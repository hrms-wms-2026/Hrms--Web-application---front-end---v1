# Part 3: Shared `TaskClockWidgetComponent`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared Clock-in/Push component, built standalone in this Part and wired into its 3 call
sites (My Task, Board's `TaskCardComponent`, Backlog's `TaskTableComponent`) in Part 6.

**Spec:** design spec §4 (`ui/task-clock-widget/task-clock-widget.component.ts`)

**Depends on:** Part 2 (`TaskApiService.clockIn`/`.push`).

## Architecture & Conventions

- Structural sibling for a small self-contained interactive `ui/` component with its own local state and a
  service call: `sprint-edit-form.component.ts` (signals for form state, `firstValueFrom` for the HTTP
  call, `submitting`/`errorMessage` signals) — read it for this module's established style before writing
  the new component, rather than inventing a different local-state pattern.
- This component receives everything it needs as inputs — it does **not** fetch the task itself. Callers
  (My Task, Board card, Backlog row) already have the `WorkTask` in hand.
- The percent popup is a small inline overlay (a `<div>` toggled by a signal), **not** `ModalComponent`
  (spec: "not a full modal — matches 'popup' in the requirement"). Check `ModalComponent`'s existing usage
  elsewhere to be sure this call is correct — the distinction matters because a full modal here would block
  the rest of the card/row from view, which is worse UX for a quick action embedded in a list.

## Global Constraints

- Client-side validates `percent > task.progressPercent` before allowing submission — the backend
  re-validates regardless (defense in depth, not a substitute).
- Disabled states must show *why* (tooltip/title attribute), never a silently-inert button.

---

### Task 1: Component skeleton, inputs, and disabled-state logic

**Files:**
- Create: `src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.ts`
- Test: `src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.spec.ts`

**Interfaces:**
- Produces: `TaskClockWidgetComponent` with inputs `task: input.required<WorkTask>`,
  `hasOpenSessionMine: input(false)`, `hasOpenSessionOtherEmployee: input(false)`,
  `isAssignee: input.required<boolean>`; outputs `clockedIn: output<void>`, `pushed: output<WorkTask>`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TaskClockWidgetComponent } from './task-clock-widget.component';
import { WorkTask } from '../../models/task.model';

const baseTask: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 'st1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null, assigneeEmployeeIds: ['e1']
};

