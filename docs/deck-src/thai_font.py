"""ตั้งฟอนต์ complex script (ใช้กับภาษาไทย) ใน theme ให้เป็นฟอนต์เดียวกับ latin

pptxgenjs เขียนแค่ <a:latin> ทำให้ PowerPoint แสดงตัวไทยด้วยฟอนต์ Thai ของ theme
(Angsana/Cordia) ซึ่งตัวเล็กกว่ามาก สคริปต์นี้แก้ theme*.xml ใน .pptx แบบ in-place
"""
import re
import shutil
import sys
import tempfile
import zipfile

path, font = sys.argv[1], sys.argv[2]
tmp = tempfile.mktemp(suffix=".pptx")
changed = 0
with zipfile.ZipFile(path) as zin, zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if re.match(r"ppt/theme/theme\d+\.xml$", item.filename):
            s = data.decode("utf-8")
            s, n1 = re.subn(r'<a:cs typeface="[^"]*"', f'<a:cs typeface="{font}"', s)
            s, n2 = re.subn(r'(<a:font script="Thai" typeface=")[^"]*(")', rf"\g<1>{font}\g<2>", s)
            changed += n1 + n2
            data = s.encode("utf-8")
        zout.writestr(item, data)
shutil.move(tmp, path)
print(f"thai_font: {changed} replacements")
