# Calendar highlights and light theme

Browser QA on 13 November 2026 used isolated Edge/Playwright with synthetic users and a separate test database.

- Today, appointments and tasks coexist; selected day remains distinct from today.
- Month navigation, return today, filters and appointment completion passed.
- Arrow keys and End maintain keyboard focus and update the selected day.
- Calendar layouts passed at 320, 390, 680, 1024, 1365 and 1440px; no event-marker overflow.
- All six main views passed text contrast and overflow checks at 320/390/680/1365px; minimum recorded text contrast 4.93:1. This is a technical check, not a full WCAG certification.
- Journal CRUD, CSV, appointment status, task creation/assignment/completion, trash/recovery and member permissions passed; no page errors.

No schema or API changes. Jenkins was not rerun for this UI change. Earlier evidence directories describe earlier versions and themes.
