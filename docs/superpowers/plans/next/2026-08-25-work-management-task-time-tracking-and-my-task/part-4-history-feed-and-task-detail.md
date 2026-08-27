# Part 4: `TaskHistoryFeedComponent`, and wiring history + clock widget + percent/reason edit into `TaskDetailModalComponent`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the history feed component, then extend `TaskDetailModalComponent` (read in full during
planning — its current structure is reproduced in the Architecture section below) to: render the history
feed, render the clock widget for assignees, and let the edit form set `progressPercent`/`reason`.

**Spec:** design spec §4 (`ui/task-history-feed/`), §3/§4 (`task-detail-modal.component.ts` additions)

**Depends on:** Part 2 (`TaskApiService.getTaskHistory`, extended edit DTOs), Part 3 (`TaskClockWidgetComponent`).

## Architecture & Conventions

- `TaskDetailModalComponent`'s current `submit()` branches on `isObjectiveOwner()`: true → `editTask(...)`
  (direct, immediate); false → `createTaskEditRequest(...)` (queued for approval). **This Part's
  `progressPercent`/`reason` fields flow through both branches identically** — no special-casing needed,
  since Part 2 of the backend plan already extended both `EditTaskCommand` and
  `CreateTaskEditRequestCommand` symmetrically.
- The component currently has no concept of "is the caller an assignee" — it only knows
  `isObjectiveOwner()`. The clock widget's `isAssignee` input needs a new computed value comparing the
  current employee's id against `task().assigneeEmployeeIds` — check how this component's caller
  (`TaskBoardComponent`/`TaskBacklogComponent`) currently determines `isObjectiveOwner` (an input they
  compute externally, e.g. `objectiveOwners()[selectedTask()!.objectiveId]`) and follow the same
  externally-computed-input pattern for a new `isAssignee` input, rather than injecting an employee-id
  service directly into this modal (keeps the modal a pure presentational consumer of inputs, matching its
  existing style).
- History and clock-widget state (open sessions) require fresh data on every open — reuse this component's
  existing `effect()` that already re-seeds the form whenever `open()`/`task()` change (see the two
  `effect()` blocks already in the constructor) rather than adding a third, separate lifecycle hook.

## Global Constraints

- The history feed section renders for **every** viewer (not gated on `isObjectiveOwner()`), per spec §6 —
  this is the one section of the modal that is NOT owner-gated, unlike the edit form fields below it (which
  already differ by owner via the existing `submit()` branch).
- Empty history state: "No changes yet", never a blank section.

---

### Task 1: `TaskHistoryFeedComponent`

**Files:**
- Create: `src/app/modules/work/ui/task-history-feed/task-history-feed.component.ts`
- Test: `src/app/modules/work/ui/task-history-feed/task-history-feed.component.spec.ts`

**Interfaces:**
- Produces: `TaskHistoryFeedComponent` with input `entries: input.required<TaskHistoryEntryDto[]>`, output
  `reasonAdded: output<{ kind: 'session' | 'percentage'; id: string; reason: string }>` (bubbles up to the
  parent modal, which calls `TaskApiService.addClockingSessionReason`/`.addPercentageLogReason` and
  refetches — this component does not call the API itself, matching `task-clock-widget`'s pattern of
  emitting outcomes rather than owning the whole round trip... **except** `task-clock-widget` *does* call
  the API directly per Part 3. Reconcile before implementing: **this component calls the API directly too**,
  matching Part 3's precedent more closely than a pure-presentational alternative — inject `TaskApiService`
  here as well, and emit a `reasonSaved: output<void>` purely so the parent can know to refetch history,
  not so the parent makes the call).

- [ ] **Step 1: Write the failing tests**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TaskHistoryFeedComponent } from './task-history-feed.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

