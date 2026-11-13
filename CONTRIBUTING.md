# การร่วมพัฒนา PawRoster

> รุ่นปัจจุบัน 2.3.0 / schema 5 เพิ่มลบบ้านโดยเจ้าของ คงบัญชีและบ้านอื่นไว้ ดู [วิธีใช้งาน](docs/CARE-FEATURES.md) และ [ผลตรวจรุ่น 2.3](evidence/home-deletion/README.md)


ใช้ issue ที่ระบุ Requirement/Acceptance Criteria และแยก branch เช่น `feature/calendar-filter`, `fix/session-validation` หรือ `docs/architecture-details` ก่อนเปิด Pull Request รายการตรวจปัจจุบันครอบคลุม R1–R8, M1–M9, C1–C9, S1–S6 และ N1–N3 ตาม [TRACEABILITY](docs/TRACEABILITY.md)

## การตรวจการเปลี่ยนแปลง

```sh
npm run check
npm test
docker compose config --quiet
node scripts/secret-scan.mjs
```

แอปรุ่น 2.2 มี 32 กรณี โดย TAP รวม Parent เป็น 33 รายการ การแก้ persistence, container, network หรือ business rules ตรวจกรณีที่เกี่ยวข้องและ Course Container ด้วย project/port/volume ทดสอบแยก ตาม [OPERATIONS](docs/OPERATIONS.md) การแก้เฉพาะเอกสารตรวจลิงก์ ภาพ แผนภาพ และความตรงกับ source โดยไม่แก้ผลทดสอบเก่าให้เป็นผลรุ่นใหม่

## ข้อมูลใน Pull Request

- ปัญหา Requirement และพฤติกรรมหลังแก้
- วิธีตรวจ ผลจริง และผลต่อ schema/deployment/data เมื่อเกี่ยวข้อง
- ภาพ UI รุ่นปัจจุบันเมื่อเปลี่ยนหน้าจอ
- การใช้เครื่องมือ AI และขอบเขตการทบทวนตามที่เกิดขึ้นจริง

ประวัติ commit ใช้ชื่อผู้เขียนตามจริง เก็บ credentials, cookies, .env, DB และ backup นอก Git ใช้ข้อมูลสังเคราะห์ใน tests และ screenshots

Jenkins deploy เฉพาะ source branch main ส่วน review เลือก feature branch ของงานที่จะตรวจ ผล build อ่านพร้อม commit และ artifact ของรอบเดียวกัน รายละเอียดความปลอดภัยอยู่ใน [SECURITY](docs/SECURITY.md)
