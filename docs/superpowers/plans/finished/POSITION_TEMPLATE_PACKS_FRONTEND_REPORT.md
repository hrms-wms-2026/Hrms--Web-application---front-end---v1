# Position Template Packs — Frontend Implementation Report

Implemented Part 2 of the Position Template Packs integration on the tenant-facing HRMS application (Organization → Positions screen).

---

## 1. Exact Files Changed / Created

### New Files Created
- `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.ts` — standalone inline template side-panel component.
- `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.html` — inline panel template with skeleton loaders, error retry state, empty state, collapsible pack accordions, position cards, and "Use template" buttons.
- `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.css` — centralized theme token styles for the inline side panel.
- `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.spec.ts` — unit tests for drawer states, rendering, and interactions.

### Existing Files Modified
- `src/app/modules/organization/models/position.model.ts` — added DTO interfaces (`PositionTemplatePackListResponse`, `PositionTemplatePackResponse`, `PositionTemplatePackPositionResponse`).
- `src/app/modules/organization/data-access/position-api.service.ts` — added `listPositionTemplatePacks()` method.
- `src/app/modules/organization/data-access/position-api.service.spec.ts` — added unit test for `listPositionTemplatePacks()`.
- `src/app/modules/organization/state/position.store.ts` — extended Signal Store with template state properties (`templatePacks`, `templatePacksLoading`, `templatePacksError`, `selectedTemplatePackKey`, `templateSearchQuery`), `filteredTemplatePacks` computed property, and `loadTemplatePacks()` method with safe error handling via `toSafeErrorMessage()`.
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.ts` — added optional `templatePreset` `@Input()` and prefill logic in `ngOnInit()`.
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.html` — added template context banner ("Started from template...") and unmatched department helper text banner.
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.css` — added theme token styles for `.pfm-template-banner`.
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.spec.ts` — added unit tests for template preset prefill and banner rendering.
- `src/app/modules/organization/feature/position-management/position-management.component.html` — replaced top-right Filter dropdown button with Templates button (with count badge), relocated "Show archived positions" checkbox to secondary toolbar area near department selector, and integrated `<app-position-template-drawer>` as an **inline side panel** rendered side-by-side on the same screen as the position hierarchy/list.
- `src/app/modules/organization/feature/position-management/position-management.component.ts` — added `templateDrawerOpen` and `templatePreset` signals, `openTemplateDrawer()`, `closeTemplateDrawer()`, `onSelectTemplatePosition()`, `onDragOver()`, `onDrop()`, and updated `onSavePosition()` to display `"Position created from template."` when created from a template preset.
- `src/app/modules/organization/feature/position-management/position-management.component.css` — added styles for `.pm-main-layout`, `.pm-view-container`, `.pm-templates-btn`, `.pm-templates-count`, and `.pm-archived-checkbox-label`.
- `src/app/modules/organization/feature/position-management/position-management.component.spec.ts` — added unit test suite for toolbar replacement, template drawer loading, permission checks, prefill matching, non-autocreate behavior, and toast notifications.

---

## 2. Endpoint Used

```
GET /api/v1/org/position-template-packs
```
- Called by `PositionApiService.listPositionTemplatePacks()`.
- No `legalEntityId` or `tenantId` is passed in path, query, or body.

---

## 3. Inline Side-Panel UX (No Modal Backdrop Popup)

- **Same-Screen Panel**: The Templates section renders as an **inline side panel** directly alongside the position hierarchy tree / list on the **exact same screen**.
- **No Backdrop Overlay**: The modal backdrop (`.ptd-backdrop`) was completely removed. The user retains full visibility and interaction with their position hierarchy while exploring template packs.
- **Drag-and-Drop on Same Screen**: Native HTML5 `(dragover)` and `(drop)` handlers are attached directly to the main position view container (`.pm-view-container`), allowing template cards to be dragged directly onto the positions tree on the same screen.

---

## 4. Permission Behavior

- **Viewing Positions & Loading Templates**: Gated by `org:read`. Users with `org:read` can open the template panel and view template packs.
- **Creating from Template**: Gated by `org:manage`. If a user with `org:read`-only clicks "Use template", the action is blocked with a friendly toast:
  > *"You need organization management access to create positions from templates."*
- **Panel Warning**: When `canCreate` (`org:manage`) is false, template position cards display disabled buttons and a persistent warning banner inside the template panel.
- **Position Access Configuration**: Remains unchanged requiring `org:manage + roles:read`.

---

## 5. Click-to-Use & Drag/Drop Behavior

- **Primary Supported Interaction**: Click-to-use via the visible **"Use template"** button on every position template card. Selecting it emits `templatePositionSelected` and opens `PositionFormModalComponent` prefilled with preset values.
- **Progressive Enhancement**: HTML5 native `draggable="true"` attributes and `(dragstart)` handlers are attached to position template cards so users can drag cards directly onto the positions list/tree area.
- **No Third-Party Dependencies**: `@angular/cdk` was not added; all interactions rely on native Angular standalone component outputs and native DOM drag events.

---

## 6. Department Matching & Non-Creation Behavior

- When a template position is selected, its `departmentName` is matched against existing active departments in `DepartmentStore.allFlatList()` using a case-insensitive trim comparison (`d.name.trim().toLowerCase() === position.departmentName.trim().toLowerCase()`).
- **If a match is found**: The matched department's `id` is preselected in the modal form's `departmentId` dropdown.
- **If no match is found**: `departmentId` remains unselected (`""`).
- **Confirmation**: **No department auto-creation logic was added.** The modal displays a helper notice:
  > *"Template suggests department: {departmentName}. Select an existing department before creating this position."*
