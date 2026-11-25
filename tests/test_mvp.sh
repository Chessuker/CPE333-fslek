#!/usr/bin/env bash
# Tests the 7 required fslek operations plus concurrent read/write (31 cases in total)
# How to run (inside the VM):  sudo ./tests/test_mvp.sh
# Overridable variables:  MOD=path/to/fslek.ko  MNT=/mnt/fslek
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="${MOD:-$SCRIPT_DIR/../fslek/fslek.ko}"
MNT="${MNT:-/mnt/fslek}"
TMP="$(mktemp -d)"
PASS=0
FAIL=0

ok()   { echo "  PASS  $1"; PASS=$((PASS + 1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }

cleanup() {
	mountpoint -q "$MNT" && umount "$MNT"
	lsmod | grep -qw fslek && rmmod fslek
	rm -rf "$TMP"
}
trap cleanup EXIT

if [ "$(id -u)" -ne 0 ]; then echo "must be run with sudo"; exit 1; fi
if [ ! -f "$MOD" ]; then echo "$MOD not found (run make in fslek/ first)"; exit 1; fi

# Clean up leftovers from a previous run
mountpoint -q "$MNT" && umount "$MNT"
lsmod | grep -qw fslek && rmmod fslek
dmesg -C 2>/dev/null || true

echo "== Load module"
check "insmod fslek.ko"                      insmod "$MOD"
check "fslek is listed in /proc/filesystems" grep -qw fslek /proc/filesystems

echo "== 1. Mount"
mkdir -p "$MNT"
check "mount -t fslek"               mount -t fslek none "$MNT"
check "findmnt reports fstype fslek" sh -c "findmnt -n -o FSTYPE '$MNT' | grep -qx fslek"

echo "== 2. Create file"
check "touch a.txt"               touch "$MNT/a.txt"
check "a.txt is a file of size 0" sh -c "[ -f '$MNT/a.txt' ] && [ ! -s '$MNT/a.txt' ]"

echo "== 3-4. Write / Read file"
echo hello > "$MNT/a.txt"
check "echo hello > a.txt, then cat returns hello" sh -c "[ \"\$(cat '$MNT/a.txt')\" = hello ]"
echo world >> "$MNT/a.txt"
check "append (>>) gives 2 lines"                  sh -c "[ \"\$(cat '$MNT/a.txt')\" = \"\$(printf 'hello\nworld')\" ]"
echo x > "$MNT/a.txt"
check "overwrite (>) leaves 2 bytes"               sh -c "[ \"\$(stat -c %s '$MNT/a.txt')\" = 2 ]"

head -c 5M /dev/urandom > "$TMP/big"
check "cp a 5 MiB file in"                         cp "$TMP/big" "$MNT/big"
check "5 MiB file reads back byte for byte"        cmp "$TMP/big" "$MNT/big"

printf Z | dd of="$MNT/sparse" bs=1 seek=10000 conv=notrunc status=none
check "write at offset 10000 gives size 10001"     sh -c "[ \"\$(stat -c %s '$MNT/sparse')\" = 10001 ]"
check "everything before the offset is 0"          sh -c "[ \"\$(head -c 10000 '$MNT/sparse' | tr -d '\\000' | wc -c)\" = 0 ]"

truncate -s 0 "$MNT/big"
check "truncate -s 0"                              sh -c "[ ! -s '$MNT/big' ]"

echo "== 5. Create directory"
check "mkdir dir"                                      mkdir "$MNT/dir"
check "mkdir -p dir/sub/deep"                          mkdir -p "$MNT/dir/sub/deep"
check "create a file in a subdirectory"                sh -c "echo nested > '$MNT/dir/sub/deep/n.txt'"
check "read a file in a subdirectory"                  sh -c "[ \"\$(cat '$MNT/dir/sub/deep/n.txt')\" = nested ]"
check "mkdir with an existing name must fail (EEXIST)" sh -c "! mkdir '$MNT/dir' 2>/dev/null"

echo "== 6. List directory"
ls -la "$MNT"
check "ls shows a.txt big sparse dir" sh -c "[ \"\$(ls '$MNT' | tr '\n' ' ')\" = 'a.txt big dir sparse ' ]"
check "ls dir/sub shows deep"         sh -c "[ \"\$(ls '$MNT/dir/sub')\" = deep ]"

echo "== Extra: concurrent read/write"
# Answers the question on page 8 of the Kernel_memory_mutex slides: what happens if read and write are called at the same time
# The code guards against this with inode_lock in fslek_write_iter / inode_lock_shared in fslek_read_iter
mkdir -p "$MNT/conc"

# 8.1 8 writers append to the same file at once, 1000 lines each
# Without the lock, lines get lost (two writers get the same end-of-file position) or overwrite each other
for w in 0 1 2 3 4 5 6 7; do
	( for i in $(seq 1000); do echo "w$w-0123456789" >> "$MNT/conc/log"; done ) &
done
wait
check "8x1000 concurrent appends give all 8000 lines"                sh -c "[ \"\$(wc -l < '$MNT/conc/log')\" = 8000 ]"
check "no line is corrupted by overlapping writes"                   sh -c "! grep -qvx 'w[0-7]-0123456789' '$MNT/conc/log'"
check "each writer has all 1000 lines"                               sh -c "[ \"\$(cut -d- -f1 '$MNT/conc/log' | sort | uniq -c | awk '\$1 == 1000' | wc -l)\" = 8 ]"

# 8.2 A writer grows the file 1 KiB at a time up to 16 MiB (the buffer is reallocated and copied several times)
# Meanwhile 4 readers keep rereading the whole file, and every read must match an exact prefix of the source
# If a reader touched the old buffer the writer had just freed with kvfree, it would get garbage or a kernel Oops
head -c 16M /dev/urandom > "$TMP/src"
: > "$MNT/conc/grow"
for r in 1 2 3 4; do
	(
		n=0
		while [ ! -e "$TMP/wdone" ]; do
			cat "$MNT/conc/grow" > "$TMP/snap$r"
			cmp -s -n "$(stat -c %s "$TMP/snap$r")" "$TMP/snap$r" "$TMP/src" ||
				echo "reader $r" >> "$TMP/readerr"
			n=$((n + 1))
		done
		echo "$n" >> "$TMP/reads"
	) &
done
dd if="$TMP/src" of="$MNT/conc/grow" bs=1024 oflag=append conv=notrunc status=none
touch "$TMP/wdone"
wait
echo "  (4 readers read the whole file $(awk '{ s += $1 } END { print s }' "$TMP/reads") times in total while it grew)"
check "file grown while being read matches the source byte for byte" cmp "$TMP/src" "$MNT/conc/grow"
check "every read is an exact prefix of the source"                  sh -c "[ ! -e '$TMP/readerr' ]"

echo "== 7. Unmount"
check "umount"            umount "$MNT"
check "no longer mounted" sh -c "! mountpoint -q '$MNT'"

echo "== Data really is in RAM: a fresh mount must be empty"
mount -t fslek none "$MNT"
check "fresh mount has no old files" sh -c "[ -z \"\$(ls -A '$MNT')\" ]"
umount "$MNT"

echo "== Unload module"
check "rmmod fslek"                   rmmod fslek
check "dmesg has no BUG/Oops/WARNING" sh -c "! dmesg | grep -Eq 'BUG|Oops|WARNING|general protection'"

echo
echo "fslek dmesg:"
dmesg | grep fslek | tail -n 10
echo
echo "Summary: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" -eq 0 ]
