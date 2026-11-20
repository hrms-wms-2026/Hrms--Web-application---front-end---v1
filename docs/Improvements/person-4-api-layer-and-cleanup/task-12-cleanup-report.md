# Task 12 cleanup report

Scans: Knip 6.43.0 and jscpd 5.4.2, commands from `docs/core/CODE_CLEANUP_GUIDE.md` §3 (generated files ignored).
Base: `f6e30e95` (2026-11-19).

## Lint baseline on the base

| Script | Base result |
|---|---|
| `node scripts/check-http-params.mjs` | Fails: 1 finding, `settings/data-access/support-tickets-api.service.ts` |
| `npx ng lint` | Fails: 7 a11y template errors in `calendar-page.component.html` and `planner-create-popover.component.ts` |
| `node scripts/check-hardcoded-colors.mjs` | Fails: `meeting-occurrence-drawer.component.ts` (6) and `meeting-link-panel.component.ts` (6) |

These failures exist before any cleanup change. They are not caused by this task.

## Duplicate lines

| After | Clones | Duplicated lines | Change vs base |
|---|---|---|---|
| Base | 283 | 3,713 | |
| After Task 2 | 283 | 3,713 | 0% (deleted files held no clones) |
| After Task 3 | 278 | 3,622 | -2.5% |
| After Task 4 | 277 | 3,604 | -2.9% |
| After Task 5a | 259 | 3,401 | -8.4% |
| After Task 5b | 259 | 3,401 | -8.4% (decisions only, no code change) |
| After Task 6a | 257 | 3,375 | -9.1% |
| After Task 6b | 253 | 3,223 | -13.2% |
| After Task 7 | 252 | 3,173 | -14.5% |
| After Task 9 | 250 | 3,073 | -17.2% |
| Target | | ≤ 2,784 | -25% |

Duplicated lines by module at base (counted by the first file of each clone):

| Module | Lines |
|---|---|
| dashboard | 1,558 |
| organization | 602 |
| attendance | 353 |
| core | 343 |
| people | 236 |
| shared | 176 |
| work | 171 |
| calendar | 83 |
| layouts | 49 |
| leave | 42 |
| settings | 42 |
| other | 23 |
| profile | 21 |
| public | 14 |
| **Total** | **3,713** |

## Unused code (Knip)

| Item | Label | Reason | Action taken |
|---|---|---|---|
| `core/config/build-info.ts` | CONFIRMED | Only named in the ARCHITECTURE §2 tree | Deleted, tree line removed |
| `core/config/feature-flags.ts` | CONFIRMED | Only named in the ARCHITECTURE §2 tree | Deleted, tree line removed |
| `modules/public/ui/landing-dashboard-preview/` | CONFIRMED | Selector and class referenced nowhere (src, angular.json, routes, widget registry) | Deleted folder (`.ts`, `.css`, `.html`; no spec) |
| `shared/ui/metric-stat/metric-stat.component.ts` | CONFIRMED | Selector and class referenced nowhere | Deleted folder (single file) |
| `shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.css` | Checked | Commit `2cb57529` replaced `templateUrl`/`styleUrl` with an inline `<app-avatar>` template on purpose; the `.profile-capsule` class is not used by the live template | Deleted the CSS (not re-linked). The `.html` next to it was also orphaned (Knip does not see `.html`), so it was deleted in a follow-up commit |
| `shared/models/problem-details.model.ts` | SUSPECTED | Task 20 may adopt it as the shared error model | Kept |
| `appendReturnPath` | SUSPECTED | Return-path safety code, see owners list | Kept |
| `RespondToCalendarEventRequest`, `UpdateCalendarConnectionRequest` | SUSPECTED | Backend request shapes for endpoints that may not be wired yet | Kept |
| `inboxReference` | CONFIRMED | Declared once in `inbox-item.util.ts`, not used even in that file | Deleted (not just un-exported) |
| `CATEGORY_FIELD` | CONFIRMED | Declared once, not used in that file either | Deleted |
| `STATUS_OPTIONS` (organization) | CONFIRMED | Declared once, not used in that file; other modules have their own | Deleted |
| `EXCEPTION_ALERT_TYPE_LABELS` | CONFIRMED | No match outside its declaration | Deleted |
| `ClockInPolicyFormModel` | CONFIRMED | Deprecated alias nobody imports | Deleted alias and its `@deprecated` comment |
| `SelectIcon` | CONFIRMED | Declared once, not used even in `select.component.ts` (the component uses `FieldIcon` directly) | Deleted (not just un-exported) |
| `prettier`, `emoji-picker-element-data` | KEEP | Ignored in Task 1 | No change |

