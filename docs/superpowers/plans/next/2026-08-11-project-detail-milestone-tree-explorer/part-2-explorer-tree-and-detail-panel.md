# Project Detail Milestone Tree Explorer — Part 2: Explorer Tree + Detail Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the milestone tree into an explorer/folder style (expand/collapse, connector lines, click-to-select) and add a side-by-side detail panel that fetches full detail for whichever node is selected — the two pieces `MilestoneTreeTabComponent` combines.

**Architecture:** `MilestoneTreeNodeComponent` (existing) is reworked in place to add expand/collapse + selection; `MilestoneDetailPanelComponent` is new and purely presentational; `ProjectDetailStore` gains `nodeDetail`/`nodeDetailLoading`/`nodeDetailError` state (kept separate from the settings-modal's existing `milestoneActionError`/`getMilestoneDetail`) via a new `loadNodeDetail`/`clearNodeDetail` pair that reuses the existing `getObjectiveById` endpoint — no new API. `MilestoneTreeTabComponent` reads `milestoneId` from its own route reactively (not a one-shot read), so switching milestones without a full route-config change (same `tree` leaf route, different `:milestoneId`) still reloads data — Angular's default route reuse strategy keeps the component instance alive across a params-only change.

**Tech Stack:** Angular 21 standalone components (signals, `input()`/`output()`), `@ngrx/signals` (`ProjectDetailStore`), `@angular/core/rxjs-interop` (`takeUntilDestroyed`), Vitest + Angular TestBed.

**Design doc:** `docs/superpowers/specs/next/2026-08-11-project-detail-milestone-tree-explorer-design.md`
**Depends on:** Nothing at the component level — all three tasks are testable in isolation with stubbed inputs/store. Part 3 wires `MilestoneTreeTabComponent` into `work.routes.ts` as the `tree` route target and enables `paramsInheritanceStrategy: 'always'` in `app.config.ts` so route param inheritance (used implicitly by this part's route stub shape) matches production routing.

## Global Constraints

- Tree connector/expand styling must use `var(--color-border)` at full opacity — **not** a faint custom `rgba(...)`, per explicit user feedback on the approved mockup ("connecting lines ellam clear ah irukkanum").
- Root node renders **expanded by default**; every deeper level renders **collapsed by default** — per the approved mockup choice.
- Clicking a node's chevron toggles expand/collapse only — it must never also emit `selected`. Clicking the row (outside the chevron) selects the node — it must never also toggle expand/collapse.
- The tree API (`getMilestoneSubtree`) already returns the full nested subtree in one call — expand/collapse is client-side UI state only. No new network call per node, no lazy per-node fetching.
- Detail panel omits Owner/Reporting Manager fields — not available from `getObjectiveById` for arbitrary tree nodes (IDs only, no resolved names). This is an intentional, confirmed scope cut, not a bug.
- Four-state pattern (loading/error/empty/data) on both the tree and the detail panel, per `docs/core/ARCHITECTURE.md` §7.4.
- Icons are inline SVG per `docs/design/ICON_THEME_SYSTEM.md`: `viewBox="0 0 24 24"`, `stroke="currentColor"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
- No `any` types (test file stub objects excepted, matching this module's existing test convention).

---

### Task 1: `ProjectDetailStore` — add node detail state

**Files:**
- Modify: `src/app/modules/work/state/project-detail.store.ts`
- Modify: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectApiService.getObjectiveById(id: string): Observable<ObjectiveDetailDto>` (existing, unchanged).
- Produces: `store.nodeDetail(): ObjectiveDetail | null`, `store.nodeDetailLoading(): boolean`, `store.nodeDetailError(): string | null`, `store.loadNodeDetail(id: string): Promise<void>`, `store.clearNodeDetail(): void`. Consumed by `MilestoneDetailPanelComponent` (Task 3) and `MilestoneTreeTabComponent` (Task 4) in this part.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/modules/work/state/project-detail.store.spec.ts` (append inside the existing `describe('ProjectDetailStore', ...)` block, after the last existing `it(...)`):

```typescript
  it('loadNodeDetail loads the mapped detail on success', async () => {
    const dto: ObjectiveDetailDto = {
      id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
      description: 'Child scope', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
      startDate: '2026-01-01', endDate: '2026-02-01', progress: 10, actualHours: null,
      allocatedHours: 10, completedHours: 1, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
      isAchieved: false
    };
    const store = setup({ getObjectiveById: () => of(dto) } as Partial<ProjectApiService>);

    await store.loadNodeDetail('o2');

    expect(store.nodeDetail()?.title).toBe('Child');
    expect(store.nodeDetailLoading()).toBe(false);
    expect(store.nodeDetailError()).toBeNull();
  });

  it('loadNodeDetail sets nodeDetailError and clears nodeDetail on failure', async () => {
    const store = setup({
      getObjectiveById: () => throwError(() => ({ error: { detail: 'gone' } }))
    } as Partial<ProjectApiService>);

    await store.loadNodeDetail('o2');

    expect(store.nodeDetailError()).toBe('gone');
    expect(store.nodeDetail()).toBeNull();
  });

  it('clearNodeDetail resets node detail state', async () => {
    const dto = { id: 'o2' } as ObjectiveDetailDto;
    const store = setup({ getObjectiveById: () => of(dto) } as Partial<ProjectApiService>);
    await store.loadNodeDetail('o2');

    store.clearNodeDetail();

    expect(store.nodeDetail()).toBeNull();
    expect(store.nodeDetailError()).toBeNull();
  });

  it('loadNodeDetail does not affect the settings-modal-only milestoneActionError state', async () => {
    const store = setup({ getObjectiveById: () => of({ id: 'o2' } as ObjectiveDetailDto) } as Partial<ProjectApiService>);

    await store.loadNodeDetail('o2');

    expect(store.milestoneActionError()).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/modules/work/state/project-detail.store.spec.ts`
Expected: FAIL — `store.loadNodeDetail is not a function`

- [ ] **Step 3: Implement the state additions**

In `src/app/modules/work/state/project-detail.store.ts`, update the state interface, initial state, and add the two methods:

```typescript
interface ProjectDetailState {
  readonly project: ProjectDetail | null;
  readonly projectLoading: boolean;
  readonly projectError: string | null;
  readonly milestones: readonly Milestone[];
  readonly milestonesLoading: boolean;
  readonly milestonesError: string | null;
  readonly selectedSubtree: MilestoneTreeNode | null;
  readonly subtreeLoading: boolean;
  readonly subtreeError: string | null;
  readonly milestoneActionError: string | null;
  readonly nodeDetail: ObjectiveDetail | null;
  readonly nodeDetailLoading: boolean;
  readonly nodeDetailError: string | null;
}

const initialState: ProjectDetailState = {
  project: null, projectLoading: false, projectError: null,
  milestones: [], milestonesLoading: false, milestonesError: null,
  selectedSubtree: null, subtreeLoading: false, subtreeError: null,
  milestoneActionError: null,
  nodeDetail: null, nodeDetailLoading: false, nodeDetailError: null
};
```

Then add these two methods inside the `withMethods((store, api = inject(ProjectApiService)) => ({ ... }))` object, after `unachieveMilestone`:

```typescript
    async loadNodeDetail(id: string): Promise<void> {
      patchState(store, { nodeDetailLoading: true, nodeDetailError: null });
      try {
        const dto = await firstValueFrom(api.getObjectiveById(id));
        patchState(store, { nodeDetail: dto, nodeDetailLoading: false });
      } catch (err) {
        patchState(store, { nodeDetailError: extractError(err, 'Failed to load milestone detail.'), nodeDetailLoading: false, nodeDetail: null });
      }
    },

    clearNodeDetail(): void {
      patchState(store, { nodeDetail: null, nodeDetailError: null });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/modules/work/state/project-detail.store.spec.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat(work): add nodeDetail state to ProjectDetailStore for the tree detail panel"
```

---

### Task 2: Rework `MilestoneTreeNodeComponent` — explorer style

**Files:**
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts` (full rewrite)
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts` (full rewrite — old assertions on date/hours text no longer apply, the row now shows title + progress only)

**Interfaces:**
- Consumes: `MilestoneTreeNode` (existing model, unchanged: `id`, `title`, `startDate`, `endDate`, `progress`, `allocatedHours`, `completedHours`, `isActive`, `children`).
- Produces: `MilestoneTreeNodeComponent` with `node = input.required<MilestoneTreeNode>()`, `selectedId = input<string | null>(null)`, `expandedByDefault = input(true)`, `selected = output<MilestoneTreeNode>()`. Consumed by `MilestoneTreeTabComponent` (Task 4, this part) as the root of the tree, passing `[expandedByDefault]="true"`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeNodeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeNodeComponent>;

  const leaf: MilestoneTreeNode = {
    id: 'o2', title: 'Child', startDate: '2026-01-20', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, children: []
  };

  const root: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
    allocatedHours: 20, completedHours: 0, isActive: true, children: [leaf]
  };

  function setup(node: MilestoneTreeNode, selectedId: string | null = null, expandedByDefault = true): void {
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.componentRef.setInput('expandedByDefault', expandedByDefault);
    fixture.detectChanges();
  }

  it('renders the node title and progress, without dates or hours', () => {
    setup(leaf);
    expect(fixture.nativeElement.textContent).toContain('Child');
    expect(fixture.nativeElement.textContent).toContain('40%');
    expect(fixture.nativeElement.textContent).not.toContain('2026-01-20');
  });

  it('shows children when expandedByDefault is true (root default)', () => {
    setup(root, null, true);
    expect(fixture.nativeElement.textContent).toContain('Child');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]').length).toBe(2);
  });

  it('hides children when expandedByDefault is false (deeper-level default)', () => {
    setup(root, null, false);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    expect(rows.length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('Child');
  });

  it('does not render a chevron for a leaf node', () => {
    setup(leaf);
    expect(fixture.nativeElement.querySelector('[data-testid="chevron"]')).toBeNull();
  });

  it('chevron click toggles expansion without emitting selected', () => {
    setup(root, null, true);
    let selectedCount = 0;
    fixture.componentInstance.selected.subscribe(() => selectedCount++);

    (fixture.nativeElement.querySelector('[data-testid="chevron"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]').length).toBe(1);
    expect(selectedCount).toBe(0);
  });

  it('row click emits selected with the clicked node, without toggling expansion', () => {
    setup(root, null, true);
    const emitted: MilestoneTreeNode[] = [];
    fixture.componentInstance.selected.subscribe((n) => emitted.push(n));

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();

    expect(emitted).toEqual([leaf]);
  });

  it('applies a highlight to the row matching selectedId', () => {
    setup(root, 'o1', true);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    expect((rows[0] as HTMLElement).className).toContain('ring-2');
    expect((rows[1] as HTMLElement).className).not.toContain('ring-2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`
Expected: FAIL — old component has no `selectedId`/`expandedByDefault` inputs, no `selected` output, no `[data-testid="tree-row"]`/`[data-testid="chevron"]` elements.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`:

```typescript
import { Component, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    <div>
      <div
        class="flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-[var(--color-surface-secondary)]"
        [class.ring-2]="node().id === selectedId()"
        [class.ring-[var(--color-focus-ring)]]="node().id === selectedId()"
        data-testid="tree-row"
        (click)="selected.emit(node())"
      >
        @if (node().children.length > 0) {
          <button
            type="button"
            class="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-text-secondary)] transition-transform"
            [style.transform]="expanded() ? 'rotate(90deg)' : 'rotate(0deg)'"
            data-testid="chevron"
            [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            (click)="toggleExpanded($event)"
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        } @else {
          <span class="h-4 w-4 shrink-0"></span>
        }
        <span class="flex-1 truncate text-sm text-[var(--color-text-primary)]">{{ node().title }}</span>
        <span class="text-xs text-[var(--color-text-secondary)]">{{ node().progress }}%</span>
      </div>

      @if (node().children.length > 0 && expanded()) {
        <div class="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-3">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node
              [node]="child"
              [selectedId]="selectedId()"
              [expandedByDefault]="false"
              (selected)="selected.emit($event)"
            />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent {
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  expandedByDefault = input(true);
  selected = output<MilestoneTreeNode>();

  expanded = signal(true);

  constructor() {
    this.expanded.set(this.expandedByDefault());
  }

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.set(!this.expanded());
  }
}
```

Note: reading `this.expandedByDefault()` in the constructor works here because Angular sets signal-input bound values before the constructor body runs for values provided via `fixture.componentRef.setInput(...)` in tests and via template bindings in the real app — this differs from the old `@Input()` decorator API, which required waiting for `ngOnInit`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts
git commit -m "feat(work): rework MilestoneTreeNodeComponent into explorer style with expand/collapse and selection"
```

---

### Task 3: `MilestoneDetailPanelComponent`

**Files:**
- Create: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`
- Test: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveDetail` (existing model alias for `ObjectiveDetailDto` — `id`, `title`, `description`, `startDate`, `endDate`, `progress`, `allocatedHours`, `completedHours`, `isAchieved?`), `CardComponent`/`LoaderComponent`/`ErrorStateComponent`/`EmptyStateComponent` (all existing shared components, unchanged signatures — `ErrorStateComponent` has `message = input.required<string>()`, `retryable = input(false)`, `retry = output<void>()`; `LoaderComponent` has `label = input<string>('')`).
- Produces: `MilestoneDetailPanelComponent` with `detail = input<ObjectiveDetail | null>(null)`, `loading = input(false)`, `error = input<string | null>(null)`, `retry = output<void>()`. Consumed by `MilestoneTreeTabComponent` (Task 4, this part).

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneDetailPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailPanelComponent>;

  const detail: ObjectiveDetail = {
    id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
    description: 'Child scope', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
    startDate: '2026-01-20', endDate: '2026-02-01', progress: 40, actualHours: null,
    allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: true,
    createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  function setup(overrides: Partial<{ detail: ObjectiveDetail | null; loading: boolean; error: string | null }> = {}): void {
    fixture = TestBed.createComponent(MilestoneDetailPanelComponent);
    fixture.componentRef.setInput('detail', overrides.detail ?? null);
    fixture.componentRef.setInput('loading', overrides.loading ?? false);
    fixture.componentRef.setInput('error', overrides.error ?? null);
    fixture.detectChanges();
  }

  it('shows the loading state', () => {
    setup({ loading: true });
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state and emits retry on click', () => {
    setup({ error: 'Failed to load' });
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));

    (fixture.nativeElement.querySelector('app-error-state button') as HTMLButtonElement).click();

    expect(retried).toBe(true);
  });

  it('shows a select-a-milestone prompt when nothing is selected', () => {
    setup();
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('renders full detail: title, description, dates, progress, hours, Achieved badge', () => {
    setup({ detail });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Child');
    expect(text).toContain('Child scope');
    expect(text).toContain('2026-01-20');
    expect(text).toContain('2026-02-01');
    expect(text).toContain('40%');
    expect(text).toContain('2 / 5');
    expect(text).toContain('Achieved');
  });

  it('omits the Achieved badge when the milestone is not achieved', () => {
    setup({ detail: { ...detail, isAchieved: false } });
    expect(fixture.nativeElement.textContent).not.toContain('Achieved');
  });

  it('does not render Owner or Reporting Manager fields (not available from the API)', () => {
    setup({ detail });
    expect(fixture.nativeElement.textContent).not.toContain('Owner');
    expect(fixture.nativeElement.textContent).not.toContain('Reporting Manager');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`
Expected: FAIL — `Cannot find module './milestone-detail-panel.component'`

- [ ] **Step 3: Write the implementation**

Create `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ObjectiveDetail } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  imports: [CardComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-loader label="Loading milestone…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="retry.emit()" />
    } @else if (detail(); as d) {
      <app-card [title]="d.title">
        <div class="flex flex-col gap-3 text-sm">
          @if (d.description) {
            <p class="text-[var(--color-text-secondary)]">{{ d.description }}</p>
          }
          <dl class="grid grid-cols-2 gap-3">
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
              <dd>{{ d.startDate }}</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">End</dt>
              <dd>{{ d.endDate }}</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Progress</dt>
              <dd>{{ d.progress }}%</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
              <dd>{{ d.completedHours }} / {{ d.allocatedHours }}</dd>
            </div>
          </dl>
          @if (d.isAchieved) {
            <span class="w-fit rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
        </div>
      </app-card>
    } @else {
      <app-empty-state title="Select a milestone" description="Click any node in the tree to see its detail here." />
    }
  `
})
export class MilestoneDetailPanelComponent {
  detail = input<ObjectiveDetail | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  retry = output<void>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts
git commit -m "feat(work): add MilestoneDetailPanelComponent for the tree's selected-node detail"
```

---

### Task 4: `MilestoneTreeTabComponent`

**Files:**
- Create: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`
- Create: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html`
- Test: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectDetailStore.loadMilestoneSubtree(id)`, `.selectedSubtree()`, `.subtreeLoading()`, `.subtreeError()`, `.loadNodeDetail(id)`, `.nodeDetail()`, `.nodeDetailLoading()`, `.nodeDetailError()`, `.clearNodeDetail()` (all now exist per Task 1); `MilestoneTreeNodeComponent` (Task 2, `node`/`selectedId`/`expandedByDefault` inputs, `selected` output); `MilestoneDetailPanelComponent` (Task 3, `detail`/`loading`/`error` inputs, `retry` output); `ActivatedRoute.paramMap` with a `milestoneId` param (provided by the inherited parent route param — Part 3 enables `paramsInheritanceStrategy: 'always'` so this works when actually routed).
- Produces: `MilestoneTreeTabComponent`, registered by Part 3 as the lazy-loaded target for the `tree` route.

- [ ] **Step 1: Write the failing tests**

Create `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneTreeTabComponent } from './milestone-tree-tab.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeTabComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeTabComponent>;
  let storeStub: any;
  let paramMap$: any;

  const treeNode: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-01', endDate: '2026-03-01', progress: 0,
    allocatedHours: 20, completedHours: 0, isActive: true, children: []
  };

  function setup(milestoneId: string): void {
    storeStub = {
      selectedSubtree: () => null,
      subtreeLoading: () => false,
      subtreeError: () => null,
      nodeDetail: () => null,
      nodeDetailLoading: () => false,
      nodeDetailError: () => null,
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      loadNodeDetail: vi.fn().mockResolvedValue(undefined),
      clearNodeDetail: vi.fn()
    };
    paramMap$ = of({ get: (key: string) => (key === 'milestoneId' ? milestoneId : null) });

    TestBed.configureTestingModule({
      imports: [MilestoneTreeTabComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } }
      ]
    });
    fixture = TestBed.createComponent(MilestoneTreeTabComponent);
  }

  it('loads the subtree for the routed milestoneId and clears stale node detail', () => {
    setup('o1');
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
    expect(storeStub.clearNodeDetail).toHaveBeenCalled();
  });

  it('renders the tree once selectedSubtree resolves', async () => {
    setup('o1');
    storeStub.selectedSubtree = () => treeNode;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
  });

  it('renders the detail panel showing the select-a-milestone prompt before any node is clicked', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-detail-panel')).not.toBeNull();
  });

  it('loads node detail and tracks selection when a tree node is selected', () => {
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.onNodeSelected(treeNode);

    expect(storeStub.loadNodeDetail).toHaveBeenCalledWith('o1');
    expect(fixture.componentInstance.selectedNodeId()).toBe('o1');
  });

  it('retryTree re-loads the subtree for the current milestone', () => {
    setup('o1');
    storeStub.loadMilestoneSubtree.mockClear();

    fixture.componentInstance.retryTree();

    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('retryDetail re-loads the detail for the currently selected node', () => {
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onNodeSelected(treeNode);
    storeStub.loadNodeDetail.mockClear();

    fixture.componentInstance.retryDetail();

    expect(storeStub.loadNodeDetail).toHaveBeenCalledWith('o1');
  });

  it('does nothing when retryDetail is called before any node is selected', () => {
    setup('o1');

    fixture.componentInstance.retryDetail();

    expect(storeStub.loadNodeDetail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`
Expected: FAIL — `Cannot find module './milestone-tree-tab.component'`

- [ ] **Step 3: Write the implementation**

Create `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html`:

```html
<div class="flex gap-4">
  <div class="flex-[0_0_62%] rounded-lg border border-[var(--color-border)] p-3">
    @if (store.subtreeLoading()) {
      <app-loader label="Loading tree…" />
    } @else if (store.subtreeError()) {
      <app-error-state [message]="store.subtreeError()!" [retryable]="true" (retry)="retryTree()" />
    } @else if (store.selectedSubtree(); as subtree) {
      <app-milestone-tree-node
        [node]="subtree"
        [selectedId]="selectedNodeId()"
        [expandedByDefault]="true"
        (selected)="onNodeSelected($event)"
      />
    }
  </div>
  <div class="flex-1">
    <app-milestone-detail-panel
      [detail]="store.nodeDetail()"
      [loading]="store.nodeDetailLoading()"
      [error]="store.nodeDetailError()"
      (retry)="retryDetail()"
    />
  </div>
</div>
```

Create `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`:

```typescript
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { MilestoneDetailPanelComponent } from '../../ui/milestone-detail-panel/milestone-detail-panel.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-tab',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, MilestoneDetailPanelComponent, LoaderComponent, ErrorStateComponent],
  templateUrl: './milestone-tree-tab.component.html'
})
export class MilestoneTreeTabComponent {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);

  selectedNodeId = signal<string | null>(null);
  private currentMilestoneId = '';

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((paramMap) => {
      const milestoneId = paramMap.get('milestoneId');
      if (!milestoneId) return;
      this.currentMilestoneId = milestoneId;
      this.selectedNodeId.set(null);
      this.store.clearNodeDetail();
      this.store.loadMilestoneSubtree(milestoneId);
    });
  }

  onNodeSelected(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
    this.store.loadNodeDetail(node.id);
  }

  retryTree(): void {
    if (this.currentMilestoneId) this.store.loadMilestoneSubtree(this.currentMilestoneId);
  }

  retryDetail(): void {
    const id = this.selectedNodeId();
    if (id) this.store.loadNodeDetail(id);
  }
}
```

Note: the subscription is set up in the **constructor**, not `ngOnInit` — this is required because `takeUntilDestroyed()` (no explicit `DestroyRef` argument) must run in an injection context, and the constructor is one. It also fixes a real behavior gap: since milestone switching now happens via routing to the same `tree` leaf route with a different `:milestoneId` (not a full route-config change), Angular's default reuse strategy keeps this component instance alive across that navigation — a one-shot `ngOnInit` + `firstValueFrom(paramMap)` (the pattern `ProjectDetailComponent` uses for its own, route-config-changing `:id` param) would only fire once and silently stop reloading data on the second and subsequent milestone selections. Subscribing to the full `paramMap` observable re-fires on every param change, regardless of reuse.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/milestone-tree-tab/
git commit -m "feat(work): add MilestoneTreeTabComponent combining the explorer tree and detail panel"
```
