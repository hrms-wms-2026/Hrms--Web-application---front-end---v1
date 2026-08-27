> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Work Management Approvals write path: allow an owner to create an allocation-extension request from the Approvals page, finish the existing “Request more allocation for my objective” action, and allow an approver to edit the granted additional hours before approving an allocation request. The edited amount must be sent through the existing API and applied by the backend approval handler.

**Architecture:** The existing `WorkApprovalsStore` remains the single state/action boundary for the Approvals page. `WorkApprovalsApiService` gains a create-allocation-request method and a body-carrying allocation-approval method. `WorkApprovalsComponent` owns the create-request modal state and loads the caller's project modules through the existing `ProjectApiService.getMyMilestones(projectId)` endpoint. `ApprovalRequestRowComponent` owns only the local editable hours field and emits the edited amount with its approval event; the page/store performs the API call. On the backend, the Work Management approve endpoint accepts an optional approved additional-hours value, passes it into `ApproveObjectiveChangeRequestCommand`, and the handler uses it only for `ExtendAllocation`; all other request types remain unchanged. The approved amount is validated as positive and checked against the approver's available slack.

**Tech Stack:** Angular standalone components, signal inputs/outputs, RxJS `firstValueFrom`, existing `ModalComponent`/`InputComponent`/`ButtonComponent`/`SelectComponent`, Angular HttpClient, C#/.NET, MediatR, EF Core, xUnit, Moq, and the repository's existing Work Management integration-test patterns.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B2 and §3. The user explicitly resolved the design ambiguity on 2026-08-27: **an approver may edit the granted hours before approving**. Therefore this Part is authorized to modify the Work Management backend command, handler, API request contract, and their Work Management tests in addition to the frontend files.

## Global Constraints

- Work only in Work Management paths: frontend `src/app/modules/work/**`, authorized shared UI imports only, frontend `docs/superpowers/**`; backend Work Management application/API contract/controller/test paths needed for this Work Management endpoint; and this plan file. Do not touch Organization, CoreHR, admin/platform, public, layouts, unrelated shared UI, CI, pipelines, migrations, or build-infrastructure files.
- Do not add a database migration. The approved amount is request-time input and does not require a schema change; the persisted objective allocation remains the only stored result.
- Preserve existing behavior for task-creation, objective-change, invitation, and non-allocation approval/rejection rows. Only allocation approval sends a non-empty body; all other approval calls remain compatible.
- Keep allocation-extension requests owner/effective-manager-only, keep root-objective rejection, duplicate-pending protection, and reporting-manager routing unchanged.
- Treat requested additional hours as the default approved amount when the approval body omits it. Reject zero or negative approved amounts with a clear client error and do not mutate the objective or request.
- Recalculate the approver slack check against the approved amount, not the originally requested amount. A positive approved amount greater than the available slack must return the existing conflict response and leave the request pending.
- Run the relevant frontend and backend tests before every commit. Do not run a frontend dev server or `dotnet run`; never kill an existing Node/ng/dotnet process; never push or merge.

---

### Task 1: Add backend support for an optional approved allocation amount

**Files:**
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/WorkManagement/ObjectiveChangeRequests/Commands/ApproveObjectiveChangeRequest/ApproveObjectiveChangeRequestCommand.cs`
- Modify: `HRMS-Backend-v1/src/ONEVO.Application/Features/WorkManagement/ObjectiveChangeRequests/Commands/ApproveObjectiveChangeRequest/ApproveObjectiveChangeRequestCommandHandler.cs`
- Modify: `HRMS-Backend-v1/src/ONEVO.Api/Contracts/WorkManagement/Objectives/ApproveObjectiveChangeRequestRequest.cs` (verify the current contract name/path before editing; add it only if this endpoint currently has no body contract)
- Modify: `HRMS-Backend-v1/src/ONEVO.Api/Controllers/Tenant/WorkManagement/ObjectivesController.cs`
- Modify: `HRMS-Backend-v1/tests/ONEVO.Tests.Unit/Features/WorkManagement/ApproveObjectiveChangeRequestCommandHandlerTests.cs`
- Modify: `HRMS-Backend-v1/tests/ONEVO.Tests.Unit/Features/WorkManagement/ApproveObjectiveChangeRequestCommandHandlerIntegrationTests.cs`

**Interfaces:**
- `ApproveObjectiveChangeRequestCommand(Guid RequestId, decimal? ApprovedAdditionalHours = null)` remains source-compatible for all existing call sites.
- The Work Management controller accepts `[FromBody] ApproveObjectiveChangeRequestRequest? request` and sends `request?.ApprovedAdditionalHours` to the command. An omitted or empty body maps to `null`.
- The handler uses `request.ApprovedAdditionalHours ?? extendPayload.RequestedAdditionalHours` only in the `ExtendAllocation` branch.

- [ ] **Step 1: Write failing unit and integration coverage.**

Extend the existing `ExtendAllocationRequest` test helper and add these concrete unit tests to `ApproveObjectiveChangeRequestCommandHandlerTests.cs`:

```csharp
[Fact]
public async Task Handle_ExtendAllocation_UsesApproverEditedAmountWhenProvided()
{
    var childObjective = ChildObjective(60m);
    var approverObjective = ApproverObjective(100m);
    var (handler, objectives) = BuildWithSlack(
        changeRequest: ExtendAllocationRequest(childObjective.Id, requestedAdditionalHours: 20m),
        childObjective, approverObjective, approverSlack: 40m);

    var result = await handler.Handle(
        new ApproveObjectiveChangeRequestCommand(RequestId, ApprovedAdditionalHours: 12m),
        CancellationToken.None);

    Assert.True(result.IsSuccess);
    objectives.Verify(x => x.Update(It.Is<Objective>(o => o.Id == childObjective.Id && o.AllocatedHours == 72m)), Times.Once);
}

