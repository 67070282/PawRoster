# Formal course verification of the deployed main code

วันที่30ตุลาคม2026 ตรวจ commit `86866281b6df405f61c2d81097b2c74b4e1cb3be` จาก main ซึ่งตรงกับ Jenkins main builds #3/#4

วิธี: fetchและcheckout main commitภายใน `tuchsanai/devtools:2569_1` → `sh scripts/course-verify.sh` → inner Docker tests/build/Compose → HTTP flow → backup → force-recreate → verify → Compose downโดยคงvolume

ผลจริง: Node tests9/9ผ่าน, buildและhealthผ่าน, healthrevisionตรงcommit, register/pet/task/claim/completeผ่านและปิดซ้ำได้409, onlinebackup integrity/stateตรงต้นฉบับ, หลังrecreate session/task/note/auditยังอยู่, logoutrevokeผ่าน ข้อมูลทั้งหมดเป็นข้อมูลสังเคราะห์ มี3บ้าน/สัตว์/งานและ9eventsสะสมจากการทดสอบซ้ำ ไม่ใช่ผู้ใช้จริง

ดู course-commit.txt, course-worktree.txt, course-tests.tap, course-smoke.txt, course-compose.txt และcourse-logs.txt บางส่วนของpathและendpointเฉพาะเครื่องถูกปกปิดก่อนเผยแพร่ เอกสารผลตรวจที่เพิ่มหลังruntime commitนี้ไม่ใช่การเปลี่ยนพฤติกรรมแอป หากแก้ระบบภายหลังต้องตรวจรุ่นส่งอีกครั้ง

course-worktree.txt รอบนี้รายงานการnormalize newlineของevidence JSON5ไฟล์จากการcheckout (ไม่มีการเปลี่ยนruntime code) จึงเก็บผลนี้ตามจริงและnormalizeไฟล์หลักฐานในcommitเอกสารที่ตามมา
