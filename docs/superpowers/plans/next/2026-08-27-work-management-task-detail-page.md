# Work Management: Task Detail Page (real B3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Task Detail *modal* with a dedicated routed page at `…/:projectId/task/:taskId` (dashboard layout, one explicit **Save Changes** button), reached by navigation from all four task surfaces (Board, Backlog, Tree, My Task), and delete the modal.

**Architecture:** A new self-loading standalone `TaskDetailPageComponent` under `feature/task-detail-page/`. It reads `taskId` from its route and `projectId` from the parent route, then loads what the old modal received as `@Input()`s from its parent: the task (new backend `GET /work/tasks/{id}`), the project's statuses and categories, the current employee id, and whether the caller owns the task's objective (from `ProjectDetailStore.milestones()`). Edit fields are local signals; **Save Changes** applies a status move (if changed) then `editTask` (owner) / `createTaskEditRequest` (non-owner), same as the modal's `submit()`. Clock widget and history feed stay immediate. The four surfaces change their "task viewed" handler from "open modal" to `router.navigate`.

**Tech Stack:** Angular 21 standalone components, signal inputs/stores, Angular Router, RxJS `firstValueFrom`, Vitest; backend .NET 10 / MediatR / xUnit + Moq, following `GetProjectTasksQueryHandler`.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B3. Refinements confirmed with the user 2026-08-27: (1) modal is **fully retired** (Option A), not kept as a peek view; (2) the page loads the task via a **new `GET /work/tasks/{id}`**; (3) **explicit Save Changes button**, not autosave. This plan is **Phase 1** (view/edit page + rewire + delete modal). Phase 2 (task *create* on the same page, context auto-fill audit, Create-vs-Request button gating) is a separate later plan and is out of scope here.

## Global Constraints

- Work Management only. Frontend: touch only `src/app/modules/work/**`. Backend: touch only `src/ONEVO.Application/Features/WorkManagement/**`, `src/ONEVO.Api/Controllers/Tenant/WorkManagement/TasksController.cs`, `src/ONEVO.Api/Contracts/WorkManagement/**` (none needed here — the new endpoint has no request body), and `tests/ONEVO.Tests.Unit/Features/WorkManagement/**`.
- Never touch `.github/**`, any `*.yml`/`*.yaml`, `Dockerfile`, or any CI/build script, in either repo.
- No EF migration — this feature adds a read endpoint only.
- Backend: `dotnet` commands may hit an `ONEVO.Api` file lock from a running dev process — always pass `-p:BuildProjectReferences=false`, never kill that process. Never run `dotnet run` or a frontend dev server.
- One commit per step group as marked. Confirm the relevant test command is green before every commit.
- "Module" is the UI word for what code calls `Objective`/`Milestone` — keep code names as the surrounding file already has them.
- Frontend focused test command: `npx ng test --watch=false --include="<path-to-spec>"`. Full WM suite: `npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"`.
- Backend focused: `dotnet test tests/ONEVO.Tests.Unit --filter "FullyQualifiedName~<Name>" -p:BuildProjectReferences=false`.

## File Structure

| File | Responsibility |
|---|---|
| `src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/GetTaskById/GetTaskByIdQuery.cs` | `GetTaskByIdQuery(Guid TaskId) : IRequest<Result<WorkTaskResponse>>` |
| `.../GetTaskById/GetTaskByIdQueryHandler.cs` | Auth + read-access check for one task, returns one `WorkTaskResponse` |
| `src/ONEVO.Api/Controllers/Tenant/WorkManagement/TasksController.cs` (modify) | `GET work/tasks/{id:guid}` action |
| `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/GetTaskByIdQueryHandlerTests.cs` | handler unit tests |
| `src/app/modules/work/data-access/task-api.service.ts` (modify) | `getTaskById(taskId): Observable<WorkTaskDto>` |
| `src/app/modules/work/work.routes.ts` (modify) | `task/:taskId` child route under `:id` |
| `src/app/modules/work/feature/task-detail-page/task-detail-page.component.ts` | the page (loads data, renders dashboard, explicit Save) |
| `src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts` | page tests |
| `task-board`, `task-backlog`, `milestone-tree-tab`, `my-task` (modify + specs) | navigate to the page instead of opening the modal |
| `src/app/modules/work/ui/task-detail-modal/**` | **deleted** in the final task |

---

### Task 1: Backend `GET /work/tasks/{id}`

**Files:**
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/GetTaskById/GetTaskByIdQuery.cs`
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/GetTaskById/GetTaskByIdQueryHandler.cs`
- Modify: `src/ONEVO.Api/Controllers/Tenant/WorkManagement/TasksController.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/GetTaskByIdQueryHandlerTests.cs`

**Interfaces:**
- Consumes: `IWorkTaskRepository.GetByIdForTenantAsync(Guid tenantId, Guid id, CancellationToken)`, `IProjectRepository.GetByIdForTenantAsync`, `IProjectMemberRepository.GetActiveObjectiveIdsForEmployeeInProjectAsync`, `IPermissionResolver.ResolveAsync`, `ITaskAssignmentRepository.GetByTaskIdsAsync`, `ITaskClockingSessionRepository.GetOpenSessionsForTasksAsync` + `GetTotalClosedSessionMinutesForTasksAsync`, `ICallerIdentityResolver.ResolveCallerEmployeeIdAsync` — all as used by `GetProjectTasksQueryHandler`.
- Produces: `GetTaskByIdQuery(Guid TaskId) : IRequest<Result<WorkTaskResponse>>`; handler returns `Result<WorkTaskResponse>` — `Forbidden` (unauthenticated / no employee), `NotFound` ("Task not found." — also when the caller may not read it), `Success(WorkTaskResponse)`.