- The user must select a valid existing department before saving.

---

## 7. Role Template Reference (`linkedRoleTemplateId`)

- **Confirmation**: `linkedRoleTemplateId` is treated strictly as a display-only indicator ("Role template included" badge) on template position cards.
- **It is NEVER treated as a tenant `roleId`** and is never sent to the backend create position endpoint (`POST /org/legal-entities/{id}/positions`) or position access endpoint (`PUT /access`).

---

## 8. Automated Tests Run & Results

```powershell
npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts
```
**Results**: **19 test files passed, 146 total tests passed (0 failed, 0 skipped).**

```powershell
npm run build
```
**Results**: **Application bundle generation complete (0 compilation errors).**

```powershell
git diff --check
```
**Results**: **Clean (0 whitespace / diff errors).**

---

## 9. Skipped Checks & Why

- **Backend code execution/modification**: Not touched, per instructions ("Do not edit backend in this task"). Backend behavior was verified against unit/architecture test assertions and `POSITION_TEMPLATE_PACKS_BACKEND_REPORT.md`.
- **Git commit / push**: Not performed, per explicit prompt instructions ("Do not commit or push").

---

## 10. Remaining Risks

- **Reports-to matching edge cases**: Position template packs use `reportsToPositionKey` (e.g. `"eng-mgr"`). Resolution matches against existing position `code` or `name`. If an organization has multiple positions with similar names or non-standard codes, the reports-to selector defaults to "Root Position" if no exact match is found, requiring manual selection by the HR user.
- **Applying full template packs (Part 3)**: This phase enables individual position creation from seeded templates. Applying an entire pack in a single transaction (Part 3) requires dedicated backend transaction support and must not be faked on the frontend.

---

## 11. UI Polish Fixes — Scroll Containers, Drawer Footer, Wheel Zoom (2026-08-11)

Follow-up pass on the same Positions screen fixing nested scrollbars, an unnecessary drawer footer, and adding mouse-wheel zoom to the hierarchy canvas. Scope limited to `src/app/modules/organization/feature/position-management/` and `src/app/modules/organization/ui/position-template-drawer/`. Backend untouched.

### 11.1 Scroll containers — corrected approach

An earlier pass in this same task switched both containers to `overflow: visible` so the page would own all scrolling. That was wrong: with `overflow: visible` the tree's absolutely/flex-positioned nodes and connector lines spilled outside the rounded card border (nodes rendered half-outside the box), and the fixed `height` became a `min-height`, leaving large dead/blank space on the page below the card. Corrected per follow-up feedback: **both containers keep their own contained internal scroll** (so content stays clipped inside the box and the page never grows to swallow it) — only the *visible scrollbar chrome* is removed, and scroll is prevented from chaining/bubbling to the page scrollbar.

