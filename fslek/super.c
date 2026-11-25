// SPDX-License-Identifier: GPL-2.0
/*
 * fslek/super.c - ลงทะเบียน filesystem, mount/umount, สร้าง inode
 *
 * ลำดับเหตุการณ์ตอน `mount -t fslek none /mnt/fslek`:
 *   1. VFS หา file_system_type ชื่อ "fslek" (ที่ register ไว้ตอน insmod)
 *   2. เรียก fslek_init_fs_context() เพื่อเตรียม fs_context
 *   3. เรียก fslek_parse_param() ทีละ mount option (เช่น -o size=1M)
 *   4. เรียก fc->ops->get_tree = fslek_get_tree()
 *   5. get_tree_nodev() สร้าง super_block ใหม่ (ไม่มี block device เพราะอยู่ใน RAM)
 *      แล้วเรียก fslek_fill_super() ให้เราเติมค่าและสร้าง root directory
 *
 * ตอน umount: VFS เรียก fslek_kill_sb() -> fslek_kill_super()
 *   ซึ่งจะ evict ทุก inode -> fslek_evict_inode() คืน buffer ของทุกไฟล์
 */
#include <linux/module.h>
#include <linux/init.h>
#include <linux/kernel.h>
#include <linux/fs.h>
#include <linux/fs_context.h>
#include <linux/fs_parser.h>
#include <linux/seq_file.h>
#include <linux/statfs.h>
#include <linux/string.h>
#include <linux/mm.h>
#include <linux/slab.h>
#include "fslek.h"

/*
 * จองโควตาของ mount: ขอ want ไบต์ ถ้าเหลือไม่พอให้เท่าที่เหลือ แต่ต้องไม่น้อยกว่า min
 * คืนจำนวนไบต์ที่จองได้ หรือ 0 ถ้าเหลือไม่ถึง min
 */
size_t fslek_charge(struct super_block *sb, size_t min, size_t want)
{
	struct fslek_sb_info *sbi = sb->s_fs_info;
	size_t got = 0;
	u64 left;

	spin_lock(&sbi->lock);
	left = sbi->max_bytes - sbi->used_bytes;
	if (left >= min) {
		got = min_t(u64, want, left);
		sbi->used_bytes += got;
	}
	spin_unlock(&sbi->lock);

	atomic_long_add(got, &fslek_stats.bytes);
	return got;
}

/* คืนโควตา คู่กับ fslek_charge() ต้องเรียกทุกครั้งที่คืน buffer */
void fslek_uncharge(struct super_block *sb, size_t bytes)
{
	struct fslek_sb_info *sbi = sb->s_fs_info;

	spin_lock(&sbi->lock);
	sbi->used_bytes -= bytes;
	spin_unlock(&sbi->lock);

	atomic_long_sub(bytes, &fslek_stats.bytes);
}

/*
 * สร้าง inode ใหม่หนึ่งตัว (ใช้ทั้งตอนสร้าง root, create file, mkdir)
 * คืน ERR_PTR(-errno) ถ้าล้มเหลว
 */
struct inode *fslek_get_inode(struct super_block *sb, const struct inode *dir,
			      umode_t mode)
{
	struct inode *inode = new_inode(sb);
	int err;

	if (!inode)
		return ERR_PTR(-ENOMEM);

	inode->i_ino = get_next_ino();
	/* ตั้ง uid/gid/mode ตามผู้สร้างและ directory แม่ */
	inode_init_owner(&nop_mnt_idmap, inode, dir, mode);
	simple_inode_init_ts(inode);	/* atime = mtime = ctime = ตอนนี้ */

	switch (mode & S_IFMT) {
	case S_IFREG:
		inode->i_op = &fslek_file_inode_operations;
		inode->i_fop = &fslek_file_operations;
		err = fslek_alloc_file_data(inode);
		if (err) {
			iput(inode);
			return ERR_PTR(err);
		}
		break;
	case S_IFDIR:
		inode->i_op = &fslek_dir_inode_operations;
		/* readdir/llseek ของ directory ใช้ของ libfs ซึ่งอ่านจาก dcache */
		inode->i_fop = &simple_dir_operations;
		/* directory เริ่มที่ nlink = 2 (ชื่อตัวเองใน parent + ".") */
		inc_nlink(inode);
		atomic_long_inc(&fslek_stats.dirs);
		break;
	default:
		/* MVP รองรับแค่ไฟล์ปกติกับ directory */
		iput(inode);
		return ERR_PTR(-EINVAL);
	}
	return inode;
}

