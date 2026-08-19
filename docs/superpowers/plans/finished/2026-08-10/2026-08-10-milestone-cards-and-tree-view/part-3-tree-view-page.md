# Milestone Cards + Tree View — Part 3: Tree View Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New route `/work/:projectId/milestones/:objectiveId` rendering a dedicated `MilestoneDetailComponent` page that shows the clicked milestone's subtree via the now-membership-gated `GetObjectiveSubtree` (backend dependency from `HRMS-Backend-v1`'s plan, same as Parts 1-2).

**Architecture:** Reuses `ProjectDetailStore`'s existing `loadMilestoneSubtree`/`selectedSubtree`/`subtreeLoading`/`subtreeError`/`clearSelectedSubtree` — no new store. New `feature/` component reads route params, same `ActivatedRoute.paramMap` pattern `ProjectDetailComponent` already uses.

**Tech Stack:** Angular 21, Angular Router, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-milestone-cards-and-tree-view-design.md`
**Depends on:** Part 2 (`part-2-card-and-edit-achieve.md`) — Part 2's `onMilestoneViewed` already calls `router.navigate(['/work', projectId, 'milestones', objectiveId])`; this part makes that route actually resolve to something.

## Global Constraints

- Same four-state pattern (loading/error/empty/data) as the rest of the module (`docs/core/ARCHITECTURE.md` §7.4) — "empty" here means the subtree loaded but has no children, which is a valid data state, not an error; don't conflate the two.
- `MilestoneTreeNodeComponent` (existing, `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`) is reused unmodified — this plan only adds the page around it.

---

### Task 1: `MilestoneDetailComponent`

**Files:**
- Create: `src/app/modules/work/feature/milestone-detail/milestone-detail.component.ts`
- Create: `src/app/modules/work/feature/milestone-detail/milestone-detail.component.html`
- Test: `src/app/modules/work/feature/milestone-detail/milestone-detail.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectDetailStore.loadMilestoneSubtree(objectiveId: string)`, `selectedSubtree()`, `subtreeLoading()`, `subtreeError()`, `clearSelectedSubtree()` (all already exist, unchanged).
- Produces: `MilestoneDetailComponent`, registered as the `:objectiveId` route in Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/app/modules/work/feature/milestone-detail/milestone-detail.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { MilestoneDetailComponent } from './milestone-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';

describe('MilestoneDetailComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailComponent>;
  let storeStub: any;

  beforeEach(async () => {
    storeStub = {
      selectedSubtree: () => null,
      subtreeLoading: () => false,
      subtreeError: () => null,
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      clearSelectedSubtree: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [MilestoneDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: (key: string) => (key === 'projectId' ? 'p1' : key === 'objectiveId' ? 'o1' : null) }) }
        },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MilestoneDetailComponent);
  });

  it('loads the subtree for the routed objectiveId', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('shows the loading state', () => {
    storeStub.subtreeLoading = () => true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state with retry wired to reload the subtree', async () => {
    storeStub.subtreeError = () => 'Failed to load milestone.';
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load milestone.');
    fixture.componentInstance.retry();
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('renders the tree when a subtree is loaded', async () => {
    storeStub.selectedSubtree = () => ({
      id: 'o1', title: 'Design Phase', startDate: '2026-01-01', endDate: '2026-03-01',
      progress: 0, allocatedHours: 20, completedHours: 5, isActive: true, children: []
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Design Phase');
  });

  it('clears the selected subtree on destroy', () => {
    fixture.detectChanges();
    fixture.destroy();
    expect(storeStub.clearSelectedSubtree).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/milestone-detail/milestone-detail.component.spec.ts --watch=false`
Expected: FAIL — cannot find module `./milestone-detail.component`.

- [ ] **Step 3: Create the component**

Create `src/app/modules/work/feature/milestone-detail/milestone-detail.component.ts`:

```typescript
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

@Component({
  selector: 'app-milestone-detail',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, ButtonComponent],
  templateUrl: './milestone-detail.component.html'
})
export class MilestoneDetailComponent implements OnInit, OnDestroy {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';
  private objectiveId = '';

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('projectId')!;
    this.objectiveId = paramMap.get('objectiveId')!;
    this.store.loadMilestoneSubtree(this.objectiveId);
  }

  ngOnDestroy(): void {
    this.store.clearSelectedSubtree();
  }

  retry(): void {
    this.store.loadMilestoneSubtree(this.objectiveId);
  }

  backToProject(): void {
    this.router.navigate(['/work', this.projectId]);
  }
}
```

Create `src/app/modules/work/feature/milestone-detail/milestone-detail.component.html`:

```html
<div class="mb-4">
  <app-button variant="secondary" (pressed)="backToProject()">← Back to project</app-button>
</div>

@if (store.subtreeLoading()) {
  <app-loader label="Loading milestone…" />
} @else if (store.subtreeError()) {
  <app-error-state [message]="store.subtreeError()!" [retryable]="true" (retry)="retry()" />
} @else if (store.selectedSubtree(); as subtree) {
  <h1 class="mb-4 text-lg font-semibold text-[var(--color-text-primary)]">{{ subtree.title }}</h1>
  <app-milestone-tree-node [node]="subtree" />
} @else {
  <app-empty-state title="Milestone not found" />
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/milestone-detail/milestone-detail.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/milestone-detail/milestone-detail.component.ts src/app/modules/work/feature/milestone-detail/milestone-detail.component.html src/app/modules/work/feature/milestone-detail/milestone-detail.component.spec.ts
git commit -m "feat(work): add MilestoneDetailComponent"
```

---

### Task 2: Register the route

**Files:**
- Modify: `src/app/modules/work/work.routes.ts`

**Interfaces:**
- Consumes: `MilestoneDetailComponent` from Task 1.

- [ ] **Step 1: Add the route**

Replace `work.routes.ts` with:

```typescript
import { Routes } from '@angular/router';

export const WORK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/project-list/project-list.component').then((m) => m.ProjectListComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./feature/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent)
  },
  {
    path: ':projectId/milestones/:objectiveId',
    loadComponent: () =>
      import('./feature/milestone-detail/milestone-detail.component').then((m) => m.MilestoneDetailComponent)
  }
];
```

Route order matters here: `:projectId/milestones/:objectiveId` must come after `:id` in this array for `/work/p1` (project detail) to still match `:id` first — but since `/work/p1/milestones/o1` has two path segments after `/work` and `:id` only matches one, Angular's router won't confuse them regardless of order (they have different segment counts). Keep the new route last for readability, matching the existing most-specific-last convention in this file.

- [ ] **Step 2: Manually verify the route resolves**

Run `npm start`, sign in, navigate to a Project Detail page, click a milestone card's View button, and confirm the URL becomes `/work/<projectId>/milestones/<objectiveId>` and the tree page renders. This step has no automated test — routing config is covered by the unit tests in Task 1 (which stub `ActivatedRoute` directly) and this is the only end-to-end confirmation that the real router wiring matches. Note in the task's completion notes whether this manual check was possible (may require a running backend + seeded tenant data) or whether it had to be skipped, per this project's standing rule to say so explicitly rather than claim success without it.

- [ ] **Step 3: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/work/work.routes.ts
git commit -m "feat(work): register the milestone detail route"
```

---

### Task 3: Update `ARCHITECTURE.md`, move plan+spec to finished, sync SUMMARY.md files

**Files:**
- Modify: `docs/core/ARCHITECTURE.md`
- Modify: `docs/superpowers/plans/next/SUMMARY.md` (if a top-level `plans/SUMMARY.md` exists per this repo's convention, update it too — check first)
- Modify: `docs/superpowers/specs/next/SUMMARY.md`, `docs/superpowers/specs/SUMMARY.md`
- Move: this plan's three part files and the design doc into their `finished/2026-08-10/` subfolders

Per `PROCESS_RULES.md` rule 6 (added 2026-08-10 in this same feature's brainstorm session): code and docs change together.

- [ ] **Step 1: Update the `work/` entry in `ARCHITECTURE.md`'s folder tree**

The `work/` entry added to `docs/core/ARCHITECTURE.md` §2 on 2026-08-10 needs three new files added under `ui/` (`milestone-card/`, `milestone-form-modal/`), a new `feature/milestone-detail/` entry, and `models/dto/` gains `EditObjectiveRequestDto`. Update the tree entry to match the actual final file list — read the current tree section first (search for `work/` in the file) and add the missing entries following the same format already used there.

- [ ] **Step 2: Move plan and spec files, update SUMMARY.md files**

```bash
mkdir -p docs/superpowers/plans/finished/2026-08-10 docs/superpowers/specs/finished/2026-08-10
git mv docs/superpowers/plans/next/2026-08-10-milestone-cards-and-tree-view docs/superpowers/plans/finished/2026-08-10/
git mv docs/superpowers/specs/next/2026-08-10-milestone-cards-and-tree-view-design.md docs/superpowers/specs/finished/2026-08-10/
```

Update `docs/superpowers/plans/next/SUMMARY.md`, `docs/superpowers/specs/next/SUMMARY.md`, and `docs/superpowers/specs/SUMMARY.md` to remove the `next/` entries for this feature and add `finished/2026-08-10/` ones instead, following the exact format of the most recent `2026-08-09` entries already in each file.

- [ ] **Step 3: Commit**

```bash
git add docs/core/ARCHITECTURE.md docs/superpowers/plans/next/SUMMARY.md docs/superpowers/specs/next/SUMMARY.md docs/superpowers/specs/SUMMARY.md docs/superpowers/plans/finished/2026-08-10 docs/superpowers/specs/finished/2026-08-10
git commit -m "docs: move milestone cards + tree view plan+spec to finished/2026-08-10, sync ARCHITECTURE.md"
```
