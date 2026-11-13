# Jenkins main build #10

ตรวจวันที่ 13 พฤศจิกายน 2569 source `4e8e5c03a19630930a84cfa8274ce040af6e06a4` ซึ่งรวมการแยกงานรอบถัดไปใน PR #16 package 2.3.0 / schema 5 ใช้ข้อมูลสังเคราะห์ บริการ CI แยกจากแอปใช้งานและ preview

| รายการ | หลักฐาน |
|---|---|
| SUCCESS และทุก stage ทำงาน | [build.json](build.json) |
| Commit | [commit.txt](commit.txt) |
| Branch main | [source-branch.txt](source-branch.txt) |
| JUnit | [tests.xml](tests.xml) |
| Image digest | [image-digest.txt](image-digest.txt) |
| Health revision ตรง commit | [health.txt](health.txt) |
| HTTP smoke และ persistence | [deployed-smoke.txt](deployed-smoke.txt) |
| Compose | [compose-status.txt](compose-status.txt) |

เอกสารและภาพหน้าจอที่เพิ่มหลัง commit นี้ไม่ได้เปลี่ยน runtime ผลของรอบนี้อ้างเฉพาะ source ข้างต้น ไม่แก้ผลย้อนหลังให้เป็นผลของ commit อื่น
