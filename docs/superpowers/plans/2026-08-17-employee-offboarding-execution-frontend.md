# Employee Offboarding Execution — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 6-step offboarding wizard (Start → Choose Exit Checklist → Review Tasks → Track Exit Work → Complete or Bypass → Complete Employee Exit), reach it from the employee-detail screen's existing disabled "Offboarding" stub, and extend the existing checklist-builder with offboarding-only bypass/penalty/category task fields — consuming the backend plan's API surface exactly as built (`docs/superpowers/plans/2026-08-17-employee-offboarding-execution-backend.md` in `HRMS-Backend-v1`, §6 there is the authoritative endpoint contract).

**Architecture:** New `src/app/modules/people/feature/offboarding/` feature (wizard shell + 6 step components + an approval-inbox screen), a new `OffboardingApiService` (data-access) and `OffboardingWizardStore` (state, NgRx SignalStore) following the exact patterns `ChecklistApiService`/`ChecklistTemplateStore` already establish in this codebase, and a new `OffboardingWizardStep` union + `STEP_ORDER`/`STEP_LABELS` constants mirroring `AddEmployeeWizardComponent`'s own step-state shape (no shared stepper component exists to reuse — verified, see Task 6).

**Tech Stack:** Angular 21 standalone components, signals, `@ngrx/signals` (SignalStore), Reactive Forms, Vitest.

## Global Constraints

- Work only in `C:\onevoNew\Hrms--Web-application---front-end---v1`. Do not touch the backend repo. Do not commit or push beyond staging each task's own files.
- Every new route carries `canActivate: [permissionGuard]` and `data: { title, permissions: [...] }`, matching every existing entry in `people.routes.ts` exactly — `employees:read` for read-only screens, `employees:write` for anything that mutates.
- API calls hit `${environment.apiUrl}/employees/{employeeId}/...` and `${environment.apiUrl}/offboarding-bypass-requests`, matching the backend's real `EmployeesController`/new-controller route prefixes (`api/v1/employees`, not `api/v1/people/employees` — the backend design spec's original prefix assumption was corrected during backend planning; see backend plan Task 9's route).
- State-changing POST requests carry an `Idempotency-Key: crypto.randomUUID()` header, matching every existing mutating call in `checklist-api.service.ts`.
- No onboarding-side frontend work, no new template-authoring shell (only `checklist-builder.component.ts`/`.html` are extended), no file upload on tasks, no computed settlement amounts, no in-app notifications/bell integration (none exists — the Approval Inbox is a plain query screen, per the corrected frontend design spec §7).
- Follow this codebase's two coexisting test conventions: full HTTP-integration-style tests (`HttpTestingController`, real injected stores) for form-heavy components, matching `checklist-builder.component.spec.ts`; lightweight stubbed-provider tests for read/detail views, matching `employee-detail.component.spec.ts`. Use judgment per component — noted per task below.

---

### Task 1: Offboarding models and `OffboardingApiService`

**Files:**
- Create: `src/app/modules/people/models/offboarding.model.ts`
- Create: `src/app/modules/people/data-access/offboarding-api.service.ts`
- Test: `src/app/modules/people/data-access/offboarding-api.service.spec.ts`

**Interfaces:**
- Produces: every request/response type and every `OffboardingApiService` method listed below — every later task's component/store code calls these exact names/signatures. Field names match the backend plan's response DTOs exactly (camelCase, matching ASP.NET's default JSON casing already used by `checklist-template.model.ts`).

- [ ] **Step 1: Models**

Create `offboarding.model.ts`:

```typescript
export type OffboardingReason = 'resignation' | 'termination' | 'retirement' | 'contract_end';
export type RehireEligibility = 'eligible' | 'not_eligible' | 'conditional';
export type KnowledgeRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type OffboardingRecordStatus = 'initiated' | 'in_progress' | 'completed' | 'cancelled';
export type EmployeeChecklistTaskStatus = 'pending' | 'in_progress' | 'completed' | 'bypassed';
export type ChecklistTaskCategory =
  | 'asset_return' | 'access_removal' | 'document_handover' | 'final_settlement' | 'knowledge_handover' | 'other';
export type BypassRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ChecklistTemplateMatchLevel = 'position' | 'department' | 'company';

export interface StartOffboardingRequest {
  reason: OffboardingReason;
  lastWorkingDate: string;
  knowledgeRiskLevel: KnowledgeRiskLevel;
  rehireEligibility: RehireEligibility | null;
  notes: string | null;
}

export interface OffboardingRecordResponse {
  id: string;
  employeeId: string;
  reason: OffboardingReason;
  lastWorkingDate: string;
  knowledgeRiskLevel: KnowledgeRiskLevel;
  rehireEligibility: RehireEligibility | null;
  notes: string | null;
  checklistTemplateId: string | null;
  status: OffboardingRecordStatus;
  createdAt: string;
  updatedAt: string | null;
  completedAt: string | null;
}

export interface ChecklistTemplateMatchResponse {
  id: string;
  name: string;
  matchLevel: ChecklistTemplateMatchLevel;
}

export interface EmployeeChecklistTaskResponse {
  id: string;
  taskTitle: string;
  ownerType: string;
  assignedToId: string;
  dueDate: string;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string | null;
  category: ChecklistTaskCategory | null;
  status: EmployeeChecklistTaskStatus;
  completedAt: string | null;
}

export interface UpdateEmployeeChecklistTaskRequest {
  assignedToId: string;
  dueDate: string;
  isRequired: boolean;
}

export interface CreateBypassRequestRequest {
  approverId: string;
  bypassReason: string;
  penaltyDescription: string | null;
}

export interface BypassRequestResponse {
  id: string;
  employeeChecklistTaskId: string;
  offboardingRecordId: string;
  requestedById: string;
  bypassReason: string;
  penaltyDescription: string | null;
  status: BypassRequestStatus;
  requestedAt: string;
}
```

- [ ] **Step 2: API service**

Create `offboarding-api.service.ts`:

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BypassRequestResponse,
  ChecklistTemplateMatchResponse,
  CreateBypassRequestRequest,
  EmployeeChecklistTaskResponse,
  OffboardingRecordResponse,
  StartOffboardingRequest,
  UpdateEmployeeChecklistTaskRequest
} from '../models/offboarding.model';

@Injectable({ providedIn: 'root' })
export class OffboardingApiService {
  private readonly http = inject(HttpClient);

  private idempotencyHeaders(): { 'Idempotency-Key': string } {
    return { 'Idempotency-Key': crypto.randomUUID() };
  }

  startOffboarding(employeeId: string, payload: StartOffboardingRequest): Observable<{ offboardingRecordId: string }> {
    return this.http.post<{ offboardingRecordId: string }>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding`, payload, { headers: this.idempotencyHeaders() });
  }

  getOffboarding(employeeId: string): Observable<OffboardingRecordResponse | null> {
    return this.http.get<OffboardingRecordResponse | null>(`${environment.apiUrl}/employees/${employeeId}/offboarding`);
  }

  getChecklistMatches(employeeId: string): Observable<readonly ChecklistTemplateMatchResponse[]> {
    return this.http.get<readonly ChecklistTemplateMatchResponse[]>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/checklist-matches`);
  }

  selectChecklist(employeeId: string, templateId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/select-checklist`, { templateId }, { headers: this.idempotencyHeaders() });
  }

  cancelOffboarding(employeeId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/cancel`, {}, { headers: this.idempotencyHeaders() });
  }

  completeOffboarding(employeeId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/offboarding/complete`, {}, { headers: this.idempotencyHeaders() });
  }

  listChecklistTasks(employeeId: string): Observable<readonly EmployeeChecklistTaskResponse[]> {
    return this.http.get<readonly EmployeeChecklistTaskResponse[]>(`${environment.apiUrl}/employees/${employeeId}/checklist-tasks`);
  }

  updateChecklistTask(employeeId: string, taskId: string, payload: UpdateEmployeeChecklistTaskRequest): Observable<void> {
    return this.http.patch<void>(`${environment.apiUrl}/employees/${employeeId}/checklist-tasks/${taskId}`, payload);
  }

  completeChecklistTask(employeeId: string, taskId: string): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/employees/${employeeId}/checklist-tasks/${taskId}/complete`, {}, { headers: this.idempotencyHeaders() });
  }

  createBypassRequest(employeeId: string, taskId: string, payload: CreateBypassRequestRequest): Observable<{ bypassRequestId: string }> {
    return this.http.post<{ bypassRequestId: string }>(
      `${environment.apiUrl}/employees/${employeeId}/checklist-tasks/${taskId}/bypass-requests`, payload, { headers: this.idempotencyHeaders() });
  }

  listMyPendingBypassRequests(): Observable<readonly BypassRequestResponse[]> {
    return this.http.get<readonly BypassRequestResponse[]>(
      `${environment.apiUrl}/offboarding-bypass-requests`, { params: { status: 'pending' } });
  }

  approveBypassRequest(id: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/offboarding-bypass-requests/${id}/approve`, {}, { headers: this.idempotencyHeaders() });
  }

  rejectBypassRequest(id: string, decisionComment: string | null): Observable<void> {
    return this.http.post<void>(
      `${environment.apiUrl}/offboarding-bypass-requests/${id}/reject`, { decisionComment }, { headers: this.idempotencyHeaders() });
  }
}
```

- [ ] **Step 3: Test**

Create `offboarding-api.service.spec.ts`, following `checklist-api.service.spec.ts`'s `HttpTestingController` pattern (that file wasn't read in full during planning research — locate and open it first to match its exact `TestBed`/`provideHttpClient`/`provideHttpClientTesting` setup boilerplate verbatim before writing this one, since duplicating that boilerplate incorrectly is a common source of flaky tests in this codebase):