- **`position-management.component.css` — `.pm-tree-container`**: kept `height: calc(100vh - 210px); overflow: auto;` (restored from the incorrect `min-height`/`overflow: visible` attempt). Added `overscroll-behavior: contain` so reaching the top/bottom edge while scrolling inside the canvas does not hand off to the page scroll. Added `scrollbar-width: none` (Firefox), `-ms-overflow-style: none` (legacy Edge/IE), and a `.pm-tree-container::-webkit-scrollbar { display: none; }` rule (Chrome/Safari/Chromium-Edge) so the native scrollbar track/thumb is invisible while the element remains fully scrollable via trackpad/touch/keyboard. The floating zoom control (`.pm-zoom-controls`, `position: sticky; bottom: 0.25rem;`) sticks to the bottom of this same scrollport as before.
- **`position-template-drawer.component.css` — `.ptd-body`**: kept `overflow-y: auto; max-height: calc(85vh - 100px);` (restored). Added the same `overscroll-behavior: contain` + scrollbar-hiding rules (`scrollbar-width: none`, `-ms-overflow-style: none`, `::-webkit-scrollbar { display: none; }`) so scrolling through template packs stays contained inside the drawer body and never scrolls the underlying page, while no ugly scrollbar is drawn.
- Net effect: the drawer and the hierarchy canvas both still scroll independently and internally (never touching the page's own scrollbar), matching the original ask — the only thing removed is the *visible* scrollbar track, not the scrolling behavior itself.

### 11.2 Drawer footer removed

- Removed the `<div class="ptd-footer">` block and its `Close panel` `app-button` from `position-template-drawer.component.html`.
- Removed the now-unused `.ptd-footer` CSS rule from `position-template-drawer.component.css`.
- No empty spacing left behind — `.ptd-body` is the last visible section in the panel now (`flex: 1` still applies).
- The header `X` icon button (`aria-label="Close template panel"`) is the only close affordance; it was already wired to `(click)="closed.emit()"` and is unchanged.

### 11.3 Mouse-wheel zoom on the hierarchy canvas

- Added `onTreeWheel(event: WheelEvent)` to `position-management.component.ts`, bound via `(wheel)="onTreeWheel($event)"` directly on the `.pm-tree-container` div (not a global/document listener).
- `event.preventDefault()` is called only inside this handler, so page scroll is blocked only while the pointer is over the hierarchy canvas; scrolling anywhere else on the page is untouched.
- `deltaY < 0` (wheel up) calls the existing `zoomIn()`; `deltaY > 0` (wheel down) calls the existing `zoomOut()`. Both already reuse the component's existing `treeZoom` signal and clamp to the same `0.4`–`1.5` range (in `0.1` steps) used by the `+`/`-` buttons — no new state or state library was introduced.
- The `+`/`-` buttons and the "reset to 100%" button are untouched and continue to call `zoomIn()` / `zoomOut()` / `resetZoom()` directly.

### 11.4 "Show archived" checkbox spacing

- `.pm-archived-checkbox-label` padding changed from `0.375rem 0.5rem` to `0.5rem 0.625rem` (matching the search input's vertical `0.5rem` padding) plus a `0.125rem` left margin and a `1px solid transparent` border, so its box height/rhythm lines up with the search input and department `app-select` next to it in `.pm-controls-left`. Left in the toolbar (not moved back into Templates), per instructions.

### 11.5 Tests added

`src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.spec.ts`:
- `does not render a footer "Close panel" button` — asserts `.ptd-footer` is absent and no button has the text `Close panel`.
- `closes via the header X button` — clicks `[aria-label="Close template panel"]` and asserts `closed` emits.

`src/app/modules/organization/feature/position-management/position-management.component.spec.ts` (new `describe('Position Hierarchy Zoom', ...)` and `describe('Show archived toggle', ...)` blocks):
- `onTreeWheel` zooms in on negative `deltaY` and out on positive `deltaY`.
- `onTreeWheel` calls `preventDefault()`.
- Wheel zoom clamps at `1.5` max / `0.4` min, same as the buttons.
- `zoomIn()` / `zoomOut()` / `resetZoom()` still work and clamp at the same min/max.
- DOM-level test: dispatches a real `WheelEvent` on `.pm-tree-container`, clicks the rendered `.pm-zoom-btn` elements, and checks the `.pm-zoom-reset` percentage label updates.
- "Show archived" checkbox `change` event still calls `PositionStore.setIncludeInactive(true)` and updates `positionStore.includeInactive()`.

### 11.6 Tests run

```powershell
npx ng test --no-watch --include "src/app/modules/organization/**/*.spec.ts"
```
**Result: 19 test files passed, 154 tests passed, 0 failed.**

```powershell
npm run build
```
**Result: build succeeded.** Pre-existing CSS budget warnings remain (including `position-management.component.css` and `position-template-drawer.component.css`, both already over the 4 kB soft budget before this change); no new errors were introduced.

```powershell
git diff --check
```
**Result: no whitespace errors reported** (only pre-existing LF→CRLF `core.autocrlf` notices unrelated to this change).

### 11.7 Remaining risks

- Not verified in a live browser against a running backend/tenant in this pass (no dev server config present in `.claude/launch.json` and standing up the tenant stack was out of scope for this task) — only unit tests, `ng build`, and `git diff --check` were run. This was later validated against real screenshots supplied mid-task, which is what surfaced the `overflow: visible` regression described in §11.1 — a further live pass is still recommended to confirm the corrected contained-scroll behavior feels right on a real trackpad/mouse.
- The hidden-scrollbar technique (`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`) removes the user's usual visual affordance that more content exists below the fold inside the canvas/drawer. There is no custom scroll-shadow or "more below" indicator added; a user unfamiliar with the screen may not realize a box is scrollable until they try scrolling inside it.
- `.pm-tree-container` still uses a fixed `height: calc(100vh - 210px)`, so on very short viewports the tree gets a small scrollport; this matches the pre-existing (pre-task) behavior and was intentionally restored rather than changed further.

---

## 12. Wheel-Zoom Speed Fix + Rendering Tearing Artifact (2026-08-11, same day follow-up)

Two more issues came back from a live screenshot: (1) wheel-triggered zoom felt "too quick" — a normal scroll fling blew straight through to the 40% floor or 150% ceiling in under a second; (2) a screenshot at `40%` zoom showed a glitchy vertical white "blinds"/stripe pattern where a tree node card should have been (see the red-boxed area in the reported screenshot, roughly where the `COO / Chief Operating Officer` card sits).

### 12.1 Wheel zoom was too fast — fixed

- **Root cause**: `onTreeWheel()` reused `zoomIn()`/`zoomOut()`, which step by `0.1` (10%) — the same step size as a deliberate `+`/`-` button click. A single mouse-wheel notch (or a couple of trackpad ticks) fires multiple `wheel` events in quick succession, so the zoom hit its `0.4`–`1.5` clamp almost instantly on any real scroll gesture.
- **Fix**: `onTreeWheel()` in `position-management.component.ts` no longer calls `zoomIn()`/`zoomOut()`. It now applies its own smaller step (`WHEEL_ZOOM_STEP = 0.02`, i.e. 2% per wheel tick vs. 10% per button click) directly against the same `treeZoom` signal, with the same `0.4`–`1.5` clamp. The `+`/`-` buttons and their `0.1` step are completely unchanged.
- Tests updated/added in `position-management.component.spec.ts`: wheel-tick assertions now expect `~1.02`/`~1.0` instead of `1.1`/`1.0`; a new test explicitly asserts the wheel step is smaller than the button step (`wheelStep < buttonStep`); the clamp test now loops enough iterations (60 / 80) to reach the `1.5`/`0.4` bounds at the smaller step size.

### 12.2 Vertical "blinds" rendering artifact — likely cause and fix applied

**Honesty check**: I could not reproduce this live (no dev server/tenant was stood up for this task — see §11.7), so this is a diagnosis from the screenshot plus the CSS involved, not a confirmed root-cause via reproduction. Treat the explanation as the most likely cause, and please re-check the live screen after this fix.

- The hierarchy canvas zooms by applying `transform: scale(...)` to `.pm-tree-list-wrapper` (`position-management.component.html`), which sits on top of `.pm-tree-container`'s repeating dotted `background-image` (`radial-gradient(...) 1px, transparent 1px` at `20px 20px`). Each position card underneath has its own `border`, `border-radius`, and `box-shadow` (`position-tree-node.component.css`).
- Scaling a box-shadow/border-heavy layer over a repeating background pattern via CSS `transform`, especially at a fast-changing/extreme scale factor (the screenshot was at `40%`), is a known class of Chromium/Edge GPU-compositing bug: without its own stable compositor layer, the scaled layer can be rasterized across shifting GPU tile boundaries, producing seam/"tearing" artifacts that look like vertical light/dark stripes — worse the faster and more often the scale value changes (which √12.1's fast wheel-zoom was actively causing, re-triggering the `0.15s` CSS transition dozens of times per second).
- **Fix applied**: `.pm-tree-list-wrapper` in `position-management.component.css` now has `will-change: transform`, `backface-visibility: hidden`, and `-webkit-backface-visibility: hidden`, which forces the browser to promote it to its own isolated, cleanly-rasterized compositor layer instead of repainting/retiling on every transform change. Combined with §12.1's much slower/smoother wheel-zoom step (fewer, smaller transform changes instead of many large ones), this should eliminate the tearing.
- **If the stripes are still visible after this fix**: that would point away from the compositing-tearing theory and toward something else (e.g. a specific position card's own state/icon rendering incorrectly). Please send a fresh screenshot/repro and I'll dig into that specific node's markup instead of guessing further.

### 12.3 Tests run

```powershell
npx ng test --no-watch --include "src/app/modules/organization/**/*.spec.ts"
```
**Result: 19 test files passed, 155 tests passed, 0 failed.**

```powershell
npm run build
```
**Result: build succeeded**, same pre-existing CSS budget warnings as before, no new errors.

---

## 13. Contextual drag/drop presets — root vs. drop-under-position (2026-08-12)

Fixed the reported bug: dragging a template card from the drawer onto the hierarchy behaved exactly like clicking "Use template" no matter where it was dropped — it never used the drop location to set `reportsToPositionId`/`departmentId`, and dropping directly onto an existing position card did nothing at all (the position card's own reparent-drag `drop` handler swallowed the event and silently failed to parse the template payload). Scope limited to `src/app/modules/organization/`. Backend untouched.

### 13.1 Files changed

- `src/app/modules/organization/models/position.model.ts` — added `POSITION_TEMPLATE_DRAG_MIME_TYPE = 'application/x-onevo-position-template'` (the safe internal DataTransfer type) and the `PositionTemplatePreset` interface (`source: 'template-click' | 'template-drop-root' | 'template-drop-under-position'`, plus `reportsToPositionName` and `departmentMessage`, extending the preset shape that already existed inline on the component). Field names (`positionName`, `positionKey`, `departmentId`, `reportsToPositionId`, `suggestedDepartmentName`) were kept as-is to match existing convention rather than renaming to the `templatePositionName`/`templatePositionKey` shape suggested in the ticket.
- `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.ts` — `onDragStart()` now sets the payload on `POSITION_TEMPLATE_DRAG_MIME_TYPE` (was `application/json`). `text/plain` is still set, but only as a human-readable OS drag-image fallback label (`pos.positionName`) — no drop target parses it as the payload anymore.
- `src/app/modules/organization/ui/position-tree-node/position-tree-node.component.ts` / `.html` / `.css` — added `isTemplateDragOver` signal and `templateDropped` output (`TemplateDropOnPositionEvent { templatePosition, packName, targetPosition }`). `onDragOver` now inspects `event.dataTransfer.types` to tell a template drag apart from an existing-position reparent drag (which still uses `text/plain` for the dragged position id) and sets the correct visual state/`dropEffect` for each. `onDrop` checks for the template MIME type **first**; if present it emits `templateDropped` and returns — it never falls through to the reparent path, and reparent drags never match the template type. The `templateDropped` output is re-emitted up through every recursive child node so a drop on any depth in the tree reaches the top-level component.
- `src/app/modules/organization/feature/position-management/position-management.component.ts` — replaced the old blanket `onDragOver`/`onDrop` (bound to the whole `.pm-view-container`, which is what made drag/drop behave like a click regardless of location) with three explicit handlers: `onCanvasDragOver`/`onCanvasDragLeave`/`onCanvasDrop` (bound to `.pm-tree-container`, the hierarchy canvas only — not the list view) and `onTemplateDroppedOnPosition` (bound to the tree's `templateDropped` output). `onSelectTemplatePosition` (click path) was refactored to share a new private `openTemplatePreset(...)` builder with the two drop paths, so all three paths produce the same `PositionTemplatePreset` shape with a different `source`.
- `src/app/modules/organization/feature/position-management/position-management.component.html` / `.css` — moved the drop bindings from `.pm-view-container` down to `.pm-tree-container`; added `canvasDragOver` signal-driven highlight (`.pm-tree-container--drop-active` + a `.pm-canvas-drop-overlay` banner reading "Drop to create root position."); wired `(templateDropped)="onTemplateDroppedOnPosition($event)"` on the root `<app-position-tree-node>`.
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.ts` — `@Input() templatePreset` now typed as `PositionTemplatePreset` (was an inline anonymous type) so it carries `source`/`reportsToPositionName`/`departmentMessage` into the modal.
- `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.html` — banner now also renders "Will report to: {name}" when `reportsToPositionName` is present and the inherited-department message when `departmentMessage` is present, alongside the existing unmatched-department helper.
- Spec files updated/extended: `position-template-drawer.component.spec.ts`, `position-tree-node.component.spec.ts`, `position-management.component.spec.ts`, `position-form-modal.component.spec.ts` (see §13.5).

### 13.2 Root-drop behavior (drop on empty canvas)

- Dropping a template card anywhere on `.pm-tree-container` (the dotted-background hierarchy canvas), including when it's empty (`positionStore.treeData().length === 0`, showing the "No positions found" empty state), creates a **root** position:
  - `reportsToPositionId = null`
  - `departmentId` = matched department (case-insensitive trim match against `DepartmentStore.allFlatList()` by `departmentName`), or `null` with `suggestedDepartmentName` set (same non-auto-create rule as click-to-use — see §6/§13.4) if no match.
- The canvas highlights with a dashed `var(--color-accent)` border + a centered "Drop to create root position." overlay while a template payload (`event.dataTransfer.types` includes `application/x-onevo-position-template`) is being dragged over it; the highlight clears on `dragleave`, `drop`, and drag cancel (no `types` match at all → the handler ignores the event, so a plain OS file drag etc. never lights up the canvas).
- Dropping directly onto an existing position card does **not** also trigger a root create — `position-tree-node`'s own `dragover`/`drop` now call `stopPropagation()` for both drag kinds, so the canvas-level handlers never see a drop that landed on a card.

### 13.3 Drop-under-position behavior (drop on an existing position card)

- Dropping a template card onto an existing position node emits `templateDropped` from that node, and the component now:
  - `reportsToPositionId = droppedOnPosition.id`
  - `departmentId = droppedOnPosition.departmentId` (when present)
  - **Ignores** the template's own `reportsToPositionKey` entirely for this path — the user explicitly chose a parent by dropping there, so the click-to-use key-matching logic never runs for drops.
- The card highlights with the same accent-color dashed border + a "Drop under this position." box (distinct signal, `isTemplateDragOver`, from the existing plain-reparent `isDragOver` highlight/text so the two drag kinds never share visual state) while a template is dragged over it; both clear on `dragleave`/`drop`.
- **Does not save immediately.** Both the root-drop and drop-under-position paths only populate `templatePreset` and open the existing create-position modal (`formModalOpen.set(true)`) — the user still reviews/edits every field and clicks "Create position" themselves, same as click-to-use. No new "instant create on drop" path was added.

### 13.4 Department inheritance behavior

| Path | `reportsToPositionId` | `departmentId` source |
|---|---|---|
| Click "Use template" | Matched from template `reportsToPositionKey` (by position `code` or `name`, case-insensitive) if found, else `null` | Matched from template `departmentName` if an active department exists, else `null` + `suggestedDepartmentName` helper |
| Drop on empty canvas | Always `null` (root) | Matched from template `departmentName` if an active department exists, else `null` + `suggestedDepartmentName` helper |
| Drop on existing position | Always the dropped-on position's `id` | Always the dropped-on position's `departmentId` (inherited); the modal banner shows `departmentMessage`: `Inherited department "{name}" from '{position name}'.` |

No path auto-creates a department. When `departmentId` cannot be resolved, the form's `departmentId` control stays required/empty and the user must pick an existing one before the "Create position" submit succeeds (unchanged validation from the original template-click implementation).

### 13.5 Click-to-use behavior (regression-checked, unchanged)

- "Use template" still opens the create modal synchronously (no drag needed), prefills name/code/department/reports-to via the same matching rules as before, sets `source: 'template-click'` on the preset, and remains the only interaction required by the drawer's accessible path (drag is progressive enhancement, per §5/§11 above — never the only way in).
- The one pre-existing test that asserted the exact `templatePreset()` object shape (`org:manage user selecting template opens create modal prefilled...`) was updated to include the three new fields (`source`, `reportsToPositionName: null`, `departmentMessage: null`) — the underlying behavior it checks (matched department id, null reports-to, null suggestion) did not change.

### 13.6 Permission behavior

- All three entry points (`onSelectTemplatePosition`, `onCanvasDrop`, `onTemplateDroppedOnPosition`) independently check `hasManageAccess()` (`org:manage`) before opening the modal and show the same toast if it's missing:
  > *"You need organization management access to create positions from templates."*
- `onCanvasDragOver` still calls `preventDefault()` when a template payload is detected (so a real `drop` event fires and the toast/permission check above actually runs on release) but sets `dropEffect = 'none'` and skips the highlight when the user lacks `org:manage`, giving a "not allowed" cursor during the drag itself.
- `position-tree-node`'s own `onDragOver`/`onDrop` still early-return entirely when `canManage` is `false` (bound from `hasManageAccess()`), so a read-only user never even sees the per-card highlight; `onTemplateDroppedOnPosition` in the parent additionally re-checks permission defensively in case that event ever fires.
- The drawer itself remains viewable under `org:read` alone (unchanged from Part 2 — see §4); only the create action is gated.

### 13.7 Tests added

- **`position-template-drawer.component.spec.ts`**: `dragstart` sets the payload on the safe custom MIME type (not just `text/plain`); `text/plain` still carries a plain-text label; "Use template" still emits without any drag; `dragstart` is a no-op when `canCreate` is false.
- **`position-tree-node.component.spec.ts`**: dragover with the template MIME type shows the template-specific visual state distinct from the plain reparent drag-over state; both visual states clear on `dragleave`; dropping a template payload emits `templateDropped` with `{ templatePosition, packName, targetPosition: node }` and does **not** emit `reparentPosition`; an existing-position reparent drop still emits `reparentPosition` and not `templateDropped` (regression); a read-only node (`canManage=false`) ignores template dragover/drop entirely.
- **`position-management.component.spec.ts`** (new `describe('Native drag/drop from Position Templates onto the hierarchy', ...)`): root-drop opens the modal with `reportsToPositionId = null` and `source: 'template-drop-root'`; root-drop matches department when found; root-drop with no department match sets `suggestedDepartmentName` and does not call any department-create endpoint; drop-under-position uses the parent's `id`/`departmentId` and `source: 'template-drop-under-position'`; drop-under-position ignores the template's own `reportsToPositionKey`; read-only user gets the friendly toast (no modal) on both the canvas-drop and drop-under-position paths; `templatePreset` clears after `closeFormModal()` following a drop; a canvas-root-drop create payload still contains only backend-supported `CreatePositionRequest` fields with `roleId` never present.
- **`position-form-modal.component.spec.ts`**: existing template-preset fixtures updated with the now-required `source` field (compile-time requirement of the extended `PositionTemplatePreset` interface); underlying prefill/banner assertions unchanged.

### 13.8 Tests run

```powershell
npx ng test --no-watch --include "src/app/modules/organization/**/*.spec.ts"
```
**Result: 19 test files passed, 174 tests passed, 0 failed.**

```powershell
npm run build
```
**Result: build succeeded.** Same pre-existing CSS budget warnings as before (`position-management.component.css`, `position-tree-node.component.css`, `position-template-drawer.component.css`, and others already over the 4 kB soft budget prior to this change); no new compilation errors.

```powershell
git diff --check
```
**Result: no whitespace errors reported** (only pre-existing LF→CRLF `core.autocrlf` notices across the branch, unrelated to this change).

### 13.9 Skipped checks

- **Live browser verification against a running backend/tenant**: not performed — no `.claude/launch.json` dev-server config exists in this repo and standing up the tenant stack was out of scope for this pass (same limitation noted in §11.7/§12.2). Only unit tests, `ng build`, and `git diff --check` were run. Real HTML5 drag/drop (actual `dragstart`/`drop` browser events with a live `DataTransfer`) was exercised only through component-level unit tests that construct fake `DragEvent`/`DataTransfer`-shaped objects and call the handler methods directly — this is the same pattern already used elsewhere in this codebase's specs (no existing spec in this repo drives drag/drop through real jsdom `DragEvent`s, since jsdom's `DataTransfer` support is minimal).
- **Backend code**: not touched, per instructions.
- **Git commit / push**: not performed, per explicit instructions.

### 13.10 Remaining risks

- **No live-browser drag/drop confirmation.** The MIME-type-based branching (`event.dataTransfer.types.includes(...)`) is standard HTML5 DnD and should work in all evergreen browsers, but the "not-allowed" cursor behavior for read-only users during `dragover` (§13.6) and the exact drop-effect cursor icon are visual details only a live pass can confirm.
- **`departmentMessage` wording is a plain sentence**, not a structured object — if the UI later needs to localize or restyle just the inherited department name, it will need to be split back into parts rather than parsed out of the sentence.
- **Multi-node deep trees**: `templateDropped` propagation relies on every recursive `<app-position-tree-node>` re-emitting the child's output (`(templateDropped)="templateDropped.emit($event)"`), the same pattern already used for `reparentPosition`/`editPosition`/etc. in this component — consistent with the existing recursive-tree wiring, but a future refactor to change that propagation pattern would need to update both outputs together.
- **CSS budget warnings** on `position-management.component.css` and `position-tree-node.component.css` grew slightly with the new overlay/highlight rules; both were already over the pre-existing 4 kB soft budget before this change (see §11), so this is not a new regression, but it compounds an existing warning.

---

## 14. Removal of Noisy Modal Template Banner (2026-08-12)

Cleaned up the Create Position modal UI by removing the large top template banner block while maintaining full template prefill functionality.

### 14.1 Changes Made
- **Removed Top Banner**: Completely removed `.pfm-template-banner` and its sub-elements ("Started from template...", "Customize details before creating.", "Will report to: ...", "Inherited department ...") from `src/app/modules/organization/ui/position-form-modal/position-form-modal.component.html`.
- **Preserved Template Prefill Behavior**: The modal still pre-populates all form controls from template presets (`name`, `code`, `departmentId`, `reportsToPositionId`).
- **Inline Missing-Department Helper**: Added a clean inline hint directly under the Department field (`.pfm-dept-suggest-helper`) that displays `"Template suggests department: {departmentName}. Select an existing department before creating this position."` only when the template suggested department cannot be matched and no department is currently selected.
- **Updated CSS**: Cleaned up banner styles in `position-form-modal.component.css` and added `.pfm-dept-suggest-helper` styling.
- **Updated Spec Suite**: Updated `position-form-modal.component.spec.ts` to assert:
  - Form fields pre-populate from `templatePreset`.
  - `.pfm-template-banner` is not rendered.
  - "Started from template", "Will report to:", and "Inherited department" text strings are not rendered in the modal DOM.
  - Inline missing-department helper renders near the Department field when `departmentId` is unmatched/empty and hides once a department is selected or matched.
  - The submit payload remains backend-safe and unchanged.

### 14.2 Tests & Build Verification
- **Unit Tests**: `npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts` passed (19 test files, 176 tests passed).
- **Production Build**: `npm run build` succeeded with 0 compilation errors.
- **Git Diff Check**: `git diff --check` passed cleanly with 0 whitespace errors.

---

## 15. Removal of Raw Reports-To Template Keys from Template Drawer Cards (2026-08-12)

Cleaned up the Position Templates side-panel card UI by removing technical/internal reporting machine keys (e.g. `Reports to: chief-executive-officer`) from user view.

### 15.1 Changes Made
- **Removed Machine Key UI**: Removed `.ptd-pos-reports-chip` and `"Reports to: {{ pos.reportsToPositionKey }}"` rendering from `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.html`.
- **Preserved Internal Reporting Logic**: Retained `reportsToPositionKey` in the frontend DTO model (`PositionTemplatePackPositionResponse`) and internal template selection matching logic.
- **Click & Drag/Drop Behavior Preserved**: Clicking "Use template" still uses `reportsToPositionKey` internally to match an existing position and prefill `reportsToPositionId`. Drag/drop under an existing position continues to use the parent position ID, and root drop onto empty canvas continues to default to root (`reportsToPositionId = null`).
- **User-Facing Department Chip**: Retained friendly user-facing `departmentName` chip (e.g., `"Executive"`, `"Engineering"`).
- **Updated CSS**: Cleaned up `.ptd-pos-reports-chip` styles in `position-template-drawer.component.css`.
- **Updated Spec Suite**: Updated `position-template-drawer.component.spec.ts` and `position-management.component.spec.ts` to assert:
  - Template drawer cards no longer render `"Reports to:"` or raw `reportsToPositionKey` machine keys.
  - Clicking "Use template" still emits the position object with `reportsToPositionKey` intact.
  - Selecting a template still pre-fills the reporting line (`reportsToPositionId`) when a safe match exists in the store.
  - Drag/drop under an existing position still overrides template `reportsToPositionKey` with the parent position ID.

### 15.2 Tests & Build Verification
- **Unit Tests**: `npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts` passed (19 test files, 178 tests passed).
- **Production Build**: `npm run build` succeeded with 0 compilation errors.
- **Git Diff Check**: `git diff --check` passed cleanly with 0 whitespace errors.

---

## 16. Employee-Count Range Badge Removal & Pack Header Alignment Fix (2026-08-12)

Cleaned up the Position Templates drawer pack headers by removing employee-count range badges (e.g., `101–500 emp`) and fixing position count badge alignment.

### 16.1 Changes Made
- **Removed Range Badge UI**: Removed visible display of `.ptd-pack-range-badge` (`employeeCountRangeKey` / `101–500 emp`) from `src/app/modules/organization/ui/position-template-drawer/position-template-drawer.component.html`.
- **Preserved Data Contract**: Kept `employeeCountRangeKey`, `employeeCountMin`, and `employeeCountMax` in the `PositionTemplatePackResponse` interface / DTO for future recommendation features.
- **Fixed Position Count Badge Layout & Alignment**:
  - Restructured `ptd-pack-header` into a clean two-column flex layout:
    - **Left**: Chevron icon + template pack title (`ptd-pack-header-left`).
    - **Right**: Vertically centered position count badge (`ptd-pack-count-chip ptd-pack-count-badge`).
  - Added `white-space: nowrap` and `flex-shrink: 0` to prevent badge wrapping underneath long title names.
  - Used theme tokens (`var(--color-surface)`, `var(--color-text-secondary)`, `var(--color-border)`) without hardcoded colors.
  - Supported singular/plural formatting (`1 position` vs `N positions`).
- **Updated Spec Suite**: Updated `position-template-drawer.component.spec.ts` to assert:
  - Employee count range labels (e.g., `101–500 emp`) are no longer rendered in pack headers.
  - Position count badges render cleanly on the right with singular and plural support.
  - Accordion expand/collapse behavior continues to function as expected.

### 16.2 Tests & Build Verification
- **Unit Tests**: `npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts` passed (19 test files, 181 tests passed).
- **Production Build**: `npm run build` succeeded with 0 compilation errors.
- **Git Diff Check**: `git diff --check` passed cleanly with 0 whitespace errors.

---

## 17. Map-like Position Hierarchy Canvas Panning (2026-08-12)

Added intuitive map-like canvas panning to the Position Hierarchy tree view, allowing users to click/touch and drag empty canvas space to smoothly pan the tree content in 2D space.

### 17.1 Technical Design & Conflict Isolation
- **Transform State**: Combined 2D translate state (`treePanX`, `treePanY`, `isPanning`) with `treeZoom` into a single reactive CSS transform computed signal: `translate(panX, panY) scale(zoom)` on `.pm-tree-list-wrapper`.
- **Target Filtering & Interaction Isolation**:
  - Pointer down events are inspected: pointerdown on position cards (`.ptn-node-card`), drop targets (`.ptn-drop-target-box`), zoom controls (`.pm-zoom-controls`), buttons, inputs, or selects immediately ignores panning.
  - Position card dragging for reparenting and HTML5 drag/drop of templates remain 100% isolated because card dragging is handled by HTML5 drag events on cards, while canvas panning is activated only by PointerEvents on empty canvas space.
- **Pointer Capture & Reset**:
  - Activated pointer capture on `.pm-tree-container` during canvas panning drag, releasing capture on `pointerup` / `pointercancel`.
  - Updated `resetZoom()` to reset both zoom factor (to `1.0` / 100%) and pan offsets (`panX = 0`, `panY = 0`).
- **CSS & Visual Feedback**:
  - Applied `cursor: grab` on canvas by default and `cursor: grabbing` with `user-select: none` during active panning.
  - Added `touch-action: none` to canvas container to prevent mobile touch scrolling from fighting canvas panning.
  - Used theme tokens without hardcoded colors.

### 17.2 Tests & Build Verification
- **Unit Tests**: `npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts` passed (19 test files, 185 tests passed).
  - Asserted `pointerdown` on empty canvas starts panning and `pointermove` updates pan offsets.
  - Asserted `pointerup` and `pointercancel` end panning cleanly.
  - Asserted `pointerdown` on `.ptn-node-card` does not start canvas panning.
  - Asserted `resetZoom` resets both zoom and pan offset to origin.
- **Production Build**: `npm run build` completed with 0 compilation errors.
- **Git Diff Check**: `git diff --check` passed cleanly with 0 whitespace errors.

### 17.3 Remaining Risks
- **Extremely Large Hierarchies**: For giant org trees exceeding viewport bounds by many screens, pan boundaries are currently unclamped (free 2D infinite canvas). Future enhancements can add soft pan boundary clamping if required by product UX.

---

## 18. List View Drawer Alignment, Compact Template Cards & Icon Toggle (2026-08-12)

- **Drawer & List Table Layout**: Fixed flex container layout in `position-management.component.css` and `position-list-table.component.css` so `app-position-template-drawer` sits side-by-side cleanly without overlapping list table columns.
- **Compact Card & Action Button Label**: Reduced template card padding to `0.45rem 0.625rem` and changed action button text from `"Use template"` to `"Use"` with `size="sm"`.
- **Icon-Only Toggle & Hidden Archived Checkbox**: Retained square icon-only view toggle buttons and removed visible "Show archived" toolbar checkbox while keeping backend/store default `includeInactive = false`.

---

## 19. Moving Positions Controls into Unified Top Page Header Line (2026-08-12)

Moved all Positions controls (search icon/expandable input, department filter dropdown, Tree/List icon-only view toggle, Templates button with count badge, and Create position action button) onto the **exact same horizontal line** as the `Organization > Positions` breadcrumb (`<app-breadcrumb-header>`).

### 19.1 Changes Made
- **Same-Line Horizontal Layout**:
  - Restructured `<header class="pm-page-header">` in `position-management.component.html` using a `<div class="pm-header-row">` flex container with `justify-content: space-between; align-items: center;`.
  - **Left**: `<app-breadcrumb-header parentLabel="Organization" currentLabel="Positions" icon="organization" />` sits on the left of the header row.
  - **Right**: `.pm-controls` container sits on the right of the exact same row.
- **Expandable Search Icon Button**:
  - Replaced the always-open wide search input with a search icon button (`.pm-icon-btn`).
  - Added `searchExpanded` signal and `toggleSearch()` method in `position-management.component.ts`.
  - Clicking the search icon button toggles the expandable search input box (`.pm-search-expandable`) open/closed on the same line.
- **Preserved Control Behavior & Permission Gating**:
  - Search input (`onSearchChange`), department filter dropdown (`onDepartmentFilterChange`), Tree/List view toggle (`onViewModeToggle`), and Templates button (`openTemplateDrawer`) function as before.
  - Create position button remains protected by `org:manage` permission gating (`@if (hasManageAccess())`).
- **Retained Removed Controls Invariants**:
  - Visible "Show archived" checkbox remains removed.
  - Old Filter button remains removed.
- **Expanded Position Hierarchy Canvas & Drawer Height**: Updated `.pm-tree-container`, `app-position-template-drawer`, and `.ptd-panel` height calculations in `position-management.component.css` and `position-template-drawer.component.css` to `calc(100vh - 125px)` / `100%`, expanding both the Position hierarchy canvas and Position Templates side panel to fill the bottom workspace.

### 19.2 Tests & Build Verification
- **Unit Tests**: `npx ng test --no-watch --include src/app/modules/organization/**/*.spec.ts` passed (**19 test files passed, 189 tests passed, 0 failed**).
  - Asserted breadcrumb and controls render on the same horizontal header line (`.pm-header-row`).
  - Asserted search input is collapsed by default and expands when clicking the search icon button.
  - Asserted search input, department filter, view toggle buttons, templates button, and create position button handlers work correctly.
  - Asserted "Show archived" checkbox and old Filter button are not rendered in the DOM.
- **Production Build**: `npm run build` completed with 0 compilation errors.
- **Git Diff Check**: `git diff --check` passed cleanly with 0 whitespace errors.

### 19.3 Remaining Risks
- **Extremely Small Mobile Viewports (<360px)**: The header controls wrap smoothly on standard mobile screens. On extreme edge-case screens (<360px width), flex items wrap cleanly to maintain layout stability.





