# WM Project Network View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Work Management's project page a second view of its Tree tab — the People module's Work Network explorer, rooted on the project instead of an employee.

**Architecture:** A new backend query returns the project's module tree and open tasks in the same node/link shape the employee work-graph already returns, so the existing Angular explorer can render it unchanged. The explorer's four files gain optional inputs (root id, ring, alert, project-mode copy) that the employee view does not pass; Work Management adds a thin view component plus a switch in the Tree toolbar.

**Tech Stack:** .NET / MediatR / xUnit (HRMS-Backend-v1); Angular standalone components, signals, d3-force, Vitest (Hrms--Web-application---front-end---v1).

**Spec:** `docs/superpowers/specs/2026-10-19-wm-project-network-view-design.md` (in the frontend repo; it covers both repos)

**Repos:** backend tasks 1–3 in `C:\Users\User\Desktop\build\HRMS-Backend-v1`; frontend tasks 4–10 in `C:\Users\User\Desktop\build\Hrms--Web-application---front-end---v1`. Branch: `feature/wm-project-network-view` in both.

## Global Constraints

- **Zero observable change to the employee Work Network.** Every edit to `src/app/modules/people/**` is a new optional input defaulting to today's behaviour. This is the spec's anti-goal.
- **Do not edit any existing spec file under `src/app/modules/people/`.** They must pass as written.
- **Do not touch `src/app/modules/people/models/work-graph.model.ts`.**
- **Do not move the explorer to `shared/`.** Work Management imports it from `modules/people/ui/work-network-graph/explorer/`.
- Scope: Work Management only, plus the four named explorer files.
- Frontend: `ng build` and `ng test` must print no warnings and no errors (`npm run check:warnings` before each FE commit). See `CLAUDE.md`.
- Backend: unit tests live in `tests/ONEVO.Tests.Unit/Features/WorkManagement/`; the architecture suite must stay green.
- Node `Kind` / `Role` / `Status` / link-kind strings come from the existing constants in `EmployeeWorkGraph/DTOs/Responses/EmployeeWorkGraphResponse.cs` — do not invent new literals.

## Review Focus

1. **A project whose root module has no children** — one node, no links. The layout, the fit-to-screen and the minimap must all render rather than divide by an empty extent. Test in Task 5.
2. **A module with `AllocatedHours == 0`** — the ring must draw an empty track, not `NaN` in the `stroke-dasharray`. Test in Task 6.
3. **An alert whose target is a task or sprint** — it must roll up to the owning module's circle, and an alert whose target is not in the graph at all must be dropped silently. Test in Task 9.
4. **A caller who is not an active project member** — must get the same 403 the objective-tree query gives, before any data is read. Test in Task 1.
5. **A private task (`VisibilityScope == Assignees`) the caller is not assigned to** — must be absent from the nodes *and* not counted toward the cap or `HiddenTaskCount`. Test in Task 2.

---

## Task 1: Project work-graph query — modules

**Repo:** HRMS-Backend-v1

**Files:**
- Create: `src/ONEVO.Application/Features/WorkManagement/ProjectWorkGraph/DTOs/Responses/ProjectWorkGraphResponse.cs`
- Create: `src/ONEVO.Application/Features/WorkManagement/ProjectWorkGraph/Queries/GetProjectWorkGraph/GetProjectWorkGraphQuery.cs`
- Create: `src/ONEVO.Application/Features/WorkManagement/ProjectWorkGraph/Queries/GetProjectWorkGraph/GetProjectWorkGraphQueryHandler.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/GetProjectWorkGraphQueryHandlerTests.cs`

**Interfaces:**
- Consumes: `WorkGraphNode`, `WorkGraphLink`, `WorkGraphStats`, `WorkGraphModuleDetails`, `WorkGraphPerson`, `WorkGraphNodeKinds`, `WorkGraphLinkKinds` from `Features/WorkManagement/EmployeeWorkGraph/DTOs/Responses/EmployeeWorkGraphResponse.cs` (unchanged); `IObjectiveRepository.GetTreeByProjectIdAsync`, `IProjectMemberRepository.HasActiveMembershipAsync`, `IProjectRepository.GetByIdForTenantAsync`, `IWorkTaskRepository.CountByObjectivesAsync`, `ICallerIdentityResolver.ResolveCallerEmployeeIdAsync`.
- Produces: `record ProjectWorkGraphResponse(IReadOnlyList<WorkGraphNode> Nodes, IReadOnlyList<WorkGraphLink> Links, int HiddenTaskCount)`; `record GetProjectWorkGraphQuery(Guid ProjectId) : IRequest<Result<ProjectWorkGraphResponse>>`; `GetProjectWorkGraphQueryHandler` with `public const int MaxTaskNodes = 60;` and `public const int MaxModuleMembers = 8;`.

