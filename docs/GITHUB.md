# GitHub repository และสถานะการเผยแพร่

ชื่อ repository ที่เตรียม: **PawRoster** บัญชีที่ยืนยันผ่านตัวเชื่อม GitHub: **67070282**

Repository: [67070282/PawRoster](https://github.com/67070282/PawRoster) · **Private** · default branch `main`

สร้าง repository ผ่านหน้าเว็บ GitHub ในบัญชีที่ผู้ใช้เข้าสู่ระบบ แล้วเผยแพร่ไฟล์ผ่านตัวเชื่อม GitHub โค้ดเป็น baseline ที่ Codex ช่วยเตรียม ไม่ fork โค้ดหรือประวัติของเพื่อน และไม่อ้างว่าเป็นผลงานร่วมที่สมาชิกทำเสร็จแล้ว ห้ามส่ง token หรือรหัสผ่านผ่านแชต

ประวัติใน GitHub เป็นประวัติหลักสำหรับพัฒนาต่อ ส่วน Git bundle ที่เคยส่งให้เป็น local snapshot ก่อนเผยแพร่และมี commit SHA ต่างกัน ให้ clone repository GitHub ใหม่ก่อนทำงานร่วมกัน ไม่ push local snapshot ทับ main

## ขั้นตอนสำหรับทีมหลังเผยแพร่

1. เชิญ GitHub username จริงของสมาชิกทั้ง 4 คน ไม่ใช้รหัสนักศึกษาเดาว่าเป็น username
2. ตั้ง issue แยกตาม requirement และเลือกผู้รับผิดชอบจริง
3. ใช้ branch + PR และ review ก่อน merge main
4. เชื่อม Jenkins Multibranch Pipeline กับ URL repo และ credentials ที่ถูกต้องตาม OPERATIONS.md
5. เก็บ build URL, commit SHA และผล post-deploy health check
6. Tag รุ่นส่งและตรวจ commit เดียวกันใน Course Container

ถ้าเป็น private repository ให้เชิญอาจารย์/TA ด้วยบัญชีที่ถูกต้องหรือทำตามช่องทางส่งงานที่ผู้สอนกำหนด ถ้าเลือก public ชื่อและรหัสนักศึกษาใน README/Proposal จะเปิดให้ทุกคนอ่านได้

## ตัวอย่างที่ใช้ศึกษาแนวทาง

[PawFeed ของอีกกลุ่ม](https://github.com/67070119/PawFeed) ใช้เป็นตัวอย่างการจัด source, docs, tests และหลักฐานใน repository ไม่ได้คัดลอก implementation หรือประวัติ commit ของกลุ่มนั้น และไม่ใช้จำนวน test/commit ของกลุ่มอื่นเป็นคำกล่าวอ้างของ PawRoster
