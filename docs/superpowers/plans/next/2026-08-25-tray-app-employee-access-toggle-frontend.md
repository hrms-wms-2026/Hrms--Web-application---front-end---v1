# Tray App Employee Access Toggle (Phase A, Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Tray App Access" checkbox to the Employee Detail page so an
`employees:write`-holding admin/HR user can block a specific employee from connecting the
desktop tray agent, calling the backend's new `POST /employees/{id}/tray-app-access` endpoint.

**Architecture:** One new `PeopleApiService` method, one new field on the `EmployeeDetailResponse`
model, and a small addition to the existing `EmployeeDetailComponent` (header actions row) —
no new files, no new store. Requires the backend plan
(`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-25-tray-app-employee-access-toggle-backend.md`)
to be implemented first, since this depends on the new endpoint and the new
`trayAppAccessEnabled` field existing on `GET /employees/{id}/detail`.

**Tech Stack:** Angular 21 standalone components, `signal()`, Vitest (`npx ng test --watch=false`,
run from `Hrms--Web-application---front-end---v1/`).

**Spec:** `docs/superpowers/specs/next/2026-08-25-tray-app-employee-access-toggle-frontend-design.md`

---

### Task 1: Model + API service method

**Files:**
- Modify: `src/app/modules/people/models/employee.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Test: `src/app/modules/people/data-access/people-api.service.spec.ts`

- [ ] **Step 1: Add the field to the model**

In `models/employee.model.ts`, add to `EmployeeDetailResponse` (after `invitationExpiresAt`):

```ts
export interface EmployeeDetailResponse {
  readonly id: string;
  readonly jobInformation: EmployeeDetailJobInformation;
  readonly personalInformation: EmployeeDetailPersonalInformation;
  readonly emergencyContacts: readonly EmployeeDetailEmergencyContact[];
  readonly payroll: EmployeeDetailPayroll | null;
  readonly invitationStatus: string | null;
  readonly invitationExpiresAt: string | null;
  readonly trayAppAccessEnabled: boolean;
}
```

- [ ] **Step 2: Write the failing test for the API method**

Add to `people-api.service.spec.ts`, near the other simple POST-action tests (e.g. alongside
`resendInvitation`'s test):

```ts
  it('posts the enabled flag to /employees/{id}/tray-app-access', () => {
    service.setTrayAppAccess('emp-1', false).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/tray-app-access`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush(null);
  });
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx ng test --watch=false`
Expected: FAIL — `service.setTrayAppAccess` is not a function.

- [ ] **Step 4: Implement the method**

In `people-api.service.ts`, add right after `resendInvitation` (currently ends at line 59):

```ts
  setTrayAppAccess(id: string, enabled: boolean): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/employees/${id}/tray-app-access`, { enabled });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/models/employee.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat: add PeopleApiService.setTrayAppAccess"
```

---

### Task 2: Employee Detail toggle

**Files:**
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`
- Test: `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts`

- [ ] **Step 1: Add `trayAppAccessEnabled` to the existing test fixture**

In `employee-detail.component.spec.ts`, add to `detailFixture` (after `invitationExpiresAt: null`):

```ts
    invitationExpiresAt: null,
    trayAppAccessEnabled: true
```

- [ ] **Step 2: Write the failing tests**

Add these `it` blocks near the existing permission-gated-action tests in the same file
(the `setup()` helper already supports `apiOverrides` and `hasWritePermission` — no changes
needed there):

```ts
  it('shows the tray app access toggle checked when trayAppAccessEnabled is true', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const toggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="tray-app-access-toggle"]');
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(true);
  });

  it('shows the toggle unchecked when trayAppAccessEnabled is false', () => {
    const { fixture } = setup({ ...detailFixture, trayAppAccessEnabled: false });
    fixture.detectChanges();

    const toggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="tray-app-access-toggle"]');
    expect(toggle.checked).toBe(false);
  });

  it('hides the toggle without employees:write', () => {
    const { fixture } = setup(detailFixture, {}, false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="tray-app-access-toggle"]')).toBeNull();
  });

  it('toggling calls setTrayAppAccess with the flipped value and reloads on success', () => {
    const setTrayAppAccess = vi.fn().mockReturnValue(of(undefined));
    const getEmployeeDetail = vi.fn()
      .mockReturnValueOnce(of(detailFixture))
      .mockReturnValueOnce(of({ ...detailFixture, trayAppAccessEnabled: false }));
    const { fixture, notificationsStub } = setup(detailFixture, { setTrayAppAccess, getEmployeeDetail });
    fixture.detectChanges();

    const toggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="tray-app-access-toggle"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(setTrayAppAccess).toHaveBeenCalledWith('emp-1', false);
    expect(getEmployeeDetail).toHaveBeenCalledTimes(2);
    expect(notificationsStub.success).toHaveBeenCalled();
  });

  it('shows an error notification and re-enables the toggle on failure', () => {
    const setTrayAppAccess = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const { fixture, notificationsStub } = setup(detailFixture, { setTrayAppAccess });
    fixture.detectChanges();

    const toggle: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="tray-app-access-toggle"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(notificationsStub.error).toHaveBeenCalled();
    expect(toggle.disabled).toBe(false);
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx ng test --watch=false`
Expected: FAIL — `[data-testid="tray-app-access-toggle"]` doesn't exist yet, and
`PeopleApiService` (the real one, not a stub method) has no `setTrayAppAccess` call site in the
component to invoke the stub.

- [ ] **Step 4: Add component state and the handler method**

In `employee-detail.component.ts`, add a new signal next to `resending` (line 296):

```ts
  readonly resending = signal(false);
  readonly trayAppAccessUpdating = signal(false);
```

Add a new computed next to `canChangePosition` (line 303):

```ts
  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canManageTrayAppAccess = computed(() => this.permissionService.hasPermission('employees:write'));
```

Add the handler method next to `resendInvitation` (after line 356):

```ts
  setTrayAppAccess(employeeId: string, enabled: boolean): void {
    this.trayAppAccessUpdating.set(true);
    this.api.setTrayAppAccess(employeeId, enabled).subscribe({
      next: () => {
        this.trayAppAccessUpdating.set(false);
        this.notifications.success(enabled ? 'Tray app access enabled.' : 'Tray app access disabled.');
        this.load();
      },
      error: (err) => {
        this.trayAppAccessUpdating.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not update tray app access.'));
      }
    });
  }
```

- [ ] **Step 5: Add the template markup**

In the template's actions row (inside the `<div class="flex items-center gap-3">` block that
currently holds the Transfer/Promote popover and Resend invitation button, lines 93-113), add
the toggle as the first child of that div:

```html
          <div class="flex items-center gap-3">
            @if (canManageTrayAppAccess()) {
              <label class="tray-access-toggle">
                <input
                  type="checkbox"
                  data-testid="tray-app-access-toggle"
                  [checked]="employee.trayAppAccessEnabled"
                  [disabled]="trayAppAccessUpdating()"
                  (change)="setTrayAppAccess(employee.id, $any($event.target).checked)"
                />
                <span>Tray App Access</span>
              </label>
            }
            @if (canChangePosition() && !isOwnRecord() && employee.jobInformation.legalEntityId && !isReadOnly() && employee.invitationStatus !== 'pending' && employee.invitationStatus !== 'expired') {
```

(the rest of that block — the popover and its closing `}`, the Resend invitation `@if`, and the
closing `</div>` — is unchanged).

- [ ] **Step 6: Add the toggle's styles**

In the component's `styles` array, add after the existing `.change-position-menu` rule
(currently ends at line 254):

```css
    .tray-access-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--color-text-primary);
      cursor: pointer;
    }

    .tray-access-toggle input[type='checkbox'] {
      cursor: pointer;
    }

    .tray-access-toggle input[type='checkbox']:disabled {
      cursor: not-allowed;
    }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx ng test --watch=false`
Expected: PASS — all 5 new tests green, plus every pre-existing `EmployeeDetailComponent` test
still passing (the new `@if` block is additive and gated on the same `employees:write`
permission the existing tests already stub via `hasWritePermission`).

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/people/feature/employee-detail/employee-detail.component.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat: add Tray App Access toggle to Employee Detail page"
```

---

### Task 3: Full regression run

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx ng test --watch=false`
Expected: PASS — no regressions.

- [ ] **Step 2: Manual smoke check (requires the backend Phase A plan already implemented)**

Start the dev server (`npm start`), log in as an Acme Owner/HR Manager seed user, open an
employee's detail page, confirm the "Tray App Access" checkbox shows checked (default `true`),
toggle it off, confirm a success notification and the checkbox reflects the new state after
reload. Log in as that toggled-off employee's own tray app flow (or hit the backend directly)
and confirm `generate`/`exchange` now return `403`.

- [ ] **Step 3: Commit (only if the smoke check surfaced a fix)**

```bash
git add -A
git commit -m "fix: <describe whatever the smoke check turned up>"
```
