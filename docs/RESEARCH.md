# การประเมินระบบและผลทดสอบ PawRoaster

วันที่รายงาน 13 พฤศจิกายน 2569

## วัตถุประสงค์และวิธีประเมิน

การประเมินตรวจความถูกต้องของฟังก์ชัน สิทธิ์ การเก็บข้อมูล และการส่งมอบซ้ำ ใช้บัญชี บ้าน สัตว์เลี้ยง งานและนัดหมายสังเคราะห์ในฐานข้อมูลทดสอบแยกจากข้อมูลใช้งาน ไม่ใช่ผลสัมภาษณ์หรือทดลองผู้ใช้จริง และไม่สรุปผลสุขภาพสัตว์เป็นตัวเลข

ใช้ HTTP acceptance tests เรียก API จริง Browser QA โต้ตอบกับหน้าจอ และ Course Docker-in-Docker ตรวจ Build/Health/HTTP flow/Backup/Persistence พร้อม Jenkins ตรวจ pipeline ตั้งแต่ source ถึงบริการ

## ระบบและ source ที่ตรวจ

| รายการ | ข้อมูล |
|---|---|
| Runtime | Node.js 24.14.0, SQLite, package 2.3.0 / schema 5 |
| Source ฟีเจอร์/API/Course | `f63e1964790fd3fc453a59bd42996e68bec56d16` |
| Source ที่ main #8 ตรวจ | `233ead1851c5224be59cf5254d50474a29ec9414` โค้ด runtime/tests ตรง source ฟีเจอร์ |
| Windows | Node.js และฐานข้อมูลชั่วคราว |
| Linux | Inner Docker ภายใน `tuchsanai/devtools:2569_1` |
| Browser | Edge/Playwright แยก context ของ owner/member/อีกบ้าน |

## HTTP acceptance tests

| กลุ่ม | กรณี | ขอบเขต | Windows | Linux ใน image อาจารย์ |
|---|---:|---|---|---|
| R1–R8 | 8 | บัญชี session งานร่วม concurrency isolation validation persistence logout | ผ่าน | ผ่าน |
| M1–M9 | 9 | หลายบ้าน สิทธิ์ การสลับบ้าน งานซ้ำ และ migration | ผ่าน | ผ่าน |
| C1–C9 | 9 | ข้อมูลสัตว์ สมุดบันทึก นัดหมาย มอบหมาย ถังขยะ กู้คืน ลบถาวร และ rollback | ผ่าน | ผ่าน |
| S1–S6 | 6 | รหัสเชิญ พักรับสมาชิก นำออก/บล็อก ปลดบล็อก ตัดสิทธิ์ และ migration | ผ่าน | ผ่าน |
| H1–H5 | 5 | ลบบ้าน คงบัญชี/บ้านอื่น ยืนยันสิทธิ์และบ้าน rollback และ schema 4→5 | ผ่าน | ผ่าน |
| รวม | **37** | **38 TAP records รวม parent, fail 0** | **ผ่าน** | **ผ่าน** |

ผลเต็ม: [Windows](../evidence/home-deletion/windows-tests.txt) / [Linux TAP](../evidence/home-deletion/course-tests.tap)

## Browser QA และภาพหน้าจอ

ตรวจ flow งาน บันทึก ปฏิทิน สัตว์เลี้ยง และสมาชิก ลบบ้านเฉพาะ owner ตรวจยกเลิก ชื่อยืนยันผิด dialog ค้าง และสถานะไม่มีบ้าน การลบบ้านสาธิตที่มีสองบัญชียังคงบ้านปลายทางและข้อมูลของทั้งสองคนไว้ ตรวจความกว้าง 320/390/1365px ไม่มี horizontal overflow และไม่พบ page errors ในรอบลบบ้าน

[ผล Browser QA](../evidence/home-deletion/ui-result.json) / [ภาพหน้าจอ](SCREENSHOTS.md) ผลการอ่านสีและ keyboard ของรอบก่อนระบุ source แยกใน evidence เดิม ไม่ใช่การรับรอง WCAG ครบทุกข้อ

## Course Container และการรักษาข้อมูล

Course verification ผ่าน syntax, Build, revision health, HTTP smoke, online backup/integrity และ force-recreate persistence ใน project/volume ทดสอบแยก หลังจบรอบหยุด service ทดสอบโดยคง volume ไว้ [ผล](../evidence/home-deletion/course-smoke.txt)

ก่อนอัปเกรด schema 5 สำรองฐานข้อมูลแอปใช้งานและ preview ไว้เป็นส่วนตัว ทดลอง migration กับสำเนา และตรวจหลังอัปเกรดว่าข้อมูลทุกตารางตรงเดิม ยกเว้น legacy users.home_id ที่นำออกตามการออกแบบ การลบบ้านเพื่อทดสอบใช้ข้อมูลสังเคราะห์เท่านั้น ไม่ลบบ้านใช้งานจริง

## Jenkins CI/CD

main build #8 สำเร็จครบ Checkout, Verify, Build image, Publish image, Deploy และ Verify deployed service ส่วน review #4/#5 สำเร็จและข้าม Deploy ตามเงื่อนไข feature branch Verify ประกอบด้วย secret scan, syntax, HTTP tests และ Compose validate ผล build/source และ health ต้องอ่านเป็นชุดเดียวกัน

[หลักฐาน main #8](../evidence/complete-project/README.md) มี JUnit, stage status, image digest, health และ deployed smoke ที่ revision ตรง `233ead1` ส่วน [review #4](../evidence/home-deletion/jenkins-review-4/build.json) ตรวจ source ฟีเจอร์ การจำลอง Verify ล้มเหลวอยู่ใน [หลักฐานย้อนหลัง](../evidence/submission-2.2/README.md) โดยอ้างเฉพาะ source/build ที่ระบุ

Pipeline deploy ไป `pawroster-ci` ภายใน image อาจารย์ แยกจากบริการใช้งานและ preview การอัปเกรดบริการใช้งานหลังอนุมัติ merge เป็นขั้นตอนแยก ไม่ใช่การสร้าง image อาจารย์ใหม่ทุก build

## ข้อจำกัดของผลประเมิน

ผลตรวจยืนยันพฤติกรรมตามกรณีที่ระบุ ไม่ใช่ load test, penetration test หรือผลภาคสนาม ไม่มีข้อมูลลดงานตกหล่นหรือเพิ่มคุณภาพชีวิตสัตว์เชิงสถิติ ระบบเหมาะกับหนึ่ง instance และฐานข้อมูล local volume การแจ้งเตือน push/email, MFA, email verification, password reset และการลบบัญชียังอยู่นอกขอบเขต
