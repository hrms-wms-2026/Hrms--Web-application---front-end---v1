# Leave Management (Frontend) — Design

**Status:** Approved 2026-08-21. Companion to the backend's `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-21-leave-management-design.md`. Source of truth for product behaviour: `C:\HR\leave-management-complete.md`.

**Supersedes:** the Leave section of `2026-08-17-attendance-leave-management-design.md` (see that file's own superseded-notice header) — this repo's earlier sketch was HR-admin-only, mocked, list+approve/reject only, built before the full product spec existed. That sketch is replaced entirely, not extended; the Attendance section of that older file is untouched.

## Scope

Full 9-screen product (My Balances, New Request, Team Balances/Approvals, HR Configuration for Types/Policies/Entitlements/All Requests/All Balances, Team Calendar) — not the narrower HR-only slice from the superseded sketch. Built phase-by-phase alongside the backend; each frontend phase ships against that phase's real backend endpoints (no mocked-data phase this time — the backend design is real and dated the same day, unlike the 2026-08-17 sketch which had no backend to build against yet).

## Nav structure decision

No new nav parent or module key. `nav-items.config.ts:73-79` already has:
```ts
{ id: 'time-off', label: 'Time Off', icon: 'time-off', path: '/time-off', requiredModules: ['leave'] }
```
This becomes a parent with `children`, mirroring the existing `organization` item's pattern (`nav-items.config.ts:87-110`):

```ts
{
  id: 'time-off',
  label: 'Time Off',
  icon: 'time-off',
  path: '/time-off',
  requiredModules: ['leave'],
  children: [
    { id: 'time-off-my', label: 'My Leave', path: '/time-off', requiredModules: ['leave'] },
    { id: 'time-off-team', label: 'Team', path: '/time-off/team', requiredModules: ['leave'], requiredPermissions: ['leave:read-team'] },
    { id: 'time-off-calendar', label: 'Calendar', path: '/time-off/calendar', requiredModules: ['leave'] },
    { id: 'time-off-types', label: 'Leave Types', path: '/time-off/types', requiredModules: ['leave'], requiredPermissions: ['leave:manage'] },
    { id: 'time-off-policies', label: 'Policies', path: '/time-off/policies', requiredModules: ['leave'], requiredPermissions: ['leave:manage'] },
    { id: 'time-off-entitlements', label: 'Entitlements', path: '/time-off/entitlements', requiredModules: ['leave'], requiredPermissions: ['leave:manage'] },
    { id: 'time-off-all', label: 'All Requests', path: '/time-off/all', requiredModules: ['leave'], requiredPermissions: ['leave:read'] }
  ]
}
```
Nav gating is UX only (frontend skill rule) — the backend's `leave:*` permission checks are the real boundary; a user without `leave:manage` who hits `/time-off/types` directly gets a real 403 from the API, the route just doesn't show the link.

**Phasing hazard (found executing Phase 1, 2026-08-24):** the full list above is only safe to add as one complete set. `canAccessNavItem()` (`nav-items/nav-access.ts`) makes any item with a non-empty `children` array require `selfOk && children.some(reachable)` — so adding `children` incrementally, one phase at a time, is **not safe** unless the first child added is one every employee can reach (`time-off-my`, gated only on the module, since `leave:read-own` is automatic). Phase 1 shipped only the `leave:manage`-gated `time-off-types` screen and correctly did **not** add `children` yet (confirmed via `nav-access.spec.ts`'s existing Time Off test — adding just that one child made the entire item disappear for non-HR employees). Whichever phase adds `children` for the first time must include `time-off-my` in that same change, even if its target route is still a stub, or must wait until Phase 3 ships it for real.

## Module structure

Follows the `organization` module's file layout exactly (see `department-api.service.ts` / `department.store.ts` / `department-management.component.ts` / `department-list-table.component.ts` / `department-form-modal.component.ts` as the reference pattern for every sub-screen below):

```
src/app/modules/leave/
  models/
    leave-type.model.ts
    leave-policy.model.ts          (Phase 2)
    leave-entitlement.model.ts     (Phase 3)
    leave-balance.model.ts         (Phase 3)
    leave-request.model.ts         (Phase 4)
  data-access/
    leave-type-api.service.ts
    leave-policy-api.service.ts        (Phase 2)
    leave-entitlement-api.service.ts   (Phase 3)
    leave-balance-api.service.ts       (Phase 3)
    leave-request-api.service.ts       (Phase 4)
  state/
    leave-type.store.ts
    leave-policy.store.ts          (Phase 2)
    leave-entitlement.store.ts     (Phase 3)
    leave-balance.store.ts         (Phase 3)
    leave-request.store.ts         (Phase 4)
  feature/
    leave-types-management/        (Phase 1, this plan's Part 1)
    policy-management/             (Phase 2)
    entitlements-management/       (Phase 3)
    my-balances/                   (Phase 3)
    team-balances/                 (Phase 3)
    new-request/                   (Phase 4)
    pending-approvals/             (Phase 5)
    requests-list/                 (Phase 5)
    team-calendar/                 (Phase 7)
  ui/
    leave-type-list-table/         (Phase 1)
    leave-type-form-modal/         (Phase 1)
    ... one ui component pair per feature screen, added per-phase
  leave.routes.ts
```

Real `HttpClient` calls from the start (no mock-data phase) — `leave-type-api.service.ts` targets `${environment.apiUrl}/leave/types`, matching `DepartmentApiService`'s pattern exactly (see backend design doc for the full route table as each phase adds endpoints).

## Testing

`.spec.ts` alongside each new file (Vitest), matching the `organization` module's existing 1:1 convention (`department-api.service.spec.ts` doesn't exist for Department's own api service in the current repo, but `legal-entity-api.service.spec.ts`/`position-api.service.spec.ts` do — write one for `leave-type-api.service.ts` regardless of that inconsistency, since state-transition specs like `department.store.ts`'s pattern are the higher-value target and this repo's own convention statement calls for co-located specs on every new file).

## Phases

See `plans/next/2026-08-21-leave-management/SUMMARY.md` for the full frontend phase breakdown — one frontend phase per backend phase from the backend's own index, same numbering.
