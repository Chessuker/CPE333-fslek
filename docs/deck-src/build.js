// สร้าง docs/fslek-design.pptx : ผลการออกแบบ fslek แบบภาพ พร้อมชื่อไฟล์ที่เกี่ยวข้อง
const pptxgen = require("pptxgenjs");
const path = require("path");
const fs = require("fs");
// โฟลเดอร์ของ pptx skill มี id ในชื่อที่เปลี่ยนได้ จึงค้นหาแทนการระบุตรงๆ (ระบุเองได้ด้วย env PPTX_SKILL)
function findSkill() {
  if (process.env.PPTX_SKILL) return process.env.PPTX_SKILL;
  const base = path.join(process.env.APPDATA, "Claude/local-agent-mode-sessions/skills-plugin");
  for (const a of fs.readdirSync(base)) {
    if (!fs.statSync(path.join(base, a)).isDirectory()) continue;
    for (const b of fs.readdirSync(path.join(base, a))) {
      const p = path.join(base, a, b, "skills/pptx");
      if (fs.existsSync(p + "/scripts/apply_theme.js")) return p;
    }
  }
  throw new Error("ไม่เจอ pptx skill ให้ตั้ง env PPTX_SKILL");
}
const SKILL = findSkill();
const { applyTheme } = require(SKILL + "/scripts/apply_theme.js");

const OUT = process.argv[2] || "fslek-design.pptx";

const THEME = {
  name: "fslek academic",
  headFontFace: "Leelawadee UI",
  bodyFontFace: "Leelawadee UI",
  colors: {
    dk1: "2D2D2D", lt1: "FFFFFF", dk2: "1F4E79", lt2: "EAF1F8",
    accent1: "2E75B6", accent2: "C55A11", accent3: "6B7280",
    accent4: "F2F2F2", accent5: "BFBFBF", accent6: "1F4E79",
    hlink: "2E75B6", folHlink: "6B7280",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "fslek: ผลการออกแบบ";
pres.author = "กลุ่ม รวมกันตายหมู่_return";

const C = pres.SchemeColor;
const NAVY = C.text2, BLUE = C.accent1, ORANGE = C.accent2, MUTED = C.accent3;
const GRAY = C.accent4, LINE = C.accent5, BODY = C.text1, WHITE = C.background1, TINT = C.background2;
const CODE = "Consolas";
const CAP = path.join(__dirname, "../../captures").replace(/\\/g, "/") + "/";

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "TITLE",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 1.25, w: 8.8, h: 1.7,
      fontSize: 27, bold: true, color: WHITE, valign: "bottom", align: "left" }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.6, y: 3.2, w: 8.8, h: 1.3,
      fontSize: 16, color: TINT, valign: "top", align: "left" }, text: "" } },
  ],
});

pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: WHITE },
  margin: [0.3, 0.5, 0.45, 0.5],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.25, w: 9.0, h: 0.85,
      fontSize: 22, bold: true, color: NAVY, valign: "top", align: "left", margin: 0 }, text: "" } },
    { text: { text: "fslek · CPE333 Mini-Project 2", options: { x: 0.5, y: 5.3, w: 5, h: 0.25,
      fontSize: 10, color: MUTED, margin: 0 } } },
  ],
  slideNumber: { x: 9.0, y: 5.3, w: 0.5, h: 0.25, fontSize: 10, color: MUTED, align: "right" },
});

// ---------- helpers ----------
const shapes = pres.shapes;

// ป้ายชื่อไฟล์ (motif ของทั้ง deck): พื้นฟ้าอ่อน ตัว Consolas สีกรมท่า
function chip(slide, text, x, y, opt = {}) {
  const fs = opt.fontSize || 12;
  const w = opt.w || 0.22 + text.length * fs * 0.0085;
  slide.addText(text, {
    x, y, w, h: opt.h || 0.28, shape: shapes.ROUNDED_RECTANGLE, rectRadius: 0.06,
    fill: { color: opt.fill || TINT }, line: { color: opt.fill || TINT, width: 0.5 },
    fontFace: CODE, fontSize: fs, color: opt.color || NAVY, bold: !!opt.bold,
    align: "center", valign: "middle", margin: 0, isTextBox: true,
    objectName: "file " + text,
  });
  return w;
}

function chips(slide, list, x, y, gap = 0.1, opt = {}) {
  let cx = x;
  for (const t of list) cx += chip(slide, t, cx, y, opt) + gap;
  return cx - gap;
}

function rect(slide, x, y, w, h, o = {}) {
  slide.addShape(o.rounded === false ? shapes.RECTANGLE : shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: o.rounded === false ? undefined : 0.08,
    fill: { color: o.fill || WHITE }, line: { color: o.line || LINE, width: o.lw || 1, dashType: o.dash || "solid" },
    objectName: o.name,
  });
}

function text(slide, t, x, y, w, h, o = {}) {
  slide.addText(t, Object.assign({ x, y, w, h, fontSize: 14, color: BODY, margin: 0,
    valign: "top", align: "left", isTextBox: true }, o));
}

function arrow(slide, x1, y1, x2, y2, color = MUTED, width = 1.5) {
  slide.addShape(shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color, width, endArrowType: "triangle" },
  });
}

function line(slide, x1, y1, x2, y2, color = LINE, width = 1.25) {
  slide.addShape(shapes.LINE, {
    x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001,
    flipH: x2 < x1, flipV: y2 < y1, line: { color, width },
  });
}

function cite(slide, t) {
  text(slide, t, 0.5, 5.02, 9.0, 0.25, { fontSize: 10, color: MUTED, valign: "bottom" });
}

function content(section, title, notes) {
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
  s.addText(title, { placeholder: "title" });
  if (notes) s.addNotes(notes);
  return s;
}

// =====================================================================
// 1. Title
pres.addSection({ title: "เปิด" });
{
  const s = pres.addSlide({ masterName: "TITLE", sectionTitle: "เปิด" });
  s.addText("fslek: filesystem ใน RAM ที่ต่อเข้า Linux VFS\nโดยเก็บข้อมูลไฟล์ใน buffer ของเราเอง", { placeholder: "title" });
  s.addText([
    { text: "ผลการออกแบบ · CPE333 Operating Systems Mini-Project 2", options: { breakLine: true } },
    { text: "กลุ่ม รวมกันตายหมู่_return · ภาคเรียนที่ 1/2569 · KMUTT", options: {} },
  ], { placeholder: "body" });
  s.addNotes("แนะนำหัวข้อ: สร้าง filesystem ใน RAM ชื่อ fslek ที่ mount ได้จริงผ่าน VFS ทุกสไลด์มีป้ายชื่อไฟล์บอกว่าส่วนนั้นอยู่ในไฟล์ไหน");
}

// 2. Goal: 7 operations
pres.addSection({ title: "โจทย์และภาพรวม" });
{
  const s = content("โจทย์และภาพรวม", "โจทย์ต้องการ filesystem ใน RAM ที่ mount ได้ และทำ 7 operation ผ่าน VFS",
    "โจทย์ให้ทำ 7 operation การ์ดแต่ละใบบอกคำสั่งที่ใช้ทดสอบและไฟล์ที่รับผิดชอบ ทั้งหมดผ่าน test 256 เคสใน 2 สคริปต์บน kernel 6.8 บรรทัดล่างคืองานเสริมที่ทำเพิ่มจากโจทย์");
  const ops = [
    ["Mount", "mount -t fslek", "super.c"],
    ["Unmount", "umount", "super.c"],
    ["Create file", "touch, echo >", "dir.c"],
    ["Write file", "echo >, >>, cp", "file.c"],
    ["Read file", "cat", "file.c"],
    ["Create directory", "mkdir, mkdir -p", "dir.c"],
    ["List directory", "ls -la", "dir.c + libfs"],
  ];
  const W = 2.1, H = 1.5, G = 0.2;
  ops.forEach(([name, cmd, file], i) => {
    const row = i < 4 ? 0 : 1, col = i < 4 ? i : i - 4;
    const x = 0.5 + col * (W + G), y = 1.3 + row * (H + 0.25);
    rect(s, x, y, W, H, { fill: WHITE, line: LINE, name: "op " + name });
    text(s, name, x + 0.15, y + 0.15, W - 0.3, 0.35, { fontSize: 16, bold: true, color: NAVY });
    text(s, cmd, x + 0.15, y + 0.55, W - 0.3, 0.35, { fontSize: 13, fontFace: CODE, color: BODY });
    chip(s, file, x + 0.15, y + H - 0.43);
  });
  // stat callout
  const x = 0.5 + 3 * (W + G), y = 1.3 + H + 0.25;
  rect(s, x, y, W, H, { fill: NAVY, line: NAVY, name: "stat tests" });
  text(s, "256/256", x + 0.15, y + 0.12, W - 0.3, 0.6, { fontSize: 32, bold: true, color: WHITE });
  text(s, "เคสผ่านบน kernel 6.8", x + 0.15, y + 0.72, W - 0.3, 0.3, { fontSize: 13, color: WHITE });
  chip(s, "tests/", x + 0.12, y + H - 0.43, { fill: WHITE, fontSize: 10.5 });
  text(s, "ทำเพิ่ม", 0.5, 4.72, 0.8, 0.28, { fontSize: 12, bold: true, color: ORANGE, valign: "middle" });
  chips(s, ["rm, rmdir", "mv", "mount -o size=, df", "/proc/fslek", "benchmark"], 1.3, 4.72, 0.12, { fill: GRAY });
}