- [ ] **Step 1: Write the failing handler tests**

Create `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/GetTaskByIdQueryHandlerTests.cs`. Mirror `GetProjectTasksQueryHandlerTests`'s `BuildHandler` shape. Cover:

```csharp
using Moq;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.Auth.Permission.ServiceInterfaces;
using ONEVO.Application.Features.WorkManagement.Common.Services;
using ONEVO.Application.Features.WorkManagement.ProjectMembers.RepositoryInterfaces;
using ONEVO.Application.Features.WorkManagement.Projects.RepositoryInterfaces;
using ONEVO.Application.Features.WorkManagement.Tasks.Queries.GetTaskById;
using ONEVO.Application.Features.WorkManagement.Tasks.RepositoryInterfaces;
using ONEVO.Domain.Features.WorkManagement.Projects.Entities;
using ONEVO.Domain.Features.WorkManagement.Tasks.Entities;
using Xunit;

namespace ONEVO.Tests.Unit.Features.WorkManagement.Tasks;

public sealed class GetTaskByIdQueryHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly Guid UserId = Guid.NewGuid();
    private static readonly Guid EmployeeId = Guid.NewGuid();
    private static readonly Guid ProjectId = Guid.NewGuid();
    private static readonly Guid ObjectiveId = Guid.NewGuid();
    private static readonly Guid TaskId = Guid.NewGuid();

    private static Project ActiveProject() => new()
    {
        Id = ProjectId, TenantId = TenantId, IsActive = true,
        Name = "Project", Identifier = "P1", CreatedAt = DateTimeOffset.UtcNow
    };

    private static WorkTask Task() => new()
    {
        Id = TaskId, TenantId = TenantId, ObjectiveId = ObjectiveId, ProjectId = ProjectId,
        ShortId = "P-1", Title = "A task", CategoryId = Guid.NewGuid(), StatusId = Guid.NewGuid(),
        CreatedAt = DateTimeOffset.UtcNow
    };

    private static GetTaskByIdQueryHandler BuildHandler(
        WorkTask? task, Project? project, bool hasReadPermission,
        IReadOnlyList<Guid>? accessibleObjectiveIds = null, bool authenticated = true, bool employeeExists = true)
    {
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.IsAuthenticated).Returns(authenticated);
        currentUser.SetupGet(x => x.TenantId).Returns(TenantId);
        currentUser.SetupGet(x => x.UserId).Returns(UserId);

        var identity = new Mock<ICallerIdentityResolver>();
        identity.Setup(x => x.ResolveCallerEmployeeIdAsync(TenantId, UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(employeeExists ? EmployeeId : (Guid?)null);

        var tasks = new Mock<IWorkTaskRepository>();
        tasks.Setup(x => x.GetByIdForTenantAsync(TenantId, TaskId, It.IsAny<CancellationToken>())).ReturnsAsync(task);

        var projects = new Mock<IProjectRepository>();
        projects.Setup(x => x.GetByIdForTenantAsync(TenantId, ProjectId, It.IsAny<CancellationToken>())).ReturnsAsync(project);

        var members = new Mock<IProjectMemberRepository>();
        members.Setup(x => x.GetActiveObjectiveIdsForEmployeeInProjectAsync(TenantId, ProjectId, EmployeeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(accessibleObjectiveIds ?? Array.Empty<Guid>());

        var permissions = new Mock<IPermissionResolver>();
        permissions.Setup(x => x.ResolveAsync(UserId, TenantId, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(hasReadPermission ? new List<string> { "projects:read" } : new List<string>());

        var assignments = new Mock<ITaskAssignmentRepository>();
        assignments.Setup(x => x.GetByTaskIdsAsync(It.IsAny<IReadOnlyList<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<TaskAssignment>());

        var sessions = new Mock<ITaskClockingSessionRepository>();
        sessions.Setup(x => x.GetOpenSessionsForTasksAsync(TenantId, It.IsAny<IReadOnlyList<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, OpenTaskClockingSessionSummary>());
        sessions.Setup(x => x.GetTotalClosedSessionMinutesForTasksAsync(TenantId, It.IsAny<IReadOnlyList<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Dictionary<Guid, int>());

        return new GetTaskByIdQueryHandler(
            currentUser.Object, identity.Object, tasks.Object, projects.Object,
            members.Object, permissions.Object, assignments.Object, sessions.Object);
    }

    [Fact]
    public async Task Handle_ReadPermission_ReturnsTask()
    {
        var handler = BuildHandler(Task(), ActiveProject(), hasReadPermission: true);
        var result = await handler.Handle(new GetTaskByIdQuery(TaskId), CancellationToken.None);
        Assert.True(result.IsSuccess);
        Assert.Equal(TaskId, result.Value!.Id);
        Assert.Equal(ObjectiveId, result.Value!.ObjectiveId);
    }

    [Fact]
    public async Task Handle_MemberOfTasksObjective_ReturnsTask()
    {
        var handler = BuildHandler(Task(), ActiveProject(), hasReadPermission: false, accessibleObjectiveIds: new[] { ObjectiveId });
        var result = await handler.Handle(new GetTaskByIdQuery(TaskId), CancellationToken.None);
        Assert.True(result.IsSuccess);
        Assert.Equal(TaskId, result.Value!.Id);
    }

    [Fact]
    public async Task Handle_NotAMemberAndNoPermission_ReturnsNotFound()
    {
        var handler = BuildHandler(Task(), ActiveProject(), hasReadPermission: false, accessibleObjectiveIds: Array.Empty<Guid>());
        var result = await handler.Handle(new GetTaskByIdQuery(TaskId), CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public async Task Handle_TaskDoesNotExist_ReturnsNotFound()
    {
        var handler = BuildHandler(task: null, ActiveProject(), hasReadPermission: true);
        var result = await handler.Handle(new GetTaskByIdQuery(TaskId), CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public async Task Handle_NotAuthenticated_ReturnsForbidden()
    {
        var handler = BuildHandler(Task(), ActiveProject(), hasReadPermission: true, authenticated: false);
        var result = await handler.Handle(new GetTaskByIdQuery(TaskId), CancellationToken.None);
        Assert.False(result.IsSuccess);
        Assert.Equal(403, result.StatusCode);
    }
}
```

