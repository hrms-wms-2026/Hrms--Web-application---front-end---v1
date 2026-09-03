> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Perform the final deep Work Management test-and-fix audit for every component and flow touched by B1–B6, including the backend approved-hours path and the frontend Work Management UI. Record a literal pass/fail result for each required behavior, fix only scoped regressions, and finish with clean repositories and reproducible test commands.

**Architecture:** This is verification-first. Do not redesign features or add new product behavior. Use the existing Work Management unit/integration tests, focused component specs, full frontend Work Management suite, backend Work Management handler suites, and static scope/reference audits. Any fix must be made in the smallest existing Work Management file and must be followed by the relevant focused test before the full suite is rerun.

**Tech Stack:** Angular/Vitest, .NET/xUnit/Moq/EF Core SQLite integration tests, Git, and existing Work Management source and documentation paths.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B7. The audit must explicitly cover Create Approval end-to-end, edited allocation approval persistence, completion-hours cascade visibility, both modes of B4/B5/B6 merged forms, and the B3 explicit-save behavior including failed-save state.

## Global Constraints

- Work only within Work Management source/tests and authorized `docs/superpowers/**` plan files. Do not touch unrelated modules, shared UI outside already-approved B1 primitives, backend areas outside Work Management, CI, routes outside Work Management, migrations, or build infrastructure.
- Do not add speculative features during audit. Fix only a failing required behavior or a test that is stale because of an implemented scoped change.
- Do not run `dotnet run`, a frontend dev server, or kill existing processes. Do not push or merge.
- Use exact test counts and commit hashes in the final report.

---

### Task 1: Backend Work Management verification

**Scope:** Backend Track A completion cascade and B2 edited-hours approval.

- [ ] **A1. Completed-hours cascade unit coverage:** run the focused `MoveTaskStatusCommandHandlerTests` suite and confirm completed hours update the task, ancestor objectives, and project as designed, while non-completed status moves do not increment completed hours.
- [ ] **A2. Approval unit coverage:** run `ApproveObjectiveChangeRequestCommandHandlerTests` and confirm: omitted amount uses requested amount; edited amount is applied; zero/negative amount returns 400 without mutation; amount above approver slack returns 409 and leaves request pending; non-allocation approval behavior remains unchanged.
- [ ] **A3. Approval integration coverage:** run `ApproveObjectiveChangeRequestCommandHandlerIntegrationTests` and confirm both default and edited amounts persist through EF without duplicate tracking failures and the request status is approved.
- [ ] **A4. Work Management backend regression:** run the complete Work Management unit filter and record the exact passed/failed/skipped totals.
- [ ] **A5. Fix policy:** if any backend test fails, fix only the Work Management handler/test/contract path responsible, rerun the focused suite, then rerun the complete Work Management filter.

Commands:

```bash
cd HRMS-Backend-v1
dotnet test tests/ONEVO.Tests.Unit --no-restore --filter FullyQualifiedName~MoveTaskStatusCommandHandlerTests
dotnet test tests/ONEVO.Tests.Unit --no-restore --filter FullyQualifiedName~ApproveObjectiveChangeRequestCommandHandlerTests
dotnet test tests/ONEVO.Tests.Unit --no-restore --filter FullyQualifiedName~ApproveObjectiveChangeRequestCommandHandlerIntegrationTests
dotnet test tests/ONEVO.Tests.Unit --no-restore -p:BuildProjectReferences=false --filter FullyQualifiedName~WorkManagement
```

---

### Task 2: Frontend shared primitives and form verification

**Scope:** B1 shared Select/Tabs, B4 SprintForm, B5 SubModuleForm, and B6 MemberManagementPopup.

- [ ] **B1 Select:** verify icon rendering, accessible label/error bindings, all migrated Work Management filter consumers, Task Create, Sprint Create, and no remaining legacy dropdown references.
- [ ] **B1 Tabs:** verify active tab state, `aria-selected`, keyboard-focusable tab buttons, configurable `aria-label`, and PreferencesModal sub-tab rendering.
- [ ] **B4 SprintForm create mode:** verify module picker, module-required error, owner create path, non-owner request path, exact create payload, and cancel.
- [ ] **B4 SprintForm edit mode:** verify prefilled values, no module picker, exact edit call contract, save success/failure, re-seeding on sprint input change, and cancel.
- [ ] **B5 SubModuleForm create mode:** verify all fields, required/date/negative-hours validation, exact create DTO including empty description normalization, no Achieved control, and cancel.
- [ ] **B5 SubModuleForm edit mode:** verify prefill, exact edit DTO, Achieved on/off metadata, Default Module disabled state/explanation, validation, and cancel.
- [ ] **B6 MemberManagementPopup project scope:** verify member rows, Avatar/name display, manager-only Add member, picker selection event, and close.
- [ ] **B6 MemberManagementPopup objective scope:** verify directory names, EmployeeAvatar, leader badge, pending tag, remove/cancel, transfer picker, loading state, and close.
- [ ] **B2 row/page:** verify editable allocation amount, edited approval event, Create Approval modal, module lookup, request success/error, request-more-allocation prefill, and existing non-allocation approval/rejection behavior.

Commands:

