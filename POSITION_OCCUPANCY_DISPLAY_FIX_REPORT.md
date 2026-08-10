# Position Occupancy Display Fix — Report

## Root cause

Both position UI components inferred occupancy instead of displaying only what the backend actually knows:

```ts
pos.currentOccupancy ?? (getStatusBadge(pos).type === 'occupied' ? 1 : 0)
```

and `getStatusBadge`/`statusBadge` treated **every unique position with `maxOccupancy === 1`** as `Occupied`, regardless of whether anyone was actually assigned to it. `maxOccupancy` is capacity, not an assignment count, and the backend has no `position_assignments` table yet — `currentOccupancy` is always `null` today (see `PositionListItemResponse.cs` comment). The old code silently turned that `null` into a fabricated `1`, so every vacant unique position rendered as `1/1 Occupied`, and every pooled position rendered as `0/N Available capacity` even though "0" was never actually measured.

## Backend contract (verified, not assumed)

- `PositionListItemResponse.cs`: `int? CurrentOccupancy, bool CurrentOccupancyCheckSupported` — both are **always `(null, false)`** today; the comment states no `position_assignments` table exists anywhere in the codebase.
- `PositionTreeNodeResponse.cs`: has **no occupancy field at all**. Tree responses never carry a count.

So today, on both the flat list and the tree, occupancy is unconditionally unknown. The fix makes the frontend represent that honestly instead of guessing — it does not (and cannot) recover real assignment data, since none exists on the backend yet.

## Files changed

- **`src/app/modules/organization/utils/position-occupancy.ts`** (new) — pure helper `resolvePositionOccupancy(input)`. Single source of truth for capacity text, status label/type, `occupancyKnown`, and an `capacityAriaLabel` for screen readers. Archived (`isActive === false`) always wins the status; occupancy is only ever "known" when `currentOccupancyCheckSupported !== false` **and** `currentOccupancy` is a finite number (not `null`/`undefined`).
- **`src/app/modules/organization/utils/position-occupancy.spec.ts`** (new) — 13 unit tests covering every required case (null, 0, capacity-reached, pooled below/at capacity, archived precedence, `currentOccupancyCheckSupported=false` with a malformed count present, missing field defaulting to "supported", no backend field-name leakage).
- **`src/app/modules/organization/models/position.model.ts`** — `PositionListItemResponse.currentOccupancy` changed from `number | undefined` to `number | null | undefined` (matches `int?`), added `currentOccupancyCheckSupported?: boolean`. `PositionTreeNodeResponse.currentOccupancy` made `number | null | undefined` (still optional — the backend does not send it, and the helper already treats absence as unknown).
- **`src/app/modules/organization/ui/position-list-table/position-list-table.component.ts` + `.html` + `.css`** — `getStatusBadge()` replaced with `getOccupancy()` calling the shared helper; the capacity `<td>` and status `<td>` now bind purely to the helper's output (`capacityText`, `capacityAriaLabel`, `statusLabel`, `statusType`); the old `!pos.isActive` branch that special-cased "Archived" is removed — archived precedence now lives only in the helper. Added `.plt-badge--full` and `.plt-badge--unknown` CSS modifiers (reusing existing color tokens, no new hardcoded theme colors). Row-level `@let occupancy = getOccupancy(pos)` avoids recomputing per binding.
- **`src/app/modules/organization/ui/position-tree-node/position-tree-node.component.ts` + `.html` + `.css`** — `statusBadge` getter replaced with `occupancy` getter using the same shared helper. The bottom-row status pill is now suppressed entirely when `occupancy.statusType === 'archived'`, because the tree card already shows an "Archived" badge in the name row — this avoids showing "Archived" twice while still satisfying "Archived takes precedence over Occupied/Vacant/Full/Unassigned." Added `.ptn-status-pill--full` / `--unknown` modifiers, plus `flex-wrap`/`white-space: normal` on the bottom row so the longer "Capacity tracking unavailable" label wraps instead of overflowing the fixed-width (270px) card.

## Labels used for unknown occupancy

- Unique position, occupancy unknown: **"Unassigned"** (`statusType: 'unassigned'`), capacity shown as `—/{maxOccupancy}` (e.g. `—/1`).
- Pooled position, occupancy unknown: **"Capacity tracking unavailable"** (`statusType: 'unknown'`), capacity shown as `—/{maxOccupancy}` (e.g. `—/5`).
- Archived position (any type): **"Archived"** (`statusType: 'archived'`) always wins, regardless of occupancy data.
- Both muted/neutral badge styling (reusing the existing `--color-text-secondary` token, same visual weight as the pre-existing "Archived" badge) — not alarming, per the requirement.
- No backend field names (`currentOccupancy`, `currentOccupancyCheckSupported`) are ever rendered; verified by a dedicated unit test.

## Whether the backend currently provides occupancy

**No.** `PositionListItemResponse.CurrentOccupancy` is always `null` and `CurrentOccupancyCheckSupported` is always `false` today (no `position_assignments` table exists). `PositionTreeNodeResponse` never sends an occupancy field at all. The frontend fix is fully forward-compatible: the moment the backend starts returning real numbers, `resolvePositionOccupancy` will render them correctly (verified by the "known" test cases: `0/1 Vacant`, `1/1 Occupied`, `3/5 Available capacity`, `5/5 Full`) with no further frontend changes required.

## Tests run

