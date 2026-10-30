# Requirement baseline และ Traceability

วันที่ทบทวน 30 ตุลาคม 2026 ขอบเขต baseline คือระบบแบ่งงานดูแลสัตว์เลี้ยงในบ้าน ไม่รวม LLM การรักษา อีเมล push หรือ recurring tasks สถานะผลจริงอ้างถึงเอกสาร evidence ล่าสุด ไม่ถือว่า “มีไฟล์” เท่ากับ “ผ่านการตรวจ”

ปัญหาที่ตั้งสมมติฐาน: บ้านที่มีหลายผู้ดูแลไม่มีสถานะร่วมว่าใครรับ/ทำงานแล้ว กลุ่มหลักคือผู้เลี้ยงหลายคนในบ้านเดียวกัน ผลที่ต้องการของระบบคือแสดงผู้รับผิดชอบและประวัติรายการเดียวกันได้ถูกต้อง ผลต่อการลืมงานต้องทดลองกับคนจริงก่อนอ้าง

| Requirement หรือคำกล่าวอ้าง | ผู้ใช้หรือสถานการณ์ | Acceptance Criteria | ส่วนที่นำไปใช้ | วิธีตรวจและหลักฐาน | สถานะและข้อจำกัด |
|---|---|---|---|---|---|
| R1 สมัครและเข้าใช้ระบบ | สมาชิกบ้าน | หลังสมัคร/login ได้ session, ไม่ login ได้ 401, รหัสผิดไม่ผ่าน, cookie HttpOnly/SameSite | server.js register/login/auth, users/sessions | test/system.test.js R1; evidence/course และผล Jenkins | ตรวจผ่าน runtime baseline; ไม่มี password reset |
| R2 สร้างและแชร์ข้อมูลบ้าน | สมาชิกสองคนในบ้านเดียวกัน | รหัส invite ถูกต้องจึงเข้าบ้าน; pet/task สร้างแล้วสมาชิกอีกคนอ่านรายการเดียวกัน | homes/pets/tasks, dashboard API + public/app.js | HTTP R2 และ UI scenario ใน PRESENTATION.md | ตรวจผ่าน; บัญชีมีบ้านเดียว ไม่มี invite expiry |
| R3 รับงานได้คนเดียว | สมาชิกสองคนกดพร้อมกัน | HTTP status ต้องเป็น 200 หนึ่งคำขอและ 409 อีกคำขอ; มี claim audit ครั้งเดียว | BEGIN IMMEDIATE + state validation | HTTP R3 ที่ assert สถานะจริง; Jenkins tests.xml | ตรวจตามโค้ดรุ่นใหม่; ไม่กันการสร้างสองรายการที่ความหมายเหมือนกัน |
| R4 ปิดหรือคืนงานตามสิทธิ์ | ผู้รับงานและสมาชิกอื่น | ผู้รับงานเปลี่ยนได้, คนอื่นได้ 403, ปิดซ้ำ 409, note/audit ตรง | task transitions + events transaction | HTTP R4, deployed smoke | ตรวจผ่าน baseline; สถานะ done เปิดกลับไม่ได้ |
| R5 แยกข้อมูลแต่ละบ้าน | บัญชีบ้านอื่นเดา ID | ไม่เห็นข้อมูล และแก้ไขผ่าน ID ไม่ได้; Browser cross-origin mutation ได้ 403 | home_id authorization, Origin validation | HTTP R5 + failure-case demo | ตรวจผ่าน; สมาชิกบ้านเดียวกันสิทธิ์เท่ากัน |
| R6 จัดการ input และป้องกัน injection | ผู้ใช้ส่งข้อมูลผิด | ว่าง/JSONเสีย/วันเวลาไม่ถูกต้อง/เกิน16KB ถูกปฏิเสธ; SQL text ไม่กลายเป็นคำสั่ง | parameterized SQL, body limit, field validation, CSP | HTTP R6; secret-scan แยกตรวจ tracked files | ตรวจผ่าน; secret scan เป็น pattern baseline ไม่ครอบคลุม secret ทุกชนิด |
| R7 ข้อมูลคงอยู่ | service/container restart | งาน note และ audit เดิมยังอยู่; session เดิมใช้ได้ก่อนหมดอายุ | SQLite named volume | HTTP R7, scripts/course-verify.sh + course-smoke.txt | ตรวจผ่าน baseline; หนึ่ง instance, local volume |
| R8 ออกจากระบบ | สมาชิกออกจากระบบ | cookie/session เก่าไม่เข้าถึง dashboard | logout + session deletion | HTTP R8, deployed smoke verify | ตรวจผ่าน |
| N1 เริ่มระบบซ้ำได้ | ผู้ตรวจ checkout โค้ด | Compose build/start healthy; /health ตอบ revision ตรง commit ที่ build | Dockerfile, compose.yaml, /health | evidence/course-main; Jenkins artifacts/main-pass commit/health/image-digest | PASS commit8686628; หากเปลี่ยนระบบภายหลังต้องตรวจรุ่นส่งอีกครั้ง |
| N2 ส่งมอบด้วย Jenkins | main/feature branch และ regression | checkout GitHub จริง, verify ก่อน build/publish; main เท่านั้น deploy; health+smoke ผ่าน; failing test ต้องหยุดก่อน deploy | Jenkinsfile + jenkins/ | evidence/jenkins: main #4 และ artifacts/main-pass; review #4; failure #3 | PASS main #4 ครบเส้นทางและ revisionตรงcommit; SCM polling ไม่ใช่ webhook |
| N3 สำรองและกู้คืน | ผู้ดูแลระบบ | backup integrity_check=ok; จำนวนและสถานะงานตรงต้นฉบับ | backup.mjs + verify-storage.mjs | course-smoke.txt และ ops-check.txt | ตรวจผ่าน baseline; ต้องเก็บ backup ส่วนตัว |
| G1 Git workflow | ผู้พัฒนาส่งการแก้ไข | branch/commit/PR ที่ review ได้และเชื่อม requirement; ไม่มี secret ใน tracked files | GitHub + CONTRIBUTING + templates | PR ของการตรวจรอบนี้ และ Git log | ไม่ใช่หลักฐานว่าสมาชิกทั้ง4ทำงานแล้ว |
| U1 ปัญหาและผลจากคนจริง | ผู้เลี้ยงหลายคน | เก็บ consent และบันทึกวิธีเก็บ/ขนาดตัวอย่าง; เทียบ baseline กับ trial ตามนิยามเดียวกัน | docs/RESEARCH.md | แบบสัมภาษณ์/ทดสอบที่เตรียม; ยังไม่มีผลจริง | PENDING USER STUDY เจ้าของแจ้งว่ายังไม่ทดลอง |

การเปลี่ยน scope ต้องบันทึก requirement ที่เปลี่ยน เหตุผล ผลกระทบ และการยอมรับจากผู้สอนใน issue/รายงาน การลดคำกล่าวอ้างย้อนหลังไม่ทำให้ข้อผูกพันเดิมหายไป
