# Bulk Onboarding Issue Resolution — Frontend Report

**Date:** 2026-08-20  
**Repo:** `Hrms--Web-application---front-end---v1`  
**Branch:** `feature/employee-management-phase1-foundation`

## Current root cause

Validate step listed the same `errorMessage` once per invalid row with no grouped issues, suggestions, or in-flow fixes. HR could not map typos or create missing setup from Bulk Onboarding.

## Files changed

- `src/app/modules/people/models/bulk-onboarding.model.ts` — issues, suggestions, resolve payload types
- `src/app/modules/people/data-access/bulk-onboarding-api.service.ts` (+ spec) — `resolveIssues()`
- `src/app/modules/people/state/bulk-onboarding.store.ts` — `resolveIssue()` with 403-friendly message
- `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.{ts,html,css,spec.ts}` — issue-resolution UI

## Endpoint contracts consumed

- `POST .../validate` — reads `issues[]` + structured `errors[]` (backward compatible if absent)
- `POST .../resolve-issues` — map / edit / create / set_default; refresh validation result
- Create actions shown only when backend `allowedActions` includes them (`org:manage` omitted server-side)

## Issue types / UX

- Summary cards: valid / need fixes / blocked / ready
- Issue groups with suggestion + actions driven by `allowedActions`
- Friendly row messages (no technical codes in UI)
- Partial import: **Import N valid rows** enabled when `validRows > 0` (matches backend draft creation)

## Permission behavior

- Create department/position buttons require action in `allowedActions` (backend already filters without `org:manage`)
- 403 on create shows: “You do not have permission to create organization setup records.”

## Tests run

```text
npx ng test --no-watch --include bulk-onboarding specs → 18 passed (3 files)
npm run build → success (CSS trimmed to meet 8kb component budget)
git diff --check → CRLF warnings only
```

## Skipped checks

- Full `people/**/*.spec.ts` / `settings/**/*.spec.ts` suites (focused bulk specs run instead)
- E2E / live API against Docker

## Remaining risks

- “Choose existing” / create flows use `window.prompt` placeholders (functional, not polished pickers)
- CSS budget is tight; further UI polish may need style extraction
- Depends on backend migration `resolution_state_json` / `resolved_work_mode_id` being applied
