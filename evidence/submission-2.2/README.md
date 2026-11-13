# Submission verification — PawRoster 2.2

Verified on 13 November 2026 inside a fresh authenticated Jenkins instance in the instructor Course Container. Build numbers belong to this instance; older evidence/jenkins refers to an earlier instance.

| Job/build | Source | Result | Verification |
|---|---|---|---|
| pawroster-main #1 | 00ad184cc7208a3738de3df90bb836a6917c1291 | SUCCESS | Checkout, secret scan, syntax, tests, build, registry publish, main deploy, revision health and HTTP smoke |
| pawroster-review #1 | aebd543c5a81c67e21ed87311af116e9a48f66a9 | SUCCESS | Feature branch verified/built/published; Deploy and deployed verification skipped |
| pawroster-review #2 | aebd543c5a81c67e21ed87311af116e9a48f66a9 | expected FAILURE | VERIFY_FAILURE_GATE=true injects an intentional failing test only in a disposable workspace; Build/Publish/Deploy and deployed verification skipped |

Each subdirectory contains build.json with stage skip evidence, the exact source commit and JUnit XML. Main also records image digest, health, Compose status and smoke. Jenkins addresses in build.json are internal to the Course Container. No credentials or database files are included.

The main health reports version 2.2.0 and revision 00ad184cc7208a3738de3df90bb836a6917c1291, matching the build source. The application code matches the previously tested 4d319e8b0ed645a7e71698da423b277f68c893c6; changes between these source commits are evidence/merge history.

Slides QA passed all ten slides at 1365x900 with working navigation and no vertical overflow. Technical system/browser results remain in evidence/household-security, evidence/calendar-highlights and evidence/permanent-delete. This report uses synthetic data and does not measure clinical or population outcomes.

After the intentional failure gate, pawroster-review #3 was rerun normally and returned SUCCESS on the same source. Its artifacts are in jenkins/review-pass-latest. JUnit records 32 cases for normal builds and 33 cases with one intentional failure for the probe.
