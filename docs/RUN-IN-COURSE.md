# เปิด PawRoaster ภายใน Docker ของรายวิชาผ่าน SSH

> ระบบใช้ schema 5 และรองรับลบบ้านโดยเจ้าของ โดยคงบัญชีและบ้านอื่นไว้ ดู [วิธีใช้งาน](CARE-FEATURES.md) และ [ผลตรวจระบบ](../evidence/home-deletion/README.md)


คู่มือนี้ใช้สภาพแวดล้อม `tuchsanai/devtools:2569_1` และรันคำสั่งโครงงานหลังเชื่อมต่อ SSH เข้าไปในกล่อง ตามรูปแบบที่ผู้สอนกำหนด

## โครงสร้าง Docker-in-Docker

```text
เครื่องหลัก / Docker Desktop
└── devtools — image: tuchsanai/devtools:2569_1, privileged
    ├── SSH :22 ← เครื่องหลัก :2222
    └── dockerd ภายในกล่อง (คนละ daemon กับเครื่องหลัก)
        ├── pawroster-course-app-1 — image แอปจาก Dockerfile (Node.js 24)
        └── care-data — Volume ฐานข้อมูล SQLite ภายใน daemon นี้
```

Image อาจารย์เป็นสภาพแวดล้อมชั้นนอกที่ใช้ Build และรันคอนเทนเนอร์โครงงานชั้นใน จึงคง `FROM node:24.14.0-alpine` ใน Dockerfile ของแอปไว้ การ Build และ Deploy ใช้ไฟล์ Dockerfile และ Compose ของ PawRoaster ภายใน daemon ชั้นใน

ตรวจสองชั้นจาก PowerShell บนเครื่องหลัก จากโฟลเดอร์ PawRoaster:

```powershell
./scripts/check-course-container.ps1 -RequireApp
```

สคริปต์ตรวจ image/privileged, ไม่มีการ Bind mount Docker socket ของเครื่องหลัก, มี dockerd ภายใน, Docker daemon ID สองชั้นต่างกัน และแอป Healthy อยู่ใน daemon ชั้นใน หากยังไม่ได้เริ่มแอป ใช้คำสั่งโดยไม่ใส่ `-RequireApp`

## 1. เปิดกล่องรายวิชาจากเครื่องหลัก

```sh
docker run -dit --name devtools --privileged -p 2222:22 tuchsanai/devtools:2569_1
```

คำสั่งนี้ใช้เมื่อยังไม่มีคอนเทนเนอร์ชื่อ `devtools` หากมีกล่องเดิมที่ตั้งค่าไว้แล้ว ใช้ `docker start devtools` แทน และตรวจด้วย `docker ps` โดยไม่ลบกล่องหรือข้อมูลเดิม

## 2. เข้า SSH และเปิดทางเข้าหน้าเว็บ

```sh
ssh -L 127.0.0.1:3083:127.0.0.1:3080 root@localhost -p 2222
```

กรอกรหัสผ่านของกล่องตามที่ผู้สอนกำหนด ตัวเลือก `-L` ส่งพอร์ต 3083 บนเครื่องหลักไปยังพอร์ต 3080 **ภายใน devtools** เปิด Terminal นี้ค้างไว้ระหว่างดูหน้าเว็บ

หากต้องการเข้า SSH อย่างเดียว คำสั่งคือ `ssh root@localhost -p 2222` แต่การเปิดเว็บจากเครื่องหลักยังต้องมี SSH tunnel หรือ Port forwarding ที่ตรงกับการตั้งค่ากล่อง

## 3. ดาวน์โหลดและเริ่มระบบภายใน SSH

คำสั่งต่อไปนี้รันใน Terminal หลังเข้าสู่ `root@devtools` แล้ว:

```sh
mkdir -p /workspace
cd /workspace
git clone https://github.com/67070282/PawRoster.git
cd PawRoster
git rev-parse HEAD
docker version
docker compose version
sh scripts/assert-course-environment.sh
export COMPOSE_PROJECT_NAME=pawroster-course
export VCS_REF="$(git rev-parse HEAD)"
docker compose up -d --build --wait
docker compose ps
```

ถ้ามีโฟลเดอร์โครงงานอยู่แล้ว ให้ใช้โฟลเดอร์นั้นและตรวจสถานะ Git ก่อนอัปเดต แทนการ Clone ทับไฟล์เดิม

เปิดเว็บจากเครื่องหลักที่ **http://localhost:3083** และตรวจบริการที่ **http://localhost:3083/health** ผล Health แสดง version และ revision ของ Commit ที่ Build

