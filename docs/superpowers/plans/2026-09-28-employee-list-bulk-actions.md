# Employee List Redesign + Bulk Actions (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the employee-change scope gap, add backend bulk endpoints (Promote/Transfer, employment type, start offboarding) with per-item results, and replace the employee list's three views with one backlog-style table that has filters, sorting, a column picker, row actions and a bulk-action bar.

**Architecture:** Backend bulk handlers loop over ids and dispatch the existing single-item MediatR command per employee (precedent: `BulkApproveLeaveRequestsCommandHandler`), clearing the EF change tracker between items. A new `IEmployeeManageScopeGuard` enforces visibility scope on every employee write. Frontend: a presentational `employee-directory-table` driven by column definitions, URL-backed list state, and the Sub-project A primitives (`SelectionModel`, `app-bulk-action-bar`, `app-dropdown-menu`).

**Tech Stack:** .NET 10 / MediatR / FluentValidation / EF Core (Postgres) / xUnit + Moq; Angular 21 standalone + signals / Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-employee-list-bulk-actions-design.md` (frontend repo)

## Global Constraints

- Backend repo `C:\onevoNew\HRMS-Backend-v1`, frontend repo `C:\onevoNew\Hrms--Web-application---front-end---v1`, both on branch `feature/task-subtasks`. **Never create git worktrees**; ignore any `.worktrees/` folders when grepping.
- Working trees are shared with other sessions: `git status` before every commit; stage only files named in the task.
- Backend has no `.sln`. Test commands: `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~<Class>"`; integration: `tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj`; architecture: `tests/ONEVO.Tests.Architecture/ONEVO.Tests.Architecture.csproj`.
- A running `ONEVO.Api.exe` dev server locks build outputs and auto-respawns: re-check and kill it immediately before each `dotnet test`/`dotnet build`.
- Backend unit tests use **Moq** + `Assert.*` (Employee folder style). `ICurrentUser` is `ONEVO.Application.Common.ServiceInterfaces.ICurrentUser`. Two interfaces are named `IEmployeeRepository`; always use `ONEVO.Application.Features.CoreHr.Employee.RepositoryInterfaces.IEmployeeRepository` (alias it as existing handlers do).
- `Result` factories: `Success`, `Failure(msg, status)`, `NotFound`, `Forbidden`, `Conflict`, `UnprocessableEntity` (`ONEVO.Application.Common.Models`).
- Frontend tests are **Vitest** (`vi.fn()`); run one spec with `npx ng test --watch=false --include=<spec>`; full `npx ng test --watch=false`; build `npx ng build`.
- Scope-guard forbidden message (exact): `You do not have access to manage this employee.`
- Bulk limit: 100 distinct employee ids. Outcome strings (exact): `succeeded`, `pendingApproval`, `failed`.
- Unexpected-failure reason (exact): `Unexpected error while processing this employee.`
- Frontend localStorage key for columns: `employee_list_columns`. Default visible columns: `employee, employeeNumber, position, department, employmentType, reportingManager`.
- Terminal employment statuses for row actions: `resigned`, `terminated`.
- Paste raw test output (summary lines) in every task report.

---

## Part 1 — Backend (HRMS-Backend-v1)

### Task 1: `IUnitOfWork.ClearTracking()`

**Files:**
- Modify: `src/ONEVO.Application/Common/RepositoryInterfaces/IUnitOfWork.cs`
- Modify: `src/ONEVO.Infrastructure/Persistence/UnitOfWork.cs`
- Modify: `tests/ONEVO.Tests.Unit/Fakes/FakeUnitOfWork.cs`
- Modify: `tests/ONEVO.Tests.Unit/Features/CoreHr/Onboarding/ApproveAccessGrantRequestCommandHandlerTests.cs` (inner `TrackingUnitOfWork`, ~line 661)

**Interfaces:**
- Produces: `void IUnitOfWork.ClearTracking()`; `FakeUnitOfWork.ClearTrackingCallCount` (int).

- [ ] **Step 1: Add the member to the interface** (after `ExecuteInTransactionAsync`):

```csharp
    /// <summary>
    /// Detaches every tracked entity. Bulk handlers call this between items so a failed item's
    /// tracked-but-unsaved changes are never flushed by a later item's SaveChangesAsync.
    /// </summary>
    void ClearTracking();
```

- [ ] **Step 2: Build to see every implementor that now fails**

Run: `dotnet build src/ONEVO.Api/ONEVO.Api.csproj` then `dotnet build tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj` and `dotnet build tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj`.
Expected: CS0535 errors naming each class that implements `IUnitOfWork`.

- [ ] **Step 3: Implement in each implementor**

`UnitOfWork.cs`:
```csharp
    public void ClearTracking() => _db.ChangeTracker.Clear();
```
`FakeUnitOfWork.cs`:
```csharp
    public int ClearTrackingCallCount { get; private set; }

    public void ClearTracking() => ClearTrackingCallCount++;
```
`TrackingUnitOfWork` (test inner class) and any other implementor the build reported:
```csharp
        public void ClearTracking() { }
```

- [ ] **Step 4: Rebuild all three projects** — Expected: 0 errors.

- [ ] **Step 5: Commit**
```bash
git status
git add src/ONEVO.Application/Common/RepositoryInterfaces/IUnitOfWork.cs src/ONEVO.Infrastructure/Persistence/UnitOfWork.cs tests/ONEVO.Tests.Unit/Fakes/FakeUnitOfWork.cs tests/ONEVO.Tests.Unit/Features/CoreHr/Onboarding/ApproveAccessGrantRequestCommandHandlerTests.cs
git commit -m "feat(core): add IUnitOfWork.ClearTracking for bulk item isolation"
```
(Add any other implementor files the build reported.)

---

### Task 2: `IEmployeeManageScopeGuard`

**Files:**
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/ServiceInterfaces/IEmployeeManageScopeGuard.cs`
- Create: `src/ONEVO.Infrastructure/Services/CoreHr/EmployeeManageScopeGuard.cs`
- Modify: `src/ONEVO.Infrastructure/DependencyInjection.cs` (next to the `IEmployeeOffboardingLockGuard` registration, ~line 313)
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/EmployeeManageScopeGuardTests.cs`

**Interfaces:**
- Consumes: `IEmployeeVisibilityScopeResolver.ResolveAsync(Guid tenantId, Guid userId, CancellationToken)` → `EmployeeVisibilityScope`; `IEmployeeRepository.GetVisibleByIdAsync(Guid tenantId, EmployeeVisibilityScope scope, Guid employeeId, CancellationToken)` → `EmployeeListItemResponse?`; `EmployeeVisibilityScope.Unrestricted()`.
- Produces:
  ```csharp
  public interface IEmployeeManageScopeGuard
  {
      Task<Result?> EnsureCanManage(Guid tenantId, Guid employeeId, CancellationToken ct = default);
  }
  public sealed class EmployeeManageScopeGuard : IEmployeeManageScopeGuard
  {
      public const string ForbiddenMessage = "You do not have access to manage this employee.";
  }
  ```

- [ ] **Step 1: Write the failing tests**

```csharp
using Moq;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;
using ONEVO.Application.Features.CoreHr.Employee.Models;
using ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;
using ONEVO.Infrastructure.Services.CoreHr;
using IEmployeeRepository = ONEVO.Application.Features.CoreHr.Employee.RepositoryInterfaces.IEmployeeRepository;

namespace ONEVO.Tests.Unit.Features.CoreHr.Employee;

public class EmployeeManageScopeGuardTests
{
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IEmployeeVisibilityScopeResolver> _resolver = new();
    private readonly Mock<IEmployeeRepository> _employees = new();
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _employeeId = Guid.NewGuid();

    public EmployeeManageScopeGuardTests()
    {
        _currentUser.Setup(c => c.UserId).Returns(_userId);
    }

    private EmployeeManageScopeGuard CreateSut() => new(_currentUser.Object, _resolver.Object, _employees.Object);

    private static EmployeeListItemResponse Row(Guid id) =>
        new(id, "E-001", "Ada Lovelace", "ada@example.com", null, null, null, null, null, null, "Full-time", "active", null, null);

    [Fact]
    public async Task OrgManage_UsesUnrestrictedScope_WithoutResolving()
    {
        _currentUser.Setup(c => c.HasPermission("org:manage")).Returns(true);
        _employees.Setup(e => e.GetVisibleByIdAsync(_tenantId, It.Is<EmployeeVisibilityScope>(s => s.CanViewAllTenantEmployees), _employeeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Row(_employeeId));

        var result = await CreateSut().EnsureCanManage(_tenantId, _employeeId);

        Assert.Null(result);
        _resolver.Verify(r => r.ResolveAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task InScope_ReturnsNull_UsingResolvedScope()
    {
        var scope = new EmployeeVisibilityScope(false, null, new HashSet<Guid>(), new HashSet<Guid> { Guid.NewGuid() }, new HashSet<Guid>());
        _resolver.Setup(r => r.ResolveAsync(_tenantId, _userId, It.IsAny<CancellationToken>())).ReturnsAsync(scope);
        _employees.Setup(e => e.GetVisibleByIdAsync(_tenantId, scope, _employeeId, It.IsAny<CancellationToken>())).ReturnsAsync(Row(_employeeId));

        var result = await CreateSut().EnsureCanManage(_tenantId, _employeeId);

        Assert.Null(result);
    }

    [Fact]
    public async Task OutOfScope_ReturnsForbidden()
    {
        var scope = new EmployeeVisibilityScope(false, null, new HashSet<Guid>(), new HashSet<Guid>(), new HashSet<Guid>());
        _resolver.Setup(r => r.ResolveAsync(_tenantId, _userId, It.IsAny<CancellationToken>())).ReturnsAsync(scope);
        _employees.Setup(e => e.GetVisibleByIdAsync(_tenantId, scope, _employeeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((EmployeeListItemResponse?)null);

        var result = await CreateSut().EnsureCanManage(_tenantId, _employeeId);

        Assert.NotNull(result);
        Assert.Equal(403, result!.StatusCode);
        Assert.Equal(EmployeeManageScopeGuard.ForbiddenMessage, result.Error);
    }
}
```

- [ ] **Step 2: Run to verify failure**

Run: `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~EmployeeManageScopeGuardTests"`
Expected: build failure — `EmployeeManageScopeGuard` / `IEmployeeManageScopeGuard` not found. (If the unit project does not reference `ONEVO.Infrastructure`, find where `EmployeeOffboardingCoverageGuard` is unit-tested — `grep -rl EmployeeOffboardingCoverageGuard tests` — and put this test file in that project instead.)

- [ ] **Step 3: Implement**

`IEmployeeManageScopeGuard.cs`:
```csharp
using ONEVO.Application.Common.Models;

namespace ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;

/// <summary>
/// Write-side visibility check for a single employee: the caller may change an employee only if
/// that employee is inside the caller's visibility scope (org:manage = unrestricted) - the same
/// resolution the employee detail screen uses to decide what the caller can see.
/// </summary>
public interface IEmployeeManageScopeGuard
{
    /// <returns>null when allowed; a 403 Result otherwise.</returns>
    Task<Result?> EnsureCanManage(Guid tenantId, Guid employeeId, CancellationToken ct = default);
}
```

`EmployeeManageScopeGuard.cs`:
```csharp
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.Models;
using ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;
using IEmployeeRepository = ONEVO.Application.Features.CoreHr.Employee.RepositoryInterfaces.IEmployeeRepository;

namespace ONEVO.Infrastructure.Services.CoreHr;

public sealed class EmployeeManageScopeGuard(
    ICurrentUser currentUser,
    IEmployeeVisibilityScopeResolver visibilityScopeResolver,
    IEmployeeRepository employeeRepository) : IEmployeeManageScopeGuard
{
    public const string ForbiddenMessage = "You do not have access to manage this employee.";

    public async Task<Result?> EnsureCanManage(Guid tenantId, Guid employeeId, CancellationToken ct = default)
    {
        var scope = currentUser.HasPermission("org:manage")
            ? EmployeeVisibilityScope.Unrestricted()
            : await visibilityScopeResolver.ResolveAsync(tenantId, currentUser.UserId, ct);

        var visible = await employeeRepository.GetVisibleByIdAsync(tenantId, scope, employeeId, ct);
        return visible is null ? Result.Forbidden(ForbiddenMessage) : null;
    }
}
```

`DependencyInjection.cs` — add directly after the `IEmployeeOffboardingCoverageGuard` line:
```csharp
        services.AddScoped<ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces.IEmployeeManageScopeGuard, ONEVO.Infrastructure.Services.CoreHr.EmployeeManageScopeGuard>();
```

- [ ] **Step 4: Run tests** — same command. Expected: 3 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/ONEVO.Application/Features/CoreHr/Employee/ServiceInterfaces/IEmployeeManageScopeGuard.cs src/ONEVO.Infrastructure/Services/CoreHr/EmployeeManageScopeGuard.cs src/ONEVO.Infrastructure/DependencyInjection.cs tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/EmployeeManageScopeGuardTests.cs
git commit -m "feat(core-hr): add employee manage-scope guard"
```

---

### Task 3: Enforce scope in Change Position and Update Job Details

**Files:**
- Modify: `src/ONEVO.Application/Features/CoreHr/Employee/Commands/ChangeEmployeePosition/ChangeEmployeePositionCommandHandler.cs`
- Modify: `src/ONEVO.Application/Features/CoreHr/Employee/Commands/UpdateEmployeeJobDetails/UpdateEmployeeJobDetailsCommandHandler.cs` (confirm folder name with `ls`)
- Modify tests: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/ChangeEmployeePositionCommandHandlerTests.cs`, `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/UpdateEmployeeJobDetailsCommandHandlerTests.cs`
- Modify: every other `new ChangeEmployeePositionCommandHandler(` / `new UpdateEmployeeJobDetailsCommandHandler(` in `tests/` (find with `grep -rn --include=*.cs "new ChangeEmployeePositionCommandHandler(\|new UpdateEmployeeJobDetailsCommandHandler(" tests | grep -v .worktrees`)
- Create: `tests/ONEVO.Tests.Integration/TestDoubles/AllowAllManageScopeGuard.cs` (only if integration tests construct these handlers)

**Interfaces:**
- Consumes: `IEmployeeManageScopeGuard` (Task 2).
- Produces: both handlers take `IEmployeeManageScopeGuard` as their **last** constructor parameter; out-of-scope → 403 with the guard's message, checked immediately after the NotFound check and before the offboarding lock.

- [ ] **Step 1: Write failing tests**

In `ChangeEmployeePositionCommandHandlerTests.cs` add a field and pass it as the last argument in `CreateHandler()`:
```csharp
    private readonly Mock<IEmployeeManageScopeGuard> _manageScopeGuard = new();
```
Add the test:
```csharp
    [Fact]
    public async Task Handle_EmployeeOutsideCallerScope_ReturnsForbidden_BeforeLockCheck()
    {
        var tenantId = Guid.NewGuid(); var employeeId = Guid.NewGuid();
        SetupNonSelfCaller(tenantId, employeeId);
        _manageScopeGuard.Setup(g => g.EnsureCanManage(tenantId, employeeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ONEVO.Application.Common.Models.Result.Forbidden("You do not have access to manage this employee."));

        var result = await CreateHandler().Handle(
            new ChangeEmployeePositionCommand(employeeId, Guid.NewGuid(), DateOnly.FromDateTime(DateTime.UtcNow), "Promotion"), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(403, result.StatusCode);
        Assert.Equal("You do not have access to manage this employee.", result.Error);
        _offboardingLockGuard.Verify(g => g.EnsureMutable(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
```