- [ ] **Step 2: Run tests — expect a build failure** (`GetTaskByIdQuery` / handler don't exist).

Run: `dotnet test tests/ONEVO.Tests.Unit --filter "FullyQualifiedName~GetTaskByIdQueryHandlerTests" -p:BuildProjectReferences=false`
Expected: build error / cannot resolve `GetTaskByIdQuery`. This is the RED step.

- [ ] **Step 3: Create the query**

`src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/GetTaskById/GetTaskByIdQuery.cs`:

```csharp
using MediatR;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Features.WorkManagement.Tasks.DTOs.Responses;

namespace ONEVO.Application.Features.WorkManagement.Tasks.Queries.GetTaskById;

public sealed record GetTaskByIdQuery(Guid TaskId) : IRequest<Result<WorkTaskResponse>>;
```

- [ ] **Step 4: Create the handler**

`src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/GetTaskById/GetTaskByIdQueryHandler.cs`:

```csharp
using MediatR;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.Auth.Permission.ServiceInterfaces;
using ONEVO.Application.Features.WorkManagement.Common.Services;
using ONEVO.Application.Features.WorkManagement.ProjectMembers.RepositoryInterfaces;
using ONEVO.Application.Features.WorkManagement.Projects.RepositoryInterfaces;
using ONEVO.Application.Features.WorkManagement.Tasks.DTOs.Responses;
using ONEVO.Application.Features.WorkManagement.Tasks.RepositoryInterfaces;

namespace ONEVO.Application.Features.WorkManagement.Tasks.Queries.GetTaskById;

public sealed class GetTaskByIdQueryHandler : IRequestHandler<GetTaskByIdQuery, Result<WorkTaskResponse>>
{
    private readonly ICurrentUser _currentUser;
    private readonly ICallerIdentityResolver _identity;
    private readonly IWorkTaskRepository _tasks;
    private readonly IProjectRepository _projects;
    private readonly IProjectMemberRepository _members;
    private readonly IPermissionResolver _permissionResolver;
    private readonly ITaskAssignmentRepository _assignments;
    private readonly ITaskClockingSessionRepository _sessions;

    public GetTaskByIdQueryHandler(
        ICurrentUser currentUser,
        ICallerIdentityResolver identity,
        IWorkTaskRepository tasks,
        IProjectRepository projects,
        IProjectMemberRepository members,
        IPermissionResolver permissionResolver,
        ITaskAssignmentRepository assignments,
        ITaskClockingSessionRepository sessions)
    {
        _currentUser = currentUser;
        _identity = identity;
        _tasks = tasks;
        _projects = projects;
        _members = members;
        _permissionResolver = permissionResolver;
        _assignments = assignments;
        _sessions = sessions;
    }

    public async Task<Result<WorkTaskResponse>> Handle(GetTaskByIdQuery request, CancellationToken ct)
    {
        if (!_currentUser.IsAuthenticated)
            return Result<WorkTaskResponse>.Forbidden("Authentication required.");

        var tenantId = _currentUser.TenantId;
        var userId = _currentUser.UserId;
        if (tenantId == Guid.Empty)
            return Result<WorkTaskResponse>.Forbidden("Tenant context missing.");

        var callerEmployeeId = await _identity.ResolveCallerEmployeeIdAsync(tenantId, userId, ct);
        if (callerEmployeeId is null)
            return Result<WorkTaskResponse>.Forbidden("No employee record for the current user.");

        var task = await _tasks.GetByIdForTenantAsync(tenantId, request.TaskId, ct);
        if (task is null)
            return Result<WorkTaskResponse>.NotFound("Task not found.");

        var project = await _projects.GetByIdForTenantAsync(tenantId, task.ProjectId, ct);
        if (project is null || !project.IsActive)
            return Result<WorkTaskResponse>.NotFound("Task not found.");

        var permissions = await _permissionResolver.ResolveAsync(userId, tenantId, null, ct);
        var hasReadPermission = permissions.Contains("projects:read") || permissions.Contains("*");
        if (!hasReadPermission)
        {
            var accessibleObjectiveIds =
                (await _members.GetActiveObjectiveIdsForEmployeeInProjectAsync(tenantId, project.Id, callerEmployeeId.Value, ct))
                .ToHashSet();
            if (!accessibleObjectiveIds.Contains(task.ObjectiveId))
                return Result<WorkTaskResponse>.NotFound("Task not found.");
        }

        var assignments = await _assignments.GetByTaskIdsAsync(new[] { task.Id }, ct);
        var assigneeIds = (IReadOnlyList<Guid>)assignments.Select(a => a.EmployeeId).ToList();

        var openSessions = await _sessions.GetOpenSessionsForTasksAsync(tenantId, new[] { task.Id }, ct);
        var totalLoggedMinutes = await _sessions.GetTotalClosedSessionMinutesForTasksAsync(tenantId, new[] { task.Id }, ct);

        var response = new WorkTaskResponse(
            task.Id, task.ObjectiveId, task.ShortId, task.Title, task.Description, task.CategoryId, task.StatusId,
            task.Priority, task.StoryPoints, task.DueDate, task.EstimatedHours, task.CompletedHours, task.ProgressPercent, task.SprintId,
            assigneeIds,
            openSessions.TryGetValue(task.Id, out var openSession) ? openSession.EmployeeId : (Guid?)null,
            openSession?.ClockInAt,
            totalLoggedMinutes.GetValueOrDefault(task.Id, 0));

        return Result<WorkTaskResponse>.Success(response);
    }
}
```

> If `IWorkTaskRepository.GetByIdForTenantAsync`'s returned `WorkTask` lacks a `ProjectId` navigation, use `task.ProjectId` as written (the entity has it — `MoveTaskStatusCommandHandler` and `WorkTask` in `GetProjectTasksQueryHandlerTests` both set/use it).

- [ ] **Step 5: Add the controller action**

In `TasksController.cs`, next to `GetByProject`:

```csharp
[HttpGet("tasks/{id:guid}")]
[RequirePermission("projects:access")]
public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
{
    var result = await _mediator.Send(new GetTaskByIdQuery(id), ct);

    return result.IsSuccess
        ? Ok(result.Value!.ToViewModel())
        : Problem(result.Error, statusCode: result.StatusCode ?? 400);
}
```

Add `using ONEVO.Application.Features.WorkManagement.Tasks.Queries.GetTaskById;` to the controller's usings if not already present. Confirm `WorkTaskResponse` has a `.ToViewModel()` extension (used by `GetByProject` as `t.ToViewModel()`); reuse the same one for the single object.

- [ ] **Step 6: Run the tests — expect PASS**

Run: `dotnet test tests/ONEVO.Tests.Unit --filter "FullyQualifiedName~GetTaskByIdQueryHandlerTests" -p:BuildProjectReferences=false`
Expected: 5 passed.

- [ ] **Step 7: Run the full WM backend suite — no regressions**

Run: `dotnet test tests/ONEVO.Tests.Unit --filter "FullyQualifiedName~WorkManagement" -p:BuildProjectReferences=false`
Expected: all green (baseline was 635 passed; now 640).

- [ ] **Step 8: Commit**

```bash
git add src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/GetTaskById tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/GetTaskByIdQueryHandlerTests.cs src/ONEVO.Api/Controllers/Tenant/WorkManagement/TasksController.cs
git commit -m "feat(work): add GET /work/tasks/{id} for the task detail page"
```

---

### Task 2: Frontend `getTaskById` + route

**Files:**
- Modify: `src/app/modules/work/data-access/task-api.service.ts`
- Modify: `src/app/modules/work/data-access/task-api.service.spec.ts`
- Modify: `src/app/modules/work/work.routes.ts`

**Interfaces:**
- Produces: `TaskApiService.getTaskById(taskId: string): Observable<WorkTaskDto>` calling `GET {baseUrl}/tasks/{taskId}`.
- Produces: route `{ path: 'task/:taskId', loadComponent: () => import('./feature/task-detail-page/task-detail-page.component').then(m => m.TaskDetailPageComponent) }` as a direct child of the `:id` route (sibling of `board`, `backlog`, `my-task`, `calendar`, `settings`).

- [ ] **Step 1: Failing test for `getTaskById`**

In `task-api.service.spec.ts`, following the existing `httpMock.expectOne` style:

```typescript
it('getTaskById requests the single task endpoint', () => {
  service.getTaskById('t1').subscribe();
  const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1`);
  expect(req.request.method).toBe('GET');
  req.flush({});
});
```

- [ ] **Step 2: Run it — expect FAIL** (`getTaskById` is not a function).

Run: `npx ng test --watch=false --include="src/app/modules/work/data-access/task-api.service.spec.ts"`

- [ ] **Step 3: Implement `getTaskById`**

In `task-api.service.ts`, next to `getTasksByProject`:

```typescript
getTaskById(taskId: string): Observable<WorkTaskDto> {
  return this.http.get<WorkTaskDto>(`${this.baseUrl}/tasks/${taskId}`);
}
```

- [ ] **Step 4: Run it — expect PASS.**

- [ ] **Step 5: Add the route**

In `work.routes.ts`, add to the `:id` route's `children` array (after `settings`):

```typescript
      {
        path: 'task/:taskId',
        loadComponent: () =>
          import('./feature/task-detail-page/task-detail-page.component').then((m) => m.TaskDetailPageComponent)
      }