describe('TaskHistoryFeedComponent', () => {
  let fixture: ComponentFixture<TaskHistoryFeedComponent>;

  function setup(entries: TaskHistoryEntryDto[]) {
    TestBed.configureTestingModule({ imports: [TaskHistoryFeedComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskHistoryFeedComponent);
    fixture.componentRef.setInput('entries', entries);
    fixture.detectChanges();
  }

  it('shows an empty state when there are no entries', () => {
    setup([]);
    expect(fixture.nativeElement.textContent).toContain('No changes yet');
  });

  it('renders one row per entry, in the given order', () => {
    setup([
      { type: 'edit', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: { logId: 'l1', source: 'direct', editRequestId: null, oldValuesJson: '{}', newValuesJson: '{"title":"New"}', reason: null }, statusChange: null, clockSession: null, percentageChange: null },
      { type: 'clock_session', occurredAt: '2026-08-25T11:00:00Z', employeeId: 'e2', employeeName: 'Sam', edit: null, statusChange: null, clockSession: { sessionId: 's1', clockInAt: '2026-08-25T10:30:00Z', clockOutAt: '2026-08-25T11:00:00Z', durationMinutes: 30, sessionReason: null, pushedPercent: 40, previousPercent: 10, percentageLogId: 'p1', percentageReason: null }, percentageChange: null }
    ]);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="history-entry"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Alex');
    expect(rows[1].textContent).toContain('Sam');
    expect(rows[1].textContent).toContain('40');
  });

  it('shows an add-note affordance on a percentage entry missing a reason', () => {
    setup([
      { type: 'percentage_change', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: null, statusChange: null, clockSession: null, percentageChange: { logId: 'p1', previousPercent: 40, newPercent: 20, source: 'manual_edit', reason: null } }
    ]);
    expect(fixture.nativeElement.querySelector('[data-testid="add-note-p1"]')).toBeTruthy();
  });

  it('does not show the add-note affordance when a reason is already present', () => {
    setup([
      { type: 'percentage_change', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: null, statusChange: null, clockSession: null, percentageChange: { logId: 'p1', previousPercent: 40, newPercent: 20, source: 'manual_edit', reason: 'already explained' } }
    ]);
    expect(fixture.nativeElement.querySelector('[data-testid="add-note-p1"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('already explained');
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

```typescript
import { Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

@Component({
  selector: 'app-task-history-feed',
  standalone: true,
  template: `
    @if (entries().length === 0) {
      <p class="task-history-feed__empty">No changes yet</p>
    } @else {
      <ul class="task-history-feed__list">
        @for (entry of entries(); track entry.occurredAt + entry.type + (entry.edit?.logId ?? entry.statusChange?.fromStatusId ?? entry.clockSession?.sessionId ?? entry.percentageChange?.logId ?? '')) {
          <li data-testid="history-entry" class="task-history-feed__entry">
            <span class="task-history-feed__actor">{{ entry.employeeName }}</span>
            <span class="task-history-feed__summary">{{ summaryFor(entry) }}</span>
            @if (entry.type === 'clock_session' && entry.clockSession; as cs) {
              @if (cs.percentageReason) {
                <p class="task-history-feed__note">{{ cs.percentageReason }}</p>
              } @else if (cs.percentageLogId) {
                <button [attr.data-testid]="'add-note-' + cs.percentageLogId" type="button" (click)="addNote('percentage', cs.percentageLogId)">
                  Add a note
                </button>
              }
            }
            @if (entry.type === 'percentage_change' && entry.percentageChange; as pc) {
              @if (pc.reason) {
                <p class="task-history-feed__note">{{ pc.reason }}</p>
              } @else {
                <button [attr.data-testid]="'add-note-' + pc.logId" type="button" (click)="addNote('percentage', pc.logId)">
                  Add a note
                </button>
              }
            }
          </li>
        }
      </ul>
    }
  `,
  styles: [`
    .task-history-feed__empty { color: var(--color-text-secondary); font-size: 13px; }
    .task-history-feed__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .task-history-feed__entry { font-size: 13px; border-bottom: 1px solid var(--color-border); padding-bottom: 6px; }
    .task-history-feed__actor { font-weight: 600; margin-right: 6px; }
    .task-history-feed__note { color: var(--color-text-secondary); margin: 2px 0 0; }
  `]
})
export class TaskHistoryFeedComponent {
  private readonly taskApi = inject(TaskApiService);

  entries = input.required<TaskHistoryEntryDto[]>();
  reasonSaved = output<void>();

  summaryFor(entry: TaskHistoryEntryDto): string {
    switch (entry.type) {
      case 'edit':
        return 'edited this task';
      case 'status_change':
        return 'moved the status';
      case 'clock_session': {
        const cs = entry.clockSession!;
        const duration = cs.durationMinutes !== null ? `${cs.durationMinutes} min` : 'in progress';
        const percent = cs.pushedPercent !== null ? `, pushed to ${cs.pushedPercent}%` : '';
        return `clocked in (${duration}${percent})`;
      }
      case 'percentage_change': {
        const pc = entry.percentageChange!;
        return `changed progress from ${pc.previousPercent}% to ${pc.newPercent}%`;
      }
    }
  }

  async addNote(kind: 'session' | 'percentage', id: string): Promise<void> {
    const reason = window.prompt('Add a note:');
    if (!reason) return;
    if (kind === 'session') {
      await firstValueFrom(this.taskApi.addClockingSessionReason(id, reason));
    } else {
      await firstValueFrom(this.taskApi.addPercentageLogReason(id, reason));
    }
    this.reasonSaved.emit();
  }
}
```

**`window.prompt` is a placeholder interaction, not a final design** — flag this to the user/reviewer
explicitly rather than silently shipping it: a real inline text input matching this app's existing input
styling (`InputComponent`) is the better long-term UX, but a native prompt is a legitimate, testable,
zero-new-component way to satisfy "addable after the fact" for this first version. If asked to polish this
during review, replace with an inline `InputComponent` + small submit button, not a redesign of the whole
feed.

- [ ] **Step 4: Run the tests to verify they pass; then Step 5: commit**

Run: `npm test -- --include='**/task-history-feed.component.spec.ts'`

```bash
git add src/app/modules/work/ui/task-history-feed/
git commit -m "feat(work): add TaskHistoryFeedComponent"
```

---

### Task 2: Wire history feed, clock widget, and progressPercent/reason into `TaskDetailModalComponent`

**Files:**
- Modify: `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.ts`
- Modify: `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.spec.ts`
- Modify: every caller of `<app-task-detail-modal>` to pass the new `isAssignee` input — at minimum
  `task-board.component.ts` and `task-backlog.component.ts` (grep `app-task-detail-modal` across the repo
  to find every call site, do not assume only these two).

**Interfaces:**
- Consumes: `TaskHistoryFeedComponent` (Task 1), `TaskClockWidgetComponent` (Part 3),
  `TaskApiService.getTaskHistory` (Part 2).
- Produces: `TaskDetailModalComponent` gains a new required input `isAssignee: input.required<boolean>`,
  fetches and displays history on open, includes the clock widget when `isAssignee()` is true, and its edit
  form's `submit()` includes `progressPercent`/`reason` in the payload sent to both `editTask`/
  `createTaskEditRequest`.

- [ ] **Step 1: Write the failing tests**

Read `task-detail-modal.component.spec.ts` in full first. Add:

```typescript
it('fetches and displays history when opened', async () => {
  taskApiSpy.getTaskHistory.and.returnValue(of([
    { type: 'edit', occurredAt: '2026-08-25T10:00:00Z', employeeId: 'e1', employeeName: 'Alex', edit: { logId: 'l1', source: 'direct', editRequestId: null, oldValuesJson: '{}', newValuesJson: '{}', reason: null }, statusChange: null, clockSession: null, percentageChange: null }
  ]));
  fixture.componentRef.setInput('task', baseTask);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('app-task-history-feed')).toBeTruthy();
});

it('shows the clock widget when the caller is an assignee', () => {
  fixture.componentRef.setInput('task', baseTask);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('isAssignee', true);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeTruthy();
});

it('hides the clock widget when the caller is not an assignee', () => {
  fixture.componentRef.setInput('task', baseTask);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('isAssignee', false);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeNull();
});

it('includes progressPercent and reason in the direct-edit payload', async () => {
  fixture.componentRef.setInput('task', baseTask);
  fixture.componentRef.setInput('isObjectiveOwner', true);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  component.progressPercent.set(75);
  component.reason.set('caught up over the weekend');
  await component.submit(baseTask.id);
  expect(taskApiSpy.editTask).toHaveBeenCalledWith(baseTask.id, jasmine.objectContaining({ progressPercent: 75, reason: 'caught up over the weekend' }));
});
```

**Note on test scaffolding:** `taskApiSpy`, `baseTask`, `fixture`, `component` follow whatever setup the
existing spec file already establishes in its `beforeEach` — extend that, do not duplicate it.

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Implement**

Add the new input and two new signals:

```typescript
  isAssignee = input.required<boolean>();
  progressPercent = signal<number | null>(null);
  reason = signal('');
  history = signal<TaskHistoryEntryDto[]>([]);
```

Extend the form-reseed `effect()` (the second one in the existing constructor) to also seed
`progressPercent`:

```typescript
        this.statusId.set(t.statusId);
        this.progressPercent.set(t.progressPercent);
```

and in its `else` branch:

```typescript
        this.statusId.set('');
        this.progressPercent.set(null);
        this.reason.set('');
```

Add a third `effect()` alongside the existing two, to load history whenever the modal opens for a task:

```typescript
    effect(() => {
      const t = this.task();
      if (this.open() && t) void this.loadHistory(t.id);
    });
```

```typescript
  private async loadHistory(taskId: string): Promise<void> {
    this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(taskId)));
  }

  async onReasonSaved(): Promise<void> {
    const t = this.task();
    if (t) await this.loadHistory(t.id);
  }
```

Update `submit()`'s `fields` object to include the two new values:

```typescript
    const fields = {
      title: this.title().trim(),
      description: this.description() || undefined,
      priority: this.priority(),
      dueDate: this.dueDate() || undefined,
      estimatedHours: this.estimatedHours() ?? undefined,
      storyPoints: this.storyPoints() ?? undefined,
      progressPercent: this.progressPercent() ?? undefined,
      reason: this.reason().trim() || undefined
    };
```

Add to the template, a Progress input near the existing `dl.task-detail__grid` (which currently shows
Progress read-only — make it editable, matching this form's existing `app-input` pattern for other numeric
fields like Estimated hours):

```typescript
          <app-input label="Progress %" type="number" [value]="progressPercentDisplay()" (valueChange)="onProgressPercentChange($event)" />
          <app-input label="Reason (optional)" [value]="reason()" (valueChange)="reason.set($event)" />
```

Remove the old read-only `<dt>Progress</dt><dd>{{ t.progressPercent }}%</dd>` row from `task-detail__grid`
(it's now editable above, showing it twice would be redundant/confusing).

Add the two helper methods:

```typescript
  progressPercentDisplay(): string {
    return this.progressPercent() == null ? '' : String(this.progressPercent());
  }

  onProgressPercentChange(value: string): void {
    this.progressPercent.set(value === '' ? null : Number(value));
  }
```

Add to the template, after the existing form fields and before the Cancel/Save button row:

```typescript
          <app-task-history-feed [entries]="history()" (reasonSaved)="onReasonSaved()" />

          @if (isAssignee()) {
            <app-task-clock-widget
              [task]="t"
              [isAssignee]="isAssignee()"
              [hasOpenSessionMine]="hasOpenSessionMine()"
              [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
              (clockedIn)="onReasonSaved()"
              (pushed)="onTaskPushed($event)"
            />
          }
```

**`hasOpenSessionMine()`/`hasOpenSessionOtherEmployee()` need a data source** — this modal doesn't
currently track open clocking sessions. Derive them from `history()` once loaded: an entry with `type ===
'clock_session'` and `clockSession.clockOutAt === null` is the open one, if any; compare its `employeeId`
against the current employee's id (this modal doesn't currently know the current employee's id either —
add a new required input `currentEmployeeId: input.required<string>()` alongside `isAssignee`, and update
every call site to pass it, matching how `isAssignee` itself needs a new call-site value). Implement as
computed signals:

```typescript
  private openSessionEntry = computed(() => this.history().find(e => e.type === 'clock_session' && e.clockSession?.clockOutAt === null) ?? null);
  hasOpenSessionMine = computed(() => this.openSessionEntry()?.employeeId === this.currentEmployeeId());
  hasOpenSessionOtherEmployee = computed(() => {
    const entry = this.openSessionEntry();
    return entry !== null && entry.employeeId !== this.currentEmployeeId();
  });
  currentEmployeeId = input.required<string>();
```

Add `onTaskPushed`:

```typescript
  async onTaskPushed(updated: WorkTask): Promise<void> {
    this.saved.emit(updated);
    await this.loadHistory(updated.id);
  }
```

Add the two new imports (`TaskHistoryFeedComponent`, `TaskClockWidgetComponent`,
`TaskHistoryEntryDto`) and register both components in the `imports` array of the `@Component` decorator.

- [ ] **Step 4: Update every call site to pass `isAssignee`/`currentEmployeeId`**

For each `<app-task-detail-modal>` usage found via grep, add the two new bindings. For
`task-board.component.ts`/`task-backlog.component.ts`, compute `isAssignee` the same way
`objectiveOwners()[selectedTask()!.objectiveId]` is already computed for `isObjectiveOwner` — a
`computed()` checking `selectedTask()?.assigneeEmployeeIds.includes(currentEmployeeId)`. Both components
need access to the current employee's id — check `EmployeeDirectoryStore`/`ProjectDetailStore` (already
injected in `TaskBoardComponent`, per the file read during planning) for whichever already exposes it
rather than adding a new lookup.

- [ ] **Step 5: Run all affected tests**

Run: `npm test -- --include='**/task-detail-modal.component.spec.ts' --include='**/task-board.component.spec.ts' --include='**/task-backlog.component.spec.ts'`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/ui/task-detail-modal/ src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts
git commit -m "feat(work): wire history feed, clock widget, and progress-percent editing into the task detail modal"
```

---

## Self-review checklist for this Part

- [ ] The old read-only `Progress` row in `task-detail__grid` is gone (replaced by the editable input) —
  grep the file for `t.progressPercent` in the template and confirm it appears only inside
  `progressPercentDisplay()`'s call site, not as a leftover duplicate display.
- [ ] Every call site of `<app-task-detail-modal>` in the repo passes both new required inputs — a missing
  required signal input is a compile-time template-type error in this Angular version, so `ng build`
  failing here is the fast way to find any missed call site.
- [ ] The history feed renders regardless of `isObjectiveOwner()` — confirmed by no `@if
  (isObjectiveOwner())` wrapping `<app-task-history-feed>` in the template diff.
