# Position Occupant Preview — Frontend Report

Scope: `Hrms--Web-application---front-end---v1` only. No backend changes. No commit or push.

## Fields consumed from backend

Both `PositionListItemResponse` and `PositionTreeNodeResponse` now carry three new optional fields
(added in `src/app/modules/organization/models/position.model.ts`):

| Field | Type | Description |
|---|---|---|
| `assignedCount` | `number?` | Total active PrimaryEmployment assignments for this position |
| `occupantPreview` | `OccupantPreviewItem[]?` | First N occupants (backend cap = 4), ordered by EffectiveFrom then Id |
| `remainingAssignedCount` | `number?` | `assignedCount - occupantPreview.length` |

`maxOccupancy` was already present and is unchanged.

### OccupantPreviewItem shape

```ts
interface OccupantPreviewItem {
  readonly employeeId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly avatarFileId: string | null;   // raw UUID — NEVER used as img src
  readonly avatarUrl: string | null;       // always null until file-serving endpoint exists
}
```

All three new position fields are marked `?` (optional) so components do not crash against a
stale/older backend that omits them. Fallback defaults: `assignedCount=0`, `occupantPreview=[]`,
`remainingAssignedCount=0`.

---

## Avatar fallback behavior

| Condition | Rendered output |
|---|---|
| `avatarUrl` is a non-empty string | `<img src="avatarUrl">` |
| `avatarUrl` is null/empty string | Initials text in a themed circle |
| `initials` is blank | `?` (matches backend's own defensive default) |
| No assigned employee for this slot | Gray empty-seat circle |

**`avatarFileId` is never used as an image URL.** The field exists only in the data model as
documentation of what the backend sends. It is not passed to any `<img src>` or URL-generating
logic. Confirmed by: (a) component source (`hasAvatarUrl()` only checks `avatarUrl`), (b)
spec test `does NOT use avatarFileId as an img src when avatarUrl is null`.

---

## Empty seat / +n display rule

**Max-visible = 4. Overflow n = hidden capacity seats.**

| Condition | Visible circles |
|---|---|
| `maxOccupancy <= 4` | All `maxOccupancy` circles (no overflow). |
| `maxOccupancy > 4` | Exactly 3 seat circles + 1 overflow circle. |

When overflow is shown:
- `n = maxOccupancy - 3` — represents hidden *capacity* seats, not only hidden employees.
- Assigned employees fill visible circles first; empty gray circles fill the rest.
- If more employees are assigned than visible slots (3), only the first 3 previews are shown.
  The backend's own preview cap of 4 means no extra fetch is needed.

### Concrete examples

| Capacity | Assigned | Rendered |
|---|---|---|
| 1 | 0 | [⬜] |
| 1 | 1 | [JS] |
| 3 | 0 | [⬜][⬜][⬜] |
| 4 | 0 | [⬜][⬜][⬜][⬜] |
| 5 | 0 | [⬜][⬜][⬜][+2] |
| 5 | 2 | [JS][MK][⬜][+2] |
| 5 | 4 | [JS][MK][AR][+2] — 4th employee hidden in +2 |
| 10 | 4 | [JS][MK][AR][+7] |

---

## Confirmation: avatarFileId not used as URL

- `PositionSeatPreviewComponent.hasAvatarUrl()` returns `true` only when
  `item.avatarUrl` is a non-null, non-empty string.
- `avatarFileId` is declared in the model with a JSDoc comment: `/** DO NOT use as an image URL. */`
- Test `does NOT use avatarFileId as an img src when avatarUrl is null` (in
  `position-seat-preview.component.spec.ts`):
  - Sets `avatarFileId = 'file-uuid-abc'`, `avatarUrl = null`.
  - Asserts no `<img>` is rendered.
  - Asserts `'file-uuid-abc'` does not appear in the DOM text.

---

## New / changed files

### New files
| File | Purpose |
|---|---|
| [`position-seat-preview.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-seat-preview/position-seat-preview.component.ts) | Standalone reusable seat-stack component |
| [`position-seat-preview.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-seat-preview/position-seat-preview.component.html) | Template — employee/empty/overflow circles |
| [`position-seat-preview.component.css`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-seat-preview/position-seat-preview.component.css) | Styles using only theme tokens (no hardcoded hex) |
| [`position-seat-preview.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-seat-preview/position-seat-preview.component.spec.ts) | 14 tests covering all required scenarios |

### Modified files
| File | Change |
|---|---|
| [`position.model.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/models/position.model.ts) | Added `OccupantPreviewItem`; added 3 optional fields to both DTO interfaces |
| [`theme-tokens.css`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/shared/styles/theme-tokens.css) | Added 6 `--color-seat-*` tokens (light + dark overrides) |
| [`position-tree-node.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-tree-node/position-tree-node.component.ts) | Added `PositionSeatPreviewComponent` import |
| [`position-tree-node.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-tree-node/position-tree-node.component.html) | Replaced `ptn-capacity` span with `<app-position-seat-preview>` |
| [`position-tree-node.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-tree-node/position-tree-node.component.spec.ts) | Replaced old `—/1` text assertions with seat-preview element checks |
| [`position-list-table.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-list-table/position-list-table.component.ts) | Added `PositionSeatPreviewComponent` import |
| [`position-list-table.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-list-table/position-list-table.component.html) | Replaced `plt-capacity-val` span with `<app-position-seat-preview>` |
| [`position-list-table.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/modules/organization/ui/position-list-table/position-list-table.component.spec.ts) | Full rewrite — old capacity text assertions replaced with seat-preview checks |

---

## Tests run

```
npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts

Test Files  20 passed (20)
     Tests  208 passed (208)
  Duration  5.07s
```

### PositionSeatPreviewComponent tests (14)
- capacity 1 assigned 0 renders one empty circle ✓
- capacity 1 assigned 1 with initials renders one employee circle (no image) ✓
- assigned employee with avatarUrl renders `<img>` not initials ✓
- does NOT use avatarFileId as an img src when avatarUrl is null ✓
- capacity 3 assigned 0 renders three empty circles ✓
- capacity 5 assigned 0 renders three empty circles + overflow +2 ✓
- capacity 5 assigned 2 renders 2 employee + 1 empty + overflow +2 ✓
- capacity 5 assigned 4 renders 3 employee + overflow +2 (4th hidden) ✓
- capacity 10 assigned 4 renders 3 employee + overflow +7 ✓
- maxVisible limit enforced — never more than maxVisible circles ✓
- capacity 4 assigned 0 renders four empty circles with no overflow ✓
- aria-label and title for assigned employee include displayName ✓
- empty seat has aria-label "Empty seat" ✓
- does not crash when all inputs absent (stale backend fallback) ✓

### Tree node tests (11, including regression)
- Renders `app-position-seat-preview` (not old `—/1` text) ✓
- One empty circle when no occupant data (stale backend) ✓
- Employee initials circle when occupantPreview provided ✓
- Archived precedence: status pill shows Archived ✓
- Shared component regression: list-table also uses seat-preview ✓
- All 6 drag/drop regression tests: template dragover, dragleave, drop, reparent, read-only ✓ (unchanged)

### List table tests (9)
- Renders `app-position-seat-preview` (not old `—/1` text) ✓
- One empty circle when no occupant data ✓
- Employee initials circle when occupantPreview provided ✓
- Does not render old `—/1` text for any occupancy scenario ✓
- Overflow +n for large capacity ✓
- Archived status badge still present ✓
- Unassigned status badge still present for active positions ✓
- No backend field names in rendered row ✓
- Multiple rows each get their own seat-preview ✓

```
npm run build  →  exit 0 (no errors; warnings are pre-existing CSS budget overruns, unrelated)
git diff --check  →  only LF→CRLF normalization warnings from .gitattributes (pre-existing, same as backend report)
```

---

## Skipped checks

- **Integration tests** (Testcontainers / full HTTP pipeline): not in scope for this task.
- **Visual/browser regression**: not automated; manual verification recommended (see below).
- **`position-occupancy.ts` utility**: left completely unchanged — the util's `capacityText` is no
  longer rendered in any UI, but the util itself is still used for the status pill label
  (`occupancy.statusLabel`). Its 13 passing tests all continue to pass.

---

## Remaining risks

1. **`avatarUrl` always null today** — expected per backend report. All employees render as
   initials circles. When a file-serving endpoint is added, only `PositionOccupantPreviewResponse.AvatarUrl`
   needs to change on the backend; the frontend contract and component already handle it.

2. **Status pill may feel redundant** with the seat stack on very small position cards. Consider
   removing or hiding it on archived positions in a follow-up (it is currently suppressed for
   `statusType === 'archived'` only in the HTML; the pill block is still compiled).

3. **`currentOccupancy`/`currentOccupancyCheckSupported` stale pair** — still present on
   `PositionListItemResponse` and used only for the status pill logic via `resolvePositionOccupancy()`.
   The capacity *display* no longer uses it; it is only the status label source now. A follow-up
   cleanup per the backend report's recommendation applies here as well.

4. **Pre-existing uncommitted WIP in working tree** (PositionTemplatePacksController, etc.) was
   not touched by this task; 3 pre-existing architecture test failures on the backend side remain
   unrelated.

Nothing was committed or pushed.
