# Shared Bulk-Action Primitives (Sub-project A) — Design

**Date:** 2026-09-28
**Status:** Approved (design), pending spec review
**Repo:** Hrms--Web-application---front-end---v1 (frontend only, no backend changes)

## Context

This is sub-project **A** of a four-part initiative:

| # | Sub-project | Depends on |
|---|---|---|
| A | Shared bulk-action primitives (this spec) | — |
| B | Employee list redesign (table, filters, sort, column picker, row actions Promote/Transfer/Offboard, bulk actions) | A |
| C | Task backlog bulk actions (status, assignee, priority, sprint, delete) | A |
| D | Bottom draft tray (onboarding drafts + new task drafts), replaces "Onboarding Drafts" tab | — |

Build order: A → B → C → D.

**Scope decisions already made:**
- The backlog receives **bulk actions only**. Column picker and filter popover are built inside B as employee-list features; promote them to `shared/` later only if a second consumer appears.
- The bulk-action bar **floats at the bottom center** (not inline above the table).

**Current state:**
- `app-task-table` (`src/app/modules/work/ui/task-table/task-table.component.ts`) has `selectable` / `selectedIds` inputs and `selectionChanged` / `selectAllChanged` outputs, with header tri-state logic (`allSelected`, `someSelected`) computed privately.
- `task-backlog.component.ts` owns a `selectedTaskIds` signal and an inline `.task-backlog__selection-toolbar` ("N tasks selected" + "Move selected to sprint" + ✕), shown only for the unsorted Backlog table.
- `shared/ui/popover` provides an anchored panel with outside-click / Escape close; open state is owned by the caller.
- No generic dropdown menu or bulk bar exists.

## Components

### 1. `SelectionModel` — `src/app/shared/utils/selection-model.ts`

Plain class (not a component, not injectable), signal-backed:

```ts
export class SelectionModel<TId extends string = string> {
  readonly selected: Signal<ReadonlySet<TId>>;
  readonly count: Signal<number>;
  isSelected(id: TId): boolean;
  toggle(id: TId, on?: boolean): void;
  setMany(ids: readonly TId[], on: boolean): void;
  clear(): void;
  allOf(ids: readonly TId[]): boolean;   // true only if ids non-empty and every id selected
  someOf(ids: readonly TId[]): boolean;  // at least one but not all selected
}
```

Semantics:
- Selection **persists across pagination** — IDs from different pages accumulate.
- Header checkbox acts on the **visible rows only** (caller passes visible IDs to `setMany` / `allOf` / `someOf`).
- **Clearing on search/filter change is the consumer's responsibility** (each screen calls `clear()` in its filter-change handler), so users never act on rows they can no longer see.
- Every mutation produces a new `Set` instance (signal change detection).

### 2. `<app-bulk-action-bar>` — `src/app/shared/ui/bulk-action-bar/`

```ts
export interface BulkAction {
  id: string;
  label: string;
  iconPath?: string;          // SVG path data (24x24 stroke) - the codebase has no icon component
  placement: 'primary' | 'more';
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;    // tooltip when disabled
}
```

- Inputs: `count: number`, `actions: BulkAction[]`, `noun?: string` (default `'item'`; renders "4 employees selected").
- Outputs: `action: string` (action id), `cleared: void`.
- Rendering: `position: fixed`, bottom-center, `bottom: calc(24px + var(--bottom-tray-offset, 0px))` (`88px` at `max-width: 768px` to clear `app-mobile-bottom-nav`) so D's draft tray can reserve space. `z-index: 1100` — above the mobile nav (1000), below modals (1200) so the selection survives under the Move-to-sprint dialog. Hidden when `count === 0`; slides/fades in otherwise. Respects `prefers-reduced-motion`.
- Layout: checked checkbox + "N {noun}(s) selected" · primary buttons · "More ▾" (`app-dropdown-menu` with `placement: 'more'` actions, `direction="up"`; omitted if none) · ✕ clear.
- Escape emits `cleared` **only when keyboard focus is inside the bar** (a document-level listener would also fire when Escape closes a modal, wiping the selection). Escape that closes the open "More" menu does not also clear (the menu panel stops propagation).
- `role="toolbar"`, `aria-label="Bulk actions"`, count in an `aria-live="polite"` region.
- **No permission logic** — the parent passes only actions the user may perform.
- Must render correctly on mobile width (wraps inside the bar, never scrolls the page; no `overflow-x: auto`, which would clip the upward "More" menu) and above `app-mobile-bottom-nav`.

### 3. `<app-dropdown-menu>` — `src/app/shared/ui/dropdown-menu/`

```ts
export interface MenuItem {
  id: string;
  label: string;
  iconPath?: string;   // SVG path data (24x24 stroke)
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
}
```

- Wraps `app-popover`; owns its own open state internally (unlike raw popover).
- Inputs: `items: MenuItem[]`, `align: 'left' | 'right'` (default `'right'`), `direction: 'down' | 'up'` (default `'down'`; the bulk bar uses `'up'` since it sits at the viewport bottom), `ariaLabel`.
- **Only one menu is open app-wide** (module-level signal): because trigger clicks stop propagation, the popover's document-click close never reaches other open menus, so opening one menu closes the rest.
- Output: `selected: string` (item id). Menu closes after selection.
- Trigger is projected via `[menu-trigger]` so the same component backs the bar's "More ▾" and the row "⋯" button.
- Keyboard: ArrowUp/ArrowDown move focus across enabled items, Enter/Space select, Escape closes and returns focus to trigger.
- Trigger clicks call `stopPropagation()` so a "⋯" inside a clickable row (`routerLink` / `(click)` row) does not trigger the row.
- `danger` items render in the error color; `dividerBefore` renders a separator.

## Backlog migration (in-scope)

- Replace `selectedTaskIds` signal in `task-backlog.component.ts` with a `SelectionModel`.
- Remove the inline `.task-backlog__selection-toolbar` and its styles; the unsorted-header now always shows.
- Render `<app-bulk-action-bar noun="task">` with a single primary action **"Move to sprint"** (opens existing `MoveTasksToSprintDialog`). Undo banner behavior unchanged.
- `app-task-table` public inputs/outputs stay **unchanged**; internally its header tri-state may use `allOf`/`someOf` helpers but no API change. Selection remains limited to the unsorted Backlog table in A — extending checkboxes to sprint sections is sub-project C.

## Out of scope

- Column picker, filter popover (B).
- Any new bulk operation or backend endpoint (B, C).
- Draft tray (D) — A only reserves `--bottom-tray-offset`.

## Testing (Vitest, `vi.fn()`, mirror `popover.component.spec.ts` host-component style)

- `selection-model.spec.ts`: toggle, setMany on/off, clear, cross-"page" accumulation, `allOf`/`someOf` edge cases (empty ids, partial, full), new Set identity per mutation.
- `bulk-action-bar.component.spec.ts`: hidden at 0; count + noun pluralization; primary vs more placement; More omitted when empty; action emits id; disabled action does not emit; ✕ and Escape emit `cleared`.
- `dropdown-menu.component.spec.ts`: opens on trigger, closes on outside click/Escape/selection; emits id; disabled item not selectable; divider + danger classes; arrow-key navigation; trigger click does not propagate to a clickable parent.
- `task-backlog` spec: existing move-to-sprint tests updated to go through the bar; selecting tasks shows bar with count; clearing hides it.
- Full `ng test` and `ng build` green before completion.
