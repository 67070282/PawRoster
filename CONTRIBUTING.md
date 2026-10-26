# การร่วมพัฒนา PawRoster

ใช้ issue ที่ระบุ Requirement ID (R1–R8, N1–N3) และ acceptance criteria ก่อนเริ่มงาน แยก branch เช่น `feature/task-filter`, `fix/session-validation` หรือ `docs/user-study` แล้วเปิด Pull Request ให้เพื่อน review ก่อน merge main

## ก่อนเปิด PR

```sh
npm run check
npm test
docker compose config --quiet
```

ถ้าเปลี่ยน persistence, container, network หรือ business rules ให้ทดสอบที่เกี่ยวข้อง และตรวจรุ่นส่งใน Course Container ด้วย `sh scripts/course-verify.sh` บันทึกผลจริงและข้อจำกัด ถ้าเปลี่ยนพฤติกรรมที่รับปากให้อัปเดต PROJECT.md และขอ scope approval จากผู้สอนตามกติกา

## สิ่งที่ควรมีใน PR

- ปัญหาและ Requirement ID
- พฤติกรรมหลังแก้ พร้อมวิธีตรวจ
- ผลทดสอบจริง และภาพ UI เมื่อเกี่ยวข้อง
- ผลต่อ schema, deployment หรือข้อมูลเดิม ถ้ามี
- ส่วนที่ใช้ AI ช่วยและสิ่งที่ผู้รับผิดชอบ review

ใช้ชื่อผู้เขียน commit ของคนที่ทำงานจริง ไม่แยก commit เพื่อเพิ่มจำนวนหรืออ้างการมีส่วนร่วมย้อนหลัง การใช้ AI ช่วยให้ระบุใน PR และต้องอธิบายโค้ด/การตัดสินใจของส่วนตนได้

ห้ามใส่ `.env`, credentials, cookies, database, backup หรือข้อมูลผู้ทดลองจริงใน Git ใช้ข้อมูลสังเคราะห์ใน test และ screenshot รายชื่อ/รหัสนักศึกษาในเอกสารเป็นข้อมูลที่ทีมให้ไว้เพื่อส่งงาน ให้ตรวจ visibility ของ repository ก่อนเผยแพร่

ประวัติเริ่มต้นที่เตรียมโดย Codex เป็น source baseline ไม่ใช่หลักฐานการพัฒนาร่วมกัน 4 คน Jenkins deploy เฉพาะ main; เปิด branch protection/review ตามสิทธิ์และแผน GitHub ที่ทีมใช้ได้