- [ ] **Step 1: Write the failing tests**

In `GetProjectWorkGraphQueryHandlerTests.cs`, mirroring the arrangement helpers in `GetEmployeeWorkGraphQueryHandlerTests.cs`:

```csharp
Handle_ReturnsRootModuleAndDescendants_AsModuleNodes()      // every active objective of the project, default one included
Handle_LinksEachChildToItsParent_WithContainsKind()
Handle_SetsStatsFromTaskCounts_IncludingAllocatedAndCompletedHours()
Handle_ReturnsForbidden_WhenCallerIsNotAnActiveProjectMember()   // Review Focus 4
Handle_ReturnsNotFound_WhenProjectIsMissingOrInactive()
Handle_ReturnsSingleNodeAndNoLinks_WhenRootHasNoChildren()
```

The membership test asserts the repositories for objectives and tasks were never called.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/ONEVO.Tests.Unit --filter FullyQualifiedName~GetProjectWorkGraphQueryHandlerTests`
Expected: FAIL — `GetProjectWorkGraphQuery` does not exist.

- [ ] **Step 3: Implement the response record, the query and the handler**

Access check first, copied in order from `GetObjectiveTreeQueryHandler.Handle`: authenticated → tenant present → caller employee resolved → project active → `HasActiveMembershipAsync`. Every active objective of the project becomes a `module` node (`WorkGraphNodeKinds.Module`) with `ObjectiveId`, `ProjectId`, `Stats` from `CountByObjectivesAsync`, and `Module` details (owner, start/end, members capped at `MaxModuleMembers`, full `MemberCount`). `Role` stays null — the spec makes project-mode modules viewer-neutral. Links: `WorkGraphLinkKinds.Contains` from parent to child. `HiddenTaskCount` is 0 until Task 2.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/ONEVO.Tests.Unit --filter FullyQualifiedName~GetProjectWorkGraphQueryHandlerTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ONEVO.Application/Features/WorkManagement/ProjectWorkGraph tests/ONEVO.Tests.Unit/Features/WorkManagement/GetProjectWorkGraphQueryHandlerTests.cs
git commit -m "feat(wm): project work-graph query returning module nodes"
```

---

## Task 2: Project work-graph query — task nodes

**Repo:** HRMS-Backend-v1

**Files:**
- Modify: `src/ONEVO.Application/Features/WorkManagement/ProjectWorkGraph/Queries/GetProjectWorkGraph/GetProjectWorkGraphQueryHandler.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/GetProjectWorkGraphQueryHandlerTests.cs`

**Interfaces:**
- Consumes: Task 1's handler; `IWorkTaskRepository.GetByProjectAsync(tenantId, projectId, ct)`; `ITaskAccessResolver.FilterViewableTasksAsync(tenantId, userId, callerEmployeeId, tasks, ct)`; `WorkTaskVisibilityScopes`; `WorkGraphTaskDetails`.
- Produces: no new public surface — `Nodes` gains `task` nodes and `HiddenTaskCount` becomes meaningful.

- [ ] **Step 1: Write the failing tests**

