# fslek: Mini RAM-based File System

CPE333 Operating Systems, Mini-Project 2 (หัวข้อ I/O and File System)

filesystem ที่เก็บทุกอย่างไว้ใน RAM และเชื่อมกับ Linux ผ่าน VFS
ข้อมูลไฟล์อยู่ใน buffer ที่ fslek จองเอง ส่วนโครงสร้าง directory อยู่ใน dcache ของ VFS
umount แล้วข้อมูลทั้งหมดหายไป

ทดสอบบน Ubuntu 24.04 kernel `6.8.0-999-generic` โค้ดรองรับ kernel 7.0 ด้วยแต่ยังไม่ได้ลอง build จริง (งาน E0)

## โครงสร้าง

```
fslek/
  fslek.h    struct กลาง, ค่าคงที่, prototype
  super.c    register filesystem, mount/umount, option size=, โควตา, df, สร้าง/evict inode
  dir.c      lookup, create, mkdir  (ls, rm, rmdir, mv ใช้ของ libfs)
  file.c     read/write/truncate บน buffer ที่จองเอง (kvzalloc)
  stats.c    สถิติรวมใน /proc/fslek
  Makefile   build ได้ทั้ง out-of-tree และ in-tree
  Kconfig    สำหรับ in-tree (fs/fslek/)
tests/
  test_mvp.sh   ทดสอบ 7 operation ที่โจทย์กำหนด
  test_edge.sh  กรณีขอบและงานเสริม
  bench.sh      วัดความเร็วเทียบกับ tmpfs และ ramfs (ใช้ bench.c)
  demo.sh       เดโมทีละขั้น
docs/
  handoff.md        สถานะ งานที่เหลือ โครงรายงาน (เริ่มอ่านที่นี่)
  test-coverage.md  เคสไหนครอบโค้ดส่วนไหน
  captures.md       รายการภาพใน captures/
  fslek-design.pptx สไลด์ผลการออกแบบ
captures/           ภาพหน้าจอจาก VM
```

## Build และทดสอบ (ใน VM)

```bash
sudo apt install -y build-essential linux-headers-$(uname -r)

# clone ใน VM โดยตรง (อย่า build บน shared folder)
git clone <URL ของ repo> ~/fslek-work && cd ~/fslek-work

make -C fslek
sudo bash tests/test_mvp.sh
sudo bash tests/test_edge.sh
sudo bash tests/bench.sh
```

ลองเองทีละคำสั่ง:

```bash
sudo insmod fslek/fslek.ko
sudo mkdir -p /mnt/fslek
sudo mount -t fslek none /mnt/fslek        # จำกัดขนาดได้ด้วย -o size=16M
echo hello | sudo tee /mnt/fslek/a.txt
cat /mnt/fslek/a.txt
sudo mkdir /mnt/fslek/dir
ls -la /mnt/fslek
sudo umount /mnt/fslek
sudo rmmod fslek
sudo dmesg | grep fslek
```

## ทางเลือก: build แบบ in-tree

ใช้ kernel source `linux-7.0.0/` ที่เคยดาวน์โหลดไว้ตอน MP1

1. copy `fslek/` ไปเป็น `linux-7.0.0/fs/fslek/`
2. เพิ่ม `source "fs/fslek/Kconfig"` ใน `fs/Kconfig`
3. เพิ่ม `obj-$(CONFIG_FSLEK_FS) += fslek/` ใน `fs/Makefile`
4. build เฉพาะโฟลเดอร์นี้: `make M=fs/fslek CONFIG_FSLEK_FS=m modules`
   ไม่ต้อง compile kernel ทั้งตัวใหม่

## ขอบเขต MVP

ทำได้: mount, umount, create file, read, write (รวม append, overwrite, truncate, เขียนข้ามท้ายไฟล์), mkdir, ls

งานเสริมที่ทำแล้ว:

- ลบไฟล์และโฟลเดอร์ (`rm`, `rmdir`, `rm -r`) และเปลี่ยนชื่อ/ย้าย (`mv`)
- จำกัดขนาดรวมต่อ mount ด้วย `-o size=` (ไม่ระบุ = ครึ่งหนึ่งของ RAM), `df` แสดงพื้นที่จริง, ปรับได้ด้วย `mount -o remount,size=`
- สถิติรวมทุก mount ใน `/proc/fslek`
- benchmark เทียบกับ tmpfs และ ramfs

ยังไม่ทำ: คืน RAM เมื่อไฟล์หด (E6), hard link, symlink, FIFO, mmap
