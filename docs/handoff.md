# fslek: ส่งงานต่อ

เอกสารนี้สำหรับเพื่อนในกลุ่มที่จะมาทำงานเสริมและเขียนรายงานต่อจาก MVP

## สถานะตอนนี้ (25 พ.ย. 2026)

- โปรเจกต์เปลี่ยนชื่อจาก minifs เป็น **fslek** เมื่อ 23 พ.ย. 2026 (module, ชื่อ filesystem, ฟังก์ชัน, ไฟล์, magic เป็น `FSLK`)
- MVP ทำครบ 7 operation ที่โจทย์กำหนด: mount, umount, create file, read, write, mkdir, ls
- `tests/test_mvp.sh` ผ่าน 31/31 บน Ubuntu 24.04 kernel `6.8.0-999-generic` (25 พ.ย. 2026 รวม E1-E5)
  รวม 5 เคส concurrency ที่เพิ่มทีหลังในหัวข้อ `== Extra: concurrent read/write`
- `tests/test_edge.sh` ผ่าน 225/225 บน kernel เดียวกัน (25 พ.ย. 2026 รวม E1-E5) ทดสอบกรณีขอบ, error path, สิทธิ์,
  ข้อจำกัด, วงจรชีวิต และหน่วยความจำรั่ว ตารางว่าเคสไหนครอบโค้ดส่วนไหนอยู่ใน `docs/test-coverage.md`
- ภาพหน้าจอหลัก 14 ภาพชื่อ fslek อยู่ใน `captures/` (รายการและความหมายดู `docs/captures.md`)
- โค้ดรองรับทั้ง kernel 6.8 และ 7.0 แต่**ยังไม่เคย compile บน 7.0 จริง** (ดูงาน E0)
- E1-E5 เสร็จและทดสอบใน VM แล้ว เหลือ E0 (kernel 7.0) และ E6

## เริ่มทำงาน

1. clone repo ใน VM ของตัวเอง: `git clone <URL ของ repo> ~/fslek-work && cd ~/fslek-work`
2. build และทดสอบ:
   ```bash
   sudo apt install -y build-essential linux-headers-$(uname -r)
   make -C fslek
   sudo bash tests/test_mvp.sh     # PASS=31 FAIL=0
   sudo bash tests/test_edge.sh    # PASS=225 FAIL=0 SKIP=0
   ```
3. อ่าน `README.md` แล้วอ่านโค้ดตามลำดับ `fslek.h` → `super.c` → `dir.c` → `file.c`
   ในโค้ดมี comment ภาษาไทยอธิบายแนวคิด VFS ไว้ทุกจุดสำคัญ

## กติการ่วม

- **ทุก VFS call ที่เพิ่มต้อง build ได้ทั้ง 6.8 และ 7.0** เทียบกับ `fs/ramfs/inode.c` และ `fs/libfs.c`
  ของทั้งสองเวอร์ชันก่อนใช้ ถ้า API ต่างกันให้เพิ่ม flag ใน `Makefile` และ wrapper ใน `fslek.h`
  ตามแบบที่มีอยู่ ห้ามใช้ `#if LINUX_VERSION_CODE` เดาเอา
- งานแต่ละชิ้นต้อง**เพิ่มเคสทดสอบ** (operation หลักลง `tests/test_mvp.sh`, กรณีขอบลง `tests/test_edge.sh`)
  และ test เดิมทั้งสองไฟล์ต้องยังผ่านครบ
- หัวข้อ H ของ `test_edge.sh` คือ operation ที่ fslek ไม่มี ถ้าเพิ่มตัวไหนให้เปลี่ยนเคสนั้นเป็นคาดว่าสำเร็จ
- ถ้างานไปเปลี่ยนผลของขั้นไหนใน `tests/demo.sh` ให้แก้ demo และ **capture ภาพขั้นนั้นใหม่**
- แตก branch ต่องาน (เช่น `e6-shrink`) แล้วเปิด pull request แนบผลบรรทัด `Summary` ของทั้งสองสคริปต์ ไม่ push เข้า `main` ตรง
- `docs/fslek-design.pptx` merge ไม่ได้ บอกกันก่อนแก้ ให้แก้ทีละคน
- สไลด์แก้ใน PowerPoint ได้เลย ส่วน `docs/deck-src/build.js` ใช้สร้างใหม่ทั้งไฟล์และจะทับที่แก้มือ ต้องมี pptx skill ของ Claude (ตั้ง env `PPTX_SKILL`) กับ `NODE_PATH`

