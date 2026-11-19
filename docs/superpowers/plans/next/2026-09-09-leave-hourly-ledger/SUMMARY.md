# 2026-09-09-leave-hourly-ledger (frontend)

**Status:** implemented on `feature/time-off-ui-refresh`. Design: `docs/superpowers/specs/next/2026-09-09-leave-hourly-ledger-design.md`. Companion backend: `HRMS-Backend-v1/docs/superpowers/plans/next/2026-09-09-leave-hourly-ledger/`.

| Part | What ships | Depends on |
|---|---|---|
| `part-1-overnight-work-hours-ui.md` | Overnight work window + live “Xh / day · this is 1 leave day” | Backend Part 1 |
| `part-2-leave-hours-models-wizard-and-balances.md` | Hour DTOs, From/To wizard, balances/history/approvals/calendar | Backend Part 3 |

Do not start Part 2 against an API that still expects `startDate`/`halfDayPeriod`.
