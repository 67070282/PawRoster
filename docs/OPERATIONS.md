# คู่มือปฏิบัติการ

## Local lifecycle

```sh
docker compose up -d --build --wait
docker compose ps
docker compose logs --tail=100 app
docker compose restart app
docker compose down
```

`down` ไม่ลบ named volume หลีกเลี่ยง `down -v` เพราะลบข้อมูลถาวร

## Jenkins

วิธีที่ทดสอบใช้ Jenkins Pipeline from SCM สอง job (`pawroster-main` และ `pawroster-review`) ชี้ main/course-readiness ตามลำดับ ใน Course Container ที่ได้รับอนุมัติ รัน `sh jenkins/start-course-jenkins.sh` จาก root repo เพื่อ build controller, local registry และสร้าง job แบบมี authentication

ผู้ใช้คือ `pawroster-admin` รหัสสุ่มอยู่ที่ `/workspace/pawroster-jenkins-admin.secret` ภายในกล่อง ไม่อยู่ใน Git Controller home อยู่ `/workspace/pawroster-jenkins-home` ทั้ง inner host และ controller เพื่อให้ bind mount workspace ใช้งานได้จริง ต้องเปิด port forwarding ของ outer Course Container สำหรับ8080ตามสภาพแวดล้อมผู้สอน ห้ามเปิด Jenkins ออก public โดยไม่จัดการสิทธิ์และTLS

Pipeline: checkout GitHub → secret scan → syntax + HTTP tests → Compose validate → build image tagged job/build → push ไป `localhost:5000/pawroster` ใน registry ของ inner daemon → main เท่านั้น deploy project `pawroster-ci` พอร์ต3180 → health ต้องมี revision ตรง Git commit + deployed HTTP smoke → JUnit/artifacts ค่าปริยาย runtime ปกติยังรัน `docker compose up` ได้โดยไม่ต้องมี Jenkins หรือ registry

Jenkinsfile ตั้ง `pollSCM('H/2 * * * *')` จึงตรวจ source ทุกประมาณ2นาทีหลังรัน job ครั้งแรก ไม่ได้ตั้ง webhook ออกอินเทอร์เน็ต Feature job ต้องข้าม Deploy และ Verify deployed service ส่วน main ต้องผ่านทุก stage พารามิเตอร์ `VERIFY_FAILURE_GATE=true` ใช้แทรก failing test เฉพาะ disposable workspace เพื่อพิสูจน์ว่า build/publish/deploy ถูกข้าม ไม่แก้โค้ดใน repository และไม่หยุด app ที่ deploy อยู่เดิม

หากใช้ Multibranch กับ Jenkins ที่ทีมมีอยู่แล้ว ให้ agent label `docker` มี Docker/Compose และ workspace ที่ daemon มองเห็น เปลี่ยน registry ผ่าน environment ตามระบบจริง และเก็บ secrets ใน Jenkins Credentials

PR ต้องไม่ deploy และห้ามให้ untrusted fork รัน agent ที่เข้าถึง Docker daemon ใช้ repository ของทีมที่เชื่อถือได้ agent แบบนี้มีสิทธิ์สูงต่อ Docker โฮสต์ ไม่แนะนำใช้ร่วมกับ production workload

เก็บ URL build, commit SHA, tests.xml, health.txt, compose-status.txt และ image digest เป็น evidence ถ้า Verify ไม่ผ่านต้องไม่มี Deploy หาก post-deploy health ล้มเหลว Pipeline ต้องขึ้น failed และให้ผู้ดูแลวินิจฉัย ไม่อ้างว่ามี automatic rollback

## Course Container: การทดสอบและทำซ้ำ

กติกากำหนด `tuchsanai/devtools:2569_1` และ Docker-in-Docker ผู้ใช้อนุมัติ `--privileged` แล้วและตรวจผ่านจริง ดู evidence/course/ ขั้นตอนเริ่มกล่องสำหรับนำเสนอให้ยึดคำสั่งผู้สอน เพราะสิทธิ์นี้ให้การเข้าถึงโฮสต์กว้าง หลัง clone และ checkout รุ่นส่งในกล่องแล้ว รัน `sh scripts/course-verify.sh` เพื่อทำ syntax/tests/build/HTTP flow/backup/recreate/logout และหยุด Compose พร้อมเก็บผลใน evidence/runtime/ สคริปต์สร้างข้อมูลสังเคราะห์ ไม่ใช้ข้อมูลจริง

ภายในกล่องที่ผู้สอนจัดเตรียมแล้ว:

