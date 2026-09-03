# Employee Detail Screen — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `EmployeeDetailComponent`'s single flat field list with a section-by-section view (Job/Personal Info, Emergency Contacts, conditionally Payroll) and add a "Change Position" action.

**Architecture:** New `getEmployeeDetail(id)` call on `PeopleApiService` against the new `GET /api/v1/employees/{id}/detail` backend endpoint, typed by a new `EmployeeDetailResponse` model mirroring the backend DTO exactly. Each section becomes its own small presentational `ui/` component (matching `employee-table.component.ts`'s existing `OnPush`, no-API-access precedent). Change Position uses the existing `app-modal` shared component plus `PositionApiService.listFlat` for the dropdown.

**Tech Stack:** Angular 21, standalone components, NgRx Signal Store (not needed here — this page has no shared cross-component state, matches `EmployeeDetailComponent`'s existing signal-only approach), Vitest.

## Global Constraints

- Depends on the backend plan (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-16-employee-detail-screen-backend.md`) being implemented first — this plan consumes `GET /api/v1/employees/{id}/detail` and `POST /api/v1/employees/{id}/change-position`.
- Payroll section visibility is driven entirely by whether `employee.payroll` is present in the response — no `*appHasPermission` directive needed for it (backend already omits the field for unauthorized callers).
- No edit actions on Personal Information/Emergency Contacts/Payroll from this screen — read-only, per the design spec.
- All commands run from `Hrms--Web-application---front-end---v1/` root.

---

### Task 1: `EmployeeDetailResponse` model + API service method

**Files:**
- Modify: `src/app/modules/people/models/employee.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Test: `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces:**
- Produces: `PeopleApiService.getEmployeeDetail(id: string): Observable<EmployeeDetailResponse>`.

- [ ] **Step 1: Add the model**

In `employee.model.ts`, add:

```typescript
export interface EmployeeDetailResponse {
  readonly id: string;
  readonly jobInformation: EmployeeDetailJobInformation;
  readonly personalInformation: EmployeeDetailPersonalInformation;
  readonly emergencyContacts: readonly EmployeeDetailEmergencyContact[];
  readonly payroll: EmployeeDetailPayroll | null;
  readonly invitationStatus: string | null;
  readonly invitationExpiresAt: string | null;
}

export interface EmployeeDetailJobInformation {
  readonly employeeNumber: string;
  readonly legalEntityId: string | null;
  readonly legalEntityName: string | null;
  readonly departmentName: string | null;
  readonly positionName: string | null;
  readonly positionId: string | null;
  readonly reportingManagerName: string | null;
  readonly employmentTypeLabel: string;
  readonly status: string;
  readonly hireDate: string;
  readonly probationEndDate: string | null;
}

export interface EmployeeDetailPersonalInformation {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly gender: string | null;
  readonly nationalityId: string | null;
  readonly addresses: readonly EmployeeDetailAddress[];
}

export interface EmployeeDetailAddress {
  readonly id: string;
  readonly addressType: string;
  readonly addressJson: string;
  readonly isPrimary: boolean;
}

export interface EmployeeDetailEmergencyContact {
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
  readonly phone: string;
  readonly email: string | null;
  readonly isPrimary: boolean;
}

export interface EmployeeDetailPayroll {
  readonly hasBankDetailsOnFile: boolean;
  readonly bankName: string | null;
  readonly maskedAccountNumber: string | null;
  readonly accountType: string | null;
}

export interface ChangePositionPayload {
  readonly positionId: string;
  readonly effectiveFrom: string;
}
```

- [ ] **Step 2: Write the failing test**

In `people-api.service.spec.ts`, add (matching this file's existing HTTP-testing setup — `HttpTestingController`):

```typescript
  it('getEmployeeDetail sends GET to /employees/{id}/detail', () => {
    service.getEmployeeDetail('emp-1').subscribe();
    const req = httpMock.expectOne(`${apiUrl}/employees/emp-1/detail`);
    expect(req.request.method).toBe('GET');
    req.flush({} as EmployeeDetailResponse);
  });

  it('changePosition sends POST to /employees/{id}/change-position with the payload', () => {
    service.changePosition('emp-1', { positionId: 'pos-1', effectiveFrom: '2026-09-01' }).subscribe();
    const req = httpMock.expectOne(`${apiUrl}/employees/emp-1/change-position`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ positionId: 'pos-1', effectiveFrom: '2026-09-01' });
    req.flush(null);
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `ng test --watch=false --include='**/people-api.service.spec.ts'`
Expected: FAIL (methods don't exist)

- [ ] **Step 4: Add the service methods**

In `people-api.service.ts`, add:

```typescript
  getEmployeeDetail(id: string): Observable<EmployeeDetailResponse> {
    return this.http.get<EmployeeDetailResponse>(`${environment.apiUrl}/employees/${id}/detail`);
  }

  changePosition(id: string, payload: ChangePositionPayload): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/employees/${id}/change-position`, payload);
  }
```

Add `EmployeeDetailResponse, ChangePositionPayload` to the existing `models/employee.model` import at the top of the file.

- [ ] **Step 5: Run the test to verify it passes**

Run: `ng test --watch=false --include='**/people-api.service.spec.ts'`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/models/employee.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat: add EmployeeDetailResponse model and getEmployeeDetail/changePosition API calls"
```

---

### Task 2: Section presentational components

**Files:**
- Create: `src/app/modules/people/ui/employee-job-info/employee-job-info.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/employee-personal-info/employee-personal-info.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/employee-emergency-contacts/employee-emergency-contacts.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/ui/employee-payroll/employee-payroll.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Each takes its slice of `EmployeeDetailResponse` as a required `input()` and renders it. No API calls, no `inject()` of any service beyond nothing — pure presentational, matching `employee-table.component.ts`'s existing shape.

- [ ] **Step 1: Write the failing test for `employee-job-info`**

`employee-job-info.component.spec.ts` (match `employee-table.component.spec.ts`'s existing render-given-input test style):

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeJobInfoComponent } from './employee-job-info.component';
import { EmployeeDetailJobInformation } from '../../models/employee.model';

describe('EmployeeJobInfoComponent', () => {
  let fixture: ComponentFixture<EmployeeJobInfoComponent>;

  const jobInfo: EmployeeDetailJobInformation = {
    employeeNumber: 'E-100', legalEntityName: 'Acme Inc', departmentName: 'Engineering',
    positionName: 'Senior Engineer', positionId: 'pos-1', reportingManagerName: 'Jane Doe',
    employmentTypeLabel: 'Full-time', status: 'active', hireDate: '2026-01-01', probationEndDate: null
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmployeeJobInfoComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeeJobInfoComponent);
    fixture.componentRef.setInput('jobInformation', jobInfo);
    fixture.detectChanges();
  });

  it('renders the position and department', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Senior Engineer');
    expect(text).toContain('Engineering');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --watch=false --include='**/employee-job-info.component.spec.ts'`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create `employee-job-info.component.ts`**

```typescript
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailJobInformation } from '../../models/employee.model';

@Component({
  selector: 'app-employee-job-info',
  standalone: true,
  template: `
    <dl class="grid max-w-2xl grid-cols-2 gap-y-3 rounded-lg border border-[var(--color-border)] p-4 text-sm">
      <dt class="text-[var(--color-text-secondary)]">Employee number</dt>
      <dd>{{ jobInformation().employeeNumber }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Position</dt>
      <dd>{{ jobInformation().positionName || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Department</dt>
      <dd>{{ jobInformation().departmentName || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Legal Entity</dt>
      <dd>{{ jobInformation().legalEntityName || '—' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Employment Type</dt>
      <dd>{{ jobInformation().employmentTypeLabel }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Status</dt>
      <dd class="capitalize">{{ jobInformation().status }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Reporting Manager</dt>
      <dd>{{ jobInformation().reportingManagerName || 'Unassigned' }}</dd>
      <dt class="text-[var(--color-text-secondary)]">Hire Date</dt>
      <dd>{{ jobInformation().hireDate }}</dd>
    </dl>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobInfoComponent {
  readonly jobInformation = input.required<EmployeeDetailJobInformation>();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `ng test --watch=false --include='**/employee-job-info.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Repeat Steps 1–4 for the remaining three sections**

`EmployeePersonalInfoComponent` (`input.required<EmployeeDetailPersonalInformation>()`, renders name/email/phone/DOB/gender + an addresses list), `EmployeeEmergencyContactsComponent` (`input.required<readonly EmployeeDetailEmergencyContact[]>()`, renders a list or an empty state "No emergency contacts on file."), `EmployeePayrollComponent` (`input.required<EmployeeDetailPayroll>()` — note this one's *presence* is already gated by the parent, per Task 3, so the component itself always has data when rendered; renders bank name, masked account number, account type). Each gets the same test-first treatment as Steps 1–4, one commit each or one combined commit for all three — match whatever granularity feels natural, this file's structure doesn't require a hard split.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/ui/employee-job-info/ src/app/modules/people/ui/employee-personal-info/ src/app/modules/people/ui/employee-emergency-contacts/ src/app/modules/people/ui/employee-payroll/
git commit -m "feat: add employee detail section presentational components"
```

---

### Task 3: Rebuild `EmployeeDetailComponent`

**Files:**
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts` (create if it doesn't exist yet)

**Interfaces:**
- Consumes: `PeopleApiService.getEmployeeDetail`, the four section components from Task 2.

- [ ] **Step 1: Write the failing test**

```typescript
  it('renders the Payroll section when the response includes it', () => {
    api.getEmployeeDetail.and.returnValue(of({ ...detailFixture, payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' } }));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeTruthy();
  });

  it('omits the Payroll section when the response does not include it', () => {
    api.getEmployeeDetail.and.returnValue(of({ ...detailFixture, payroll: null }));
    component.load();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeFalsy();
  });
```

Build out the full spec file matching `employee-list.component.spec.ts`'s existing loading/error/loaded-state test structure (this component already has that shape today for its minimal version — extend it, don't replace it wholesale).

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --watch=false --include='**/employee-detail.component.spec.ts'`
Expected: FAIL

- [ ] **Step 3: Rewrite the component**

```typescript
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeJobInfoComponent } from '../../ui/employee-job-info/employee-job-info.component';
import { EmployeePersonalInfoComponent } from '../../ui/employee-personal-info/employee-personal-info.component';
import { EmployeeEmergencyContactsComponent } from '../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../ui/employee-payroll/employee-payroll.component';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';

@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    RouterLink, ButtonComponent, ErrorStateComponent, LoaderComponent, PageHeaderComponent, ModalComponent,
    EmployeeJobInfoComponent, EmployeePersonalInfoComponent, EmployeeEmergencyContactsComponent,
    EmployeePayrollComponent, ChangePositionModalComponent
  ],
  template: `
    @if (loading()) {
      <app-loader label="Loading employee…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (employee(); as employee) {
      <app-page-header [title]="employee.personalInformation.firstName + ' ' + employee.personalInformation.lastName" [subtitle]="employee.personalInformation.email">
        <a routerLink="/people/employees">
          <span class="text-sm font-medium text-[var(--color-accent)] hover:underline">Back to Employees</span>
        </a>
      </app-page-header>

      <div class="mt-4 flex flex-col gap-6">
        <div>
          <div class="mb-2 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">Job Information</h3>
            <app-button (pressed)="changePositionOpen.set(true)">Change Position</app-button>
          </div>
          <app-employee-job-info [jobInformation]="employee.jobInformation" />
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Personal Information</h3>
          <app-employee-personal-info [personalInformation]="employee.personalInformation" />
        </div>

        <div>
          <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Emergency Contacts</h3>
          <app-employee-emergency-contacts [contacts]="employee.emergencyContacts" />
        </div>

        @if (employee.payroll; as payroll) {
          <div>
            <h3 class="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Payroll & Statutory</h3>
            <app-employee-payroll [payroll]="payroll" />
          </div>
        }
      </div>

      @if (employee.invitationStatus === 'expired') {
        <div class="mt-4 max-w-2xl rounded-lg border border-[var(--color-border)] p-4 text-sm">
          <p class="mb-3 text-[var(--color-text-secondary)]">
            This employee's onboarding invitation expired before they set up their account.
          </p>
          <app-button [loading]="resending()" [disabled]="resending()" (pressed)="resendInvitation(employee.id)">
            Resend invitation
          </app-button>
        </div>
      }

      <app-change-position-modal
        [open]="changePositionOpen()"
        [employeeId]="employee.id"
        [legalEntityId]="employee.jobInformation.legalEntityId!"
        [currentPositionId]="employee.jobInformation.positionId"
        (closed)="changePositionOpen.set(false)"
        (changed)="onPositionChanged()"
      />
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PeopleApiService);
  private readonly notifications = inject(NotificationService);

  readonly employee = signal<EmployeeDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resending = signal(false);
  readonly changePositionOpen = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api.getEmployeeDetail(id).subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'The employee or selected organization record could not be found.'));
      }
    });
  }

  resendInvitation(employeeId: string): void {
    this.resending.set(true);
    this.api.resendInvitation(employeeId).subscribe({
      next: () => {
        this.resending.set(false);
        this.notifications.success('Invitation resent.');
        this.load();
      },
      error: (err) => {
        this.resending.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not resend the invitation.'));
      }
    });
  }

  onPositionChanged(): void {
    this.changePositionOpen.set(false);
    this.notifications.success('Position updated.');
    this.load();
  }
}
```

Note: `ChangePositionModalComponent` is built in Task 4 — this step will not compile until that task's file exists. If executing tasks strictly in order via a fresh subagent per task, do Task 4 immediately after this step rather than waiting for a full separate review cycle, or temporarily stub the import.

- [ ] **Step 4: Run the test to verify it passes (after Task 4 also lands)**

Run: `ng test --watch=false --include='**/employee-detail.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/feature/employee-detail/employee-detail.component.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat: rebuild employee detail page with section components and Change Position action"
```

---

### Task 4: Change Position modal

**Files:**
- Create: `src/app/modules/people/ui/change-position-modal/change-position-modal.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Produces: `<app-change-position-modal [open] [employeeId] [currentPositionId] (closed) (changed)>`. Consumes `PositionApiService.listFlat` (organization module, already used elsewhere for dependency-filtered dropdowns per the add-employee-wizard precedent) and `PeopleApiService.changePosition`.

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ChangePositionModalComponent } from './change-position-modal.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { NotificationService } from '../../../../core/services/notification.service';

describe('ChangePositionModalComponent', () => {
  let fixture: ComponentFixture<ChangePositionModalComponent>;
  let component: ChangePositionModalComponent;
  let peopleApi: jasmine.SpyObj<PeopleApiService>;
  let positionApi: jasmine.SpyObj<PositionApiService>;

  beforeEach(async () => {
    peopleApi = jasmine.createSpyObj('PeopleApiService', ['changePosition']);
    positionApi = jasmine.createSpyObj('PositionApiService', ['listFlat']);
    positionApi.listFlat.and.returnValue(of({ items: [{ id: 'pos-2', name: 'Manager' }], totalCount: 1, page: 1, pageSize: 25 } as never));

    await TestBed.configureTestingModule({
      imports: [ChangePositionModalComponent],
      providers: [
        { provide: PeopleApiService, useValue: peopleApi },
        { provide: PositionApiService, useValue: positionApi },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePositionModalComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.componentRef.setInput('currentPositionId', 'pos-1');
    fixture.detectChanges();
  });

  it('emits changed and calls changePosition on submit', () => {
    peopleApi.changePosition.and.returnValue(of(undefined));
    const changedSpy = jasmine.createSpy('changed');
    component.changed.subscribe(changedSpy);

    component.selectedPositionId.set('pos-2');
    component.submit();

    expect(peopleApi.changePosition).toHaveBeenCalledWith('emp-1', jasmine.objectContaining({ positionId: 'pos-2' }));
    expect(changedSpy).toHaveBeenCalled();
  });

  it('shows the backend conflict message on a 409 and does not emit changed', () => {
    peopleApi.changePosition.and.returnValue(throwError(() => ({ status: 409, error: { detail: 'This position has reached its capacity.' } })));
    const changedSpy = jasmine.createSpy('changed');
    component.changed.subscribe(changedSpy);

    component.selectedPositionId.set('pos-2');
    component.submit();

    expect(changedSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --watch=false --include='**/change-position-modal.component.spec.ts'`
Expected: FAIL (component doesn't exist)

- [ ] **Step 3: Create the component**

```typescript
import { ChangeDetectionStrategy, Component, inject, input, output, signal, effect } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PositionResponse } from '../../../organization/models/position.model';

@Component({
  selector: 'app-change-position-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Change Position" (closed)="onClose()">
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-text-secondary)]">New position</span>
          <select
            class="rounded-md border border-[var(--color-border)] p-2"
            (change)="selectedPositionId.set($any($event.target).value)"
          >
            <option value="">Select a position…</option>
            @for (position of positions(); track position.id) {
              <option [value]="position.id" [selected]="position.id === selectedPositionId()">{{ position.name }}</option>
            }
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-text-secondary)]">Effective from</span>
          <input
            type="date"
            class="rounded-md border border-[var(--color-border)] p-2"
            [value]="effectiveFrom()"
            (change)="effectiveFrom.set($any($event.target).value)"
          />
        </label>
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="onClose()">Cancel</app-button>
          <app-button [loading]="submitting()" [disabled]="!selectedPositionId() || submitting()" (pressed)="submit()">
            Save
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
  readonly closed = output<void>();
  readonly changed = output<void>();

  readonly positions = signal<readonly PositionResponse[]>([]);
  readonly selectedPositionId = signal('');
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));
  readonly submitting = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.loadPositions();
      }
    });
  }

  private loadPositions(): void {
    this.positionApi.listFlat(this.legalEntityId()).subscribe((page) => {
      this.positions.set(page.items.filter((p) => p.id !== this.currentPositionId()));
    });
  }

  submit(): void {
    if (!this.selectedPositionId()) {
      return;
    }
    this.submitting.set(true);
    this.peopleApi.changePosition(this.employeeId(), {
      positionId: this.selectedPositionId(),
      effectiveFrom: this.effectiveFrom()
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.changed.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not change position.'));
      }
    });
  }

  onClose(): void {
    this.selectedPositionId.set('');
    this.closed.emit();
  }
}
```

This requires `EmployeeDetailJobInformation` to carry a raw `legalEntityId` (not just `legalEntityName`) — already added to both the backend DTO (backend plan Task 3) and this plan's Task 1 model while writing this task, so the field exists by the time this component is built. `EmployeeDetailComponent`'s template (Task 3) must pass it: add `[legalEntityId]="employee.jobInformation.legalEntityId"` to the `<app-change-position-modal>` tag there — do this as part of Task 3, not deferred.

- [ ] **Step 4: Run the test to verify it passes**

Run: `ng test --watch=false --include='**/change-position-modal.component.spec.ts'`
Expected: PASS (both tests)

- [ ] **Step 5: Run the full frontend suite**

Run: `ng test --watch=false`
Expected: PASS (every test, including `employee-detail.component.spec.ts` from Task 3, now that this component exists)

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/ui/change-position-modal/
git commit -m "feat: add Change Position modal"
```

---

### Task 5: Manual verification

- [ ] **Step 1: Build**

Run: `ng build`
Expected: clean production build.

- [ ] **Step 2: Manual browser check**

Start the frontend dev server and the backend API locally (both plans' backend endpoints must be running). Navigate to an employee's detail page as a user with `employees:read` + coverage but **without** `employees:read:sensitive` — confirm the Payroll section does not render at all. Log in as a user **with** `employees:read:sensitive` on the same employee — confirm masked bank details render. Click "Change Position," select a different position, submit — confirm the page reloads with the new position shown, and the old position's seat is freed (verify by attempting to reassign a third employee into the vacated position's old slot if capacity was 1).

- [ ] **Step 3: Commit if any fixes were needed during manual verification**

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```
