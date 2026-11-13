# รายการตรวจชุดส่ง PawRoster 2.2

ตรวจวันที่ 13 พฤศจิกายน 2569 ขอบเขตการประเมินคือระบบที่ทำงานได้จริงและการส่งมอบด้วย DevTools โดยใช้ข้อมูลสังเคราะห์

อ้างอิง [ข้อกำหนดโครงงาน](https://github.com/Tuchsanai/DevTools/tree/main/Mini_Project/project-details) และอ่านผลพร้อม source commit ที่ระบุในแต่ละหลักฐาน

| ส่วนส่งมอบ | รายการที่ตรวจ | ผล/เอกสาร |
|---|---|---|
| รายงานโครงงาน | ปัญหา ผู้ใช้ Solution ขอบเขต ผลเชิงระบบและข้อจำกัด | PROJECT.md |
| ผู้จัดทำ | รายชื่อและรหัสประจำตัวครบ 4 คน | PROJECT.md / PRESENTATION.md |
| Requirements | เชื่อม acceptance criteria กับ implementation และผลตรวจ | TRACEABILITY.md |
| Web/Backend/Database | ใช้ระบบจริง HTML/JS → Node.js → SQLite | HTTP tests และ Browser QA ผ่าน |
| Automated tests | R1–R8/M1–M9/C1–C9/S1–S6 รวม 32 กรณี | Windows/Linux ผ่าน; TAP 33 รวม Parent, fail 0 |
| Docker/Compose | Build/healthy, named volume, online backup และ recreate | Course verification ผ่าน |
| Course Container | SSH เข้า image อาจารย์และใช้ Docker daemon ภายใน | source 4d319e8 ตรวจครบ; evidence/household-security |
| Git/GitHub | source, feature branches, commit และ PR ที่ตรวจย้อนหลังได้ | GITHUB.md และ GitHub PR history |
| Jenkins main | ตรวจ source ถึง publish/deploy และ revision health/smoke | main #1 SUCCESS ที่ 00ad184 |
| Jenkins feature/failure gate | feature ข้าม deploy; test ล้มเหลวหยุดส่งมอบ | review #1/#3 SUCCESS / #2 expected FAILURE |
| Security | สิทธิ์แยกบ้าน รหัสเก่าใช้ไม่ได้ บล็อก/ปลดบล็อกและพักรับสมาชิก | S1–S6, SECURITY.md |
| เอกสารเปิดโครงงาน | วิธีหลักใน image อาจารย์และทางเลือก Docker บนเครื่องหลัก | README.md อยู่บนสุดของ repository |
| เอกสารนำเสนอ | สไลด์ 10 หน้าและลำดับ Demo | presentation/index.html / PRESENTATION.md; QA ผ่าน 10 หน้า |
| การเปิดเผยเครื่องมือ | ระบุการใช้ OpenAI Codex ตามจริง | README.md |

รายงานผลละเอียด: [RESEARCH.md](RESEARCH.md) หลักฐาน CI/CD ล่าสุด: [evidence/submission-2.2](../evidence/submission-2.2/README.md)

ผลที่ยืนยันเป็นการทำงานของระบบในสถานการณ์ทดสอบ ไม่ใช่ผลสุขภาพสัตว์หรือสถิติประโยชน์ของประชากร และไม่ใช่การรับรองความปลอดภัยครบทุกด้าน การให้คะแนนเป็นไปตามดุลยพินิจและเงื่อนไขรายวิชา
