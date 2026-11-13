> ประวัติการตรวจตามวันที่และ commit ในเอกสารนี้ หลักฐานรุ่นปัจจุบันดู [แผนที่หลักฐาน](../README.md)

# PawRoster 2.0 — ผลตรวจในกล่องอาจารย์ผ่าน SSH

วันที่ตรวจ: 12 พฤศจิกายน 2026

## สภาพแวดล้อมและรุ่นที่ตรวจ

- กล่องภายนอกสร้างด้วย `docker run -dit --name devtools --privileged -p 2222:22 tuchsanai/devtools:2569_1`
- เข้าใช้งานจริงด้วย SSH `root@localhost -p 2222` และรันคำสั่งโครงงานจากภายใน SSH
- Clone จาก GitHub `main` ที่ Commit **37363816800e2a1db93c9cb91430853b561d0b18**
- [สถานะ Working tree](course-worktree.txt) ว่างก่อนเริ่มทดสอบ: ไม่มีการแก้ไข Source code ในกล่อง
- รัน `sh scripts/course-verify.sh` ด้วย Docker daemon ภายใน devtools; Exit code = 0

## ผลตรวจ

| รายการ | ผลและหลักฐาน |
|---|---|
| HTTP acceptance tests | ผ่าน 17 กรณี R1–R8 และ M1–M9; TAP รวม 18 รายการเมื่อรวม Parent: [course-tests.tap](course-tests.tap) |
| Build และ Health | สำเร็จ; [Health](course-health.json) แสดง version 2.0.0 และ Revision ตรง Commit ที่ Clone |
| ระบบหลายบ้าน | สร้างบ้านเพิ่ม เข้าร่วมด้วยบัญชีเดิม สลับบ้าน และแยกข้อมูลได้ |
| งานซ้ำ | ทำงานเสร็จแล้วเกิดรายการถัดไปหนึ่งรายการ |
| สำรองข้อมูล | Online backup, Integrity และการเทียบสถานะข้อมูลผ่าน |
| Persistence | หลัง Force-recreate ยังมี Session, Membership, บ้านที่เลือก, งาน, หมายเหตุ และ Audit |
| ถอนสิทธิ์ | นำสมาชิกออกแล้วเข้าบ้านเดิมไม่ได้; Logout ทำให้ Session ใช้ไม่ได้ |
| เว็บผ่าน SSH tunnel | เปิดเครื่องหลักที่พอร์ต 3083 ส่งไปยัง loopback:3080 ภายใน devtools; UI สมัครบ้าน เพิ่มสัตว์ สร้างงาน รับงาน และบันทึกเสร็จผ่าน |

ผล Flow และการคงข้อมูล: [course-smoke.txt](course-smoke.txt) · Commit: [course-commit.txt](course-commit.txt) · วิธีเข้ากล่อง: [course-access.txt](course-access.txt)

หลักฐานนี้ยืนยันรุ่นที่ระบุ ไม่ใช่ผลรัน Jenkins รุ่น 2.0 และไม่ใช่ผลการศึกษากับผู้เลี้ยงจริง การเพิ่มรายงานและคู่มือภายหลังไม่เปลี่ยนโค้ดแอปที่ตรวจใน Commit นี้

วิธีทำซ้ำ: [RUN-IN-COURSE.md](../../docs/RUN-IN-COURSE.md)