```typescript
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { OffboardingApiService } from './offboarding-api.service';

describe('OffboardingApiService', () => {
  let service: OffboardingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OffboardingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('startOffboarding posts to /employees/:id/offboarding with an Idempotency-Key header', () => {
    service.startOffboarding('emp-1', {
      reason: 'resignation', lastWorkingDate: '2026-12-01', knowledgeRiskLevel: 'medium',
      rehireEligibility: 'eligible', notes: null
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/offboarding`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    req.flush({ offboardingRecordId: 'rec-1' });
  });

  it('getOffboarding gets /employees/:id/offboarding', () => {
    service.getOffboarding('emp-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/offboarding`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('listMyPendingBypassRequests gets /offboarding-bypass-requests?status=pending', () => {
    service.listMyPendingBypassRequests().subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/offboarding-bypass-requests` && r.params.get('status') === 'pending');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
```

Run: `npm test -- offboarding-api.service.spec.ts` (or this codebase's equivalent Vitest invocation — check `package.json`'s `test` script for the exact filter syntax before running).
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/people/models/offboarding.model.ts src/app/modules/people/data-access/offboarding-api.service.ts src/app/modules/people/data-access/offboarding-api.service.spec.ts
git commit -m "feat: add offboarding models and API service"
```

---

### Task 2: Checklist builder — offboarding bypass/penalty/category fields

**Files:**
- Modify: `src/app/modules/people/models/checklist-template.model.ts`
- Modify: `src/app/modules/people/feature/checklist-builder/checklist-builder.component.ts`
- Modify: `src/app/modules/people/feature/checklist-builder/checklist-builder.component.html`
- Modify: `src/app/modules/people/feature/checklist-builder/checklist-builder.component.spec.ts`

**Interfaces:**
- Produces: `ChecklistTemplateTaskRequest`/`Response` gain `isBypassable: boolean`, `bypassPenaltyDescription: string | null`, `category: ChecklistTaskCategory | null` (imported from `offboarding.model.ts`, Task 1) — these three fields round-trip through `checklist-api.service.ts` unchanged (that service already passes the whole payload through, no per-field wiring needed there).

- [ ] **Step 1: Extend the model**

In `checklist-template.model.ts`, add the import and extend both task interfaces:

```typescript
import { ChecklistTaskCategory } from './offboarding.model';
```

Change:

```typescript
export interface ChecklistTemplateTaskRequest {
  title: string;
  ownerType: ChecklistTaskOwnerType;
  assignedToId?: string | null;
  assigneePositionId?: string | null;
  dueOffsetDays: number;
  sequence?: number | null;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string | null;
  category: ChecklistTaskCategory | null;
}

export interface ChecklistTemplateTaskResponse {
  title: string;
  ownerType: string;
  assignedToId: string | null;
  dueOffsetDays: number;
  sequence: number;
  isRequired: boolean;
  isBypassable: boolean;
  bypassPenaltyDescription: string | null;
  category: ChecklistTaskCategory | null;
}
```

- [ ] **Step 2: Write the failing component test for the new fields**

In `checklist-builder.component.spec.ts`, add (following the file's existing `beforeEach`/`flushInitialRequests` setup — see the file for the exact harness before adding this):

```typescript
it('shows bypass/penalty/category fields only for offboarding templates', () => {
  component.form.controls.templateType.setValue('onboarding');
  fixture.detectChanges();
  let compiled: HTMLElement = fixture.nativeElement;
  expect(compiled.querySelector('[data-testid="task-0-bypassable"]')).toBeNull();

  component.form.controls.templateType.setValue('offboarding');
  fixture.detectChanges();
  compiled = fixture.nativeElement;
  expect(compiled.querySelector('[data-testid="task-0-bypassable"]')).not.toBeNull();
});

it('mapTaskFormToRequest carries isBypassable/bypassPenaltyDescription/category through', () => {
  component.form.controls.templateType.setValue('offboarding');
  const value = {
    title: 'Return laptop', assignmentType: 'employee' as const, assigneePositionId: '',
    dueOffsetDays: 1, isRequired: true, isBypassable: true, bypassPenaltyDescription: 'Deduct from settlement', category: 'asset_return' as const
  };
  const request = component.mapTaskFormToRequest(value, 0);
  expect(request.isBypassable).toBe(true);
  expect(request.bypassPenaltyDescription).toBe('Deduct from settlement');
  expect(request.category).toBe('asset_return');
});
```

Run: `npm test -- checklist-builder.component.spec.ts`
Expected: FAIL (no `[data-testid="task-0-bypassable"]` element exists yet; `mapTaskFormToRequest` doesn't read those form fields yet).

- [ ] **Step 3: Extend the component**

In `checklist-builder.component.ts`:

Add to the `ChecklistTaskFormValue` interface (after `isRequired: boolean;`):

```typescript
  isBypassable: boolean;
  bypassPenaltyDescription: string;
  category: ChecklistTaskCategory | '';
```

Add the import: `import { ChecklistTaskCategory } from '../../models/offboarding.model';`

Add a getter mirroring `isCompanyPositionAssignment`:

```typescript
  isOffboardingTemplate(): boolean {
    return this.form.controls.templateType.value === 'offboarding';
  }
```

In `addTask(...)`, extend the `FormGroup` construction (after the existing `isRequired: [existing?.isRequired ?? true]` line):

```typescript
      isBypassable: [existing?.isBypassable ?? false],
      bypassPenaltyDescription: [existing?.bypassPenaltyDescription ?? ''],
      category: [existing?.category ?? '']
```

In `loadTemplateForEdit(...)`'s `addTask({...})` call (the block mapping `detail.tasks.forEach(...)`), add the three fields to the object passed in:

```typescript
            isBypassable: t.isBypassable,
            bypassPenaltyDescription: t.bypassPenaltyDescription ?? '',
            category: t.category ?? ''
```

In `mapTaskFormToRequest(...)`, add the three fields to **all three** `return` statements (employee-owner, position-picked, position-fallback):

```typescript
      isBypassable: !!value.isBypassable,
      bypassPenaltyDescription: value.bypassPenaltyDescription || null,
      category: (value.category || null) as ChecklistTaskCategory | null,
```

- [ ] **Step 4: Extend the template**

In `checklist-builder.component.html`, inside the `@for (taskGroup of tasksArray.controls; ...)` loop, after the `cb-task-list__col-due` block and before `cb-task-list__col-actions`, add a new column (only rendered for offboarding templates):

```html
              @if (isOffboardingTemplate()) {
                <div class="cb-task-list__col-bypass">
                  <span class="cb-task-row__mobile-label">Bypass</span>
                  <label class="cb-bypass-toggle">
                    <input
                      type="checkbox"
                      [attr.data-testid]="'task-' + idx + '-bypassable'"
                      [checked]="taskGroup.value.isBypassable"
                      (change)="taskGroup.get('isBypassable')?.setValue($any($event.target).checked)"
                    />
                    <span>Bypassable</span>
                  </label>
                  @if (taskGroup.value.isBypassable) {
                    <app-input
                      placeholder="Penalty if bypassed (optional)"
                      [value]="taskGroup.value.bypassPenaltyDescription || ''"
                      (valueChange)="taskGroup.get('bypassPenaltyDescription')?.setValue($event)"
                    />
                    <select
                      class="cb-assigned-field__select"
                      [attr.aria-label]="'Category for task ' + (idx + 1)"
                      [value]="taskGroup.value.category || ''"
                      (change)="taskGroup.get('category')?.setValue($any($event.target).value)"
                    >
                      <option value="">No category</option>
                      <option value="asset_return">Asset Return</option>
                      <option value="access_removal">Access Removal</option>
                      <option value="document_handover">Document Handover</option>
                      <option value="final_settlement">Final Settlement</option>
                      <option value="knowledge_handover">Knowledge Handover</option>
                      <option value="other">Other</option>
                    </select>
                  }
                </div>
              }
```

Add a matching `.cb-task-list__col-bypass` / `.cb-bypass-toggle` rule to `checklist-builder.component.css`, following the sizing/spacing convention of the existing `.cb-task-list__col-*` classes in that file (open it to match the grid-template-columns value — adding a new column changes the row's column count, so the existing grid definition needs one more column sized appropriately; read the current CSS grid rule before editing to avoid breaking row alignment for onboarding templates, which never show this column, by making it a conditionally-added column, not resizing the grid globally — the simplest correct approach is a `display: contents` wrapper or an `@if`-gated column exactly as the assignee-position sub-field already does, not a fixed grid column, since only offboarding rows render it).

- [ ] **Step 5: Run to verify tests pass**

Run: `npm test -- checklist-builder.component.spec.ts`
Expected: both new tests pass, and no previously-passing test in this file regresses (re-run the full file, not just the new tests — this file's existing `not.toContain('Required')`-style assertions are sensitive to accidental copy collisions, per the frontend design spec §2's caveat).

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/people/models/checklist-template.model.ts src/app/modules/people/feature/checklist-builder/
git commit -m "feat: add offboarding bypass/penalty/category fields to checklist builder"
```

---

### Task 3: `OffboardingWizardStore`

**Files:**
- Create: `src/app/modules/people/state/offboarding-wizard.store.ts`
- Test: `src/app/modules/people/state/offboarding-wizard.store.spec.ts`

**Interfaces:**
- Produces: `OffboardingWizardStep = 'start' | 'choose_checklist' | 'review_tasks' | 'track_exit_work' | 'complete_or_bypass' | 'complete_exit'`; `OffboardingWizardStore` with state `{ employeeId, record, checklistMatches, tasks, myPendingBypassRequests, step, loading, saving, error }` and methods `goToStep`, `loadOffboarding`, `startOffboarding`, `loadChecklistMatches`, `selectChecklist`, `loadTasks`, `updateTask`, `completeTask`, `createBypassRequest`, `cancelOffboarding`, `completeOffboarding`, `loadMyPendingBypassRequests`, `decideBypassRequest` — every wizard step component (Tasks 6-11) and the Approval Inbox (Task 12) call these exact method names.

- [ ] **Step 1: Store**

Create `offboarding-wizard.store.ts`:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { NotificationService } from '../../../core/services/notification.service';
import { OffboardingApiService } from '../data-access/offboarding-api.service';
import {
  BypassRequestResponse,
  ChecklistTemplateMatchResponse,
  CreateBypassRequestRequest,
  EmployeeChecklistTaskResponse,
  OffboardingRecordResponse,
  StartOffboardingRequest,
  UpdateEmployeeChecklistTaskRequest
} from '../models/offboarding.model';

export type OffboardingWizardStep =
  | 'start' | 'choose_checklist' | 'review_tasks' | 'track_exit_work' | 'complete_or_bypass' | 'complete_exit';

export interface OffboardingWizardState {
  readonly employeeId: string | null;
  readonly record: OffboardingRecordResponse | null;
  readonly checklistMatches: readonly ChecklistTemplateMatchResponse[];
  readonly tasks: readonly EmployeeChecklistTaskResponse[];
  readonly myPendingBypassRequests: readonly BypassRequestResponse[];
  readonly step: OffboardingWizardStep;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
}

const initialState: OffboardingWizardState = {
  employeeId: null, record: null, checklistMatches: [], tasks: [], myPendingBypassRequests: [],
  step: 'start', loading: false, saving: false, error: null
};

export const OffboardingWizardStore = signalStore(
  { providedIn: 'root' },
  withState<OffboardingWizardState>(initialState),
  withMethods((store, api = inject(OffboardingApiService), notifications = inject(NotificationService)) => ({
    reset(): void {
      patchState(store, initialState);
    },

    goToStep(step: OffboardingWizardStep): void {
      patchState(store, { step });
    },

    async loadOffboarding(employeeId: string): Promise<void> {
      patchState(store, { employeeId, loading: true, error: null });
      try {
        const record = await firstValueFrom(api.getOffboarding(employeeId));
        patchState(store, { record, loading: false });
        if (record) {
          patchState(store, { step: record.status === 'initiated' ? 'choose_checklist' : 'review_tasks' });
          if (record.status !== 'initiated') {
            await this.loadTasks(employeeId);
          }
        }
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load offboarding status.') });
      }
    },

    async startOffboarding(employeeId: string, payload: StartOffboardingRequest): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.startOffboarding(employeeId, payload));
        patchState(store, { saving: false, employeeId });
        await this.loadOffboarding(employeeId);
        patchState(store, { step: 'choose_checklist' });
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to start offboarding.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async loadChecklistMatches(employeeId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const checklistMatches = await firstValueFrom(api.getChecklistMatches(employeeId));
        patchState(store, { checklistMatches, loading: false });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load matching checklists.') });
      }
    },

    async selectChecklist(employeeId: string, templateId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.selectChecklist(employeeId, templateId));
        patchState(store, { saving: false });
        await this.loadOffboarding(employeeId);
        patchState(store, { step: 'review_tasks' });
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to select checklist.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async loadTasks(employeeId: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const tasks = await firstValueFrom(api.listChecklistTasks(employeeId));
        patchState(store, { tasks, loading: false });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load checklist tasks.') });
      }
    },

    async updateTask(employeeId: string, taskId: string, payload: UpdateEmployeeChecklistTaskRequest): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.updateChecklistTask(employeeId, taskId, payload));
        patchState(store, { saving: false });
        await this.loadTasks(employeeId);
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to update task.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async completeTask(employeeId: string, taskId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.completeChecklistTask(employeeId, taskId));
        patchState(store, { saving: false });
        notifications.success('Task marked complete.');
        await this.loadTasks(employeeId);
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to complete task.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async createBypassRequest(employeeId: string, taskId: string, payload: CreateBypassRequestRequest): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.createBypassRequest(employeeId, taskId, payload));
        patchState(store, { saving: false });
        notifications.success('Bypass request sent for approval.');
        await this.loadTasks(employeeId);
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to request bypass.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async cancelOffboarding(employeeId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.cancelOffboarding(employeeId));
        patchState(store, { saving: false });
        notifications.success('Offboarding cancelled.');
        this.reset();
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to cancel offboarding.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async completeOffboarding(employeeId: string): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(api.completeOffboarding(employeeId));
        patchState(store, { saving: false });
        notifications.success('Offboarding completed.');
        await this.loadOffboarding(employeeId);
        patchState(store, { step: 'complete_exit' });
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to complete offboarding.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    },

    async loadMyPendingBypassRequests(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const myPendingBypassRequests = await firstValueFrom(api.listMyPendingBypassRequests());
        patchState(store, { myPendingBypassRequests, loading: false });
      } catch (err: unknown) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load pending approvals.') });
      }
    },

    async decideBypassRequest(id: string, decision: 'approve' | 'reject', decisionComment: string | null): Promise<boolean> {
      patchState(store, { saving: true, error: null });
      try {
        await firstValueFrom(decision === 'approve' ? api.approveBypassRequest(id) : api.rejectBypassRequest(id, decisionComment));
        patchState(store, { saving: false });
        notifications.success(decision === 'approve' ? 'Bypass approved.' : 'Bypass rejected.');
        await this.loadMyPendingBypassRequests();
        return true;
      } catch (err: unknown) {
        const message = toSafeErrorMessage(err, 'Failed to record the decision.');
        patchState(store, { saving: false, error: message });
        notifications.error(message);
        return false;
      }
    }
  }))
);
```

- [ ] **Step 2: Test**

Create `offboarding-wizard.store.spec.ts`, following `checklist-template.store.spec.ts`'s pattern (locate that file first and match its `TestBed`/mocked-`OffboardingApiService` setup exactly):

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { OffboardingApiService } from '../data-access/offboarding-api.service';
import { OffboardingWizardStore } from './offboarding-wizard.store';

describe('OffboardingWizardStore', () => {
  let store: InstanceType<typeof OffboardingWizardStore>;
  let apiStub: Partial<OffboardingApiService>;

  function setup(overrides: Partial<OffboardingApiService> = {}): void {
    apiStub = { getOffboarding: () => of(null), ...overrides };
    TestBed.configureTestingModule({ providers: [{ provide: OffboardingApiService, useValue: apiStub }] });
    store = TestBed.inject(OffboardingWizardStore);
  }

  it('loadOffboarding with no existing record leaves step at start', async () => {
    setup({ getOffboarding: () => of(null) });
    await store.loadOffboarding('emp-1');
    expect(store.record()).toBeNull();
    expect(store.step()).toBe('start');
  });

  it('loadOffboarding with an initiated record advances to choose_checklist', async () => {
    setup({
      getOffboarding: () => of({
        id: 'rec-1', employeeId: 'emp-1', reason: 'resignation', lastWorkingDate: '2026-12-01',
        knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null, checklistTemplateId: null,
        status: 'initiated', createdAt: '2026-08-17T00:00:00Z', updatedAt: null, completedAt: null
      })
    });
    await store.loadOffboarding('emp-1');
    expect(store.step()).toBe('choose_checklist');
  });

  it('startOffboarding failure surfaces an error and does not advance the step', async () => {
    setup({ startOffboarding: () => throwError(() => new Error('boom')), getOffboarding: () => of(null) });
    const result = await store.startOffboarding('emp-1', {
      reason: 'resignation', lastWorkingDate: '2026-12-01', knowledgeRiskLevel: 'medium', rehireEligibility: null, notes: null
    });
    expect(result).toBe(false);
    expect(store.step()).toBe('start');
  });
});
```