In `UpdateEmployeeJobDetailsCommandHandlerTests.cs`: add the same `_manageScopeGuard` field, pass it last in the handler construction, and add:
```csharp
    [Fact]
    public async Task Handle_EmployeeOutsideCallerScope_ReturnsForbidden_AndDoesNotSave()
    {
        var tenantId = Guid.NewGuid();
        var employee = new ONEVO.Domain.Features.CoreHr.Entities.Employee { Id = Guid.NewGuid(), TenantId = tenantId, LegalEntityId = Guid.NewGuid() };
        SetUpHappyPath(tenantId, employee);
        _manageScopeGuard.Setup(g => g.EnsureCanManage(tenantId, employee.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(ONEVO.Application.Common.Models.Result.Forbidden("You do not have access to manage this employee."));

        var result = await CreateHandler().Handle(
            new UpdateEmployeeJobDetailsCommand(employee.Id, "E-100", "part_time", null), CancellationToken.None);

        Assert.Equal(403, result.StatusCode);
        _employees.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }
```
(Use the file's actual names for the employee mock field, the helper and the handler factory; if the helper signature differs, adapt the arrange lines only. `Mock<T>` returns a completed `Task` with `null` for unset `Task<Result?>` calls, so existing tests keep passing with no setup.)

- [ ] **Step 2: Run to verify failure**

Run: `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~ChangeEmployeePositionCommandHandlerTests|FullyQualifiedName~UpdateEmployeeJobDetailsCommandHandlerTests"`
Expected: build error (constructor has no such parameter).

- [ ] **Step 3: Implement**

`ChangeEmployeePositionCommandHandler`: add `using ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;`, a field `private readonly IEmployeeManageScopeGuard _manageScopeGuard;`, a last ctor parameter `IEmployeeManageScopeGuard manageScopeGuard` assigned to it, and directly after the NotFound return:
```csharp
        var scopeResult = await _manageScopeGuard.EnsureCanManage(tenantId, employee.Id, ct);
        if (scopeResult is not null)
            return Result<ChangeEmployeePositionResponse>.Forbidden(scopeResult.Error!);
```
`UpdateEmployeeJobDetailsCommandHandler`: same field/ctor change, and after its NotFound return:
```csharp
        var scopeResult = await _manageScopeGuard.EnsureCanManage(tenantId, employee.Id, ct);
        if (scopeResult is not null)
            return Result<Unit>.Forbidden(scopeResult.Error!);
```

If integration tests construct either handler, create `tests/ONEVO.Tests.Integration/TestDoubles/AllowAllManageScopeGuard.cs`:
```csharp
using ONEVO.Application.Common.Models;
using ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;

namespace ONEVO.Tests.Integration.TestDoubles;

/// <summary>Scope is covered by EmployeeManageScopeGuardTests; integration tests of handler
/// behaviour run as an org:manage caller, for whom the real guard also allows everything.</summary>
internal sealed class AllowAllManageScopeGuard : IEmployeeManageScopeGuard
{
    public Task<Result?> EnsureCanManage(Guid tenantId, Guid employeeId, CancellationToken ct = default)
        => Task.FromResult<Result?>(null);
}
```
and pass `new AllowAllManageScopeGuard()` as the last argument at each construction site.

- [ ] **Step 4: Run tests**

Unit filter from Step 2 → all pass. Then build + run integration tests for the folder: `dotnet test tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj --filter "FullyQualifiedName~CoreHr.Employee"` → all pass (requires local Postgres; if unavailable, report that verbatim rather than skipping silently).

- [ ] **Step 5: Commit** (all files touched above)
```bash
git status
git add <files>
git commit -m "fix(core-hr): enforce visibility scope on change-position and job-details writes"
```

---

### Task 4: `ChangeEmployeeEmploymentTypeCommand`

**Files:**
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/Commands/ChangeEmployeeEmploymentType/ChangeEmployeeEmploymentTypeCommand.cs`
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/Commands/ChangeEmployeeEmploymentType/ChangeEmployeeEmploymentTypeCommandHandler.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/ChangeEmployeeEmploymentTypeCommandHandlerTests.cs`

**Interfaces:**
- Consumes: `IEmployeeManageScopeGuard`; `IEmployeeOffboardingLockGuard.EnsureMutable(tenantId, employeeId, ct)` → `Result?` (namespace: copy the `using` from `UpdateEmployeeJobDetailsCommandHandler.cs`); `IEmploymentTypeRepository.GetIdByCodeAsync(string, ct)` → `int?` (namespace `ONEVO.Application.Features.CoreHr.OnboardingDrafts.RepositoryInterfaces`).
- Produces: `public sealed record ChangeEmployeeEmploymentTypeCommand(Guid EmployeeId, string EmploymentTypeCode) : IRequest<Result<Unit>>;`

- [ ] **Step 1: Write failing tests**

```csharp
using MediatR;
using Moq;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeeEmploymentType;
using ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;
using ONEVO.Application.Features.CoreHr.OnboardingDrafts.RepositoryInterfaces;
using IEmployeeRepository = ONEVO.Application.Features.CoreHr.Employee.RepositoryInterfaces.IEmployeeRepository;
// + the IEmployeeOffboardingLockGuard using copied from UpdateEmployeeJobDetailsCommandHandlerTests.cs

namespace ONEVO.Tests.Unit.Features.CoreHr.Employee;

public class ChangeEmployeeEmploymentTypeCommandHandlerTests
{
    private readonly Mock<IEmployeeRepository> _employees = new();
    private readonly Mock<IEmployeeManageScopeGuard> _scope = new();
    private readonly Mock<IEmployeeOffboardingLockGuard> _lock = new();
    private readonly Mock<IEmploymentTypeRepository> _types = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly ONEVO.Domain.Features.CoreHr.Entities.Employee _employee;

    public ChangeEmployeeEmploymentTypeCommandHandlerTests()
    {
        _employee = new ONEVO.Domain.Features.CoreHr.Entities.Employee
        {
            Id = Guid.NewGuid(), TenantId = _tenantId, EmployeeNumber = "E-007", EmploymentTypeId = 1, WorkModeId = Guid.NewGuid()
        };
        _currentUser.Setup(c => c.TenantId).Returns(_tenantId);
        _employees.Setup(e => e.GetTrackedByIdAsync(_tenantId, _employee.Id, It.IsAny<CancellationToken>())).ReturnsAsync(_employee);
        _types.Setup(t => t.GetIdByCodeAsync("contract", It.IsAny<CancellationToken>())).ReturnsAsync(3);
    }

    private ChangeEmployeeEmploymentTypeCommandHandler CreateSut() =>
        new(_employees.Object, _scope.Object, _lock.Object, _types.Object, _currentUser.Object);

    [Fact]
    public async Task Handle_Valid_ChangesOnlyEmploymentType()
    {
        var workMode = _employee.WorkModeId;

        var result = await CreateSut().Handle(new ChangeEmployeeEmploymentTypeCommand(_employee.Id, "contract"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, _employee.EmploymentTypeId);
        Assert.Equal("E-007", _employee.EmployeeNumber);
        Assert.Equal(workMode, _employee.WorkModeId);
        _employees.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_UnknownEmployee_ReturnsNotFound()
    {
        var result = await CreateSut().Handle(new ChangeEmployeeEmploymentTypeCommand(Guid.NewGuid(), "contract"), CancellationToken.None);
        Assert.Equal(404, result.StatusCode);
    }

    [Fact]
    public async Task Handle_OutOfScope_ReturnsForbidden_WithoutSaving()
    {
        _scope.Setup(s => s.EnsureCanManage(_tenantId, _employee.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Forbidden("You do not have access to manage this employee."));

        var result = await CreateSut().Handle(new ChangeEmployeeEmploymentTypeCommand(_employee.Id, "contract"), CancellationToken.None);

        Assert.Equal(403, result.StatusCode);
        _employees.Verify(e => e.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_Offboarded_ReturnsConflict()
    {
        _lock.Setup(l => l.EnsureMutable(_tenantId, _employee.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Conflict("This employee's record is read-only after offboarding completion."));

        var result = await CreateSut().Handle(new ChangeEmployeeEmploymentTypeCommand(_employee.Id, "contract"), CancellationToken.None);

        Assert.Equal(409, result.StatusCode);
    }

    [Fact]
    public async Task Handle_UnknownCode_ReturnsBadRequest()
    {
        var result = await CreateSut().Handle(new ChangeEmployeeEmploymentTypeCommand(_employee.Id, "nope"), CancellationToken.None);

        Assert.Equal(400, result.StatusCode);
        Assert.Equal("Employment type is invalid.", result.Error);
    }
}
```

- [ ] **Step 2: Run to verify failure**
Run: `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~ChangeEmployeeEmploymentTypeCommandHandlerTests"` — Expected: build error, types missing.

- [ ] **Step 3: Implement**

`ChangeEmployeeEmploymentTypeCommand.cs`:
```csharp
using FluentValidation;
using MediatR;
using ONEVO.Application.Common.Models;

namespace ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeeEmploymentType;

/// <summary>Changes only the employment type - unlike UpdateEmployeeJobDetailsCommand, which
/// overwrites employee number and work mode too and so can't be applied in bulk.</summary>
public sealed record ChangeEmployeeEmploymentTypeCommand(Guid EmployeeId, string EmploymentTypeCode) : IRequest<Result<Unit>>;

public sealed class ChangeEmployeeEmploymentTypeCommandValidator : AbstractValidator<ChangeEmployeeEmploymentTypeCommand>
{
    public ChangeEmployeeEmploymentTypeCommandValidator()
    {
        RuleFor(x => x.EmployeeId).NotEmpty();
        RuleFor(x => x.EmploymentTypeCode).NotEmpty().MaximumLength(50);
    }
}
```

`ChangeEmployeeEmploymentTypeCommandHandler.cs`:
```csharp
using MediatR;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.ServiceInterfaces;
using ONEVO.Application.Features.CoreHr.OnboardingDrafts.RepositoryInterfaces;
using IEmployeeRepository = ONEVO.Application.Features.CoreHr.Employee.RepositoryInterfaces.IEmployeeRepository;
// + the IEmployeeOffboardingLockGuard using copied from UpdateEmployeeJobDetailsCommandHandler.cs

namespace ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeeEmploymentType;

public sealed class ChangeEmployeeEmploymentTypeCommandHandler(
    IEmployeeRepository employeeRepository,
    IEmployeeManageScopeGuard manageScopeGuard,
    IEmployeeOffboardingLockGuard offboardingLockGuard,
    IEmploymentTypeRepository employmentTypes,
    ICurrentUser currentUser) : IRequestHandler<ChangeEmployeeEmploymentTypeCommand, Result<Unit>>
{
    public async Task<Result<Unit>> Handle(ChangeEmployeeEmploymentTypeCommand request, CancellationToken ct)
    {
        var tenantId = currentUser.TenantId;
        var employee = await employeeRepository.GetTrackedByIdAsync(tenantId, request.EmployeeId, ct);
        if (employee is null)
            return Result<Unit>.NotFound("The employee could not be found.");

        var scopeResult = await manageScopeGuard.EnsureCanManage(tenantId, employee.Id, ct);
        if (scopeResult is not null)
            return Result<Unit>.Forbidden(scopeResult.Error!);

        var lockResult = await offboardingLockGuard.EnsureMutable(tenantId, employee.Id, ct);
        if (lockResult is not null)
            return Result<Unit>.Conflict(lockResult.Error!);

        var employmentTypeId = await employmentTypes.GetIdByCodeAsync(request.EmploymentTypeCode, ct);
        if (employmentTypeId is null)
            return Result<Unit>.Failure("Employment type is invalid.", 400);

        employee.EmploymentTypeId = employmentTypeId.Value;
        await employeeRepository.SaveChangesAsync(ct);
        return Result<Unit>.Success(Unit.Value);
    }
}
```

- [ ] **Step 4: Run tests** — Expected: 5 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/ONEVO.Application/Features/CoreHr/Employee/Commands/ChangeEmployeeEmploymentType/ tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/ChangeEmployeeEmploymentTypeCommandHandlerTests.cs
git commit -m "feat(core-hr): add narrow change-employment-type command"
```

---

### Task 5: Bulk result DTO + `BulkEmployeeActionRunner`

**Files:**
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/DTOs/Responses/BulkEmployeeActionResponse.cs`
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/Services/BulkEmployeeActionRunner.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/BulkEmployeeActionRunnerTests.cs`

**Interfaces:**
- Consumes: `IUnitOfWork.ClearTracking()` (Task 1), `FakeUnitOfWork.ClearTrackingCallCount`.
- Produces:
  ```csharp
  public static class BulkEmployeeActionOutcomes { Succeeded = "succeeded"; PendingApproval = "pendingApproval"; Failed = "failed"; }
  public sealed record BulkEmployeeActionItemResponse(Guid EmployeeId, string Outcome, string? Reason);
  public sealed record BulkEmployeeActionResponse(IReadOnlyList<BulkEmployeeActionItemResponse> Items, int Succeeded, int PendingApproval, int Failed)
  { public static BulkEmployeeActionResponse From(IReadOnlyList<BulkEmployeeActionItemResponse> items); }
  public readonly record struct BulkItemOutcome(bool Success, bool PendingApproval, string? Error);
  public static class BulkEmployeeActionRunner
  {
      public const int MaxEmployees = 100;
      public const string UnexpectedFailureReason = "Unexpected error while processing this employee.";
      public static Task<BulkEmployeeActionResponse> RunAsync(IEnumerable<Guid> employeeIds,
          Func<Guid, CancellationToken, Task<BulkItemOutcome>> processOne, IUnitOfWork unitOfWork, ILogger logger, CancellationToken ct);
  }
  ```

- [ ] **Step 1: Write failing tests**

```csharp
using Microsoft.Extensions.Logging.Abstractions;
using ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;
using ONEVO.Application.Features.CoreHr.Employee.Services;
using ONEVO.Tests.Unit.Fakes;

namespace ONEVO.Tests.Unit.Features.CoreHr.Employee;

public class BulkEmployeeActionRunnerTests
{
    private readonly FakeUnitOfWork _uow = new();

    [Fact]
    public async Task MapsSuccessPendingAndFailure_AndCountsThem()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid(); var c = Guid.NewGuid();
        var outcomes = new Dictionary<Guid, BulkItemOutcome>
        {
            [a] = new(true, false, null),
            [b] = new(true, true, null),
            [c] = new(false, false, "You cannot change your own position.")
        };

        var response = await BulkEmployeeActionRunner.RunAsync(
            new[] { a, b, c }, (id, _) => Task.FromResult(outcomes[id]), _uow, NullLogger.Instance, CancellationToken.None);

        Assert.Equal(new[] { "succeeded", "pendingApproval", "failed" }, response.Items.Select(i => i.Outcome));
        Assert.Equal("You cannot change your own position.", response.Items[2].Reason);
        Assert.Null(response.Items[0].Reason);
        Assert.Equal((1, 1, 1), (response.Succeeded, response.PendingApproval, response.Failed));
    }

    [Fact]
    public async Task DeduplicatesIds_PreservingFirstOccurrenceOrder()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        var calls = new List<Guid>();

        var response = await BulkEmployeeActionRunner.RunAsync(
            new[] { a, b, a }, (id, _) => { calls.Add(id); return Task.FromResult(new BulkItemOutcome(true, false, null)); },
            _uow, NullLogger.Instance, CancellationToken.None);

        Assert.Equal(new[] { a, b }, calls);
        Assert.Equal(2, response.Items.Count);
    }

    [Fact]
    public async Task ClearsTrackingAfterEveryItem_IncludingFailures()
    {
        await BulkEmployeeActionRunner.RunAsync(
            new[] { Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid() },
            (_, _) => Task.FromResult(new BulkItemOutcome(false, false, "nope")),
            _uow, NullLogger.Instance, CancellationToken.None);

        Assert.Equal(3, _uow.ClearTrackingCallCount);
    }

    [Fact]
    public async Task UnexpectedException_BecomesFailedItem_AndProcessingContinues()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid();

        var response = await BulkEmployeeActionRunner.RunAsync(
            new[] { a, b },
            (id, _) => id == a ? throw new InvalidOperationException("boom") : Task.FromResult(new BulkItemOutcome(true, false, null)),
            _uow, NullLogger.Instance, CancellationToken.None);

        Assert.Equal("failed", response.Items[0].Outcome);
        Assert.Equal(BulkEmployeeActionRunner.UnexpectedFailureReason, response.Items[0].Reason);
        Assert.Equal("succeeded", response.Items[1].Outcome);
        Assert.Equal(2, _uow.ClearTrackingCallCount);
    }

    [Fact]
    public async Task Cancellation_Propagates()
    {
        using var cts = new CancellationTokenSource();
        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => BulkEmployeeActionRunner.RunAsync(
            new[] { Guid.NewGuid() }, (_, _) => Task.FromResult(new BulkItemOutcome(true, false, null)),
            _uow, NullLogger.Instance, cts.Token));
    }
}
```

- [ ] **Step 2: Run to verify failure** — `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~BulkEmployeeActionRunnerTests"` → build error.

- [ ] **Step 3: Implement**

`BulkEmployeeActionResponse.cs`:
```csharp
namespace ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;

public static class BulkEmployeeActionOutcomes
{
    public const string Succeeded = "succeeded";
    public const string PendingApproval = "pendingApproval";
    public const string Failed = "failed";
}

public sealed record BulkEmployeeActionItemResponse(Guid EmployeeId, string Outcome, string? Reason);

public sealed record BulkEmployeeActionResponse(
    IReadOnlyList<BulkEmployeeActionItemResponse> Items,
    int Succeeded,
    int PendingApproval,
    int Failed)
{
    public static BulkEmployeeActionResponse From(IReadOnlyList<BulkEmployeeActionItemResponse> items) => new(
        items,
        items.Count(i => i.Outcome == BulkEmployeeActionOutcomes.Succeeded),
        items.Count(i => i.Outcome == BulkEmployeeActionOutcomes.PendingApproval),
        items.Count(i => i.Outcome == BulkEmployeeActionOutcomes.Failed));
}
```

`BulkEmployeeActionRunner.cs`:
```csharp
using Microsoft.Extensions.Logging;
using ONEVO.Application.Common.RepositoryInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;

namespace ONEVO.Application.Features.CoreHr.Employee.Services;

public readonly record struct BulkItemOutcome(bool Success, bool PendingApproval, string? Error);

/// <summary>
/// Shared loop for employee bulk actions: each id is processed sequentially through the
/// existing single-employee command (so every single-item rule applies), outcomes are mapped
/// per item, and the change tracker is cleared after every item so a failed item's tracked
/// changes can never be flushed by a later item's SaveChangesAsync.
/// </summary>
public static class BulkEmployeeActionRunner
{
    public const int MaxEmployees = 100;
    public const string UnexpectedFailureReason = "Unexpected error while processing this employee.";

    public static async Task<BulkEmployeeActionResponse> RunAsync(
        IEnumerable<Guid> employeeIds,
        Func<Guid, CancellationToken, Task<BulkItemOutcome>> processOne,
        IUnitOfWork unitOfWork,
        ILogger logger,
        CancellationToken ct)
    {
        var items = new List<BulkEmployeeActionItemResponse>();
        foreach (var employeeId in employeeIds.Distinct())
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                var outcome = await processOne(employeeId, ct);
                items.Add(outcome.Success
                    ? new BulkEmployeeActionItemResponse(employeeId,
                        outcome.PendingApproval ? BulkEmployeeActionOutcomes.PendingApproval : BulkEmployeeActionOutcomes.Succeeded,
                        null)
                    : new BulkEmployeeActionItemResponse(employeeId, BulkEmployeeActionOutcomes.Failed, outcome.Error));
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Bulk employee action failed for employee {EmployeeId}", employeeId);
                items.Add(new BulkEmployeeActionItemResponse(employeeId, BulkEmployeeActionOutcomes.Failed, UnexpectedFailureReason));
            }
            finally
            {
                unitOfWork.ClearTracking();
            }
        }

        return BulkEmployeeActionResponse.From(items);
    }
}
```

- [ ] **Step 4: Run tests** — Expected: 5 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/ONEVO.Application/Features/CoreHr/Employee/DTOs/Responses/BulkEmployeeActionResponse.cs src/ONEVO.Application/Features/CoreHr/Employee/Services/BulkEmployeeActionRunner.cs tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/BulkEmployeeActionRunnerTests.cs
git commit -m "feat(core-hr): add bulk employee action runner and result DTO"
```

---

### Task 6: The three bulk commands

**Files:**
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/Commands/BulkChangeEmployeePosition/BulkChangeEmployeePositionCommand.cs`
- Create: `src/ONEVO.Application/Features/CoreHr/Employee/Commands/BulkChangeEmploymentType/BulkChangeEmploymentTypeCommand.cs`
- Create: `src/ONEVO.Application/Features/CoreHr/Offboarding/Commands/BulkStartOffboarding/BulkStartOffboardingCommand.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/BulkEmployeeCommandsTests.cs`

(Each file holds record + validator + handler, following `ApproveLeaveRequestCommand.cs`.)

**Interfaces:**
- Consumes: `BulkEmployeeActionRunner.RunAsync`, `BulkItemOutcome`, `MaxEmployees` (Task 5); `ChangeEmployeePositionCommand(Guid EmployeeId, Guid PositionId, DateOnly EffectiveFrom, string ChangeReason, Guid? ReportsToEmployeeId = null)` → `Result<ChangeEmployeePositionResponse(bool PendingApproval)>`; `ChangeEmployeeEmploymentTypeCommand` (Task 4) → `Result<Unit>`; `StartOffboardingCommand(Guid EmployeeId, string Reason, DateOnly LastWorkingDate, string KnowledgeRiskLevel, string? RehireEligibility, string? Notes)` → `Result<Guid>` (namespace `ONEVO.Application.Features.CoreHr.Offboarding.Commands.StartOffboarding`).
- Produces:
  ```csharp
  public sealed record BulkChangeEmployeePositionCommand(IReadOnlyList<Guid> EmployeeIds, Guid PositionId, DateOnly EffectiveFrom, string ChangeReason, Guid? ReportsToEmployeeId) : IRequest<Result<BulkEmployeeActionResponse>>;
  public sealed record BulkChangeEmploymentTypeCommand(IReadOnlyList<Guid> EmployeeIds, string EmploymentTypeCode) : IRequest<Result<BulkEmployeeActionResponse>>;
  public sealed record BulkStartOffboardingCommand(IReadOnlyList<Guid> EmployeeIds, string Reason, DateOnly LastWorkingDate, string KnowledgeRiskLevel, string? RehireEligibility, string? Notes) : IRequest<Result<BulkEmployeeActionResponse>>;
  ```
  Handlers: `BulkChangeEmployeePositionCommandHandler(IMediator, IUnitOfWork, ILogger<...>)`, same shape for the other two.

- [ ] **Step 1: Write failing tests**

```csharp
using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Features.CoreHr.Employee.Commands.BulkChangeEmployeePosition;
using ONEVO.Application.Features.CoreHr.Employee.Commands.BulkChangeEmploymentType;
using ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeeEmploymentType;
using ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeePosition;
using ONEVO.Application.Features.CoreHr.Offboarding.Commands.BulkStartOffboarding;
using ONEVO.Application.Features.CoreHr.Offboarding.Commands.StartOffboarding;
using ONEVO.Tests.Unit.Fakes;

namespace ONEVO.Tests.Unit.Features.CoreHr.Employee;

public class BulkEmployeeCommandsTests
{
    private readonly Mock<IMediator> _mediator = new();
    private readonly FakeUnitOfWork _uow = new();
    private static readonly DateOnly Today = new(2026, 10, 1);

    [Fact]
    public async Task BulkChangePosition_DispatchesOneCommandPerEmployee_AndMapsPendingApproval()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid(); var c = Guid.NewGuid();
        var positionId = Guid.NewGuid(); var managerId = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.Is<ChangeEmployeePositionCommand>(x => x.EmployeeId == a), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<ChangeEmployeePositionResponse>.Success(new ChangeEmployeePositionResponse(false)));
        _mediator.Setup(m => m.Send(It.Is<ChangeEmployeePositionCommand>(x => x.EmployeeId == b), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<ChangeEmployeePositionResponse>.Success(new ChangeEmployeePositionResponse(true)));
        _mediator.Setup(m => m.Send(It.Is<ChangeEmployeePositionCommand>(x => x.EmployeeId == c), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<ChangeEmployeePositionResponse>.Forbidden("You do not have access to manage this employee."));

        var handler = new BulkChangeEmployeePositionCommandHandler(_mediator.Object, _uow, NullLogger<BulkChangeEmployeePositionCommandHandler>.Instance);
        var result = await handler.Handle(new BulkChangeEmployeePositionCommand(new[] { a, b, c }, positionId, Today, "Transfer", managerId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(new[] { "succeeded", "pendingApproval", "failed" }, result.Value!.Items.Select(i => i.Outcome));
        Assert.Equal("You do not have access to manage this employee.", result.Value.Items[2].Reason);
        _mediator.Verify(m => m.Send(It.Is<ChangeEmployeePositionCommand>(x =>
            x.EmployeeId == a && x.PositionId == positionId && x.EffectiveFrom == Today && x.ChangeReason == "Transfer" && x.ReportsToEmployeeId == managerId),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkChangeEmploymentType_DispatchesNarrowCommand()
    {
        var a = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.IsAny<ChangeEmployeeEmploymentTypeCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<Unit>.Success(Unit.Value));

        var handler = new BulkChangeEmploymentTypeCommandHandler(_mediator.Object, _uow, NullLogger<BulkChangeEmploymentTypeCommandHandler>.Instance);
        var result = await handler.Handle(new BulkChangeEmploymentTypeCommand(new[] { a }, "contract"), CancellationToken.None);

        Assert.Equal(1, result.Value!.Succeeded);
        _mediator.Verify(m => m.Send(It.Is<ChangeEmployeeEmploymentTypeCommand>(x => x.EmployeeId == a && x.EmploymentTypeCode == "contract"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkStartOffboarding_DispatchesStartOffboardingPerEmployee()
    {
        var a = Guid.NewGuid(); var b = Guid.NewGuid();
        _mediator.Setup(m => m.Send(It.Is<StartOffboardingCommand>(x => x.EmployeeId == a), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<Guid>.Success(Guid.NewGuid()));
        _mediator.Setup(m => m.Send(It.Is<StartOffboardingCommand>(x => x.EmployeeId == b), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<Guid>.Conflict("This employee already has an offboarding in progress."));

        var handler = new BulkStartOffboardingCommandHandler(_mediator.Object, _uow, NullLogger<BulkStartOffboardingCommandHandler>.Instance);
        var result = await handler.Handle(
            new BulkStartOffboardingCommand(new[] { a, b }, "resignation", Today, "medium", null, "note"), CancellationToken.None);

        Assert.Equal((1, 0, 1), (result.Value!.Succeeded, result.Value.PendingApproval, result.Value.Failed));
        _mediator.Verify(m => m.Send(It.Is<StartOffboardingCommand>(x =>
            x.EmployeeId == a && x.Reason == "resignation" && x.LastWorkingDate == Today && x.KnowledgeRiskLevel == "medium" && x.Notes == "note"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public void Validators_RejectEmptyAndOverLimit_AcceptDuplicatesWithinLimit()
    {
        var validator = new BulkChangeEmploymentTypeCommandValidator();
        Assert.False(validator.Validate(new BulkChangeEmploymentTypeCommand(Array.Empty<Guid>(), "contract")).IsValid);
        Assert.False(validator.Validate(new BulkChangeEmploymentTypeCommand(Enumerable.Range(0, 101).Select(_ => Guid.NewGuid()).ToList(), "contract")).IsValid);
        var id = Guid.NewGuid();
        Assert.True(validator.Validate(new BulkChangeEmploymentTypeCommand(Enumerable.Repeat(id, 150).ToList(), "contract")).IsValid);

        Assert.False(new BulkChangeEmployeePositionCommandValidator().Validate(
            new BulkChangeEmployeePositionCommand(Enumerable.Range(0, 101).Select(_ => Guid.NewGuid()).ToList(), Guid.NewGuid(), Today, "Promotion", null)).IsValid);
        Assert.False(new BulkStartOffboardingCommandValidator().Validate(
            new BulkStartOffboardingCommand(Array.Empty<Guid>(), "resignation", Today, "medium", null, null)).IsValid);
    }
}
```

