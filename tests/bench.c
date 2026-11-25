// SPDX-License-Identifier: GPL-2.0
/*
 * Measurement program used by bench.sh (E3). Not part of the kernel module.
 *
 *   bench CSV ROUNDS "SIZES in MiB" name=dir [name=dir ...]
 *
 * What it does to keep the numbers comparable:
 *   - only the read/write system calls are timed, not open, unlink or process startup
 *   - the user buffer is touched beforehand, so its page faults are not measured
 *   - every sample moves at least SAMPLE_MIB, so small files are not timed over a few microseconds
 *   - one warm-up sample per file system is thrown away
 *   - the file systems take turns inside every round, so a slow moment of the VM hits all of them
 *   - the process stays on one CPU
 *   - the median is reported together with the slowest and fastest sample
 */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <sched.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define MIB		(1024L * 1024)
#define SAMPLE_MIB	64
#define MAX_FS		8
#define MAX_ROUNDS	1000

static char *buf;

static void die(const char *what)
{
	fprintf(stderr, "bench: %s: %s\n", what, strerror(errno));
	exit(1);
}

static double now(void)
{
	struct timespec ts;

	clock_gettime(CLOCK_MONOTONIC, &ts);
	return ts.tv_sec + ts.tv_nsec / 1e9;
}

/* Writes or reads the whole file sequentially and returns the seconds it took */
static double transfer(int fd, int is_write, long size, long bs)
{
	double t0 = now();

	for (long pos = 0; pos < size; pos += bs) {
		ssize_t n = is_write ? pwrite(fd, buf, bs, pos) : pread(fd, buf, bs, pos);

		if (n != bs)
			die(is_write ? "write" : "read");
	}
	return now() - t0;
}

static int create(const char *path)
{
	int fd = open(path, O_RDWR | O_CREAT | O_EXCL, 0600);

	if (fd < 0)
		die(path);
	return fd;
}

/* One sample in MiB/s. Writing always starts from a new file, so growing it is part of the cost */
static double sample(const char *path, int read_fd, int is_write, long size, long bs)
{
	long passes = SAMPLE_MIB * MIB / size;
	double t = 0;

	if (passes < 1)
		passes = 1;
	for (long i = 0; i < passes; i++) {
		if (is_write) {
			int fd = create(path);

			t += transfer(fd, 1, size, bs);
			close(fd);
			unlink(path);
		} else {
			t += transfer(read_fd, 0, size, bs);
		}
	}
	return (double)passes * size / MIB / t;
}

static int cmp(const void *a, const void *b)
{
	double x = *(const double *)a, y = *(const double *)b;

	return (x > y) - (x < y);
}

int main(int argc, char **argv)
{
	static double res[MAX_FS][MAX_ROUNDS];
	static const struct { const char *name; int is_write; long bs; } specs[] = {
		{ "write", 1, MIB }, { "read", 0, MIB }, { "write", 1, 4096 }, { "read", 0, 4096 },
	};
	char path[MAX_FS][PATH_MAX];
	int fd[MAX_FS], nfs = argc - 4, rounds;
	cpu_set_t cpus;
	FILE *csv;

	if (argc < 5 || nfs > MAX_FS) {
		fprintf(stderr, "usage: bench CSV ROUNDS SIZES name=dir...\n");
		return 2;
	}
	rounds = atoi(argv[2]);
	if (rounds < 1 || rounds > MAX_ROUNDS) {
		fprintf(stderr, "bench: ROUNDS must be 1-%d\n", MAX_ROUNDS);
		return 2;
	}
	for (int f = 0; f < nfs; f++) {
		char *eq = strchr(argv[4 + f], '=');

		if (!eq) {
			fprintf(stderr, "bench: expected name=dir, got %s\n", argv[4 + f]);
			return 2;
		}
		*eq = '\0';	/* argv[4 + f] is now just the name */
		snprintf(path[f], sizeof(path[f]), "%s/f", eq + 1);
	}

	CPU_ZERO(&cpus);
	CPU_SET(sched_getcpu(), &cpus);
	sched_setaffinity(0, sizeof(cpus), &cpus);	/* best effort */

	buf = malloc(MIB);
	if (!buf)
		die("malloc");
	memset(buf, 0xa5, MIB);

	csv = fopen(argv[1], "w");
	if (!csv)
		die(argv[1]);
	fprintf(csv, "op,bs,size_mib,fs,median_mib_s,min_mib_s,max_mib_s\n");

	for (size_t s = 0; s < sizeof(specs) / sizeof(specs[0]); s++) {
		char sizes[256], *tok, *save;

		printf("\n%-5s bs=%-5s", specs[s].name, specs[s].bs == MIB ? "1M" : "4K");
		for (int f = 0; f < nfs; f++)
			printf("%22s", argv[4 + f]);
		printf("\n");

		snprintf(sizes, sizeof(sizes), "%s", argv[3]);
		for (tok = strtok_r(sizes, " ", &save); tok; tok = strtok_r(NULL, " ", &save)) {
			long size = atol(tok) * MIB;

			if (size <= 0) {
				fprintf(stderr, "bench: bad size %s\n", tok);
				return 2;
			}
			if (!specs[s].is_write) {
				for (int f = 0; f < nfs; f++) {
					fd[f] = create(path[f]);
					transfer(fd[f], 1, size, MIB);
				}
			}
			/* round -1 is the warm-up */
			for (int r = -1; r < rounds; r++) {
				for (int k = 0; k < nfs; k++) {
					int f = (r + 1 + k) % nfs;
					double v = sample(path[f], fd[f], specs[s].is_write, size, specs[s].bs);

					if (r >= 0)
						res[f][r] = v;
				}
			}
			printf("%6s MiB    ", tok);
			for (int f = 0; f < nfs; f++) {
				char cell[64];
				double med;

				qsort(res[f], rounds, sizeof(double), cmp);
				med = (res[f][(rounds - 1) / 2] + res[f][rounds / 2]) / 2;
				snprintf(cell, sizeof(cell), "%.0f (%.0f-%.0f)", med, res[f][0], res[f][rounds - 1]);
				printf("%22s", cell);
				fprintf(csv, "%s,%s,%s,%s,%.0f,%.0f,%.0f\n", specs[s].name,
					specs[s].bs == MIB ? "1M" : "4K", tok, argv[4 + f],
					med, res[f][0], res[f][rounds - 1]);
				if (!specs[s].is_write) {
					close(fd[f]);
					unlink(path[f]);
				}
			}
			printf("\n");
			fflush(stdout);
		}
	}
	if (fclose(csv))
		die(argv[1]);
	return 0;
}
