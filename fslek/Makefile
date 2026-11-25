# SPDX-License-Identifier: GPL-2.0
#
# ใช้ได้ 2 แบบ:
#   out-of-tree:  cd fslek && make            (build กับ headers ของ kernel ที่รันอยู่)
#   in-tree:      วางโฟลเดอร์นี้เป็น fs/fslek/ ใน kernel source แล้วเปิด CONFIG_FSLEK_FS
#                 (ดู README.md หัวข้อ in-tree)

ifneq ($(KERNELRELEASE),)
# ---- ส่วนที่ Kbuild อ่าน ----
obj-$(CONFIG_FSLEK_FS) += fslek.o
fslek-y := super.o dir.o file.o stats.o

# VFS API ต่างกันระหว่าง kernel 6.8 กับ 7.0 อยู่ 3 จุด
# ตรวจจาก header ของ kernel ที่กำลัง build ด้วยแทนการเดาจากเลขเวอร์ชัน
# (ดู compat ใน fslek.h)
FSLEK_INC := $(srctree)/include/linux
# ถ้าหา header ไม่เจอ grep จะเงียบและ flag จะว่าง ซึ่งเท่ากับเลือก API ของ 6.8
# ไม่ว่า kernel จริงจะเป็นเวอร์ชันไหน จึงต้องเตือนให้เห็นชัด
ifeq ($(wildcard $(FSLEK_INC)/fs.h),)
$(warning fslek: ไม่เจอ $(FSLEK_INC)/fs.h การตรวจ API อาจผิด ถ้า build บน kernel >= 6.15 จะ compile ไม่ผ่าน)
endif
ifneq ($(shell grep -s d_make_persistent $(FSLEK_INC)/dcache.h),)
ccflags-y += -DFSLEK_HAVE_D_MAKE_PERSISTENT
endif
ifneq ($(shell grep -s inode_just_drop $(FSLEK_INC)/fs.h),)
ccflags-y += -DFSLEK_HAVE_INODE_JUST_DROP
endif
ifneq ($(shell grep -sE 'dentry \*\s*\(\*mkdir\)' $(FSLEK_INC)/fs.h),)
ccflags-y += -DFSLEK_MKDIR_RETURNS_DENTRY
endif
$(info fslek: headers=$(FSLEK_INC) fs.h=$(if $(wildcard $(FSLEK_INC)/fs.h),found,MISSING) flags=$(ccflags-y))
else
# ---- เรียกจาก shell ปกติ ----
KDIR ?= /lib/modules/$(shell uname -r)/build

all:
	$(MAKE) -C $(KDIR) M=$(CURDIR) CONFIG_FSLEK_FS=m modules

clean:
	$(MAKE) -C $(KDIR) M=$(CURDIR) clean

.PHONY: all clean
endif
