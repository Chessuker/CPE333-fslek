#!/usr/bin/env bash
# Tests edge cases not touched by test_mvp.sh, following the fslek code paths one by one
# See docs/test-coverage.md for which case covers which code path
#
# How to run (inside the VM):  sudo bash tests/test_edge.sh
# Overridable variables:  MOD=path/to/fslek.ko  MNT=/mnt/fslek  MNT2=/mnt/fslek2
#
# Requires: coreutils, util-linux (runuser), python3 (without it, the python cases are SKIPped)
# Peak RAM use is about 100 MiB, during the 64 MiB file test
set -u
export LC_ALL=C	# keep error messages in English so they can be matched to errno

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="${MOD:-$SCRIPT_DIR/../fslek/fslek.ko}"
MNT="${MNT:-/mnt/fslek}"
MNT2="${MNT2:-/mnt/fslek2}"
TMP="$(mktemp -d)"
PASS=0
FAIL=0
SKIP=0

ok()   { echo "  PASS  $1"; PASS=$((PASS + 1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
skip() { echo "  SKIP  $1"; SKIP=$((SKIP + 1)); }
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }

# fails_with "description" "expected error text" command...
# Passes when the command fails and its error contains that text (strerror of the errno the kernel returned)
fails_with() {
	local d="$1" msg="$2" err
	shift 2
	if err="$("$@" 2>&1 >/dev/null)"; then
		bad "$d (command succeeded but should have failed)"
		return
	fi
	case "$err" in
	*"$msg"*) ok "$d" ;;
	*) bad "$d (got: $err)" ;;
	esac
}

eq()   { [ "$1" = "$2" ]; }
ne()   { [ "$1" != "$2" ]; }
size() { stat -c %s "$1"; }
# Bytes [skip, skip+count) of the file are all 0
zero_range() {
	[ "$(dd if="$1" iflag=skip_bytes,count_bytes skip="$2" count="$3" bs=64K status=none |
		tr -d '\000' | wc -c)" = 0 ]
}
# vmalloc memory in use (kB); fslek buffers larger than ~4 MiB come from vmalloc
vm_kb() { awk '/^VmallocUsed:/ { print $2 }' /proc/meminfo; }
unmount_count() { dmesg | grep -c 'fslek: unmounting'; }

HAVE_PY=0
command -v python3 >/dev/null 2>&1 && HAVE_PY=1
# python is used for system calls the shell cannot make directly (writev, readv, sendfile, mmap, O_EXCL, rename)
cat > "$TMP/sys.py" <<'EOF'
import mmap, os, sys

mode, path = sys.argv[1], sys.argv[2]
if mode == "writev":
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    n = os.writev(fd, [b"ab", b"cd", b"ef"])
    os.close(fd)
    sys.exit(0 if n == 6 else 1)
elif mode == "readv":
    fd = os.open(path, os.O_RDONLY)
    a, b = bytearray(2), bytearray(4)
    n = os.readv(fd, [a, b])
    os.close(fd)
    sys.exit(0 if n == 6 and a == b"ab" and b == b"cdef" else 1)
elif mode == "write0":
    fd = os.open(path, os.O_WRONLY | os.O_APPEND)
    n = os.write(fd, b"")
    os.close(fd)
    sys.exit(0 if n == 0 else 1)
elif mode == "excl":
    os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
elif mode == "mmap":
    with open(path, "r+b") as f:
        mmap.mmap(f.fileno(), 0)
elif mode == "rename":
    os.rename(path, sys.argv[3])
