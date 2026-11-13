# รายการตรวจชุดส่ง PawRoaster

ตรวจวันที่ 13 พฤศจิกายน 2569 ใช้ข้อมูลสังเคราะห์ ผลจริงและ source อ้างอิงอยู่ใน [RESEARCH](RESEARCH.md)

| ส่วนส่งมอบ | รายการ | ผล/แหล่งตรวจ |
|---|---|---|
| รายงานโครงงาน | ปัญหา ผู้ใช้ Solution ขอบเขต ผลเชิงระบบ และข้อจำกัด | [PROJECT](PROJECT.md) |
| ผู้จัดทำ | รายชื่อและรหัสประจำตัวครบ 4 คน | PROJECT ไม่มีการแต่งหน้าที่สมาชิก |
| Requirement | เชื่อม implementation กับ acceptance tests | [TRACEABILITY](TRACEABILITY.md) |
| ระบบจริง | HTML/JS, Node.js API และ SQLite ทำงานร่วมกัน | HTTP และ Browser QA ผ่าน |
| Tests | R1–R8/M1–M9/C1–C9/S1–S6/H1–H5 | 37 กรณี; 38 TAP records รวม parent; fail 0 บน Windows/Linux |
| หลายบ้านและสมาชิก | สลับบ้าน role บล็อก/ปลดบล็อก หมุนรหัสและลบบ้าน | M/S/H ผ่าน บัญชีและบ้านอื่นยังอยู่ |
| สมุดบันทึกและปฏิทิน | ประวัติ น้ำหนัก นัดหมาย และการกรองข้อมูล | C และ Browser QA ผ่าน |
| Docker/Compose | Build, healthy, named volume และ recreate | [Course smoke](../evidence/home-deletion/course-smoke.txt) |
| Jenkins | main #10 ครบ Verify/Build/Publish/Deploy/Verify service | [หลักฐาน](../evidence/task-completion/main-10/README.md) |
| Source/revision | บริการตรง commit ที่ตรวจ | health และ commit ของ build เดียวกัน |
| สำรอง/อัปเกรด | Online backup, integrity, persistence, migration | ตรวจสำเนาและข้อมูลหลัง upgrade; backup เก็บส่วนตัว |
| Git/GitHub | Branch/commit/PR และไม่มี DB/secret ใน source | [GITHUB](GITHUB.md), secret scan |
| วิธีเปิด | Course Container ผ่าน SSH และ inner Docker | บนสุด [README](../README.md) |
| ภาพหน้าจอ | หน้าระบบที่ตรวจด้วยข้อมูลสาธิต | [SCREENSHOTS](SCREENSHOTS.md) |
| การใช้ AI | Codex ช่วยวิเคราะห์ พัฒนา ทดสอบและจัดทำเอกสาร | สรุปใน README และรายงาน |

ชื่อรายงานคือ PawRoaster ส่วน repository/คำสั่งยังใช้ที่อยู่จริง `67070282/PawRoster` เลข package/schema และหลักฐานตามรุ่นใช้สำหรับตรวจสอบทางเทคนิค การประเมินใช้ข้อมูลสังเคราะห์ ไม่มีผลสัมภาษณ์หรือทดลองผู้ใช้จริง