## งานเสริม

| งาน | ความสำคัญ | ไฟล์ที่แก้ | ต้องรู้ kernel |
|---|---|---|---|
| E0 ทดสอบบน kernel 7.0 | สูง | ไม่แก้โค้ด | ไม่ |
| E1 ลบไฟล์/โฟลเดอร์ (**เสร็จ** ทดสอบแล้ว) | สูง | `dir.c` | น้อย |
| E2 rename (**เสร็จ** ทดสอบแล้ว) | กลาง | `dir.c` | น้อย |
| E3 benchmark เทียบ tmpfs/ramfs (**เสร็จ** วัดแล้ว) | กลาง | `tests/bench.sh`, `tests/bench.c` | ไม่ |
| E4 mount option จำกัดขนาด + `df` (**เสร็จ** ทดสอบแล้ว) | ต่ำ | `super.c`, `file.c`, `fslek.h` | ปานกลาง |
| E5 สถิติผ่าน `/proc/fslek` (**เสร็จ** ทดสอบแล้ว) | กลาง | `stats.c` ใหม่, `super.c` | ปานกลาง |
| E6 คืนหน่วยความจำเมื่อไฟล์หด | ต่ำ | `file.c` | ปานกลาง |

ลำดับความสำคัญจัดตามเนื้อหาที่อาจารย์สอน (ดูหัวข้อ เทียบกับเนื้อหาที่เรียน ด้านล่าง)
E1 ต้องมีเพราะ Lecture 12 สไลด์ 11 นับ Delete เป็น file operation พื้นฐานคู่กับ Create/Read/Write
E5 ขยับขึ้นเป็นกลางเพราะเป็นรูปแบบ `/proc` + mutex ตรงกับเอกสาร `Kernel_memory_mutex.pdf`

### E0 ทดสอบบน kernel 7.0

คนที่มี VM Ubuntu 26.04 (kernel 7.0.0-xx) จาก MP1 รัน build, `test_mvp.sh` และ `demo.sh`
ตอน `make` ต้องเห็นบรรทัด `fs.h=found flags=-DFSLEK_HAVE_D_MAKE_PERSISTENT -DFSLEK_HAVE_INODE_JUST_DROP -DFSLEK_MKDIR_RETURNS_DENTRY`
capture บรรทัดนั้นกับผล `PASS=.. FAIL=..` มาใส่รายงานในหัวข้อ compat
ถ้า compile ไม่ผ่าน ส่ง error ทั้งหมดกลับมา

### E1 ลบไฟล์และโฟลเดอร์ (`rm`, `rmdir`)

เสร็จแล้ว ทดสอบใน VM ผ่านครบเมื่อ 25 พ.ย. 2026

- ใน `fslek_dir_inode_operations` มี `.unlink = simple_unlink` และ `.rmdir = simple_rmdir`
- เทียบ `fs/libfs.c` ของ 6.8 และ 7.0 แล้ว signature เหมือนกัน ไม่ต้องมี flag ใหม่: 6.8 ปล่อย dentry ที่ pin ไว้ด้วย `dput()` ส่วน 7.0 ใช้ `d_make_discardable()`
  ตรงกับวิธี pin ใน `fslek_pin_dentry()` ของแต่ละเวอร์ชัน
- buffer ของไฟล์ถูกคืนเองใน `fslek_evict_inode()` เมื่อไม่มีใครเปิดไฟล์นั้นอยู่
- เคสทดสอบ 33 เคสอยู่ในหัวข้อ K ของ `test_edge.sh`: `rm` แล้วหายจาก `ls`, `rmdir` โฟลเดอร์ที่มีของได้ `Directory not empty`,
  `rm -r` 1000 ไฟล์, สร้างและลบพร้อมกัน 4 process, สิทธิ์และ sticky bit, ไฟล์ที่ถูกลบขณะเปิดอยู่ยังใช้ผ่าน fd ได้,
  buffer ถูกคืนตอน `rm` หรือตอนปิด fd สุดท้าย
- `demo.sh` ขั้น 10a แสดงการลบและ `mv`
- เคส `rmdir` โฟลเดอร์ที่ไม่ว่างตรงกับ Lecture 12 สไลด์ 16 (ต้องเช็คว่าว่างก่อนลบ) ใช้อ้างในรายงานได้
  `simple_rmdir` เช็คให้แล้วผ่าน `simple_empty()`

