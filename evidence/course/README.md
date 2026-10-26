# Course Container verification

ตรวจจริงวันที่ 27 ตุลาคม 2026 หลังผู้ใช้อนุมัติเริ่ม Course Container แบบ privileged

เส้นทาง: Docker Desktop → `tuchsanai/devtools:2569_1` → dockerd ภายในกล่อง → Node test container และ Compose app container → SQLite named volume ของ inner daemon

ผล:

- Syntax server/frontend และ HTTP acceptance 9/9 ผ่าน (course-tests.tap)
- Compose build และ health check ผ่าน (course-compose.txt)
- HTTP สมัครบ้าน เพิ่มสัตว์ สร้าง/รับ/ปิดงาน และปิดซ้ำได้ 409 ผ่าน
- SQLite online backup + integrity check + เทียบ task states ผ่าน
- หลัง force-recreate: session เดิมใช้ได้ งาน note และ completion audit หนึ่งรายการยังอยู่
- Logout ทำให้ session ใช้ต่อไม่ได้
- Inner Compose ถูก down โดยคง volume และ outer container `pawroster-course-check` ถูก stop หลังคัดลอกหลักฐาน ไม่มี port ของ outer container เผยแพร่ไป host

ดู course-smoke.txt, course-logs.txt, course-engine.txt และ course-image.txt ประกอบ ผล Browser เดิมมาจาก Docker Desktop โดยตรง รอบ Course Container นี้ตรวจ HTTP ไม่ได้ตรวจ UI ผ่าน forwarded port

รุ่นตรวจ: source ชุดส่งมอบถูก copy แบบอ่านอย่างเดียวเข้ากล่อง แล้วคัดลอกเข้า working directory และสร้าง local Git snapshot อัตโนมัติ ชื่อ commit คือ `Generated source snapshot for course verification, not team history` SHA อยู่ใน course-commit.txt; course-worktree.txt ว่างหมายถึงสะอาดตอนเริ่มตรวจ ไม่ได้ clone repository จริงของทีม ไม่ใช่หลักฐานการมีส่วนร่วมของสมาชิก เอกสารผลตรวจถูกอัปเดตภายหลัง snapshot; runtime source ตรงกับรุ่นที่ตรวจ

ทำซ้ำจาก repository ทีม: checkout commit รุ่นส่ง ภายในกล่องที่อนุมัติ → `sh scripts/course-verify.sh` เก็บ evidence/runtime/ และอ้าง commit นั้นจริง Jenkins ยังต้องเชื่อมและรันเป็นอีกขั้นตอนหนึ่ง
