# Shared Bulk-Action Primitives (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three reusable frontend primitives — `SelectionModel`, `<app-dropdown-menu>`, `<app-bulk-action-bar>` — and migrate the task backlog's inline selection toolbar onto them.

**Architecture:** `SelectionModel` is a plain signal-backed class the host screen instantiates. `<app-dropdown-menu>` wraps the existing `app-popover` and owns its open state (only one menu open app-wide). `<app-bulk-action-bar>` is a fixed, bottom-center toolbar rendered by the host screen when `count > 0`, delegating its "More" menu to `<app-dropdown-menu>`. No backend changes.

**Tech Stack:** Angular 21 (standalone components, signals, `input()`/`output()`), Vitest via `@angular/build:unit-test` (`vi.fn()`), plain CSS with design tokens from `src/styles.css`.

**Spec:** `docs/superpowers/specs/finished/2026-09-28/2026-09-28-shared-bulk-action-primitives-design.md`

## Global Constraints

- Frontend repo only: `C:\onevoNew\Hrms--Web-application---front-end---v1`. Branch `feature/task-subtasks`. **Do not create git worktrees.**
- This working tree is shared with other sessions — run `git status` before each commit and stage only the files listed in the task.
- Test runner is **Vitest** (not Jest): use `vi.fn()` / `vi.spyOn()`.
- Single-spec run: `npx ng test --watch=false --include=<path-to-spec>` from the repo root. Full: `npx ng test --watch=false`. Build: `npx ng build`.
- Icons: the codebase has **no icon component**; icons are inline `<svg viewBox="0 0 24 24">` with `<path d="…">`. Therefore `BulkAction.icon` / `MenuItem.icon` from the spec are implemented as **`iconPath?: string` (SVG path data)**.
- Colors only via tokens: `--color-surface`, `--color-surface-secondary`, `--color-border`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-danger-text`, `--color-danger-subtle`.
- z-index ladder (measured): `app-mobile-bottom-nav` 1000 < **bulk bar 1100** < `app-modal` overlay (`z-[1200]`) and `.global-dialog-container` 1200 < `app-popover` 1300 < toasts 2000. The bar must stay BELOW modals because the selection deliberately survives while the Move-to-sprint dialog is open. `.task-backlog__undo-banner` is in normal flow (not fixed), so it does not collide with the bar.
- Bulk bar bottom offset: `calc(24px + var(--bottom-tray-offset, 0px))` desktop; `calc(88px + var(--bottom-tray-offset, 0px))` at `max-width: 768px` (clears `app-mobile-bottom-nav`).
- `app-task-table` public inputs/outputs must NOT change.

**Refinements to the spec discovered while planning (apply them; they are part of this plan):**
1. `icon` → `iconPath` (see above).
2. `<app-dropdown-menu>` gets a `direction: 'down' | 'up'` input (default `'down'`); the bulk bar uses `'up'` because it sits at the bottom of the viewport.
3. Bulk bar Escape clears **only when keyboard focus is inside the bar** (a document-level listener would also fire when the user presses Escape to close a modal like the Move-to-sprint dialog, wiping the selection). The dropdown panel stops Escape propagation so closing the "More" menu does not also clear.
4. Only one `<app-dropdown-menu>` may be open at a time (module-level signal), because trigger clicks `stopPropagation()` and so the popover's document-click close never fires for other open menus.

---

## File Structure

| File | Responsibility |
|---|---|
| Create `src/app/shared/utils/selection-model.ts` | Selection state class |
| Create `src/app/shared/utils/selection-model.spec.ts` | Its tests |
| Create `src/app/shared/ui/dropdown-menu/dropdown-menu.component.ts` | `MenuItem` type + menu component (template inline) |
| Create `src/app/shared/ui/dropdown-menu/dropdown-menu.component.css` | Menu styles |
| Create `src/app/shared/ui/dropdown-menu/dropdown-menu.component.spec.ts` | Its tests |
| Create `src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.ts` | `BulkAction` type + bar component |
| Create `src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.css` | Bar styles |
| Create `src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.spec.ts` | Its tests |
| Modify `src/app/modules/work/feature/task-backlog/task-backlog.component.ts` | Use `SelectionModel` + bar; drop inline toolbar |
| Modify `src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts` | Update the `bulk select and move to sprint` block |

---

### Task 1: `SelectionModel`

**Files:**
- Create: `src/app/shared/utils/selection-model.ts`
- Test: `src/app/shared/utils/selection-model.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export class SelectionModel<TId extends string = string> {
    readonly selected: Signal<ReadonlySet<TId>>;
    readonly count: Signal<number>;
    isSelected(id: TId): boolean;
    toggle(id: TId, on?: boolean): void;
    setMany(ids: readonly TId[], on: boolean): void;
    clear(): void;
    allOf(ids: readonly TId[]): boolean;
    someOf(ids: readonly TId[]): boolean;
  }
  ```

- [ ] **Step 1: Write the failing test**

`src/app/shared/utils/selection-model.spec.ts`:
```ts
import { SelectionModel } from './selection-model';