### E2 rename (`mv`)

เสร็จแล้ว ทดสอบใน VM ผ่านครบเมื่อ 25 พ.ย. 2026

- ใน `fslek_dir_inode_operations` มี `.rename = simple_rename` (โค้ดใน `fs/libfs.c` เหมือนกันทั้ง 6.8 และ 7.0)
- ย้ายแค่ชื่อ inode และ buffer เดิมไม่ถูก copy เลข inode จึงไม่เปลี่ยน ถ้า `mv` ทับไฟล์เดิม ไฟล์เดิมถูก unlink และคืน buffer
- `mv` ข้าม mount VFS คืน `EXDEV` แล้วคำสั่ง `mv` จะ copy และลบเอง
- เคสทดสอบ 35 เคสอยู่ในหัวข้อ L: ในโฟลเดอร์เดียวกัน, ข้ามโฟลเดอร์, ทับไฟล์, ย้ายโฟลเดอร์ทั้งก้อน, nlink, ชนิดไม่ตรงกัน, พร้อมกัน 4 process

### E3 benchmark เทียบกับ tmpfs และ ramfs

เสร็จแล้ว วัดใน VM เมื่อ 25 พ.ย. 2026 (`captures/test_bench.png`): `sudo bash tests/bench.sh` (ใช้เวลาไม่กี่นาที ต้องมี gcc)

median ของ 15 รอบ หน่วย MiB/s ช่วงช้าสุดถึงเร็วสุดดูในภาพ:

| | ขนาด | fslek | tmpfs | ramfs | fslek ÷ ramfs |
|---|---|---|---|---|---|
| เขียน `bs=1M` | 1 MiB | 10912 | 1171 | 1471 | 7.4 |
| | 4 MiB | 5068 | 1085 | 1475 | 3.4 |
| | 16 MiB | 2506 | 1016 | 1386 | 1.8 |
| | 64 MiB | 2316 | 1012 | 1379 | 1.7 |
| อ่าน `bs=1M` | 1 MiB | 8028 | 4765 | 6257 | 1.3 |
| | 4 MiB | 7929 | 3872 | 5233 | 1.5 |
| | 16 MiB | 8022 | 3894 | 4398 | 1.8 |
| | 64 MiB | 7324 | 2925 | 4542 | 1.6 |
| เขียน `bs=4K` | 1 MiB | 1759 | 660 | 745 | 2.4 |
| | 4 MiB | 1655 | 604 | 680 | 2.4 |
| | 16 MiB | 1276 | 669 | 738 | 1.7 |
| | 64 MiB | 1245 | 657 | 751 | 1.7 |
| อ่าน `bs=4K` | 1 MiB | 2137 | 2088 | 2118 | 1.0 |
| | 4 MiB | 2167 | 1842 | 2042 | 1.1 |
| | 16 MiB | 2082 | 1680 | 1918 | 1.1 |
| | 64 MiB | 2041 | 1746 | 1783 | 1.1 |

- สรุปได้: fslek เขียนเร็วกว่าทั้งสองตัว และอ่าน `bs=1M` เร็วกว่า ส่วนอ่าน `bs=4K` ไม่ต่าง (ช่วงซ้อนกัน)
- คำอธิบายที่เป็นไปได้ **ยังไม่ได้ profile**: buffer ก้อนเดียวไม่ต้องหาและจองทีละหน้าใน page cache, ไฟล์ 1 MiB เขียนลงหน่วยความจำก้อนเดิมที่ยังอยู่ใน CPU cache,
  อ่านทีละ 4 KiB เสียเวลากับ system call เป็นหลัก
- เขียนในรายงานให้ครบว่า fslek ทำน้อยกว่า (ไม่มี mmap, ไม่มี swap) และใช้ RAM เกินได้เกือบเท่าตัว

