# Milestone Cards + Tree View — Part 2: Card Grid + Edit/Achieve Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Project Detail's flat milestone list with a `MilestoneCardComponent` grid (View always, Edit/Achieve/Unachieve gated by `milestone.isOwner`), wire Edit to a new `MilestoneFormModalComponent`, and wire Achieve/Unachieve to a confirm modal — mirroring `ProjectCardComponent`/`ProjectFormModalComponent`/`ProjectListComponent`'s existing confirm-modal pattern exactly.

**Architecture:** `ui/` presentational components (`MilestoneCardComponent`, `MilestoneFormModalComponent`) take inputs/emit outputs only, no store injection — `feature/` `ProjectDetailComponent` owns the modal-open signals and wires everything to `ProjectDetailStore`'s methods from Part 1.

**Tech Stack:** Angular 21, NgRx Signal Store, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-milestone-cards-and-tree-view-design.md`
**Depends on:** Part 1 (`part-1-data-layer.md`) must be complete — this part calls `store.getMilestoneDetail`/`editMilestone`/`achieveMilestone`/`unachieveMilestone`, all added there.

## Global Constraints

- `MilestoneFormModalComponent` is Edit-only — no `mode` input, no create path (milestones aren't created standalone; see the design doc's Out of scope section).
- Component composition follows `docs/core/ARCHITECTURE.md` §2/§4 and `PROCESS_RULES.md` rule 6: `ui/` components take `input()`/`output()` only, no store injection, no API calls.
- The View button's navigation target route (`/work/:projectId/milestones/:objectiveId`) is added in Part 3 — this part's `router.navigate(...)` call is written now and unit-tested via the navigation call itself, not via actual route resolution.

---

### Task 1: `MilestoneCardComponent`

**Files:**
- Create: `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`
- Test: `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`

**Interfaces:**
- Consumes: `Milestone` (from Part 1, now carries `isOwner`).
- Produces: `MilestoneCardComponent` with `milestone = input.required<Milestone>()`, `viewed = output<void>()`, `editRequested = output<void>()`, `achieveToggled = output<void>()` — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`:

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

  function setup(milestone: Milestone): void {
    TestBed.configureTestingModule({ imports: [MilestoneCardComponent] });
    fixture = TestBed.createComponent(MilestoneCardComponent);
    fixture.componentRef.setInput('milestone', milestone);
    fixture.detectChanges();
  }

  it('shows View but not Edit/Achieve when the caller is not the owner', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).toBeNull();
  });

  it('shows Edit and Achieve when the caller is the owner', () => {
    setup({ ...baseMilestone, isOwner: true });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Achieve');
  });

  it('shows Unachieve instead of Achieve when already achieved', () => {
    setup({ ...baseMilestone, isOwner: true, isAchieved: true });
    expect(fixture.nativeElement.textContent).toContain('Unachieve');
  });

  it('emits viewed/editRequested/achieveToggled on button press', () => {
    setup({ ...baseMilestone, isOwner: true });
    let viewed = false, edited = false, achieved = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.editRequested.subscribe(() => (edited = true));
    fixture.componentInstance.achieveToggled.subscribe(() => (achieved = true));

    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="edit-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="achieve-button"] button') as HTMLButtonElement).click();

    expect(viewed).toBe(true);
    expect(edited).toBe(true);
    expect(achieved).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: FAIL — cannot find module `./milestone-card.component`.

- [ ] **Step 3: Create the component**

Create `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <app-card [title]="milestone().title">
      <div class="flex items-center justify-between">
        <p class="text-xs text-[var(--color-text-secondary)]">{{ milestone().ownerName }}</p>
        @if (milestone().isAchieved) {
          <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            Achieved
          </span>
        }
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Start</dt>
        <dd>{{ milestone().startDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">End</dt>
        <dd>{{ milestone().endDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Hours</dt>
        <dd>{{ milestone().completedHours }} / {{ milestone().allocatedHours }}</dd>
      </dl>
      <div class="mt-4 flex gap-2">
        <span data-testid="view-button">
          <app-button variant="secondary" (pressed)="viewed.emit()">View</app-button>
        </span>
        @if (milestone().isOwner) {
          <span data-testid="edit-button">
            <app-button variant="secondary" (pressed)="editRequested.emit()">Edit</app-button>
          </span>
          <span data-testid="achieve-button">
            <app-button variant="primary" (pressed)="achieveToggled.emit()">
              {{ milestone().isAchieved ? 'Unachieve' : 'Achieve' }}
            </app-button>
          </span>
        }
      </div>
    </app-card>
  `
})
export class MilestoneCardComponent {
  milestone = input.required<Milestone>();
  viewed = output<void>();
  editRequested = output<void>();
  achieveToggled = output<void>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-card/milestone-card.component.ts src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts
git commit -m "feat(work): add MilestoneCardComponent"
```

---

### Task 2: `MilestoneFormModalComponent`

**Files:**
- Create: `src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.ts`
- Test: `src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveDetail` (from Part 1).
- Produces: `MilestoneFormModalComponent` with `open = input(false)`, `initialValue = input<ObjectiveDetail | null>(null)`, `submitting = input(false)`, `errorMessage = input<string>('')`, `submitted = output<EditObjectiveRequestDto>()`, `closed = output<void>()` — consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneFormModalComponent } from './milestone-form-modal.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneFormModalComponent', () => {
  let fixture: ComponentFixture<MilestoneFormModalComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    description: 'Scope the design work', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MilestoneFormModalComponent] });
    fixture = TestBed.createComponent(MilestoneFormModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('prefills all fields including description from initialValue', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();

    const titleInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="title-field"] input');
    const descriptionInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="description-field"] input');
    expect(titleInput.value).toBe('Design Phase');
    expect(descriptionInput.value).toBe('Scope the design work');
  });

  it('blocks submit and shows a validation error when title is empty', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, title: '' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });

  it('emits submitted with the edited fields', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.submitted.subscribe((v: any) => (emitted = v));

    const titleInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="title-field"] input');
    titleInput.value = 'Design Phase v2';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.title).toBe('Design Phase v2');
    expect(emitted.description).toBe('Scope the design work');
    expect(emitted.allocatedHours).toBe(20);
  });

  it('emits closed when cancelled', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts --watch=false`
Expected: FAIL — cannot find module `./milestone-form-modal.component`.

- [ ] **Step 3: Create the component**

Create `src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.ts`:

```typescript
import { Component, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-milestone-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Edit milestone" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="title-field">
          <app-input label="Title" [value]="title()" [error]="errors()['title'] ?? ''" (valueChange)="title.set($event)" />
        </span>
        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>
        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>
        <span data-testid="end-date-field">
          <app-input label="End date" type="date" [value]="endDate()" [error]="errors()['endDate'] ?? ''" (valueChange)="endDate.set($event)" />
        </span>
        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Save changes</app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class MilestoneFormModalComponent {
  open = input(false);
  initialValue = input<ObjectiveDetail | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  submitted = output<EditObjectiveRequestDto>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  startDate = signal('');
  endDate = signal('');
  allocatedHours = signal(0);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (value) {
        this.title.set(value.title);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.endDate.set(value.endDate);
        this.allocatedHours.set(value.allocatedHours);
      } else {
        this.title.set('');
        this.description.set('');
        this.startDate.set('');
        this.endDate.set('');
        this.allocatedHours.set(0);
      }
      this.errors.set({});
    });
  }

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  submit(): void {
    const errors: Record<string, string> = {};
    if (!this.title().trim()) errors['title'] = 'Title is required.';
    if (!this.startDate()) errors['startDate'] = 'Start date is required.';
    if (!this.endDate()) errors['endDate'] = 'End date is required.';
    else if (this.startDate() && this.endDate() < this.startDate()) errors['endDate'] = 'End date cannot be before the start date.';
    if (this.allocatedHours() < 0) errors['allocatedHours'] = 'Allocated hours cannot be negative.';

    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    this.submitted.emit({
      title: this.title(), description: this.description(),
      startDate: this.startDate(), endDate: this.endDate(), allocatedHours: this.allocatedHours()
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.ts src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts
git commit -m "feat(work): add MilestoneFormModalComponent"
```

---

### Task 3: Wire cards + Edit modal + Achieve confirm modal into `ProjectDetailComponent`

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html`
- Test: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneCardComponent` (Task 1), `MilestoneFormModalComponent` (Task 2), `ProjectDetailStore.getMilestoneDetail/editMilestone/achieveMilestone/unachieveMilestone` (Part 1 Task 4), `ConfirmModalComponent` (existing, `src/app/shared/ui/confirm-modal/confirm-modal.component.ts`).

- [ ] **Step 1: Write the failing tests**

In `project-detail.component.spec.ts`, update the `milestone` const to include `isOwner: true` (needed for the Edit/Achieve tests below):

```typescript
  const milestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
    objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
    isOwner: true
  };
```

Add these store methods to the existing `storeStub` object (alongside `loadProject`, `loadMyMilestones`, etc.):

```typescript
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      milestoneActionError: () => null
```

Note: this is `milestoneActionError`, a field distinct from `projectError`/`milestonesError` that the stub already has — Part 1 Task 4 added it specifically so a failed milestone action can't blank out the already-loaded project header or card grid (see that task's Interfaces note). Don't reuse `projectError` here.

