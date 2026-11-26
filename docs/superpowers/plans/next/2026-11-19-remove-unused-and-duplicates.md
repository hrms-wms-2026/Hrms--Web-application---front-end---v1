# Remove Unused and Duplicate Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the confirmed-unused files and exports Knip finds, and cut the jscpd duplicate lines by at least 25%. Only copies that must change together are merged. Every finding is labelled and written into a report.

**Architecture:** This follows `docs/core/CODE_CLEANUP_GUIDE.md`:
- **Mode A** (scan, label every finding CONFIRMED / SUSPECTED / KEEP) comes first.
- **Mode B** then runs as small single-theme batches, each verified and committed on its own.
- Tool configs stay outside the repo in `C:\HR2\cleanup-tools\`.
- Batches are ordered safest first. A re-measure checkpoint decides whether the dashboard batch is needed, and that batch needs the user's go-ahead.

**Tech Stack:** Angular 21, Knip 6.43.0 and jscpd 5.4.2 (via `npx`, not installed in the repo), Vitest via `ng test`.

---

## Baseline (measured 2026-11-19 on `b019faf9`, the base of this branch)

These numbers are measured with the commands in Task 1, so later runs compare like with like.

**jscpd:** 283 clones, **3,713 duplicated lines** (2.03% of 1,087 files).
- **This plan's 25% target is ≤ 2,785 duplicated lines.** The task file's 3,881 is from the 2026-11-13 scan and is kept for reference only.
- By format: CSS 1,550, TypeScript 1,501, markup 662.
- By module:

  | Module | Lines |
  |---|---|
  | dashboard | 1,558 (CSS 724) |
  | organization | 559 |
  | core | 327 |
  | attendance | 291 |
  | people | 215 |
  | shared | 176 |
  | work | 171 |

**Knip:** 7 unused files, 1 dependency, 1 devDependency, 5 exports, 4 types (listed in Task 2).
- `device-change-requests.store.ts` and `location-change-requests.store.ts`, named in the task file, are **already gone** from Development.

**Lint on the base is already red.** Each script must be run on its own and compared against these base counts:

| Script | Base result |
|---|---|
| `node scripts/check-http-params.mjs` | fails: 1 finding, `settings/data-access/support-tickets-api.service.ts` |
| `npx ng lint` | 7 a11y template errors, in `calendar-page.component.html` and `planner-create-popover.component.ts` |
| `node scripts/check-hardcoded-colors.mjs` | fails: 2 meeting files |

A batch is green when none of these counts rise and no new file appears.

**Full `ng test` on the base:**
- 4 en-GB date failures: `date-range-picker`, `time-tracking` ×2, inbox `leave-request-summary`.
- 1 flaky file that changes between runs (`main-layout` timeout or `widget-registry` teardown).

### Batches and their ceilings

These are the clone lines each batch's files are involved in, from `jscpd-report.json`. Removing them all is the ceiling, not the expectation.

| Task | Batch | Clones | Lines (ceiling) | Risk |
|---|---|---|---|---|
| 3 | Auth store: repeated session patch | 5 | 91 | low, well tested |
| 4 | Work models: DTO vs model copies | 3 | 61 | low |
| 5 | Organization: department/position/role twins | 52 | 559 | medium |
| 6 | Attendance: list/panel/status styles and formatters | 12 | 291 | medium |
| 7 | Auth pages: shared form styles and markup | 15 | 236 | medium |
| 8 | Checkpoint | | | |
| 9 | Dashboard: 8 cards hand-roll the size observer | 17 | 392 | **needs the user's go-ahead** |

The non-dashboard ceiling is 1,238 lines, so the target of 928 removed lines is reachable without the dashboard, but only if most of each batch lands. Dashboard CSS (724 lines) stays out: `docs/design/WIDGET_CREATION_RULES.md` makes widgets copy the reference card on purpose.

**Ownership** (`CODE_CLEANUP_GUIDE.md` §4.2):
- Improvements task 12 assigns this cleanup to Person 4, so the listed batches are in scope.
- Dashboard changed in 93 commits this month and has a pending BoardUI conversion. It needs the user's explicit OK (Task 9).
- If any other batch's files show up in an open PR, skip that batch and record it in the report.

## Rules for every batch (from the cleanup guide)

- **One theme per commit.** Stage with `git add <file> ...`, never `git add -A`. No attribution or `Co-Authored-By` trailers in commit messages.
- **No push or PR** inside this plan.
- **Never** suppress a lint rule, test or warning, and never raise a budget.
- **Merge only copies that must change together:** the same UI shown for two entities, or the same state logic. Similar CSS in unrelated components stays.
- **A shared piece goes in the narrowest shared folder.** A module's own `ui/` or `utils/` if only that module uses it, `src/app/shared/` otherwise. It follows the frontend rules: `styleUrl`, the a11y rules in `CLAUDE.md`, and theme tokens (no hex colours).
- Do not write the old product name (Onevo/Onexso) in new text under `src/app`.

**Per-batch gate.** Run all of these after each batch:

```powershell
npm run check:warnings
npx ng test --watch=false --include "<each touched folder>/**/*.spec.ts"
npx ng test --watch=false --include=src/app/visible-product-name.guard.spec.ts
node scripts/check-http-params.mjs
npx ng lint
node scripts/check-hardcoded-colors.mjs
npx --yes jscpd@5.4.2 src --format typescript,css,markup --ignore "**/node_modules/**,**/*.spec.ts,**/*.testing.ts,**/*.generated.ts" --min-tokens 70 --reporters json,silent --output ..\cleanup-tools\reports\jscpd-fe
```

- The first three must pass.
- The three lint scripts must match the base counts above.
- Write the new jscpd duplicated-lines total into the report table (Task 1 creates the report).

---

### Task 1: Scan setup, baseline and report skeleton

**Files:**
- Outside the repo: `C:\HR2\cleanup-tools\knip.frontend.json`
- Modify: `docs/core/CODE_CLEANUP_GUIDE.md` (config snippet and jscpd command)
- Create: `docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md`

- [ ] **Step 1: Write the Knip config, ignoring generated files and the two dependencies that are really used**

`C:\HR2\cleanup-tools\knip.frontend.json`:

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": ["scripts/**/*.{js,mjs}", "playwright*.config.ts", "e2e*/**/*.ts"],
  "ignore": ["src/app/shared/api-types/*.generated.ts"],
  "ignoreExportsUsedInFile": true,
  "ignoreDependencies": ["@angular-eslint/builder", "prettier", "emoji-picker-element-data"]
}
```

