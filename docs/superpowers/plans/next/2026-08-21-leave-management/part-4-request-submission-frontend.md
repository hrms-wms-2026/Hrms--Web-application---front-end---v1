# Leave Management (Frontend) - Part 4: Request Submission (Phase 4 of 10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Screen 5 (New Request) end to end: the 5-step request wizard (leave type + live remaining days, dates + half-day, live total + warnings, reason + document, review + submit), own request history on the My Balances page, and an HR "submit on behalf of" entry point from the Entitlements screen.

**Architecture:** Follows the Phase 1-3 leave-module conventions exactly (verified against the actually-shipped code, not just the plan): thin `HttpClient` API service, one `signalStore` for request state, a presentational history table, and a wizard component that owns its own step/draft state locally (per `onevo-frontend-architecture`'s rule that UI-local state - modal open, active step - never lives in the store). The wizard calls the backend's `preview` endpoint on every data-changing step so all business rules (balance split, warnings, conflicts) are evaluated server-side; the frontend never re-implements that logic.

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals`, RxJS, Vitest, `HttpClientTestingModule`.

**Spec:** Screen 5 in `C:\HR\leave-management-complete.md` (lines 340-370, read in full for this plan - quoted verbatim below where it drives a UI decision). Design doc: `docs/superpowers/specs/next/2026-08-21-leave-management-design.md`. Backend companion: `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-21-leave-management/part-4-request-submission.md`, shipped on `feat/leave-management-part-4` (all API shapes below are read directly from that branch's checked-out worktree source, not the plan doc, since shipped code can diverge from what was planned).

## Global Constraints

- Frontend only. `feat/leave-management-part-4` is not yet merged into `development` - point `environment.apiUrl` at that branch's running API for local dev/testing.
- Follow the module's established conventions exactly (`leave-balance.store.ts`/`my-balances.component.ts` are the closest reference implementations, already shipped this session): thin `HttpClient` API service `providedIn: 'root'`; one `signalStore` per aggregate; presentational tables take `@Input`/`@Output` only; wizard/modal-local state (current step, in-progress draft) is a `signal()` inside the component, never in the store.
- **Resolved scope decision (calendar markings):** Screen 5 step 2 says "Calendar marks weekends, public holidays, existing leave, and a badge for how many teammates are already off." That data comes from the Team Calendar endpoint (`GET /leave/calendar`, Phase 7 - not yet built on either side, confirmed by `find` returning no `LeaveCalendarController` on `feat/leave-management-part-4`). This phase uses the plain `app-date-picker` with no overlay markings. Revisit when Phase 7 ships.
- **Resolved scope decision (file upload):** Screen 5 step 4 needs file upload for supporting documents, submitted as `fileRecordIds: Guid[]`. No generic file/document upload controller exists anywhere in the backend yet (confirmed by `grep` across `Controllers/` on `feat/leave-management-part-4` - zero matches for any file/storage/upload route). This phase ships the Reason field and the document-required messaging (surfaced verbatim from the backend's `DocumentRequired` validation error) but the file picker itself is out of scope - `fileRecordIds` is always submitted as `[]`. A leave type with `requiresDocument` + `documentRequiredAfterDays` configured will correctly block long requests with the backend's real error until a file-upload endpoint exists; don't build a fake/local-only file picker to work around that.
- **Resolved scope decision (gender-restricted types):** Screen 5 step 1 says gender-restricted types are hidden from the dropdown. No employee gender field is exposed anywhere in the frontend yet (confirmed by `grep -ri gender` across `core/` and `modules/` - zero matches). This phase shows all active leave types regardless of `applicableGender`; the backend still enforces it server-side (`GenderRestricted` error surfaces if picked and disallowed). Revisit once a "my employee profile" gender field exists.
- **Resolved scope decision (row click / detail / cancel):** the product spec says "Click a row for request detail," but a request detail view with actions belongs to Screen 8 (Approval, Phase 5) and cancellation belongs to Phase 6 - neither exists yet. This phase's history table is read-only display only, no row click handler.
- `LeaveRequestResponse`, `LeaveRequestListItemResponse`, and the two submit request shapes are copied verbatim (camelCased) from the backend C# records read directly off `feat/leave-management-part-4`. Do not rename fields - Phase 5 (approvals) and Phase 6 (cancellation) read this same shape.
- The **same** `SubmitLeaveRequestRequest` payload shape is used for both the `preview` and the real `submit` calls (confirmed from `LeaveRequestsController.cs`: `Preview` and `Submit` both bind `[FromBody] SubmitLeaveRequestRequest`). The wizard should build one draft object and pass it to whichever call is needed - don't create two different draft-to-request mappers.
- Reuse existing shared pieces instead of rebuilding: `app-button`, `app-empty-state`, `app-error-state`, `app-select`, `app-date-picker` (`shared/ui`), `app-modal` (`shared/ui/modal`), `EmployeePickerComponent` (`work/ui/employee-picker`, already reused by the Phase 3 manual-entitlement modal - same cross-module import pattern applies here), and `LeaveBalanceStore.my()` (Phase 3, already shipped) as the source of "remaining days beside each name" for the leave-type dropdown - do not add a new balance-lookup endpoint call.
- Every write action error is surfaced via `NotificationService.error` reading the backend's own message (`toSafeErrorMessage`, RFC7807 `detail` field) - the backend already returns exact, user-facing strings (`LeaveRequestMessages`), so the frontend does not need its own copy of validation error text.

---

### Task 1: Response/request models

**Files:**
- Create: `src/app/modules/leave/models/leave-request.model.ts`

- [ ] **Step 1: Create the model file**

Create `src/app/modules/leave/models/leave-request.model.ts`:

```typescript
/** Matches ONEVO.Application.Features.Leave.Request.DTOs.Responses.* verbatim. */
export interface LeaveRequestBalanceImpactResponse {
  currentRemainingDays: number;
  pendingAfterSubmitDays: number;
  remainingAfterSubmitDays: number;
}

export interface LeaveRequestApproverResponse {
  approverEmployeeId: string;
  sequenceOrder: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  delegatedFromApproverId: string | null;
}

export interface LeaveRequestWarningResponse {
  code: string;
  message: string;
}

export interface LeaveRequestCalendarConflictResponse {
  source: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
}

export interface LeaveRequestConflictSnapshotResponse {
  warnings: LeaveRequestWarningResponse[];
  calendarConflicts: LeaveRequestCalendarConflictResponse[];
  teamAbsencePercent: number | null;
}

export interface LeaveRequestResponse {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  halfDayPeriod: 'am' | 'pm' | null;
  totalDays: number;
  paidDays: number;
  unpaidDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  noticePeriodMissed: boolean;
  submittedOnBehalfOfBy: string | null;
  balanceImpact: LeaveRequestBalanceImpactResponse;
  approvers: LeaveRequestApproverResponse[];
  conflictSnapshot: LeaveRequestConflictSnapshotResponse;
  createdAt: string;
}

export interface LeaveRequestListItemResponse {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  paidDays: number;
  unpaidDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  noticePeriodMissed: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** Matches ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestRequest verbatim. Shared by preview and submit. */
export interface SubmitLeaveRequestRequest {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDayPeriod: 'am' | 'pm' | null;
  reason: string | null;
  fileRecordIds: string[] | null;
}

/** Matches ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestOnBehalfRequest verbatim. */
export interface SubmitLeaveRequestOnBehalfRequest extends SubmitLeaveRequestRequest {
  employeeId: string;
}

export interface LeaveRequestListFilter {
  status?: string;
  fromDate?: string;
  toDate?: string;
  leaveTypeId?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/modules/leave/models/leave-request.model.ts
git commit -m "feat(leave): add leave request models"
```

---

### Task 2: API service

**Files:**
- Create: `src/app/modules/leave/data-access/leave-request-api.service.ts`
- Create: `src/app/modules/leave/data-access/leave-request-api.service.spec.ts`

**Interfaces:**
- Produces: `LeaveRequestApiService.{preview, submit, submitOnBehalf, listMine}`

- [ ] **Step 1: Write the failing API service tests**

Create `src/app/modules/leave/data-access/leave-request-api.service.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';
import { LeaveRequestApiService } from './leave-request-api.service';

describe('LeaveRequestApiService', () => {
  let service: LeaveRequestApiService;
  let httpMock: HttpTestingController;

  const mockResponse: LeaveRequestResponse = {
    id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
    startDate: '2026-09-10', endDate: '2026-09-12', halfDayPeriod: null, totalDays: 3, paidDays: 3, unpaidDays: 0,
    status: 'pending', noticePeriodMissed: false, submittedOnBehalfOfBy: null,
    balanceImpact: { currentRemainingDays: 17, pendingAfterSubmitDays: 3, remainingAfterSubmitDays: 14 },
    approvers: [{ approverEmployeeId: 'mgr-1', sequenceOrder: 1, status: 'pending', delegatedFromApproverId: null }],
    conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
    createdAt: '2026-08-25T00:00:00Z'
  };

  const payload: SubmitLeaveRequestRequest = {
    leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12',
    halfDayPeriod: null, reason: 'Trip', fileRecordIds: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveRequestApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveRequestApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('previews a request', () => {
    service.preview(payload).subscribe((res) => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('submits a request', () => {
    service.submit(payload).subscribe((res) => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockResponse);
  });

  it('submits on behalf of an employee', () => {
    const onBehalfPayload: SubmitLeaveRequestOnBehalfRequest = { ...payload, employeeId: 'emp-2' };
    service.submitOnBehalf(onBehalfPayload).subscribe((res) => expect(res).toEqual(mockResponse));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/on-behalf`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(onBehalfPayload);
    req.flush(mockResponse);
  });

  it('lists my requests with filters', () => {
    const items: LeaveRequestListItemResponse[] = [];
    service.listMine({ status: 'pending', leaveTypeId: 'type-1' }).subscribe((res) => expect(res).toEqual(items));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/my?status=pending&leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    req.flush(items);
  });

  it('lists my requests with no filters', () => {
    service.listMine({}).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/leave-request-api.service.spec.ts' --watch=false
```

Expected: FAIL - `leave-request-api.service.ts` does not exist.

- [ ] **Step 3: Implement the API service**

Create `src/app/modules/leave/data-access/leave-request-api.service.ts`:

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  LeaveRequestListFilter,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveRequestsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveRequestApiService {
  private readonly http = inject(HttpClient);

  preview(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.http.post<LeaveRequestResponse>(`${environment.apiUrl}/leave/requests/preview`, payload);
  }

  submit(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.http.post<LeaveRequestResponse>(`${environment.apiUrl}/leave/requests`, payload);
  }

  submitOnBehalf(payload: SubmitLeaveRequestOnBehalfRequest): Observable<LeaveRequestResponse> {
    return this.http.post<LeaveRequestResponse>(`${environment.apiUrl}/leave/requests/on-behalf`, payload);
  }

  listMine(filter: LeaveRequestListFilter): Observable<LeaveRequestListItemResponse[]> {
    let params = new HttpParams();
    if (filter.status) params = params.set('status', filter.status);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId);
    return this.http.get<LeaveRequestListItemResponse[]>(`${environment.apiUrl}/leave/requests/my`, { params });
  }
}
```

- [ ] **Step 4: Run API service tests**

Run:

```bash
npm test -- --include='**/leave-request-api.service.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/data-access/leave-request-api.service.ts src/app/modules/leave/data-access/leave-request-api.service.spec.ts
git commit -m "feat(leave): add leave request API service"
```

---

### Task 3: State store

**Files:**
- Create: `src/app/modules/leave/state/leave-request.store.ts`
- Create: `src/app/modules/leave/state/leave-request.store.spec.ts`

**Interfaces:**
- Produces: `LeaveRequestStore.{myRequests, myRequestsLoading, myRequestsError, myRequestsFilter, previewing, previewResult, previewError, submitting, submitError}` state + `loadMine, setMyRequestsFilter, preview, clearPreview, submit, submitOnBehalf` methods

- [ ] **Step 1: Write the failing store tests**

Create `src/app/modules/leave/state/leave-request.store.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveRequestListItemResponse, LeaveRequestResponse, SubmitLeaveRequestRequest } from '../models/leave-request.model';
import { LeaveRequestStore } from './leave-request.store';

describe('LeaveRequestStore', () => {
  let store: InstanceType<typeof LeaveRequestStore>;
  let httpMock: HttpTestingController;

  const mockResponse: LeaveRequestResponse = {
    id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
    startDate: '2026-09-10', endDate: '2026-09-12', halfDayPeriod: null, totalDays: 3, paidDays: 3, unpaidDays: 0,
    status: 'pending', noticePeriodMissed: false, submittedOnBehalfOfBy: null,
    balanceImpact: { currentRemainingDays: 17, pendingAfterSubmitDays: 3, remainingAfterSubmitDays: 14 },
    approvers: [], conflictSnapshot: { warnings: [], calendarConflicts: [], teamAbsencePercent: null },
    createdAt: '2026-08-25T00:00:00Z'
  };

  const payload: SubmitLeaveRequestRequest = {
    leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12',
    halfDayPeriod: null, reason: 'Trip', fileRecordIds: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveRequestStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveRequestStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads my requests', async () => {
    const items: LeaveRequestListItemResponse[] = [];
    const loading = store.loadMine();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush(items);
    await loading;
    expect(store.myRequests()).toEqual(items);
    expect(store.myRequestsLoading()).toBe(false);
  });

  it('reloads with new filters when setMyRequestsFilter is called', async () => {
    const loading = store.loadMine();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    await loading;
    store.setMyRequestsFilter({ status: 'pending' });
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/requests/my?status=pending`);
    req.flush([]);
  });

  it('runs a preview into previewResult', async () => {
    const previewing = store.preview(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`).flush(mockResponse);
    await previewing;
    expect(store.previewResult()).toEqual(mockResponse);
    expect(store.previewing()).toBe(false);
  });

  it('sets previewError on a failed preview and clears previewResult', async () => {
    const previewing = store.preview(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`)
      .flush({ detail: 'Insufficient balance. You have 1 days remaining for Annual Leave' }, { status: 400, statusText: 'Bad Request' });
    await previewing;
    expect(store.previewResult()).toBeNull();
    expect(store.previewError()).toContain('Insufficient balance');
  });

  it('clearPreview resets preview state', async () => {
    const previewing = store.preview(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/preview`).flush(mockResponse);
    await previewing;
    store.clearPreview();
    expect(store.previewResult()).toBeNull();
  });

  it('submit succeeds and reloads my requests', async () => {
    const submitting = store.submit(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests`).flush(mockResponse);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    const result = await submitting;
    expect(result).toEqual(mockResponse);
    expect(store.submitting()).toBe(false);
  });

  it('submit sets submitError and returns null on failure', async () => {
    const submitting = store.submit(payload);
    httpMock.expectOne(`${environment.apiUrl}/leave/requests`)
      .flush({ detail: 'You already have a pending/approved leave request overlapping these dates' }, { status: 409, statusText: 'Conflict' });
    const result = await submitting;
    expect(result).toBeNull();
    expect(store.submitError()).toContain('overlapping');
  });

  it('submitOnBehalf posts to the on-behalf endpoint', async () => {
    const submitting = store.submitOnBehalf({ ...payload, employeeId: 'emp-2' });
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/on-behalf`).flush(mockResponse);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
    const result = await submitting;
    expect(result).toEqual(mockResponse);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/leave-request.store.spec.ts' --watch=false
```

Expected: FAIL - `leave-request.store.ts` does not exist.

- [ ] **Step 3: Implement the store**

Create `src/app/modules/leave/state/leave-request.store.ts`:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveRequestApiService } from '../data-access/leave-request-api.service';
import {
  LeaveRequestListFilter,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';

export interface LeaveRequestState {
  readonly myRequests: readonly LeaveRequestListItemResponse[];
  readonly myRequestsLoading: boolean;
  readonly myRequestsError: string | null;
  readonly myRequestsFilter: LeaveRequestListFilter;
  readonly previewing: boolean;
  readonly previewResult: LeaveRequestResponse | null;
  readonly previewError: string | null;
  readonly submitting: boolean;
  readonly submitError: string | null;
}

const initialState: LeaveRequestState = {
  myRequests: [],
  myRequestsLoading: false,
  myRequestsError: null,
  myRequestsFilter: {},
  previewing: false,
  previewResult: null,
  previewError: null,
  submitting: false,
  submitError: null
};

export const LeaveRequestStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveRequestState>(initialState),
  withMethods((store, api = inject(LeaveRequestApiService)) => ({
    setMyRequestsFilter(filter: LeaveRequestListFilter): void {
      patchState(store, { myRequestsFilter: filter });
      void this.loadMine();
    },
    async loadMine(): Promise<void> {
      patchState(store, { myRequestsLoading: true, myRequestsError: null });
      try {
        const myRequests = await firstValueFrom(api.listMine(store.myRequestsFilter()));
        patchState(store, { myRequests, myRequestsLoading: false });
      } catch (err) {
        patchState(store, { myRequestsLoading: false, myRequestsError: toSafeErrorMessage(err, 'Failed to load your requests.') });
      }
    },
    async preview(payload: SubmitLeaveRequestRequest): Promise<void> {
      patchState(store, { previewing: true, previewError: null, previewResult: null });
      try {
        const previewResult = await firstValueFrom(api.preview(payload));
        patchState(store, { previewing: false, previewResult });
      } catch (err) {
        patchState(store, { previewing: false, previewError: toSafeErrorMessage(err, 'Failed to preview this request.') });
      }
    },
    clearPreview(): void {
      patchState(store, { previewResult: null, previewError: null });
    },
    async submit(payload: SubmitLeaveRequestRequest): Promise<LeaveRequestResponse | null> {
      patchState(store, { submitting: true, submitError: null });
      try {
        const result = await firstValueFrom(api.submit(payload));
        patchState(store, { submitting: false, previewResult: null });
        await this.loadMine();
        return result;
      } catch (err) {
        patchState(store, { submitting: false, submitError: toSafeErrorMessage(err, 'Failed to submit this request.') });
        return null;
      }
    },
    async submitOnBehalf(payload: SubmitLeaveRequestOnBehalfRequest): Promise<LeaveRequestResponse | null> {
      patchState(store, { submitting: true, submitError: null });
      try {
        const result = await firstValueFrom(api.submitOnBehalf(payload));
        patchState(store, { submitting: false, previewResult: null });
        await this.loadMine();
        return result;
      } catch (err) {
        patchState(store, { submitting: false, submitError: toSafeErrorMessage(err, 'Failed to submit this request.') });
        return null;
      }
    }
  }))
);
```

Note: `submitOnBehalf` calling `this.loadMine()` afterwards reloads the *current user's own* request list, which is a no-op refresh when HR submits for someone else (their own list doesn't change). That's harmless (matches the store's single source of truth) but not useful for the HR case - the Entitlements screen doesn't read `myRequests`, so this is fine to leave as-is rather than adding a second list just for this.

- [ ] **Step 4: Run store tests**

Run:

```bash
npm test -- --include='**/leave-request.store.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/state/leave-request.store.ts src/app/modules/leave/state/leave-request.store.spec.ts
git commit -m "feat(leave): add leave request store"
```

---

### Task 4: Request history table (presentational)

**Files:**
- Create: `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.ts`
- Create: `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.html`
- Create: `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.css`
- Create: `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.spec.ts`

Matches the product spec's Screen 4 history table columns exactly: "Type · Start · End · Total days · Status (green Approved, yellow Pending, red Rejected, grey Cancelled) · Approved By · Submitted On." `LeaveRequestListItemResponse` has no "Approved By" field (approver identity isn't part of the list DTO - only the detail response's `approvers` array has it, and the detail response isn't fetched for a list row per the read-only scope decision above), so that column renders `-` for now rather than a second API call per row.

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';
import { LeaveRequestHistoryTableComponent } from './leave-request-history-table.component';

describe('LeaveRequestHistoryTableComponent', () => {
  let fixture: ComponentFixture<LeaveRequestHistoryTableComponent>;

  const requests: LeaveRequestListItemResponse[] = [
    { id: 'req-1', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startDate: '2026-09-10', endDate: '2026-09-12', totalDays: 3, paidDays: 3, unpaidDays: 0, status: 'pending', noticePeriodMissed: false, createdAt: '2026-08-25T00:00:00Z', updatedAt: null },
    { id: 'req-2', employeeId: 'emp-1', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', startDate: '2026-07-01', endDate: '2026-07-01', totalDays: 1, paidDays: 1, unpaidDays: 0, status: 'rejected', noticePeriodMissed: true, createdAt: '2026-06-20T00:00:00Z', updatedAt: '2026-06-21T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveRequestHistoryTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveRequestHistoryTableComponent);
    fixture.componentRef.setInput('requests', requests);
  });

  it('renders one row per request', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="request-row"]').length).toBe(2);
  });

  it('shows a status badge matching each status', () => {
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('[data-testid="request-status"]');
    expect(badges[0].textContent.trim()).toBe('Pending');
    expect(badges[0].className).toContain('lrh-status-pending');
    expect(badges[1].textContent.trim()).toBe('Rejected');
    expect(badges[1].className).toContain('lrh-status-rejected');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/leave-request-history-table.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.ts`:

```typescript
/** Quiet Operations Desk: a read-only scan of the employee's own submitted requests. */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveRequestListItemResponse } from '../../models/leave-request.model';

@Component({ selector: 'app-leave-request-history-table', standalone: true, imports: [CommonModule], templateUrl: './leave-request-history-table.component.html', styleUrl: './leave-request-history-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveRequestHistoryTableComponent {
  @Input({ required: true }) requests: readonly LeaveRequestListItemResponse[] = [];

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
}
```

Create `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.html`:

```html
<table class="lrh-table">
  <thead>
    <tr><th>Type</th><th>Start</th><th>End</th><th>Total Days</th><th>Status</th><th>Approved By</th><th>Submitted On</th></tr>
  </thead>
  <tbody>
    @for (request of requests; track request.id) {
      <tr data-testid="request-row">
        <td>{{ request.leaveTypeName }}</td>
        <td>{{ request.startDate }}</td>
        <td>{{ request.endDate }}</td>
        <td>{{ request.totalDays.toFixed(1) }}</td>
        <td><span data-testid="request-status" class="lrh-status" [class]="'lrh-status-' + request.status">{{ statusLabel(request.status) }}</span></td>
        <td>-</td>
        <td>{{ request.createdAt | slice:0:10 }}</td>
      </tr>
    }
  </tbody>
</table>
```

Create `src/app/modules/leave/ui/leave-request-history-table/leave-request-history-table.component.css`:

```css
.lrh-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.lrh-table th { text-align: left; padding: .55rem .7rem; color: var(--color-text-secondary, #64748b); font-weight: 650; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.lrh-table td { padding: .6rem .7rem; color: var(--color-text-primary, #18202d); border-bottom: 1px solid var(--color-border, #e4e8ee); }
.lrh-status { display: inline-block; padding: .15rem .55rem; border-radius: 999px; font-size: .72rem; font-weight: 650; }
.lrh-status-pending { background: #fef3e2; color: #8a5a12; }
.lrh-status-approved { background: #e3f6e8; color: #1c7a3a; }
.lrh-status-rejected { background: #fde8e6; color: #a3271d; }
.lrh-status-cancelled { background: #eef1f4; color: #556170; }
```

Note: `{{ request.createdAt | slice:0:10 }}` needs Angular's `SlicePipe` - it's part of `CommonModule`, already imported, so no extra import is needed.

- [ ] **Step 4: Run component test**

Run:

```bash
npm test -- --include='**/leave-request-history-table.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/ui/leave-request-history-table
git commit -m "feat(leave): add leave request history table"
```

---

### Task 5: New Leave Request wizard (5 steps)

**Files:**
- Create: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.ts`
- Create: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.html`
- Create: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.css`
- Create: `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.spec.ts`

Steps, verbatim from the product spec (Screen 5):
1. Leave type dropdown, remaining days beside each name (`Annual Leave — 15 days remaining`). Zero-balance types shown greyed but still selectable.
2. Start date, End date, half-day toggle (AM/PM, same-day only per `LeaveRequestMessages.HalfDaySameDay`).
3. Live total + warnings - triggered by calling `preview` on entering this step and again on any date/type change; renders `previewResult.totalDays`, `previewResult.conflictSnapshot.warnings`, and collapsible `calendarConflicts` (non-blocking).
4. Reason (free text) + document notice (file upload itself out of scope - see Global Constraints).
5. Review (type, dates, days, `balanceImpact.currentRemainingDays` -> `remainingAfterSubmitDays`) + Submit.

HR mode (`forEmployeeId` input set): prepends an employee-picker requirement before step 1 can be left, and calls `submitOnBehalf` instead of `submit` on the final step.

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { NewLeaveRequestWizardComponent } from './new-leave-request-wizard.component';

describe('NewLeaveRequestWizardComponent', () => {
  let fixture: ComponentFixture<NewLeaveRequestWizardComponent>;

  const leaveTypes: LeaveTypeResponse[] = [
    { id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual', isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20, carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0, isActive: true, createdAt: '2026-08-21T00:00:00Z' }
  ];
  const balances: LeaveBalanceResponse[] = [
    { employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null, legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, entitledDays: 20, annualDays: 20, carriedForwardDays: 0, usedDays: 5, pendingDays: 0, remainingDays: 15, isNegative: false, carryForwardExpiresOn: null }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [NewLeaveRequestWizardComponent] }).compileComponents();
    fixture = TestBed.createComponent(NewLeaveRequestWizardComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('leaveTypes', leaveTypes);
    fixture.componentRef.setInput('balances', balances);
  });

  it('shows remaining days next to each leave type option', () => {
    fixture.detectChanges();
    const options: HTMLOptionElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="leave-type-select"] option'));
    expect(options.some((o) => o.textContent?.includes('Annual Leave') && o.textContent?.includes('15 days remaining'))).toBe(true);
  });

  it('does not advance past step 1 until a leave type is picked', () => {
    fixture.detectChanges();
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(1);
  });

  it('advances through steps once required fields are filled', () => {
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(2);
    fixture.componentInstance.draft.update((d) => ({ ...d, startDate: '2026-09-10', endDate: '2026-09-12' }));
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(3);
  });

  it('emits preview with the current draft when leaving step 2', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.previewRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12' }));
    fixture.componentInstance.step.set(2);
    fixture.componentInstance.onNext();
    expect(emitted).toEqual([{ leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', halfDayPeriod: null, reason: null, fileRecordIds: [] }]);
  });

  it('requires an employee to be picked in on-behalf mode before advancing', () => {
    fixture.componentRef.setInput('onBehalf', true);
    fixture.detectChanges();
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1' }));
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(1);
    fixture.componentInstance.onEmployeePicked('emp-2');
    fixture.componentInstance.onNext();
    expect(fixture.componentInstance.step()).toBe(2);
  });

  it('emits submit with the on-behalf shape in on-behalf mode', () => {
    fixture.componentRef.setInput('onBehalf', true);
    fixture.detectChanges();
    fixture.componentInstance.onEmployeePicked('emp-2');
    fixture.componentInstance.draft.update((d) => ({ ...d, leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', reason: 'Trip' }));
    fixture.componentInstance.step.set(5);
    const emitted: unknown[] = [];
    fixture.componentInstance.submitRequested.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmit();
    expect(emitted).toEqual([{ employeeId: 'emp-2', leaveTypeId: 'type-1', startDate: '2026-09-10', endDate: '2026-09-12', halfDayPeriod: null, reason: 'Trip', fileRecordIds: [] }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/new-leave-request-wizard.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.ts`:

```typescript
/** Screen 5, 5 steps per the product spec: type -> dates -> live total/warnings -> reason -> review & submit. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveRequestResponse, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';

export interface LeaveRequestDraft {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDayPeriod: 'am' | 'pm' | null;
  reason: string | null;
}

function emptyDraft(): LeaveRequestDraft {
  return { leaveTypeId: '', startDate: '', endDate: '', halfDayPeriod: null, reason: null };
}

@Component({
  selector: 'app-new-leave-request-wizard',
  standalone: true,
  imports: [CommonModule, ModalComponent, DatePickerComponent, EmployeePickerComponent],
  templateUrl: './new-leave-request-wizard.component.html',
  styleUrl: './new-leave-request-wizard.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NewLeaveRequestWizardComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = [];
  @Input() onBehalf = false;
  @Input() previewing = false;
  @Input() previewResult: LeaveRequestResponse | null = null;
  @Input() previewError: string | null = null;
  @Input() submitting = false;
  @Input() submitError: string | null = null;
  @Output() previewRequested = new EventEmitter<SubmitLeaveRequestRequest>();
  @Output() submitRequested = new EventEmitter<SubmitLeaveRequestRequest | SubmitLeaveRequestOnBehalfRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly step = signal(1);
  readonly draft = signal<LeaveRequestDraft>(emptyDraft());
  readonly employeeId = signal<string | null>(null);
  readonly pickerOpen = signal(false);

  readonly steps = ['Leave type', 'Dates', 'Total & warnings', 'Reason', 'Review'];
  readonly activeLeaveTypes = computed(() => this.leaveTypes.filter((type) => type.isActive));

  remainingDaysFor(leaveTypeId: string): number | null {
    const balance = this.balances.find((b) => b.leaveTypeId === leaveTypeId);
    return balance ? balance.remainingDays : null;
  }

  onLeaveTypeChange(leaveTypeId: string): void {
    this.draft.update((d) => ({ ...d, leaveTypeId }));
  }

  onEmployeePicked(id: string): void {
    this.employeeId.set(id);
    this.pickerOpen.set(false);
  }

  canLeaveStep(step: number): boolean {
    const d = this.draft();
    if (step === 1) return this.onBehalf ? this.employeeId() !== null && !!d.leaveTypeId : !!d.leaveTypeId;
    if (step === 2) return !!d.startDate && !!d.endDate && d.endDate >= d.startDate;
    return true;
  }

  onNext(): void {
    if (!this.canLeaveStep(this.step())) return;
    if (this.step() === 2) this.previewRequested.emit(this.toRequest());
    this.step.update((s) => Math.min(5, s + 1));
  }

  onBack(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  onSubmit(): void {
    const request = this.toRequest();
    if (this.onBehalf) {
      const employeeId = this.employeeId();
      if (!employeeId) return;
      this.submitRequested.emit({ ...request, employeeId } as SubmitLeaveRequestOnBehalfRequest);
    } else {
      this.submitRequested.emit(request);
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  private toRequest(): SubmitLeaveRequestRequest {
    const d = this.draft();
    return {
      leaveTypeId: d.leaveTypeId,
      startDate: d.startDate,
      endDate: d.endDate,
      halfDayPeriod: d.halfDayPeriod,
      reason: d.reason,
      fileRecordIds: []
    };
  }
}
```

- [ ] **Step 4: Add the template**

Create `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.html`:

```html
<app-modal [open]="open" title="New Leave Request" (closed)="onClose()">
  <div class="nlw-body">
    @if (onBehalf && step() === 1) {
      <button type="button" class="nlw-picker-trigger" (click)="pickerOpen.set(true)">{{ employeeId() ? 'Employee selected' : 'Choose employee' }}</button>
      <app-employee-picker [open]="pickerOpen()" (selected)="onEmployeePicked($event)" (closed)="pickerOpen.set(false)" />
    }

    @if (step() === 1) {
      <label class="nlw-field">
        <span>Leave Type</span>
        <select data-testid="leave-type-select" [value]="draft().leaveTypeId" (change)="onLeaveTypeChange($any($event.target).value)">
          <option value="">Select a leave type</option>
          @for (type of activeLeaveTypes(); track type.id) {
            <option [value]="type.id" [class.nlw-zero-balance]="remainingDaysFor(type.id) === 0">
              {{ type.name }} @if (remainingDaysFor(type.id) !== null) { - {{ remainingDaysFor(type.id) }} days remaining }
            </option>
          }
        </select>
      </label>
    }

    @if (step() === 2) {
      <app-date-picker label="Start date" [value]="draft().startDate" (valueChange)="draft.update(d => ({...d, startDate: $event}))" />
      <app-date-picker label="End date" [value]="draft().endDate" (valueChange)="draft.update(d => ({...d, endDate: $event}))" />
      <label class="nlw-field">
        <span>Half day</span>
        <select [value]="draft().halfDayPeriod ?? ''" (change)="draft.update(d => ({...d, halfDayPeriod: ($any($event.target).value || null)}))">
          <option value="">Full day(s)</option>
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
      </label>
    }

    @if (step() === 3) {
      @if (previewing) {
        <p class="nlw-muted">Calculating total and checking policy warnings...</p>
      } @else if (previewError) {
        <p class="nlw-error">{{ previewError }}</p>
      } @else if (previewResult) {
        <p class="nlw-total">Total leave days: <strong>{{ previewResult.totalDays }}</strong></p>
        @if (previewResult.noticePeriodMissed) {
          <p class="nlw-warning">This request does not meet the minimum notice period. Your manager will be informed.</p>
        }
        @for (warning of previewResult.conflictSnapshot.warnings; track warning.code) {
          <p class="nlw-warning">{{ warning.message }}</p>
        }
        @if (previewResult.conflictSnapshot.calendarConflicts.length > 0) {
          <details class="nlw-conflicts">
            <summary>{{ previewResult.conflictSnapshot.calendarConflicts.length }} calendar conflict(s) - does not block submission</summary>
            @for (conflict of previewResult.conflictSnapshot.calendarConflicts; track conflict.title) {
              <p>{{ conflict.title }} ({{ conflict.source }})</p>
            }
          </details>
        }
      }
    }

    @if (step() === 4) {
      <label class="nlw-field">
        <span>Reason</span>
        <textarea rows="3" [value]="draft().reason ?? ''" (input)="draft.update(d => ({...d, reason: ($any($event.target).value || null)}))"></textarea>
      </label>
      <p class="nlw-muted">Document upload is not available yet - if this leave type requires a document past a certain length, submission will be blocked with an explanation.</p>
    }

    @if (step() === 5) {
      <div class="nlw-review">
        <span>Type</span><strong>{{ draft().leaveTypeId }}</strong>
        <span>Dates</span><strong>{{ draft().startDate }} - {{ draft().endDate }}</strong>
        @if (previewResult) {
          <span>Total Days</span><strong>{{ previewResult.totalDays }}</strong>
          <span>Balance</span><strong>{{ previewResult.balanceImpact.currentRemainingDays }} -&gt; {{ previewResult.balanceImpact.remainingAfterSubmitDays }}</strong>
        }
      </div>
      @if (submitError) { <p class="nlw-error">{{ submitError }}</p> }
    }

    <div class="nlw-actions">
      @if (step() > 1) { <button type="button" class="nlw-secondary" (click)="onBack()">Back</button> }
      @if (step() < 5) {
        <button type="button" class="nlw-primary" [disabled]="!canLeaveStep(step())" (click)="onNext()">Continue</button>
      } @else {
        <button type="button" class="nlw-primary" [disabled]="submitting || !previewResult" (click)="onSubmit()">{{ submitting ? 'Submitting...' : 'Submit' }}</button>
      }
    </div>
  </div>
</app-modal>
```

- [ ] **Step 5: Add the stylesheet**

Create `src/app/modules/leave/ui/new-leave-request-wizard/new-leave-request-wizard.component.css`:

```css
.nlw-body { display: flex; flex-direction: column; gap: .8rem; min-width: 340px; }
.nlw-field { display: flex; flex-direction: column; gap: .3rem; font-size: .8rem; color: var(--color-text-secondary, #64748b); }
.nlw-field select, .nlw-field textarea { border-radius: 6px; border: 1px solid var(--color-border, #e4e8ee); padding: .4rem .6rem; font-family: inherit; }
.nlw-zero-balance { color: #9aa4b2; }
.nlw-picker-trigger { text-align: left; border: 1px dashed var(--color-border, #e4e8ee); border-radius: 6px; padding: .5rem .7rem; font-size: .82rem; background: transparent; cursor: pointer; }
.nlw-muted { color: var(--color-text-secondary, #64748b); font-size: .8rem; }
.nlw-total { font-size: .9rem; }
.nlw-warning { color: #8a5a12; font-size: .8rem; background: #fef3e2; border-radius: 6px; padding: .45rem .65rem; }
.nlw-error { color: #a3271d; font-size: .8rem; }
.nlw-conflicts { font-size: .8rem; color: var(--color-text-secondary, #64748b); }
.nlw-review { display: grid; grid-template-columns: auto 1fr; gap: .3rem .8rem; font-size: .84rem; }
.nlw-review span { color: var(--color-text-secondary, #64748b); }
.nlw-actions { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .4rem; }
.nlw-primary { background: #1e5eff; color: #fff; border: none; border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.nlw-primary:disabled { opacity: .5; cursor: not-allowed; }
.nlw-secondary { background: transparent; border: 1px solid var(--color-border, #e4e8ee); border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
```

- [ ] **Step 6: Run wizard test**

Run:

```bash
npm test -- --include='**/new-leave-request-wizard.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/leave/ui/new-leave-request-wizard
git commit -m "feat(leave): add New Leave Request wizard"
```

---

### Task 6: Wire into My Balances (employee self-service entry point)

**Files:**
- Modify: `src/app/modules/leave/feature/my-balances/my-balances.component.ts`
- Modify: `src/app/modules/leave/feature/my-balances/my-balances.component.html`
- Modify: `src/app/modules/leave/feature/my-balances/my-balances.component.css`
- Create: `src/app/modules/leave/feature/my-balances/my-balances.component.spec.ts` (this component currently has no spec - confirmed by `find src/app/modules/leave/feature/my-balances -name '*.spec.ts'` returning nothing; add one now rather than extending an untested component further)

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/leave/feature/my-balances/my-balances.component.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { MyBalancesComponent } from './my-balances.component';

describe('MyBalancesComponent', () => {
  let fixture: ComponentFixture<MyBalancesComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MyBalancesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBalancesComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads balances and my requests on init', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  });

  it('opens the new-request wizard when the button is clicked', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="new-request-button"]');
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.wizardOpen()).toBe(true);
  });
});
```

Note: this test expects `GET /leave/types` because Step 1 of the wizard needs the full active leave-type list, not just the ones with a generated balance - `MyBalancesComponent` must load `LeaveTypeStore` (already shipped in Phase 1/2) alongside `LeaveBalanceStore`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/my-balances.component.spec.ts' --watch=false
```

Expected: FAIL - `wizardOpen` and the new-request button do not exist yet, and `LeaveTypeStore` is not loaded by this component.

- [ ] **Step 3: Update the component**

Modify `src/app/modules/leave/feature/my-balances/my-balances.component.ts` - replace its contents with:

```typescript
/** Quiet Operations Desk: the employee's own leave position, request history, and the New Request entry point. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
import { LeaveRequestHistoryTableComponent } from '../../ui/leave-request-history-table/leave-request-history-table.component';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';

@Component({
  selector: 'app-my-balances',
  standalone: true,
  imports: [CommonModule, ButtonComponent, EmptyStateComponent, ErrorStateComponent, SelectComponent, LeaveBalanceListTableComponent, LeaveRequestHistoryTableComponent, NewLeaveRequestWizardComponent],
  templateUrl: './my-balances.component.html',
  styleUrl: './my-balances.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyBalancesComponent {
  readonly store = inject(LeaveBalanceStore);
  readonly requestStore = inject(LeaveRequestStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly yearOptions: SelectOption[] = yearOptions();
  readonly selectedYear = computed(() => String(this.store.year()));
  readonly wizardOpen = signal(false);

  constructor() {
    void this.store.loadMy(new Date().getFullYear());
    void this.requestStore.loadMine();
    void this.leaveTypeStore.load();
  }

  onYearChange(year: string): void {
    void this.store.loadMy(Number(year));
  }

  openWizard(): void {
    this.wizardOpen.set(true);
  }

  closeWizard(): void {
    this.wizardOpen.set(false);
    this.requestStore.clearPreview();
  }

  onPreviewRequested(payload: SubmitLeaveRequestRequest): void {
    void this.requestStore.preview(payload);
  }

  async onSubmitRequested(payload: SubmitLeaveRequestRequest): Promise<void> {
    const result = await this.requestStore.submit(payload);
    if (result) {
      this.closeWizard();
      void this.store.loadMy(this.store.year());
    }
  }
}

export function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) }));
}
```

- [ ] **Step 4: Update the template**

Replace `src/app/modules/leave/feature/my-balances/my-balances.component.html` with:

```html
<!-- Quiet Operations Desk: personal balances and request history lead the Time Off module without management noise. -->
<section class="mbc-page">
  <header class="mbc-header">
    <div><p class="mbc-kicker">TIME OFF</p><h1>My Balances</h1><p class="mbc-subtitle">Your leave entitlement and remaining days for the selected year.</p></div>
    <div class="mbc-header-actions">
      <app-select [options]="yearOptions" [value]="selectedYear()" (valueChange)="onYearChange($event)" />
      <app-button data-testid="new-request-button" (click)="openWizard()">+ New Request</app-button>
    </div>
  </header>
  @if (store.myLoading()) {
    <div class="mbc-loading" aria-busy="true"><span></span><span></span><span></span></div>
  } @else if (store.myError()) {
    <app-error-state [message]="store.myError()!" [retryable]="true" (retry)="store.loadMy(store.year())" />
  } @else if (store.my().length === 0) {
    <app-empty-state title="No leave balances yet" description="Balances appear once HR generates entitlements for this year." />
  } @else {
    <app-leave-balance-list-table [balances]="store.my()" [showEmployeeColumn]="false" />
  }

  <h2 class="mbc-subheading">Request History</h2>
  @if (requestStore.myRequestsLoading()) {
    <div class="mbc-loading" aria-busy="true"><span></span><span></span><span></span></div>
  } @else if (requestStore.myRequestsError()) {
    <app-error-state [message]="requestStore.myRequestsError()!" [retryable]="true" (retry)="requestStore.loadMine()" />
  } @else if (requestStore.myRequests().length === 0) {
    <app-empty-state title="No leave requests yet" description="Requests you submit will appear here." />
  } @else {
    <app-leave-request-history-table [requests]="requestStore.myRequests()" />
  }
</section>

@if (wizardOpen()) {
  <app-new-leave-request-wizard
    [open]="true"
    [leaveTypes]="leaveTypeStore.items()"
    [balances]="store.my()"
    [previewing]="requestStore.previewing()"
    [previewResult]="requestStore.previewResult()"
    [previewError]="requestStore.previewError()"
    [submitting]="requestStore.submitting()"
    [submitError]="requestStore.submitError()"
    (previewRequested)="onPreviewRequested($event)"
    (submitRequested)="onSubmitRequested($event)"
    (closed)="closeWizard()"
  />
}
```

- [ ] **Step 5: Update the stylesheet**

Modify `src/app/modules/leave/feature/my-balances/my-balances.component.css` - add these rules (keep the existing `.mbc-*` rules already in the file):

```css
.mbc-header-actions { display: flex; align-items: center; gap: .7rem; }
.mbc-subheading { margin: 1.6rem 0 .8rem; font-size: 1.05rem; color: var(--color-text-primary, #18202d); }
```

- [ ] **Step 6: Run the component test**

Run:

```bash
npm test -- --include='**/my-balances.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/leave/feature/my-balances
git commit -m "feat(leave): add New Request entry point and request history to My Balances"
```

---

### Task 7: Wire on-behalf entry point into Entitlements Management (HR)

**Files:**
- Modify: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.ts`
- Modify: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.html`
- Create/modify: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.spec.ts` (check first whether one already exists from the Phase 3 build - if it does, add these cases to it rather than replacing the file)

- [ ] **Step 1: Check for an existing spec file and read it**

Run:

```bash
ls src/app/modules/leave/feature/entitlements-management/*.spec.ts
```

If it exists, read it fully before editing - Step 2 below adds new `it(...)` blocks to whatever `describe` block is already there, matching its existing `TestBed` setup rather than duplicating one.

- [ ] **Step 2: Add the failing test cases**

Add to `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.spec.ts` (inside the existing `describe` block, or a new file with the same `TestBed` setup as Task 6's spec if none exists yet):

```typescript
it('shows the New Request (on behalf) button on the Entitlements tab when the user can manage', () => {
  fixture.detectChanges();
  httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
  httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`).flush([]);
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('[data-testid="new-request-on-behalf-button"]')).toBeTruthy();
});

it('opens the wizard in on-behalf mode', () => {
  fixture.detectChanges();
  httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
  httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`).flush([]);
  fixture.detectChanges();
  (fixture.nativeElement.querySelector('[data-testid="new-request-on-behalf-button"]') as HTMLButtonElement).click();
  fixture.detectChanges();
  expect(fixture.componentInstance.requestWizardOpen()).toBe(true);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/entitlements-management.component.spec.ts' --watch=false
```

Expected: FAIL - `requestWizardOpen` and the on-behalf button do not exist yet.

- [ ] **Step 4: Add the store, signal, and handlers**

In `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.ts`, add these imports:

```typescript
import { LeaveRequestStore } from '../../state/leave-request.store';
import { SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from '../../models/leave-request.model';
import { NewLeaveRequestWizardComponent } from '../../ui/new-leave-request-wizard/new-leave-request-wizard.component';
```

Add `NewLeaveRequestWizardComponent` to the `@Component` `imports` array.

Add to the class body (alongside the other injected stores and signals):

```typescript
readonly requestStore = inject(LeaveRequestStore);
readonly requestWizardOpen = signal(false);

openRequestWizard(): void { this.requestWizardOpen.set(true); }
closeRequestWizard(): void { this.requestWizardOpen.set(false); this.requestStore.clearPreview(); }
onRequestPreview(payload: SubmitLeaveRequestRequest): void { void this.requestStore.preview(payload); }
async onRequestSubmit(payload: SubmitLeaveRequestRequest | SubmitLeaveRequestOnBehalfRequest): Promise<void> {
  const result = await this.requestStore.submitOnBehalf(payload as SubmitLeaveRequestOnBehalfRequest);
  if (result) {
    this.notificationService.success('Leave request submitted on behalf of the employee.');
    this.closeRequestWizard();
  } else {
    this.notificationService.error(this.requestStore.submitError() ?? 'Failed to submit the request.');
  }
}
```

- [ ] **Step 5: Add the button and wizard to the template**

In `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.html`, add a button next to the existing `+ Manual entitlement` / `Generate entitlements` buttons inside `emc-header-actions`:

```html
<app-button variant="secondary" data-testid="new-request-on-behalf-button" (click)="openRequestWizard()">+ New Request</app-button>
```

Add the wizard instance at the end of the file, alongside the other `@if (...)`-gated modals:

```html
@if (requestWizardOpen()) {
  <app-new-leave-request-wizard
    [open]="true"
    [onBehalf]="true"
    [leaveTypes]="leaveTypeStore.items()"
    [balances]="[]"
    [previewing]="requestStore.previewing()"
    [previewResult]="requestStore.previewResult()"
    [previewError]="requestStore.previewError()"
    [submitting]="requestStore.submitting()"
    [submitError]="requestStore.submitError()"
    (previewRequested)="onRequestPreview($event)"
    (submitRequested)="onRequestSubmit($event)"
    (closed)="closeRequestWizard()"
  />
}
```

Note: `[balances]="[]"` here is deliberate, not a placeholder - HR doesn't have the picked employee's balances loaded client-side in this phase (that would need a per-employee balance lookup that doesn't exist yet), so the wizard's "N days remaining" hint next to each leave type is simply blank for the on-behalf flow. The backend's `preview`/`submitOnBehalf` calls still enforce the real balance server-side regardless - this only affects the hint text, not correctness.

- [ ] **Step 6: Run the tests**

Run:

```bash
npm test -- --include='**/entitlements-management.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/leave/feature/entitlements-management
git commit -m "feat(leave): add HR New Request (on behalf) entry point to Entitlements"
```

---

### Task 8: Full build and regression check

**Files:** none (verification only)

- [ ] **Step 1: Run a full production build**

Run:

```bash
npm run build
```

Expected: builds clean, no TypeScript errors. Pay particular attention to `DatePickerComponent`'s and `EmployeePickerComponent`'s exact input/output names (`value`/`valueChange`, `open`/`selected`/`closed`) - these were read from the actual shipped files during planning, but re-verify if the build fails on the wizard component specifically.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test -- --watch=false
```

Expected: all tests pass, including every pre-existing Phase 1-3 suite - this phase must not regress them.

- [ ] **Step 3: Manual smoke check against the running backend**

With `feat/leave-management-part-4` running locally and `ng serve --ssl true` running from this repo, log in as the smoke-seeded HR manager (or a regular employee account with `leave:read-own`) and:
1. Visit `/time-off` (My Balances), confirm the Request History section renders (empty state if nothing submitted yet).
2. Click "+ New Request", pick a leave type showing its real remaining-days hint, pick dates, confirm step 3 shows a real total-days number and any warnings from the live preview call.
3. Add a reason, review the balance-before/after on step 5, submit, confirm a real `LeaveRequestResponse` comes back and the row appears in Request History with status "Pending".
4. Try requesting more days than remaining for a paid-only type and confirm the backend's `InsufficientBalance` message surfaces (via `previewError`) rather than a generic error.
5. As HR, visit `/time-off/entitlements`, click "+ New Request", pick an employee, and confirm `POST /leave/requests/on-behalf` is called (network tab) on submit rather than the own-request endpoint.

Record any mismatch between this plan's assumed component APIs and the actual shipped files, and fix the plan's assumptions inline in code (not in this doc) before moving to Phase 5.

- [ ] **Step 4: Commit only if Step 3 required code fixes**

```bash
git add -A
git commit -m "fix(leave): correct component API mismatches found during Phase 4 smoke test"
```

(Skip this commit if Step 3 required no changes.)
