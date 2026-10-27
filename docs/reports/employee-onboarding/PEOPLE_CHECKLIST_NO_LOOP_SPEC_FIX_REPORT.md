# People Checklist No-Loop Spec Fix Report

## Root cause

The no-loop spec expected the initial company load at `GET ${environment.apiUrl}/org/legal-entities`, but `LegalEntityStore.loadCompanies()` calls `LegalEntityApiService.getAccessibleCompanies()`, whose current session-scoped contract is `GET ${environment.apiUrl}/session/companies`. Production was correct; the test expectation was stale.

## Change made

Updated only `src/app/modules/people/feature/checklist-templates/checklist-templates.component.no-loop.spec.ts`, changing the company-load expectation from `/org/legal-entities` to `/session/companies`. The test still performs a real company load, flushes the checklist list request, runs eight idle `fixture.detectChanges()` cycles, and asserts that no additional checklist list request occurs.

## Verification

| Command | Result |
|---|---|
| `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts` | Passed; 309 tests passed. |
| `npm run build` | Passed; Angular production build completed with existing warnings only. |
| `git diff --check` | Passed with exit code 0; only LF-to-CRLF normalization warnings were emitted. |

No production behavior changed. The `/session/companies` contract was preserved, no backend files were touched, and no commit or push was performed.