[Fact]
public async Task Handle_ExtendAllocation_ApprovedAmountExceedingSlackReturnsConflict()
{
    var childObjective = ChildObjective(60m);
    var approverObjective = ApproverObjective(100m);
    var (handler, objectives) = BuildWithSlack(
        changeRequest: ExtendAllocationRequest(childObjective.Id, requestedAdditionalHours: 10m),
        childObjective, approverObjective, approverSlack: 20m);

    var result = await handler.Handle(
        new ApproveObjectiveChangeRequestCommand(RequestId, ApprovedAdditionalHours: 21m),
        CancellationToken.None);

    Assert.False(result.IsSuccess);
    Assert.Equal(409, result.StatusCode);
    objectives.Verify(x => x.Update(It.IsAny<Objective>()), Times.Never);
}

[Fact]
public async Task Handle_ExtendAllocation_NonPositiveApprovedAmountReturnsFailure()
{
    var childObjective = ChildObjective(60m);
    var approverObjective = ApproverObjective(100m);
    var (handler, objectives) = BuildWithSlack(
        changeRequest: ExtendAllocationRequest(childObjective.Id, requestedAdditionalHours: 10m),
        childObjective, approverObjective, approverSlack: 20m);

    var result = await handler.Handle(
        new ApproveObjectiveChangeRequestCommand(RequestId, ApprovedAdditionalHours: 0m),
        CancellationToken.None);

    Assert.False(result.IsSuccess);
    Assert.Equal(400, result.StatusCode);
    objectives.Verify(x => x.Update(It.IsAny<Objective>()), Times.Never);
}
```

Keep the existing test proving that omitted approved hours use the requested amount. Extend the real-DbContext integration scenario with an approval command carrying a smaller edited amount and assert the child objective's persisted `AllocatedHours` increases by the edited amount, while the request becomes approved. Use the integration test's existing seed/reset helpers; do not create a new database or migration.

- [ ] **Step 2: Run the targeted backend tests and confirm red.**

Run:

```bash
cd HRMS-Backend-v1
dotnet test tests/ONEVO.Tests.Unit --no-restore --filter FullyQualifiedName~ApproveObjectiveChangeRequestCommandHandlerTests
dotnet test tests/ONEVO.Tests.Unit --no-restore --filter FullyQualifiedName~ApproveObjectiveChangeRequestCommandHandlerIntegrationTests
```

Expected red result: the command does not yet accept `ApprovedAdditionalHours`, and the controller/body contract is not yet wired. A compile failure is the intended red step.

- [ ] **Step 3: Implement the optional request body and command field.**

Add the nullable property to the command:

```csharp
public sealed record ApproveObjectiveChangeRequestCommand(
    Guid RequestId,
    decimal? ApprovedAdditionalHours = null
) : IRequest<Result>;
```

Verify the current API contract namespace and add or modify the Work Management request record as:

```csharp
namespace ONEVO.Api.Contracts.WorkManagement.Objectives;