- [ ] **Step 2: Run to verify failure** — `--filter "FullyQualifiedName~BulkEmployeeCommandsTests"` → build error.

- [ ] **Step 3: Implement**

`BulkChangeEmployeePositionCommand.cs`:
```csharp
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.RepositoryInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeePosition;
using ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;
using ONEVO.Application.Features.CoreHr.Employee.Services;

namespace ONEVO.Application.Features.CoreHr.Employee.Commands.BulkChangeEmployeePosition;

public sealed record BulkChangeEmployeePositionCommand(
    IReadOnlyList<Guid> EmployeeIds,
    Guid PositionId,
    DateOnly EffectiveFrom,
    string ChangeReason,
    Guid? ReportsToEmployeeId) : IRequest<Result<BulkEmployeeActionResponse>>;

public sealed class BulkChangeEmployeePositionCommandValidator : AbstractValidator<BulkChangeEmployeePositionCommand>
{
    public BulkChangeEmployeePositionCommandValidator()
    {
        RuleFor(x => x.EmployeeIds).NotEmpty()
            .Must(ids => ids.Distinct().Count() <= BulkEmployeeActionRunner.MaxEmployees)
            .WithMessage($"A bulk action can include at most {BulkEmployeeActionRunner.MaxEmployees} employees.");
        RuleFor(x => x.PositionId).NotEmpty();
        RuleFor(x => x.ChangeReason).NotEmpty();
    }
}

public sealed class BulkChangeEmployeePositionCommandHandler(
    IMediator mediator,
    IUnitOfWork unitOfWork,
    ILogger<BulkChangeEmployeePositionCommandHandler> logger)
    : IRequestHandler<BulkChangeEmployeePositionCommand, Result<BulkEmployeeActionResponse>>
{
    public async Task<Result<BulkEmployeeActionResponse>> Handle(BulkChangeEmployeePositionCommand command, CancellationToken ct)
    {
        var response = await BulkEmployeeActionRunner.RunAsync(command.EmployeeIds, async (employeeId, token) =>
        {
            var result = await mediator.Send(new ChangeEmployeePositionCommand(
                employeeId, command.PositionId, command.EffectiveFrom, command.ChangeReason, command.ReportsToEmployeeId), token);
            return new BulkItemOutcome(result.IsSuccess, result.IsSuccess && result.Value!.PendingApproval, result.Error);
        }, unitOfWork, logger, ct);

        return Result<BulkEmployeeActionResponse>.Success(response);
    }
}
```

`BulkChangeEmploymentTypeCommand.cs`:
```csharp
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.RepositoryInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.Commands.ChangeEmployeeEmploymentType;
using ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;
using ONEVO.Application.Features.CoreHr.Employee.Services;

namespace ONEVO.Application.Features.CoreHr.Employee.Commands.BulkChangeEmploymentType;

public sealed record BulkChangeEmploymentTypeCommand(IReadOnlyList<Guid> EmployeeIds, string EmploymentTypeCode)
    : IRequest<Result<BulkEmployeeActionResponse>>;

public sealed class BulkChangeEmploymentTypeCommandValidator : AbstractValidator<BulkChangeEmploymentTypeCommand>
{
    public BulkChangeEmploymentTypeCommandValidator()
    {
        RuleFor(x => x.EmployeeIds).NotEmpty()
            .Must(ids => ids.Distinct().Count() <= BulkEmployeeActionRunner.MaxEmployees)
            .WithMessage($"A bulk action can include at most {BulkEmployeeActionRunner.MaxEmployees} employees.");
        RuleFor(x => x.EmploymentTypeCode).NotEmpty().MaximumLength(50);
    }
}

public sealed class BulkChangeEmploymentTypeCommandHandler(
    IMediator mediator,
    IUnitOfWork unitOfWork,
    ILogger<BulkChangeEmploymentTypeCommandHandler> logger)
    : IRequestHandler<BulkChangeEmploymentTypeCommand, Result<BulkEmployeeActionResponse>>
{
    public async Task<Result<BulkEmployeeActionResponse>> Handle(BulkChangeEmploymentTypeCommand command, CancellationToken ct)
    {
        var response = await BulkEmployeeActionRunner.RunAsync(command.EmployeeIds, async (employeeId, token) =>
        {
            var result = await mediator.Send(new ChangeEmployeeEmploymentTypeCommand(employeeId, command.EmploymentTypeCode), token);
            return new BulkItemOutcome(result.IsSuccess, false, result.Error);
        }, unitOfWork, logger, ct);

        return Result<BulkEmployeeActionResponse>.Success(response);
    }
}
```

`BulkStartOffboardingCommand.cs`:
```csharp
using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.RepositoryInterfaces;
using ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses;
using ONEVO.Application.Features.CoreHr.Employee.Services;
using ONEVO.Application.Features.CoreHr.Offboarding.Commands.StartOffboarding;

namespace ONEVO.Application.Features.CoreHr.Offboarding.Commands.BulkStartOffboarding;

/// <summary>Starts offboarding for many employees with shared exit details. Each employee's
/// checklist is still chosen and completed one at a time in the offboarding wizard.</summary>
public sealed record BulkStartOffboardingCommand(
    IReadOnlyList<Guid> EmployeeIds,
    string Reason,
    DateOnly LastWorkingDate,
    string KnowledgeRiskLevel,
    string? RehireEligibility,
    string? Notes) : IRequest<Result<BulkEmployeeActionResponse>>;

public sealed class BulkStartOffboardingCommandValidator : AbstractValidator<BulkStartOffboardingCommand>
{
    public BulkStartOffboardingCommandValidator()
    {
        RuleFor(x => x.EmployeeIds).NotEmpty()
            .Must(ids => ids.Distinct().Count() <= BulkEmployeeActionRunner.MaxEmployees)
            .WithMessage($"A bulk action can include at most {BulkEmployeeActionRunner.MaxEmployees} employees.");
        RuleFor(x => x.Reason).NotEmpty();
        RuleFor(x => x.KnowledgeRiskLevel).NotEmpty();
    }
}

public sealed class BulkStartOffboardingCommandHandler(
    IMediator mediator,
    IUnitOfWork unitOfWork,
    ILogger<BulkStartOffboardingCommandHandler> logger)
    : IRequestHandler<BulkStartOffboardingCommand, Result<BulkEmployeeActionResponse>>
{
    public async Task<Result<BulkEmployeeActionResponse>> Handle(BulkStartOffboardingCommand command, CancellationToken ct)
    {
        var response = await BulkEmployeeActionRunner.RunAsync(command.EmployeeIds, async (employeeId, token) =>
        {
            var result = await mediator.Send(new StartOffboardingCommand(
                employeeId, command.Reason, command.LastWorkingDate, command.KnowledgeRiskLevel, command.RehireEligibility, command.Notes), token);
            return new BulkItemOutcome(result.IsSuccess, false, result.Error);
        }, unitOfWork, logger, ct);

        return Result<BulkEmployeeActionResponse>.Success(response);
    }
}
```

- [ ] **Step 4: Run tests** — Expected: 4 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/ONEVO.Application/Features/CoreHr/Employee/Commands/BulkChangeEmployeePosition/ src/ONEVO.Application/Features/CoreHr/Employee/Commands/BulkChangeEmploymentType/ src/ONEVO.Application/Features/CoreHr/Offboarding/Commands/BulkStartOffboarding/ tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/BulkEmployeeCommandsTests.cs
git commit -m "feat(core-hr): add bulk change-position, employment-type and start-offboarding commands"
```

---

### Task 7: Bulk endpoints on `EmployeesController`

**Files:**
- Create: `src/ONEVO.Api/Contracts/CoreHr/Employees/BulkEmployeeRequests.cs`
- Modify: `src/ONEVO.Api/Controllers/Tenant/CoreHr/EmployeesController.cs` (add after `UpdateJobDetails`, ~line 144)
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/EmployeesControllerTests.cs`

**Interfaces:**
- Consumes: Task 6 commands; `RequirePermissionAttribute(string permission)` (`ONEVO.Api.Filters`, permission stored in a private field — tests read it via `CustomAttributeData`).
- Produces: `POST api/v1/employees/bulk/change-position` (`employees:write`), `POST api/v1/employees/bulk/employment-type` (`employees:write`), `POST api/v1/employees/bulk/offboarding/start` (`employees:offboard`); each returns `200 OK` with `BulkEmployeeActionResponse`.

- [ ] **Step 1: Write failing tests** (append to `EmployeesControllerTests`, which already has `_mediator` and `_sut`):

```csharp
    private static string? PermissionOf(string actionName) =>
        typeof(EmployeesController).GetMethod(actionName)!
            .GetCustomAttributesData()
            .Single(a => a.AttributeType == typeof(ONEVO.Api.Filters.RequirePermissionAttribute))
            .ConstructorArguments[0].Value as string;

    [Theory]
    [InlineData(nameof(EmployeesController.BulkChangePosition), "employees:write")]
    [InlineData(nameof(EmployeesController.BulkChangeEmploymentType), "employees:write")]
    [InlineData(nameof(EmployeesController.BulkStartOffboarding), "employees:offboard")]
    public void BulkActions_RequireTheSamePermissionAsTheSingleAction(string action, string permission)
        => Assert.Equal(permission, PermissionOf(action));

    [Fact]
    public async Task BulkChangePosition_SendsCommand_AndReturnsOk()
    {
        var ids = new[] { Guid.NewGuid() };
        var positionId = Guid.NewGuid();
        var response = BulkEmployeeActionResponse.From(Array.Empty<BulkEmployeeActionItemResponse>());
        _mediator.Setup(m => m.Send(It.IsAny<BulkChangeEmployeePositionCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<BulkEmployeeActionResponse>.Success(response));

        var result = await _sut.BulkChangePosition(
            new BulkChangePositionRequest(ids, positionId, new DateOnly(2026, 10, 1), "Promotion"), CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(response, ok.Value);
        _mediator.Verify(m => m.Send(It.Is<BulkChangeEmployeePositionCommand>(c =>
            c.EmployeeIds.SequenceEqual(ids) && c.PositionId == positionId && c.ChangeReason == "Promotion" && c.ReportsToEmployeeId == null),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkChangeEmploymentType_SendsCommand()
    {
        var ids = new[] { Guid.NewGuid() };
        _mediator.Setup(m => m.Send(It.IsAny<BulkChangeEmploymentTypeCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<BulkEmployeeActionResponse>.Success(BulkEmployeeActionResponse.From(Array.Empty<BulkEmployeeActionItemResponse>())));

        var result = await _sut.BulkChangeEmploymentType(new BulkChangeEmploymentTypeRequest(ids, "intern"), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        _mediator.Verify(m => m.Send(It.Is<BulkChangeEmploymentTypeCommand>(c => c.EmployeeIds.SequenceEqual(ids) && c.EmploymentTypeCode == "intern"), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task BulkStartOffboarding_SendsCommand()
    {
        var ids = new[] { Guid.NewGuid() };
        _mediator.Setup(m => m.Send(It.IsAny<BulkStartOffboardingCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<BulkEmployeeActionResponse>.Success(BulkEmployeeActionResponse.From(Array.Empty<BulkEmployeeActionItemResponse>())));

        var result = await _sut.BulkStartOffboarding(
            new BulkStartOffboardingRequest(ids, "retirement", new DateOnly(2026, 12, 31), "high", "eligible", null), CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        _mediator.Verify(m => m.Send(It.Is<BulkStartOffboardingCommand>(c =>
            c.EmployeeIds.SequenceEqual(ids) && c.Reason == "retirement" && c.KnowledgeRiskLevel == "high" && c.RehireEligibility == "eligible"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
```
Add usings for the three command namespaces, `ONEVO.Api.Contracts.CoreHr.Employees`, and `ONEVO.Application.Features.CoreHr.Employee.DTOs.Responses`.

- [ ] **Step 2: Run to verify failure** — `--filter "FullyQualifiedName~EmployeesControllerTests"` → build error.

- [ ] **Step 3: Implement**

`BulkEmployeeRequests.cs` (use the same namespace as `ChangePositionRequest.cs`):
```csharp
namespace ONEVO.Api.Contracts.CoreHr.Employees;

public sealed record BulkChangePositionRequest(
    IReadOnlyList<Guid> EmployeeIds, Guid PositionId, DateOnly EffectiveFrom, string ChangeReason, Guid? ReportsToEmployeeId = null);

public sealed record BulkChangeEmploymentTypeRequest(IReadOnlyList<Guid> EmployeeIds, string EmploymentTypeCode);

public sealed record BulkStartOffboardingRequest(
    IReadOnlyList<Guid> EmployeeIds, string Reason, DateOnly LastWorkingDate, string KnowledgeRiskLevel, string? RehireEligibility, string? Notes);
```

Controller actions:
```csharp
    /// <summary>Promote/transfer many employees into one position. Each employee goes through the
    /// single change-position rules; the response reports the outcome per employee.</summary>
    [HttpPost("bulk/change-position")]
    [RequirePermission("employees:write")]
    public async Task<IActionResult> BulkChangePosition(
        [FromBody] BulkChangePositionRequest request, CancellationToken ct = default)
    {
        var result = await _mediator.Send(new BulkChangeEmployeePositionCommand(
            request.EmployeeIds, request.PositionId, request.EffectiveFrom, request.ChangeReason, request.ReportsToEmployeeId), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }

    [HttpPost("bulk/employment-type")]
    [RequirePermission("employees:write")]
    public async Task<IActionResult> BulkChangeEmploymentType(
        [FromBody] BulkChangeEmploymentTypeRequest request, CancellationToken ct = default)
    {
        var result = await _mediator.Send(new BulkChangeEmploymentTypeCommand(request.EmployeeIds, request.EmploymentTypeCode), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }

    [HttpPost("bulk/offboarding/start")]
    [RequirePermission("employees:offboard")]
    public async Task<IActionResult> BulkStartOffboarding(
        [FromBody] BulkStartOffboardingRequest request, CancellationToken ct = default)
    {
        var result = await _mediator.Send(new BulkStartOffboardingCommand(
            request.EmployeeIds, request.Reason, request.LastWorkingDate, request.KnowledgeRiskLevel, request.RehireEligibility, request.Notes), ct);

        return result.IsSuccess
            ? Ok(result.Value)
            : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }
```

- [ ] **Step 4: Run tests**
- `--filter "FullyQualifiedName~EmployeesControllerTests"` → all pass.
- `dotnet test tests/ONEVO.Tests.Architecture/ONEVO.Tests.Architecture.csproj` → all pass (EmployeesControllerArchitectureTests may constrain controller shape; fix the new code, not the test).

- [ ] **Step 5: Commit**
```bash
git status
git add src/ONEVO.Api/Contracts/CoreHr/Employees/BulkEmployeeRequests.cs src/ONEVO.Api/Controllers/Tenant/CoreHr/EmployeesController.cs tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/EmployeesControllerTests.cs
git commit -m "feat(api): expose employee bulk action endpoints"
```

---

### Task 8: List endpoint — position / employment type / manager filters, sorting, work mode

**Files:**
- Modify: `src/ONEVO.Application/Features/CoreHr/Employee/Queries/ListEmployees/ListEmployeesQuery.cs`
- Modify: `src/ONEVO.Application/Features/CoreHr/Employee/Queries/ListEmployees/ListEmployeesQueryHandler.cs`
- Modify: `src/ONEVO.Application/Features/CoreHr/Employee/RepositoryInterfaces/IEmployeeRepository.cs` (`EmployeeListFilter`, line ~13)
- Modify: `src/ONEVO.Infrastructure/Persistence/Repositories/CoreHr/EfEmployeeRepository.cs` (`ListVisibleAsync`, lines 79-368)
- Modify: `src/ONEVO.Api/Controllers/Tenant/CoreHr/EmployeesController.cs` (`List`, lines 46-62)
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/ListEmployeesQueryHandlerTests.cs`, `tests/ONEVO.Tests.Unit/Features/CoreHr/Employee/EmployeesControllerTests.cs`, `tests/ONEVO.Tests.Integration/CoreHr/Employee/EmployeesListIntegrationTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public record ListEmployeesQuery(string? Search, Guid? DepartmentId, Guid? LegalEntityId, int Page = 1, int PageSize = 25,
      Guid? PositionId = null, IReadOnlyList<string>? EmploymentTypeCodes = null, Guid? ReportingManagerId = null,
      string? SortBy = null, bool SortDescending = false) : IRequest<Result<EmployeeListPageResponse>>;
  public sealed record EmployeeListFilter(string? Search, Guid? DepartmentId, Guid? LegalEntityId,
      IReadOnlyCollection<Guid>? RestrictToEmployeeIds = null, Guid? PositionId = null,
      IReadOnlyCollection<string>? EmploymentTypeCodes = null, Guid? ReportingManagerId = null,
      string? SortBy = null, bool SortDescending = false);
  ```
  Query string: `positionId`, `employmentType` (repeatable), `managerId`, `sortBy`, `sortDir` (`desc` → descending; anything else ascending). Canonical sort keys: `name, employeeNumber, position, department, employmentType, manager`; unknown → null (default ordering). List items now carry `WorkModeLabel`.

- [ ] **Step 1: Write failing unit tests**

In `ListEmployeesQueryHandlerTests.cs` (reuse its existing arrange helpers that make visibility non-empty and set a legal entity; the repository mock field is the `IEmployeeRepository` mock):
```csharp
    [Fact]
    public async Task Handle_PassesNewFiltersAndCanonicalSortToRepository()
    {
        // arrange: same setup as the file's existing happy-path test (visible ids non-empty, legal entity resolved)
        var positionId = Guid.NewGuid(); var managerId = Guid.NewGuid();

        await CreateHandler().Handle(new ListEmployeesQuery(null, null, null, 1, 25,
            positionId, new[] { "contract" }, managerId, "DEPARTMENT", true), CancellationToken.None);

        _employees.Verify(r => r.ListVisibleAsync(It.IsAny<Guid>(), It.IsAny<EmployeeVisibilityScope>(),
            It.Is<EmployeeListFilter>(f => f.PositionId == positionId && f.EmploymentTypeCodes!.Single() == "contract"
                && f.ReportingManagerId == managerId && f.SortBy == "department" && f.SortDescending),
            1, 25, It.IsAny<CancellationToken>(), It.IsAny<EmployeeListAttendanceOptions?>()), Times.Once);
    }

    [Fact]
    public async Task Handle_UnknownSortKey_IsIgnored()
    {
        // arrange: same as above
        await CreateHandler().Handle(new ListEmployeesQuery(null, null, null, SortBy: "salary"), CancellationToken.None);

        _employees.Verify(r => r.ListVisibleAsync(It.IsAny<Guid>(), It.IsAny<EmployeeVisibilityScope>(),
            It.Is<EmployeeListFilter>(f => f.SortBy == null), It.IsAny<int>(), It.IsAny<int>(),
            It.IsAny<CancellationToken>(), It.IsAny<EmployeeListAttendanceOptions?>()), Times.Once);
    }
```
In `EmployeesControllerTests.cs`:
```csharp
    [Fact]
    public async Task List_MapsNewQueryParameters()
    {
        _mediator.Setup(m => m.Send(It.IsAny<ListEmployeesQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<EmployeeListPageResponse>.Success(new EmployeeListPageResponse([], 0, 1, 25)));
        var positionId = Guid.NewGuid(); var managerId = Guid.NewGuid();

        await _sut.List(positionId: positionId, employmentTypes: new[] { "full_time", "intern" }, managerId: managerId,
            sortBy: "manager", sortDir: "desc", ct: CancellationToken.None);

        _mediator.Verify(m => m.Send(It.Is<ListEmployeesQuery>(q => q.PositionId == positionId
            && q.EmploymentTypeCodes!.SequenceEqual(new[] { "full_time", "intern" }) && q.ReportingManagerId == managerId
            && q.SortBy == "manager" && q.SortDescending), It.IsAny<CancellationToken>()), Times.Once);
    }
```

- [ ] **Step 2: Run to verify failure** — `--filter "FullyQualifiedName~ListEmployeesQueryHandlerTests|FullyQualifiedName~EmployeesControllerTests"` → build errors.

- [ ] **Step 3: Implement**

`ListEmployeesQuery.cs` — replace the record with the Produces signature above.

`IEmployeeRepository.cs` — replace `EmployeeListFilter` with the Produces signature above.

`ListEmployeesQueryHandler.cs` — add inside the class:
```csharp
    private static readonly HashSet<string> SortKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        "name", "employeeNumber", "position", "department", "employmentType", "manager"
    };
```
and where it builds `new EmployeeListFilter(...)`, pass the new fields:
```csharp
        var sortBy = request.SortBy is not null && SortKeys.TryGetValue(request.SortBy, out var canonicalSort) ? canonicalSort : null;
        var filter = new EmployeeListFilter(
            request.Search, request.DepartmentId, legalEntityId, visibility.EmployeeIds.ToHashSet(),
            request.PositionId,
            request.EmploymentTypeCodes is { Count: > 0 } codes ? codes : null,
            request.ReportingManagerId,
            sortBy,
            request.SortDescending);
```
(Keep the handler's existing variable names for search/department/legal entity/visible ids.)

`EmployeesController.List` — add parameters after `pageSize` and pass them:
```csharp
        [FromQuery] Guid? positionId = null,
        [FromQuery(Name = "employmentType")] string[]? employmentTypes = null,
        [FromQuery] Guid? managerId = null,
        [FromQuery] string? sortBy = null,
        [FromQuery] string? sortDir = null,
```
```csharp
            new ListEmployeesQuery(search, departmentId, legalEntityId, page, pageSize,
                positionId, employmentTypes, managerId, sortBy,
                string.Equals(sortDir, "desc", StringComparison.OrdinalIgnoreCase)), ct);