Add these tests at the end of the `describe` block, just above the final closing `}`:

```typescript
  it('opens the milestone edit modal and patches in the full detail once fetched', async () => {
    const detail = { id: 'o1', title: 'Default', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneEditRequested(milestone);

    expect(fixture.componentInstance.milestoneFormOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.milestoneFormInitialValue() as any)?.description).toBe('Full scope');
  });

  it('submits a milestone edit and closes the modal on success', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneEditRequested(milestone);

    await fixture.componentInstance.onMilestoneEditSubmit({
      title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40
    });

    expect(storeStub.editMilestone).toHaveBeenCalledWith('o1', {
      title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40
    });
    expect(fixture.componentInstance.milestoneFormOpen()).toBe(false);
  });

  it('opens the achieve confirm modal and calls achieveMilestone on confirm', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneAchieveToggled(milestone);
    expect(fixture.componentInstance.achieveConfirmOpen()).toBe(true);

    await fixture.componentInstance.onMilestoneAchieveConfirmed();

    expect(storeStub.achieveMilestone).toHaveBeenCalledWith('o1');
    expect(fixture.componentInstance.achieveConfirmOpen()).toBe(false);
  });

  it('calls unachieveMilestone when the milestone is already achieved', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneAchieveToggled({ ...milestone, isAchieved: true });
    await fixture.componentInstance.onMilestoneAchieveConfirmed();
    expect(storeStub.unachieveMilestone).toHaveBeenCalledWith('o1');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: FAIL — `onMilestoneEditRequested`/`onMilestoneEditSubmit`/`onMilestoneAchieveToggled`/`onMilestoneAchieveConfirmed`/`milestoneFormOpen`/`achieveConfirmOpen` don't exist yet.

- [ ] **Step 3: Update the component class**

Replace the full contents of `project-detail.component.ts` with:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneFormModalComponent } from '../../ui/milestone-form-modal/milestone-form-modal.component';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { Milestone, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneCardComponent, MilestoneFormModalComponent, MilestoneTreeNodeComponent, ConfirmModalComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  milestoneFormOpen = signal(false);
  milestoneFormInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneFormSubmitting = signal(false);
  achieveConfirmOpen = signal(false);
  achieveConfirmSubmitting = signal(false);
  private targetMilestone = signal<Milestone | null>(null);

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    this.store.loadMyMilestones(this.projectId);
  }

  onMilestoneViewed(milestone: Milestone): void {
    this.router.navigate(['/work', this.projectId, 'milestones', milestone.objectiveId]);
  }

  onMilestoneEditRequested(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.milestoneFormOpen.set(true);
    this.loadFullMilestoneDetail(milestone.objectiveId);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestone()?.objectiveId === id) {
      this.milestoneFormInitialValue.set(detail);
    }
  }

  async onMilestoneEditSubmit(payload: EditObjectiveRequestDto): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.milestoneFormSubmitting.set(true);
    const result = await this.store.editMilestone(milestone.objectiveId, payload);
    this.milestoneFormSubmitting.set(false);
    if (result.success) {
      this.milestoneFormOpen.set(false);
      await this.store.loadMyMilestones(this.projectId);
    }
  }

  onMilestoneAchieveToggled(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.achieveConfirmOpen.set(true);
  }

  async onMilestoneAchieveConfirmed(): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.achieveConfirmSubmitting.set(true);
    const result = milestone.isAchieved
      ? await this.store.unachieveMilestone(milestone.objectiveId)
      : await this.store.achieveMilestone(milestone.objectiveId);
    this.achieveConfirmSubmitting.set(false);
    if (result.success) {
      this.achieveConfirmOpen.set(false);
      await this.store.loadMyMilestones(this.projectId);
    }
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
```