public sealed record ApproveObjectiveChangeRequestRequest(decimal? ApprovedAdditionalHours);
```

Update only the Work Management controller action:

```csharp
public async Task<IActionResult> ApproveChangeRequest(
    Guid requestId,
    [FromBody] ApproveObjectiveChangeRequestRequest? request,
    CancellationToken ct)
{
    var result = await _mediator.Send(
        new ApproveObjectiveChangeRequestCommand(requestId, request?.ApprovedAdditionalHours), ct);

    return result.IsSuccess
        ? NoContent()
        : Problem(result.Error, statusCode: result.StatusCode ?? 400);
}
```

Retain the same route, permission, response codes, and behavior for all non-allocation requests. If the current controller action has a framework-specific empty-body binding convention, follow an existing Work Management endpoint pattern rather than adding custom JSON parsing.

- [ ] **Step 4: Use the edited amount in the handler with validation and slack checking.**

In the existing `ExtendAllocation` branch, deserialize the payload first, resolve `approvedAdditionalHours` from the command or payload, then validate before the slack check:

```csharp
var approvedAdditionalHours = request.ApprovedAdditionalHours
    ?? extendPayload.RequestedAdditionalHours;

if (approvedAdditionalHours <= 0m)
    return Result.Failure("Approved additional hours must be greater than zero.", 400);

var approverSlack = await _slack.CalculateAsync(tenantId, approverOwnObjective, ct: innerCt);
if (approvedAdditionalHours > approverSlack)
    return Result.Conflict(
        "You don't have enough allocation yourself to approve this. Request more from your own reporting manager first, then return to approve this request.");

objective.AllocatedHours += approvedAdditionalHours;
```

Do not change the notification decision or request status flow. The existing notification may continue to describe the allocation approval without adding new template keys; avoid touching notification infrastructure outside Work Management.

- [ ] **Step 5: Run the targeted backend tests and verify green.**

Run both commands from Step 2. Expected result: all existing approval tests, the edited-hours unit tests, and the integration coverage pass. If a build-lock error mentions `ONEVO.Api`, add `-p:BuildProjectReferences=false`; never kill the running process.

- [ ] **Step 6: Commit the backend B2 contract change.**

```bash
git add src/ONEVO.Application/Features/WorkManagement/ObjectiveChangeRequests/Commands/ApproveObjectiveChangeRequest/ApproveObjectiveChangeRequestCommand.cs src/ONEVO.Application/Features/WorkManagement/ObjectiveChangeRequests/Commands/ApproveObjectiveChangeRequest/ApproveObjectiveChangeRequestCommandHandler.cs src/ONEVO.Api/Contracts/WorkManagement/Objectives/ApproveObjectiveChangeRequestRequest.cs src/ONEVO.Api/Controllers/Tenant/WorkManagement/ObjectivesController.cs tests/ONEVO.Tests.Unit/Features/WorkManagement/ApproveObjectiveChangeRequestCommandHandlerTests.cs tests/ONEVO.Tests.Unit/Features/WorkManagement/ApproveObjectiveChangeRequestCommandHandlerIntegrationTests.cs
git commit -m "feat(work): allow approvers to edit granted allocation hours"
```

If the contract file is not needed because an existing Work Management request record already serves this endpoint, stage that existing contract instead and record the actual path in the final report.

---

### Task 2: Extend the frontend approval API, DTOs, mapper, and store

**Files:**
- Modify: `src/app/modules/work/data-access/work-approvals-api.service.ts`
- Modify: `src/app/modules/work/models/dto/allocation-request.dto.ts`
- Modify: `src/app/modules/work/models/approval.model.ts` only if a typed allocation payload is required by the row component
- Modify: `src/app/modules/work/utils/approval.mapper.ts`
- Modify: `src/app/modules/work/state/work-approvals.store.ts`
- Modify: `src/app/modules/work/state/work-approvals.store.spec.ts`

**Interfaces:**
- `createAllocationRequest(objectiveId: string, payload: { requestedAdditionalHours: number; reason: string }): Observable<unknown>` posts to `${workBase}/objectives/${objectiveId}/allocation-requests`.
- `approveAllocationRequest(id: string, approvedAdditionalHours: number): Observable<void>` posts `{ approvedAdditionalHours }` to the existing approve endpoint.
- `WorkApprovalsStore.approve(item, approvedAdditionalHours?)` passes the edited amount only for `allocation_extend`; all other item kinds preserve their current API call signatures.

- [ ] **Step 1: Add red store/API tests.**

Add coverage that an allocation approval calls the API with the edited amount and that a rejected create request leaves the form/page error state available. Add an API-client test following existing HttpTestingController conventions if this repository has one for `WorkApprovalsApiService`; otherwise test the store call boundary with a mocked API. Use concrete values such as `approvedAdditionalHours: 12` and assert the body is exactly `{ approvedAdditionalHours: 12 }`.

- [ ] **Step 2: Implement the API and store changes.**

Add the create method and change the allocation approval method:

```typescript
createAllocationRequest(
  objectiveId: string,
  payload: { requestedAdditionalHours: number; reason: string }
): Observable<unknown> {
  return this.http.post(
    `${this.workBase}/objectives/${objectiveId}/allocation-requests`,
    payload
  );
}

