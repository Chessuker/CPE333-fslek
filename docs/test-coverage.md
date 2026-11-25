# Test coverage ของ fslek

มีสคริปต์ทดสอบสองตัว รันใน VM ด้วย sudo ทั้งคู่ (`tests/bench.sh` วัดความเร็ว ไม่ใช่การทดสอบความถูกต้อง)

| สคริปต์ | เคส | ใช้ทำอะไร |
|---|---|---|
| `tests/test_mvp.sh` | 31 | 7 operation ตามโจทย์ + concurrency (ภาพ 13, 15) |
| `tests/test_edge.sh` | 225 | กรณีขอบ, error path, สิทธิ์, ข้อจำกัด, วงจรชีวิต, หน่วยความจำรั่ว, งานเสริม E1, E2, E4, E5 |

ผลบน Ubuntu 24.04 kernel `6.8.0-999-generic` (25 พ.ย. 2026 รวม E1-E5): `test_mvp.sh` PASS=31 FAIL=0, `test_edge.sh` PASS=225 FAIL=0 SKIP=0

| หัวข้อ | A | B | C | D | E | F | G | H | I | J | K | L | N | P | ท้าย |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| เคส | 17 | 8 | 5 | 10 | 14 | 8 | 9 | 6 | 9 | 5 | 33 | 35 | 41 | 22 | 3 |

ตัวเลขจากหัวข้อ J ใช้ในรายงานได้: VmallocUsed ก่อน 18544 kB หลังเขียนไฟล์ 32 MiB เป็น 51376 kB
(เพิ่ม 32832 kB ตรงกับ buffer 32 MiB ที่ kvzalloc จองผ่าน vmalloc) และกลับมาใกล้ค่าเดิมหลัง truncate และ umount
จากหัวข้อ K: ก่อน 18640 kB หลังเขียน 32 MiB เป็น 51456 kB หลัง `rm` เหลือ 18656 kB

## code path กับเคสที่ครอบ

ตัวอักษรคือหัวข้อใน `test_edge.sh` (A-P ไม่มี M และ O) และ M คือ `test_mvp.sh`

### file.c

| ฟังก์ชัน / กรณี | เคส |
|---|---|
| `fslek_alloc_file_data`: ไฟล์ใหม่ยังไม่จอง buffer | A (ไฟล์ว่าง 0 บล็อก) |
| `fslek_reserve`: จองครั้งแรกขั้นต่ำ 4 KiB | A (ไฟล์ 1 ไบต์ = 8 บล็อก) |
| `fslek_reserve`: ขยายเท่าตัวและ copy ข้อมูลเดิม | A (เขียนทีละไบต์ 10000 ครั้ง, 32 บล็อก), M (5 MiB) |
| `fslek_reserve`: เกิน 64 MiB คืน `-EFBIG` | C |
| `fslek_reserve`: เกินโควตาคืน `-ENOSPC`, เหลือไม่พอขยายเท่าตัวก็เอาเท่าที่เหลือ | N |
| `fslek_reserve`: kvzalloc ล้มคืน `-ENOMEM` | **ไม่ได้ทดสอบ** (ดูด้านล่าง) |
| `fslek_resize`: truncate เป็น 0 คืน buffer | B, J (vmalloc ลดลง) |
| `fslek_resize`: ขยาย ส่วนใหม่เป็น 0 | B (1 MiB เป็น 0 ทั้งไฟล์) |
| `fslek_resize`: หด แล้วขยายกลับไม่เห็นข้อมูลเก่า (invariant) | B |
| `fslek_read_iter`: อ่านกลางไฟล์ / เลย EOF / ขอเกินท้ายไฟล์ | A |
| `fslek_read_iter`: อ่านลง buffer หลายก้อน (readv) | A |
| `fslek_write_iter`: เขียนทับกลางไฟล์, เขียนเลยท้ายไฟล์ (รูเป็น 0) | A, M (sparse) |
| `fslek_write_iter`: `O_APPEND` ผ่าน `generic_write_checks` | M, C |
| `fslek_write_iter`: เขียน 0 ไบต์ | A |
| `fslek_write_iter`: เขียนหลายก้อน (writev) | A |
| `fslek_write_iter`: เขียนที่ offset 64 MiB คืน `-EFBIG` | C |
| `fslek_write_iter`: อัปเดต mtime/ctime | D |
| `fslek_write_iter` / `read_iter` พร้อมกันหลาย process | M (concurrency) |
| `fslek_setattr`: chmod, chown, touch -d | D |
| `fslek_setattr`: truncate เกิน 64 MiB ถูกปฏิเสธใน `setattr_prepare` | B |
| `generic_file_llseek` | A (tail -c) |
| `copy_splice_read` / `iter_file_splice_write` | G (sendfile ทั้งสองทิศ) |
| `noop_fsync` | G |

### dir.c

