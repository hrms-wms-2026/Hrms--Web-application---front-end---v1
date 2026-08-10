# Card Settings Popup — Part A: Milestone Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MilestoneCardComponent`'s separate Edit + Achieve/Unachieve buttons with a single gear-icon Settings button opening a `MilestoneSettingsModalComponent` — edit fields plus an Achieved toggle, one Save changes button, achieve-state-dependent save ordering.

**Architecture:** `MilestoneSettingsModalComponent` (new, `ui/`) fully replaces `MilestoneFormModalComponent` (deleted). It emits one combined event; `ProjectDetailComponent` (`feature/`) owns the save-ordering sequencing (unachieve-first when turning off, edit-then-achieve-last when turning on), calling the existing `ProjectDetailStore` methods from the prior plan unchanged.

**Tech Stack:** Angular 21, NgRx Signal Store, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-card-settings-popup-design.md`

## Global Constraints

- `ObjectiveDetailDto` is missing `isAchieved` today (it was modeled off the Subtree node shape, which also lacks it) even though the real `GET /work/objectives/{id}` backend response includes it — Task 1 adds just that one field, nothing else unused.
- The Achieved toggle is disabled when `milestone.isDefault` — `AchieveObjective`/`UnachieveObjective` both reject the Default Objective with `400`.
- Component composition follows `docs/core/ARCHITECTURE.md` §2/§4 and `PROCESS_RULES.md` rule 6: the popup (`ui/`) has no store injection; sequencing logic lives in the `feature/` component only.

---

### Task 1: Add `isAchieved` to `ObjectiveDetailDto`

**Files:**
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`
- Test: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Produces: `ObjectiveDetailDto.isAchieved: boolean` — consumed by Task 2's `MilestoneSettingsModalComponent`.

- [ ] **Step 1: Write the failing test**

In `project-detail.store.spec.ts`, find the `'getMilestoneDetail returns the mapped detail on success'` test and add `isAchieved: false` to its `dto` literal, then add an assertion:

```typescript
      allocatedHours: 20, completedHours: 0, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
      isAchieved: false
    };
    const store = setup({ getObjectiveById: () => of(dto) } as Partial<ProjectApiService>);

    const result = await store.getMilestoneDetail('o1');

    expect(result).toEqual(dto);
    expect(result?.isAchieved).toBe(false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/state/project-detail.store.spec.ts --watch=false`
Expected: FAIL — TypeScript compile error, `isAchieved` does not exist on `ObjectiveDetailDto`.

- [ ] **Step 3: Add the field**

In `milestone.dto.ts`, `ObjectiveDetailDto` currently ends with `isActive: boolean; createdAt: string; updatedAt: string | null;`. Add `isAchieved?: boolean;` (optional — see note below) right after `isActive: boolean;`:

```typescript
export interface ObjectiveDetailDto {
  id: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  description: string | null;
  ownerId: string;
  reportingManagerId: string | null;
  createdById: string;
  startDate: string;
  endDate: string;
  progress: number;
  actualHours: number | null;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  /** Only present on the plain Get Objective response — the Subtree endpoint's nodes (which share this shape via ObjectiveSubtreeNodeDto) never return it. */
  isAchieved?: boolean;
  createdAt: string;
  updatedAt: string | null;
}
```