approveAllocationRequest(id: string, approvedAdditionalHours: number): Observable<void> {
  return this.http.post<void>(
    `${this.workBase}/objectives/change-requests/${id}/approve`,
    { approvedAdditionalHours }
  );
}
```

Change the store method to accept an optional amount and use the allocation item's requested amount as the fallback when no edited amount is supplied. Keep `approve(item)` source-compatible for all current callers:

```typescript
async approve(item: ApprovalItem, approvedAdditionalHours?: number): Promise<boolean> {
  // ...
  case 'allocation_extend': {
    const requested = item.raw.payload.requestedAdditionalHours;
    await firstValueFrom(api.approveAllocationRequest(
      item.id,
      approvedAdditionalHours ?? requested
    ));
    // remove the item exactly as today
    break;
  }
}
```

If the raw union does not expose the allocation payload safely, add a narrow type guard or map the requested amount onto `ApprovalItem`; do not use `any` to bypass the union. Keep error extraction and queue removal unchanged.

- [ ] **Step 3: Run the store/API tests and commit.**

Run the focused Work Approvals store/API specs. Confirm the edited amount is sent and an API failure keeps the allocation item pending with the existing error. Commit:

```bash
git add src/app/modules/work/data-access/work-approvals-api.service.ts src/app/modules/work/models/dto/allocation-request.dto.ts src/app/modules/work/models/approval.model.ts src/app/modules/work/utils/approval.mapper.ts src/app/modules/work/state/work-approvals.store.ts src/app/modules/work/state/work-approvals.store.spec.ts
git commit -m "feat(work): send edited allocation amounts from approvals"
```

Stage only files that actually changed.

---

### Task 3: Add the Create Approval modal and finish the request-more-allocation action

**Files:**
- Modify: `src/app/modules/work/feature/work-approvals/work-approvals.component.ts`
- Modify: `src/app/modules/work/feature/work-approvals/work-approvals.component.spec.ts`
- Modify: `src/app/modules/work/ui/approval-request-row/approval-request-row.component.ts`
- Modify: `src/app/modules/work/ui/approval-request-row/approval-request-row.component.spec.ts` if present; otherwise add tests in the existing authorized Work Management spec location.

**Interfaces:**
- `WorkApprovalsComponent` obtains the current project id from the existing routed `ActivatedRoute` pattern and loads modules using `ProjectApiService.getMyMilestones(projectId)`.
- It exposes modal state, selected module id, requested hours, reason, submitting state, and a user-visible create error. The modal submits through `WorkApprovalsApiService.createAllocationRequest` (prefer a store method only if the existing store architecture already owns all write operations).
- `ApprovalRequestRowComponent` emits `approved` with the final amount for `allocation_extend` and emits `requestOwnAllocation` when the existing action is activated. The page opens the same modal, prefilled with the caller's own objective where the lookup response identifies `isOwner` and the objective id.

- [ ] **Step 1: Add red component tests.**

Expand the page spec to cover: the Create Approval button is rendered; clicking it opens the modal; module options come from `getMyMilestones`; submitting `{ requestedAdditionalHours: 12, reason: 'Need more delivery capacity' }` calls the existing allocation-request endpoint; a failed request renders an alert; and a successful request closes the modal and reloads approvals. Add row tests that an allocation row renders an editable hours input initialized to its requested amount, emits `approved` with the edited amount, and emits `requestOwnAllocation` from the existing action. Keep non-allocation rows on the current approve/reject behavior.

Use concrete DOM markers (`data-testid="create-approval-button"`, `data-testid="create-approval-modal"`, `data-testid="allocation-hours-input"`, and `data-testid="create-approval-submit"`) so tests verify behavior rather than CSS details.

- [ ] **Step 2: Implement the page modal and module lookup.**

Add `ProjectApiService`, `WorkApprovalsApiService`, `ActivatedRoute`, and the already shared `ModalComponent`, `SelectComponent`, `InputComponent`, and `ButtonComponent` imports. Resolve the project id using the surrounding route convention. Add a Create Approval button above the existing request sections:

```html
<app-button data-testid="create-approval-button" variant="primary" (pressed)="openCreateApproval()">
  Create Approval
