# Work Management: Task Create Page + Tree "View" (B3 Phase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.

**Goal:** Move task creation off the modal and onto the same `TaskDetailPageComponent` (route `task/new`, empty form), with context auto-fill from the surface that opened it; delete `task-create-modal`; and add a "View" action to task rows in the tree.

**Architecture:** `TaskDetailPageComponent` gains a `mode` of `'create' | 'edit'`, chosen by a route `data: { mode: 'create' }` on a new `task/new` route sitting before `task/:taskId`. In create mode the page loads modules (`getMyMilestones`), the project's sprints, assignable members and categories itself, reads `?module` / `?sprint` / `?sprintRequired` query params for prefill, and renders a module / category / sprint / assignee picker block plus the shared title/description/priority/due-date/estimated-hours/story-points fields. Submit branches on the selected module's `isOwner`: `TaskBoardStore.createTask` (owner) or `TaskApiService.createTaskCreationRequest` (non-owner), surfaces the `InsufficientAllocationErrorDto` slack hint, then navigates back. The four surfaces' "Create task" buttons become `router.navigate` calls. `task-tree-row` gets a third icon button, "View task", wired through the existing tree outputs to the same page navigation Phase 1 added for edit.

**Tech Stack:** Angular 21 standalone + signals, Angular Router (`data`, `queryParams`), RxJS `firstValueFrom`, Vitest.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B3 — the "Context-aware auto-fill", "Create vs Create Request button-label gating" and "insufficient-allocation slack" bullets. Follows Phase 1 (`2026-08-27-work-management-task-detail-page.md`). Decisions carried from the user 2026-08-27: one component / one page for create + view + edit; module field is **prefilled but still editable** (not locked); explicit submit.

## Global Constraints

- Work Management frontend only: `src/app/modules/work/**`. No backend change (create endpoints already exist). No `.github/**`, `*.yml`/`*.yaml`, Dockerfile, or CI script.
- Never run a dev server. Focused test: `npx ng test --watch=false --include="<spec>"`. Full WM: `npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"`.
- One commit per task. Green before every commit.
- "Module" = UI word for Objective/Milestone; keep code names as the file already has them.
- Router in specs: provide `{ provide: Router, useValue: { navigate: vi.fn() } }` (or an existing stub) — do NOT use `provideRouter([])`, it overrides the `ActivatedRoute` stubs and breaks unrelated tests.

## File Structure

| File | Responsibility |
|---|---|
| `src/app/modules/work/work.routes.ts` (modify) | add `task/new` route (before `task/:taskId`) with `data: { mode: 'create' }` |
| `src/app/modules/work/feature/task-detail-page/task-detail-page.component.ts` (modify) | create-mode template + data loading + submit |
| `src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts` (modify) | create-mode tests |
| `task-board` / `task-backlog` / `milestone-tree-tab` / `my-task` (modify + specs) | "Create task" navigates to `task/new`; remove `<app-task-create-modal>` |
| `src/app/modules/work/ui/task-create-modal/**` | **deleted** in Task 2 |
| `src/app/modules/work/ui/task-tree-row/task-tree-row.component.ts` (+ spec) | "View task" button → new `viewRequested` output |
| `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts` | forward `viewRequested` |
| `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.*` | handle `viewRequested` → navigate |

---

### Task 1: Create mode on `TaskDetailPageComponent`

**Files:**
- Modify: `src/app/modules/work/work.routes.ts`
- Modify: `src/app/modules/work/feature/task-detail-page/task-detail-page.component.ts`
- Modify: `src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts`

**Interfaces:**
- Consumes: `TaskApiService.getCategories`, `.createTaskCreationRequest`, `.assignTask`; `TaskBoardStore.createTask(objectiveId, CreateTaskRequestDto): Promise<WorkTask | InsufficientAllocationErrorDto | null>`; `ProjectApiService.getMyMilestones(projectId): Observable<MyProjectMilestoneDto[]>` (fields `objectiveId`, `title`, `isOwner`); `SprintApiService.getByProject(projectId)` + `toSprint`; `ProjectDetailStore.loadProjectMembers` + `.projectMembers()`; `ActivatedRoute.snapshot.data['mode']`, `.queryParamMap`.
- Produces: `TaskDetailPageComponent` renders create UI when `mode() === 'create'`. `createRequest` shape is `CreateTaskRequestDto` (`{ title, description?, categoryId, priority, dueDate?, estimatedHours?, storyPoints?, sprintId: string | null }`).

