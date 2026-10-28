# Tray App Employee Access Toggle — Frontend Design

## Problem

The backend (see `HRMS-Backend-v1`'s companion spec,
`docs/superpowers/specs/next/2026-08-25-tray-app-employee-access-toggle-backend-design.md`) adds a
per-employee `TrayAppAccessEnabled` flag and a
`POST /api/v1/employees/{id}/tray-app-access` endpoint to toggle it, plus a new
`trayAppAccessEnabled` field on `GET /employees/{id}/detail`. There is currently no frontend UI
to view or change this flag.

## Scope

A single toggle on the existing Employee Detail page, visible only to users holding
`employees:write` (the same permission already gating "Transfer / Promote" on that page — no new
permission code). No new page, no bulk-management list (per the earlier scope decision — Phase A
stays on the employee detail screen).

## Location

`src/app/modules/people/feature/employee-detail/employee-detail.component.ts` — the header
actions row (currently holds the "Transfer / Promote" popover and the conditional
"Resend invitation" button, lines 93-113). The toggle sits in that same row, always visible when
the permission check passes (not conditional on tab, invitation status, or read-only state the
way "Transfer / Promote" is — this is a security-relevant control, not a workflow action, so it
stays reachable regardless of what onboarding/offboarding state the employee is in).

## UI

A plain labeled checkbox — matching this codebase's existing convention for standalone toggles
(see `clock-in-policy-form.component.html`'s `<input type="checkbox">` usage; there is no shared
`shared/ui` toggle/switch component, and this is a single-use control, so introducing one would
be premature). Label: "Tray App Access". Checked state reflects
`employee.trayAppAccessEnabled` from the already-loaded `EmployeeDetailResponse` — no separate
fetch. Disabled while a toggle request is in flight.

## Data flow

- `PeopleApiService.setTrayAppAccess(employeeId, enabled)` → `POST /employees/{id}/tray-app-access`,
  body `{ enabled }`, matching `resendInvitation`'s call shape exactly.
- `EmployeeDetailResponse` (frontend model, `models/employee.model.ts`) gains
  `readonly trayAppAccessEnabled: boolean` as the last field, matching the backend DTO's field
  order.
- On toggle: optimistic UI is not used — the component sets a local `trayAppAccessUpdating`
  signal, awaits the API call, then calls `load()` to re-fetch the authoritative employee detail
  (same pattern `resendInvitation` and `onPositionChanged` already use), and shows a
  `NotificationService.success`/`.error` message.

## Error handling

The global `error.interceptor.ts` + `ErrorHandlerService` already show a banner for every HTTP
failure status (`403: 'You do not have access to perform this action.'`, etc.) — this toggle
follows the same "don't duplicate the global banner" decision already made for the
`connect-desktop-agent` design: the component's own error handler just resets
`trayAppAccessUpdating` and shows one additional, toggle-specific
`NotificationService.error('Could not update tray app access.')` via `toSafeErrorMessage`,
matching exactly how `resendInvitation` already handles its own failures on this same component
(see `employee-detail.component.ts:351-354`) — this is existing double-notification behavior in
this component already, not a new pattern being introduced.

## Testing

`employee-detail.component.spec.ts` (existing file) gains cases: toggle renders checked/unchecked
from `employee.trayAppAccessEnabled`, hidden without `employees:write`, clicking it calls
`PeopleApiService.setTrayAppAccess` with the flipped value and reloads on success, and shows an
error notification on failure without leaving the checkbox stuck disabled.
