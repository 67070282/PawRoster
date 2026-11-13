# Repository และประวัติการส่งมอบ

Repository: [67070282/PawRoster](https://github.com/67070282/PawRoster) · Public · default branch `main`

## การจัดการเวอร์ชัน

โค้ด เอกสาร ชุดทดสอบ Docker และ Jenkinsfile อยู่ใน repository เดียว ใช้ feature branch และ Pull Request เพื่อรวบรวมการเปลี่ยนแปลงก่อนรวมเข้า main ประวัติที่ตรวจได้อยู่ใน commit และ PR ไม่รวมข้อมูลฐานข้อมูล รหัสผ่าน token หรือไฟล์สำรองใน source control

| รุ่น/ขอบเขต | Pull Request |
|---|---|
| สมุดบันทึก ปฏิทิน และถังขยะ | [#5](https://github.com/67070282/PawRoster/pull/5) |
| ปรับข้อความและการอ่านหน้าจอ | [#6](https://github.com/67070282/PawRoster/pull/6) |
| ลบสัตว์เลี้ยงถาวร | [#7](https://github.com/67070282/PawRoster/pull/7) |
| ธีมสว่างและปฏิทินเน้นวันนี้/นัดหมาย | [#8](https://github.com/67070282/PawRoster/pull/8) |
| รุ่น 2.2 จัดการสมาชิกและรหัสเชิญ | [#9](https://github.com/67070282/PawRoster/pull/9) |

รอบติดตั้งที่บันทึกในหลักฐานเริ่มต้นรุ่น 2.2 ใช้ `00ad184cc7208a3738de3df90bb836a6917c1291` ผล acceptance/Course Container ตรวจ source `4d319e8b0ed645a7e71698da423b277f68c893c6` โดยโค้ด runtime ตรงกัน รายละเอียดใน [RESEARCH.md](RESEARCH.md)

เอกสาร ภาพหน้าจอ และการล้างลิงก์ไฟล์นำเสนอที่ลบแล้วอัปเดตผ่าน [PR #10](https://github.com/67070282/PawRoster/pull/10), [PR #11](https://github.com/67070282/PawRoster/pull/11) และ [PR #12](https://github.com/67070282/PawRoster/pull/12)

## การตรวจซ้ำ

1. Clone repository ตาม [README](../README.md)
2. ตรวจ `git rev-parse HEAD` และชื่อ branch
3. Build/Test/Deploy ใน Course Container และตรวจ health revision
4. อ่านผลใน evidence directory พร้อมวันที่และ commit ไม่ใช้ผลรุ่นเก่าแทนรุ่นใหม่

การใช้ AI เป็นเครื่องมือพัฒนาระบุใน README ประวัติการทบทวนและเปลี่ยนแปลงใช้ข้อมูลจริงใน GitHub