ระบบใช้ Docker-in-Docker: เครื่องหลักรันกล่อง `devtools` ส่วน Docker daemon ภายในกล่องรันบริการ `pawroster-course-app-1` และ SQLite อยู่ใน Volume ของ daemon ภายในกล่อง การเปิดพอร์ต 2222 เพียงอย่างเดียวไม่ได้เปิดพอร์ตเว็บจากกล่องออกมา จึงใช้ SSH tunnel ในหัวข้อ 2

## 4. ทดสอบระบบในกล่องรายวิชา

จากโฟลเดอร์โครงงานภายใน SSH:

```sh
export COMPOSE_PROJECT_NAME=pawroster-verification
export APP_PORT=3087
export IMAGE_TAG=verification
sh scripts/course-verify.sh
```

สคริปต์ตรวจไวยากรณ์และ HTTP acceptance tests, Build, Health ที่ Revision ตรง Commit, Flow หลายบ้านและงานซ้ำ, SQLite backup/integrity และ Force-recreate แล้วตรวจข้อมูลคงอยู่ ผลอยู่ใน `evidence/runtime/` โดยใช้ข้อมูลสังเคราะห์ทั้งหมด

เมื่อสำเร็จจะมีข้อความ `PASS: course Docker-in-Docker verification` สคริปต์หยุด Compose เมื่อจบรอบตรวจ โดยเก็บ Volume ไว้ หากต้องการเปิดหน้าเว็บต่อ:

```sh
export COMPOSE_PROJECT_NAME=pawroster-course
export VCS_REF="$(git rev-parse HEAD)"
docker compose up -d --wait
```

## 5. หยุดและเปิดครั้งต่อไป

ภายใน SSH ใช้ `docker compose down` จากโฟลเดอร์เดิมและ Compose project เดิมเพื่อหยุดแอปโดยเก็บข้อมูล ไม่ใช้ `down -v` หากต้องการเก็บฐานข้อมูล จากนั้น `exit` จะปิด SSH tunnel ด้วย

ครั้งถัดไปเปิดกล่องจากเครื่องหลักด้วย `docker start devtools` แล้วเข้า SSH ตามหัวข้อ 2 และเริ่ม Compose ภายในโฟลเดอร์เดิม Docker daemon ภายในกล่องต้องพร้อมก่อนรันคำสั่ง Compose

ผลตรวจจริงของรุ่น 2.0 ผ่านเส้นทางนี้อยู่ใน [หลักฐาน Course Container ผ่าน SSH](../evidence/course-v2-ssh/README.md) ส่วนการสมัครและทดลองใช้งานดู [คู่มือเปิดโครงงาน](../README.md#try-the-app)

ผลตรวจสองชั้นและ Environment guard จาก Commit ที่ Pull จริง: [Docker-in-Docker validation](../evidence/dind-validation/README.md)

ผลตรวจระบบ: [Course Container และ acceptance tests](../evidence/home-deletion/README.md), [Jenkins main #8](../evidence/complete-project/main-8/build.json) และ [รายงานผลทดสอบ](RESEARCH.md)

## อัปเกรดฐานข้อมูลและการลบบ้าน

สำรอง DB ผ่าน `scripts/backup.mjs` ก่อนเปลี่ยน image เก็บไฟล์สำรองนอก Git และนอก public evidence จากนั้นใช้ขั้นตอน build/compose เดิมกับ named volume เดิม แอปจะย้าย schema 4→5 อัตโนมัติ ตรวจ `/health` ว่า version เป็น `2.3.0` และ revision ตรง commit ที่ deploy พร้อมตรวจ `PRAGMA user_version` เป็น 5, `integrity_check` เป็น ok และ `foreign_key_check` ไม่มีรายการ

Schema 5 เอา `users.home_id` ที่เลิกใช้แล้วออก ค่าบัญชีและสมาชิกภาพยังอยู่ หากต้องย้อนกลับไปแอปก่อน 2.3 ต้องคืนทั้ง image และ backup ก่อน migration ด้วยกัน ไม่ใช้ฐานข้อมูล schema 5 กับแอปเก่า การลบบ้านผ่าน UI เป็นการลบถาวรทั้งบ้าน การกู้คืน backup เป็นงานผู้ดูแลและจะกระทบข้อมูลที่เปลี่ยนหลังเวลาสำรอง จึงควรทดลองคืนใน volume แยกก่อน
