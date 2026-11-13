# Requirement baseline และ Traceability

วันที่ทบทวน 12 พฤศจิกายน 2026 รุ่น 2.0 รองรับหลายบ้าน บทบาทสมาชิก และงานซ้ำ ผล R1–R8 ตรวจซ้ำในรุ่น 2.0; หลักฐาน Course Container และ Jenkins ในตารางเดิมเป็นประวัติรุ่น 1.0 ผลตรวจรุ่นใหม่แยกใน evidence/v2/ ไม่รวม LLM การรักษา อีเมล หรือ Push notification

ปัญหาที่ตั้งสมมติฐาน: บ้านที่มีหลายผู้ดูแลไม่มีสถานะร่วมว่าใครรับ/ทำงานแล้ว กลุ่มหลักคือผู้เลี้ยงหลายคนในบ้านเดียวกัน ผลที่ต้องการของระบบคือแสดงผู้รับผิดชอบและประวัติรายการเดียวกันได้ถูกต้อง ผลต่อการลืมงานต้องทดลองกับคนจริงก่อนอ้าง

| Requirement หรือคำกล่าวอ้าง | ผู้ใช้หรือสถานการณ์ | Acceptance Criteria | ส่วนที่นำไปใช้ | วิธีตรวจและหลักฐาน | สถานะและข้อจำกัด |
|---|---|---|---|---|---|
| R1 สมัครและเข้าใช้ระบบ | สมาชิกบ้าน | หลังสมัคร/login ได้ session, ไม่ login ได้ 401, รหัสผิดไม่ผ่าน, cookie HttpOnly/SameSite | server.js register/login/auth, users/sessions | test/system.test.js R1; evidence/course และผล Jenkins | ตรวจผ่าน runtime baseline; ไม่มี password reset |
| R2 สร้างและแชร์ข้อมูลบ้าน | สมาชิกสองคนในบ้านเดียวกัน | รหัส invite ถูกต้องจึงเข้าบ้าน; pet/task สร้างแล้วสมาชิกอีกคนอ่านรายการเดียวกัน | homes/pets/tasks, dashboard API + public/app.js | HTTP R2 และ UI scenario ใน PRESENTATION.md | รองรับหลายบ้านตาม M1/M2; ไม่มี invite expiry อัตโนมัติ |
| R3 รับงานได้คนเดียว | สมาชิกสองคนกดพร้อมกัน | HTTP status ต้องเป็น 200 หนึ่งคำขอและ 409 อีกคำขอ; มี claim audit ครั้งเดียว | BEGIN IMMEDIATE + state validation | HTTP R3 ที่ assert สถานะจริง; Jenkins tests.xml | ตรวจตามโค้ดรุ่นใหม่; ไม่กันการสร้างสองรายการที่ความหมายเหมือนกัน |
| R4 ปิดหรือคืนงานตามสิทธิ์ | ผู้รับงานและสมาชิกอื่น | ผู้รับงานเปลี่ยนได้, คนอื่นได้ 403, ปิดซ้ำ 409, note/audit ตรง | task transitions + events transaction | HTTP R4, deployed smoke | ตรวจผ่าน baseline; สถานะ done เปิดกลับไม่ได้ |
| R5 แยกข้อมูลแต่ละบ้าน | บัญชีบ้านอื่นเดา ID | ไม่เห็นข้อมูล และแก้ไขผ่าน ID ไม่ได้; Browser cross-origin mutation ได้ 403 | home_id authorization, Origin validation | HTTP R5 + failure-case demo | สิทธิ์ตาม membership และ owner/member ดู M2–M5 |
| R6 จัดการ input และป้องกัน injection | ผู้ใช้ส่งข้อมูลผิด | ว่าง/JSONเสีย/วันเวลาไม่ถูกต้อง/เกิน16KB ถูกปฏิเสธ; SQL text ไม่กลายเป็นคำสั่ง | parameterized SQL, body limit, field validation, CSP | HTTP R6; secret-scan แยกตรวจ tracked files | ตรวจผ่าน; secret scan เป็น pattern baseline ไม่ครอบคลุม secret ทุกชนิด |
| R7 ข้อมูลคงอยู่ | service/container restart | งาน note และ audit เดิมยังอยู่; session เดิมใช้ได้ก่อนหมดอายุ | SQLite named volume | HTTP R7, scripts/course-verify.sh + course-smoke.txt | ตรวจผ่าน baseline; หนึ่ง instance, local volume |
| R8 ออกจากระบบ | สมาชิกออกจากระบบ | cookie/session เก่าไม่เข้าถึง dashboard | logout + session deletion | HTTP R8, deployed smoke verify | ตรวจผ่าน |
| N1 เริ่มระบบซ้ำได้ | ผู้ตรวจ checkout โค้ด | Compose build/start healthy; /health ตอบ revision ตรง commit ที่ build | Dockerfile, compose.yaml, /health | evidence/course-main; Jenkins artifacts/main-pass commit/health/image-digest | PASS commit8686628; หากเปลี่ยนระบบภายหลังต้องตรวจรุ่นส่งอีกครั้ง |
| N2 ส่งมอบด้วย Jenkins | main/feature branch และ regression | checkout GitHub จริง, verify ก่อน build/publish; main เท่านั้น deploy; health+smoke ผ่าน; failing test ต้องหยุดก่อน deploy | Jenkinsfile + jenkins/ | evidence/jenkins: main #4 และ artifacts/main-pass; review #4; failure #3 | PASS main #4 ครบเส้นทางและ revisionตรงcommit; SCM polling ไม่ใช่ webhook |
| N3 สำรองและกู้คืน | ผู้ดูแลระบบ | backup integrity_check=ok; จำนวนและสถานะงานตรงต้นฉบับ | backup.mjs + verify-storage.mjs | course-smoke.txt และ ops-check.txt | ตรวจผ่าน baseline; ต้องเก็บ backup ส่วนตัว |
| G1 Git workflow | ผู้พัฒนาส่งการแก้ไข | branch/commit/PR ที่ review ได้และเชื่อม requirement; ไม่มี secret ใน tracked files | GitHub + CONTRIBUTING + templates | PR ของการตรวจรอบนี้ และ Git log | ไม่ใช่หลักฐานว่าสมาชิกทั้ง4ทำงานแล้ว |
| U1 ปัญหาและผลจากคนจริง | ผู้เลี้ยงหลายคน | เก็บ consent และบันทึกวิธีเก็บ/ขนาดตัวอย่าง; เทียบ baseline กับ trial ตามนิยามเดียวกัน | docs/RESEARCH.md | แบบสัมภาษณ์/ทดสอบที่เตรียม; ยังไม่มีผลจริง | PENDING USER STUDY เจ้าของแจ้งว่ายังไม่ทดลอง |

