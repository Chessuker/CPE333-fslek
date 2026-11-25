// SPDX-License-Identifier: GPL-2.0
/*
 * fslek/file.c - เก็บข้อมูลไฟล์ใน buffer ที่จองเอง (ไม่ใช้ page cache)
 *
 * แต่ละไฟล์มี struct fslek_file_data (ดู fslek.h) อยู่ใน inode->i_private
 * ข้อมูลทั้งไฟล์อยู่ใน buffer ต่อเนื่องก้อนเดียวที่จองด้วย kvzalloc()
 * (ก้อนเล็กได้จาก kmalloc ก้อนใหญ่ได้จาก vmalloc)
 *
 * เส้นทางของ system call:
 *   read(2)     -> vfs_read()     -> fslek_read_iter()
 *   write(2)    -> vfs_write()    -> fslek_write_iter()
 *   truncate(2), open(O_TRUNC)   -> notify_change() -> fslek_setattr()
 *   sendfile/splice (เช่น cp, cat บางรุ่น) -> copy_splice_read / iter_file_splice_write
 *                                   ซึ่งวนกลับมาเรียก read_iter / write_iter ของเรา
 */
#include <linux/fs.h>
#include <linux/mm.h>
#include <linux/slab.h>
#include <linux/uio.h>
#include <linux/minmax.h>
#include "fslek.h"

static inline struct fslek_file_data *FSLEK_FD(struct inode *inode)
{
	return inode->i_private;
}

int fslek_alloc_file_data(struct inode *inode)
{
	struct fslek_file_data *fd = kzalloc(sizeof(*fd), GFP_KERNEL);

	if (!fd)
		return -ENOMEM;
	/* ยังไม่จอง buffer จนกว่าจะมีการเขียนครั้งแรก ไฟล์ว่างจึงไม่กิน RAM */
	inode->i_private = fd;
	atomic_long_inc(&fslek_stats.files);
	return 0;
}

void fslek_free_file_data(struct inode *inode)
{
	struct fslek_file_data *fd = FSLEK_FD(inode);

	if (!fd)
		return;
	kvfree(fd->data);
	fslek_uncharge(inode->i_sb, fd->capacity);
	kfree(fd);
	inode->i_private = NULL;
	atomic_long_dec(&fslek_stats.files);
}

/*
 * ทำให้ buffer จุได้อย่างน้อย need ไบต์ (ผู้เรียกต้องถือ inode_lock)
 * ขยายแบบเท่าตัวเพื่อให้การเขียนต่อท้ายทีละน้อยเป็น amortized O(1)
 * ขนาดที่จองเป็นจำนวนเต็มหน้า (PAGE_SIZE) เสมอ ให้นับโควตาเป็นบล็อกได้ตรงกับ df
 */
static int fslek_reserve(struct inode *inode, size_t need)
{
	struct fslek_file_data *fd = FSLEK_FD(inode);
	size_t min_cap, newcap, got;
	char *buf;

	if (need <= fd->capacity)
		return 0;
	if (need > FSLEK_MAX_FILE_SIZE)
		return -EFBIG;

	min_cap = round_up(need, PAGE_SIZE);
	newcap = max3(min_cap, fd->capacity * 2, FSLEK_MIN_ALLOC);
	newcap = min(newcap, FSLEK_MAX_FILE_SIZE);

	/* โควตาเหลือไม่พอขยายเท่าตัว ก็เอาเท่าที่เหลือ ขอแค่พอกับที่ต้องเขียนจริง */
	got = fslek_charge(inode->i_sb, min_cap - fd->capacity,
			   newcap - fd->capacity);
	if (!got)
		return -ENOSPC;
	newcap = fd->capacity + got;

	/* kvzalloc คืน buffer ที่เป็น 0 ทั้งก้อน ส่วนที่เกิน i_size จึงเป็น 0 ตาม invariant */
	buf = kvzalloc(newcap, GFP_KERNEL);
	if (!buf) {
		fslek_uncharge(inode->i_sb, got);
		return -ENOMEM;
	}
	if (fd->data) {
		memcpy(buf, fd->data, i_size_read(inode));
		kvfree(fd->data);
	}
	fd->data = buf;
	fd->capacity = newcap;
	/* ให้ stat/du เห็นขนาดที่จองจริง (หน่วย 512 ไบต์) */
	inode->i_blocks = newcap >> 9;
	atomic_long_inc(&fslek_stats.grows);
	return 0;
}