```csharp
Handle_AddsOpenTasksOfEachModule_AsTaskNodes()              // not_started / active only
Handle_ExcludesSubtasks_WhenTaskHasAParentTask()
Handle_ExcludesPrivateTasks_TheCallerIsNotAssignedTo()      // Review Focus 5
Handle_DoesNotCountExcludedPrivateTasks_TowardHiddenTaskCount()  // Review Focus 5
Handle_CapsTaskNodesAtMaxTaskNodes_AndReportsTheRestAsHidden()
Handle_LinksEachTaskToItsModule_WithContainsKind()
Handle_SetsIsOverdue_WhenDueDateIsBeforeToday()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `dotnet test tests/ONEVO.Tests.Unit --filter FullyQualifiedName~GetProjectWorkGraphQueryHandlerTests`
Expected: FAIL — no task nodes returned.

- [ ] **Step 3: Add task nodes to the handler**

Read the project's tasks with `GetByProjectAsync`, keep those whose `ParentTaskId` is null and whose status is open, **then** pass them through `FilterViewableTasksAsync` — filter before capping, so an excluded private task is invisible rather than hidden. Cap at `MaxTaskNodes`; `HiddenTaskCount` is the count of viewable open top-level tasks beyond the cap. Each becomes a `task` node with `TaskId`, `ObjectiveId`, `Status`, `Sublabel` (the task code, as the employee handler sets it) and `WorkGraphTaskDetails(DueDate, StatusName, Priority, IsOverdue)`, where `IsOverdue` is `DueDate < _clock.Today`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `dotnet test tests/ONEVO.Tests.Unit --filter FullyQualifiedName~GetProjectWorkGraphQueryHandlerTests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(wm): project work-graph task nodes with visibility filtering"
```

---

## Task 3: Endpoint

**Repo:** HRMS-Backend-v1

**Files:**
- Modify: `src/ONEVO.Api/Controllers/Tenant/WorkManagement/ProjectsController.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/GetProjectWorkGraphQueryHandlerTests.cs` (no new file)

**Interfaces:**
- Consumes: `GetProjectWorkGraphQuery` from Task 1.
- Produces: `GET /api/v1/work/projects/{id:guid}/work-graph` returning `ProjectWorkGraphResponse`.

- [ ] **Step 1: Add the action**

`[HttpGet("{id:guid}/work-graph")] GetWorkGraph(Guid id, CancellationToken ct)`, following the shape of the sibling actions in this controller: send the query, `return result.IsSuccess ? Ok(result.Value) : Problem(result.Error, statusCode: result.StatusCode ?? 400);`. Match the controller's existing permission attributes for project reads — the handler owns the membership rule, the attribute owns the permission.

- [ ] **Step 2: Build and run the full unit + architecture suites**

Run: `dotnet build-server shutdown && dotnet build src/ONEVO.Application && dotnet test tests/ONEVO.Tests.Unit && dotnet test tests/ONEVO.Tests.Architecture`
Expected: PASS, no new failures.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(wm): expose GET /work/projects/{id}/work-graph"
```

---

## Task 4: Frontend model and API method

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Create: `src/app/modules/work/models/dto/project-work-graph.dto.ts`
- Modify: `src/app/modules/work/data-access/project-api.service.ts`
- Test: `src/app/modules/work/data-access/project-api.service.spec.ts`

**Interfaces:**
- Consumes: `WorkGraphNode`, `WorkGraphLink` types from `src/app/modules/people/models/work-graph.model.ts` (imported, not copied, not modified).
- Produces: `interface ProjectWorkGraphDto { readonly nodes: readonly WorkGraphNode[]; readonly links: readonly WorkGraphLink[]; readonly hiddenTaskCount: number; }` — structurally identical to `EmployeeWorkGraphResponse`, which is what lets the explorer accept it; and `ProjectApiService.getWorkGraph(projectId: string): Observable<ProjectWorkGraphDto>`.

- [ ] **Step 1: Write the failing test**

In `project-api.service.spec.ts`, following the pattern of `people-api.service.spec.ts:109`:

```ts
it('getWorkGraph GETs /work/projects/{id}/work-graph', () => { /* expectOne(`${environment.apiUrl}/work/projects/p-1/work-graph`) */ });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/app/modules/work/data-access/project-api.service.spec.ts`
Expected: FAIL — `getWorkGraph` is not a function.

- [ ] **Step 3: Add the DTO file and the service method**

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/app/modules/work/data-access/project-api.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run check:warnings && git add -A && git commit -m "feat(wm): project work-graph DTO and API method"
```

---

## Task 5: Explorer layout — optional root

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Modify: `src/app/modules/people/ui/work-network-graph/explorer/explorer-layout.ts`
- Test: `src/app/modules/people/ui/work-network-graph/explorer/explorer-layout.spec.ts` (append; do not edit existing cases)

**Interfaces:**
- Produces: `buildExplorerLayout(graph: EmployeeWorkGraphResponse, rootId?: string): ExplorerLayout`. With `rootId` omitted the function behaves exactly as it does today. With it, the node of that id is pinned at `(0, 0)` via `fx`/`fy`, takes the centre radius (38) and collision (96), and its outgoing links take the long distance (230) instead of the `contains` distance (135). `ExplorerNode` gains `readonly isRoot?: boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
it('pins the node named by rootId at the origin')
it('gives the root the centre radius and collision, and its links the long distance')
it('is unchanged when rootId is omitted: the employee node is still the pinned centre')   // anti-goal guard
it('lays out a graph of one node and no links')                                           // Review Focus 1
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph/explorer/explorer-layout.spec.ts`
Expected: FAIL on the first two; the third must already pass.

- [ ] **Step 3: Add the optional `rootId` parameter**

Today `radiusOf` / `collideOf` and the link distance key off `node.kind` alone. Give each an "is this the root" input and keep the existing `kind` branches as the fallback, so omitting `rootId` produces identical numbers.

- [ ] **Step 4: Run the whole explorer spec folder to verify nothing moved**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph`
Expected: PASS, including every pre-existing case unedited.