- [ ] **Step 1: Failing create-mode tests**

Add to `task-detail-page.component.spec.ts` a second `describe` block (`TaskDetailPageComponent - create mode`) that configures the route with `snapshot.data = { mode: 'create' }`, `snapshot.paramMap.get('taskId')` → `null`, and `snapshot.queryParamMap.get` returning `module`/`sprint`/`sprintRequired` per test. Provide `TaskBoardStore` (`{ createTask: vi.fn(), error: () => null }`), `SprintApiService` (`{ getByProject: vi.fn().mockReturnValue(of([])) }`), `ProjectApiService` (`{ getMyMilestones: vi.fn().mockReturnValue(of([{ objectiveId: 'o1', title: 'Mod 1', isOwner: true }])) }`), and extend the existing `api` stub with `createTaskCreationRequest: vi.fn().mockReturnValue(of({}))` and `assignTask: vi.fn().mockReturnValue(of(undefined))`, `getCategories: vi.fn().mockReturnValue(of([{ id: 'c1', name: 'Feature', displayOrder: 0 }]))`.

```typescript
it('is in create mode with an empty title when the route says so', () => {
  expect(fixture.componentInstance.mode()).toBe('create');
  expect(fixture.componentInstance.title()).toBe('');
});

it('prefills the module from the ?module query param', () => {
  // route queryParamMap.get('module') === 'o1' for this test
  expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
});

it('owner submit calls TaskBoardStore.createTask with the built request and navigates away', async () => {
  const store = TestBed.inject(TaskBoardStore) as any;
  store.createTask.mockResolvedValue({ id: 't-new', objectiveId: 'o1' });
  fixture.componentInstance.title.set('New task');
  fixture.componentInstance.selectedObjectiveId.set('o1');
  fixture.componentInstance.categoryId.set('c1');
  await fixture.componentInstance.submit();
  expect(store.createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'New task', categoryId: 'c1' }));
  expect(TestBed.inject(Router).navigate).toHaveBeenCalled();
});

it('non-owner submit routes through createTaskCreationRequest', async () => {
  (TestBed.inject(ProjectApiService) as any).getMyMilestones.mockReturnValue(of([{ objectiveId: 'o1', title: 'Mod 1', isOwner: false }]));
  // re-create component so the milestones reload...
  // (or set selectedObjectiveId to a module whose isOwner is false in the loaded list)
  fixture.componentInstance.title.set('Ask');
  fixture.componentInstance.selectedObjectiveId.set('o1');
  fixture.componentInstance.categoryId.set('c1');
  await fixture.componentInstance.submit();
  expect(api['createTaskCreationRequest']).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'Ask' }));
});

it('shows the allocation slack hint when createTask returns an InsufficientAllocationErrorDto', async () => {
  const store = TestBed.inject(TaskBoardStore) as any;
  store.createTask.mockResolvedValue({ availableSlackHours: 3, suggestedAction: 'extend_allocation' });
  fixture.componentInstance.title.set('X');
  fixture.componentInstance.selectedObjectiveId.set('o1');
  fixture.componentInstance.categoryId.set('c1');
  await fixture.componentInstance.submit();
  expect(fixture.componentInstance.allocationHint()?.availableSlackHours).toBe(3);
});

it('blocks submit when module or category is missing', async () => {
  fixture.componentInstance.title.set('X');
  await fixture.componentInstance.submit();
  expect((TestBed.inject(TaskBoardStore) as any).createTask).not.toHaveBeenCalled();
  expect(fixture.componentInstance.errors()['objectiveId'] || fixture.componentInstance.errors()['categoryId']).toBeTruthy();
});
```

- [ ] **Step 2: Run — expect FAIL** (`mode`, `selectedObjectiveId`, `allocationHint` not defined).

`npx ng test --watch=false --include="src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts"`