- `bench.sh` mount ทั้งสามตัวแล้วให้ `bench.c` วัดการเขียนและอ่านไฟล์ 1, 4, 16, 64 MiB ทั้ง `bs=1M` และ `bs=4K`
- แต่ละช่องแสดง median ของ 15 รอบ และช่วงช้าสุดถึงเร็วสุด หน่วย MiB/s ผลลง `bench.csv` ในโฟลเดอร์โปรเจกต์สำหรับทำกราฟ
- เขียนเริ่มจากไฟล์ใหม่ทุกครั้ง fslek จึงเสียเวลาขยาย buffer ทุกรอบ ทั้งสามตัวอยู่ใน RAM จึงไม่ต้อง `drop_caches`
- **ห้ามใช้ผลรุ่นแรกที่วัดด้วย `dd`** (ไม่อยู่ใน repo) รุ่นนั้นใช้ `dd` ค่าเฉลี่ย 5 รอบ ค่าแกว่งและไม่เรียงตามขนาดไฟล์
  เช่น fslek อ่าน `bs=1M` ที่ 16 MiB ได้ 1690 แต่ที่ 64 MiB ได้ 8142 ส่วนหนึ่งเพราะ page fault ของ buffer ใน `dd` ถูกนับรวม
- สิ่งที่แก้: จับเวลาเฉพาะ system call อ่าน/เขียน, แตะ buffer ก่อนวัด, แต่ละตัวอย่างส่งข้อมูลอย่างน้อย 64 MiB,
  ทิ้งรอบอุ่นเครื่อง 1 รอบ, สลับ filesystem ทุกรอบ, ตรึง process ไว้ที่ CPU เดียว
- ลองสองรอบกับ tmpfs และ ramfs ใน WSL ค่า median ต่างกันระหว่างรอบมากสุดราว 22% ส่วนใหญ่ไม่เกิน 10%
  จึงสรุปได้เฉพาะความต่างที่ใหญ่กว่านั้นชัดเจน ถ้าช่วงในวงเล็บซ้อนกันมากให้เขียนว่าไม่ต่างกัน
- ไฟล์เล็กอ่านเร็วกว่าไฟล์ใหญ่เพราะอยู่ใน CPU cache ได้ทั้งไฟล์ ไม่ใช่ความผิดปกติ

### E4 mount option `size=` และ `df`

เสร็จแล้ว ทดสอบใน VM ผ่านครบเมื่อ 25 พ.ย. 2026

- `struct fslek_sb_info` ใน `sb->s_fs_info` มี `max_bytes`, `used_bytes` และ spinlock ของตัวเอง
- `fslek_parse_param()` รับ `size=` (ลงท้าย K, M, G ได้ ปัดขึ้นเป็นหน้า) ค่าผิด, 0 หรือ option ที่ไม่รู้จักทำให้ mount ล้ม
- ไม่ระบุ `size=` ใช้ครึ่งหนึ่งของ RAM เหมือน tmpfs จึงไม่มี mount ไหนที่เขียนจน RAM หมดเครื่องได้
- `fslek_reserve()` เรียก `fslek_charge()` ก่อนจอง buffer ถ้าเหลือไม่พอขยายเท่าตัวก็เอาเท่าที่เหลือ ถ้าไม่พอกับที่ต้องเขียนคืน `-ENOSPC`
- คืนโควตาด้วย `fslek_uncharge()` ตอน truncate เป็น 0, ตอน evict และตอน kvzalloc ล้ม
- นับ `capacity` ไม่ใช่ `i_size` ไฟล์ที่ถูก `rm` แต่ยังเปิดอยู่จึงยังนับ ตอนขยายมีก้อนเก่ากับใหม่พร้อมกันชั่วครู่ ซึ่งไม่ได้นับก้อนเก่าซ้ำ
- `mount -o remount,size=` ปรับได้ แต่ลดต่ำกว่าที่ใช้อยู่ไม่ได้ `df` กับ `findmnt` แสดงค่าจริง
- `kfree(sbi)` อยู่หลัง `fslek_kill_super()` ต่างจาก ramfs เพราะการ evict ตอน umount ยังต้องใช้ `sbi`
- ข้อจำกัด: `write()` ครั้งเดียวที่ใหญ่กว่าพื้นที่ที่เหลือล้มทั้งก้อน ไม่เขียนบางส่วนให้แบบ tmpfs
- เคสทดสอบ 41 เคสอยู่ในหัวข้อ N

### E5 สถิติผ่าน `/proc/fslek`

เสร็จแล้ว ทดสอบใน VM ผ่านครบเมื่อ 25 พ.ย. 2026

