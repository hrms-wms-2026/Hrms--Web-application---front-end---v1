# Work Management — Task Foundation, Part 2: Approvals Tab and Notification Bell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sixth "Approvals" tab to the milestone sub-menu (one page for every Work Management approval kind) and wire up the previously-static navbar notification bell to the new backend Notifications API.

**Architecture:** Same layered pattern as Part 1. New `data-access`/`state`/`feature`/`ui` files for approvals; a new generic (not `modules/work`-scoped) `core/services/notification-api.service.ts` and `core/state/notifications.store.ts` for the navbar bell, since notifications are shared infra per the backend design's §6.

**Tech Stack:** Same as Part 1.

**Spec:** `Hrms--Web-application---front-end---v1/docs/superpowers/specs/next/2026-08-16-work-management-task-foundation-design.md` §4, §5. Backend contract: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-16-work-management-task-foundation-design.md` §3.3 (task creation requests), §4 (allocation extend), §6.5 (notifications API).

## Global Constraints

- Prerequisite: Part 1 of this plan (`TaskBoardStore`, `WorkTask` model) is not a hard dependency of this Part, but both parts ship together — coordinate before merging either alone.
- The navbar bell and `notification-api.service.ts` live outside `modules/work/` (in `core/` and `layouts/main-layout/top-navbar/`) since they are generic — do not move Work-Management-specific approval code into those shared locations.
- Same design-token/styling rule as Part 1 (`COMPONENT_DESIGN_RULES.md`).

---

### Task 1: Models, DTOs, mappers for approvals (task creation requests + allocation requests)

**Files:**
- Create: `src/app/modules/work/models/dto/task-creation-request.dto.ts`
- Create: `src/app/modules/work/models/dto/allocation-request.dto.ts`
- Create: `src/app/modules/work/models/approval.model.ts`
- Create: `src/app/modules/work/utils/approval.mapper.ts`

**Interfaces:**
- Produces: `TaskCreationRequestDto`, `AllocationRequestDto` (raw shapes matching backend spec §3.3/§4 response bodies), `ApprovalItem` (a unified app-facing shape: `{ id, kind: 'task_creation' | 'allocation_extend' | 'objective_change' | 'objective_invitation', title, description, requestedByName, createdAt, raw }` — `raw` keeps the original typed DTO for kind-specific action handlers), `toApprovalItem` overloads per source DTO.

- [ ] **Step 1: Write the DTO files**, matching backend spec §3.3's `TaskCreationRequestResponse` and §4's `ObjectiveChangeRequestResponse` (extended with the `extend_allocation` payload shape) field-for-field. Read the *existing* `src/app/modules/work/models/dto/objective-invitation.dto.ts` and any existing objective-change-request DTO file first, to reuse their exact casing convention and confirm whether an `ObjectiveChangeRequestDto` already exists (it likely does, from the already-shipped `ListMyObjectiveChangeRequests` endpoint) — extend that existing file with the `extend_allocation` payload shape rather than creating a parallel one.

```typescript
// src/app/modules/work/models/dto/task-creation-request.dto.ts
export interface TaskCreationRequestPayloadDto {
  title: string;
  description: string | null;
  taskType: string;
  priority: string;
  dueDate: string | null;
  estimatedHours: number | null;
  storyPoints: number | null;
}