</app-button>
```

Inside the existing component template, add an `app-modal` form with a module `app-select`, numeric hours `app-input`, description `app-input`, an alert for errors, Cancel, and Submit buttons. Populate the module options from `getMyMilestones(projectId)`, mapping `{ objectiveId, title }` to `SelectOption`. Validate a selected module, positive finite hours, and non-empty reason before posting. On success, reset the form, close the modal, and call `store.loadAll()`.

Do not introduce a new backend lookup: the existing `GET /work/projects/{projectId}/objectives/mine` path is the source of truth. Keep the owner flag available for the prefill action and do not offer root modules that cannot route a request if the lookup response gives enough information to identify them; if the existing response does not include `reportingManagerId`, let the backend return its existing actionable error instead of inventing a frontend rule.

- [ ] **Step 3: Implement row-level edited hours and the shared request action.**

In `ApprovalRequestRowComponent`, add a local `approvedHours` signal initialized from `item().raw.payload.requestedAdditionalHours` for allocation rows. Render it only for `allocation_extend`, with the required test id and numeric input beside the actions. Change the approve button to call a method:

```typescript
onApproveClick(): void {
  if (this.item().kind !== 'allocation_extend') {
    this.approved.emit();
    return;
  }
  this.approved.emit(this.approvedHours());
}
```

Update the output type to `output<number | undefined>()` and keep the page backward-compatible for non-allocation items. Replace the TODO comment/action behavior with the existing `requestOwnAllocation.emit()` action; the page handles opening the same modal and preselecting the caller-owned objective when possible. Do not create a second request form.

- [ ] **Step 4: Connect page events to store/API operations.**

Change the page template bindings to `(approved)="onApprove(item, $event)"`. Update `onApprove` to pass the optional amount to `store.approve`. For `requestOwnAllocation`, open the create modal, set a pending-prefill objective id, and apply it once the modules lookup completes. Keep `lastFailedId` behavior so approval failures remain inline on the originating row. After a successful create request, reload the four approval queues and show the new request outcome in the existing page flow.

- [ ] **Step 5: Run focused frontend tests and commit.**

Run the Work Approvals component, row, store, and API specs. Expected result: Create Approval opens and submits, Request more allocation opens the same form, edited hours reach the store, and existing approval/rejection flows remain green. Commit:

```bash
git add src/app/modules/work/feature/work-approvals/work-approvals.component.ts src/app/modules/work/feature/work-approvals/work-approvals.component.spec.ts src/app/modules/work/ui/approval-request-row/approval-request-row.component.ts src/app/modules/work/ui/approval-request-row/approval-request-row.component.spec.ts
git commit -m "feat(work): add approval creation and inline allocation editing"
```

---

### Task 4: Run the B2 integration-oriented frontend/backend verification and commit the plan status

**Files:**
- Modify: this plan file only for checkbox/status notes; do not move it from `plans/next/`.

- [ ] **Step 1: Run backend Work Management approval tests.**

Run the targeted approval unit/integration tests from Task 1 and then:

```bash
dotnet test tests/ONEVO.Tests.Unit --no-restore -p:BuildProjectReferences=false --filter FullyQualifiedName~WorkManagement
```

If a build-lock error mentions `ONEVO.Api`, use `-p:BuildProjectReferences=false`; do not kill the running API process.

- [ ] **Step 2: Run the complete frontend Work Management suite.**

```bash
npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"
```

Expected: all Work Management tests pass, including the new B2 create-request and edited-hours coverage. Record the exact total in the final report.

- [ ] **Step 3: Audit scope and commit any status-only plan update.**

Run `git diff --check`, inspect `git status --short`, and confirm every changed path belongs to the Work Management scope. Do not touch CI/build files or unrelated modules. Keep this plan under `docs/superpowers/plans/next/` until the required browser/manual verification is performed.

## Self-Review Checklist

- [ ] The user's “approver may edit granted hours” decision is implemented end-to-end: row input → store → HTTP body → controller request → MediatR command → handler slack check → persisted child allocation.
- [ ] Omitted approved hours preserve the original requested amount.
- [ ] Zero/negative edited hours fail without mutating state; insufficient approver slack returns conflict and leaves the request pending.
- [ ] Create Approval and Request more allocation use the existing caller-module lookup and allocation-request endpoint; no duplicate backend query or new route exists.
- [ ] Existing task creation, objective changes, invitations, and rejection flows remain unchanged.
- [ ] Tests cover frontend UI, store/API payloads, backend unit validation, and real EF persistence for an edited approved amount.
- [ ] No migration, CI/pipeline/build-infrastructure, unrelated module, or unauthorized shared UI file was changed.
- [ ] No B3 autosave decision was guessed or implemented in B2.
