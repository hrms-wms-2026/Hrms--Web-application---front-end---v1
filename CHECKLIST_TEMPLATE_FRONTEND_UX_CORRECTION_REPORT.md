# Checklist Template Frontend UX Correction Report

Scope: `src/app/modules/people/feature/checklist-builder/` and related model/tests. No backend,
onboarding finalization, position management, settings, or auth changes.

## Corrected assignee model

Each task row exposes **Assigned to** with two HR-facing options:

| UI option | Meaning | Payload |
|-----------|---------|---------|
| **Employee** | Task is assigned to the employee being onboarded/offboarded | `ownerType: "employee"`, `assignedToId: null`, `assigneePositionId: null` |
| **Company position** | Task is assigned to whoever currently holds the selected company position | `ownerType: "custom_user"`, `assignedToId: null`, `assigneePositionId: <position id>` |

Forbidden in UI: "New employee", "Existing employee", "Someone else", "Responsible party", and
backend terms like `ownerType` / `custom_user` / `assignedToId`.

When **Company position** is selected, an **Assignee position** dropdown appears (all company
positions loaded once via the existing position API — no employee/person picker).

## Checklist applicability vs task assignee

These are separate concepts:

- **Use this checklist for** (applicability / scope): Company default, Department, or Position.
  Controls which `departmentId` / `positionId` are sent on the template itself.
- **Assigned to** (per-task assignee): Employee or Company position.
  Controls each task's `ownerType`, `assignedToId`, and `assigneePositionId`.

Scope rules unchanged:

- Company default → `departmentId: null`, `positionId: null`
- Department → `departmentId` required, `positionId: null`
- Position → both `departmentId` and `positionId` required

## Backend task payload mapping

Verified against:

- `CreateChecklistTemplateCommand` / `UpdateChecklistTemplateCommand` task inputs
- `ChecklistTemplateTaskRequest` API contract
- `ChecklistTemplateTaskInputResolver`

**Employee assignment**

```json
{
  "ownerType": "employee",
  "assignedToId": null,
  "assigneePositionId": null,
  "dueOffsetDays": 0
}
```

**Company position assignment**

```json
{
  "ownerType": "custom_user",
  "assignedToId": null,
  "assigneePositionId": "<selected-position-guid>",
  "dueOffsetDays": 0
}
```

`custom_user` is the backend-supported non-employee owner type used when resolving assignees
via position (see backend tests and `ChecklistTaskOwnerTypes.CustomUser`).

## Backend position-only task assignee support

**Supported.** Create/Update commands accept `assigneePositionId` without `assignedToId`.
`ChecklistTemplateTaskInputResolver` resolves the position to the current position holder at
template save time via `IChecklistTemplateAssigneeResolver`.

**Caveat:** The template detail response (`ChecklistTemplateTaskResponse`) returns only
`assignedToId`, not `assigneePositionId`. On edit, non-employee tasks load as **Company position**
but the position dropdown may be empty until HR re-selects a position before save.

## Task-list UX

Compact ClickUp/Plane-style rows inside the Tasks section:

| Column | Content |
|--------|---------|
| # | Sequence number |
| Task | Title input |
| Assigned to | Employee / Company position selector; assignee position dropdown when needed |
| Due | `[n] days after start date` |
| Required | Checkbox toggle |
| Actions | Move up, move down, remove |

No nested grey boxes, no repeated helper paragraphs, no disabled fake controls.

## Tests run

```bash
npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts
npm run build
git diff --check
```

Results: **121/121** people module tests passed; build succeeded; `git diff --check` clean.

Coverage in `checklist-builder.component.spec.ts`:

- "Assigned to", "Employee", "Company position" render
- Forbidden labels do not render
- Employee payload emits `ownerType: employee`, null assignee fields
- Company position requires assignee position; emits `assigneePositionId` + `ownerType: custom_user`
- Due validation (integer ≥ 0)
- Add/remove/reorder
- Scope validation and payload mapping
- Edit mode loads non-employee tasks as Company position

## Remaining risks

1. **Edit round-trip:** Saved templates store resolved `assignedToId` in JSON; the API does not
   return `assigneePositionId`, so edit mode cannot pre-fill the original assignee position.
2. **Resolver at save time:** Backend resolves position → current holder when the template is
   saved, not dynamically at onboarding/offboarding runtime. If the position holder changes
   after template save, stored `assignedToId` reflects the holder at save time.
3. **Vacant positions:** If the selected position has no current holder, backend save may fail
   with an resolver error — the UI does not pre-validate occupancy.
