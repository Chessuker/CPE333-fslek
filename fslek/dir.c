// SPDX-License-Identifier: GPL-2.0
/*
 * fslek/dir.c - inode operations ของ directory
 *
 * fslek ไม่มี "ตาราง directory" ของตัวเอง โครงสร้างไดเรกทอรีทั้งหมดอยู่ใน
 * dcache ของ VFS: แต่ละชื่อไฟล์คือ dentry หนึ่งตัวที่ผูกกับ inode
 * เราตั้ง dentry เป็น persistent (d_make_persistent) เพื่อไม่ให้ VFS ทิ้งมัน
 * ไปตอนหน่วยความจำตึง เพราะถ้าทิ้งแล้วไฟล์จะหายจริง ไม่มี disk ให้อ่านกลับ
 *
 * ผลที่ตามมา:
 *   - lookup ใช้ simple_lookup ได้: ถ้าชื่อไม่อยู่ใน dcache แปลว่าไม่มีไฟล์นั้นจริง
 *   - ls (readdir) ใช้ simple_dir_operations ที่ไล่ลูกของ dentry ใน dcache
 */
#include <linux/fs.h>
#include <linux/dcache.h>
#include "fslek.h"

/* สร้าง inode ใหม่แล้วผูกกับชื่อ (dentry) ใน directory แม่ */
static int fslek_mknod(struct inode *dir, struct dentry *dentry, umode_t mode)
{
	struct inode *inode = fslek_get_inode(dir->i_sb, dir, mode);

	if (IS_ERR(inode))
		return PTR_ERR(inode);

	/* ผูก dentry กับ inode และ pin ไว้ใน dcache (ดู compat ใน fslek.h) */
	fslek_pin_dentry(dentry, inode);
	/* directory แม่ถูกแก้เนื้อหา จึงอัปเดต mtime/ctime */
	inode_set_mtime_to_ts(dir, inode_set_ctime_current(dir));
	return 0;
}

/* open(O_CREAT), touch, echo > newfile */
static int fslek_create(struct mnt_idmap *idmap, struct inode *dir,
			struct dentry *dentry, umode_t mode, bool excl)
{
	return fslek_mknod(dir, dentry, mode | S_IFREG);
}

static int fslek_do_mkdir(struct inode *dir, struct dentry *dentry, umode_t mode)
{
	int err = fslek_mknod(dir, dentry, mode | S_IFDIR);

	if (!err)
		inc_nlink(dir);	/* ".." ของ directory ลูกชี้กลับมาที่ dir */
	return err;
}

/*
 * mkdir
 * ตั้งแต่ Linux 6.15 ->mkdir คืน struct dentry *: NULL = สำเร็จ, ERR_PTR = ผิดพลาด
 * ERR_PTR(0) มีค่าเป็น NULL จึงคืนได้ทั้งสองกรณีในบรรทัดเดียว
 * kernel ก่อนหน้านั้น (เช่น 6.8) คืน int ตามปกติ
 */
#ifdef FSLEK_MKDIR_RETURNS_DENTRY
static struct dentry *fslek_mkdir(struct mnt_idmap *idmap, struct inode *dir,
				  struct dentry *dentry, umode_t mode)
{
	return ERR_PTR(fslek_do_mkdir(dir, dentry, mode));
}
#else
static int fslek_mkdir(struct mnt_idmap *idmap, struct inode *dir,
		       struct dentry *dentry, umode_t mode)
{
	return fslek_do_mkdir(dir, dentry, mode);
}
#endif

const struct inode_operations fslek_dir_inode_operations = {
	.lookup		= simple_lookup,
	.create		= fslek_create,
	.mkdir		= fslek_mkdir,
	/*
	 * rm และ rmdir ใช้ของ libfs ซึ่งลด nlink อัปเดต mtime/ctime ของ directory แม่
	 * แล้วปลด pin ของ dentry (6.8: dput(), 7.0: d_make_discardable())
	 * ตรงกับวิธี pin ใน fslek_pin_dentry() ของแต่ละเวอร์ชัน
	 * simple_rmdir คืน -ENOTEMPTY ถ้า directory ยังมีของอยู่
	 *
	 * buffer ของไฟล์ถูกคืนใน fslek_evict_inode() เมื่อไม่มีใครเปิดไฟล์นั้นแล้ว
	 * ไฟล์ที่ถูกลบขณะเปิดอยู่จึงยังอ่าน/เขียนผ่าน fd เดิมได้จนกว่าจะปิด
	 */
	.unlink		= simple_unlink,
	.rmdir		= simple_rmdir,
	/*
	 * mv ใน mount เดียวกัน: ย้ายแค่ชื่อ (dentry) inode และ buffer เดิมไม่ถูก copy
	 * ถ้ามีไฟล์ปลายทางอยู่แล้ว simple_rename จะ simple_unlink ตัวนั้นให้ก่อน
	 * ถ้า mv ข้าม mount VFS คืน -EXDEV แล้วคำสั่ง mv จะ copy และลบเอง
	 */
	.rename		= simple_rename,
};