- [ ] **Step 5: Commit**

```bash
npm run check:warnings && git commit -am "feat(people): optional rootId for the explorer layout"
```

---

## Task 6: Canvas — progress ring, alert state, neutral module fill

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Modify: `src/app/modules/people/ui/work-network-graph/explorer/work-network-explorer-canvas.component.ts`
- Test: `src/app/modules/people/ui/work-network-graph/explorer/work-network-explorer-canvas.component.spec.ts` (create if absent)

**Interfaces:**
- Consumes: Task 5's `rootId`.
- Produces: four new inputs on `app-work-network-explorer-canvas`, all optional —
  `rootId = input<string | null>(null)`, `showProgressRing = input(false)`,
  `alertNodeIds = input<ReadonlySet<string>>(new Set())`,
  `neutralModuleFill = input(false)`.

- [ ] **Step 1: Write the failing tests**

```ts
it('draws no ring and no alert fill when the new inputs are left at their defaults')   // anti-goal guard
it('draws a progress ring whose arc is completedHours / allocatedHours of the circumference')
it('draws an empty ring, with no NaN in stroke-dasharray, when allocatedHours is 0')  // Review Focus 2
it('adds the alert class to the core circle of every id in alertNodeIds')
it('uses the neutral module fill when neutralModuleFill is true and role is null')
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph/explorer/work-network-explorer-canvas.component.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Add the ring as a second `<circle>` inside `wgx-node__body`, drawn only when `showProgressRing()` and the node is a module: a grey track plus an arc via `stroke-dasharray` on a circle of radius `node.radius + 4`, rotated `-90deg` so it starts at twelve o'clock. Guard the fraction: `allocatedHours <= 0` means a zero-length arc, never a division. The alert state is a class on the existing `wgx-core` circle. The neutral fill is one more `wgx-node--module-*` variant selected when `neutralModuleFill()` and `node.data.role` is null. Pass `rootId()` through to `buildExplorerLayout`.

- [ ] **Step 4: Run the whole explorer spec folder**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run check:warnings && git commit -am "feat(people): optional progress ring, alert state and neutral module fill on the explorer canvas"
```

---

## Task 7: Explorer wrapper — project-mode chrome

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Modify: `src/app/modules/people/ui/work-network-graph/explorer/work-network-explorer.component.ts`
- Test: `src/app/modules/people/ui/work-network-graph/explorer/work-network-explorer.component.spec.ts` (append; do not edit existing cases)

**Interfaces:**
- Consumes: the canvas inputs from Task 6.
- Produces: new optional inputs on `app-work-network-explorer` — `heading = input('Work Network')`, `description = input<string>(…current copy…)`, `showClose = input(true)`, `legend = input<readonly ExplorerLegendItem[] | null>(null)`, plus pass-throughs `rootId`, `showProgressRing`, `alertNodeIds`, `neutralModuleFill`. Exports `interface ExplorerLegendItem { readonly key: string; readonly label: string; }` where `key` is the existing `wge-key--*` modifier.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders the Work Network heading, the close button and the employee legend when no new inputs are passed')  // anti-goal guard
it('renders the given heading and hides the close button when showClose is false')
it('renders the given legend items instead of the default legend')
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph/explorer/work-network-explorer.component.spec.ts`
Expected: FAIL on the last two.

- [ ] **Step 3: Implement**

Replace the hardcoded `<h2>`, description and legend `<li>`s with the inputs, defaulting to today's literal strings and today's six legend items, so the employee view renders character-for-character as before.

- [ ] **Step 4: Run the whole explorer spec folder**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run check:warnings && git commit -am "feat(people): optional heading, legend and chrome inputs on the work network explorer"
```

---

## Task 8: Detail panel — project mode

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Modify: `src/app/modules/people/ui/work-network-graph/explorer/work-network-detail-panel.component.ts`
- Test: `src/app/modules/people/ui/work-network-graph/explorer/work-network-detail-panel.component.spec.ts` (create if absent)

