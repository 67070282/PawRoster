# Permanent pet deletion verification

Tested source commit: `1ac0865dab4e0949eeece061119de4b61649033a`.

- Windows and Linux in the instructor image: 26 acceptance cases passed (27 TAP records including the parent), zero failed.
- Linux command invoked through `ssh root@localhost -p 2222`, using the inner Docker daemon and a read-only source mount with `node:24.14.0-alpine node --test --test-reporter=tap`.
- Browser UI: cancellation, wrong name, successful permanent deletion, related data removal, preservation of another pet, reload, and 320/390/1365px dialogs passed on a separate synthetic database.
- No real user pet was permanently deleted during verification. No schema change. Jenkins was not rerun.

`windows-tests.tap`, `course-tests.tap` and `ui-summary.json` contain the recorded results. UI checks covered the working tree whose source matches the tested commit.
