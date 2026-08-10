# Card Settings Popup — Part B: Project Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `ProjectCardComponent`'s separate Edit + Achieve/Unachieve buttons with a single gear-icon Settings button opening a new `ProjectSettingsModalComponent` — edit fields plus an Achieved toggle, one Save changes button. `ProjectFormModalComponent` shrinks to Create-only.

**Architecture:** Unlike Objectives, `EditProjectCommandHandler` has no achieved-state check — editing an already-achieved Project is allowed, so there's no save-ordering constraint here (unlike Part A's Milestone popup). `ProjectSettingsModalComponent` (new, `ui/`) always calls Edit first, then Achieve/Unachieve if the toggle changed — order chosen for consistency with Part A's code shape, not because the backend requires it.

**Tech Stack:** Angular 21, NgRx Signal Store, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-card-settings-popup-design.md`
**Depends on:** None functionally (independent of Part A), but mirrors its patterns — read Part A first if executing this cold.

## Global Constraints

- `Project`/`ProjectDetail` already carry `isAchieved` (unlike Milestone's `ObjectiveDetailDto`, no DTO gap to fix here).
- `ProjectSettingsModalComponent` has no Identifier field (immutable after create), no Release date field (create-only), no Logo upload (create-only, `EditProjectRequestDto` has no logo field).
- `ProjectFormModalComponent` loses its `mode`/`initialValue` inputs and `editSubmitted` output entirely — it becomes Create-only. Its fields always reset when the modal opens (no more "Create opened right after Edit closed" scenario — Edit lives in a separate component now, so that old cross-mode reset bug this repo fixed earlier can't recur here).

---

### Task 1: Simplify `ProjectFormModalComponent` to Create-only

**Files:**
- Modify: `src/app/modules/work/ui/project-form-modal/project-form-modal.component.ts`
- Modify: `src/app/modules/work/ui/project-form-modal/project-form-modal.component.spec.ts`

**Interfaces:**
- Removes: `mode` input, `initialValue` input, `editSubmitted` output.
- Produces: same `createSubmitted = output<CreateProjectPayload>()`, `closed = output<void>()` as before, `open = input(false)` unchanged.

- [ ] **Step 1: Update the failing tests**

In `project-form-modal.component.spec.ts`:
- Remove `fixture.componentRef.setInput('mode', 'create')` from `beforeEach` (no longer exists).
- Delete the `'shows identifier and release date fields only in create mode'` test (identifier/release-date are unconditional now — nothing to compare against).
- Delete the `'prefills fields from initialValue in edit mode'`, `'prefills color from initialValue in edit mode'`, and `'clears prefilled fields when initialValue goes back to null...'` tests (no `initialValue`/`mode` inputs left).
- In the remaining tests, remove any `fixture.componentRef.setInput('mode', ...)` and `setInput('initialValue', ...)` calls.
- Add a new test:

```typescript
  it('resets fields every time the modal opens', () => {
    fixture.detectChanges();
    setField('name-field', 'Website Revamp');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    expect(nameInput.value).toBe('');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/ui/project-form-modal/project-form-modal.component.spec.ts --watch=false`
Expected: FAIL — `open` input doesn't reset fields yet (new test), and/or leftover `mode`/`initialValue` references from Step 1 edits don't compile until Step 3/4 land — if compile errors block the RED run, that's expected here since this task changes the component's public inputs; proceed to Step 3 next.

- [ ] **Step 3: Simplify the component**

Replace `project-form-modal.component.ts` with:

```typescript
import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { CreateProjectPayload } from '../../models/project.model';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, SelectComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Create project" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="name-field">
          <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
        </span>

        <span data-testid="identifier-field">
          <app-input label="Identifier" [value]="identifier()" [error]="errors()['identifier'] ?? ''" (valueChange)="identifier.set($event)" />
        </span>

        <span data-testid="category-field">
          <app-select label="Category" placeholder="Select a category" [options]="categoryOptions()" [value]="categoryId()" [error]="errors()['categoryId'] ?? ''" (valueChange)="categoryId.set($event)" />
        </span>

        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>

        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>

        <span data-testid="target-date-field">
          <app-input label="Target date" type="date" [value]="targetDate()" [error]="errors()['targetDate'] ?? ''" (valueChange)="targetDate.set($event)" />
        </span>

        <span data-testid="release-date-field">
          <app-input label="Release date" type="date" [value]="releaseDate()" [error]="errors()['releaseDate'] ?? ''" (valueChange)="releaseDate.set($event)" />
        </span>

        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        <span data-testid="color-field">
          <app-input label="Color" placeholder="#2563EB" [value]="color()" (valueChange)="color.set($event)" />
        </span>

        <span data-testid="logo-field" class="flex flex-col gap-1">
          <label class="text-xs font-medium text-[var(--color-text-secondary)]">Logo</label>
          <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogoFileSelected($event)" />
          @if (logoFile(); as file) {
            <span class="text-xs text-[var(--color-text-secondary)]">{{ file.name }}</span>
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
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Create</app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class ProjectFormModalComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  open = input(false);
  submitting = input(false);
  errorMessage = input<string>('');

  createSubmitted = output<CreateProjectPayload>();
  closed = output<void>();

  name = signal('');
  identifier = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  releaseDate = signal('');
  allocatedHours = signal(0);
  color = signal('');
  logoFile = signal<File | null>(null);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      if (this.open()) {
        this.name.set('');
        this.identifier.set('');
        this.categoryId.set('');
        this.description.set('');
        this.startDate.set('');
        this.targetDate.set('');
        this.releaseDate.set('');
        this.allocatedHours.set(0);
        this.color.set('');
        this.logoFile.set(null);
        this.errors.set({});
      }
    });
  }

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  onLogoFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.logoFile.set(input.files?.[0] ?? null);
  }

  private buildFields(): ProjectFormFields {
    return {
      name: this.name(), identifier: this.identifier(), categoryId: this.categoryId(),
      startDate: this.startDate(), targetDate: this.targetDate(), releaseDate: this.releaseDate(),
      allocatedHours: this.allocatedHours()
    };
  }

  submit(): void {
    const fields = this.buildFields();
    const errors = validateProjectForm(fields, 'create');
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    this.createSubmitted.emit({
      categoryId: fields.categoryId, name: fields.name, identifier: fields.identifier,
      description: this.description(), startDate: fields.startDate, targetDate: fields.targetDate,
      releaseDate: fields.releaseDate, color: this.color(), actualHours: 0,
      defaultObjectiveAllocatedHours: fields.allocatedHours, logoFile: this.logoFile()
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/ui/project-form-modal/project-form-modal.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/project-form-modal/
git commit -m "refactor(work): simplify ProjectFormModalComponent to Create-only"
```

---

### Task 2: `ProjectSettingsModalComponent`

**Files:**
- Create: `src/app/modules/work/ui/project-settings-modal/project-settings-modal.component.ts`
- Create: `src/app/modules/work/ui/project-settings-modal/project-settings-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectDetail` (already carries `isAchieved`).
- Produces: `ProjectSettingsModalComponent` with `open = input(false)`, `initialValue = input<ProjectDetail | null>(null)`, `submitting = input(false)`, `errorMessage = input<string>('')`, `saved = output<{ fields: EditProjectPayload; achievedChanged: boolean; achieved: boolean }>()`, `closed = output<void>()` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/project-settings-modal/project-settings-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectSettingsModalComponent } from './project-settings-modal.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectDetail } from '../../models/project.model';

describe('ProjectSettingsModalComponent', () => {
  let fixture: ComponentFixture<ProjectSettingsModalComponent>;

  const detail: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectSettingsModalComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: () => Promise.resolve() } }]
    });
    fixture = TestBed.createComponent(ProjectSettingsModalComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('prefills fields and the Achieved toggle from initialValue', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isAchieved: true });
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    const achievedToggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input');
    expect(nameInput.value).toBe('Website Revamp');
    expect(achievedToggle.checked).toBe(true);
  });

  it('emits saved with achievedChanged:false when the toggle is untouched', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.saved.subscribe((v: any) => (emitted = v));

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.achievedChanged).toBe(false);
    expect(emitted.fields.name).toBe('Website Revamp');
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

  it('blocks submit and shows a validation error when name is empty', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, name: '' });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is required.');
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

Run: `npx ng test --include src/app/modules/work/ui/project-settings-modal/project-settings-modal.component.spec.ts --watch=false`
Expected: FAIL — cannot find module `./project-settings-modal.component`.

- [ ] **Step 3: Create the component**

Create `src/app/modules/work/ui/project-settings-modal/project-settings-modal.component.ts`:

```typescript
import { Component, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { EditProjectPayload, ProjectDetail } from '../../models/project.model';

@Component({
  selector: 'app-project-settings-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, SelectComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Project settings" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="name-field">
          <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
        </span>

        <span data-testid="category-field">
          <app-select label="Category" placeholder="Select a category" [options]="categoryOptions()" [value]="categoryId()" [error]="errors()['categoryId'] ?? ''" (valueChange)="categoryId.set($event)" />
        </span>

        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>

        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>

        <span data-testid="target-date-field">
          <app-input label="Target date" type="date" [value]="targetDate()" [error]="errors()['targetDate'] ?? ''" (valueChange)="targetDate.set($event)" />
        </span>

        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        <span data-testid="color-field">
          <app-input label="Color" placeholder="#2563EB" [value]="color()" (valueChange)="color.set($event)" />
        </span>

        <span data-testid="achieved-field" class="flex items-center gap-2">
          <input type="checkbox" id="project-achieved-toggle" [checked]="achieved()" (change)="onAchievedChange($event)" />
          <label for="project-achieved-toggle" class="text-sm text-[var(--color-text-primary)]">Achieved</label>
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
export class ProjectSettingsModalComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  open = input(false);
  initialValue = input<ProjectDetail | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  saved = output<{ fields: EditProjectPayload; achievedChanged: boolean; achieved: boolean }>();
  closed = output<void>();

  name = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  allocatedHours = signal(0);
  color = signal('');
  achieved = signal(false);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (value) {
        this.name.set(value.name);
        this.categoryId.set(value.categoryId);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.targetDate.set(value.targetDate);
        this.allocatedHours.set(value.allocatedHours);
        this.color.set(value.color ?? '');
        this.achieved.set(value.isAchieved);
      } else {
        this.name.set('');
        this.categoryId.set('');
        this.description.set('');
        this.startDate.set('');
        this.targetDate.set('');
        this.allocatedHours.set(0);
        this.color.set('');
        this.achieved.set(false);
      }
      this.errors.set({});
    });
  }

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
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
    const fields: ProjectFormFields = {
      name: this.name(), identifier: '', categoryId: this.categoryId(),
      startDate: this.startDate(), targetDate: this.targetDate(), releaseDate: '',
      allocatedHours: this.allocatedHours()
    };
    const errors = validateProjectForm(fields, 'edit');
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    const initial = this.initialValue();
    const achievedChanged = initial !== null && this.achieved() !== initial.isAchieved;

    this.saved.emit({
      fields: {
        name: fields.name, description: this.description(), categoryId: fields.categoryId,
        startDate: fields.startDate, targetDate: fields.targetDate, color: this.color(), actualHours: 0
      },
      achievedChanged,
      achieved: this.achieved()
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/ui/project-settings-modal/project-settings-modal.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/project-settings-modal/
git commit -m "feat(work): add ProjectSettingsModalComponent"
```

---

### Task 3: Update `ProjectCardComponent` — gear-icon Settings button

**Files:**
- Modify: `src/app/modules/work/ui/project-card/project-card.component.ts`
- Modify: `src/app/modules/work/ui/project-card/project-card.component.spec.ts`

**Interfaces:**
- Produces: `ProjectCardComponent.settingsRequested = output<void>()`, replacing `edited`/`achieveToggled` — consumed by Task 4.

- [ ] **Step 1: Update the failing tests**

Check `project-card.component.spec.ts` for its current Edit/Achieve button tests (mirrors the shape `milestone-card.component.spec.ts` had before Part A Task 3) and replace them the same way:

```typescript
  it('shows View but not Settings when the caller is not the lead', () => {
    setup({ ...baseProject, isLead: false });
    expect(fixture.nativeElement.querySelector('[data-testid="view-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('shows the Settings button when the caller is the lead', () => {
    setup({ ...baseProject, isLead: true });
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).not.toBeNull();
  });

  it('emits viewed/settingsRequested on button press', () => {
    setup({ ...baseProject, isLead: true });
    let viewed = false, settings = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    fixture.componentInstance.settingsRequested.subscribe(() => (settings = true));

    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="settings-button"] button') as HTMLButtonElement).click();

    expect(viewed).toBe(true);
    expect(settings).toBe(true);
  });
```

Adjust `baseProject`/`setup` names to match whatever this spec file's existing helper is actually called (read the file first — it mirrors `milestone-card.component.spec.ts`'s shape but for `Project`). Delete the old Edit/Achieve-button-specific tests these replace.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/ui/project-card/project-card.component.spec.ts --watch=false`
Expected: FAIL — `settingsRequested` doesn't exist, `[data-testid="settings-button"]` not found.

- [ ] **Step 3: Update the component**

Replace `project-card.component.ts` with:

```typescript
import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="relative">
      @if (project().isLead) {
        <span data-testid="settings-button" class="absolute right-2 top-2 z-10">
          <button
            type="button"
            class="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Project settings"
            (click)="settingsRequested.emit()"
          >⚙</button>
        </span>
      }
      <app-card [title]="project().name">
        <div class="flex items-center justify-between">
          <p class="text-xs text-[var(--color-text-secondary)]">{{ project().identifier }}</p>
          @if (project().isAchieved) {
            <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt class="text-[var(--color-text-secondary)]">Start</dt>
          <dd>{{ project().startDate }}</dd>
          <dt class="text-[var(--color-text-secondary)]">Target</dt>
          <dd>{{ project().targetDate }}</dd>
          <dt class="text-[var(--color-text-secondary)]">Hours</dt>
          <dd>{{ project().completedHours }} / {{ project().allocatedHours }}</dd>
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
export class ProjectCardComponent {
  project = input.required<Project>();
  viewed = output<void>();
  settingsRequested = output<void>();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/ui/project-card/project-card.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/project-card/
git commit -m "feat(work): replace ProjectCardComponent's Edit/Achieve buttons with a Settings gear button"
```

---

### Task 4: Wire the new popups into `ProjectListComponent`

**Files:**
- Modify: `src/app/modules/work/feature/project-list/project-list.component.ts`
- Modify: `src/app/modules/work/feature/project-list/project-list.component.html`
- Modify: `src/app/modules/work/feature/project-list/project-list.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectCardComponent.settingsRequested` (Task 3), `ProjectFormModalComponent` (Create-only, Task 1), `ProjectSettingsModalComponent.saved` (Task 2), `ProjectListStore.getProjectDetail/editProject/achieveProject/unachieveProject` (all unchanged, already exist).

- [ ] **Step 1: Update the failing tests**

In `project-list.component.spec.ts`, remove `formModalMode` references (no longer exists — `openCreateModal`/`onCreateSubmit` tests need no `mode` assertions). Replace the milestone-equivalent Edit/Achieve tests (`openEditModal`/`onEditSubmit`/`openAchieveConfirm`/`onAchieveConfirmed`, mirroring what Part A Task 4 replaced for milestones) with the Project equivalents:

```typescript
  it('opens the settings modal and patches in the full detail once fetched', async () => {
    const detail = { ...project, description: 'Rebuild the marketing site.', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null };
    storeStub.getProjectDetail = vi.fn().mockResolvedValue(detail);
    fixture.detectChanges();

    fixture.componentInstance.onProjectSettingsRequested(project);

    expect(fixture.componentInstance.settingsModalOpen()).toBe(true);
    expect(storeStub.getProjectDetail).toHaveBeenCalledWith('p1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.settingsModalInitialValue() as any)?.description).toBe('Rebuild the marketing site.');
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested(project);

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp v2', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.editProject).toHaveBeenCalledWith('p1', {
      name: 'Website Revamp v2', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0
    });
    expect(storeStub.achieveProject).not.toHaveBeenCalled();
    expect(storeStub.unachieveProject).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settingsModalOpen()).toBe(false);
  });

  it('edits then achieves when the toggle is turned on', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested(project);

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0 },
      achievedChanged: true, achieved: true
    });

    expect(storeStub.editProject).toHaveBeenCalled();
    expect(storeStub.achieveProject).toHaveBeenCalledWith('p1');
    expect(storeStub.unachieveProject).not.toHaveBeenCalled();
  });

  it('edits then unachieves when the toggle is turned off', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested({ ...project, isAchieved: true });

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0 },
      achievedChanged: true, achieved: false
    });

    expect(storeStub.unachieveProject).toHaveBeenCalledWith('p1');
  });

  it('stops and keeps the modal open if editProject fails', async () => {
    storeStub.editProject = vi.fn().mockResolvedValue(false);
    fixture.detectChanges();
    fixture.componentInstance.onProjectSettingsRequested(project);

    await fixture.componentInstance.onProjectSettingsSaved({
      fields: { name: 'Website Revamp', description: '', categoryId: 'cat1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '', actualHours: 0 },
      achievedChanged: true, achieved: true
    });

    expect(storeStub.achieveProject).not.toHaveBeenCalled();
    expect(fixture.componentInstance.settingsModalOpen()).toBe(true);
  });
```

Add `getProjectDetail`/`editProject`/`achieveProject`/`unachieveProject` to `storeStub` if any are missing (they should already be there from the prior plan's Description-bug fix and the existing achieve/unachieve methods) — check before adding duplicates.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/project-list/project-list.component.spec.ts --watch=false`
Expected: FAIL — `onProjectSettingsRequested`/`onProjectSettingsSaved`/`settingsModalOpen`/`settingsModalInitialValue` don't exist yet.

- [ ] **Step 3: Update the component**

Replace `project-list.component.ts` with:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectListStore, AchievedFilter } from '../../state/project-list.store';
import { ProjectCardComponent } from '../../ui/project-card/project-card.component';
import { ProjectFilterBarComponent } from '../../ui/project-filter-bar/project-filter-bar.component';
import { ProjectFormModalComponent } from '../../ui/project-form-modal/project-form-modal.component';
import { ProjectSettingsModalComponent } from '../../ui/project-settings-modal/project-settings-modal.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CreateProjectPayload, EditProjectPayload, Project, ProjectDetail } from '../../models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    ProjectCardComponent, ProjectFilterBarComponent, ProjectFormModalComponent, ProjectSettingsModalComponent, ConfirmModalComponent,
    PageHeaderComponent, ButtonComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectListStore);
  private readonly router = inject(Router);

  createModalOpen = signal(false);
  settingsModalOpen = signal(false);
  settingsModalInitialValue = signal<Project | ProjectDetail | null>(null);
  deleteConfirmOpen = signal(false);
  private targetProject = signal<Project | null>(null);
  actionSubmitting = signal(false);

  ngOnInit(): void {
    this.store.loadProjects();
  }

  onView(project: Project): void {
    this.router.navigate(['/work', project.id]);
  }

  openCreateModal(): void {
    this.createModalOpen.set(true);
  }

  async onCreateSubmit(payload: CreateProjectPayload): Promise<void> {
    this.actionSubmitting.set(true);
    const success = await this.store.createProject(payload);
    this.actionSubmitting.set(false);
    if (success) {
      this.createModalOpen.set(false);
    }
  }

  onProjectSettingsRequested(project: Project): void {
    this.targetProject.set(project);
    this.settingsModalInitialValue.set(project);
    this.settingsModalOpen.set(true);
    this.loadFullDetailForSettings(project.id);
  }

  private async loadFullDetailForSettings(id: string): Promise<void> {
    const detail = await this.store.getProjectDetail(id);
    if (detail && this.targetProject()?.id === id) {
      this.settingsModalInitialValue.set(detail);
    }
  }

  async onProjectSettingsSaved(event: { fields: EditProjectPayload; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);

    const editSuccess = await this.store.editProject(project.id, event.fields);
    if (!editSuccess) {
      this.actionSubmitting.set(false);
      return;
    }

    if (event.achievedChanged) {
      const achieveSuccess = event.achieved
        ? await this.store.achieveProject(project.id)
        : await this.store.unachieveProject(project.id);
      if (!achieveSuccess) {
        this.actionSubmitting.set(false);
        return;
      }
    }

    this.actionSubmitting.set(false);
    this.settingsModalOpen.set(false);
  }

  openDeleteConfirm(project: Project): void {
    this.targetProject.set(project);
    this.deleteConfirmOpen.set(true);
  }

  async onDeleteConfirmed(): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = await this.store.deleteProject(project.id);
    this.actionSubmitting.set(false);
    if (success) {
      this.deleteConfirmOpen.set(false);
    }
  }

  onCategoryFilterChanged(categoryId: string | null): void {
    this.store.setCategoryFilter(categoryId);
  }

  onAchievedFilterChanged(filter: AchievedFilter): void {
    this.store.setAchievedFilter(filter);
  }
}
```

- [ ] **Step 4: Update the template**

Replace `project-list.component.html` with:

```html
<app-page-header title="Projects" subtitle="Plan and manage your projects.">
  <app-button variant="primary" (pressed)="openCreateModal()">+ Create project</app-button>
</app-page-header>

<app-project-filter-bar
  (categoryChanged)="onCategoryFilterChanged($event)"
  (achievedFilterChanged)="onAchievedFilterChanged($event)"
/>

<div class="mt-4">
  @if (store.loading()) {
    <app-loader label="Loading projects…" />
  } @else if (store.error()) {
    <app-error-state [message]="store.error()!" [retryable]="true" (retry)="store.loadProjects()" />
  } @else if (store.filteredProjects().length === 0) {
    <app-empty-state title="No projects yet" description="Create your first project to get started.">
      <app-button variant="primary" (pressed)="openCreateModal()">+ Create project</app-button>
    </app-empty-state>
  } @else {
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (project of store.filteredProjects(); track project.id) {
        <app-project-card
          [project]="project"
          (viewed)="onView(project)"
          (settingsRequested)="onProjectSettingsRequested(project)"
        />
      }
    </div>
  }
</div>

<app-project-form-modal
  [open]="createModalOpen()"
  [submitting]="actionSubmitting()"
  [errorMessage]="store.error() ?? ''"
  (createSubmitted)="onCreateSubmit($event)"
  (closed)="createModalOpen.set(false)"
/>

<app-project-settings-modal
  [open]="settingsModalOpen()"
  [initialValue]="settingsModalInitialValue()"
  [submitting]="actionSubmitting()"
  [errorMessage]="store.error() ?? ''"
  (saved)="onProjectSettingsSaved($event)"
  (closed)="settingsModalOpen.set(false)"
/>

<app-confirm-modal
  [open]="deleteConfirmOpen()"
  title="Delete project"
  message="Delete this project? This cannot be undone."
  confirmLabel="Delete"
  [loading]="actionSubmitting()"
  [errorMessage]="store.error() ?? ''"
  (confirmed)="onDeleteConfirmed()"
  (cancelled)="deleteConfirmOpen.set(false)"
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/project-list/project-list.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 6: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/feature/project-list/project-list.component.ts src/app/modules/work/feature/project-list/project-list.component.html src/app/modules/work/feature/project-list/project-list.component.spec.ts
git commit -m "feat(work): wire ProjectSettingsModalComponent into Project List"
```

---

### Task 5: Update ARCHITECTURE.md, move plan+spec to finished, sync SUMMARY.md files

**Files:**
- Modify: `docs/core/ARCHITECTURE.md`
- Modify: `docs/superpowers/plans/SUMMARY.md`, `docs/superpowers/plans/finished/SUMMARY.md`
- Modify: `docs/superpowers/specs/SUMMARY.md`, `docs/superpowers/specs/next/SUMMARY.md`, `docs/superpowers/specs/finished/SUMMARY.md`
- Move: this plan's two part files and the design doc into their `finished/2026-08-10/` subfolders (a second `2026-08-10/` batch — check whether the existing `finished/2026-08-10/` subfolder from the earlier Milestone Cards plan already exists and add to it rather than recreate)

- [ ] **Step 1: Update `ARCHITECTURE.md`'s `work/` tree entry**

Add `milestone-settings-modal/`, `project-settings-modal/` under `ui/`; remove `milestone-form-modal/` (deleted in Part A). `project-form-modal/` stays (simplified, not removed).

- [ ] **Step 2: Move plan and spec files, update SUMMARY.md files**

```bash
git mv docs/superpowers/plans/next/2026-08-10-card-settings-popup docs/superpowers/plans/finished/2026-08-10/
git mv docs/superpowers/specs/next/2026-08-10-card-settings-popup-design.md docs/superpowers/specs/finished/2026-08-10/
```

Update all five SUMMARY.md files listed above, following the exact format of the most recent entries already in each, per the pattern the Milestone Cards + Tree View plan already established the same day.

- [ ] **Step 3: Commit**

```bash
git add docs/core/ARCHITECTURE.md docs/superpowers/plans docs/superpowers/specs
git commit -m "docs: move card settings popup plan+spec to finished/2026-08-10, sync ARCHITECTURE.md"
```
