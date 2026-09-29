# Drafts Bar + Unsaved Changes Guard (Sub-project D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ClickUp-style drafts bar at the bottom of the app (own task drafts + own onboarding drafts), a shared "Save draft? / Discard / Keep editing" guard for the task create modal and the add-employee wizard (plus route-leave and browser-close protection), backed by new task-draft storage and partial, deletable onboarding drafts.

**Architecture:** Backend adds a tenant-scoped, per-user `task_drafts` table with an opaque JSON payload and owner-only CRUD, and relaxes onboarding-draft saving to "company + step" (full validation stays in finalize). Frontend adds an `UnsavedChangesService` + dialog + `CanDeactivate` guard, a root `DraftsStore`, and an app-wide `<app-drafts-bar>` in the main layout; both forms register with the guard and hydrate from drafts.

**Tech Stack:** .NET 10 / EF Core (Postgres, RLS) / MediatR / FluentValidation / xUnit + Moq; Angular 21 standalone + signals + @ngrx/signals / Vitest.

**Spec:** `docs/superpowers/specs/2026-09-29-drafts-bar-and-unsaved-changes-guard-design.md` (frontend repo)

## Global Constraints

- Backend `C:\onevoNew\HRMS-Backend-v1`, frontend `C:\onevoNew\Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. **Never create git worktrees**; ignore `.worktrees/`.
- Shared working trees — other sessions may have uncommitted edits. `git status` before every commit; stage only this task's files; if a file you must edit already has foreign edits, stage only your hunks (`git add -p`) or stop and ask.
- Backend tests: `dotnet test tests/ONEVO.Tests.Unit/ONEVO.Tests.Unit.csproj --filter "FullyQualifiedName~<Class>"`; integration project `tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj`. Kill `ONEVO.Api.exe` right before each build/test (it auto-respawns).
- EF migrations: `dotnet ef migrations add <Name> --project src/ONEVO.Infrastructure --startup-project src/ONEVO.Api` (confirm against the existing `src/ONEVO.Infrastructure/Migrations` folder). Never hand-edit the model snapshot. Do **not** run `dotnet ef database update` against the shared dev DB — a pre-existing broken migration is known to block it; integration tests build their own DB.
- Onboarding-draft namespaces are plural (`...CoreHr.OnboardingDrafts...`) although folders are singular; the entity namespace is `ONEVO.Domain.Features.CoreHr.Entities` (tests alias it `OnboardingDraftEntity`).
- Frontend: Vitest (`vi.fn()`), `npx ng test --watch=false --include=<spec>`; paths relative to `src/app/`.
- Exact strings: dialog title `Save draft?` / `Discard changes?`; dialog body `Would you like to save a draft? You can reopen it from the drafts bar at the bottom of the screen.`; buttons `Discard`, `Keep editing`, `Save draft`; cancel conflict `This draft has already been finalized.`; re-save closed draft `This draft is closed and can no longer be edited.`; finalize start date `Start date is required.`; task-draft payload limit 262144 characters.
- The UI word is "draft"/"drafts bar" — never "tray" in code or copy (tray = desktop tray app).
- Paste raw test summary lines in every task report.

---

## Part 1 — Backend

### Task 1: Partial onboarding drafts (save relaxed, finalize strict, closed drafts frozen)

**Files:**
- Modify: `src/ONEVO.Domain/Features/CoreHr/OnboardingDraft/Entities/OnboardingDraft.cs` (`StartDate` → `DateOnly?`)
- Modify: `src/ONEVO.Application/Features/CoreHr/OnboardingDraft/Commands/SaveOnboardingDraft/SaveOnboardingDraftCommand.cs` (`FirstName`, `LastName`, `WorkEmail`, `EmploymentType` → `string?`; `StartDate` → `DateOnly?`)
- Modify: `.../SaveOnboardingDraft/SaveOnboardingDraftCommandValidator.cs`
- Modify: `src/ONEVO.Application/Features/CoreHr/OnboardingDraft/Services/OnboardingDraftWriteService.cs` (`SaveAsync` ~117-293, `FinalizeAsync` ~295-368)
- Modify: `src/ONEVO.Api/Contracts/.../SaveOnboardingDraftRequest.cs` (same nullability — find with `grep -rn "record SaveOnboardingDraftRequest" src`) and the controller mapping if it needs `?? ""`
- Modify: any `OnboardingDraftResponse` / DTO with `DateOnly StartDate` → `DateOnly?` (compiler will point them out) and every finalize use of `draft.StartDate` (use `.Value` after the new check)
- Create: migration `MakeOnboardingDraftStartDateNullable`
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/OnboardingDraft/OnboardingDraftWriteServiceTests.cs`, `SaveOnboardingDraftCommandValidatorTests.cs` (create if absent), finalize tests in `tests/ONEVO.Tests.Unit/Features/CoreHr/OnboardingDrafts/FinalizeOnboardingDraftCommandHandlerTests.cs` or the write-service tests (wherever finalize is unit-tested today)

**Interfaces:**
- Produces: saving requires only `LegalEntityId` (non-empty) and `LastSavedStep`. Optional values are validated only when present: names ≤100 chars; `WorkEmail` valid email ≤320 when non-blank; `EmploymentType` ≤30; employee number format when non-blank. Blank strings are stored as `""` (columns stay NOT NULL). Email-uniqueness check runs only when `WorkEmail` is non-blank. Saving an existing draft whose status is `cancelled` or `finalized` → 409 `This draft is closed and can no longer be edited.` Finalize additionally returns 422 `Start date is required.` when `StartDate` is null (existing name/email/employment-type/work-mode checks unchanged).

- [ ] **Step 1: Write failing tests**