/*
 * VFS เรียกตอน inode ถูกทิ้งจริง (ไฟล์ถูกลบและไม่มีใครเปิดอยู่ หรือตอน umount)
 * ตรงนี้คือจุดที่ข้อมูลไฟล์ใน RAM ถูกคืนให้ระบบ
 */
static void fslek_evict_inode(struct inode *inode)
{
	truncate_inode_pages_final(&inode->i_data);
	clear_inode(inode);
	if (S_ISREG(inode->i_mode))
		fslek_free_file_data(inode);
	else if (S_ISDIR(inode->i_mode))
		atomic_long_dec(&fslek_stats.dirs);
}

/* df: ขนาดทั้งหมดคือ size= ที่ใช้ไปคือ buffer ที่จองจริงของทุกไฟล์ */
static int fslek_statfs(struct dentry *dentry, struct kstatfs *buf)
{
	struct fslek_sb_info *sbi = dentry->d_sb->s_fs_info;
	int err = simple_statfs(dentry, buf);	/* magic, ขนาดบล็อก, ความยาวชื่อ */

	if (err)
		return err;

	spin_lock(&sbi->lock);
	buf->f_blocks = sbi->max_bytes >> PAGE_SHIFT;
	buf->f_bfree = (sbi->max_bytes - sbi->used_bytes) >> PAGE_SHIFT;
	spin_unlock(&sbi->lock);
	buf->f_bavail = buf->f_bfree;
	return 0;
}

/* option ที่แสดงใน findmnt และ /proc/mounts */
static int fslek_show_options(struct seq_file *m, struct dentry *root)
{
	struct fslek_sb_info *sbi = root->d_sb->s_fs_info;
	u64 max;

	spin_lock(&sbi->lock);
	max = sbi->max_bytes;
	spin_unlock(&sbi->lock);
	seq_printf(m, ",size=%lluk", max >> 10);
	return 0;
}

static const struct super_operations fslek_super_ops = {
	.statfs		= fslek_statfs,
	.show_options	= fslek_show_options,
	/* ไม่ cache inode ที่ไม่มีใครอ้างถึงแล้ว (เหมือน ramfs) */
	.drop_inode	= fslek_drop_inode,
	.evict_inode	= fslek_evict_inode,
};

static int fslek_fill_super(struct super_block *sb, struct fs_context *fc)
{
	struct fslek_sb_info *sbi = sb->s_fs_info;	/* ย้ายมาจาก fc->s_fs_info แล้ว */
	struct inode *root;

	/* ไม่ได้ระบุ size= : ใช้ครึ่งหนึ่งของ RAM เหมือน tmpfs กันเขียนจน RAM หมดเครื่อง */
	if (!sbi->max_bytes)
		sbi->max_bytes = (u64)(totalram_pages() / 2) << PAGE_SHIFT;

	sb->s_maxbytes		= FSLEK_MAX_FILE_SIZE;
	sb->s_blocksize		= PAGE_SIZE;
	sb->s_blocksize_bits	= PAGE_SHIFT;
	sb->s_magic		= FSLEK_MAGIC;
	sb->s_op		= &fslek_super_ops;
	sb->s_time_gran		= 1;

	root = fslek_get_inode(sb, NULL, S_IFDIR | FSLEK_DEFAULT_MODE);
	if (IS_ERR(root))
		return PTR_ERR(root);

	/* d_make_root() สร้าง dentry "/" ของ filesystem นี้ (iput ให้เองถ้าล้มเหลว) */
	sb->s_root = d_make_root(root);
	if (!sb->s_root)
		return -ENOMEM;

	pr_info(FSLEK_NAME ": mounted (sb=%p)\n", sb);
	return 0;
}

static int fslek_get_tree(struct fs_context *fc)
{
	/* nodev = ไม่มี block device ข้างหลัง ทุก mount ได้ super_block ใหม่ของตัวเอง */
	return get_tree_nodev(fc, fslek_fill_super);
}

enum fslek_param { Opt_size };

static const struct fs_parameter_spec fslek_parameters[] = {
	fsparam_string("size", Opt_size),
	{}
};

