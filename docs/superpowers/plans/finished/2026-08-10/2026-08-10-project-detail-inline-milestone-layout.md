# Project Detail — Compact Cards, Horizontal Scroll, Inline Milestone Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Project Detail's layout — compact project header card, horizontal-scrolling shorter milestone cards (no View button, whole card clickable), and an inline detail panel below the row that loads the selected milestone's tree without navigating away. Remove the now-unused standalone milestone-detail route.

**Architecture:** Reuses `ProjectDetailStore`'s pre-existing `loadMilestoneSubtree`/`selectedSubtree`/`subtreeLoading`/`subtreeError`/`clearSelectedSubtree` — these were built for this exact inline pattern in the module's original design and have sat unused since a later plan this same session moved to a routed page instead. No new store methods needed.

**Tech Stack:** Angular 21, NgRx Signal Store, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-project-detail-inline-milestone-layout-design.md`

## Global Constraints

- `MilestoneSettingsModalComponent`, the Achieve/Edit flow, and `ProjectCardComponent`/`ProjectListComponent` are untouched — this plan only changes `MilestoneCardComponent`'s click/selection behavior and `ProjectDetailComponent`'s layout.
- The Settings gear button's click handler must call `event.stopPropagation()` — without it, clicking Settings would also fire the card's new click-to-select behavior.

---

### Task 1: `MilestoneCardComponent` — no View button, whole card clickable, shorter

**Files:**
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`

**Interfaces:**
- Removes: the "View" button UI (the `viewed` output itself stays — same name, now emitted by the whole card's click instead of a button press).
- Produces: `MilestoneCardComponent.selected = input(false)` — consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Replace `milestone-card.component.spec.ts` with:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneCardComponent } from './milestone-card.component';
import { Milestone } from '../../models/milestone.model';

