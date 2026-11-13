> ประวัติการตรวจตามวันที่และ commit ในเอกสารนี้ หลักฐานรุ่นปัจจุบันดู [แผนที่หลักฐาน](../README.md)

# ยืนยัน Docker-in-Docker หลังเปรียบเทียบ PawFeed

ตรวจวันที่ 12 พฤศจิกายน 2026 จาก Commit **bf87d29cf20f61d35e2c6a5e2a7b735ed0826e6c** ที่ Pull ผ่าน SSH ภายใน `devtools`

## ข้อสรุป

PawFeed ใช้ image อาจารย์สำหรับกล่องชั้นนอกและใช้ Node image สำหรับแอปชั้นใน ดู [Course wrapper](https://github.com/67070119/PawFeed/blob/main/scripts/course-container-test.sh) และ [Backend Dockerfile](https://github.com/67070119/PawFeed/blob/main/backend/Dockerfile) PawRoster ใช้รูปแบบเดียวกัน โดยรวม Web/API/SQLite ใน app container เดียวตามสถาปัตยกรรมของโครงงาน

```text
Docker Desktop
└── devtools : tuchsanai/devtools:2569_1 (privileged)
    └── dockerd ภายใน (คนละ daemon)
        └── pawroster-course-app-1 : pawroster:local
            └── SQLite ใน named volume
```

## สิ่งที่เพิ่ม

- `scripts/assert-course-environment.sh`: ตรวจ container, dockerd ที่ทำงานภายใน และ Local Unix socket ก่อนรัน Course verification
- `scripts/check-course-container.ps1`: ตรวจจากเครื่องหลักว่า outer image ถูกต้อง, privileged, ไม่มี host socket mount, daemon IDs ต่างกัน และ app container อยู่บน inner daemon พร้อม Health
- ตัวตรวจยอมรับกล่องอาจารย์และปฏิเสธ Node container ทั่วไปด้วย Exit 1 ตามที่คาด: [guard-tests.txt](guard-tests.txt)

## ผลตรวจจาก GitHub commit จริง

- [Working tree](course-worktree.txt) ว่างก่อนตรวจ; [Commit](course-commit.txt) ตรงรุ่นที่ระบุ
- HTTP tests ผ่าน **17 กรณี** (18 TAP records รวม Parent): [course-tests.tap](course-tests.tap)
- Build/Health, หลายบ้าน, งานซ้ำ, Backup/Integrity และ Force-recreate/Persistence ผ่าน: [course-smoke.txt](course-smoke.txt)
- [Health](course-health.json) แสดง revision ตรง Commit ที่ Build
- [ผลตรวจโครงสร้างสองชั้น](daemon-proof.json) ยืนยันว่าแอป Healthy อยู่บน daemon ภายในและไม่มี host socket mount

ผลนี้เป็นการทดสอบ Docker-in-Docker ไม่ใช่ผลรัน Jenkins รุ่น 2.0 การเพิ่มรายงานนี้ภายหลังไม่เปลี่ยนโค้ดแอปและสคริปต์ที่ตรวจใน Commit ข้างต้น
