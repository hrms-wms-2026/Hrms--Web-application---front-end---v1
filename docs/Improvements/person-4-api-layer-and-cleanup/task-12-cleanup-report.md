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
| `shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.css` | Checked | Commit `2cb57529` replaced `templateUrl`/`styleUrl` with an inline `<app-avatar>` template on purpose; the `.profile-capsule` class is not used by the live template | Deleted the CSS (not re-linked). The `.html` next to it is also orphaned (Knip does not see it); left for the owner |
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
- `home-page-profile-capsule.component.html` is orphaned after the inline-template change (`2cb57529`); the owner can delete it.