```

`EfEmployeeRepository.ListVisibleAsync`:
1. Add the work-mode join to `joined` exactly as in `GetVisibleByIdAsync` (after the `empStatus` join):
   ```csharp
            join workMode in _db.TimeAttendanceWorkModes.AsNoTracking() on e.WorkModeId equals (Guid?)workMode.Id into workModeJoin
            from workMode in workModeJoin.DefaultIfEmpty()
   ```
   and change the select to `select new { e, dept, legalEntity, empType, empStatus, workMode, position, manager };`
2. After the `LegalEntityId` filter block add:
   ```csharp
        if (filter.PositionId is not null)
        {
            joined = joined.Where(row => row.position != null && row.position.Id == filter.PositionId.Value);
        }

        if (filter.EmploymentTypeCodes is { Count: > 0 })
        {
            var employmentTypeCodes = filter.EmploymentTypeCodes.ToList();
            joined = joined.Where(row => row.empType != null && employmentTypeCodes.Contains(row.empType.Code));
        }

        if (filter.ReportingManagerId is not null)
        {
            joined = joined.Where(row => row.manager != null && row.manager.Id == filter.ReportingManagerId.Value);
        }
   ```
3. Directly after `var totalCount = await joined.CountAsync(ct);` add the ordering (default = last name, same as today):
   ```csharp
        var descending = filter.SortDescending;
        joined = filter.SortBy switch
        {
            "name" => descending
                ? joined.OrderByDescending(row => row.e.LastName).ThenByDescending(row => row.e.FirstName).ThenBy(row => row.e.Id)
                : joined.OrderBy(row => row.e.LastName).ThenBy(row => row.e.FirstName).ThenBy(row => row.e.Id),
            "employeeNumber" => descending
                ? joined.OrderByDescending(row => row.e.EmployeeNumber).ThenBy(row => row.e.Id)
                : joined.OrderBy(row => row.e.EmployeeNumber).ThenBy(row => row.e.Id),
            "position" => descending
                ? joined.OrderByDescending(row => row.position != null ? row.position.Name : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id)
                : joined.OrderBy(row => row.position != null ? row.position.Name : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id),
            "department" => descending
                ? joined.OrderByDescending(row => row.dept != null ? row.dept.Name : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id)
                : joined.OrderBy(row => row.dept != null ? row.dept.Name : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id),
            "employmentType" => descending
                ? joined.OrderByDescending(row => row.empType != null ? row.empType.Label : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id)
                : joined.OrderBy(row => row.empType != null ? row.empType.Label : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id),
            "manager" => descending
                ? joined.OrderByDescending(row => row.manager != null ? row.manager.LastName : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id)
                : joined.OrderBy(row => row.manager != null ? row.manager.LastName : null).ThenBy(row => row.e.LastName).ThenBy(row => row.e.Id),
            _ => joined.OrderBy(row => row.e.LastName).ThenBy(row => row.e.Id),
        };
   ```
4. Attendance path: split the chained `.Select(...).OrderByDescending(...).ThenBy(...).ThenBy(...).Skip(...).Take(...).ToList()` so that attention-priority ordering applies only when no explicit sort was requested (rows arrive from `joined.ToListAsync` already in the database order):
   ```csharp
            var projectedRows = rows.Select(row => { /* existing lambda body unchanged */ });
            var orderedRows = filter.SortBy is null
                ? projectedRows
                    .OrderByDescending(row => GetAttentionPriority(row.AttendanceSummary?.AttentionType))
                    .ThenBy(row => row.Row.e.LastName)
                    .ThenBy(row => row.Row.e.Id)
                    .AsEnumerable()
                : projectedRows;
            var pagedRows = orderedRows.Skip((page - 1) * pageSize).Take(pageSize).ToList();
   ```
   The existing later variable named `orderedRows` (the projection to `EmployeeListItemResponse`) must be renamed to `responseRows` to avoid the clash; update its `return`.
5. Non-attendance path: remove `.OrderBy(row => row.e.LastName).ThenBy(row => row.e.Id)` (ordering is now applied above).
6. `WorkModeLabel` is the 18th positional argument of `EmployeeListItemResponse`.
   - Non-attendance projection (18 args, ends with four `null`s): replace the **last** `null` with `row.workMode != null ? row.workMode.Name : null`.
   - Attendance projection (17 args, ends with the `monitoringWarnings.TryGetValue(...) ? overridden : row.AttendanceSummary` expression): append an 18th argument `row.Row.workMode != null ? row.Row.workMode.Name : null`.

Integration tests — add to `EmployeesListIntegrationTests.cs`, reusing its seeded data (two departments, employees E-0xx) and handler factory:
```csharp
    [Fact]
    public async Task List_SortByDepartmentDescending_OrdersByDepartmentName()
    {
        var handler = /* same factory call the existing tests use */;
        var result = await handler.Handle(new ListEmployeesQuery(null, null, null, 1, 100, SortBy: "department", SortDescending: true), CancellationToken.None);

        var names = result.Value!.Items.Select(i => i.DepartmentName).ToList();
        Assert.Equal(names.OrderByDescending(n => n, StringComparer.Ordinal).ToList(), names);
    }

    [Fact]
    public async Task List_FilterByEmploymentType_ReturnsOnlyMatchingRows()
    {
        var handler = /* same factory */;
        var all = await handler.Handle(new ListEmployeesQuery(null, null, null, 1, 100), CancellationToken.None);
        var label = all.Value!.Items.First().EmploymentTypeLabel;
        var code = /* look up the code for that label: await db.EmploymentTypes.Where(t => t.Label == label).Select(t => t.Code).SingleAsync() using the test's DbContext */;

        var filtered = await handler.Handle(new ListEmployeesQuery(null, null, null, 1, 100, EmploymentTypeCodes: new[] { code }), CancellationToken.None);

        Assert.NotEmpty(filtered.Value!.Items);
        Assert.All(filtered.Value.Items, i => Assert.Equal(label, i.EmploymentTypeLabel));
    }
```
(Replace the two `/* same factory */` comments with the exact construction expression used by the existing tests in that file; for `code` use the DbContext instance the file already holds. Postgres ordering of `NULL` names: descending puts NULLs first; if seeded data contains employees without a department, filter them out of both lists before comparing.)

- [ ] **Step 4: Run tests**
- Unit filter from Step 2 → pass; full unit project `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj` → pass.
- `dotnet test tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj --filter "FullyQualifiedName~EmployeesListIntegrationTests"` → pass.

- [ ] **Step 5: Commit**
```bash
git status
git add <all files above>
git commit -m "feat(core-hr): employee list filters by position/type/manager, sorting, work mode label"
```

---

### Task 9: Backend full verification

- [ ] Kill any running `ONEVO.Api.exe`, then run all three test projects:
  `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj`, `dotnet test tests/ONEVO.Tests.Architecture/ONEVO.Tests.Architecture.csproj`, `dotnet test tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj`.
  Paste the raw summary lines. Failures in files this plan did not touch: check `git log -1 -- <file>` and report as pre-existing, do not fix.
- [ ] Smoke the API manually (dev server running, logged in as an admin with `employees:write`): `POST /api/v1/employees/bulk/employment-type` with one own-scope employee id and `"employmentTypeCode":"contract"` → 200 with `succeeded: 1`; with `employeeIds: []` → 400.

---

## Part 2 — Frontend (Hrms--Web-application---front-end---v1)

All paths below are relative to `src/app/`.

### Task 10: Models, API methods, column definitions, CSV + URL-state utilities

**Files:**
- Modify: `modules/people/models/employee.model.ts`
- Modify: `modules/people/data-access/people-api.service.ts`
- Create: `modules/people/models/employment-type-options.ts`
- Create: `modules/people/models/employee-columns.ts`
- Create: `modules/people/utils/employee-csv.ts`
- Create: `modules/people/utils/employee-list-url-state.ts`
- Test: `modules/people/models/employee-columns.spec.ts`, `modules/people/utils/employee-csv.spec.ts`, `modules/people/utils/employee-list-url-state.spec.ts`, `modules/people/data-access/people-api.service.spec.ts` (create if absent)

**Interfaces:**
- Produces (exact names later tasks use):
  ```ts
  // employee.model.ts
  export type EmployeeSortKey = 'name' | 'employeeNumber' | 'position' | 'department' | 'employmentType' | 'manager';
  export type SortDirection = 'asc' | 'desc';
  // EmployeeListItemResponse gains: readonly workModeLabel?: string | null;
  // EmployeeListParams gains: positionId?, employmentType?: string[], managerId?, sortBy?: EmployeeSortKey, sortDir?: SortDirection
  export type BulkEmployeeActionOutcome = 'succeeded' | 'pendingApproval' | 'failed';
  export interface BulkEmployeeActionItem { readonly employeeId: string; readonly outcome: BulkEmployeeActionOutcome; readonly reason: string | null; }
  export interface BulkEmployeeActionResponse { readonly items: readonly BulkEmployeeActionItem[]; readonly succeeded: number; readonly pendingApproval: number; readonly failed: number; }
  export interface BulkChangePositionPayload { readonly employeeIds: readonly string[]; readonly positionId: string; readonly effectiveFrom: string; readonly changeReason: 'Promotion' | 'Transfer'; readonly reportsToEmployeeId: string | null; }
  export interface BulkChangeEmploymentTypePayload { readonly employeeIds: readonly string[]; readonly employmentTypeCode: string; }
  export interface BulkStartOffboardingPayload { readonly employeeIds: readonly string[]; readonly reason: string; readonly lastWorkingDate: string; readonly knowledgeRiskLevel: string; readonly rehireEligibility: string | null; readonly notes: string | null; }
  // PeopleApiService
  bulkChangePosition(p: BulkChangePositionPayload): Observable<BulkEmployeeActionResponse>        // POST {api}/employees/bulk/change-position
  bulkChangeEmploymentType(p: BulkChangeEmploymentTypePayload): Observable<BulkEmployeeActionResponse> // POST {api}/employees/bulk/employment-type
  bulkStartOffboarding(p: BulkStartOffboardingPayload): Observable<BulkEmployeeActionResponse>      // POST {api}/employees/bulk/offboarding/start
  // employment-type-options.ts
  export const EMPLOYMENT_TYPE_OPTIONS: readonly { readonly value: string; readonly label: string }[];
  // employee-columns.ts
  export type EmployeeColumnKey = 'employee' | 'employeeNumber' | 'position' | 'department' | 'employmentType' | 'reportingManager' | 'company' | 'workMode' | 'email' | 'status';
  export interface EmployeeColumnDef { readonly key: EmployeeColumnKey; readonly label: string; readonly sortKey?: EmployeeSortKey; readonly locked?: boolean; readonly value: (e: EmployeeListItemResponse) => string; }
  export const EMPLOYEE_COLUMNS: readonly EmployeeColumnDef[];
  export const DEFAULT_EMPLOYEE_COLUMNS: readonly EmployeeColumnKey[];
  export function loadEmployeeColumns(): EmployeeColumnKey[];
  export function saveEmployeeColumns(keys: readonly EmployeeColumnKey[]): void;
  // employee-csv.ts
  export function toEmployeeCsv(rows: readonly EmployeeListItemResponse[], columns: readonly EmployeeColumnDef[]): string;
  export function downloadCsv(filename: string, csv: string): void;
  // employee-list-url-state.ts
  export interface EmployeeListFilters { readonly departmentId: string | null; readonly positionId: string | null; readonly employmentTypes: readonly string[]; readonly managerId: string | null; }
  export const EMPTY_EMPLOYEE_FILTERS: EmployeeListFilters;
  export const EMPLOYEE_PAGE_SIZES: readonly number[]; // [10, 25, 50]
  export interface EmployeeListUrlState { readonly search: string; readonly page: number; readonly pageSize: number; readonly sortBy: EmployeeSortKey | null; readonly sortDir: SortDirection; readonly filters: EmployeeListFilters; }
  export function parseEmployeeListState(params: ParamMap): EmployeeListUrlState;
  export function toEmployeeListParams(state: EmployeeListUrlState): EmployeeListParams;
  export function filtersToQueryParams(filters: EmployeeListFilters): Record<string, string | null>;
  export function countActiveFilters(filters: EmployeeListFilters): number;
  export function selectionScopeKey(state: EmployeeListUrlState): string; // everything except page
  ```

- [ ] **Step 1: Write failing tests**

`modules/people/models/employee-columns.spec.ts`:
```ts
import { DEFAULT_EMPLOYEE_COLUMNS, EMPLOYEE_COLUMNS, loadEmployeeColumns, saveEmployeeColumns } from './employee-columns';

describe('employee columns', () => {
  beforeEach(() => localStorage.clear());

  it('defaults when nothing is stored', () => {
    expect(loadEmployeeColumns()).toEqual([...DEFAULT_EMPLOYEE_COLUMNS]);
  });

  it('round-trips a saved selection in canonical column order and always keeps the locked employee column', () => {
    saveEmployeeColumns(['email', 'position']);
    expect(loadEmployeeColumns()).toEqual(['employee', 'position', 'email']);
  });

  it('ignores unknown keys and falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('employee_list_columns', JSON.stringify(['bogus', 'status']));
    expect(loadEmployeeColumns()).toEqual(['employee', 'status']);
    localStorage.setItem('employee_list_columns', '{not json');
    expect(loadEmployeeColumns()).toEqual([...DEFAULT_EMPLOYEE_COLUMNS]);
  });

  it('survives a throwing localStorage', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(loadEmployeeColumns()).toEqual([...DEFAULT_EMPLOYEE_COLUMNS]);
    spy.mockRestore();
  });

  it('employee is the only locked column and every sortable column maps to a backend sort key', () => {
    expect(EMPLOYEE_COLUMNS.filter((c) => c.locked).map((c) => c.key)).toEqual(['employee']);
    expect(EMPLOYEE_COLUMNS.filter((c) => c.sortKey).map((c) => c.sortKey))
      .toEqual(['name', 'employeeNumber', 'position', 'department', 'employmentType', 'manager']);
  });
});
```

`modules/people/utils/employee-csv.spec.ts`:
```ts
import { EMPLOYEE_COLUMNS } from '../models/employee-columns';
import { EmployeeListItemResponse } from '../models/employee.model';
import { toEmployeeCsv } from './employee-csv';

const row = (overrides: Partial<EmployeeListItemResponse> = {}): EmployeeListItemResponse => ({
  id: 'e1', employeeNumber: 'DAPI-0015', fullName: 'Saif Ahamed', email: 'saif@example.com',
  departmentId: null, departmentName: 'Watercraft Engineering', positionId: null, positionName: 'Watercraft Engineer',
  legalEntityId: 'le1', legalEntityName: 'Dapi', employmentTypeLabel: 'Full-time', status: 'active',
  reportingManagerId: null, reportingManagerName: 'Abitha Devendran', ...overrides
});

describe('toEmployeeCsv', () => {
  const cols = EMPLOYEE_COLUMNS.filter((c) => ['employee', 'employeeNumber', 'position'].includes(c.key));

  it('writes a header and one line per row using the column labels and values', () => {
    expect(toEmployeeCsv([row()], cols)).toBe('Employee,ID,Position\r\nSaif Ahamed,DAPI-0015,Watercraft Engineer');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(toEmployeeCsv([row({ fullName: 'Doe, "J"\nX' })], cols.slice(0, 1))).toBe('Employee\r\n"Doe, ""J""\nX"');
  });

  it('neutralises spreadsheet formula prefixes', () => {
    expect(toEmployeeCsv([row({ fullName: '=HYPERLINK("x")' })], cols.slice(0, 1))).toBe('Employee\r\n"\'=HYPERLINK(""x"")"');
  });
});
```

`modules/people/utils/employee-list-url-state.spec.ts`:
```ts
import { convertToParamMap } from '@angular/router';
import { countActiveFilters, filtersToQueryParams, parseEmployeeListState, selectionScopeKey, toEmployeeListParams } from './employee-list-url-state';

describe('employee list URL state', () => {
  it('parses defaults from an empty URL', () => {
    expect(parseEmployeeListState(convertToParamMap({}))).toEqual({
      search: '', page: 1, pageSize: 25, sortBy: null, sortDir: 'asc',
      filters: { departmentId: null, positionId: null, employmentTypes: [], managerId: null }
    });
  });

  it('parses every param and rejects invalid page size / sort key', () => {
    const state = parseEmployeeListState(convertToParamMap({
      search: 'ab', page: '3', pageSize: '50', sortBy: 'department', sortDir: 'desc',
      departmentId: 'd1', positionId: 'p1', employmentType: 'full_time,intern', managerId: 'm1'
    }));
    expect(state).toEqual({
      search: 'ab', page: 3, pageSize: 50, sortBy: 'department', sortDir: 'desc',
      filters: { departmentId: 'd1', positionId: 'p1', employmentTypes: ['full_time', 'intern'], managerId: 'm1' }
    });
    const bad = parseEmployeeListState(convertToParamMap({ pageSize: '999', sortBy: 'salary', page: '-2' }));
    expect([bad.pageSize, bad.sortBy, bad.page]).toEqual([25, null, 1]);
  });

  it('maps state to API params, omitting empties', () => {
    const state = parseEmployeeListState(convertToParamMap({ sortBy: 'manager', sortDir: 'desc', employmentType: 'contract' }));
    expect(toEmployeeListParams(state)).toEqual({
      search: undefined, page: 1, pageSize: 25, departmentId: undefined, positionId: undefined,
      employmentType: ['contract'], managerId: undefined, sortBy: 'manager', sortDir: 'desc'
    });
  });

  it('filtersToQueryParams writes null for empty filters so router merge removes them', () => {
    expect(filtersToQueryParams({ departmentId: null, positionId: 'p', employmentTypes: [], managerId: null }))
      .toEqual({ departmentId: null, positionId: 'p', employmentType: null, managerId: null });
  });

  it('counts active filters and builds a selection key that ignores page only', () => {
    const a = parseEmployeeListState(convertToParamMap({ page: '1', departmentId: 'd' }));
    const b = parseEmployeeListState(convertToParamMap({ page: '2', departmentId: 'd' }));
    const c = parseEmployeeListState(convertToParamMap({ page: '1', departmentId: 'd', pageSize: '10' }));
    expect(countActiveFilters(a.filters)).toBe(1);
    expect(selectionScopeKey(a)).toBe(selectionScopeKey(b));
    expect(selectionScopeKey(a)).not.toBe(selectionScopeKey(c));
  });
});
```

`modules/people/data-access/people-api.service.spec.ts` (add these tests; create the file with a `TestBed` + `provideHttpClient()` + `provideHttpClientTesting()` setup if absent):
```ts
  it('sends repeated employmentType params for the list filter', () => {
    service.listEmployees({ employmentType: ['full_time', 'intern'], sortBy: 'name', sortDir: 'desc' }).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/employees'));
    expect(req.request.params.getAll('employmentType')).toEqual(['full_time', 'intern']);
    expect(req.request.params.get('sortDir')).toBe('desc');
    req.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
  });

  it('posts bulk actions to the bulk endpoints', () => {
    service.bulkChangeEmploymentType({ employeeIds: ['a'], employmentTypeCode: 'contract' }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/employees/bulk/employment-type')).flush({ items: [], succeeded: 0, pendingApproval: 0, failed: 0 });
    service.bulkStartOffboarding({ employeeIds: ['a'], reason: 'resignation', lastWorkingDate: '2026-10-31', knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/employees/bulk/offboarding/start')).flush({ items: [], succeeded: 0, pendingApproval: 0, failed: 0 });
    service.bulkChangePosition({ employeeIds: ['a'], positionId: 'p', effectiveFrom: '2026-10-01', changeReason: 'Transfer', reportsToEmployeeId: null }).subscribe();
    httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/employees/bulk/change-position')).flush({ items: [], succeeded: 0, pendingApproval: 0, failed: 0 });
  });
```

- [ ] **Step 2: Run to verify failure**
`npx ng test --watch=false --include=src/app/modules/people/models/employee-columns.spec.ts --include=src/app/modules/people/utils/employee-csv.spec.ts --include=src/app/modules/people/utils/employee-list-url-state.spec.ts --include=src/app/modules/people/data-access/people-api.service.spec.ts` → FAIL (missing modules/methods).

- [ ] **Step 3: Implement**

`employee.model.ts` — add `readonly workModeLabel?: string | null;` to `EmployeeListItemResponse`; add to `EmployeeListParams`:
```ts
  positionId?: string;
  employmentType?: readonly string[];
  managerId?: string;
  sortBy?: EmployeeSortKey;
  sortDir?: SortDirection;
```
and append the new types from **Produces** verbatim.

`people-api.service.ts` — in `toHttpParams`, support arrays (loop body):
```ts
      if (Array.isArray(value)) {
        for (const item of value) {
          httpParams = httpParams.append(key, String(item));
        }
        continue;
      }
```
(widen the `Object.entries` cast to `Record<string, unknown>` and keep the existing empty-value skip; use `httpParams.set(key, String(value))` for scalars.) Add:
```ts
  bulkChangePosition(payload: BulkChangePositionPayload): Observable<BulkEmployeeActionResponse> {
    return this.http.post<BulkEmployeeActionResponse>(`${environment.apiUrl}/employees/bulk/change-position`, payload);
  }

  bulkChangeEmploymentType(payload: BulkChangeEmploymentTypePayload): Observable<BulkEmployeeActionResponse> {
    return this.http.post<BulkEmployeeActionResponse>(`${environment.apiUrl}/employees/bulk/employment-type`, payload);
  }

  bulkStartOffboarding(payload: BulkStartOffboardingPayload): Observable<BulkEmployeeActionResponse> {
    return this.http.post<BulkEmployeeActionResponse>(`${environment.apiUrl}/employees/bulk/offboarding/start`, payload);
  }
```

`employment-type-options.ts`:
```ts
/** Same codes as the backend employment_types lookup (and EMPLOYMENT_TYPE_OPTIONS in employee-job-info). */
export const EMPLOYMENT_TYPE_OPTIONS: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'intern', label: 'Intern' }
];
```

`employee-columns.ts`:
```ts
import { EmployeeListItemResponse, EmployeeSortKey } from './employee.model';

export type EmployeeColumnKey =
  | 'employee' | 'employeeNumber' | 'position' | 'department' | 'employmentType'
  | 'reportingManager' | 'company' | 'workMode' | 'email' | 'status';

export interface EmployeeColumnDef {
  readonly key: EmployeeColumnKey;
  readonly label: string;
  readonly sortKey?: EmployeeSortKey;
  readonly locked?: boolean;
  readonly value: (employee: EmployeeListItemResponse) => string;
}

export const EMPLOYEE_COLUMNS: readonly EmployeeColumnDef[] = [
  { key: 'employee', label: 'Employee', sortKey: 'name', locked: true, value: (e) => e.fullName },
  { key: 'employeeNumber', label: 'ID', sortKey: 'employeeNumber', value: (e) => e.employeeNumber },
  { key: 'position', label: 'Position', sortKey: 'position', value: (e) => e.positionName ?? '' },
  { key: 'department', label: 'Department', sortKey: 'department', value: (e) => e.departmentName ?? '' },
  { key: 'employmentType', label: 'Employment', sortKey: 'employmentType', value: (e) => e.employmentTypeLabel },
  { key: 'reportingManager', label: 'Reporting Manager', sortKey: 'manager', value: (e) => e.reportingManagerName ?? '' },
  { key: 'company', label: 'Company', value: (e) => e.legalEntityName ?? '' },
  { key: 'workMode', label: 'Work Mode', value: (e) => e.workModeLabel ?? '' },
  { key: 'email', label: 'Email', value: (e) => e.email },
  { key: 'status', label: 'Status', value: (e) => e.status }
];

export const DEFAULT_EMPLOYEE_COLUMNS: readonly EmployeeColumnKey[] =
  ['employee', 'employeeNumber', 'position', 'department', 'employmentType', 'reportingManager'];

const STORAGE_KEY = 'employee_list_columns';

/** Per-browser preference; always canonical order, always includes the locked Employee column. */
export function loadEmployeeColumns(): EmployeeColumnKey[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...DEFAULT_EMPLOYEE_COLUMNS];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_EMPLOYEE_COLUMNS];
    return EMPLOYEE_COLUMNS.filter((c) => c.locked || parsed.includes(c.key)).map((c) => c.key);
  } catch {
    return [...DEFAULT_EMPLOYEE_COLUMNS];
  }
}

