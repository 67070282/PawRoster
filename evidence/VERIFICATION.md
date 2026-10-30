# ผลตรวจที่เกิดขึ้นจริง

วันที่ 27 ตุลาคม 2026 (Asia/Bangkok)

| การตรวจ | ผล |
|---|---|
| Node v24.14.0 บน Windows: syntax server + frontend | PASS |
| Windows HTTP acceptance tests | PASS 9/9 (รวม parent test 1 และ subtests 8) |
| Linux node:24.14.0-alpine HTTP acceptance | PASS ดู linux-tests.tap |
| Docker Compose config/build/start + Dockerfile health check | PASS บน Docker Desktop Engine 29.8.2 |
| Browser UI: สมัคร/สร้างบ้าน/เพิ่มสัตว์/เพิ่มงาน/รับงาน/ทำเสร็จพร้อม note/กรองทั้งหมด | PASS ตรวจผ่าน in-app browser จริง |
| Browser layout | ตรวจ viewport แคบจาก side panel; ยังไม่ทดสอบทุก browser/อุปกรณ์ |
| Compose recreation + data persistence | PASS งาน 1 รายการและ audit 3 รายการยังอยู่ ดู ops-check.txt |
| Backup restore | PASS SQLite online backup, integrity_check=ok และ task states ตรงต้นฉบับ ดู ops-check.txt |
| Jenkins runtime/SCM polling/branch gate | PASS review build #4 ถูกกระตุ้นจาก SCM change, build/test/publish ผ่าน และข้าม deploy ตาม branch; failure probe #3 หยุดก่อน Build/Publish/Deploy ดู jenkins/ |
| Jenkins main deployment | PENDING รอเจ้าของอนุมัติ merge PR #1; main #1 ยังใช้ Jenkinsfile เก่าและพบ optional-plugin dependency ซึ่งแก้แล้วใน PR |
| Course Container Docker-in-Docker | PASS 9/9 tests, Compose build/health, deployed HTTP flow, duplicate rejection, backup/restore, recreation persistence และ logout ดู course/ |
| User study/impact/team contribution | NOT COLLECTED ต้องเก็บจริง |

รอบตรวจ30ตุลาคม2026: เพิ่ม evidence/course-git/ จาก clone GitHub และ checkout `3d93c7a7215671ee8bf96e939451991393985cc5` ตรงกับ Jenkins review #4 ชุดทดสอบผ่าน9/9, smoke ตรวจrevision, backupและrecreateผ่าน ภาพและผลรอบเก่ายังเก็บไว้แยก ไม่ใช้แทนการตรวจ commit ปัจจุบัน สไลด์HTML10หน้าตรวจการแสดงผลและoverflowแล้ว

ครั้งแรก Windows test ถูก sandbox ปิด localhost (EACCES); เมื่อรันโดยได้รับสิทธิ์ผ่านระบบ review แล้วผ่าน ไม่ปกปิดว่า Docker Desktop/Linux เป็นเพียงหลักฐานเสริมและไม่แทน Course Container

ต่อมาผู้ใช้อนุมัติ `--privileged` โดยตรง จึงตรวจใน `tuchsanai/devtools:2569_1` ผ่าน Docker daemon ภายในกล่อง (Engine 29.8.1) จริง Source ถูก copy เข้า filesystem ของกล่องและสร้าง Git snapshot สำหรับอ้างอิงการตรวจ โดยไม่ได้ clone GitHub ของทีม และ snapshot ไม่ใช่หลักฐาน teamwork ดูรายละเอียดใน [course/README.md](course/README.md) การตรวจรอบนี้ใช้ HTTP จริง ยังไม่ได้ตรวจ Browser ผ่าน port forwarding ของกล่อง หลังจบหยุด inner Compose และ outer privileged container แล้ว

ภาพ dashboard.png เป็นข้อมูลสังเคราะห์ “ผู้ทดสอบ/โมจิ” ใช้ตรวจ UI ไม่ใช่ผลสัมภาษณ์หรือการเลี้ยงจริง

ข้อจำกัด: ไม่มี password reset, invite rotation, member removal, role admin, pagination งาน, recurring tasks, push notification, automatic rollback หรือ multi-instance; สิทธิ์สมาชิกในบ้านเท่ากัน มีการ refresh ด้วยปุ่ม ไม่มี live sync; audit trail ไม่ใช่ immutable audit สำหรับ compliance