/* เปลี่ยนขนาดไฟล์เป็น new_size (ผู้เรียกต้องถือ inode_lock) */
static int fslek_resize(struct inode *inode, loff_t new_size)
{
	struct fslek_file_data *fd = FSLEK_FD(inode);
	loff_t old_size = i_size_read(inode);
	int err;

	if (new_size == 0) {
		/* truncate เป็น 0 (เช่น echo > file): คืน buffer ทั้งก้อน */
		kvfree(fd->data);
		fslek_uncharge(inode->i_sb, fd->capacity);
		fd->data = NULL;
		fd->capacity = 0;
		inode->i_blocks = 0;
	} else if (new_size > old_size) {
		/* ขยาย: ส่วนที่เพิ่มเป็น 0 อยู่แล้วตาม invariant */
		err = fslek_reserve(inode, new_size);
		if (err)
			return err;
	} else {
		/* หด: ล้างส่วนท้ายเป็น 0 เพื่อรักษา invariant (ข้อมูลเก่าจะไม่โผล่กลับมา) */
		memset(fd->data + new_size, 0, old_size - new_size);
	}
	i_size_write(inode, new_size);
	return 0;
}

static ssize_t fslek_read_iter(struct kiocb *iocb, struct iov_iter *to)
{
	struct inode *inode = file_inode(iocb->ki_filp);
	struct fslek_file_data *fd = FSLEK_FD(inode);
	loff_t pos = iocb->ki_pos;
	loff_t size;
	size_t len, copied;

	if (!iov_iter_count(to))
		return 0;

	inode_lock_shared(inode);
	size = i_size_read(inode);
	if (pos >= size) {
		inode_unlock_shared(inode);
		return 0;	/* EOF */
	}
	len = min_t(size_t, iov_iter_count(to), size - pos);
	/* copy_to_iter คัดลอกไปยัง buffer ของ user (หรือ pipe ตอน splice) */
	copied = copy_to_iter(fd->data + pos, len, to);
	inode_unlock_shared(inode);

	if (!copied)
		return -EFAULT;
	iocb->ki_pos = pos + copied;
	file_accessed(iocb->ki_filp);
	return copied;
}

static ssize_t fslek_write_iter(struct kiocb *iocb, struct iov_iter *from)
{
	struct inode *inode = file_inode(iocb->ki_filp);
	struct fslek_file_data *fd;
	loff_t pos, size;
	size_t len, copied;
	ssize_t ret;

	inode_lock(inode);
	/*
	 * generic_write_checks():
	 *   - ถ้าเปิดด้วย O_APPEND ย้าย ki_pos ไปท้ายไฟล์ (echo >> file)
	 *   - ตัดความยาวไม่ให้เกิน s_maxbytes หรือคืน -EFBIG
	 * คืนจำนวนไบต์ที่จะเขียนได้จริง
	 */
	ret = generic_write_checks(iocb, from);
	if (ret <= 0)
		goto out;
	len = ret;
	pos = iocb->ki_pos;

	ret = fslek_reserve(inode, pos + len);
	if (ret)
		goto out;

	fd = FSLEK_FD(inode);
	size = i_size_read(inode);
	/* ถ้า pos > size ช่วง [size, pos) เป็น 0 อยู่แล้วตาม invariant จึงไม่ต้อง memset */
	copied = copy_from_iter(fd->data + pos, len, from);
	if (!copied) {
		ret = -EFAULT;
		goto out;
	}
	pos += copied;
	iocb->ki_pos = pos;
	if (pos > size)
		i_size_write(inode, pos);
	inode_set_mtime_to_ts(inode, inode_set_ctime_current(inode));
	ret = copied;
out:
	inode_unlock(inode);
	return ret;
}

/*
 * chmod/chown/truncate มาทางนี้ VFS ถือ inode_lock มาให้แล้ว
 */
static int fslek_setattr(struct mnt_idmap *idmap, struct dentry *dentry,
			 struct iattr *iattr)
{
	struct inode *inode = d_inode(dentry);
	int err;

	err = setattr_prepare(idmap, dentry, iattr);
	if (err)
		return err;

	if ((iattr->ia_valid & ATTR_SIZE) &&
	    iattr->ia_size != i_size_read(inode)) {
		err = fslek_resize(inode, iattr->ia_size);
		if (err)
			return err;
		inode_set_mtime_to_ts(inode, inode_set_ctime_current(inode));
	}
	setattr_copy(idmap, inode, iattr);
	return 0;
}

const struct inode_operations fslek_file_inode_operations = {
	.setattr	= fslek_setattr,
	/* .getattr ปล่อยว่าง: VFS ใช้ generic_fillattr ซึ่งอ่าน i_blocks ที่เราตั้งไว้ */
};

const struct file_operations fslek_file_operations = {
	.owner		= THIS_MODULE,
	.llseek		= generic_file_llseek,
	.read_iter	= fslek_read_iter,
	.write_iter	= fslek_write_iter,
	.splice_read	= copy_splice_read,
	.splice_write	= iter_file_splice_write,
	.fsync		= noop_fsync,	/* อยู่ใน RAM ไม่มีอะไรต้อง flush */
};
