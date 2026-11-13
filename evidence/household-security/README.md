# Household security 2.2 verification

Tested source commit: `4d319e8b0ed645a7e71698da423b277f68c893c6`.

Windows and Linux in the instructor image passed 32 acceptance cases (33 TAP records including the parent), zero failures. S1–S6 cover obsolete invites in register/join, multi-session removal, blocked rejoin, owner/house boundaries, pause/reopen, atomic rollback and schema 3→4 migration/restart.

The course script was invoked through SSH inside `tuchsanai/devtools:2569_1`, using the local inner Docker daemon, isolated Compose project `pawroster-security-validation` and its own data volume on port 3087. Syntax, build, revision health, deployed HTTP smoke, SQLite online backup/integrity and force-recreate persistence passed. The test service was then stopped and the volume retained. `course-tests.tap` and `course-smoke.txt` contain sanitized synthetic-data results.

Browser QA used isolated owner/member/other-home accounts and a separate synthetic database. See `ui-summary.json`. No real household membership or invite was changed for testing. Pre-upgrade data was backed up privately and integrity checked. Jenkins was not rerun; this is not an independent penetration test. See docs/SECURITY.md for limitations.

Subsequent submission verification reran Jenkins for the same 2.2 application code. See [evidence/submission-2.2](../submission-2.2/README.md) for the newer CI/CD results; the statement above describes the earlier verification round.
