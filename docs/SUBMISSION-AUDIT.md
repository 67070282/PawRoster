# รายการตรวจชุดส่ง PawRoster 2.2

## ผลตรวจปัจจุบัน รุ่น 2.3.0 / schema 5

Source ฟีเจอร์ที่ตรวจ: `f63e1964790fd3fc453a59bd42996e68bec56d16` ใช้ข้อมูลสังเคราะห์ แยกฐานข้อมูลทดสอบจากข้อมูลใช้งานจริง Acceptance tests ผ่าน **37 กรณี (38 TAP records รวม parent), fail 0** บน Windows และ Linux ภายใน image อาจารย์ เพิ่ม H1–H5 สำหรับลบบ้าน การรักษาบัญชีและบ้านอื่น การยืนยัน/สิทธิ์ การ rollback และ migration 4→5 ผล Browser QA และ Course Docker-in-Docker อยู่ใน [หลักฐานรุ่น 2.3](../evidence/home-deletion/README.md)

| Requirement | ผลและหลักฐาน |
|---|---|
| ลบบ้านที่มีเจ้าของและสมาชิกย้ายออกทั้งหมด | H1 / UI: ทั้งสองบัญชียังเข้าบ้านปลายทางและเห็นข้อมูลเดิมได้ |
| คงบัญชีเมื่อไม่มีบ้านเหลือ | H3 / UI: session ใช้ได้ เปิดสร้าง/เข้าร่วมบ้านได้ และ login ใหม่ได้ |
| เฉพาะ owner และต้องยืนยันบ้าน | H2 / UI: member ถูกปฏิเสธ ชื่อ/บ้าน/รหัสค้างถูกปฏิเสธ ไม่มีการเขียนข้อมูล |
| ลบอย่างครบถ้วนและ rollback | H1/H4: ลบข้อมูลเฉพาะบ้านเป้าหมาย foreign keys ถูกต้อง และจำลองล้มเหลวแล้วข้อมูลทุกตารางคงเดิม |
| อัปเกรดข้อมูลเดิม | H5 และ migration fixtures รุ่น 1/2/3: schema 5 คงบัญชี credential session และสมาชิกภาพ |
| ฟีเจอร์เดิม | R1–R8, M1–M9, C1–C9, S1–S6 ผ่านในชุด 2.3 เดียวกัน |

## ผลย้อนหลังและรายละเอียดวิธีตรวจรุ่น 2.2

ข้อมูลด้านล่างเป็นผลจริงของรอบ 2.2 ตาม source/build ที่ระบุ ไม่ใช่หลักฐานว่า Jenkins build เดิมตรวจ source 2.3 แล้ว การทำงาน pipeline ยังใช้ Jenkinsfile ชุดเดิม และผลใหม่อ้างตาม build/source ใน evidence เท่านั้น


ตรวจวันที่ 13 พฤศจิกายน 2569 ขอบเขตการประเมินคือระบบที่ทำงานได้จริงและการส่งมอบด้วย DevTools โดยใช้ข้อมูลสังเคราะห์

อ้างอิง [ข้อกำหนดโครงงาน](https://github.com/Tuchsanai/DevTools/tree/main/Mini_Project/project-details) และอ่านผลพร้อม source commit ที่ระบุในแต่ละหลักฐาน

| ส่วนส่งมอบ | รายการที่ตรวจ | ผล/เอกสาร |
|---|---|---|
| รายงานโครงงาน | ปัญหา ผู้ใช้ Solution ขอบเขต ผลเชิงระบบและข้อจำกัด | PROJECT.md |
| ผู้จัดทำ | รายชื่อและรหัสประจำตัวครบ 4 คน | PROJECT.md |
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
| เอกสาร/Bootstrap ปัจจุบัน | ตรวจ branch, auth และการเริ่ม Jenkins แยก พร้อม backup export | [current-files-qa](../evidence/current-files-qa/README.md) |
| การเปิดเผยเครื่องมือ | ระบุการใช้ OpenAI Codex ตามจริง | README.md |

รายงานผลละเอียด: [RESEARCH.md](RESEARCH.md) หลักฐาน CI/CD ย้อนหลังรุ่น 2.2: [evidence/submission-2.2](../evidence/submission-2.2/README.md)

ผลที่ยืนยันเป็นการทำงานของระบบในสถานการณ์ทดสอบ ไม่ใช่ผลสุขภาพสัตว์หรือสถิติประโยชน์ของประชากร และไม่ใช่การรับรองความปลอดภัยครบทุกด้าน การให้คะแนนเป็นไปตามดุลยพินิจและเงื่อนไขรายวิชา