- `stats.c` มี `atomic_long_t` 4 ตัว รวมทุก mount: `files`, `directories` (รวม root), `bytes` (buffer ที่จอง), `grows` (จำนวนครั้งที่จองก้อนใหม่)
- สร้างด้วย `proc_create_single()` ใน `fslek_init()` ก่อน register และลบด้วย `remove_proc_entry()` ใน `fslek_exit()`
- `bytes` ถูกแก้ใน `fslek_charge()`/`fslek_uncharge()` ที่เดียวกับโควตาของ E4 สองค่าจึงตรงกันเสมอ
- เหตุผลที่ใช้ atomic แทน mutex ในสไลด์หน้า 9 อยู่ในหัวข้อ Locking ด้านล่าง ใช้ใส่รายงานได้
- เดโมสด: `watch -n 0.5 cat /proc/fslek` ระหว่างเขียนไฟล์ใหญ่
- เคสทดสอบ 22 เคสอยู่ในหัวข้อ P รวมการยืนยันว่า counter กลับเป็น 0 หลัง umount (ไม่มีการนับรั่ว)

### E6 คืนหน่วยความจำเมื่อไฟล์หด

- ตอนนี้ buffer ขยายอย่างเดียว (ภาพ 9: ไฟล์ 5 MiB จองจริง 8 MiB) และคืนเฉพาะตอน truncate เป็น 0
- ใน `fslek_resize()` ถ้าขนาดใหม่เหลือไม่ถึง 1/4 ของ `capacity` ให้จองก้อนเล็กลงแล้ว copy ไป
- ต้องรักษา invariant ใน `fslek.h`: ไบต์ที่เกิน `i_size` ต้องเป็น 0
- ผลก่อนและหลังแก้ใช้เป็นหัวข้อ trade-off ในรายงานได้

## เทียบกับเนื้อหาที่เรียน

อ่านจาก `Lecture/Lecture11_IODevicesAndMassDataStorage.pptx`, `Lecture12_FileSystemAndImplementation.pptx`
และ `Kernel_memory_mutex.pdf` แล้ว โค้ดไม่มีจุดที่ขัดกับที่สอน แต่รายงานต้องอธิบายให้เห็นว่าตรงกันตรงไหน
และต่างกันตรงไหนเพราะอะไร

### Memory allocation (PDF หน้า 7)

| ในสไลด์ | ใน fslek |
|---|---|
| `kzalloc()` / `kfree()` ได้หน่วยความจำต่อเนื่องทาง physical | `struct fslek_file_data` ใน `fslek_alloc_file_data()` (`file.c`) |
| `kvmalloc()` ลอง kmalloc ก่อนแล้วค่อย vmalloc, คืนด้วย `kvfree()` | buffer ข้อมูลไฟล์ใน `fslek_reserve()` ใช้ `kvzalloc()` (แบบที่ล้างเป็น 0) |

เหตุผลที่ buffer ใช้ `kvzalloc`: ไฟล์ใหญ่ได้ถึง 64 MiB ถ้าใช้ kmalloc ต้องหาหน้าที่ต่อกันทาง physical ซึ่งมักไม่มี

### Locking (PDF หน้า 8-9) **ต้องอธิบายในรายงาน**

สไลด์ใช้ mutex ตัวเดียวทั้ง module (`DEFINE_MUTEX`) ส่วน fslek ใช้ lock ของแต่ละ inode
(`inode_lock` ตอนเขียน, `inode_lock_shared` ตอนอ่าน) ซึ่งเป็น reader-writer semaphore ใน `struct inode`

- อ่านพร้อมกันได้หลายคน เขียนได้ทีละคน และสองไฟล์ต่างกันไม่ต้องรอกันเลย
- สไลด์หน้า 9 แนะนำให้ copy ข้อมูล user ไป buffer ชั่วคราวก่อน lock เราไม่ทำแบบนั้น
  เพราะ `fslek_reserve()` อาจจองก้อนใหม่แล้ว `kvfree()` ก้อนเก่าทิ้ง ถ้า reader copy ออกนอก lock
  จะอ่านหน่วยความจำที่ถูกคืนไปแล้ว (use-after-free) อีกเหตุผลคือ buffer ชั่วคราวทำให้ใช้ RAM เป็นสองเท่า
  สำหรับไฟล์ 64 MiB
- การ copy ข้อมูล user ระหว่างถือ lock อาจเกิด page fault ได้ ซึ่งปลอดภัยเพราะ fslek ไม่มี `.mmap`
  user buffer จึงไม่มีทางเป็นหน้าของไฟล์ fslek เอง (ไม่มีทาง lock ซ้อนตัวเอง)