| ฟังก์ชัน / กรณี | เคส |
|---|---|
| `fslek_create` | M, E (1000 ไฟล์, ชื่อยาว 255, ชื่อภาษาไทย) |
| `fslek_mkdir` + `inc_nlink(dir)` | M, E (nlink = 7) |
| `fslek_mknod`: อัปเดต mtime ของ directory แม่ | D |
| `simple_lookup`: ชื่อที่ไม่มี, ชื่อยาวเกิน 255 | E |
| `simple_dir_operations`: readdir 1000 รายการ, `.` และ `..` | E |
| `simple_unlink`: ลบไฟล์, ชื่อหายจาก `ls`, สร้างชื่อเดิมใหม่ได้, อัปเดต mtime ของ directory แม่ | K |
| `simple_rmdir`: ลบ directory ว่าง, nlink ของแม่ลดกลับ, ไม่ว่างคืน `ENOTEMPTY` | K |
| ลบผิดชนิด (`EISDIR`, `ENOTDIR`), สร้างไฟล์ใน directory ที่ถูกลบแล้ว (`ENOENT`) | K |
| ลบทั้งต้นไม้ (`rm -r` 1000 ไฟล์), สร้างและลบพร้อมกัน 4 process | K |
| สิทธิ์การลบ: directory 755 (`EACCES`), sticky bit (`EPERM`) | K |
| `simple_rename`: ในโฟลเดอร์เดียวกัน, ข้ามโฟลเดอร์, ทับไฟล์, ย้ายโฟลเดอร์, nlink, mtime | L |
| `simple_rename`: ปลายทางไม่ว่าง (`ENOTEMPTY`), ชนิดไม่ตรง (`EISDIR`, `ENOTDIR`), ย้ายเข้าตัวเอง (`EINVAL`), ข้าม mount (`EXDEV`) | L |
| `simple_rename`: สิทธิ์ และ 4 process พร้อมกัน | L |
| operation ที่ไม่มีคืน `EPERM` (link, symlink, mknod) | H |

### super.c

| ฟังก์ชัน / กรณี | เคส |
|---|---|
| `fslek_init` / `fslek_exit` | M |
| `fslek_get_tree` → `get_tree_nodev`: แต่ละ mount ได้ super_block ใหม่ | I (mount สองที่แยกกัน) |
| `fslek_fill_super`: s_magic, s_maxbytes | G (statfs), C |
| `fslek_get_inode`: เจ้าของตามผู้สร้าง, setgid, umask | D, F |
| `fslek_get_inode`: ชนิดอื่นที่ไม่รองรับคืน `-EINVAL` | ไปไม่ถึง เพราะไม่มี `.mknod` VFS ตัดที่ `EPERM` ก่อน (H) |
| `fslek_evict_inode`: คืน buffer ตอน umount | J (vmalloc กลับมาเท่าเดิม, 20 รอบไม่รั่ว) |
| `fslek_evict_inode`: คืน buffer ตอน `rm` และตอนปิด fd สุดท้ายของไฟล์ที่ถูกลบ | K (vmalloc กลับมาเท่าเดิม, 50 รอบไม่รั่ว) |
| `fslek_parse_param`: size ถูก/ผิด/0/ติดลบ/ว่าง, option ที่ไม่รู้จัก, ปัดขึ้นเป็นหน้า | N |
| `fslek_reconfigure`: เพิ่ม, ลดพอดีที่ใช้, ลดต่ำกว่าที่ใช้ต้องล้ม | N |
| `fslek_charge` / `fslek_uncharge`: เต็มพอดี, คืนตอน rm/truncate/ปิด fd, โควตาแยกต่อ mount, 4 process แย่งกัน | N |
| `fslek_statfs`, `fslek_show_options` | N (df, findmnt) |
| `fslek_evict_inode`: คืน buffer ของไฟล์ที่ถูก `mv` ทับ | L |
| `fslek_kill_sb`: เรียกเมื่อ reference สุดท้ายหายไป | I (lazy umount + fd ค้าง) |
| module ถูกถือไว้ระหว่าง mount | I (rmmod ต้องล้ม) |

### stats.c

| ฟังก์ชัน / กรณี | เคส |
|---|---|
| `fslek_stats_show`: ค่าถูกหลัง create, write, mkdir, mv, truncate, rm, rmdir | P |
| รวมหลาย mount และไฟล์ที่ถูกลบแต่ยังเปิดอยู่ | P |
| counter ตรงหลัง 4 process พร้อมกัน และกลับเป็น 0 หลัง umount | P |
| `fslek_stats_exit`: `/proc/fslek` หายหลัง rmmod | ท้ายสคริปต์ |

## ที่ยังไม่ครอบ และเหตุผล

- **kvzalloc ล้ม (`-ENOMEM`)**: ต้องใช้ fault injection (`CONFIG_FAILSLAB`, `CONFIG_FAULT_INJECTION_DEBUG_FS`)
  ซึ่ง kernel ของ VM อาจไม่ได้เปิดไว้ เช็คได้ด้วย `ls /sys/kernel/debug/failslab`
  ถ้ามีก็เพิ่มเคสได้ ถ้าไม่มีให้เขียนในรายงานว่าตรวจด้วยการอ่านโค้ดแทน
- **copy_from_iter ได้ไม่ครบ (user buffer ผิด)**: ทำให้เกิดจาก shell ไม่ได้ ต้องเขียนโปรแกรม C ส่ง pointer ผิด
- **หน่วยความจำรั่วฝั่ง kmalloc** (ไฟล์เล็กกว่า ~4 MiB และ `struct fslek_file_data`): `VmallocUsed` เห็นแค่ฝั่ง vmalloc
  ถ้าจะตรวจต้องใช้ kernel ที่เปิด `CONFIG_DEBUG_KMEMLEAK`
- **kernel 7.0**: งาน E0 ต้องรันทั้งสองสคริปต์บน 7.0 ด้วย
