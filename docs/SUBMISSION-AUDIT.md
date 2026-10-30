# ตรวจความครบถ้วนตามกติกา

แหล่งกติกา https://github.com/Tuchsanai/DevTools/tree/main/Mini_Project/project-details#traceability ตรวจวันที่30ตุลาคม2026

| ข้อกำหนด | สิ่งที่มี | สถานะหรือสิ่งที่ยังต้องทำ |
|---|---|---|
| Problem และ evidence | สมมติฐานเฉพาะกลุ่มผู้เลี้ยงหลายคน + แบบสัมภาษณ์ | ยังไม่มีผลสัมภาษณ์ ตามที่เจ้าของแจ้ง |
| Target users/use case/ขอบเขต | PROJECT.md และ flow หลัก | มี baseline และข้อจำกัด |
| Traceability | TRACEABILITY.md ครบ6คอลัมน์ เชื่อมปัญหาไปผลตรวจ | อัปเดตผลตาม evidence รุ่นสุดท้าย |
| Web+Backend+Database จริง | HTML/JS → Node HTTP → SQLite | มีระบบและ HTTP/UI evidence |
| Git/GitHub | repository, branch, commit, PR templates | เพิ่ม PR รอบแก้จริง; สมาชิกต้องร่วมงานจริงต่อ |
| Docker/Compose | image, volume, health, config | ทดสอบ commit ใหม่ใน Course Container |
| Jenkins CI/CD | Jenkinsfile และ bootstrap พร้อม auth/registry | ตรวจ job จริงและ failure gate ในรอบนี้ |
| System Design/Integration | ARCHITECTURE.md / API / schema / failures | เพิ่มรายละเอียด registry/SCM/commit verification |
| Security/Privacy/Operations | session, home authorization, validation, CSP, backup | เพิ่ม tracked-secret scan; ไม่มี public production hosting |
| Course Container | มีรอบเก่าแบบ source snapshot | รันทดสอบจาก clone commit GitHub จริงและเก็บSHA |
| Slide ครบ7มิติ | PRESENTATION.md พร้อมลำดับ10นาที | เป็นเนื้อหาสไลด์ ต้องจัดสไลด์และซ้อมจริง |
| Team/Network | รายชื่อ4คน | เจ้าของจะเติมหน้าที่/Section/กลุ่มภายหลัง; ไม่อ้าง partner |
| Social impact | นิยาม baseline/เป้าหมาย/วิธีเก็บ | ต้องทดลองและรายงานผลจริง |
| Sustainability/advantage | สมมติฐานผู้สนับสนุนและ roadmap | ยังไม่มี willingness-to-pay หรือ advantage ที่ยืนยัน |
| AI disclosure/ownership | README/CONTRIBUTING | ทีมต้องทบทวนและอธิบาย/แก้โค้ดได้จริง |

**ยังไม่สามารถระบุว่าครบทุกอย่างสำหรับส่งได้** จนกว่าจะมีผลผู้ใช้จริง ข้อมูลทีม และการนำเสนอ/ownership ของสมาชิก แม้งานระบบและ DevTools จะทำผ่านแล้วก็ตาม ไม่มีการสร้างหลักฐานการทดลองหรือ teamwork ย้อนหลัง

ไม่ถือเครื่องมือทางเลือก เช่น Kafka/RabbitMQ/Grafana/Kubernetes/LLM เป็นสิ่งที่ต้องใส่เพิ่มทั้งหมด กติกาประเมินเหตุผล ความถูกต้องและหลักฐานตามความจำเป็นของระบบ