- [ ] **Step 3: Implement create mode in the component**

In `task-detail-page.component.ts`:

- Add imports: `SelectComponent, SelectOption` from `shared/ui/select/select.component`; `TaskBoardStore`; `ProjectApiService` from `../../data-access/project-api.service`; `SprintApiService` from `../../data-access/sprint-api.service`; `toSprint` from `../../utils/sprint.mapper`; `Sprint` from `../../models/sprint.model`; `CreateTaskRequestDto, InsufficientAllocationErrorDto` from `../../models/dto/task.dto`.
- Add `SelectComponent` to `imports:` array.
- New fields:

```typescript
private readonly boardStore = inject(TaskBoardStore);
private readonly projectApi = inject(ProjectApiService);
private readonly sprintApi = inject(SprintApiService);

readonly mode = signal<'create' | 'edit'>(
  this.route.snapshot.data['mode'] === 'create' ? 'create' : 'edit'
);
private readonly prefillModuleId = this.route.snapshot.queryParamMap.get('module') ?? '';
private readonly prefillSprintId = this.route.snapshot.queryParamMap.get('sprint') ?? '';
readonly sprintRequired = signal(this.route.snapshot.queryParamMap.get('sprintRequired') !== 'false');

modules = signal<readonly { objectiveId: string; title: string; isOwner: boolean }[]>([]);
selectedObjectiveId = signal('');
sprints = signal<readonly Sprint[]>([]);
sprintId = signal('');
assignableMembers = signal<readonly { employeeId: string; name: string }[]>([]);
assigneeEmployeeId = signal('');
categoryId = signal('');
allocationHint = signal<InsufficientAllocationErrorDto | null>(null);

moduleOptions = computed<SelectOption[]>(() => this.modules().map((m) => ({ value: m.objectiveId, label: m.title })));
categoryOptions = computed<SelectOption[]>(() => this.categories().map((c) => ({ value: c.id, label: c.name })));
assigneeOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Unassigned' },
  ...this.assignableMembers().map((m) => ({ value: m.employeeId, label: m.name }))
]);
sprintOptions = computed<SelectOption[]>(() => {
  const objId = this.selectedObjectiveId();
  const list = objId ? this.sprints().filter((s) => s.objectiveId === objId) : this.sprints();
  return [...(this.sprintRequired() ? [] : [{ value: '', label: 'No sprint' }]), ...list.map((s) => ({ value: s.id, label: s.name }))];
});
selectedModuleIsOwner = computed(() =>
  this.modules().find((m) => m.objectiveId === this.selectedObjectiveId())?.isOwner ?? false
);
```

- In the constructor, branch:

```typescript
constructor() {
  void this.currentEmployee.ensureLoaded();
  if (this.mode() === 'create') {
    void this.loadCreateContext();
  } else {
    void this.load();
  }
}

private async loadCreateContext(): Promise<void> {
  this.loading.set(true);
  try {
    const [milestones, sprintDtos, categoryDtos] = await Promise.all([
      firstValueFrom(this.projectApi.getMyMilestones(this.projectId)),
      firstValueFrom(this.sprintApi.getByProject(this.projectId)),
      firstValueFrom(this.taskApi.getCategories(this.projectId))
    ]);
    this.modules.set(milestones.map((m) => ({ objectiveId: m.objectiveId, title: m.title, isOwner: m.isOwner })));
    this.sprints.set(sprintDtos.map(toSprint));
    this.categories.set(categoryDtos.map(toTaskCategoryColumn));
    this.categoryId.set(this.categories()[0]?.id ?? '');
    if (this.prefillModuleId && this.modules().some((m) => m.objectiveId === this.prefillModuleId)) {
      this.selectedObjectiveId.set(this.prefillModuleId);
    }
    if (this.prefillSprintId) this.sprintId.set(this.prefillSprintId);
    await this.projectStore.loadProjectMembers(this.projectId);
    this.assignableMembers.set(
      this.projectStore.projectMembers().map((m) => ({ employeeId: m.employeeId, name: m.name }))
    );
  } catch {
    this.loadError.set('Failed to load the task form.');
  } finally {
    this.loading.set(false);
  }
}
```