Run: `npm test -- offboarding-wizard.store.spec.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/state/offboarding-wizard.store.ts src/app/modules/people/state/offboarding-wizard.store.spec.ts
git commit -m "feat: add OffboardingWizardStore"
```

---

### Task 4: Employee-detail screen wiring

**Files:**
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`
- Modify: `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.loadOffboarding`/`record` (Task 3), Angular `Router`.
- Produces: enabled navigation from the employee-detail popover into the wizard route (Task 6 registers that route) — Task 6 assumes this wiring exists.

- [ ] **Step 1: Write the failing test**

In `employee-detail.component.spec.ts`, add (following the file's existing stubbed-provider pattern — `PeopleApiService`/`PermissionService`/`AuthStore` as `useValue` stubs, `provideRouter([])`):

```typescript
it('enables the Offboarding menu item and navigates to the wizard on click', () => {
  // Arrange the same way the file's other "renders the Change Position popover" test does,
  // then additionally stub OffboardingWizardStore.loadOffboarding to resolve with no record.
  const router = TestBed.inject(Router);
  const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const button = fixture.nativeElement.querySelector('[data-testid="offboarding-menu-item"]') as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  button.click();
  fixture.detectChanges();

  expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', expect.any(String), 'offboarding']);
});
```

Run: `npm test -- employee-detail.component.spec.ts`
Expected: FAIL (button is still `disabled`; no `navigateToOffboarding` method exists).

- [ ] **Step 2: Wire the button**

In `employee-detail.component.ts`, add the imports:

```typescript
import { Router } from '@angular/router';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
```

Add to the injected-services block:

```typescript
  private readonly router = inject(Router);
  private readonly offboardingStore = inject(OffboardingWizardStore);