### Raw Knip output (base)

No dependency findings. Knip also hints that the `ignore` pattern for generated api-types matches nothing yet (the task 08 file is not on this branch); this is expected.

Unused files (7)

- `src/app/core/config/build-info.ts`
- `src/app/core/config/feature-flags.ts`
- `src/app/modules/public/ui/landing-dashboard-preview/landing-dashboard-preview.component.css`
- `src/app/modules/public/ui/landing-dashboard-preview/landing-dashboard-preview.component.ts`
- `src/app/shared/models/problem-details.model.ts`
- `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.css`
- `src/app/shared/ui/metric-stat/metric-stat.component.ts`

Unused exports (5)

- `appendReturnPath` (function) `src/app/core/auth/utils/safe-return-path.ts:20`
- `inboxReference` (function) `src/app/modules/inbox/utils/inbox-item.util.ts:94`
- `CATEGORY_FIELD` `src/app/modules/inbox/utils/inbox-item.util.ts:156`
- `STATUS_OPTIONS` `src/app/modules/organization/utils/general-settings-options.ts:84`
- `EXCEPTION_ALERT_TYPE_LABELS` `src/app/shared/models/exception-evidence.model.ts:7`

Unused exported types (4)

- `RespondToCalendarEventRequest` (interface) `src/app/modules/calendar/models/calendar-event.model.ts:105`
- `UpdateCalendarConnectionRequest` (interface) `src/app/modules/settings/models/calendar-connection.model.ts:37`
- `ClockInPolicyFormModel` (type) `src/app/modules/settings/utils/clock-in-policy-form.utils.ts:52`
- `SelectIcon` (type) `src/app/shared/ui/select/select.component.ts:22`

## Skipped or reported to owners

- `RespondToCalendarEventRequest` and `UpdateCalendarConnectionRequest` (calendar/settings owner): backend request shapes with no caller. Wire the endpoints or delete the types?
- `shared/models/problem-details.model.ts` (task 20 owner): unused today. Adopt it as the shared error model or delete?
- `appendReturnPath` (auth owner): still needed? It adds a `return_path` query parameter to a continue URL, but only after `parseSafeReturnPath` accepts it (same origin, `/device/activate` with one `request_id` and one `user_code`). It came in with the tray device-activation gate (`2179d23e`) and nothing calls it yet.