export interface TaskCreationRequestDto {
  id: string;
  objectiveId: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  payload: TaskCreationRequestPayloadDto;
  createdAt: string;
}
```

```typescript
// src/app/modules/work/models/dto/allocation-request.dto.ts
export interface AllocationRequestDto {
  id: string;
  objectiveId: string;
  requestType: 'extend_allocation';
  status: 'pending' | 'approved' | 'rejected';
  payload: { requestedAdditionalHours: number; reason: string };
  createdAt: string;
}
```

- [ ] **Step 2: Write `approval.model.ts` and `approval.mapper.ts`** — `ApprovalItem` as described above; `toApprovalItem` has one overload per DTO kind, each producing a human-readable `title`/`description` (e.g. task-creation: `title = payload.title`, `description = 'Requested for {objectiveId}'`; allocation: `title = '+{hours}h requested'`, `description = reason`).

- [ ] **Step 3: No unit test (pure mapping, same rationale as Part 1 Task 2). Step 4: Commit.**

```bash
git add src/app/modules/work/models/dto/task-creation-request.dto.ts src/app/modules/work/models/dto/allocation-request.dto.ts src/app/modules/work/models/approval.model.ts src/app/modules/work/utils/approval.mapper.ts
git commit -m "feat(work): approval DTOs, unified ApprovalItem model, mapper"
```

### Task 2: `WorkApprovalsApiService`

**Files:**
- Create: `src/app/modules/work/data-access/work-approvals-api.service.ts`
- Test: `src/app/modules/work/data-access/work-approvals-api.service.spec.ts`

**Interfaces:**
- Produces: `WorkApprovalsApiService.{getMyTaskCreationRequests, approveTaskCreationRequest, rejectTaskCreationRequest, getMyAllocationRequests, approveAllocationRequest, rejectAllocationRequest, getMyObjectiveChangeRequests, approveObjectiveChangeRequest, rejectObjectiveChangeRequest, getMyObjectiveInvitations, acceptObjectiveInvitation, rejectObjectiveInvitation}`. The last four methods **wrap already-existing endpoints** (`GET/POST .../change-requests/...`, `GET/POST .../invitations/...`) — read `src/app/modules/work/data-access/project-api.service.ts` and `objective-member-api.service.ts` first; if those methods already exist on an existing service, this new service should **inject and delegate to those existing services** rather than duplicating the HTTP calls, per this codebase's DRY convention.

- [ ] **Step 1: Read `project-api.service.ts` and `objective-member-api.service.ts` in full to confirm which of the four "already exists" methods are really already implemented, and their exact names.**

- [ ] **Step 2: Write the failing tests** for the two genuinely new methods (`getMyTaskCreationRequests`, `getMyAllocationRequests` and their approve/reject actions), following Part 1 Task 3's `HttpTestingController` pattern exactly.

- [ ] **Step 3: Write the service** — new HTTP calls for task-creation-requests/allocation-requests, delegating calls for the other two kinds to the existing services confirmed in Step 1 (inject them, call through, do not re-implement).

- [ ] **Step 4: Run tests, verify PASS. Step 5: Commit.**

```bash
git add src/app/modules/work/data-access/work-approvals-api.service.ts src/app/modules/work/data-access/work-approvals-api.service.spec.ts
git commit -m "feat(work): WorkApprovalsApiService - new endpoints + delegation to existing ones"
```

### Task 3: `WorkApprovalsStore`

**Files:**
- Create: `src/app/modules/work/state/work-approvals.store.ts`
- Test: `src/app/modules/work/state/work-approvals.store.spec.ts`

**Interfaces:**
- Consumes: `WorkApprovalsApiService` (Task 2), `toApprovalItem` (Task 1).
- Produces: state `{ taskCreationRequests, allocationRequests, objectiveChangeRequests, objectiveInvitations, loading, error }`, computed `pendingCount`, methods `{ loadAll(), approve(item: ApprovalItem), reject(item: ApprovalItem, comment?: string) }` — `approve`/`reject` switch on `item.kind` to call the matching API method, then remove the item from local state on success (all four lists use the same shape, so one generic `approve`/`reject` pair replaces four near-duplicate method sets).

- [ ] **Step 1: Write the failing test** — one test per list loading correctly via `loadAll()` (all four API calls run in parallel via `Promise.all`, matching Task 4's `getStatuses`/`getTasks` pattern from Part 1), plus one test asserting `approve()` removes the approved item from the correct list and surfaces the `409 APPROVER_INSUFFICIENT_SLACK` case (for an `allocation_extend` item) as a store error rather than silently failing — this is the one place spec §4's cascading-approval UX becomes visible, per this repo's own frontend spec §4.

```typescript
it('approve on an allocation request with insufficient approver slack surfaces the 409 message and keeps the item pending', async () => {
  const approveAllocationRequest = jasmine.createSpy().and.returnValue(
    throwError(() => ({ status: 409, error: { detail: "You don't have enough allocation yourself..." } }))
  );
  const store = setup({ approveAllocationRequest });
  await store.loadAll();
  const item = store.allocationRequests()[0];

  await store.approve(item);

  expect(store.error()).toContain("You don't have enough allocation yourself");
  expect(store.allocationRequests().length).toBe(1); // item NOT removed - still pending
});
```

- [ ] **Step 2: Run test, verify FAIL.**

- [ ] **Step 3: Write the store**, following the exact `signalStore`/`withState`/`withComputed`/`withMethods`/`patchState`/`extractError` pattern established in Part 1 Task 4.

- [ ] **Step 4: Run tests, verify PASS. Step 5: Commit.**

```bash
git add src/app/modules/work/state/work-approvals.store.ts src/app/modules/work/state/work-approvals.store.spec.ts
git commit -m "feat(work): WorkApprovalsStore - unified load/approve/reject for all four request kinds"
```

### Task 4: `ui/approval-request-row` + `feature/work-approvals` page + sixth sub-menu tab

**Files:**
- Create: `src/app/modules/work/ui/approval-request-row/approval-request-row.component.ts`
- Create: `src/app/modules/work/feature/work-approvals/work-approvals.component.ts`
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts` — add the sixth tab
- Modify: `src/app/modules/work/work.routes.ts` — add the `approvals` route segment
- Test: `src/app/modules/work/feature/work-approvals/work-approvals.component.spec.ts`