Validator (`SaveOnboardingDraftCommandValidatorTests.cs`):
```csharp
using ONEVO.Application.Features.CoreHr.OnboardingDrafts.Commands.SaveOnboardingDraft;
using Xunit;

namespace ONEVO.Tests.Unit.Features.CoreHr.OnboardingDraft;

public class SaveOnboardingDraftCommandValidatorTests
{
    private static SaveOnboardingDraftCommand Partial(string? email = null, string? first = null) => new(
        DraftId: null, FirstName: first, LastName: null, WorkEmail: email, LegalEntityId: Guid.NewGuid(),
        DepartmentId: null, PositionId: null, EmploymentType: null, StartDate: null, EmployeeNumber: null,
        WorkModeId: null, SelectedTemplateId: null, EditedTasksJson: null, LastSavedStep: "employee_details",
        IfMatchVersion: null, ReportsToEmployeeId: null);

    [Fact] public void OnlyCompanyAndStep_IsValid() => Assert.True(new SaveOnboardingDraftCommandValidator().Validate(Partial()).IsValid);

    [Fact] public void MissingCompany_IsInvalid() =>
        Assert.False(new SaveOnboardingDraftCommandValidator().Validate(Partial() with { LegalEntityId = Guid.Empty }).IsValid);

    [Fact] public void MalformedEmail_WhenProvided_IsInvalid() =>
        Assert.False(new SaveOnboardingDraftCommandValidator().Validate(Partial(email: "not-an-email")).IsValid);

    [Fact] public void OverlongName_WhenProvided_IsInvalid() =>
        Assert.False(new SaveOnboardingDraftCommandValidator().Validate(Partial(first: new string('a', 101))).IsValid);
}
```
(Named arguments must match the record's parameter names — adjust if the record uses different names; the positional order was `DraftId, FirstName, LastName, WorkEmail, LegalEntityId, DepartmentId, PositionId, EmploymentType, StartDate, EmployeeNumber, WorkModeId, SelectedTemplateId, EditedTasksJson, LastSavedStep, IfMatchVersion, ReportsToEmployeeId`.)

Write service (add to `OnboardingDraftWriteServiceTests.cs`, reusing its existing setup that makes the legal entity active and seat evaluation return "allowed"):
```csharp
    [Fact]
    public async Task SaveAsync_PartialDraft_PersistsBlanks_AndSkipsEmailUniquenessCheck()
    {
        // arrange: existing helper for an active legal entity; command with only LegalEntityId + LastSavedStep (all else null)
        var result = await CreateService().SaveAsync(TenantId, UserId, partialCommand, CancellationToken.None);

        Assert.True(result.IsSuccess);
        _employeeRepository.Verify(r => r.EmployeeExistsInLegalEntityAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()), Times.Never);
        _draftRepository.Verify(r => r.AddAsync(It.Is<OnboardingDraftEntity>(d =>
            d.FirstName == "" && d.WorkEmail == "" && d.EmploymentType == "" && d.StartDate == null), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("cancelled")]
    [InlineData("finalized")]
    public async Task SaveAsync_ExistingClosedDraft_ReturnsConflict(string status)
    {
        // arrange: GetTrackedAsync returns a draft with Status = status, StartedById = UserId
        var result = await CreateService().SaveAsync(TenantId, UserId, partialCommand with { DraftId = existingId }, CancellationToken.None);

        Assert.Equal(409, result.StatusCode);
        Assert.Equal("This draft is closed and can no longer be edited.", result.Error);
    }
```
Finalize:
```csharp
    [Fact]
    public async Task FinalizeAsync_MissingStartDate_ReturnsUnprocessable()
    {
        // arrange: a draft that passes every existing finalize check (names, email, company, dept, position, work mode, employment type) but StartDate = null
        var result = await /* finalize via the same entry point existing finalize tests use */;

        Assert.Equal(422, result.StatusCode);
        Assert.Equal("Start date is required.", result.Error);
    }
```
Fill the arrange blocks using the helpers already in those test files (they build drafts that pass every check); only the fields named above differ.

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~SaveOnboardingDraftCommandValidatorTests|FullyQualifiedName~OnboardingDraftWriteServiceTests|FullyQualifiedName~FinalizeOnboardingDraft"` → build errors / failures.

- [ ] **Step 3: Implement**

Validator (replace the rules):
```csharp
        RuleFor(c => c.FirstName).MaximumLength(100);
        RuleFor(c => c.LastName).MaximumLength(100);
        RuleFor(c => c.WorkEmail).EmailAddress().MaximumLength(320).When(c => !string.IsNullOrWhiteSpace(c.WorkEmail));
        RuleFor(c => c.LegalEntityId).NotEmpty();
        RuleFor(c => c.EmploymentType).MaximumLength(30);
        RuleFor(c => c.LastSavedStep).NotEmpty().MaximumLength(50);
        // EmployeeNumber and WorkModeId rules unchanged
```
Write service `SaveAsync`:
- Wrap the email-uniqueness block: `if (!string.IsNullOrWhiteSpace(request.WorkEmail) && await _employeeRepository.EmployeeExistsInLegalEntityAsync(...request.WorkEmail.Trim()...))`.
- In the existing-draft branch, right after the permission check:
  ```csharp
            if (existing.Status is OnboardingDraftStatus.Cancelled or OnboardingDraftStatus.Finalized)
                return Result<OnboardingDraftResponse>.Conflict("This draft is closed and can no longer be edited.");
  ```
- Assignment block: `draft.FirstName = request.FirstName?.Trim() ?? string.Empty;` (same for `LastName`, `WorkEmail`), `draft.EmploymentType = request.EmploymentType?.Trim() ?? string.Empty;`, `draft.StartDate = request.StartDate;`.
`FinalizeAsync`: after the work-email check add
  ```csharp
        if (draft.StartDate is null)
            return Result<FinalizeOnboardingDraftResponse>.UnprocessableEntity("Start date is required.");
  ```
  and change later uses to `draft.StartDate.Value`.
Entity: `public DateOnly? StartDate { get; set; }`. Request contract + response DTOs: nullable as listed. Then:
```bash
dotnet ef migrations add MakeOnboardingDraftStartDateNullable --project src/ONEVO.Infrastructure --startup-project src/ONEVO.Api
```
Inspect the generated migration: it must contain only an `AlterColumn<DateOnly>` on `onboarding_drafts.start_date` to `nullable: true` (and the reverse in Down). If it contains anything else, stop and report it (someone else's pending model change).

- [ ] **Step 4: Run** the Step 2 filter → pass; full `OnboardingDraft` folders: `--filter "FullyQualifiedName~OnboardingDraft"` → pass. Integration: `--filter "FullyQualifiedName~OnboardingDraftsIntegrationTests"` → pass, and add one integration test that saves a draft with only company + step, reads it back, and asserts `StartDate == null` and `FirstName == ""`.

- [ ] **Step 5: Commit** (source, contract, DTOs, migration + designer + snapshot, tests)
```bash
git status
git commit -m "feat(core-hr): allow partial onboarding drafts; freeze closed drafts; finalize requires start date"
```

---

### Task 2: Cancel onboarding draft + "mine" list filter

**Files:**
- Create: `src/ONEVO.Application/Features/CoreHr/OnboardingDraft/Commands/CancelOnboardingDraft/CancelOnboardingDraftCommand.cs` (record + handler)
- Modify: `IOnboardingDraftRepository.ListWithNamesAsync` + `EfOnboardingDraftRepository` (~126-163)
- Modify: `ListOnboardingDraftsQuery` + handler
- Modify: `src/ONEVO.Api/Controllers/Tenant/CoreHr/OnboardingDraftsController.cs`
- Test: `tests/ONEVO.Tests.Unit/Features/CoreHr/OnboardingDrafts/CancelOnboardingDraftCommandHandlerTests.cs`, `GetAndListOnboardingDraftQueryHandlerTests.cs`, `OnboardingDraftsControllerTests.cs`

**Interfaces:**
- Produces:
  ```csharp
  public sealed record CancelOnboardingDraftCommand(Guid DraftId) : IRequest<Result>;
  // handler ctor: (IOnboardingDraftRepository draftRepository, ICurrentUser currentUser, IDateTimeProvider clock)
  public record ListOnboardingDraftsQuery(int Page = 1, int PageSize = 25, bool Mine = false) : IRequest<Result<DraftListPageResponse>>;
  Task<(IReadOnlyList<DraftListItemResponse> Items, int TotalCount)> ListWithNamesAsync(Guid tenantId, Guid? startedById, int page, int pageSize, CancellationToken ct = default, bool openOnly = false);
  // DELETE api/v1/onboarding/drafts/{id}  [RequirePermission("employees:write")] → 204
  // GET    api/v1/onboarding/drafts?mine=true
  ```
  Cancel rules: 404 when missing; 403 unless starter or `employees:write`; finalized → 409 `This draft has already been finalized.`; already cancelled → success (idempotent); otherwise `Status = Cancelled`, `UpdatedAt = clock.UtcNow`, save. `Mine=true` forces `startedById = caller` and `openOnly = true`, which excludes status `cancelled`/`finalized` and `DraftReason == "invitation_sent"`.

- [ ] **Step 1: Write failing tests**
```csharp
public sealed class CancelOnboardingDraftCommandHandlerTests
{
    private readonly Mock<IOnboardingDraftRepository> _drafts = new();
    private readonly Mock<ICurrentUser> _currentUser = new();
    private readonly Mock<IDateTimeProvider> _clock = new();
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public CancelOnboardingDraftCommandHandlerTests()
    {
        _currentUser.SetupGet(u => u.TenantId).Returns(_tenantId);
        _currentUser.SetupGet(u => u.UserId).Returns(_userId);
        _clock.SetupGet(c => c.UtcNow).Returns(new DateTimeOffset(2026, 9, 29, 10, 0, 0, TimeSpan.Zero));
    }

    private CancelOnboardingDraftCommandHandler Sut() => new(_drafts.Object, _currentUser.Object, _clock.Object);

    private OnboardingDraftEntity Seed(string status, Guid? startedBy = null)
    {
        var d = new OnboardingDraftEntity { Id = Guid.NewGuid(), TenantId = _tenantId, Status = status, StartedById = startedBy ?? _userId };
        _drafts.Setup(r => r.GetTrackedAsync(_tenantId, d.Id, It.IsAny<CancellationToken>())).ReturnsAsync(d);
        return d;
    }

    [Fact]
    public async Task OwnDraft_IsCancelled_AndSaved()
    {
        var d = Seed(OnboardingDraftStatus.Draft);
        var r = await Sut().Handle(new CancelOnboardingDraftCommand(d.Id), CancellationToken.None);
        Assert.True(r.IsSuccess);
        Assert.Equal(OnboardingDraftStatus.Cancelled, d.Status);
        _drafts.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task SomeoneElsesDraft_WithoutWrite_IsForbidden()
    {
        var d = Seed(OnboardingDraftStatus.Draft, startedBy: Guid.NewGuid());
        _currentUser.Setup(u => u.HasPermission("employees:write")).Returns(false);
        Assert.Equal(403, (await Sut().Handle(new CancelOnboardingDraftCommand(d.Id), CancellationToken.None)).StatusCode);
    }

    [Fact]
    public async Task FinalizedDraft_IsConflict()
    {
        var d = Seed(OnboardingDraftStatus.Finalized);
        var r = await Sut().Handle(new CancelOnboardingDraftCommand(d.Id), CancellationToken.None);
        Assert.Equal(409, r.StatusCode);
        Assert.Equal("This draft has already been finalized.", r.Error);
    }

    [Fact]
    public async Task AlreadyCancelled_IsIdempotentSuccess_WithoutSaving()
    {
        var d = Seed(OnboardingDraftStatus.Cancelled);
        Assert.True((await Sut().Handle(new CancelOnboardingDraftCommand(d.Id), CancellationToken.None)).IsSuccess);
        _drafts.Verify(x => x.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Missing_IsNotFound()
        => Assert.Equal(404, (await Sut().Handle(new CancelOnboardingDraftCommand(Guid.NewGuid()), CancellationToken.None)).StatusCode);
}
```
List handler (add to the list test class):
```csharp
    [Fact]
    public async Task Mine_ForcesCallerAndOpenOnly_EvenForWriteHolders()
    {
        _currentUser.Setup(u => u.HasPermission("employees:write")).Returns(true);
        _draftRepository.Setup(r => r.ListWithNamesAsync(_tenantId, _userId, 1, 25, It.IsAny<CancellationToken>(), true))
            .ReturnsAsync((Array.Empty<DraftListItemResponse>(), 0));

        var result = await CreateHandler().Handle(new ListOnboardingDraftsQuery(1, 25, Mine: true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        _draftRepository.Verify(r => r.ListWithNamesAsync(_tenantId, _userId, 1, 25, It.IsAny<CancellationToken>(), true), Times.Once);
    }
```
Controller: `Cancel_SendsCommand_AndReturnsNoContent` (mediator returns `Result.Success()` → `NoContentResult`) and `List_PassesMine` (verify `ListOnboardingDraftsQuery` with `Mine == true`), plus a reflection check that `Cancel` has `RequirePermission("employees:write")` (read the constructor argument via `GetCustomAttributesData()` as in B's EmployeesController tests).
Integration (`OnboardingDraftsIntegrationTests.cs`): save two drafts for user A and one for user B, cancel one of A's; `ListWithNamesAsync(tenant, A, 1, 25, openOnly: true)` returns exactly A's remaining draft.

- [ ] **Step 2: Run** → build errors.

- [ ] **Step 3: Implement**

Cancel handler:
```csharp
public sealed class CancelOnboardingDraftCommandHandler(
    IOnboardingDraftRepository draftRepository, ICurrentUser currentUser, IDateTimeProvider clock)
    : IRequestHandler<CancelOnboardingDraftCommand, Result>
{
    public async Task<Result> Handle(CancelOnboardingDraftCommand request, CancellationToken ct)
    {
        var draft = await draftRepository.GetTrackedAsync(currentUser.TenantId, request.DraftId, ct);
        if (draft is null)
            return Result.NotFound("The draft could not be found.");
        if (draft.StartedById != currentUser.UserId && !currentUser.HasPermission("employees:write"))
            return Result.Forbidden();
        if (draft.Status == OnboardingDraftStatus.Finalized)
            return Result.Conflict("This draft has already been finalized.");
        if (draft.Status == OnboardingDraftStatus.Cancelled)
            return Result.Success();

        draft.Status = OnboardingDraftStatus.Cancelled;
        draft.UpdatedAt = clock.UtcNow;
        await draftRepository.SaveChangesAsync(ct);
        return Result.Success();
    }
}
```
(Use the `IDateTimeProvider` type/namespace the write service uses; if `Result.Forbidden()` needs a message, pass `"Access denied."`.)
Repository: add the `openOnly` parameter and, after the `startedById` filter:
```csharp
        if (openOnly)
        {
            joined = joined.Where(row =>
                row.d.Status != OnboardingDraftStatus.Cancelled
                && row.d.Status != OnboardingDraftStatus.Finalized
                && (row.d.DraftReason == null || row.d.DraftReason != OnboardingDraftReason.InvitationSent));
        }
```
List handler:
```csharp
        var startedById = request.Mine || !_currentUser.HasPermission("employees:write") ? _currentUser.UserId : (Guid?)null;
        var (items, totalCount) = await _draftRepository.ListWithNamesAsync(_currentUser.TenantId, startedById, page, pageSize, ct, openOnly: request.Mine);
```
Controller: `List(..., [FromQuery] bool mine = false, ...)` passing `Mine: mine`; new action:
```csharp
    [HttpDelete("{id:guid}")]
    [RequirePermission("employees:write")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct = default)
    {
        var result = await _mediator.Send(new CancelOnboardingDraftCommand(id), ct);
        return result.IsSuccess ? NoContent() : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }
```

- [ ] **Step 4: Run** unit filter `FullyQualifiedName~OnboardingDraft` + the integration class → pass.

- [ ] **Step 5: Commit**
```bash
git status
git commit -m "feat(core-hr): cancel onboarding drafts and list only my open drafts"
```

---

### Task 3: `task_drafts` table — entity, configuration, repository, migration with RLS

**Files:**
- Create: `src/ONEVO.Domain/Features/WorkManagement/Tasks/Entities/TaskDraft.cs`
- Create: `src/ONEVO.Infrastructure/Persistence/Configurations/WorkManagement/TaskDraftConfiguration.cs`
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/RepositoryInterfaces/ITaskDraftRepository.cs`
- Create: `src/ONEVO.Infrastructure/Persistence/Repositories/WorkManagement/EfTaskDraftRepository.cs`
- Modify: `src/ONEVO.Infrastructure/Persistence/ApplicationDbContext.cs` (DbSet next to `TaskComments`, ~line 320)
- Modify: `src/ONEVO.Infrastructure/DependencyInjection.cs` (next to the `EfTaskCommentRepository` lines, ~383)
- Create: migration `AddTaskDrafts` (+ RLS SQL appended by hand)
- Test: `tests/ONEVO.Tests.Integration/WorkManagement/TaskDraftRepositoryIntegrationTests.cs` (mirror the setup of an existing WorkManagement integration test that uses `SharedPostgresTemplate.CreateDatabaseAsync()`)

**Interfaces:**
- Produces:
  ```csharp
  public class TaskDraft : BaseEntity { Guid OwnerUserId; Guid ProjectId; string Title = ""; string PayloadJson = "{}"; }
  public interface ITaskDraftRepository
  {
      Task AddAsync(TaskDraft draft, CancellationToken ct = default);
      /// Tracked; null unless it exists in the tenant AND belongs to ownerUserId.
      Task<TaskDraft?> GetOwnedAsync(Guid tenantId, Guid ownerUserId, Guid draftId, CancellationToken ct = default);
      Task<IReadOnlyList<TaskDraft>> ListOwnedAsync(Guid tenantId, Guid ownerUserId, CancellationToken ct = default); // newest (UpdatedAt ?? CreatedAt) first, no tracking
      void Remove(TaskDraft draft); // soft delete via SoftDeleteInterceptor
  }
  // table task_drafts: title varchar(500) not null, payload_json jsonb not null,
  // index ix_task_drafts_tenant_id_owner_user_id (tenant_id, owner_user_id); RLS policy tenant_isolation
  ```

- [ ] **Step 1: Write the failing integration test**
```csharp
public sealed class TaskDraftRepositoryIntegrationTests : IAsyncLifetime
{
    // copy the fixture fields / InitializeAsync / DisposeAsync from an existing WorkManagement integration test
    // (database from SharedPostgresTemplate, ApplicationDbContext in tenant context for _tenantId)

    [Fact]
    public async Task Add_ListOwned_GetOwned_Remove_RoundTrip()
    {
        var owner = Guid.NewGuid(); var other = Guid.NewGuid(); var project = Guid.NewGuid();
        await using var db = CreateDbContext();
        var repo = new EfTaskDraftRepository(db);
        var mine = new TaskDraft { Id = Guid.NewGuid(), TenantId = _tenantId, OwnerUserId = owner, ProjectId = project, Title = "Fix login", PayloadJson = "{\"priority\":\"high\"}", CreatedById = owner };
        var theirs = new TaskDraft { Id = Guid.NewGuid(), TenantId = _tenantId, OwnerUserId = other, ProjectId = project, Title = "Other", PayloadJson = "{}", CreatedById = other };
        await repo.AddAsync(mine); await repo.AddAsync(theirs);
        await db.SaveChangesAsync();

        Assert.Equal(new[] { mine.Id }, (await repo.ListOwnedAsync(_tenantId, owner)).Select(d => d.Id));
        Assert.Null(await repo.GetOwnedAsync(_tenantId, owner, theirs.Id));
        var loaded = await repo.GetOwnedAsync(_tenantId, owner, mine.Id);
        Assert.Equal("{\"priority\": \"high\"}".Replace(" ", ""), loaded!.PayloadJson.Replace(" ", ""));   // jsonb normalises whitespace

        repo.Remove(loaded);
        await db.SaveChangesAsync();
        Assert.Empty(await repo.ListOwnedAsync(_tenantId, owner));
    }
}
```

- [ ] **Step 2: Run** `dotnet test tests/ONEVO.Tests.Integration/ONEVO.Tests.Integration.csproj --filter "FullyQualifiedName~TaskDraftRepositoryIntegrationTests"` → build error.

- [ ] **Step 3: Implement**

`TaskDraft.cs`:
```csharp
using ONEVO.Domain.Common;

namespace ONEVO.Domain.Features.WorkManagement.Tasks.Entities;

/// <summary>A user's unsaved "create task" form. Private to its owner; the payload is the
/// frontend's form snapshot and is opaque to the backend.</summary>
public class TaskDraft : BaseEntity
{
    public Guid OwnerUserId { get; set; }
    public Guid ProjectId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = "{}";
}
```
`TaskDraftConfiguration.cs`:
```csharp
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using ONEVO.Domain.Features.WorkManagement.Tasks.Entities;

namespace ONEVO.Infrastructure.Persistence.Configurations.WorkManagement;

public sealed class TaskDraftConfiguration : IEntityTypeConfiguration<TaskDraft>
{
    public void Configure(EntityTypeBuilder<TaskDraft> builder)
    {
        builder.ToTable("task_drafts");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Title).HasMaxLength(500).IsRequired();
        builder.Property(d => d.PayloadJson).HasColumnType("jsonb").IsRequired();
        builder.HasIndex(d => new { d.TenantId, d.OwnerUserId }).HasDatabaseName("ix_task_drafts_tenant_id_owner_user_id");
    }
}
```
(If `TaskCommentConfiguration` shows configurations are discovered by `ApplyConfigurationsFromAssembly`, nothing else is needed; otherwise register it the same way TaskComment's is.)
`ITaskDraftRepository.cs` — as in **Produces**, namespace `ONEVO.Application.Features.WorkManagement.Tasks.RepositoryInterfaces`.
`EfTaskDraftRepository.cs`:
```csharp
public sealed class EfTaskDraftRepository(ApplicationDbContext db) : ITaskDraftRepository
{
    public async Task AddAsync(TaskDraft draft, CancellationToken ct = default) => await db.TaskDrafts.AddAsync(draft, ct);

    public Task<TaskDraft?> GetOwnedAsync(Guid tenantId, Guid ownerUserId, Guid draftId, CancellationToken ct = default) =>
        db.TaskDrafts.FirstOrDefaultAsync(d => d.TenantId == tenantId && d.OwnerUserId == ownerUserId && d.Id == draftId, ct);

    public async Task<IReadOnlyList<TaskDraft>> ListOwnedAsync(Guid tenantId, Guid ownerUserId, CancellationToken ct = default) =>
        await db.TaskDrafts.AsNoTracking()
            .Where(d => d.TenantId == tenantId && d.OwnerUserId == ownerUserId)
            .OrderByDescending(d => d.UpdatedAt ?? d.CreatedAt).ThenBy(d => d.Id)
            .ToListAsync(ct);

    public void Remove(TaskDraft draft) => db.TaskDrafts.Remove(draft);
}
```
DbSet: `public DbSet<TaskDraft> TaskDrafts => Set<TaskDraft>();`
DI:
```csharp
        services.AddScoped<EfTaskDraftRepository>();
        services.AddScoped<ITaskDraftRepository>(sp => sp.GetRequiredService<EfTaskDraftRepository>());
```
Migration:
```bash
dotnet ef migrations add AddTaskDrafts --project src/ONEVO.Infrastructure --startup-project src/ONEVO.Api
```
Check the generated `Up` creates only `task_drafts` (+ its index). Then append, at the end of `Up`:
```csharp
            migrationBuilder.Sql(@"
                ALTER TABLE task_drafts ENABLE ROW LEVEL SECURITY;
                ALTER TABLE task_drafts FORCE ROW LEVEL SECURITY;
                DROP POLICY IF EXISTS tenant_isolation ON task_drafts;
                CREATE POLICY tenant_isolation ON task_drafts
                    USING (
                        current_setting('app.tenant_context_mode', true) = 'admin'
                        OR (
                            current_setting('app.tenant_context_mode', true) = 'tenant'
                            AND tenant_id::text = current_setting('app.current_tenant_id', true)
                        )
                    )
                    WITH CHECK (
                        current_setting('app.tenant_context_mode', true) = 'admin'
                        OR (
                            current_setting('app.tenant_context_mode', true) = 'tenant'
                            AND tenant_id::text = current_setting('app.current_tenant_id', true)
                        )
                    );
            ");
```
and at the start of `Down`, before `DropTable`:
```csharp
            migrationBuilder.Sql(@"
                DROP POLICY IF EXISTS tenant_isolation ON task_drafts;
                ALTER TABLE task_drafts DISABLE ROW LEVEL SECURITY;
            ");
```
If the repo has an architecture/integration test enumerating RLS-protected tenant tables (grep `task_comments` under `tests/` for a list of table names), add `task_drafts` there too.

- [ ] **Step 4: Run** the integration test → pass; also any RLS-coverage test you touched.

- [ ] **Step 5: Commit**
```bash
git status
git commit -m "feat(work): add task_drafts table with tenant RLS"
```

---

### Task 4: Task-draft endpoints (owner-only CRUD)

**Files:**
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/DTOs/Responses/TaskDraftResponse.cs`
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Commands/TaskDrafts/TaskDraftCommands.cs` (Save + Delete records, validator, handlers)
- Create: `src/ONEVO.Application/Features/WorkManagement/Tasks/Queries/TaskDrafts/TaskDraftQueries.cs` (List + Get)
- Create: `src/ONEVO.Api/Controllers/Tenant/WorkManagement/TaskDraftsController.cs`
- Create: `src/ONEVO.Api/Contracts/WorkManagement/Tasks/SaveTaskDraftRequest.cs` (same folder as other task request contracts)
- Test: `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/TaskDraftHandlersTests.cs`, `tests/ONEVO.Tests.Unit/Features/WorkManagement/Tasks/TaskDraftsControllerTests.cs`

**Interfaces:**
- Consumes: `ITaskDraftRepository` (Task 3), `IUnitOfWork`, `ICurrentUser`, `IMediator`, `DeleteTaskPendingUploadCommand(Guid FileId) : IRequest<Result>` (conflicts for files already attached to a task — ignored).
- Produces:
  ```csharp
  public sealed record TaskDraftSummaryResponse(Guid Id, Guid ProjectId, string Title, DateTimeOffset UpdatedAt);
  public sealed record TaskDraftResponse(Guid Id, Guid ProjectId, string Title, string PayloadJson, DateTimeOffset UpdatedAt);
  public sealed record SaveTaskDraftCommand(Guid? DraftId, Guid ProjectId, string? Title, string PayloadJson) : IRequest<Result<TaskDraftResponse>>;
  public sealed record DeleteTaskDraftCommand(Guid DraftId) : IRequest<Result>;
  public sealed record ListMyTaskDraftsQuery : IRequest<Result<IReadOnlyList<TaskDraftSummaryResponse>>>;
  public sealed record GetTaskDraftQuery(Guid DraftId) : IRequest<Result<TaskDraftResponse>>;
  public const int TaskDraftLimits.MaxPayloadLength = 262144;
  // HTTP (prefix api/v1/work, same class attributes as TasksController):
  // GET task-drafts → 200 [summaries]; GET task-drafts/{id} → 200 | 404; POST task-drafts → 201 TaskDraftResponse;
  // PUT task-drafts/{id} → 200 | 404; DELETE task-drafts/{id} → 204 | 404
  ```
  Rules: every operation is scoped to `ICurrentUser.UserId`; someone else's draft is indistinguishable from missing (404). Save validates: `ProjectId` non-empty; `Title` ≤ 500 (null → `""`, trimmed); `PayloadJson` non-empty, ≤ 262144 chars, parses as a JSON **object**. Delete reads `attachmentFileIds` (string array) from the payload if present and sends `DeleteTaskPendingUploadCommand` for each, ignoring every failure, then removes the draft.

- [ ] **Step 1: Write failing tests** (`TaskDraftHandlersTests.cs`; Moq + `FakeUnitOfWork`; `_currentUser` returns `IsAuthenticated = true`, `TenantId`, `UserId`):
```csharp
    [Fact]
    public async Task Save_New_CreatesOwnedDraft_TrimmedTitle()
    {
        TaskDraft? added = null;
        _repo.Setup(r => r.AddAsync(It.IsAny<TaskDraft>(), It.IsAny<CancellationToken>())).Callback<TaskDraft, CancellationToken>((d, _) => added = d);

        var r = await SaveSut().Handle(new SaveTaskDraftCommand(null, _projectId, "  Fix login  ", "{\"priority\":\"high\"}"), CancellationToken.None);

        Assert.True(r.IsSuccess);
        Assert.Equal((_userId, _tenantId, "Fix login", _projectId), (added!.OwnerUserId, added.TenantId, added.Title, added.ProjectId));
        Assert.Equal(1, _uow.SaveCallCount);
    }

    [Fact]
    public async Task Save_ExistingNotOwned_IsNotFound()
    {
        _repo.Setup(r => r.GetOwnedAsync(_tenantId, _userId, _draftId, It.IsAny<CancellationToken>())).ReturnsAsync((TaskDraft?)null);
        var r = await SaveSut().Handle(new SaveTaskDraftCommand(_draftId, _projectId, "x", "{}"), CancellationToken.None);
        Assert.Equal(404, r.StatusCode);
    }

    [Fact]
    public async Task Save_Existing_UpdatesFieldsAndTimestamp()
    {
        var existing = new TaskDraft { Id = _draftId, TenantId = _tenantId, OwnerUserId = _userId, ProjectId = _projectId, Title = "old", PayloadJson = "{}" };
        _repo.Setup(r => r.GetOwnedAsync(_tenantId, _userId, _draftId, It.IsAny<CancellationToken>())).ReturnsAsync(existing);
        var r = await SaveSut().Handle(new SaveTaskDraftCommand(_draftId, _projectId, "new", "{\"a\":1}"), CancellationToken.None);
        Assert.True(r.IsSuccess);
        Assert.Equal(("new", "{\"a\":1}"), (existing.Title, existing.PayloadJson));
        Assert.NotNull(existing.UpdatedAt);
    }

    [Theory]
    [InlineData("")]
    [InlineData("[1,2]")]
    [InlineData("{not json")]
    public void Validator_RejectsNonObjectPayload(string payload) =>
        Assert.False(new SaveTaskDraftCommandValidator().Validate(new SaveTaskDraftCommand(null, _projectId, "t", payload)).IsValid);

    [Fact]
    public void Validator_RejectsOversizedPayload() =>
        Assert.False(new SaveTaskDraftCommandValidator().Validate(
            new SaveTaskDraftCommand(null, _projectId, "t", "{\"d\":\"" + new string('x', TaskDraftLimits.MaxPayloadLength) + "\"}")).IsValid);

    [Fact]
    public async Task Delete_RemovesDraft_AndBestEffortDeletesPendingAttachments()
    {
        var f1 = Guid.NewGuid(); var f2 = Guid.NewGuid();
        var draft = new TaskDraft { Id = _draftId, TenantId = _tenantId, OwnerUserId = _userId, PayloadJson = $"{{\"attachmentFileIds\":[\"{f1}\",\"{f2}\"]}}" };
        _repo.Setup(r => r.GetOwnedAsync(_tenantId, _userId, _draftId, It.IsAny<CancellationToken>())).ReturnsAsync(draft);
        _mediator.Setup(m => m.Send(It.Is<DeleteTaskPendingUploadCommand>(c => c.FileId == f1), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Conflict("This file is already attached and cannot be deleted as a pending upload."));
        _mediator.Setup(m => m.Send(It.Is<DeleteTaskPendingUploadCommand>(c => c.FileId == f2), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("storage down"));

        var r = await DeleteSut().Handle(new DeleteTaskDraftCommand(_draftId), CancellationToken.None);

        Assert.True(r.IsSuccess);
        _repo.Verify(x => x.Remove(draft), Times.Once);
        _mediator.Verify(m => m.Send(It.IsAny<DeleteTaskPendingUploadCommand>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task Delete_NotOwned_IsNotFound()
    {
        _repo.Setup(r => r.GetOwnedAsync(_tenantId, _userId, _draftId, It.IsAny<CancellationToken>())).ReturnsAsync((TaskDraft?)null);
        Assert.Equal(404, (await DeleteSut().Handle(new DeleteTaskDraftCommand(_draftId), CancellationToken.None)).StatusCode);
    }

    [Fact]
    public async Task List_ReturnsCallersDraftsAsSummaries()
    {
        _repo.Setup(r => r.ListOwnedAsync(_tenantId, _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new[] { new TaskDraft { Id = _draftId, ProjectId = _projectId, Title = "t", CreatedAt = DateTimeOffset.UnixEpoch } });
        var r = await ListSut().Handle(new ListMyTaskDraftsQuery(), CancellationToken.None);
        Assert.Equal((_draftId, _projectId, "t", DateTimeOffset.UnixEpoch), (r.Value![0].Id, r.Value[0].ProjectId, r.Value[0].Title, r.Value[0].UpdatedAt));
    }
```
(`SaveSut()`, `DeleteSut()`, `ListSut()` construct the handlers with the mocks; `GetTaskDraftQuery` gets one found + one 404 test of the same shape.)
Controller tests (`TaskDraftsControllerTests.cs`): `Create` returns `CreatedAtActionResult`; `Update` passes the route id as `DraftId`; `Delete` returns `NoContentResult`; `List`/`Get` return `OkObjectResult`.

- [ ] **Step 2: Run** `--filter "FullyQualifiedName~TaskDraft"` → build error.

- [ ] **Step 3: Implement**

`TaskDraftCommands.cs` (key parts):
```csharp
public static class TaskDraftLimits { public const int MaxPayloadLength = 262144; public const int MaxTitleLength = 500; }

public sealed class SaveTaskDraftCommandValidator : AbstractValidator<SaveTaskDraftCommand>
{
    public SaveTaskDraftCommandValidator()
    {
        RuleFor(x => x.ProjectId).NotEmpty();
        RuleFor(x => x.Title).MaximumLength(TaskDraftLimits.MaxTitleLength);
        RuleFor(x => x.PayloadJson).NotEmpty().MaximumLength(TaskDraftLimits.MaxPayloadLength)
            .Must(BeJsonObject).WithMessage("Payload must be a JSON object.");
    }

    private static bool BeJsonObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try { using var doc = JsonDocument.Parse(json); return doc.RootElement.ValueKind == JsonValueKind.Object; }
        catch (JsonException) { return false; }
    }
}

public sealed class SaveTaskDraftCommandHandler(ITaskDraftRepository drafts, IUnitOfWork unitOfWork, ICurrentUser currentUser)
    : IRequestHandler<SaveTaskDraftCommand, Result<TaskDraftResponse>>
{
    public async Task<Result<TaskDraftResponse>> Handle(SaveTaskDraftCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated) return Result<TaskDraftResponse>.Forbidden("Authentication required.");
        var tenantId = currentUser.TenantId; var userId = currentUser.UserId;
        var now = DateTimeOffset.UtcNow;
        TaskDraft draft;
        if (request.DraftId is { } id)
        {
            var existing = await drafts.GetOwnedAsync(tenantId, userId, id, ct);
            if (existing is null) return Result<TaskDraftResponse>.NotFound("Draft not found.");
            draft = existing;
        }
        else
        {
            draft = new TaskDraft { Id = Guid.NewGuid(), TenantId = tenantId, OwnerUserId = userId, CreatedById = userId, CreatedAt = now };
            await drafts.AddAsync(draft, ct);
        }
        draft.ProjectId = request.ProjectId;
        draft.Title = request.Title?.Trim() ?? string.Empty;
        draft.PayloadJson = request.PayloadJson;
        draft.UpdatedAt = now;
        await unitOfWork.SaveChangesAsync(ct);
        return Result<TaskDraftResponse>.Success(new TaskDraftResponse(draft.Id, draft.ProjectId, draft.Title, draft.PayloadJson, now));
    }
}

public sealed class DeleteTaskDraftCommandHandler(
    ITaskDraftRepository drafts, IUnitOfWork unitOfWork, ICurrentUser currentUser, IMediator mediator, ILogger<DeleteTaskDraftCommandHandler> logger)
    : IRequestHandler<DeleteTaskDraftCommand, Result>
{
    public async Task<Result> Handle(DeleteTaskDraftCommand request, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated) return Result.Forbidden("Authentication required.");
        var draft = await drafts.GetOwnedAsync(currentUser.TenantId, currentUser.UserId, request.DraftId, ct);
        if (draft is null) return Result.NotFound("Draft not found.");

        // Pending uploads referenced by the draft are only kept alive by it. Files already attached to a
        // created task make DeleteTaskPendingUpload return Conflict - that's expected and ignored.
        foreach (var fileId in ReadAttachmentFileIds(draft.PayloadJson))
        {
            try { await mediator.Send(new DeleteTaskPendingUploadCommand(fileId), ct); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            { logger.LogWarning(ex, "Could not delete pending upload {FileId} for task draft {DraftId}", fileId, draft.Id); }
        }

        drafts.Remove(draft);
        await unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }

    private static IEnumerable<Guid> ReadAttachmentFileIds(string payloadJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (!doc.RootElement.TryGetProperty("attachmentFileIds", out var ids) || ids.ValueKind != JsonValueKind.Array) return [];
            return ids.EnumerateArray()
                .Select(e => e.ValueKind == JsonValueKind.String && Guid.TryParse(e.GetString(), out var g) ? g : Guid.Empty)
                .Where(g => g != Guid.Empty).ToList();
        }
        catch (JsonException) { return []; }
    }
}
```
Queries: `ListMyTaskDraftsQueryHandler` maps `ListOwnedAsync` to `TaskDraftSummaryResponse(d.Id, d.ProjectId, d.Title, d.UpdatedAt ?? d.CreatedAt)`; `GetTaskDraftQueryHandler` uses `GetOwnedAsync` → 404 or `TaskDraftResponse`.
Request: `public sealed record SaveTaskDraftRequest(Guid ProjectId, string? Title, System.Text.Json.JsonElement Payload);` — the controller passes `request.Payload.GetRawText()` as `PayloadJson` so the frontend sends a real JSON object, not a string. The response exposes `payloadJson` as a string; the frontend `JSON.parse`s it.
Controller:
```csharp
[ApiController]
[Route("api/v1/work/task-drafts")]
[Authorize(Policy = "TenantPolicy")]
[RequireAnyModule("worksync_foundation", "projects", "objectives_milestones", "tasks", "boards", "planning_sprints")]
public sealed class TaskDraftsController(IMediator mediator) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct) => ToResult(await mediator.Send(new ListMyTaskDraftsQuery(), ct));

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) => ToResult(await mediator.Send(new GetTaskDraftQuery(id), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveTaskDraftRequest request, CancellationToken ct)
    {
        var result = await mediator.Send(new SaveTaskDraftCommand(null, request.ProjectId, request.Title, request.Payload.GetRawText()), ct);
        return result.IsSuccess
            ? CreatedAtAction(nameof(Get), new { id = result.Value!.Id }, result.Value)
            : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveTaskDraftRequest request, CancellationToken ct) =>
        ToResult(await mediator.Send(new SaveTaskDraftCommand(id, request.ProjectId, request.Title, request.Payload.GetRawText()), ct));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await mediator.Send(new DeleteTaskDraftCommand(id), ct);
        return result.IsSuccess ? NoContent() : Problem(result.Error, statusCode: result.StatusCode ?? 400);
    }

    private IActionResult ToResult<T>(Result<T> result) =>
        result.IsSuccess ? Ok(result.Value) : Problem(result.Error, statusCode: result.StatusCode ?? 400);
}
```

- [ ] **Step 4: Run** `--filter "FullyQualifiedName~TaskDraft"` + Architecture tests → pass.

- [ ] **Step 5: Commit**
```bash
git status
git commit -m "feat(work): owner-only task draft endpoints"
```

---

### Task 5: Backend verification

- [ ] Kill `ONEVO.Api.exe`; run Unit, Architecture, Integration projects; paste raw summaries (pre-existing failures: `git log -1 -- <file>`, report, don't fix).
- [ ] Smoke with the dev server (only if the dev DB has the new migrations; if `database update` is blocked by the known broken migration, say so and skip): `POST /api/v1/work/task-drafts` `{ "projectId": "...", "title": "t", "payload": { "priority": "high" } }` → 201; `GET /api/v1/work/task-drafts` → contains it; `DELETE` → 204. `POST /api/v1/onboarding/drafts` with only `legalEntityId` + `lastSavedStep` → 201; `GET /api/v1/onboarding/drafts?mine=true` lists it; `DELETE` → 204 and it disappears from `mine`.

---

## Part 2 — Frontend (paths relative to `src/app/`)

### Task 6: Unsaved Changes Guard infrastructure

**Files:**
- Create: `shared/services/unsaved-changes.service.ts` (+ `.spec.ts`)
- Create: `shared/ui/unsaved-changes-dialog/unsaved-changes-dialog.component.ts` (+ `.spec.ts`)
- Create: `shared/guards/unsaved-changes.guard.ts` (+ `.spec.ts`) (use the folder where other shared guards live if `shared/guards` doesn't exist — `ls src/app/shared src/app/core/guards`)
- Modify: `layouts/main-layout/main-layout.component.ts` + `.html` (mount the dialog once, after `<main>`)
- Modify: `modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts` + `.html` (migrate to the service)

**Interfaces:**
- Produces:
  ```ts
  export interface DirtyFormHandle {
    isDirty(): boolean;
    canSaveDraft(): boolean;
    saveDraft(): Promise<boolean>;   // true = saved
    discard(): void;                 // called when the user chooses Discard
  }
  export type UnsavedChoice = 'discard' | 'keep' | 'save';
  export interface UnsavedPrompt { readonly canSaveDraft: boolean; readonly saving: boolean; readonly error: string | null; }
  @Injectable({ providedIn: 'root' }) export class UnsavedChangesService {
    readonly prompt: Signal<UnsavedPrompt | null>;
    register(handle: DirtyFormHandle): () => void;   // returns unregister
    hasDirtyForm(): boolean;
    requestClose(handle?: DirtyFormHandle): Promise<boolean>; // default = most recently registered; true = caller may close/leave
    choose(choice: UnsavedChoice): void;             // used by the dialog
  }
  export const unsavedChangesGuard: CanDeactivateFn<unknown>;  // () => inject(UnsavedChangesService).requestClose()
  // <app-unsaved-changes-dialog/> — no inputs; reads service.prompt(); test ids unsaved-discard, unsaved-keep, unsaved-save
  ```
  Save failure message (exact): `Could not save the draft. Try again or discard your changes.`

- [ ] **Step 1: Write failing tests**

`unsaved-changes.service.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { DirtyFormHandle, UnsavedChangesService } from './unsaved-changes.service';

function handle(overrides: Partial<DirtyFormHandle> = {}): DirtyFormHandle & { discard: ReturnType<typeof vi.fn>; saveDraft: ReturnType<typeof vi.fn> } {
  return { isDirty: () => true, canSaveDraft: () => true, saveDraft: vi.fn(async () => true), discard: vi.fn(), ...overrides } as never;
}

describe('UnsavedChangesService', () => {
  let service: UnsavedChangesService;
  beforeEach(() => { service = TestBed.inject(UnsavedChangesService); });

  it('allows closing a clean form without prompting', async () => {
    const h = handle({ isDirty: () => false });
    service.register(h);
    expect(await service.requestClose(h)).toBe(true);
    expect(service.prompt()).toBeNull();
  });

  it('keep → stays open, discard → calls discard and closes', async () => {
    const h = handle();
    service.register(h);
    const keep = service.requestClose(h);
    expect(service.prompt()).toEqual({ canSaveDraft: true, saving: false, error: null });
    service.choose('keep');
    expect(await keep).toBe(false);

    const discard = service.requestClose(h);
    service.choose('discard');
    expect(await discard).toBe(true);
    expect(h.discard).toHaveBeenCalled();
    expect(service.prompt()).toBeNull();
  });

  it('save → closes when the draft saves; stays open with an error when it fails', async () => {
    const h = handle({ saveDraft: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) });
    service.register(h);
    const result = service.requestClose(h);
    service.choose('save');
    await Promise.resolve(); await Promise.resolve();
    expect(service.prompt()).toEqual({ canSaveDraft: true, saving: false, error: 'Could not save the draft. Try again or discard your changes.' });
    service.choose('save');
    expect(await result).toBe(true);
    expect(h.saveDraft).toHaveBeenCalledTimes(2);
  });

  it('requestClose() without a handle uses the latest registration; unregister removes it', async () => {
    const unregister = service.register(handle({ isDirty: () => false }));
    expect(service.hasDirtyForm()).toBe(false);
    const dirty = handle();
    const unregisterDirty = service.register(dirty);
    expect(service.hasDirtyForm()).toBe(true);
    unregisterDirty();
    expect(await service.requestClose()).toBe(true);
    unregister();
  });

  it('blocks browser unload while a dirty form is registered', () => {
    service.register(handle());
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
```
`unsaved-changes-dialog.component.spec.ts`: renders nothing when `prompt()` is null; with a prompt renders title `Save draft?` and the three buttons; with `canSaveDraft: false` renders title `Discard changes?` and no `unsaved-save`; clicking each button calls `service.choose(...)` with `discard` / `keep` / `save`; shows `prompt().error` in a `role="alert"`; `unsaved-save` shows loading while `saving`. (Provide a stub `UnsavedChangesService` with `prompt = signal(...)` and `choose = vi.fn()`.)
`unsaved-changes.guard.spec.ts`: `TestBed.runInInjectionContext(() => unsavedChangesGuard(null!, null!, null!, null!))` resolves to the stub service's `requestClose()` result (true and false cases).

- [ ] **Step 2: Run** the three specs → FAIL.

- [ ] **Step 3: Implement**

`unsaved-changes.service.ts`:
```ts
import { DestroyRef, Injectable, Signal, inject, signal } from '@angular/core';

export interface DirtyFormHandle {
  isDirty(): boolean;
  canSaveDraft(): boolean;
  saveDraft(): Promise<boolean>;
  discard(): void;
}

export type UnsavedChoice = 'discard' | 'keep' | 'save';
export interface UnsavedPrompt { readonly canSaveDraft: boolean; readonly saving: boolean; readonly error: string | null; }

const SAVE_FAILED = 'Could not save the draft. Try again or discard your changes.';

/**
 * Single place that decides whether an open form may be closed or navigated away from.
 * Forms register a handle while open; close buttons, the route guard and the browser's
 * beforeunload all go through here, and one app-wide dialog renders `prompt`.
 */
@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
  private readonly handles: DirtyFormHandle[] = [];
  private readonly promptState = signal<UnsavedPrompt | null>(null);
  private pendingChoice: ((choice: UnsavedChoice) => void) | null = null;

  readonly prompt: Signal<UnsavedPrompt | null> = this.promptState.asReadonly();

  constructor() {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (this.hasDirtyForm()) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('beforeunload', onBeforeUnload));
  }

  register(handle: DirtyFormHandle): () => void {
    this.handles.push(handle);
    return () => {
      const index = this.handles.indexOf(handle);
      if (index >= 0) this.handles.splice(index, 1);
    };
  }

  hasDirtyForm(): boolean {
    return this.handles.some((h) => h.isDirty());
  }

  async requestClose(handle: DirtyFormHandle | undefined = this.handles.at(-1)): Promise<boolean> {
    if (!handle || !handle.isDirty()) return true;
    this.promptState.set({ canSaveDraft: handle.canSaveDraft(), saving: false, error: null });
    for (;;) {
      const choice = await new Promise<UnsavedChoice>((resolve) => (this.pendingChoice = resolve));
      if (choice === 'keep') {
        this.promptState.set(null);
        return false;
      }
      if (choice === 'discard') {
        this.promptState.set(null);
        handle.discard();
        return true;
      }
      this.promptState.update((p) => (p ? { ...p, saving: true, error: null } : p));
      const saved = await handle.saveDraft().catch(() => false);
      if (saved) {
        this.promptState.set(null);
        return true;
      }
      this.promptState.update((p) => (p ? { ...p, saving: false, error: SAVE_FAILED } : p));
    }
  }

  choose(choice: UnsavedChoice): void {
    const resolve = this.pendingChoice;
    this.pendingChoice = null;
    resolve?.(choice);
  }
}
```
(The `DestroyRef` of a root service fires when the app/TestBed is torn down, so specs don't leak listeners.)

`unsaved-changes-dialog.component.ts`:
```ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UnsavedChangesService } from '../../services/unsaved-changes.service';
import { ButtonComponent } from '../button/button.component';
import { ModalComponent } from '../modal/modal.component';

@Component({
  selector: 'app-unsaved-changes-dialog',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (service.prompt(); as prompt) {
      <app-modal [open]="true" [title]="prompt.canSaveDraft ? 'Save draft?' : 'Discard changes?'" panelClass="unsaved-dialog" (closed)="service.choose('keep')">
        <p class="mb-4 text-sm text-[var(--color-text-secondary)]">
          {{ prompt.canSaveDraft
            ? 'Would you like to save a draft? You can reopen it from the drafts bar at the bottom of the screen.'
            : 'You have unsaved changes. Discard them?' }}
        </p>
        @if (prompt.error) { <p class="mb-4 text-sm text-[var(--color-danger-text)]" role="alert">{{ prompt.error }}</p> }
        <div class="flex items-center gap-2">
          <app-button variant="danger" data-testid="unsaved-discard" [disabled]="prompt.saving" (pressed)="service.choose('discard')">Discard</app-button>
          <span class="flex-1"></span>
          <app-button variant="secondary" data-testid="unsaved-keep" [disabled]="prompt.saving" (pressed)="service.choose('keep')">Keep editing</app-button>
          @if (prompt.canSaveDraft) {
            <app-button variant="primary" data-testid="unsaved-save" [loading]="prompt.saving" (pressed)="service.choose('save')">Save draft</app-button>
          }
        </div>
      </app-modal>
    }
  `
})
export class UnsavedChangesDialogComponent {
  protected readonly service = inject(UnsavedChangesService);
}
```
The dialog opens *on top of* the task modal / wizard, which also sit at z-index 1200. It is mounted after `<main>` in main-layout, so later DOM order wins the tie; if the browser check shows it underneath, add a global rule `.unsaved-dialog` → give its modal root `z-index: 1250` (the modal's root element is the `fixed inset-0 z-[1200]` div — target it with `app-unsaved-changes-dialog .fixed { z-index: 1250; }` in `styles.css`).

`unsaved-changes.guard.ts`:
```ts
import { CanDeactivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { UnsavedChangesService } from '../services/unsaved-changes.service';

/** Blocks leaving a route while a registered form has unsaved changes, via the shared dialog. */
export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => inject(UnsavedChangesService).requestClose();
```
Main layout: import `UnsavedChangesDialogComponent`, add `<app-unsaved-changes-dialog />` right after `<app-mobile-bottom-nav />`.
Calendar modal: inject `UnsavedChangesService`; register on open with `{ isDirty: () => this.isDirty(), canSaveDraft: () => false, saveDraft: async () => false, discard: () => {} }` (unregister on close / `DestroyRef`); `attemptClose()` becomes `void this.unsaved.requestClose(this.handle).then((ok) => ok && this.cancel.emit())`; delete `discardConfirmOpen`, `confirmDiscard`, `cancelDiscard` and the `<app-confirm-modal>` in the html; update its spec's discard tests to drive `UnsavedChangesService.choose` instead.

- [ ] **Step 4: Run** the three new specs + `modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts` + `layouts/main-layout/*.spec.ts` → pass (layout specs may need `UnsavedChangesDialogComponent` stubbed like other children).

- [ ] **Step 5: Commit**
```bash
git status
git add src/app/shared/services/unsaved-changes.service.ts src/app/shared/services/unsaved-changes.service.spec.ts src/app/shared/ui/unsaved-changes-dialog/ src/app/shared/guards/ src/app/layouts/main-layout/ src/app/modules/calendar/ui/calendar-event-form-modal/
git commit -m "feat(shared): unsaved changes guard - service, dialog, route guard; calendar modal migrated"
```
(Stage only your hunks in main-layout files if they carry foreign edits.)

---

### Task 7: Draft APIs + `DraftsStore`

**Files:**
- Create: `modules/work/models/task-draft.model.ts`
- Create: `modules/work/data-access/task-draft-api.service.ts` (+ `.spec.ts`)
- Modify: `modules/people/data-access/people-api.service.ts` (+ spec) — `cancelDraft`, `listDrafts` `mine`
- Modify: `modules/people/models/onboarding-draft.model.ts` (`DraftListParams.mine?: boolean`)
- Create: `shared/state/drafts.store.ts` (+ `.spec.ts`)

**Interfaces:**
- Produces:
  ```ts
  // task-draft.model.ts
  export interface TaskDraftAttachment { readonly fileId: string; readonly name: string; readonly sizeBytes: number; }
  export interface TaskDraftSubtask { id: string; title: string; priority?: WorkTask['priority']; dueDate?: string; assigneeEmployeeId?: string; objectiveId?: string; categoryId?: string; }
  export interface TaskDraftPayload {
    readonly version: 1; readonly description: string; readonly objectiveId: string; readonly sprintId: string;
    readonly categoryId: string; readonly statusId: string; readonly priority: WorkTask['priority'] | null;
    readonly dueDate: string; readonly estimatedHours: number | null; readonly storyPoints: number | null;
    readonly assigneeEmployeeId: string; readonly subtasks: readonly TaskDraftSubtask[];
    readonly attachments: readonly TaskDraftAttachment[]; readonly attachmentFileIds: readonly string[];
  }
  export interface TaskDraftSummary { readonly id: string; readonly projectId: string; readonly title: string; readonly updatedAt: string; }
  export interface TaskDraft { readonly id: string; readonly projectId: string; readonly title: string; readonly payload: TaskDraftPayload; readonly updatedAt: string; }
  // TaskDraftApiService (base `${environment.apiUrl}/work/task-drafts`)
  list(): Observable<TaskDraftSummary[]>
  get(id: string): Observable<TaskDraft>                  // parses payloadJson
  create(projectId: string, title: string, payload: TaskDraftPayload): Observable<TaskDraft>   // POST { projectId, title, payload }
  update(id: string, projectId: string, title: string, payload: TaskDraftPayload): Observable<TaskDraft>  // PUT
  remove(id: string): Observable<void>
  // PeopleApiService
  cancelDraft(id: string): Observable<void>               // DELETE /onboarding/drafts/{id}
  // listDrafts({ mine: true, page: 1, pageSize: 50 }) → ?mine=true
  // shared/state/drafts.store.ts
  export interface DraftChip { readonly kind: 'task' | 'employee'; readonly id: string; readonly label: string; readonly badge: string | null; readonly projectId: string | null; }
  export const DraftsStore: signalStore root; state { chips: DraftChip[] }; methods load(): Promise<void>; removeChip(chip: DraftChip): Promise<boolean>
  ```
  Labels: task → `title.trim() || 'Untitled task'`; employee → `displayName.trim() || 'Untitled employee'`. Badges: `waiting_for_seat` → `Waiting for seat`; `waiting_for_position_approval` → `Awaiting approval`; otherwise null. Order: task drafts first (API order), then employee drafts (API order). `load()` uses `Promise.allSettled` so a 403 on onboarding drafts (user without `employees:read`) still shows task drafts; the employee request is skipped entirely when `PermissionService.hasPermission('employees:read')` is false.

- [ ] **Step 1: Write failing tests**

`task-draft-api.service.spec.ts`:
```ts
  it('parses payloadJson on get and sends payload as an object on create/update', () => {
    const payload = { version: 1, description: '<p>x</p>' } as never;
    service.get('d1').subscribe((d) => expect(d.payload).toEqual(payload));
    httpMock.expectOne((r) => r.url.endsWith('/work/task-drafts/d1'))
      .flush({ id: 'd1', projectId: 'p', title: 't', payloadJson: JSON.stringify(payload), updatedAt: '2026-09-29T00:00:00Z' });

    service.create('p', 't', payload).subscribe();
    const post = httpMock.expectOne((r) => r.method === 'POST' && r.url.endsWith('/work/task-drafts'));
    expect(post.request.body).toEqual({ projectId: 'p', title: 't', payload });
    post.flush({ id: 'd2', projectId: 'p', title: 't', payloadJson: '{}', updatedAt: '' });

    service.update('d2', 'p', 't2', payload).subscribe();
    httpMock.expectOne((r) => r.method === 'PUT' && r.url.endsWith('/work/task-drafts/d2')).flush({ id: 'd2', projectId: 'p', title: 't2', payloadJson: '{}', updatedAt: '' });
    service.remove('d2').subscribe();
    httpMock.expectOne((r) => r.method === 'DELETE' && r.url.endsWith('/work/task-drafts/d2')).flush(null);
  });
```
People API spec: `listDrafts({ mine: true })` sends `mine=true`; `cancelDraft('x')` sends `DELETE …/onboarding/drafts/x`.
`drafts.store.spec.ts` (stub `TaskDraftApiService`, `PeopleApiService`, `PermissionService`):
```ts
  it('merges task and employee drafts into labelled chips', async () => {
    taskApi.list.mockReturnValue(of([{ id: 't1', projectId: 'p1', title: '', updatedAt: '' }]));
    peopleApi.listDrafts.mockReturnValue(of({ items: [
      { id: 'e1', displayName: 'Jane Doe', status: 'draft' },
      { id: 'e2', displayName: ' ', status: 'waiting_for_seat' }
    ], totalCount: 2, page: 1, pageSize: 50 }));
    await store.load();
    expect(store.chips()).toEqual([
      { kind: 'task', id: 't1', label: 'Untitled task', badge: null, projectId: 'p1' },
      { kind: 'employee', id: 'e1', label: 'Jane Doe', badge: null, projectId: null },
      { kind: 'employee', id: 'e2', label: 'Untitled employee', badge: 'Waiting for seat', projectId: null }
    ]);
    expect(peopleApi.listDrafts).toHaveBeenCalledWith({ mine: true, page: 1, pageSize: 50 });
  });

  it('still shows task drafts when the onboarding list fails, and skips it without employees:read', async () => {
    taskApi.list.mockReturnValue(of([{ id: 't1', projectId: 'p1', title: 'A', updatedAt: '' }]));
    peopleApi.listDrafts.mockReturnValue(throwError(() => new Error('403')));
    await store.load();
    expect(store.chips().map((c) => c.id)).toEqual(['t1']);
    hasEmployeesRead = false;
    peopleApi.listDrafts.mockClear();
    await store.load();
    expect(peopleApi.listDrafts).not.toHaveBeenCalled();
  });

  it('removeChip deletes through the right API and drops the chip', async () => {
    // seed via load with t1 + e1
    await store.removeChip(store.chips()[0]);
    expect(taskApi.remove).toHaveBeenCalledWith('t1');
    await store.removeChip(store.chips()[0]);
    expect(peopleApi.cancelDraft).toHaveBeenCalledWith('e1');
    expect(store.chips()).toEqual([]);
  });
```

- [ ] **Step 2: Run** the specs → FAIL.

- [ ] **Step 3: Implement**
- `TaskDraftApiService`: `get`/`create`/`update` map the wire `{ payloadJson: string }` to `{ payload: JSON.parse(payloadJson) }` with `map()`.
- `PeopleApiService.cancelDraft`: `this.http.delete<void>(`${environment.apiUrl}/onboarding/drafts/${id}`)`; `DraftListParams` gains `mine?: boolean` (existing `toHttpParams` serialises booleans).
- `DraftsStore`:
```ts
export const DraftsStore = signalStore(
  { providedIn: 'root' },
  withState<{ chips: readonly DraftChip[] }>({ chips: [] }),
  withMethods((store, taskDrafts = inject(TaskDraftApiService), peopleApi = inject(PeopleApiService), permissions = inject(PermissionService)) => {
    let requestId = 0;
    const employeeBadge = (status: string) =>
      status === 'waiting_for_seat' ? 'Waiting for seat' : status === 'waiting_for_position_approval' ? 'Awaiting approval' : null;
    return {
      async load(): Promise<void> {
        const id = ++requestId;
        const [tasks, employees] = await Promise.allSettled([
          firstValueFrom(taskDrafts.list()),
          permissions.hasPermission('employees:read')
            ? firstValueFrom(peopleApi.listDrafts({ mine: true, page: 1, pageSize: 50 }))
            : Promise.resolve({ items: [] as DraftListItemResponse[] })
        ]);
        if (id !== requestId) return;
        const taskChips: DraftChip[] = tasks.status === 'fulfilled'
          ? tasks.value.map((d) => ({ kind: 'task', id: d.id, label: d.title.trim() || 'Untitled task', badge: null, projectId: d.projectId }))
          : [];
        const employeeChips: DraftChip[] = employees.status === 'fulfilled'
          ? employees.value.items.map((d) => ({ kind: 'employee', id: d.id, label: d.displayName.trim() || 'Untitled employee', badge: employeeBadge(d.status), projectId: null }))
          : [];
        patchState(store, { chips: [...taskChips, ...employeeChips] });
      },
      async removeChip(chip: DraftChip): Promise<boolean> {
        try {
          await firstValueFrom(chip.kind === 'task' ? taskDrafts.remove(chip.id) : peopleApi.cancelDraft(chip.id));
          patchState(store, { chips: store.chips().filter((c) => !(c.kind === chip.kind && c.id === chip.id)) });
          return true;
        } catch {
          return false;
        }
      }
    };
  })
);
```

- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(drafts): task draft API, onboarding cancel/mine, drafts store"` (stage only the listed files).

---

### Task 8: `<app-drafts-bar>` in the main layout

**Files:**
- Create: `layouts/main-layout/drafts-bar/drafts-bar.component.ts` (+ `.spec.ts`)
- Modify: `layouts/main-layout/main-layout.component.ts` + `.html`

**Interfaces:**
- Consumes: `DraftsStore` (`chips`, `load`, `removeChip`), `ConfirmModalComponent`, `Router`.
- Produces: selector `app-drafts-bar`; test ids `drafts-bar`, `draft-chip-<kind>-<id>`, `draft-chip-remove-<kind>-<id>`. Navigation: task chip → `router.navigate(['/work', chip.projectId, 'backlog'], { queryParams: { taskDraftId: chip.id } })`; employee chip → `router.navigate(['/people/employees'], { queryParams: { draftId: chip.id } })`. Sets `--bottom-tray-offset` on `document.documentElement` to `56px` while at least one chip exists, `0px` otherwise (and on destroy). Loads on init and on `window:focus`.

- [ ] **Step 1: Write failing tests**
```ts
describe('DraftsBarComponent', () => {
  // providers: DraftsStore stub { chips: signal<DraftChip[]>([]), load: vi.fn(async () => {}), removeChip: vi.fn(async () => true) }, Router stub { navigate: vi.fn() }
  it('renders nothing and zero offset when there are no drafts', () => {
    expect(el.querySelector('[data-testid="drafts-bar"]')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--bottom-tray-offset')).toBe('0px');
  });

  it('renders one chip per draft with badge, and reserves bottom space', () => {
    chips.set([{ kind: 'task', id: 't1', label: 'Fix login', badge: null, projectId: 'p1' },
               { kind: 'employee', id: 'e1', label: 'Jane', badge: 'Awaiting approval', projectId: null }]);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="draft-chip-task-t1"]')!.textContent).toContain('Fix login');
    expect(el.querySelector('[data-testid="draft-chip-employee-e1"]')!.textContent).toContain('Awaiting approval');
    expect(document.documentElement.style.getPropertyValue('--bottom-tray-offset')).toBe('56px');
  });

  it('opens the right screen for each kind', () => {
    // with the two chips above
    (el.querySelector('[data-testid="draft-chip-task-t1"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1', 'backlog'], { queryParams: { taskDraftId: 't1' } });
    (el.querySelector('[data-testid="draft-chip-employee-e1"]') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/people/employees'], { queryParams: { draftId: 'e1' } });
  });

  it('asks before deleting, then removes via the store', async () => {
    (el.querySelector('[data-testid="draft-chip-remove-task-t1"]') as HTMLElement).click();
    fixture.detectChanges();
    expect(store.removeChip).not.toHaveBeenCalled();
    (fixture.componentInstance as unknown as { confirmDelete: () => Promise<void> }).confirmDelete();
    expect(store.removeChip).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('reloads on window focus', () => {
    store.load.mockClear();
    window.dispatchEvent(new Event('focus'));
    expect(store.load).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run** → FAIL.

- [ ] **Step 3: Implement**
```ts
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ConfirmModalComponent } from '../../../shared/ui/confirm-modal/confirm-modal.component';
import { DraftChip, DraftsStore } from '../../../shared/state/drafts.store';

const BAR_OFFSET = '56px';

@Component({
  selector: 'app-drafts-bar',
  standalone: true,
  imports: [ConfirmModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (store.chips().length > 0) {
      <nav class="drafts-bar" data-testid="drafts-bar" aria-label="Your drafts">
        @for (chip of store.chips(); track chip.kind + chip.id) {
          <div class="drafts-bar__chip">
            <button type="button" class="drafts-bar__open" [attr.data-testid]="'draft-chip-' + chip.kind + '-' + chip.id"
              [title]="chip.label" (click)="open(chip)">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                @if (chip.kind === 'task') { <path d="M6 3h9l3 3v15H6zM9 12h6M9 16h6" /> }
                @else { <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" /> }
              </svg>
              <span class="drafts-bar__label">{{ chip.label }}</span>
              @if (chip.badge) { <span class="drafts-bar__badge">{{ chip.badge }}</span> }
            </button>
            <button type="button" class="drafts-bar__remove" [attr.data-testid]="'draft-chip-remove-' + chip.kind + '-' + chip.id"
              [attr.aria-label]="'Delete draft ' + chip.label" (click)="pendingDelete.set(chip)">✕</button>
          </div>
        }
      </nav>
    }
    <app-confirm-modal [open]="!!pendingDelete()" title="Delete draft?"
      [message]="'Delete the draft “' + (pendingDelete()?.label ?? '') + '”? This cannot be undone.'"
      confirmLabel="Delete" [loading]="deleting()" [errorMessage]="deleteError() ?? ''"
      (confirmed)="confirmDelete()" (cancelled)="pendingDelete.set(null)" />
  `,
  styles: [`
    .drafts-bar { position: fixed; left: 16px; right: 16px; bottom: 12px; z-index: 1050; display: flex; gap: 8px; overflow-x: auto; pointer-events: none; }
    .drafts-bar__chip { display: inline-flex; align-items: center; flex: 0 0 auto; max-width: 18rem; border: 1px solid var(--color-border); border-radius: 9px; background: var(--color-surface); box-shadow: 0 4px 14px rgb(0 0 0 / 10%); pointer-events: auto; }
    .drafts-bar__open { display: inline-flex; align-items: center; gap: 6px; min-width: 0; padding: 6px 4px 6px 10px; border: 0; background: none; color: var(--color-text-primary); font: inherit; font-size: 12px; cursor: pointer; }
    .drafts-bar__open svg { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .drafts-bar__label { overflow: hidden; max-width: 24ch; text-overflow: ellipsis; white-space: nowrap; }
    .drafts-bar__badge { padding: 1px 6px; border-radius: 6px; background: var(--color-surface-secondary); color: var(--color-text-secondary); font-size: 11px; white-space: nowrap; }
    .drafts-bar__remove { padding: 4px 8px; border: 0; background: none; color: var(--color-text-secondary); cursor: pointer; }
    .drafts-bar__remove:hover { color: var(--color-danger-text); }
    @media (max-width: 768px) { .drafts-bar { bottom: 84px; } }
  `]
})
export class DraftsBarComponent {
  protected readonly store = inject(DraftsStore);
  private readonly router = inject(Router);

  protected readonly pendingDelete = signal<DraftChip | null>(null);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  constructor() {
    void this.store.load();
    const root = document.documentElement;
    effect(() => root.style.setProperty('--bottom-tray-offset', this.store.chips().length > 0 ? BAR_OFFSET : '0px'));
    inject(DestroyRef).onDestroy(() => root.style.setProperty('--bottom-tray-offset', '0px'));
  }

  @HostListener('window:focus')
  protected onWindowFocus(): void {
    void this.store.load();
  }

  protected open(chip: DraftChip): void {
    if (chip.kind === 'task') {
      void this.router.navigate(['/work', chip.projectId, 'backlog'], { queryParams: { taskDraftId: chip.id } });
    } else {
      void this.router.navigate(['/people/employees'], { queryParams: { draftId: chip.id } });
    }
  }

  protected async confirmDelete(): Promise<void> {
    const chip = this.pendingDelete();
    if (!chip) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    const ok = await this.store.removeChip(chip);
    this.deleting.set(false);
    if (ok) this.pendingDelete.set(null);
    else this.deleteError.set('Could not delete the draft. Please try again.');
  }
}
```
(The bar is `pointer-events: none` except on chips so it never blocks clicks on page content behind the gaps; z-index 1050 sits above the mobile nav (1000) and below the bulk bar (1100) and modals (1200). The mobile `bottom: 84px` places it above the mobile bottom nav — adjust in the browser check if the nav is taller.)
Main layout: import `DraftsBarComponent`; add `<app-drafts-bar />` directly after `<app-mobile-bottom-nav />`. Also make `<main>`'s bottom padding include the offset so the last content isn't hidden: in `main-layout.component.css` add `.main-content { padding-bottom: calc(var(--existing-padding, 0px) + var(--bottom-tray-offset, 0px)); }` — read the existing `.main-content` rule first and append `+ var(--bottom-tray-offset, 0px)` to its existing bottom padding instead of replacing it.

- [ ] **Step 4: Run** the spec + `layouts/main-layout/*.spec.ts` (stub `app-drafts-bar` there like the other children) → pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(drafts): app-wide drafts bar"` (stage only your hunks in main-layout files).

---

### Task 9: Task create modal — guard, Save draft, resume, delete-after-create

**Files:**
- Modify: `modules/work/ui/task-form-modal/task-form-modal.component.ts` (3443 lines — edit surgically; anchors below)
- Modify: `modules/work/ui/task-form-modal/task-form-modal.component.spec.ts`
- Modify: `modules/work/feature/task-backlog/task-backlog.component.ts` (+ spec) — `?taskDraftId=`

**Interfaces:**
- Consumes: Task 6 `UnsavedChangesService`/`DirtyFormHandle`; Task 7 `TaskDraftApiService`, `TaskDraftPayload`, `DraftsStore.load()`.
- Produces on `app-task-form-modal`: new input `draftId = input<string>('')` (create mode only). Behaviour:
  - While open in create mode the modal registers a `DirtyFormHandle`. Dirty = current `buildDraftPayload()` + title differs from the baseline captured after the form finished loading (after `loadCreateContext()`, and after draft hydration when `draftId` is set) — so prefills and an unchanged resumed draft are **not** dirty.
  - `onBackdrop` / `onEscape` / `onCancel` (when no popover is open) call `attemptClose()`: `if (await unsaved.requestClose(handle)) closed.emit()`. A clean close still runs `cleanupUnsavedAttachments()`.
  - Handle `saveDraft()` → `create` (no active draft) or `update` (active draft) with `{ projectId, title, payload }`; sets `activeDraftId`; re-baselines; `draftsStore.load()`; returns true/false (never throws).
  - Handle `discard()` → `cleanupUnsavedAttachments()` limited to files **not** in the active draft's saved payload.
  - A successful create (any `submitCreateWithAction` success branch, including the approval-request branch) deletes the active draft (`taskDraftApi.remove`, errors ignored) and calls `draftsStore.load()`.
  - `resetForm()` also clears `activeDraftId`, `savedDraftAttachmentIds` and the baseline.
  - Backlog: reads `taskDraftId` from the query params; when present, opens the create modal with `[draftId]` bound; on close clears the param (`router.navigate([], { queryParams: { taskDraftId: null }, queryParamsHandling: 'merge', replaceUrl: true })`).

- [ ] **Step 1: Write failing tests** (in the modal spec, using its existing create-mode setup; provide `TaskDraftApiService` stub `{ get: vi.fn(), create: vi.fn(() => of({ id: 'd1', ... })), update: vi.fn(() => of({...})), remove: vi.fn(() => of(undefined)) }`, a `DraftsStore` stub `{ load: vi.fn() }`, and the real `UnsavedChangesService`):
```ts
  it('closing an untouched create form closes immediately (prefills are not "changes")', async () => {
    // open in create mode with prefillModuleId; await context load
    component.onCancel();
    await fixture.whenStable();
    expect(closedSpy).toHaveBeenCalled();
    expect(TestBed.inject(UnsavedChangesService).prompt()).toBeNull();
  });

  it('closing after typing asks; Save draft creates the draft, refreshes the bar and closes', async () => {
    component.title.set('Fix login');
    component.onCancel();
    const unsaved = TestBed.inject(UnsavedChangesService);
    expect(unsaved.prompt()?.canSaveDraft).toBe(true);
    unsaved.choose('save');
    await fixture.whenStable();
    expect(taskDraftApi.create).toHaveBeenCalledWith('project-1', 'Fix login', expect.objectContaining({ version: 1 }));
    expect(draftsStore.load).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('Discard deletes pending attachments that are not part of a saved draft', async () => {
    component.attachedFiles.set([{ fileId: 'f-new', name: 'a.png', sizeBytes: 1 }]);
    component.onCancel();
    TestBed.inject(UnsavedChangesService).choose('discard');
    await fixture.whenStable();
    expect(taskApi.deletePendingFile).toHaveBeenCalledWith('f-new');
  });

  it('opening with draftId hydrates the form and is not dirty until edited', async () => {
    taskDraftApi.get.mockReturnValue(of({ id: 'd1', projectId: 'project-1', title: 'Saved title', updatedAt: '',
      payload: { version: 1, description: '<p>hi</p>', objectiveId: 'milestone-1', sprintId: '', categoryId: 'cat-1', statusId: '',
        priority: 'high', dueDate: '2026-10-01', estimatedHours: 3, storyPoints: null, assigneeEmployeeId: '',
        subtasks: [{ id: 's1', title: 'Sub' }], attachments: [{ fileId: 'f1', name: 'x.pdf', sizeBytes: 10 }], attachmentFileIds: ['f1'] } }));
    fixture.componentRef.setInput('draftId', 'd1');
    // open + await load
    expect(component.title()).toBe('Saved title');
    expect(component.priority()).toBe('high');
    expect(component.draftSubtasks().map((s) => s.title)).toEqual(['Sub']);
    expect(component.attachedFiles().map((f) => f.fileId)).toEqual(['f1']);
    component.onCancel();
    expect(closedSpy).toHaveBeenCalled();            // unchanged resumed draft closes without prompting
    expect(taskApi.deletePendingFile).not.toHaveBeenCalledWith('f1');
  });

  it('saving again from a resumed draft updates instead of creating', async () => {
    // hydrate d1 as above, then component.title.set('Changed'); component.onCancel(); unsaved.choose('save')
    expect(taskDraftApi.update).toHaveBeenCalledWith('d1', 'project-1', 'Changed', expect.anything());
    expect(taskDraftApi.create).not.toHaveBeenCalled();
  });

  it('creating the task deletes the draft it came from', async () => {
    // hydrate d1, then run the existing successful-create path (submitCreateWithAction('create_and_close'))
    expect(taskDraftApi.remove).toHaveBeenCalledWith('d1');
    expect(draftsStore.load).toHaveBeenCalled();
  });
```
Backlog spec:
```ts
  it('opens the create modal hydrated from ?taskDraftId and clears the param on close', async () => {
    // setup with route queryParamMap { taskDraftId: 'd1' }
    const modal = fixture.debugElement.query(By.directive(TaskFormModalComponent)).componentInstance as TaskFormModalComponent;
    expect(modal.open()).toBe(true);
    expect(modal.mode()).toBe('create');
    expect(modal.draftId()).toBe('d1');
    modal.closed.emit();
    expect(router.navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { taskDraftId: null }, replaceUrl: true }));
  });
```
Write the elided arrange lines with the specs' existing helpers.

- [ ] **Step 2: Run** both specs → FAIL.

- [ ] **Step 3: Implement** in the modal:
1. Inject `UnsavedChangesService`, `TaskDraftApiService`, `DraftsStore`; add `readonly draftId = input<string>('');`, `private readonly activeDraftId = signal<string | null>(null);`, `private savedDraftAttachmentIds = new Set<string>();`, `private baseline: string | null = null;`, `private unregisterGuard: (() => void) | null = null;`.
2. Snapshot helpers:
```ts
  private buildDraftPayload(): TaskDraftPayload {
    return {
      version: 1,
      description: this.description(),
      objectiveId: this.selectedObjectiveId(), sprintId: this.sprintId(), categoryId: this.categoryId(), statusId: this.statusId(),
      priority: this.priority(), dueDate: this.dueDate(), estimatedHours: this.estimatedHours(), storyPoints: this.storyPoints(),
      assigneeEmployeeId: this.assigneeEmployeeId(),
      subtasks: this.draftSubtasks(),
      attachments: this.attachedFiles().filter((f) => !f.uploading).map(({ fileId, name, sizeBytes }) => ({ fileId, name, sizeBytes })),
      attachmentFileIds: this.attachedFiles().filter((f) => !f.uploading).map((f) => f.fileId)
    };
  }
  private snapshot(): string { return JSON.stringify([this.title().trim(), this.buildDraftPayload()]); }
  private markClean(): void { this.baseline = this.snapshot(); }
  private readonly guardHandle: DirtyFormHandle = {
    isDirty: () => this.currentEffectiveMode() === 'create' && this.baseline !== null && this.snapshot() !== this.baseline,
    canSaveDraft: () => this.currentEffectiveMode() === 'create',
    saveDraft: () => this.saveAsDraft(),
    discard: () => this.cleanupUnsavedAttachments()
  };
```
3. Register while open in create mode — add to the constructor (next to the existing open/reset effect):
```ts
    effect(() => {
      const shouldGuard = this.open() && this.mode() === 'create';
      untracked(() => {
        if (shouldGuard && !this.unregisterGuard) this.unregisterGuard = this.unsaved.register(this.guardHandle);
        if (!shouldGuard && this.unregisterGuard) { this.unregisterGuard(); this.unregisterGuard = null; }
      });
    });
    inject(DestroyRef).onDestroy(() => this.unregisterGuard?.());
```
4. Include `draftId()` in the open-effect key (`${this.mode()}:${effectiveId}:${this.draftId()}:${isOpen}`) so a different draft reloads.
5. At the end of `loadCreateContext()` (after prefills are applied):
```ts
    const draftId = this.draftId();
    if (draftId) {
      try {
        const draft = await firstValueFrom(this.taskDraftApi.get(draftId));
        this.applyDraft(draft);
      } catch {
        this.errorMessage.set('This draft could not be loaded. It may have been deleted.');
      }
    }
    this.markClean();
```
with
```ts
  private applyDraft(draft: TaskDraft): void {
    const p = draft.payload;
    this.activeDraftId.set(draft.id);
    this.title.set(draft.title);
    this.description.set(p.description ?? '');
    this.descRte()?.setHtml(p.description ?? '');
    if (p.objectiveId) this.selectedObjectiveId.set(p.objectiveId);
    this.sprintId.set(p.sprintId ?? '');
    if (p.categoryId) this.categoryId.set(p.categoryId);
    this.statusId.set(p.statusId ?? '');
    this.priority.set(p.priority ?? null);
    this.dueDate.set(p.dueDate ?? '');
    this.estimatedHours.set(p.estimatedHours ?? null);
    this.storyPoints.set(p.storyPoints ?? null);
    this.assigneeEmployeeId.set(p.assigneeEmployeeId ?? '');
    this.draftSubtasks.set([...(p.subtasks ?? [])]);
    this.attachedFiles.set((p.attachments ?? []).map((a) => ({ ...a })));
    this.savedDraftAttachmentIds = new Set(p.attachmentFileIds ?? []);
  }
```
(`descRte()?.setHtml` emits `htmlChange`, which also sets `description` — harmless. If the editor isn't rendered yet when this runs, `initialHtml` binding picks the value up because `description` was set first.)
6. Draft save:
```ts
  private async saveAsDraft(): Promise<boolean> {
    const payload = this.buildDraftPayload();
    const title = this.title().trim();
    try {
      const id = this.activeDraftId();
      const saved = await firstValueFrom(id
        ? this.taskDraftApi.update(id, this.projectId(), title, payload)
        : this.taskDraftApi.create(this.projectId(), title, payload));
      this.activeDraftId.set(saved.id);
      this.savedDraftAttachmentIds = new Set(payload.attachmentFileIds);
      this.markClean();
      void this.draftsStore.load();
      return true;
    } catch {
      return false;
    }
  }
```
7. `cleanupUnsavedAttachments()` — skip ids in `savedDraftAttachmentIds`:
```ts
    for (const file of this.attachedFiles()) {
      if (this.savedDraftAttachmentIds.has(file.fileId)) continue;
      firstValueFrom(this.taskApi.deletePendingFile(file.fileId)).catch(() => {});
    }
```
8. Close paths: in `onBackdrop()` / `onEscape()` replace the `else { this.cleanupUnsavedAttachments(); this.closed.emit(); }` branch with `else { void this.attemptClose(); }`; `onCancel()` becomes `void this.attemptClose();`; add
```ts
  private async attemptClose(): Promise<void> {
    const dirty = this.guardHandle.isDirty();
    if (!(await this.unsaved.requestClose(this.guardHandle))) return;
    if (!dirty) this.cleanupUnsavedAttachments();   // dirty paths already ran discard() or saved the files into a draft
    this.closed.emit();
  }
```
9. After every successful create branch in `submitCreateWithAction` (both the direct create and the creation-request path), before emitting/closing:
```ts
    const finishedDraftId = this.activeDraftId();
    if (finishedDraftId) {
      this.activeDraftId.set(null);
      this.savedDraftAttachmentIds = new Set();
      firstValueFrom(this.taskDraftApi.remove(finishedDraftId)).catch(() => {}).finally(() => void this.draftsStore.load());
    }
```
and call `this.markClean()` after the `create_and_add_another` reset so the fresh form isn't dirty.
10. `resetForm()`: add `this.activeDraftId.set(null); this.savedDraftAttachmentIds = new Set(); this.baseline = null;`.

Backlog: add `protected readonly taskModalDraftId = signal('');`; in the existing `route.queryParamMap` handling (or a new `takeUntilDestroyed` subscription) — when `taskDraftId` is present: `taskModalMode.set('create'); taskModalTaskId.set(''); taskModalDraftId.set(id); taskModalOpen.set(true);`. Bind `[draftId]="taskModalDraftId()"` on `<app-task-form-modal>`. In `closeTaskModal()`: if `taskModalDraftId()` → clear it and navigate the param away as specified. `openCreateTask()` must reset `taskModalDraftId` to `''`.

- [ ] **Step 4: Run** modal spec, backlog spec, board spec (`modules/work/feature/task-board/task-board.component.spec.ts` — its modal stub may need the new `draftId` input), milestone-tree spec → pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(work): task create modal saves/resumes drafts behind the unsaved-changes guard"`

---

### Task 10: Add-employee wizard partial drafts + guard; remove the Onboarding Drafts tab

**Files:**
- Modify: `modules/people/state/add-employee-wizard.store.ts` (`saveDraft` ~769-852) (+ spec)
- Modify: `modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts` + `.html` (+ spec)
- Modify: `modules/people/models/onboarding-draft.model.ts` (`SaveOnboardingDraftPayload`: `firstName/lastName/workEmail/employmentType: string | null`, `startDate: string | null`)
- Modify: `modules/people/feature/employee-list/employee-list.component.ts` + `.html` + `.spec.ts`
- Modify: `modules/people/state/people.store.ts` (+ spec) — remove the drafts slice
- Delete: `modules/people/ui/draft-table/` (component + spec) — only used by the employee list (verify with grep first)

**Interfaces:**
- Consumes: Task 6 service/handle; Task 7 `DraftsStore.load()`.
- Produces: `store.saveDraft(step: WizardStep, options: { partial?: boolean } = {})`. With `partial: true` it skips the work-mode, position, checklist and reports-to pre-checks; `editedTasksJson` is sent only when a template is selected, loaded and its tasks validate (else null); blank strings go out as `null`. The only client-side requirement for a partial save is a selected company: message `Select a company before saving a draft.` Finalize keeps every existing check (it calls `saveDraft(step)` without `partial`).
  The **Save draft** button uses `partial: true`. The wizard registers a `DirtyFormHandle` (dirty = `form.dirty` or company/department/position/template/reports-to changed since open/resume; `canSaveDraft` = a company is selected; `saveDraft` = partial save + `draftsStore.load()`; `discard` = no-op). `onCancel()` (Escape, ✕, Cancel, backdrop) → `if (await unsaved.requestClose(handle)) { closed.emit(); router.navigate(['/people/employees']); }`.
  Employee list: no tabs; drafts load removed; `onEmployeeSaved` → `closeAddEmployeeModal(); loadEmployees(); draftsStore.load();`. `?draftId=` / `?addEmployee=true` handling stays.

- [ ] **Step 1: Write failing tests**
Store spec:
```ts
  it('partial save sends only what is filled and skips the full-form pre-checks', async () => {
    // arrange: companyId set; formValue with firstName 'Jane', everything else blank; no workModeId, no position
    const response = await store.saveDraft('employee_details', { partial: true });
    expect(response).not.toBeNull();
    const [payload] = peopleApi.saveDraft.mock.calls[0];
    expect(payload).toEqual(expect.objectContaining({ firstName: 'Jane', lastName: null, workEmail: null, employmentType: null, startDate: null, workModeId: null, editedTasksJson: null }));
  });

  it('non-partial save still requires a work mode', async () => {
    // same arrange
    expect(await store.saveDraft('employee_details')).toBeNull();
    expect(store.saveError()).toBe('Work mode is required.');
  });
```
Wizard spec:
```ts
  it('Save draft works with only a company and a first name', async () => {
    // select company, type first name; click the Save draft button
    expect(peopleStoreSaveSpy).toHaveBeenCalledWith(expect.any(String), { partial: true });
  });

  it('Save draft without a company shows a message and does not call the API', async () => {
    // click Save draft on a fresh wizard
    expect(peopleApi.saveDraft).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Select a company before saving a draft.');
  });

  it('closing with changes asks through the guard; Keep editing keeps it open', async () => {
    // type a first name; press Escape on the dialog element
    const unsaved = TestBed.inject(UnsavedChangesService);
    expect(unsaved.prompt()).not.toBeNull();
    unsaved.choose('keep');
    await fixture.whenStable();
    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('closing an untouched wizard closes immediately', async () => {
    component.onCancel();
    await fixture.whenStable();
    expect(closedSpy).toHaveBeenCalled();
  });
```
Employee list spec: delete `'excludes finalized and invitation-sent drafts from the Onboarding Drafts count and table'` and every `/onboarding/drafts` flush/expectation (the list no longer requests drafts — the drafts bar does, and it's not on this page); add:
```ts
  it('has no Onboarding Drafts tab', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Onboarding Drafts');
  });

  it('saving from the wizard refreshes the drafts bar', () => {
    component.onEmployeeSaved({ finalized: false, draftId: 'd1' });
    expect(draftsStore.load).toHaveBeenCalled();
  });
```
(Provide a `DraftsStore` stub `{ load: vi.fn() }`.)

- [ ] **Step 2: Run** the four specs → FAIL.

- [ ] **Step 3: Implement**
Store `saveDraft(lastSavedStep, { partial = false } = {})`:
- Wrap the work-mode check, the position-issue block and the reports-to check in `if (!partial) { ... }`.
- For the checklist block: when `partial`, compute `editedTasksJson` only if `selectedTemplateId && !store.loadingSelectedTemplateDetail() && store.draftTasksSourceTemplateId() === selectedTemplateId && validateDraftTasks(store.draftTasks()).length === 0`, otherwise leave it `null` (no error); when not partial keep the existing behaviour.
- In `payload` map blanks to null: `firstName: form.firstName.trim() || null`, same for `lastName`, `workEmail`, `employmentType`; `startDate: form.startDate || null`; `workModeId: form.workModeId || null`.
- Before building the payload: `if (!store.companyId()) { patchState(store, { saveError: 'Select a company before saving a draft.' }); return null; }`.
Wizard component:
- `onSaveDraft()`: drop the `submitAttempted`/form/position/reports-to/employee-number gates; call `this.store.saveDraft(this.store.step(), { partial: true })`; on success also `void this.draftsStore.load()` and `this.markClean()`; on failure show `store.saveError()` (the message is displayed via the existing notification error path).
- Guard: inject `UnsavedChangesService`, `DraftsStore`, `DestroyRef`. Baseline = `JSON.stringify([this.form.getRawValue(), store.companyId(), store.departmentId(), store.positionId(), store.selectedTemplateId(), store.selectedReportsToEmployeeId()])` captured after init and after `resumeExistingDraft` completes (`markClean()`). Register in `ngOnInit`/constructor, unregister on destroy.
- `onCancel()`:
```ts
  async onCancel(): Promise<void> {
    if (!(await this.unsaved.requestClose(this.guardHandle))) return;
    this.closed.emit();
    void this.router.navigate(['/people/employees']);
  }
```
  (template bindings `(keydown.escape)="onCancel()"` etc. keep working with a Promise-returning method.)
- `onFinalize()` unchanged except: after the successful branches, call `void this.draftsStore.load()` (finalized drafts leave the bar).
Employee list: remove `activeTab`, `setTab`, the segmented-tabs markup (keep the Employees count badge next to the title if it was inside the tab — render it as plain text), the drafts section, `loadDrafts()` and its calls, `onContinueDraft`, the `DraftTableComponent` import; inject `DraftsStore`; update `onEmployeeSaved`.
PeopleStore: delete the `drafts*` state, `actionableDrafts`, `loadDrafts` and their spec cases (grep the codebase first: nothing else may use them).
Delete `modules/people/ui/draft-table/` if grep shows no other usage; `isTerminalDraft` stays only if something still imports it (else delete it and its spec too).

- [ ] **Step 4: Run** the four specs + `npx ng test --watch=false --include=src/app/modules/people/**/*.spec.ts` → pass.
- [ ] **Step 5: Commit** — `git commit -m "feat(people): partial onboarding drafts behind the unsaved-changes guard; drafts leave the employee list for the drafts bar"` (stage only your hunks in employee-list files if another session has edits there).

---

### Task 11: Route guards + full verification

**Files:**
- Modify: `modules/people/people.routes.ts` (the `employees` route) and `modules/work/work.routes.ts` (children `board`, `backlog`, `milestones/:milestoneId/tree`)
- Test: `modules/people/people.routes.spec.ts` / `modules/work/work.routes.spec.ts` (create if absent)

- [ ] **Step 1: Write failing test**
```ts
import { unsavedChangesGuard } from '../../shared/guards/unsaved-changes.guard';
import { PEOPLE_ROUTES } from './people.routes';

it('the employee list route is protected by the unsaved-changes guard', () => {
  const employees = PEOPLE_ROUTES.flatMap((r) => [r, ...(r.children ?? [])]).find((r) => r.path === 'employees');
  expect(employees?.canDeactivate).toContain(unsavedChangesGuard);
});
```
and the same shape for `board`, `backlog`, `milestones/:milestoneId/tree` in `WORK_ROUTES` (search children of the `:id` route).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — add `canDeactivate: [unsavedChangesGuard]` to those four route objects (merge with any existing `canDeactivate` array).
- [ ] **Step 4: Run** → pass. Then `npx ng test --watch=false` and `npx ng build`; paste raw summaries (pre-existing failures reported, not fixed).
- [ ] **Step 5: Browser check** (backend with Part 1 migrations applied; if the sandboxed pane blocks `*.onexso.com`, use Claude in Chrome or ask the user):
  1. Backlog → Add Task → type a title → ✕ → "Save draft?" → **Save draft** → modal closes; a chip "Fix login" appears bottom-left; the bulk bar (select a task) floats above it.
  2. Click the chip from another page (e.g. Home) → lands on that project's Backlog with the modal filled in (title, description, priority, subtasks, attachment).
  3. Close it untouched → closes without asking. Reopen, create the task → chip disappears.
  4. Add Employee → pick company + first name only → **Save draft** → chip "Jane"; reopen from chip; Finalize with missing fields shows the finalize errors.
  5. With an unsaved task form open, click a sidebar link → dialog; **Keep editing** stays; **Discard** navigates.
  6. With a dirty form, reload the tab → browser "Leave site?" prompt.
  7. Chip ✕ → confirm → chip gone (task draft's pending attachment is deleted server-side).
  8. Employee list has no Onboarding Drafts tab. Calendar event modal still asks "Discard changes?" via the new dialog.
  9. 375px width: chips sit above the mobile bottom nav and scroll horizontally.
  Screenshot steps 1, 2 and 5.
- [ ] **Step 6: Commit** — `git commit -m "feat: guard task and employee routes against unsaved changes"`; record any spec divergence in the spec file and commit docs.