- โควตา `size=` ใช้ร่วมกันทุกไฟล์ใน mount จึงมี `spinlock_t` แยกต่อ super_block (`fslek_sb_info.lock`)
  ใช้ spinlock แทน mutex ได้เพราะช่วงที่ถือมีแค่บวกลบเลข ไม่มีการ sleep ลำดับ lock คือ inode_lock ก่อนเสมอ
- counter ใน `/proc/fslek` ใช้ `atomic_long_t` เพราะแต่ละตัวอิสระกัน ถ้าใช้ mutex ตัวเดียวแบบสไลด์หน้า 9
  สองไฟล์ที่ไม่เกี่ยวกันจะต้องรอกันทุกครั้งที่ buffer ขยาย ข้อแลกเปลี่ยนคือค่าแต่ละบรรทัดอาจอ่านคนละจังหวะกันเล็กน้อย
- หลักฐาน: หัวข้อ concurrency ของ `test_mvp.sh` (append พร้อมกัน 8 ตัว และอ่านระหว่างที่ไฟล์โต) ผ่าน 5/5
- เขียนตามจริงในรายงานว่าเป็น smoke test: รอบที่วัดบน VM reader อ่านทั้งไฟล์รวมแค่ 12 รอบระหว่างที่ไฟล์โต
  ช่วงที่ buffer ถูกจองใหม่สั้นมาก test ผ่านจึงไม่ได้พิสูจน์ว่าไม่มี race ทุกกรณี
  ที่ยืนยันความถูกต้องได้จริงคือเหตุผลในโค้ด: ทุกการแตะ `data`/`capacity` อยู่ใต้ lock

### Lecture 12 กับส่วนที่ตรงกันใน fslek

| สไลด์ | หัวข้อ | ใน fslek |
|---|---|---|
| 5 | file = linear array of bytes, directory = คู่ (ชื่อ, inode number) | buffer ต่อเนื่องก้อนเดียว, คู่ชื่อกับ inode อยู่ใน dentry |
| 11 | Create / Read / Write / Delete | create, read_iter, write_iter, delete ใช้ `simple_unlink` (E1) |
| 13 | tree-structured directory, absolute/relative path | `mkdir -p dir/sub/deep` (ภาพ 8) |
| 14 | hard link ต้องมี reference count | `i_nlink` มีอยู่แล้วแต่ยังไม่รองรับ `ln` (ข้อจำกัด) |
| 16 | mkdir ได้ `.` กับ `..`, ลบ directory ต้องว่าง | directory ใหม่ `nlink = 2` และ `inc_nlink(dir)` ใน `dir.c`, `simple_rmdir` เช็คว่าว่างก่อนลบและลด `nlink` ของแม่ (E1) |
| 17 | File Control Block, Volume Control Block | FCB = `struct inode`, volume = `struct super_block` |
| 19 | ต้อง mount ที่ mount point ก่อนใช้ | `mount -t fslek none /mnt/fslek` (ภาพ 4) |
| 21 | contiguous allocation: ไม่รู้ขนาดตอนสร้าง ถ้าโตเกินต้องย้ายไฟล์ | buffer ก้อนเดียว ขยายเท่าตัวแล้ว copy ไปก้อนใหม่ คือปัญหาข้อนี้ตรงๆ แต่ทำให้ย้ายไม่บ่อย |
| 24-26 | indexed allocation | เบื้องหลัง `vmalloc` เอาหน้าที่กระจายกันมาต่อด้วย page table คล้าย index block |
| 28 | free space management | หน้าว่างใช้ allocator ของ kernel ส่วนพื้นที่ที่เหลือของ mount นับเองด้วย `fslek_charge`/`fslek_uncharge` (E4) |
| 29 | directory แบบ linear list หรือ hash table | ค้นชื่อผ่าน dcache ซึ่งเป็น hash table (`simple_lookup`) |
| 30-31 | consistency, journaling | ไม่จำเป็นเพราะไม่มีอะไรลง disk (ข้อจำกัดด้าน persistence) |

### Lecture 11

- สไลด์ 27 (file system stack): ext4 ส่งต่อให้ generic block layer และ device driver
  แต่ fslek ไม่มี block device (`get_tree_nodev`) ข้อมูลจบที่ RAM ใน buffer ของเรา
  ควรวาด stack เทียบกันสองข้างในหัวข้อ Background
- เนื้อหาเรื่อง disk scheduling, DMA, interrupt ไม่เกี่ยวกับ fslek โดยตรง ไม่ต้องยัดลงรายงาน

