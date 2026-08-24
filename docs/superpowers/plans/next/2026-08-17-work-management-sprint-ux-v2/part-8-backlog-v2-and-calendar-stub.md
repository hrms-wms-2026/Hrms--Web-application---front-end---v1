# Work Management — Backlog v2 & Calendar Stub (Part 8 of 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Depends on Part 7** (the task-detail popup this plan wires into must already be always-editable).

**Goal:** Replace Backlog's Part-4 sidebar-list-plus-separate-table layout with expandable sprint tabs
(click a sprint → expands inline to show its tasks; a `+` in the corner opens task-create scoped to
it). Add the Calendar sub-menu tab and route as a content-less stub.

**Tech Stack:** Angular (standalone components, signals).

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-work-management-sprint-ux-v2-design.md`

## Global Constraints

- Work Management module only.
- This **replaces** `SprintListComponent`'s usage in `TaskBacklogComponent` — the component itself
  can stay in the codebase if some other page still uses it (check first via
  `grep -rln "app-sprint-list" src/app/modules/work`), but `TaskBacklogComponent` stops using it.
- Nothing above/around the sub-menu tab bar changes; existing theme tokens only.
- Fixes the known UX gap from Part 4's E2E check (sprint dropdown not refreshing after create) as a
  side effect of this redesign's single-source data flow — verify that specifically in this part's
  manual check, don't just assume the redesign fixed it.

---

### Task 1: `SprintTabComponent` (one expandable row)

**Files:**
- Create: `src/app/modules/work/ui/sprint-tab/sprint-tab.component.ts`
- Create: `src/app/modules/work/ui/sprint-tab/sprint-tab.component.spec.ts`

**Interfaces:**
- Produces: `SprintTabComponent { sprint: input.required<Sprint>, isObjectiveOwner: input.required<boolean>, tasks: input.required<readonly WorkTask[]>, statusNames: input.required<Record<string,string>>, expanded: input(false), toggled: output<void>, editRequested: output<void>, statusChangeRequested: output<string>, createTaskRequested: output<void>, taskViewed: output<WorkTask> }`.

- [ ] **Step 1: Write the failing test**

```typescript
  it('shows Edit button only for the owner', () => { /* render with isObjectiveOwner=true/false, assert button presence */ });
  it('status is a dropdown for the owner, plain text for a member', () => { /* assert <select> vs plain span */ });
  it('clicking Expand toggles the expanded output/state and reveals the task list', () => { /* click, assert toggled emitted and task rows visible when expanded=true */ });
  it('the + button emits createTaskRequested only when expanded', () => { /* assert + is absent or emits nothing when collapsed */ });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/sprint-tab.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```typescript
import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskTableComponent } from '../task-table/task-table.component';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-sprint-tab',
  standalone: true,
  imports: [DatePipe, ButtonComponent, TaskTableComponent],
  template: `
    <div class="sprint-tab">
      <div class="sprint-tab__header">
        <button type="button" class="sprint-tab__expand" (click)="toggled.emit()" [attr.aria-expanded]="expanded()">
          {{ expanded() ? '▾' : '▸' }} {{ sprint().name }}
        </button>
        <span class="sprint-tab__dates">{{ sprint().startDate | date: 'MMM d' }} – {{ sprint().endDate | date: 'MMM d' }}</span>

        @if (isObjectiveOwner()) {
          <select class="sprint-tab__status-select" [value]="sprint().status" (change)="statusChangeRequested.emit($any($event.target).value)">
            <option value="future">Future</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
            <option value="achieved">Achieved</option>
          </select>
          <app-button variant="secondary" (pressed)="editRequested.emit()">Edit</app-button>
        } @else {
          <span class="sprint-tab__status-text" [attr.data-status]="sprint().status">{{ sprint().status }}</span>
        }
      </div>

      @if (expanded()) {
        <div class="sprint-tab__body">
          <div class="sprint-tab__body-toolbar">
            <button type="button" class="sprint-tab__add-task" aria-label="Add task to this sprint" (click)="createTaskRequested.emit()">+</button>
          </div>
          <app-task-table [tasks]="tasks()" [statusNames]="statusNames()" (viewed)="taskViewed.emit($event)" />
        </div>
      }
    </div>
  `,
  styles: [`
    .sprint-tab { border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: 8px; overflow: hidden; }
    .sprint-tab__header { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--color-surface); }
    .sprint-tab__expand { flex: 1; text-align: left; background: none; border: none; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
    .sprint-tab__dates { font-size: 11px; color: var(--color-text-secondary); }
    .sprint-tab__status-select { border: 1px solid var(--color-border); border-radius: 6px; padding: 4px 6px; background: var(--color-surface); color: var(--color-text-primary); font-size: 12px; }
    .sprint-tab__status-text { font-size: 12px; color: var(--color-text-secondary); text-transform: capitalize; }
    .sprint-tab__body { border-top: 1px solid var(--color-border); padding: 8px 12px; }
    .sprint-tab__body-toolbar { display: flex; justify-content: flex-end; margin-bottom: 6px; }
    .sprint-tab__add-task { width: 24px; height: 24px; border-radius: 999px; border: 1px solid var(--color-border); background: var(--color-surface); color: var(--color-text-primary); cursor: pointer; font-size: 14px; line-height: 1; }
  `]
})
export class SprintTabComponent {
  sprint = input.required<Sprint>();
  isObjectiveOwner = input.required<boolean>();
  tasks = input.required<readonly WorkTask[]>();
  statusNames = input.required<Record<string, string>>();
  expanded = input(false);

  toggled = output<void>();
  editRequested = output<void>();
  statusChangeRequested = output<string>();
  createTaskRequested = output<void>();
  taskViewed = output<WorkTask>();
}
```

Note: `statusChangeRequested` lets the owner change a sprint's status directly from the dropdown — the
spec's screenshot shows a status dropdown but Sprint Foundation's backend only exposes `Complete`/
`Achieve` as explicit actions (not a generic "set to any status" endpoint — `Future`→`Active` and
`Active`→`Incomplete` are date-driven, not owner-settable). **Wire this dropdown's change handler to
call `SprintApiService.complete`/`.achieve` only for those two reachable target values**; if the owner
picks `Future`/`Active`/`Incomplete` directly, show a validation message explaining those are
automatic, not owner-settable, rather than calling a non-existent endpoint. Implement this mapping in
`TaskBacklogComponent`'s `statusChangeRequested` handler (Task 2 below), not inside `SprintTabComponent`
itself, so the dumb presentational component stays free of that business rule.

- [ ] **Step 4: Run to verify all pass, then commit**

Run: `npx ng test --watch=false --include='**/sprint-tab.component.spec.ts'`
Expected: PASS.

```bash
git add src/app/modules/work/ui/sprint-tab/
git commit -m "feat(work): SprintTabComponent - expandable sprint row with inline task list"
```

---

### Task 2: Rebuild `TaskBacklogComponent` around `SprintTabComponent`

**Files:**
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
  it('renders one SprintTabComponent per sprint, owner sees all statuses, member sees active-only', () => { /* two variants of the fixture */ });
  it('expanding a sprint shows only that sprint\'s tasks', () => { /* filter by sprintId, assert other sprints\' tasks absent */ });
  it('the sprint create-task + button opens the create modal with sprintId pre-filled and the dropdown hidden', () => { /* assert modal input bindings */ });
  it('creating a sprint immediately reflects in this component\'s own sprint list and the create-task modal\'s dropdown, without a page reload', () => { /* the Part-4 UX-gap regression check */ });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include='**/task-backlog.component.spec.ts'`
Expected: FAIL — current component still uses `SprintListComponent`.

- [ ] **Step 3: Implement**

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { SprintListStore } from '../../state/sprint-list.store';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { WorkTask } from '../../models/task.model';

@Component({
  selector: 'app-task-backlog',
  standalone: true,
  imports: [TaskCreateModalComponent, TaskDetailModalComponent, SprintTabComponent, ButtonComponent],
  template: `
    <div class="task-backlog__toolbar">
      <app-button variant="primary" (pressed)="createSprintOpen.set(true)">Create Sprint</app-button>
    </div>

    @if (store.loading() || sprintStore.loading()) {
      <p>Loading…</p>
    } @else {
      @for (sprint of sprintStore.sprints(); track sprint.id) {
        <app-sprint-tab
          [sprint]="sprint"
          [isObjectiveOwner]="isObjectiveOwner()"
          [tasks]="tasksForSprint(sprint.id)"
          [statusNames]="statusNames()"
          [expanded]="expandedSprintId() === sprint.id"
          (toggled)="toggleExpanded(sprint.id)"
          (statusChangeRequested)="onStatusChangeRequested(sprint.id, $event)"
          (createTaskRequested)="onCreateTaskForSprint(sprint.id)"
          (taskViewed)="onTaskViewed($event)"
        />
      }
    }

    @if (milestoneId()) {
      <app-task-create-modal
        [open]="createOpen()"
        [objectiveId]="milestoneId()!"
        [isObjectiveOwner]="isObjectiveOwner()"
        [activeSprints]="createModalSprints()"
        [assignableMembers]="assignableMembers()"
        (closed)="createOpen.set(false)"
        (created)="onTaskCreated()"
      />
      <app-task-detail-modal [open]="detailOpen()" [task]="selectedTask()" [isObjectiveOwner]="isObjectiveOwner()" (closed)="detailOpen.set(false)" (saved)="reloadTasks()" (requested)="detailOpen.set(false)" />
    }
  `,
  styles: [`
    .task-backlog__toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; }
  `]
})
export class TaskBacklogComponent implements OnInit {
  protected readonly store = inject(TaskBoardStore);
  protected readonly sprintStore = inject(SprintListStore);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly sprintApi = inject(SprintApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly createOpen = signal(false);
  protected readonly createSprintOpen = signal(false);
  protected readonly detailOpen = signal(false);
  protected readonly selectedTask = signal<WorkTask | null>(null);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly isObjectiveOwner = signal(false);
  protected readonly expandedSprintId = signal<string | null>(null);
  protected readonly createForSprintId = signal<string | null>(null);
  protected readonly assignableMembers = signal<{ employeeId: string; name: string }[]>([]);

  protected readonly statusNames = computed(() => Object.fromEntries(this.store.statuses().map((s) => [s.id, s.name])));
  protected readonly createModalSprints = computed(() =>
    this.createForSprintId() ? this.sprintStore.sprints().filter((s) => s.id === this.createForSprintId()) : this.sprintStore.sprints()
  );

  ngOnInit(): void {
    const id = this.route.parent?.snapshot.paramMap.get('milestoneId') ?? null;
    this.milestoneId.set(id);
    if (!id) return;

    const fromList = this.projectStore.milestones().find((m) => m.objectiveId === id);
    this.isObjectiveOwner.set(fromList?.isOwner ?? false);
    void this.store.loadBoard(id);
    void this.sprintStore.load(id, !this.isObjectiveOwner());

    if (!fromList) {
      void this.projectStore.getMilestoneDetail(id).then((detail) => {
        if (detail) this.isObjectiveOwner.set(detail.isOwner);
      });
    }
  }

  tasksForSprint(sprintId: string): WorkTask[] {
    return this.store.tasks().filter((t) => t.sprintId === sprintId);
  }

  toggleExpanded(sprintId: string): void {
    this.expandedSprintId.set(this.expandedSprintId() === sprintId ? null : sprintId);
  }

  onCreateTaskForSprint(sprintId: string): void {
    this.createForSprintId.set(sprintId);
    this.createOpen.set(true);
  }

  onTaskCreated(): void {
    this.createOpen.set(false);
    this.createForSprintId.set(null);
    void this.reloadTasks();
  }

  async reloadTasks(): Promise<void> {
    const id = this.milestoneId();
    if (id) await this.store.loadBoard(id);
  }

  onTaskViewed(task: WorkTask): void {
    this.selectedTask.set(task);
    this.detailOpen.set(true);
  }

  async onStatusChangeRequested(sprintId: string, newStatus: string): Promise<void> {
    const id = this.milestoneId();
    if (!id) return;
    // Only Complete and Achieve are owner-settable actions - Future/Active/Incomplete are date-driven
    // by SprintLifecycleJob (see the note in Part 7's plan doc). Picking anything else here is a
    // no-op with a message, not a call to a non-existent endpoint.
    if (newStatus === 'complete') {
      await this.sprintStore.complete(sprintId, id, !this.isObjectiveOwner());
    } else if (newStatus === 'achieved') {
      await this.sprintStore.achieve(sprintId, id, !this.isObjectiveOwner());
    }
  }
}
```

