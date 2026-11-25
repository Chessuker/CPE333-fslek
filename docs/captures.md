# รายการภาพที่ต้อง capture

ใช้คู่กับ `sudo bash tests/demo.sh` ซึ่งหยุดรอ Enter ทุกขั้นและล้างจอให้ก่อน
1 ขั้น = 1 ภาพ ตั้งชื่อไฟล์ตามเลขขั้น เช่น `1.png`
เก็บไว้ใน `captures/` (ภาพหลัก 14 ภาพ capture บน kernel 6.8.0-999 ชื่อ fslek แล้วเมื่อ 25 พ.ย. 2026)

ภาพบังคับครบแล้ว เหลือเฉพาะข้อไม่บังคับ:

- `4.png` หัวตาราง `findmnt` ตัดเป็นสองบรรทัด ถ่ายใหม่ด้วยหน้าต่างที่กว้างขึ้นถ้าอยากให้อ่านง่าย (ไม่บังคับ)

## ตั้งค่าหน้าจอก่อนเริ่ม

- ขยาย font ของ terminal ให้ใหญ่ขึ้น (ประมาณ 14-16pt) เพราะภาพจะถูกย่อลงในรายงาน A4
- ขนาดหน้าต่างประมาณ 100 คอลัมน์ x 30 บรรทัด ภาพแคบอ่านง่ายกว่าภาพกว้าง
- ครอปเฉพาะหน้าต่าง terminal ไม่เอา taskbar หรือ desktop
- ให้เห็น prompt `thawat@thawat` ในภาพ เป็นหลักฐานว่ารันบนเครื่องจริง
- ถ้าผลลัพธ์ยาวเกินจอ ให้แยกเป็นภาพ a/b ไม่ต้องย่อ font ลง

## ภาพหลัก (บังคับ 14 ภาพ)

| # | ขั้นใน demo.sh | ในภาพต้องเห็น | ใช้ในรายงานส่วน |
|---|---|---|---|
| 01 | Environment | `uname -r` = 6.8.0-999-generic, เวอร์ชัน Ubuntu | Environment |
| 02 | Build module | บรรทัด `fslek: ... fs.h=found flags=`, CC ของ 4 ไฟล์, `fslek.ko` ที่ได้ | Implementation / Build |
| 03 | Load module | `lsmod` เห็น fslek, `/proc/filesystems` มี `nodev fslek` | Register filesystem |
| 04 | Mount | `findmnt` แสดง FSTYPE = fslek, `ls -la` ของ root ว่าง | Mount |
| 05 | Create file | `hello.txt` ขนาด 0 | Create file |
| 06 | Write/read | เขียน, append, overwrite แล้ว `cat` ทีละครั้ง และ `stat` | Read/Write |
| 07 | Large file | `sha256sum` สองบรรทัดค่าเท่ากัน | Read/Write (ความถูกต้อง) |
| 08 | Create directory | `mkdir` และ `mkdir -p` ซ้อนหลายชั้น, ไฟล์ในโฟลเดอร์ลึก | Create directory |
| 09 | List directory | `ls -la` และ `ls -laR` เห็นโครงสร้างทั้งหมด | List directory |
| 10a | Delete, rename | `File exists`, `No such file`, `rmdir` ได้ `Directory not empty`, `mv` แล้วเลข inode เท่าเดิม, `rm -r` สำเร็จ | งานเสริม E1, E2 |
| 10b | Size limit and df | `findmnt` เห็น `size=10240k`, `dd` ได้ `No space left on device` หลังเขียนไป 2 MiB, `df` ก่อน/ตอนเต็ม/หลัง `rm` | งานเสริม E4 |
| 10c | Statistics | `/proc/fslek` สามรอบ: ก่อนเขียน, หลังเขียน 1 MiB, หลัง `rm` | งานเสริม E5 |
| 11 | Unmount | หลัง umount ไม่ mount อยู่แล้ว, mount ใหม่แล้วว่างเปล่า (เพราะอยู่ใน RAM) | Unmount |
| 12 | Unload + log | `rmmod`, ไม่มี fslek ใน `/proc/filesystems`, `dmesg` เห็น registered/mounted/unmounting/unregistered | Module lifecycle |

ภาพที่ 10 รุ่นเก่า (`rm` ใช้ไม่ได้) เป็นของก่อนทำ E1-E5 แทนด้วย `10a.png`, `10b.png`, `10c.png`

## ภาพเสริม

capture แล้วเมื่อ 25 พ.ย. 2026 ชื่อไฟล์จริงใน `captures/`: ภาพ 13 กับ 15 รวมอยู่ใน `test_mvp.png`,
ภาพ 16 คือ `test_edge-a.png` ถึง `test_edge-d.png`, ภาพ 14 คือ `fslek.png`, ภาพ 17 คือ `test_bench.png`

| # | ภาพ | ใช้ทำอะไร |
|---|---|---|
| 13 | ผลของ `sudo bash tests/test_mvp.sh` ส่วนท้ายที่เห็น `PASS=31 FAIL=0` | หลักฐานการทดสอบ (Testing) |
| 14 | `modinfo fslek/fslek.ko` | รายละเอียด module (ใส่ภาคผนวกได้) |
| 15 | ผลหัวข้อ `== Extra: concurrent read/write` ใน `test_mvp.sh` (5 บรรทัด PASS และจำนวนรอบที่ reader อ่าน) | หลักฐานว่า locking ทำงาน ใช้คู่กับหัวข้อ Locking ในรายงาน |
| 16 | ผล `sudo bash tests/test_edge.sh` ทั้งหมด (ยาวเกินจอ แยกเป็น 16a, 16b, ... ตามหัวข้อ A-P ต้องเห็น `PASS=225 FAIL=0 SKIP=0`) | Testing ส่วนกรณีขอบ และภาพหัวข้อ H ใช้ในส่วน Limitations ได้ |
| 17 | ผล `sudo bash tests/bench.sh` ทั้งตาราง (เก็บ `bench.csv` มาด้วย) | งานเสริม E3 |

## สิ่งที่ไม่ต้อง capture

- **โค้ด**: ให้ copy เป็นข้อความใส่รายงาน (font monospace) ไม่ใช่ภาพหน้าจอ อ่านง่ายกว่าและไม่เปลืองหน้า
  ส่วนที่ควรยกมาอธิบาย: `fslek_fill_super` (super.c), `fslek_mknod` (dir.c),
  `fslek_reserve` และ `fslek_write_iter` (file.c), struct `fslek_file_data` (fslek.h)
- **Diagram** โครงสร้าง VFS (super_block, inode, dentry, file) และเส้นทาง `write(2)` ถึง `fslek_write_iter`:
  ให้คนเขียน Docs วาดใหม่ ไม่ต้อง capture จากเว็บ

## วิดีโอสำรองสำหรับพรีเซนต์

อัด `sudo NOPAUSE=1 bash tests/demo.sh` หรือรันแบบหยุดทีละขั้นแล้วอัดหน้าจอด้วย OBS
ยาว 2-3 นาที ใช้เปิดแทนเมื่อ VM มีปัญหาตอนเดโมสด
