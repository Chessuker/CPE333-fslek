#!/usr/bin/env bash
# Step-by-step fslek demo, waits for Enter at every step so the screen can be captured
# Step numbers match the image names in docs/captures.md
#
#   sudo bash tests/demo.sh              pause at every step (for captures/live demo)
#   sudo NOPAUSE=1 bash tests/demo.sh    run straight through (for the backup video)
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$SCRIPT_DIR/.."
MOD="$ROOT/fslek/fslek.ko"
MNT="${MNT:-/mnt/fslek}"
BIG=/tmp/fslek-big.bin

B=$'\e[1;36m'; C=$'\e[1;33m'; N=$'\e[0m'

step() {
	if [ -n "${STARTED:-}" ] && [ -z "${NOPAUSE:-}" ]; then
		read -rp $'\n[Enter] next step ' _
	fi
	STARTED=1
	clear
	echo "${B}==== $* ====${N}"
	echo
}
# Print the command before running it, so captures show both the command and its output
run() {
	echo "${C}\$ $*${N}"
	eval "$@"
	echo
}

if [ "$(id -u)" -ne 0 ]; then echo "must be run with sudo"; exit 1; fi

# Clean up leftovers from a previous run (not shown in captures)
mountpoint -q "$MNT" && umount "$MNT"
lsmod | grep -qw fslek && rmmod fslek
dmesg -C 2>/dev/null || true

step "01 Environment"
run "uname -r"
run "lsb_release -ds"

step "02 Build module"
# Build as the original user (not root), otherwise root owns the build files and a later make fails
BUILD_USER="${SUDO_USER:-root}"
sudo -u "$BUILD_USER" make -C "$ROOT/fslek" clean >/dev/null 2>&1
run "sudo -u $BUILD_USER make -C '$ROOT/fslek' 2>&1 | grep -E 'fslek:|CC|LD|error'"
run "ls -l '$MOD'"

step "03 Load module"
run "insmod '$MOD'"
run "lsmod | grep -w fslek"
run "grep -w fslek /proc/filesystems"

step "04 Mount"
run "mkdir -p $MNT"
run "mount -t fslek none $MNT"
run "findmnt $MNT"
run "ls -la $MNT"

step "05 Create file"
run "touch $MNT/hello.txt"
run "ls -l $MNT"

step "06 Write and read file"
run "echo 'Hello from fslek' > $MNT/hello.txt"
run "cat $MNT/hello.txt"
run "echo 'second line (append)' >> $MNT/hello.txt"
run "cat $MNT/hello.txt"
run "echo 'overwritten' > $MNT/hello.txt"
run "cat $MNT/hello.txt"
run "stat -c '%n  size=%s bytes  blocks=%b' $MNT/hello.txt"

step "07 Large file (5 MiB) integrity"
run "head -c 5M /dev/urandom > $BIG"
run "cp $BIG $MNT/big.bin"
run "ls -lh $MNT/big.bin"
run "sha256sum $BIG $MNT/big.bin"

step "08 Create directory"
run "mkdir $MNT/docs"
run "mkdir -p $MNT/docs/report/figures"
run "echo 'nested file' > $MNT/docs/report/notes.txt"
run "cat $MNT/docs/report/notes.txt"

step "09 List directory contents"
run "ls -la $MNT"
run "ls -laR $MNT/docs"

step "10a Delete, rename and error handling"
run "mkdir $MNT/docs"
run "cat $MNT/no-such-file"
run "rmdir $MNT/docs"
run "ls -i $MNT/hello.txt"
run "mv $MNT/hello.txt $MNT/docs/renamed.txt"
run "ls -i $MNT/docs/renamed.txt"
run "rm -r $MNT/docs"
run "ls -l $MNT"

step "10b Size limit and df"
run "mount -o remount,size=10M $MNT"
run "findmnt -n -o FSTYPE,OPTIONS $MNT"
run "df -h $MNT"
run "dd if=/dev/zero of=$MNT/fill bs=1M count=4"
run "df -h $MNT"
run "rm $MNT/fill"
run "df -h $MNT"

step "10c Statistics in /proc/fslek"
run "cat /proc/fslek"
run "dd if=/dev/zero of=$MNT/stat bs=64K count=16 status=none"
run "cat /proc/fslek"
run "rm $MNT/stat"
run "cat /proc/fslek"

step "11 Unmount (data lives only in RAM)"
run "umount $MNT"
run "findmnt $MNT || echo 'not mounted'"
run "mount -t fslek none $MNT"
run "ls -la $MNT"
run "umount $MNT"

step "12 Unload module and kernel log"
run "rmmod fslek"
run "grep -w fslek /proc/filesystems || echo 'fslek no longer registered'"
run "dmesg | grep fslek"

rm -f "$BIG"
echo "${B}==== End of demo ====${N}"