Note `createSprintOpen`'s modal itself isn't shown here in full — reuse whatever form
`SprintListComponent` (Part 4) already built for sprint creation (its `creating`/`newName`/`newStart`/
`newEnd`/`submitCreate` block), either by extracting it into a small standalone
`SprintCreateFormComponent` this task adds, or by inlining an equivalent block directly in this
template bound to `createSprintOpen` — implementer's choice, but don't duplicate the validation logic,
extract it if copying more than the template markup.

- [ ] **Step 4: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/task-backlog.component.spec.ts'`
Expected: PASS.

- [ ] **Step 5: Full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS. Delete `SprintListComponent`'s spec/usage if nothing else references it after this
change (`grep -rln "app-sprint-list" src/app/modules/work` should return nothing outside its own
files); if truly unused, remove the component files too rather than leaving dead code.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/task-backlog/
git commit -m "feat(work): Backlog v2 - expandable sprint tabs replace the sidebar-list layout"
```

---

### Task 3: Calendar stub tab

**Files:**
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts`
- Modify: `src/app/modules/work/work.routes.ts`

- [ ] **Step 1: Add the tab**

In `BASE_TABS` (or wherever appropriate given the `isOwner`-gated `SETTINGS_TAB` split from Sprint
Foundation Part 3 Task 4), add `{ label: 'Calendar', segment: 'calendar' }` — visible to everyone
(not owner-gated, per the spec), with a matching `@case ('calendar')` SVG icon block following the
existing per-tab icon pattern.