Why the new entries are there:
- `ignore`: the task 08 generated file (PR #170) is types-only output.
- `prettier`: used by `prettier --check` and by `scripts/api-types/api-types-lib.mjs`.
- `emoji-picker-element-data`: an asset in `angular.json`, loaded at runtime by `shared/ui/icon-picker`.

- [ ] **Step 2: Put the same changes in the guide**

In `docs/core/CODE_CLEANUP_GUIDE.md`:
- Replace the `knip.frontend.json` block in §2.2 with the JSON above.
- In §3.2, add `,**/*.generated.ts` to the jscpd `--ignore` list.
- Add one line under the JSON:

  > `prettier` and `emoji-picker-element-data` are used (format check / `angular.json` asset), so they are ignored rather than reported.

- [ ] **Step 3: Run both scans on the clean branch**

```powershell
npx --yes knip@6.43.0 --config ..\cleanup-tools\knip.frontend.json --no-progress --no-exit-code
npx --yes jscpd@5.4.2 src --format typescript,css,markup --ignore "**/node_modules/**,**/*.spec.ts,**/*.testing.ts,**/*.generated.ts" --min-tokens 70 --reporters json,silent --output ..\cleanup-tools\reports\jscpd-fe
```

**Expected:**
- Knip shows 7 unused files, 5 exports and 4 types, and **no** dependency findings.
- jscpd shows 283 clones and 3,713 lines.
- If the numbers differ, Development has moved. Write the new numbers into the report, and recompute the target as 75% of the new line count.

- [ ] **Step 4: Write the report skeleton**

`docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md`:

````markdown
# Task 12 cleanup report

Scans: Knip 6.43.0 and jscpd 5.4.2, commands from `docs/core/CODE_CLEANUP_GUIDE.md` §3 (generated files ignored).
Base: `b019faf9` (2026-11-19).

## Duplicate lines

| After | Clones | Duplicated lines | Change vs base |
|---|---|---|---|
| Base | 283 | 3,713 | |
| Target | | ≤ 2,785 | -25% |

## Unused code (Knip)

| Item | Label | Reason | Action |
|---|---|---|---|

## Skipped or reported to owners

(none yet)
````

- [ ] **Step 5: Commit**

```powershell
git add docs/core/CODE_CLEANUP_GUIDE.md docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md
git commit -m "docs(cleanup): task 12 baseline and scan config for generated files"
```

---

### Task 2: Unused files and exports (Knip batch)

**Files:** listed per item below.

Each item was already searched with `git grep` (strings, templates, specs, `angular.json`) on the base. **Repeat the grep before each delete.** Also check `modules/dashboard/widgets/widget-registry.ts`, route `loadComponent`, and `@defer` for the component names.

| Item | Label | Action |
|---|---|---|
| `core/config/build-info.ts` | CONFIRMED | delete. It is only named in the ARCHITECTURE §2 tree. Remove that line too. |
| `core/config/feature-flags.ts` | CONFIRMED | delete, plus the ARCHITECTURE §2 tree line |
| `modules/public/ui/landing-dashboard-preview/` (`.ts` + `.css`) | CONFIRMED | delete the folder |
| `shared/ui/metric-stat/metric-stat.component.ts` | CONFIRMED | delete the folder |
| `shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.css` | check first | see Step 2 |
| `shared/models/problem-details.model.ts` | SUSPECTED | **keep.** Task 20 needs a shared error model and may adopt this one. Ask the user. |
| `appendReturnPath` (`core/auth/utils/safe-return-path.ts`) | SUSPECTED | **keep.** It is return-path safety code. Read why it exists and ask. Do not delete it. |
| `RespondToCalendarEventRequest`, `UpdateCalendarConnectionRequest` | SUSPECTED | **keep.** These are backend request shapes for endpoints that may not be wired yet. Report them to the calendar/settings owner. |
| `inboxReference`, `CATEGORY_FIELD` (`modules/inbox/utils/inbox-item.util.ts`) | CONFIRMED if used only in that file | used in the file → remove `export`. Unused → delete. |
| `STATUS_OPTIONS` (`modules/organization/utils/general-settings-options.ts`) | CONFIRMED | other modules have their own `STATUS_OPTIONS`. If used in this file, remove `export`; otherwise delete. |
| `EXCEPTION_ALERT_TYPE_LABELS` (`shared/models/exception-evidence.model.ts`) | CONFIRMED if no match outside the file | same rule |
| `ClockInPolicyFormModel` (`modules/settings/utils/clock-in-policy-form.utils.ts:52`) | CONFIRMED | an alias nobody imports (the matches are `createDefaultClockInPolicyFormModel`). Delete the alias line. |
| `SelectIcon` (`shared/ui/select/select.component.ts:22`) | CONFIRMED | used in that file only. Remove `export`. |
| `prettier`, `emoji-picker-element-data` | KEEP | already ignored in Task 1 |

- [ ] **Step 1: Delete the confirmed files**

```powershell
git rm src/app/core/config/build-info.ts src/app/core/config/feature-flags.ts
git rm -r src/app/modules/public/ui/landing-dashboard-preview src/app/shared/ui/metric-stat
```

In `docs/core/ARCHITECTURE.md`, delete the two tree lines `│   │   ├── build-info.ts` and `│   │   ├── feature-flags.ts`. They are around line 84. Check that the tree's `├──`/`└──` characters still line up.

- [ ] **Step 2: Check the orphaned capsule stylesheet before deleting it**

```powershell
git log --oneline -S "home-page-profile-capsule.component.css" -- src/app/shared/ui/home-page-profile-capsule
```

- If a commit **removed** a `styleUrl` pointing at it by mistake, so the component lost styles it still needs (compare the CSS selectors with the template's classes), re-link it with `styleUrl: './home-page-profile-capsule.component.css'`. Record that as "re-linked".
- If its styles moved elsewhere on purpose (inline `styles` or a parent stylesheet), `git rm` the file.

- [ ] **Step 3: Unused exports and types**

Apply the table's action for each of `inboxReference`, `CATEGORY_FIELD`, `STATUS_OPTIONS`, `EXCEPTION_ALERT_TYPE_LABELS`, `ClockInPolicyFormModel` and `SelectIcon`. Before each one:

```powershell
git grep -n "<Name>" -- src
```

- [ ] **Step 4: Gate, re-scan, report**

Run the per-batch gate, then rerun Knip. **Expected:** Knip lists only the SUSPECTED items: `problem-details.model.ts`, `appendReturnPath` and the 2 calendar types.

Fill the report's "Unused code" table with every row from the table above, including the final action. Add a line to "Skipped or reported to owners" for the calendar types.

- [ ] **Step 5: Commit**

```powershell
git add <each deleted or edited path> docs/core/ARCHITECTURE.md docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md
git commit -m "chore(cleanup): remove unused files, exports and types found by Knip"
```

---

### Task 3: Auth store, one session patch

**Files:**
- Modify: `src/app/core/auth/state/auth.store.ts`
- Test: `src/app/core/auth/state/auth.store.spec.ts` (existing)

`login`, `acceptLegalDocuments` and the other session methods each copy the same 11-field `patchState` from `toCurrentUserViewModel(dto)` (jscpd: lines 58-82 vs 184-210, 91-107, 125-141, 153-168). A new session field must be added to every copy, so these must change together.

- [ ] **Step 1: Run the existing spec as the safety net**

Run: `npx ng test --watch=false --include=src/app/core/auth/state/auth.store.spec.ts`
Expected: PASS. Note the test count.

- [ ] **Step 2: Add one helper above `signalStore(...)`**

```ts
/** The session fields every successful auth call copies from the current-user response. */
function sessionState(view: ReturnType<typeof toCurrentUserViewModel>) {
  return {
    authenticated: view.authenticated,
    email: view.email,
    employeeId: view.employeeId,
    permissions: view.permissions,
    activeModules: view.activeModules,
    managesPeople: view.managesPeople,
    legalAcceptanceRequired: view.legalAcceptanceRequired,
    pendingLegalDocuments: view.pendingLegalDocuments,
    workspaceSlug: view.workspaceSlug,
    redirectRequired: view.redirectRequired,
    continueUrl: view.continueUrl,
  };
}
```

If `toCurrentUserViewModel`'s return type is exported under a name (e.g. `CurrentUserViewModel`), use that name instead of `ReturnType<...>`.

- [ ] **Step 3: Replace each identical copy**

Replace each `patchState(store, { authenticated: view.authenticated, ... continueUrl: view.continueUrl, loading: false })` with:

```ts
patchState(store, { ...sessionState(view), loading: false });
```

- Replace **only** blocks whose field list is exactly these 11 fields plus `loading`.
- If a block sets different or extra fields, keep the extras: `{ ...sessionState(view), extraField: x, loading: false }`.
- If a block sets a field from somewhere other than `view`, leave that block as it is and note why in the commit body.
- Error paths stay unchanged. Each one has its own message, and the auth error handling is security-relevant.

- [ ] **Step 4: Gate and commit**

Run the per-batch gate. The auth store spec must show the same test count, all passing.

```powershell
git add src/app/core/auth/state/auth.store.ts docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md
git commit -m "refactor(auth): one session patch helper in AuthStore"
```

---

### Task 4: Work models, DTO vs model copies

**Files:**
- Modify: `src/app/modules/work/models/milestone.model.ts` and `src/app/modules/work/models/project.model.ts`, as Step 1 decides

jscpd clones:
- `models/dto/milestone.dto.ts:1-24` (`MyProjectMilestoneDto`) vs `models/milestone.model.ts:3-29` (`Milestone`)
- `models/dto/project.dto.ts:13-31` and `81-98` vs `models/project.model.ts:13-31` and `44-61`

- [ ] **Step 1: Decide per pair whether the split is deliberate**

ARCHITECTURE §5.1 rules 3-4 say models in `models/` match backend DTOs, and view models are mapped in the store or a mapper. A pair is a **merge** when both of these hold:
- the field lists are identical in names and types (`git diff --no-index` on the two extracted interfaces), and
- no mapper turns one into the other (`git grep -n "MyProjectMilestoneDto" -- src/app/modules/work` shows the API returns the DTO and the store hands it straight to UI typed as `Milestone`).

Otherwise it is **KEEP**. Write the reason in the report.

- [ ] **Step 2: Merge the identical ones**

For each merge, keep the DTO as the source and make the model an alias. Keep the model's JSDoc. For `Milestone`:

```ts
import { MyProjectMilestoneDto } from './dto/milestone.dto';

/**
 * A milestone row as the backend returns it (`MyProjectMilestoneDto`).
 * `isEffectiveOwner` is true only for the actual owner (or an ancestor's owner), never a plain
 * member, unlike `isOwner` (owner OR active member). Use it wherever a check must match the
 * backend's IsEffectiveOwnerAsync gate (e.g. task edit save-vs-request).
 */
export type Milestone = MyProjectMilestoneDto;
```

Do the same for each identical `project.model.ts` / `project.dto.ts` pair, using the real names found in Step 1.

- [ ] **Step 3: Gate and commit**

Run the per-batch gate with `--include "src/app/modules/work/**/*.spec.ts"` and `--include "src/app/modules/dashboard/feature/active-projects-card/**/*.spec.ts"` (dashboard imports these DTOs).

```powershell
git add <edited model files> docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md
git commit -m "refactor(work): alias models that duplicate their backend DTOs"
```

---

### Task 5: Organization twins (department / position / role)

**Files:** in `src/app/modules/organization/`. The biggest clones are below. The full list comes from `node -e` over `jscpd-report.json`, filtered to `organization`.

| Clone | Lines |
|---|---|
| `ui/department-archive-modal` vs `ui/position-archive-modal` (CSS) | 75 |
| `ui/position-access-modal` vs `ui/position-archive-modal` (CSS) | 51 |
| `state/department.store.ts:91-118,127-148` vs `state/position.store.ts:163-190,200-221` | 50 |
| `ui/department-list-table` vs `ui/position-list-table` (CSS) | 44 |
| `ui/department-archive-modal` vs `ui/role-archive-modal` (CSS) | 35 |
| `feature/department-management` vs `feature/position-management` (HTML) | 30 |

These are the same screens for three entities, so a visual or behaviour change must land in all of them.

- [ ] **Step 1: Print the organization clone list**

```powershell
node -e "const r=require('../cleanup-tools/reports/jscpd-fe/jscpd-report.json');for(const d of r.duplicates){const a=d.firstFile.name.replace(/\\/g,'/'),b=d.secondFile.name.replace(/\\/g,'/');if(a.includes('/organization/')&&b.includes('/organization/'))console.log(d.format,d.lines,a+':'+d.firstFile.start+'-'+d.firstFile.end,'<>',b+':'+d.secondFile.start+'-'+d.secondFile.end)}" | Sort-Object { [int]($_ -split ' ')[1] } -Descending
```

- [ ] **Step 2: Archive modals, one shared presentational component**

1. Read the department, position and role archive modal `.ts`, `.html` and `.css` side by side. List what differs: title text, the entity name, the impact lines and counts, the confirm button label, and emitted events.
2. Create `src/app/modules/organization/ui/archive-confirm-modal/`:
   - `archive-confirm-modal.component.ts` with `styleUrl`, `ChangeDetectionStrategy.OnPush`, signal `input()`s for each listed difference, and `output()`s named `confirmed` / `cancelled`. Never `confirm`/`cancel`/`close`: CLAUDE.md bans DOM event names.
   - `.html` and `.css` taken from the department version, with entity-specific text replaced by inputs. A11y rules: buttons are `<button>`, the backdrop is `role="presentation"`, Escape closes.
   - A `.spec.ts` covering:
     - title and impact rendering
     - `confirmed` on the confirm button
     - `cancelled` on the cancel button
     - `cancelled` on Escape
3. Make each of the three entity modals a thin wrapper that passes its values to `<app-archive-confirm-modal>`. Keep each wrapper's existing selector, inputs and outputs, so the management pages and their specs do not change.
   - If the role modal differs in structure, not just text (fewer sections, other actions), leave it out and say so in the report.
4. Run the existing specs of the three modals and the management pages. They must pass unchanged.

- [ ] **Step 3: List tables and stores**

- **List tables:** `department-list-table` vs `position-list-table` (CSS 44).
  - If both tables render the same column layout and row states, move the shared rules into one stylesheet owned by a shared `ui/org-list-table-shell` component only when the markup is also shared.
  - Otherwise leave them. Similar CSS alone is not enough.
  - Write the decision in the report.
- **Stores:** `department.store.ts` vs `position.store.ts`.
  - Read both clone ranges. If they are the same list/paging/error logic over a different API service, extract the shared part into a pure function in `modules/organization/utils/org-list-state.util.ts`, with a spec, and call it from both stores.
  - If the copies differ in error messages or in which state they reset, keep them.

- [ ] **Step 4: Gate and commit, one commit per sub-batch**

Run the per-batch gate with `--include "src/app/modules/organization/**/*.spec.ts"` after each sub-batch, and commit separately:
- `refactor(organization): shared archive confirm modal`
- `refactor(organization): ...` for the list tables or stores, only if they changed

Update the report's duplicate table after each commit.

---

### Task 6: Attendance styles and formatters

**Files:** in `src/app/modules/attendance/`.

| Clone | Lines |
|---|---|
| `time-tracking/attendance-history-list` vs `time-tracking/my-requests-panel` (CSS) | 95 |
| `feature/status-card` vs `time-tracking/time-tracking.component.css` | 57 |
| `feature/status-card` vs `time-tracking/attendance-detail-drawer` (CSS) | 46 |
| `utils/attendance-formatters.ts:48-66` vs `76-94`, and `13-20` vs `38-45` (self-copies) | 27 |

- [ ] **Step 1: Formatters first (pure TS, lowest risk)**

1. Read `utils/attendance-formatters.ts`. The two pairs of ranges are the same logic with a different input.
2. Extract a private helper in the same file that takes the varying part as a parameter, and make the exported functions call it.
3. Exported names and signatures stay the same.
4. Run `npx ng test --watch=false --include "src/app/modules/attendance/utils/**/*.spec.ts"`. If `attendance-formatters.spec.ts` does not exist, write one first that pins the current outputs of the affected functions for 3 inputs each, and see it pass **before** the refactor.

- [ ] **Step 2: History list vs my requests panel (CSS 95)**

1. Compare the two templates. If both render the same row list (same row structure, status pill and empty state), extract a presentational `ui/attendance-row-list/` component with `styleUrl`, inputs for rows and labels, and a spec. Use it from both, and remove the duplicated CSS.
2. If the templates differ and only the CSS matches, leave them and write "similar CSS only" in the report.
3. The status-card vs time-tracking/drawer CSS pairs get the same test. They merge only through a shared component, never a shared loose stylesheet.

- [ ] **Step 3: Gate and commit, one commit per sub-batch**

Run the per-batch gate with `--include "src/app/modules/attendance/**/*.spec.ts"`. Note that `time-tracking.component.spec.ts` has 2 base en-GB failures, which must stay exactly those 2.

Commits:
- `refactor(attendance): share formatter logic`
- `refactor(attendance): shared row list for history and requests`

---

### Task 7: Auth pages, shared form pieces

**Files:** in `src/app/core/auth/feature/`.

| Clone | Lines |
|---|---|
| `accept-invitation.component.html` vs `reset-password.component.html` | 64 |
| `accept-invitation.component.css` vs `login.component.css` | 34 |
| `accept-invitation.component.css` vs `reset-password.component.css` | 34 |
| `accept-invitation.component.css` vs `forgot-password.component.css` | 26 |

- [ ] **Step 1: Read the duplicated HTML range**

It is most likely the "new password + confirm + rules" block. If so, extract `src/app/core/auth/ui/new-password-fields/` (`.ts` with `styleUrl`, `.html`, `.css`, `.spec.ts`):
- It takes the parent's form controls as inputs, or uses `ControlContainer`, whichever the two pages already use.
- It renders the same labels, `for`/`id` pairs, error messages and rule hints.
- The parent pages keep their validators, submit logic and API calls. **Validation is not moved or changed:** it is auth input validation (guide §4.1, security).

If the duplicated range is not a self-contained block, leave it and say so in the report.

- [ ] **Step 2: Page shell CSS**

The four pages share card/heading/field styles. Move them into the auth layout only if every page renders inside `layouts/auth-layout` and the rules target the page's own markup classes. Otherwise leave them.

- [ ] **Step 3: Gate and commit**

Run the per-batch gate with `--include "src/app/core/auth/**/*.spec.ts"`. Commit as `refactor(auth): shared new-password fields`.

---

### Task 8: Checkpoint, re-measure

- [ ] **Step 1: Run jscpd, Knip and the full test suite**

```powershell
npx --yes jscpd@5.4.2 src --format typescript,css,markup --ignore "**/node_modules/**,**/*.spec.ts,**/*.testing.ts,**/*.generated.ts" --min-tokens 70 --reporters json,silent --output ..\cleanup-tools\reports\jscpd-fe
npx --yes knip@6.43.0 --config ..\cleanup-tools\knip.frontend.json --no-progress --no-exit-code
npx ng test --watch=false
```

- [ ] **Step 2: Decide**

- If duplicated lines are **≤ 2,785**, skip Task 9. Go to Task 10 and record that the dashboard was not touched.
- If they are **above** 2,785, stop and report the number to the controller. Task 9 runs **only after the user says the dashboard cards may be changed.** Without that, go to Task 10 and record the gap honestly.

---

### Task 9: Dashboard cards, use the existing `injectHostSize()` (only with the user's go-ahead)

**Files:**
- Modify: these 8 cards' `.component.ts` (and their specs only if needed):
  - `quick-actions-card`
  - `team-attendance-card`
  - `team-employee-forecast-card`
  - `team-module-forecast-card`
  - `team-plan-today-card`
  - `team-progress-card`
  - `team-work-task-card`
  - `today-at-a-glance-card`
- Modify: `docs/design/WIDGET_CREATION_RULES.md` line 47

`src/app/modules/dashboard/utils/host-size.util.ts` already has `injectHostSize()`, a ResizeObserver plus rAF host-size signal that disconnects on destroy. Four cards already use it: `team-schedule`, `team-status`, `weekly-progress` and `dashboard-summary-strip`. The 8 cards above still each carry their own copy of `observeSize()` / `stopObservingSize()` / `resizeObserver` / `frameId` / `pendingSize`.

**The spec trap:** under tests `ResizeObserver` is undefined, so `injectHostSize()` stays 0x0 forever, and the specs drive the card through the public `applySize(size)`.
- Feeding the signal into `applySize` must therefore skip 0x0, or the first effect run overwrites the size a spec set and flips the `measured` hysteresis state.
- It must also run `applySize` inside `untracked`, so reading `this.view()` there does not subscribe the effect.

- [ ] **Step 1: Build the per-card difference table first**

```powershell
foreach ($c in 'quick-actions','team-attendance','team-employee-forecast','team-module-forecast','team-plan-today','team-progress','team-work-task','today-at-a-glance') {
  $f = "src/app/modules/dashboard/feature/$c-card/$c-card.component.ts"
  "== $c"; Select-String -Path $f -Pattern 'applySize\(|observeSize|stopObservingSize|resolve\w+View|\.set\(' | ForEach-Object { "  $($_.LineNumber): $($_.Line.Trim())" }
  Select-String -Path ($f -replace '\.ts$','.spec.ts') -Pattern 'applySize\(' | Measure-Object | ForEach-Object { "  spec applySize calls: $($_.Count)" }
}
```

For each card, record:
- the view resolver it calls,
- what else `applySize` sets (e.g. `heroLegend`, `size`),
- whether `applySize` is public with a `size` parameter,
- whether specs call it.

Put the table in the report.

- [ ] **Step 2: Worked example, `team-employee-forecast-card`**

1. Delete the fields `resizeObserver`, `frameId` and `pendingSize`, and the methods `observeSize()` and `stopObservingSize()`.
2. In `ngOnInit`, delete `this.observeSize();`, and in its `onDestroy` delete `this.stopObservingSize();`. The visibility listener lines stay.
3. Change `applySize` to take its size explicitly. The body stays the same, minus the `pendingSize` lines:

   ```ts
   /** Public so a spec can drive a size without a ResizeObserver. */
   applySize(size: { width: number; height: number }): void {
     const view = resolveEmployeeForecastView(
       size.width,
       size.height,
       this.measured ? this.view() : null,
     );
     if (size.width > 0 && size.height > 0) this.measured = true;
     if (view !== this.view()) this.view.set(view);
     this.size.set({ width: size.width, height: size.height });
     this.heroLegend.set(
       size.width - EMPLOYEE_FORECAST_CARD_CHROME.width >= EMPLOYEE_FORECAST_HERO_LEGEND_WIDTH_PX,
     );
   }
   ```

4. Add the host-size feed: a field, plus an effect in the constructor. Create the constructor if there is none.

   ```ts
   private readonly hostSize = injectHostSize();

   constructor() {
     effect(() => {
       const size = this.hostSize();
       // 0x0 = the observer has not fired yet (and never does under tests, where specs call applySize).
       if (size.width === 0 && size.height === 0) return;
       untracked(() => this.applySize(size));
     });
   }
   ```

   Import `effect` and `untracked` from `@angular/core`, and `injectHostSize` from `../../utils/host-size.util`. If the `host` `ElementRef` field is now unused, delete it.

5. Run `npx ng test --watch=false --include "src/app/modules/dashboard/feature/team-employee-forecast-card/**/*.spec.ts"`. It must pass with no spec change.
   - If a spec called `applySize()` with no argument, pass the size it meant (the value it set earlier).
   - Never delete an assertion.

- [ ] **Step 3: The other 7 cards, the same steps**

Apply Step 2 to each card, using that card's own resolver and extra setters from the Step 1 table. Run each card's spec after editing it. A card whose `applySize` does something the pattern does not cover (for example it reads the DOM) stays as it is and gets a line in the report.

- [ ] **Step 4: Fix the rule that tells authors to copy the old code**

In `docs/design/WIDGET_CREATION_RULES.md` line 47, replace `(ResizeObserver + rAF, like the reference card's `observeSize/applySize`)` with:

```
(`injectHostSize()` from `modules/dashboard/utils/host-size.util.ts`, fed into the card's `applySize(size)` through an `effect` that skips 0x0 and runs `applySize` in `untracked`; see `team-employee-forecast-card`)
```

- [ ] **Step 5: Gate and commit**

Run the per-batch gate with `--include "src/app/modules/dashboard/**/*.spec.ts"`.

```powershell
git add <the 8 card .ts files and any changed specs> docs/design/WIDGET_CREATION_RULES.md docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md
git commit -m "refactor(dashboard): cards use injectHostSize instead of their own ResizeObserver"
```

---

### Task 10: Report, task status, final verification

**Files:**
- Modify: `docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md`
- Modify: `docs/Improvements/person-4-api-layer-and-cleanup/task-12 Remove duplicate and unused code.md`

- [ ] **Step 1: Final scans and suite**

```powershell
npx --yes knip@6.43.0 --config ..\cleanup-tools\knip.frontend.json --no-progress --no-exit-code
npx --yes jscpd@5.4.2 src --format typescript,css,markup --ignore "**/node_modules/**,**/*.spec.ts,**/*.testing.ts,**/*.generated.ts" --min-tokens 70 --reporters json,silent --output ..\cleanup-tools\reports\jscpd-fe
npm run check:warnings
node scripts/check-http-params.mjs
npx ng lint
node scripts/check-hardcoded-colors.mjs
npx ng test --watch=false
```

**Expected:**
- Knip lists only the SUSPECTED items.
- jscpd is at or below target, or the report states the gap.
- `check:warnings` is clean.
- The three lint scripts are at their base counts.
- `ng test` shows only the base failures, and none of the failing files are in `git diff --name-only origin/Development`.

- [ ] **Step 2: Finish the report**

Fill in:
- the final duplicate table row and percentage,
- every batch's decision (merged / kept, with the reason),
- the SUSPECTED list with the question for each:
  - `problem-details.model.ts`: adopt in task 20?
  - `appendReturnPath`: still needed?
  - the 2 calendar request types: wire or delete?
- the attendance stores already being gone,
- anything skipped because it was in an open PR or owned elsewhere.

- [ ] **Step 3: Task 12 status section**

Append to the task 12 file:

```markdown

## Status (2026-11-19)

- Report: `task-12-cleanup-report.md` (every Knip finding labelled, duplicate lines before/after per batch).
- Duplicate lines: 3,713 → [final] ([change]%) on the base `b019faf9` scan with generated files ignored.
- Removed: [files]. Kept on purpose: `prettier`, `emoji-picker-element-data` (used), and the SUSPECTED items listed in the report, which need an answer from their owners.
- Dashboard cards: [changed with the user's go-ahead / not touched].
```

- [ ] **Step 4: Commit**

```powershell
git add docs/Improvements/person-4-api-layer-and-cleanup/task-12-cleanup-report.md "docs/Improvements/person-4-api-layer-and-cleanup/task-12 Remove duplicate and unused code.md"
git commit -m "docs(cleanup): task 12 report and status"
```

---

## Done when (mapped to task 12)

| Task 12 "Done when" | Covered by |
|---|---|
| The scan shows no confirmed unused file or dependency | Tasks 1-2. Only SUSPECTED items remain, each with an open question. |
| Duplicate lines down by at least 25% | Tasks 3-7, plus Task 9 if the checkpoint needs it and the user agrees |
| Build and full test suite pass | Task 10. The base en-GB failures are pre-existing and listed. |
