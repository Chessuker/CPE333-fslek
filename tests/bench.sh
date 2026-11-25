#!/usr/bin/env bash
# Benchmarks fslek against tmpfs and ramfs (E3)
#
# How to run (inside the VM):  sudo bash tests/bench.sh      (takes a few minutes)
# Overridable variables:  ROUNDS=15  SIZES="1 4 16 64" (MiB)  CSV=path/to/bench.csv
#
# Compiles tests/bench.c, mounts each file system and lets the program measure them.
# See the comment in bench.c for how the measurement is kept fair.
# All three live in RAM, so there is no disk cache to drop. tmpfs and ramfs store pages in the
# page cache; fslek copies into one contiguous buffer that doubles in size.
set -u
export LC_ALL=C

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOD="${MOD:-$SCRIPT_DIR/../fslek/fslek.ko}"
ROUNDS="${ROUNDS:-15}"
SIZES="${SIZES:-1 4 16 64}"
CSV="${CSV:-$SCRIPT_DIR/../bench.csv}"
FSTYPES="${FSTYPES:-fslek tmpfs ramfs}"
BASE="$(mktemp -d)"
LOADED=0

cleanup() {
	for fs in $FSTYPES; do mountpoint -q "$BASE/$fs" && umount "$BASE/$fs"; done
	[ "$LOADED" = 1 ] && rmmod fslek
	rm -f "$BASE/bench"
	rmdir "$BASE"/* "$BASE" 2>/dev/null
}
trap cleanup EXIT

die() { echo "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "must be run with sudo"
gcc -O2 -Wall -o "$BASE/bench" "$SCRIPT_DIR/bench.c" || die "cannot compile bench.c"

# Use the module that is already loaded, or load it and unload it again at the end
case " $FSTYPES " in
*" fslek "*)
	if ! lsmod | grep -qw fslek; then
		[ -f "$MOD" ] || die "$MOD not found (run make in fslek/ first)"
		insmod "$MOD" || die "insmod failed"
		LOADED=1
	fi ;;
esac
args=()
for fs in $FSTYPES; do
	mkdir "$BASE/$fs"
	mount -t "$fs" none "$BASE/$fs" || die "mount $fs failed"
	args+=("$fs=$BASE/$fs")
done

echo "kernel $(uname -r), $ROUNDS rounds, MiB/s: median (slowest-fastest)"
"$BASE/bench" "$CSV" "$ROUNDS" "$SIZES" "${args[@]}" || die "benchmark failed"
# Give the CSV back to the user who ran sudo
[ -n "${SUDO_UID:-}" ] && chown "$SUDO_UID:${SUDO_GID:-$SUDO_UID}" "$CSV"
echo
echo "CSV: $CSV"