- [ ] **Step 2: Add the route**

In `work.routes.ts`, add, reusing the existing "coming soon" stub component the same way `my-task`/
`list` already do:

```typescript
        { path: 'calendar', loadComponent: () => import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then(m => m.MilestoneComingSoonTabComponent), data: { title: 'Calendar' } }
```

- [ ] **Step 3: Run full frontend regression, then commit**

Run: `npx ng test --watch=false`
Expected: all PASS (check `milestone-sub-menu.component.spec.ts` and `work.routes.spec.ts` for
assertions on the exact tab count/list that may need updating, same as the Settings tab addition
required in Sprint Foundation Part 3).

```bash
git add src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts src/app/modules/work/work.routes.ts
git commit -m "feat(work): Calendar sub-menu tab (stub, no content yet)"
```

---

## End of Part 8 — end of the whole feature

Part 8, and this whole 8-part feature (Sprint Foundation Parts 1-4 + this spec's Parts 5-8), is done
when `npx ng test --watch=false` and the backend's `dotnet test --filter WorkManagement` are both
green, and a full manual browser pass confirms: task-detail popup saves directly as owner / creates a
request as a member, which the owner then sees in Approvals and can approve; Board Structure's drag
reorder persists after reload; Backlog shows expandable sprint tabs with working inline task lists and
per-sprint task creation; the sprint-create-then-modal-refresh gap from Part 4 is actually gone (no
reload needed); and the Calendar tab appears for everyone with its placeholder content, breaking
nothing else in the tab bar.