**Interfaces:**
- Consumes: `WorkApprovalsStore` (Task 3), `ApprovalItem` (Task 1).
- Produces: `ApprovalRequestRowComponent` (input `item: ApprovalItem`; outputs `approved`, `rejected: string | undefined`), `WorkApprovalsComponent` (four sections, one `ApprovalRequestRowComponent` per pending item).

- [ ] **Step 1: Write `ApprovalRequestRowComponent`** — title/description/requester/created-at, Approve button, Reject button that reveals an inline comment textarea when `item.kind === 'task_creation'` (rejection requires a comment per backend spec §3.3) — no comment field for the other three kinds (their reject flows don't require one per the existing/companion backend design). For `item.kind === 'allocation_extend'`, on an approve failure whose message contains the approver-insufficient-slack text (Task 3's store already surfaces this in `store.error()`), render it inline on the row instead of a generic toast, with a link stub to a future "request more allocation for my own objective" action (full wiring of that follow-up request is a `// TODO` — the backend endpoint exists per the companion plan, `POST /objectives/{myOwnObjectiveId}/allocation-requests`, but resolving "my own objective for this context" needs a lookup this task's scope doesn't cover; flag it rather than half-wire it).

- [ ] **Step 2: Write `WorkApprovalsComponent`** — four `<section>` blocks (Task Creation Requests / Allocation Requests / Objective Change Requests / Objective Invitations), each rendering `store.<listName>()` through `ApprovalRequestRowComponent`, `ngOnInit` calls `store.loadAll()`. No `milestoneId`-specific loading — matches spec §4's "one page for every kind of Work Management approval" (these lists are the caller's global pending-approval queues, not scoped to the currently-viewed milestone, per the already-existing `change-requests/mine`/`invitations/mine` endpoints' own semantics).

- [ ] **Step 3: Add the sixth tab to `MilestoneSubMenuComponent`'s `TABS` array:**

```typescript
const TABS: SubMenuTab[] = [
  { label: 'Tree', segment: 'tree' },
  { label: 'Board', segment: 'board' },
  { label: 'Backlog', segment: 'backlog' },
  { label: 'My Task', segment: 'my-task' },
  { label: 'List', segment: 'list' },
  { label: 'Approvals', segment: 'approvals' }
];
```

Add a matching `@case ('approvals')` SVG icon block in the same component's template (a checkmark-in-circle icon, matching the existing icon style/stroke-width of the other five cases).

- [ ] **Step 4: Add the route to `work.routes.ts`**, inside the same `milestones/:milestoneId` children array as `board`/`backlog`:

```typescript
{
  path: 'approvals',
  loadComponent: () =>
    import('../../feature/work-approvals/work-approvals.component').then((m) => m.WorkApprovalsComponent)
}
```