> `projectStore` is currently `private readonly projectStore = inject(ProjectDetailStore)` in the component — keep it; it already exists for `isObjectiveOwner`. Confirm `ProjectDetailStore` exposes `loadProjectMembers` and `projectMembers()` (it does — `task-board.component.ts` uses both). If `projectMembers()` items lack a `name`, map from whatever field they carry (see `task-board.component.ts loadAssignableMembers`).

- Template: wrap the current edit body in `@if (mode() === 'edit')`, and add an `@else` create block:

```html
@else {
  <section class="task-page__main">
    <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
    <app-select [options]="moduleOptions()" [value]="selectedObjectiveId()" label="Module" placeholder="Select a module"
      [error]="errors()['objectiveId'] || ''" [icon]="'module'" (valueChange)="selectedObjectiveId.set($event)" />
    <app-select [options]="sprintOptions()" [value]="sprintId()"
      [label]="'Sprint' + (sprintRequired() ? '' : ' (optional)')" [error]="errors()['sprintId'] || ''"
      [icon]="'sprint'" (valueChange)="sprintId.set($event)" />
    <app-select [options]="assigneeOptions()" [value]="assigneeEmployeeId()" label="Assign to (optional)"
      [icon]="'filter'" (valueChange)="assigneeEmployeeId.set($event)" />
    <app-select [options]="categoryOptions()" [value]="categoryId()" label="Category" placeholder="Select a category"
      [error]="errors()['categoryId'] || ''" [icon]="'category'" (valueChange)="categoryId.set($event)" />
    <label class="task-page__field">Priority
      <select class="task-page__select" [value]="priority()" (change)="priority.set($any($event.target).value)">
        <option value="low">Low</option><option value="medium">Medium</option>
        <option value="high">High</option><option value="critical">Critical</option>
      </select>
    </label>
    <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
    <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
    <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />
    <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />

    @if (allocationHint()) {
      <p class="task-page__error" role="alert" data-testid="allocation-hint">
        Not enough allocation ({{ allocationHint()!.availableSlackHours }}h available).
      </p>
    } @else if (errorMessage()) {
      <p class="task-page__error" role="alert">{{ errorMessage() }}</p>
    }
    <div class="task-page__actions">
      <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
        {{ selectedModuleIsOwner() ? 'Create' : 'Create request' }}
      </app-button>
    </div>
  </section>
}
```

Also gate the header: `@if (mode() === 'edit' && task(); as t) { ...header... } @else if (mode() === 'create') { <h1 class="task-page__title-text">New task</h1> }` — keep it simple.

- `submit()` — branch at the top:

```typescript
async submit(): Promise<void> {
  if (this.mode() === 'create') return this.submitCreate();
  // ...existing edit body unchanged...
}

private async submitCreate(): Promise<void> {
  const errs: Record<string, string> = {};
  if (!this.title().trim()) errs['title'] = 'Title is required.';
  if (!this.selectedObjectiveId()) errs['objectiveId'] = 'Module is required.';
  if (!this.categoryId()) errs['categoryId'] = 'Category is required.';
  if (this.sprintRequired() && !this.sprintId()) errs['sprintId'] = 'Sprint is required.';
  this.errors.set(errs);
  if (Object.keys(errs).length > 0) return;

  const request: CreateTaskRequestDto = {
    title: this.title().trim(),
    description: this.description() || undefined,
    categoryId: this.categoryId(),
    priority: this.priority(),
    dueDate: this.dueDate() || undefined,
    estimatedHours: this.estimatedHours() ?? undefined,
    storyPoints: this.storyPoints() ?? undefined,
    sprintId: this.sprintId() || null
  };

  this.submitting.set(true);
  this.errorMessage.set(null);
  this.allocationHint.set(null);
  try {
    const objectiveId = this.selectedObjectiveId();
    if (!this.selectedModuleIsOwner()) {
      await firstValueFrom(this.taskApi.createTaskCreationRequest(objectiveId, request));
      void this.router.navigate(['/work', this.projectId, 'board']);
      return;
    }
    const result = await this.boardStore.createTask(objectiveId, request);
    if (result && 'availableSlackHours' in result) { this.allocationHint.set(result); return; }
    if (result) {
      if (this.assigneeEmployeeId()) await firstValueFrom(this.taskApi.assignTask(result.id, this.assigneeEmployeeId()));
      void this.router.navigate(['/work', this.projectId, 'task', result.id]);
      return;
    }
    this.errorMessage.set(this.boardStore.error() ?? 'Failed to create the task.');
  } finally {
    this.submitting.set(false);
  }
}
```