describe('MilestoneCardComponent', () => {
  let fixture: ComponentFixture<MilestoneCardComponent>;

  const baseMilestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 20, completedHours: 5,
    objectiveIsActive: true, isAchieved: false, achievedAt: null,
    membershipIsActive: true, membershipRemovedAt: null, isOwner: false
  };

  function setup(milestone: Milestone, selected = false): void {
    TestBed.configureTestingModule({ imports: [MilestoneCardComponent] });
    fixture = TestBed.createComponent(MilestoneCardComponent);
    fixture.componentRef.setInput('milestone', milestone);
    fixture.componentRef.setInput('selected', selected);
    fixture.detectChanges();
  }

  it('has no View button', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).toBeNull();
  });

  it('does not render Start/End date rows', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.textContent).not.toContain('2026-01-01');
  });

  it('emits viewed when the card itself is clicked', () => {
    setup(baseMilestone);
    let viewed = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    (fixture.nativeElement.querySelector('[data-testid="milestone-card"]') as HTMLElement).click();
    expect(viewed).toBe(true);
  });

  it('shows the Settings button when the caller is the owner, and clicking it does not also emit viewed', () => {
    setup({ ...baseMilestone, isOwner: true });
    let viewed = false, settings = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.settingsRequested.subscribe(() => (settings = true));

    (fixture.nativeElement.querySelector('[data-testid="settings-button"] button') as HTMLButtonElement).click();

    expect(settings).toBe(true);
    expect(viewed).toBe(false);
  });

  it('hides the Settings button when the caller is not the owner', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('applies a highlight class when selected', () => {
    setup(baseMilestone, true);
    const card: HTMLElement = fixture.nativeElement.querySelector('[data-testid="milestone-card"]');
    expect(card.className).toContain('ring-2');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: FAIL — `selected` input doesn't exist, `[data-testid="milestone-card"]` not found, View button still present.

- [ ] **Step 3: Update the component**

Replace `milestone-card.component.ts` with:

```typescript
import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-card',
  standalone: true,
  imports: [CardComponent],
  template: `
    <div
      data-testid="milestone-card"
      class="relative cursor-pointer rounded-lg transition-shadow"
      [class.ring-2]="selected()"
      [class.ring-[var(--color-focus-ring)]]="selected()"
      (click)="viewed.emit()"
    >
      @if (milestone().isOwner) {
        <span data-testid="settings-button" class="absolute right-2 top-2 z-10">
          <button
            type="button"
            class="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Milestone settings"
            (click)="onSettingsClick($event)"
          >⚙</button>
        </span>
      }
      <app-card [title]="milestone().title">
        <div class="flex items-center justify-between">
          <p class="text-xs text-[var(--color-text-secondary)]">{{ milestone().ownerName }}</p>
          @if (milestone().isAchieved) {
            <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
        </div>
        <p class="mt-2 text-sm text-[var(--color-text-secondary)]">
          {{ milestone().completedHours }} / {{ milestone().allocatedHours }}h
        </p>
      </app-card>
    </div>
  `
})
export class MilestoneCardComponent {
  milestone = input.required<Milestone>();
  selected = input(false);
  viewed = output<void>();
  settingsRequested = output<void>();

  onSettingsClick(event: Event): void {
    event.stopPropagation();
    this.settingsRequested.emit();
  }
}
```

Note: `ButtonComponent` import is dropped — the card no longer uses `app-button` anywhere (the View button is gone, and the Settings trigger was already a raw `<button>`, not `app-button`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-card/
git commit -m "feat(work): make MilestoneCardComponent's whole body clickable, drop View button and date rows"
```

---

### Task 2: `ProjectDetailComponent` — compact header card, horizontal scroll, inline detail panel

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneCardComponent.selected` (Task 1), `ProjectDetailStore.loadMilestoneSubtree/selectedSubtree/subtreeLoading/subtreeError/clearSelectedSubtree` (pre-existing, untouched).
- Removes: `onMilestoneViewed` (replaced by `onMilestoneSelected`), the `Router` injection for milestone navigation (still needed elsewhere? check — if `router` is only used for `onMilestoneViewed`, remove the injection entirely).

- [ ] **Step 1: Write the failing tests**

In `project-detail.component.spec.ts`, add `loadMilestoneSubtree`, `selectedSubtree`, `subtreeLoading`, `subtreeError`, `clearSelectedSubtree` to `storeStub` if not already present (they should already be there — this component already used them before the routed version replaced inline rendering; verify, don't duplicate). Replace any reference to `onMilestoneViewed` and add:

```typescript
  it('loads the milestone subtree and marks the card selected when a milestone is clicked', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSelected(milestone);
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
    expect(fixture.componentInstance.selectedMilestoneId()).toBe('o1');
  });

  it('renders the tree once selectedSubtree resolves', async () => {
    storeStub.selectedSubtree = () => ({ id: 'o1', title: 'Default', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, children: [] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
  });

  it('shows a prompt when no milestone is selected yet', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('resets stale subtree state on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.clearSelectedSubtree).toHaveBeenCalled();
  });
```

Remove any existing test that called `router.navigate` for a milestone (if one predates this task — check for a leftover `onMilestoneViewed` navigation test from the pre-inline version; none is expected to exist today since the current tests only cover Settings/achieve flows, but verify).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: FAIL — `onMilestoneSelected`/`selectedMilestoneId` don't exist yet.

- [ ] **Step 3: Update the component**

Replace `project-detail.component.ts` with:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Milestone, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneCardComponent, MilestoneSettingsModalComponent, MilestoneTreeNodeComponent, CardComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private projectId = '';

  selectedMilestoneId = signal<string | null>(null);

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  private targetMilestone = signal<Milestone | null>(null);

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.selectedMilestoneId.set(null);
    this.store.clearSelectedSubtree();
    this.store.loadProject(this.projectId);
    this.store.loadMyMilestones(this.projectId);
  }

  onMilestoneSelected(milestone: Milestone): void {
    this.selectedMilestoneId.set(milestone.objectiveId);
    this.store.loadMilestoneSubtree(milestone.objectiveId);
  }

  onMilestoneSettingsRequested(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.milestoneSettingsOpen.set(true);
    this.loadFullMilestoneDetail(milestone.objectiveId);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestone()?.objectiveId === id) {
      this.milestoneSettingsInitialValue.set(detail);
    }
  }

  async onMilestoneSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.milestoneSettingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(milestone.objectiveId);
      if (!unachieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(milestone.objectiveId, event.fields);
    if (!editResult.success) {
      this.milestoneSettingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(milestone.objectiveId);
      if (!achieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    this.milestoneSettingsSubmitting.set(false);
    this.milestoneSettingsOpen.set(false);
    await this.store.loadMyMilestones(this.projectId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }

  retrySubtree(): void {
    const id = this.selectedMilestoneId();
    if (id) this.store.loadMilestoneSubtree(id);
  }
}
```

`Router` is no longer injected — nothing else in this component navigated with it.

- [ ] **Step 4: Update the template**

Replace `project-detail.component.html` with:

```html
@if (store.projectLoading()) {
  <app-loader label="Loading project…" />
} @else if (store.projectError()) {
  <app-error-state [message]="store.projectError()!" [retryable]="true" (retry)="retryProject()" />
} @else if (store.project(); as project) {
  <div class="mb-6">
  <app-card>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-base font-semibold text-[var(--color-text-primary)]">{{ project.name }}</h1>
        <p class="text-xs text-[var(--color-text-secondary)]">{{ project.identifier }} · {{ project.description ?? '' }}</p>
      </div>
      <dl class="flex gap-6 text-sm">
        <div>
          <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
          <dd>{{ project.startDate }}</dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-text-secondary)]">Target</dt>
          <dd>{{ project.targetDate }}</dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
          <dd>{{ project.completedHours }} / {{ project.allocatedHours }}</dd>
        </div>
      </dl>
    </div>
  </app-card>
  </div>
}

<h2 class="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">Milestones</h2>

@if (store.milestonesLoading()) {
  <app-loader label="Loading milestones…" />
} @else if (store.milestonesError()) {
  <app-error-state [message]="store.milestonesError()!" [retryable]="true" (retry)="retryMilestones()" />
} @else if (store.milestones().length === 0) {
  <app-empty-state title="No milestones yet" />
} @else {
  <div class="flex gap-4 overflow-x-auto pb-2">
    @for (milestone of store.milestones(); track milestone.objectiveId) {
      <div class="w-48 flex-shrink-0">
        <app-milestone-card
          [milestone]="milestone"
          [selected]="selectedMilestoneId() === milestone.objectiveId"
          (viewed)="onMilestoneSelected(milestone)"
          (settingsRequested)="onMilestoneSettingsRequested(milestone)"
        />
      </div>
    }
  </div>
}

<div class="mt-6">
  @if (store.subtreeLoading()) {
    <app-loader label="Loading milestone…" />
  } @else if (store.subtreeError()) {
    <app-error-state [message]="store.subtreeError()!" [retryable]="true" (retry)="retrySubtree()" />
  } @else if (store.selectedSubtree(); as subtree) {
    <app-milestone-tree-node [node]="subtree" />
  } @else if (store.milestones().length > 0) {
    <p class="text-sm text-[var(--color-text-secondary)]">Select a milestone above to see its detail.</p>
  }
</div>

<app-milestone-settings-modal
  [open]="milestoneSettingsOpen()"
  [initialValue]="milestoneSettingsInitialValue()"
  [submitting]="milestoneSettingsSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (saved)="onMilestoneSettingsSaved($event)"
  (closed)="milestoneSettingsOpen.set(false)"
/>
```

The `mb-6` spacing is applied via a wrapping `<div>`, not directly on `<app-card class="mb-6">` — no existing code in this repo puts a Tailwind class straight on a custom component tag, and `CardComponent`'s host element display mode isn't guaranteed to make that work. This matches the established wrapping-`<div>` spacing pattern already used elsewhere (e.g. `project-list.component.html`'s `<div class="mt-4">`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 6: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: this toolchain type-checks the whole app graph (established earlier this session) — expect a `work.routes.ts` compile error referencing the still-present `milestone-detail` import at this point, since Task 3 (next) removes it. Not this task's own failure; proceed to commit.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/feature/project-detail/project-detail.component.ts src/app/modules/work/feature/project-detail/project-detail.component.html src/app/modules/work/feature/project-detail/project-detail.component.spec.ts
git commit -m "feat(work): compact project header card, horizontal-scroll milestones, inline detail panel

Transiently leaves work.routes.ts referencing the still-present
MilestoneDetailComponent - Task 3, landing next, removes it."
```

---

### Task 3: Remove the standalone milestone-detail route and component

**Files:**
- Modify: `src/app/modules/work/work.routes.ts`
- Delete: `src/app/modules/work/feature/milestone-detail/milestone-detail.component.ts`
- Delete: `src/app/modules/work/feature/milestone-detail/milestone-detail.component.html`
- Delete: `src/app/modules/work/feature/milestone-detail/milestone-detail.component.spec.ts`

- [ ] **Step 1: Remove the route**

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
  }
];
```

- [ ] **Step 2: Delete the component**

```bash
git rm -r src/app/modules/work/feature/milestone-detail
```

- [ ] **Step 3: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions — this closes Task 2's transient break.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/work/work.routes.ts
git commit -m "feat(work): remove the standalone milestone-detail route, now that Project Detail shows milestone detail inline"
```

---

### Task 4: Update ARCHITECTURE.md, move plan+spec to finished, sync SUMMARY.md files

**Files:**
- Modify: `docs/core/ARCHITECTURE.md`
- Modify: `docs/superpowers/plans/SUMMARY.md`, `docs/superpowers/plans/finished/SUMMARY.md`
- Modify: `docs/superpowers/specs/SUMMARY.md`, `docs/superpowers/specs/next/SUMMARY.md`, `docs/superpowers/specs/finished/SUMMARY.md`
- Move: this plan and the design doc into `finished/2026-08-10/` (already exists this session — add alongside the other two 2026-08-10 entries)

- [ ] **Step 1: Update `ARCHITECTURE.md`'s `work/` tree entry**

Remove the `feature/milestone-detail/` entry added earlier this session (Task 3 deleted the component).

- [ ] **Step 2: Move plan and spec, update SUMMARY.md files**

```bash
git mv docs/superpowers/plans/next/2026-08-10-project-detail-inline-milestone-layout.md docs/superpowers/plans/finished/2026-08-10/
git mv docs/superpowers/specs/next/2026-08-10-project-detail-inline-milestone-layout-design.md docs/superpowers/specs/finished/2026-08-10/
```

Update all five SUMMARY.md files, following the exact format already established for the other two 2026-08-10 entries this session.

- [ ] **Step 3: Run the full work module suite one last time**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/core/ARCHITECTURE.md docs/superpowers/plans docs/superpowers/specs
git commit -m "docs: move project detail inline milestone layout plan+spec to finished/2026-08-10, sync ARCHITECTURE.md"
```
