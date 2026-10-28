# Sensitive Position Approval — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Change Position into an action menu (Promotion/Transfer/Offboarding-disabled) that's hidden on your own record, shows a sensitivity reminder, and give `roles:manage` holders an Approvals inbox.

**Architecture:** Reuses the existing `app-popover` component (already used by the profile menu) for the action menu instead of building a new dropdown. The caller's own employee id — not available client-side today — gets threaded through the auth session store from the backend companion plan's Task 8. `change-position-modal.component.ts` gains a locked `changeReason` input and a reminder driven by a new `requiresApproval` field on the position picker's response. A new `approvals-list.component.ts` follows the exact shape `employee-list.component.ts` already established.

**Tech Stack:** Angular 21, standalone components, Vitest.

## Global Constraints

- Depends on the backend companion plan (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-17-sensitive-position-approval-backend.md`) — specifically `ChangeEmployeePositionResponse.PendingApproval`, `PositionListItemResponse.RequiresApproval`, `GET .../pending-for-me`, and `CurrentUserDto.EmployeeId` on `/auth/me`.
- All commands run from `Hrms--Web-application---front-end---v1/` root.
- The self-position-change hide-the-button behavior is UX-only — the backend companion's Task 3 enforces the real rule regardless of what this plan builds. Don't skip backend verification on the assumption the frontend check is sufficient.

---

### Task 1: Thread `employeeId` through the auth session store

**Files:**
- Modify: wherever `CurrentUserViewModel` is declared (`src/app/core/auth/` — confirmed fields today: `email, permissions, activeModules, authenticated, legalAcceptanceRequired, pendingLegalDocuments, workspaceSlug, redirectRequired, continueUrl`; find the exact file before editing)
- Modify: the auth API service/mapper that builds `CurrentUserViewModel` from the `/auth/me` HTTP response
- Modify: `auth.store.ts` (or wherever session state lives) if it re-exposes user fields as its own signals

**Interfaces:**
- Produces: `CurrentUserViewModel.employeeId: string | null`, readable the same way every other field on that view model already is (find one existing consumer, e.g. `permissions`, and match its read pattern exactly).

- [ ] **Step 1: Write the failing test**

Find this view model's existing mapper test (or the auth API service spec that constructs it from a raw HTTP response fixture) and add:

```typescript
it('maps employeeId from the me response', () => {
  const raw = { ...meResponseFixture, user: { ...meResponseFixture.user, employeeId: 'emp-123' } };
  const result = toCurrentUserViewModel(raw); // adjust to the real mapper function/method name
  expect(result.employeeId).toBe('emp-123');
});

it('maps a null employeeId when the account has no employee record', () => {
  const raw = { ...meResponseFixture, user: { ...meResponseFixture.user, employeeId: null } };
  const result = toCurrentUserViewModel(raw);
  expect(result.employeeId).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --watch=false --include='**/<the real mapper spec file>'`
Expected: FAIL

- [ ] **Step 3: Add the field**

Add `employeeId: string | null` to the raw `/auth/me` response type (matching the backend's new `CurrentUserDto.EmployeeId`), to `CurrentUserViewModel`, and to whatever mapping function converts one to the other — a one-line addition each, following the exact pattern the adjacent existing field (`email` or `workspaceSlug`) already uses in that same mapper.

- [ ] **Step 4: Run the test to verify it passes**

Run: `ng test --watch=false --include='**/<the real mapper spec file>'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/auth/
git commit -m "feat: thread employeeId through the auth session store"
```

---

### Task 2: `ChangePositionPayload.changeReason` + response typing

**Files:**
- Modify: `src/app/modules/people/models/employee.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Test: `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces:**
- Produces: `ChangePositionPayload { positionId: string; effectiveFrom: string; changeReason: 'Promotion' | 'Transfer' | 'LateralMove'; }`, `ChangePositionResponse { pendingApproval: boolean; }`, `PeopleApiService.changePosition(...): Observable<ChangePositionResponse>` (changed from `Observable<void>` — the backend companion's Task 3 now returns a body).

- [ ] **Step 1: Write the failing test**

```typescript
it('changePosition sends changeReason and returns pendingApproval', () => {
  service.changePosition('emp-1', { positionId: 'pos-1', effectiveFrom: '2026-09-01', changeReason: 'Promotion' })
    .subscribe((response) => expect(response.pendingApproval).toBe(true));
  const req = httpMock.expectOne(`${apiUrl}/employees/emp-1/change-position`);
  expect(req.request.body).toEqual({ positionId: 'pos-1', effectiveFrom: '2026-09-01', changeReason: 'Promotion' });
  req.flush({ pendingApproval: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --watch=false --include='**/people-api.service.spec.ts'`
Expected: FAIL

- [ ] **Step 3: Update the model and service**

In `employee.model.ts`:

```typescript
export interface ChangePositionPayload {
  readonly positionId: string;
  readonly effectiveFrom: string;
  readonly changeReason: 'Promotion' | 'Transfer' | 'LateralMove';
}

export interface ChangePositionResponse {
  readonly pendingApproval: boolean;
}
```

In `people-api.service.ts`:

```typescript
changePosition(id: string, payload: ChangePositionPayload): Observable<ChangePositionResponse> {
  return this.http.post<ChangePositionResponse>(`${environment.apiUrl}/employees/${id}/change-position`, payload);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `ng test --watch=false --include='**/people-api.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/models/employee.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat: add changeReason to ChangePositionPayload, type the pendingApproval response"
```

---

### Task 3: `PositionListItemResponse.requiresApproval`

**Files:**
- Modify: `src/app/modules/organization/models/position.model.ts`

- [ ] **Step 1: Add the field**

```typescript
export interface PositionListItemResponse {
  // ...existing fields unchanged...
  readonly requiresApproval?: boolean;
}
```

No test needed for a pure type addition with no logic — this is consumed by Task 4's component test instead.

- [ ] **Step 2: Commit**

```bash
git add src/app/modules/organization/models/position.model.ts
git commit -m "feat: add requiresApproval to PositionListItemResponse"
```

---

### Task 4: `change-position-modal.component.ts` — locked `changeReason` + sensitivity reminder

**Files:**
- Modify: `src/app/modules/people/ui/change-position-modal/change-position-modal.component.ts`
- Test: `change-position-modal.component.spec.ts` (create if it doesn't exist — check first)

**Interfaces:**
- Consumes: `Task 2`'s `ChangePositionPayload`/`ChangePositionResponse`, `Task 3`'s `requiresApproval`.
- Produces: new required input `changeReason: 'Promotion' | 'Transfer'` (Offboarding never opens this modal, per Task 5), new output `pendingApproval: void` alongside the existing `changed: void` (so the parent can show a different toast).

- [ ] **Step 1: Write the failing tests**

```typescript
it('shows the sensitivity reminder and changes the Save label when the selected position requires approval', () => {
  positionApi.listFlat.and.returnValue(of({
    items: [{ id: 'pos-2', name: 'Head of Security', requiresApproval: true }], totalCount: 1, page: 1, pageSize: 100
  } as never));
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  component.selectedPositionId.set('pos-2');
  fixture.detectChanges();

  const text = fixture.nativeElement.textContent as string;
  expect(text).toContain('requires approval');
  expect(fixture.nativeElement.querySelector('app-button[type="submit"]')?.textContent).toContain('Send for approval');
});

it('emits pendingApproval instead of changed when the backend returns pendingApproval: true', () => {
  peopleApi.changePosition.and.returnValue(of({ pendingApproval: true }));
  const pendingSpy = jasmine.createSpy('pendingApproval');
  const changedSpy = jasmine.createSpy('changed');
  component.pendingApproval.subscribe(pendingSpy);
  component.changed.subscribe(changedSpy);
  component.selectedPositionId.set('pos-2');
  fixture.componentRef.setInput('changeReason', 'Promotion');

  component.submit();

  expect(pendingSpy).toHaveBeenCalled();
  expect(changedSpy).not.toHaveBeenCalled();
});
```

Adjust selectors/setup to match whatever this component's real test conventions turn out to be once the spec file is created/found — follow `employee-detail.component.spec.ts`'s established mocking style for `PeopleApiService`/`PositionApiService`/`NotificationService`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --watch=false --include='**/change-position-modal.component.spec.ts'`
Expected: FAIL

- [ ] **Step 3: Update the component**

```typescript
import { ChangeDetectionStrategy, Component, inject, input, output, signal, effect, computed } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PositionListItemResponse } from '../../../organization/models/position.model';

@Component({
  selector: 'app-change-position-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="modalTitle()" (closed)="onClose()">
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-text-secondary)]">New position</span>
          <select class="rounded-md border border-[var(--color-border)] p-2"
            (change)="selectedPositionId.set($any($event.target).value)">
            <option value="">Select a position…</option>
            @for (position of positions(); track position.id) {
              <option [value]="position.id" [selected]="position.id === selectedPositionId()">{{ position.name }}</option>
            }
          </select>
          @if (loadError(); as loadErrorMessage) {
            <p class="text-xs text-[var(--color-danger-text)]">{{ loadErrorMessage }}</p>
          }
        </label>
        @if (selectedPositionRequiresApproval()) {
          <p class="rounded-md bg-[var(--color-warning-surface)] p-2 text-xs text-[var(--color-warning-text)]">
            This position requires approval. Your request will be sent to an approver and won't take effect until approved.
          </p>
        }
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-text-secondary)]">Effective from</span>
          <input type="date" class="rounded-md border border-[var(--color-border)] p-2"
            [value]="effectiveFrom()" (change)="effectiveFrom.set($any($event.target).value)" />
        </label>
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="onClose()">Cancel</app-button>
          <app-button type="submit" [loading]="submitting()" [disabled]="!selectedPositionId() || !effectiveFrom() || submitting()" (pressed)="submit()">
            {{ selectedPositionRequiresApproval() ? 'Send for approval' : 'Save' }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePositionModalComponent {
  private readonly peopleApi = inject(PeopleApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly notifications = inject(NotificationService);

  readonly open = input.required<boolean>();
  readonly employeeId = input.required<string>();
  readonly legalEntityId = input.required<string>();
  readonly currentPositionId = input<string | null>(null);
  readonly changeReason = input.required<'Promotion' | 'Transfer'>();
  readonly closed = output<void>();
  readonly changed = output<void>();
  readonly pendingApproval = output<void>();

  readonly modalTitle = computed(() => this.changeReason() === 'Promotion' ? 'Promotion' : 'Transfer');
  readonly positions = signal<readonly PositionListItemResponse[]>([]);
  readonly selectedPositionId = signal('');
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly selectedPositionRequiresApproval = computed(() =>
    this.positions().find((p) => p.id === this.selectedPositionId())?.requiresApproval ?? false);

  constructor() {
    effect(() => { if (this.open()) { this.loadPositions(); } });
  }

  private loadPositions(): void {
    this.loadError.set(null);
    this.positionApi.listFlat(this.legalEntityId(), { pageSize: 100, includeInactive: false }).subscribe({
      next: (page) => { this.positions.set(page.items.filter((p) => p.id !== this.currentPositionId())); },
      error: (err) => { this.loadError.set(toSafeErrorMessage(err, 'Could not load positions.')); }
    });
  }

  submit(): void {
    if (!this.selectedPositionId() || !this.effectiveFrom()) { return; }
    this.submitting.set(true);
    this.peopleApi.changePosition(this.employeeId(), {
      positionId: this.selectedPositionId(),
      effectiveFrom: this.effectiveFrom(),
      changeReason: this.changeReason()
    }).subscribe({
      next: (response) => {
        this.submitting.set(false);
        if (response.pendingApproval) { this.pendingApproval.emit(); } else { this.changed.emit(); }
      },
      error: (err) => { this.submitting.set(false); this.notifications.error(toSafeErrorMessage(err, 'Could not change position.')); }
    });
  }

  onClose(): void { this.selectedPositionId.set(''); this.closed.emit(); }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `ng test --watch=false --include='**/change-position-modal.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/ui/change-position-modal/
git commit -m "feat: lock changeReason on Change Position modal, add sensitivity reminder"
```

---

### Task 5: `employee-detail.component.ts` — action menu + self-position-change hide

**Files:**
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`
- Test: `employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: `app-popover` (`src/app/shared/ui/popover/popover.component.ts` — `open: boolean`, `ariaLabel: string`, `align: 'left'|'right'`, `closed` output, `[popover-trigger]`/`[popover-panel]` projection slots, per `profile-menu.component.ts`'s real usage), Task 1's `employeeId` on the current-user view model, Task 4's updated modal inputs/outputs.

- [ ] **Step 1: Write the failing tests**

Add to `employee-detail.component.spec.ts` (its existing setup already mocks `PeopleApiService`; add whatever service exposes the current user's `employeeId` — Task 1 — to the mock providers):

```typescript
it('hides the Change Position menu entirely when viewing your own record', () => {
  currentUserService.employeeId.and.returnValue('emp-1'); // adjust to the real signal/getter name from Task 1
  api.getEmployeeDetail.and.returnValue(of({ ...detailFixture, id: 'emp-1' }));
  component.load();
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="change-position-trigger"]')).toBeFalsy();
});

it('shows the action menu with Promotion, Transfer, and a disabled Offboarding for another employee', () => {
  currentUserService.employeeId.and.returnValue('emp-99');
  api.getEmployeeDetail.and.returnValue(of({ ...detailFixture, id: 'emp-1' }));
  component.load();
  fixture.detectChanges();
  component.changePositionMenuOpen.set(true);
  fixture.detectChanges();

  const text = fixture.nativeElement.textContent as string;
  expect(text).toContain('Promotion');
  expect(text).toContain('Transfer');
  const offboardingButton = fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]');
  expect(offboardingButton.disabled).toBe(true);
});

it('opens the modal with changeReason=Promotion when Promotion is clicked', () => {
  currentUserService.employeeId.and.returnValue('emp-99');
  api.getEmployeeDetail.and.returnValue(of({ ...detailFixture, id: 'emp-1' }));
  component.load();
  fixture.detectChanges();

  component.openChangePosition('Promotion');

  expect(component.changePositionOpen()).toBe(true);
  expect(component.changePositionReason()).toBe('Promotion');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --watch=false --include='**/employee-detail.component.spec.ts'`
Expected: FAIL

- [ ] **Step 3: Update the component**

Add `PopoverComponent` to the imports array. Add a signal for the reason and rename the open flag's semantics slightly:

```typescript
readonly changePositionMenuOpen = signal(false);
readonly changePositionOpen = signal(false);
readonly changePositionReason = signal<'Promotion' | 'Transfer'>('Promotion');

readonly isOwnRecord = computed(() => this.employee()?.id === this.currentUser.employeeId()); // adjust to Task 1's real accessor

openChangePosition(reason: 'Promotion' | 'Transfer'): void {
  this.changePositionReason.set(reason);
  this.changePositionMenuOpen.set(false);
  this.changePositionOpen.set(true);
}

onPositionPendingApproval(): void {
  this.changePositionOpen.set(false);
  this.notifications.success('Sent for approval.');
  this.load();
}
```

Replace the existing single Change Position `<app-button>` (confirmed today at lines 87–91, guarded by `@if (canChangePosition() && employee.jobInformation.legalEntityId)`) with:

```html
@if (canChangePosition() && !isOwnRecord() && employee.jobInformation.legalEntityId) {
  <app-popover [open]="changePositionMenuOpen()" ariaLabel="Change position actions" align="right" (closed)="changePositionMenuOpen.set(false)">
    <app-button popover-trigger data-testid="change-position-trigger" (pressed)="changePositionMenuOpen.set(!changePositionMenuOpen())">
      Change Position
    </app-button>
    <div popover-panel>
      <button type="button" class="profile-action-btn" (click)="openChangePosition('Promotion')">Promotion</button>
      <button type="button" class="profile-action-btn" (click)="openChangePosition('Transfer')">Transfer</button>
      <button type="button" class="profile-action-btn" data-testid="offboarding-menu-item" disabled title="Not yet available">Offboarding</button>
    </div>
  </app-popover>
}
```

(Match `profile-menu.component.html`'s exact class names/markup shape for the panel items rather than inventing new ones — copy its trigger/panel structure verbatim and just swap the menu items.)

Update the modal usage (existing lines ~208–217) to pass the new required `changeReason` input and handle the new `pendingApproval` output:

```html
<app-change-position-modal
  [open]="changePositionOpen()"
  [employeeId]="employee.id"
  [legalEntityId]="employee.jobInformation.legalEntityId!"
  [currentPositionId]="employee.jobInformation.positionId"
  [changeReason]="changePositionReason()"
  (closed)="changePositionOpen.set(false)"
  (changed)="onPositionChanged()"
  (pendingApproval)="onPositionPendingApproval()"
/>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `ng test --watch=false --include='**/employee-detail.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/feature/employee-detail/
git commit -m "feat: turn Change Position into an action menu, hide on own record"
```

---

### Task 6: Approvals inbox

**Files:**
- Create: `src/app/modules/people/models/access-grant-request.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts` (add `listPendingApprovals()`)
- Create: `src/app/modules/people/feature/approvals-list/approvals-list.component.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/people/people.routes.ts`
- Modify: wherever the People section's nav entries are declared (find the file — likely a layout/nav config, not `people.routes.ts` itself; search for how "Employees"/"Checklists" nav labels are declared)

**Interfaces:**
- Produces: `PeopleApiService.listPendingApprovals(): Observable<PendingAccessGrantRequestResponse[]>`.

- [ ] **Step 1: Add the model**

```typescript
export interface PendingAccessGrantRequestResponse {
  readonly id: string;
  readonly actionType: 'onboarding_position_access' | 'position_change_access';
  readonly employeeName: string | null;
  readonly targetPositionName: string;
  readonly changeReason: string | null;
  readonly requestedByName: string;
  readonly requestedAt: string;
}
```

- [ ] **Step 2: Add the API call**

```typescript
listPendingApprovals(): Observable<PendingAccessGrantRequestResponse[]> {
  return this.http.get<PendingAccessGrantRequestResponse[]>(`${environment.apiUrl}/onboarding/access-grant-requests/pending-for-me`);
}
```

Import `PendingAccessGrantRequestResponse` from the new model file at the top of `people-api.service.ts`.

- [ ] **Step 3: Write the failing component test**

```typescript
it('renders pending requests with employee name, position, and requested-by', () => {
  api.listPendingApprovals.and.returnValue(of([
    { id: 'req-1', actionType: 'position_change_access', employeeName: 'Jane Doe', targetPositionName: 'Head of Security', changeReason: 'Promotion', requestedByName: 'John Smith', requestedAt: '2026-08-17T10:00:00Z' }
  ]));
  fixture.detectChanges();
  const text = fixture.nativeElement.textContent as string;
  expect(text).toContain('Jane Doe');
  expect(text).toContain('Head of Security');
  expect(text).toContain('Promotion');
});

it('approve button calls approveAccessGrantRequest and reloads the list', () => {
  api.listPendingApprovals.and.returnValue(of([{ id: 'req-1', actionType: 'position_change_access', employeeName: 'Jane Doe', targetPositionName: 'Head of Security', changeReason: 'Promotion', requestedByName: 'John Smith', requestedAt: '2026-08-17T10:00:00Z' }]));
  api.approveAccessGrantRequest.and.returnValue(of({} as never));
  fixture.detectChanges();

  component.approve('req-1');

  expect(api.approveAccessGrantRequest).toHaveBeenCalledWith('req-1');
});

it('reject prompts for a note and calls rejectAccessGrantRequest with it', () => {
  api.listPendingApprovals.and.returnValue(of([{ id: 'req-1', actionType: 'position_change_access', employeeName: 'Jane Doe', targetPositionName: 'Head of Security', changeReason: 'Promotion', requestedByName: 'John Smith', requestedAt: '2026-08-17T10:00:00Z' }]));
  api.rejectAccessGrantRequest.and.returnValue(of({} as never));
  fixture.detectChanges();

  component.rejectNote.set('Not enough justification');
  component.reject('req-1');

  expect(api.rejectAccessGrantRequest).toHaveBeenCalledWith('req-1', { decisionNote: 'Not enough justification' });
});
```

Adjust `RejectAccessGrantRequestRequest`'s exact field name (`decisionNote` vs `DecisionNote`, casing) to whatever `onboarding-draft.model.ts` already declares — read it before finalizing this test.

- [ ] **Step 4: Run tests to verify they fail**

Run: `ng test --watch=false --include='**/approvals-list.component.spec.ts'`
Expected: FAIL

- [ ] **Step 5: Build the component**

Follow `employee-list.component.ts`'s established shape exactly (loading/error-with-retry/empty/loaded states, `OnPush`, a presentational `ui/` child table if this module's convention calls for one at this size — a single flat list of pending requests is small enough that inlining the table in the feature component is also acceptable; match whichever `employee-list.component.ts` actually does before deciding). Each row: employee name (or the row's own fallback text "New hire" when `employeeName` is null, since the backend's `pending-for-me` response doesn't separately carry an invited-name field for onboarding rows per the backend plan — if that turns out wrong once Task built, adjust to whatever the real response includes), position, change reason (blank for onboarding rows), requested by, requested at (formatted via whatever date-pipe this module's other list already uses), Approve button, Reject button (opens a small inline note field, not a separate modal, consistent with keeping this page simple).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `ng test --watch=false --include='**/approvals-list.component.spec.ts'`
Expected: PASS

- [ ] **Step 7: Add the route**

In `people.routes.ts`, add a sibling entry to the existing `employees`/`checklists` top-level paths:

```typescript
{
  path: 'approvals',
  loadComponent: () => import('./feature/approvals-list/approvals-list.component').then((m) => m.ApprovalsListComponent),
  canActivate: [permissionGuard],
  data: { title: 'Approvals', permissions: ['roles:manage'] }
}
```

- [ ] **Step 8: Add the nav entry**

Find wherever "Employees"/"Checklists" nav labels are declared for the People section (search the layout/sidebar config, not this routes file) and add an "Approvals" entry pointing at `/people/approvals`, gated the same way the existing entries already are (permission-based visibility, matching this app's established nav-gating pattern).

- [ ] **Step 9: Run the full frontend suite**

Run: `ng test --watch=false`
Expected: PASS (every test)

- [ ] **Step 10: Commit**

```bash
git add src/app/modules/people/models/access-grant-request.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/feature/approvals-list/ src/app/modules/people/people.routes.ts
git commit -m "feat: add Approvals inbox for roles:manage holders"
```

---

### Task 7: Job Journey tab on Employee Detail

**Files:**
- Modify: `src/app/modules/people/data-access/people-api.service.ts` (add `getJobJourney`)
- Create: `src/app/modules/people/models/position-history.model.ts`
- Create: `src/app/modules/people/ui/employee-job-journey/employee-job-journey.component.ts` (+ `.spec.ts`)
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`

**Interfaces:**
- Consumes: `GET /api/v1/employees/{id}/position-history` (backend companion plan Task 10).

- [ ] **Step 1: Add the model and API call**

```typescript
export interface PositionHistoryEntryResponse {
  readonly positionName: string;
  readonly departmentName: string | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly changeReason: 'Promotion' | 'Transfer' | 'LateralMove' | null;
  readonly initiatedByName: string;
  readonly approvedByName: string | null;
}
```

```typescript
getJobJourney(employeeId: string): Observable<PositionHistoryEntryResponse[]> {
  return this.http.get<PositionHistoryEntryResponse[]>(`${environment.apiUrl}/employees/${employeeId}/position-history`);
}
```

- [ ] **Step 2: Write the failing component test**

```typescript
it('renders entries oldest first, with no reason badge on the hire entry', () => {
  fixture.componentRef.setInput('entries', [
    { positionName: 'Senior Engineer', departmentName: 'Engineering', effectiveFrom: '2024-02-01', effectiveTo: '2026-08-16', changeReason: null, initiatedByName: 'System', approvedByName: null },
    { positionName: 'Head of Security', departmentName: 'Security', effectiveFrom: '2026-08-17', effectiveTo: null, changeReason: 'Promotion', initiatedByName: 'Jane Doe', approvedByName: 'John Smith' }
  ]);
  fixture.detectChanges();

  const rows = fixture.nativeElement.querySelectorAll('[data-testid="journey-entry"]');
  expect(rows[0].textContent).toContain('Senior Engineer');
  expect(rows[0].textContent).not.toContain('Promotion');
  expect(rows[1].textContent).toContain('Promotion');
  expect(rows[1].textContent).toContain('Approved by John Smith');
});

it('shows Present instead of an end date for the current entry', () => {
  fixture.componentRef.setInput('entries', [
    { positionName: 'Head of Security', departmentName: 'Security', effectiveFrom: '2026-08-17', effectiveTo: null, changeReason: 'Promotion', initiatedByName: 'Jane Doe', approvedByName: null }
  ]);
  fixture.detectChanges();
  expect((fixture.nativeElement.textContent as string)).toContain('Present');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `ng test --watch=false --include='**/employee-job-journey.component.spec.ts'`
Expected: FAIL

- [ ] **Step 4: Build the component**

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';

@Component({
  selector: 'app-employee-job-journey',
  standalone: true,
  template: `
    <ol class="flex flex-col gap-3">
      @for (entry of entries(); track $index) {
        <li data-testid="journey-entry" class="rounded-lg border border-[var(--color-border)] p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ entry.positionName }}</span>
            @if (entry.changeReason) {
              <span class="rounded-full bg-[var(--color-accent-surface)] px-2 py-0.5 text-xs">{{ entry.changeReason }}</span>
            }
          </div>
          <p class="text-[var(--color-text-secondary)]">{{ entry.departmentName || '—' }}</p>
          <p class="text-xs text-[var(--color-text-secondary)]">{{ entry.effectiveFrom }} – {{ entry.effectiveTo || 'Present' }}</p>
          <p class="text-xs text-[var(--color-text-secondary)]">
            Changed by {{ entry.initiatedByName }}
            @if (entry.approvedByName) { · Approved by {{ entry.approvedByName }} }
          </p>
        </li>
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobJourneyComponent {
  readonly entries = input.required<readonly PositionHistoryEntryResponse[]>();
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `ng test --watch=false --include='**/employee-job-journey.component.spec.ts'`
Expected: PASS

- [ ] **Step 6: Wire it into `employee-detail.component.ts`**

Add `'journey'` to the `activeTab` signal's type union and a tab button for it (matching however the existing four tabs are already rendered — copy that pattern). Add a `jobJourney = signal<readonly PositionHistoryEntryResponse[]>([])` and load it in `load()` alongside the existing `getEmployeeDetail` call: `this.api.getJobJourney(id).subscribe((entries) => this.jobJourney.set(entries));` (fire-and-forget alongside the main load — don't block the page on it, and don't fail the whole page if it errors, just log/ignore, since Job Journey is supplementary to the main detail view). Render `<app-employee-job-journey [entries]="jobJourney()" />` when `activeTab() === 'journey'`.

- [ ] **Step 7: Run the full frontend suite**

Run: `ng test --watch=false`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/models/position-history.model.ts src/app/modules/people/ui/employee-job-journey/ src/app/modules/people/feature/employee-detail/
git commit -m "feat: add Job Journey tab to Employee Detail"
```

---

### Task 8: Manual verification

- [ ] **Step 1: Build**

Run: `ng build`
Expected: clean production build.

- [ ] **Step 2: Manual browser check**

Start both the frontend dev server and the backend API (with the backend companion plan's changes already applied). As a `roles:manage` holder viewing your own employee detail page, confirm the Change Position menu is absent. Viewing another employee, click Promotion into a position you've marked `RequiresApproval` in the position access modal — confirm the reminder appears and Save reads "Send for approval." Submit — confirm the target's current position is unchanged and a "Sent for approval" toast appears. Navigate to `/people/approvals` — confirm the request appears. Log in as the requester and confirm they cannot approve their own request (verify the backend rejects it if the UI doesn't already prevent the click). Log in as a different `roles:manage` holder and approve — confirm the employee's position actually changes, and confirm the Job Journey tab now shows the new entry with both "Changed by" and "Approved by" populated correctly.

- [ ] **Step 3: Commit any fixes found during manual verification**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