**Interfaces:**
- Produces: one new optional input `projectMode = input(false)` on `app-work-network-detail-panel`.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders the employee-relative kind line and tasks heading when projectMode is false')   // anti-goal guard
it('renders "Module" with the parent module name and no role word when projectMode is true')
it('heads the tasks tab as the module\'s tasks, not the employee\'s, when projectMode is true')
it('renders without an employee node present in the graph when projectMode is true')
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph/explorer/work-network-detail-panel.component.spec.ts`
Expected: FAIL on the last three.

- [ ] **Step 3: Implement**

`kindLine()` today composes "Module • {project label} • {role word}" from `node.role` and a `kind: 'project'` node, and `isMe()` / `firstName()` read the `employee` node. Under `projectMode()` take the second segment from the node's parent in `links` and drop the role word; make the employee-dependent getters return null rather than assuming a node exists. Keep both paths in the same methods — no duplicate template.

- [ ] **Step 4: Run the whole explorer spec folder**

Run: `npx vitest run src/app/modules/people/ui/work-network-graph`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run check:warnings && git commit -am "feat(people): project mode for the work network detail panel"
```

---

## Task 9: Work Management network view component

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Create: `src/app/modules/work/feature/project-network-view/project-network-view.component.ts`
- Create: `src/app/modules/work/feature/project-network-view/project-network-view.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectApiService.getWorkGraph` (Task 4); `app-work-network-explorer` with the inputs from Tasks 5–8; `ProjectMonitorStore` (`src/app/modules/work/state/`), whose `alertsFor(id)` and `count()` the tree tab already uses.
- Produces: `app-project-network-view` with `projectId = input.required<string>()` and `rootObjectiveId = input.required<string>()`, and an output `openRequested = output<WorkGraphNode>()` for the panel's "Open in Work Management" action.

- [ ] **Step 1: Write the failing tests**

```ts
it('loads the graph for the project and renders the explorer rooted on rootObjectiveId')
it('passes the ids of modules that have alerts as alertNodeIds')
it('rolls a task-targeted or sprint-targeted alert up to its module')          // Review Focus 3
it('drops an alert whose target is not in the graph')                          // Review Focus 3
it('shows the loader while the request is in flight and an error state on failure')
```

Stub `ProjectApiService` and `ProjectMonitorStore`; no real HTTP (see `CLAUDE.md`).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/modules/work/feature/project-network-view`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

A `computed` maps the monitor store's alerts to a `Set<string>` of module node ids: an alert on a module id goes in directly; an alert on a task or sprint id resolves to its module through the graph's `links`; anything that resolves to no node in the graph is skipped. Render `app-work-network-explorer` with `rootId` = `rootObjectiveId()`, `showProgressRing` true, `neutralModuleFill` true, `showClose` false, `heading` "Project Network", and a legend of module / alert / in-progress / not-started / overdue. Reuse `app-loader` and `app-error-state` as the tree tab does.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run src/app/modules/work/feature/project-network-view`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
npm run check:warnings && git add -A && git commit -m "feat(wm): project network view component"
```

---

## Task 10: View switch in the Tree tab

**Repo:** Hrms--Web-application---front-end---v1

**Files:**
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html`
- Test: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`

**Interfaces:**
- Consumes: `app-project-network-view` from Task 9.
- Produces: no new public surface — a `viewMode = signal<'tree' | 'network'>('tree')` inside the tab component.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders the tree list and not the network view by default')
it('renders the network view and not the tree list after the switch is clicked')      // data-testid="tree-view-switch"
it('hides tree search, the owner filter, the highlight filter bar and Expand all in network mode')
it('keeps Create module and the switch itself visible in network mode')
it('keeps the explanation card column mounted in tree mode')
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run src/app/modules/work/feature/milestone-tree-tab`
Expected: FAIL

- [ ] **Step 3: Implement**

Add the segmented switch to the `#toolbarTpl` block, left of *Create module*, and gate the four toolbar controls on `viewMode() === 'tree'`. In the body, swap the tree list for `app-project-network-view` when the mode is `network`; the right-hand explanation-card column stays as it is and is shown in tree mode only.

- [ ] **Step 4: Run the full frontend suite**

Run: `npx vitest run && npm run check:warnings`
Expected: PASS, no warnings.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(wm): switch the project Tree tab between tree and network views"
```