## โครงรายงาน (ไม่เกิน 25 หน้า ไม่นับภาคผนวก)

ใช้รูปแบบเดียวกับ MP1: เนื้อหาภาษาไทย หัวข้อภาษาอังกฤษ ปกมีรายชื่อสมาชิกทั้ง 7 คน

| ส่วน | หน้า | เนื้อหา | ภาพ/ข้อมูลที่ใช้ |
|---|---|---|---|
| 1. Introduction | 1 | เป้าหมายตามโจทย์, ขอบเขต, environment | ภาพ 1 |
| 2. Background: Linux VFS | 4-5 | super_block, inode, dentry, file และตาราง operations, dcache, ramfs/libfs, page cache เทียบกับ buffer ของเรา, ตาราง Lecture 12 กับ fslek, file system stack เทียบกับ ext4 | diagram วาดเอง |
| 3. Design | 3-4 | โครงสร้างไฟล์โค้ด, `fslek_file_data` และ invariant, การขยาย buffer เท่าตัว (contiguous allocation), kvzalloc, locking เทียบกับ mutex ในสไลด์, compat 6.8/7.0 | diagram, ภาพ 6 และ 9 |
| 4. Implementation | 5-6 | แยกตาม operation: register/mount/umount, create, mkdir, lookup/ls, read, write, truncate พร้อมโค้ดสั้นๆ และเส้นทางจาก system call ถึงฟังก์ชันของเรา | ภาพ 2-5, 8, 11-12 |
| 5. Testing & Results | 4-5 | ตาราง 31 เคสของ `test_mvp.sh` (รวม concurrency), สรุป 225 เคสของ `test_edge.sh` จัดกลุ่มตามหัวข้อ A-P พร้อมตาราง coverage, ผลเดโม, ผล benchmark (E3), ผลบน 7.0 (E0) | ภาพ 6-10c, ภาพ PASS=31, ภาพ 15-17 |
| 6. Extensions | 1-2 | E1-E5: ลบ, rename, benchmark, `size=` + `df`, `/proc/fslek` | ภาพ 10a-10c, 17 |
| 7. Problems & Limitations | 1 | ปัญหาที่เจอ, สิ่งที่ยังไม่รองรับ: ข้อมูลหายเมื่อ umount (ไม่ persistent), ไม่มี hard link/symlink, ไม่มี mmap, ไฟล์หดแล้วไม่คืน RAM จนกว่าจะเป็น 0, เขียนก้อนใหญ่ที่เกินโควตาล้มทั้งก้อน | ภาพ 16 หัวข้อ H |
| 8. Conclusion | 0.5 | สรุปสั้น | |
| ภาคผนวก | ไม่จำกัด | source code ทั้งหมด, `modinfo`, test script | |

โค้ดในรายงานให้ใส่เป็นข้อความ font monospace ไม่ใช่ภาพหน้าจอ และไม่ต้องจัด justify

## พรีเซนต์ 7-11 นาที

| ช่วง | เวลา | เนื้อหา |
|---|---|---|
| เปิด | 1 นาที | โจทย์และสิ่งที่ทำ |
| VFS | 3 นาที | อธิบายด้วยภาพ (ทำแบบ fancy ได้): system call ผ่าน VFS มาถึง fslek อย่างไร |
| Design | 1.5 นาที | buffer ของเราเทียบกับ page cache, การขยายเท่าตัว |
| Demo สด | 3 นาที | `sudo bash tests/demo.sh` เลือกขั้น 3-11 |
| ผลและข้อจำกัด | 1 นาที | test 31 เคส (เน้นเคส concurrency ที่ตอบคำถามในสไลด์ mutex), benchmark, สิ่งที่ยังไม่รองรับ |

อัดวิดีโอเดโมสำรองไว้ด้วย (`sudo NOPAUSE=1 bash tests/demo.sh`) เผื่อ VM มีปัญหาตอนพรีเซนต์

## ช่องแบ่งงาน (กรอกเอง)

| งาน | คนรับ | กำหนดส่ง |
|---|---|---|
| E0 ทดสอบบน 7.0 | | |
| กราฟ benchmark จาก `bench.csv` | | |
| E6 (เลือกตามเวลา) | | |
| รายงานส่วน 1-3 | | |
| รายงานส่วน 4-8 + รวมเล่ม | | |
| สไลด์ + วิดีโอสำรอง | | |
