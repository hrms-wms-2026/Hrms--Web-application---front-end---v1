# Leave Management (Frontend) - Part 3: Entitlements + Balances (Phase 3 of 10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the frontend for Screens 3 and 4: My Balances (employee default landing page), Team Balances (manager), and an HR Entitlements screen that covers bulk generate (preview + confirm), manual assignment, adjust, recalculate, and a read-only All Balances view.

**Architecture:** Mirrors the Phase 1/2 leave module exactly: thin `HttpClient` API services, `@ngrx/signals` `signalStore` state stores, dumb `@Input`/`@Output` table components, and page-level feature components that own permission checks + notifications. Balances (My/Team/All) share one `LeaveBalanceResponse` shape and one read-only store; Entitlements (generate/manual/adjust/recalculate) is a separate write-capable store because it owns different mutations and a two-step generate-preview flow.

**Tech Stack:** Angular 18 standalone components, `@ngrx/signals`, RxJS, Jasmine/Karma, `HttpClientTestingModule`.

**Spec:** `docs/superpowers/specs/next/2026-08-21-leave-management-design.md`; product context `C:\HR\leave-management-complete.md`. Backend companion: `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-21-leave-management/part-3-entitlements-and-balances.md`, shipped on `feat/leave-management-part-3` (backend endpoints below are read directly from that branch's checked-out worktree, not guessed from the plan doc, since the plan and the final shipped code can diverge).

## Global Constraints

- Frontend only. The backend branch `feat/leave-management-part-3` is not yet merged into `development` - point `environment.apiUrl` at that branch's running API for local dev/testing until it merges.
- Follow the established leave-module conventions exactly (`leave-type-api.service.ts`, `leave-type.store.ts`, `leave-types-management.component.ts` are the reference implementations): API services are thin `HttpClient` wrappers `providedIn: 'root'`; stores are `signalStore` with `withState`/`withMethods`; feature components inject the store + `PermissionService` + `NotificationService`; presentational tables take `@Input`/`@Output` only.
- **Resolved open decision (route/screen split):** the backend plan's frontend line only names 3 feature pages (`entitlements-management`, `my-balances`, `team-balances`) even though the backend exposes 3 separate balance endpoints (`/balances/my`, `/balances/team`, `/balances/all`). This plan folds **All Balances** into the `entitlements-management` screen as a second tab (`Entitlements` | `All Balances`), both HR-only, rather than inventing an unlisted 4th route. `Entitlements` tab requires `leave:manage`; `All Balances` tab requires `leave:read` or `leave:manage`.
- **Resolved open decision (employment status filter):** `GET /leave/balances/all` accepts an optional `employmentStatusId` query param, but no employment-status picker/API exists anywhere in this frontend yet (confirmed by search - zero matches for `EmploymentStatus` in `src/app`). The API service exposes the param for future use; this phase does not add a UI control for it. Do not invent a picker.
- Money/day values are `decimal` on the backend and arrive as JSON numbers - keep them as `number` in TypeScript, never stringify or round in the UI beyond display formatting (`toFixed(1)` for display only, never for the underlying state value).
- `LeaveBalanceResponse` and `LeaveEntitlementResponse` field names are copied verbatim (camelCased) from the backend C# records read directly off `feat/leave-management-part-3`. Do not rename fields to "look nicer" - later phases (5, 6, 7) read these same shapes.
- Reuse existing shared pieces instead of rebuilding them: `app-button`, `app-empty-state`, `app-error-state`, `app-select` (`shared/ui`), `app-modal` (`shared/ui/modal`), `LegalEntityApiService` (`organization/data-access`), and `EmployeePickerComponent` (`work/ui/employee-picker`) for the manual-entitlement employee field - this component already exists and cross-module imports of shared `ui/` pieces are an established pattern (`leave-policy-form-wizard.component.ts` already imports `LegalEntityListItem` from `organization/models`).
- Every write action that can return a 409 (adjust, recalculate) must follow the exact confirm-retry pattern already shipped in `leave-type.store.ts`'s `deactivateLeaveType` (`'success' | 'confirm' | 'error'` return, checked via `err instanceof HttpErrorResponse && err.status === 409`).

---

### Task 1: Response/request models

**Files:**
- Create: `src/app/modules/leave/models/leave-entitlement.model.ts`
- Create: `src/app/modules/leave/models/leave-balance.model.ts`

No test for this task - pure type declarations, verified by the TypeScript compiler in later tasks' `ng build`/`ng test` runs.

- [ ] **Step 1: Create the entitlement model**

Create `src/app/modules/leave/models/leave-entitlement.model.ts`:

```typescript
/** Matches ONEVO.Application.Features.Leave.Entitlement.DTOs.Responses.LeaveEntitlementResponse verbatim. */
export interface LeaveEntitlementResponse {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  totalDays: number;
  carriedForwardDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  source: 'auto' | 'manual';
  manualReason: string | null;
  isOverUtilized: boolean;
  warning: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface LeaveEntitlementListFilter {
  legalEntityId?: string;
  departmentId?: string;
  leaveTypeId?: string;
  search?: string;
}

export interface GenerateEntitlementsRequest {
  year: number;
  legalEntityId: string | null;
}

export interface LeaveEntitlementGenerationLineResponse {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  totalDays: number;
  carriedForwardDays: number;
  remainingDays: number;
  probationRestrictionApplied: boolean;
  forfeitedDays: number;
  carryForwardExpiresOn: string | null;
  warning: string | null;
}

export interface LeaveEntitlementGenerationSkipResponse {
  employeeId: string | null;
  employeeName: string | null;
  reason: string;
}

export interface LeaveEntitlementGenerationErrorResponse {
  employeeId: string | null;
  employeeName: string | null;
  reason: string;
}

export interface LeaveEntitlementGenerationPreviewResponse {
  year: number;
  employeeCount: number;
  entitlementLineCount: number;
  lines: LeaveEntitlementGenerationLineResponse[];
  skipped: LeaveEntitlementGenerationSkipResponse[];
}

export interface LeaveEntitlementGenerationResultResponse {
  year: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  created: LeaveEntitlementGenerationLineResponse[];
  skipped: LeaveEntitlementGenerationSkipResponse[];
  errors: LeaveEntitlementGenerationErrorResponse[];
}

export interface CreateManualEntitlementRequest {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalDays: number;
  carriedForwardDays: number;
  reason: string;
}

export interface AdjustEntitlementRequest {
  totalDays: number;
  carriedForwardDays: number;
  reason: string;
  confirmNegativeRemaining: boolean;
}

export interface RecalculateEntitlementRequest {
  confirmNegativeRemaining: boolean;
}
```

- [ ] **Step 2: Create the balance model**

Create `src/app/modules/leave/models/leave-balance.model.ts`:

```typescript
/** Matches ONEVO.Application.Features.Leave.Balance.DTOs.Responses.LeaveBalanceResponse verbatim. */
export interface LeaveBalanceResponse {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  entitledDays: number;
  annualDays: number;
  carriedForwardDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  isNegative: boolean;
  carryForwardExpiresOn: string | null;
}

export interface LeaveBalanceTeamFilter {
  departmentId?: string;
  leaveTypeId?: string;
  search?: string;
}

export interface LeaveBalanceAllFilter extends LeaveBalanceTeamFilter {
  legalEntityId?: string;
  employmentStatusId?: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/leave/models/leave-entitlement.model.ts src/app/modules/leave/models/leave-balance.model.ts
git commit -m "feat(leave): add entitlement and balance models"
```

---

### Task 2: API services

**Files:**
- Create: `src/app/modules/leave/data-access/leave-entitlement-api.service.ts`
- Create: `src/app/modules/leave/data-access/leave-entitlement-api.service.spec.ts`
- Create: `src/app/modules/leave/data-access/leave-balance-api.service.ts`
- Create: `src/app/modules/leave/data-access/leave-balance-api.service.spec.ts`

**Interfaces:**
- Produces: `LeaveEntitlementApiService.{list, previewGenerate, generate, createManual, adjust, recalculate}`
- Produces: `LeaveBalanceApiService.{my, team, all}`

- [ ] **Step 1: Write the failing entitlement API service tests**

Create `src/app/modules/leave/data-access/leave-entitlement-api.service.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  LeaveEntitlementGenerationPreviewResponse,
  LeaveEntitlementGenerationResultResponse,
  LeaveEntitlementResponse,
  RecalculateEntitlementRequest
} from '../models/leave-entitlement.model';
import { LeaveEntitlementApiService } from './leave-entitlement-api.service';

describe('LeaveEntitlementApiService', () => {
  let service: LeaveEntitlementApiService;
  let httpMock: HttpTestingController;

  const mockEntitlement: LeaveEntitlementResponse = {
    id: 'ent-1', employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman',
    leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026,
    totalDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: 17,
    source: 'auto', manualReason: null, isOverUtilized: false, warning: null,
    createdAt: '2026-08-21T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveEntitlementApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveEntitlementApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists entitlements for a year with filters', () => {
    service.list(2026, { legalEntityId: 'le-1', search: 'anu' }).subscribe((items) => expect(items).toEqual([mockEntitlement]));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026&legalEntityId=le-1&search=anu`);
    expect(req.request.method).toBe('GET');
    req.flush([mockEntitlement]);
  });

  it('lists entitlements for a year with no filters', () => {
    service.list(2026, {}).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026`);
    expect(req.request.method).toBe('GET');
    req.flush([mockEntitlement]);
  });

  it('previews a bulk generate', () => {
    const preview: LeaveEntitlementGenerationPreviewResponse = { year: 2026, employeeCount: 1, entitlementLineCount: 1, lines: [], skipped: [] };
    const payload: GenerateEntitlementsRequest = { year: 2026, legalEntityId: 'le-1' };
    service.previewGenerate(payload).subscribe((result) => expect(result).toEqual(preview));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(preview);
  });

  it('runs a bulk generate', () => {
    const result: LeaveEntitlementGenerationResultResponse = { year: 2026, createdCount: 1, skippedCount: 0, errorCount: 0, created: [], skipped: [], errors: [] };
    const payload: GenerateEntitlementsRequest = { year: 2026, legalEntityId: null };
    service.generate(payload).subscribe((response) => expect(response).toEqual(result));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(result);
  });

  it('creates a manual entitlement', () => {
    const payload: CreateManualEntitlementRequest = { employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, totalDays: 20, carriedForwardDays: 0, reason: 'Backfill' };
    service.createManual(payload).subscribe((item) => expect(item).toEqual(mockEntitlement));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/manual`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockEntitlement);
  });

  it('adjusts an entitlement', () => {
    const payload: AdjustEntitlementRequest = { totalDays: 18, carriedForwardDays: 2, reason: 'Correction', confirmNegativeRemaining: false };
    service.adjust('ent-1', payload).subscribe((item) => expect(item).toEqual(mockEntitlement));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(mockEntitlement);
  });

  it('recalculates an entitlement', () => {
    const payload: RecalculateEntitlementRequest = { confirmNegativeRemaining: true };
    service.recalculate('ent-1', payload).subscribe((item) => expect(item).toEqual(mockEntitlement));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/recalculate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockEntitlement);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/leave-entitlement-api.service.spec.ts' --watch=false
```

Expected: FAIL - `leave-entitlement-api.service.ts` does not exist.

- [ ] **Step 3: Implement the entitlement API service**

Create `src/app/modules/leave/data-access/leave-entitlement-api.service.ts`:

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  LeaveEntitlementGenerationPreviewResponse,
  LeaveEntitlementGenerationResultResponse,
  LeaveEntitlementListFilter,
  LeaveEntitlementResponse,
  RecalculateEntitlementRequest
} from '../models/leave-entitlement.model';

/** Client for ONEVO.Api's LeaveEntitlementsController at /api/v1/leave/entitlements. */
@Injectable({ providedIn: 'root' })
export class LeaveEntitlementApiService {
  private readonly http = inject(HttpClient);

  list(year: number, filter: LeaveEntitlementListFilter): Observable<LeaveEntitlementResponse[]> {
    let params = new HttpParams().set('year', year);
    if (filter.legalEntityId) params = params.set('legalEntityId', filter.legalEntityId);
    if (filter.departmentId) params = params.set('departmentId', filter.departmentId);
    if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId);
    if (filter.search) params = params.set('search', filter.search);
    return this.http.get<LeaveEntitlementResponse[]>(`${environment.apiUrl}/leave/entitlements`, { params });
  }

  previewGenerate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationPreviewResponse> {
    return this.http.post<LeaveEntitlementGenerationPreviewResponse>(`${environment.apiUrl}/leave/entitlements/generate/preview`, payload);
  }

  generate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationResultResponse> {
    return this.http.post<LeaveEntitlementGenerationResultResponse>(`${environment.apiUrl}/leave/entitlements/generate`, payload);
  }

  createManual(payload: CreateManualEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.http.post<LeaveEntitlementResponse>(`${environment.apiUrl}/leave/entitlements/manual`, payload);
  }

  adjust(entitlementId: string, payload: AdjustEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.http.put<LeaveEntitlementResponse>(`${environment.apiUrl}/leave/entitlements/${entitlementId}/adjust`, payload);
  }

  recalculate(entitlementId: string, payload: RecalculateEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.http.post<LeaveEntitlementResponse>(`${environment.apiUrl}/leave/entitlements/${entitlementId}/recalculate`, payload);
  }
}
```

- [ ] **Step 4: Run entitlement API service tests**

Run:

```bash
npm test -- --include='**/leave-entitlement-api.service.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Write the failing balance API service tests**

Create `src/app/modules/leave/data-access/leave-balance-api.service.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceResponse } from '../models/leave-balance.model';
import { LeaveBalanceApiService } from './leave-balance-api.service';

