/* SPDX-License-Identifier: GPL-2.0 */
/*
 * fslek - Mini RAM-based filesystem (CPE333 Mini-Project 2)
 *
 * Header กลางที่ทุกไฟล์ใช้ร่วมกัน
 *
 * ภาพรวมการแบ่งไฟล์:
 *   super.c  ลงทะเบียน filesystem กับ VFS, mount/umount, สร้าง inode
 *   dir.c    operation ของ directory: lookup, create, mkdir (ls, rm, rmdir, mv ใช้ของ libfs)
 *   file.c   operation ของไฟล์: read, write, truncate (buffer เขียนเอง)
 *   stats.c  สถิติรวมทุก mount ใน /proc/fslek
 *
 * รองรับ Linux 6.8 (Ubuntu 24.04) และ 7.0 (Ubuntu 26.04) ดูส่วน compat ด้านล่าง
 */
#ifndef _FSLEK_H
#define _FSLEK_H

#include <linux/fs.h>
#include <linux/dcache.h>
#include <linux/types.h>
#include <linux/atomic.h>
#include <linux/spinlock.h>

#define FSLEK_NAME		"fslek"
#define FSLEK_MAGIC		0x46534c4b	/* "FSLK" ให้ statfs/df แสดงได้ */
#define FSLEK_DEFAULT_MODE	0755

/*
 * ขนาดไฟล์สูงสุดต่อไฟล์ ค่านี้ถูกตั้งเป็น sb->s_maxbytes ด้วย
 * generic_write_checks() จะตัด/ปฏิเสธการเขียนที่เกินให้อัตโนมัติ (-EFBIG)
 */
#define FSLEK_MAX_FILE_SIZE	(64UL * 1024 * 1024)

/* ขยาย buffer ครั้งแรกอย่างน้อยเท่านี้ เพื่อไม่ต้อง realloc ทุกครั้งที่เขียนทีละนิด */
#define FSLEK_MIN_ALLOC		4096UL

/*
 * ข้อมูลของไฟล์ปกติหนึ่งไฟล์ เก็บไว้ใน inode->i_private
 *
 * ขนาดไฟล์จริงเก็บที่ inode->i_size (ของ VFS) ไม่เก็บซ้ำในนี้
 * capacity คือขนาด buffer ที่จองไว้ ซึ่ง >= i_size เสมอ
 *
 * Invariant: ไบต์ใน data ตั้งแต่ i_size ถึง capacity เป็น 0 เสมอ
 * ทำให้การเขียนข้ามท้ายไฟล์ (เช่น lseek ไปไกลแล้วเขียน) ได้ "รู" ที่เป็นศูนย์
 * โดยไม่ต้อง memset ทุกครั้ง
 *
 * Locking: ทุกการแก้ data/capacity/i_size ต้องถือ inode_lock(inode)
 * การอ่านถือ inode_lock_shared(inode)
 */
struct fslek_file_data {
	char	*data;
	size_t	capacity;
};

/*
 * ข้อมูลต่อ mount หนึ่งครั้ง เก็บไว้ใน sb->s_fs_info
 *
 * used_bytes คือผลรวม capacity (buffer ที่จองจริง ไม่ใช่ i_size) ของทุกไฟล์ใน mount นี้
 * รวมไฟล์ที่ถูก rm แล้วแต่ยังมีคนเปิดอยู่  Invariant: used_bytes <= max_bytes เสมอ
 *
 * lock ต้องแยกจาก inode_lock เพราะหลายไฟล์ใช้โควตาก้อนเดียวกัน
 * เป็น spinlock ได้เพราะช่วงที่ถือมีแค่บวกลบเลข ไม่มีอะไรที่ต้อง sleep
 */
struct fslek_sb_info {
	spinlock_t	lock;
	u64		max_bytes;	/* จาก mount option size= */
	u64		used_bytes;
};

/* counter รวมทุก mount แสดงใน /proc/fslek (ดู stats.c) */
struct fslek_stats {
	atomic_long_t	files;
	atomic_long_t	dirs;		/* รวม root ของแต่ละ mount */
	atomic_long_t	bytes;		/* buffer ที่จองอยู่ทั้งหมด */
	atomic_long_t	grows;		/* จำนวนครั้งที่จอง buffer ก้อนใหม่ */
};

/*
 * Compat ระหว่าง kernel 6.8 (Ubuntu 24.04) กับ 7.0 (Ubuntu 26.04)
 * Makefile ตรวจ header แล้วกำหนด macro FSLEK_* ให้อัตโนมัติ
 *
 * 1. การ pin dentry ไว้ใน dcache
 *    6.8: d_instantiate() + dget() แล้วตอน umount ใช้ kill_litter_super()
 *         ซึ่งปล่อย reference ที่ pin ไว้ทั้งหมด
 *    7.0: d_make_persistent() ทำทั้งสองอย่างในคำสั่งเดียว
 *         และ kill_anon_super() จัดการ dentry แบบ persistent ให้เอง
 * 2. drop_inode: 6.8 ชื่อ generic_delete_inode, 7.0 เปลี่ยนชื่อเป็น inode_just_drop
 * 3. ->mkdir: 6.8 คืน int, ตั้งแต่ 6.15 คืน struct dentry *
 */
#ifdef FSLEK_HAVE_D_MAKE_PERSISTENT
static inline void fslek_pin_dentry(struct dentry *dentry, struct inode *inode)
{
	d_make_persistent(dentry, inode);
}
#define fslek_kill_super	kill_anon_super
#else
static inline void fslek_pin_dentry(struct dentry *dentry, struct inode *inode)
{
	d_instantiate(dentry, inode);
	dget(dentry);	/* reference เพิ่ม 1 = pin ไว้ไม่ให้ dcache ทิ้ง */
}
#define fslek_kill_super	kill_litter_super
#endif

#ifdef FSLEK_HAVE_INODE_JUST_DROP
#define fslek_drop_inode	inode_just_drop
#else
#define fslek_drop_inode	generic_delete_inode
#endif

/* super.c */
struct inode *fslek_get_inode(struct super_block *sb, const struct inode *dir,
			      umode_t mode);
size_t fslek_charge(struct super_block *sb, size_t min, size_t want);
void fslek_uncharge(struct super_block *sb, size_t bytes);

/* dir.c */
extern const struct inode_operations fslek_dir_inode_operations;

/* file.c */
extern const struct inode_operations fslek_file_inode_operations;
extern const struct file_operations fslek_file_operations;
int fslek_alloc_file_data(struct inode *inode);
void fslek_free_file_data(struct inode *inode);

/* stats.c */
extern struct fslek_stats fslek_stats;
int fslek_stats_init(void);
void fslek_stats_exit(void);

#endif /* _FSLEK_H */