```

- [ ] **Step 6: Commit** (route target doesn't exist yet — that's Task 3; committing the service + spec is fine, but hold the route line until Task 3 so the build stays green. Instead: commit only the service now.)

```bash
git add src/app/modules/work/data-access/task-api.service.ts src/app/modules/work/data-access/task-api.service.spec.ts
git commit -m "feat(work): add getTaskById to the task API service"
```

Revert the `work.routes.ts` edit for now (re-apply it in Task 3, Step 8) OR leave it and do Task 3 immediately without committing in between. Executor's choice; the build must not be committed broken.

---

### Task 3: `TaskDetailPageComponent`

**Files:**
- Create: `src/app/modules/work/feature/task-detail-page/task-detail-page.component.ts`
- Create: `src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts`
- Modify: `src/app/modules/work/work.routes.ts` (add the route from Task 2 Step 5 if not already applied)

**Interfaces:**
- Consumes: `TaskApiService.getTaskById`, `.getStatuses`, `.getCategories`, `.getTaskHistory`, `.editTask`, `.createTaskEditRequest`, `.moveTaskStatus`, `.getCurrentEmployee`; `ProjectDetailStore.milestones()` (array of `{ objectiveId, isOwner }`); `toWorkTask`, `toTaskCategoryColumn` mappers; `TaskHistoryFeedComponent`, `TaskClockWidgetComponent` (same inputs the modal passed — see `task-detail-modal.component.ts` lines 56-67).
- Produces: route component `TaskDetailPageComponent`. Reads `taskId` from `ActivatedRoute.snapshot.paramMap.get('taskId')` and `projectId` from `route.parent?.snapshot.paramMap.get('id')`. A **Back** control calls `history.back()` (or `router.navigate(['..'])`).

The page's editable-field set, validation, `submit()` semantics (status move → `editTask` for owner / `createTaskEditRequest` for non-owner), the `widgetTask` computed, `hasOpenSessionMine`/`hasOpenSessionOtherEmployee`, `totalLoggedMinutesFromHistory`, `availableStatuses`, and `categoryName` are **ported verbatim** from `task-detail-modal.component.ts` (lines 105-313). The only differences: data is loaded in an `ngOnInit`/`effect` instead of received as inputs; there is no `<app-modal>` wrapper; and there is a two-column dashboard layout.

- [ ] **Step 1: Write the failing spec**

Create `task-detail-page.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskDetailPageComponent } from './task-detail-page.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';

