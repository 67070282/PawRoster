# Jenkins execution evidence

รันจริงวันที่30ตุลาคม2026 ใน Jenkins controller ภายใน Docker daemon ของ `tuchsanai/devtools:2569_1` ไม่มีการใช้ผล shell script แทน Jenkins job

| Job/build | ผล | สิ่งที่ยืนยัน |
|---|---|---|
| pawroster-review #1 | FAILURE | พบ timestamps option ต้องมี plugin เพิ่ม จึงเอา optional dependency ออกใน source |
| pawroster-review #2 | SUCCESS | checkout source จาก GitHub, verify/build/push local registry ผ่าน; branch งานข้าม Deploy |
| pawroster-review #3 | EXPECTED FAILURE | VERIFY_FAILURE_GATE=true แทรก failing test ในworkspace; JUnitมีfailure และ Build/Publish/Deploy ถูกข้าม |
| pawroster-review #4 | SUCCESS | Started by an SCM change; โค้ด `3d93c7a7215671ee8bf96e939451991393985cc5`; testsผ่าน, publishผ่าน, Deployข้ามตามbranch |
| pawroster-main #1 | FAILURE บนรุ่นเก่า | main ยังไม่รวม PR และยังมีtimestamps dependency; ไม่ใช่ failure gate probe และไม่นับว่ารุ่นแก้deployผ่าน |

ไฟล์ `.json` มาจาก Jenkins API readback และ `.txt` มาจาก console output ที่รันจริง โดยปกปิดอีเมล URLบริการเฉพาะเครื่อง และruntime pathก่อนเผยแพร่ JUnit/image digest อยู่ artifacts/ คงผลทดสอบ build/commit/digestเดิม ไม่บันทึกรหัสผ่าน admin หรือsecret file ใน Git

Jenkinsใช้SCM pollingทุกประมาณ2นาที ไม่ใช่webhook public registryอยู่loopbackในกล่อง ไม่ใช่Docker Hub Main deploymentยังรอคำอนุมัติให้merge [PR #1](https://github.com/67070282/PawRoster/pull/1) จึงยังไม่อ้างว่าเส้นทางmain publish/deploy/verifyผ่าน

Run URLs ในไฟล์เป็น URL ภายในcontroller `http://127.0.0.1:8080/` การตรวจรอบนี้ forward host localhost:8088 เข้า Course Container แล้วเข้า Jenkins ต้องใช้บัญชีadminที่สร้างไว้ ไม่มีpublic Jenkins หลังทดสอบจะหยุดกล่องเพื่อลดสิทธิ์privileged; หลักฐานในrepoยังเปิดอ่านได้