describe('LeaveBalanceApiService', () => {
  let service: LeaveBalanceApiService;
  let httpMock: HttpTestingController;

  const mockBalance: LeaveBalanceResponse = {
    employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman',
    departmentId: 'dept-1', departmentName: 'Engineering', legalEntityId: 'le-1', legalEntityName: 'Acme UK',
    leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026,
    entitledDays: 22, annualDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: 17,
    isNegative: false, carryForwardExpiresOn: '2026-03-31'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveBalanceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveBalanceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets my balances for a year', () => {
    service.my(2026).subscribe((items) => expect(items).toEqual([mockBalance]));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`);
    expect(req.request.method).toBe('GET');
    req.flush([mockBalance]);
  });

  it('gets team balances with filters', () => {
    service.team(2026, { departmentId: 'dept-1', search: 'anu' }).subscribe((items) => expect(items).toEqual([mockBalance]));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&departmentId=dept-1&search=anu`);
    expect(req.request.method).toBe('GET');
    req.flush([mockBalance]);
  });

  it('gets all balances with filters', () => {
    service.all(2026, { legalEntityId: 'le-1', leaveTypeId: 'type-1' }).subscribe((items) => expect(items).toEqual([mockBalance]));
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/balances/all?year=2026&legalEntityId=le-1&leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    req.flush([mockBalance]);
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/leave-balance-api.service.spec.ts' --watch=false
```

Expected: FAIL - `leave-balance-api.service.ts` does not exist.

- [ ] **Step 7: Implement the balance API service**

Create `src/app/modules/leave/data-access/leave-balance-api.service.ts`:

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceAllFilter, LeaveBalanceResponse, LeaveBalanceTeamFilter } from '../models/leave-balance.model';

/** Client for ONEVO.Api's LeaveBalancesController at /api/v1/leave/balances. */
@Injectable({ providedIn: 'root' })
export class LeaveBalanceApiService {
  private readonly http = inject(HttpClient);

  my(year: number): Observable<LeaveBalanceResponse[]> {
    const params = new HttpParams().set('year', year);
    return this.http.get<LeaveBalanceResponse[]>(`${environment.apiUrl}/leave/balances/my`, { params });
  }

  team(year: number, filter: LeaveBalanceTeamFilter): Observable<LeaveBalanceResponse[]> {
    let params = new HttpParams().set('year', year);
    if (filter.departmentId) params = params.set('departmentId', filter.departmentId);
    if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId);
    if (filter.search) params = params.set('search', filter.search);
    return this.http.get<LeaveBalanceResponse[]>(`${environment.apiUrl}/leave/balances/team`, { params });
  }

  all(year: number, filter: LeaveBalanceAllFilter): Observable<LeaveBalanceResponse[]> {
    let params = new HttpParams().set('year', year);
    if (filter.legalEntityId) params = params.set('legalEntityId', filter.legalEntityId);
    if (filter.departmentId) params = params.set('departmentId', filter.departmentId);
    if (filter.leaveTypeId) params = params.set('leaveTypeId', filter.leaveTypeId);
    if (filter.employmentStatusId !== undefined) params = params.set('employmentStatusId', filter.employmentStatusId);
    if (filter.search) params = params.set('search', filter.search);
    return this.http.get<LeaveBalanceResponse[]>(`${environment.apiUrl}/leave/balances/all`, { params });
  }
}
```

- [ ] **Step 8: Run balance API service tests**

Run:

```bash
npm test -- --include='**/leave-balance-api.service.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/leave/data-access/leave-entitlement-api.service.ts src/app/modules/leave/data-access/leave-entitlement-api.service.spec.ts src/app/modules/leave/data-access/leave-balance-api.service.ts src/app/modules/leave/data-access/leave-balance-api.service.spec.ts
git commit -m "feat(leave): add entitlement and balance API services"
```

---

### Task 3: State stores

**Files:**
- Create: `src/app/modules/leave/state/leave-entitlement.store.ts`
- Create: `src/app/modules/leave/state/leave-entitlement.store.spec.ts`
- Create: `src/app/modules/leave/state/leave-balance.store.ts`
- Create: `src/app/modules/leave/state/leave-balance.store.spec.ts`

**Interfaces:**
- Produces: `LeaveEntitlementStore.{year, filters, items, loading, loadError, saving, actionError, generationPreview, generating, generationError}` state + `setYear, setFilters, load, previewGenerate, clearGenerationPreview, generate, createManual, adjust, recalculate` methods
- Produces: `LeaveBalanceStore.{my*, team*, all*}` state slices + `loadMy, setTeamFilters, loadTeam, setAllFilters, loadAll` methods

- [ ] **Step 1: Write the failing entitlement store tests**

Create `src/app/modules/leave/state/leave-entitlement.store.spec.ts`:

```typescript
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveEntitlementResponse } from '../models/leave-entitlement.model';
import { LeaveEntitlementStore } from './leave-entitlement.store';

describe('LeaveEntitlementStore', () => {
  let store: InstanceType<typeof LeaveEntitlementStore>;
  let httpMock: HttpTestingController;

  const mockEntitlement: LeaveEntitlementResponse = {
    id: 'ent-1', employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman',
    leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026,
    totalDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: 17,
    source: 'auto', manualReason: null, isOverUtilized: false, warning: null,
    createdAt: '2026-08-21T00:00:00Z', updatedAt: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveEntitlementStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveEntitlementStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('defaults year to the current year and loads on construction call', async () => {
    const loading = store.load();
    httpMock.expectOne((req) => req.url === `${environment.apiUrl}/leave/entitlements`).flush([mockEntitlement]);
    await loading;
    expect(store.items()).toEqual([mockEntitlement]);
    expect(store.loading()).toBe(false);
  });

  it('reloads with new filters when setFilters is called', async () => {
    store.setYear(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026`).flush([]);
    await Promise.resolve();
    store.setFilters({ search: 'anu' });
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026&search=anu`);
    req.flush([mockEntitlement]);
    await Promise.resolve();
    expect(store.items()).toEqual([mockEntitlement]);
  });

  it('runs a generate preview into generationPreview', async () => {
    store.setYear(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026`).flush([]);
    await Promise.resolve();
    const previewing = store.previewGenerate({ year: 2026, legalEntityId: null });
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview`)
      .flush({ year: 2026, employeeCount: 1, entitlementLineCount: 1, lines: [], skipped: [] });
    await previewing;
    expect(store.generationPreview()?.employeeCount).toBe(1);
  });

  it('adjust returns confirm on 409 without applying actionError', async () => {
    const adjusting = store.adjust('ent-1', { totalDays: 5, carriedForwardDays: 0, reason: 'r', confirmNegativeRemaining: false });
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`)
      .flush('Remaining would go negative', { status: 409, statusText: 'Conflict' });
    expect(await adjusting).toBe('confirm');
    expect(store.actionError()).toBeNull();
  });

  it('adjust returns success and reloads on 200', async () => {
    store.setYear(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026`).flush([]);
    await Promise.resolve();
    const adjusting = store.adjust('ent-1', { totalDays: 18, carriedForwardDays: 2, reason: 'r', confirmNegativeRemaining: false });
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements/ent-1/adjust`).flush(mockEntitlement);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/entitlements?year=2026`).flush([mockEntitlement]);
    expect(await adjusting).toBe('success');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/leave-entitlement.store.spec.ts' --watch=false
```

Expected: FAIL - `leave-entitlement.store.ts` does not exist.

- [ ] **Step 3: Implement the entitlement store**

Create `src/app/modules/leave/state/leave-entitlement.store.ts`:

```typescript
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveEntitlementApiService } from '../data-access/leave-entitlement-api.service';
import {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  LeaveEntitlementGenerationPreviewResponse,
  LeaveEntitlementListFilter,
  LeaveEntitlementResponse,
  RecalculateEntitlementRequest
} from '../models/leave-entitlement.model';

export interface LeaveEntitlementState {
  readonly year: number;
  readonly filters: LeaveEntitlementListFilter;
  readonly items: readonly LeaveEntitlementResponse[];
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly saving: boolean;
  readonly actionError: string | null;
  readonly generationPreview: LeaveEntitlementGenerationPreviewResponse | null;
  readonly generating: boolean;
  readonly generationError: string | null;
}

type ConflictOutcome = 'success' | 'confirm' | 'error';

const initialState: LeaveEntitlementState = {
  year: new Date().getFullYear(),
  filters: {},
  items: [],
  loading: false,
  loadError: null,
  saving: false,
  actionError: null,
  generationPreview: null,
  generating: false,
  generationError: null
};

export const LeaveEntitlementStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveEntitlementState>(initialState),
  withMethods((store, api = inject(LeaveEntitlementApiService)) => ({
    setYear(year: number): void {
      patchState(store, { year });
      void this.load();
    },
    setFilters(filters: LeaveEntitlementListFilter): void {
      patchState(store, { filters });
      void this.load();
    },
    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const items = await firstValueFrom(api.list(store.year(), store.filters()));
        patchState(store, { items, loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load entitlements.') });
      }
    },
    async previewGenerate(payload: GenerateEntitlementsRequest): Promise<boolean> {
      patchState(store, { generating: true, generationError: null, generationPreview: null });
      try {
        const generationPreview = await firstValueFrom(api.previewGenerate(payload));
        patchState(store, { generating: false, generationPreview });
        return true;
      } catch (err) {
        patchState(store, { generating: false, generationError: toSafeErrorMessage(err, 'Failed to preview entitlement generation.') });
        return false;
      }
    },
    clearGenerationPreview(): void {
      patchState(store, { generationPreview: null, generationError: null });
    },
    async generate(payload: GenerateEntitlementsRequest): Promise<boolean> {
      patchState(store, { generating: true, generationError: null });
      try {
        await firstValueFrom(api.generate(payload));
        patchState(store, { generating: false, generationPreview: null });
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { generating: false, generationError: toSafeErrorMessage(err, 'Failed to generate entitlements.') });
        return false;
      }
    },
    async createManual(payload: CreateManualEntitlementRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.createManual(payload));
        patchState(store, { saving: false });
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create manual entitlement.') });
        return false;
      }
    },
    async adjust(entitlementId: string, payload: AdjustEntitlementRequest): Promise<ConflictOutcome> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.adjust(entitlementId, payload));
        patchState(store, { saving: false });
        await this.load();
        return 'success';
      } catch (err) {
        if (err instanceof HttpErrorResponse && err.status === 409 && !payload.confirmNegativeRemaining) {
          patchState(store, { saving: false });
          return 'confirm';
        }
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to adjust entitlement.') });
        return 'error';
      }
    },
    async recalculate(entitlementId: string, payload: RecalculateEntitlementRequest): Promise<ConflictOutcome> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.recalculate(entitlementId, payload));
        patchState(store, { saving: false });
        await this.load();
        return 'success';
      } catch (err) {
        if (err instanceof HttpErrorResponse && err.status === 409 && !payload.confirmNegativeRemaining) {
          patchState(store, { saving: false });
          return 'confirm';
        }
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to recalculate entitlement.') });
        return 'error';
      }
    }
  }))
);
```

- [ ] **Step 4: Run entitlement store tests**

Run:

```bash
npm test -- --include='**/leave-entitlement.store.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Write the failing balance store tests**

Create `src/app/modules/leave/state/leave-balance.store.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveBalanceResponse } from '../models/leave-balance.model';
import { LeaveBalanceStore } from './leave-balance.store';

describe('LeaveBalanceStore', () => {
  let store: InstanceType<typeof LeaveBalanceStore>;
  let httpMock: HttpTestingController;

  const mockBalance: LeaveBalanceResponse = {
    employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman',
    departmentId: 'dept-1', departmentName: 'Engineering', legalEntityId: 'le-1', legalEntityName: 'Acme UK',
    leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026,
    entitledDays: 22, annualDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: 17,
    isNegative: false, carryForwardExpiresOn: '2026-03-31'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveBalanceStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveBalanceStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads my balances', async () => {
    const loading = store.loadMy(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`).flush([mockBalance]);
    await loading;
    expect(store.my()).toEqual([mockBalance]);
    expect(store.myLoading()).toBe(false);
  });

  it('loads team balances and reloads on setTeamFilters', async () => {
    const loading = store.loadTeam(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026`).flush([]);
    await loading;
    store.setTeamFilters({ search: 'anu' });
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&search=anu`);
    req.flush([mockBalance]);
    await Promise.resolve();
    expect(store.team()).toEqual([mockBalance]);
  });

  it('loads all balances and reloads on setAllFilters', async () => {
    const loading = store.loadAll(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/balances/all?year=2026`).flush([]);
    await loading;
    store.setAllFilters({ legalEntityId: 'le-1' });
    const req = httpMock.expectOne(`${environment.apiUrl}/leave/balances/all?year=2026&legalEntityId=le-1`);
    req.flush([mockBalance]);
    await Promise.resolve();
    expect(store.all()).toEqual([mockBalance]);
  });

  it('sets loadError on a failed my-balances load', async () => {
    const loading = store.loadMy(2026);
    httpMock.expectOne(`${environment.apiUrl}/leave/balances/my?year=2026`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await loading;
    expect(store.my()).toEqual([]);
    expect(store.myError()).toBeTruthy();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run:

```bash
npm test -- --include='**/leave-balance.store.spec.ts' --watch=false
```

Expected: FAIL - `leave-balance.store.ts` does not exist.

- [ ] **Step 7: Implement the balance store**

Create `src/app/modules/leave/state/leave-balance.store.ts`:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveBalanceApiService } from '../data-access/leave-balance-api.service';
import { LeaveBalanceAllFilter, LeaveBalanceResponse, LeaveBalanceTeamFilter } from '../models/leave-balance.model';

export interface LeaveBalanceState {
  readonly year: number;
  readonly my: readonly LeaveBalanceResponse[];
  readonly myLoading: boolean;
  readonly myError: string | null;
  readonly team: readonly LeaveBalanceResponse[];
  readonly teamFilters: LeaveBalanceTeamFilter;
  readonly teamLoading: boolean;
  readonly teamError: string | null;
  readonly all: readonly LeaveBalanceResponse[];
  readonly allFilters: LeaveBalanceAllFilter;
  readonly allLoading: boolean;
  readonly allError: string | null;
}

const initialState: LeaveBalanceState = {
  year: new Date().getFullYear(),
  my: [], myLoading: false, myError: null,
  team: [], teamFilters: {}, teamLoading: false, teamError: null,
  all: [], allFilters: {}, allLoading: false, allError: null
};

export const LeaveBalanceStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveBalanceState>(initialState),
  withMethods((store, api = inject(LeaveBalanceApiService)) => ({
    async loadMy(year: number): Promise<void> {
      patchState(store, { year, myLoading: true, myError: null });
      try {
        const my = await firstValueFrom(api.my(year));
        patchState(store, { my, myLoading: false });
      } catch (err) {
        patchState(store, { myLoading: false, myError: toSafeErrorMessage(err, 'Failed to load your balances.') });
      }
    },
    setTeamFilters(filters: LeaveBalanceTeamFilter): void {
      patchState(store, { teamFilters: filters });
      void this.loadTeam(store.year());
    },
    async loadTeam(year: number): Promise<void> {
      patchState(store, { year, teamLoading: true, teamError: null });
      try {
        const team = await firstValueFrom(api.team(year, store.teamFilters()));
        patchState(store, { team, teamLoading: false });
      } catch (err) {
        patchState(store, { teamLoading: false, teamError: toSafeErrorMessage(err, 'Failed to load team balances.') });
      }
    },
    setAllFilters(filters: LeaveBalanceAllFilter): void {
      patchState(store, { allFilters: filters });
      void this.loadAll(store.year());
    },
    async loadAll(year: number): Promise<void> {
      patchState(store, { year, allLoading: true, allError: null });
      try {
        const all = await firstValueFrom(api.all(year, store.allFilters()));
        patchState(store, { all, allLoading: false });
      } catch (err) {
        patchState(store, { allLoading: false, allError: toSafeErrorMessage(err, 'Failed to load all balances.') });
      }
    }
  }))
);
```

- [ ] **Step 8: Run balance store tests**

Run:

```bash
npm test -- --include='**/leave-balance.store.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/leave/state/leave-entitlement.store.ts src/app/modules/leave/state/leave-entitlement.store.spec.ts src/app/modules/leave/state/leave-balance.store.ts src/app/modules/leave/state/leave-balance.store.spec.ts
git commit -m "feat(leave): add entitlement and balance stores"
```

---

### Task 4: Shared balance list table (presentational)

**Files:**
- Create: `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.ts`
- Create: `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.html`
- Create: `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.css`
- Create: `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.spec.ts`

Reused by My Balances, Team Balances, and the All Balances tab - column visibility is driven by `@Input` flags so one component covers all three.

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceListTableComponent } from './leave-balance-list-table.component';

describe('LeaveBalanceListTableComponent', () => {
  let fixture: ComponentFixture<LeaveBalanceListTableComponent>;

  const balances: LeaveBalanceResponse[] = [
    {
      employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman',
      departmentId: 'dept-1', departmentName: 'Engineering', legalEntityId: 'le-1', legalEntityName: 'Acme UK',
      leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026,
      entitledDays: 22, annualDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: -1,
      isNegative: true, carryForwardExpiresOn: '2026-03-31'
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveBalanceListTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveBalanceListTableComponent);
    fixture.componentRef.setInput('balances', balances);
  });

  it('renders one row per balance', () => {
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="balance-row"]');
    expect(rows.length).toBe(1);
  });

  it('marks a negative remaining balance', () => {
    fixture.detectChanges();
    const negative = fixture.nativeElement.querySelector('[data-testid="balance-remaining-negative"]');
    expect(negative).toBeTruthy();
    expect(negative.textContent).toContain('-1');
  });

  it('hides the employee column when showEmployeeColumn is false', () => {
    fixture.componentRef.setInput('showEmployeeColumn', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="balance-employee-column"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/leave-balance-list-table.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.ts`:

```typescript
/** Quiet Operations Desk: a scan-first balance ledger, shared by My/Team/All Balances. */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';

@Component({ selector: 'app-leave-balance-list-table', standalone: true, imports: [CommonModule], templateUrl: './leave-balance-list-table.component.html', styleUrl: './leave-balance-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveBalanceListTableComponent {
  @Input({ required: true }) balances: readonly LeaveBalanceResponse[] = [];
  @Input() showEmployeeColumn = true;
  @Input() showDepartmentColumn = false;
  @Input() showLegalEntityColumn = false;
}
```

Create `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.html`:

```html
<table class="lbt-table">
  <thead>
    <tr>
      @if (showEmployeeColumn) { <th data-testid="balance-employee-column">Employee</th> }
      @if (showDepartmentColumn) { <th>Department</th> }
      @if (showLegalEntityColumn) { <th>Legal Entity</th> }
      <th>Leave Type</th>
      <th>Entitled</th>
      <th>Carried Forward</th>
      <th>Used</th>
      <th>Pending</th>
      <th>Remaining</th>
      <th>Carry-Forward Expires</th>
    </tr>
  </thead>
  <tbody>
    @for (balance of balances; track balance.employeeId + balance.leaveTypeId) {
      <tr data-testid="balance-row">
        @if (showEmployeeColumn) { <td>{{ balance.employeeName }} <span class="lbt-muted">({{ balance.employeeNumber }})</span></td> }
        @if (showDepartmentColumn) { <td>{{ balance.departmentName ?? '-' }}</td> }
        @if (showLegalEntityColumn) { <td>{{ balance.legalEntityName ?? '-' }}</td> }
        <td>{{ balance.leaveTypeName }} <span class="lbt-muted">({{ balance.leaveTypeCode }})</span></td>
        <td>{{ balance.entitledDays.toFixed(1) }}</td>
        <td>{{ balance.carriedForwardDays.toFixed(1) }}</td>
        <td>{{ balance.usedDays.toFixed(1) }}</td>
        <td>{{ balance.pendingDays.toFixed(1) }}</td>
        <td>
          @if (balance.isNegative) {
            <span data-testid="balance-remaining-negative" class="lbt-negative">{{ balance.remainingDays.toFixed(1) }}</span>
          } @else {
            <span data-testid="balance-remaining">{{ balance.remainingDays.toFixed(1) }}</span>
          }
        </td>
        <td>{{ balance.carryForwardExpiresOn ?? '-' }}</td>
      </tr>
    }
  </tbody>
</table>
```

Create `src/app/modules/leave/ui/leave-balance-list-table/leave-balance-list-table.component.css`:

```css
.lbt-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.lbt-table th { text-align: left; padding: .55rem .7rem; color: var(--color-text-secondary, #64748b); font-weight: 650; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.lbt-table td { padding: .6rem .7rem; color: var(--color-text-primary, #18202d); border-bottom: 1px solid var(--color-border, #e4e8ee); }
.lbt-muted { color: var(--color-text-secondary, #64748b); font-size: .74rem; }
.lbt-negative { color: #c0362c; font-weight: 700; }
```

- [ ] **Step 4: Run component test**

Run:

```bash
npm test -- --include='**/leave-balance-list-table.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/ui/leave-balance-list-table
git commit -m "feat(leave): add shared balance list table"
```

---

### Task 5: My Balances feature page

**Files:**
- Create: `src/app/modules/leave/feature/my-balances/my-balances.component.ts`
- Create: `src/app/modules/leave/feature/my-balances/my-balances.component.html`
- Create: `src/app/modules/leave/feature/my-balances/my-balances.component.css`
- Create: `src/app/modules/leave/feature/my-balances/my-balances.component.spec.ts`

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

  it('loads balances for the current year on init', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`);
    expect(req.request.params.get('year')).toBe(String(new Date().getFullYear()));
    req.flush([]);
  });

  it('shows an empty state when there are no balances', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/my-balances.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/modules/leave/feature/my-balances/my-balances.component.ts`:

```typescript
/** Quiet Operations Desk: the employee's own leave position at a glance. */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';

@Component({
  selector: 'app-my-balances',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, SelectComponent, LeaveBalanceListTableComponent],
  templateUrl: './my-balances.component.html',
  styleUrl: './my-balances.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyBalancesComponent {
  readonly store = inject(LeaveBalanceStore);
  readonly yearOptions: SelectOption[] = yearOptions();
  readonly selectedYear = computed(() => String(this.store.year()));

  constructor() {
    void this.store.loadMy(new Date().getFullYear());
  }

  onYearChange(year: string): void {
    void this.store.loadMy(Number(year));
  }
}

export function yearOptions(): SelectOption[] {
  const current = new Date().getFullYear();
  return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) }));
}
```

Create `src/app/modules/leave/feature/my-balances/my-balances.component.html`:

```html
<section class="mbc-page">
  <header class="mbc-header">
    <div><p class="mbc-kicker">TIME OFF</p><h1>My Balances</h1><p class="mbc-subtitle">Your leave entitlements and remaining days for the selected year.</p></div>
    <app-select [options]="yearOptions" [value]="selectedYear()" (valueChange)="onYearChange($any($event))" />
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
</section>
```

Create `src/app/modules/leave/feature/my-balances/my-balances.component.css`:

```css
.mbc-page { max-width: 1320px; margin: 0 auto; padding: 1.75rem 2rem 2.5rem; }
.mbc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; padding-bottom: 1.4rem; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.mbc-kicker { margin: 0 0 .4rem; color: #1e5eff; font-size: .66rem; font-weight: 750; letter-spacing: .1em; }
.mbc-header h1 { margin: 0; color: var(--color-text-primary, #18202d); font-size: 1.56rem; line-height: 1.25; }
.mbc-subtitle { margin: .4rem 0 0; color: var(--color-text-secondary, #64748b); font-size: .88rem; }
.mbc-loading { display: flex; gap: .42rem; justify-content: center; padding: 4rem; }
.mbc-loading span { width: .52rem; height: .52rem; border-radius: 50%; background: #7ea3f7; animation: mbc-pulse 900ms ease-in-out infinite alternate; }
.mbc-loading span:nth-child(2) { animation-delay: 160ms; }
.mbc-loading span:nth-child(3) { animation-delay: 320ms; }
@keyframes mbc-pulse { to { opacity: .32; transform: translateY(-3px); } }
```

Confirmed against `shared/ui/select/select.component.ts`: inputs are `label`, `placeholder`, `options`, `disabled`, `value`, `error` (all `input()`), and the output is `valueChange = output<string>()`, emitted from `onChange` as `(event.target as HTMLSelectElement).value`. The bindings above (`[options]`, `[value]`, `(valueChange)`) match exactly - no further verification needed for this component.

- [ ] **Step 4: Run component test**

Run:

```bash
npm test -- --include='**/my-balances.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/my-balances
git commit -m "feat(leave): add My Balances page"
```

---

### Task 6: Team Balances feature page

**Files:**
- Create: `src/app/modules/leave/feature/team-balances/team-balances.component.ts`
- Create: `src/app/modules/leave/feature/team-balances/team-balances.component.html`
- Create: `src/app/modules/leave/feature/team-balances/team-balances.component.css`
- Create: `src/app/modules/leave/feature/team-balances/team-balances.component.spec.ts`

Same shape as Task 5 but scoped to the manager's reports, with search + leave-type filters (no legal-entity filter - a manager's team does not cross legal entities in this design).

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/leave/feature/team-balances/team-balances.component.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { TeamBalancesComponent } from './team-balances.component';

describe('TeamBalancesComponent', () => {
  let fixture: ComponentFixture<TeamBalancesComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TeamBalancesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TeamBalancesComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads team balances on init', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/team`);
    req.flush([]);
  });

  it('reloads when the search box changes', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/team`).flush([]);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="team-balances-search"]');
    input.value = 'anu';
    input.dispatchEvent(new Event('input'));
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/team` && r.params.get('search') === 'anu');
    req.flush([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/team-balances.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/modules/leave/feature/team-balances/team-balances.component.ts`:

```typescript
/** Quiet Operations Desk: a manager's scan of direct/indirect reports' leave positions. */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';

@Component({
  selector: 'app-team-balances',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, LeaveBalanceListTableComponent],
  templateUrl: './team-balances.component.html',
  styleUrl: './team-balances.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamBalancesComponent {
  readonly store = inject(LeaveBalanceStore);

  constructor() {
    void this.store.loadTeam(new Date().getFullYear());
  }

  onSearchInput(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.store.setTeamFilters({ ...this.store.teamFilters(), search: search || undefined });
  }
}
```

Create `src/app/modules/leave/feature/team-balances/team-balances.component.html`:

```html
<section class="tbc-page">
  <header class="tbc-header">
    <div><p class="tbc-kicker">TIME OFF / TEAM</p><h1>Team Balances</h1><p class="tbc-subtitle">Leave positions for your direct and indirect reports.</p></div>
    <input data-testid="team-balances-search" type="text" placeholder="Search by name or employee number" class="tbc-search" (input)="onSearchInput($event)" />
  </header>
  @if (store.teamLoading()) {
    <div class="tbc-loading" aria-busy="true"><span></span><span></span><span></span></div>
  } @else if (store.teamError()) {
    <app-error-state [message]="store.teamError()!" [retryable]="true" (retry)="store.loadTeam(store.year())" />
  } @else if (store.team().length === 0) {
    <app-empty-state title="No team balances found" description="No entitlements match the current filters, or your team has none generated yet." />
  } @else {
    <app-leave-balance-list-table [balances]="store.team()" [showDepartmentColumn]="true" />
  }
</section>
```

Create `src/app/modules/leave/feature/team-balances/team-balances.component.css`:

```css
.tbc-page { max-width: 1320px; margin: 0 auto; padding: 1.75rem 2rem 2.5rem; }
.tbc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; padding-bottom: 1.4rem; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.tbc-kicker { margin: 0 0 .4rem; color: #1e5eff; font-size: .66rem; font-weight: 750; letter-spacing: .1em; }
.tbc-header h1 { margin: 0; color: var(--color-text-primary, #18202d); font-size: 1.56rem; line-height: 1.25; }
.tbc-subtitle { margin: .4rem 0 0; color: var(--color-text-secondary, #64748b); font-size: .88rem; }
.tbc-search { min-width: 260px; border-radius: 8px; border: 1px solid var(--color-border, #e4e8ee); padding: .5rem .75rem; font-size: .82rem; }
.tbc-loading { display: flex; gap: .42rem; justify-content: center; padding: 4rem; }
.tbc-loading span { width: .52rem; height: .52rem; border-radius: 50%; background: #7ea3f7; animation: tbc-pulse 900ms ease-in-out infinite alternate; }
.tbc-loading span:nth-child(2) { animation-delay: 160ms; }
.tbc-loading span:nth-child(3) { animation-delay: 320ms; }
@keyframes tbc-pulse { to { opacity: .32; transform: translateY(-3px); } }
```

- [ ] **Step 4: Run component test**

Run:

```bash
npm test -- --include='**/team-balances.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/team-balances
git commit -m "feat(leave): add Team Balances page"
```

---

### Task 7: Entitlement list table + generate/manual/adjust modals (presentational)

**Files:**
- Create: `src/app/modules/leave/ui/leave-entitlement-list-table/leave-entitlement-list-table.component.ts` (+ `.html`, `.css`, `.spec.ts`)
- Create: `src/app/modules/leave/ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component.ts` (+ `.html`, `.css`, `.spec.ts`)
- Create: `src/app/modules/leave/ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component.ts` (+ `.html`, `.css`, `.spec.ts`)
- Create: `src/app/modules/leave/ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component.ts` (+ `.html`, `.css`, `.spec.ts`)

- [ ] **Step 1: Write the failing list table test**

Create `src/app/modules/leave/ui/leave-entitlement-list-table/leave-entitlement-list-table.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveEntitlementResponse } from '../../models/leave-entitlement.model';
import { LeaveEntitlementListTableComponent } from './leave-entitlement-list-table.component';

describe('LeaveEntitlementListTableComponent', () => {
  let fixture: ComponentFixture<LeaveEntitlementListTableComponent>;

  const entitlements: LeaveEntitlementResponse[] = [
    { id: 'ent-1', employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, totalDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: 17, source: 'manual', manualReason: 'Backfill', isOverUtilized: false, warning: null, createdAt: '2026-08-21T00:00:00Z', updatedAt: null }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveEntitlementListTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveEntitlementListTableComponent);
    fixture.componentRef.setInput('entitlements', entitlements);
  });

  it('renders one row per entitlement with a manual badge', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="entitlement-row"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="entitlement-source"]').textContent).toContain('Manual');
  });

  it('emits adjustEntitlement when the Adjust action is clicked', () => {
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
    const emitted: LeaveEntitlementResponse[] = [];
    fixture.componentInstance.adjustEntitlement.subscribe((e: LeaveEntitlementResponse) => emitted.push(e));
    (fixture.nativeElement.querySelector('[data-testid="entitlement-adjust"]') as HTMLButtonElement).click();
    expect(emitted).toEqual([entitlements[0]]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/leave-entitlement-list-table.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the list table**

Create `src/app/modules/leave/ui/leave-entitlement-list-table/leave-entitlement-list-table.component.ts`:

```typescript
/** Quiet Operations Desk: HR's editable entitlement ledger. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveEntitlementResponse } from '../../models/leave-entitlement.model';

@Component({ selector: 'app-leave-entitlement-list-table', standalone: true, imports: [CommonModule], templateUrl: './leave-entitlement-list-table.component.html', styleUrl: './leave-entitlement-list-table.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementListTableComponent {
  @Input({ required: true }) entitlements: readonly LeaveEntitlementResponse[] = [];
  @Input() canManage = false;
  @Output() adjustEntitlement = new EventEmitter<LeaveEntitlementResponse>();
  @Output() recalculateEntitlement = new EventEmitter<LeaveEntitlementResponse>();

  onAdjust(entitlement: LeaveEntitlementResponse): void { this.adjustEntitlement.emit(entitlement); }
  onRecalculate(entitlement: LeaveEntitlementResponse): void { this.recalculateEntitlement.emit(entitlement); }
}
```

Create `src/app/modules/leave/ui/leave-entitlement-list-table/leave-entitlement-list-table.component.html`:

```html
<table class="elt-table">
  <thead>
    <tr>
      <th>Employee</th><th>Leave Type</th><th>Source</th><th>Total</th><th>Carried Forward</th><th>Used</th><th>Pending</th><th>Remaining</th>
      @if (canManage) { <th>Actions</th> }
    </tr>
  </thead>
  <tbody>
    @for (entitlement of entitlements; track entitlement.id) {
      <tr data-testid="entitlement-row">
        <td>{{ entitlement.employeeName }} <span class="elt-muted">({{ entitlement.employeeNumber }})</span></td>
        <td>{{ entitlement.leaveTypeName }}</td>
        <td>
          <span data-testid="entitlement-source" [class.elt-badge-manual]="entitlement.source === 'manual'" class="elt-badge">{{ entitlement.source === 'manual' ? 'Manual' : 'Auto' }}</span>
          @if (entitlement.isOverUtilized) { <span class="elt-badge elt-badge-warning">Over-utilized</span> }
        </td>
        <td>{{ entitlement.totalDays.toFixed(1) }}</td>
        <td>{{ entitlement.carriedForwardDays.toFixed(1) }}</td>
        <td>{{ entitlement.usedDays.toFixed(1) }}</td>
        <td>{{ entitlement.pendingDays.toFixed(1) }}</td>
        <td [class.elt-negative]="entitlement.remainingDays < 0">{{ entitlement.remainingDays.toFixed(1) }}</td>
        @if (canManage) {
          <td class="elt-actions">
            <button type="button" data-testid="entitlement-adjust" class="elt-action" (click)="onAdjust(entitlement)">Adjust</button>
            <button type="button" data-testid="entitlement-recalculate" class="elt-action" (click)="onRecalculate(entitlement)">Recalculate</button>
          </td>
        }
      </tr>
    }
  </tbody>
</table>
```

Create `src/app/modules/leave/ui/leave-entitlement-list-table/leave-entitlement-list-table.component.css`:

```css
.elt-table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.elt-table th { text-align: left; padding: .55rem .7rem; color: var(--color-text-secondary, #64748b); font-weight: 650; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.elt-table td { padding: .6rem .7rem; color: var(--color-text-primary, #18202d); border-bottom: 1px solid var(--color-border, #e4e8ee); }
.elt-muted { color: var(--color-text-secondary, #64748b); font-size: .74rem; }
.elt-negative { color: #c0362c; font-weight: 700; }
.elt-badge { display: inline-block; padding: .12rem .5rem; border-radius: 999px; font-size: .7rem; font-weight: 650; background: #eef2ff; color: #3b4ca0; margin-right: .3rem; }
.elt-badge-manual { background: #fef3e2; color: #8a5a12; }
.elt-badge-warning { background: #fde8e6; color: #a3271d; }
.elt-actions { display: flex; gap: .4rem; }
.elt-action { border: 1px solid var(--color-border, #e4e8ee); background: var(--color-surface, #fff); border-radius: 6px; padding: .3rem .6rem; font-size: .74rem; cursor: pointer; }
.elt-action:hover { background: var(--color-surface-secondary, #f4f6f9); }
```

- [ ] **Step 4: Run list table test**

Run:

```bash
npm test -- --include='**/leave-entitlement-list-table.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Write the failing generate-modal test**

Create `src/app/modules/leave/ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveEntitlementGenerationPreviewResponse } from '../../models/leave-entitlement.model';
import { LeaveEntitlementGenerateModalComponent } from './leave-entitlement-generate-modal.component';

describe('LeaveEntitlementGenerateModalComponent', () => {
  let fixture: ComponentFixture<LeaveEntitlementGenerateModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveEntitlementGenerateModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveEntitlementGenerateModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('year', 2026);
  });

  it('emits preview with the selected year and legal entity on the preview step', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.preview.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onPreviewClick();
    expect(emitted).toEqual([{ year: 2026, legalEntityId: null }]);
  });

  it('shows the preview summary once a preview result is provided', () => {
    const preview: LeaveEntitlementGenerationPreviewResponse = { year: 2026, employeeCount: 3, entitlementLineCount: 3, lines: [], skipped: [] };
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('emits confirmGenerate when the confirm button is clicked after a preview exists', () => {
    const preview: LeaveEntitlementGenerationPreviewResponse = { year: 2026, employeeCount: 1, entitlementLineCount: 1, lines: [], skipped: [] };
    fixture.componentRef.setInput('preview', preview);
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.confirmGenerate.subscribe((e: unknown) => emitted.push(e));
    (fixture.nativeElement.querySelector('[data-testid="generate-confirm"]') as HTMLButtonElement).click();
    expect(emitted).toEqual([{ year: 2026, legalEntityId: null }]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/leave-entitlement-generate-modal.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 7: Implement the generate modal**

Create `src/app/modules/leave/ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component.ts`:

```typescript
/** Two-step bulk generate: pick scope -> preview -> confirm. Never calls the API itself; the parent owns store calls. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { GenerateEntitlementsRequest, LeaveEntitlementGenerationPreviewResponse } from '../../models/leave-entitlement.model';

@Component({ selector: 'app-leave-entitlement-generate-modal', standalone: true, imports: [CommonModule, ModalComponent], templateUrl: './leave-entitlement-generate-modal.component.html', styleUrl: './leave-entitlement-generate-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementGenerateModalComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) year = new Date().getFullYear();
  @Input() legalEntities: readonly LegalEntityListItem[] = [];
  @Input() preview: LeaveEntitlementGenerationPreviewResponse | null = null;
  @Input() generating = false;
  @Input() generationError: string | null = null;
  @Output() preview$ = new EventEmitter<GenerateEntitlementsRequest>();
  @Output() confirmGenerate = new EventEmitter<GenerateEntitlementsRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly selectedLegalEntityId = signal<string | null>(null);

  get preview_alias(): EventEmitter<GenerateEntitlementsRequest> { return this.preview$; }
  // Exposed under the name the spec expects.
  get previewEmitter(): EventEmitter<GenerateEntitlementsRequest> { return this.preview$; }

  onLegalEntityChange(legalEntityId: string): void { this.selectedLegalEntityId.set(legalEntityId || null); }

  onPreviewClick(): void { this.preview$.emit({ year: this.year, legalEntityId: this.selectedLegalEntityId() }); }

  onConfirmClick(): void { this.confirmGenerate.emit({ year: this.year, legalEntityId: this.selectedLegalEntityId() }); }

  onClose(): void { this.closed.emit(); }
}
```

Note: the spec above calls `fixture.componentInstance.preview.subscribe(...)` - since `preview` is already used as the `@Input()` name for the preview *result*, the output must be named differently in the actual component (`preview$` above collides with nothing but is not what the test calls). Before writing this file for real, rename the `@Input() preview` to `previewResult` and the `@Output() preview$` to `preview` so the test's `fixture.componentInstance.preview.subscribe(...)` line resolves correctly, and update the template/other references accordingly. Do this rename now, before running Step 8, and delete the two throwaway getter aliases above (`preview_alias`, `previewEmitter`) - they exist only to flag the naming collision, not to ship.

Corrected component (replace the block above with this before running tests):

```typescript
/** Two-step bulk generate: pick scope -> preview -> confirm. Never calls the API itself; the parent owns store calls. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { GenerateEntitlementsRequest, LeaveEntitlementGenerationPreviewResponse } from '../../models/leave-entitlement.model';

@Component({ selector: 'app-leave-entitlement-generate-modal', standalone: true, imports: [CommonModule, ModalComponent], templateUrl: './leave-entitlement-generate-modal.component.html', styleUrl: './leave-entitlement-generate-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementGenerateModalComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) year = new Date().getFullYear();
  @Input() legalEntities: readonly LegalEntityListItem[] = [];
  @Input() previewResult: LeaveEntitlementGenerationPreviewResponse | null = null;
  @Input() generating = false;
  @Input() generationError: string | null = null;
  @Output() preview = new EventEmitter<GenerateEntitlementsRequest>();
  @Output() confirmGenerate = new EventEmitter<GenerateEntitlementsRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly selectedLegalEntityId = signal<string | null>(null);

  onLegalEntityChange(legalEntityId: string): void { this.selectedLegalEntityId.set(legalEntityId || null); }
  onPreviewClick(): void { this.preview.emit({ year: this.year, legalEntityId: this.selectedLegalEntityId() }); }
  onConfirmClick(): void { this.confirmGenerate.emit({ year: this.year, legalEntityId: this.selectedLegalEntityId() }); }
  onClose(): void { this.closed.emit(); }
}
```

And update the spec's `preview` input line accordingly - change `fixture.componentRef.setInput('preview', preview)` to `fixture.componentRef.setInput('previewResult', preview)` in Step 5's test before running it.

Create `src/app/modules/leave/ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component.html`:

```html
<app-modal [open]="open" title="Generate Entitlements" (closed)="onClose()">
  <div class="egm-body">
    <label class="egm-field">
      <span>Legal Entity (optional - leave blank for all)</span>
      <select (change)="onLegalEntityChange($any($event.target).value)">
        <option value="">All legal entities</option>
        @for (entity of legalEntities; track entity.id) { <option [value]="entity.id">{{ entity.name }}</option> }
      </select>
    </label>
    @if (!previewResult) {
      <button type="button" class="egm-primary" [disabled]="generating" (click)="onPreviewClick()">{{ generating ? 'Loading preview...' : 'Preview' }}</button>
    } @else {
      <div class="egm-summary">
        <p><strong>{{ previewResult.employeeCount }}</strong> employees, <strong>{{ previewResult.entitlementLineCount }}</strong> entitlement lines will be created.</p>
        @if (previewResult.skipped.length > 0) { <p class="egm-warning">{{ previewResult.skipped.length }} employee(s) will be skipped (no active policy or already generated).</p> }
      </div>
      @if (generationError) { <p class="egm-error">{{ generationError }}</p> }
      <div class="egm-actions">
        <button type="button" class="egm-secondary" [disabled]="generating" (click)="onPreviewClick()">Re-run preview</button>
        <button type="button" data-testid="generate-confirm" class="egm-primary" [disabled]="generating" (click)="onConfirmClick()">{{ generating ? 'Generating...' : 'Confirm & Generate' }}</button>
      </div>
    }
  </div>
</app-modal>
```

Create `src/app/modules/leave/ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component.css`:

```css
.egm-body { display: flex; flex-direction: column; gap: .9rem; min-width: 320px; }
.egm-field { display: flex; flex-direction: column; gap: .3rem; font-size: .8rem; color: var(--color-text-secondary, #64748b); }
.egm-field select { border-radius: 6px; border: 1px solid var(--color-border, #e4e8ee); padding: .4rem .6rem; }
.egm-primary { background: #1e5eff; color: #fff; border: none; border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.egm-secondary { background: transparent; border: 1px solid var(--color-border, #e4e8ee); border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.egm-summary { background: #f4f6f9; border-radius: 8px; padding: .7rem .9rem; font-size: .84rem; }
.egm-warning { color: #8a5a12; margin: .35rem 0 0; }
.egm-error { color: #a3271d; font-size: .8rem; }
.egm-actions { display: flex; justify-content: flex-end; gap: .5rem; }
```

- [ ] **Step 8: Run generate-modal test**

Run:

```bash
npm test -- --include='**/leave-entitlement-generate-modal.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 9: Write the failing manual-form-modal test**

Create `src/app/modules/leave/ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { LeaveEntitlementManualFormModalComponent } from './leave-entitlement-manual-form-modal.component';

describe('LeaveEntitlementManualFormModalComponent', () => {
  let fixture: ComponentFixture<LeaveEntitlementManualFormModalComponent>;

  const leaveTypes: LeaveTypeResponse[] = [
    { id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual', isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20, carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0, isActive: true, createdAt: '2026-08-21T00:00:00Z' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveEntitlementManualFormModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveEntitlementManualFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('leaveTypes', leaveTypes);
  });

  it('does not emit save until an employee is picked', () => {
    fixture.detectChanges();
    const emitted: unknown[] = [];
    fixture.componentInstance.save.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmit();
    expect(emitted.length).toBe(0);
  });

  it('emits save with the picked employee and form values', () => {
    fixture.detectChanges();
    fixture.componentInstance.onEmployeePicked('emp-1');
    fixture.componentInstance.leaveTypeId.set('type-1');
    fixture.componentInstance.totalDays.set(20);
    fixture.componentInstance.carriedForwardDays.set(2);
    fixture.componentInstance.reason.set('Backfill for legacy system');
    const emitted: unknown[] = [];
    fixture.componentInstance.save.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmit();
    expect(emitted).toEqual([{ employeeId: 'emp-1', leaveTypeId: 'type-1', year: 2026, totalDays: 20, carriedForwardDays: 2, reason: 'Backfill for legacy system' }]);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/leave-entitlement-manual-form-modal.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 11: Implement the manual-form modal**

Create `src/app/modules/leave/ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component.ts`:

```typescript
/** HR-only: create one entitlement outside the bulk generate flow (e.g. a backfilled hire). */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { EmployeePickerComponent } from '../../../work/ui/employee-picker/employee-picker.component';
import { CreateManualEntitlementRequest } from '../../models/leave-entitlement.model';
import { LeaveTypeResponse } from '../../models/leave-type.model';

@Component({ selector: 'app-leave-entitlement-manual-form-modal', standalone: true, imports: [CommonModule, ModalComponent, EmployeePickerComponent], templateUrl: './leave-entitlement-manual-form-modal.component.html', styleUrl: './leave-entitlement-manual-form-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementManualFormModalComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) year = new Date().getFullYear();
  @Input() leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input() saving = false;
  @Input() actionError: string | null = null;
  @Output() save = new EventEmitter<CreateManualEntitlementRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly pickerOpen = signal(false);
  readonly employeeId = signal<string | null>(null);
  readonly leaveTypeId = signal<string | null>(null);
  readonly totalDays = signal<number | null>(null);
  readonly carriedForwardDays = signal<number>(0);
  readonly reason = signal('');

  onEmployeePicked(employeeId: string): void { this.employeeId.set(employeeId); this.pickerOpen.set(false); }

  onSubmit(): void {
    const employeeId = this.employeeId();
    const leaveTypeId = this.leaveTypeId();
    const totalDays = this.totalDays();
    if (!employeeId || !leaveTypeId || totalDays === null || !this.reason().trim()) return;
    this.save.emit({ employeeId, leaveTypeId, year: this.year, totalDays, carriedForwardDays: this.carriedForwardDays(), reason: this.reason().trim() });
  }

  onClose(): void { this.closed.emit(); }
}
```

Create `src/app/modules/leave/ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component.html`:

```html
<app-modal [open]="open" title="Add Manual Entitlement" (closed)="onClose()">
  <div class="emm-body">
    <button type="button" class="emm-picker-trigger" (click)="pickerOpen.set(true)">{{ employeeId() ? 'Employee selected' : 'Choose employee' }}</button>
    <app-employee-picker [open]="pickerOpen()" (selected)="onEmployeePicked($event)" (closed)="pickerOpen.set(false)" />
    <label class="emm-field">
      <span>Leave Type</span>
      <select (change)="leaveTypeId.set($any($event.target).value)">
        <option value="">Select a leave type</option>
        @for (type of leaveTypes; track type.id) { <option [value]="type.id">{{ type.name }}</option> }
      </select>
    </label>
    <label class="emm-field"><span>Total Days</span><input type="number" step="0.5" (input)="totalDays.set($any($event.target).valueAsNumber)" /></label>
    <label class="emm-field"><span>Carried Forward Days</span><input type="number" step="0.5" [value]="carriedForwardDays()" (input)="carriedForwardDays.set($any($event.target).valueAsNumber)" /></label>
    <label class="emm-field"><span>Reason</span><textarea rows="2" (input)="reason.set($any($event.target).value)"></textarea></label>
    @if (actionError) { <p class="emm-error">{{ actionError }}</p> }
    <div class="emm-actions">
      <button type="button" class="emm-secondary" (click)="onClose()">Cancel</button>
      <button type="button" class="emm-primary" [disabled]="saving" (click)="onSubmit()">{{ saving ? 'Saving...' : 'Save' }}</button>
    </div>
  </div>
</app-modal>
```

Create `src/app/modules/leave/ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component.css`:

```css
.emm-body { display: flex; flex-direction: column; gap: .8rem; min-width: 320px; }
.emm-picker-trigger { text-align: left; border: 1px dashed var(--color-border, #e4e8ee); border-radius: 6px; padding: .5rem .7rem; font-size: .82rem; background: transparent; cursor: pointer; }
.emm-field { display: flex; flex-direction: column; gap: .3rem; font-size: .8rem; color: var(--color-text-secondary, #64748b); }
.emm-field select, .emm-field input, .emm-field textarea { border-radius: 6px; border: 1px solid var(--color-border, #e4e8ee); padding: .4rem .6rem; font-family: inherit; }
.emm-primary { background: #1e5eff; color: #fff; border: none; border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.emm-secondary { background: transparent; border: 1px solid var(--color-border, #e4e8ee); border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.emm-error { color: #a3271d; font-size: .8rem; }
.emm-actions { display: flex; justify-content: flex-end; gap: .5rem; }
```

- [ ] **Step 12: Run manual-form-modal test**

Run:

```bash
npm test -- --include='**/leave-entitlement-manual-form-modal.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 13: Write the failing adjust-modal test**

Create `src/app/modules/leave/ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveEntitlementResponse } from '../../models/leave-entitlement.model';
import { LeaveEntitlementAdjustModalComponent } from './leave-entitlement-adjust-modal.component';

describe('LeaveEntitlementAdjustModalComponent', () => {
  let fixture: ComponentFixture<LeaveEntitlementAdjustModalComponent>;

  const entitlement: LeaveEntitlementResponse = { id: 'ent-1', employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL', year: 2026, totalDays: 20, carriedForwardDays: 2, usedDays: 4, pendingDays: 1, remainingDays: 17, source: 'auto', manualReason: null, isOverUtilized: false, warning: null, createdAt: '2026-08-21T00:00:00Z', updatedAt: null };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveEntitlementAdjustModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveEntitlementAdjustModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('entitlement', entitlement);
  });

  it('pre-fills totalDays and carriedForwardDays from the entitlement', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.totalDays()).toBe(20);
    expect(fixture.componentInstance.carriedForwardDays()).toBe(2);
  });

  it('emits save with confirmNegativeRemaining false on first submit', () => {
    fixture.detectChanges();
    fixture.componentInstance.reason.set('Correction');
    const emitted: unknown[] = [];
    fixture.componentInstance.save.subscribe((e: unknown) => emitted.push(e));
    fixture.componentInstance.onSubmit();
    expect(emitted).toEqual([{ totalDays: 20, carriedForwardDays: 2, reason: 'Correction', confirmNegativeRemaining: false }]);
  });

  it('shows a confirm step and emits confirmNegativeRemaining true when needsConfirmation is set', () => {
    fixture.componentRef.setInput('needsConfirmation', true);
    fixture.detectChanges();
    fixture.componentInstance.reason.set('Correction');
    const emitted: unknown[] = [];
    fixture.componentInstance.save.subscribe((e: unknown) => emitted.push(e));
    (fixture.nativeElement.querySelector('[data-testid="adjust-confirm-negative"]') as HTMLButtonElement).click();
    expect(emitted).toEqual([{ totalDays: 20, carriedForwardDays: 2, reason: 'Correction', confirmNegativeRemaining: true }]);
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/leave-entitlement-adjust-modal.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 15: Implement the adjust modal**

Create `src/app/modules/leave/ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component.ts`:

```typescript
/** HR-only: adjust totalDays/carriedForwardDays with a mandatory reason; a 409 (would go negative) surfaces needsConfirmation from the parent. */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AdjustEntitlementRequest, LeaveEntitlementResponse } from '../../models/leave-entitlement.model';

@Component({ selector: 'app-leave-entitlement-adjust-modal', standalone: true, imports: [CommonModule, ModalComponent], templateUrl: './leave-entitlement-adjust-modal.component.html', styleUrl: './leave-entitlement-adjust-modal.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class LeaveEntitlementAdjustModalComponent implements OnChanges {
  @Input({ required: true }) open = false;
  @Input({ required: true }) entitlement!: LeaveEntitlementResponse;
  @Input() needsConfirmation = false;
  @Input() saving = false;
  @Input() actionError: string | null = null;
  @Output() save = new EventEmitter<AdjustEntitlementRequest>();
  @Output() closed = new EventEmitter<void>();

  readonly totalDays = signal(0);
  readonly carriedForwardDays = signal(0);
  readonly reason = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entitlement'] && this.entitlement) {
      this.totalDays.set(this.entitlement.totalDays);
      this.carriedForwardDays.set(this.entitlement.carriedForwardDays);
    }
  }

  onSubmit(): void { this.emitAdjust(false); }
  onConfirmNegative(): void { this.emitAdjust(true); }
  onClose(): void { this.closed.emit(); }

  private emitAdjust(confirmNegativeRemaining: boolean): void {
    if (!this.reason().trim()) return;
    this.save.emit({ totalDays: this.totalDays(), carriedForwardDays: this.carriedForwardDays(), reason: this.reason().trim(), confirmNegativeRemaining });
  }
}
```

Create `src/app/modules/leave/ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component.html`:

```html
<app-modal [open]="open" title="Adjust Entitlement" (closed)="onClose()">
  <div class="eam-body">
    <p class="eam-subject">{{ entitlement.employeeName }} - {{ entitlement.leaveTypeName }} ({{ entitlement.year }})</p>
    <label class="eam-field"><span>Total Days</span><input type="number" step="0.5" [value]="totalDays()" (input)="totalDays.set($any($event.target).valueAsNumber)" /></label>
    <label class="eam-field"><span>Carried Forward Days</span><input type="number" step="0.5" [value]="carriedForwardDays()" (input)="carriedForwardDays.set($any($event.target).valueAsNumber)" /></label>
    <label class="eam-field"><span>Reason</span><textarea rows="2" (input)="reason.set($any($event.target).value)"></textarea></label>
    @if (actionError) { <p class="eam-error">{{ actionError }}</p> }
    @if (!needsConfirmation) {
      <div class="eam-actions">
        <button type="button" class="eam-secondary" (click)="onClose()">Cancel</button>
        <button type="button" class="eam-primary" [disabled]="saving" (click)="onSubmit()">{{ saving ? 'Saving...' : 'Save' }}</button>
      </div>
    } @else {
      <p class="eam-warning">This change would leave a negative remaining balance. Continue anyway?</p>
      <div class="eam-actions">
        <button type="button" class="eam-secondary" (click)="onClose()">Cancel</button>
        <button type="button" data-testid="adjust-confirm-negative" class="eam-danger" [disabled]="saving" (click)="onConfirmNegative()">Adjust anyway</button>
      </div>
    }
  </div>
</app-modal>
```

Create `src/app/modules/leave/ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component.css`:

```css
.eam-body { display: flex; flex-direction: column; gap: .8rem; min-width: 320px; }
.eam-subject { margin: 0; font-size: .84rem; color: var(--color-text-secondary, #64748b); }
.eam-field { display: flex; flex-direction: column; gap: .3rem; font-size: .8rem; color: var(--color-text-secondary, #64748b); }
.eam-field input, .eam-field textarea { border-radius: 6px; border: 1px solid var(--color-border, #e4e8ee); padding: .4rem .6rem; font-family: inherit; }
.eam-primary { background: #1e5eff; color: #fff; border: none; border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.eam-secondary { background: transparent; border: 1px solid var(--color-border, #e4e8ee); border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.eam-danger { background: #c0362c; color: #fff; border: none; border-radius: 6px; padding: .5rem 1rem; font-size: .82rem; cursor: pointer; }
.eam-error { color: #a3271d; font-size: .8rem; }
.eam-warning { color: #8a5a12; font-size: .82rem; background: #fef3e2; border-radius: 6px; padding: .5rem .7rem; }
.eam-actions { display: flex; justify-content: flex-end; gap: .5rem; }
```

- [ ] **Step 16: Run adjust-modal test**

Run:

```bash
npm test -- --include='**/leave-entitlement-adjust-modal.component.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 17: Commit**

```bash
git add src/app/modules/leave/ui/leave-entitlement-list-table src/app/modules/leave/ui/leave-entitlement-generate-modal src/app/modules/leave/ui/leave-entitlement-manual-form-modal src/app/modules/leave/ui/leave-entitlement-adjust-modal
git commit -m "feat(leave): add entitlement table and generate/manual/adjust modals"
```

---

### Task 8: Entitlements Management feature page (HR, two tabs)

**Files:**
- Create: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.ts`
- Create: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.html`
- Create: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.css`
- Create: `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.spec.ts`

Wires together every piece built in Tasks 3, 4, and 7: the "Entitlements" tab (list + generate + manual + adjust + recalculate) and the "All Balances" tab (read-only, reuses `LeaveBalanceListTableComponent`).

- [ ] **Step 1: Write the failing component test**

Create `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { EntitlementsManagementComponent } from './entitlements-management.component';

describe('EntitlementsManagementComponent', () => {
  let fixture: ComponentFixture<EntitlementsManagementComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EntitlementsManagementComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(EntitlementsManagementComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads entitlements and legal entities on init, defaulting to the Entitlements tab', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="tab-entitlements"]').classList).toContain('active');
  });

  it('switches to the All Balances tab and lazily loads it once', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`).flush([]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="tab-all-balances"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/all`).flush([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --include='**/entitlements-management.component.spec.ts' --watch=false
```

Expected: FAIL - component does not exist.

- [ ] **Step 3: Implement the component**

Create `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.ts`:

```typescript
/** Quiet Operations Desk: HR's single home for entitlement bookkeeping and the org-wide balance ledger. */
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LegalEntityApiService } from '../../../organization/data-access/legal-entity-api.service';
import { LegalEntityListItem } from '../../../organization/models/legal-entity.model';
import { LeaveEntitlementStore } from '../../state/leave-entitlement.store';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { AdjustEntitlementRequest, CreateManualEntitlementRequest, LeaveEntitlementResponse, RecalculateEntitlementRequest } from '../../models/leave-entitlement.model';
import { LeaveEntitlementListTableComponent } from '../../ui/leave-entitlement-list-table/leave-entitlement-list-table.component';
import { LeaveEntitlementGenerateModalComponent } from '../../ui/leave-entitlement-generate-modal/leave-entitlement-generate-modal.component';
import { LeaveEntitlementManualFormModalComponent } from '../../ui/leave-entitlement-manual-form-modal/leave-entitlement-manual-form-modal.component';
import { LeaveEntitlementAdjustModalComponent } from '../../ui/leave-entitlement-adjust-modal/leave-entitlement-adjust-modal.component';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';

type Tab = 'entitlements' | 'all-balances';

@Component({
  selector: 'app-entitlements-management',
  standalone: true,
  imports: [CommonModule, ButtonComponent, EmptyStateComponent, ErrorStateComponent, LeaveEntitlementListTableComponent, LeaveEntitlementGenerateModalComponent, LeaveEntitlementManualFormModalComponent, LeaveEntitlementAdjustModalComponent, LeaveBalanceListTableComponent],
  templateUrl: './entitlements-management.component.html',
  styleUrl: './entitlements-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EntitlementsManagementComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly legalEntityApi = inject(LegalEntityApiService);
  readonly entitlementStore = inject(LeaveEntitlementStore);
  readonly balanceStore = inject(LeaveBalanceStore);
  readonly leaveTypeStore = inject(LeaveTypeStore);

  readonly canManage = computed(() => this.permissionService.hasPermission('leave:manage'));
  readonly canReadAllBalances = computed(() => this.permissionService.hasAnyPermission(['leave:read', 'leave:manage']));

  readonly activeTab = signal<Tab>('entitlements');
  private allBalancesLoaded = false;

  readonly legalEntities = signal<readonly LegalEntityListItem[]>([]);
  readonly generateModalOpen = signal(false);
  readonly manualModalOpen = signal(false);
  readonly adjustTarget = signal<LeaveEntitlementResponse | null>(null);
  readonly adjustNeedsConfirmation = signal(false);

  constructor() {
    void this.entitlementStore.load();
    void this.leaveTypeStore.load();
    void this.loadLegalEntities();
  }

  private async loadLegalEntities(): Promise<void> {
    try {
      this.legalEntities.set(await firstValueFrom(this.legalEntityApi.getLegalEntities(false)));
    } catch {
      this.notificationService.error('Failed to load legal entities.');
    }
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'all-balances' && !this.allBalancesLoaded) {
      this.allBalancesLoaded = true;
      void this.balanceStore.loadAll(this.entitlementStore.year());
    }
  }

  openGenerateModal(): void { this.generateModalOpen.set(true); }
  closeGenerateModal(): void { this.generateModalOpen.set(false); this.entitlementStore.clearGenerationPreview(); }

  async onPreviewGenerate(request: { year: number; legalEntityId: string | null }): Promise<void> {
    await this.entitlementStore.previewGenerate(request);
  }

  async onConfirmGenerate(request: { year: number; legalEntityId: string | null }): Promise<void> {
    const success = await this.entitlementStore.generate(request);
    if (success) {
      this.notificationService.success('Entitlements generated.');
      this.closeGenerateModal();
    }
  }

  openManualModal(): void { this.manualModalOpen.set(true); }
  closeManualModal(): void { this.manualModalOpen.set(false); }

  async onSaveManual(payload: CreateManualEntitlementRequest): Promise<void> {
    const success = await this.entitlementStore.createManual(payload);
    if (success) {
      this.notificationService.success('Manual entitlement created.');
      this.closeManualModal();
    } else {
      this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to create manual entitlement.');
    }
  }

  openAdjustModal(entitlement: LeaveEntitlementResponse): void { this.adjustTarget.set(entitlement); this.adjustNeedsConfirmation.set(false); }
  closeAdjustModal(): void { this.adjustTarget.set(null); this.adjustNeedsConfirmation.set(false); }

  async onSaveAdjust(payload: AdjustEntitlementRequest): Promise<void> {
    const target = this.adjustTarget();
    if (!target) return;
    const outcome = await this.entitlementStore.adjust(target.id, payload);
    if (outcome === 'success') { this.notificationService.success('Entitlement adjusted.'); this.closeAdjustModal(); }
    else if (outcome === 'confirm') this.adjustNeedsConfirmation.set(true);
    else this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to adjust entitlement.');
  }

  async onRecalculate(entitlement: LeaveEntitlementResponse): Promise<void> {
    const payload: RecalculateEntitlementRequest = { confirmNegativeRemaining: false };
    const outcome = await this.entitlementStore.recalculate(entitlement.id, payload);
    if (outcome === 'success') this.notificationService.success('Entitlement recalculated.');
    else if (outcome === 'confirm') {
      const confirmed = window.confirm('This recalculation would leave a negative remaining balance. Continue anyway?');
      if (confirmed) {
        const forced = await this.entitlementStore.recalculate(entitlement.id, { confirmNegativeRemaining: true });
        if (forced === 'success') this.notificationService.success('Entitlement recalculated.');
        else this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to recalculate entitlement.');
      }
    } else this.notificationService.error(this.entitlementStore.actionError() ?? 'Failed to recalculate entitlement.');
  }
}
```

- [ ] **Step 4: Add the template**

Create `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.html`:

```html
<section class="emc-page">
  <header class="emc-header">
    <div><p class="emc-kicker">TIME OFF / ADMINISTRATION</p><h1>Entitlements</h1><p class="emc-subtitle">Generate, assign, and adjust leave entitlements; review balances across the organization.</p></div>
    @if (canManage() && activeTab() === 'entitlements') {
      <div class="emc-header-actions">
        <app-button variant="secondary" (click)="openManualModal()">+ Manual entitlement</app-button>
        <app-button (click)="openGenerateModal()">Generate entitlements</app-button>
      </div>
    }
  </header>

  <div class="emc-tabs">
    <button type="button" data-testid="tab-entitlements" class="emc-tab" [class.active]="activeTab() === 'entitlements'" (click)="selectTab('entitlements')">Entitlements</button>
    @if (canReadAllBalances()) {
      <button type="button" data-testid="tab-all-balances" class="emc-tab" [class.active]="activeTab() === 'all-balances'" (click)="selectTab('all-balances')">All Balances</button>
    }
  </div>

  @if (activeTab() === 'entitlements') {
    @if (entitlementStore.loading()) {
      <div class="emc-loading" aria-busy="true"><span></span><span></span><span></span></div>
    } @else if (entitlementStore.loadError()) {
      <app-error-state [message]="entitlementStore.loadError()!" [retryable]="true" (retry)="entitlementStore.load()" />
    } @else if (entitlementStore.items().length === 0) {
      <app-empty-state title="No entitlements generated for this year" description="Use Generate entitlements to create them from each employee's active leave policy." />
    } @else {
      <app-leave-entitlement-list-table [entitlements]="entitlementStore.items()" [canManage]="canManage()" (adjustEntitlement)="openAdjustModal($event)" (recalculateEntitlement)="onRecalculate($event)" />
    }
  } @else {
    @if (balanceStore.allLoading()) {
      <div class="emc-loading" aria-busy="true"><span></span><span></span><span></span></div>
    } @else if (balanceStore.allError()) {
      <app-error-state [message]="balanceStore.allError()!" [retryable]="true" (retry)="balanceStore.loadAll(entitlementStore.year())" />
    } @else if (balanceStore.all().length === 0) {
      <app-empty-state title="No balances found" description="No entitlements match the current filters." />
    } @else {
      <app-leave-balance-list-table [balances]="balanceStore.all()" [showDepartmentColumn]="true" [showLegalEntityColumn]="true" />
    }
  }
</section>

@if (generateModalOpen()) {
  <app-leave-entitlement-generate-modal
    [open]="true"
    [year]="entitlementStore.year()"
    [legalEntities]="legalEntities()"
    [previewResult]="entitlementStore.generationPreview()"
    [generating]="entitlementStore.generating()"
    [generationError]="entitlementStore.generationError()"
    (preview)="onPreviewGenerate($event)"
    (confirmGenerate)="onConfirmGenerate($event)"
    (closed)="closeGenerateModal()"
  />
}
@if (manualModalOpen()) {
  <app-leave-entitlement-manual-form-modal
    [open]="true"
    [year]="entitlementStore.year()"
    [leaveTypes]="leaveTypeStore.items()"
    [saving]="entitlementStore.saving()"
    [actionError]="entitlementStore.actionError()"
    (save)="onSaveManual($event)"
    (closed)="closeManualModal()"
  />
}
@if (adjustTarget(); as target) {
  <app-leave-entitlement-adjust-modal
    [open]="true"
    [entitlement]="target"
    [needsConfirmation]="adjustNeedsConfirmation()"
    [saving]="entitlementStore.saving()"
    [actionError]="entitlementStore.actionError()"
    (save)="onSaveAdjust($event)"
    (closed)="closeAdjustModal()"
  />
}
```

- [ ] **Step 5: Add the stylesheet**

Create `src/app/modules/leave/feature/entitlements-management/entitlements-management.component.css`:

```css
.emc-page { max-width: 1320px; margin: 0 auto; padding: 1.75rem 2rem 2.5rem; }
.emc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1.5rem; padding-bottom: 1.4rem; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.emc-kicker { margin: 0 0 .4rem; color: #1e5eff; font-size: .66rem; font-weight: 750; letter-spacing: .1em; }
.emc-header h1 { margin: 0; color: var(--color-text-primary, #18202d); font-size: 1.56rem; line-height: 1.25; }
.emc-subtitle { margin: .4rem 0 0; color: var(--color-text-secondary, #64748b); font-size: .88rem; }
.emc-header-actions { display: flex; gap: .6rem; }
.emc-tabs { display: flex; gap: .3rem; margin: 1.1rem 0 1rem; border-bottom: 1px solid var(--color-border, #e4e8ee); }
.emc-tab { background: transparent; border: none; padding: .55rem .3rem; margin-right: 1rem; font-size: .84rem; color: var(--color-text-secondary, #64748b); cursor: pointer; border-bottom: 2px solid transparent; }
.emc-tab.active { color: #1e5eff; border-bottom-color: #1e5eff; font-weight: 650; }
.emc-loading { display: flex; gap: .42rem; justify-content: center; padding: 4rem; }
.emc-loading span { width: .52rem; height: .52rem; border-radius: 50%; background: #7ea3f7; animation: emc-pulse 900ms ease-in-out infinite alternate; }
.emc-loading span:nth-child(2) { animation-delay: 160ms; }
.emc-loading span:nth-child(3) { animation-delay: 320ms; }
@keyframes emc-pulse { to { opacity: .32; transform: translateY(-3px); } }
```

- [ ] **Step 6: Run component test**

Run:

```bash
npm test -- --include='**/entitlements-management.component.spec.ts' --watch=false
```

Expected: PASS. If `LegalEntityApiService.getLegalEntities` is not the exact method name, check `src/app/modules/organization/data-access/legal-entity-api.service.ts` (already used the same way in `policy-management.component.ts`, so it should match without changes).

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/leave/feature/entitlements-management
git commit -m "feat(leave): add Entitlements Management page with All Balances tab"
```

---

### Task 9: Routes and shell navigation

**Files:**
- Modify: `src/app/modules/leave/leave.routes.ts`
- Modify: `src/app/modules/leave/leave.routes.spec.ts`
- Modify: `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts`
- Modify: `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.html`

- [ ] **Step 1: Read the existing route spec before changing it**

Open `src/app/modules/leave/leave.routes.spec.ts` and note its current assertions (it currently checks the `types`-redirect and the two existing child routes). Update its expectations in Step 2 to match the new route table - do not leave old assertions that contradict the new default route.

- [ ] **Step 2: Update the route spec**

Replace the contents of `src/app/modules/leave/leave.routes.spec.ts` with:

```typescript
import { LEAVE_ROUTES } from './leave.routes';

describe('LEAVE_ROUTES', () => {
  it('has a shell route with My Balances as the index route', () => {
    const shell = LEAVE_ROUTES[0];
    const children = shell.children ?? [];
    const index = children.find((r) => r.path === '');
    expect(index).toBeTruthy();
    expect(index?.data?.['permissions']).toEqual(['leave:read-own']);
  });

  it('has a team balances route gated on leave:read-team', () => {
    const children = LEAVE_ROUTES[0].children ?? [];
    const team = children.find((r) => r.path === 'team');
    expect(team?.data?.['permissions']).toEqual(['leave:read-team']);
  });

  it('has an entitlements route gated on leave:read or leave:manage', () => {
    const children = LEAVE_ROUTES[0].children ?? [];
    const entitlements = children.find((r) => r.path === 'entitlements');
    expect(entitlements?.data?.['permissions']).toEqual(['leave:read', 'leave:manage']);
  });

  it('keeps the existing types and policies routes', () => {
    const children = LEAVE_ROUTES[0].children ?? [];
    expect(children.some((r) => r.path === 'types')).toBe(true);
    expect(children.some((r) => r.path === 'policies')).toBe(true);
  });
});
```

- [ ] **Step 3: Run the route spec to verify it fails**

Run:

```bash
npm test -- --include='**/leave.routes.spec.ts' --watch=false
```

Expected: FAIL - the index route currently redirects to `types` instead of loading My Balances, and `team`/`entitlements` do not exist yet.

- [ ] **Step 4: Update the routes**

Replace `src/app/modules/leave/leave.routes.ts` with:

```typescript
import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const LEAVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/time-off-shell/time-off-shell.component').then((m) => m.TimeOffShellComponent),
    children: [
      { path: '', loadComponent: () => import('./feature/my-balances/my-balances.component').then((m) => m.MyBalancesComponent), canActivate: [permissionGuard], data: { title: 'My Balances', permissions: ['leave:read-own'] } },
      { path: 'team', loadComponent: () => import('./feature/team-balances/team-balances.component').then((m) => m.TeamBalancesComponent), canActivate: [permissionGuard], data: { title: 'Team Balances', permissions: ['leave:read-team'] } },
      { path: 'entitlements', loadComponent: () => import('./feature/entitlements-management/entitlements-management.component').then((m) => m.EntitlementsManagementComponent), canActivate: [permissionGuard], data: { title: 'Entitlements', permissions: ['leave:read', 'leave:manage'] } },
      { path: 'types', loadComponent: () => import('./feature/leave-types-management/leave-types-management.component').then((m) => m.LeaveTypesManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Types', permissions: ['leave:read'] } },
      { path: 'policies', loadComponent: () => import('./feature/policy-management/policy-management.component').then((m) => m.PolicyManagementComponent), canActivate: [permissionGuard], data: { title: 'Leave Policies', permissions: ['leave:manage'] } }
    ]
  }
];
```

- [ ] **Step 5: Run the route spec**

Run:

```bash
npm test -- --include='**/leave.routes.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 6: Update the shell's nav items with permission gating**

Replace `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts` with:

```typescript
/** Quiet Operations Desk: local Time Off context rail, permission-filtered per visitor. */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';

interface TimeOffMenuItem {
  readonly label: string;
  readonly route: string;
  readonly permissions: readonly string[];
}

const MENU_ITEMS: readonly TimeOffMenuItem[] = [
  { label: 'My Balances', route: '/time-off', permissions: ['leave:read-own'] },
  { label: 'Team Balances', route: '/time-off/team', permissions: ['leave:read-team'] },
  { label: 'Entitlements', route: '/time-off/entitlements', permissions: ['leave:read', 'leave:manage'] },
  { label: 'Leave Types', route: '/time-off/types', permissions: ['leave:read'] },
  { label: 'Leave Policies', route: '/time-off/policies', permissions: ['leave:manage'] }
] as const;

@Component({ selector: 'app-time-off-shell', standalone: true, imports: [RouterLink, RouterLinkActive, RouterOutlet], templateUrl: './time-off-shell.component.html', styleUrl: './time-off-shell.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class TimeOffShellComponent {
  private readonly permissionService = inject(PermissionService);
  readonly menuItems = computed(() => MENU_ITEMS.filter((item) => this.permissionService.hasAnyPermission(item.permissions)));
}
```

- [ ] **Step 7: Update the shell template to read menuItems as a signal**

Read `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.html` first - it currently does `@for (item of menuItems; ...)`. Change the loop source from `menuItems` to `menuItems()` since it is now a computed signal:

```html
<nav class="tos-rail">
  @for (item of menuItems(); track item.route) {
    <a [routerLink]="item.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.route === '/time-off' }">{{ item.label }}</a>
  }
</nav>
<router-outlet />
```

(Keep any existing wrapper markup/classes from the current file - only the loop source and the `exact` match on the My Balances link need to change, since `/time-off` must not stay active-highlighted on `/time-off/team`.)

- [ ] **Step 8: Run the full leave module test suite**

Run:

```bash
npm test -- --include='**/modules/leave/**/*.spec.ts' --watch=false
```

Expected: PASS for every spec added or touched in this plan.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/leave/leave.routes.ts src/app/modules/leave/leave.routes.spec.ts src/app/modules/leave/feature/time-off-shell
git commit -m "feat(leave): wire My/Team Balances and Entitlements routes, gate shell nav by permission"
```

---

### Task 10: Full build and regression check

**Files:** none (verification only)

- [ ] **Step 1: Run a full production build**

Run:

```bash
npm run build
```

Expected: builds clean, no TypeScript errors. Pay particular attention to the `SelectComponent` output name flagged in Task 5 and the `EmployeePickerComponent`/`ModalComponent`/`LegalEntityApiService` imports flagged in Tasks 7-8 - these were used based on the current repo state read during planning, but re-verify each import resolves and each method/output name matches before treating a build failure as a real regression elsewhere.

- [ ] **Step 2: Run the full test suite**

Run:

```bash
npm test -- --watch=false
```

Expected: all tests pass, including the pre-existing Leave Types and Leave Policies suites (Phase 1/2) - this phase must not regress them.

- [ ] **Step 3: Manual smoke check against the running backend**

With `feat/leave-management-part-3` running locally (`dotnet run` from that worktree) and `ng serve --ssl true` running from this repo, log in as the smoke-seeded HR manager and:
1. Visit `/time-off` - confirm it loads My Balances by default (not a redirect flash to Leave Types).
2. Visit `/time-off/entitlements`, click "Generate entitlements", pick no legal entity, click Preview, confirm the preview summary renders, click "Confirm & Generate", confirm the table refreshes.
3. Click "Adjust" on a generated row, submit a negative-remaining change, confirm the "Adjust anyway" confirmation step appears and completes.
4. Switch to the "All Balances" tab, confirm it loads once and shows department + legal entity columns.
5. Visit `/time-off/team` as a manager account with reports, confirm team balances load and the search box filters.

Record any mismatch between this plan's assumed component API names (`SelectComponent`'s output, `ModalComponent`'s inputs, `EmployeePickerComponent`'s outputs) and the actual files, and fix the plan's assumptions inline in code (not in this doc) before moving to Phase 4.

- [ ] **Step 4: Commit only if Step 3 required code fixes**

```bash
git add -A
git commit -m "fix(leave): correct component API mismatches found during Phase 3 smoke test"
```

(Skip this commit if Step 3 required no changes.)