describe('SelectionModel', () => {
  it('starts empty', () => {
    const model = new SelectionModel();
    expect(model.count()).toBe(0);
    expect(model.selected().size).toBe(0);
  });

  it('toggle flips membership when no explicit state is given', () => {
    const model = new SelectionModel();
    model.toggle('a');
    expect(model.isSelected('a')).toBe(true);
    model.toggle('a');
    expect(model.isSelected('a')).toBe(false);
  });

  it('toggle with an explicit state is idempotent', () => {
    const model = new SelectionModel();
    model.toggle('a', true);
    model.toggle('a', true);
    expect(model.count()).toBe(1);
    model.toggle('a', false);
    model.toggle('a', false);
    expect(model.count()).toBe(0);
  });

  it('accumulates ids from different pages', () => {
    const model = new SelectionModel();
    model.setMany(['p1-a', 'p1-b', 'p1-c'], true);
    model.setMany(['p2-a', 'p2-b'], true);
    expect(model.count()).toBe(5);
  });

  it('setMany(false) removes only the given ids', () => {
    const model = new SelectionModel();
    model.setMany(['a', 'b', 'c'], true);
    model.setMany(['a', 'b'], false);
    expect([...model.selected()]).toEqual(['c']);
  });

  it('clear empties the selection', () => {
    const model = new SelectionModel();
    model.setMany(['a', 'b'], true);
    model.clear();
    expect(model.count()).toBe(0);
  });

  it('allOf is false for an empty id list', () => {
    const model = new SelectionModel();
    model.toggle('a', true);
    expect(model.allOf([])).toBe(false);
  });

  it('allOf / someOf report full, partial and no selection of the visible ids', () => {
    const model = new SelectionModel();
    const visible = ['a', 'b', 'c'];
    expect(model.allOf(visible)).toBe(false);
    expect(model.someOf(visible)).toBe(false);

    model.toggle('a', true);
    expect(model.allOf(visible)).toBe(false);
    expect(model.someOf(visible)).toBe(true);

    model.setMany(visible, true);
    expect(model.allOf(visible)).toBe(true);
    expect(model.someOf(visible)).toBe(false);
  });

  it('selected ids outside the visible list do not affect allOf/someOf', () => {
    const model = new SelectionModel();
    model.toggle('other-page', true);
    expect(model.someOf(['a', 'b'])).toBe(false);
    expect(model.allOf(['a', 'b'])).toBe(false);
  });

  it('produces a new Set instance on every mutation', () => {
    const model = new SelectionModel();
    const s0 = model.selected();
    model.toggle('a');
    const s1 = model.selected();
    model.setMany(['b'], true);
    const s2 = model.selected();
    model.clear();
    const s3 = model.selected();
    expect(new Set([s0, s1, s2, s3]).size).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include=src/app/shared/utils/selection-model.spec.ts`
Expected: FAIL — cannot resolve `./selection-model`.

- [ ] **Step 3: Write minimal implementation**

`src/app/shared/utils/selection-model.ts`:
```ts
import { Signal, computed, signal } from '@angular/core';

/**
 * Signal-backed set of selected row ids for list screens with bulk actions.
 * Ids persist across pagination; the header checkbox acts on the visible ids only
 * (pass them to setMany/allOf/someOf). Clearing on search/filter change is the
 * owning screen's job so users never act on rows they can no longer see.
 */
export class SelectionModel<TId extends string = string> {
  private readonly state = signal<ReadonlySet<TId>>(new Set<TId>());

  readonly selected: Signal<ReadonlySet<TId>> = this.state.asReadonly();
  readonly count = computed(() => this.state().size);

  isSelected(id: TId): boolean {
    return this.state().has(id);
  }

  toggle(id: TId, on?: boolean): void {
    const next = new Set(this.state());
    const select = on ?? !next.has(id);
    if (select) next.add(id); else next.delete(id);
    this.state.set(next);
  }

  setMany(ids: readonly TId[], on: boolean): void {
    const next = new Set(this.state());
    for (const id of ids) {
      if (on) next.add(id); else next.delete(id);
    }
    this.state.set(next);
  }

  clear(): void {
    this.state.set(new Set<TId>());
  }

  allOf(ids: readonly TId[]): boolean {
    const selected = this.state();
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }

  someOf(ids: readonly TId[]): boolean {
    const selected = this.state();
    const hits = ids.filter((id) => selected.has(id)).length;
    return hits > 0 && hits < ids.length;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false --include=src/app/shared/utils/selection-model.spec.ts`
Expected: PASS, 10 tests. Paste the raw summary line into your report.

- [ ] **Step 5: Commit**

```bash
git status
git add src/app/shared/utils/selection-model.ts src/app/shared/utils/selection-model.spec.ts
git commit -m "feat(shared): add SelectionModel for bulk-selectable lists"
```

---

### Task 2: `<app-dropdown-menu>`

**Files:**
- Create: `src/app/shared/ui/dropdown-menu/dropdown-menu.component.ts`
- Create: `src/app/shared/ui/dropdown-menu/dropdown-menu.component.css`
- Test: `src/app/shared/ui/dropdown-menu/dropdown-menu.component.spec.ts`

**Interfaces:**
- Consumes: `PopoverComponent` from `src/app/shared/ui/popover/popover.component.ts` — inputs `open: boolean`, `align: 'left' | 'right'`, `ariaLabel: string`; output `closed: void`; content slots `[popover-trigger]` and `[popover-panel]`; renders the panel as `.app-popover__panel[role="menu"]` only while open; emits `closed` on document Escape and on document clicks outside its host.
- Produces:
  ```ts
  export interface MenuItem {
    id: string;
    label: string;
    iconPath?: string;
    danger?: boolean;
    disabled?: boolean;
    dividerBefore?: boolean;
  }
  // selector 'app-dropdown-menu'
  // inputs: items: MenuItem[] (required), align: 'left'|'right' = 'right',
  //         direction: 'down'|'up' = 'down', ariaLabel: string = 'Menu'
  // output: selected: string (item id)
  // content slot: [menu-trigger]
  // DOM hooks for tests: items render as button[data-testid="menu-item-<id>"]
  ```

- [ ] **Step 1: Write the failing test**

`src/app/shared/ui/dropdown-menu/dropdown-menu.component.spec.ts`:
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DropdownMenuComponent, MenuItem } from './dropdown-menu.component';

@Component({
  standalone: true,
  imports: [DropdownMenuComponent],
  template: `
    <div class="row" (click)="rowClicks = rowClicks + 1">
      <app-dropdown-menu [items]="items" ariaLabel="Row actions" (selected)="picked.push($event)">
        <button menu-trigger type="button" class="trigger-a">⋯</button>
      </app-dropdown-menu>
    </div>
    <app-dropdown-menu [items]="items" (selected)="picked.push($event)">
      <button menu-trigger type="button" class="trigger-b">B</button>
    </app-dropdown-menu>
    <button type="button" class="outside">Outside</button>
  `
})
class HostComponent {
  rowClicks = 0;
  picked: string[] = [];
  items: MenuItem[] = [
    { id: 'promote', label: 'Promote' },
    { id: 'archived', label: 'Archived', disabled: true },
    { id: 'transfer', label: 'Transfer' },
    { id: 'offboard', label: 'Offboard', danger: true, dividerBefore: true }
  ];
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const menus = () => el.querySelectorAll('[role="menu"]');
  return { fixture, el, click, menus };
}

describe('DropdownMenuComponent', () => {
  it('is closed initially and opens on trigger click', async () => {
    const { click, menus } = await setup();
    expect(menus().length).toBe(0);
    click('.trigger-a');
    expect(menus().length).toBe(1);
  });

  it('trigger click does not reach a clickable ancestor row', async () => {
    const { fixture, click } = await setup();
    click('.trigger-a');
    expect(fixture.componentInstance.rowClicks).toBe(0);
  });

  it('emits the item id, closes, and does not reach the row on selection', async () => {
    const { fixture, click, menus } = await setup();
    click('.trigger-a');
    click('[data-testid="menu-item-transfer"]');
    expect(fixture.componentInstance.picked).toEqual(['transfer']);
    expect(fixture.componentInstance.rowClicks).toBe(0);
    expect(menus().length).toBe(0);
  });

  it('disabled items are rendered disabled and do not emit', async () => {
    const { fixture, el, click } = await setup();
    click('.trigger-a');
    const disabled = el.querySelector('[data-testid="menu-item-archived"]') as HTMLButtonElement;
    expect(disabled.disabled).toBe(true);
    disabled.click();
    expect(fixture.componentInstance.picked).toEqual([]);
  });

  it('renders danger styling and a divider before flagged items', async () => {
    const { el, click } = await setup();
    click('.trigger-a');
    const offboard = el.querySelector('[data-testid="menu-item-offboard"]') as HTMLElement;
    expect(offboard.classList).toContain('dropdown-menu__item--danger');
    expect(offboard.previousElementSibling?.classList).toContain('dropdown-menu__divider');
  });

  it('closes on an outside click', async () => {
    const { click, menus } = await setup();
    click('.trigger-a');
    click('.outside');
    expect(menus().length).toBe(0);
  });

  it('opening one menu closes any other open menu', async () => {
    const { el, click, menus } = await setup();
    click('.trigger-a');
    click('.trigger-b');
    expect(menus().length).toBe(1);
    expect(el.querySelector('.trigger-b')!.closest('app-dropdown-menu')!.querySelector('[role="menu"]')).toBeTruthy();
  });

  it('clicking the trigger again closes the menu', async () => {
    const { click, menus } = await setup();
    click('.trigger-a');
    click('.trigger-a');
    expect(menus().length).toBe(0);
  });

  it('ArrowDown/ArrowUp move focus across enabled items only, wrapping', async () => {
    const { fixture, el, click } = await setup();
    click('.trigger-a');
    await fixture.whenStable();
    const panel = el.querySelector('.dropdown-menu__panel') as HTMLElement;
    const key = (k: string) => panel.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-promote');
    key('ArrowDown');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-transfer');
    key('ArrowDown');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-offboard');
    key('ArrowDown');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-promote');
    key('ArrowUp');
    expect((document.activeElement as HTMLElement).dataset['testid']).toBe('menu-item-offboard');
  });

  it('Escape inside the panel closes, refocuses the trigger, and does not propagate', async () => {
    const { fixture, el, click, menus } = await setup();
    const outerListener = vi.fn();
    el.addEventListener('keydown', outerListener);
    click('.trigger-a');
    await fixture.whenStable();
    const panel = el.querySelector('.dropdown-menu__panel') as HTMLElement;
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(menus().length).toBe(0);
    expect(document.activeElement).toBe(el.querySelector('.trigger-a'));
    expect(outerListener).not.toHaveBeenCalled();
  });
});
```

Note: the component test host must be attached to `document` for focus assertions; Angular's `TestBed.createComponent` attaches the root element to `document.body` in the Vitest/jsdom runner. If focus assertions fail only because the element is detached, add `document.body.appendChild(fixture.nativeElement)` in `setup()` — do not weaken the assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include=src/app/shared/ui/dropdown-menu/dropdown-menu.component.spec.ts`
Expected: FAIL — cannot resolve `./dropdown-menu.component`.

- [ ] **Step 3: Write the implementation**

`src/app/shared/ui/dropdown-menu/dropdown-menu.component.ts`:
```ts
import { Component, ElementRef, Injector, OnDestroy, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { PopoverComponent } from '../popover/popover.component';

export interface MenuItem {
  id: string;
  label: string;
  /** SVG path data for a 24x24 stroke icon. */
  iconPath?: string;
  danger?: boolean;
  disabled?: boolean;
  dividerBefore?: boolean;
}

// Only one menu may be open app-wide: trigger clicks stop propagation (so a "⋯" inside a
// clickable row doesn't open the row), which also stops app-popover's document-click close
// from reaching other open menus - so opening one menu closes the rest here instead.
const openMenu = signal<DropdownMenuComponent | null>(null);

/**
 * Action menu anchored to a projected [menu-trigger] element. Owns its open state,
 * unlike app-popover. Used for bulk-bar "More" and per-row "⋯" menus.
 */
@Component({
  selector: 'app-dropdown-menu',
  standalone: true,
  imports: [PopoverComponent],
  host: {
    class: 'dropdown-menu',
    '[class.dropdown-menu--up]': "direction() === 'up'"
  },
  template: `
    <app-popover [open]="isOpen()" [align]="align()" [ariaLabel]="ariaLabel()" (closed)="close()">
      <span popover-trigger #trigger class="dropdown-menu__trigger" (click)="onTriggerClick($event)">
        <ng-content select="[menu-trigger]" />
      </span>
      <div popover-panel #panel class="dropdown-menu__panel" (keydown)="onKeydown($event)" (click)="$event.stopPropagation()">
        @for (item of items(); track item.id) {
          @if (item.dividerBefore) {
            <div class="dropdown-menu__divider" role="separator"></div>
          }
          <button
            type="button"
            role="menuitem"
            class="dropdown-menu__item"
            [class.dropdown-menu__item--danger]="item.danger"
            [disabled]="item.disabled"
            [attr.data-testid]="'menu-item-' + item.id"
            (click)="choose(item)"
          >
            @if (item.iconPath) {
              <svg class="dropdown-menu__icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.iconPath" /></svg>
            }
            <span>{{ item.label }}</span>
          </button>
        }
      </div>
    </app-popover>
  `,
  styleUrl: './dropdown-menu.component.css'
})
export class DropdownMenuComponent implements OnDestroy {
  items = input.required<MenuItem[]>();
  align = input<'left' | 'right'>('right');
  direction = input<'down' | 'up'>('down');
  ariaLabel = input<string>('Menu');
  selected = output<string>();

  protected readonly isOpen = computed(() => openMenu() === this);

  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly injector = inject(Injector);

  protected onTriggerClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.close();
      return;
    }
    openMenu.set(this);
    afterNextRender(() => this.enabledItems()[0]?.focus(), { injector: this.injector });
  }

  protected choose(item: MenuItem): void {
    if (item.disabled) return;
    this.close();
    this.selected.emit(item.id);
  }

  close(): void {
    if (openMenu() === this) openMenu.set(null);
  }

  ngOnDestroy(): void {
    // Don't leave a destroyed instance in the module-level slot (e.g. row removed while its menu is open).
    this.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.enabledItems();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        event.preventDefault();
        items[index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length]?.focus();
        break;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.close();
        this.trigger().nativeElement.querySelector<HTMLElement>('button, [tabindex]')?.focus();
        break;
    }
  }

  private enabledItems(): HTMLButtonElement[] {
    return Array.from(this.panel().nativeElement.querySelectorAll<HTMLButtonElement>('button.dropdown-menu__item:not([disabled])'));
  }
}
```

Note on Escape: `app-popover` also listens for `document:keydown.escape`; because the panel handler calls `stopPropagation()`, only this handler runs when focus is in the panel. When focus is elsewhere, the popover's document listener emits `closed` → `close()`, which is idempotent.

`src/app/shared/ui/dropdown-menu/dropdown-menu.component.css`:
```css
:host {
  display: inline-block;
}

.dropdown-menu__trigger {
  display: inline-flex;
}

:host ::ng-deep .app-popover__panel {
  min-width: 12rem;
  padding: 0.35rem;
}

:host(.dropdown-menu--up) ::ng-deep .app-popover__panel {
  top: auto;
  bottom: calc(100% + 0.5rem);
}

.dropdown-menu__panel {
  display: flex;
  flex-direction: column;
}

.dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.5rem 0.65rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--color-text-primary);
  font: inherit;
  font-size: 0.8125rem;
  text-align: left;
  cursor: pointer;
}

.dropdown-menu__item:hover:not(:disabled),
.dropdown-menu__item:focus-visible {
  background: var(--color-surface-secondary);
  outline: none;
}

.dropdown-menu__item:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dropdown-menu__item--danger {
  color: var(--color-danger-text);
}

.dropdown-menu__item--danger:hover:not(:disabled) {
  background: var(--color-danger-subtle);
}

.dropdown-menu__icon {
  width: 16px;
  height: 16px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dropdown-menu__divider {
  height: 1px;
  margin: 0.3rem 0.25rem;
  background: var(--color-border);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false --include=src/app/shared/ui/dropdown-menu/dropdown-menu.component.spec.ts`
Expected: PASS, 10 tests. Also re-run `--include=src/app/shared/ui/popover/popover.component.spec.ts` — PASS (popover untouched). Paste raw summary lines.

- [ ] **Step 5: Commit**

```bash
git status
git add src/app/shared/ui/dropdown-menu/
git commit -m "feat(shared): add app-dropdown-menu built on app-popover"
```

---

### Task 3: `<app-bulk-action-bar>`

**Files:**
- Create: `src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.ts`
- Create: `src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.css`
- Test: `src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.spec.ts`

**Interfaces:**
- Consumes: `DropdownMenuComponent`, `MenuItem` from Task 2 (`src/app/shared/ui/dropdown-menu/dropdown-menu.component.ts`) — inputs `items`, `align`, `direction`, `ariaLabel`; output `selected: string`; trigger slot `[menu-trigger]`; items render as `[data-testid="menu-item-<id>"]`.
- Produces:
  ```ts
  export interface BulkAction {
    id: string;
    label: string;
    iconPath?: string;
    placement: 'primary' | 'more';
    danger?: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }
  // selector 'app-bulk-action-bar'
  // inputs: count: number (required), actions: BulkAction[] (required), noun: string = 'item'
  // outputs: action: string (action id), cleared: void
  // DOM hooks: [data-testid="bulk-action-bar"], [data-testid="bulk-action-<id>"],
  //            [data-testid="bulk-action-more"], [data-testid="bulk-action-clear"]
  ```

- [ ] **Step 1: Write the failing test**

`src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.spec.ts`:
```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BulkAction, BulkActionBarComponent } from './bulk-action-bar.component';

@Component({
  standalone: true,
  imports: [BulkActionBarComponent],
  template: `
    <app-bulk-action-bar
      [count]="count"
      [actions]="actions"
      noun="employee"
      (action)="actionIds.push($event)"
      (cleared)="clearedCount = clearedCount + 1"
    />
  `
})
class HostComponent {
  count = 0;
  actionIds: string[] = [];
  clearedCount = 0;
  actions: BulkAction[] = [
    { id: 'change-position', label: 'Change Position', placement: 'primary' },
    { id: 'locked', label: 'Locked', placement: 'primary', disabled: true, disabledReason: 'Not allowed' },
    { id: 'export', label: 'Export Selected', placement: 'more' },
    { id: 'offboard', label: 'Bulk Offboard', placement: 'more', danger: true }
  ];
}

async function setup(count: number, actions?: BulkAction[]) {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.count = count;
  if (actions) fixture.componentInstance.actions = actions;
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  return { fixture, el, q };
}

describe('BulkActionBarComponent', () => {
  it('renders nothing when count is 0', async () => {
    const { q } = await setup(0);
    expect(q('bulk-action-bar')).toBeNull();
  });

  it('shows the pluralized count', async () => {
    const one = await setup(1);
    expect(one.q('bulk-action-bar')!.textContent).toContain('1 employee selected');
    TestBed.resetTestingModule();
    const many = await setup(4);
    expect(many.q('bulk-action-bar')!.textContent).toContain('4 employees selected');
  });

  it('exposes toolbar semantics', async () => {
    const { q } = await setup(2);
    const bar = q('bulk-action-bar')!;
    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBe('Bulk actions');
    expect(bar.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('renders primary actions as buttons and emits their id', async () => {
    const { fixture, q } = await setup(2);
    q('bulk-action-change-position')!.click();
    expect(fixture.componentInstance.actionIds).toEqual(['change-position']);
    expect(q('bulk-action-export')).toBeNull();
  });

  it('disabled primary actions are disabled, carry their reason as title, and do not emit', async () => {
    const { fixture, q } = await setup(2);
    const locked = q('bulk-action-locked') as HTMLButtonElement;
    expect(locked.disabled).toBe(true);
    expect(locked.title).toBe('Not allowed');
    locked.click();
    expect(fixture.componentInstance.actionIds).toEqual([]);
  });

  it('puts "more" actions in the More menu and emits their id', async () => {
    const { fixture, el, q } = await setup(2);
    q('bulk-action-more')!.click();
    fixture.detectChanges();
    const offboard = el.querySelector('[data-testid="menu-item-offboard"]') as HTMLElement;
    expect(offboard.classList).toContain('dropdown-menu__item--danger');
    offboard.click();
    expect(fixture.componentInstance.actionIds).toEqual(['offboard']);
  });

  it('omits the More button when there are no "more" actions', async () => {
    const { q } = await setup(2, [{ id: 'move', label: 'Move to sprint', placement: 'primary' }]);
    expect(q('bulk-action-more')).toBeNull();
  });

  it('clear button emits cleared', async () => {
    const { fixture, q } = await setup(2);
    q('bulk-action-clear')!.click();
    expect(fixture.componentInstance.clearedCount).toBe(1);
  });

  it('Escape with focus inside the bar emits cleared', async () => {
    const { fixture, q } = await setup(2);
    q('bulk-action-change-position')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.clearedCount).toBe(1);
  });

  it('Escape elsewhere on the page does not clear (e.g. closing a modal)', async () => {
    const { fixture } = await setup(2);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.clearedCount).toBe(0);
  });

  it('Escape that closes the open More menu does not also clear', async () => {
    const { fixture, el, q } = await setup(2);
    q('bulk-action-more')!.click();
    fixture.detectChanges();
    (el.querySelector('.dropdown-menu__panel') as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.clearedCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false --include=src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.spec.ts`
Expected: FAIL — cannot resolve `./bulk-action-bar.component`.

- [ ] **Step 3: Write the implementation**

`src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.ts`:
```ts
import { Component, computed, input, output } from '@angular/core';
import { DropdownMenuComponent, MenuItem } from '../dropdown-menu/dropdown-menu.component';

export interface BulkAction {
  id: string;
  label: string;
  /** SVG path data for a 24x24 stroke icon. */
  iconPath?: string;
  placement: 'primary' | 'more';
  danger?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

/**
 * Floating bottom-center toolbar shown while rows are selected. Has no permission
 * logic: the host passes only the actions the user may perform.
 */
@Component({
  selector: 'app-bulk-action-bar',
  standalone: true,
  imports: [DropdownMenuComponent],
  template: `
    @if (count() > 0) {
      <div class="bulk-bar" role="toolbar" aria-label="Bulk actions" data-testid="bulk-action-bar" (keydown.escape)="cleared.emit()">
        <span class="bulk-bar__count" aria-live="polite">
          <svg class="bulk-bar__check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          {{ label() }}
        </span>
        <span class="bulk-bar__sep" aria-hidden="true"></span>
        @for (item of primaryActions(); track item.id) {
          <button
            type="button"
            class="bulk-bar__action"
            [class.bulk-bar__action--danger]="item.danger"
            [disabled]="item.disabled"
            [attr.title]="item.disabled ? (item.disabledReason ?? null) : null"
            [attr.data-testid]="'bulk-action-' + item.id"
            (click)="action.emit(item.id)"
          >
            @if (item.iconPath) {
              <svg class="bulk-bar__icon" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="item.iconPath" /></svg>
            }
            {{ item.label }}
          </button>
        }
        @if (moreItems().length > 0) {
          <app-dropdown-menu [items]="moreItems()" align="left" direction="up" ariaLabel="More bulk actions" (selected)="action.emit($event)">
            <button menu-trigger type="button" class="bulk-bar__action" data-testid="bulk-action-more">
              More
              <svg class="bulk-bar__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
          </app-dropdown-menu>
        }
        <button type="button" class="bulk-bar__clear" aria-label="Clear selection" title="Clear selection" data-testid="bulk-action-clear" (click)="cleared.emit()">
          <svg class="bulk-bar__icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    }
  `,
  styleUrl: './bulk-action-bar.component.css'
})
export class BulkActionBarComponent {
  count = input.required<number>();
  actions = input.required<BulkAction[]>();
  noun = input<string>('item');
  action = output<string>();
  cleared = output<void>();

  protected readonly label = computed(() => {
    const n = this.count();
    return `${n} ${this.noun()}${n === 1 ? '' : 's'} selected`;
  });

  protected readonly primaryActions = computed(() => this.actions().filter((a) => a.placement === 'primary'));

  protected readonly moreItems = computed<MenuItem[]>(() =>
    this.actions()
      .filter((a) => a.placement === 'more')
      .map((a) => ({ id: a.id, label: a.label, iconPath: a.iconPath, danger: a.danger, disabled: a.disabled }))
  );
}
```

Note: the loop variable is deliberately `item`, not `action` — `action` would shadow the `action` output and `(click)` would call `.emit` on a `BulkAction`.

`src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.css`:
```css
.bulk-bar {
  position: fixed;
  left: 50%;
  bottom: calc(24px + var(--bottom-tray-offset, 0px));
  z-index: 1100;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  max-width: calc(100vw - 32px);
  padding: 0.45rem 0.5rem 0.45rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 0.85rem;
  background: var(--color-surface);
  box-shadow: 0 12px 32px rgb(0 0 0 / 18%);
  transform: translateX(-50%);
  animation: bulk-bar-in 160ms ease-out;
}

@keyframes bulk-bar-in {
  from { opacity: 0; transform: translate(-50%, 12px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@media (prefers-reduced-motion: reduce) {
  .bulk-bar { animation: none; }
}

.bulk-bar__count {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  white-space: nowrap;
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 600;
}

.bulk-bar__check {
  width: 16px;
  height: 16px;
  padding: 2px;
  border-radius: 4px;
  background: var(--color-accent);
  color: #fff;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.bulk-bar__sep {
  width: 1px;
  height: 20px;
  margin: 0 0.35rem;
  background: var(--color-border);
}

.bulk-bar__action {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 0.55rem;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.bulk-bar__action:hover:not(:disabled) {
  background: var(--color-surface-secondary);
}

.bulk-bar__action:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.bulk-bar__action--danger {
  color: var(--color-danger-text);
}

.bulk-bar__clear {
  display: inline-flex;
  margin-left: 0.2rem;
  padding: 0.35rem;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.bulk-bar__clear:hover {
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
}

.bulk-bar__icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

@media (max-width: 768px) {
  .bulk-bar {
    bottom: calc(88px + var(--bottom-tray-offset, 0px));
    flex-wrap: wrap;
    justify-content: center;
  }

  .bulk-bar__sep { display: none; }
}
```

(Do not use `overflow-x: auto` on `.bulk-bar` — it would clip the upward "More" dropdown panel.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false --include=src/app/shared/ui/bulk-action-bar/bulk-action-bar.component.spec.ts`
Expected: PASS, 11 tests. Paste the raw summary line.

- [ ] **Step 5: Commit**

```bash
git status
git add src/app/shared/ui/bulk-action-bar/
git commit -m "feat(shared): add floating app-bulk-action-bar"
```

---

### Task 4: Migrate the task backlog onto the primitives

**Files:**
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts` (template ~lines 137-189, styles ~lines 214-218, class ~lines 239, 430-446, 503-515)
- Test: `src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts` (describe block `bulk select and move to sprint`, ~lines 580-615)

**Interfaces:**
- Consumes: `SelectionModel` (Task 1: `selected`, `count`, `toggle(id, on?)`, `setMany(ids, on)`, `clear()`); `BulkActionBarComponent` + `BulkAction` (Task 3: inputs `count`, `actions`, `noun`; outputs `action`, `cleared`; test ids `bulk-action-bar`, `bulk-action-<id>`, `bulk-action-clear`).
- Produces: backlog keeps the `selectedTaskIds` name (now `this.selection.selected`, a `Signal<ReadonlySet<string>>`) so existing spec accessors and `selectedTasks` keep working. New bulk action id: `'move-to-sprint'`.

- [ ] **Step 1: Update the spec first (failing)**

In `task-backlog.component.spec.ts`, replace the two tests `'selecting a Backlog row replaces the title with a selection toolbar'` and `'clearing the selection restores the plain title'` with:

```ts
    it('selecting a Backlog row shows the floating bulk bar with the count; the Backlog title stays', async () => {
      const tasks = [makeTaskWithHours('t-a', 4), makeTaskWithHours('t-b', 6)];
      const { fixture } = setup({ tasks });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]')).toBeNull();

      (fixture.nativeElement.querySelector('[data-testid="task-select-t-a"]') as HTMLInputElement).click();
      fixture.detectChanges();

      const bar = fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]');
      expect(bar).not.toBeNull();
      expect(bar.textContent).toContain('1 task selected');
      expect(fixture.nativeElement.querySelector('.task-backlog__unsorted-title')?.textContent).toContain('Backlog');
      expect(fixture.nativeElement.querySelector('.task-backlog__selection-toolbar')).toBeNull();
    });

    it('clearing the selection from the bulk bar hides it', async () => {
      const tasks = [makeTaskWithHours('t-a', 4)];
      const { fixture } = setup({ tasks });
      await fixture.whenStable();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('[data-testid="task-select-t-a"]') as HTMLInputElement).click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="bulk-action-clear"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]')).toBeNull();
    });

    it('"Move to sprint" in the bulk bar opens the move dialog', async () => {
      const tasks = [makeTaskWithHours('t-a', 4)];
      const { fixture } = setup({ tasks });
      await fixture.whenStable();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('[data-testid="task-select-t-a"]') as HTMLInputElement).click();
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('[data-testid="bulk-action-move-to-sprint"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      const inst = fixture.componentInstance as unknown as { moveDialogOpen: () => boolean };
      expect(inst.moveDialogOpen()).toBe(true);
    });

    it('changing a filter clears the selection', async () => {
      const tasks = [makeTaskWithHours('t-a', 4)];
      const { fixture } = setup({ tasks });
      await fixture.whenStable();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('[data-testid="task-select-t-a"]') as HTMLInputElement).click();
      fixture.detectChanges();

      const inst = fixture.componentInstance as unknown as {
        selectedTaskIds: () => ReadonlySet<string>;
        onFilterFieldChanged: (event: { key: string; values: string[] }) => void;
      };
      expect(inst.selectedTaskIds().size).toBe(1);
      inst.onFilterFieldChanged({ key: 'priority', values: ['high'] });
      expect(inst.selectedTaskIds().size).toBe(0);
    });
```

Leave every other test in the block unchanged.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx ng test --watch=false --include=src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts`
Expected: the 4 new tests FAIL (no `bulk-action-bar` element; filter doesn't clear); all others PASS.

- [ ] **Step 3: Implement the migration**

In `task-backlog.component.ts`:

1. Add imports:
   ```ts
   import { SelectionModel } from '../../../../shared/utils/selection-model';
   import { BulkAction, BulkActionBarComponent } from '../../../../shared/ui/bulk-action-bar/bulk-action-bar.component';
   ```
   and add `BulkActionBarComponent` to the `imports: [...]` array.

2. Template: replace the whole `@if (selectedTaskIds().size > 0) { …toolbar… } @else { …unsorted-header… }` block with just the header:
   ```html
          <div class="task-backlog__unsorted-header">
            <svg class="task-backlog__unsorted-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            <h3 class="task-backlog__unsorted-title">Backlog</h3>
            <span class="task-backlog__unsorted-summary">{{ unsortedTasks().length }} task{{ unsortedTasks().length === 1 ? '' : 's' }} · {{ unsortedTotalHours() }}h</span>
          </div>
   ```

3. Template: immediately before the `@if (moveUndoBanner(); as banner) {` block, add:
   ```html
    <app-bulk-action-bar
      noun="task"
      [count]="selection.count()"
      [actions]="bulkActions"
      (action)="onBulkAction($event)"
      (cleared)="clearSelection()"
    />
   ```

4. Styles: delete the five `.task-backlog__selection-toolbar`, `.task-backlog__selection-toolbar ::ng-deep app-button > button`, `.task-backlog__selection-count`, `.task-backlog__selection-clear`, `.task-backlog__selection-clear:hover` rules. Note the first one shares a physical line with `.task-backlog__unsorted-summary { … }` — keep the `.task-backlog__unsorted-summary` rule intact.

5. Class: replace
   ```ts
   protected readonly selectedTaskIds = signal<ReadonlySet<string>>(new Set());
   ```
   with
   ```ts
   protected readonly selection = new SelectionModel<string>();
   protected readonly selectedTaskIds = this.selection.selected;
   protected readonly bulkActions: BulkAction[] = [
     { id: 'move-to-sprint', label: 'Move to sprint', placement: 'primary' }
   ];
   ```

6. Class: replace `onTaskSelectionChanged`, `onSelectAllChanged`, `clearSelection` bodies and add `onBulkAction`:
   ```ts
   protected onTaskSelectionChanged(event: { taskId: string; selected: boolean }): void {
     this.selection.toggle(event.taskId, event.selected);
   }

   protected onSelectAllChanged(event: { taskIds: string[]; selected: boolean }): void {
     this.selection.setMany(event.taskIds, event.selected);
   }

   protected clearSelection(): void {
     this.selection.clear();
   }

   protected onBulkAction(actionId: string): void {
     if (actionId === 'move-to-sprint') this.moveDialogOpen.set(true);
   }
   ```

7. Class: clear the selection on any filter change — first line of `setAssigneeFilter` and of `onFilterFieldChanged`:
   ```ts
   protected setAssigneeFilter(ids: string[]): void { this.clearSelection(); this.assigneeFilter.set(ids); }
   ```
   ```ts
   protected onFilterFieldChanged(event: { key: string; values: string[] }): void {
     this.clearSelection();
     switch (event.key) {
       // …unchanged cases…
     }
   }
   ```

8. If `signal` is no longer used anywhere else in the file, leave the import alone only if other code still uses it (it does — e.g. `moveDialogOpen`); do not remove it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false --include=src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts`
Expected: all tests PASS, including the pre-existing move/undo/blocked tests. Also run `--include=src/app/modules/work/ui/task-table/task-table.component.spec.ts` — PASS (untouched). Paste raw summary lines.

- [ ] **Step 5: Commit**

```bash
git status
git add src/app/modules/work/feature/task-backlog/task-backlog.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts
git commit -m "refactor(work): backlog selection uses SelectionModel and floating bulk bar"
```

---

### Task 5: Full verification + browser check

**Files:** none modified (fix-forward only if something fails, in the file that owns the failure).

- [ ] **Step 1: Full unit test run**

Run: `npx ng test --watch=false`
Expected: all specs pass. Paste the raw final summary (files / tests passed / failed). If any failure is in a file this plan did not touch, check `git log -1 -- <file>` and report it as pre-existing rather than fixing it.

- [ ] **Step 2: Production build**

Run: `npx ng build`
Expected: build succeeds with no new errors or budget failures.

- [ ] **Step 3: Browser check (manual evidence)**

With the dev server running, open a project's Backlog tab as a module owner:
1. Tick 2 Backlog tasks → the floating bar appears bottom-center: "2 tasks selected · Move to sprint · ✕". No inline toolbar above the table; the "Backlog" header stays.
2. Click "Move to sprint" → the existing dialog opens; press Escape to close it → the selection is **still** there.
3. Focus a bar button and press Escape → bar disappears, checkboxes cleared.
4. Change any filter → selection clears.
5. Narrow to 375px width → the bar sits above the mobile bottom nav and wraps rather than overflowing.

Note: per project memory, the sandboxed Browser pane may block scripts on the `*.onexso.com` dev domain; if so use Claude in Chrome or ask the user to perform this check. Take a screenshot of step 1 as proof.

- [ ] **Step 4: Update the spec with the planning refinements**

Edit `docs/superpowers/specs/finished/2026-09-28/2026-09-28-shared-bulk-action-primitives-design.md`: `icon` → `iconPath` (SVG path data); add `direction` input to dropdown-menu; change bar Escape rule to "only when focus is within the bar"; note single-open-menu rule. Commit:

```bash
git status
git add docs/superpowers/specs/finished/2026-09-28/2026-09-28-shared-bulk-action-primitives-design.md
git commit -m "docs: sync bulk-action primitives spec with implementation refinements"
```