const taskDto = {
  id: 't1', objectiveId: 'o1', shortId: 'P-1', title: 'First', description: 'desc',
  categoryId: 'c1', statusId: 's1', priority: 'high' as const, storyPoints: 2, dueDate: '2026-09-01',
  estimatedHours: 4, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: ['e1'],
  openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
};

describe('TaskDetailPageComponent', () => {
  let fixture: ComponentFixture<TaskDetailPageComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    api = {
      getTaskById: vi.fn().mockReturnValue(of(taskDto)),
      getStatuses: vi.fn().mockReturnValue(of([
        { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
        { id: 's2', name: 'Doing', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
      ])),
      getCategories: vi.fn().mockReturnValue(of([{ id: 'c1', name: 'Feature', displayOrder: 0 }])),
      getTaskHistory: vi.fn().mockReturnValue(of([])),
      editTask: vi.fn().mockReturnValue(of(taskDto)),
      createTaskEditRequest: vi.fn().mockReturnValue(of({})),
      moveTaskStatus: vi.fn().mockReturnValue(of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [TaskDetailPageComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectDetailStore, useValue: { milestones: signal([{ objectiveId: 'o1', isOwner: true }]) } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: (k: string) => (k === 'taskId' ? 't1' : null) } },
          parent: { snapshot: { paramMap: { get: () => 'p1' } } }
        } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  });

  it('loads the task by its route id and seeds the form', () => {
    expect(api.getTaskById).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.title()).toBe('First');
  });

  it('does not persist anything until Save Changes is pressed', () => {
    fixture.componentInstance.title.set('Edited');
    expect(api.editTask).not.toHaveBeenCalled();
    expect(api.moveTaskStatus).not.toHaveBeenCalled();
  });

  it('on Save Changes: moves status if changed, then edits the task (owner path)', async () => {
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.statusId.set('s2');
    await fixture.componentInstance.submit();
    expect(api.moveTaskStatus).toHaveBeenCalledWith('t1', 's2');
    expect(api.editTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
  });

  it('non-owner Save Changes routes through createTaskEditRequest', async () => {
    (TestBed.inject(ProjectDetailStore).milestones as any).set([{ objectiveId: 'o1', isOwner: false }]);
    fixture.detectChanges();
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api.createTaskEditRequest).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
    expect(api.editTask).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (component file does not exist).

Run: `npx ng test --watch=false --include="src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts"`

- [ ] **Step 3: Create the component**

Create `task-detail-page.component.ts`. Port the modal's class body; load data instead of taking inputs. Full file:

```typescript
import { Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskCategoryColumn } from '../../models/task-category.model';
import { toTaskCategoryColumn } from '../../utils/task-category.mapper';
import { toWorkTask } from '../../utils/task.mapper';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { TaskHistoryFeedComponent } from '../../ui/task-history-feed/task-history-feed.component';
import { TaskClockWidgetComponent } from '../../ui/task-clock-widget/task-clock-widget.component';
import { TaskHistoryEntryDto } from '../../models/dto/task-history.dto';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [InputComponent, ButtonComponent, TaskHistoryFeedComponent, TaskClockWidgetComponent],
  template: `
    <div class="task-page">
      <button type="button" class="task-page__back" (click)="goBack()">&larr; Back</button>

      @if (loading()) {
        <p>Loading…</p>
      } @else if (loadError()) {
        <p class="task-page__error" role="alert">{{ loadError() }}</p>
      } @else if (task(); as t) {
        <header class="task-page__header">
          <span class="task-page__short-id">{{ t.shortId }}</span>
          <h1 class="task-page__title-text">{{ t.title }}</h1>
        </header>

        <div class="task-page__grid">
          <section class="task-page__main">
            <app-input label="Title" [value]="title()" [error]="errors()['title'] || ''" (valueChange)="title.set($event)" />
            <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
            <label class="task-page__field">Priority
              <select class="task-page__select" [value]="priority()" (change)="priority.set($any($event.target).value)">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <app-input label="Due date" type="date" [value]="dueDate()" (valueChange)="dueDate.set($event)" />
            <app-input label="Estimated hours" type="number" [value]="estimatedHoursDisplay()" (valueChange)="onEstimatedHoursChange($event)" />
            <app-input label="Story points" type="number" [value]="storyPointsDisplay()" (valueChange)="onStoryPointsChange($event)" />
            <app-input label="Progress %" type="number" [value]="progressPercentDisplay()" (valueChange)="onProgressPercentChange($event)" />
            <app-input label="Reason (optional)" [value]="reason()" (valueChange)="reason.set($event)" />

            @if (errorMessage()) {
              <p class="task-page__error" role="alert">{{ errorMessage() }}</p>
            }
            <div class="task-page__actions">
              <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
                {{ isObjectiveOwner() ? 'Save changes' : 'Request changes' }}
              </app-button>
            </div>
          </section>

          <aside class="task-page__side">
            <label class="task-page__field">Status
              <select class="task-page__select" [value]="statusId()" (change)="statusId.set($any($event.target).value)">
                @for (status of availableStatuses(); track status.id) {
                  <option [value]="status.id">{{ status.name }}</option>
                }
              </select>
            </label>
            <dl class="task-page__meta">
              <dt>Category</dt><dd>{{ categoryName() }}</dd>
              <dt>Completed hours</dt><dd>{{ t.completedHours }}</dd>
            </dl>

            @if (isAssignee()) {
              <app-task-clock-widget
                [task]="widgetTask()!"
                [isAssignee]="isAssignee()"
                [hasOpenSessionMine]="hasOpenSessionMine()"
                [hasOpenSessionOtherEmployee]="hasOpenSessionOtherEmployee()"
                (clockedIn)="reloadHistory()"
                (pushed)="onTaskPushed($event)"
              />
            }

            <app-task-history-feed [entries]="history()" (reasonSaved)="reloadHistory()" />
          </aside>
        </div>
      }
    </div>
  `,
  styles: [`
    .task-page { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
    .task-page__back { align-self: flex-start; background: none; border: none; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; padding: 0; }
    .task-page__short-id { font-size: 12px; color: var(--color-text-secondary); }
    .task-page__title-text { margin: 2px 0 0; font-size: 20px; font-weight: 700; color: var(--color-text-primary); }
    .task-page__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: 24px; }
    @media (max-width: 900px) { .task-page__grid { grid-template-columns: 1fr; } }
    .task-page__main, .task-page__side { display: flex; flex-direction: column; gap: 12px; }
    .task-page__field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-text-primary); }
    .task-page__select { border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 10px; background: var(--color-surface); color: var(--color-text-primary); }
    .task-page__meta { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; margin: 0; }
    .task-page__meta dt { color: var(--color-text-secondary); }
    .task-page__meta dd { margin: 0; color: var(--color-text-primary); }
    .task-page__actions { margin-top: 8px; display: flex; justify-content: flex-end; }
    .task-page__error { font-size: 13px; color: var(--color-danger-text, var(--color-danger)); }
  `]
})
export class TaskDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly taskApi = inject(TaskApiService);
  private readonly projectStore = inject(ProjectDetailStore);
  private readonly currentEmployee = inject(CurrentEmployeeStore);

  private readonly taskId = this.route.snapshot.paramMap.get('taskId') ?? '';
  private readonly projectId = this.route.parent?.snapshot.paramMap.get('id') ?? '';

  task = signal<WorkTask | null>(null);
  statuses = signal<TaskStatusColumn[]>([]);
  categories = signal<TaskCategoryColumn[]>([]);
  history = signal<TaskHistoryEntryDto[]>([]);
  loading = signal(true);
  loadError = signal<string | null>(null);

  title = signal('');
  description = signal('');
  priority = signal<WorkTask['priority']>('medium');
  dueDate = signal('');
  estimatedHours = signal<number | null>(null);
  storyPoints = signal<number | null>(null);
  progressPercent = signal<number | null>(null);
  reason = signal('');
  statusId = signal('');

  submitting = signal(false);
  errors = signal<Record<string, string>>({});
  errorMessage = signal<string | null>(null);

  currentEmployeeId = computed(() => this.currentEmployee.id());
  isObjectiveOwner = computed(() => {
    const t = this.task();
    if (!t) return false;
    return this.projectStore.milestones().find((m) => m.objectiveId === t.objectiveId)?.isOwner ?? false;
  });
  isAssignee = computed(() => {
    const t = this.task();
    return !!t && t.assigneeEmployeeIds.includes(this.currentEmployeeId());
  });

  private readonly openSessionEntry = computed(() =>
    this.history().find((e) => e.type === 'clock_session' && e.clockSession?.clockOutAt === null) ?? null
  );
  hasOpenSessionMine = computed(() => this.openSessionEntry()?.employeeId === this.currentEmployeeId());
  hasOpenSessionOtherEmployee = computed(() => {
    const e = this.openSessionEntry();
    return e !== null && e.employeeId !== this.currentEmployeeId();
  });
  private readonly totalLoggedMinutesFromHistory = computed(() =>
    this.history()
      .filter((e) => e.type === 'clock_session' && e.clockSession?.durationMinutes != null)
      .reduce((sum, e) => sum + (e.clockSession!.durationMinutes ?? 0), 0)
  );
  widgetTask = computed<WorkTask | null>(() => {
    const t = this.task();
    if (!t) return null;
    const entry = this.openSessionEntry();
    return {
      ...t,
      openClockSessionEmployeeId: entry?.employeeId ?? null,
      openClockSessionClockInAt: entry?.clockSession ? new Date(entry.clockSession.clockInAt) : null,
      totalLoggedMinutes: Math.max(t.totalLoggedMinutes, this.totalLoggedMinutesFromHistory())
    };
  });

  categoryName = computed(() => {
    const t = this.task();
    if (!t) return '';
    return this.categories().find((c) => c.id === t.categoryId)?.name ?? t.categoryId;
  });
  availableStatuses = computed(() =>
    [...this.statuses()]
      .filter((s) => s.visibility === 'public' || this.isObjectiveOwner())
      .sort((a, b) => a.displayOrder - b.displayOrder)
  );

  constructor() {
    void this.currentEmployee.ensureLoaded();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [taskDto, statusDtos, categoryDtos, historyEntries] = await Promise.all([
        firstValueFrom(this.taskApi.getTaskById(this.taskId)),
        firstValueFrom(this.taskApi.getStatuses(this.projectId)),
        firstValueFrom(this.taskApi.getCategories(this.projectId)),
        firstValueFrom(this.taskApi.getTaskHistory(this.taskId))
      ]);
      const t = toWorkTask(taskDto);
      this.task.set(t);
      this.statuses.set(statusDtos);
      this.categories.set(categoryDtos.map(toTaskCategoryColumn));
      this.history.set(historyEntries);
      this.seedForm(t);
    } catch {
      this.loadError.set('Failed to load this task.');
    } finally {
      this.loading.set(false);
    }
  }

  private seedForm(t: WorkTask): void {
    this.title.set(t.title);
    this.description.set(t.description ?? '');
    this.priority.set(t.priority);
    this.dueDate.set(t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '');
    this.estimatedHours.set(t.estimatedHours);
    this.storyPoints.set(t.storyPoints);
    this.progressPercent.set(t.progressPercent);
    this.reason.set('');
    this.statusId.set(t.statusId);
    this.errors.set({});
    this.errorMessage.set(null);
  }

  async reloadHistory(): Promise<void> {
    try {
      this.history.set(await firstValueFrom(this.taskApi.getTaskHistory(this.taskId)));
    } catch {
      /* keep the current feed */
    }
  }

  async onTaskPushed(updated: WorkTask): Promise<void> {
    this.task.set(updated);
    await this.reloadHistory();
  }

  estimatedHoursDisplay(): string { return this.estimatedHours() == null ? '' : String(this.estimatedHours()); }
  storyPointsDisplay(): string { return this.storyPoints() == null ? '' : String(this.storyPoints()); }
  progressPercentDisplay(): string { return this.progressPercent() == null ? '' : String(this.progressPercent()); }
  onEstimatedHoursChange(v: string): void { this.estimatedHours.set(v === '' ? null : Number(v)); }
  onStoryPointsChange(v: string): void { this.storyPoints.set(v === '' ? null : Number(v)); }
  onProgressPercentChange(v: string): void { this.progressPercent.set(v === '' ? null : Number(v)); }

  goBack(): void {
    history.back();
  }

  async submit(): Promise<void> {
    const fieldErrors: Record<string, string> = {};
    if (!this.title().trim()) fieldErrors['title'] = 'Title is required.';
    this.errors.set(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    const newStatusId = this.statusId();
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

    try {
      if (newStatusId && newStatusId !== this.task()?.statusId) {
        await firstValueFrom(this.taskApi.moveTaskStatus(this.taskId, newStatusId));
      }
      if (this.isObjectiveOwner()) {
        const dto = await firstValueFrom(this.taskApi.editTask(this.taskId, fields));
        const t = toWorkTask(dto);
        this.task.set(t);
        this.seedForm(t);
      } else {
        await firstValueFrom(this.taskApi.createTaskEditRequest(this.taskId, fields));
      }
      await this.reloadHistory();
    } catch (err: unknown) {
      const detail = (err as { error?: { detail?: string } })?.error?.detail;
      this.errorMessage.set(detail || 'Failed to save.');
    } finally {
      this.submitting.set(false);
    }
  }
}
```

- [ ] **Step 4: Run the page spec — expect PASS.**

Run: `npx ng test --watch=false --include="src/app/modules/work/feature/task-detail-page/task-detail-page.component.spec.ts"`

- [ ] **Step 5: Ensure the route is present** in `work.routes.ts` (Task 2 Step 5). Run the full WM suite:

`npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"` — expect green.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/task-detail-page src/app/modules/work/work.routes.ts
git commit -m "feat(work): add the routed task detail page"
```

---

### Task 4: Point Board / Backlog / Tree / My Task at the page, delete the modal

Do these four sub-steps one surface at a time; each is a commit. For every surface the change is the same shape:

1. In the component `.ts`: inject `Router` (`private readonly router = inject(Router)`), and change the "view task" handler from `this.selectedTask.set(task); this.detailOpen.set(true);` to:
   ```typescript
   void this.router.navigate(['/work', this.projectId(), 'task', task.id]);
   ```
   (use whatever the surface already calls its projectId accessor — `projectId()` in my-task/tree, `this.projectId()` in board/backlog).
2. Delete the `<app-task-detail-modal ...>` block from the template, the `TaskDetailModalComponent` import and `imports:` entry, and the now-unused `detailOpen` / `selectedTask` signals **only if nothing else uses them** (Backlog/Board also use `selectedTask` for `onStatusChangeRequested` on the *table* row — check each; keep what's still referenced).
3. Update the surface's `.spec.ts`: replace assertions that the modal opens with an assertion that `Router.navigate` was called with `['/work', <projectId>, 'task', <taskId>]`. Provide a `Router` stub: `{ provide: Router, useValue: { navigate: vi.fn() } }`.

- [ ] **Step 1: task-board** — apply the shape above.
  Run: `npx ng test --watch=false --include="src/app/modules/work/feature/task-board/task-board.component.spec.ts"` → green.
  ```bash
  git add src/app/modules/work/feature/task-board/
  git commit -m "feat(work): open the task page from the board instead of the modal"
  ```

- [ ] **Step 2: task-backlog** — same.
  Run its spec → green.
  ```bash
  git add src/app/modules/work/feature/task-backlog/
  git commit -m "feat(work): open the task page from the backlog instead of the modal"
  ```

- [ ] **Step 3: milestone-tree-tab** — same (template is `.html`; remove the `<app-task-detail-modal>` line there and the `editTaskOpen` plumbing).
  Run its spec → green.
  ```bash
  git add src/app/modules/work/feature/milestone-tree-tab/
  git commit -m "feat(work): open the task page from the tree instead of the modal"
  ```

- [ ] **Step 4: my-task** — same (remove `<app-task-detail-modal>`, `detailOpen`, `selectedTask`, `onTaskSaved`; `onTaskViewed` becomes the navigate call).
  Run its spec → green.
  ```bash
  git add src/app/modules/work/feature/my-task/
  git commit -m "feat(work): open the task page from My Task instead of the modal"
  ```

- [ ] **Step 5: Delete the modal**

```bash
git rm src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.ts src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.spec.ts
```

- [ ] **Step 6: Grep for stragglers**

Run: `git grep -n "task-detail-modal\|TaskDetailModal" -- 'src/*'` → must return nothing. Fix any remaining import.

- [ ] **Step 7: Full WM suite**

Run: `npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"` → all green.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/modules/work
git commit -m "refactor(work): delete the task detail modal, superseded by the task page"
```

---

## Self-Review

**Spec coverage (§2 Part B3):**
- "no per-task route" → Task 2/3 add `task/:taskId`. ✔
- "Convert task-detail-modal content into the new page's template (dashboard-style … autosaving each field" → page built; **autosave overridden to explicit Save per the user 2026-08-27** — noted in the header. ✔
- "Keep the modal version only if a genuinely modal-appropriate quick-view is still wanted … do not keep two full copies" → user chose Option A (full retire); Task 4 deletes it. ✔
- "Context-aware auto-fill … per-trigger-point audit" and "Create vs Create Request button-label gating" and "child module has no allocated hours … surface the slack" → these are **task-create concerns**; explicitly deferred to Phase 2 in the header. ✔ (gap is intentional and recorded)

**Placeholder scan:** none — every step has real code or a concrete command.

**Type consistency:** `getTaskById(taskId: string): Observable<WorkTaskDto>` used identically in Task 2 and Task 3; `submit()` / `title()` / `statusId()` signal names match between the spec (Task 3 Step 1) and the component (Step 3); `moveTaskStatus(taskId, newStatusId)` matches `task-api.service.ts:101`; `editTask(taskId, fields)` matches `:81`; `createTaskEditRequest(taskId, fields)` matches `:130`.

**Out of scope (Phase 2, separate plan):** task create on the page, context auto-fill, Create/Request gating, insufficient-allocation slack surfacing on the page.