From `C:\onevoNew\Hrms--Web-application---front-end---v1`:

- `npx ng test --include=src/app/modules/organization/utils/position-occupancy.spec.ts --watch=false` → 13/13 passed.
- `npx ng test --include=src/app/modules/organization/ui/position-list-table/position-list-table.component.spec.ts --watch=false` → 9/9 passed.
- `npx ng test --include=src/app/modules/organization/ui/position-tree-node/position-tree-node.component.spec.ts --watch=false` → 5/5 passed, including a cross-component test that renders equivalent unique/unknown input through both `PositionTreeNodeComponent` and `PositionListTableComponent` and asserts identical status text ("Unassigned", `—/1`) — directly covering the "flat table and tree render the same status for equivalent inputs" requirement.
- `npx ng test --include=src/app/modules/organization/**/*.spec.ts --watch=false` → **115/115 passed** (including the fixed `organization.routes.spec.ts`, see below).
- `npx ng test --watch=false` (whole app) → 358/376 passed. The remaining 18 failures span `error.interceptor.spec.ts`, `side-navbar.component.spec.ts`, `top-navbar.component.spec.ts`, `landing-page.component.spec.ts`, and `landing-header.component.spec.ts` — all in files with **pre-existing uncommitted WIP changes already present before this task started** (`error-handler.service.ts`, `notification.service.ts`, `main-layout.component.*`, etc., per `git status --short` at task start). None touch position/occupancy code; not introduced by this change.

### Bonus fix: `organization.routes.spec.ts` (requested separately, not part of the original occupancy task)

The user asked, after reviewing the initial report, whether the 4 `organization.routes.spec.ts` failures ("Cannot match any routes. URL Segment: 'dashboard'") could also be fixed. Root cause: `ORGANIZATION_ROUTES` gates both routes with `canActivate: [permissionGuard]` (`permission.guard.ts:27` redirects to `/dashboard` when `PermissionService.hasAnyPermission(['org:read'])` is `false`). The spec never provided a `PermissionService` stub, so in the isolated test router — which only registers `ORGANIZATION_ROUTES`, not `/dashboard` — the guard always redirected into a route that didn't exist in the test, throwing `NG04002`. Not an app bug; a stale test that predated `permissionGuard` being added to these routes. `src/app/app.routes.spec.ts` (Settings routes) already had the fix for the identical situation: stub `PermissionService` with `{ hasAnyPermission: () => true, hasAnyModule: () => true, hasPermission: () => true }`. Applied the same stub to both `describe` blocks in `organization.routes.spec.ts` — test-file-only change, no production/guard code touched. Result: 4/4 passing, no regressions (organization suite 115/115, whole-app suite 358/376 with the same pre-existing-WIP failures as before minus these 4).
- `npx ng build` → succeeds, no errors. Only CSS-budget warnings (4kB/component soft limit, not a build failure). `landing-hero` and `position-management.component.css` (4.79 kB, unmodified by this change) were already over budget on the baseline. `position-tree-node.component.css` was already over budget before this change too (6.12 kB); this change's `flex-wrap`/`white-space: normal` addition (needed so the longer "Capacity tracking unavailable" label wraps instead of overflowing the fixed-width tree card) adds it to 6.19 kB — a further ~70 bytes, not newly caused, but not shrunk either. Still a warning, not a build error.
- `git diff --check` on all changed position files → clean, no whitespace errors.

**Note:** `package.json` only defines a single `"test": "ng test"` script — there is no separate script per component. Filtering was done via `ng test --include=<glob>`.

## Manual verification

Attempted via the `claude-in-chrome` browser tool, but the browser extension was not connected in this environment ("Browser extension is not connected"), so an interactive click-through of Organization → Positions (flat and tree views) against a live dev tenant could **not** be completed in this session. This is a genuine gap, not a claimed pass — automated coverage above proves the logic and rendering are correct via component-level DOM assertions, but a real-browser pass (confirming visual layout, no console errors, and CSS wrapping on the longer "Capacity tracking unavailable" pill in the 270px tree card) is still recommended before sign-off. The frontend dev server (port 4200) and what is presumably the backend (port 7229, matching `environment.ts`'s documented HTTPS dev setup) both appeared to already be listening in this sandbox, so a manual pass should be quick to run separately.

## Remaining limitation

Employee-to-position assignment is **not implemented** anywhere in this codebase (no `position_assignments` table, no assignment API, no "Assign person" UI — the last was explicitly out of scope for this task). This means occupancy will continue to render as "Unassigned" / "Capacity tracking unavailable" for every position until that feature is built on the backend and the `currentOccupancy` / `currentOccupancyCheckSupported` fields start carrying real data — at which point no further frontend changes are needed, per the "known occupancy" tests above.

## Explicitly not touched

Per task scope: `HRMS-Backend-v1`, `OneVo-HR`, employee assignment schema/API, position assignment behavior, management coverage behavior, and position capacity validation rules were not modified. Pre-existing unrelated uncommitted changes on this branch (`error-handler.service.*`, `notification.service.ts`, `main-layout.*`, `company-selector.component.ts`, `department-management.component.ts`, `general-settings.*`, `role.store.ts`, `department.store.ts`, `general-settings.store.ts`, `legal-entity.store.ts`, the new `shared/ui/toast/` directory, and the two other report `.md` files already present) were left untouched and unstaged, as instructed. No commits, resets, or pushes were made.