/* เรียกครั้งละหนึ่ง option  option ที่ไม่รู้จักคืน -ENOPARAM แล้ว VFS จะปฏิเสธ mount ให้เอง */
static int fslek_parse_param(struct fs_context *fc, struct fs_parameter *param)
{
	struct fslek_sb_info *opts = fc->s_fs_info;
	struct fs_parse_result result;
	unsigned long long size;
	char *rest;
	int opt;

	opt = fs_parse(fc, fslek_parameters, param, &result);
	if (opt < 0)
		return opt;

	/* Opt_size: memparse อ่านเลขที่ลงท้ายด้วย K, M, G ได้ */
	size = memparse(param->string, &rest);
	if (*rest || !size || size > LLONG_MAX)
		return invalfc(fc, "bad value for size: '%s'", param->string);
	opts->max_bytes = round_up(size, PAGE_SIZE);
	return 0;
}

/* mount -o remount,size=... : ลดให้ต่ำกว่าที่ใช้อยู่ไม่ได้ (invariant used <= max) */
static int fslek_reconfigure(struct fs_context *fc)
{
	struct fslek_sb_info *sbi = fc->root->d_sb->s_fs_info;
	struct fslek_sb_info *opts = fc->s_fs_info;
	bool fits;

	if (!opts->max_bytes)
		return 0;	/* remount โดยไม่ได้แตะ size= */

	spin_lock(&sbi->lock);
	fits = opts->max_bytes >= sbi->used_bytes;
	if (fits)
		sbi->max_bytes = opts->max_bytes;
	spin_unlock(&sbi->lock);

	return fits ? 0 : invalfc(fc, "size is smaller than the space in use");
}

static void fslek_free_fc(struct fs_context *fc)
{
	/* ถ้า mount สำเร็จ ค่านี้เป็น NULL เพราะ sget_fc() ย้ายไปให้ super_block แล้ว */
	kfree(fc->s_fs_info);
}

static const struct fs_context_operations fslek_context_ops = {
	.free		= fslek_free_fc,
	.parse_param	= fslek_parse_param,
	.get_tree	= fslek_get_tree,
	.reconfigure	= fslek_reconfigure,
};

static int fslek_init_fs_context(struct fs_context *fc)
{
	struct fslek_sb_info *sbi = kzalloc(sizeof(*sbi), GFP_KERNEL);

	if (!sbi)
		return -ENOMEM;
	spin_lock_init(&sbi->lock);
	fc->s_fs_info = sbi;
	fc->ops = &fslek_context_ops;
	return 0;
}

static void fslek_kill_sb(struct super_block *sb)
{
	struct fslek_sb_info *sbi = sb->s_fs_info;

	pr_info(FSLEK_NAME ": unmounting (sb=%p)\n", sb);
	/*
	 * ปล่อย dentry ที่ pin ไว้ แล้ว evict ทุก inode -> fslek_evict_inode()
	 * -> คืน buffer ทุกไฟล์ (kill_anon_super บน 7.0, kill_litter_super บน 6.8)
	 */
	fslek_kill_super(sb);
	/* ต้องคืนหลังสุด เพราะการ evict ข้างบนยังเรียก fslek_uncharge() */
	kfree(sbi);
}

static struct file_system_type fslek_fs_type = {
	.owner			= THIS_MODULE,
	.name			= FSLEK_NAME,
	.init_fs_context	= fslek_init_fs_context,
	.parameters		= fslek_parameters,
	.kill_sb		= fslek_kill_sb,
};

static int __init fslek_init(void)
{
	int err;

	/* สร้าง /proc/fslek ก่อน เพราะหลัง register แล้วมีคน mount ได้ทันที */
	err = fslek_stats_init();
	if (err) {
		pr_err(FSLEK_NAME ": cannot create /proc/fslek: %d\n", err);
		return err;
	}

	err = register_filesystem(&fslek_fs_type);
	if (err) {
		pr_err(FSLEK_NAME ": register_filesystem failed: %d\n", err);
		fslek_stats_exit();
		return err;
	}
	pr_info(FSLEK_NAME ": registered\n");
	return 0;
}

static void __exit fslek_exit(void)
{
	unregister_filesystem(&fslek_fs_type);
	fslek_stats_exit();
	pr_info(FSLEK_NAME ": unregistered\n");
}

module_init(fslek_init);
module_exit(fslek_exit);

MODULE_LICENSE("GPL");
MODULE_DESCRIPTION("fslek: mini RAM-based filesystem (CPE333 Mini-Project 2)");
MODULE_ALIAS_FS(FSLEK_NAME);