```bash
cd Hrms--Web-application---front-end---v1
npx ng test --watch=false --include=src/app/shared/ui/select/select.component.spec.ts --include=src/app/shared/ui/tabs/tabs.component.spec.ts --include=src/app/shared/ui/preferences-modal/preferences-modal.component.spec.ts
npx ng test --watch=false --include=src/app/modules/work/ui/sprint-form/sprint-form.component.spec.ts --include=src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts --include=src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts --include=src/app/modules/work/ui/approval-request-row/approval-request-row.component.spec.ts --include=src/app/modules/work/feature/work-approvals/work-approvals.component.spec.ts
```

---

### Task 3: Frontend Work Management end-to-end regression checklist

Run the complete suite and resolve failures using the smallest scoped fix:

```bash
cd Hrms--Web-application---front-end---v1
npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"
```

For each item below, record `PASS` or `FAIL` with the test file and observed result:

- [ ] **C1 Create Approval end-to-end:** module lookup → create request payload → approval queue reload → allocation row edited amount → approval body → backend handler → module allocation change. If a browser/manual environment is unavailable, mark UI interaction as test-covered and separately identify the unexecuted manual step; do not claim browser verification.
- [ ] **C2 Completion-hours cascade UI visibility:** move a task to Completed through the Work Management task flow and confirm the module tree displays updated completed hours after refresh; if only automated coverage is available, record the exact handler/integration and tree-refresh tests used.
- [ ] **C3 B4 in create mode:** SprintForm creates a sprint from Task Backlog and MilestoneTreeTab with correct module/objective context.
- [ ] **C4 B4 in edit mode:** SprintForm edits from Task Backlog and MilestoneTreeTab and refreshes the parent data.
- [ ] **C5 B5 in create mode:** SubModuleForm creates a child module through MilestoneTreeTab with exact parent id and refresh.
- [ ] **C6 B5 in edit mode:** SubModuleForm edits a module and preserves achieved/unachieved ordering, error handling, and refresh.
- [ ] **C7 B6 project scope:** ProjectList uses the unified popup, maps project members, and preserves add-member behavior.
- [ ] **C8 B6 objective scope:** MilestoneTreeTab uses the unified popup and preserves member add/remove/transfer/pending behavior.
- [ ] **C9 B3 explicit save:** draft changes remain local before Save; successful Save calls the store once and refreshes; failed Save leaves the modal open and inputs available. No blur/debounce calls exist.
- [ ] **C10 B1 migration:** no old Work Management dropdown, sprint form, sub-module form, settings form, or member popup selectors/classes remain in source imports/templates.

---

### Task 4: Static scope, formatting, and Git audit

- [ ] Run `git diff --check` in both repositories.
- [ ] Run `git status --short --branch` in both repositories and inspect every path.
- [ ] Confirm backend changed paths are limited to Work Management application/API contract/controller/tests plus the authorized backend B2 contract path.
- [ ] Confirm frontend changed paths are limited to Work Management source/tests and authorized shared B1 primitives plus `docs/superpowers/**` plans.
- [ ] Search for old selectors/classes and confirm no stale source references remain.
- [ ] Search for TODO markers introduced by the prompt's B2 path and confirm the dead request-more-allocation TODO is gone.
- [ ] Do not move plans from `docs/superpowers/plans/next/` before the final report unless the repository convention requires it.
- [ ] Commit only audit plan checkbox/status changes if needed, using an explicit Work Management test-audit commit.

Suggested audits:

```bash
# frontend, from Hrms--Web-application---front-end---v1
git diff --check
git grep -n -e WorkDropdownComponent -e WorkDropdownOption -e app-work-dropdown -- src/app || true
git grep -n -e SprintCreateFormComponent -e SprintEditFormComponent -e app-sprint-create-form -e app-sprint-edit-form -- src/app/modules/work || true
git grep -n -e CreateSubModuleModalComponent -e MilestoneSettingsModalComponent -e app-create-sub-module-modal -e app-milestone-settings-modal -- src/app/modules/work || true
git grep -n -e ProjectMembersPopupComponent -e ObjectiveMembersPopupComponent -e app-project-members-popup -e app-objective-members-popup -- src/app/modules/work || true
```

## Final Audit Record Template

| Area | Required behavior | Result | Evidence |
|---|---|---|---|
| Backend cascade | Completed hours cascade to ancestors/project | PASS/FAIL | Test file and count |
| Backend approval | Edited hours, fallback, validation, slack | PASS/FAIL | Unit/integration counts |
| B1 Select/Tabs | Shared primitives and consumers | PASS/FAIL | Focused test counts |
| B2 Approvals | Create, inline edit, request-more action | PASS/FAIL | Component/store/API tests |
| B3 Explicit save | No autosave; success/failure handling | PASS/FAIL | Modal/tree tests |
| B4 SprintForm | Create and edit modes | PASS/FAIL | SprintForm/parent tests |
| B5 SubModuleForm | Create and edit modes | PASS/FAIL | SubModuleForm/tree tests |
| B6 Members | Project/objective scopes | PASS/FAIL | Popup/parent tests |
| Scope | Work Management-only changes | PASS/FAIL | Git status/path audit |

## Self-Review Checklist

- [ ] Every required behavior has a literal PASS/FAIL record and test evidence.
- [ ] No unverified manual/browser behavior is reported as verified.
- [ ] Full Work Management suites pass or failures are explicitly documented.
- [ ] Scope audit confirms no unrelated modules changed.
- [ ] Final repositories are clean except for intentional uncommitted audit-plan checkbox updates, which are either committed or explicitly reported.
