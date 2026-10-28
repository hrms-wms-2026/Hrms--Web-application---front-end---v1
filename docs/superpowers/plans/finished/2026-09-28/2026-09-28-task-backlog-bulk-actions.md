# Task Backlog Bulk Actions (Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bulk Status / Assign / Priority / Due date / Move to sprint / Move to backlog / Convert to subtask / Delete on the task backlog, across sprint sections and the Backlog table, with per-task results — and fix the move-undo and orphaned-subtask bugs on the way.

**Architecture:** Backend bulk commands dispatch the existing single-task MediatR command per id through a shared, id-agnostic `BulkItemRunner` (extracted from B's employee runner). Priority and due date get a narrow `SetTaskAttributesCommand` instead of the full-overwrite edit. Sprint moves keep using the existing all-or-nothing `PUT sprints/{id}/tasks`. Frontend reuses A's bulk bar and one new picker dialog.

**Tech Stack:** .NET 10 / MediatR / FluentValidation / xUnit + Moq; Angular 21 standalone + signals / Vitest.

**Spec:** `docs/superpowers/specs/finished/2026-09-28/2026-09-28-task-backlog-bulk-actions-design.md` (frontend repo)

## Global Constraints

- Backend `C:\onevoNew\HRMS-Backend-v1`, frontend `C:\onevoNew\Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. **Never create git worktrees**; ignore `.worktrees/`.
- Shared working trees: both repos currently have **uncommitted changes from another session** (backend: project-member repository files; frontend: employee-list CSS/HTML, employee-columns, main-layout CSS). Never stage, revert or reformat them. `git status` before each commit; stage only the task's files.
- Backend tests: `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~<Class>"`. Kill a running `ONEVO.Api.exe` right before each build/test (it auto-respawns).
- WorkManagement unit tests use Moq + `Assert.*`, one `Build(...)`-style helper per test class (see `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/DeleteTaskCommandHandlerTests.cs`).
- Frontend: Vitest (`vi.fn()`), `npx ng test --watch=false --include=<spec>`; paths below are relative to `src/app/`.
- Bulk limit 100 distinct ids. Task outcome strings: `succeeded`, `failed`.
- Exact messages: subtask delete guard `This task has subtasks. Delete or move its subtasks first.`; invalid priority `Priority must be one of: low, medium, high, critical.`
- Paste raw test summary lines in every task report.

---

## Part 1 — Backend

### Task 1: Extract id-agnostic `BulkItemRunner`

**Files:**
- Create: `src/ONEVO.Application/Common/Services/BulkItemRunner.cs`
- Modify: `src/ONEVO.Application/Features/CoreHr/Employee/Services/BulkEmployeeActionRunner.cs`
- Test: `tests/ONEVO.Tests.Unit/Common/BulkItemRunnerTests.cs` (create folder if missing)

**Interfaces:**
- Produces:
  ```csharp
  namespace ONEVO.Application.Common.Services;
  public static class BulkItemOutcomes { Succeeded = "succeeded"; PendingApproval = "pendingApproval"; Failed = "failed"; }
  public sealed record BulkItemResult(Guid Id, string Outcome, string? Reason);
  public static class BulkItemRunner
  {
      public const int MaxItems = 100;
      public static Task<IReadOnlyList<BulkItemResult>> RunAsync(IEnumerable<Guid> ids,
          Func<Guid, CancellationToken, Task<BulkItemOutcome>> processOne, IUnitOfWork unitOfWork,
          ILogger logger, string unexpectedFailureReason, CancellationToken ct);
  }
  ```
  `BulkItemOutcome` stays declared in `ONEVO.Application.Features.CoreHr.Employee.Services` (B's commands already use it); `BulkItemRunner` references it from there. Do **not** move it (would churn B's files for no gain).
- Keeps: `BulkEmployeeActionRunner.RunAsync(...)` signature, constants and `BulkEmployeeActionOutcomes` values unchanged.

- [ ] **Step 1: Write failing tests**
```csharp
using Microsoft.Extensions.Logging.Abstractions;
using ONEVO.Application.Common.Services;
using ONEVO.Application.Features.CoreHr.Employee.Services;
using ONEVO.Tests.Unit.Fakes;
using Xunit;

namespace ONEVO.Tests.Unit.Common;

public class BulkItemRunnerTests
{
    private readonly FakeUnitOfWork _uow = new();

    [Fact]
    public async Task MapsOutcomes_DeduplicatesIds_ClearsTrackingPerItem()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        var results = await BulkItemRunner.RunAsync(new[] { a, b, a },
            (id, _) => Task.FromResult(id == a ? new BulkItemOutcome(true, false, null) : new BulkItemOutcome(false, false, "nope")),
            _uow, NullLogger.Instance, "Unexpected.", CancellationToken.None);

        Assert.Equal(new[] { (a, "succeeded", (string?)null), (b, "failed", "nope") }, results.Select(r => (r.Id, r.Outcome, r.Reason)));
        Assert.Equal(2, _uow.ClearTrackingCallCount);
    }

    [Fact]
    public async Task ExceptionsBecomeFailures_WithCallerSuppliedReason_AndValidationMessages()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        var results = await BulkItemRunner.RunAsync(new[] { a, b },
            (id, _) => id == a
                ? throw new InvalidOperationException("boom")
                : throw new FluentValidation.ValidationException(new[] { new FluentValidation.Results.ValidationFailure("X", "X is bad.") }),
            _uow, NullLogger.Instance, "Unexpected error while processing this task.", CancellationToken.None);

        Assert.Equal("Unexpected error while processing this task.", results[0].Reason);
        Assert.Equal("X is bad.", results[1].Reason);
    }
}
```

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~BulkItemRunnerTests"` → build error.

- [ ] **Step 3: Implement**

`BulkItemRunner.cs`:
```csharp
using Microsoft.Extensions.Logging;
using ONEVO.Application.Common.RepositoryInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.Services;

namespace ONEVO.Application.Common.Services;

public static class BulkItemOutcomes
{
    public const string Succeeded = "succeeded";
    public const string PendingApproval = "pendingApproval";
    public const string Failed = "failed";
}

public sealed record BulkItemResult(Guid Id, string Outcome, string? Reason);

/// <summary>
/// Shared loop for bulk actions: each id is processed sequentially through the existing
/// single-item command (so every single-item rule applies), outcomes are mapped per item, and
/// the change tracker is cleared after every item so a failed item's tracked changes can never
/// be flushed by a later item's SaveChangesAsync.
/// </summary>
public static class BulkItemRunner
{
    public const int MaxItems = 100;

    public static async Task<IReadOnlyList<BulkItemResult>> RunAsync(
        IEnumerable<Guid> ids,
        Func<Guid, CancellationToken, Task<BulkItemOutcome>> processOne,
        IUnitOfWork unitOfWork,
        ILogger logger,
        string unexpectedFailureReason,
        CancellationToken ct)
    {
        var results = new List<BulkItemResult>();
        foreach (var id in ids.Distinct())
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var outcome = await processOne(id, ct);
                results.Add(outcome.Success
                    ? new BulkItemResult(id, outcome.PendingApproval ? BulkItemOutcomes.PendingApproval : BulkItemOutcomes.Succeeded, null)
                    : new BulkItemResult(id, BulkItemOutcomes.Failed, outcome.Error));
            }
            catch (FluentValidation.ValidationException ex)
            {
                // ValidationBehavior throws rather than returning a failed Result.
                results.Add(new BulkItemResult(id, BulkItemOutcomes.Failed, string.Join(" ", ex.Errors.Select(e => e.ErrorMessage))));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Bulk action failed for item {ItemId}", id);
                results.Add(new BulkItemResult(id, BulkItemOutcomes.Failed, unexpectedFailureReason));
            }
            finally
            {
                unitOfWork.ClearTracking();
            }
        }

        return results;
    }
}
```

`BulkEmployeeActionRunner.RunAsync` body becomes:
```csharp
        var results = await BulkItemRunner.RunAsync(employeeIds, processOne, unitOfWork, logger, UnexpectedFailureReason, ct);
        return BulkEmployeeActionResponse.From(
            results.Select(r => new BulkEmployeeActionItemResponse(r.Id, r.Outcome, r.Reason)).ToList());
```
(add `using ONEVO.Application.Common.Services;`; keep `MaxEmployees`, `UnexpectedFailureReason`, the XML doc.)

- [ ] **Step 4: Run** `--filter "FullyQualifiedName~BulkItemRunnerTests|FullyQualifiedName~BulkEmployeeActionRunnerTests|FullyQualifiedName~BulkEmployeeCommandsTests"` → all pass (B's tests prove behaviour is unchanged).

- [ ] **Step 5: Commit**
```bash
git add src/ONEVO.Application/Common/Services/BulkItemRunner.cs src/ONEVO.Application/Features/CoreHr/Employee/Services/BulkEmployeeActionRunner.cs tests/ONEVO.Tests.Unit/Common/BulkItemRunnerTests.cs
git commit -m "refactor(core): extract id-agnostic BulkItemRunner from employee bulk runner"
```

---

### Task 2: `TaskDueDateEventWindowRule` (shared event-window check)

**Files:**
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Services/TaskDueDateEventWindowRule.cs`
- Modify: `src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/EditTask/EditTaskCommandHandler.cs` (R3 block, ~lines 105-120)
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/TaskDueDateEventWindowRuleTests.cs`

**Interfaces:**
- Consumes: the element type returned by `ICalendarEventRepository.ListActiveEventWindowsForTaskAsync(tenantId, taskId, objectiveId, ct)` — it exposes `Name`, `StartDate`, `EndDate` (check its declared type name in `CalendarEvents/RepositoryInterfaces` and use it below in place of `ActiveEventWindow`).
- Produces: `public static string? TaskDueDateEventWindowRule.Validate(IReadOnlyList<ActiveEventWindow> windows, DateOnly? dueDate)` → `null` when allowed, otherwise the exact conflict message EditTask returns today.

- [ ] **Step 1: Write failing tests**
```csharp
using ONEVO.Application.Features.WorkManagement.Tasks.Services;
using Xunit;
// + using for the ActiveEventWindow type's namespace

namespace ONEVO.Tests.Unit.Features.WorkManagement.Tasks;

public class TaskDueDateEventWindowRuleTests
{
    private static readonly IReadOnlyList<ActiveEventWindow> Windows = new[]
    {
        new ActiveEventWindow(/* construct with Name "Launch", StartDate 2026-10-01, EndDate 2026-10-10 — match the type's constructor/initializer */)
    };

    [Fact]
    public void NoWindows_AllowsAnything() => Assert.Null(TaskDueDateEventWindowRule.Validate(Array.Empty<ActiveEventWindow>(), null));

    [Fact]
    public void InsideWindow_Allowed() => Assert.Null(TaskDueDateEventWindowRule.Validate(Windows, new DateOnly(2026, 10, 5)));

    [Fact]
    public void ClearingDueDate_InActiveEvent_IsRejected()
        => Assert.Equal("This task is in active event(s) Launch; a due date is required.", TaskDueDateEventWindowRule.Validate(Windows, null));

    [Fact]
    public void OutsideWindow_IsRejectedWithWindowDetails()
        => Assert.Equal(
            "Due date 2026-11-01 is outside event window(s): Launch 2026-10-01..2026-10-10. Widen the event first.",
            TaskDueDateEventWindowRule.Validate(Windows, new DateOnly(2026, 11, 1)));
}
```
(The `new ActiveEventWindow(...)` line: fill in with the real type's shape; the four assertions are fixed.)

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~TaskDueDateEventWindowRuleTests"` → build error.

- [ ] **Step 3: Implement**
```csharp
namespace ONEVO.Application.Features.WorkManagement.Tasks.Services;

/// <summary>R3: a member of an active calendar event must keep a due date inside every such event's window.
/// Shared by EditTask and SetTaskAttributes so the rule can't drift between them.</summary>
public static class TaskDueDateEventWindowRule
{
    public static string? Validate(IReadOnlyList<ActiveEventWindow> windows, DateOnly? dueDate)
    {
        if (windows.Count == 0)
            return null;
        if (dueDate is null)
            return $"This task is in active event(s) {string.Join(", ", windows.Select(w => w.Name))}; a due date is required.";
        var bad = windows.Where(w => dueDate < w.StartDate || dueDate > w.EndDate).ToList();
        return bad.Count == 0
            ? null
            : $"Due date {dueDate:yyyy-MM-dd} is outside event window(s): "
              + $"{string.Join(", ", bad.Select(w => $"{w.Name} {w.StartDate:yyyy-MM-dd}..{w.EndDate:yyyy-MM-dd}"))}. Widen the event first.";
    }
}
```
In `EditTaskCommandHandler`, replace the body of `if (request.DueDate != task.DueDate) { ... }` with:
```csharp
            var windows = await _calendarEvents.ListActiveEventWindowsForTaskAsync(tenantId, task.Id, task.ObjectiveId, ct);
            var windowError = TaskDueDateEventWindowRule.Validate(windows, request.DueDate);
            if (windowError is not null)
                return Result<WorkTaskResponse>.Conflict(windowError);
```
(If the repository returns a type other than `IReadOnlyList<...>`, call `.ToList()`.)

- [ ] **Step 4: Run** the new tests + `--filter "FullyQualifiedName~EditTaskCommandHandlerTests"` → all pass (proves EditTask behaviour unchanged).

- [ ] **Step 5: Commit**
```bash
git add src/ONEVO.Application/Features/WorkManagement/Tasks/Services/TaskDueDateEventWindowRule.cs src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/EditTask/EditTaskCommandHandler.cs tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/TaskDueDateEventWindowRuleTests.cs
git commit -m "refactor(work): extract task due-date event-window rule"
```

---

### Task 3: `SetTaskAttributesCommand` (narrow priority / due-date change)

**Files:**
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/SetTaskAttributes/SetTaskAttributesCommand.cs` (record + validator)
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/SetTaskAttributes/SetTaskAttributesCommandHandler.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/SetTaskAttributesCommandHandlerTests.cs`

**Interfaces:**
- Consumes: `ICurrentUser`, `ICallerIdentityResolver.ResolveCallerEmployeeIdAsync`, `IWorkTaskRepository.GetTrackedByIdForTenantAsync`, `IObjectiveRepository.GetByIdForTenantAsync`, `IMilestoneMembershipCoordinator.IsEffectiveOwnerAsync`, `ISprintRepository.GetByIdForTenantAsync`, `ICalendarEventRepository.ListActiveEventWindowsForTaskAsync`, `ITaskEditLogRepository.AddAsync`, `IUnitOfWork` (same types/usings as `EditTaskCommandHandler`), `TaskDueDateEventWindowRule` (Task 2), `WorkTaskPriorities`.
- Produces: `public sealed record SetTaskAttributesCommand(Guid TaskId, string? Priority, bool SetDueDate, DateOnly? DueDate) : IRequest<Result>;` — `Priority == null` leaves priority; `SetDueDate == false` leaves due date; `SetDueDate && DueDate == null` clears it.

- [ ] **Step 1: Write failing tests** — build the handler with the same mock set `EditTaskCommandHandlerTests` uses (copy its `Build` helper shape: authenticated user, resolved caller employee, a tracked `WorkTask { Id, TenantId, ObjectiveId, Priority = "medium", DueDate = 2026-10-05 }`, objective, `IsEffectiveOwnerAsync` → true by default, `ListActiveEventWindowsForTaskAsync` → empty by default, `FakeUnitOfWork`). Tests:
```csharp
    [Fact] public async Task SetsPriorityOnly_AndLogsOnlyThatField()
    // act: new SetTaskAttributesCommand(TaskId, "high", false, null)
    // assert: IsSuccess; task.Priority == "high"; task.DueDate unchanged;
    //   editLogs.Verify(AddAsync(It.Is<TaskEditLog>(l => l.Source == TaskEditLogSources.Direct
    //     && l.NewValuesJson == "{\"priority\":\"high\"}" && l.OldValuesJson == "{\"priority\":\"medium\"}"), ...), Times.Once)

    [Fact] public async Task ClearsDueDate_WhenSetDueDateWithNull()
    // act: (TaskId, null, true, null) → task.DueDate == null, priority unchanged

    [Fact] public async Task NonOwner_ReturnsForbidden_AndDoesNotSave()
    // IsEffectiveOwnerAsync → false → StatusCode 403; uow.SaveCallCount == 0

    [Fact] public async Task AchievedSprint_ReturnsForbidden()
    // task.SprintId set; sprint Status = SprintStatuses.Achieved → 403

    [Fact] public async Task DueDateOutsideEventWindow_ReturnsConflict_WithRuleMessage()
    // windows = [Launch 2026-10-01..2026-10-10]; act (TaskId, null, true, 2026-11-01) → 409, Error == rule message

    [Fact] public async Task NoActualChange_SucceedsWithoutEditLog()
    // act (TaskId, "medium", true, 2026-10-05) → success; editLogs AddAsync never called

    [Fact] public void Validator_RejectsUnknownPriority_AndEmptyCommand()
    // new SetTaskAttributesCommandValidator().Validate(new(TaskId, "urgent", false, null)).IsValid == false,
    //   with message "Priority must be one of: low, medium, high, critical."
    // Validate(new(TaskId, null, false, null)).IsValid == false
```
Write each test body fully in the file following those comments (arrange via the helper, act, assert exactly as stated).

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~SetTaskAttributesCommandHandlerTests"` → build error.

- [ ] **Step 3: Implement**

`SetTaskAttributesCommand.cs`:
```csharp
using FluentValidation;
using MediatR;
using ONEVO.Application.Common.Models;
using ONEVO.Domain.Features.WorkManagement.Tasks.Entities;

namespace ONEVO.Application.Features.WorkManagement.Tasks.Commands.SetTaskAttributes;

/// <summary>Narrow change of priority and/or due date. Unlike EditTaskCommand (a full-record
/// replace that also re-syncs attachments and re-checks allocation slack), this touches only the
/// named fields, so it is safe to apply to many tasks at once.</summary>
public sealed record SetTaskAttributesCommand(Guid TaskId, string? Priority, bool SetDueDate, DateOnly? DueDate) : IRequest<Result>;

public sealed class SetTaskAttributesCommandValidator : AbstractValidator<SetTaskAttributesCommand>
{
    private static readonly string[] Priorities =
        { WorkTaskPriorities.Low, WorkTaskPriorities.Medium, WorkTaskPriorities.High, WorkTaskPriorities.Critical };

    public SetTaskAttributesCommandValidator()
    {
        RuleFor(x => x.TaskId).NotEmpty();
        RuleFor(x => x.Priority)
            .Must(p => p is null || Priorities.Contains(p))
            .WithMessage("Priority must be one of: low, medium, high, critical.");
        RuleFor(x => x).Must(x => x.Priority is not null || x.SetDueDate)
            .WithMessage("Nothing to change.");
    }
}
```

`SetTaskAttributesCommandHandler.cs` (usings as in `EditTaskCommandHandler`):
```csharp
public sealed class SetTaskAttributesCommandHandler(
    ICurrentUser currentUser,
    ICallerIdentityResolver identity,
    IWorkTaskRepository tasks,
    IObjectiveRepository objectives,
    IMilestoneMembershipCoordinator membership,
    ISprintRepository sprints,
    ICalendarEventRepository calendarEvents,
    ITaskEditLogRepository editLogs,
    IUnitOfWork unitOfWork) : IRequestHandler<SetTaskAttributesCommand, Result>
{
    public async Task<Result> Handle(SetTaskAttributesCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated)
            return Result.Forbidden("Authentication required.");
        var tenantId = currentUser.TenantId;
        var callerEmployeeId = await identity.ResolveCallerEmployeeIdAsync(tenantId, currentUser.UserId, ct);
        if (callerEmployeeId is null)
            return Result.Forbidden("No employee record for the current user.");

        var task = await tasks.GetTrackedByIdForTenantAsync(tenantId, request.TaskId, ct);
        if (task is null)
            return Result.NotFound("Task not found.");
        var objective = await objectives.GetByIdForTenantAsync(tenantId, task.ObjectiveId, ct);
        if (objective is null)
            return Result.NotFound("Objective not found.");
        if (!await membership.IsEffectiveOwnerAsync(tenantId, objective.Id, callerEmployeeId.Value, ct))
            return Result.Forbidden("Only this milestone's owner can change task priority or due date.");

        if (task.SprintId.HasValue)
        {
            var sprint = await sprints.GetByIdForTenantAsync(tenantId, task.SprintId.Value, ct);
            if (sprint is not null && sprint.Status == SprintStatuses.Achieved)
                return Result.Forbidden("This task's sprint has been achieved and is now frozen.");
        }

        var oldValues = new Dictionary<string, object?>();
        var newValues = new Dictionary<string, object?>();
        if (request.Priority is not null && request.Priority != task.Priority)
        {
            oldValues["priority"] = task.Priority;
            newValues["priority"] = request.Priority;
        }
        if (request.SetDueDate && request.DueDate != task.DueDate)
        {
            var windows = await calendarEvents.ListActiveEventWindowsForTaskAsync(tenantId, task.Id, task.ObjectiveId, ct);
            var windowError = TaskDueDateEventWindowRule.Validate(windows, request.DueDate);
            if (windowError is not null)
                return Result.Conflict(windowError);
            oldValues["dueDate"] = task.DueDate;
            newValues["dueDate"] = request.DueDate;
        }

        if (newValues.Count == 0)
            return Result.Success();

        var now = DateTimeOffset.UtcNow;
        if (newValues.ContainsKey("priority")) task.Priority = request.Priority!;
        if (newValues.ContainsKey("dueDate")) task.DueDate = request.DueDate;
        task.UpdatedAt = now;
        await editLogs.AddAsync(new TaskEditLog
        {
            Id = Guid.NewGuid(), TenantId = tenantId, TaskId = task.Id, EmployeeId = callerEmployeeId.Value,
            Source = TaskEditLogSources.Direct,
            OldValuesJson = JsonSerializer.Serialize(oldValues),
            NewValuesJson = JsonSerializer.Serialize(newValues),
            Reason = null, ChangedAt = now
        }, ct);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```
(`DateOnly` serialises as `"2026-10-05"` with System.Text.Json — the priority-only test asserts JSON exactly; the due-date tests assert the entity, not the JSON.)

- [ ] **Step 4: Run** → 7 passed.

- [ ] **Step 5: Commit**
```bash
git add src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/SetTaskAttributes/ tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/SetTaskAttributesCommandHandlerTests.cs
git commit -m "feat(work): add narrow set-task-attributes command for priority and due date"
```

---

### Task 4: Block deleting a task that has subtasks

**Files:**
- Modify: `src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/DeleteTask/DeleteTaskCommandHandler.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/DeleteTaskCommandHandlerTests.cs`

**Interfaces:**
- Consumes: `IWorkTaskRepository.GetTrackedByParentTaskIdAsync(Guid tenantId, Guid parentTaskId, CancellationToken)` → `IReadOnlyList<WorkTask>` (EF global filter already hides soft-deleted rows).
- Produces: 409 `This task has subtasks. Delete or move its subtasks first.` checked after the manager gate, before `Remove`.

- [ ] **Step 1: Write the failing test** (extend `FilterAwareTaskStore.Bind` to answer `GetTrackedByParentTaskIdAsync` from `_visible.Where(t => t.ParentTaskId == parentId)`):
```csharp
    [Fact]
    public async Task Handle_TaskWithLiveSubtasks_ReturnsConflict_AndKeepsTask()
    {
        var parent = new WorkTask { Id = TaskId, TenantId = TenantId, ObjectiveId = ObjectiveId, Title = "Parent" };
        var (handler, tasks, store) = Build(parent, OwnerEmployeeId);
        store.Seed(new WorkTask { Id = Guid.NewGuid(), TenantId = TenantId, ObjectiveId = ObjectiveId, ParentTaskId = TaskId, Title = "Child" });

        var result = await handler.Handle(new DeleteTaskCommand(TaskId), CancellationToken.None);

        Assert.Equal(409, result.StatusCode);
        Assert.Equal("This task has subtasks. Delete or move its subtasks first.", result.Error);
        tasks.Verify(t => t.Remove(It.IsAny<WorkTask>()), Times.Never);
    }
```
(Use the `WorkTask` initializer fields the file's other tests use; adapt the `Build` call to its real signature.)

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~DeleteTaskCommandHandlerTests"` → new test FAILS.

- [ ] **Step 3: Implement** — after the `IsEffectiveManagerAsync` check:
```csharp
        var children = await _tasks.GetTrackedByParentTaskIdAsync(tenantId, task.Id, ct);
        if (children is { Count: > 0 })
            return Result.Conflict("This task has subtasks. Delete or move its subtasks first.");
```

- [ ] **Step 4: Run** → all DeleteTask tests pass.

- [ ] **Step 5: Commit**
```bash
git add src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/DeleteTask/DeleteTaskCommandHandler.cs tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/DeleteTaskCommandHandlerTests.cs
git commit -m "fix(work): refuse to delete a task that still has subtasks"
```

---

### Task 5: Bulk task commands

**Files:**
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/DTOs/Responses/BulkTaskActionResponse.cs`
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/BulkTaskActions/BulkTaskActionCommands.cs` (all six records, validators and handlers — one feature, one file, like `ApproveLeaveRequestCommand.cs`)
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/BulkTaskActionCommandsTests.cs`

**Interfaces:**
- Consumes: `BulkItemRunner`, `BulkItemResult`, `BulkItemOutcomes` (Task 1); `BulkItemOutcome` (`ONEVO.Application.Features.CoreHr.Employee.Services`); single commands `MoveTaskStatusCommand(Guid TaskId, Guid NewStatusId) : IRequest<Result>`, `AssignTaskCommand(Guid TaskId, Guid EmployeeId) : IRequest<Result>`, `DeleteTaskCommand(Guid TaskId) : IRequest<Result>`, `ConvertTaskToSubtaskCommand(Guid TaskId, Guid NewParentTaskId) : IRequest<Result<WorkTaskResponse>>`, `SetTaskAttributesCommand` (Task 3).
- Produces:
  ```csharp
  public sealed record BulkTaskActionItemResponse(Guid TaskId, string Outcome, string? Reason);
  public sealed record BulkTaskActionResponse(IReadOnlyList<BulkTaskActionItemResponse> Items, int Succeeded, int Failed)
  { public static BulkTaskActionResponse From(IReadOnlyList<BulkItemResult> results); }
  public sealed record BulkMoveTaskStatusCommand(IReadOnlyList<Guid> TaskIds, Guid NewStatusId) : IRequest<Result<BulkTaskActionResponse>>;
  public sealed record BulkAssignTaskCommand(IReadOnlyList<Guid> TaskIds, Guid EmployeeId) : IRequest<Result<BulkTaskActionResponse>>;
  public sealed record BulkSetTaskPriorityCommand(IReadOnlyList<Guid> TaskIds, string Priority) : IRequest<Result<BulkTaskActionResponse>>;
  public sealed record BulkSetTaskDueDateCommand(IReadOnlyList<Guid> TaskIds, DateOnly? DueDate) : IRequest<Result<BulkTaskActionResponse>>;
  public sealed record BulkConvertTasksToSubtasksCommand(IReadOnlyList<Guid> TaskIds, Guid NewParentTaskId) : IRequest<Result<BulkTaskActionResponse>>;
  public sealed record BulkDeleteTasksCommand(IReadOnlyList<Guid> TaskIds) : IRequest<Result<BulkTaskActionResponse>>;
  // handlers: (IMediator mediator, IUnitOfWork unitOfWork, ILogger<THandler> logger)
  public const string BulkTaskActions.UnexpectedFailureReason = "Unexpected error while processing this task.";
  ```

- [ ] **Step 1: Write failing tests**
```csharp
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.AssignTask;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.BulkTaskActions;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.ConvertTaskToSubtask;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.DeleteTask;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.MoveTaskStatus;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.SetTaskAttributes;
using ONEVO.Application.Features.WorkManagement.Tasks.DTOs.Responses;
using ONEVO.Tests.Unit.Fakes;
using Xunit;

namespace ONEVO.Tests.Unit.Features.WorkManagement.Tasks;

public class BulkTaskActionCommandsTests
{
    private readonly Mock<IMediator> _mediator = new();
    private readonly FakeUnitOfWork _uow = new();
    private readonly Guid _a = Guid.NewGuid();
    private readonly Guid _b = Guid.NewGuid();

    private void Returns<TCommand>(Guid id, Result result) where TCommand : IRequest<Result> =>
        _mediator.Setup(m => m.Send(It.Is<TCommand>(c => (Guid)c.GetType().GetProperty("TaskId")!.GetValue(c)! == id), It.IsAny<CancellationToken>()))
            .ReturnsAsync(result);

    [Fact]
    public async Task BulkStatus_DispatchesPerTask_AndMapsFailures()
    {
        var statusId = Guid.NewGuid();
        Returns<MoveTaskStatusCommand>(_a, Result.Success());
        Returns<MoveTaskStatusCommand>(_b, Result.Forbidden("Members cannot move tasks into a private status."));

        var r = await new BulkMoveTaskStatusCommandHandler(_mediator.Object, _uow, NullLogger<BulkMoveTaskStatusCommandHandler>.Instance)
            .Handle(new BulkMoveTaskStatusCommand(new[] { _a, _b }, statusId), CancellationToken.None);

        Assert.Equal((1, 1), (r.Value!.Succeeded, r.Value.Failed));
        Assert.Equal("Members cannot move tasks into a private status.", r.Value.Items[1].Reason);
        _mediator.Verify(m => m.Send(It.Is<MoveTaskStatusCommand>(c => c.TaskId == _a && c.NewStatusId == statusId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkAssign_ReportsAlreadyAssignedAsFailedWithReason()
    {
        var emp = Guid.NewGuid();
        Returns<AssignTaskCommand>(_a, Result.Conflict("This employee is already assigned to the task."));

        var r = await new BulkAssignTaskCommandHandler(_mediator.Object, _uow, NullLogger<BulkAssignTaskCommandHandler>.Instance)
            .Handle(new BulkAssignTaskCommand(new[] { _a }, emp), CancellationToken.None);

        Assert.Equal("failed", r.Value!.Items[0].Outcome);
        _mediator.Verify(m => m.Send(It.Is<AssignTaskCommand>(c => c.EmployeeId == emp), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkPriority_And_BulkDueDate_UseSetTaskAttributes()
    {
        _mediator.Setup(m => m.Send(It.IsAny<SetTaskAttributesCommand>(), It.IsAny<CancellationToken>())).ReturnsAsync(Result.Success());

        await new BulkSetTaskPriorityCommandHandler(_mediator.Object, _uow, NullLogger<BulkSetTaskPriorityCommandHandler>.Instance)
            .Handle(new BulkSetTaskPriorityCommand(new[] { _a }, "high"), CancellationToken.None);
        await new BulkSetTaskDueDateCommandHandler(_mediator.Object, _uow, NullLogger<BulkSetTaskDueDateCommandHandler>.Instance)
            .Handle(new BulkSetTaskDueDateCommand(new[] { _b }, null), CancellationToken.None);

        _mediator.Verify(m => m.Send(It.Is<SetTaskAttributesCommand>(c => c.TaskId == _a && c.Priority == "high" && !c.SetDueDate), It.IsAny<CancellationToken>()), Times.Once);
        _mediator.Verify(m => m.Send(It.Is<SetTaskAttributesCommand>(c => c.TaskId == _b && c.Priority == null && c.SetDueDate && c.DueDate == null), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkConvert_DispatchesWithSharedParent()
    {
        var parent = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.IsAny<ConvertTaskToSubtaskCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<WorkTaskResponse>.Conflict("A subtask cannot itself have subtasks."));

        var r = await new BulkConvertTasksToSubtasksCommandHandler(_mediator.Object, _uow, NullLogger<BulkConvertTasksToSubtasksCommandHandler>.Instance)
            .Handle(new BulkConvertTasksToSubtasksCommand(new[] { _a }, parent), CancellationToken.None);

        Assert.Equal("A subtask cannot itself have subtasks.", r.Value!.Items[0].Reason);
        _mediator.Verify(m => m.Send(It.Is<ConvertTaskToSubtaskCommand>(c => c.TaskId == _a && c.NewParentTaskId == parent), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkDelete_DispatchesPerTask()
    {
        Returns<DeleteTaskCommand>(_a, Result.Success());
        Returns<DeleteTaskCommand>(_b, Result.Conflict("This task has subtasks. Delete or move its subtasks first."));

        var r = await new BulkDeleteTasksCommandHandler(_mediator.Object, _uow, NullLogger<BulkDeleteTasksCommandHandler>.Instance)
            .Handle(new BulkDeleteTasksCommand(new[] { _a, _b }), CancellationToken.None);

        Assert.Equal(new[] { "succeeded", "failed" }, r.Value!.Items.Select(i => i.Outcome));
        Assert.Equal(2, _uow.ClearTrackingCallCount);
    }

    [Fact]
    public void Validators_EnforceNonEmptyAndLimit()
    {
        var over = Enumerable.Range(0, 101).Select(_ => Guid.NewGuid()).ToList();
        Assert.False(new BulkDeleteTasksCommandValidator().Validate(new BulkDeleteTasksCommand(Array.Empty<Guid>())).IsValid);
        Assert.False(new BulkDeleteTasksCommandValidator().Validate(new BulkDeleteTasksCommand(over)).IsValid);
        Assert.False(new BulkSetTaskPriorityCommandValidator().Validate(new BulkSetTaskPriorityCommand(new[] { _a }, "urgent")).IsValid);
        Assert.False(new BulkMoveTaskStatusCommandValidator().Validate(new BulkMoveTaskStatusCommand(new[] { _a }, Guid.Empty)).IsValid);
        Assert.False(new BulkAssignTaskCommandValidator().Validate(new BulkAssignTaskCommand(new[] { _a }, Guid.Empty)).IsValid);
        Assert.False(new BulkConvertTasksToSubtasksCommandValidator().Validate(new BulkConvertTasksToSubtasksCommand(new[] { _a }, Guid.Empty)).IsValid);
        Assert.True(new BulkSetTaskDueDateCommandValidator().Validate(new BulkSetTaskDueDateCommand(new[] { _a }, null)).IsValid);
    }
}
```
(Namespaces of the single commands: confirm with `grep -rn "record MoveTaskStatusCommand\|record AssignTaskCommand\|record DeleteTaskCommand\|record ConvertTaskToSubtaskCommand" src` and fix the usings if a folder differs. Use the real already-assigned message from `AssignTaskCommandHandler` if you want, the test only asserts outcome.)

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~BulkTaskActionCommandsTests"` → build error.

- [ ] **Step 3: Implement**

`BulkTaskActionResponse.cs`:
```csharp
using ONEVO.Application.Common.Services;

namespace ONEVO.Application.Features.WorkManagement.Tasks.DTOs.Responses;

public sealed record BulkTaskActionItemResponse(Guid TaskId, string Outcome, string? Reason);

public sealed record BulkTaskActionResponse(IReadOnlyList<BulkTaskActionItemResponse> Items, int Succeeded, int Failed)
{
    public static BulkTaskActionResponse From(IReadOnlyList<BulkItemResult> results) => new(
        results.Select(r => new BulkTaskActionItemResponse(r.Id, r.Outcome, r.Reason)).ToList(),
        results.Count(r => r.Outcome == BulkItemOutcomes.Succeeded),
        results.Count(r => r.Outcome == BulkItemOutcomes.Failed));
}
```

`BulkTaskActionCommands.cs`:
```csharp
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.RepositoryInterfaces;
using ONEVO.Application.Common.Services;
using ONEVO.Application.Features.CoreHr.Employee.Services;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.AssignTask;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.ConvertTaskToSubtask;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.DeleteTask;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.MoveTaskStatus;
using ONEVO.Application.Features.WorkManagement.Tasks.Commands.SetTaskAttributes;
using ONEVO.Application.Features.WorkManagement.Tasks.DTOs.Responses;
using ONEVO.Domain.Features.WorkManagement.Tasks.Entities;

namespace ONEVO.Application.Features.WorkManagement.Tasks.Commands.BulkTaskActions;

public static class BulkTaskActions
{
    public const string UnexpectedFailureReason = "Unexpected error while processing this task.";

    internal static IRuleBuilderOptions<T, IReadOnlyList<Guid>> ValidTaskIds<T>(this IRuleBuilder<T, IReadOnlyList<Guid>> rule) =>
        rule.NotEmpty()
            .Must(ids => ids.Distinct().Count() <= BulkItemRunner.MaxItems)
            .WithMessage($"A bulk action can include at most {BulkItemRunner.MaxItems} tasks.");

    internal static async Task<Result<BulkTaskActionResponse>> RunAsync(
        IReadOnlyList<Guid> taskIds,
        Func<Guid, CancellationToken, Task<Result>> sendOne,
        IUnitOfWork unitOfWork, ILogger logger, CancellationToken ct)
    {
        var results = await BulkItemRunner.RunAsync(taskIds, async (id, token) =>
        {
            var result = await sendOne(id, token);
            return new BulkItemOutcome(result.IsSuccess, false, result.Error);
        }, unitOfWork, logger, UnexpectedFailureReason, ct);
        return Result<BulkTaskActionResponse>.Success(BulkTaskActionResponse.From(results));
    }
}

// ---- Status ----
public sealed record BulkMoveTaskStatusCommand(IReadOnlyList<Guid> TaskIds, Guid NewStatusId) : IRequest<Result<BulkTaskActionResponse>>;
public sealed class BulkMoveTaskStatusCommandValidator : AbstractValidator<BulkMoveTaskStatusCommand>
{
    public BulkMoveTaskStatusCommandValidator() { RuleFor(x => x.TaskIds).ValidTaskIds(); RuleFor(x => x.NewStatusId).NotEmpty(); }
}
public sealed class BulkMoveTaskStatusCommandHandler(IMediator mediator, IUnitOfWork unitOfWork, ILogger<BulkMoveTaskStatusCommandHandler> logger)
    : IRequestHandler<BulkMoveTaskStatusCommand, Result<BulkTaskActionResponse>>
{
    public Task<Result<BulkTaskActionResponse>> Handle(BulkMoveTaskStatusCommand c, CancellationToken ct) =>
        BulkTaskActions.RunAsync(c.TaskIds, (id, t) => mediator.Send(new MoveTaskStatusCommand(id, c.NewStatusId), t), unitOfWork, logger, ct);
}

// ---- Assign ----
public sealed record BulkAssignTaskCommand(IReadOnlyList<Guid> TaskIds, Guid EmployeeId) : IRequest<Result<BulkTaskActionResponse>>;
public sealed class BulkAssignTaskCommandValidator : AbstractValidator<BulkAssignTaskCommand>
{
    public BulkAssignTaskCommandValidator() { RuleFor(x => x.TaskIds).ValidTaskIds(); RuleFor(x => x.EmployeeId).NotEmpty(); }
}
public sealed class BulkAssignTaskCommandHandler(IMediator mediator, IUnitOfWork unitOfWork, ILogger<BulkAssignTaskCommandHandler> logger)
    : IRequestHandler<BulkAssignTaskCommand, Result<BulkTaskActionResponse>>
{
    public Task<Result<BulkTaskActionResponse>> Handle(BulkAssignTaskCommand c, CancellationToken ct) =>
        BulkTaskActions.RunAsync(c.TaskIds, (id, t) => mediator.Send(new AssignTaskCommand(id, c.EmployeeId), t), unitOfWork, logger, ct);
}

// ---- Priority ----
public sealed record BulkSetTaskPriorityCommand(IReadOnlyList<Guid> TaskIds, string Priority) : IRequest<Result<BulkTaskActionResponse>>;
public sealed class BulkSetTaskPriorityCommandValidator : AbstractValidator<BulkSetTaskPriorityCommand>
{
    private static readonly string[] Priorities = { WorkTaskPriorities.Low, WorkTaskPriorities.Medium, WorkTaskPriorities.High, WorkTaskPriorities.Critical };
    public BulkSetTaskPriorityCommandValidator()
    {
        RuleFor(x => x.TaskIds).ValidTaskIds();
        RuleFor(x => x.Priority).Must(p => Priorities.Contains(p)).WithMessage("Priority must be one of: low, medium, high, critical.");
    }
}
public sealed class BulkSetTaskPriorityCommandHandler(IMediator mediator, IUnitOfWork unitOfWork, ILogger<BulkSetTaskPriorityCommandHandler> logger)
    : IRequestHandler<BulkSetTaskPriorityCommand, Result<BulkTaskActionResponse>>
{
    public Task<Result<BulkTaskActionResponse>> Handle(BulkSetTaskPriorityCommand c, CancellationToken ct) =>
        BulkTaskActions.RunAsync(c.TaskIds, (id, t) => mediator.Send(new SetTaskAttributesCommand(id, c.Priority, false, null), t), unitOfWork, logger, ct);
}

// ---- Due date ----
public sealed record BulkSetTaskDueDateCommand(IReadOnlyList<Guid> TaskIds, DateOnly? DueDate) : IRequest<Result<BulkTaskActionResponse>>;
public sealed class BulkSetTaskDueDateCommandValidator : AbstractValidator<BulkSetTaskDueDateCommand>
{
    public BulkSetTaskDueDateCommandValidator() { RuleFor(x => x.TaskIds).ValidTaskIds(); }
}
public sealed class BulkSetTaskDueDateCommandHandler(IMediator mediator, IUnitOfWork unitOfWork, ILogger<BulkSetTaskDueDateCommandHandler> logger)
    : IRequestHandler<BulkSetTaskDueDateCommand, Result<BulkTaskActionResponse>>
{
    public Task<Result<BulkTaskActionResponse>> Handle(BulkSetTaskDueDateCommand c, CancellationToken ct) =>
        BulkTaskActions.RunAsync(c.TaskIds, (id, t) => mediator.Send(new SetTaskAttributesCommand(id, null, true, c.DueDate), t), unitOfWork, logger, ct);
}

// ---- Convert to subtask ----
public sealed record BulkConvertTasksToSubtasksCommand(IReadOnlyList<Guid> TaskIds, Guid NewParentTaskId) : IRequest<Result<BulkTaskActionResponse>>;
public sealed class BulkConvertTasksToSubtasksCommandValidator : AbstractValidator<BulkConvertTasksToSubtasksCommand>
{
    public BulkConvertTasksToSubtasksCommandValidator() { RuleFor(x => x.TaskIds).ValidTaskIds(); RuleFor(x => x.NewParentTaskId).NotEmpty(); }
}
public sealed class BulkConvertTasksToSubtasksCommandHandler(IMediator mediator, IUnitOfWork unitOfWork, ILogger<BulkConvertTasksToSubtasksCommandHandler> logger)
    : IRequestHandler<BulkConvertTasksToSubtasksCommand, Result<BulkTaskActionResponse>>
{
    public Task<Result<BulkTaskActionResponse>> Handle(BulkConvertTasksToSubtasksCommand c, CancellationToken ct) =>
        BulkTaskActions.RunAsync(c.TaskIds, async (id, t) =>
        {
            var r = await mediator.Send(new ConvertTaskToSubtaskCommand(id, c.NewParentTaskId), t);
            return r.IsSuccess ? Result.Success() : Result.Failure(r.Error!, r.StatusCode ?? 400);
        }, unitOfWork, logger, ct);
}

// ---- Delete ----
public sealed record BulkDeleteTasksCommand(IReadOnlyList<Guid> TaskIds) : IRequest<Result<BulkTaskActionResponse>>;
public sealed class BulkDeleteTasksCommandValidator : AbstractValidator<BulkDeleteTasksCommand>
{
    public BulkDeleteTasksCommandValidator() { RuleFor(x => x.TaskIds).ValidTaskIds(); }
}
public sealed class BulkDeleteTasksCommandHandler(IMediator mediator, IUnitOfWork unitOfWork, ILogger<BulkDeleteTasksCommandHandler> logger)
    : IRequestHandler<BulkDeleteTasksCommand, Result<BulkTaskActionResponse>>
{
    public Task<Result<BulkTaskActionResponse>> Handle(BulkDeleteTasksCommand c, CancellationToken ct) =>
        BulkTaskActions.RunAsync(c.TaskIds, (id, t) => mediator.Send(new DeleteTaskCommand(id), t), unitOfWork, logger, ct);
}
```
(If an extension method can't live in a non-generic static class that also has other members in your C# settings, move `ValidTaskIds` into its own `internal static class BulkTaskIdRules`. If `Result.Failure` has a different signature, use the one `Result.cs` defines.)

- [ ] **Step 4: Run** → 6 passed.

- [ ] **Step 5: Commit**
```bash
git add src/ONEVO.Application/Features/WorkManagement/Tasks/DTOs/Responses/BulkTaskActionResponse.cs src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/BulkTaskActions/ tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/BulkTaskActionCommandsTests.cs
git commit -m "feat(work): add bulk task status/assign/priority/due-date/convert/delete commands"
```

---

### Task 6: Bulk endpoints on `TasksController`

**Files:**
- Create: `src/ONEVO.Api/Contracts/WorkManagement/Tasks/BulkTaskRequests.cs` (use the namespace/folder where `ConvertTaskToSubtaskRequest` lives — `grep -rn "record ConvertTaskToSubtaskRequest" src/ONEVO.Api`)
- Modify: `src/ONEVO.Api/Controllers/Tenant/WorkManagement/TasksController.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/TasksControllerBulkTests.cs` (or append to an existing TasksController test class if one exists — `grep -rln "new TasksController(" tests`)

**Interfaces:**
- Produces (route prefix `api/v1/work`, no endpoint permission attribute — same as every other task action; authorization is per item in the handlers):
  - `POST tasks/bulk/status` `{ taskIds, newStatusId }`
  - `POST tasks/bulk/assign` `{ taskIds, employeeId }`
  - `POST tasks/bulk/priority` `{ taskIds, priority }`
  - `POST tasks/bulk/due-date` `{ taskIds, dueDate }` (`dueDate` null ⇒ clear)
  - `POST tasks/bulk/convert-to-subtask` `{ taskIds, newParentTaskId }`
  - `POST tasks/bulk/delete` `{ taskIds }`
  - each → `200 OK` `BulkTaskActionResponse`

- [ ] **Step 1: Write failing tests** — one test per endpoint of this shape (six total), constructing the controller the way existing controller tests do (`new TasksController(mediator.Object)`; if its constructor takes more, pass mocks):
```csharp
    [Fact]
    public async Task BulkPriority_SendsCommand_AndReturnsOk()
    {
        var ids = new[] { Guid.NewGuid() };
        var response = BulkTaskActionResponse.From(Array.Empty<BulkItemResult>());
        _mediator.Setup(m => m.Send(It.IsAny<BulkSetTaskPriorityCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<BulkTaskActionResponse>.Success(response));

        var result = await _sut.BulkSetPriority(new BulkSetTaskPriorityRequest(ids, "high"), CancellationToken.None);

        Assert.Same(response, Assert.IsType<OkObjectResult>(result).Value);
        _mediator.Verify(m => m.Send(It.Is<BulkSetTaskPriorityCommand>(c => c.TaskIds.SequenceEqual(ids) && c.Priority == "high"), It.IsAny<CancellationToken>()), Times.Once);
    }
```
Actions/requests to cover: `BulkMoveStatus(BulkMoveTaskStatusRequest)`, `BulkAssign(BulkAssignTaskRequest)`, `BulkSetPriority(BulkSetTaskPriorityRequest)`, `BulkSetDueDate(BulkSetTaskDueDateRequest)` (assert `DueDate == null` passes through), `BulkConvertToSubtask(BulkConvertTasksToSubtasksRequest)`, `BulkDelete(BulkDeleteTasksRequest)`.

- [ ] **Step 2: Run** → build error.

- [ ] **Step 3: Implement**

Requests:
```csharp
public sealed record BulkMoveTaskStatusRequest(IReadOnlyList<Guid> TaskIds, Guid NewStatusId);
public sealed record BulkAssignTaskRequest(IReadOnlyList<Guid> TaskIds, Guid EmployeeId);
public sealed record BulkSetTaskPriorityRequest(IReadOnlyList<Guid> TaskIds, string Priority);
public sealed record BulkSetTaskDueDateRequest(IReadOnlyList<Guid> TaskIds, DateOnly? DueDate);
public sealed record BulkConvertTasksToSubtasksRequest(IReadOnlyList<Guid> TaskIds, Guid NewParentTaskId);
public sealed record BulkDeleteTasksRequest(IReadOnlyList<Guid> TaskIds);
```
Controller (next to the single-task actions; one shown, the other five identical in shape):
```csharp
    /// <summary>Bulk actions run the single-task command per task; the response reports each task's outcome.</summary>
    [HttpPost("tasks/bulk/priority")]
    public async Task<IActionResult> BulkSetPriority([FromBody] BulkSetTaskPriorityRequest request, CancellationToken ct)
    {
        var result = await _mediator.Send(new BulkSetTaskPriorityCommand(request.TaskIds, request.Priority), ct);
        return result.IsSuccess ? Ok(result.Value) : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }
```
Write all six explicitly: `tasks/bulk/status` → `BulkMoveStatus` → `BulkMoveTaskStatusCommand(request.TaskIds, request.NewStatusId)`; `tasks/bulk/assign` → `BulkAssign` → `BulkAssignTaskCommand(request.TaskIds, request.EmployeeId)`; `tasks/bulk/due-date` → `BulkSetDueDate` → `BulkSetTaskDueDateCommand(request.TaskIds, request.DueDate)`; `tasks/bulk/convert-to-subtask` → `BulkConvertToSubtask` → `BulkConvertTasksToSubtasksCommand(request.TaskIds, request.NewParentTaskId)`; `tasks/bulk/delete` → `BulkDelete` → `BulkDeleteTasksCommand(request.TaskIds)`. Use the controller's existing mediator field name and error-mapping style (copy from its `ConvertToSubtask` action).

- [ ] **Step 4: Run** the controller tests + `dotnet test tests/ONEVO.Tests.Architecture/ONEVO.Tests.Architecture.csproj` → pass.

- [ ] **Step 5: Commit**
```bash
git add src/ONEVO.Api/Contracts/WorkManagement/Tasks/BulkTaskRequests.cs src/ONEVO.Api/Controllers/Tenant/WorkManagement/TasksController.cs <controller test file>
git commit -m "feat(api): expose task bulk action endpoints"
```

---

### Task 7: Backend full verification

- [ ] Kill `ONEVO.Api.exe`; run the Unit, Architecture and Integration test projects; paste raw summaries. Pre-existing failures in untouched files: report with `git log -1 -- <file>`, don't fix.
- [ ] Manual smoke as a module owner: `POST /api/v1/work/tasks/bulk/priority` with two task ids + `"priority":"high"` → 200, `succeeded: 2`; with `"priority":"urgent"` → 400. `POST .../tasks/bulk/delete` on a parent task that has a subtask → 200 with that item `failed` and the subtask message.

---

## Part 2 — Frontend (paths relative to `src/app/`)

### Task 8: Shared result modal + task bulk API

**Files:**
- Create: `shared/ui/bulk-action-result-modal/bulk-action-result-modal.component.ts` (moved + generalised)
- Create: `shared/ui/bulk-action-result-modal/bulk-action-result-modal.component.spec.ts`
- Delete: `modules/people/ui/bulk-employee-actions/bulk-action-result-modal.component.ts` (`git mv` then edit)
- Modify: `modules/people/ui/bulk-employee-actions/bulk-employee-actions.spec.ts` (drop the result-modal test — it moves to the shared spec)
- Modify: `modules/people/feature/employee-list/employee-list.component.ts` / `.html` (import path + adapter)
- Modify: `modules/work/data-access/task-api.service.ts`, `modules/work/models/task.model.ts`
- Test: `modules/work/data-access/task-api.service.spec.ts` (create if absent)

**Interfaces:**
- Produces:
  ```ts
  // shared/ui/bulk-action-result-modal/bulk-action-result-modal.component.ts
  export interface BulkResultSummary {
    readonly items: readonly { readonly id: string; readonly outcome: 'succeeded' | 'pendingApproval' | 'failed'; readonly reason: string | null }[];
    readonly succeeded: number; readonly pendingApproval: number; readonly failed: number;
  }
  // selector 'app-bulk-action-result-modal'; inputs result: BulkResultSummary | null, title: string, names: ReadonlyMap<string,string>, noun: string ('item'); output closed
  // test ids unchanged: bulk-result-summary, bulk-result-failure-<id>
  // summary text: "{succeeded} changed · {pendingApproval} sent for approval · {failed} skipped" — the
  //   "sent for approval" segment is omitted when pendingApproval === 0 AND the input showApprovals is false (default true)
  // task.model.ts
  export interface BulkTaskActionItem { readonly taskId: string; readonly outcome: 'succeeded' | 'failed'; readonly reason: string | null; }
  export interface BulkTaskActionResponse { readonly items: readonly BulkTaskActionItem[]; readonly succeeded: number; readonly failed: number; }
  export function toBulkResultSummary(r: BulkTaskActionResponse): BulkResultSummary;
  // TaskApiService (base `${apiUrl}/work`)
  bulkMoveStatus(taskIds: string[], newStatusId: string): Observable<BulkTaskActionResponse>          // POST tasks/bulk/status
  bulkAssign(taskIds: string[], employeeId: string): Observable<BulkTaskActionResponse>               // POST tasks/bulk/assign
  bulkSetPriority(taskIds: string[], priority: WorkTask['priority']): Observable<BulkTaskActionResponse> // POST tasks/bulk/priority
  bulkSetDueDate(taskIds: string[], dueDate: string | null): Observable<BulkTaskActionResponse>     // POST tasks/bulk/due-date
  bulkConvertToSubtask(taskIds: string[], newParentTaskId: string): Observable<BulkTaskActionResponse> // POST tasks/bulk/convert-to-subtask
  bulkDelete(taskIds: string[]): Observable<BulkTaskActionResponse>                                  // POST tasks/bulk/delete
  // employee list: toEmployeeBulkSummary(r: BulkEmployeeActionResponse): BulkResultSummary (maps employeeId → id), in modules/people/models/employee.model.ts
  ```

- [ ] **Step 1: Write failing tests**

`shared/ui/bulk-action-result-modal/bulk-action-result-modal.component.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { BulkActionResultModalComponent, BulkResultSummary } from './bulk-action-result-modal.component';

const summary: BulkResultSummary = {
  items: [
    { id: 'a', outcome: 'succeeded', reason: null },
    { id: 'c', outcome: 'failed', reason: 'This task has subtasks. Delete or move its subtasks first.' }
  ],
  succeeded: 1, pendingApproval: 0, failed: 1
};

function render(showApprovals: boolean) {
  const fixture = TestBed.createComponent(BulkActionResultModalComponent);
  fixture.componentRef.setInput('result', summary);
  fixture.componentRef.setInput('title', 'Delete results');
  fixture.componentRef.setInput('names', new Map([['c', 'Write docs']]));
  fixture.componentRef.setInput('showApprovals', showApprovals);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('BulkActionResultModalComponent', () => {
  it('summarises counts and lists failures by name', () => {
    const el = render(true);
    expect(el.querySelector('[data-testid="bulk-result-summary"]')!.textContent).toContain('1 changed · 0 sent for approval · 1 skipped');
    expect(el.querySelector('[data-testid="bulk-result-failure-c"]')!.textContent).toContain('Write docs');
  });

  it('omits the approvals segment when not applicable', () => {
    const el = render(false);
    expect(el.querySelector('[data-testid="bulk-result-summary"]')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('1 changed · 1 skipped');
  });
});
```
`task-api.service.spec.ts` (HttpTestingController):
```ts
  it('posts each bulk action to its endpoint', () => {
    const ok = { items: [], succeeded: 0, failed: 0 };
    service.bulkMoveStatus(['a'], 's').subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/work/tasks/bulk/status') && r.body.newStatusId === 's').flush(ok);
    service.bulkAssign(['a'], 'e').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/assign') && r.body.employeeId === 'e').flush(ok);
    service.bulkSetPriority(['a'], 'high').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/priority') && r.body.priority === 'high').flush(ok);
    service.bulkSetDueDate(['a'], null).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/due-date') && r.body.dueDate === null).flush(ok);
    service.bulkConvertToSubtask(['a'], 'p').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/convert-to-subtask') && r.body.newParentTaskId === 'p').flush(ok);
    service.bulkDelete(['a']).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/work/tasks/bulk/delete') && r.body.taskIds[0] === 'a').flush(ok);
  });
```

- [ ] **Step 2: Run** both specs → FAIL.

- [ ] **Step 3: Implement**
1. `git mv src/app/modules/people/ui/bulk-employee-actions/bulk-action-result-modal.component.ts src/app/shared/ui/bulk-action-result-modal/bulk-action-result-modal.component.ts`; fix its relative imports (`../modal/modal.component`, `../button/button.component`); replace the `BulkEmployeeActionResponse` input type with `BulkResultSummary` (declare the interface in this file); change `failures` to filter `item.outcome === 'failed'` and track `item.id`; test id `'bulk-result-failure-' + item.id`; add `readonly showApprovals = input(true);` and render the summary as:
   ```html
   {{ r.succeeded }} changed ·@if (showApprovals()) { {{ r.pendingApproval }} sent for approval ·} {{ r.failed }} skipped
   ```
2. Employee list: add to `employee.model.ts`
   ```ts
   export function toEmployeeBulkSummary(r: BulkEmployeeActionResponse): BulkResultSummary {
     return { ...r, items: r.items.map((i) => ({ id: i.employeeId, outcome: i.outcome, reason: i.reason })) };
   }
   ```
   (import the type from the shared component file), update the component import path, and in the template pass `[result]="bulkResult() ? toEmployeeBulkSummary(bulkResult()!.result) : null"` (expose `toEmployeeBulkSummary` as a component field). Remove the moved test from `bulk-employee-actions.spec.ts`.
3. `task.model.ts`: add `BulkTaskActionItem`, `BulkTaskActionResponse`, and
   ```ts
   export function toBulkResultSummary(r: BulkTaskActionResponse): BulkResultSummary {
     return { items: r.items.map((i) => ({ id: i.taskId, outcome: i.outcome, reason: i.reason })), succeeded: r.succeeded, pendingApproval: 0, failed: r.failed };
   }
   ```
4. `task-api.service.ts` — six methods, each `this.http.post<BulkTaskActionResponse>(`${this.baseUrl}/tasks/bulk/<path>`, { taskIds, ...field })` (use the service's existing base-URL field name).

- [ ] **Step 4: Run** the two new specs + `modules/people/feature/employee-list/employee-list.component.spec.ts` + `modules/people/ui/bulk-employee-actions/bulk-employee-actions.spec.ts` → all pass.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/shared/ui/bulk-action-result-modal/ src/app/modules/people/ui/bulk-employee-actions/ src/app/modules/people/models/employee.model.ts src/app/modules/people/feature/employee-list/employee-list.component.ts src/app/modules/work/data-access/task-api.service.ts src/app/modules/work/data-access/task-api.service.spec.ts src/app/modules/work/models/task.model.ts
git commit -m "feat(work): task bulk API; move bulk result modal to shared"
```
⚠ `employee-list.component.html` has **another session's uncommitted edits**. Make the one-line `[result]` change with `Edit`, then stage only that hunk: `git add -p src/app/modules/people/feature/employee-list/employee-list.component.html` and accept only your hunk. If the hunks are entangled, stop and tell the user instead of committing their work.

---

### Task 9: Selection inside sprint sections

**Files:**
- Modify: `modules/work/ui/sprint-tab/sprint-tab.component.ts`
- Test: `modules/work/ui/sprint-tab/sprint-tab.component.spec.ts`

**Interfaces:**
- Produces on `app-sprint-tab`: inputs `selectable = input(false)`, `selectedIds = input<ReadonlySet<string>>(new Set())`; outputs `taskSelectionChanged = output<{ taskId: string; selected: boolean }>()`, `taskSelectAllChanged = output<{ taskIds: string[]; selected: boolean }>()` — passed straight to/from its inner `app-task-table` (`selectable`, `selectedIds`, `selectionChanged`, `selectAllChanged`).

- [ ] **Step 1: Write failing test** (in the existing spec's setup, render an expanded, non-complete sprint with one task whose objective is in `objectiveOwners` as `true`):
```ts
  it('passes selection through to its task table and re-emits changes', async () => {
    fixture.componentRef.setInput('selectable', true);
    fixture.componentRef.setInput('selectedIds', new Set(['t1']));
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('[data-testid="task-select-t1"]') as HTMLInputElement;
    expect(box.checked).toBe(true);
    const emitted = vi.fn();
    fixture.componentInstance.taskSelectionChanged.subscribe(emitted);
    box.click();
    expect(emitted).toHaveBeenCalledWith({ taskId: 't1', selected: false });
  });
```
- [ ] **Step 2: Run** `npx ng test --watch=false --include=src/app/modules/work/ui/sprint-tab/sprint-tab.component.spec.ts` → FAIL.
- [ ] **Step 3: Implement** — add the two inputs/outputs and on the inner table:
```html
            [selectable]="selectable()"
            [selectedIds]="selectedIds()"
            (selectionChanged)="taskSelectionChanged.emit($event)"
            (selectAllChanged)="taskSelectAllChanged.emit($event)"
```
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** `git add src/app/modules/work/ui/sprint-tab/` → `git commit -m "feat(work): sprint sections support row selection"`

---

### Task 10: `<app-bulk-task-picker-dialog>`

**Files:**
- Create: `modules/work/ui/bulk-task-picker-dialog/bulk-task-picker-dialog.component.ts`
- Test: `modules/work/ui/bulk-task-picker-dialog/bulk-task-picker-dialog.component.spec.ts`

**Interfaces:**
- Consumes: `ModalComponent`, `ButtonComponent`, `CustomSelectComponent` (`shared/ui/custom-select`: `label`, `placeholder`, `options: SelectOption[]`, `value`, `valueChange`), `DatePickerComponent` (`label`, `value`, `valueChange`).
- Produces:
  ```ts
  export type BulkTaskPickerMode = 'status' | 'priority' | 'assignee' | 'dueDate' | 'parent';
  // selector 'app-bulk-task-picker-dialog'
  mode = input.required<BulkTaskPickerMode | null>();   // null ⇒ closed
  count = input.required<number>();
  options = input<readonly SelectOption[]>([]);          // status / assignee / parent options (priority uses its own fixed list)
  submitting = input(false);
  error = input<string | null>(null);
  confirmed = output<string | null>();   // the chosen value; dueDate mode may emit null (= clear)
  closed = output<void>();
  // test ids: bulk-picker-submit, bulk-picker-clear-date
  ```

- [ ] **Step 1: Write failing tests**
```ts
import { TestBed } from '@angular/core/testing';
import { BulkTaskPickerDialogComponent } from './bulk-task-picker-dialog.component';

function create(mode: string, options = [{ value: 's1', label: 'Done' }]) {
  const fixture = TestBed.createComponent(BulkTaskPickerDialogComponent);
  fixture.componentRef.setInput('mode', mode);
  fixture.componentRef.setInput('count', 3);
  fixture.componentRef.setInput('options', options);
  fixture.detectChanges();
  const confirmed = vi.fn();
  fixture.componentInstance.confirmed.subscribe(confirmed);
  return { fixture, inst: fixture.componentInstance as unknown as { value: { set(v: string): void }; canSubmit(): boolean; submit(): void; clearDate(): void; title(): string }, confirmed };
}

describe('BulkTaskPickerDialogComponent', () => {
  it('titles by mode and count', () => {
    expect(create('status').inst.title()).toBe('Change status · 3 tasks');
    expect(create('parent').inst.title()).toBe('Convert to subtask · 3 tasks');
  });

  it('requires a value before submitting and emits it', () => {
    const { inst, confirmed } = create('status');
    expect(inst.canSubmit()).toBe(false);
    inst.value.set('s1');
    inst.submit();
    expect(confirmed).toHaveBeenCalledWith('s1');
  });

  it('priority mode offers the four priorities without needing options', () => {
    const { fixture } = create('priority', []);
    const opts = (fixture.componentInstance as unknown as { effectiveOptions(): { value: string }[] }).effectiveOptions().map((o) => o.value);
    expect(opts).toEqual(['low', 'medium', 'high', 'critical']);
  });

  it('due date mode can clear the date', () => {
    const { inst, confirmed } = create('dueDate', []);
    inst.clearDate();
    expect(confirmed).toHaveBeenCalledWith(null);
  });
});
```
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement**
```ts
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CustomSelectComponent } from '../../../../shared/ui/custom-select/custom-select.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';

export type BulkTaskPickerMode = 'status' | 'priority' | 'assignee' | 'dueDate' | 'parent';

const TITLES: Record<BulkTaskPickerMode, string> = {
  status: 'Change status', priority: 'Set priority', assignee: 'Add assignee', dueDate: 'Set due date', parent: 'Convert to subtask'
};
const LABELS: Record<Exclude<BulkTaskPickerMode, 'dueDate'>, string> = {
  status: 'Status', priority: 'Priority', assignee: 'Assignee', parent: 'Parent task'
};
const PRIORITIES: SelectOption[] = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
];

@Component({
  selector: 'app-bulk-task-picker-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, CustomSelectComponent, DatePickerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="mode() !== null" [title]="title()" (closed)="closed.emit()">
      <div class="flex flex-col gap-4">
        @if (mode() === 'dueDate') {
          <app-date-picker label="Due date" [value]="value()" (valueChange)="value.set($event)" />
        } @else if (mode()) {
          <app-custom-select [label]="label()" placeholder="Select…" [options]="effectiveOptions()" [value]="value()" (valueChange)="value.set($event)" />
        }
        @if (mode() === 'parent') {
          <p class="text-xs text-[var(--color-text-secondary)]">Subtasks leave their sprint. Tasks that already have subtasks bring them along.</p>
        }
        @if (error(); as message) { <p class="text-xs text-[var(--color-danger-text)]">{{ message }}</p> }
        <div class="flex justify-end gap-2">
          @if (mode() === 'dueDate') {
            <app-button variant="secondary" data-testid="bulk-picker-clear-date" [disabled]="submitting()" (pressed)="clearDate()">Clear due date</app-button>
          }
          <app-button variant="secondary" (pressed)="closed.emit()">Cancel</app-button>
          <app-button data-testid="bulk-picker-submit" [loading]="submitting()" [disabled]="!canSubmit()" (pressed)="submit()">Apply</app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkTaskPickerDialogComponent {
  readonly mode = input.required<BulkTaskPickerMode | null>();
  readonly count = input.required<number>();
  readonly options = input<readonly SelectOption[]>([]);
  readonly submitting = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output<string | null>();
  readonly closed = output<void>();

  protected readonly value = signal('');
  protected readonly title = computed(() => {
    const mode = this.mode();
    return mode ? `${TITLES[mode]} · ${this.count()} task${this.count() === 1 ? '' : 's'}` : '';
  });
  protected readonly label = computed(() => { const m = this.mode(); return m && m !== 'dueDate' ? LABELS[m] : ''; });
  protected readonly effectiveOptions = computed(() => (this.mode() === 'priority' ? PRIORITIES : [...this.options()]));
  protected readonly canSubmit = computed(() => !!this.value() && !this.submitting());

  constructor() {
    // Fresh value each time the dialog opens in a (possibly different) mode.
    effect(() => { this.mode(); this.value.set(''); });
  }

  protected submit(): void {
    if (this.canSubmit()) this.confirmed.emit(this.value());
  }

  protected clearDate(): void {
    this.confirmed.emit(null);
  }
}
```
- [ ] **Step 4: Run** → 4 passed.
- [ ] **Step 5: Commit** `git add src/app/modules/work/ui/bulk-task-picker-dialog/` → `git commit -m "feat(work): add bulk task picker dialog"`

---

### Task 11: Wire bulk actions into the backlog

**Files:**
- Modify: `modules/work/feature/task-backlog/task-backlog.component.ts`
- Modify: `modules/work/feature/task-backlog/task-backlog.component.spec.ts`

**Interfaces:**
- Consumes: Task 8 (`TaskApiService.bulk*`, `toBulkResultSummary`, `BulkActionResultModalComponent` with `showApprovals`), Task 9 (`app-sprint-tab` selection I/O), Task 10 (`BulkTaskPickerDialogComponent`, `BulkTaskPickerMode`), `SprintApiService.setTasks(sprintId, { addTaskIds, removeTaskIds })` (`modules/work/data-access/sprint-api.service`), `ConfirmModalComponent` (`shared/ui/confirm-modal`: inputs `open`, `title`, `message`, `confirmLabel`, `loading`, `errorMessage`; outputs `confirmed`, `cancelled`), existing `selection` (`SelectionModel`), `moveTargets`, `MoveTasksToSprintDialog`, `moveUndoBanner`, `modules()` (`isOwner` = member-or-owner, `isEffectiveOwner` = owner), `store.statuses()` (`visibility: 'public' | 'private'`), `assignableMembers()`.
- Produces: bulk action ids `status`, `assign`, `priority` (primary); `due-date`, `move-to-sprint`, `move-to-backlog`, `convert-to-subtask`, `delete` (more). Owner-only ids: `priority`, `due-date`, `move-to-sprint`, `move-to-backlog` — disabled with reason `You can only do this for tasks in modules you own.` when any selected task's module is not `isEffectiveOwner`.

- [ ] **Step 1: Update the spec (failing)** — in the `bulk select and move to sprint` block (rename it `bulk actions`), keep existing tests that still apply; change the move tests' API expectation from `taskApi.editTask` to `SprintApiService.setTasks` (provide `{ provide: SprintApiService, useValue: { setTasks: vi.fn(() => of({})) } }` in `setup`, and `bulkMoveStatus/bulkAssign/bulkSetPriority/bulkSetDueDate/bulkConvertToSubtask/bulkDelete: vi.fn(() => of({ items: [], succeeded: 1, failed: 0 }))` on the TaskApiService mock). Add:
```ts
    it('rows inside an expanded sprint are selectable and count toward the bulk bar', async () => {
      // arrange: one sprint task (sprintId 'sp-1', owned module) + one backlog task; expand sp-1
      (fixture.nativeElement.querySelector('[data-testid="task-select-t-in-sprint"]') as HTMLInputElement).click();
      (fixture.nativeElement.querySelector('[data-testid="task-select-t-a"]') as HTMLInputElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]').textContent).toContain('2 tasks selected');
    });

    it('owner-only actions are disabled with a reason when a selected module is not effectively owned', async () => {
      // arrange: backlog task in milestone-2 where isOwner true, isEffectiveOwner false; select it
      const priority = fixture.nativeElement.querySelector('[data-testid="bulk-action-priority"]') as HTMLButtonElement;
      expect(priority.disabled).toBe(true);
      expect(priority.title).toBe('You can only do this for tasks in modules you own.');
      expect((fixture.nativeElement.querySelector('[data-testid="bulk-action-status"]') as HTMLButtonElement).disabled).toBe(false);
    });

    it('status picker hides private statuses unless every selected module is owned', async () => {
      // arrange: store.statuses() = [{ id: 'pub', visibility: 'public', ... }, { id: 'priv', visibility: 'private', ... }]; select a task in a member-only module
      const inst = fixture.componentInstance as unknown as { statusOptions: () => { value: string }[] };
      expect(inst.statusOptions().map((o) => o.value)).toEqual(['pub']);
    });

    it('applying a picker calls the matching bulk endpoint with the selected ids, then shows results and clears selection', async () => {
      // arrange: select t-a and t-b
      const inst = fixture.componentInstance as unknown as {
        onBulkAction: (id: string) => void; onPickerConfirmed: (v: string | null) => Promise<void>;
        selection: { count: () => number }; bulkResult: () => { title: string } | null;
      };
      inst.onBulkAction('priority');
      await inst.onPickerConfirmed('high');
      const taskApi = TestBed.inject(TaskApiService) as unknown as { bulkSetPriority: ReturnType<typeof vi.fn> };
      expect(taskApi.bulkSetPriority).toHaveBeenCalledWith(['t-a', 't-b'], 'high');
      expect(inst.selection.count()).toBe(0);
      expect(inst.bulkResult()?.title).toBe('Set priority');
    });

    it('due date picker clear sends null', async () => {
      // select t-a; inst.onBulkAction('due-date'); await inst.onPickerConfirmed(null);
      // expect(taskApi.bulkSetDueDate).toHaveBeenCalledWith(['t-a'], null)
    });

    it('delete asks for confirmation before calling the API', async () => {
      // select t-a; inst.onBulkAction('delete'); expect(taskApi.bulkDelete).not.toHaveBeenCalled();
      // expect(inst.deleteConfirmOpen()).toBe(true); await inst.onDeleteConfirmed();
      // expect(taskApi.bulkDelete).toHaveBeenCalledWith(['t-a'])
    });

    it('move to sprint uses one setTasks call on the target sprint', async () => {
      // select t-a, t-b (both backlog); await inst.onTasksMoved('sp-2');
      // expect(sprintApi.setTasks).toHaveBeenCalledWith('sp-2', { addTaskIds: ['t-a', 't-b'], removeTaskIds: [] })
    });

    it('undo after moving backlog tasks into a sprint removes them from that sprint (fixes the old null-sprint undo)', async () => {
      // after the move above: await inst.undoMove();
      // expect(sprintApi.setTasks).toHaveBeenLastCalledWith('sp-2', { addTaskIds: [], removeTaskIds: ['t-a', 't-b'] })
    });

    it('move to backlog removes each task from its own sprint and is hidden when nothing selected is in a sprint', async () => {
      // select two tasks in sp-1 and one in sp-2; await inst.onMoveToBacklog();
      // expect setTasks called with ('sp-1', { addTaskIds: [], removeTaskIds: [ids in sp-1] }) and ('sp-2', {..., removeTaskIds: [id in sp-2]})
      // then select only backlog tasks: bulkActions() has no 'move-to-backlog'
    });
```
Write each commented test body out in full in the spec (arrange with the file's `setup({ tasks, sprints, milestones })` helper and `makeTask`/`makeTaskWithHours`, act, assert exactly as the comments state). Delete the old assertion that move calls `editTask` per task.

- [ ] **Step 2: Run** `npx ng test --watch=false --include=src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts` → new tests FAIL.

- [ ] **Step 3: Implement** in `task-backlog.component.ts`:

1. Inject `SprintApiService`; import `BulkTaskPickerDialogComponent`, `BulkTaskPickerMode`, `ConfirmModalComponent`, `BulkActionResultModalComponent`, `BulkResultSummary`, `toBulkResultSummary`, `BulkTaskActionResponse`, `SelectOption`; add the three components to `imports`.
2. Sprint sections: on each `<app-sprint-tab>` add
   ```html
              [selectable]="true"
              [selectedIds]="selectedTaskIds()"
              (taskSelectionChanged)="onTaskSelectionChanged($event)"
              (taskSelectAllChanged)="onSelectAllChanged($event)"
   ```
3. `selectedTasks` must cover every visible task, not just unsorted: change its source from `this.unsortedTasks()` to the full filtered list the template renders (`this.filteredTasks()` — confirm the computed's name near line 416).
4. Replace `bulkActions` with a computed:
   ```ts
   private static readonly OWNER_ONLY_REASON = 'You can only do this for tasks in modules you own.';
   protected readonly selectionAllOwned = computed(() => {
     const owned = this.ownedObjectiveIds();
     return this.selectedTasks().every((t) => owned.has(t.objectiveId));
   });
   protected readonly bulkActions = computed<BulkAction[]>(() => {
     const ownerBlocked = this.selectionAllOwned() ? undefined : TaskBacklogComponent.OWNER_ONLY_REASON;
     const ownerOnly = { disabled: !!ownerBlocked, disabledReason: ownerBlocked };
     const actions: BulkAction[] = [
       { id: 'status', label: 'Status', placement: 'primary' },
       { id: 'assign', label: 'Assign', placement: 'primary' },
       { id: 'priority', label: 'Priority', placement: 'primary', ...ownerOnly },
       { id: 'due-date', label: 'Due date', placement: 'more', ...ownerOnly },
       { id: 'move-to-sprint', label: 'Move to sprint', placement: 'more', ...ownerOnly }
     ];
     if (this.selectedTasks().some((t) => t.sprintId)) {
       actions.push({ id: 'move-to-backlog', label: 'Move to backlog', placement: 'more', ...ownerOnly });
     }
     actions.push(
       { id: 'convert-to-subtask', label: 'Convert to subtask', placement: 'more' },
       { id: 'delete', label: 'Delete', placement: 'more', danger: true }
     );
     return actions;
   });
   ```
   (`moveBlockedReason` stays as the dialog's own backstop.)
5. Picker state + options:
   ```ts
   protected readonly pickerMode = signal<BulkTaskPickerMode | null>(null);
   protected readonly bulkSubmitting = signal(false);
   protected readonly bulkError = signal<string | null>(null);
   protected readonly bulkResult = signal<{ title: string; summary: BulkResultSummary } | null>(null);
   protected readonly deleteConfirmOpen = signal(false);
   protected readonly taskNames = computed(() => new Map(this.store.tasks().map((t) => [t.id, t.title] as const)));

   protected readonly statusOptions = computed<SelectOption[]>(() => {
     const includePrivate = this.selectionAllOwned();
     return this.store.statuses()
       .filter((s) => includePrivate || s.visibility !== 'private')
       .map((s) => ({ value: s.id, label: s.name }));
   });
   protected readonly parentOptions = computed<SelectOption[]>(() => {
     const selected = this.selectedTaskIds();
     return this.store.tasks()
       .filter((t) => t.parentTaskId === null && !selected.has(t.id))
       .map((t) => ({ value: t.id, label: t.title }));
   });
   protected readonly pickerOptions = computed<SelectOption[]>(() => {
     switch (this.pickerMode()) {
       case 'status': return this.statusOptions();
       case 'assignee': return this.assignableMembers().map((m) => ({ value: m.employeeId, label: m.name }));
       case 'parent': return this.parentOptions();
       default: return [];
     }
   });
   ```
6. Actions:
   ```ts
   protected onBulkAction(actionId: string): void {
     this.bulkError.set(null);
     switch (actionId) {
       case 'status': this.pickerMode.set('status'); break;
       case 'assign': this.pickerMode.set('assignee'); break;
       case 'priority': this.pickerMode.set('priority'); break;
       case 'due-date': this.pickerMode.set('dueDate'); break;
       case 'convert-to-subtask': this.pickerMode.set('parent'); break;
       case 'move-to-sprint': this.moveDialogOpen.set(true); break;
       case 'move-to-backlog': void this.onMoveToBacklog(); break;
       case 'delete': this.deleteConfirmOpen.set(true); break;
     }
   }

   private static readonly PICKER_TITLES: Record<BulkTaskPickerMode, string> = {
     status: 'Change status', assignee: 'Add assignee', priority: 'Set priority', dueDate: 'Set due date', parent: 'Convert to subtask'
   };

   protected async onPickerConfirmed(value: string | null): Promise<void> {
     const mode = this.pickerMode();
     if (!mode) return;
     const ids = this.selectedTasks().map((t) => t.id);
     const call = {
       status: () => this.taskApi.bulkMoveStatus(ids, value!),
       assignee: () => this.taskApi.bulkAssign(ids, value!),
       priority: () => this.taskApi.bulkSetPriority(ids, value as WorkTask['priority']),
       dueDate: () => this.taskApi.bulkSetDueDate(ids, value),
       parent: () => this.taskApi.bulkConvertToSubtask(ids, value!)
     }[mode];
     await this.runBulk(TaskBacklogComponent.PICKER_TITLES[mode], call, () => this.pickerMode.set(null));
   }

   protected async onDeleteConfirmed(): Promise<void> {
     const ids = this.selectedTasks().map((t) => t.id);
     await this.runBulk('Delete', () => this.taskApi.bulkDelete(ids), () => this.deleteConfirmOpen.set(false));
   }

   private async runBulk(title: string, call: () => Observable<BulkTaskActionResponse>, close: () => void): Promise<void> {
     this.bulkSubmitting.set(true);
     this.bulkError.set(null);
     try {
       const response = await firstValueFrom(call());
       close();
       this.bulkResult.set({ title, summary: toBulkResultSummary(response) });
       this.clearSelection();
       await this.reloadTasks();
     } catch (err: unknown) {
       const detail = (err as { error?: { detail?: string } })?.error?.detail;
       this.bulkError.set(detail || 'The bulk action failed. Nothing was changed.');
     } finally {
       this.bulkSubmitting.set(false);
     }
   }
   ```
7. Rewrite move + undo on `setTasks` (replace `onTasksMoved` body's `Promise.all(editTask…)`, and `undoMove`):
   ```ts
   private lastMove: { taskId: string; previousSprintId: string | null; newSprintId: string | null }[] = [];

   /** Applies moves grouped by sprint: adds into a sprint and removals from a sprint are both
    *  PUT sprints/{id}/tasks calls - the only API that can send tasks back to the backlog. */
   private async applySprintMoves(moves: { taskId: string; from: string | null; to: string | null }[]): Promise<void> {
     const bySprint = new Map<string, { addTaskIds: string[]; removeTaskIds: string[] }>();
     const bucket = (id: string) => bySprint.get(id) ?? bySprint.set(id, { addTaskIds: [], removeTaskIds: [] }).get(id)!;
     for (const move of moves) {
       if (move.to) bucket(move.to).addTaskIds.push(move.taskId);          // adding to a sprint also detaches it from its previous sprint
       else if (move.from) bucket(move.from).removeTaskIds.push(move.taskId);
     }
     for (const [sprintId, request] of bySprint) {
       await firstValueFrom(this.sprintApi.setTasks(sprintId, request));
     }
     await this.sprintStore.loadForProject(this.projectId());
   }

   protected async onTasksMoved(targetSprintId: string): Promise<void> {
     const tasks = this.selectedTasks();
     if (tasks.length === 0) return;
     this.movingTasks.set(true);
     this.moveError.set(null);
     try {
       await this.applySprintMoves(tasks.map((t) => ({ taskId: t.id, from: t.sprintId, to: targetSprintId })));
       this.lastMove = tasks.map((t) => ({ taskId: t.id, previousSprintId: t.sprintId, newSprintId: targetSprintId }));
       const targetName = this.sprintStore.sprints().find((s) => s.id === targetSprintId)?.name ?? 'the sprint';
       this.showUndoBanner(`${tasks.length} task${tasks.length === 1 ? '' : 's'} moved to ${targetName}`);
       this.moveDialogOpen.set(false);
       this.clearSelection();
       await this.reloadTasks();
     } catch (err: unknown) {
       const detail = (err as { error?: { detail?: string } })?.error?.detail;
       this.moveError.set(detail || 'Failed to move the selected tasks.');
     } finally {
       this.movingTasks.set(false);
     }
   }

   protected async onMoveToBacklog(): Promise<void> {
     const tasks = this.selectedTasks().filter((t) => t.sprintId);
     if (tasks.length === 0) return;
     try {
       await this.applySprintMoves(tasks.map((t) => ({ taskId: t.id, from: t.sprintId, to: null })));
       this.lastMove = tasks.map((t) => ({ taskId: t.id, previousSprintId: t.sprintId, newSprintId: null }));
       this.showUndoBanner(`${tasks.length} task${tasks.length === 1 ? '' : 's'} moved to the backlog`);
       this.clearSelection();
       await this.reloadTasks();
     } catch (err: unknown) {
       const detail = (err as { error?: { detail?: string } })?.error?.detail;
       this.bulkError.set(detail || 'Failed to move the selected tasks to the backlog.');
     }
   }

   protected async undoMove(): Promise<void> {
     const moves = this.lastMove;
     if (moves.length === 0) return;
     this.lastMove = [];
     this.moveUndoBanner.set(null);
     await this.applySprintMoves(moves.map((m) => ({ taskId: m.taskId, from: m.newSprintId, to: m.previousSprintId })));
     await this.reloadTasks();
   }
   ```
   (`this.projectId()` = however the component already exposes the routed project id — it calls `loadBoard(projectId)` near line 291. `toEditTaskRequest` may become unused here; remove the import only if nothing else in the file uses it.)
8. Template, after the `<app-bulk-action-bar …>`:
   ```html
    <app-bulk-task-picker-dialog [mode]="pickerMode()" [count]="selectedTasks().length" [options]="pickerOptions()"
      [submitting]="bulkSubmitting()" [error]="bulkError()" (confirmed)="onPickerConfirmed($event)" (closed)="pickerMode.set(null)" />
    <app-confirm-modal [open]="deleteConfirmOpen()" [title]="'Delete ' + selectedTasks().length + ' task' + (selectedTasks().length === 1 ? '' : 's') + '?'"
      message="Deleted tasks are removed from the board. Tasks that still have subtasks are skipped."
      confirmLabel="Delete" [loading]="bulkSubmitting()" [errorMessage]="bulkError() ?? ''"
      (confirmed)="onDeleteConfirmed()" (cancelled)="deleteConfirmOpen.set(false)" />
    <app-bulk-action-result-modal [result]="bulkResult()?.summary ?? null" [title]="bulkResult()?.title ?? ''"
      [names]="taskNames()" [showApprovals]="false" (closed)="bulkResult.set(null)" />
   ```
   Show `bulkError()` for move-to-backlog failures in the existing move-error area (or a small `role="alert"` line above the Backlog table).

- [ ] **Step 4: Run** the backlog spec → all pass; also `modules/work/ui/task-table/task-table.component.spec.ts` and `modules/work/ui/sprint-tab/sprint-tab.component.spec.ts`.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/work/feature/task-backlog/task-backlog.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts
git commit -m "feat(work): backlog bulk status/assign/priority/due-date/move/convert/delete; fix move undo"
```

---

### Task 12: Frontend verification + browser check

- [ ] `npx ng test --watch=false` and `npx ng build` — paste raw summaries; pre-existing failures reported, not fixed.
- [ ] Browser (backend running; if the sandboxed pane blocks the `*.onexso.com` dev domain, use Claude in Chrome or ask the user), on a project's Backlog as a module owner:
  1. Expand a sprint, tick one task in it and two in Backlog → bar "3 tasks selected".
  2. Status → pick a status → result dialog "3 changed · 0 skipped"; rows update.
  3. Priority → High; Due date → a date, then Due date → Clear.
  4. Move to sprint → Undo → tasks return to the Backlog (the old bug).
  5. Select sprint tasks → Move to backlog → Undo.
  6. Convert 2 tasks to subtasks of a third → they appear under it.
  7. Delete a task that has subtasks + one that doesn't → result lists the parent as skipped with the subtask message.
  8. As a plain member (not owner): Priority/Due date/Move are disabled with the tooltip; Status list has no private statuses.
  Screenshot steps 1 and 7.
- [ ] Record any divergence from the spec in the spec file and commit docs.