## ส่วนเพิ่มเติมในรุ่น 2.0

| Problem / Requirement ID | ผู้ใช้/สถานการณ์ | Acceptance Criteria ที่สังเกตได้ | Implementation | วิธีทดสอบ/หลักฐาน | สถานะ/ข้อจำกัด |
|---|---|---|---|---|---|
| M1 หลายบ้านต่อบัญชี | ผู้มีบัญชีได้รับคำเชิญจากบ้านอื่น | Join ด้วยบัญชีเดิมแล้วสลับบ้านได้ ข้อมูลไม่ปะปน และ Session อื่นไม่ถูกเปลี่ยนตาม | memberships, sessions.active_home_id, homes APIs | multi-home.test.js M1; UI บ้านเดิม/บ้านเพื่อน | ผ่าน; Cookie เดียวกันใช้ Session ร่วมกัน |
| M2 สิทธิ์และรหัสเชิญ | เจ้าของบ้านจัดการการเข้าร่วม | Member ดู/เปลี่ยนรหัสไม่ได้ รหัสเดิมเข้าร่วมไม่ได้หลัง Rotate | role checks, invite rotation | M2 | ผ่าน; ไม่มี Expiry อัตโนมัติ |
| M3 ถอนสมาชิก | สมาชิกมีงานที่รับค้าง | เข้าถึงบ้านเดิมไม่ได้ งานกลับ open พร้อม Audit; บัญชียังสร้างบ้านใหม่ได้ | releaseMember, session invalidation | M3 | ผ่าน; สมาชิกอาจกลับเข้าร่วมด้วยรหัสที่ยังใช้ได้ |
| M4 โอนสิทธิ์/ออกจากบ้าน | เจ้าของบ้านต้องการออก | โอนให้สมาชิกในบ้านเท่านั้น จากนั้นออกได้โดยยังมีบ้านอื่น | transfer/leave endpoints | M4 | ผ่าน; ไม่รองรับลบบ้าน |
| M5 ป้องกันแท็บเก่า | สลับบ้านใน Session เดียว | คำขอพร้อม X-Home-ID ของบ้านเก่าได้ 409 และไม่เขียนข้อมูล | home header check, reauthorization after body | M5 | ผ่าน; Client เก่าไม่ส่ง Header ต้องอัปเดตหน้าเว็บ |
| M6 แก้ไข/ยกเลิกงาน | ผู้สร้างงาน/เจ้าของบ้าน | แก้เฉพาะ open; ยกเลิกงานไม่เสร็จ; สมาชิกอื่นได้ 403; คงประวัติ | created_by, priority, cancelled_at, audit | M6; UI แก้ไข/ยกเลิกและตัวกรอง | ผ่าน; Done ไม่เปิดกลับ |
| M7 งานซ้ำ | งานรายวัน/รายสัปดาห์ | Complete สร้างครั้งถัดไปหนึ่งรายการ ปิดซ้ำไม่สร้างเพิ่ม | recurrence inside transaction | M7; UI งานวันที่ถัดไป; Docker smoke | ผ่าน; นับจาก due เดิม ไม่ใช่ Scheduler |
| M8 ข้อมูลสัตว์เลี้ยง | ผู้ดูแลบันทึกข้อควรทราบ | แก้ไขได้เฉพาะบ้านตน เก็บประวัติเมื่อไม่มีงานค้าง และนำกลับได้ | pets notes/archive/edit | M8; UI สัตว์เลี้ยง | ผ่าน; ไม่มีอัปโหลดภาพ |
| M9 Migration | ใช้ข้อมูลรุ่น 1.0 ต่อ | Session/งานเดิมยังอยู่; earliest member เป็น Owner; Membership ที่ออกแล้วไม่กลับหลัง restart | atomic schema v2 migration | M9; สำรองข้อมูลก่อนเปิดรุ่นใหม่ในเครื่อง | ผ่าน; Rollback ใช้ Backup ก่อน Migration |