> `projectId` is `private readonly` in the component; `submitCreate` is a method on the same class so `this.projectId` is fine. `Router` is already injected (`this.router`) from Phase 1.

- [ ] **Step 4: Add the route** — in `work.routes.ts`, immediately **before** the `task/:taskId` entry:

```typescript
      {
        path: 'task/new',
        data: { mode: 'create' },
        loadComponent: () =>
          import('./feature/task-detail-page/task-detail-page.component').then((m) => m.TaskDetailPageComponent)
      },
```

Update `work.routes.spec.ts`: the `:id` children list becomes `[... 'settings', 'task/new', 'task/:taskId']`; add `expect(...find(r => r.path === 'task/new')!.data).toEqual({ mode: 'create' })`.

- [ ] **Step 5: Run the page spec — expect PASS.** Then the full WM suite — expect green.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/task-detail-page src/app/modules/work/work.routes.ts src/app/modules/work/work.routes.spec.ts
git commit -m "feat(work): task creation on the routed task page (create mode)"
```

---

### Task 2: Point the four surfaces at `task/new`; delete the create modal

For each surface, the "Create task" button currently sets `createOpen.set(true)`. Change it to a navigate, passing context as query params, then remove the `<app-task-create-modal>` block, its import, its `imports:` entry, the `createOpen` signal, and `onTaskCreated`/`onTaskCreateClosed` handlers that only served the modal.

- **Board** (`task-board.component.ts`): button → `void this.router.navigate(['/work', this.projectId(), 'task', 'new'])`. (Board's create is project-wide, sprint required → no query params needed; defaults apply.)
- **Backlog** (`task-backlog.component.ts`): `void this.router.navigate(['/work', this.projectId(), 'task', 'new'], { queryParams: { sprintRequired: 'false' } })`.
- **My Task** (`my-task.component.ts`): `void this.router.navigate(['/work', this.projectId(), 'task', 'new'])`.
- **Tree** (`milestone-tree-tab.component.ts` + `.html`): the create-task trigger has a module (and maybe sprint) in context — `onCreateTaskRequested(node)` currently sets `createTaskObjectiveId` etc. Replace its body with:
  ```typescript
  const moduleId = node.kind === 'sprint' ? (node.parentObjectiveId ?? '') : node.id;
  const sprintId = node.kind === 'sprint' ? node.id : '';
  const queryParams: Record<string, string> = { module: moduleId };
  if (sprintId) { queryParams['sprint'] = sprintId; queryParams['sprintRequired'] = 'true'; }
  void this.router.navigate(['/work', this.projectId(), 'task', 'new'], { queryParams });
  ```
  Remove `createTaskOpen`, `createTaskObjectiveId`, `createTaskIsOwner`, `createTaskSprints`, `createTaskSprint`, `onTaskCreated`, `onTaskCreateClosed` and the `<app-task-create-modal>` block in the `.html`. (Verify each symbol isn't used elsewhere first with `git grep`.)

For every surface spec: replace "opens the create modal" assertions with "navigates to `['/work', <projectId>, 'task', 'new']` (with the expected `queryParams`)". Keep the `{ provide: Router, useValue: { navigate: vi.fn() } }` stubs already added in Phase 1; Board/Backlog/My-Task/Tree all have them.

- [ ] **Step 1: task-board** — change + spec, run `task-board.component.spec.ts` green, commit `feat(work): create tasks from the board via the task page`.
- [ ] **Step 2: task-backlog** — same, commit.
- [ ] **Step 3: my-task** — same, commit.
- [ ] **Step 4: milestone-tree-tab** — same, commit.
- [ ] **Step 5: Delete the modal**

```bash
git rm src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts src/app/modules/work/ui/task-create-modal/task-create-modal.component.spec.ts
git grep -n "task-create-modal\|TaskCreateModal" -- 'src/*'   # must be empty
```

- [ ] **Step 6: Full WM suite green, commit** `refactor(work): delete the task create modal, superseded by the task page`.

---

### Task 3: "View task" action on tree task rows

**Files:**
- Modify: `src/app/modules/work/ui/task-tree-row/task-tree-row.component.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` (+ `.html` if the node is rendered there) (+ `.spec.ts`)

**Interfaces:**
- Produces: `TaskTreeRowComponent.viewRequested = output<MilestoneTreeNode>()`; `MilestoneTreeNodeComponent.viewRequested` re-emit; tree tab `onViewRequested(node)` → `void this.router.navigate(['/work', this.projectId(), 'task', node.taskSource?.id ?? node.id])`.

- [ ] **Step 1: Failing spec** in `task-tree-row.component.spec.ts`:

```typescript
it('emits viewRequested with the node when the View button is clicked', () => {
  // ...render with a task node...
  const spy = vi.fn();
  fixture.componentInstance.viewRequested.subscribe(spy);
  fixture.nativeElement.querySelector('[data-testid="view-button"]').click();
  expect(spy).toHaveBeenCalledWith(node);
});
```

- [ ] **Step 2: Run — expect FAIL** (no `view-button`).

- [ ] **Step 3: Implement**

In `task-tree-row.component.ts`: add `viewRequested = output<MilestoneTreeNode>();` and, as the first child of the `row-actions` span (before the edit button):

```html
<button type="button" class="{{ iconClass() }}" data-testid="view-button" aria-label="View task" (click)="emit($event, viewRequested)">
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
</button>
```

In `milestone-tree-node.component.ts`: add `viewRequested = output<MilestoneTreeNode>();` and, everywhere `app-task-tree-row` is rendered, add `(viewRequested)="viewRequested.emit($event)"`. Also re-emit through any nested `app-milestone-tree-node` recursion the same way `editRequested` is.

In `milestone-tree-tab.component.*`: bind `(viewRequested)="onViewRequested($event)"` on `<app-milestone-tree-node>`, and:

```typescript
onViewRequested(node: MilestoneTreeNode): void {
  void this.router.navigate(['/work', this.projectId(), 'task', node.taskSource?.id ?? node.id]);
}
```

- [ ] **Step 4: Run the three specs — expect PASS.** Add a tree-tab spec: `onViewRequested({ ...task node... })` → `routerStub.navigate` called with `['/work', 'p1', 'task', 't1']`.

- [ ] **Step 5: Full WM suite green. Commit** `feat(work): add a View action to tree task rows`.

---

## Self-Review

**Spec coverage (§2 Part B3):**
- "no per-task route" → done in Phase 1.
- "Context-aware auto-fill … per-trigger-point audit" → Task 1 reads `?module`/`?sprint`; Task 2 has each surface pass what it knows (Board/My-Task: nothing; Backlog: `sprintRequired=false`; Tree: `module` + optional `sprint`). ✔
- "Create vs Create Request button-label gating" → `selectedModuleIsOwner()` drives the label and the endpoint. ✔
- "child module has no allocated hours … surface the slack" → `allocationHint()` from `createTask`'s `InsufficientAllocationErrorDto` return. ✔ (The "link into the module's edit form" refinement is left as a plain message for now — note in the final report.)
- User's tree "view" ask → Task 3. ✔

**Placeholder scan:** none — the one hand-wave ("re-create component so milestones reload" in a test comment) is a note to the test author about ordering, not production code; resolve it by setting `getMyMilestones` return before `TestBed.createComponent`.

**Type consistency:** `CreateTaskRequestDto` fields match `buildRequest` in the old modal and `task.dto.ts:33`; `createTask` return-type union handled with the same `'availableSlackHours' in result` guard the modal used; `MyProjectMilestoneDto` field names (`objectiveId`/`title`/`isOwner`) match `work-approvals.component.ts`'s usage.

**Out of scope:** the "Request more allocation" deep-link from the slack hint (kept as a message); any redesign of the edit-mode page.
