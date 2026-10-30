# Verification from a GitHub checkout

Source: https://github.com/67070282/PawRoster

Commit: `3d93c7a7215671ee8bf96e939451991393985cc5` (course-readiness, PR #1)

วิธี: clone repositoryภายใน Course Container `tuchsanai/devtools:2569_1`, fetch/checkout commitที่ระบุ แล้วรัน `sh scripts/course-verify.sh` ผ่าน Docker daemonภายในกล่องจริง

ผล: syntaxผ่าน, HTTP acceptance9/9, Compose build/healthผ่าน, /health revisionตรงcommit, register→pet→task→claim→completeผ่าน, duplicateได้409, backup integrity/stateผ่าน และหลังforce-recreateงานnote/audit/sessionยังอยู่ ออกจากระบบแล้วsessionใช้ต่อไม่ได้ สคริปต์หยุดinnerComposeโดยคงvolume

ไฟล์ course-commit.txt, course-worktree.txt, course-tests.tap, course-smoke.txt, course-compose.txt และcourse-logs.txt เป็นผลรันจริง Gitworktreeสะอาดตอนเริ่ม (ไฟล์ผลรันอยู่ในignored runtime directory) นี่เป็นหลักฐานจากGitHub checkout แยกจากรอบเก่าในevidence/courseที่เป็นgenerated snapshot