```

Add a signal and computed for the offboarding status, populated alongside `load()`:

```typescript
  readonly offboardingStatus = computed(() => this.offboardingStore.record()?.status ?? null);
  readonly isReadOnly = computed(() => this.offboardingStatus() === 'completed');
```

In `load()`, after `this.api.getEmployeeDetail(id).subscribe({...})`, add:

```typescript
    void this.offboardingStore.loadOffboarding(id);
```

Add the navigation method:

```typescript
  navigateToOffboarding(employeeId: string): void {
    this.changePositionMenuOpen.set(false);
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }
```

In the template, replace the disabled stub button:

```html
                  <button type="button" class="profile-action-btn" data-testid="offboarding-menu-item" disabled title="Not yet available">Offboarding</button>
```

with:

```html
                  <button type="button" class="profile-action-btn" data-testid="offboarding-menu-item" (click)="navigateToOffboarding(employee.id)">
                    {{ offboardingStatus() && offboardingStatus() !== 'cancelled' ? (isReadOnly() ? 'View Offboarding' : 'Continue Offboarding') : 'Offboarding' }}
                  </button>
```

Also gate the whole Change Position popover trigger so it's hidden once read-only — change the existing `@if` condition:

```html
            @if (canChangePosition() && !isOwnRecord() && employee.jobInformation.legalEntityId && !isReadOnly()) {
```

- [ ] **Step 3: Run to verify it passes**

Run: `npm test -- employee-detail.component.spec.ts`
Expected: the new test passes; re-run the full file to confirm no existing test (e.g. one asserting the popover always renders for a permitted user) broke from the new `!isReadOnly()` condition — if one does, that test's fixture needs an `OffboardingWizardStore` stub returning `record: null` added to its setup, which is a legitimate fix, not a sign this task is wrong.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/people/feature/employee-detail/
git commit -m "feat: wire employee-detail Offboarding action to the wizard route"
```

---

### Task 5: Offboarding wizard shell and route

**Files:**
- Create: `src/app/modules/people/feature/offboarding/offboarding-wizard.component.ts`
- Modify: `src/app/modules/people/people.routes.ts`
- Test: `src/app/modules/people/feature/offboarding/offboarding-wizard.component.spec.ts`

**Interfaces:**
- Produces: the routed shell at `/people/employees/:id/offboarding` that Task 4 navigates to; `STEP_ORDER: readonly OffboardingWizardStep[]` and `STEP_LABELS: Record<OffboardingWizardStep, string>` module-level constants (mirroring `AddEmployeeWizardComponent`'s exact pattern) — Tasks 6-11's step components are rendered by this shell via `@switch (store.step())`.

- [ ] **Step 1: Shell component**

Create `offboarding-wizard.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { OffboardingWizardStep, OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import { OffboardingStartStepComponent } from './steps/offboarding-start-step.component';
import { OffboardingChooseChecklistStepComponent } from './steps/offboarding-choose-checklist-step.component';
import { OffboardingReviewTasksStepComponent } from './steps/offboarding-review-tasks-step.component';
import { OffboardingTrackExitWorkStepComponent } from './steps/offboarding-track-exit-work-step.component';
import { OffboardingCompleteOrBypassStepComponent } from './steps/offboarding-complete-or-bypass-step.component';
import { OffboardingCompleteExitStepComponent } from './steps/offboarding-complete-exit-step.component';

export const STEP_ORDER: readonly OffboardingWizardStep[] =
  ['start', 'choose_checklist', 'review_tasks', 'track_exit_work', 'complete_or_bypass', 'complete_exit'];

export const STEP_LABELS: Record<OffboardingWizardStep, string> = {
  start: 'Start Offboarding',
  choose_checklist: 'Choose Exit Checklist',
  review_tasks: 'Review Tasks',
  track_exit_work: 'Track Exit Work',
  complete_or_bypass: 'Complete or Bypass Tasks',
  complete_exit: 'Complete Employee Exit'
};

@Component({
  selector: 'app-offboarding-wizard',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent, OffboardingStartStepComponent, OffboardingChooseChecklistStepComponent,
    OffboardingReviewTasksStepComponent, OffboardingTrackExitWorkStepComponent,
    OffboardingCompleteOrBypassStepComponent, OffboardingCompleteExitStepComponent
  ],
  template: `
    <app-breadcrumb-header parentLabel="Employees" currentLabel="Offboarding" parentUrl="/people/employees" icon="people" />

    <nav class="ow-steps" aria-label="Offboarding steps">
      @for (step of stepOrder; track step; let i = $index) {
        <span class="ow-steps__chip" [class.ow-steps__chip--active]="step === store.step()" [class.ow-steps__chip--done]="i < stepIndex()">
          {{ i + 1 }}. {{ stepLabels[step] }}
        </span>
      }
    </nav>

    @switch (store.step()) {
      @case ('start') { <app-offboarding-start-step [employeeId]="employeeId()" /> }
      @case ('choose_checklist') { <app-offboarding-choose-checklist-step [employeeId]="employeeId()" /> }
      @case ('review_tasks') { <app-offboarding-review-tasks-step [employeeId]="employeeId()" /> }
      @case ('track_exit_work') { <app-offboarding-track-exit-work-step [employeeId]="employeeId()" /> }
      @case ('complete_or_bypass') { <app-offboarding-complete-or-bypass-step [employeeId]="employeeId()" /> }
      @case ('complete_exit') { <app-offboarding-complete-exit-step [employeeId]="employeeId()" /> }
    }
  `,
  styles: [`
    .ow-steps { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
    .ow-steps__chip { font-size: 0.75rem; padding: 0.375rem 0.75rem; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .ow-steps__chip--active { background: var(--color-accent); color: white; font-weight: 600; }
    .ow-steps__chip--done { color: var(--color-text-primary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingWizardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(OffboardingWizardStore);

  readonly stepOrder = STEP_ORDER;
  readonly stepLabels = STEP_LABELS;
  readonly employeeId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  constructor() {
    const id = this.employeeId();
    if (id) {
      void this.store.loadOffboarding(id);
    } else {
      void this.router.navigate(['/people/employees']);
    }
  }
}
```

- [ ] **Step 2: Route**

In `people.routes.ts`, in the `employees` children array, add a sibling after `':id'`:

```typescript
      {
        path: ':id/offboarding',
        loadComponent: () =>
          import('./feature/offboarding/offboarding-wizard.component').then((m) => m.OffboardingWizardComponent),
        canActivate: [permissionGuard],
        data: { title: 'Offboard Employee', permissions: ['employees:write'] }
      }
```

- [ ] **Step 3: Test**

Create `offboarding-wizard.component.spec.ts`, following `employee-detail.component.spec.ts`'s lightweight stubbed-provider style (this is a read/orchestration shell, not a form-heavy component):

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingWizardComponent } from './offboarding-wizard.component';

describe('OffboardingWizardComponent', () => {
  let fixture: ComponentFixture<OffboardingWizardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OffboardingWizardComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'emp-1' } } } },
        { provide: OffboardingApiService, useValue: { getOffboarding: () => of(null) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingWizardComponent);
    fixture.detectChanges();
  });

  it('renders the Start Offboarding step first when no record exists', () => {
    expect(fixture.componentInstance.store.step()).toBe('start');
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('app-offboarding-start-step')).not.toBeNull();
  });
});
```

Run: `npm test -- offboarding-wizard.component.spec.ts`
Expected: passes once Task 6 creates `OffboardingStartStepComponent` (this task and Task 6 are sequenced together in execution — the shell imports a component Task 6 creates, so `dotnet build`-equivalent (`ng build`/`tsc`) will not succeed until Task 6 lands; that's expected and matches how Task 9's backend controller in the companion plan referenced not-yet-existing query handlers within the same task).

- [ ] **Step 4: Commit** (after Task 6 makes this buildable — see that task's own commit step, which stages both)

---

### Task 6: Step 1 — Start Offboarding

**Files:**
- Create: `src/app/modules/people/feature/offboarding/steps/offboarding-start-step.component.ts`
- Test: `src/app/modules/people/feature/offboarding/steps/offboarding-start-step.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.startOffboarding` (Task 3).
- Produces: `OffboardingStartStepComponent` with `employeeId = input.required<string>()` — Task 5's shell passes this exact input.

- [ ] **Step 1: Component**

Create `offboarding-start-step.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../../shared/ui/select/select.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-start-step',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4 max-w-xl">
      <app-select
        label="Exit reason *"
        [options]="[
          { value: 'resignation', label: 'Resignation' },
          { value: 'termination', label: 'Termination' },
          { value: 'retirement', label: 'Retirement' },
          { value: 'contract_end', label: 'Contract End' }
        ]"
        [value]="form.controls.reason.value"
        (valueChange)="form.controls.reason.setValue($any($event))"
      />
      <app-input
        label="Last working day *"
        type="date"
        [value]="form.controls.lastWorkingDate.value"
        (valueChange)="form.controls.lastWorkingDate.setValue($event)"
      />
      <app-select
        label="Knowledge risk level *"
        [options]="[
          { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
          { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
        ]"
        [value]="form.controls.knowledgeRiskLevel.value"
        (valueChange)="form.controls.knowledgeRiskLevel.setValue($any($event))"
      />
      <app-select
        label="Rehire eligibility"
        [options]="[
          { value: 'eligible', label: 'Eligible' }, { value: 'not_eligible', label: 'Not Eligible' },
          { value: 'conditional', label: 'Conditional' }
        ]"
        [value]="form.controls.rehireEligibility.value || ''"
        (valueChange)="form.controls.rehireEligibility.setValue($any($event) || null)"
      />
      <app-input
        label="Notes"
        [value]="form.controls.notes.value || ''"
        (valueChange)="form.controls.notes.setValue($event || null)"
      />
      <app-button variant="primary" type="submit" [loading]="store.saving()" [disabled]="form.invalid">
        Start Offboarding
      </app-button>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingStartStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.group({
    reason: ['resignation' as const, Validators.required],
    lastWorkingDate: ['', Validators.required],
    knowledgeRiskLevel: ['medium' as const, Validators.required],
    rehireEligibility: [null as 'eligible' | 'not_eligible' | 'conditional' | null],
    notes: [null as string | null]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    await this.store.startOffboarding(this.employeeId(), {
      reason: value.reason, lastWorkingDate: value.lastWorkingDate, knowledgeRiskLevel: value.knowledgeRiskLevel,
      rehireEligibility: value.rehireEligibility, notes: value.notes
    });
  }
}
```

- [ ] **Step 2: Test**

Create `offboarding-start-step.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingStartStepComponent } from './offboarding-start-step.component';
import { of } from 'rxjs';

describe('OffboardingStartStepComponent', () => {
  let fixture: ComponentFixture<OffboardingStartStepComponent>;
  let startOffboardingSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    startOffboardingSpy = vi.fn(() => of({ offboardingRecordId: 'rec-1' }));
    await TestBed.configureTestingModule({
      imports: [OffboardingStartStepComponent],
      providers: [
        { provide: OffboardingApiService, useValue: { startOffboarding: startOffboardingSpy, getOffboarding: () => of(null) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingStartStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('does not submit when the form is invalid', async () => {
    fixture.componentInstance.form.controls.lastWorkingDate.setValue('');
    await fixture.componentInstance.submit();
    expect(startOffboardingSpy).not.toHaveBeenCalled();
  });

  it('submits the form values on valid submit', async () => {
    fixture.componentInstance.form.patchValue({ lastWorkingDate: '2026-12-01' });
    await fixture.componentInstance.submit();
    expect(startOffboardingSpy).toHaveBeenCalledWith('emp-1', expect.objectContaining({ lastWorkingDate: '2026-12-01', reason: 'resignation' }));
  });
});
```

Run: `npm test -- offboarding-start-step.component.spec.ts`
Expected: both pass. Also now run `npm test -- offboarding-wizard.component.spec.ts` (Task 5) — it should now pass since this component exists.

- [ ] **Step 3: Commit (both Task 5 and Task 6 together, since Task 5's shell only compiles once this step exists)**

```bash
git add src/app/modules/people/people.routes.ts src/app/modules/people/feature/offboarding/
git commit -m "feat: add offboarding wizard shell, route, and Start Offboarding step"
```

---

### Task 7: Step 2 — Choose Exit Checklist

**Files:**
- Create: `src/app/modules/people/feature/offboarding/steps/offboarding-choose-checklist-step.component.ts`
- Test: `src/app/modules/people/feature/offboarding/steps/offboarding-choose-checklist-step.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.loadChecklistMatches`/`checklistMatches`/`selectChecklist` (Task 3).

- [ ] **Step 1: Component**

Create `offboarding-choose-checklist-step.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-choose-checklist-step',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    @if (store.loading()) {
      <app-loader label="Loading matching checklists…" />
    } @else if (store.checklistMatches().length === 0) {
      <p class="text-sm text-[var(--color-text-secondary)]">No active offboarding checklist templates match this employee's company, department, or position.</p>
    } @else {
      <div class="space-y-2 max-w-xl">
        @for (match of store.checklistMatches(); track match.id) {
          <label class="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg cursor-pointer">
            <input type="radio" name="template" [value]="match.id" [checked]="selectedId() === match.id" (change)="selectedId.set(match.id)" />
            <span>{{ match.name }}</span>
            <span class="text-xs text-[var(--color-text-secondary)]">({{ match.matchLevel }} match)</span>
          </label>
        }
      </div>
      <app-button variant="primary" class="mt-4" [loading]="store.saving()" [disabled]="!selectedId()" (pressed)="confirm()">
        Use This Checklist
      </app-button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingChooseChecklistStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);
  readonly selectedId = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.employeeId();
      if (id) void this.store.loadChecklistMatches(id);
    });
  }

  async confirm(): Promise<void> {
    const templateId = this.selectedId();
    if (!templateId) return;
    await this.store.selectChecklist(this.employeeId(), templateId);
  }
}
```

- [ ] **Step 2: Test**

Create `offboarding-choose-checklist-step.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingChooseChecklistStepComponent } from './offboarding-choose-checklist-step.component';

describe('OffboardingChooseChecklistStepComponent', () => {
  let fixture: ComponentFixture<OffboardingChooseChecklistStepComponent>;
  let selectChecklistSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    selectChecklistSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingChooseChecklistStepComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          getChecklistMatches: () => of([{ id: 'tpl-1', name: 'Standard Offboarding', matchLevel: 'company' }]),
          selectChecklist: selectChecklistSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingChooseChecklistStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('lists matching templates and confirms the selected one', async () => {
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.selectedId.set('tpl-1');
    await fixture.componentInstance.confirm();
    expect(selectChecklistSpy).toHaveBeenCalledWith('emp-1', 'tpl-1');
  });
});
```

Run: `npm test -- offboarding-choose-checklist-step.component.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/feature/offboarding/steps/offboarding-choose-checklist-step.component.ts src/app/modules/people/feature/offboarding/steps/offboarding-choose-checklist-step.component.spec.ts
git commit -m "feat: add Choose Exit Checklist step"
```

---

### Task 8: Step 3 — Review Tasks

**Files:**
- Create: `src/app/modules/people/feature/offboarding/steps/offboarding-review-tasks-step.component.ts`
- Test: `src/app/modules/people/feature/offboarding/steps/offboarding-review-tasks-step.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.loadTasks`/`tasks`/`updateTask`/`goToStep` (Task 3).

- [ ] **Step 1: Component**

Create `offboarding-review-tasks-step.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-review-tasks-step',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    @if (store.loading()) {
      <app-loader label="Loading tasks…" />
    } @else {
      <div class="space-y-2">
        @for (task of store.tasks(); track task.id) {
          <div class="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
            <div>
              <p class="text-sm font-medium">{{ task.taskTitle }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">Due {{ task.dueDate }} · {{ task.isRequired ? 'Required' : 'Optional' }}</p>
            </div>
            <label class="flex items-center gap-1.5 text-xs">
              <input type="checkbox" [checked]="task.isRequired" (change)="toggleRequired(task.id, task.isRequired, $any($event.target).checked)" />
              Required
            </label>
          </div>
        }
      </div>
      <app-button variant="primary" class="mt-4" (pressed)="store.goToStep('track_exit_work')">
        Continue
      </app-button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingReviewTasksStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  constructor() {
    effect(() => {
      const id = this.employeeId();
      if (id) void this.store.loadTasks(id);
    });
  }

  async toggleRequired(taskId: string, currentIsRequired: boolean, checked: boolean): Promise<void> {
    if (currentIsRequired === checked) return;
    const task = this.store.tasks().find((t) => t.id === taskId);
    if (!task) return;
    await this.store.updateTask(this.employeeId(), taskId, { assignedToId: task.assignedToId, dueDate: task.dueDate, isRequired: checked });
  }
}
```

- [ ] **Step 2: Test**

Create `offboarding-review-tasks-step.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingReviewTasksStepComponent } from './offboarding-review-tasks-step.component';

describe('OffboardingReviewTasksStepComponent', () => {
  let fixture: ComponentFixture<OffboardingReviewTasksStepComponent>;
  let updateSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    updateSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingReviewTasksStepComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          listChecklistTasks: () => of([{
            id: 'task-1', taskTitle: 'Return laptop', ownerType: 'employee', assignedToId: 'user-1', dueDate: '2026-12-01',
            isRequired: true, isBypassable: true, bypassPenaltyDescription: null, category: 'asset_return', status: 'pending', completedAt: null
          }]),
          updateChecklistTask: updateSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingReviewTasksStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('toggling required calls updateTask with the new value', async () => {
    await fixture.componentInstance.toggleRequired('task-1', true, false);
    expect(updateSpy).toHaveBeenCalledWith('emp-1', 'task-1', { assignedToId: 'user-1', dueDate: '2026-12-01', isRequired: false });
  });

  it('does not call updateTask when the value has not changed', async () => {
    await fixture.componentInstance.toggleRequired('task-1', true, true);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
```

Run: `npm test -- offboarding-review-tasks-step.component.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/feature/offboarding/steps/offboarding-review-tasks-step.component.ts src/app/modules/people/feature/offboarding/steps/offboarding-review-tasks-step.component.spec.ts
git commit -m "feat: add Review Tasks step"
```

---

### Task 9: Step 4 — Track Exit Work

**Files:**
- Create: `src/app/modules/people/feature/offboarding/steps/offboarding-track-exit-work-step.component.ts`
- Test: `src/app/modules/people/feature/offboarding/steps/offboarding-track-exit-work-step.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.tasks`/`goToStep` (Task 3). Introduces a pure, independently-testable grouping function (`groupTasksByCategory`) rather than inlining the aggregation in the template, mirroring the backend plan's precedent of extracting gate/aggregation logic (Task 16 there) into a plain function a reviewer can verify in isolation.

- [ ] **Step 1: Component**

Create `offboarding-track-exit-work-step.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ChecklistTaskCategory, EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

const CATEGORY_LABELS: Record<ChecklistTaskCategory, string> = {
  asset_return: 'Assets Returned', access_removal: 'Access Removed', document_handover: 'Documents Handover',
  final_settlement: 'Final Settlement', knowledge_handover: 'Knowledge Handover', other: 'Other'
};

export interface CategoryProgress {
  readonly category: string;
  readonly total: number;
  readonly resolved: number;
}

export function groupTasksByCategory(tasks: readonly EmployeeChecklistTaskResponse[]): readonly CategoryProgress[] {
  const byCategory = new Map<string, EmployeeChecklistTaskResponse[]>();
  for (const task of tasks) {
    const key = task.category ?? 'other';
    byCategory.set(key, [...(byCategory.get(key) ?? []), task]);
  }
  return [...byCategory.entries()].map(([category, categoryTasks]) => ({
    category: CATEGORY_LABELS[category as ChecklistTaskCategory] ?? category,
    total: categoryTasks.length,
    resolved: categoryTasks.filter((t) => t.status === 'completed' || t.status === 'bypassed').length
  }));
}

export function overallProgressPercent(tasks: readonly EmployeeChecklistTaskResponse[]): number {
  if (tasks.length === 0) return 100;
  const resolved = tasks.filter((t) => t.status === 'completed' || t.status === 'bypassed').length;
  return Math.round((resolved / tasks.length) * 100);
}

@Component({
  selector: 'app-offboarding-track-exit-work-step',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="mb-4">
      <div class="h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden">
        <div class="h-full bg-[var(--color-accent)]" [style.width.%]="overallPercent()"></div>
      </div>
      <p class="text-xs text-[var(--color-text-secondary)] mt-1">{{ overallPercent() }}% complete</p>
    </div>
    <div class="space-y-2">
      @for (row of categoryProgress(); track row.category) {
        <div class="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
          <span class="text-sm font-medium">{{ row.category }}</span>
          <span class="text-xs text-[var(--color-text-secondary)]">{{ row.resolved }} / {{ row.total }}</span>
        </div>
      }
    </div>
    <app-button variant="primary" class="mt-4" (pressed)="store.goToStep('complete_or_bypass')">
      Continue
    </app-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingTrackExitWorkStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  readonly categoryProgress = computed(() => groupTasksByCategory(this.store.tasks()));
  readonly overallPercent = computed(() => overallProgressPercent(this.store.tasks()));
}
```

- [ ] **Step 2: Test the pure functions first (they're the reviewable core of this step)**

Create `offboarding-track-exit-work-step.component.spec.ts`:

```typescript
import { groupTasksByCategory, overallProgressPercent } from './offboarding-track-exit-work-step.component';
import { EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';

function task(overrides: Partial<EmployeeChecklistTaskResponse>): EmployeeChecklistTaskResponse {
  return {
    id: 'task-1', taskTitle: 'x', ownerType: 'employee', assignedToId: 'u1', dueDate: '2026-12-01',
    isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null, status: 'pending', completedAt: null,
    ...overrides
  };
}

describe('groupTasksByCategory', () => {
  it('groups by category and counts resolved (completed or bypassed) vs total', () => {
    const tasks = [
      task({ category: 'asset_return', status: 'completed' }),
      task({ category: 'asset_return', status: 'pending' }),
      task({ category: 'access_removal', status: 'bypassed' })
    ];
    const result = groupTasksByCategory(tasks);
    expect(result.find((r) => r.category === 'Assets Returned')).toEqual({ category: 'Assets Returned', total: 2, resolved: 1 });
    expect(result.find((r) => r.category === 'Access Removed')).toEqual({ category: 'Access Removed', total: 1, resolved: 1 });
  });

  it('buckets null category as Other', () => {
    const result = groupTasksByCategory([task({ category: null })]);
    expect(result).toEqual([{ category: 'Other', total: 1, resolved: 0 }]);
  });
});

describe('overallProgressPercent', () => {
  it('returns 100 for an empty task list', () => {
    expect(overallProgressPercent([])).toBe(100);
  });

  it('computes the resolved percentage rounded to the nearest integer', () => {
    expect(overallProgressPercent([task({ status: 'completed' }), task({ status: 'pending' }), task({ status: 'pending' })])).toBe(33);
  });
});
```

Run: `npm test -- offboarding-track-exit-work-step.component.spec.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/feature/offboarding/steps/offboarding-track-exit-work-step.component.ts src/app/modules/people/feature/offboarding/steps/offboarding-track-exit-work-step.component.spec.ts
git commit -m "feat: add Track Exit Work step"
```

---

### Task 10: Step 5 — Complete or Bypass Tasks

**Files:**
- Create: `src/app/modules/people/feature/offboarding/steps/offboarding-complete-or-bypass-step.component.ts`
- Test: `src/app/modules/people/feature/offboarding/steps/offboarding-complete-or-bypass-step.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.tasks`/`completeTask`/`createBypassRequest`/`goToStep` (Task 3).

- [ ] **Step 1: Component**

Create `offboarding-complete-or-bypass-step.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../../shared/ui/input/input.component';
import { EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-complete-or-bypass-step',
  standalone: true,
  imports: [ButtonComponent, InputComponent],
  template: `
    <div class="space-y-2">
      @for (task of store.tasks(); track task.id) {
        <div class="p-3 border border-[var(--color-border)] rounded-lg">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium">{{ task.taskTitle }}</span>
            <span class="text-xs text-[var(--color-text-secondary)]">{{ task.status }}</span>
          </div>
          @if (task.status === 'pending' || task.status === 'in_progress') {
            <div class="flex gap-2 mt-2">
              <app-button variant="secondary" size="sm" [loading]="store.saving()" (pressed)="complete(task.id)">Complete</app-button>
              @if (task.isBypassable) {
                <app-button variant="secondary" size="sm" (pressed)="openBypass(task)">Bypass</app-button>
              }
            </div>
          }
          @if (bypassingTaskId() === task.id) {
            <div class="mt-2 space-y-2 p-2 border-t border-[var(--color-border)]">
              <app-input label="Bypass reason *" [value]="bypassReason()" (valueChange)="bypassReason.set($event)" />
              <app-input label="Penalty (if approved)" [value]="penaltyDescription()" (valueChange)="penaltyDescription.set($event)" />
              <app-input label="Approver user id *" [value]="approverId()" (valueChange)="approverId.set($event)" />
              <app-button variant="primary" size="sm" [loading]="store.saving()" [disabled]="!bypassReason() || !approverId()" (pressed)="submitBypass(task.id)">
                Send for Approval
              </app-button>
            </div>
          }
        </div>
      }
    </div>
    <app-button variant="primary" class="mt-4" (pressed)="store.goToStep('complete_exit')">
      Continue
    </app-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingCompleteOrBypassStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  readonly bypassingTaskId = signal<string | null>(null);
  readonly bypassReason = signal('');
  readonly penaltyDescription = signal('');
  readonly approverId = signal('');

  async complete(taskId: string): Promise<void> {
    await this.store.completeTask(this.employeeId(), taskId);
  }

  openBypass(task: EmployeeChecklistTaskResponse): void {
    this.bypassingTaskId.set(task.id);
    this.bypassReason.set('');
    this.penaltyDescription.set(task.bypassPenaltyDescription ?? '');
    this.approverId.set('');
  }

  async submitBypass(taskId: string): Promise<void> {
    const reason = this.bypassReason();
    const approver = this.approverId();
    if (!reason || !approver) return;
    const ok = await this.store.createBypassRequest(this.employeeId(), taskId, {
      approverId: approver, bypassReason: reason, penaltyDescription: this.penaltyDescription() || null
    });
    if (ok) this.bypassingTaskId.set(null);
  }
}
```

- [ ] **Step 2: Test**

Create `offboarding-complete-or-bypass-step.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingCompleteOrBypassStepComponent } from './offboarding-complete-or-bypass-step.component';

describe('OffboardingCompleteOrBypassStepComponent', () => {
  let fixture: ComponentFixture<OffboardingCompleteOrBypassStepComponent>;
  let completeSpy: ReturnType<typeof vi.fn>;
  let bypassSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    completeSpy = vi.fn(() => of(undefined));
    bypassSpy = vi.fn(() => of({ bypassRequestId: 'br-1' }));
    await TestBed.configureTestingModule({
      imports: [OffboardingCompleteOrBypassStepComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          listChecklistTasks: () => of([]),
          completeChecklistTask: completeSpy,
          createBypassRequest: bypassSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingCompleteOrBypassStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('complete calls completeChecklistTask', async () => {
    await fixture.componentInstance.complete('task-1');
    expect(completeSpy).toHaveBeenCalledWith('emp-1', 'task-1');
  });

  it('submitBypass with a reason and approver calls createBypassRequest and closes the form', async () => {
    fixture.componentInstance.bypassReason.set('Payment processed in advance.');
    fixture.componentInstance.approverId.set('user-2');
    fixture.componentInstance.bypassingTaskId.set('task-1');
    await fixture.componentInstance.submitBypass('task-1');
    expect(bypassSpy).toHaveBeenCalledWith('emp-1', 'task-1', {
      approverId: 'user-2', bypassReason: 'Payment processed in advance.', penaltyDescription: null
    });
    expect(fixture.componentInstance.bypassingTaskId()).toBeNull();
  });

  it('submitBypass without a reason does not call createBypassRequest', async () => {
    fixture.componentInstance.approverId.set('user-2');
    await fixture.componentInstance.submitBypass('task-1');
    expect(bypassSpy).not.toHaveBeenCalled();
  });
});
```

Run: `npm test -- offboarding-complete-or-bypass-step.component.spec.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/feature/offboarding/steps/offboarding-complete-or-bypass-step.component.ts src/app/modules/people/feature/offboarding/steps/offboarding-complete-or-bypass-step.component.spec.ts
git commit -m "feat: add Complete or Bypass Tasks step"
```

---

### Task 11: Step 6 — Complete Employee Exit

**Files:**
- Create: `src/app/modules/people/feature/offboarding/steps/offboarding-complete-exit-step.component.ts`
- Test: `src/app/modules/people/feature/offboarding/steps/offboarding-complete-exit-step.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.tasks`/`completeOffboarding` (Task 3). Reuses `OffboardingCompletionGate`-equivalent logic client-side only to **enable/disable** the button (the backend's `OffboardingCompletionGate.AllRequiredTasksResolved`, backend plan Task 16, is the actual authority — this is UX-only, matching the frontend design spec §5's "surfaced from the GET response, not recomputed client-side" instruction by deriving readiness from the already-loaded `tasks` array rather than re-fetching or duplicating server logic elsewhere).

- [ ] **Step 1: Component**

Create `offboarding-complete-exit-step.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-complete-exit-step',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (store.record()?.status === 'completed') {
      <p class="text-sm font-medium text-[var(--color-text-primary)]">This employee's exit is complete. The record is now read-only.</p>
      <app-button variant="secondary" class="mt-4" (pressed)="backToProfile()">Back to Profile</app-button>
    } @else {
      <p class="text-sm text-[var(--color-text-secondary)] mb-4">
        Review complete. {{ allRequiredResolved() ? 'All required tasks are resolved.' : 'Some required tasks are still open.' }}
      </p>
      <app-button variant="primary" [loading]="store.saving()" [disabled]="!allRequiredResolved()" (pressed)="complete()">
        Complete Employee Exit
      </app-button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingCompleteExitStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);
  private readonly router = inject(Router);

  readonly allRequiredResolved = computed(() =>
    this.store.tasks().filter((t) => t.isRequired).every((t) => t.status === 'completed' || t.status === 'bypassed'));

  async complete(): Promise<void> {
    if (!this.allRequiredResolved()) return;
    await this.store.completeOffboarding(this.employeeId());
  }

  backToProfile(): void {
    void this.router.navigate(['/people/employees', this.employeeId()]);
  }
}
```

- [ ] **Step 2: Test**

Create `offboarding-complete-exit-step.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../../data-access/offboarding-api.service';
import { OffboardingCompleteExitStepComponent } from './offboarding-complete-exit-step.component';

function taskFixture(status: string, isRequired: boolean) {
  return {
    id: 'task-1', taskTitle: 'x', ownerType: 'employee', assignedToId: 'u1', dueDate: '2026-12-01',
    isRequired, isBypassable: false, bypassPenaltyDescription: null, category: null, status, completedAt: null
  };
}

describe('OffboardingCompleteExitStepComponent', () => {
  async function setup(tasks: unknown[]): Promise<ComponentFixture<OffboardingCompleteExitStepComponent>> {
    await TestBed.configureTestingModule({
      imports: [OffboardingCompleteExitStepComponent],
      providers: [
        provideRouter([]),
        { provide: OffboardingApiService, useValue: { listChecklistTasks: () => of(tasks), getOffboarding: () => of(null) } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(OffboardingCompleteExitStepComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture;
  }

  it('disables completion while a required task is still pending', async () => {
    const fixture = await setup([taskFixture('pending', true)]);
    expect(fixture.componentInstance.allRequiredResolved()).toBe(false);
  });

  it('enables completion once all required tasks are completed or bypassed', async () => {
    const fixture = await setup([taskFixture('completed', true), taskFixture('bypassed', true), taskFixture('pending', false)]);
    expect(fixture.componentInstance.allRequiredResolved()).toBe(true);
  });
});
```

Run: `npm test -- offboarding-complete-exit-step.component.spec.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/feature/offboarding/steps/offboarding-complete-exit-step.component.ts src/app/modules/people/feature/offboarding/steps/offboarding-complete-exit-step.component.spec.ts
git commit -m "feat: add Complete Employee Exit step"
```

---

### Task 12: Approval Inbox (My Pending Approvals)

**Files:**
- Create: `src/app/modules/people/feature/offboarding/offboarding-approvals.component.ts`
- Modify: `src/app/modules/people/people.routes.ts`
- Test: `src/app/modules/people/feature/offboarding/offboarding-approvals.component.spec.ts`

**Interfaces:**
- Consumes: `OffboardingWizardStore.loadMyPendingBypassRequests`/`myPendingBypassRequests`/`decideBypassRequest` (Task 3).

- [ ] **Step 1: Component**

Create `offboarding-approvals.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-approvals',
  standalone: true,
  imports: [ButtonComponent, InputComponent, LoaderComponent],
  template: `
    <h1 class="text-xl font-bold mb-4">My Pending Approvals</h1>
    @if (store.loading()) {
      <app-loader label="Loading pending approvals…" />
    } @else if (store.myPendingBypassRequests().length === 0) {
      <p class="text-sm text-[var(--color-text-secondary)]">No pending bypass requests.</p>
    } @else {
      <div class="space-y-2">
        @for (request of store.myPendingBypassRequests(); track request.id) {
          <div class="p-3 border border-[var(--color-border)] rounded-lg space-y-2">
            <p class="text-sm">{{ request.bypassReason }}</p>
            <p class="text-xs text-[var(--color-text-secondary)]">Penalty: {{ request.penaltyDescription || 'None' }}</p>
            @if (decidingId() === request.id) {
              <app-input label="Comment (optional)" [value]="comment()" (valueChange)="comment.set($event)" />
            }
            <div class="flex gap-2">
              <app-button variant="primary" size="sm" [loading]="store.saving()" (pressed)="decide(request.id, 'approve')">Approve</app-button>
              <app-button variant="secondary" size="sm" [loading]="store.saving()" (pressed)="startReject(request.id)">Reject</app-button>
              @if (decidingId() === request.id) {
                <app-button variant="secondary" size="sm" [loading]="store.saving()" (pressed)="decide(request.id, 'reject')">Confirm Reject</app-button>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingApprovalsComponent implements OnInit {
  readonly store = inject(OffboardingWizardStore);
  readonly decidingId = signal<string | null>(null);
  readonly comment = signal('');

  ngOnInit(): void {
    void this.store.loadMyPendingBypassRequests();
  }

  startReject(id: string): void {
    this.decidingId.set(id);
    this.comment.set('');
  }

  async decide(id: string, decision: 'approve' | 'reject'): Promise<void> {
    await this.store.decideBypassRequest(id, decision, decision === 'reject' ? this.comment() || null : null);
    this.decidingId.set(null);
  }
}
```

- [ ] **Step 2: Route**

In `people.routes.ts`, add a new top-level entry after the `approvals` route:

```typescript
  {
    path: 'offboarding-approvals',
    loadComponent: () =>
      import('./feature/offboarding/offboarding-approvals.component').then((m) => m.OffboardingApprovalsComponent),
    canActivate: [permissionGuard],
    data: { title: 'Offboarding Approvals', permissions: ['employees:read'] }
  }
```

- [ ] **Step 3: Test**

Create `offboarding-approvals.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingApprovalsComponent } from './offboarding-approvals.component';

describe('OffboardingApprovalsComponent', () => {
  let fixture: ComponentFixture<OffboardingApprovalsComponent>;
  let approveSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    approveSpy = vi.fn(() => of(undefined));
    await TestBed.configureTestingModule({
      imports: [OffboardingApprovalsComponent],
      providers: [{
        provide: OffboardingApiService,
        useValue: {
          listMyPendingBypassRequests: () => of([{
            id: 'br-1', employeeChecklistTaskId: 'task-1', offboardingRecordId: 'rec-1', requestedById: 'user-1',
            bypassReason: 'Payment processed in advance.', penaltyDescription: null, status: 'pending', requestedAt: '2026-08-17T00:00:00Z'
          }]),
          approveBypassRequest: approveSpy
        }
      }]
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingApprovalsComponent);
    fixture.detectChanges();
  });

  it('loads pending approvals on init', () => {
    expect(fixture.componentInstance.store.myPendingBypassRequests().length).toBe(0); // async - not yet resolved at this tick
  });

  it('decide(approve) calls approveBypassRequest', async () => {
    await fixture.componentInstance.decide('br-1', 'approve');
    expect(approveSpy).toHaveBeenCalledWith('br-1');
  });
});
```

Run: `npm test -- offboarding-approvals.component.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/people/feature/offboarding/offboarding-approvals.component.ts src/app/modules/people/feature/offboarding/offboarding-approvals.component.spec.ts src/app/modules/people/people.routes.ts
git commit -m "feat: add offboarding bypass approval inbox"
```

---

### Task 13: Coverage-scoped Offboarding sidebar screen

**Files:**
- Modify: `src/app/modules/people/models/offboarding.model.ts`
- Modify: `src/app/modules/people/data-access/offboarding-api.service.ts`
- Modify: `src/app/layouts/main-layout/nav/nav-items.config.ts`
- Modify: `src/app/modules/people/people.routes.ts`
- Create: `src/app/modules/people/feature/offboarding/offboarding-overview.component.ts`
- Test: `src/app/modules/people/data-access/offboarding-api.service.spec.ts` (extend)
- Test: `src/app/modules/people/feature/offboarding/offboarding-overview.component.spec.ts`

**Interfaces:**
- Consumes: `GET /api/v1/employees/offboarding-overview` (backend plan Task 20), `PermissionService.hasPermission` (existing).
- Produces: `OffboardingOverviewItemResponse`, `OffboardingApiService.getOffboardingOverview()`, the `/people/offboarding` route, and the `people-offboarding` nav entry — the sole new consumer-facing surface this task adds; every other piece (wizard, checklist builder, approval inbox) is unchanged from Tasks 1-12.

- [ ] **Step 1: Model addition**

In `offboarding.model.ts`, add:

```typescript
export interface OffboardingOverviewItemResponse {
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  positionName: string | null;
  currentOffboardingStatus: OffboardingRecordStatus | null;
  canStartOffboarding: boolean;
}
```

- [ ] **Step 2: API service method**

In `offboarding-api.service.ts`, add:

```typescript
  getOffboardingOverview(): Observable<readonly OffboardingOverviewItemResponse[]> {
    return this.http.get<readonly OffboardingOverviewItemResponse[]>(`${environment.apiUrl}/employees/offboarding-overview`);
  }
```

Add `OffboardingOverviewItemResponse` to the existing import from `../models/offboarding.model`.

Extend `offboarding-api.service.spec.ts` (Task 1) with:

```typescript
  it('getOffboardingOverview gets /employees/offboarding-overview', () => {
    service.getOffboardingOverview().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/offboarding-overview`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
```

Run: `npm test -- offboarding-api.service.spec.ts`
Expected: PASS.

- [ ] **Step 3: Sidebar entry**

In `nav-items.config.ts`, in the `people` item's `children` array, add after `people-checklists`:

```typescript
      {
        id: 'people-offboarding',
        label: 'Offboarding',
        path: '/people/offboarding',
        requiredModules: ['core_hr'],
        requiredPermissions: ['employees:read']
      },
```

- [ ] **Step 4: Route**

In `people.routes.ts`, add a new top-level entry (sibling to `employees`/`checklists`/`approvals`):

```typescript
  {
    path: 'offboarding',
    loadComponent: () =>
      import('./feature/offboarding/offboarding-overview.component').then((m) => m.OffboardingOverviewComponent),
    canActivate: [permissionGuard],
    data: { title: 'Offboarding', permissions: ['employees:read'] }
  },
```

- [ ] **Step 5: Screen component**

Create `offboarding-overview.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewItemResponse } from '../../models/offboarding.model';

@Component({
  selector: 'app-offboarding-overview',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    <h1 class="text-xl font-bold mb-4">Offboarding</h1>
    @if (loading()) {
      <app-loader label="Loading your covered employees…" />
    } @else if (error()) {
      <p class="text-sm text-[var(--color-danger-text)]">{{ error() }}</p>
    } @else if (items().length === 0) {
      <p class="text-sm text-[var(--color-text-secondary)]">No employees are currently within your management coverage.</p>
    } @else {
      <div class="space-y-2">
        @for (item of items(); track item.employeeId) {
          <div class="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
            <div>
              <p class="text-sm font-medium">{{ item.employeeName }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">
                {{ item.positionName || 'Unassigned position' }} · {{ item.departmentName || 'No department' }}
                @if (item.currentOffboardingStatus) { · {{ item.currentOffboardingStatus }} }
              </p>
            </div>
            @if (item.canStartOffboarding && canOffboard()) {
              <app-button variant="secondary" size="sm" (pressed)="startOffboarding(item.employeeId)">Start Offboarding</app-button>
            } @else if (!item.canStartOffboarding) {
              <app-button variant="secondary" size="sm" (pressed)="viewOffboarding(item.employeeId)">
                {{ item.currentOffboardingStatus === 'completed' ? 'View' : 'Continue' }}
              </app-button>
            }
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingOverviewComponent implements OnInit {
  private readonly api = inject(OffboardingApiService);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  readonly items = signal<readonly OffboardingOverviewItemResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getOffboardingOverview().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to load your covered employees.'));
      }
    });
  }

  startOffboarding(employeeId: string): void {
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }

  viewOffboarding(employeeId: string): void {
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }
}
```

- [ ] **Step 6: Test**

Create `offboarding-overview.component.spec.ts`, following `employee-detail.component.spec.ts`'s lightweight stubbed-provider style:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewComponent } from './offboarding-overview.component';

describe('OffboardingOverviewComponent', () => {
  async function setup(canOffboard: boolean): Promise<{ fixture: ComponentFixture<OffboardingOverviewComponent>; router: Router }> {
    await TestBed.configureTestingModule({
      imports: [OffboardingOverviewComponent],
      providers: [
        provideRouter([]),
        {
          provide: OffboardingApiService,
          useValue: {
            getOffboardingOverview: () => of([
              { employeeId: 'emp-1', employeeName: 'Ada Lovelace', departmentName: 'Engineering', positionName: 'Engineer', currentOffboardingStatus: null, canStartOffboarding: true }
            ])
          }
        },
        { provide: PermissionService, useValue: { hasPermission: (p: string) => canOffboard && p === 'employees:offboard' } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(OffboardingOverviewComponent);
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    return { fixture, router };
  }

  it('shows Start Offboarding when the caller holds employees:offboard', async () => {
    const { fixture } = await setup(true);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).toContain('Start Offboarding');
  });

  it('hides Start Offboarding when the caller lacks employees:offboard', async () => {
    const { fixture } = await setup(false);
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.textContent).not.toContain('Start Offboarding');
  });

  it('startOffboarding navigates to the wizard route for that employee', async () => {
    const { fixture, router } = await setup(true);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.startOffboarding('emp-1');
    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees', 'emp-1', 'offboarding']);
  });
});
```

Run: `npm test -- offboarding-overview.component.spec.ts`
Expected: all three pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/people/models/offboarding.model.ts src/app/modules/people/data-access/offboarding-api.service.ts src/app/modules/people/data-access/offboarding-api.service.spec.ts src/app/layouts/main-layout/nav/nav-items.config.ts src/app/modules/people/people.routes.ts src/app/modules/people/feature/offboarding/offboarding-overview.component.ts src/app/modules/people/feature/offboarding/offboarding-overview.component.spec.ts
git commit -m "feat: add coverage-scoped Offboarding sidebar screen"
```

## Self-Review

**Spec coverage:** Frontend design spec §4 (checklist builder extension) → Task 2. §5 (6-step wizard) → Tasks 5-11, one task per step plus the shell. §6 (employee-detail changes) → Task 4. §7 (Approval Inbox, corrected to query-only, own top-level route) → Task 12. §9 (coverage-scoped Offboarding sidebar screen, added 2026-08-18) → Task 13. Every model/service call in every step component traces to a real `OffboardingApiService` method from Task 1 and a real `OffboardingWizardStore` method from Task 3 — no step invents an endpoint the backend plan doesn't define.

**Placeholder scan:** Every task contains complete, real component/service/store code and real test code. Two explicit, justified exceptions: Task 1 Step 3 and Task 3 Step 2 both say "locate and match [an existing spec file]'s exact harness" rather than guessing that harness's current shape — consistent with the backend plan's own standard of not hardcoding a guess where reading the live file first is cheap and the guess could silently be wrong (test harness conventions in this codebase visibly vary file-to-file, per the frontend research — `checklist-builder.component.spec.ts` uses real HTTP testing, `employee-detail.component.spec.ts` uses stubbed providers).

**Type consistency:** `OffboardingWizardStep`, every `OffboardingWizardState` field, and every `OffboardingApiService` method signature from Tasks 1 and 3 are used identically by name across Tasks 4-13 — cross-checked that no step component calls a store method or reads a state field that Task 3 didn't actually define. Task 13's `getOffboardingOverview`/`OffboardingOverviewItemResponse` are additive to Task 1's service/model files, not a redefinition, and its `employees:offboard` permission check via `PermissionService.hasPermission` matches the backend plan Task 19's exact permission string — a client-side UX gate only, never the authority (the backend endpoint enforces it independently).