## Batch decisions
- Task 3, auth store: merged. All 5 session `patchState` blocks (`login`, `acceptLegalDocuments`, `acceptEmployeeInvitation`, `checkSession`, `exchangeSession`) carried the same 11 fields plus `loading`, so they now use one `sessionState(view)` helper typed with `CurrentUserViewModel`. A new session field is added in one place. Error paths unchanged. `auth.store.spec.ts`: 18 tests before and after.
- Task 4, work models: `CreateProjectPayload` and `EditProjectPayload` merged into aliases of `CreateProjectRequestDto` and `EditProjectRequestDto`. Field lists are identical (names, types, optionality), and no mapper sits between them: the form emits the payload and `ProjectListStore` passes it straight to `ProjectApiService`.
- Task 4, `Milestone` vs `MyProjectMilestoneDto`: kept. Fields are identical, but `toMilestone` in `project.mapper.ts` converts one to the other, and the store maps every response through it. Merging would mean removing that mapper step, which is outside this batch.
- Task 4, `Project` / `ProjectDetail` vs `ProjectListItemDto` / `ProjectDetailDto`: kept. `toProject` and `toProjectDetail` map them, and normalise `icon` and `systemPurpose` (`?? null`). The model also names its own `ProjectLabel` and `ProjectMemberAvatar` types.
- Task 5a, organization archive modals: merged. Department, position and role archive modals had the same shell (backdrop, header, impact grid, alerts, footer) with only texts and counts changed, so they now wrap one `ui/archive-confirm-modal` (inputs: entity type and name, subtitle, impacts, blocker messages, clear and warning messages; outputs `confirmed`/`cancelled`). Wrappers keep their selectors, inputs and outputs, so the management pages are unchanged. Differences kept as inputs: 3 vs 2 impact cards (grid now one column per card, same layout), backend blocker messages (department) vs fixed ones (position), position body `scroll-fade`, role has no dependency check and shows a warning alert. One intended addition: Escape now cancels (not while saving), as CLAUDE.md asks for modal backdrops. Organization specs: 23 files / 283 tests before, 24 / 292 after (9 new). `position-access-modal`: kept, similar CSS only (different header, form body, `closed`/`saveAccess` outputs).
- Task 5b, `department-list-table` vs `position-list-table`: kept. The markup is not shared: different columns (status badge vs capacity seat preview), different row states (position has vacant-row highlighting and row titles), and different actions (department opens an Edit/Archive/Restore menu, position opens the detail panel). The shared CSS is the action button and menu rules only. Note for a later unused-code pass: `position-list-table.component.css` still holds `.plt-menu*` rules that its template no longer renders; its spec asserts `.plt-menu` is absent.
- Task 5b, `department.store.ts` vs `position.store.ts`: kept. The `load()` copies differ in the error message ("Failed to load departments." / "Failed to load positions."), the tree API call (options object vs boolean) and result shape (`res.treeItems` vs `res`), and the flat query (`view: 'flat'` vs `departmentId`). The setter clones (patch, then reload the current legal entity) call `this.load`, so they are not a pure function; position also has an extra department filter. Under the plan's rule (differing error messages) both stay.
- Task 5b, `department-management` vs `position-management` HTML (expandable search block): kept. It is the same UI, but the same block also lives in `roles-management`, `position-template-drawer` and people `employee-list`, so a shared piece would belong in `shared/ui`, outside this organization batch. The page CSS and specs also key on the page prefixes (`.pm-search-container`, `.pm-search-expandable input` in `position-management.component.spec.ts`), and department adds a phone-only search the others lack.
- Task 6a, `attendance-formatters.ts`: merged. `fullDateLabel` and `formatDate` differed only in the `Intl` options, and `formatDateTime` and `formatClockTime` differed only in `hour12`, so each pair now calls a private helper (`formatUtcDateOnly`, `formatTimeInZone`). Exported names and signatures are unchanged. The spec was extended first (impossible calendar dates, bad ISO, invalid timezone, a second timezone) and passed against the old code before the refactor.
- Task 6b, `attendance-history-list` vs `my-requests-panel`: partly merged. The two tables are not the same row list (history has employee/date/clock columns, a status pill with notes and row selection; requests has tabs, correction and work-area columns, cancel actions and a different pill), so no shared row-list component was made ("similar CSS only" for the table, pill and note rules, which stay). The same empty-state box, error banner with retry and Previous/Next footer do appear in both (twice in the panel), so they became `ui/attendance-empty-state`, `ui/attendance-error-banner` and `ui/attendance-list-pager`, each with a spec. Class names (`tt-pagination*`, `time-tracking-message`, `empty-state-box`) are kept. The work-area pager keeps its extra disable-while-loading through `busy`.
- Task 6b, `status-card` vs `attendance-detail-drawer` CSS (status pill): kept. It is the same pill, but merging needs a shared component that carries two hard-coded dot colours (`#10b981`, `#f59e0b`) and the hex-colour check then fails on the new file. The theme tokens differ from these values in light mode (`--color-warning` is `#d97706`), so swapping them would change the look. Not merged; no baseline was raised.
- Task 6b, `status-card` vs `time-tracking.component.css`: the status-pill rules in `time-tracking.component.css` were dead (no `status-pill` element in its template or class), so they were deleted.
- Task 7, `accept-invitation` vs `reset-password` HTML (new password + confirm block): merged into `core/auth/ui/new-password-fields` (OnPush, `ControlContainer` from the parent `FormGroupDirective`, inputs `passwordPlaceholder` and `confirmPlaceholder`). The two blocks were identical apart from the placeholders ("Password" / "Confirm password" vs "New password" / "Confirm new password") and the page-prefixed wrapper and error classes. Parents keep the form, the validators (`required`, `minLength(8)`, mismatch check in `submit()`), the submit logic and the API calls; they only lost the two show/hide signals and toggle methods, which moved into the new component (no spec used them). Ids (`password`, `confirmPassword`), error texts, aria-labels and the `ui-field` classes are unchanged. The new component re-checks on the parent group `events` because `markAllAsTouched()` and `setErrors()` run in the parent and would not refresh an OnPush child. The wrapper and error classes became `new-password-field` and `new-password-error` (no spec queried the old names). `core/auth` specs: 17 files / 158 tests before, 18 / 163 after (5 new).
- Task 7, auth page shell CSS (`accept-invitation` vs `login`, `reset-password`, `forgot-password`): kept. Each page styles its own markup with page-prefixed classes (`invite-`, `reset-`, `login-`, `forgot-`), and with emulated encapsulation `layouts/auth-layout` cannot style a child page's elements, so there is no owner to move the rules to. A shared stylesheet would break the rule against loose shared CSS, and a shared card/heading component would rename classes the pages style and change spacing details per page. What remains are the page title/subtitle, state-box and button rules, which are similar CSS only.
- Task 9, dashboard cards: 6 of the 8 now use `injectHostSize()` and lost their own `observeSize()` / `stopObservingSize()` / `resizeObserver` / `frameId` / `pendingSize`. Difference table:

  | Card | View resolver | `applySize` also sets | `applySize` public | Spec calls `applySize` | Result |
  |---|---|---|---|---|---|
  | `team-employee-forecast` | `resolveEmployeeForecastView` | `size`, `heroLegend` | yes | 1 | converted |
  | `team-module-forecast` | `resolveModuleForecastView` | `size`, `heroLegend` | yes | 1 | converted |
  | `team-work-task` | `resolveTeamWorkTaskView` | `size`, `heroLegend` | yes | 1 | converted |
  | `team-attendance` | `resolveTeamAttendanceView` | `size`, `heroLegend` | no | 0 | converted |
  | `team-progress` | `resolveTeamProgressMode` | `size`, `mode` | no | 0 (drives a fake ResizeObserver) | converted |
  | `team-plan-today` | none (height < 300px = compact) | `compact` | n/a | 0 (sets `compact`) | converted |
  | `quick-actions` | none | measures inner `content` / `list` elements | n/a | 0 | kept: observes a child element and reads the DOM, not the host size |
  | `today-at-a-glance` | none | `fitCanvas` | n/a | 0 | kept: measures the host synchronously after first render (`clientWidth`), the helper would add a frame of 0x0 |

  Each converted card feeds the signal into its `applySize(size)` from a constructor `effect` that skips 0x0 and runs `applySize` in `untracked`. Spec change: `team-progress-card.component.spec.ts` "coalesces several size reports" now calls `fixture.detectChanges()` after `flushFrames()`, because the size reaches the layout through an effect; no assertion removed. `docs/design/WIDGET_CREATION_RULES.md` now points authors at `injectHostSize()` instead of the copied observer. Dashboard specs: 116 files / 1,167 tests pass; `check:warnings` clean; ESLint clean on the changed files.