```sh
docker version
docker compose version
git clone <URL_REPOSITORY_ของทีม> pawroster
cd pawroster
git checkout <COMMIT_SHA_รุ่นส่ง>
mkdir -p evidence/runtime
docker compose config --quiet
docker run --rm -v "$PWD:/app" -w /app node:24.14.0-alpine node --test --test-reporter=tap --test-reporter-destination=evidence/runtime/course-tests.tap
docker compose up -d --build --wait --wait-timeout 90
docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/health').then(async r=>{if(!r.ok)process.exit(1);console.log(await r.text())})"
docker compose ps
```

แทนค่า URL/commit ก่อนรัน ต้องตรวจ `$PWD` ว่า daemon **ภายในกล่อง** เห็น path นี้จริง ไม่ใช่ bind mount ชี้ไป host อื่น เปิด Browser ผ่านการ forward port ที่ผู้สอนจัดไว้: แอป bind 127.0.0.1:3080 ภายในกล่องโดยค่าเริ่มต้น อาจต้องปรับ bind/port ตาม setup กล่อง ไม่สมมติว่า expose 3080 ของ inner container จะเข้าถึงจากเครื่อง host ได้ทันที

ทำ UI demo ตาม PRESENTATION.md เก็บ before/after, สอง session แย่งงาน, logs, pipeline และผลดังต่อไปนี้:

```sh
git rev-parse HEAD > evidence/runtime/commit.txt
docker compose ps > evidence/runtime/course-compose.txt
docker compose logs --no-color > evidence/runtime/course-logs.txt
docker compose down
docker compose up -d --wait
```

หลังขึ้นใหม่ล็อกอินดูงานเดิมต้องยังอยู่ แล้ว `docker compose down` เพื่อหยุดโดยคงข้อมูล เก็บ evidence ของกล่องรายวิชาแยกจากเครื่องส่วนตัว

## Backup และ restore

SQLite อาจมีไฟล์ WAL ห้ามคัดลอกเฉพาะ .db ขณะเขียน ใช้ SQLite online backup ที่ให้มา:

Local:

```sh
node scripts/backup.mjs backups/care.db
```

Docker (สำรองผ่าน online backup ใน container แล้วนำออกมา):

```sh
docker compose exec -T app node scripts/backup.mjs /tmp/care-backup.db
docker compose cp app:/tmp/care-backup.db ./care-backup.db
```

ไฟล์สำรองมี email, note และ session จึงเก็บในพื้นที่ส่วนตัว มี retention และไม่ commit Git

ทดสอบกู้คืนโดย **สร้าง instance แยก** ก่อน ไม่เขียนทับฐานข้อมูลจริง:

PowerShell:

```powershell
$env:DB_PATH = './care-backup.db'
$env:PORT = '3090'
node src/server.js
```

Linux:

```sh
DB_PATH=./care-backup.db PORT=3090 node src/server.js
```

เข้าที่ 3090 ล็อกอินและเทียบจำนวนงาน/สถานะกับต้นฉบับ หากต้องกู้คืนจริงให้หยุด service สำรอง volume เก่า และให้ผู้ดูแลเปลี่ยนข้อมูลตามขั้นตอนที่ทดสอบแล้ว ออก session ทั้งหมดหลัง restore หากสงสัยไฟล์สำรองรั่ว ไม่มี automatic recovery ในรุ่นนี้

## Git/GitHub และส่งงาน

สร้าง repository ของทีมแล้ววางไฟล์ชุดนี้ที่ root ก่อนเริ่มงานร่วมกัน ใช้ `.gitignore` ที่ให้มา ตรวจไม่มี `.env`, DB, backup หรือข้อมูลส่วนตัวใน staged files ตั้ง issue ตาม R1–R8/N1–N3 ใช้ branch และ review จริง จากนั้น tag รุ่นส่งและบันทึก commit เดียวกันในรายงาน, pipeline, Course Container

Repository หลักคือ https://github.com/67070282/PawRoster แบบ Public ตามคำขอเจ้าของ เผยแพร่ไฟล์ผ่านตัวเชื่อม GitHub การมี baseline นี้ไม่ใช่หลักฐานการมีส่วนร่วมของสมาชิก ต้องพัฒนาผ่าน issue/branch/PR ตามงานจริงต่อไป ให้ clone repository หลักใหม่ก่อนเริ่มงานร่วมกัน เพราะ local snapshot ก่อนเผยแพร่มี commit SHA ต่างจาก remote ดู GITHUB.md