elif mode == "sendfile":
    src = os.open(path, os.O_RDONLY)
    dst = os.open(sys.argv[3], os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    left = os.fstat(src).st_size
    while left:
        n = os.sendfile(dst, src, None, left)
        if n == 0:
            break
        left -= n
    sys.exit(0 if left == 0 else 1)
else:
    sys.exit("unknown mode " + mode)
EOF
py() { python3 -I "$TMP/sys.py" "$@"; }

cleanup() {
	exec 3<&- 2>/dev/null
	for m in "$MNT" "$MNT2"; do mountpoint -q "$m" && umount -l "$m"; done
	lsmod | grep -qw fslek && rmmod fslek
	rm -rf "$TMP"
}
trap cleanup EXIT

if [ "$(id -u)" -ne 0 ]; then echo "must be run with sudo"; exit 1; fi
if [ ! -f "$MOD" ]; then echo "$MOD not found (run make in fslek/ first)"; exit 1; fi

for m in "$MNT" "$MNT2"; do mountpoint -q "$m" && umount "$m"; done
lsmod | grep -qw fslek && rmmod fslek
dmesg -C 2>/dev/null || true
mkdir -p "$MNT" "$MNT2"

insmod "$MOD" || { echo "insmod failed"; exit 1; }
mount -t fslek none "$MNT" || { echo "mount failed"; exit 1; }

echo "== A. Read/write at various offsets (fslek_read_iter, fslek_write_iter, fslek_reserve)"
F="$MNT/a"
printf abcdef > "$F"
printf XY | dd of="$F" bs=1 seek=2 conv=notrunc status=none
check "overwrite mid-file gives abXYef"                            eq "$(cat "$F")" abXYef
check "overwrite mid-file keeps size 6"                            eq "$(size "$F")" 6
check "read from offset 4 gives ef"                                eq "$(dd if="$F" bs=1 skip=4 status=none)" ef
check "read past end of file gives 0 bytes (EOF)"                  eq "$(dd if="$F" bs=1 skip=100 count=5 status=none | wc -c)" 0
check "asking for 100 bytes returns the 6 available"               eq "$(dd if="$F" bs=100 count=1 status=none | wc -c)" 6
check "tail -c 2 (lseek SEEK_END) gives ef"                        eq "$(tail -c 2 "$F")" ef

: > "$MNT/empty"
check "empty file has no buffer yet (0 blocks)"                    eq "$(stat -c %b "$MNT/empty")" 0
printf x > "$MNT/one"
check "1-byte file allocates the 4 KiB minimum (8 blocks x 512 B)" eq "$(stat -c %b "$MNT/one")" 8
head -c 10000 /dev/urandom > "$TMP/s10k"
dd if="$TMP/s10k" of="$MNT/small" bs=1 status=none
check "10000 one-byte writes match byte for byte"                  cmp "$TMP/s10k" "$MNT/small"
check "buffer doubles 4K>8K>16K (32 blocks)"                       eq "$(stat -c %b "$MNT/small")" 32
head -c 12288 /dev/urandom > "$TMP/s12k"
dd if="$TMP/s12k" of="$MNT/edge" bs=4096 status=none
check "4096-byte writes ending on the buffer edge match"           cmp "$TMP/s12k" "$MNT/edge"
fails_with "reading a directory as a file must fail"               "Is a directory" cat "$MNT"
if [ "$HAVE_PY" = 1 ]; then
	check "writev with 3 chunks (multi-segment iov_iter)"      py writev "$MNT/iov"
	check "content after writev is abcdef"                     eq "$(cat "$MNT/iov")" abcdef
	check "readv splits into 2 buffers correctly"              py readv "$MNT/iov"
	check "0-byte write returns 0"                             py write0 "$MNT/iov"
	check "0-byte write leaves the size unchanged"             eq "$(size "$MNT/iov")" 6
else
	skip "writev/readv/0-byte write (no python3)"
fi

echo "== B. truncate (fslek_setattr, fslek_resize)"
T="$MNT/t"
printf ABCDEFGH > "$T"
truncate -s 3 "$T"
check "shrink to 3 bytes gives ABC"                          eq "$(cat "$T")" ABC
truncate -s 8 "$T"
check "grow back to 8 bytes"                                 eq "$(size "$T")" 8
check "grown part is 0, not the old DEFGH (invariant)"       zero_range "$T" 3 5
truncate -s 0 "$T"
check "truncate -s 0 frees the whole buffer (0 blocks)"      eq "$(stat -c %b "$T")" 0
echo again > "$T"
check "can write again after truncate -s 0"                  eq "$(cat "$T")" again
: > "$MNT/grow"
truncate -s 1M "$MNT/grow"
check "truncate an empty file to 1 MiB gives the right size" eq "$(size "$MNT/grow")" 1048576
check "file grown by truncate is all 0"                      zero_range "$MNT/grow" 0 1048576
fails_with "truncate beyond 64 MiB must fail"                "File too large" truncate -s 65M "$MNT/grow"
truncate -s 0 "$MNT/grow"

echo "== C. Maximum file size 64 MiB (s_maxbytes, -EFBIG)"
check "can write a file of exactly 64 MiB"            dd if=/dev/zero of="$MNT/max" bs=1M count=64 status=none
check "size is 67108864"                              eq "$(size "$MNT/max")" 67108864
# Use dd instead of printf >> because dash reports printf errors as I/O error, hiding the real errno
fails_with "appending 1 more byte must fail"          "File too large" \
	dd if=/dev/zero of="$MNT/max" bs=1 count=1 oflag=append conv=notrunc status=none
# conv=notrunc stops dd from calling ftruncate to 64 MiB first (which would allocate another 64 MiB buffer for nothing)
fails_with "write at offset 64 MiB must fail"         "File too large" \
	dd if=/dev/zero of="$MNT/max2" bs=1 count=1 seek=64M conv=notrunc status=none
check "64 MiB file is intact after the failed writes" eq "$(size "$MNT/max")" 67108864
truncate -s 0 "$MNT/max"

echo "== D. Timestamps and metadata (setattr_copy, inode_init_owner)"
m0="$(stat -c %y "$F")"
c0="$(stat -c %z "$F")"
echo more >> "$F"
check "write changes mtime"                                ne "$(stat -c %y "$F")" "$m0"
check "write changes ctime"                                ne "$(stat -c %z "$F")" "$c0"
d0="$(stat -c %y "$MNT")"
touch "$MNT/newfile"
check "creating a file changes the parent directory mtime" ne "$(stat -c %y "$MNT")" "$d0"
s0="$(size "$F")"
touch "$F"
check "touch on an existing file keeps its content"        eq "$(size "$F")" "$s0"
touch -d '2001-02-03 04:05:06' "$F"
check "touch -d can set mtime in the past"                 eq "$(stat -c %Y "$F")" "$(date -d '2001-02-03 04:05:06' +%s)"
chmod 600 "$F"
check "chmod 600 file"                                     eq "$(stat -c %a "$F")" 600
mkdir "$MNT/cm"
chmod 700 "$MNT/cm"
check "chmod 700 directory"                                eq "$(stat -c %a "$MNT/cm")" 700
chown 65534:65534 "$F"
check "chown to 65534:65534"                               eq "$(stat -c %u:%g "$F")" 65534:65534
(umask 077; touch "$MNT/um"; mkdir "$MNT/umd")
check "umask 077: new file gets 600"                       eq "$(stat -c %a "$MNT/um")" 600
check "umask 077: new directory gets 700"                  eq "$(stat -c %a "$MNT/umd")" 700

echo "== E. Directories and file names (fslek_mknod, simple_lookup, simple_dir_operations)"
mkdir "$MNT/n"
for i in 1 2 3 4 5; do mkdir "$MNT/n/s$i"; done
check "directory with 5 subdirectories has nlink = 7"             eq "$(stat -c %h "$MNT/n")" 7
check "regular file has nlink = 1"                                eq "$(stat -c %h "$MNT/one")" 1
check "find counts 6 directories"                                 eq "$(find "$MNT/n" -type d | wc -l)" 6
L255="$(printf 'a%.0s' $(seq 255))"
check "can create a 255-character name"                           touch "$MNT/n/$L255"
fails_with "256-character name must fail"                         "File name too long" touch "$MNT/n/${L255}b"
check "can create a name with Thai, spaces and parentheses"       touch "$MNT/n/ไฟล์ ทดสอบ (1).txt"
check "file with a Thai name can be found"                        test -e "$MNT/n/ไฟล์ ทดสอบ (1).txt"
mkdir "$MNT/many"
for i in $(seq 1000); do : > "$MNT/many/f$i"; done
check "ls shows all 1000 created files"                           eq "$(ls "$MNT/many" | wc -l)" 1000
check "ls -a shows 2 more: . and .."                              eq "$(ls -a "$MNT/many" | wc -l)" 1002
check "relative path after cd"                                    sh -c "cd '$MNT/n' && echo rel > s1/r.txt && [ \"\$(cat ../n/s1/r.txt)\" = rel ]"
fails_with "creating a file under a regular file must fail"       "Not a directory" touch "$MNT/one/x"
fails_with "opening a missing file must fail"                     "No such file or directory" cat "$MNT/nope"
fails_with "mkdir under a missing parent must fail"               "No such file or directory" mkdir "$MNT/nope/x"
if [ "$HAVE_PY" = 1 ]; then
	fails_with "O_CREAT|O_EXCL on an existing file must fail" "File exists" py excl "$MNT/one"
else
	skip "O_CREAT|O_EXCL (no python3)"
fi

echo "== F. User permissions (inode_init_owner + VFS permission checks)"
if command -v runuser >/dev/null 2>&1 && id nobody >/dev/null 2>&1; then
	NB_UID="$(id -u nobody)"
	NB_GID="$(id -g nobody)"
	as_nobody() { runuser -u nobody -- "$@"; }
	mkdir "$MNT/perm"
	echo secret > "$MNT/perm/rootfile"
	fails_with "nobody cannot create a file in a root-owned 755 directory" "Permission denied" as_nobody touch "$MNT/perm/x"
	fails_with "nobody cannot write a root-owned 644 file"                 "Permission denied" as_nobody sh -c "echo x >> '$MNT/perm/rootfile'"
	check      "nobody can read a root-owned 644 file"                     as_nobody cat "$MNT/perm/rootfile"
	chmod 600 "$MNT/perm/rootfile"
	fails_with "nobody cannot read a root-owned 600 file"                  "Permission denied" as_nobody cat "$MNT/perm/rootfile"
	chmod 1777 "$MNT/perm"
	check      "nobody can create a file after chmod 1777"                 as_nobody touch "$MNT/perm/mine"
	check      "file created by nobody is owned by nobody"                 eq "$(stat -c %u "$MNT/perm/mine")" "$NB_UID"
	mkdir "$MNT/sg"
	chgrp "$NB_GID" "$MNT/sg"
	chmod 2775 "$MNT/sg"
	touch "$MNT/sg/x"
	mkdir "$MNT/sg/sub"
	check      "setgid directory: new file gets the directory group"       eq "$(stat -c %g "$MNT/sg/x")" "$NB_GID"
	check      "setgid directory: subdirectory inherits setgid"            test -g "$MNT/sg/sub"
else
	skip "permission tests (no runuser or no nobody user)"
fi

echo "== G. sendfile/splice, fsync, statfs (other file_operations and super_operations)"
check "dd conv=fsync (noop_fsync) succeeds"                  dd if=/dev/zero of="$MNT/fs" bs=4K count=4 conv=fsync status=none
check "sync -f succeeds"                                     sync -f "$MNT"
check "statfs: magic is 46534c4b (FSLK)"                     eq "$(stat -f -c %t "$MNT")" 46534c4b
check "statfs: maximum name length is 255"                   eq "$(stat -f -c %l "$MNT")" 255
check "df works on fslek"                                    df "$MNT"
if [ "$HAVE_PY" = 1 ]; then
	head -c 3M /dev/urandom > "$TMP/s3m"
	check "sendfile into fslek (iter_file_splice_write)" py sendfile "$TMP/s3m" "$MNT/sf"
	check "data sent into fslek matches byte for byte"   cmp "$TMP/s3m" "$MNT/sf"
	check "sendfile out of fslek (copy_splice_read)"     py sendfile "$MNT/sf" "$TMP/back"
	check "data sent out of fslek matches byte for byte" cmp "$TMP/s3m" "$TMP/back"
else
	skip "sendfile (no python3)"
fi

echo "== H. Current limits (operations fslek does not have)"
mkdir "$MNT/lim"
echo data > "$MNT/lim/f"
fails_with "ln hard link (no .link)"                 "Operation not permitted" ln "$MNT/lim/f" "$MNT/lim/h"
fails_with "ln -s (no .symlink)"                     "Operation not permitted" ln -s f "$MNT/lim/s"
fails_with "mkfifo (no .mknod)"                      "Operation not permitted" mkfifo "$MNT/lim/p"
fails_with "open with O_DIRECT (no direct_IO)"       "Invalid argument" \
	dd if=/dev/zero of="$MNT/lim/f" bs=4096 count=1 oflag=direct conv=notrunc status=none
if [ "$HAVE_PY" = 1 ]; then
	fails_with "mmap (no .mmap)"                 "No such device" py mmap "$MNT/lim/f"
else
	skip "mmap (no python3)"
fi
check "file is intact after all the failed commands" eq "$(cat "$MNT/lim/f")" data

echo "== I. Module and mount lifecycle (super.c)"
fails_with "rmmod while still mounted must fail"               "in use" rmmod fslek
echo keep > "$MNT/keep"
exec 3< "$MNT/keep"
fails_with "umount with an open file must fail"                "busy" umount "$MNT"
before="$(unmount_count)"
check "umount -l (lazy) with an open file"                     umount -l "$MNT"
check "open fd is still readable after lazy umount"            eq "$(cat <&3)" keep
check "super_block is not destroyed while the fd is open"      eq "$(unmount_count)" "$before"
exec 3<&-
for i in 1 2 3 4 5 6 7 8 9 10; do
	[ "$(unmount_count)" -gt "$before" ] && break
	sleep 0.2
done
check "closing the fd destroys the super_block (kill_sb)"      eq "$(unmount_count)" "$((before + 1))"

mount -t fslek none "$MNT"
mount -t fslek none "$MNT2"
echo one > "$MNT/only1"
check "two mounts get separate super_blocks"                   ne "$(stat -c %d "$MNT")" "$(stat -c %d "$MNT2")"
check "file created in one mount does not appear in the other" test ! -e "$MNT2/only1"
umount "$MNT2"
check "first mount still works after the second is unmounted"  eq "$(cat "$MNT/only1")" one
umount "$MNT"

echo "== J. Memory release (fslek_evict_inode, kvfree)"
mount -t fslek none "$MNT"
v0="$(vm_kb)"
dd if=/dev/zero of="$MNT/m1" bs=1M count=32 status=none
v1="$(vm_kb)"
echo "  (VmallocUsed: before $v0 kB, after writing 32 MiB $v1 kB)"
check "32 MiB file uses at least 30 MiB more vmalloc"               test "$((v1 - v0))" -ge 30720
truncate -s 0 "$MNT/m1"
check "vmalloc is back near the start after truncate -s 0"          test "$(($(vm_kb) - v0))" -le 4096
dd if=/dev/zero of="$MNT/m1" bs=1M count=32 status=none
umount "$MNT"
check "vmalloc is back near the start after umount"                 test "$(($(vm_kb) - v0))" -le 4096

v0="$(vm_kb)"
rounds=0
for r in $(seq 20); do
	mount -t fslek none "$MNT" || break
	mkdir "$MNT/d"
	for i in 1 2 3 4 5; do head -c 6M /dev/zero > "$MNT/d/f$i"; done
	umount "$MNT" || break
	rounds=$((rounds + 1))
done
check "mount/write 5x6 MiB/umount completes 20 rounds"              eq "$rounds" 20
check "no vmalloc leak after 20 rounds (a leak would lose 800 MiB)" test "$(($(vm_kb) - v0))" -le 4096

echo "== K. Delete (simple_unlink, simple_rmdir, fslek_evict_inode)"
mount -t fslek none "$MNT"
# Set the root mtime to the past so that any later change is visible regardless of clock granularity
old="$(date -d '2001-02-03 04:05:06' +%s)"
echo bye > "$MNT/f"
touch -d '2001-02-03 04:05:06' "$MNT"
check "rm file"                                               rm "$MNT/f"
check "removed file is gone from ls"                          eq "$(ls -A "$MNT")" ""
check "rm changes the parent directory mtime"                 ne "$(stat -c %Y "$MNT")" "$old"
fails_with "opening a removed file must fail"                 "No such file or directory" cat "$MNT/f"
fails_with "rm of a missing file must fail"                   "No such file or directory" rm "$MNT/f"
echo new > "$MNT/f"
check "same name can be created again with new content"       eq "$(cat "$MNT/f")" new

n0="$(stat -c %h "$MNT")"
mkdir "$MNT/d"
touch -d '2001-02-03 04:05:06' "$MNT"
check "rmdir empty directory"                                 rmdir "$MNT/d"
check "rmdir brings the parent nlink back"                    eq "$(stat -c %h "$MNT")" "$n0"
check "rmdir changes the parent directory mtime"              ne "$(stat -c %Y "$MNT")" "$old"
mkdir -p "$MNT/full/sub"
echo data > "$MNT/full/x"
fails_with "rmdir of a non-empty directory must fail"         "Directory not empty" rmdir "$MNT/full"
check "contents are intact after the failed rmdir"            eq "$(cat "$MNT/full/x")" data
# unlink(1) calls unlink(2) directly, while rm checks the file type by itself first
fails_with "unlink(2) on a directory must fail"               "Is a directory" unlink "$MNT/full"
fails_with "rmdir on a regular file must fail"                "Not a directory" rmdir "$MNT/f"
mkdir "$MNT/cwd"
fails_with "creating a file in a removed directory must fail" "No such file or directory" \
	sh -c "cd '$MNT/cwd' && rmdir '$MNT/cwd' && touch x"
for i in $(seq 1000); do : > "$MNT/full/sub/f$i"; done
check "rm -r a tree with 1000 files"                          rm -r "$MNT/full"
check "the tree is gone"                                      test ! -e "$MNT/full"

# 4 workers create, write and remove files in the same directory at once
mkdir "$MNT/par"
for w in 1 2 3 4; do
	( for i in $(seq 100); do
		echo "$w-$i" > "$MNT/par/$w-$i" && rm "$MNT/par/$w-$i" || echo "$w-$i" >> "$TMP/parerr"
	done ) 2>/dev/null &
done
wait
check "4 workers creating and removing 100 files each"        test ! -e "$TMP/parerr"
check "shared directory is empty afterwards"                  rmdir "$MNT/par"

if [ -n "${NB_UID:-}" ]; then
	mkdir "$MNT/perm"
	echo x > "$MNT/perm/rootfile"
	fails_with "nobody cannot remove a file in a root-owned 755 directory" "Permission denied" as_nobody unlink "$MNT/perm/rootfile"
	chmod 1777 "$MNT/perm"
	as_nobody touch "$MNT/perm/mine"
	fails_with "sticky directory: nobody cannot remove a file of root"     "Operation not permitted" as_nobody unlink "$MNT/perm/rootfile"
	check "sticky directory: nobody can remove their own file"             as_nobody unlink "$MNT/perm/mine"
else
	skip "delete permission tests (no runuser or no nobody user)"
fi

# A removed file stays usable through an open fd and is freed when the last fd is closed
echo keep > "$MNT/open"
exec 3<> "$MNT/open"
check "rm a file that is still open"                          rm "$MNT/open"
check "its name is gone right away"                           test ! -e "$MNT/open"
check "nlink through the open fd is 0"                        eq "$(stat -L -c %h "/proc/$$/fd/3")" 0
check "open fd is still readable"                             eq "$(cat <&3)" keep
echo more >&3
check "open fd is still writable (5 + 5 bytes)"               eq "$(stat -L -c %s "/proc/$$/fd/3")" 10
fails_with "umount with a removed but open file must fail"    "busy" umount "$MNT"
exec 3<&-

v0="$(vm_kb)"
dd if=/dev/zero of="$MNT/m1" bs=1M count=32 status=none
v1="$(vm_kb)"
rm "$MNT/m1"
v2="$(vm_kb)"
echo "  (VmallocUsed: before $v0 kB, after writing 32 MiB $v1 kB, after rm $v2 kB)"
check "32 MiB file uses at least 30 MiB more vmalloc"         test "$((v1 - v0))" -ge 30720
check "vmalloc is back near the start after rm"               test "$((v2 - v0))" -le 4096
dd if=/dev/zero of="$MNT/m2" bs=1M count=32 status=none
exec 3< "$MNT/m2"
rm "$MNT/m2"
check "buffer is kept while the removed file is open"         test "$(($(vm_kb) - v0))" -ge 30720
exec 3<&-
check "closing the fd frees the buffer"                       test "$(($(vm_kb) - v0))" -le 4096
for i in $(seq 50); do head -c 6M /dev/zero > "$MNT/m3" && rm "$MNT/m3"; done
check "no vmalloc leak after 50 write/rm rounds"              test "$(($(vm_kb) - v0))" -le 4096
check "umount after deleting files"                           umount "$MNT"

echo "== L. Rename (simple_rename)"
mount -t fslek none "$MNT"
mkdir "$MNT/p1" "$MNT/p2"
echo data > "$MNT/a"
ino="$(stat -c %i "$MNT/a")"
touch -d '2001-02-03 04:05:06' "$MNT"
check "mv in the same directory"                                 mv "$MNT/a" "$MNT/b"
check "old name is gone"                                         test ! -e "$MNT/a"
check "content is unchanged"                                     eq "$(cat "$MNT/b")" data
check "inode number is unchanged (nothing is copied)"            eq "$(stat -c %i "$MNT/b")" "$ino"
check "mv changes the parent directory mtime"                    ne "$(stat -c %Y "$MNT")" "$old"
check "mv into another directory"                                mv "$MNT/b" "$MNT/p1/c"
check "inode number is unchanged across directories"             eq "$(stat -c %i "$MNT/p1/c")" "$ino"
echo target > "$MNT/t"
check "mv onto an existing file"                                 mv "$MNT/p1/c" "$MNT/t"
check "target now has the source content"                        eq "$(cat "$MNT/t")" data
check "target nlink is 1"                                        eq "$(stat -c %h "$MNT/t")" 1
fails_with "mv of a missing file must fail"                      "No such file or directory" mv "$MNT/nope" "$MNT/x"

exec 3< "$MNT/t"
mv "$MNT/t" "$MNT/p2/t"
check "open fd is still readable after mv"                       eq "$(cat <&3)" data
exec 3<&-

mkdir -p "$MNT/p1/tree/sub"
echo deep > "$MNT/p1/tree/sub/f"
check "mv a whole directory into another directory"              mv "$MNT/p1/tree" "$MNT/p2/"
check "files inside the moved directory are readable"            eq "$(cat "$MNT/p2/tree/sub/f")" deep
check "old parent nlink drops to 2"                              eq "$(stat -c %h "$MNT/p1")" 2
check "new parent nlink rises to 3"                              eq "$(stat -c %h "$MNT/p2")" 3
check ".. of the moved directory is the new parent"              eq "$(stat -c %i "$MNT/p2/tree/..")" "$(stat -c %i "$MNT/p2")"
mkdir "$MNT/p1/empty" "$MNT/p1/src"
check "mv a directory onto an empty directory"                   mv -T "$MNT/p1/src" "$MNT/p1/empty"
check "parent nlink is 3 after the replace"                      eq "$(stat -c %h "$MNT/p1")" 3
fails_with "mv a directory onto a non-empty directory must fail" "Directory not empty" mv -T "$MNT/p1/empty" "$MNT/p2/tree"
if [ "$HAVE_PY" = 1 ]; then
	fails_with "rename(2) file onto a directory must fail"      "Is a directory" py rename "$MNT/p2/t" "$MNT/p1"
	fails_with "rename(2) directory onto a file must fail"      "Not a directory" py rename "$MNT/p1" "$MNT/p2/t"
	fails_with "rename(2) directory into itself must fail"      "Invalid argument" py rename "$MNT/p2" "$MNT/p2/tree/x"
	mount -t fslek none "$MNT2"
	fails_with "rename(2) to another mount must fail"           "Invalid cross-device link" py rename "$MNT/p2/t" "$MNT2/t"
	umount "$MNT2"
else
	skip "rename(2) error cases (no python3)"
fi
check "contents are intact after the failed renames"             eq "$(cat "$MNT/p2/t" "$MNT/p2/tree/sub/f" | tr '\n' ' ')" "data deep "

head -c 1M /dev/urandom > "$TMP/mv1m"
cp "$TMP/mv1m" "$MNT/out"
check "mv out to another file system (copy + unlink)"            mv "$MNT/out" "$TMP/out"
check "file moved out matches byte for byte"                     cmp "$TMP/mv1m" "$TMP/out"
check "file moved out is gone from fslek"                        test ! -e "$MNT/out"
check "mv in from another file system"                           mv "$TMP/out" "$MNT/in"
check "file moved in matches byte for byte"                      cmp "$TMP/mv1m" "$MNT/in"

if [ -n "${NB_UID:-}" ]; then
	fails_with "nobody cannot mv in a root-owned 755 directory" "Permission denied" as_nobody mv "$MNT/in" "$MNT/stolen"
else
	skip "rename permission test (no runuser or no nobody user)"
fi

# 4 workers rename their own file back and forth in the same directory at once
mkdir "$MNT/par"
for w in 1 2 3 4; do
	( echo "$w" > "$MNT/par/$w"
	for i in $(seq 100); do
		mv "$MNT/par/$w" "$MNT/par/$w.tmp" && mv "$MNT/par/$w.tmp" "$MNT/par/$w" || echo "$w-$i" >> "$TMP/mverr"
	done ) 2>/dev/null &
done
wait
check "4 workers renaming 200 times each"                        test ! -e "$TMP/mverr"
check "every file is there with its own content"                 eq "$(cd "$MNT/par" && cat 1 2 3 4 | tr -d '\n')$(ls "$MNT/par" | wc -l)" 12344

v0="$(vm_kb)"
dd if=/dev/zero of="$MNT/m1" bs=1M count=32 status=none
echo small > "$MNT/m2"
mv "$MNT/m2" "$MNT/m1"
check "replacing a 32 MiB file by mv frees its buffer"           test "$(($(vm_kb) - v0))" -le 4096
check "umount after renames"                                     umount "$MNT"

# M stands for test_mvp.sh in docs/test-coverage.md, so there is no section M here
echo "== N. Mount option size= and df (fslek_parse_param, fslek_charge, fslek_statfs)"
df_k() { df -k --output="$1" "$2" | tail -n 1 | tr -d ' '; }
mem_kb() { awk '/^MemTotal:/ { print $2 }' /proc/meminfo; }
mount -t fslek none "$MNT"
check "default size is half of RAM"                      eq "$(df_k size "$MNT")" "$(($(mem_kb) / 8 * 4))"
check "findmnt shows the default size"                   sh -c "findmnt -n -o OPTIONS '$MNT' | grep -q 'size=$(df_k size "$MNT")k'"
umount "$MNT"

check "mount -o size=1M"                                 mount -t fslek -o size=1M none "$MNT"
check "findmnt shows size=1024k"                         sh -c "findmnt -n -o OPTIONS '$MNT' | grep -qw size=1024k"
check "df: size is 1024 kB"                              eq "$(df_k size "$MNT")" 1024
check "df: nothing is used yet"                          eq "$(df_k used "$MNT")" 0
check "df: 1024 kB is available"                         eq "$(df_k avail "$MNT")" 1024
printf x > "$MNT/one"
check "df: a 1-byte file uses 4 kB"                      eq "$(df_k used "$MNT")" 4
fails_with "one 2 MiB write must fail"                   "No space left on device" dd if=/dev/zero of="$MNT/two" bs=2M count=1 status=none
check "failed write leaves nothing charged"              eq "$(df_k used "$MNT")" 4
fails_with "truncate to 2 MiB must fail"                 "No space left on device" truncate -s 2M "$MNT/two"
check "failed truncate keeps size 0"                     eq "$(size "$MNT/two")" 0
fails_with "filling up with 4 KiB writes must fail"      "No space left on device" dd if=/dev/zero of="$MNT/fill" bs=4K status=none
check "the file filled exactly what was left (1020 kB)"  eq "$(size "$MNT/fill")" 1044480
check "df: nothing is available"                         eq "$(df_k avail "$MNT")" 0
fails_with "writing 1 byte to a new file must fail"      "No space left on device" dd if=/dev/zero of="$MNT/new" bs=1 count=1 status=none
check "creating an empty file still works"               touch "$MNT/zero"
check "overwriting in place still works when full"       dd if=/dev/urandom of="$MNT/fill" bs=4K count=4 conv=notrunc status=none
check "writing into already allocated space still works" sh -c "printf yz >> '$MNT/one' && [ \"\$(cat '$MNT/one')\" = xyz ]"
mount -t fslek -o size=1M none "$MNT2"
check "another mount has its own quota"                  dd if=/dev/zero of="$MNT2/f" bs=512K count=2 status=none
umount "$MNT2"

exec 3< "$MNT/fill"
rm "$MNT/fill"
check "df: a removed but open file still counts"         eq "$(df_k avail "$MNT")" 0
exec 3<&-
check "df: closing it gives 1020 kB back"                eq "$(df_k avail "$MNT")" 1020
check "can write again after the space is freed"         dd if=/dev/zero of="$MNT/again" bs=64K count=8 status=none
truncate -s 0 "$MNT/again"
check "df: truncate -s 0 gives the space back"           eq "$(df_k avail "$MNT")" 1020

dd if=/dev/zero of="$MNT/keep" bs=512K count=1 status=none
check "remount with a larger size"                       mount -o remount,size=2M "$MNT"
check "df: size is now 2048 kB"                          eq "$(df_k size "$MNT")" 2048
check "remount keeps the data"                           eq "$(size "$MNT/keep")" 524288
check "remount below the space in use must fail"         sh -c "! mount -o remount,size=64K '$MNT'"
check "df: size is still 2048 kB"                        eq "$(df_k size "$MNT")" 2048
check "remount to exactly the space in use"              mount -o remount,size=516K "$MNT"
check "df: nothing is available after shrinking"         eq "$(df_k avail "$MNT")" 0
umount "$MNT"

for bad in size=abc size=0 size=-1 size=1Mx size= nosuchoption=1; do
	check "mount -o $bad must fail" sh -c "! mount -t fslek -o '$bad' none '$MNT'"
	mountpoint -q "$MNT" && umount "$MNT"
done
mount -t fslek -o size=5000 none "$MNT"
check "size=5000 is rounded up to 2 pages"               eq "$(df_k size "$MNT")" 8
umount "$MNT"

# 4 writers compete for the same quota; the total must never exceed it
mount -t fslek -o size=8M none "$MNT"
for w in 1 2 3 4; do
	dd if=/dev/zero of="$MNT/w$w" bs=4K status=none 2>/dev/null &
done
wait
check "4 writers fill the quota exactly"                 eq "$(df_k avail "$MNT")" 0
check "allocated blocks add up to 8 MiB"                 eq "$(stat -c %b "$MNT"/w* | awk '{ s += $1 } END { print s * 512 }')" 8388608
rm "$MNT"/w*
check "df: everything is free again"                     eq "$(df_k used "$MNT")" 0
umount "$MNT"

echo "== P. Statistics in /proc/fslek (stats.c)"
st() { awk -v k="$1" '$1 == k { print $2 }' /proc/fslek; }
check "/proc/fslek exists"                                     test -f /proc/fslek
check "no files while nothing is mounted"                      eq "$(st files)" 0
check "no directories while nothing is mounted"                eq "$(st directories)" 0
check "no bytes while nothing is mounted (no accounting leak)" eq "$(st bytes)" 0
mount -t fslek none "$MNT"
check "a fresh mount has 1 directory (its root)"               eq "$(st directories)" 1
g0="$(st grows)"
touch "$MNT/f"
check "touch: 1 file"                                          eq "$(st files)" 1
check "touch: an empty file has 0 bytes"                       eq "$(st bytes)" 0
printf x > "$MNT/f"
check "1-byte write: 4096 bytes"                               eq "$(st bytes)" 4096
check "1-byte write: buffer grew once"                         eq "$(st grows)" "$((g0 + 1))"
g0="$(st grows)"
dd if=/dev/zero of="$MNT/g" bs=1000 count=10 status=none
check "10000 bytes in small writes: grew 3 times (4K>8K>16K)"  eq "$(st grows)" "$((g0 + 3))"
check "bytes is 4096 + 16384"                                  eq "$(st bytes)" 20480
mkdir "$MNT/d"
check "mkdir: 2 directories"                                   eq "$(st directories)" 2
mv "$MNT/f" "$MNT/d/f"
check "mv does not change the counters"                        eq "$(st files) $(st directories) $(st bytes)" "2 2 20480"
mount -t fslek none "$MNT2"
touch "$MNT2/h"
check "counters cover every mount"                             eq "$(st files) $(st directories)" "3 3"
umount "$MNT2"
check "umount takes its files and directories away"            eq "$(st files) $(st directories)" "2 2"
truncate -s 0 "$MNT/g"
check "truncate -s 0 takes the bytes away"                     eq "$(st bytes)" 4096
exec 3< "$MNT/d/f"
rm "$MNT/d/f"
check "a removed but open file still counts"                   eq "$(st files) $(st bytes)" "2 4096"
exec 3<&-
check "closing it takes it away"                               eq "$(st files) $(st bytes)" "1 0"
rmdir "$MNT/d"
check "rmdir: 1 directory"                                     eq "$(st directories)" 1
for w in 1 2 3 4; do
	( for i in $(seq 100); do
		echo x > "$MNT/c$w-$i"
		rm "$MNT/c$w-$i"
	done ) &
done
wait
check "counters are exact after 4 concurrent workers"          eq "$(st files) $(st bytes)" "1 0"
if [ -n "${NB_UID:-}" ]; then
	check "nobody can read /proc/fslek" as_nobody cat /proc/fslek
else
	skip "reading /proc/fslek as nobody (no runuser or no nobody user)"
fi
umount "$MNT"
check "umount: every counter is back to 0"                     eq "$(st files) $(st directories) $(st bytes)" "0 0 0"

echo "== Unload module"
check "rmmod fslek"                   rmmod fslek
check "/proc/fslek is gone"           test ! -e /proc/fslek
check "dmesg has no BUG/Oops/WARNING" sh -c "! dmesg | grep -Eq 'BUG|Oops|WARNING|general protection'"

echo
echo "Summary: PASS=$PASS FAIL=$FAIL SKIP=$SKIP"
[ "$FAIL" -eq 0 ]
