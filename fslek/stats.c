// SPDX-License-Identifier: GPL-2.0
/*
 * fslek/stats.c - สถิติของ fslek ทุก mount รวมกัน อ่านได้จาก /proc/fslek
 *
 * ใช้ atomic_long_t แทน mutex เพราะ counter แต่ละตัวอิสระจากกัน และถูกแก้ทุกครั้งที่
 * ไฟล์ใดก็ตามขยายหรือถูกลบ ถ้าใช้ mutex ตัวเดียวทั้ง module สองไฟล์ที่ไม่เกี่ยวกัน
 * จะต้องรอกัน ซึ่งขัดกับที่ fslek ใช้ lock แยกต่อ inode
 *
 * ข้อแลกเปลี่ยน: ค่าหลายบรรทัดใน /proc/fslek อ่านคนละจังหวะกันเล็กน้อย
 * แต่ละค่าถูกต้อง แต่อาจไม่ใช่ภาพ ณ เวลาเดียวกันเป๊ะถ้ามีการเขียนอยู่พร้อมกัน
 */
#include <linux/init.h>
#include <linux/proc_fs.h>
#include <linux/seq_file.h>
#include "fslek.h"

struct fslek_stats fslek_stats;

static int fslek_stats_show(struct seq_file *m, void *v)
{
	seq_printf(m, "files        %ld\n", atomic_long_read(&fslek_stats.files));
	seq_printf(m, "directories  %ld\n", atomic_long_read(&fslek_stats.dirs));
	seq_printf(m, "bytes        %ld\n", atomic_long_read(&fslek_stats.bytes));
	seq_printf(m, "grows        %ld\n", atomic_long_read(&fslek_stats.grows));
	return 0;
}

int __init fslek_stats_init(void)
{
	/* ไฟล์อ่านอย่างเดียว เปิดแต่ละครั้งเรียก fslek_stats_show() ใหม่หนึ่งรอบ */
	if (!proc_create_single(FSLEK_NAME, 0444, NULL, fslek_stats_show))
		return -ENOMEM;
	return 0;
}

void fslek_stats_exit(void)
{
	/* รอให้คนที่กำลังอ่านอยู่อ่านจบก่อน จึงถอด module ต่อได้อย่างปลอดภัย */
	remove_proc_entry(FSLEK_NAME, NULL);
}