**Why optional, not required:** `ObjectiveSubtreeNodeDto extends ObjectiveDetailDto` (same file) — the Subtree endpoint's actual backend response never includes `isAchieved` on its nodes (confirmed against `Get Objective Subtree.md`). Making the field required broke `project.mapper.spec.ts`'s existing `ObjectiveSubtreeNodeDto` test fixture (missing-property compile error) — found and fixed during execution, not anticipated when this plan was written. Optional keeps the type honest about what each endpoint actually returns instead of forcing subtree fixtures to fabricate a field that was never there.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/state/project-detail.store.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/models/dto/milestone.dto.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat(work): add isAchieved to ObjectiveDetailDto"
```

---

### Task 2: `MilestoneSettingsModalComponent` (replaces `MilestoneFormModalComponent`)

**Files:**
- Create: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts`
- Create: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts`
- Delete: `src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.ts`
- Delete: `src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveDetail` (now carries `isAchieved`, per Task 1).
- Produces: `MilestoneSettingsModalComponent` with `open = input(false)`, `initialValue = input<ObjectiveDetail | null>(null)`, `submitting = input(false)`, `errorMessage = input<string>('')`, `saved = output<{ fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }>()`, `closed = output<void>()` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneSettingsModalComponent } from './milestone-settings-modal.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneSettingsModalComponent', () => {
  let fixture: ComponentFixture<MilestoneSettingsModalComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    description: 'Scope the design work', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MilestoneSettingsModalComponent] });
    fixture = TestBed.createComponent(MilestoneSettingsModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('prefills fields and the Achieved toggle from initialValue', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isAchieved: true });
    fixture.detectChanges();

    const titleInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="title-field"] input');
    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    expect(titleInput.value).toBe('Design Phase');
    expect(achievedToggle.checked).toBe(true);
  });

  it('disables the Achieved toggle for the Default Milestone', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    expect(achievedToggle.disabled).toBe(true);
  });

  it('emits saved with achievedChanged:false when the toggle is untouched', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(false);
    expect(emitted.fields.title).toBe('Design Phase');
  });

  it('emits saved with achievedChanged:true, achieved:true when toggled on', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    achievedToggle.checked = true;
    achievedToggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(true);
    expect(emitted.achieved).toBe(true);
  });

  it('emits saved with achievedChanged:true, achieved:false when toggled off', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isAchieved: true });
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    achievedToggle.checked = false;
    achievedToggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(true);
    expect(emitted.achieved).toBe(false);
  });

  it('blocks submit and shows a validation error when title is empty', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, title: '' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
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

Run: `npx ng test --include src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts --watch=false`
Expected: FAIL — cannot find module `./milestone-settings-modal.component`.

- [ ] **Step 3: Create the component**

Create `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts`:

```typescript
import { Component, effect, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-milestone-settings-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Milestone settings" (closed)="closed.emit()">
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

        <span data-testid="achieved-field" class="flex items-center gap-2">
          <input type="checkbox" id="milestone-achieved-toggle" [checked]="achieved()" [disabled]="isDefault()" (change)="onAchievedChange($event)" />
          <label for="milestone-achieved-toggle" class="text-sm text-[var(--color-text-primary)]">Achieved</label>
          @if (isDefault()) {
            <span class="text-xs text-[var(--color-text-secondary)]">(Achieve the project instead — the Default Milestone follows the project's own achieved state)</span>
          }
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
export class MilestoneSettingsModalComponent {
  open = input(false);
  initialValue = input<ObjectiveDetail | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  saved = output<{ fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  startDate = signal('');
  endDate = signal('');
  allocatedHours = signal(0);
  achieved = signal(false);
  isDefault = signal(false);
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
        this.achieved.set(value.isAchieved);
        this.isDefault.set(value.isDefault);
      } else {
        this.title.set('');
        this.description.set('');
        this.startDate.set('');
        this.endDate.set('');
        this.allocatedHours.set(0);
        this.achieved.set(false);
        this.isDefault.set(false);
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

  onAchievedChange(event: Event): void {
    this.achieved.set((event.target as HTMLInputElement).checked);
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

    const initial = this.initialValue();
    const achievedChanged = initial !== null && this.achieved() !== initial.isAchieved;

    this.saved.emit({
      fields: {
        title: this.title(), description: this.description(),
        startDate: this.startDate(), endDate: this.endDate(), allocatedHours: this.allocatedHours()
      },
      achievedChanged,
      achieved: this.achieved()
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Delete the replaced component**

```bash
git rm src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.ts src/app/modules/work/ui/milestone-form-modal/milestone-form-modal.component.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/ui/milestone-settings-modal/
git commit -m "feat(work): add MilestoneSettingsModalComponent, remove MilestoneFormModalComponent"
```

---

### Task 3: Update `MilestoneCardComponent` — gear-icon Settings button

**Files:**
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`

**Interfaces:**
- Produces: `MilestoneCardComponent.settingsRequested = output<void>()`, replacing `editRequested`/`achieveToggled` — consumed by Task 4.

- [ ] **Step 1: Update the failing tests**

Replace the two button-specific tests in `milestone-card.component.spec.ts` (`'shows Edit and Achieve when the caller is the owner'` and part of `'emits viewed/editRequested/achieveToggled on button press'`) and the "not owner" test with:

```typescript
  it('shows View but not Settings when the caller is not the owner', () => {
    setup(baseMilestone);
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('shows the Settings button when the caller is the owner', () => {
    setup({ ...baseMilestone, isOwner: true });
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).not.toBeNull();
  });

  it('emits viewed/settingsRequested on button press', () => {
    setup({ ...baseMilestone, isOwner: true });
    let viewed = false, settings = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.settingsRequested.subscribe(() => (settings = true));

    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="settings-button"] button') as HTMLButtonElement).click();

    expect(viewed).toBe(true);
    expect(settings).toBe(true);
  });
```

Delete the now-obsolete `'shows Unachieve instead of Achieve when already achieved'` test (that state now lives inside the settings popup, tested in Task 2) and the old `'emits viewed/editRequested/achieveToggled on button press'` test (replaced above).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: FAIL — `settingsRequested` doesn't exist, `[data-testid="settings-button"]` not found.

- [ ] **Step 3: Update the component**

Replace `milestone-card.component.ts` with:

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
    <div class="relative">
      @if (milestone().isOwner) {
        <span data-testid="settings-button" class="absolute right-2 top-2 z-10">
          <button
            type="button"
            class="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Milestone settings"
            (click)="settingsRequested.emit()"
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
        </div>
      </app-card>
    </div>
  `
})
export class MilestoneCardComponent {
  milestone = input.required<Milestone>();
  viewed = output<void>();
  settingsRequested = output<void>();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-card/
git commit -m "feat(work): replace MilestoneCardComponent's Edit/Achieve buttons with a Settings gear button"
```

---

### Task 4: Wire the new popup + save-ordering into `ProjectDetailComponent`

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneCardComponent.settingsRequested` (Task 3), `MilestoneSettingsModalComponent.saved` (Task 2), `ProjectDetailStore.getMilestoneDetail/editMilestone/achieveMilestone/unachieveMilestone` (unchanged, from the prior plan).

- [ ] **Step 1: Update the failing tests**

In `project-detail.component.spec.ts`, replace the four milestone-action tests (`'opens the milestone edit modal...'`, `'submits a milestone edit...'`, `'opens the achieve confirm modal...'`, `'calls unachieveMilestone...'`) with:

```typescript
  it('opens the settings modal and patches in the full detail once fetched', async () => {
    const detail = { id: 'o1', title: 'Default', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, isAchieved: false, isDefault: true };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.milestoneSettingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.editMilestone).toHaveBeenCalledWith('o1', {
      title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40
    });
    expect(storeStub.achieveMilestone).not.toHaveBeenCalled();
    expect(storeStub.unachieveMilestone).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(false);
  });

  it('edits then achieves, in that order, when the toggle is turned on', async () => {
    const calls: string[] = [];
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    storeStub.achieveMilestone = vi.fn().mockImplementation(async () => { calls.push('achieve'); return { success: true, pending: false }; });
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(calls).toEqual(['edit', 'achieve']);
  });

  it('unachieves then edits, in that order, when the toggle is turned off', async () => {
    const calls: string[] = [];
    storeStub.unachieveMilestone = vi.fn().mockImplementation(async () => { calls.push('unachieve'); return { success: true, pending: false }; });
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(calls).toEqual(['unachieve', 'edit']);
  });

  it('stops the sequence and keeps the modal open if the first step fails', async () => {
    storeStub.unachieveMilestone = vi.fn().mockResolvedValue({ success: false, pending: false });
    const editSpy = vi.fn();
    storeStub.editMilestone = editSpy;
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(editSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
  });
```

Update the `storeStub` object: rename nothing (methods stay the same names), but note the last two new tests override `editMilestone`/`unachieveMilestone`/`achieveMilestone` per-test — no stub-shape change needed beyond what already exists.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: FAIL — `milestoneSettingsOpen`/`onMilestoneSettingsRequested`/`onMilestoneSettingsSaved`/`milestoneSettingsInitialValue` don't exist yet.

- [ ] **Step 3: Update the component**

In `project-detail.component.ts`, replace the milestone-modal-related imports, signals, and methods. Replace the `MilestoneFormModalComponent` import with `MilestoneSettingsModalComponent`, remove the `ConfirmModalComponent` import and the achieve-confirm signals/methods, and replace the edit-related signals/methods:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
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
    MilestoneCardComponent, MilestoneSettingsModalComponent, MilestoneTreeNodeComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
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
}
```

- [ ] **Step 4: Update the template**

In `project-detail.component.html`, replace the `<app-milestone-card>` wiring and the two milestone modals at the bottom:

```html
      <app-milestone-card
        [milestone]="milestone"
        (viewed)="onMilestoneViewed(milestone)"
        (settingsRequested)="onMilestoneSettingsRequested(milestone)"
      />
```

Replace the `<app-milestone-form-modal>` and `<app-confirm-modal>` (achieve) blocks at the bottom of the file with:

```html
<app-milestone-settings-modal
  [open]="milestoneSettingsOpen()"
  [initialValue]="milestoneSettingsInitialValue()"
  [submitting]="milestoneSettingsSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (saved)="onMilestoneSettingsSaved($event)"
  (closed)="milestoneSettingsOpen.set(false)"
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 6: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/feature/project-detail/project-detail.component.ts src/app/modules/work/feature/project-detail/project-detail.component.html src/app/modules/work/feature/project-detail/project-detail.component.spec.ts
git commit -m "feat(work): wire MilestoneSettingsModalComponent with achieve-state-dependent save ordering"
```