describe('TaskClockWidgetComponent', () => {
  let fixture: ComponentFixture<TaskClockWidgetComponent>;

  function setup(overrides: Partial<{ task: WorkTask; hasOpenSessionMine: boolean; hasOpenSessionOtherEmployee: boolean; isAssignee: boolean }>) {
    TestBed.configureTestingModule({ imports: [TaskClockWidgetComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskClockWidgetComponent);
    fixture.componentRef.setInput('task', overrides.task ?? baseTask);
    fixture.componentRef.setInput('hasOpenSessionMine', overrides.hasOpenSessionMine ?? false);
    fixture.componentRef.setInput('hasOpenSessionOtherEmployee', overrides.hasOpenSessionOtherEmployee ?? false);
    fixture.componentRef.setInput('isAssignee', overrides.isAssignee ?? true);
    fixture.detectChanges();
  }

  it('shows an enabled Clock In button when the caller is an assignee with no open session and the task is not locked', () => {
    setup({});
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]');
    expect(btn.disabled).toBe(false);
  });

  it('disables Clock In when the task is locked at 100%', () => {
    setup({ task: { ...baseTask, progressPercent: 100 } });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]');
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('complete');
  });

  it('disables Clock In when someone else has an open session on this task', () => {
    setup({ hasOpenSessionOtherEmployee: true });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]');
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('in progress');
  });

  it('disables Clock In when the caller is not an assignee', () => {
    setup({ isAssignee: false });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]');
    expect(btn.disabled).toBe(true);
  });

  it('shows a Push button instead of Clock In when the caller has an open session', () => {
    setup({ hasOpenSessionMine: true });
    expect(fixture.nativeElement.querySelector('[data-testid="clock-in-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="push-button"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement the skeleton (Clock In/Push button switching + disabled-state logic only — the
  push popup and API calls are Task 2)**

```typescript
import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { WorkTask } from '../../models/task.model';
import { TaskApiService } from '../../data-access/task-api.service';
import { toWorkTask } from '../../utils/task.mapper';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-task-clock-widget',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (hasOpenSessionMine()) {
      <button data-testid="push-button" type="button" class="task-clock-widget__button" (click)="openPushPopup()">
        Push
      </button>
    } @else {
      <button
        data-testid="clock-in-button"
        type="button"
        class="task-clock-widget__button"
        [disabled]="clockInDisabled()"
        [title]="clockInDisabledReason()"
        (click)="onClockIn()"
      >
        Clock In
      </button>
    }
  `,
  styles: [`
    .task-clock-widget__button {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 12px;
      background: var(--color-surface);
      color: var(--color-text-primary);
    }
    .task-clock-widget__button:disabled { opacity: 0.5; cursor: not-allowed; }
  `]
})
export class TaskClockWidgetComponent {
  private readonly taskApi = inject(TaskApiService);

  task = input.required<WorkTask>();
  hasOpenSessionMine = input(false);
  hasOpenSessionOtherEmployee = input(false);
  isAssignee = input.required<boolean>();
  clockedIn = output<void>();
  pushed = output<WorkTask>();

  isLockedAt100 = computed(() => this.task().progressPercent === 100);

  clockInDisabled = computed(() =>
    this.isLockedAt100() || this.hasOpenSessionOtherEmployee() || !this.isAssignee());

  clockInDisabledReason = computed(() => {
    if (this.isLockedAt100()) return 'This task is complete - reduce its percentage before clocking in again.';
    if (this.hasOpenSessionOtherEmployee()) return 'Another teammate has this task in progress.';
    if (!this.isAssignee()) return 'Only an assignee of this task can clock in.';
    return '';
  });

  async onClockIn(): Promise<void> {
    await firstValueFrom(this.taskApi.clockIn(this.task().id));
    this.clockedIn.emit();
  }

  openPushPopup(): void {
    // Task 2 of this Part implements the popup itself.
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass; then Step 5: commit**

Run: `npm test -- --include='**/task-clock-widget.component.spec.ts'`

```bash
git add src/app/modules/work/ui/task-clock-widget/
git commit -m "feat(work): add TaskClockWidget skeleton with Clock In and disabled-state logic"
```

---

### Task 2: The Push popup — percent entry, client-side validation, submit

**Files:**
- Modify: `src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.ts`
- Modify: `src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.spec.ts`

**Interfaces:**
- Produces: on successful Push, `pushed` emits the updated `WorkTask`; on a validation failure, the popup
  stays open showing an inline error, no HTTP call is made.

- [ ] **Step 1: Write the failing tests**

```typescript
it('opens the push popup showing the current percent for reference', () => {
  setup({ hasOpenSessionMine: true, task: { ...baseTask, progressPercent: 30 } });
  fixture.nativeElement.querySelector('[data-testid="push-button"]').click();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="push-current-percent"]').textContent).toContain('30');
});

it('blocks submission client-side when entered percent is not greater than current', async () => {
  setup({ hasOpenSessionMine: true, task: { ...baseTask, progressPercent: 30 } });
  fixture.nativeElement.querySelector('[data-testid="push-button"]').click();
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('[data-testid="push-percent-input"]');
  input.value = '30';
  input.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  fixture.nativeElement.querySelector('[data-testid="push-submit-button"]').click();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="push-error"]').textContent).toContain('greater than');
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

Add signals and the popup template:

```typescript
  pushPopupOpen = signal(false);
  pushPercent = signal<number | null>(null);
  pushReason = signal('');
  pushError = signal<string | null>(null);
  pushSubmitting = signal(false);
```

```typescript
  openPushPopup(): void {
    this.pushPopupOpen.set(true);
    this.pushPercent.set(null);
    this.pushReason.set('');
    this.pushError.set(null);
  }

  closePushPopup(): void {
    this.pushPopupOpen.set(false);
  }

  async submitPush(): Promise<void> {
    const percent = this.pushPercent();
    const current = this.task().progressPercent;
    if (percent === null || percent <= current) {
      this.pushError.set(`Percent must be greater than the current progress (${current}%).`);
      return;
    }
    this.pushSubmitting.set(true);
    this.pushError.set(null);
    try {
      const dto = await firstValueFrom(this.taskApi.push(this.task().id, { percent, reason: this.pushReason() || undefined }));
      this.pushed.emit(toWorkTask(dto));
      this.pushPopupOpen.set(false);
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.pushError.set(detail || 'Failed to push.');
    } finally {
      this.pushSubmitting.set(false);
    }
  }
```

Add to the template, inside the `@if (hasOpenSessionMine())` branch, after the Push button:

```typescript
      @if (pushPopupOpen()) {
        <div class="task-clock-widget__popup">
          <p data-testid="push-current-percent">Current: {{ task().progressPercent }}%</p>
          <input
            data-testid="push-percent-input"
            type="number"
            min="0"
            max="100"
            (input)="pushPercent.set($any($event.target).value === '' ? null : Number($any($event.target).value))"
          />
          <input
            data-testid="push-reason-input"
            type="text"
            placeholder="Optional note"
            (input)="pushReason.set($any($event.target).value)"
          />
          @if (pushError()) {
            <p data-testid="push-error" role="alert">{{ pushError() }}</p>
          }
          <div>
            <button data-testid="push-submit-button" type="button" [disabled]="pushSubmitting()" (click)="submitPush()">Submit</button>
            <button type="button" (click)="closePushPopup()">Cancel</button>
          </div>
        </div>
      }
```

- [ ] **Step 4: Run the tests to verify they pass; then Step 5: commit**

Run: `npm test -- --include='**/task-clock-widget.component.spec.ts'`
Expected: PASS, all tests from both Tasks in this Part.

```bash
git add src/app/modules/work/ui/task-clock-widget/
git commit -m "feat(work): add Push popup with client-side percent validation"
```

---

## Self-review checklist for this Part

- [ ] `clockInDisabledReason()` never returns an empty string while the button is actually disabled — every
  disabled branch in `clockInDisabled()` has a matching non-empty message in
  `clockInDisabledReason()` (4 conditions each, in the same order).
- [ ] The Push popup never calls the API when client-side validation fails — confirmed by Task 2's second
  test asserting no unexpected `HttpTestingController` request (if using `HttpClientTestingModule`,
  consider adding `httpMock.verify()` in an `afterEach` to catch this automatically).
- [ ] This Part's component is not yet imported by `TaskCardComponent`, `TaskTableComponent`, or
  `MyTaskComponent` — that's Part 6 (Board/Backlog) and Part 5 (My Task). Confirm with `git grep -n
  "TaskClockWidgetComponent"` that only this Part's own files reference it so far.