- [ ] **Step 5: Write the component test** (loadAll called on init, matching Part 1 Task 6's test pattern), run it, verify PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/ui/approval-request-row/ src/app/modules/work/feature/work-approvals/ src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts src/app/modules/work/work.routes.ts
git commit -m "feat(work): Approvals tab - sixth sub-menu entry, unified four-section approval page"
```

### Task 5: `NotificationApiService` + `NotificationsStore` (generic, `core/`)

**Files:**
- Create: `src/app/core/services/notification-api.service.ts`
- Create: `src/app/core/state/notifications.store.ts`
- Test: `src/app/core/services/notification-api.service.spec.ts`
- Test: `src/app/core/state/notifications.store.spec.ts`

**Interfaces:**
- Produces: `NotificationApiService.{getMine, getUnreadCount, markRead, markAllRead}` (calling `GET/POST /api/v1/notifications...`, per backend spec §6.5 — note the route has **no** `/work/` prefix, unlike everything in `modules/work/data-access/`). `NotificationsStore` with state `{ items, unreadCount, loading, error }`, method `refreshUnreadCount()` polled every 60 seconds while the app is open (spec §5 — no websocket/real-time infra).

- [ ] **Step 1: Read `src/app/core/services/notification.service.ts` (the existing ephemeral toast service) just enough to confirm the new persistent service's filename doesn't collide — name this one `notification-api.service.ts` (already specified above) to keep the two clearly distinct; do not rename or touch the existing toast service.**

- [ ] **Step 2: Write both files' failing tests**, `NotificationApiService`'s following Part 1 Task 3's pattern, `NotificationsStore`'s following Part 1 Task 4's pattern (including one test that advances a fake `setInterval`-driven timer via `fakeAsync`/`tick(60000)` and asserts `refreshUnreadCount` fires again — read how any existing polling pattern in this codebase, if one exists, sets up/tears down its interval, to avoid leaking timers across tests; if `NotificationsStore` is `providedIn: 'root'`, the interval must be started explicitly by a caller (Task 6's navbar component), not in the store's own constructor, so tests can control it directly instead of fighting a self-starting timer).**

- [ ] **Step 3: Write the service and the store.**

- [ ] **Step 4: Run tests, verify PASS. Step 5: Commit.**

```bash
git add src/app/core/services/notification-api.service.ts src/app/core/services/notification-api.service.spec.ts src/app/core/state/notifications.store.ts src/app/core/state/notifications.store.spec.ts
git commit -m "feat(core): NotificationApiService and NotificationsStore - generic notification polling"
```

### Task 6: Wire the navbar bell — `ui/notification-dropdown` + `NotificationBellComponent`

**Files:**
- Create: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts`
- Create: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-dropdown/notification-dropdown.component.ts`
- Modify: `src/app/layouts/main-layout/top-navbar/top-navbar.component.ts`
- Modify: `src/app/layouts/main-layout/top-navbar/top-navbar.component.html` — replace the static bell `<button>` block
- Test: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts`

**Interfaces:**
- Consumes: `NotificationsStore` (Task 5).
- Produces: `NotificationBellComponent` (starts the 60s poll on `ngOnInit`, stops on `ngOnDestroy`; toggles the dropdown open/closed; badge bound to `store.unreadCount()`), `NotificationDropdownComponent` (input `items`, output `itemClicked: NotificationItem` — click marks read via the store and, based on `relatedEntityType`, the parent navigates: `task`/`task_creation_request` → that task's Board tab, `objective_change_request`/`allocation_extend` → the Approvals tab, per spec §5).

- [ ] **Step 1: Write the failing test** — bell click toggles dropdown visibility, badge shows `unreadCount()`, dropdown item click calls `store.markRead(id)` then navigates (mock `Router.navigate`, assert it's called with the expected path built from `relatedEntityType`/`relatedEntityId`).

- [ ] **Step 2: Write `NotificationBellComponent`**, reusing the existing bell SVG markup from `top-navbar.component.html` (Step 3 below moves it into this new component rather than deleting and rewriting it) plus a badge bound to `store.unreadCount() > 0`, and `ngOnInit`/`ngOnDestroy` starting/clearing a `setInterval(() => store.refreshUnreadCount(), 60000)`.

- [ ] **Step 3: Write `NotificationDropdownComponent`** — a positioned popup (reuse whichever existing dropdown/popover pattern this codebase already has, e.g. check `ui/project-settings-modal/` or `profile-menu` for a popover-positioning convention rather than inventing a new one), listing `items` with relative-time formatting (reuse an existing date-formatting utility if one exists in this codebase before adding a new dependency).

- [ ] **Step 4: Update `top-navbar.component.ts`** to import and render `<app-notification-bell />`, and `top-navbar.component.html` to replace the static `<button aria-label="Notifications">...</button>` block with `<app-notification-bell />`.

- [ ] **Step 5: Run tests, verify PASS.**

- [ ] **Step 6: Manual browser verification** — start the dev server, confirm the bell shows a live unread count, click it, confirm the dropdown lists real notifications from the backend (once the backend companion plan's Part 4 is deployed), click a notification, confirm navigation and that it's marked read (badge count decrements).

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including every spec added across both parts of this frontend plan.

- [ ] **Step 8: Commit**

```bash
git add src/app/layouts/main-layout/top-navbar/
git commit -m "feat(core): wire the navbar notification bell to real backend data"
```

## Part 2 complete — full frontend plan series done