export function saveEmployeeColumns(keys: readonly EmployeeColumnKey[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // Storage blocked (private mode etc.) - the choice just won't persist.
  }
}
```

`employee-csv.ts`:
```ts
import { EmployeeColumnDef } from '../models/employee-columns';
import { EmployeeListItemResponse } from '../models/employee.model';

function csvCell(raw: string): string {
  // Leading = + - @ tab/CR make spreadsheet apps evaluate the cell as a formula.
  const value = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toEmployeeCsv(rows: readonly EmployeeListItemResponse[], columns: readonly EmployeeColumnDef[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(',');
  const lines = rows.map((row) => columns.map((c) => csvCell(c.value(row))).join(','));
  return [header, ...lines].join('\r\n');
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```
Note: the formula test expects the prefixed value to also be quoted because it contains `"`; `'=HYPERLINK("x")'` → `"'=HYPERLINK(""x"")"`.

`employee-list-url-state.ts`:
```ts
import { ParamMap } from '@angular/router';
import { EmployeeListParams, EmployeeSortKey, SortDirection } from '../models/employee.model';

export interface EmployeeListFilters {
  readonly departmentId: string | null;
  readonly positionId: string | null;
  readonly employmentTypes: readonly string[];
  readonly managerId: string | null;
}

export const EMPTY_EMPLOYEE_FILTERS: EmployeeListFilters = { departmentId: null, positionId: null, employmentTypes: [], managerId: null };
export const EMPLOYEE_PAGE_SIZES: readonly number[] = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 25;
const SORT_KEYS: readonly EmployeeSortKey[] = ['name', 'employeeNumber', 'position', 'department', 'employmentType', 'manager'];

export interface EmployeeListUrlState {
  readonly search: string;
  readonly page: number;
  readonly pageSize: number;
  readonly sortBy: EmployeeSortKey | null;
  readonly sortDir: SortDirection;
  readonly filters: EmployeeListFilters;
}

export function parseEmployeeListState(params: ParamMap): EmployeeListUrlState {
  const page = Number(params.get('page'));
  const pageSize = Number(params.get('pageSize'));
  const sortBy = params.get('sortBy') as EmployeeSortKey | null;
  const types = params.get('employmentType');
  return {
    search: params.get('search') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: EMPLOYEE_PAGE_SIZES.includes(pageSize) ? pageSize : DEFAULT_PAGE_SIZE,
    sortBy: sortBy && SORT_KEYS.includes(sortBy) ? sortBy : null,
    sortDir: params.get('sortDir') === 'desc' ? 'desc' : 'asc',
    filters: {
      departmentId: params.get('departmentId') || null,
      positionId: params.get('positionId') || null,
      employmentTypes: types ? types.split(',').filter(Boolean) : [],
      managerId: params.get('managerId') || null
    }
  };
}

export function toEmployeeListParams(state: EmployeeListUrlState): EmployeeListParams {
  return {
    search: state.search || undefined,
    page: state.page,
    pageSize: state.pageSize,
    departmentId: state.filters.departmentId ?? undefined,
    positionId: state.filters.positionId ?? undefined,
    employmentType: state.filters.employmentTypes.length ? [...state.filters.employmentTypes] : undefined,
    managerId: state.filters.managerId ?? undefined,
    sortBy: state.sortBy ?? undefined,
    sortDir: state.sortBy ? state.sortDir : undefined
  };
}

export function filtersToQueryParams(filters: EmployeeListFilters): Record<string, string | null> {
  return {
    departmentId: filters.departmentId,
    positionId: filters.positionId,
    employmentType: filters.employmentTypes.length ? filters.employmentTypes.join(',') : null,
    managerId: filters.managerId
  };
}

export function countActiveFilters(filters: EmployeeListFilters): number {
  return [filters.departmentId, filters.positionId, filters.managerId].filter(Boolean).length
    + (filters.employmentTypes.length ? 1 : 0);
}

/** Selection survives paging but not a change to what the list contains or how it's ordered. */
export function selectionScopeKey(state: EmployeeListUrlState): string {
  const { page: _page, ...rest } = state;
  return JSON.stringify(rest);
}
```
(The `toEmployeeListParams` spec expects `sortDir: 'desc'` when `sortBy` is set — matches.)

- [ ] **Step 4: Run tests** — same command → all pass.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/models/employee.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts src/app/modules/people/models/employment-type-options.ts src/app/modules/people/models/employee-columns.ts src/app/modules/people/models/employee-columns.spec.ts src/app/modules/people/utils/employee-csv.ts src/app/modules/people/utils/employee-csv.spec.ts src/app/modules/people/utils/employee-list-url-state.ts src/app/modules/people/utils/employee-list-url-state.spec.ts
git commit -m "feat(people): employee list models, bulk API, column defs, CSV and URL-state utils"
```

---

### Task 11: `<app-employee-directory-table>`

**Files:**
- Create: `modules/people/ui/employee-directory-table/employee-directory-table.component.ts`
- Create: `modules/people/ui/employee-directory-table/employee-directory-table.component.html`
- Create: `modules/people/ui/employee-directory-table/employee-directory-table.component.css`
- Test: `modules/people/ui/employee-directory-table/employee-directory-table.component.spec.ts`

**Interfaces:**
- Consumes: `EmployeeColumnDef`, `EMPLOYEE_COLUMNS` (Task 10); `MenuItem`, `DropdownMenuComponent` (`shared/ui/dropdown-menu/dropdown-menu.component`, test ids `menu-item-<id>`); `AvatarComponent`, `EmptyStateComponent`; attendance helpers from `modules/people/utils/employee-view.utils` (`attendanceWarningLabel`, `attendanceSeverityClass`, `attendanceAttentionLabel`, `attendanceStatusLabel`, `breakOverageLabel`).
- Produces:
  ```ts
  // selector 'app-employee-directory-table'
  employees = input.required<readonly EmployeeListItemResponse[]>();
  columns = input.required<readonly EmployeeColumnDef[]>();
  sortBy = input<EmployeeSortKey | null>(null);
  sortDir = input<SortDirection>('asc');
  selectedIds = input<ReadonlySet<string>>(new Set());
  rowMenuItems = input<(employee: EmployeeListItemResponse) => MenuItem[]>(() => []);
  sortChanged = output<{ sortBy: EmployeeSortKey; sortDir: SortDirection }>();
  selectionChanged = output<{ id: string; selected: boolean }>();
  selectAllChanged = output<{ ids: string[]; selected: boolean }>();
  rowAction = output<{ employee: EmployeeListItemResponse; actionId: string }>();
  // test ids: employee-row-<id>, employee-select-<id>, employee-select-all, employee-sort-<columnKey>, employee-row-menu-<id>
  ```

- [ ] **Step 1: Write failing tests**

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { EMPLOYEE_COLUMNS, EmployeeColumnDef } from '../../models/employee-columns';
import { EmployeeListItemResponse } from '../../models/employee.model';
import { MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { EmployeeDirectoryTableComponent } from './employee-directory-table.component';

const emp = (id: string, overrides: Partial<EmployeeListItemResponse> = {}): EmployeeListItemResponse => ({
  id, employeeNumber: `N-${id}`, fullName: `Person ${id}`, email: `${id}@x.com`, departmentId: null, departmentName: 'Dept',
  positionId: null, positionName: 'Pos', legalEntityId: 'le', legalEntityName: 'Co', employmentTypeLabel: 'Full-time',
  status: 'active', reportingManagerId: null, reportingManagerName: 'Boss', ...overrides
});

@Component({
  standalone: true,
  imports: [EmployeeDirectoryTableComponent],
  template: `
    <app-employee-directory-table
      [employees]="employees()" [columns]="columns()" [sortBy]="'department'" [sortDir]="'asc'"
      [selectedIds]="selected()" [rowMenuItems]="menu"
      (sortChanged)="sorts.push($event)" (selectionChanged)="toggles.push($event)"
      (selectAllChanged)="selectAlls.push($event)" (rowAction)="actions.push($event)" />
  `
})
class HostComponent {
  employees = signal<readonly EmployeeListItemResponse[]>([emp('a'), emp('b', { reportingManagerName: null })]);
  columns = signal<readonly EmployeeColumnDef[]>(EMPLOYEE_COLUMNS.filter((c) => ['employee', 'department', 'reportingManager', 'email'].includes(c.key)));
  selected = signal<ReadonlySet<string>>(new Set());
  menu = (e: EmployeeListItemResponse): MenuItem[] => (e.id === 'a' ? [{ id: 'promote', label: 'Promote' }] : []);
  sorts: unknown[] = []; toggles: unknown[] = []; selectAlls: unknown[] = []; actions: { employee: EmployeeListItemResponse; actionId: string }[] = [];
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent], providers: [{ provide: Router, useValue: { navigate: vi.fn() } }] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  return { fixture, el, q, host: fixture.componentInstance, router: TestBed.inject(Router) as unknown as { navigate: ReturnType<typeof vi.fn> } };
}

describe('EmployeeDirectoryTableComponent', () => {
  it('renders only the given columns, in order, plus select and menu columns', async () => {
    const { el } = await setup();
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent!.trim()).filter(Boolean);
    expect(headers).toEqual(['Employee', 'Department', 'Reporting Manager', 'Email']);
  });

  it('shows an em dash for empty values', async () => {
    const { q } = await setup();
    expect(q('employee-row-b')!.textContent).toContain('—');
  });

  it('marks the active sort column and emits toggled direction on the same column, asc on a new one', async () => {
    const { q, host } = await setup();
    expect(q('employee-sort-department')!.getAttribute('aria-sort')).toBe('ascending');
    q('employee-sort-department')!.click();
    q('employee-sort-employee')!.click();
    expect(host.sorts).toEqual([{ sortBy: 'department', sortDir: 'desc' }, { sortBy: 'name', sortDir: 'asc' }]);
  });

  it('email column is not sortable', async () => {
    const { q } = await setup();
    expect(q('employee-sort-email')).toBeNull();
  });

  it('row click navigates to the detail page; checkbox and menu clicks do not', async () => {
    const { fixture, q, router } = await setup();
    q('employee-row-a')!.click();
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees', 'a']);
    router.navigate.mockClear();
    (q('employee-select-a') as HTMLInputElement).click();
    q('employee-row-menu-a')!.querySelector('button')!.click();
    fixture.detectChanges();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('emits selection and select-all over the visible rows; header reflects partial selection', async () => {
    const { fixture, q, host } = await setup();
    (q('employee-select-a') as HTMLInputElement).click();
    expect(host.toggles).toEqual([{ id: 'a', selected: true }]);
    host.selected.set(new Set(['a']));
    fixture.detectChanges();
    const all = q('employee-select-all') as HTMLInputElement;
    expect(all.indeterminate).toBe(true);
    all.click();
    expect(host.selectAlls).toEqual([{ ids: ['a', 'b'], selected: true }]);
    expect(q('employee-row-a')!.classList).toContain('edt__row--selected');
  });

  it('renders a row menu only when the row has items, and emits the chosen action', async () => {
    const { fixture, el, q, host } = await setup();
    expect(q('employee-row-menu-b')!.querySelector('button')).toBeNull();
    q('employee-row-menu-a')!.querySelector('button')!.click();
    fixture.detectChanges();
    (el.querySelector('[data-testid="menu-item-promote"]') as HTMLElement).click();
    expect(host.actions.map((a) => [a.employee.id, a.actionId])).toEqual([['a', 'promote']]);
  });

  it('shows the empty state when there are no employees', async () => {
    const { fixture, el, host } = await setup();
    host.employees.set([]);
    fixture.detectChanges();
    expect(el.textContent).toContain('No employees found');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx ng test --watch=false --include=src/app/modules/people/ui/employee-directory-table/employee-directory-table.component.spec.ts` → FAIL.

- [ ] **Step 3: Implement**

`employee-directory-table.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { DropdownMenuComponent, MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { EmployeeColumnDef } from '../../models/employee-columns';
import { EmployeeListItemResponse, EmployeeSortKey, SortDirection } from '../../models/employee.model';
import {
  attendanceAttentionLabel,
  attendanceSeverityClass,
  attendanceStatusLabel,
  attendanceWarningLabel,
  breakOverageLabel
} from '../../utils/employee-view.utils';

@Component({
  selector: 'app-employee-directory-table',
  standalone: true,
  imports: [AvatarComponent, DropdownMenuComponent, EmptyStateComponent],
  templateUrl: './employee-directory-table.component.html',
  styleUrl: './employee-directory-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDirectoryTableComponent {
  private readonly router = inject(Router);

  readonly employees = input.required<readonly EmployeeListItemResponse[]>();
  readonly columns = input.required<readonly EmployeeColumnDef[]>();
  readonly sortBy = input<EmployeeSortKey | null>(null);
  readonly sortDir = input<SortDirection>('asc');
  readonly selectedIds = input<ReadonlySet<string>>(new Set());
  readonly rowMenuItems = input<(employee: EmployeeListItemResponse) => MenuItem[]>(() => []);

  readonly sortChanged = output<{ sortBy: EmployeeSortKey; sortDir: SortDirection }>();
  readonly selectionChanged = output<{ id: string; selected: boolean }>();
  readonly selectAllChanged = output<{ ids: string[]; selected: boolean }>();
  readonly rowAction = output<{ employee: EmployeeListItemResponse; actionId: string }>();

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceSeverityClass = attendanceSeverityClass;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;

  protected readonly menuItemsById = computed(() => {
    const itemsFor = this.rowMenuItems();
    return new Map(this.employees().map((e) => [e.id, itemsFor(e)] as const));
  });

  protected readonly visibleIds = computed(() => this.employees().map((e) => e.id));
  protected readonly allSelected = computed(() => {
    const ids = this.visibleIds();
    return ids.length > 0 && ids.every((id) => this.selectedIds().has(id));
  });
  protected readonly someSelected = computed(() =>
    !this.allSelected() && this.visibleIds().some((id) => this.selectedIds().has(id)));

  protected ariaSort(column: EmployeeColumnDef): 'ascending' | 'descending' | 'none' {
    if (!column.sortKey || column.sortKey !== this.sortBy()) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  protected onSort(column: EmployeeColumnDef): void {
    if (!column.sortKey) return;
    const sortDir: SortDirection = column.sortKey === this.sortBy() && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChanged.emit({ sortBy: column.sortKey, sortDir });
  }

  protected openEmployee(employee: EmployeeListItemResponse): void {
    void this.router.navigate(['/people/employees', employee.id]);
  }

  protected onRowSelect(id: string, event: Event): void {
    this.selectionChanged.emit({ id, selected: (event.target as HTMLInputElement).checked });
  }

  protected onSelectAll(event: Event): void {
    this.selectAllChanged.emit({ ids: this.visibleIds(), selected: (event.target as HTMLInputElement).checked });
  }

  protected onMenuSelected(employee: EmployeeListItemResponse, actionId: string): void {
    this.rowAction.emit({ employee, actionId });
  }
}
```

`employee-directory-table.component.html`:
```html
@if (employees().length === 0) {
  <app-empty-state title="No employees found" description="Try adjusting your search or filters." />
} @else {
  <div class="edt__scroll">
    <table class="edt">
      <thead>
        <tr>
          <th class="edt__select-cell">
            <input type="checkbox" data-testid="employee-select-all" aria-label="Select all employees on this page"
              [checked]="allSelected()" [indeterminate]="someSelected()" (change)="onSelectAll($event)" />
          </th>
          @for (column of columns(); track column.key) {
            <th [attr.aria-sort]="ariaSort(column)" [class]="'edt__col-' + column.key">
              @if (column.sortKey) {
                <button type="button" class="edt__sort" [attr.data-testid]="'employee-sort-' + column.key" [attr.aria-sort]="ariaSort(column)" (click)="onSort(column)">
                  {{ column.label }}
                  <svg class="edt__sort-icon" [class.edt__sort-icon--active]="ariaSort(column) !== 'none'" viewBox="0 0 24 24" aria-hidden="true">
                    @if (ariaSort(column) === 'descending') { <path d="M8 10l4 4 4-4" /> }
                    @else if (ariaSort(column) === 'ascending') { <path d="M8 14l4-4 4 4" /> }
                    @else { <path d="M8 9l4-4 4 4M8 15l4 4 4-4" /> }
                  </svg>
                </button>
              } @else {
                {{ column.label }}
              }
            </th>
          }
          <th class="edt__menu-cell" aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        @for (employee of employees(); track employee.id) {
          <tr class="edt__row" tabindex="0" [attr.data-testid]="'employee-row-' + employee.id"
            [class.edt__row--selected]="selectedIds().has(employee.id)"
            (click)="openEmployee(employee)" (keydown.enter)="openEmployee(employee)">
            <td class="edt__select-cell" (click)="$event.stopPropagation()">
              <input type="checkbox" [attr.data-testid]="'employee-select-' + employee.id" [attr.aria-label]="'Select ' + employee.fullName"
                [checked]="selectedIds().has(employee.id)" (change)="onRowSelect(employee.id, $event)" />
            </td>
            @for (column of columns(); track column.key) {
              <td [class]="'edt__col-' + column.key">
                @switch (column.key) {
                  @case ('employee') {
                    <div class="emp-identity">
                      <div class="emp-avatar-wrapper"
                        [class.emp-avatar-wrapper--warning]="attendanceWarningLabel(employee) !== null"
                        [attr.aria-label]="attendanceWarningLabel(employee)" [attr.title]="attendanceWarningLabel(employee)">
                        <app-avatar class="emp-avatar" [userName]="employee.fullName" size="md" shape="circle" />
                        <span class="emp-status-dot-avatar"
                          [class.emp-status-dot-avatar--active]="employee.status.toLowerCase() === 'active'"
                          [class.emp-status-dot-avatar--inactive]="employee.status.toLowerCase() !== 'active'"
                          [title]="'Status: ' + employee.status"></span>
                      </div>
                      <div class="emp-info">
                        <span class="edt__name" [title]="employee.fullName">{{ employee.fullName }}</span>
                        @if (attendanceAttentionLabel(employee); as attentionLabel) {
                          <span class="emp-attention-indicator" [class]="attendanceSeverityClass(employee)" [attr.title]="attentionLabel">{{ attentionLabel }}</span>
                        } @else if (attendanceStatusLabel(employee); as statusLabel) {
                          <span class="emp-attendance-status-label" [attr.title]="statusLabel">{{ statusLabel }}</span>
                        }
                        @if (breakOverageLabel(employee); as breakLabel) {
                          <span class="emp-break-overage-marker emp-attention--critical" [attr.title]="breakLabel">{{ breakLabel }}</span>
                        }
                      </div>
                    </div>
                  }
                  @case ('employeeNumber') {
                    <span class="edt__pill">{{ employee.employeeNumber || '—' }}</span>
                  }
                  @case ('reportingManager') {
                    @if (employee.reportingManagerName) {
                      <span class="edt__manager">
                        <app-avatar [userName]="employee.reportingManagerName" size="xs" shape="circle" />
                        {{ employee.reportingManagerName }}
                      </span>
                    } @else { — }
                  }
                  @default {
                    {{ column.value(employee) || '—' }}
                  }
                }
              </td>
            }
            <td class="edt__menu-cell" [attr.data-testid]="'employee-row-menu-' + employee.id" (click)="$event.stopPropagation()">
              @if (menuItemsById().get(employee.id); as items) {
                @if (items.length > 0) {
                  <app-dropdown-menu [items]="items" ariaLabel="Employee actions" (selected)="onMenuSelected(employee, $event)">
                    <button menu-trigger type="button" class="edt__menu-btn" [attr.aria-label]="'Actions for ' + employee.fullName">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></svg>
                    </button>
                  </app-dropdown-menu>
                }
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  </div>
}
```

`employee-directory-table.component.css` — backlog visual language (from `modules/work/ui/task-table/task-table.component.ts` lines 256-294, 405-406), then **append verbatim** from `modules/people/ui/employee-table/employee-table.component.css` every rule whose selector starts with `.emp-identity`, `.emp-avatar-wrapper`, `.emp-avatar`, `.emp-status-dot-avatar`, `.emp-info`, `.emp-attention-indicator`, `.emp-attention--`, `.emp-attendance-status-label`, `.emp-break-overage-marker` (that file is deleted in Task 15, so copy now):
```css
:host { display: block; }
.edt__scroll { overflow-x: auto; border-radius: 12px; background: var(--color-surface-secondary); padding: 2px 4px 6px; }
.edt { width: 100%; min-width: 900px; border-collapse: separate; border-spacing: 0 5px; color: var(--color-text-primary); }
.edt th, .edt td { text-align: left; white-space: nowrap; vertical-align: middle; }
.edt td { overflow: hidden; text-overflow: ellipsis; max-width: 260px; padding: 7px 14px; font-size: 13px; }
.edt thead tr { background: var(--color-surface-secondary); }
.edt th { padding: 13px 16px; color: var(--color-text-secondary); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
.edt thead th:first-child { border-top-left-radius: 8px; }
.edt thead th:last-child { border-top-right-radius: 8px; }
.edt__sort { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: none; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; cursor: pointer; transition: color 160ms ease; }
.edt__sort:hover { color: var(--color-accent); }
.edt__sort-icon { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; opacity: .5; }
.edt__sort-icon--active { opacity: 1; color: var(--color-accent); }
.edt__row { cursor: pointer; }
.edt__row td { background: var(--color-surface); border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); transition: background-color 150ms ease, border-color 150ms ease; }
.edt__row td:first-child { border-left: 1px solid var(--color-border); border-top-left-radius: 8px; border-bottom-left-radius: 8px; }
.edt__row td:last-child { border-right: 1px solid var(--color-border); border-top-right-radius: 8px; border-bottom-right-radius: 8px; }
.edt__row:hover td { background: var(--color-surface-secondary); border-color: color-mix(in srgb, var(--color-accent) 22%, var(--color-border)); }
.edt__row:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.edt__row--selected td { background: color-mix(in srgb, var(--color-accent) 7%, var(--color-surface)); border-color: color-mix(in srgb, var(--color-accent) 38%, var(--color-border)); }
.edt__select-cell { width: 1%; }
.edt__select-cell input[type="checkbox"] { width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-accent); }
.edt__menu-cell { width: 1%; overflow: visible !important; text-align: right; }
.edt__menu-btn { display: inline-flex; padding: 4px; border: 0; border-radius: 6px; background: transparent; color: var(--color-text-secondary); cursor: pointer; }
.edt__menu-btn:hover { background: var(--color-surface-secondary); color: var(--color-text-primary); }
.edt__menu-btn svg { width: 16px; height: 16px; fill: currentColor; }
.edt__name { font-weight: 600; }
.edt__pill { padding: 2px 8px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 12px; }
.edt__manager { display: inline-flex; align-items: center; gap: 8px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
/* + verbatim employee-cell rules from employee-table.component.css (see above) */
```
Note: `td { overflow: hidden }` would clip the row menu's popover panel, hence `.edt__menu-cell { overflow: visible !important; }`; the scroll container's `overflow-x: auto` can still clip a menu on the last rows — if the browser check (Task 17) shows clipping, set `direction="up"` on the row menu for the last two rows (`$last`/`$index >= employees().length - 2`).

- [ ] **Step 4: Run tests** — same command → 8 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/ui/employee-directory-table/
git commit -m "feat(people): add backlog-style employee directory table"
```

---

### Task 12: `<app-employee-column-picker>`

**Files:**
- Create: `modules/people/ui/employee-column-picker/employee-column-picker.component.ts`
- Test: `modules/people/ui/employee-column-picker/employee-column-picker.component.spec.ts`

**Interfaces:**
- Consumes: `EMPLOYEE_COLUMNS`, `DEFAULT_EMPLOYEE_COLUMNS`, `EmployeeColumnKey` (Task 10); `PopoverComponent` (`shared/ui/popover/popover.component`: inputs `open`, `align`, `ariaLabel`; output `closed`; slots `[popover-trigger]`, `[popover-panel]`).
- Produces: selector `app-employee-column-picker`; `visible = input.required<readonly EmployeeColumnKey[]>()`; `applied = output<EmployeeColumnKey[]>()` (canonical order, always includes `employee`). Test ids: `columns-trigger`, `columns-search`, `column-toggle-<key>`, `columns-reset`, `columns-apply`.

- [ ] **Step 1: Write failing tests**
```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmployeeColumnKey } from '../../models/employee-columns';
import { EmployeeColumnPickerComponent } from './employee-column-picker.component';

@Component({
  standalone: true,
  imports: [EmployeeColumnPickerComponent],
  template: `<app-employee-column-picker [visible]="visible()" (applied)="applied.push($event)" />`
})
class HostComponent {
  visible = signal<readonly EmployeeColumnKey[]>(['employee', 'position']);
  applied: EmployeeColumnKey[][] = [];
}

async function setup() {
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(id: string) => el.querySelector(`[data-testid="${id}"]`) as T | null;
  const open = () => { q('columns-trigger')!.click(); fixture.detectChanges(); };
  return { fixture, q, open, host: fixture.componentInstance };
}

describe('EmployeeColumnPickerComponent', () => {
  it('opens with the current visibility checked and employee locked', async () => {
    const { q, open } = await setup();
    open();
    expect(q<HTMLInputElement>('column-toggle-position')!.checked).toBe(true);
    expect(q<HTMLInputElement>('column-toggle-email')!.checked).toBe(false);
    expect(q<HTMLInputElement>('column-toggle-employee')!.disabled).toBe(true);
  });

  it('stages toggles and emits canonical order only on Apply', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q<HTMLInputElement>('column-toggle-email')!.click();
    q<HTMLInputElement>('column-toggle-position')!.click();
    q<HTMLInputElement>('column-toggle-department')!.click();
    fixture.detectChanges();
    expect(host.applied).toEqual([]);
    q('columns-apply')!.click();
    fixture.detectChanges();
    expect(host.applied).toEqual([['employee', 'department', 'email']]);
    expect(q('columns-apply')).toBeNull();
  });

  it('Reset restores the defaults in the draft', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q('columns-reset')!.click();
    fixture.detectChanges();
    q('columns-apply')!.click();
    expect(host.applied[0]).toEqual(['employee', 'employeeNumber', 'position', 'department', 'employmentType', 'reportingManager']);
  });

  it('search filters the list by label', async () => {
    const { fixture, q, open } = await setup();
    open();
    const search = q<HTMLInputElement>('columns-search')!;
    search.value = 'mail';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('column-toggle-email')).not.toBeNull();
    expect(q('column-toggle-position')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx ng test --watch=false --include=src/app/modules/people/ui/employee-column-picker/employee-column-picker.component.spec.ts` → FAIL.

- [ ] **Step 3: Implement**
```ts
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { DEFAULT_EMPLOYEE_COLUMNS, EMPLOYEE_COLUMNS, EmployeeColumnKey } from '../../models/employee-columns';

@Component({
  selector: 'app-employee-column-picker',
  standalone: true,
  imports: [PopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-popover [open]="open()" align="right" ariaLabel="Columns" (closed)="open.set(false)">
      <button popover-trigger type="button" class="ecp__trigger" data-testid="columns-trigger" [attr.aria-expanded]="open()" (click)="toggle()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM10 5v14M15 5v14" /></svg>
        Columns
      </button>
      <div popover-panel class="ecp__panel">
        <p class="ecp__title">Columns</p>
        <input class="ecp__search" type="search" placeholder="Search columns…" data-testid="columns-search"
          [value]="search()" (input)="search.set($any($event.target).value)" />
        <ul class="ecp__list">
          @for (column of filteredColumns(); track column.key) {
            <li>
              <label class="ecp__item">
                <input type="checkbox" [attr.data-testid]="'column-toggle-' + column.key"
                  [checked]="draft().has(column.key)" [disabled]="column.locked" (change)="toggleColumn(column.key)" />
                {{ column.label }}
              </label>
            </li>
          }
        </ul>
        <div class="ecp__actions">
          <button type="button" class="ecp__btn" data-testid="columns-reset" (click)="reset()">Reset</button>
          <button type="button" class="ecp__btn ecp__btn--primary" data-testid="columns-apply" (click)="apply()">Apply</button>
        </div>
      </div>
    </app-popover>
  `,
  styles: [`
    .ecp__trigger { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .ecp__trigger:hover { background: var(--color-surface-secondary); }
    .ecp__trigger svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; }
    .ecp__panel { display: flex; flex-direction: column; gap: 10px; width: 15rem; }
    .ecp__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
    .ecp__search { padding: 6px 9px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 12px; }
    .ecp__list { display: flex; flex-direction: column; gap: 2px; max-height: 16rem; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    .ecp__item { display: flex; align-items: center; gap: 8px; padding: 4px 2px; color: var(--color-text-primary); font-size: 13px; cursor: pointer; }
    .ecp__item input { accent-color: var(--color-accent); }
    .ecp__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .ecp__btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; cursor: pointer; }
    .ecp__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: #fff; }
  `]
})
export class EmployeeColumnPickerComponent {
  readonly visible = input.required<readonly EmployeeColumnKey[]>();
  readonly applied = output<EmployeeColumnKey[]>();

  protected readonly open = signal(false);
  protected readonly search = signal('');
  protected readonly draft = signal<ReadonlySet<EmployeeColumnKey>>(new Set());

  protected readonly filteredColumns = computed(() => {
    const term = this.search().trim().toLowerCase();
    return EMPLOYEE_COLUMNS.filter((c) => !term || c.label.toLowerCase().includes(term));
  });

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.draft.set(new Set(this.visible()));
    this.search.set('');
    this.open.set(true);
  }

  protected toggleColumn(key: EmployeeColumnKey): void {
    const next = new Set(this.draft());
    if (next.has(key)) next.delete(key); else next.add(key);
    this.draft.set(next);
  }

  protected reset(): void {
    this.draft.set(new Set(DEFAULT_EMPLOYEE_COLUMNS));
  }

  protected apply(): void {
    const draft = this.draft();
    this.applied.emit(EMPLOYEE_COLUMNS.filter((c) => c.locked || draft.has(c.key)).map((c) => c.key));
    this.open.set(false);
  }
}
```

- [ ] **Step 4: Run tests** → 4 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/ui/employee-column-picker/
git commit -m "feat(people): add employee column picker popover"
```

---

### Task 13: `<app-employee-filter-popover>`

**Files:**
- Create: `modules/people/ui/employee-filter-popover/employee-filter-popover.component.ts`
- Test: `modules/people/ui/employee-filter-popover/employee-filter-popover.component.spec.ts`

**Interfaces:**
- Consumes: `EmployeeListFilters`, `EMPTY_EMPLOYEE_FILTERS`, `countActiveFilters`, `EMPLOYMENT_TYPE_OPTIONS` (Task 10); `DepartmentApiService.listFlat(legalEntityId, params)` (`modules/organization/data-access/department-api.service`, returns `{ items: { id, name }[] }`); `PositionApiService.listFlat(legalEntityId, { pageSize, includeInactive })` (`modules/organization/data-access/position-api.service`); `PeopleApiService.listEmployees({ legalEntityId, pageSize })`; `CustomSelectComponent` (`shared/ui/custom-select/custom-select.component`: inputs `label`, `placeholder`, `options: SelectOption[]`, `value`; output `valueChange: string`); `SelectOption` (`shared/ui/select/select.component`); `PopoverComponent`.
- Produces: selector `app-employee-filter-popover`; `value = input.required<EmployeeListFilters>()`; `legalEntityId = input<string | null>(null)`; `applied = output<EmployeeListFilters>()`. Test ids: `filter-trigger`, `filter-count`, `filter-type-<code>`, `filter-reset`, `filter-apply`, `filter-no-company`.

- [ ] **Step 1: Write failing tests**
```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeListFilters, EMPTY_EMPLOYEE_FILTERS } from '../../utils/employee-list-url-state';
import { EmployeeFilterPopoverComponent } from './employee-filter-popover.component';

@Component({
  standalone: true,
  imports: [EmployeeFilterPopoverComponent],
  template: `<app-employee-filter-popover [value]="value()" [legalEntityId]="le()" (applied)="applied.push($event)" />`
})
class HostComponent {
  value = signal<EmployeeListFilters>({ ...EMPTY_EMPLOYEE_FILTERS, departmentId: 'd1' });
  le = signal<string | null>('le-1');
  applied: EmployeeListFilters[] = [];
}

async function setup() {
  const departments = { listFlat: vi.fn(() => of({ items: [{ id: 'd1', name: 'Engineering' }] })) };
  const positions = { listFlat: vi.fn(() => of({ items: [{ id: 'p1', name: 'Engineer' }] })) };
  const people = { listEmployees: vi.fn(() => of({ items: [{ id: 'm1', fullName: 'Boss' }], totalCount: 1, page: 1, pageSize: 100 })) };
  await TestBed.configureTestingModule({
    imports: [HostComponent],
    providers: [
      { provide: DepartmentApiService, useValue: departments },
      { provide: PositionApiService, useValue: positions },
      { provide: PeopleApiService, useValue: people }
    ]
  }).compileComponents();
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(id: string) => el.querySelector(`[data-testid="${id}"]`) as T | null;
  const open = () => { q('filter-trigger')!.click(); fixture.detectChanges(); };
  return { fixture, q, open, host: fixture.componentInstance, departments, positions, people };
}

describe('EmployeeFilterPopoverComponent', () => {
  it('shows the active filter count on the trigger', async () => {
    const { q } = await setup();
    expect(q('filter-count')!.textContent!.trim()).toBe('1');
  });

  it('loads options for the selected company once', async () => {
    const { open, departments, positions, people } = await setup();
    open(); open(); open();
    expect(departments.listFlat).toHaveBeenCalledTimes(1);
    expect(departments.listFlat).toHaveBeenCalledWith('le-1', expect.objectContaining({ pageSize: 100 }));
    expect(positions.listFlat).toHaveBeenCalledWith('le-1', expect.objectContaining({ includeInactive: false }));
    expect(people.listEmployees).toHaveBeenCalledWith(expect.objectContaining({ legalEntityId: 'le-1', pageSize: 100 }));
  });

  it('stages employment types and emits the full filter object on Apply', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q<HTMLInputElement>('filter-type-contract')!.click();
    q<HTMLInputElement>('filter-type-intern')!.click();
    fixture.detectChanges();
    expect(host.applied).toEqual([]);
    q('filter-apply')!.click();
    expect(host.applied).toEqual([{ departmentId: 'd1', positionId: null, employmentTypes: ['contract', 'intern'], managerId: null }]);
  });

  it('Reset then Apply emits empty filters', async () => {
    const { fixture, q, open, host } = await setup();
    open();
    q('filter-reset')!.click();
    fixture.detectChanges();
    q('filter-apply')!.click();
    expect(host.applied).toEqual([EMPTY_EMPLOYEE_FILTERS]);
  });

  it('without a selected company shows a hint and does not call the APIs', async () => {
    const { fixture, q, open, host, departments } = await setup();
    host.le.set(null);
    fixture.detectChanges();
    open();
    expect(q('filter-no-company')).not.toBeNull();
    expect(departments.listFlat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx ng test --watch=false --include=src/app/modules/people/ui/employee-filter-popover/employee-filter-popover.component.spec.ts` → FAIL.

- [ ] **Step 3: Implement**
```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { CustomSelectComponent } from '../../../../shared/ui/custom-select/custom-select.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import { countActiveFilters, EMPTY_EMPLOYEE_FILTERS, EmployeeListFilters } from '../../utils/employee-list-url-state';

@Component({
  selector: 'app-employee-filter-popover',
  standalone: true,
  imports: [PopoverComponent, CustomSelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-popover [open]="open()" align="right" ariaLabel="Filter employees" (closed)="open.set(false)">
      <button popover-trigger type="button" class="efp__trigger" data-testid="filter-trigger" [attr.aria-expanded]="open()" (click)="toggle()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
        Filter
        @if (activeCount() > 0) { <span class="efp__count" data-testid="filter-count">{{ activeCount() }}</span> }
      </button>
      <div popover-panel class="efp__panel">
        <p class="efp__title">Filter</p>
        @if (!legalEntityId()) {
          <p class="efp__hint" data-testid="filter-no-company">Select a company to filter by department, position or manager.</p>
        } @else {
          <app-custom-select label="Department" placeholder="Select department" [options]="departmentOptions()"
            [value]="draft().departmentId ?? ''" (valueChange)="patch({ departmentId: $event || null })" />
          <app-custom-select label="Position" placeholder="Select position" [options]="positionOptions()"
            [value]="draft().positionId ?? ''" (valueChange)="patch({ positionId: $event || null })" />
        }
        <fieldset class="efp__types">
          <legend>Employment Type</legend>
          @for (type of employmentTypes; track type.value) {
            <label class="efp__check">
              <input type="checkbox" [attr.data-testid]="'filter-type-' + type.value"
                [checked]="draft().employmentTypes.includes(type.value)" (change)="toggleType(type.value)" />
              {{ type.label }}
            </label>
          }
        </fieldset>
        @if (legalEntityId()) {
          <app-custom-select label="Reporting Manager" placeholder="Select manager" [options]="managerOptions()"
            [value]="draft().managerId ?? ''" (valueChange)="patch({ managerId: $event || null })" />
        }
        @if (loadError(); as error) { <p class="efp__error">{{ error }}</p> }
        <div class="efp__actions">
          <button type="button" class="efp__btn" data-testid="filter-reset" (click)="draft.set(empty)">Reset</button>
          <button type="button" class="efp__btn efp__btn--primary" data-testid="filter-apply" (click)="apply()">Apply</button>
        </div>
      </div>
    </app-popover>
  `,
  styles: [`
    .efp__trigger { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: 1px solid var(--color-border); border-radius: 8px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .efp__trigger:hover { background: var(--color-surface-secondary); }
    .efp__trigger svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
    .efp__count { min-width: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-accent); color: #fff; font-size: 11px; line-height: 18px; text-align: center; }
    .efp__panel { display: flex; flex-direction: column; gap: 10px; width: 17rem; }
    .efp__title { margin: 0; font-size: 14px; font-weight: 700; color: var(--color-text-primary); }
    .efp__hint { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
    .efp__error { margin: 0; font-size: 12px; color: var(--color-danger-text); }
    .efp__types { display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; border: 0; }
    .efp__types legend { margin-bottom: 4px; font-size: 12px; font-weight: 600; color: var(--color-text-primary); }
    .efp__check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--color-text-primary); }
    .efp__check input { accent-color: var(--color-accent); }
    .efp__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .efp__btn { padding: 6px 14px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; cursor: pointer; }
    .efp__btn--primary { border-color: var(--color-accent); background: var(--color-accent); color: #fff; }
  `]
})
export class EmployeeFilterPopoverComponent {
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly peopleApi = inject(PeopleApiService);

  readonly value = input.required<EmployeeListFilters>();
  readonly legalEntityId = input<string | null>(null);
  readonly applied = output<EmployeeListFilters>();

  protected readonly empty = EMPTY_EMPLOYEE_FILTERS;
  protected readonly employmentTypes = EMPLOYMENT_TYPE_OPTIONS;
  protected readonly open = signal(false);
  protected readonly draft = signal<EmployeeListFilters>(EMPTY_EMPLOYEE_FILTERS);
  protected readonly departmentOptions = signal<SelectOption[]>([]);
  protected readonly positionOptions = signal<SelectOption[]>([]);
  protected readonly managerOptions = signal<SelectOption[]>([]);
  protected readonly loadError = signal<string | null>(null);
  protected readonly activeCount = computed(() => countActiveFilters(this.value()));
  private loadedForLegalEntityId: string | null = null;

  protected toggle(): void {
    if (this.open()) {
      this.open.set(false);
      return;
    }
    this.draft.set(this.value());
    this.loadOptions();
    this.open.set(true);
  }

  protected patch(change: Partial<EmployeeListFilters>): void {
    this.draft.update((d) => ({ ...d, ...change }));
  }

  protected toggleType(code: string): void {
    this.draft.update((d) => ({
      ...d,
      employmentTypes: d.employmentTypes.includes(code) ? d.employmentTypes.filter((c) => c !== code) : [...d.employmentTypes, code]
    }));
  }

  protected apply(): void {
    this.applied.emit(this.draft());
    this.open.set(false);
  }

  private loadOptions(): void {
    const legalEntityId = this.legalEntityId();
    if (!legalEntityId || legalEntityId === this.loadedForLegalEntityId) return;
    this.loadedForLegalEntityId = legalEntityId;
    this.loadError.set(null);
    forkJoin({
      departments: this.departmentApi.listFlat(legalEntityId, { pageSize: 100 }),
      positions: this.positionApi.listFlat(legalEntityId, { pageSize: 100, includeInactive: false }),
      managers: this.peopleApi.listEmployees({ legalEntityId, pageSize: 100 })
    }).subscribe({
      next: ({ departments, positions, managers }) => {
        this.departmentOptions.set(departments.items.map((d) => ({ value: d.id, label: d.name })));
        this.positionOptions.set(positions.items.map((p) => ({ value: p.id, label: p.name })));
        this.managerOptions.set(managers.items.map((m) => ({ value: m.id, label: m.fullName })));
      },
      error: () => {
        this.loadedForLegalEntityId = null;
        this.loadError.set('Could not load filter options.');
      }
    });
  }
}
```
Notes: if `DepartmentApiService.listFlat`'s params type (`ListDepartmentsQueryParams` in `modules/organization/models/department.model.ts`) names the page-size field differently, use its name. The backend clamps page size at 100, so the manager dropdown lists at most 100 people — acceptable for this phase.

- [ ] **Step 4: Run tests** → 5 passed.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/ui/employee-filter-popover/
git commit -m "feat(people): add employee filter popover"
```

---

### Task 14: Bulk dialogs — change-position bulk mode, employment type, start offboarding, results

**Files:**
- Modify: `modules/people/ui/change-position-modal/change-position-modal.component.ts`
- Modify: `modules/people/ui/change-position-modal/change-position-modal.component.spec.ts`
- Create: `modules/people/ui/bulk-employee-actions/bulk-employment-type-modal.component.ts`
- Create: `modules/people/ui/bulk-employee-actions/bulk-start-offboarding-modal.component.ts`
- Create: `modules/people/ui/bulk-employee-actions/bulk-action-result-modal.component.ts`
- Test: `modules/people/ui/bulk-employee-actions/bulk-employee-actions.spec.ts`

**Interfaces:**
- Consumes: `PeopleApiService.bulkChangePosition / bulkChangeEmploymentType / bulkStartOffboarding`, `BulkEmployeeActionResponse` (Task 10); `EMPLOYMENT_TYPE_OPTIONS`; `ModalComponent` (`shared/ui/modal/modal.component`: inputs `open`, `title`; output `closed`; projects content); `ButtonComponent` (`shared/ui/button/button.component`: inputs `variant`, `type`, `disabled`, `loading`; output `pressed`); `SelectComponent` (`shared/ui/select/select.component`: inputs `label`, `placeholder`, `options`, `value`; output `valueChange`); `DatePickerComponent` (`shared/ui/date-picker/date-picker.component`: inputs `label`, `value`; output `valueChange`); `InputComponent` (`shared/ui/input/input.component`: inputs `label`, `value`; output `valueChange`); `toSafeErrorMessage` (`core/services/error-handler.service`).
- Produces:
  - `ChangePositionModalComponent`: `employeeId` becomes `input('')`; new `employeeIds = input<readonly string[]>([])` (non-empty ⇒ bulk mode); new `bulkCompleted = output<BulkEmployeeActionResponse>()`. Bulk mode posts `bulkChangePosition`, emits `bulkCompleted`, shows no toast, then closes.
  - `BulkEmploymentTypeModalComponent` (`app-bulk-employment-type-modal`): inputs `open`, `employeeIds`; outputs `closed`, `completed: BulkEmployeeActionResponse`. Test ids `bulk-type-submit`.
  - `BulkStartOffboardingModalComponent` (`app-bulk-start-offboarding-modal`): inputs `open`, `employeeIds`; outputs `closed`, `completed`. Test id `bulk-offboard-submit`.
  - `BulkActionResultModalComponent` (`app-bulk-action-result-modal`): inputs `result: BulkEmployeeActionResponse | null`, `title: string`, `names: ReadonlyMap<string, string>`; output `closed`. Test ids `bulk-result-summary`, `bulk-result-failure-<employeeId>`.

- [ ] **Step 1: Write failing tests**

Append to `change-position-modal.component.spec.ts` (reuse its existing `PeopleApiService`/`PositionApiService` mocks; add `bulkChangePosition: vi.fn(() => of({ items: [], succeeded: 2, pendingApproval: 0, failed: 0 }))` to the people mock):
```ts
  it('bulk mode posts all employee ids once and emits bulkCompleted instead of changed', async () => {
    // arrange as the existing "submits the selected position" test, but set inputs:
    // fixture.componentRef.setInput('employeeIds', ['a', 'b']); fixture.componentRef.setInput('employeeId', '');
    // select a position and submit exactly as that test does
    const completed = vi.fn(); const changed = vi.fn();
    fixture.componentInstance.bulkCompleted.subscribe(completed);
    fixture.componentInstance.changed.subscribe(changed);

    fixture.componentInstance.submit();

    expect(peopleApi.bulkChangePosition).toHaveBeenCalledWith(expect.objectContaining({ employeeIds: ['a', 'b'], changeReason: 'Promotion' }));
    expect(peopleApi.changePosition).not.toHaveBeenCalled();
    expect(completed).toHaveBeenCalledWith({ items: [], succeeded: 2, pendingApproval: 0, failed: 0 });
    expect(changed).not.toHaveBeenCalled();
  });

  it('bulk mode title names the employee count', async () => {
    fixture.componentRef.setInput('employeeIds', ['a', 'b', 'c']);
    fixture.detectChanges();
    expect(fixture.componentInstance.modalTitle()).toBe('Promotion · 3 employees');
  });
```
(Fill the arrange lines from the spec's existing single-submit test; keep variable names consistent with that file.)

`bulk-employee-actions.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { NotificationService } from '../../../../core/services/notification.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkEmployeeActionResponse } from '../../models/employee.model';
import { BulkActionResultModalComponent } from './bulk-action-result-modal.component';
import { BulkEmploymentTypeModalComponent } from './bulk-employment-type-modal.component';
import { BulkStartOffboardingModalComponent } from './bulk-start-offboarding-modal.component';

const response: BulkEmployeeActionResponse = {
  items: [
    { employeeId: 'a', outcome: 'succeeded', reason: null },
    { employeeId: 'b', outcome: 'pendingApproval', reason: null },
    { employeeId: 'c', outcome: 'failed', reason: 'You cannot change your own position.' }
  ],
  succeeded: 1, pendingApproval: 1, failed: 1
};

describe('bulk employee action dialogs', () => {
  let people: { bulkChangeEmploymentType: ReturnType<typeof vi.fn>; bulkStartOffboarding: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    people = { bulkChangeEmploymentType: vi.fn(() => of(response)), bulkStartOffboarding: vi.fn(() => of(response)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: PeopleApiService, useValue: people },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
  });

  it('employment type: submit is disabled until a type is chosen, then posts ids + code and emits completed', () => {
    const fixture = TestBed.createComponent(BulkEmploymentTypeModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employeeIds', ['a', 'b']);
    fixture.detectChanges();
    const completed = vi.fn();
    fixture.componentInstance.completed.subscribe(completed);

    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.code.set('contract');
    fixture.componentInstance.submit();

    expect(people.bulkChangeEmploymentType).toHaveBeenCalledWith({ employeeIds: ['a', 'b'], employmentTypeCode: 'contract' });
    expect(completed).toHaveBeenCalledWith(response);
  });

  it('start offboarding: requires a last working date and posts the shared exit details', () => {
    const fixture = TestBed.createComponent(BulkStartOffboardingModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employeeIds', ['a']);
    fixture.detectChanges();

    expect(fixture.componentInstance.canSubmit()).toBe(false);
    fixture.componentInstance.lastWorkingDate.set('2026-10-31');
    fixture.componentInstance.reason.set('retirement');
    fixture.componentInstance.submit();

    expect(people.bulkStartOffboarding).toHaveBeenCalledWith({
      employeeIds: ['a'], reason: 'retirement', lastWorkingDate: '2026-10-31',
      knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null
    });
  });

  it('result modal summarises counts and lists failures with names and reasons', () => {
    const fixture = TestBed.createComponent(BulkActionResultModalComponent);
    fixture.componentRef.setInput('result', response);
    fixture.componentRef.setInput('title', 'Promote results');
    fixture.componentRef.setInput('names', new Map([['c', 'Cara Diaz']]));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-testid="bulk-result-summary"]')!.textContent).toContain('1 changed · 1 sent for approval · 1 skipped');
    const failure = el.querySelector('[data-testid="bulk-result-failure-c"]')!.textContent!;
    expect(failure).toContain('Cara Diaz');
    expect(failure).toContain('You cannot change your own position.');
  });
});
```
(`ModalComponent` renders projected content into the component's own DOM when `open` is true — if it renders elsewhere, query `document.body` instead of `fixture.nativeElement` in the last test.)

- [ ] **Step 2: Run to verify failure** — `npx ng test --watch=false --include=src/app/modules/people/ui/bulk-employee-actions/bulk-employee-actions.spec.ts --include=src/app/modules/people/ui/change-position-modal/change-position-modal.component.spec.ts` → FAIL.

- [ ] **Step 3: Implement**

`change-position-modal.component.ts` changes:
```ts
  readonly employeeId = input<string>('');
  readonly employeeIds = input<readonly string[]>([]);
  readonly bulkCompleted = output<BulkEmployeeActionResponse>();

  readonly isBulk = computed(() => this.employeeIds().length > 0);
  readonly modalTitle = computed(() => {
    const base = this.changeReason() === 'Promotion' ? 'Promotion' : 'Transfer';
    return this.isBulk() ? `${base} · ${this.employeeIds().length} employees` : base;
  });
```
(import `BulkEmployeeActionResponse` from `../../models/employee.model`). In `submit()`, after building `payload`, add before the single-employee call:
```ts
    if (this.isBulk()) {
      this.peopleApi.bulkChangePosition({ ...payload, employeeIds: [...this.employeeIds()] }).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.bulkCompleted.emit(res);
          this.onClose();
        },
        error: (err) => {
          this.submitting.set(false);
          this.notifications.error(toSafeErrorMessage(err, 'Failed to change positions.'));
        }
      });
      return;
    }
```
In the template's reports-to hint, make the copy work for both modes: replace `choose who this employee reports to.` with `choose who {{ isBulk() ? 'these employees report' : 'this employee reports' }} to.`

`bulk-employment-type-modal.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import { BulkEmployeeActionResponse } from '../../models/employee.model';

@Component({
  selector: 'app-bulk-employment-type-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Change employment type" (closed)="close()">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-[var(--color-text-secondary)]">Applies to {{ employeeIds().length }} selected employee{{ employeeIds().length === 1 ? '' : 's' }}. Employee numbers and work modes are not changed.</p>
        <app-select label="Employment type" placeholder="Select a type" [options]="options" [value]="code()" (valueChange)="code.set($event)" />
        @if (error(); as message) { <p class="text-xs text-[var(--color-danger-text)]">{{ message }}</p> }
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="close()">Cancel</app-button>
          <app-button data-testid="bulk-type-submit" [loading]="submitting()" [disabled]="!canSubmit()" (pressed)="submit()">Apply</app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkEmploymentTypeModalComponent {
  private readonly peopleApi = inject(PeopleApiService);

  readonly open = input.required<boolean>();
  readonly employeeIds = input.required<readonly string[]>();
  readonly closed = output<void>();
  readonly completed = output<BulkEmployeeActionResponse>();

  readonly options = [...EMPLOYMENT_TYPE_OPTIONS];
  readonly code = signal('');
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly canSubmit = computed(() => !!this.code() && this.employeeIds().length > 0 && !this.submitting());

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.peopleApi.bulkChangeEmploymentType({ employeeIds: [...this.employeeIds()], employmentTypeCode: this.code() }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.completed.emit(res);
        this.close();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to change employment type.'));
      }
    });
  }

  close(): void {
    this.code.set('');
    this.error.set(null);
    this.closed.emit();
  }
}
```

`bulk-start-offboarding-modal.component.ts` (option lists match `feature/offboarding/offboarding-overview.component.ts`):
```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkEmployeeActionResponse } from '../../models/employee.model';

const EXIT_REASONS = [
  { value: 'resignation', label: 'Resignation' }, { value: 'termination', label: 'Termination' },
  { value: 'retirement', label: 'Retirement' }, { value: 'contract_end', label: 'Contract End' }
];
const RISK_LEVELS = [
  { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
];
const REHIRE = [
  { value: 'eligible', label: 'Eligible' }, { value: 'not_eligible', label: 'Not Eligible' }, { value: 'conditional', label: 'Conditional' }
];

@Component({
  selector: 'app-bulk-start-offboarding-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, SelectComponent, DatePickerComponent, InputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Start offboarding" (closed)="close()">
      <div class="flex flex-col gap-4">
        <p class="text-sm text-[var(--color-text-secondary)]">
          Starts offboarding for {{ employeeIds().length }} selected employee{{ employeeIds().length === 1 ? '' : 's' }} with the same exit details.
          Each person's checklist is chosen afterwards from their offboarding page.
        </p>
        <app-select label="Exit reason *" [options]="reasons" [value]="reason()" (valueChange)="reason.set($event)" />
        <app-date-picker label="Last working day *" [value]="lastWorkingDate()" (valueChange)="lastWorkingDate.set($event)" />
        <app-select label="Knowledge risk level *" [options]="riskLevels" [value]="knowledgeRiskLevel()" (valueChange)="knowledgeRiskLevel.set($event)" />
        <app-select label="Rehire eligibility" [options]="rehire" [value]="rehireEligibility() ?? ''" (valueChange)="rehireEligibility.set($event || null)" />
        <app-input label="Notes" [value]="notes() ?? ''" (valueChange)="notes.set($event || null)" />
        @if (error(); as message) { <p class="text-xs text-[var(--color-danger-text)]">{{ message }}</p> }
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="close()">Cancel</app-button>
          <app-button variant="danger" data-testid="bulk-offboard-submit" [loading]="submitting()" [disabled]="!canSubmit()" (pressed)="submit()">Start offboarding</app-button>
        </div>
      </div>
    </app-modal>
  `
})
export class BulkStartOffboardingModalComponent {
  private readonly peopleApi = inject(PeopleApiService);

  readonly open = input.required<boolean>();
  readonly employeeIds = input.required<readonly string[]>();
  readonly closed = output<void>();
  readonly completed = output<BulkEmployeeActionResponse>();

  readonly reasons = EXIT_REASONS;
  readonly riskLevels = RISK_LEVELS;
  readonly rehire = REHIRE;
  readonly reason = signal('resignation');
  readonly lastWorkingDate = signal('');
  readonly knowledgeRiskLevel = signal('medium');
  readonly rehireEligibility = signal<string | null>(null);
  readonly notes = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly canSubmit = computed(() =>
    !!this.reason() && !!this.lastWorkingDate() && !!this.knowledgeRiskLevel() && this.employeeIds().length > 0 && !this.submitting());

  submit(): void {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.peopleApi.bulkStartOffboarding({
      employeeIds: [...this.employeeIds()],
      reason: this.reason(),
      lastWorkingDate: this.lastWorkingDate(),
      knowledgeRiskLevel: this.knowledgeRiskLevel(),
      rehireEligibility: this.rehireEligibility(),
      notes: this.notes()
    }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.completed.emit(res);
        this.close();
      },
      error: (err) => {
        this.submitting.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to start offboarding.'));
      }
    });
  }

  close(): void {
    this.reason.set('resignation');
    this.lastWorkingDate.set('');
    this.knowledgeRiskLevel.set('medium');
    this.rehireEligibility.set(null);
    this.notes.set(null);
    this.error.set(null);
    this.closed.emit();
  }
}
```
(If `ButtonComponent`'s `ButtonVariant` has no `'danger'`, use the closest destructive variant it defines — check `shared/ui/button/button.component.ts`.)

`bulk-action-result-modal.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { BulkEmployeeActionResponse } from '../../models/employee.model';

@Component({
  selector: 'app-bulk-action-result-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="!!result()" [title]="title()" (closed)="closed.emit()">
      @if (result(); as r) {
        <div class="flex flex-col gap-4">
          <p class="text-sm font-semibold text-[var(--color-text-primary)]" data-testid="bulk-result-summary">
            {{ r.succeeded }} changed · {{ r.pendingApproval }} sent for approval · {{ r.failed }} skipped
          </p>
          @if (failures().length > 0) {
            <ul class="flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
              @for (item of failures(); track item.employeeId) {
                <li class="rounded-md border border-[var(--color-border)] p-2" [attr.data-testid]="'bulk-result-failure-' + item.employeeId">
                  <span class="font-semibold text-[var(--color-text-primary)]">{{ names().get(item.employeeId) ?? 'Unknown employee' }}</span>
                  <span class="block text-xs text-[var(--color-danger-text)]">{{ item.reason }}</span>
                </li>
              }
            </ul>
          }
          <div class="flex justify-end"><app-button (pressed)="closed.emit()">Done</app-button></div>
        </div>
      }
    </app-modal>
  `
})
export class BulkActionResultModalComponent {
  readonly result = input<BulkEmployeeActionResponse | null>(null);
  readonly title = input('Bulk action results');
  readonly names = input<ReadonlyMap<string, string>>(new Map());
  readonly closed = output<void>();

  protected readonly failures = computed(() => (this.result()?.items ?? []).filter((i) => i.outcome === 'failed'));
}
```

- [ ] **Step 4: Run tests** — same command as Step 2 → all pass (existing change-position tests still green).

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/ui/change-position-modal/ src/app/modules/people/ui/bulk-employee-actions/
git commit -m "feat(people): bulk change-position mode and bulk employment-type/offboarding/result dialogs"
```

---

### Task 15: Rewire the employee list; delete the three old views

**Files:**
- Modify: `modules/people/feature/employee-list/employee-list.component.ts`
- Modify: `modules/people/feature/employee-list/employee-list.component.html`
- Modify: `modules/people/feature/employee-list/employee-list.component.css` (remove `.emp-pagination*` / view-cycle rules that become unused; add toolbar + pager rules below)
- Modify: `modules/people/feature/employee-list/employee-list.component.spec.ts`
- Delete: `modules/people/ui/employee-table/` (4 files), `modules/people/ui/employee-list-view/` (4 files), `modules/people/ui/employee-card-view/` (4 files)

**Interfaces:**
- Consumes: everything from Tasks 10–14; `SelectionModel` (`shared/utils/selection-model`: `selected`, `count`, `toggle(id, on?)`, `setMany(ids, on)`, `clear()`); `BulkActionBarComponent` + `BulkAction` (`shared/ui/bulk-action-bar/bulk-action-bar.component`: inputs `count`, `actions`, `noun`; outputs `action`, `cleared`; test ids `bulk-action-bar`, `bulk-action-<id>`, `bulk-action-more`); `MenuItem`; `LegalEntityStore.selectedLegalEntityId` (`modules/organization/state/legal-entity.store`); `AuthStore.employeeId` (`core/auth/state/auth.store`); `PermissionService.hasPermission`.
- Produces: bulk action ids `promote`, `transfer`, `employment-type`, `export`, `offboard`; row action ids `promote`, `transfer`, `offboard`; toolbar test ids `employee-page-size`, `employee-page-<n>`.

- [ ] **Step 1: Update the spec first (failing)**

In `employee-list.component.spec.ts`:
1. Delete the two view-mode tests (`toggles viewMode between table, list, and card…`, `cycles viewMode sequentially…`) and any `employee_view_mode` references.
2. Extend the `PermissionService` mock so tests can control `employees:offboard`: `hasPermission: (p) => p === 'employees:write' ? hasWritePermission : p === 'employees:offboard' ? hasOffboardPermission : true` with `let hasOffboardPermission = true;` reset in `beforeEach`.
3. Provide `{ provide: LegalEntityStore, useValue: { selectedLegalEntityId: signal('le-1') } }` and `{ provide: AuthStore, useValue: { employeeId: signal('me') } }` (import `signal` from `@angular/core`), plus stub `DepartmentApiService`/`PositionApiService` with `listFlat: () => of({ items: [] })`.
4. If the loader test asserts `app-employee-table`, change it to `app-employee-directory-table`.
5. Add a helper that flushes a page with rows:
```ts
function flushEmployees(items: Partial<EmployeeListItemResponse>[], totalCount = items.length) {
  const full = items.map((i, n) => ({
    id: `e${n}`, employeeNumber: `N${n}`, fullName: `Person ${n}`, email: `p${n}@x.com`, departmentId: null, departmentName: null,
    positionId: null, positionName: null, legalEntityId: 'le-1', legalEntityName: 'Co', employmentTypeLabel: 'Full-time',
    status: 'active', reportingManagerId: null, reportingManagerName: null, ...i
  }));
  httpMock.match((r) => r.url.includes('/employees') && !r.url.includes('/bulk')).forEach((r) => r.flush({ items: full, totalCount, page: 1, pageSize: 25 }));
  httpMock.match((r) => r.url.includes('/onboarding/drafts')).forEach((r) => r.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 }));
  fixture.detectChanges();
}
```
6. Add tests:
```ts
  it('passes sort, page size and filters from the URL to the API', () => {
    queryParams.next(convertToParamMap({ sortBy: 'department', sortDir: 'desc', pageSize: '50', employmentType: 'contract,intern', managerId: 'm1' }));
    const req = httpMock.match((r) => r.url.endsWith('/employees')).at(-1)!;
    expect(req.request.params.get('sortBy')).toBe('department');
    expect(req.request.params.get('sortDir')).toBe('desc');
    expect(req.request.params.get('pageSize')).toBe('50');
    expect(req.request.params.getAll('employmentType')).toEqual(['contract', 'intern']);
    expect(req.request.params.get('managerId')).toBe('m1');
  });

  it('sorting from the table header writes sortBy/sortDir and resets to page 1', () => {
    flushEmployees([{}]);
    (fixture.nativeElement.querySelector('[data-testid="employee-sort-department"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: expect.objectContaining({ sortBy: 'department', sortDir: 'asc', page: 1 }), queryParamsHandling: 'merge'
    }));
  });

  it('shows the bulk bar with actions gated by permission', () => {
    hasOffboardPermission = false;
    flushEmployees([{}, {}]);
    (fixture.nativeElement.querySelector('[data-testid="employee-select-e0"]') as HTMLInputElement).click();
    fixture.detectChanges();
    const bar = fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]') as HTMLElement;
    expect(bar.textContent).toContain('1 employee selected');
    expect(bar.querySelector('[data-testid="bulk-action-promote"]')).not.toBeNull();
    (bar.querySelector('[data-testid="bulk-action-more"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="menu-item-export"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="menu-item-offboard"]')).toBeNull();
  });

  it('without employees:write only Export is offered', () => {
    hasWritePermission = false;
    flushEmployees([{}]);
    (fixture.nativeElement.querySelector('[data-testid="employee-select-e0"]') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="bulk-action-promote"]')).toBeNull();
  });

  it('Promote is disabled when the selection spans companies', () => {
    flushEmployees([{ legalEntityId: 'le-1' }, { legalEntityId: 'le-2' }]);
    (fixture.nativeElement.querySelector('[data-testid="employee-select-all"]') as HTMLInputElement).click();
    fixture.detectChanges();
    const promote = fixture.nativeElement.querySelector('[data-testid="bulk-action-promote"]') as HTMLButtonElement;
    expect(promote.disabled).toBe(true);
    expect(promote.title).toContain('single company');
  });

  it('changing a filter clears the selection; changing page keeps it', () => {
    flushEmployees([{}]);
    (fixture.nativeElement.querySelector('[data-testid="employee-select-e0"]') as HTMLInputElement).click();
    queryParams.next(convertToParamMap({ page: '2' }));
    flushEmployees([{ id: 'x' }]);
    expect(fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]')).not.toBeNull();
    queryParams.next(convertToParamMap({ page: '2', departmentId: 'd1' }));
    flushEmployees([{ id: 'x' }]);
    expect(fixture.nativeElement.querySelector('[data-testid="bulk-action-bar"]')).toBeNull();
  });

  it('row menu hides Promote/Transfer on the caller\'s own row and offers Offboard to employees:offboard holders', () => {
    flushEmployees([{ id: 'me' }, { id: 'other' }]);
    expect(fixture.nativeElement.querySelector('[data-testid="employee-row-menu-me"] button')).toBeNull();
    (fixture.nativeElement.querySelector('[data-testid="employee-row-menu-other"] button') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="menu-item-promote"]')).not.toBeNull();
    (fixture.nativeElement.querySelector('[data-testid="menu-item-offboard"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees', 'other', 'offboarding']);
  });

  it('employment-type bulk result shows the summary, reloads and clears the selection', () => {
    flushEmployees([{}]);
    (fixture.nativeElement.querySelector('[data-testid="employee-select-e0"]') as HTMLInputElement).click();
    fixture.detectChanges();
    const inst = fixture.componentInstance as unknown as { onBulkCompleted: (title: string, r: unknown) => void; selection: { count: () => number } };
    inst.onBulkCompleted('Change employment type', { items: [{ employeeId: 'e0', outcome: 'succeeded', reason: null }], succeeded: 1, pendingApproval: 0, failed: 0 });
    fixture.detectChanges();
    expect(inst.selection.count()).toBe(0);
    expect(document.body.textContent).toContain('1 changed · 0 sent for approval · 0 skipped');
    expect(httpMock.match((r) => r.url.endsWith('/employees')).length).toBeGreaterThan(0);
  });
```
(Adapt `fixture`, `router`, `httpMock`, `queryParams`, `hasWritePermission` names to the spec's existing setup; flush any outstanding requests at the end of each test so `httpMock.verify()` passes.)

- [ ] **Step 2: Run to verify failure** — `npx ng test --watch=false --include=src/app/modules/people/feature/employee-list/employee-list.component.spec.ts` → new tests FAIL.

- [ ] **Step 3: Implement**

**Delete the old views:**
```bash
git rm -r src/app/modules/people/ui/employee-table src/app/modules/people/ui/employee-list-view src/app/modules/people/ui/employee-card-view
```
(Task 11 already copied the employee-cell CSS you need.)

**`employee-list.component.ts`:**
1. Remove the three view-component imports, `EmployeeViewMode`, the `viewMode` signal and every view-mode member (`loadInitialViewMode`, `setViewMode`, `cycleViewMode`, `viewModeTitle`, `viewModeAriaLabel`), and the view components from `imports: [...]`.
2. Add imports and add to `imports: [...]`: `EmployeeDirectoryTableComponent`, `EmployeeColumnPickerComponent`, `EmployeeFilterPopoverComponent`, `ChangePositionModalComponent`, `BulkEmploymentTypeModalComponent`, `BulkStartOffboardingModalComponent`, `BulkActionResultModalComponent`, `BulkActionBarComponent`.
3. Add fields:
```ts
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly authStore = inject(AuthStore);

  readonly canWrite = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly legalEntityId = this.legalEntityStore.selectedLegalEntityId;

  readonly listState = signal<EmployeeListUrlState>(parseEmployeeListState(this.route.snapshot.queryParamMap));
  readonly pageSizes = EMPLOYEE_PAGE_SIZES;
  readonly visibleColumnKeys = signal<EmployeeColumnKey[]>(loadEmployeeColumns());
  readonly visibleColumns = computed(() => EMPLOYEE_COLUMNS.filter((c) => this.visibleColumnKeys().includes(c.key)));

  readonly selection = new SelectionModel<string>();
  private readonly rowCache = signal<ReadonlyMap<string, EmployeeListItemResponse>>(new Map());
  readonly selectedRows = computed(() =>
    [...this.selection.selected()].map((id) => this.rowCache().get(id)).filter((r): r is EmployeeListItemResponse => !!r));
  readonly selectedIdList = computed(() => [...this.selection.selected()]);
  private lastSelectionScope = selectionScopeKey(this.listState());

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.store.employeesTotalCount() / this.listState().pageSize)));
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = Math.min(this.listState().page, total);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });
  readonly rangeStart = computed(() => this.store.employeesTotalCount() === 0 ? 0 : (this.listState().page - 1) * this.listState().pageSize + 1);
  readonly rangeEnd = computed(() => Math.min(this.listState().page * this.listState().pageSize, this.store.employeesTotalCount()));

  readonly positionChangeBlockedReason = computed(() => {
    const companies = new Set(this.selectedRows().map((r) => r.legalEntityId));
    if (companies.has(null)) return 'Some selected employees have no company assigned.';
    if (companies.size > 1) return 'Select employees from a single company to change their position together.';
    return null;
  });
  readonly bulkLegalEntityId = computed(() => this.selectedRows()[0]?.legalEntityId ?? '');

  readonly bulkActions = computed<BulkAction[]>(() => {
    const actions: BulkAction[] = [];
    if (this.canWrite()) {
      const blocked = this.positionChangeBlockedReason();
      actions.push(
        { id: 'promote', label: 'Promote', placement: 'primary', disabled: !!blocked, disabledReason: blocked ?? undefined },
        { id: 'transfer', label: 'Transfer', placement: 'primary', disabled: !!blocked, disabledReason: blocked ?? undefined },
        { id: 'employment-type', label: 'Change Employment Type', placement: 'more' }
      );
    }
    actions.push({ id: 'export', label: 'Export Selected', placement: 'more' });
    if (this.canOffboard()) {
      actions.push({ id: 'offboard', label: 'Bulk Offboard', placement: 'more', danger: true });
    }
    return actions;
  });

  readonly bulkPositionReason = signal<'Promotion' | 'Transfer' | null>(null);
  readonly bulkEmploymentTypeOpen = signal(false);
  readonly bulkOffboardOpen = signal(false);
  readonly bulkResult = signal<{ title: string; result: BulkEmployeeActionResponse } | null>(null);
  readonly resultNames = computed(() => new Map([...this.rowCache().values()].map((r) => [r.id, r.fullName] as const)));
  readonly rowPositionChange = signal<{ employee: EmployeeListItemResponse; reason: 'Promotion' | 'Transfer' } | null>(null);

  readonly rowMenuItems = (employee: EmployeeListItemResponse): MenuItem[] => {
    const own = employee.id === this.authStore.employeeId();
    const terminal = ['resigned', 'terminated'].includes(employee.status.toLowerCase());
    const invitationBlocked = employee.invitationStatus === 'pending' || employee.invitationStatus === 'expired';
    const items: MenuItem[] = [];
    if (this.canWrite() && !own && !terminal && !invitationBlocked && employee.legalEntityId) {
      items.push({ id: 'promote', label: 'Promote' }, { id: 'transfer', label: 'Transfer' });
    }
    if (this.canOffboard() && !own && !terminal) {
      items.push({ id: 'offboard', label: 'Offboard', danger: true, dividerBefore: items.length > 0 });
    }
    return items;
  };
```
4. Replace the constructor's `queryParamMap` subscription body with:
```ts
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state = parseEmployeeListState(params);
      const scope = selectionScopeKey(state);
      if (scope !== this.lastSelectionScope) {
        this.selection.clear();
        this.lastSelectionScope = scope;
      }
      this.listState.set(state);
      this.store.loadEmployees(toEmployeeListParams(state));
      if ((params.get('addEmployee') === 'true' || params.has('draftId')) && this.canAddEmployee()) {
        this.activeDraftId.set(params.get('draftId'));
        this.isAddEmployeeModalOpen.set(true);
      }
    });

    effect(() => {
      const rows = this.store.employees();
      untracked(() => this.rowCache.update((cache) => {
        const next = new Map(cache);
        for (const row of rows) next.set(row.id, row);
        return next;
      }));
    });
```
5. `loadEmployees()` becomes `this.store.loadEmployees(toEmployeeListParams(this.listState()));`.
6. Add methods:
```ts
  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  onSortChanged(event: { sortBy: EmployeeSortKey; sortDir: SortDirection }): void {
    this.navigate({ sortBy: event.sortBy, sortDir: event.sortDir, page: 1 });
  }

  onFiltersApplied(filters: EmployeeListFilters): void {
    this.navigate({ ...filtersToQueryParams(filters), page: 1 });
  }

  onColumnsApplied(keys: EmployeeColumnKey[]): void {
    this.visibleColumnKeys.set(keys);
    saveEmployeeColumns(keys);
  }

  onPageSizeChange(value: string): void {
    this.navigate({ pageSize: Number(value), page: 1 });
  }

  onBulkAction(actionId: string): void {
    switch (actionId) {
      case 'promote': this.bulkPositionReason.set('Promotion'); break;
      case 'transfer': this.bulkPositionReason.set('Transfer'); break;
      case 'employment-type': this.bulkEmploymentTypeOpen.set(true); break;
      case 'offboard': this.bulkOffboardOpen.set(true); break;
      case 'export': this.exportSelected(); break;
    }
  }

  onBulkCompleted(title: string, result: BulkEmployeeActionResponse): void {
    this.bulkResult.set({ title, result });
    this.selection.clear();
    this.loadEmployees();
  }

  onRowAction(event: { employee: EmployeeListItemResponse; actionId: string }): void {
    if (event.actionId === 'offboard') {
      void this.router.navigate(['/people/employees', event.employee.id, 'offboarding']);
      return;
    }
    this.rowPositionChange.set({ employee: event.employee, reason: event.actionId === 'promote' ? 'Promotion' : 'Transfer' });
  }

  private exportSelected(): void {
    const csv = toEmployeeCsv(this.selectedRows(), this.visibleColumns());
    downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }
```
`goToEmployeesPage(page)` stays as-is (it already merges `page`). `onSearchInput` stays (search change resets page to 1 and — via the scope key — clears the selection).

**`employee-list.component.html`:**
1. Delete the whole view-cycle `@if (activeTab() === 'employees') { … emp-view-cycle-btn … }` block (lines ~47-81).
2. Replace the three-view `@if/@else` block and the old `.emp-pagination` block (lines ~131-162) with:
```html
      <div class="emp-toolbar">
        <app-employee-filter-popover [value]="listState().filters" [legalEntityId]="legalEntityId()" (applied)="onFiltersApplied($event)" />
        <app-employee-column-picker [visible]="visibleColumnKeys()" (applied)="onColumnsApplied($event)" />
      </div>

      <app-employee-directory-table
        [employees]="store.employees()"
        [columns]="visibleColumns()"
        [sortBy]="listState().sortBy"
        [sortDir]="listState().sortDir"
        [selectedIds]="selection.selected()"
        [rowMenuItems]="rowMenuItems"
        (sortChanged)="onSortChanged($event)"
        (selectionChanged)="selection.toggle($event.id, $event.selected)"
        (selectAllChanged)="selection.setMany($event.ids, $event.selected)"
        (rowAction)="onRowAction($event)"
      />

      @if (store.employeesTotalCount() > 0) {
        <nav class="emp-pager" aria-label="Employee pages">
          <span class="emp-pager__range">Showing {{ rangeStart() }}–{{ rangeEnd() }} of {{ store.employeesTotalCount() }} employees</span>
          <div class="emp-pager__controls">
            <button type="button" class="emp-pager__btn" aria-label="Previous page" [disabled]="listState().page <= 1" (click)="goToEmployeesPage(listState().page - 1)">‹</button>
            @for (n of pageNumbers(); track n) {
              <button type="button" class="emp-pager__btn" [attr.data-testid]="'employee-page-' + n"
                [class.emp-pager__btn--active]="n === listState().page" [attr.aria-current]="n === listState().page ? 'page' : null"
                (click)="goToEmployeesPage(n)">{{ n }}</button>
            }
            <button type="button" class="emp-pager__btn" aria-label="Next page" [disabled]="listState().page >= totalPages()" (click)="goToEmployeesPage(listState().page + 1)">›</button>
            <select class="emp-pager__size" data-testid="employee-page-size" aria-label="Rows per page"
              [value]="listState().pageSize" (change)="onPageSizeChange($any($event.target).value)">
              @for (size of pageSizes; track size) { <option [value]="size">{{ size }} / page</option> }
            </select>
          </div>
        </nav>
      }
```
3. Before the closing `<app-add-employee-wizard …/>`, add:
```html
<app-bulk-action-bar noun="employee" [count]="selection.count()" [actions]="bulkActions()" (action)="onBulkAction($event)" (cleared)="selection.clear()" />

@if (bulkPositionReason(); as reason) {
  <app-change-position-modal [open]="true" [employeeIds]="selectedIdList()" [legalEntityId]="bulkLegalEntityId()" [changeReason]="reason"
    (bulkCompleted)="onBulkCompleted(reason === 'Promotion' ? 'Promote results' : 'Transfer results', $event)" (closed)="bulkPositionReason.set(null)" />
}
@if (rowPositionChange(); as change) {
  <app-change-position-modal [open]="true" [employeeId]="change.employee.id" [legalEntityId]="change.employee.legalEntityId ?? ''"
    [currentPositionId]="change.employee.positionId" [changeReason]="change.reason"
    (changed)="loadEmployees()" (pendingApproval)="loadEmployees()" (closed)="rowPositionChange.set(null)" />
}
<app-bulk-employment-type-modal [open]="bulkEmploymentTypeOpen()" [employeeIds]="selectedIdList()"
  (completed)="onBulkCompleted('Change employment type', $event)" (closed)="bulkEmploymentTypeOpen.set(false)" />
<app-bulk-start-offboarding-modal [open]="bulkOffboardOpen()" [employeeIds]="selectedIdList()"
  (completed)="onBulkCompleted('Start offboarding', $event)" (closed)="bulkOffboardOpen.set(false)" />
<app-bulk-action-result-modal [result]="bulkResult()?.result ?? null" [title]="bulkResult()?.title ?? ''" [names]="resultNames()" (closed)="bulkResult.set(null)" />
```

**`employee-list.component.css`** — delete the now-unused `.emp-view-cycle*` and `.emp-pagination*` rules; add:
```css
.emp-toolbar { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 10px; }
.emp-pager { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; }
.emp-pager__range { font-size: 13px; color: var(--color-text-secondary); }
.emp-pager__controls { display: flex; align-items: center; gap: 4px; }
.emp-pager__btn { min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--color-text-primary); font: inherit; font-size: 13px; cursor: pointer; }
.emp-pager__btn:hover:not(:disabled) { background: var(--color-surface-secondary); }
.emp-pager__btn:disabled { opacity: .4; cursor: not-allowed; }
.emp-pager__btn--active { border-color: var(--color-accent); color: var(--color-accent); font-weight: 600; }
.emp-pager__size { margin-left: 8px; padding: 5px 8px; border: 1px solid var(--color-border); border-radius: 7px; background: var(--color-surface); color: var(--color-text-primary); font: inherit; font-size: 13px; }
```

- [ ] **Step 4: Run tests**
- `npx ng test --watch=false --include=src/app/modules/people/feature/employee-list/employee-list.component.spec.ts` → all pass.
- `grep -rn "app-employee-table\|app-employee-list-view\|app-employee-card-view\|employee_view_mode" src/app` → no matches.

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/feature/employee-list/
git commit -m "feat(people): backlog-style employee list with filters, sorting, columns, row actions and bulk actions"
```
(The `git rm` from Step 3 is already staged and goes into this commit.)

---

### Task 16: Detail screen — gate Offboarding on `employees:offboard`

**Files:**
- Modify: `modules/people/feature/employee-detail/employee-detail.component.ts` (menu at ~lines 101-114, computeds at ~330-333)
- Test: `modules/people/feature/employee-detail/employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: `PermissionService.hasPermission`.
- Produces: `canOffboard = computed(() => permissionService.hasPermission('employees:offboard'))`. The menu renders when `(canChangePosition() || canOffboard())` plus the existing conditions; Promotion/Transfer items only with `canChangePosition()`; the Offboarding item only with `canOffboard()`. Trigger label: `Transfer / Promote` when `canChangePosition()`, otherwise `Offboarding`.

- [ ] **Step 1: Write failing tests** (use the spec's existing permission mock + setup helper; the fixture needs an employee that is not the caller, has a legal entity and no pending/expired invitation — the spec's existing "shows Transfer / Promote" test arranges exactly that):
```ts
  it('hides the Offboarding item from a user with employees:write but not employees:offboard', async () => {
    // arrange as the existing Transfer/Promote test, with permissions: employees:write only
    (fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Promotion');
  });

  it('shows only the Offboarding item to a user with employees:offboard but not employees:write', async () => {
    // arrange with permissions: employees:offboard only
    const trigger = fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]') as HTMLElement;
    expect(trigger.textContent).toContain('Offboarding');
    trigger.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Promotion');
  });
```

- [ ] **Step 2: Run to verify failure** — `npx ng test --watch=false --include=src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts` → the two new tests FAIL.

- [ ] **Step 3: Implement**

Add next to `canChangePosition`:
```ts
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
```
Replace the menu block with:
```html
            @if ((canChangePosition() || canOffboard()) && !isOwnRecord() && employee.jobInformation.legalEntityId && !isReadOnly() && employee.invitationStatus !== 'pending' && employee.invitationStatus !== 'expired') {
              <app-popover [open]="changePositionMenuOpen()" ariaLabel="Employee actions" align="right" (closed)="changePositionMenuOpen.set(false)">
                <app-button popover-trigger data-testid="change-position-trigger" (pressed)="changePositionMenuOpen.set(!changePositionMenuOpen())">
                  {{ canChangePosition() ? 'Transfer / Promote' : 'Offboarding' }}
                </app-button>
                <div popover-panel class="change-position-menu">
                  @if (canChangePosition()) {
                    <button type="button" class="profile-action-btn" (click)="openChangePosition('Promotion')">Promotion</button>
                    <button type="button" class="profile-action-btn" (click)="openChangePosition('Transfer')">Transfer</button>
                  }
                  @if (canOffboard()) {
                    <button type="button" class="profile-action-btn" data-testid="offboarding-menu-item" (click)="navigateToOffboarding(employee.id)">
                      {{ offboardingStatus() && offboardingStatus() !== 'cancelled' ? (isReadOnly() ? 'View Offboarding' : 'Continue Offboarding') : 'Offboarding' }}
                    </button>
                  }
                </div>
              </app-popover>
            }
```

- [ ] **Step 4: Run tests** → all detail-spec tests pass (existing tests that grant `employees:write` and click Offboarding must now also grant `employees:offboard` — update their permission arrangement rather than the assertion).

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/modules/people/feature/employee-detail/employee-detail.component.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "fix(people): gate detail-screen offboarding on employees:offboard"
```

---

### Task 17: Frontend full verification + browser check

- [ ] **Step 1:** `npx ng test --watch=false` — paste the raw summary. Failures in files this plan did not touch: `git log -1 -- <file>`, report as pre-existing.
- [ ] **Step 2:** `npx ng build` — no new errors or budget failures.
- [ ] **Step 3: Browser check** (backend from Part 1 running; the sandboxed Browser pane may block scripts on the `*.onexso.com` dev domain — if so use Claude in Chrome or ask the user). As an admin on People › Employees:
  1. Table matches the backlog look: grey rounded header, card rows, checkbox column, `⋯` on rows. No view-cycle button.
  2. Sort by Department (click header twice → desc); URL has `sortBy=department&sortDir=desc`.
  3. Filter by an employment type → list narrows, Filter shows count badge; Reset clears.
  4. Columns: turn on Email, turn off ID → Apply; reload page → preference kept.
  5. Page size 10 → numbered pages; select 2 rows on page 1, go to page 2, select 1 → bar says "3 employees selected".
  6. More → Export Selected downloads `employees-YYYY-MM-DD.csv` with the visible columns and 3 rows.
  7. Change Employment Type on 2 employees (one of them your own record is fine) → result dialog with counts; rows update.
  8. Promote with employees from two companies selected → Promote disabled with tooltip.
  9. Row `⋯` on your own row → no Promote/Transfer.
  10. Log in as a user with `employees:write` but not `employees:offboard` → no Bulk Offboard, no Offboard row item, detail screen menu has no Offboarding.
  11. At 375px width, the bulk bar sits above the mobile nav and the table scrolls horizontally inside its container.
  Screenshot steps 1 and 7 as proof.
- [ ] **Step 4:** Update the spec if anything in implementation diverged; commit docs.
