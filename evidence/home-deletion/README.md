# PawRoster 2.3 — ลบบ้านถาวร

วันที่ตรวจ 13 พฤศจิกายน 2569 Source runtime/tests `f63e1964790fd3fc453a59bd42996e68bec56d16` รุ่น 2.3.0 schema 5 ใช้บัญชีและข้อมูลสังเคราะห์ทั้งหมด ภาพและ UI ตรวจจาก worktree ที่มี runtime ตรง source นี้ เอกสารและหลักฐานเพิ่มหลัง source commit

| รายการ | ผล |
|---|---|
| Windows Node 24.14.0 | 37 กรณี / 38 TAP records ผ่าน fail 0: [ผล](windows-tests.txt) |
| Linux ใน image อาจารย์ | [ผล TAP](course-tests.tap), [commit](course-commit.txt) |
| Course Docker-in-Docker | [HTTP smoke, backup, force recreate/persistence](course-smoke.txt), [Compose](course-compose.txt) |
| Browser Edge/Playwright | [ผล UI](ui-result.json): สิทธิ์ owner/member, cancel, ชื่อผิด, dialog ค้าง, ย้ายทั้งสองคน, ไม่มีบ้านเหลือ และ 320/390/1365px ไม่มี horizontal overflow |
| ภาพหน้าจอ | [ภาพปัจจุบัน](../../docs/SCREENSHOTS.md), ใช้ fixture สาธิต ไม่เผยรหัสเชิญ |

H1 ตรวจบ้านสองคนย้ายไปอีกบ้านและคงข้อมูลบ้านปลายทาง H2 ตรวจสิทธิ์/confirmation H3 ตรวจบัญชีไม่มีบ้านและใช้ต่อได้ H4 inject ความล้มเหลวเพื่อตรวจ rollback ทุกตาราง H5 ตรวจ migration 4→5 เก็บ identity/credential/session/membership ผลรอบก่อนเก็บตามรุ่นเดิม ไม่ใช้แทนผลตรวจ source นี้

การลบบ้านจริงต้องให้เจ้าของยืนยันเอง ไม่ได้ลบบ้านของผู้ใช้จริงเพื่อทดสอบ ไม่มีผลสัมภาษณ์หรือผลทดลองผู้ใช้จริงในรายงานนี้

Jenkins review #4 ตรวจ source ฟีเจอร์เดียวกันสำเร็จ: Checkout/Verify/Build/Publish ผ่าน ส่วน Deploy/Verify deployed ถูกข้ามตามเงื่อนไข feature branch ดู [build](jenkins-review-4/build.json) และ [JUnit](jenkins-review-4/tests.xml) ผล main รุ่น 2.3 จะอ้างตาม build หลัง merge

ทดลอง migration บนสำเนา backup ของแอปใช้งานและ preview ก่อนอัปเกรด: schema 4→5 ผ่าน integrity_check=ok, foreign_key_check ว่าง และข้อมูลทุกตารางตรงเดิมยกเว้นคอลัมน์ legacy users.home_id ที่นำออก ไฟล์สำรองและข้อมูลบัญชีเก็บเป็นส่วนตัว