ขอบเขตรุ่น 2.0 เพิ่มจากปัญหาการเข้าร่วมบ้านภายหลังสมัครตามคำขอผู้จัดทำ ผลผู้ใช้จริงยังอยู่ระหว่างเก็บข้อมูลตาม U1

## ส่วนเพิ่มเติมรุ่น 2.1

| Requirement | ผู้ใช้/สถานการณ์ | Acceptance Criteria | Implementation | Test/Evidence | ข้อจำกัด |
|---|---|---|---|---|---|
| C1 ลบ/กู้คืนสัตว์เลี้ยง | เจ้าของบ้านลบรายการ | ยืนยันชื่อ, member/บ้านอื่นทำไม่ได้, ยกเลิกงานค้าง, คงประวัติและกู้คืนได้ | pets.deleted_at + transaction + events | pet-care.test.js C1; UI trash/recovery | ไม่มีลบสัตว์เลี้ยงถาวร |
| C2 ข้อมูลประจำตัว | ผู้ดูแลแก้ข้อมูล | สายพันธุ์ เพศ วันเกิดที่เป็นวันที่จริง | petFields + migration | C2; UI profile | ไม่รวมอัปโหลดภาพ |
| C3 สมุดบันทึกและสิทธิ์ | หลายสมาชิก/หลายบ้าน | สร้าง/แก้/ลบตามสิทธิ์และไม่ข้ามบ้าน | pet_records APIs | C3; UI CRUD/CSV | ลบบันทึกแต่ละรายการถาวร |
| C4 Validation | ส่งข้อมูลผิด | ปฏิเสธน้ำหนัก/วัน/ประเภทผิด และข้อความเกินกำหนด | recordFields | C4 | ไม่มีคำแนะนำทางการแพทย์ |
| C5 นัดหมายและคงข้อมูล | ผู้ดูแลนัดครั้งถัดไป | เสร็จ/เปิดกลับได้ เปลี่ยนนัดรีเซ็ต และอยู่หลัง restart | due_at/resolved_at | C5; ปฏิทินและ Docker smoke | ไม่มี Push/email |
| C6 มอบหมาย | เจ้าของบ้านเลือกผู้ดูแล | เฉพาะ owner เลือกสมาชิกบ้านเดียวกัน งาน open และ audit ครั้งเดียว | assign transition | C6; UI owner/member | ไม่มีขั้นตอนตอบรับคำขอ |
| C7 Migration | ฐานข้อมูล schema 2 | คง session/สัตว์/งาน/ประวัติและเพิ่ม schema 3 | versioned migration | C7 | rollback ใช้ backup ก่อนอัปเกรด |
| U2 ปฏิทิน/มือถือ | ผู้ดูแลวางแผน | เดือน/วันถูกต้อง งานและนัดตามตัวกรอง สร้างงานในวันที่เลือก ไม่ล้น 390px | renderCalendar + UI forms | browser QA, evidence/v2.1 | แสดงเฉพาะงานซ้ำที่สร้างแล้ว |

## ส่วนเพิ่มเติมรุ่น 2.2

| ความต้องการ | ผลและหลักฐาน | Tests |
|---|---|---|
| เปลี่ยนรหัสแล้วรหัสเก่าใช้ไม่ได้ | ตรวจทั้ง register และ join โดยไม่ตัดสมาชิกเดิม | S1 |
| นำสมาชิกออกอย่างปลอดภัย | ตัดสิทธิ์ทุก session ในบ้าน บล็อกการกลับเข้า เปลี่ยนรหัส และคืนงาน | S2 |
| เจ้าของจัดการการเข้าร่วม | ปลดบล็อก พัก/เปิดรับสมาชิก และ owner-only audit | S3–S4 |
| ข้อมูลต้องคงสภาพเมื่อผิดพลาด | Rollback ทั้งชุด; Migration และ Persistence | S5–S6 |

ชุดปัจจุบัน 32 กรณี (33 TAP records รวม Parent) หลักฐานก่อนหน้าใช้กับรุ่นที่ระบุ ไม่มีผลสัมภาษณ์หรือทดลองกับผู้ใช้จริงเพิ่มจากการตรวจนี้