- [ ] **Step 4: Update the template**

Replace the "Milestones" section in `project-detail.component.html` (from `<h2 class="mb-3 ...">Milestones</h2>` through the end of the `@else` block that renders `<ul>`, i.e. everything up to but not including the final `@if (store.subtreeLoading())` block, which stays untouched since it's still used when a tree is shown inline — actually per this plan's scope, inline tree display moves to Part 3's dedicated page, so remove the final subtree block here too) with:

```html
<h2 class="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">Milestones</h2>

@if (store.milestonesLoading()) {
  <app-loader label="Loading milestones…" />
} @else if (store.milestonesError()) {
  <app-error-state [message]="store.milestonesError()!" [retryable]="true" (retry)="retryMilestones()" />
} @else if (store.milestones().length === 0) {
  <app-empty-state title="No milestones yet" />
} @else {
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    @for (milestone of store.milestones(); track milestone.objectiveId) {
      <app-milestone-card
        [milestone]="milestone"
        (viewed)="onMilestoneViewed(milestone)"
        (editRequested)="onMilestoneEditRequested(milestone)"
        (achieveToggled)="onMilestoneAchieveToggled(milestone)"
      />
    }
  </div>
}

<app-milestone-form-modal
  [open]="milestoneFormOpen()"
  [initialValue]="milestoneFormInitialValue()"
  [submitting]="milestoneFormSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (submitted)="onMilestoneEditSubmit($event)"
  (closed)="milestoneFormOpen.set(false)"
/>

<app-confirm-modal
  [open]="achieveConfirmOpen()"
  title="Achieve milestone"
  message="Mark this milestone as achieved? Every direct sub-milestone must already be achieved first."
  confirmLabel="Confirm"
  [loading]="achieveConfirmSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (confirmed)="onMilestoneAchieveConfirmed()"
  (cancelled)="achieveConfirmOpen.set(false)"
/>
```

The header `dl` block above "Milestones" (project name/identifier/dates) stays exactly as-is — only the "Milestones" section and everything below it changes.

- [ ] **Step 5: Update tests that referenced the removed inline-tree/click behavior**

The existing tests `'loads a milestone subtree on click'` and `'renders the milestone tree when a subtree is selected'` in `project-detail.component.spec.ts` test `onMilestoneClicked`, which no longer exists (View now navigates instead of loading a subtree inline — that behavior moves to Part 3's dedicated page). Delete both of those two tests. The existing test `'shows a muted tag for a milestone the caller is no longer a member of'` still applies conceptually but the flat-list-specific "no longer a member" tag rendering was part of the old `<ul>` markup this task replaced — if `MilestoneCardComponent` doesn't render that tag (it doesn't, per Task 1's template), delete this test too; it's out of this plan's scope to re-add that indicator to the card (not requested, note it in the plan's follow-up if wanted later, but don't silently drop functionality without flagging it — add a one-line comment above the deleted test block: `// membershipIsActive "no longer a member" tag not carried over to MilestoneCardComponent - flag if still wanted`).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 7: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/work/feature/project-detail/project-detail.component.ts src/app/modules/work/feature/project-detail/project-detail.component.html src/app/modules/work/feature/project-detail/project-detail.component.spec.ts
git commit -m "feat(work): wire milestone card grid, edit modal, achieve toggle into Project Detail"
```
