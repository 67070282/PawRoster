# หลักฐานตรวจระบบ PawRoaster

Jenkins main build #8 ตรวจวันที่ 13 พฤศจิกายน 2569 บน source `233ead1851c5224be59cf5254d50474a29ec9414` และ package 2.3.0 ชื่อรายงานใช้ PawRoaster ส่วนชื่อเทคนิคและผลเดิมใน artifacts คงตามระบบที่ตรวจ ไม่แก้ log หรือผลทดสอบย้อนหลัง

| รายการ | หลักฐาน |
|---|---|
| Build/stage status SUCCESS | [build.json](main-8/build.json) |
| Source commit | [commit.txt](main-8/commit.txt) |
| Source branch main | [source-branch.txt](main-8/source-branch.txt) |
| JUnit | [tests.xml](main-8/tests.xml) |
| Image digest | [image-digest.txt](main-8/image-digest.txt) |
| Health version/revision | [health.txt](main-8/health.txt) |
| Deployed HTTP flow/persistence | [deployed-smoke.txt](main-8/deployed-smoke.txt) |
| Compose status | [compose-status.txt](main-8/compose-status.txt) |

ใช้ข้อมูลสังเคราะห์ บริการของ pipeline อยู่ใน project สำหรับ CI ภายใน image อาจารย์ แยกจากบริการใช้งาน/preview หลักฐานนี้ไม่ได้อ้างว่ารอบเก่าตรวจการแก้เอกสารหลัง commit ข้างต้นแล้ว