// 3. Architecture layers
{
  const s = content("โจทย์และภาพรวม", "ทุก system call ผ่าน VFS ก่อนถึง fslek ซึ่งแยกโค้ดตามหน้าที่เป็น 4 ไฟล์",
    "ไล่จากบนลงล่าง: คำสั่งของ user กลายเป็น system call, VFS แปลงเป็น object กลาง 4 ตัว แล้วเรียก operations ที่ fslek ลงทะเบียนไว้ fslek เก็บข้อมูลจริงใน RAM สองที่ คือ buffer ของไฟล์ และ dcache");
  const X = 0.5, W = 9.0, LBL = 1.55;
  // layer: user
  rect(s, X, 1.2, W, 0.55, { fill: GRAY, line: GRAY, name: "layer user" });
  text(s, "User space", X + 0.15, 1.2, LBL, 0.55, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
  chips(s, ["mount", "touch", "echo >", "cat", "mkdir", "ls", "rm", "mv", "umount"], X + LBL + 0.2, 1.335, 0.14, { fill: WHITE });
  arrow(s, 5, 1.75, 5, 2.05);
  text(s, "system call: mount, open, read, write, mkdir, unlink, rename", 5.15, 1.78, 4.3, 0.25, { fontSize: 11, color: MUTED });
  // layer: VFS
  rect(s, X, 2.05, W, 0.85, { fill: TINT, line: TINT, name: "layer vfs" });
  text(s, [{ text: "Linux VFS", options: { bold: true, breakLine: true } }, { text: "+ libfs helper", options: { fontSize: 11, color: MUTED } }],
    X + 0.15, 2.05, LBL, 0.85, { fontSize: 14, color: NAVY, valign: "middle" });
  ["super_block", "inode", "dentry (dcache)", "file"].forEach((t, i) => {
    const bx = X + LBL + 0.2 + i * 1.8;
    rect(s, bx, 2.22, 1.65, 0.5, { fill: WHITE, line: BLUE, name: "vfs " + t });
    text(s, t, bx, 2.22, 1.65, 0.5, { fontSize: 13, fontFace: CODE, color: NAVY, align: "center", valign: "middle" });
  });
  arrow(s, 5, 2.9, 5, 3.2);
  text(s, "เรียกผ่านตาราง operations ที่ fslek ลงทะเบียน", 5.15, 2.93, 4.3, 0.25, { fontSize: 11, color: MUTED });
  // layer: fslek
  rect(s, X, 3.2, W, 1.15, { fill: WHITE, line: NAVY, lw: 1.5, name: "layer fslek" });
  text(s, "fslek", X + 0.15, 3.2, LBL, 1.15, { fontSize: 16, bold: true, color: NAVY, valign: "middle" });
  const mods = [
    ["super.c", "mount, umount, size=, df, inode", 0],
    ["dir.c", "create, mkdir, rm, mv", 1.75],
    ["file.c", "read, write, truncate", 3.3],
    ["stats.c", "/proc/fslek", 4.8],
  ];
  mods.forEach(([f, d, dx]) => {
    const bx = X + LBL + 0.2 + dx;
    chip(s, f, bx, 3.33, { fontSize: 13, bold: true });
    text(s, d, bx, 3.68, 1.45, 0.6, { fontSize: 11.5, color: BODY });
  });
  const hx = X + LBL + 0.2 + 6.1;
  chip(s, "fslek.h", hx, 3.33, { fill: GRAY });
  text(s, "struct กลาง\n+ compat", hx, 3.68, 1.2, 0.6, { fontSize: 11, color: MUTED });
  arrow(s, 5, 4.35, 5, 4.55);
  // layer: RAM
  rect(s, X, 4.55, W, 0.45, { fill: GRAY, line: GRAY, name: "layer ram" });
  text(s, "RAM", X + 0.15, 4.55, LBL, 0.45, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
  text(s, "ข้อมูลไฟล์: buffer ต่อ inode (kvzalloc)    โครง directory: dentry ที่ถูก pin ใน dcache",
    X + LBL + 0.2, 4.55, W - LBL - 0.3, 0.45, { fontSize: 12, color: BODY, valign: "middle" });
  cite(s, "อ้างอิง: Linux kernel documentation, Overview of the Linux Virtual File System");
}

// 3b. file system stack: ext4 vs fslek (Lecture 11 slide 27)
{
  const s = content("โจทย์และภาพรวม", "fslek ไม่มี block layer กับ device driver ใน stack เพราะข้อมูลจบที่ RAM",
    "เทียบกับภาพ file system stack ใน Lecture 11 สไลด์ 27 สามชั้นบนเหมือนกัน แต่ ext4 ต้องส่งต่อให้ page cache, generic block layer และ driver ก่อนถึง disk ส่วน fslek mount แบบ nodev ด้วย get_tree_nodev ข้อมูลจึงจบที่ buffer ใน RAM ข้อแลกเปลี่ยนคือ umount แล้วข้อมูลหาย");
  const rows = [
    ["แอปของ user", "แอปของ user", "same"],
    ["system call", "system call", "same"],
    ["VFS", "VFS", "same"],
    ["ext4", "fslek  (super.c · dir.c · file.c)", "fs"],
    ["page cache", "buffer ต่อ inode ใน RAM (kvzalloc)", "fs"],
    ["generic block layer", "ไม่มี", "none"],
    ["device driver", "ไม่มี", "none"],
    ["disk", "ไม่มี (ข้อมูลหายเมื่อ umount)", "none"],
  ];
  const COLS = [0.5, 5.15], CW = 4.35, Y0 = 1.62, LH = 0.34, G = 0.07;
  text(s, "ext4 บน disk", COLS[0], 1.22, CW, 0.32, { fontSize: 14, bold: true, color: MUTED });
  text(s, "fslek", COLS[1], 1.22, CW, 0.32, { fontSize: 14, bold: true, color: NAVY });
  rows.forEach(([a, b, kind], i) => {
    const y = Y0 + i * (LH + G);
    [a, b].forEach((t, c) => {
      const x = COLS[c];
      let fill = GRAY, ln = GRAY, color = BODY, dash, bold = false;
      if (kind === "fs") {
        fill = c ? TINT : WHITE; ln = c ? NAVY : LINE; color = c ? NAVY : BODY; bold = c === 1 && i === 3;
      }
      if (kind === "none" && c === 1) { fill = WHITE; ln = LINE; color = MUTED; dash = "dash"; }
      if (kind === "none" && c === 0) { fill = WHITE; ln = LINE; }
      rect(s, x, y, CW, LH, { fill, line: ln, dash, name: "stack " + c + " " + i });
      text(s, t, x + 0.15, y, CW - 0.3, LH, { fontSize: 12, color, bold, valign: "middle" });
    });
  });
  // ขีดแบ่งจุดที่สอง stack แยกกัน
  const ySplit = Y0 + 3 * (LH + G) - G / 2;
  line(s, 0.5, ySplit, 9.5, ySplit, ORANGE, 1.25);
  text(s, "แยกกันตรงนี้", 8.1, ySplit - 0.28, 1.4, 0.25, { fontSize: 10.5, color: ORANGE, align: "right" });
  cite(s, "อ้างอิง: Lecture 11 สไลด์ 27 (Example of File System Stack) · fslek ใช้ get_tree_nodev ใน super.c จึงไม่มี block device");
}

// 4. Operation -> file -> function table
{
  const s = content("โจทย์และภาพรวม", "แต่ละ operation อยู่ในไฟล์เดียว จึงไล่โค้ดและเพิ่มงานเสริมได้ทีละไฟล์",
    "ตารางนี้ใช้เป็นแผนที่โค้ด ถ้าจะแก้ operation ไหน ให้เปิดไฟล์ในคอลัมน์ที่สาม ส่วน ls, rm, mv ไม่ต้องเขียนเองเพราะใช้ helper ของ libfs ที่ทำงานบน dcache สี่แถวล่างคืองานเสริม");
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const f = (t) => ({ text: t, options: { fontFace: CODE, color: NAVY, bold: true } });
  const fn = (t) => ({ text: t, options: { fontFace: CODE } });
  const rows = [
    [hdr("Operation"), hdr("คำสั่งทดสอบ"), hdr("ไฟล์"), hdr("ฟังก์ชันหลักของ fslek")],
    ["Mount", fn("mount -t fslek"), f("super.c"), fn("fslek_init_fs_context → fslek_fill_super")],
    ["Unmount", fn("umount"), f("super.c"), fn("fslek_kill_sb → fslek_evict_inode")],
    ["Create file", fn("touch, echo >"), f("dir.c"), fn("fslek_create → fslek_mknod")],
    ["Write file", fn("echo >>, cp"), f("file.c"), fn("fslek_write_iter → fslek_reserve")],
    ["Read file", fn("cat"), f("file.c"), fn("fslek_read_iter")],
    ["Truncate", fn("echo >, truncate"), f("file.c"), fn("fslek_setattr → fslek_resize")],
    ["Create directory", fn("mkdir -p"), f("dir.c"), fn("fslek_mkdir → fslek_mknod")],
    ["List directory", fn("ls -la"), f("dir.c"), fn("simple_lookup, simple_dir_operations (libfs)")],
    ["Delete (E1)", fn("rm, rmdir"), f("dir.c"), fn("simple_unlink, simple_rmdir (libfs)")],
    ["Rename (E2)", fn("mv"), f("dir.c"), fn("simple_rename (libfs)")],
    ["จำกัดขนาด (E4)", fn("size=, df"), f("super.c"), fn("fslek_parse_param, fslek_charge, fslek_statfs")],
    ["สถิติ (E5)", fn("cat /proc/fslek"), f("stats.c"), fn("fslek_stats_show")],
  ];
  s.addTable(rows, {
    x: 0.5, y: 1.2, w: 9.0, colW: [1.7, 1.9, 0.95, 4.45], rowH: 0.285,
    fontSize: 11, color: BODY, valign: "middle", margin: [0, 0.08, 0, 0.08],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" },
    fill: { color: WHITE },
  });
  cite(s, "Truncate ไม่อยู่ใน 7 operation ของโจทย์ แต่ echo > ต้องใช้ เพราะเปิดไฟล์ด้วย O_TRUNC ก่อนเขียน");
}

// 5. Mount lifecycle
pres.addSection({ title: "การออกแบบ" });
{
  const s = content("การออกแบบ", "insmod ลงทะเบียน fslek, mount สร้าง super_block ใหม่ และ umount คืน RAM ทุกไฟล์",
    "วงจรชีวิตทั้งหมดอยู่ใน super.c ทุก mount ได้ super_block ใหม่ผ่าน get_tree_nodev เพราะไม่มี block device ตอน umount ทุก inode ถูก evict และ buffer ถูก kvfree หลักฐานคือ dmesg ในภาพ 12");
  // ชื่อฟังก์ชันของเราละ prefix fslek_ เพื่อไม่ให้ตัดกลางคำ (มีหมายเหตุใต้สไลด์)
  const st = [
    ["insmod", ["init()", "stats_init()", "register_filesystem"], "super.c"],
    ["mount", ["init_fs_context()", "parse_param()", "get_tree_nodev", "fill_super()", "d_make_root"], "super.c"],
    ["ใช้งาน", ["อยู่ใน", "RAM"], "dir.c file.c"],
    ["umount", ["kill_sb()", "kill_super()", "evict_inode()", "→ kvfree buffer", "kfree(sbi)"], "super.c"],
    ["rmmod", ["exit()", "unregister_filesystem", "stats_exit()"], "super.c"],
  ];
  const WS = 1.81, WM = 0.95, G = 0.2, Y = 1.25, H = 2.25;
  let x = 0.5;
  st.forEach(([cmd, fns, file], i) => {
    const mid = i === 2, W = mid ? WM : WS;
    rect(s, x, Y, W, H, { fill: mid ? GRAY : WHITE, line: mid ? GRAY : BLUE, name: "stage " + cmd });
    text(s, cmd, x + 0.1, Y + 0.12, W - 0.2, 0.35, { fontSize: 16, bold: true, color: NAVY });
    text(s, fns.join("\n"), x + 0.1, Y + 0.55, W - 0.2, 1.2,
      mid ? { fontSize: 13, color: BODY } : { fontSize: 9.5, fontFace: CODE, color: BODY, paraSpaceAfter: 3 });
    if (mid) {
      text(s, "dir.c\nfile.c", x + 0.1, Y + H - 0.62, W - 0.2, 0.5, { fontSize: 11, fontFace: CODE, color: NAVY, bold: true });
    } else {
      chip(s, file, x + 0.1, Y + H - 0.4, { fontSize: 11 });
    }
    if (i < st.length - 1) arrow(s, x + W + 0.02, Y + H / 2, x + W + G - 0.02, Y + H / 2, NAVY, 1.75);
    x += W + G;
  });
  // dmesg evidence
  rect(s, 0.5, 3.75, 9.0, 1.05, { fill: "262626", line: "262626", rounded: false, name: "dmesg" });
  text(s, [
    { text: "$ dmesg | grep fslek", options: { color: "F2C14E", breakLine: true } },
    { text: "fslek: registered → mounted (sb=...) → unmounting (sb=...) → unregistered", options: { color: "E6E6E6" } },
  ], 0.7, 3.82, 8.6, 0.9, { fontSize: 12, fontFace: CODE, valign: "middle" });
  cite(s, "ฟังก์ชันที่มี () คือของ fslek (ละ prefix fslek_) · dmesg จาก captures/12.png ย่อ timestamp ออก");
}

// 6. dcache tree
{
  const s = content("การออกแบบ", "โครง directory อยู่ใน dcache ของ VFS โดย pin dentry ไว้ fslek จึงไม่มีตาราง directory เอง",
    "ต้นไม้ด้านซ้ายคือสถานะหลังเดโมขั้น 8 ทุก dentry ถูก pin ด้วย reference เพิ่มหนึ่ง ทำให้ VFS ไม่ทิ้งชื่อไฟล์ตอนหน่วยความจำตึง lookup จึงตอบได้ทันทีว่าไม่มีไฟล์ถ้าหาใน dcache ไม่เจอ");
  // tree
  const nodes = [
    { id: "root", t: "/", x: 0.6, y: 1.3, dir: true },
    { id: "h", t: "hello.txt", x: 1.35, y: 1.85, p: "root" },
    { id: "b", t: "big.bin", x: 1.35, y: 2.4, p: "root" },
    { id: "d", t: "docs/", x: 1.35, y: 2.95, p: "root", dir: true },
    { id: "r", t: "report/", x: 2.1, y: 3.5, p: "d", dir: true },
    { id: "n", t: "notes.txt", x: 2.85, y: 4.05, p: "r" },
    { id: "f", t: "figures/", x: 2.85, y: 4.6, p: "r", dir: true },
  ];
  const NW = 1.3, NH = 0.38;
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  nodes.forEach((n) => {
    if (n.p) {
      const p = byId[n.p];
      const vx = p.x + 0.2;
      line(s, vx, p.y + NH, vx, n.y + NH / 2, MUTED, 1);
      line(s, vx, n.y + NH / 2, n.x, n.y + NH / 2, MUTED, 1);
    }
  });
  nodes.forEach((n) => {
    s.addText(n.t, {
      x: n.x, y: n.y, w: NW, h: NH, shape: shapes.ROUNDED_RECTANGLE, rectRadius: 0.06,
      fill: { color: n.dir ? TINT : WHITE }, line: { color: n.dir ? BLUE : LINE, width: 1 },
      fontFace: CODE, fontSize: 12, color: NAVY, bold: !!n.dir, align: "left", valign: "middle",
      margin: [0, 0, 0, 0.1], isTextBox: true, objectName: "dentry " + n.t,
    });
    s.addShape(shapes.OVAL, { x: n.x + NW - 0.2, y: n.y + NH / 2 - 0.06, w: 0.12, h: 0.12,
      fill: { color: ORANGE }, line: { color: ORANGE }, objectName: "pin " + n.t });
  });
  s.addShape(shapes.OVAL, { x: 2.35, y: 1.42, w: 0.12, h: 0.12, fill: { color: ORANGE }, line: { color: ORANGE } });
  text(s, "dentry ถูก pin (ref +1)", 2.55, 1.33, 2.2, 0.3, { fontSize: 12, color: MUTED, valign: "middle" });
  text(s, "สถานะหลัง demo ขั้น 8-9 (captures/9.png)", 2.9, 1.95, 2.5, 0.3, { fontSize: 10, color: MUTED, valign: "middle" });

  // right column
  const RX = 5.55, RW = 3.95;
  const items = [
    ["สร้างไฟล์/โฟลเดอร์", "fslek_mknod สร้าง inode แล้วผูกกับชื่อและ pin ไว้", ["dir.c", "fslek.h"]],
    ["lookup", "simple_lookup: ไม่เจอใน dcache แปลว่าไม่มีไฟล์จริง", ["fs/libfs.c"]],
    ["ls, rm, rmdir, mv", "helper ของ libfs ทำงานบน dentry ใน dcache ทั้งหมด", ["fs/libfs.c"]],
    ["ทำไมต้อง pin", "ไม่มี disk ให้อ่านกลับ ถ้า VFS ทิ้ง dentry ไฟล์จะหายจริง", ["fslek_pin_dentry"]],
  ];
  items.forEach(([h, d, cs], i) => {
    const y = 1.3 + i * 0.93;
    text(s, h, RX, y, RW, 0.3, { fontSize: 14, bold: true, color: NAVY });
    text(s, d, RX, y + 0.3, RW, 0.32, { fontSize: 12, color: BODY });
    chips(s, cs, RX, y + 0.62, 0.1, { fontSize: 11, h: 0.24 });
  });
  cite(s, "อ้างอิง: fs/libfs.c และ fs/ramfs/inode.c ของ Linux v6.8 และ v7.0");
}

// 7. buffer structure
{
  const s = content("การออกแบบ", "ข้อมูลไฟล์อยู่ใน buffer ก้อนเดียวต่อ inode และไบต์ที่เกิน i_size เป็นศูนย์เสมอ",
    "inode ของ VFS เก็บขนาดไฟล์จริง ส่วน i_private ชี้ไปที่ struct fslek_file_data ซึ่งถือ buffer กับขนาดที่จองไว้ กติกาเดียวที่ต้องรักษาคือไบต์หลัง i_size เป็นศูนย์เสมอ การเขียนข้ามท้ายไฟล์จึงได้ช่องว่างเป็นศูนย์โดยไม่ต้อง memset");
  // inode box
  rect(s, 0.5, 1.3, 2.4, 1.15, { fill: TINT, line: BLUE, name: "struct inode" });
  text(s, [
    { text: "struct inode (VFS)", options: { bold: true, color: NAVY, fontSize: 13, breakLine: true } },
    { text: "i_size    = 12", options: { breakLine: true } },
    { text: "i_blocks  = 8", options: { breakLine: true } },
    { text: "i_private", options: {} },
  ], 0.65, 1.38, 2.2, 1.0, { fontSize: 12, fontFace: CODE, color: BODY });
  // file data box
  rect(s, 3.35, 1.3, 2.55, 1.15, { fill: WHITE, line: NAVY, lw: 1.5, name: "struct fslek_file_data" });
  text(s, [
    { text: "struct fslek_file_data", options: { bold: true, color: NAVY, fontSize: 13, breakLine: true } },
    { text: "char  *data", options: { breakLine: true } },
    { text: "size_t capacity = 4096", options: {} },
  ], 3.5, 1.38, 2.35, 1.0, { fontSize: 12, fontFace: CODE, color: BODY });
  arrow(s, 1.85, 2.2, 3.35, 2.2, NAVY);
  chip(s, "fslek.h", 6.15, 1.35);
  text(s, "ตัวอย่าง: hello.txt หลัง echo 'overwritten'\n(captures/6.png: size=12 blocks=8)", 6.15, 1.75, 3.35, 0.7, { fontSize: 11, color: MUTED });
  // buffer bar
  const BY = 3.05, BX = 0.5, BW = 9.0, DW = 2.4;
  // *data ชี้ไปต้น buffer
  line(s, 4.6, 2.45, 4.6, 2.75, NAVY, 1.5);
  line(s, 4.6, 2.75, 1.0, 2.75, NAVY, 1.5);
  arrow(s, 1.0, 2.75, 1.0, BY, NAVY);
  s.addText("ข้อมูลจริง 12 ไบต์", { x: BX, y: BY, w: DW, h: 0.55, fill: { color: BLUE }, line: { color: BLUE },
    fontSize: 13, color: WHITE, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addText("ส่วนที่จองไว้แต่ยังไม่ใช้ = 0 เสมอ (invariant)", { x: BX + DW, y: BY, w: BW - DW, h: 0.55,
    fill: { color: GRAY }, line: { color: LINE }, fontSize: 13, color: NAVY, align: "center", valign: "middle", margin: 0, isTextBox: true });
  text(s, "0", BX, BY + 0.6, 0.5, 0.25, { fontSize: 11, fontFace: CODE, color: MUTED });
  text(s, "i_size", BX + DW - 0.5, BY + 0.6, 1.0, 0.25, { fontSize: 11, fontFace: CODE, color: MUTED, align: "center" });
  text(s, "capacity", BX + BW - 1.0, BY + 0.6, 1.0, 0.25, { fontSize: 11, fontFace: CODE, color: MUTED, align: "right" });
  text(s, "(ไม่ตามสัดส่วน)", BX + 3.8, BY + 0.6, 1.6, 0.25, { fontSize: 10, color: MUTED, align: "center" });
  // rules
  const rules = [
    ["เขียนข้ามท้ายไฟล์", "ช่องว่างเป็น 0 อยู่แล้ว ไม่ต้อง memset"],
    ["truncate ให้สั้นลง", "fslek_resize ล้างส่วนท้ายเป็น 0"],
    ["truncate เป็น 0", "kvfree คืน buffer ทั้งก้อน"],
  ];
  rules.forEach(([h, d], i) => {
    const x = 0.5 + i * 3.05;
    text(s, h, x, 4.05, 2.9, 0.28, { fontSize: 13, bold: true, color: NAVY });
    text(s, d, x, 4.33, 2.9, 0.28, { fontSize: 12, color: BODY });
  });
  const cw = chip(s, "file.c", 0.5, 4.7, { fontSize: 11, h: 0.24 });
  text(s, "fslek_reserve · fslek_resize · fslek_write_iter", 0.5 + cw + 0.15, 4.7, 5, 0.24, { fontSize: 11, fontFace: CODE, color: MUTED, valign: "middle" });
}

// 8. growth policy chart
{
  const s = content("การออกแบบ", "buffer ขยายครั้งละเท่าตัว แลก RAM ส่วนเกินกับการไม่ต้อง realloc ทุกครั้งที่เขียน",
    "กราฟคำนวณจากกฎใน fslek_reserve สมมติว่าเขียนต่อเนื่องทีละก้อนเล็กแบบที่ cp ทำ ไฟล์ 5 MiB จึงจองจริง 8 MiB ตรงกับ total 8200 ในภาพ 9 ข้อเสียคือเสีย RAM ได้เกือบเท่าตัว ซึ่งเป็นงานเสริม E6");
  const labels = ["1", "2", "3", "4", "5", "6", "7", "8"];
  s.addChart(pres.charts.BAR, [
    { name: "ขนาดไฟล์", labels, values: [1, 2, 3, 4, 5, 6, 7, 8] },
    { name: "buffer ที่จองจริง", labels, values: [1, 2, 4, 4, 8, 8, 8, 8] },
  ], {
    x: 0.4, y: 1.2, w: 5.5, h: 3.8, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60,
    chartColors: ["BFBFBF", "2E75B6"],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: "404040", dataLabelFontFace: "+mn-lt",
    showLegend: true, legendPos: "t", legendFontSize: 12, legendFontFace: "+mn-lt", legendColor: "404040",
    showCatAxisTitle: true, catAxisTitle: "ขนาดไฟล์ (MiB)", catAxisTitleFontSize: 12, catAxisTitleColor: "404040", catAxisTitleFontFace: "+mn-lt",
    showValAxisTitle: true, valAxisTitle: "MiB", valAxisTitleFontSize: 12, valAxisTitleColor: "404040", valAxisTitleFontFace: "+mn-lt",
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, catAxisLabelColor: "404040", valAxisLabelColor: "404040",
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
    valAxisMaxVal: 9, valAxisMinVal: 0, valAxisMajorUnit: 2,
    valGridLine: { color: "E5E5E5", size: 0.5 }, catGridLine: { style: "none" },
  });
  // right column
  const RX = 6.2, RW = 3.3;
  s.addText("5 MiB → จองจริง 8 MiB", { x: RX, y: 1.3, w: RW, h: 0.5, shape: shapes.ROUNDED_RECTANGLE, rectRadius: 0.06,
    fill: { color: WHITE }, line: { color: ORANGE, width: 1.5 }, fontSize: 15, bold: true, color: ORANGE,
    align: "center", valign: "middle", margin: 0, isTextBox: true });
  text(s, "ตรงกับ ls -la: total 8200 (captures/9.png)", RX, 1.85, RW, 0.3, { fontSize: 11, color: MUTED });
  const pts = [
    ["กฎการขยาย", "max(ที่ต้องใช้, 2 × เดิม) ปัดเต็มหน้า"],
    ["ข้อดี", "เขียนต่อท้าย n ครั้ง copy รวม O(n)"],
    ["ข้อเสีย", "เปลือง RAM ได้เกือบ 2 เท่า คืนเฉพาะ truncate 0"],
  ];
  pts.forEach(([h, d], i) => {
    const y = 2.3 + i * 0.72;
    text(s, h, RX, y, RW, 0.28, { fontSize: 13, bold: true, color: NAVY });
    text(s, d, RX, y + 0.28, RW, 0.4, { fontSize: 12, color: BODY });
  });
  chips(s, ["file.c", "fslek_reserve"], RX, 4.5, 0.1, { fontSize: 11, h: 0.24 });
  cite(s, "คำนวณจาก fslek_reserve() โดยสมมติว่าเขียนต่อเนื่องทีละก้อนเล็ก เช่น cp · งานต่อ E6: คืน RAM เมื่อไฟล์หด (docs/handoff.md)");
}

// 8b. kernel memory allocation + evidence
{
  const s = content("การออกแบบ", "kvzalloc เลือก kmalloc หรือ vmalloc ให้เอง และ buffer ทุกก้อนถูกคืนครบเมื่อ rm หรือ umount",
    "ตารางซ้ายตรงกับ PDF Kernel_memory_mutex หน้า 7 struct เล็กใช้ kzalloc ส่วน buffer ข้อมูลใช้ kvzalloc เพราะไฟล์ใหญ่ได้ถึง 64 MiB ฝั่งขวาคือหลักฐานจาก test_edge.sh หัวข้อ J: เขียนไฟล์ 32 MiB แล้ว VmallocUsed เพิ่ม 32832 kB พอ truncate หรือ umount ก็กลับมาที่เดิม หัวข้อ K ได้ผลแบบเดียวกันเมื่อ rm และวนซ้ำแล้วไม่รั่ว");
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const fn = (t) => ({ text: t, options: { fontFace: CODE, color: NAVY, bold: true } });
  s.addTable([
    [hdr("จอง / คืน"), hdr("หน่วยความจำ physical"), hdr("ใช้กับ")],
    [fn("kzalloc /\nkfree"), "ต่อเนื่องกัน", { text: [{ text: "fslek_file_data", options: { fontFace: CODE, fontSize: 10.5, breakLine: true } }, { text: "fslek_sb_info", options: { fontFace: CODE, fontSize: 10.5 } }] }],
    [fn("kvzalloc /\nkvfree"), "ลอง kmalloc ก่อน ถ้าไม่ได้ใช้ vmalloc (หน้ากระจายได้)", "buffer ข้อมูลไฟล์"],
  ], {
    x: 0.5, y: 1.25, w: 5.0, colW: [1.3, 2.0, 1.7], rowH: [0.36, 0.6, 0.72],
    fontSize: 11.5, color: BODY, valign: "middle", margin: [0, 0.06, 0, 0.06],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  const why = [
    ["ทำไม buffer ใช้ kvzalloc", "ไฟล์ใหญ่ได้ถึง 64 MiB หาหน้าที่ต่อกันทาง physical ขนาดนั้นมักไม่ได้"],
    ["ได้ 0 ทั้งก้อน", "ตรงกับ invariant ว่าไบต์ที่เกิน i_size ต้องเป็น 0"],
  ];
  why.forEach(([h, d], i) => {
    const y = 3.08 + i * 0.66;
    text(s, h, 0.5, y, 5.0, 0.28, { fontSize: 13, bold: true, color: NAVY });
    text(s, d, 0.5, y + 0.28, 5.0, 0.32, { fontSize: 12, color: BODY });
  });
  chips(s, ["file.c", "fslek_reserve", "fslek_free_file_data"], 0.5, 4.45, 0.1, { fontSize: 11, h: 0.24 });

  // evidence column
  const RX = 5.9, RW = 3.6;
  text(s, "VmallocUsed จาก /proc/meminfo", RX, 1.22, RW, 0.3, { fontSize: 12, bold: true, color: MUTED });
  const ev = [
    ["18,544 kB", "ก่อนเขียน", GRAY, NAVY],
    ["51,376 kB", "หลังเขียนไฟล์ 32 MiB (+32,832 kB)", TINT, ORANGE],
    ["≤ +4 MiB", "หลัง truncate -s 0, หลัง umount และหลัง rm", GRAY, NAVY],
  ];
  ev.forEach(([v, d, fill, col], i) => {
    const y = 1.55 + i * 0.86;
    rect(s, RX, y, RW, 0.66, { fill, line: fill, name: "ev " + i });
    text(s, v, RX + 0.15, y + 0.04, RW - 0.3, 0.36, { fontSize: 19, bold: true, color: col });
    text(s, d, RX + 0.15, y + 0.38, RW - 0.3, 0.25, { fontSize: 11, color: BODY });
    if (i < 2) arrow(s, RX + RW / 2, y + 0.66, RX + RW / 2, y + 0.86, MUTED, 1.25);
  });
  text(s, "วน mount/umount 20 รอบ และเขียน/rm 50 รอบ: ไม่รั่ว", RX, 4.15, RW, 0.25, { fontSize: 11, color: BODY });
  chips(s, ["fslek_evict_inode", "super.c"], RX, 4.45, 0.1, { fontSize: 11, h: 0.24 });
  cite(s, "อ้างอิง: Kernel_memory_mutex.pdf หน้า 7 · ตัวเลขจาก tests/test_edge.sh หัวข้อ J และ K (captures/test_edge-b.png, test_edge-c.png)");
}

// 9. write / read / truncate path
{
  const s = content("การออกแบบ", "write() ล็อก inode ก่อน แล้วตรวจ ขยาย buffer และ copy จาก user ตามลำดับ",
    "ทางเดินของ write มี 6 ขั้นอยู่ใน fslek_write_iter ทั้งหมด จุดสำคัญคือทุกอย่างอยู่ภายใต้ inode_lock ส่วน read ใช้ shared lock ให้อ่านพร้อมกันได้ และ truncate มาทาง setattr ซึ่ง VFS ล็อกมาให้แล้ว");
  text(s, "write", 0.5, 1.2, 1.5, 0.3, { fontSize: 14, bold: true, color: NAVY });
  text(s, "echo x >> f  →  vfs_write  →  fslek_write_iter", 1.3, 1.2, 6.5, 0.3, { fontSize: 12, fontFace: CODE, color: MUTED });
  const steps = [
    ["1", "inode_lock", "กันเขียนชนกัน"],
    ["2", "generic_write_checks", "O_APPEND, จำกัดไฟล์ละ 64 MiB"],
    ["3", "fslek_reserve", "ขยาย buffer และเช็คโควตา"],
    ["4", "copy_from_iter", "copy จาก user เข้า buffer"],
    ["5", "i_size_write", "อัปเดตขนาดและ mtime"],
    ["6", "inode_unlock", "คืน lock"],
  ];
  // 2 แถว แถวละ 3 ขั้น อ่านซ้ายไปขวา บนลงล่าง
  const W = 2.8, G = 0.3, H = 0.68;
  steps.forEach(([n, fn, d], i) => {
    const col = i % 3, rowi = Math.floor(i / 3);
    const x = 0.5 + col * (W + G), y = 1.55 + rowi * (H + 0.15);
    const key = i === 2 || i === 3;
    rect(s, x, y, W, H, { fill: key ? TINT : WHITE, line: key ? BLUE : LINE, name: "step " + n });
    text(s, n, x + 0.1, y, 0.3, H, { fontSize: 16, bold: true, color: ORANGE, valign: "middle" });
    text(s, fn, x + 0.42, y + 0.07, W - 0.5, 0.28, { fontSize: 11, fontFace: CODE, color: NAVY, bold: true });
    text(s, d, x + 0.42, y + 0.36, W - 0.5, 0.28, { fontSize: 11, color: BODY });
    if (col < 2) arrow(s, x + W, y + H / 2, x + W + G, y + H / 2, NAVY, 1.25);
  });
  // read row
  const row = (label, y, flow, note) => {
    text(s, label, 0.5, y, 1.0, 0.45, { fontSize: 14, bold: true, color: NAVY, valign: "middle" });
    s.addText(flow, { x: 1.5, y, w: 8.0, h: 0.45, shape: shapes.ROUNDED_RECTANGLE, rectRadius: 0.06,
      fill: { color: GRAY }, line: { color: GRAY }, fontSize: 11, fontFace: CODE, color: BODY,
      valign: "middle", margin: [0, 0, 0, 0.12], isTextBox: true });
    text(s, note, 1.5, y + 0.47, 8.0, 0.25, { fontSize: 10.5, color: MUTED });
  };
  row("read", 3.2, "cat f  →  fslek_read_iter: inode_lock_shared → copy_to_iter (ไม่เกิน i_size) → unlock",
    "หลายคนอ่านพร้อมกันได้ เพราะใช้ shared lock");
  row("truncate", 3.97,"echo x > f (O_TRUNC), truncate  →  notify_change  →  fslek_setattr → fslek_resize",
    "VFS ถือ inode_lock มาให้แล้วก่อนเรียก setattr");
  const cw = chip(s, "file.c", 0.5, 4.72, { fontSize: 11, h: 0.24 });
  text(s, "cp และ cat บางรุ่นใช้ splice ซึ่ง copy_splice_read / iter_file_splice_write วนกลับมาเรียก read_iter / write_iter",
    0.5 + cw + 0.15, 4.72, 8.9 - cw - 0.15, 0.24, { fontSize: 10.5, color: MUTED, valign: "middle" });
}

// 9b. locking vs lecture mutex
{
  const s = content("การออกแบบ", "fslek ใช้ lock ต่อไฟล์แบบ reader-writer แทน mutex ตัวเดียวของทั้ง module",
    "ซ้ายคือตัวอย่างในคาบจาก PDF หน้า 9 mutex ตัวเดียวคุม buffer ตัวเดียว ขวาคือ fslek ที่ใช้ inode_lock ซึ่งเป็น rw_semaphore ของแต่ละไฟล์ อ่านพร้อมกันได้ ไฟล์ต่างกันไม่ต้องรอกัน แถวกลางอธิบายว่าทำไมเรา copy ข้อมูลระหว่างถือ lock ต่างจากคำแนะนำในสไลด์ และแถวล่างคือผล test concurrency");
  const panel = (x, title, codeTxt) => {
    rect(s, x, 1.2, 4.35, 1.75, { fill: WHITE, line: LINE });
    text(s, title, x + 0.15, 1.27, 4.1, 0.28, { fontSize: 13, bold: true, color: NAVY });
    chip(s, codeTxt, x + 0.15, 1.58, { fontSize: 10.5, h: 0.24 });
  };
  const box = (t, x, y, w, o = {}) => s.addText(t, { x, y, w, h: 0.28, shape: shapes.ROUNDED_RECTANGLE, rectRadius: 0.05,
    fill: { color: o.fill || GRAY }, line: { color: o.line || o.fill || GRAY }, fontSize: 10.5, fontFace: o.font || undefined,
    color: o.color || BODY, bold: !!o.bold, align: "center", valign: "middle", margin: 0, isTextBox: true });
  // left: lecture
  panel(0.5, "ตัวอย่างในคาบ: mutex ตัวเดียว", "static DEFINE_MUTEX(buffer_lock)");
  ["read()", "write()", "write()"].forEach((t, i) => {
    const y = 1.93 + i * 0.32;
    box(t, 0.65, y, 0.85, { font: CODE });
    arrow(s, 1.5, y + 0.14, 2.0, 2.39, MUTED, 1);
  });
  box("mutex", 2.0, 2.25, 0.9, { fill: ORANGE, color: WHITE, bold: true });
  arrow(s, 2.9, 2.39, 3.2, 2.39, MUTED, 1);
  box("buffer", 3.2, 2.25, 1.5, { fill: TINT, line: BLUE, font: CODE });
  // right: fslek
  panel(5.15, "fslek: inode_lock ต่อไฟล์ (rw_semaphore)", "inode_lock / inode_lock_shared");
  const lane = (y, who, lbl, buf) => {
    who.forEach((t, i) => {
      box(t, 5.3 + i * 0.68, y, 0.6, { font: CODE });
    });
    const ax = 5.3 + who.length * 0.68 - 0.08;
    arrow(s, ax, y + 0.14, 7.05, y + 0.14, MUTED, 1);
    box(lbl, 7.05, y, 1.0, { fill: ORANGE, color: WHITE, bold: true });
    arrow(s, 8.05, y + 0.14, 8.3, y + 0.14, MUTED, 1);
    box(buf, 8.3, y, 1.05, { fill: TINT, line: BLUE, font: CODE });
  };
  lane(1.98, ["read", "read"], "lock ไฟล์ A", "buffer A");
  lane(2.4, ["write"], "lock ไฟล์ B", "buffer B");
  // why copy under lock
  text(s, "ทำไม copy ข้อมูลระหว่างถือ lock (สไลด์หน้า 9 แนะนำให้ copy ก่อน lock)", 0.5, 3.07, 9.0, 0.28,
    { fontSize: 13, bold: true, color: NAVY });
  const why = [
    ["buffer ถูกย้ายได้", "fslek_reserve จองก้อนใหม่แล้ว kvfree ก้อนเก่า copy นอก lock จะอ่านหน่วยความจำที่คืนไปแล้ว"],
    ["ไม่เปลือง RAM ซ้ำ", "buffer ชั่วคราวทำให้ไฟล์ 64 MiB ใช้ RAM สองเท่า"],
    ["ไม่ lock ซ้อนตัวเอง", "fslek ไม่มี .mmap page fault ระหว่าง copy จึงไม่วนกลับมาที่ fslek"],
  ];
  why.forEach(([h, d], i) => {
    const x = 0.5 + i * 3.05;
    text(s, h, x, 3.38, 2.9, 0.26, { fontSize: 12, bold: true, color: ORANGE });
    text(s, d, x, 3.64, 2.9, 0.55, { fontSize: 11, color: BODY });
  });
  // evidence strip
  rect(s, 0.5, 4.27, 9.0, 0.6, { fill: TINT, line: TINT, name: "evidence" });
  text(s, "ผลทดสอบ", 0.65, 4.27, 1.0, 0.6, { fontSize: 12, bold: true, color: NAVY, valign: "middle" });
  text(s, "writer 8 ตัว × 1000 บรรทัด ได้ครบ 8000 ไม่มีบรรทัดเพี้ยน", 1.65, 4.3, 3.2, 0.55, { fontSize: 11, color: BODY, valign: "middle" });
  text(s, "reader 4 ตัวอ่านขณะไฟล์โตถึง 16 MiB ได้ส่วนต้นที่ถูกทุกครั้ง", 5.0, 4.3, 3.0, 0.55, { fontSize: 11, color: BODY, valign: "middle" });
  chip(s, "test_mvp.sh", 8.2, 4.45, { fontSize: 10, h: 0.24, fill: WHITE, w: 1.15 });
  cite(s, "อ้างอิง: Kernel_memory_mutex.pdf หน้า 8-9 · เป็น smoke test ผ่านแล้วไม่ได้พิสูจน์ว่าไม่มี race ทุกกรณี");
}

// 10. compat 6.8 / 7.0
{
  const s = content("การออกแบบ", "Makefile ตรวจ header ของ kernel ทำให้โค้ดชุดเดียว build ได้ทั้ง 6.8 และ 7.0",
    "VFS API ระหว่าง 6.8 กับ 7.0 ต่างกัน 4 จุด แทนที่จะเดาจากเลขเวอร์ชัน Makefile grep header ของ kernel ที่กำลัง build แล้วส่ง flag ให้ fslek.h เลือกฟังก์ชัน ฝั่ง 6.8 ทดสอบแล้ว ฝั่ง 7.0 ยังรอเพื่อนรันในงาน E0");
  // pipeline strip
  const strip = [["Makefile", "grep header 3 รูปแบบ"], ["-DFSLEK_*", "flag ตอน compile"], ["fslek.h", "wrapper เลือก API"]];
  strip.forEach(([c, d], i) => {
    const x = 0.5 + i * 3.1;
    chip(s, c, x, 1.25, { fontSize: 12, bold: true });
    text(s, d, x, 1.58, 2.6, 0.28, { fontSize: 12, color: BODY });
    if (i < 2) arrow(s, x + 2.55, 1.39, x + 3.0, 1.39, NAVY, 1.5);
  });
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const fn = (t) => ({ text: t, options: { fontFace: CODE } });
  const fl = (t) => ({ text: t, options: { fontFace: CODE, color: NAVY, bold: true } });
  const rows = [
    [hdr("จุดที่ต่าง"), hdr("kernel 6.8 (Ubuntu 24.04)"), hdr("kernel 7.0 (Ubuntu 26.04)"), hdr("ใช้ที่")],
    ["pin dentry", fn("d_instantiate + dget"), fn("d_make_persistent"), fl("dir.c")],
    ["umount", fn("kill_litter_super"), fn("kill_anon_super"), fl("super.c")],
    ["drop_inode", fn("generic_delete_inode"), fn("inode_just_drop"), fl("super.c")],
    ["->mkdir คืนค่า", fn("int"), fn("struct dentry *"), fl("dir.c")],
    [{ text: "สถานะ", options: { bold: true } },
     { text: "ทดสอบแล้ว 256/256", options: { bold: true, color: "2E7D32" } },
     { text: "ยังไม่ได้ compile จริง (E0)", options: { bold: true, color: ORANGE } }, ""],
  ];
  s.addTable(rows, {
    x: 0.5, y: 2.1, w: 9.0, colW: [1.7, 2.9, 2.9, 1.5], rowH: 0.42,
    fontSize: 12, color: BODY, valign: "middle", margin: [0, 0.08, 0, 0.08],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  cite(s, "ตรวจจาก fs/ramfs/inode.c, fs/libfs.c, include/linux/fs.h ของ Linux v6.8 และ v7.0 · API ที่ E1-E5 ใช้เหมือนกันทั้งสองเวอร์ชัน");
}

// =====================================================================
// งานเสริม E1-E5
pres.addSection({ title: "งานเสริม" });

// ภาพจาก captures/ พร้อมกรอบและป้ายชื่อไฟล์
function shot(s, file, pxW, pxH, x, y, w) {
  const h = (w * pxH) / pxW;
  s.addImage({ path: CAP + file, x, y, w, h, altText: "ผลรัน " + file });
  s.addShape(shapes.RECTANGLE, { x, y, w, h, fill: { type: "none" }, line: { color: LINE, width: 0.75 } });
  chip(s, "captures/" + file, x, y + h + 0.08, { fontSize: 10, h: 0.24 });
  return y + h;
}

// X1. E1 + E2 delete, rename
{
  const s = content("งานเสริม", "rm และ mv ทำงานกับชื่อใน dcache ส่วน buffer ถูกคืนเมื่อไม่มีใครใช้ไฟล์นั้นแล้ว",
    "E1 กับ E2 ใช้ simple_unlink, simple_rmdir, simple_rename ของ libfs ซึ่งปลด pin ให้ตรงกับวิธี pin ของแต่ละ kernel rm ปลดชื่อและลด nlink ทันที แต่ถ้ายังมี fd เปิดอยู่ inode กับ buffer จะอยู่ต่อจนปิด fd สุดท้าย mv ย้ายแค่ชื่อ เลข inode ในภาพขวาจึงเท่าเดิมคือ 47880");
  const panel = (y, h, title) => {
    rect(s, 0.5, y, 5.1, h, { fill: WHITE, line: LINE });
    text(s, title, 0.65, y + 0.08, 4.8, 0.28, { fontSize: 13, bold: true, color: NAVY });
  };
  panel(1.2, 1.75, "rm: ชื่อหายทันที ข้อมูลอยู่ต่อถ้ายังมีคนเปิด");
  const st = [["simple_unlink", "ปลดชื่อ"], ["nlink = 0", "ไม่มีชื่อแล้ว"], ["close(fd)", "ตัวสุดท้าย"], ["evict_inode", "kvfree buffer"]];
  const W = 1.1, G = 0.14;
  st.forEach(([c, d], i) => {
    const x = 0.65 + i * (W + G);
    rect(s, x, 1.65, W, 0.62, { fill: i === 3 ? TINT : GRAY, line: i === 3 ? BLUE : GRAY, name: "rm " + i });
    text(s, c, x + 0.03, 1.69, W - 0.06, 0.26, { fontSize: 9.5, fontFace: CODE, bold: true, color: NAVY, align: "center", valign: "middle" });
    text(s, d, x + 0.03, 1.95, W - 0.06, 0.26, { fontSize: 10.5, align: "center", valign: "middle" });
    if (i < 3) arrow(s, x + W, 1.96, x + W + G, 1.96, NAVY, 1.25);
  });
  text(s, "ระหว่างนั้นยังอ่านและเขียนผ่าน fd เดิมได้ · rmdir โฟลเดอร์ที่ไม่ว่างได้ ENOTEMPTY", 0.65, 2.42, 4.8, 0.42, { fontSize: 11 });

  panel(3.08, 1.5, "mv: ย้ายแค่ชื่อ ไม่ copy ข้อมูล");
  box(s, "hello.txt", 0.65, 3.5, 1.45, 0.34, { font: CODE, fontSize: 10, dash: "dash", color: MUTED });
  box(s, "docs/renamed.txt", 0.65, 4.0, 1.45, 0.34, { font: CODE, fontSize: 10, fill: TINT, line: BLUE, color: NAVY, bold: true });
  box(s, "inode 47880", 2.65, 3.75, 1.2, 0.36, { font: CODE, fontSize: 10, fill: TINT, line: BLUE, color: NAVY });
  box(s, "buffer เดิม", 4.3, 3.75, 1.15, 0.36, { fontSize: 11, fill: GRAY, line: GRAY });
  arrow(s, 2.1, 4.17, 2.65, 3.97, NAVY, 1.5);
  arrow(s, 3.85, 3.93, 4.3, 3.93, NAVY, 1.5);
  text(s, "ก่อน", 2.2, 3.55, 0.45, 0.22, { fontSize: 10, color: MUTED });
  text(s, "หลัง", 2.2, 4.2, 0.45, 0.22, { fontSize: 10, color: NAVY, bold: true });
  chips(s, ["dir.c", "fs/libfs.c", "simple_rename"], 0.5, 4.68, 0.1, { fontSize: 10.5, h: 0.24 });

  shot(s, "10a.png", 702, 525, 5.85, 1.25, 3.65);
  text(s, "ตรงกับ Lecture 12 สไลด์ 11 (Delete) และ 16 (ลบ directory ต้องว่างก่อน)", 5.85, 4.36, 3.65, 0.45, { fontSize: 11 });
  cite(s, "ทดสอบด้วย tests/test_edge.sh หัวข้อ K (ลบ 33 เคส) และ L (rename 35 เคส)");
}

// X2. E4 size= quota
{
  const s = content("งานเสริม", "size= จำกัด RAM รวมของทั้ง mount เพราะทุกการจอง buffer ต้องผ่าน fslek_charge ก่อน",
    "E4 เพิ่ม fslek_sb_info ต่อ super_block เก็บโควตาสูงสุดกับที่ใช้ไป ป้องกันด้วย spinlock ของตัวเองเพราะหลายไฟล์ใช้โควตาก้อนเดียวกัน ขอสองค่าคือ min ที่จำเป็นกับ want ที่อยากได้เพราะขยายเท่าตัว ถ้าไม่ระบุ size= ใช้ครึ่งหนึ่งของ RAM เหมือน tmpfs ภาพขวาตั้ง 10 MiB มีไฟล์จองอยู่ 8 MiB จึงเขียนเพิ่มได้ 2 MiB พอดี");
  box(s, "fslek_reserve(inode, need)", 0.5, 1.22, 2.4, 0.36, { font: CODE, fontSize: 10.5, fill: GRAY, line: GRAY });
  arrow(s, 2.9, 1.4, 3.2, 1.4, NAVY, 1.25);
  box(s, "fslek_charge(sb, min, want)", 3.2, 1.22, 2.4, 0.36, { font: CODE, fontSize: 10.5, fill: TINT, line: BLUE, color: NAVY, bold: true });
  text(s, "left = max_bytes - used_bytes   (spinlock ต่อ mount)", 0.5, 1.68, 5.1, 0.26, { fontSize: 10.5, fontFace: CODE, color: MUTED });
  const br = [
    ["left >= want", "ได้ครบ", "ขยายเท่าตัวตามปกติ", TINT, BLUE, NAVY],
    ["min <= left < want", "ได้เท่าที่เหลือ", "พอสำหรับที่ต้องเขียน", TINT, BLUE, NAVY],
    ["left < min", "-ENOSPC", "No space left on device", WHITE, ORANGE, ORANGE],
  ];
  const BW = 1.62, BG = 0.12;
  br.forEach(([c, h, d, fill, ln, col], i) => {
    const x = 0.5 + i * (BW + BG);
    rect(s, x, 2.0, BW, 0.95, { fill, line: ln, name: "charge " + i });
    text(s, c, x + 0.06, 2.06, BW - 0.12, 0.24, { fontSize: 9.5, fontFace: CODE, bold: true, color: col, align: "center" });
    text(s, h, x + 0.06, 2.31, BW - 0.12, 0.28, { fontSize: 13, bold: true, color: col, align: "center" });
    text(s, d, x + 0.06, 2.62, BW - 0.12, 0.26, { fontSize: 10, align: "center" });
  });
  const facts = [
    ["คืนโควตาเมื่อ", "truncate เป็น 0, ไฟล์ถูก evict, หรือ kvzalloc ล้ม (fslek_uncharge)"],
    ["ค่าเริ่มต้น", "ครึ่งหนึ่งของ RAM เหมือน tmpfs จึงเขียนจน RAM หมดเครื่องไม่ได้"],
    ["remount,size=", "เพิ่มลดได้ แต่ลดต่ำกว่าที่ใช้อยู่ไม่ได้ (used <= max เสมอ)"],
  ];
  facts.forEach(([h, d], i) => {
    const y = 3.1 + i * 0.5;
    text(s, h, 0.5, y, 1.25, 0.45, { fontSize: 12, bold: true, color: NAVY });
    text(s, d, 1.8, y, 3.8, 0.45, { fontSize: 11 });
  });
  chips(s, ["super.c", "fslek_parse_param", "fslek_statfs"], 0.5, 4.68, 0.1, { fontSize: 10.5, h: 0.24 });
  shot(s, "10b.png", 700, 560, 5.85, 1.25, 3.65);
  cite(s, "นับ capacity ที่จองจริง ไม่ใช่ i_size · tests/test_edge.sh หัวข้อ N 41 เคส รวม 4 process แย่งโควตาเดียวกัน");
}

// X3. E5 /proc/fslek
{
  const s = content("งานเสริม", "/proc/fslek นับด้วย atomic แทน mutex เพราะแต่ละค่าอิสระกัน ไฟล์ต่างกันจึงไม่ต้องรอกัน",
    "E5 ทำตามแบบ procfs ในคาบแต่ใช้ proc_create_single กับ seq_printf counter สี่ตัวรวมทุก mount ตารางบอกจุดที่เพิ่มและลด bytes ใช้จุดเดียวกับโควตาของ E4 จึงตรงกันเสมอ เหตุผลที่ไม่ใช้ mutex ตัวเดียวแบบสไลด์หน้า 9 คือทุกไฟล์จะต้องรอกันเมื่อ buffer ขยาย ภาพขวา: เขียน 1 MiB ทีละ 64 KiB bytes เพิ่ม 1048576 และ grows เพิ่ม 5");
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const cd = (t, o = {}) => ({ text: t, options: Object.assign({ fontFace: CODE, fontSize: 10 }, o) });
  const nm = (t) => cd(t, { color: NAVY, bold: true });
  s.addTable([
    [hdr("counter"), hdr("เพิ่มที่"), hdr("ลดที่")],
    [nm("files"), cd("fslek_alloc_file_data"), cd("fslek_free_file_data")],
    [nm("directories"), cd("fslek_get_inode"), cd("fslek_evict_inode")],
    [nm("bytes"), cd("fslek_charge"), cd("fslek_uncharge")],
    [nm("grows"), cd("fslek_reserve"), "ไม่ลด (นับสะสม)"],
  ], {
    x: 0.5, y: 1.25, w: 5.1, colW: [1.2, 2.0, 1.9], rowH: 0.31,
    fontSize: 11, color: BODY, valign: "middle", margin: [0, 0.06, 0, 0.06],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  const cmp = [
    ["mutex ตัวเดียว (สไลด์หน้า 9)", "ทุกบรรทัดเป็นค่า ณ เวลาเดียวกัน", "แต่ทุกไฟล์ต้องรอกันเมื่อ buffer ขยาย", WHITE, LINE],
    ["atomic_long_t (ที่ใช้)", "ไม่มีใครรอใคร แต่ละค่าถูกต้อง", "แต่ละบรรทัดอาจอ่านคนละจังหวะเล็กน้อย", TINT, BLUE],
  ];
  cmp.forEach(([h, a, b, fill, ln], i) => {
    const x = 0.5 + i * 2.6;
    rect(s, x, 3.05, 2.5, 1.35, { fill, line: ln, name: "cmp " + i });
    text(s, h, x + 0.12, 3.12, 2.3, 0.28, { fontSize: 12, bold: true, color: NAVY });
    text(s, a, x + 0.12, 3.44, 2.3, 0.4, { fontSize: 11 });
    text(s, b, x + 0.12, 3.87, 2.3, 0.45, { fontSize: 11, color: ORANGE });
  });
  chips(s, ["stats.c", "proc_create_single", "seq_printf"], 0.5, 4.68, 0.1, { fontSize: 10.5, h: 0.24 });
  shot(s, "10c.png", 730, 500, 5.85, 1.25, 3.65);
  text(s, "เขียน 1 MiB ทีละ 64 KiB: bytes +1,048,576 และ grows +5 (64K ถึง 1M) หลัง rm ค่า bytes กลับเท่าเดิม",
    5.85, 4.17, 3.65, 0.65, { fontSize: 11 });
  cite(s, "อ้างอิง: Kernel_memory_mutex.pdf (procfs, mutex หน้า 9) · tests/test_edge.sh หัวข้อ P 22 เคส ทุกค่ากลับเป็น 0 หลัง umount");
}

// X4. E3 benchmark
{
  const s = content("งานเสริม", "fslek เขียนเร็วกว่า ramfs 1.7-7.4 เท่า\nอ่านก้อน 1 MiB เร็วกว่า 1.3-1.8 เท่า แต่อ่านทีละ 4 KiB ไม่ต่าง",
    "กราฟซ้ายคือไฟล์ 64 MiB ตารางขวาคืออัตราส่วน median ของ fslek ต่อ ramfs ทุกขนาด ตัวเลขเป็น median ของ 15 รอบ สลับ filesystem ทุกรอบ แถวอ่าน 4K ต่างจาก ramfs ไม่เกิน 15% และช่วงต่ำสุดสูงสุดซ้อนกัน จึงสรุปว่าไม่ต่าง เทียบ tmpfs ต่างได้ถึง 24% แต่ช่วงก็ยังซ้อนกัน คำอธิบายในกล่องเป็นข้อสันนิษฐานจากโครงสร้าง ยังไม่ได้ profile และ fslek เร็วกว่าส่วนหนึ่งเพราะทำน้อยกว่า ไม่มี mmap ไม่มี swap");
  const labels = ["เขียน bs=1M", "อ่าน bs=1M", "เขียน bs=4K", "อ่าน bs=4K"];
  s.addChart(pres.charts.BAR, [
    { name: "fslek", labels, values: [2316, 7324, 1245, 2041] },
    { name: "tmpfs", labels, values: [1012, 2925, 657, 1746] },
    { name: "ramfs", labels, values: [1379, 4542, 751, 1783] },
  ], {
    x: 0.4, y: 1.2, w: 5.3, h: 3.75, barDir: "col", barGrouping: "clustered", barGapWidthPct: 50,
    chartColors: ["2E75B6", "BFBFBF", "6B7280"],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: "404040", dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "#,##0",
    showLegend: true, legendPos: "t", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: "404040",
    showValAxisTitle: true, valAxisTitle: "MiB/s (ไฟล์ 64 MiB)", valAxisTitleFontSize: 11, valAxisTitleColor: "404040", valAxisTitleFontFace: "+mn-lt",
    catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, catAxisLabelColor: "404040", valAxisLabelColor: "404040",
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", valAxisLabelFormatCode: "#,##0",
    valAxisMaxVal: 8000, valAxisMinVal: 0, valAxisMajorUnit: 2000,
    valGridLine: { color: "E5E5E5", size: 0.5 }, catGridLine: { style: "none" },
  });
  const RX = 5.9, RW = 3.6;
  text(s, "fslek ÷ ramfs (median ของ 15 รอบ)", RX, 1.22, RW, 0.28, { fontSize: 12, bold: true, color: NAVY });
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } });
  const v = (t, hot) => ({ text: t, options: { align: "center", bold: hot, color: hot ? NAVY : MUTED, fill: { color: hot ? "EAF1F8" : "FFFFFF" } } });
  s.addTable([
    [hdr(""), hdr("1"), hdr("4"), hdr("16"), hdr("64 MiB")],
    ["เขียน 1M", v("7.4", true), v("3.4", true), v("1.8", true), v("1.7", true)],
    ["อ่าน 1M", v("1.3", true), v("1.5", true), v("1.8", true), v("1.6", true)],
    ["เขียน 4K", v("2.4", true), v("2.4", true), v("1.7", true), v("1.7", true)],
    ["อ่าน 4K", v("1.0"), v("1.1"), v("1.1"), v("1.1")],
  ], {
    x: RX, y: 1.55, w: RW, colW: [1.0, 0.6, 0.6, 0.6, 0.8], rowH: 0.3,
    fontSize: 11, color: BODY, valign: "middle", margin: [0, 0.05, 0, 0.05],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  rect(s, RX, 3.2, RW, 1.4, { fill: TINT, line: TINT, name: "why bench" });
  text(s, "น่าจะเพราะ (ยังไม่ได้ profile)", RX + 0.12, 3.26, RW - 0.24, 0.26, { fontSize: 12, bold: true, color: NAVY });
  text(s, [
    { text: "fslek copy เข้า buffer ก้อนเดียว ไม่ต้องหาและจองทีละหน้าใน page cache", options: { bullet: { indent: 10 }, breakLine: true } },
    { text: "อ่านทีละ 4 KiB ค่า system call เป็นส่วนใหญ่ของเวลา", options: { bullet: { indent: 10 }, breakLine: true } },
    { text: "เขียนไฟล์ 1 MiB ทิ้งห่างสุด: buffer ก้อนเดิมยังอยู่ใน CPU cache", options: { bullet: { indent: 10 }, breakLine: true } },
    { text: "fslek ทำน้อยกว่า: ไม่มี mmap, ไม่มี swap", options: { bullet: { indent: 10 } } },
  ], RX + 0.12, 3.53, RW - 0.24, 1.02, { fontSize: 10.5 });
  chips(s, ["tests/bench.sh", "tests/bench.c"], RX, 4.7, 0.1, { fontSize: 10.5, h: 0.24 });
  cite(s, "VM kernel 6.8.0-999 · ตารางเต็มพร้อมช่วงช้าสุดถึงเร็วสุดใน captures/test_bench.png · ต่างกันไม่ถึงราว 20% ถือว่าไม่ต่าง");
}

// 10b. Lecture 12 mapping
pres.addSection({ title: "เทียบกับเนื้อหาที่เรียน" });
{
  const s = content("เทียบกับเนื้อหาที่เรียน", "แนวคิดหลักใน Lecture 12 มีตัวตนในโค้ด fslek ยกเว้น hard link และส่วนที่ต้องมี disk",
    "ไล่จากบนลงล่าง: control block สองแบบคือ inode กับ super_block, การ mount, directory ที่เป็นคู่ชื่อกับ inode ซึ่ง fslek เก็บใน dcache ที่เป็น hash table, วิธีจองพื้นที่ที่ตรงกับ contiguous allocation รวมถึงข้อเสียที่ต้องย้ายเมื่อไฟล์โต สองแถวล่างคือ hard link ที่ยังไม่รองรับ และสิ่งที่ไม่จำเป็นเพราะไม่มี disk");
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const fn = (t) => ({ text: t, options: { fontFace: CODE, color: NAVY, bold: true } });
  const mt = (t) => ({ text: t, options: { color: MUTED } });
  const rows = [
    [hdr("แนวคิดใน Lecture 12"), hdr("สไลด์"), hdr("ใน fslek"), hdr("ไฟล์")],
    ["File Control Block", "17", "struct inode เก็บขนาด สิทธิ์ เวลา และ i_private ชี้ไป buffer", fn("super.c")],
    ["Volume Control Block", "17", "struct super_block: ขนาดไฟล์สูงสุด 64 MiB, magic 0x46534c4b", fn("super.c")],
    ["Mount ที่ mount point", "19", "mount -t fslek none /mnt/fslek → get_tree_nodev", fn("super.c")],
    ["Directory = คู่ (ชื่อ, inode)", "5, 29", "dentry ใน dcache ซึ่งเป็น hash table ค้นด้วย simple_lookup", fn("dir.c")],
    ["mkdir ได้ . และ ..", "16", "directory ใหม่ nlink = 2 และเพิ่ม nlink ของแม่, rmdir ต้องว่างก่อน", fn("dir.c")],
    ["Contiguous allocation", "21", "buffer ก้อนเดียว ถ้าไม่พอต้องย้ายไปก้อนใหม่ จึงขยายเท่าตัวให้ย้ายไม่บ่อย", fn("file.c")],
    ["Free-space management", "28", "หน้าว่างใช้ allocator ของ kernel ส่วนพื้นที่ที่เหลือนับด้วย fslek_charge", fn("super.c")],
    ["Create / Read / Write / Delete", "11", "มีครบ: delete ใช้ simple_unlink และ simple_rmdir (E1)", fn("dir.c")],
    ["Hard link, reference count", "14", { text: "i_nlink มีแล้ว แต่ยังไม่รองรับ ln", options: { color: ORANGE, bold: true } }, fn("dir.c")],
    [mt("Consistency, journaling"), mt("30-31"), mt("ไม่จำเป็น เพราะไม่มีอะไรลง disk"), mt("-")],
  ];
  s.addTable(rows, {
    x: 0.5, y: 1.2, w: 9.0, colW: [2.45, 0.7, 4.85, 1.0], rowH: 0.33,
    fontSize: 11.5, color: BODY, valign: "middle", margin: [0, 0.08, 0, 0.08],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  cite(s, "อ้างอิง: Lecture12_FileSystemAndImplementation.pptx · รายละเอียดใน docs/handoff.md หัวข้อ เทียบกับเนื้อหาที่เรียน");
}

// 10c. test overview
pres.addSection({ title: "การทดสอบและข้อจำกัด" });
{
  const s = content("การทดสอบและข้อจำกัด", "ทดสอบ 256 เคสใน 2 สคริปต์ ผ่านทั้งหมดบน kernel 6.8 และ dmesg ไม่มี Oops",
    "กราฟแสดงจำนวนเคสแยกตามกลุ่ม สีเทาคือ test_mvp.sh ที่ครอบ 7 operation ตามโจทย์และ concurrency สีน้ำเงินคือ test_edge.sh ที่ไล่ code path ทีละจุด รวมถึง error path สิทธิ์ ข้อจำกัด หน่วยความจำรั่ว และงานเสริมในหัวข้อ K L N P สิ่งที่ยังไม่ครอบเขียนไว้มุมขวาล่าง");
  const groups = [
    ["7 operation ตามโจทย์", 26, 0], ["อ่าน/เขียนพร้อมกัน", 5, 0],
    ["A อ่าน/เขียนที่ offset", 17, 1], ["B truncate", 8, 1], ["C ไฟล์ 64 MiB", 5, 1],
    ["D เวลา, สิทธิ์ไฟล์", 10, 1], ["E directory, ชื่อไฟล์", 14, 1], ["F ผู้ใช้ nobody", 8, 1],
    ["G sendfile, fsync, statfs", 9, 1], ["H ข้อจำกัด", 6, 1], ["I วงจรชีวิต mount", 9, 1],
    ["J หน่วยความจำรั่ว", 5, 1], ["K ลบ (E1)", 33, 1], ["L rename (E2)", 35, 1], ["N size= และ df (E4)", 41, 1],
    ["P /proc/fslek (E5)", 22, 1], ["ถอด module + dmesg", 3, 1],
  ];
  const labels = groups.map((g) => g[0]);
  s.addChart(pres.charts.BAR, [
    { name: "test_mvp.sh (31)", labels, values: groups.map((g) => (g[2] ? 0 : g[1])) },
    { name: "test_edge.sh (225)", labels, values: groups.map((g) => (g[2] ? g[1] : 0)) },
  ], {
    x: 0.4, y: 1.15, w: 5.9, h: 3.85, barDir: "bar", barGrouping: "stacked", barGapWidthPct: 45,
    chartColors: ["BFBFBF", "2E75B6"], catAxisOrientation: "maxMin",
    showValue: false,
    showLegend: true, legendPos: "t", legendFontSize: 11, legendFontFace: "+mn-lt", legendColor: "404040",
    catAxisLabelFontSize: 8.5, catAxisLabelFrequency: 1, valAxisLabelFontSize: 10, catAxisLabelColor: "404040", valAxisLabelColor: "404040",
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
    valAxisMaxVal: 45, valAxisMinVal: 0, valAxisMajorUnit: 5,
    valGridLine: { color: "E5E5E5", size: 0.5 }, catGridLine: { style: "none" },
  });
  const RX = 6.55, RW = 2.95;
  const stats = [["31/31", "tests/test_mvp.sh"], ["225/225", "tests/test_edge.sh"], ["0", "BUG / Oops / WARNING ใน dmesg"]];
  stats.forEach(([v, d], i) => {
    const y = 1.2 + i * 0.78;
    rect(s, RX, y, RW, 0.66, { fill: i === 2 ? WHITE : NAVY, line: NAVY, name: "stat " + i });
    text(s, v, RX + 0.12, y, 1.2, 0.66, { fontSize: 18, bold: true, color: i === 2 ? NAVY : WHITE, valign: "middle" });
    text(s, d, RX + 1.3, y, RW - 1.4, 0.66, { fontSize: 11, fontFace: i === 2 ? undefined : CODE,
      color: i === 2 ? BODY : WHITE, valign: "middle" });
  });
  text(s, "ยังไม่ครอบ", RX, 3.6, RW, 0.26, { fontSize: 12, bold: true, color: ORANGE });
  text(s, "kvzalloc ล้ม (ENOMEM), หน่วยความจำรั่วฝั่ง kmalloc, kernel 7.0 (งาน E0)", RX, 3.86, RW, 0.6, { fontSize: 11, color: BODY });
  chip(s, "docs/test-coverage.md", RX, 4.55, { fontSize: 10.5, h: 0.24 });
  cite(s, "รันบน Ubuntu 24.04 kernel 6.8.0-999-generic เมื่อ 25 พ.ย. 2026 · ตารางว่าเคสไหนครอบฟังก์ชันไหนอยู่ใน docs/test-coverage.md");
}

// 10d. evidence screenshots
{
  const s = content("การทดสอบและข้อจำกัด", "ผลรันจริงใน VM: test_mvp.sh ผ่าน 31/31 และ test_edge.sh ผ่าน 225/225",
    "ภาพจริงจาก VM ใช้ยืนยันตัวเลขในสไลด์ก่อนหน้า ถ้าต้องการให้อ่านชัดตอนพรีเซนต์ ให้เปิดไฟล์ภาพเต็มใน captures/ ภาพกลางคือต้นผลของ test_edge.sh ภาพขวาคือท้ายผลที่เห็น PASS=225 ส่วนกลางอยู่ใน test_edge-b.png และ test_edge-c.png");
  const imgs = [["test_mvp.png", 587, 925], ["test_edge-a.png", 768, 961], ["test_edge-d.png", 521, 907]];
  const H = 3.5, G = 0.18;
  const ws = imgs.map(([, w, h]) => (H * w) / h);
  let x = 0.5 + (9.0 - ws.reduce((a, b) => a + b, 0) - G * 2) / 2;
  imgs.forEach(([f], i) => {
    s.addImage({ path: CAP + f, x, y: 1.2, w: ws[i], h: H, altText: "ผลรัน " + f });
    s.addShape(shapes.RECTANGLE, { x, y: 1.2, w: ws[i], h: H, fill: { type: "none" }, line: { color: LINE, width: 0.75 } });
    chip(s, "captures/" + f, x, 4.8, { fontSize: 10, h: 0.24, w: Math.min(ws[i], 0.22 + (9 + f.length) * 10 * 0.0085) });
    x += ws[i] + G;
  });
  text(s, "ช่วงกลางของ test_edge.sh อยู่ใน captures/test_edge-b.png และ test_edge-c.png", 0.5, 5.06, 9.0, 0.22, { fontSize: 10, color: MUTED, align: "center" });
}

// 10e. limitations
{
  const s = content("การทดสอบและข้อจำกัด", "ข้อจำกัดทุกข้อมี test ยืนยัน และบอกได้ว่าต้องแก้ที่ไฟล์ไหน",
    "ทุกแถวมีหลักฐานจากเดโมหรือ test_edge.sh หัวข้อ C, H, N ซึ่งเช็คข้อความ error จริงจาก kernel สองแถวบนปรับปรุงต่อได้ กลุ่มกลางอยู่นอกขอบเขตโจทย์ สองแถวที่เขียนว่าตั้งใจคือผลจากการออกแบบให้อยู่ใน RAM rm กับ mv ที่เคยเป็นข้อจำกัดทำแล้วใน E1 และ E2");
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const er = (t) => ({ text: t, options: { fontFace: CODE, fontSize: 10.5 } });
  const plan = (t, c) => ({ text: t, options: { bold: true, color: c } });
  const rows = [
    [hdr("สิ่งที่ยังทำไม่ได้"), hdr("ผลที่ได้จริง"), hdr("สาเหตุในโค้ด"), hdr("แผน")],
    ["RAM ส่วนเกิน", "ไฟล์ 5 MiB จอง 8 MiB", "ขยายเท่าตัว คืนเฉพาะ truncate 0", plan("E6 · file.c", ORANGE)],
    ["write ก้อนใหญ่กว่าที่เหลือ", er("No space left on device"), "ล้มทั้งก้อน ไม่เขียนบางส่วน", plan("ปรับได้ · file.c", ORANGE)],
    ["ln, ln -s, mkfifo", er("Operation not permitted"), "ไม่มี .link, .symlink, .mknod", plan("นอกขอบเขต", MUTED)],
    ["mmap", er("No such device"), "ไม่มี .mmap เพราะไม่ใช้ page cache", plan("นอกขอบเขต", MUTED)],
    ["O_DIRECT", er("Invalid argument"), "ไม่มี direct_IO", plan("นอกขอบเขต", MUTED)],
    ["ไฟล์เกิน 64 MiB", er("File too large"), "s_maxbytes = FSLEK_MAX_FILE_SIZE", plan("ตั้งใจ", NAVY)],
    ["ข้อมูลหลัง umount", "หายทั้งหมด", "อยู่ใน RAM ไม่มี disk", plan("ตั้งใจ", NAVY)],
  ];
  s.addTable(rows, {
    x: 0.5, y: 1.2, w: 9.0, colW: [1.85, 2.35, 3.25, 1.55], rowH: 0.38,
    fontSize: 11.5, color: BODY, valign: "middle", margin: [0, 0.08, 0, 0.08],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  cite(s, "ผลจาก tests/test_edge.sh หัวข้อ C, H, N · RAM ส่วนเกินอยู่ใน captures/9.png ข้อมูลหลัง umount อยู่ใน captures/11.png");
}

// 11. Conclusions
pres.addSection({ title: "สรุป" });
{
  const s = content("สรุป", "ออกแบบให้เล็กและแยกไฟล์ตามหน้าที่ จึงครบโจทย์และเพิ่ม E1-E5 ได้โดยไม่รื้อของเดิม",
    "สรุปสามข้อ แล้วชี้งานที่เหลือคือ E0 กับ E6 สไลด์นี้ค้างไว้ตอนถามตอบ");
  const pts = [
    ["ใช้ VFS ให้มากที่สุด", "ls, rm, mv และโครง directory ได้จาก dcache + libfs", ["dir.c"]],
    ["เขียนเองเฉพาะข้อมูลไฟล์กับโควตา", "buffer ต่อ inode, ขยายเท่าตัว, ส่วนเกินเป็น 0 เสมอ", ["file.c", "super.c", "stats.c"]],
    ["ตรวจผลได้ซ้ำ", "test 256 เคส + demo 14 ขั้นพร้อมภาพหลักฐาน", ["test_mvp.sh", "test_edge.sh", "demo.sh"]],
  ];
  pts.forEach(([h, d, cs], i) => {
    const y = 1.2 + i * 0.9;
    s.addShape(shapes.OVAL, { x: 0.5, y: y + 0.05, w: 0.38, h: 0.38, fill: { color: NAVY }, line: { color: NAVY } });
    text(s, String(i + 1), 0.5, y + 0.05, 0.38, 0.38, { fontSize: 14, bold: true, color: WHITE, align: "center", valign: "middle" });
    text(s, h, 1.05, y, 3.6, 0.3, { fontSize: 15, bold: true, color: NAVY });
    text(s, d, 1.05, y + 0.33, 3.6, 0.5, { fontSize: 12, color: BODY });
    chips(s, cs, 4.85, y + 0.05, 0.1, { fontSize: 11, h: 0.26 });
  });
  // next steps box
  rect(s, 0.5, 3.95, 9.0, 0.95, { fill: TINT, line: TINT, name: "next steps" });
  text(s, "งานต่อยอด", 0.7, 4.02, 2, 0.3, { fontSize: 13, bold: true, color: NAVY });
  const nx = [["เสร็จแล้ว E1-E5", "test_edge.sh"], ["E0 ลองบน kernel 7.0", "ไม่แก้โค้ด"], ["E6 คืน RAM เมื่อหด", "file.c"], ["รายละเอียด", "docs/handoff.md"]];
  nx.forEach(([t, f], i) => {
    const x = 0.7 + i * 2.2;
    text(s, t, x, 4.35, 2.1, 0.25, { fontSize: 12, color: BODY });
    chip(s, f, x, 4.6, { fontSize: 11, h: 0.24, fill: WHITE });
  });
}

// 12. References
{
  const s = content("สรุป", "อ้างอิง", null);
  text(s, [
    { text: "Linux kernel documentation. Overview of the Linux Virtual File System. docs.kernel.org/filesystems/vfs.html", options: { bullet: true, breakLine: true } },
    { text: "Linux kernel documentation. Ramfs, rootfs and initramfs. docs.kernel.org/filesystems/ramfs-rootfs-initramfs.html", options: { bullet: true, breakLine: true } },
    { text: "Linux source v6.8 และ v7.0: fs/ramfs/inode.c, fs/libfs.c, include/linux/fs.h, include/linux/dcache.h, fs/super.c, fs/fs_parser.c. git.kernel.org", options: { bullet: true, breakLine: true } },
    { text: "เอกสารประกอบการสอน CPE333: Lecture 11 IO Devices and Mass Data Storage, Lecture 12 File System and Its Implementation, Kernel_memory_mutex.pdf", options: { bullet: true, breakLine: true } },
    { text: "The Linux Kernel Module Programming Guide. sysprog21.github.io/lkmpg", options: { bullet: true, breakLine: true } },
    { text: "โค้ดและหลักฐานของกลุ่ม: fslek/, tests/, captures/, docs/handoff.md, docs/test-coverage.md", options: { bullet: true } },
  ], 0.5, 1.25, 9.0, 3.6, { fontSize: 13, paraSpaceAfter: 8 });
}

// =====================================================================
// ภาคผนวก: อ่านโค้ดทีละไฟล์ (ลำดับเดียวกับที่แนะนำใน handoff)
const APX = "ภาคผนวก: อ่านโค้ดทีละไฟล์";
pres.addSection({ title: APX });

function badge(slide, n, x, y, d = 0.3, fs = 12, fill = ORANGE) {
  slide.addShape(shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
  text(slide, String(n), x, y, d, d, { fontSize: fs, bold: true, color: WHITE, align: "center", valign: "middle" });
}

// กล่องมีข้อความ (margin หน่วย point)
function box(slide, t, x, y, w, h, o = {}) {
  slide.addText(t, {
    x, y, w, h, shape: shapes.ROUNDED_RECTANGLE, rectRadius: 0.06,
    fill: { color: o.fill || WHITE }, line: { color: o.line || LINE, width: o.lw || 1, dashType: o.dash || "solid" },
    fontSize: o.fontSize || 11, fontFace: o.font, color: o.color || BODY, bold: !!o.bold,
    align: o.align || "center", valign: "middle", margin: o.margin ?? 3, isTextBox: true,
  });
}

// A1. reading map
{
  const s = content(APX, "อ่านโค้ดตามลำดับที่ kernel เรียกใช้ แล้วจึงดู test ที่ยืนยันแต่ละส่วน",
    "ภาคผนวกนี้ใช้ตอนตอบคำถาม หรือให้เพื่อนในกลุ่มอ่านโค้ดต่อ ลำดับ 7 ขั้นตามลูกศรคือลำดับที่แนะนำ สี่ไฟล์ตรงกลางคือโค้ดหลัก ส่วนล่างบอกว่าไฟล์ไหนเรียกอะไรของไฟล์ไหน ทั้ง module เชื่อมข้ามไฟล์แค่ 6 จุดนี้ สไลด์ถัดไปเป็นภาพของแต่ละไฟล์ตามลำดับนี้ ส่วน stats.c ดูในสไลด์ /proc/fslek ของหัวข้องานเสริม");
  const steps = [
    ["Makefile", "build อย่างไร และได้ flag อะไร"],
    ["fslek.h", "struct กับค่าคงที่ที่ทุกไฟล์ใช้"],
    ["super.c", "mount, umount, สร้าง inode, โควตา"],
    ["dir.c", "สร้าง ลบ ย้ายชื่อใน directory"],
    ["file.c", "buffer, read, write, truncate"],
    ["stats.c", "นับสถิติให้ /proc/fslek"],
    ["tests/", "เคสไหนยืนยันฟังก์ชันไหน"],
  ];
  const W = 1.16, G = 0.1466, Y = 1.22, H = 1.5;
  steps.forEach(([f, q], i) => {
    const x = 0.5 + i * (W + G);
    const key = i >= 2 && i <= 5;
    rect(s, x, Y, W, H, { fill: key ? TINT : WHITE, line: key ? BLUE : LINE, name: "read " + f });
    badge(s, i + 1, x + 0.1, Y + 0.1);
    chip(s, f, x + 0.1, Y + 0.5, { fontSize: 11, bold: true, w: W - 0.2, fill: key ? WHITE : TINT });
    text(s, q, x + 0.08, Y + 0.84, W - 0.12, 0.62, { fontSize: 9.5 });
    if (i < steps.length - 1) arrow(s, x + W, Y + H / 2, x + W + G, Y + H / 2, NAVY, 1.25);
  });
  text(s, "การเรียกข้ามไฟล์", 0.5, 2.88, 4, 0.28, { fontSize: 13, bold: true, color: NAVY });
  const xs = [
    ["dir.c", "fslek_get_inode()", "super.c", "create และ mkdir ขอ inode ใหม่"],
    ["super.c", "fslek_alloc_file_data()", "file.c", "ไฟล์ปกติได้ fslek_file_data ตอนสร้าง inode"],
    ["super.c", "i_op, i_fop", "dir.c, file.c", "ผูก inode กับตาราง operations ตามชนิด"],
    ["file.c", "fslek_charge(), uncharge()", "super.c", "จองและคืนโควตา size= คู่กับ buffer"],
    ["super.c, file.c", "fslek_stats", "stats.c", "เพิ่มและลด counter ของ /proc/fslek"],
    ["ทุกไฟล์ .c", "#include", "fslek.h", "ใช้ struct, ค่าคงที่ และ compat ร่วมกัน"],
  ];
  xs.forEach(([a, via, b, d], i) => {
    const y = 3.22 + i * 0.335;
    chip(s, a, 0.5, y, { fontSize: 10, w: 1.25 });
    text(s, via, 1.85, y - 0.08, 2.3, 0.2, { fontSize: 9.5, fontFace: CODE, color: MUTED, align: "center" });
    arrow(s, 1.85, y + 0.17, 4.15, y + 0.17, NAVY, 1.25);
    chip(s, b, 4.25, y, { fontSize: 10, w: 1.45 });
    text(s, d, 5.9, y, 3.6, 0.28, { fontSize: 11, valign: "middle" });
  });
}

// A2. Makefile
{
  const s = content(APX, "make รัน Makefile สองรอบ รอบที่สองตรวจ header ของ kernel แล้ว compile 4 ไฟล์เป็น fslek.ko",
    "รอบแรก make ถูกเรียกจาก shell ตัวแปร KERNELRELEASE ยังว่าง Makefile จึงส่งต่อให้ build system ของ kernel ที่ /lib/modules รอบที่สอง Kbuild อ่านไฟล์เดิมอีกครั้ง คราวนี้ grep header ของ kernel ที่กำลัง build หา API ใหม่ 3 ตัว เจอตัวไหนก็เพิ่ม flag ให้ compiler แล้ว fslek.h ใช้ flag นั้นเลือกฟังก์ชัน บรรทัด fslek: headers=... ที่พิมพ์ออกมาคือหลักฐานในภาพ 2");
  const rows = [
    ["รอบที่ 1: เรียกจาก shell (KERNELRELEASE ว่าง)", [
      ["make", "cd fslek && make"],
      ["KDIR", "/lib/modules/$(uname -r)/build"],
      ["make -C $(KDIR) M=$(CURDIR)", "ส่งต่อให้ build system ของ kernel"],
    ]],
    ["รอบที่ 2: Kbuild อ่าน Makefile อีกครั้ง (KERNELRELEASE มีค่า)", [
      ["grep header", "dcache.h และ fs.h หา 3 รูปแบบ"],
      ["ccflags-y += -DFSLEK_*", "flag ส่งเข้า compiler"],
      ["super.o dir.o file.o stats.o", "fslek-y รวมเป็น fslek.ko"],
    ]],
  ];
  const W = 2.8, G = 0.3, H = 0.62;
  rows.forEach(([lbl, st], r) => {
    const y0 = 1.2 + r * 1.02;
    text(s, lbl, 0.5, y0, 9.0, 0.26, { fontSize: 12, bold: true, color: MUTED });
    st.forEach(([c, d], i) => {
      const x = 0.5 + i * (W + G), y = y0 + 0.3;
      const key = r === 1 && i < 2;
      rect(s, x, y, W, H, { fill: key ? TINT : WHITE, line: key ? BLUE : LINE, name: "mk " + r + i });
      badge(s, r * 3 + i + 1, x + 0.08, y + (H - 0.26) / 2, 0.26, 10.5);
      text(s, c, x + 0.42, y + 0.06, W - 0.5, 0.26, { fontSize: 10.5, fontFace: CODE, color: NAVY, bold: true });
      text(s, d, x + 0.42, y + 0.33, W - 0.5, 0.26, { fontSize: 10.5, color: BODY });
      if (i < 2) arrow(s, x + W, y + H / 2, x + W + G, y + H / 2, NAVY, 1.25);
    });
  });
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY } } });
  const cd = (t, o = {}) => ({ text: t, options: Object.assign({ fontFace: CODE, fontSize: 10 }, o) });
  s.addTable([
    [hdr("ข้อความที่ grep หา"), hdr("ถ้าเจอ ได้ flag"), hdr("fslek.h เลือกใช้")],
    [cd("d_make_persistent  (dcache.h)"), cd("-DFSLEK_HAVE_D_MAKE_PERSISTENT", { color: NAVY, bold: true }), cd("d_make_persistent, kill_anon_super")],
    [cd("inode_just_drop  (fs.h)"), cd("-DFSLEK_HAVE_INODE_JUST_DROP", { color: NAVY, bold: true }), cd("inode_just_drop")],
    [cd("dentry *(*mkdir)  (fs.h)"), cd("-DFSLEK_MKDIR_RETURNS_DENTRY", { color: NAVY, bold: true }), cd("mkdir คืน struct dentry *")],
  ], {
    x: 0.5, y: 3.25, w: 9.0, colW: [2.75, 3.25, 3.0], rowH: 0.32,
    fontSize: 11, color: BODY, valign: "middle", margin: [0, 0.08, 0, 0.08],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  text(s, "grep ไม่เจอทั้งสามตัวแปลว่าเป็น kernel แบบ 6.8 แต่ถ้าหาไฟล์ fs.h ไม่เจอ Makefile จะพิมพ์ $(warning) เพราะ flag ว่างจะเลือก API ของ 6.8 เสมอ",
    0.5, 4.6, 9.0, 0.3, { fontSize: 10.5, color: ORANGE });
  cite(s, "บรรทัด fslek: headers=... fs.h=found flags=... ที่ $(info) พิมพ์ออกมาอยู่ใน captures/2.png");
}

// A3. fslek.h
{
  const s = content(APX, "fslek.h แบ่งเป็น 4 ส่วน และแต่ละส่วนถูกใช้โดยไฟล์ .c คนละชุด",
    "อ่าน header ก่อนไฟล์ .c เพราะทุกไฟล์ include มัน ส่วนที่สำคัญที่สุดคือ struct สามตัว: fslek_file_data ต่อไฟล์ มีแค่ pointer กับขนาดที่จองไว้ ขนาดไฟล์จริงไม่เก็บซ้ำเพราะอยู่ใน inode แล้ว fslek_sb_info ต่อ mount เก็บโควตา และ fslek_stats รวมทั้ง module ส่วน compat เป็น static inline กับ define ทั้งหมด จึงไม่มีโค้ดเพิ่มตอนรัน");
  const bands = [
    ["1  ค่าคงที่", ["FSLEK_MAGIC          0x46534c4b", "FSLEK_MAX_FILE_SIZE  64 MiB", "FSLEK_MIN_ALLOC      4096"],
      [["super.c", "s_magic, s_maxbytes"], ["file.c", "ขอบเขตของ fslek_reserve"]]],
    ["2  struct", ["fslek_file_data  data, capacity (>= i_size)", "fslek_sb_info    lock, max_bytes, used_bytes", "fslek_stats      files, dirs, bytes, grows"],
      [["file.c", "file_data ผ่าน inode->i_private"], ["super.c", "sb_info ผ่าน sb->s_fs_info"]]],
    ["3  compat 6.8 / 7.0", ["fslek_pin_dentry()", "fslek_kill_super   fslek_drop_inode"],
      [["dir.c", "pin dentry ตอนสร้างชื่อ"], ["super.c", "umount และ drop_inode"]]],
    ["4  prototype ข้ามไฟล์", ["fslek_get_inode()  fslek_charge/uncharge()", "fslek_*_operations  alloc/free_file_data", "fslek_stats_init/exit()"],
      [["dir.c", "เรียก fslek_get_inode"], ["super.c", "ตั้ง ops และจอง file_data"]]],
  ];
  const X = 0.5, W = 4.7, H = 0.84, G = 0.1;
  bands.forEach(([h, code, uses], i) => {
    const y = 1.22 + i * (H + G);
    rect(s, X, y, W, H, { fill: i === 1 ? TINT : WHITE, line: i === 1 ? BLUE : LINE, name: "band " + i });
    text(s, h, X + 0.12, y + 0.06, W - 0.24, 0.26, { fontSize: 12, bold: true, color: NAVY });
    text(s, code.join("\n"), X + 0.12, y + 0.33, W - 0.24, 0.5, { fontSize: 9.5, fontFace: CODE, color: BODY });
    arrow(s, X + W + 0.05, y + H / 2, X + W + 0.4, y + H / 2, MUTED, 1.25);
    uses.forEach(([f, d], j) => {
      const uy = y + (uses.length === 1 ? (H - 0.26) / 2 : 0.1 + j * 0.36);
      chip(s, f, 5.7, uy, { fontSize: 10.5, h: 0.26, w: 0.85 });
      text(s, d, 6.65, uy, 2.85, 0.26, { fontSize: 11, valign: "middle" });
    });
  });
}

// A4. super.c
{
  const s = content(APX, "super.c อ่านจากล่างขึ้นบน เพราะสิ่งที่ kernel เรียกก่อนอยู่ท้ายไฟล์",
    "ซ้ายคือฟังก์ชันตามตำแหน่งจริงในไฟล์ เลขสีส้มคือลำดับที่ควรอ่าน เริ่มจาก fslek_init ตอน insmod ไล่ขึ้นไปจนถึง fill_super ตอน mount เลข 6 คือส่วนของ size= กับ df ที่ใช้ระหว่าง mount อยู่ และเลข 7 คือตอนคืนทรัพยากร ขวาคือ fslek_get_inode ซึ่งเป็นฟังก์ชันเดียวที่ไฟล์อื่นเรียก ทุก inode ทั้ง root ไฟล์ และ directory สร้างที่นี่ แล้วแยกตามชนิดว่าจะผูกกับ operations ชุดไหน");
  text(s, "ตำแหน่งในไฟล์ (บรรทัด)", 0.5, 1.2, 3.0, 0.26, { fontSize: 12, bold: true, color: MUTED });
  const fns = [
    [33, "fslek_charge()", 6], [52, "fslek_uncharge()", 6], [67, "fslek_get_inode()", 5], [111, "fslek_evict_inode()", 7],
    [122, "fslek_statfs()", 6], [139, "fslek_show_options()", 6], [151, "fslek_super_ops", 4], [159, "fslek_fill_super()", 4],
    [188, "fslek_get_tree()", 3], [202, "fslek_parse_param()", 3], [223, "fslek_reconfigure()", 6], [247, "fslek_context_ops", 3],
    [254, "fslek_init_fs_context()", 3], [266, "fslek_kill_sb()", 7], [280, "fslek_fs_type", 2],
    [288, "fslek_init()", 1], [309, "fslek_exit()", 1],
  ];
  fns.forEach(([ln, f, n], i) => {
    const y = 1.48 + i * 0.214, key = f === "fslek_get_inode()";
    text(s, String(ln), 0.5, y, 0.38, 0.195, { fontSize: 9, fontFace: CODE, color: MUTED, align: "right", valign: "middle" });
    box(s, f, 0.95, y, 2.5, 0.195, { font: CODE, fontSize: 9, align: "left", margin: [5, 0, 0, 0],
      fill: key ? TINT : WHITE, line: key ? BLUE : LINE, color: NAVY, bold: key });
    badge(s, n, 3.55, y, 0.195, 8.5);
  });
  arrow(s, 4.0, 4.75, 4.0, 1.55, MUTED, 1.25);
  text(s, "อ่านขึ้น", 4.06, 4.45, 0.6, 0.25, { fontSize: 10, color: MUTED });

  // fslek_get_inode decision
  const RX = 4.55, RW = 4.95;
  text(s, "fslek_get_inode(): สร้าง inode แล้วแยกตามชนิด", RX, 1.2, RW, 0.26, { fontSize: 12, bold: true, color: NAVY });
  box(s, "new_inode → get_next_ino → inode_init_owner (uid, gid, setgid) → ตั้งเวลา", RX, 1.55, RW, 0.45,
    { fontSize: 10.5, fill: TINT, line: BLUE });
  const cx = RX + RW / 2;
  arrow(s, cx, 2.0, cx, 2.15, NAVY, 1.25);
  s.addText("mode & S_IFMT", { x: cx - 1.1, y: 2.15, w: 2.2, h: 0.6, shape: shapes.DIAMOND,
    fill: { color: WHITE }, line: { color: NAVY, width: 1.25 }, fontFace: CODE, fontSize: 9.5, color: NAVY, bold: true,
    align: "center", valign: "middle", margin: 0, isTextBox: true });
  const BW = 1.55, BG = (RW - 3 * BW) / 2;
  const centers = [0, 1, 2].map((i) => RX + i * (BW + BG) + BW / 2);
  line(s, cx, 2.75, cx, 2.9, NAVY, 1.25);
  line(s, centers[0], 2.9, centers[2], 2.9, NAVY, 1.25);
  const br = [
    ["S_IFREG", "ไฟล์ปกติ", "i_op  = file ops\ni_fop = file ops\nalloc_file_data()", TINT, BLUE],
    ["S_IFDIR", "directory", "i_op = dir ops\nls ใช้ของ libfs\nnlink = 2", TINT, BLUE],
    ["อื่น ๆ", "ไม่รองรับ", "iput(inode)\nคืน -EINVAL", WHITE, LINE],
  ];
  br.forEach(([k, h, d, fill, ln], i) => {
    const x = RX + i * (BW + BG);
    arrow(s, centers[i], 2.9, centers[i], 3.05, NAVY, 1.25);
    rect(s, x, 3.05, BW, 1.3, { fill, line: ln, name: "branch " + k });
    text(s, k, x + 0.1, 3.1, BW - 0.2, 0.24, { fontSize: 10.5, fontFace: CODE, bold: true, color: ORANGE });
    text(s, h, x + 0.1, 3.34, BW - 0.2, 0.24, { fontSize: 11.5, bold: true, color: NAVY });
    text(s, d, x + 0.1, 3.6, BW - 0.2, 0.72, { fontSize: 9.5, fontFace: CODE, color: BODY });
  });
  text(s, "ผู้เรียก", RX, 4.5, 0.6, 0.26, { fontSize: 11, bold: true, color: MUTED, valign: "middle" });
  chips(s, ["fill_super() → root", "dir.c fslek_mknod()"], RX + 0.65, 4.5, 0.12, { fontSize: 10, h: 0.26 });
}

// A5. dir.c
{
  const s = content(APX, "create กับ mkdir ใช้ fslek_mknod ร่วมกัน ต่างกันที่ชนิดไฟล์และ nlink ของแม่",
    "touch กับ mkdir เข้ามาคนละฟังก์ชันแต่ลงที่ fslek_mknod ตัวเดียว ซึ่งทำ 3 อย่าง: ขอ inode จาก super.c, ผูกชื่อแล้ว pin ไว้ใน dcache, และอัปเดตเวลาของ directory แม่ mkdir ทำเพิ่มอีกอย่างคือ inc_nlink ของแม่ เพราะ .. ของลูกชี้กลับมา ด้านขวาล่างคือตาราง operations ที่มีและที่ไม่มี ซึ่งเป็นเหตุที่ ln ได้ EPERM ส่วน rm กับ mv ใช้ helper ของ libfs");
  box(s, "touch a.txt", 0.5, 1.22, 2.4, 0.3, { fill: GRAY, line: GRAY, font: CODE, fontSize: 10.5 });
  box(s, "mkdir docs", 3.1, 1.22, 2.4, 0.3, { fill: GRAY, line: GRAY, font: CODE, fontSize: 10.5 });
  arrow(s, 1.7, 1.52, 1.7, 1.7, NAVY, 1.25);
  arrow(s, 4.3, 1.52, 4.3, 1.7, NAVY, 1.25);
  rect(s, 0.5, 1.7, 2.4, 0.8, { fill: WHITE, line: BLUE, name: "fn create" });
  text(s, [
    { text: "fslek_create()", options: { fontFace: CODE, bold: true, color: NAVY, breakLine: true } },
    { text: "mode | S_IFREG", options: { fontFace: CODE } },
  ], 0.6, 1.76, 2.2, 0.7, { fontSize: 10.5, valign: "middle", align: "center" });
  rect(s, 3.1, 1.7, 2.4, 0.8, { fill: WHITE, line: BLUE, name: "fn mkdir" });
  text(s, [
    { text: "fslek_mkdir() → do_mkdir()", options: { fontFace: CODE, bold: true, color: NAVY, breakLine: true } },
    { text: "mode | S_IFDIR", options: { fontFace: CODE, breakLine: true } },
    { text: "สำเร็จแล้ว inc_nlink(dir)", options: { color: ORANGE, bold: true } },
  ], 3.15, 1.74, 2.3, 0.72, { fontSize: 9.5, valign: "middle", align: "center" });
  arrow(s, 1.7, 2.5, 2.6, 2.8, NAVY, 1.25);
  arrow(s, 4.3, 2.5, 3.4, 2.8, NAVY, 1.25);
  box(s, "fslek_mknod(dir, dentry, mode)", 1.4, 2.8, 3.2, 0.4, { fill: TINT, line: BLUE, font: CODE, fontSize: 11, bold: true, color: NAVY });
  arrow(s, 3.0, 3.2, 3.0, 3.36, NAVY, 1.25);
  const st = [
    ["fslek_get_inode() สร้าง inode ตามชนิด", "super.c"],
    ["fslek_pin_dentry() ผูกชื่อกับ inode และ pin ไว้", "fslek.h"],
    ["อัปเดต mtime และ ctime ของ directory แม่", "dir.c"],
  ];
  st.forEach(([d, f], i) => {
    const y = 3.36 + i * 0.48;
    rect(s, 0.5, y, 5.0, 0.4, { fill: WHITE, line: LINE, name: "mknod " + i });
    badge(s, i + 1, 0.58, y + 0.08, 0.24, 10);
    text(s, d, 0.92, y, 3.55, 0.4, { fontSize: 10.5, valign: "middle" });
    chip(s, f, 4.5, y + 0.08, { fontSize: 9.5, h: 0.24, w: 0.9 });
  });

  // nlink
  const RX = 5.9, RW = 3.6;
  text(s, "nlink หลัง mkdir /docs", RX, 1.2, RW, 0.26, { fontSize: 12, bold: true, color: NAVY });
  box(s, "/   nlink = 2", RX, 1.6, 1.45, 0.36, { font: CODE, fontSize: 10.5, fill: GRAY, line: GRAY });
  text(s, "mkdir", RX + 1.5, 1.42, 0.6, 0.2, { fontSize: 9.5, fontFace: CODE, color: MUTED, align: "center" });
  arrow(s, RX + 1.5, 1.78, RX + 2.1, 1.78, NAVY, 1.25);
  box(s, "/   nlink = 3", RX + 2.15, 1.6, 1.45, 0.36, { font: CODE, fontSize: 10.5, fill: TINT, line: BLUE, color: NAVY, bold: true });
  box(s, "docs/  nlink = 2", RX + 2.15, 2.08, 1.45, 0.36, { font: CODE, fontSize: 10, fill: TINT, line: BLUE, color: NAVY });
  line(s, RX + 2.3, 1.96, RX + 2.3, 2.08, BLUE, 1);
  text(s, "แม่ +1 เพราะ .. ของ docs ชี้กลับมา\nลูกเริ่มที่ 2 คือชื่อใน / กับ .", RX, 2.08, 2.1, 0.62, { fontSize: 10, color: BODY });

  text(s, "fslek_dir_inode_operations", RX, 2.85, RW, 0.26, { fontSize: 11, fontFace: CODE, bold: true, color: NAVY });
  const ops = [
    [".lookup = simple_lookup (libfs)", true], [".create = fslek_create", true], [".mkdir  = fslek_mkdir", true],
    [".unlink = simple_unlink (libfs)", true], [".rmdir  = simple_rmdir (libfs)", true], [".rename = simple_rename (libfs)", true],
    [".link, .symlink, .mknod  ไม่มี → EPERM", false],
  ];
  ops.forEach(([t, has], i) => {
    const y = 3.14 + i * 0.285;
    box(s, t, RX, y, RW, 0.245, { font: CODE, fontSize: 9.5, align: "left", margin: 5,
      fill: has ? TINT : WHITE, line: has ? TINT : LINE, dash: has ? "solid" : "dash", color: has ? NAVY : MUTED });
  });
}

// A6. file.c buffer management
{
  const s = content(APX, "fslek_reserve ขยาย buffer และ fslek_resize เปลี่ยนขนาดไฟล์ โดยให้ส่วนเกิน i_size เป็น 0 เสมอ",
    "ซ้ายคือ fslek_reserve ที่ write และ truncate ใช้ ตรวจสองเงื่อนไขก่อน ถ้าพอแล้วคืนทันที ถ้าเกิน 64 MiB คืน EFBIG จากนั้นขอโควตาจาก fslek_charge ถ้าไม่พอคืน ENOSPC แล้วจึงจองก้อนใหม่ใหญ่ขึ้นเท่าตัว copy ของเดิม แล้วคืนก้อนเก่า ขวาคือ fslek_resize สามกรณี จุดสำคัญคือกรณีหด ต้อง memset ส่วนท้ายเป็นศูนย์ ไม่อย่างนั้นข้อมูลเก่าจะโผล่กลับมาเมื่อไฟล์ขยายอีกครั้ง test_edge.sh หัวข้อ B ตรวจกรณีนี้");
  text(s, "fslek_reserve(inode, need)", 0.5, 1.2, 4.4, 0.26, { fontSize: 12, fontFace: CODE, bold: true, color: NAVY });
  const flow = [
    ["need <= capacity ?", "ใช่: คืน 0 ทันที", true],
    ["need > 64 MiB ?", "ใช่: -EFBIG", true],
    ["newcap = max3(need, 2×cap, 4 KiB)", null, false],
    ["got = fslek_charge(min, want)", "0: -ENOSPC", false],
    ["buf = kvzalloc(cap + got)", "ล้ม: -ENOMEM", false],
    ["memcpy ของเดิม แล้ว kvfree ก้อนเก่า", null, false],
    ["ตั้ง capacity และ i_blocks ใหม่", null, false],
  ];
  const MW = 2.85, MH = 0.38;
  flow.forEach(([t, exit, dec], i) => {
    const y = 1.52 + i * 0.49;
    box(s, t, 0.5, y, MW, MH, { font: CODE, fontSize: 9, fill: dec ? WHITE : TINT, line: dec ? NAVY : BLUE,
      color: NAVY, bold: dec });
    if (i < flow.length - 1) arrow(s, 0.5 + MW / 2, y + MH, 0.5 + MW / 2, y + 0.49, NAVY, 1.25);
    if (exit) {
      arrow(s, 0.5 + MW, y + MH / 2, 3.6, y + MH / 2, ORANGE, 1.25);
      box(s, exit, 3.6, y, 1.3, MH, { fontSize: 10, color: ORANGE, line: ORANGE, bold: true });
    }
  });

  // fslek_resize
  const RX = 5.3, BX = 5.85, BW = 3.65;
  text(s, "fslek_resize(inode, new_size)", RX, 1.2, 4.2, 0.26, { fontSize: 12, fontFace: CODE, bold: true, color: NAVY });
  const K = {
    d: { fill: BLUE, line: BLUE, color: WHITE }, z: { fill: GRAY, line: LINE, color: MUTED },
    n: { fill: TINT, line: BLUE, color: NAVY }, m: { fill: ORANGE, line: ORANGE, color: WHITE },
    e: { fill: WHITE, line: LINE, color: MUTED, dash: "dash" },
  };
  const bar = (y, segs) => {
    let x = BX;
    segs.forEach(([f, k, t]) => {
      const w = BW * f;
      box(s, t || "", x, y, w, 0.24, Object.assign({ fontSize: 9, margin: 0 }, K[k]));
      x += w;
    });
  };
  const cases = [
    ["new_size = 0  (echo > f)", [[0.45, "d", "ข้อมูล"], [0.55, "z", "0"]], [[1, "e", "ไม่มี buffer"]], "kvfree ทั้งก้อน คืนโควตา capacity = 0"],
    ["ขยาย  (truncate -s ใหญ่ขึ้น)", [[0.35, "d", "ข้อมูล"], [0.65, "z", "0"]], [[0.35, "d", "ข้อมูล"], [0.3, "n", "ใหม่ = 0"], [0.35, "z", "0"]], "เรียก fslek_reserve ไม่ต้อง memset"],
    ["หด  (truncate -s เล็กลง)", [[0.6, "d", "ข้อมูล"], [0.4, "z", "0"]], [[0.35, "d", "ข้อมูล"], [0.25, "m", "memset 0"], [0.4, "z", "0"]], "ข้อมูลเก่าไม่โผล่กลับเมื่อขยายอีกครั้ง"],
  ];
  cases.forEach(([h, before, after, note], i) => {
    const y = 1.5 + i * 1.1;
    text(s, h, RX, y, 4.2, 0.24, { fontSize: 11, bold: true, color: NAVY });
    text(s, "ก่อน", RX, y + 0.28, 0.5, 0.24, { fontSize: 9.5, color: MUTED, valign: "middle" });
    bar(y + 0.28, before);
    text(s, "หลัง", RX, y + 0.56, 0.5, 0.24, { fontSize: 9.5, color: MUTED, valign: "middle" });
    bar(y + 0.56, after);
    text(s, note, BX, y + 0.82, BW, 0.2, { fontSize: 9.5, color: MUTED });
  });
  cite(s, "ต้องถูกเรียกขณะถือ inode_lock · need ถูกปัดขึ้นเป็นเต็มหน้า 4 KiB ก่อน · ตรวจโดย tests/test_edge.sh หัวข้อ A, B, C, N");
}

// A7. file.c ops + read path
{
  const s = content(APX, "file_operations บอก VFS ว่า system call ไหนลงฟังก์ชันไหน และ read ไม่อ่านเลย i_size",
    "ซ้ายคือตารางที่ผูกไว้กับไฟล์ปกติทุกไฟล์ สีฟ้าคือฟังก์ชันที่เราเขียน สีขาวคือ helper ของ kernel ที่ใช้ได้เลย ขวาคือ fslek_read_iter ความยาวที่อ่านจริงคือค่าน้อยกว่าระหว่างที่ผู้ใช้ขอ กับระยะจาก pos ถึงท้ายไฟล์ ส่วนทางเดินของ write อยู่ในสไลด์ write path ก่อนหน้า");
  text(s, "fslek_file_operations + setattr", 0.5, 1.2, 4.4, 0.26, { fontSize: 12, fontFace: CODE, bold: true, color: NAVY });
  const map = [
    ["read, cat", "fslek_read_iter", true],
    ["write, echo >>", "fslek_write_iter", true],
    ["truncate, chmod", "fslek_setattr", true],
    ["lseek, tail -c", "generic_file_llseek", false],
    ["sendfile, cp", "splice helper → read/write_iter", false],
    ["fsync", "noop_fsync", false],
  ];
  map.forEach(([sc, fn, ours], i) => {
    const y = 1.55 + i * 0.47;
    box(s, sc, 0.5, y, 1.55, 0.36, { fill: GRAY, line: GRAY, font: CODE, fontSize: 9.5 });
    arrow(s, 2.05, y + 0.18, 2.35, y + 0.18, NAVY, 1.25);
    box(s, fn, 2.35, y, 2.55, 0.36, { font: CODE, fontSize: 9.5, fill: ours ? TINT : WHITE, line: ours ? BLUE : LINE,
      color: ours ? NAVY : BODY, bold: ours });
  });
  box(s, "เขียนเอง", 2.35, 4.45, 1.1, 0.26, { fontSize: 9.5, fill: TINT, line: BLUE, color: NAVY });
  box(s, "helper ของ kernel", 3.55, 4.45, 1.35, 0.26, { fontSize: 9.5 });

  const RX = 5.3, RW = 4.2;
  text(s, "fslek_read_iter()", RX, 1.2, RW, 0.26, { fontSize: 12, fontFace: CODE, bold: true, color: NAVY });
  box(s, "ผู้ใช้ขอ count ไบต์", RX + 1.0, 1.55, 3.0, 0.22, { fontSize: 9, dash: "dash", color: MUTED, margin: 0 });
  const BY = 1.85;
  box(s, "", RX, BY, 1.0, 0.4, { fill: TINT, line: BLUE, margin: 0 });
  box(s, "len ที่อ่านจริง", RX + 1.0, BY, 1.8, 0.4, { fill: BLUE, line: BLUE, color: WHITE, bold: true, fontSize: 10, margin: 0 });
  box(s, "0", RX + 2.8, BY, 1.4, 0.4, { fill: GRAY, line: LINE, color: MUTED, fontSize: 10, margin: 0 });
  [["0", 0, "left"], ["pos", 1.0, "center"], ["i_size", 2.8, "center"], ["capacity", RW, "right"]].forEach(([t, dx, al]) => {
    const w = 0.8, x = al === "left" ? RX : al === "right" ? RX + RW - w : RX + dx - w / 2;
    text(s, t, x, BY + 0.44, w, 0.2, { fontSize: 9.5, fontFace: CODE, color: MUTED, align: al });
  });
  text(s, "len = min(count, i_size - pos)", RX, 2.55, RW, 0.26, { fontSize: 11, fontFace: CODE, bold: true, color: ORANGE });
  const st = [
    ["inode_lock_shared", "หลาย reader อ่านพร้อมกันได้"],
    ["pos >= i_size", "คืน 0 แปลว่า EOF"],
    ["copy_to_iter(data + pos, len)", "copy ไม่ได้เลยคืน -EFAULT"],
    ["ki_pos += copied", "ปลด lock แล้วอัปเดต atime"],
  ];
  st.forEach(([c, d], i) => {
    const y = 2.92 + i * 0.47;
    badge(s, i + 1, RX, y + 0.06, 0.26, 10.5);
    text(s, c, RX + 0.36, y, RW - 0.36, 0.22, { fontSize: 10, fontFace: CODE, bold: true, color: NAVY });
    text(s, d, RX + 0.36, y + 0.21, RW - 0.36, 0.22, { fontSize: 10, color: BODY });
  });
}

// A8. tests
{
  const s = content(APX, "สคริปต์ทดสอบ 3 ตัวไล่จากเดโมทีละขั้นไปถึงกรณีขอบ และทุกหัวข้อชี้กลับไปที่ไฟล์โค้ด",
    "demo.sh ใช้ตอนเดโมสดและเก็บภาพ test_mvp.sh ตรวจ 7 operation ตามโจทย์ test_edge.sh ไล่กรณีขอบทีละ code path ตารางล่างบอกว่าแต่ละหัวข้อทดสอบโค้ดในไฟล์ไหน ถ้าแก้ไฟล์ไหนให้รันหัวข้อที่มีจุดในแถวนั้น รายละเอียดระดับฟังก์ชันอยู่ใน docs/test-coverage.md");
  const cards = [
    ["demo.sh", "14 ขั้น", "หยุดรอ Enter ทุกขั้น ใช้เดโมสดและ capture (ขั้น 10 แยก a, b, c)"],
    ["test_mvp.sh", "31 เคส", "7 operation ตามโจทย์ + อ่าน/เขียนพร้อมกัน (หัวข้อ M)"],
    ["test_edge.sh", "225 เคส", "กรณีขอบและงานเสริม ตรวจข้อความ error จริงจาก kernel"],
  ];
  const W = 2.8, G = 0.3, Y = 1.22, H = 1.05;
  cards.forEach(([f, n, d], i) => {
    const x = 0.5 + i * (W + G);
    rect(s, x, Y, W, H, { fill: WHITE, line: i ? BLUE : LINE, name: "card " + f });
    chip(s, f, x + 0.12, Y + 0.12, { fontSize: 11, bold: true });
    text(s, n, x + 1.5, Y + 0.06, W - 1.62, 0.36, { fontSize: 17, bold: true, color: i ? NAVY : MUTED, align: "right" });
    text(s, d, x + 0.12, Y + 0.5, W - 0.24, 0.5, { fontSize: 10.5 });
    if (i < 2) arrow(s, x + W, Y + H / 2, x + W + G, Y + H / 2, NAVY, 1.25);
  });
  const secs = ["M", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "N", "P"];
  const cov = {
    "super.c": "MCDFGIJKLNP", "dir.c": "MDEHKL", "file.c": "MABCDGHJKNP", "stats.c": "P",
  };
  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, align: "center" } });
  const rows = [[hdr("ไฟล์ \\ หัวข้อ"), ...secs.map(hdr)]];
  Object.entries(cov).forEach(([f, c]) => {
    rows.push([{ text: f, options: { fontFace: CODE, bold: true, color: NAVY } },
      ...secs.map((k) => (c.includes(k)
        ? { text: "●", options: { color: BLUE, align: "center", fill: { color: "EAF1F8" } } }
        : { text: "", options: {} }))]);
  });
  s.addTable(rows, {
    x: 0.5, y: 2.5, w: 9.0, colW: [1.3, ...secs.map(() => 7.7 / secs.length)], rowH: 0.31,
    fontSize: 12, color: BODY, valign: "middle", margin: [0, 0.08, 0, 0.08],
    border: { type: "solid", pt: 0.75, color: "D9D9D9" }, fill: { color: WHITE },
  });
  text(s, "M test_mvp.sh · A offset และ EOF · B truncate · C ไฟล์ 64 MiB · D เวลาและสิทธิ์ · E directory และชื่อไฟล์ · F ผู้ใช้ nobody, setgid · G sendfile, fsync, statfs · H ข้อจำกัด · I วงจรชีวิต mount · J หน่วยความจำรั่ว · K ลบ · L rename · N size= และ df · P /proc/fslek",
    0.5, 4.13, 9.0, 0.5, { fontSize: 10.5, color: BODY });
  chip(s, "docs/test-coverage.md", 0.5, 4.75, { fontSize: 10.5, h: 0.26 });
  text(s, "ตารางระดับฟังก์ชัน: เคสไหนครอบโค้ดบรรทัดไหน", 2.95, 4.75, 6.5, 0.26, { fontSize: 10.5, color: MUTED, valign: "middle" });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
