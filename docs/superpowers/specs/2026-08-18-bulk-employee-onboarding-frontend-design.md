# Bulk Employee Onboarding — Frontend Design

**Status:** Approved by user 2026-08-18, ready for implementation planning.

**Companion spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-18-bulk-employee-onboarding-backend-design.md` (backend half; API contract is defined there in §6, this document is the frontend consumer of it).

**Origin:** brainstormed live with the user 2026-08-18 via `superpowers:brainstorming`. Placement and interaction decisions below (column-mapping-with-preview, org-entities-must-already-exist, batch-level defaults with per-row CSV override, partial success, background-processed create/finalize) came directly from that conversation.

---

## 1. Goal

A Settings sub-page where HR uploads a CSV of prospective employees, maps its columns to system fields with a live one-row preview, sees a validation summary with per-row errors, and reviews/bulk-finalizes the resulting batch of onboarding drafts — reusing the existing single-employee onboarding-draft data and finalize outcomes rather than a parallel bulk-only model.

## 2. Scope

**In scope:** the 5-step flow (Upload → Map Columns → Validate → Review Drafts → Finalize Selected), Settings nav placement, polling for the two background-processed steps (create-drafts, finalize).

**Out of scope:** `.xlsx` upload (CSV only, phase 1 — see backend spec §2), a UI for authoring/saving reusable column-mapping templates (mapping is ephemeral per upload), any UI for creating missing Department/Position inline (a missing one is a validation error with a message pointing at Organization settings, not an inline create action). No Reporting Manager field anywhere in this flow — see §4 for why.

## 3. Current-state facts this design depends on

Verified directly against the codebase:

- **Settings sub-sidebar pattern**: `nav-items.config.ts` defines a `settings` parent nav item with `children: [{ id, label, path, requiredPermissions }]`; visibility is purely derived from child visibility (`canAccessNavItem`, `nav-access.ts`), the parent declares no permission/module gate of its own. Existing children: `settings-general` (`legal_entity:update`), `settings-roles` (`roles:manage`), `settings-notifications` (`notifications:manage`, currently a placeholder route). `canAccessNavItem` also supports `requiredModules` (`nav-access.ts:17`) — other Settings children don't set it today, but sibling top-level items like `people`/`organization` do (`requiredModules: ['core_hr']` / `['org_structure']`), and `employees:write`/`employees:read` are seeded under the `core_hr` module (`ModuleCatalogSeeder.cs`) — bulk onboarding's nav child sets `requiredModules: ['core_hr']` for that same consistency.
- **`app.routes.ts`**: the `settings` route has `children` with `loadComponent` per path and a catch-all `{ path: '', pathMatch: 'full', redirectTo: 'general' }`. `app.routes.spec.ts` asserts `/settings` redirects to `/settings/general` and that `/settings/general` resolves — adding a new `settings` child doesn't change that redirect target, but the new route must be added without breaking the existing two assertions (still exact-tested).
- **Physical-module-vs-route-path split is an established pattern**: `general-settings.component.ts` physically lives in `modules/organization/feature/general-settings/` but is routed at `/settings/general`. Bulk onboarding follows the same split: physically in `modules/people/feature/bulk-onboarding/` (co-located with the onboarding-draft code — `add-employee-wizard`, `checklist-builder`, `onboarding-draft.model.ts` — that it depends on and extends), routed at `/settings/bulk-onboarding`.
- **Existing onboarding-draft model** (`modules/people/models/onboarding-draft.model.ts`) already defines `SaveOnboardingDraftPayload`, `OnboardingDraftResponse`, `FinalizeOnboardingDraftResponse` (with `invitationQueued`/`positionApprovalPending`/`checklistTasksCreated`/`messageKey`), `DraftStatus`, `DraftReason`, and their display-label maps (`DRAFT_REASON_LABELS`, `DRAFT_STATUS_LABELS`). Bulk onboarding's per-row outcome display reuses these labels rather than inventing new copy for the same underlying states.
- **State management convention** (frontend architecture doc §4): NgRx Signal Store per module (`*.store.ts`), component-local UI state via `signal()`, no `BehaviorSubject` in module stores. `data-access/*-api.service.ts` for HTTP, `ui/` for presentational-only components (no API calls), `feature/` for the page-level smart container.

## 4. Flow and components

Physical home: `modules/people/feature/bulk-onboarding/`. Route: `/settings/bulk-onboarding`, `canActivate: [permissionGuard]`, `data: { title: 'Bulk Onboarding', permissions: ['employees:write'] }` (write, not read, because the landing action is upload — a read-only viewer of past batches is not in this phase's scope).

1. **Upload** — file picker (CSV only, client-side extension/type check before submit), batch-level defaults form (Legal Entity required select; Work Mode, Employment Type, Checklist Template optional defaults, each overridable per row via a mapped CSV column). Submits to `POST /batches`.
2. **Map Columns** — table of system fields (First Name, Last Name, Work Email\*, Start Date\*, Employment Type, Work Mode, Department, Position, Checklist Template, Employee Number) each with a dropdown of detected CSV headers, pre-filled from the backend's auto-suggested mapping. No Reporting Manager field: verified against the backend (`Employee` and `onboarding_drafts` have no manager column at all — reporting manager is entirely implied by whichever Position a row resolves to, via that position's own `ReportsToPositionId`, exactly as the existing single-employee wizard already works). A "Preview row 1" panel calls `POST /batches/{id}/preview` on every mapping change (debounced) and renders the resolved values — including resolved Department/Position *names*, not raw IDs, so a wrong mapping is visible immediately. Changing the mapping and re-checking row 1 is the entire "fix once, applies to all" mechanism the user asked about in brainstorming — there's no per-row mapping UI because there's only one mapping for the file.
3. **Validate** — submits the confirmed mapping to `POST /batches/{id}/validate`; shows a summary (`X valid / Y invalid` of `total_rows`) and a per-row error table (row number, field, message) for anything invalid, downloadable/copyable so HR can fix and re-upload just the failed rows. Valid rows proceed regardless of invalid ones (partial success, not all-or-nothing).
4. **Create Drafts** — a "Create N drafts" action calls `POST /batches/{id}/create-drafts`, then the component polls `GET /batches/{id}` (short interval, stopped on terminal status) showing a progress state while `status` is `draft_creation_pending`, until `drafts_created`.
5. **Review** — table of the batch's rows joined to their `onboarding_draft_id` (name, email, department, position, status), using the existing `DRAFT_STATUS_LABELS`/`DRAFT_REASON_LABELS` maps for display. Row-select checkboxes feed the finalize action. A link out to the existing My Drafts list is included since the same drafts appear there too (see backend spec §4.2) — this is called out in the UI copy, not hidden, so it doesn't read as a bug when HR notices the overlap.
6. **Finalize** — "Finalize N selected" calls `POST /batches/{id}/finalize` with the selected draft ids, then polls the same `GET /batches/{id}` until `finalize_completed`, rendering the four-way outcome per row (finalized / waiting for seat / waiting for approval / failed) using the same labels/copy the single-employee finalize screen already uses for these states — no new copy invented for outcomes that already exist.

## 5. State

`modules/people/state/bulk-onboarding.store.ts` (NgRx Signal Store, matches `EmployeeStore`/`add-employee-wizard.store.ts` shape): `batchId`, `status`, `columnMapping`, `detectedColumns`, `previewRow`, `rows` (with per-row status/error), `totalRows`/`validRows`/`invalidRows`, `loading`, `error`, plus methods `uploadFile`, `updateMapping` (debounced preview call), `validate`, `createDrafts`, `pollUntilTerminal(status)`, `finalizeSelected`. `data-access/bulk-onboarding-api.service.ts` wraps the six endpoints from the backend spec's §6 table.

## 6. Tests

- `bulk-onboarding.store.spec.ts` — upload/mapping/validate/create-drafts/finalize state transitions, polling stop condition on terminal status, error state on API failure (mirrors `add-employee-wizard.store.spec.ts`'s structure).
- `bulk-onboarding-api.service.spec.ts` — one spec per endpoint, request shape and response mapping.
- `bulk-onboarding.component.spec.ts` — step navigation, partial-success rendering (valid/invalid counts + error table), disabled states while polling.
- Mapping-preview util spec (if extracted into a pure function rather than inline in the store) — auto-suggest matching, resolved-name preview shape.
- Update `app.routes.spec.ts` to add a `/settings/bulk-onboarding` resolution assertion alongside the existing `/settings` → `/settings/general` redirect assertion (both must keep passing — the redirect target does not change).
- Update the nav-config test (`nav-access.spec.ts` or equivalent covering `NAV_ITEMS`) for the new `settings-bulk-onboarding` child and its `requiredModules: ['core_hr']` + `requiredPermissions: ['employees:write']` gate.

## 7. Open items for the plan to resolve

- Exact copy/labels for the system-field list in the mapping step and the CSV template's suggested header names — implementation detail.
- Whether the batch-level defaults form and Upload step are one screen or two — either is fine; plan should decide based on how much vertical space the defaults form needs next to the file picker.
