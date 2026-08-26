# Leave Management - Part 2: Leave Policy Admin Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Leave Policies admin screen (spec Screen 2) against the real backend `/api/v1/leave/policies` endpoints: list, detail, create with replacement confirmation, and clone.

**Architecture:** Extend the Phase 1 `src/app/modules/leave/` module with policy-specific models, an API service, a signal store, list/detail UI, and a 7-step create wizard. Keep business numbers and country/legal-entity choices user supplied; the UI only supplies protocol vocabulary choices that already exist in the backend. Do not convert the main dark `Time Off` sidebar item into children; instead extend the People-module-style inner Time Off sidebar from Part 1 by adding only the newly built `Leave Policies` item.

**Tech Stack:** Angular 21 standalone components, Angular reactive forms, `HttpClient`, `@ngrx/signals` signal stores, RxJS `firstValueFrom`, co-located `.spec.ts` tests with `ng test`.

**Spec:** `docs/superpowers/specs/next/2026-08-21-leave-management-design.md`; backend API contract from `HRMS-Backend-v1/src/ONEVO.Api/Contracts/Leave/Policies/CreateLeavePolicyRequest.cs` and `HRMS-Backend-v1/src/ONEVO.Application/Features/Leave/Policy/DTOs/Responses/LeavePolicyResponse.cs`.

## Global Constraints

- Execute Frontend Part 1 first if `src/app/modules/leave/leave.routes.ts`, `leave-type.model.ts`, `leave-type-api.service.ts`, and `leave-type.store.ts` are missing.
- Use real backend calls only; no fixture-backed or mocked-data phase.
- Do not hard-code company policy values such as country, entitlement days, carry-forward caps, notice days, blackout dates, legal entity IDs, or effective dates. The user must enter or select them.
- The only fixed option values in UI are backend protocol vocabularies: `annual`, `monthly`, `daily`, `immediately`, `after_probation`, `after_n_months`, `calendar_days`, `working_days`, `any_one`, `all_must_approve`, `in_order`.
- `code` is owned by Leave Types and is not editable from policy screens.
- Main-sidebar nav children are not added in this phase. Use the inner Time Off sidebar from Part 1 for `/time-off/types` and `/time-off/policies`.
- Do not show unbuilt Time Off pages in the inner sidebar. After Part 2, the inner sidebar contains exactly `Leave Types` and `Leave Policies`; future items such as Entitlements, Requests, Approvals, Team Calendar, Balances, and Audit appear only in the phase that builds their route.
- Route and UI permission gating is only UX; backend permissions remain authoritative.
- Every production file added in this phase has a co-located `.spec.ts` or is covered by the feature/route spec named in its task.
- Use compact operational UI patterns already present in Organization screens: constrained content width, table/list scanning, modal/wizard for creation, short toasts, inline errors.

---

## File Map

- `src/app/modules/leave/models/leave-policy.model.ts` - DTOs, request types, option value unions, form draft types.
- `src/app/modules/leave/utils/leave-policy-form.mapper.ts` - pure validation and request mapping for the 7-step wizard.
- `src/app/modules/leave/data-access/leave-policy-api.service.ts` - `HttpClient` wrapper for list/get/create/clone.
- `src/app/modules/leave/state/leave-policy.store.ts` - signal store for list, selected policy, create/clone, conflict confirmation state.
- `src/app/modules/leave/feature/time-off-shell/` - update the inner Time Off sidebar from Part 1 to add `Leave Policies`.
- `src/app/modules/leave/ui/leave-policy-list-table/` - policy table and row actions.
- `src/app/modules/leave/ui/leave-policy-detail-panel/` - read-only detail panel for selected policy.
- `src/app/modules/leave/ui/leave-policy-form-wizard/` - 7-step create wizard.
- `src/app/modules/leave/feature/policy-management/` - page orchestration.
- `src/app/modules/leave/leave.routes.ts` - add `/time-off/policies`.
- `docs/superpowers/plans/next/2026-08-21-leave-management/SUMMARY.md` and indexes - mark Part 2 written in full.

---

### Task 1: Policy Models And Pure Form Mapper

**Files:**
- Create: `src/app/modules/leave/models/leave-policy.model.ts`
- Create: `src/app/modules/leave/utils/leave-policy-form.mapper.ts`
- Test: `src/app/modules/leave/utils/leave-policy-form.mapper.spec.ts`

**Interfaces:**
- Consumes: Phase 1 `LeaveTypeResponse.id`, `LeaveTypeResponse.name`, and `LeaveTypeResponse.code`.
- Produces:
  - `LeavePolicyListItemResponse`
  - `LeavePolicyResponse`
  - `CreateLeavePolicyRequest`
  - `CloneLeavePolicyRequest`
  - `LeavePolicyFormDraft`
  - `createEmptyLeavePolicyFormDraft(): LeavePolicyFormDraft`
  - `validateLeavePolicyFormDraft(draft: LeavePolicyFormDraft): readonly string[]`
  - `toCreateLeavePolicyRequest(draft: LeavePolicyFormDraft, confirmReplaceExistingLegalEntityAssignments: boolean): CreateLeavePolicyRequest`

- [ ] **Step 1: Write the failing mapper tests**

Create `src/app/modules/leave/utils/leave-policy-form.mapper.spec.ts`:

```ts
import {
  createEmptyLeavePolicyFormDraft,
  toCreateLeavePolicyRequest,
  validateLeavePolicyFormDraft
} from './leave-policy-form.mapper';
import { LeavePolicyFormDraft } from '../models/leave-policy.model';

function validDraft(): LeavePolicyFormDraft {
  return {
    name: 'Engineering annual policy',
    description: 'Applies to active engineering staff',
    country: 'LK',
    jobLevel: null,
    accrualMethod: 'monthly',
    accrualStart: 'after_n_months',
    accrualAfterNMonths: 3,
    prorationMethod: 'calendar_days',
    probationRestriction: true,
    minimumTenureMonths: 2,
    firstYearReducedPercent: null,
    minimumNoticeDays: 7,
    maxConsecutiveDays: 14,
    minDaysPerRequest: 0.5,
    maxTeamAbsencePercent: 25,
    approvalMode: 'in_order',
    effectiveFrom: '2026-01-01',
    leaveTypes: [
      {
        leaveTypeId: '11111111-1111-1111-1111-111111111111',
        annualEntitlementDays: 14,
        monthlyAccrualDays: 1.17,
        carryForwardMaxDays: 5,
        carryForwardExpiryMonths: 3
      }
    ],
    blackoutPeriods: [{ startDate: '2026-04-10', endDate: '2026-04-12', reason: 'Year-end freeze' }],
    legalEntityIds: ['22222222-2222-2222-2222-222222222222']
  };
}

describe('leave policy form mapper', () => {
  it('starts with blank business values instead of hard-coded policy defaults', () => {
    const draft = createEmptyLeavePolicyFormDraft();

    expect(draft.country).toBe('');
    expect(draft.effectiveFrom).toBe('');
    expect(draft.leaveTypes).toEqual([]);
    expect(draft.legalEntityIds).toEqual([]);
  });

  it('maps a draft to the backend create request and preserves confirmation explicitly', () => {
    const request = toCreateLeavePolicyRequest(validDraft(), true);

    expect(request.name).toBe('Engineering annual policy');
    expect(request.country).toBe('LK');
    expect(request.accrualMethod).toBe('monthly');
    expect(request.accrualStart).toBe('after_n_months');
    expect(request.accrualAfterNMonths).toBe(3);
    expect(request.leaveTypes).toEqual([
      {
        leaveTypeId: '11111111-1111-1111-1111-111111111111',
        annualEntitlementDays: 14,
        monthlyAccrualDays: 1.17,
        carryForwardMaxDays: 5,
        carryForwardExpiryMonths: 3
      }
    ]);
    expect(request.blackoutPeriods).toEqual([
      { startDate: '2026-04-10', endDate: '2026-04-12', reason: 'Year-end freeze' }
    ]);
    expect(request.legalEntityIds).toEqual(['22222222-2222-2222-2222-222222222222']);
    expect(request.confirmReplaceExistingLegalEntityAssignments).toBe(true);
  });

  it('requires country, effective date, one leave type rule, and one legal entity', () => {
    const draft = { ...validDraft(), country: '', effectiveFrom: '', leaveTypes: [], legalEntityIds: [] };

    expect(validateLeavePolicyFormDraft(draft)).toEqual([
      'Country is required.',
      'Effective date is required.',
      'Add at least one leave type rule.',
      'Select at least one legal entity.'
    ]);
  });

  it('requires accrualAfterNMonths only when accrual start is after_n_months', () => {
    const invalid = { ...validDraft(), accrualAfterNMonths: null };
    const validImmediate = { ...invalid, accrualStart: 'immediately' as const };

    expect(validateLeavePolicyFormDraft(invalid)).toContain('Enter the number of months before accrual starts.');
    expect(validateLeavePolicyFormDraft(validImmediate)).not.toContain('Enter the number of months before accrual starts.');
  });
});
```

- [ ] **Step 2: Run mapper tests to verify RED**

Run: `npx ng test --include src/app/modules/leave/utils/leave-policy-form.mapper.spec.ts`

Expected: FAIL because `leave-policy-form.mapper` and `leave-policy.model` do not exist.

- [ ] **Step 3: Add the model definitions**

Create `src/app/modules/leave/models/leave-policy.model.ts`:

```ts
export type LeavePolicyAccrualMethod = 'annual' | 'monthly' | 'daily';
export type LeavePolicyAccrualStart = 'immediately' | 'after_probation' | 'after_n_months';
export type LeavePolicyProrationMethod = 'calendar_days' | 'working_days';
export type LeavePolicyApprovalMode = 'any_one' | 'all_must_approve' | 'in_order';

export interface LeavePolicyLeaveTypeRuleResponse {
  readonly id: string;
  readonly leaveTypeId: string;
  readonly leaveTypeName: string;
  readonly leaveTypeCode: string;
  readonly annualEntitlementDays: number;
  readonly monthlyAccrualDays: number | null;
  readonly carryForwardMaxDays: number | null;
  readonly carryForwardExpiryMonths: number | null;
}

export interface LeavePolicyBlackoutPeriodResponse {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string | null;
}

export interface LeavePolicyLegalEntityAssignmentResponse {
  readonly id: string;
  readonly legalEntityId: string;
  readonly legalEntityName: string;
  readonly effectiveDate: string;
  readonly isActive: boolean;
}

export interface LeavePolicyListItemResponse {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly country: string;
  readonly jobLevel: string | null;
  readonly accrualMethod: LeavePolicyAccrualMethod;
  readonly accrualStart: LeavePolicyAccrualStart;
  readonly prorationMethod: LeavePolicyProrationMethod;
  readonly approvalMode: LeavePolicyApprovalMode;
  readonly effectiveFrom: string;
  readonly version: number;
  readonly isActive: boolean;
  readonly leaveTypes: readonly LeavePolicyLeaveTypeRuleResponse[];
  readonly legalEntities: readonly LeavePolicyLegalEntityAssignmentResponse[];
  readonly createdAt: string;
}

export interface LeavePolicyResponse extends LeavePolicyListItemResponse {
  readonly accrualAfterNMonths: number | null;
  readonly probationRestriction: boolean;
  readonly minimumTenureMonths: number;
  readonly firstYearReducedPercent: number | null;
  readonly minimumNoticeDays: number;
  readonly maxConsecutiveDays: number | null;
  readonly minDaysPerRequest: number;
  readonly maxTeamAbsencePercent: number | null;
  readonly blackoutPeriods: readonly LeavePolicyBlackoutPeriodResponse[];
  readonly updatedAt: string | null;
}

export interface CreateLeavePolicyTypeRuleRequest {
  leaveTypeId: string;
  annualEntitlementDays: number;
  monthlyAccrualDays: number | null;
  carryForwardMaxDays: number | null;
  carryForwardExpiryMonths: number | null;
}

export interface CreateLeavePolicyBlackoutPeriodRequest {
  startDate: string;
  endDate: string;
  reason: string | null;
}

export interface CreateLeavePolicyRequest {
  name: string;
  description: string | null;
  country: string;
  jobLevel: string | null;
  accrualMethod: LeavePolicyAccrualMethod;
  accrualStart: LeavePolicyAccrualStart;
  accrualAfterNMonths: number | null;
  prorationMethod: LeavePolicyProrationMethod;
  probationRestriction: boolean;
  minimumTenureMonths: number;
  firstYearReducedPercent: number | null;
  minimumNoticeDays: number;
  maxConsecutiveDays: number | null;
  minDaysPerRequest: number;
  maxTeamAbsencePercent: number | null;
  approvalMode: LeavePolicyApprovalMode;
  effectiveFrom: string;
  leaveTypes: CreateLeavePolicyTypeRuleRequest[];
  blackoutPeriods: CreateLeavePolicyBlackoutPeriodRequest[];
  legalEntityIds: string[];
  confirmReplaceExistingLegalEntityAssignments: boolean;
}

export interface CloneLeavePolicyRequest {
  name: string;
  country: string;
  legalEntityIds: string[];
  effectiveFrom: string;
  confirmReplaceExistingLegalEntityAssignments: boolean;
}

export type LeavePolicyFormDraft = Omit<CreateLeavePolicyRequest, 'confirmReplaceExistingLegalEntityAssignments'>;

export const LEAVE_POLICY_ACCRUAL_METHOD_OPTIONS: readonly { value: LeavePolicyAccrualMethod; label: string }[] = [
  { value: 'annual', label: 'Annual' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' }
];

export const LEAVE_POLICY_ACCRUAL_START_OPTIONS: readonly { value: LeavePolicyAccrualStart; label: string }[] = [
  { value: 'immediately', label: 'Immediately' },
  { value: 'after_probation', label: 'After probation' },
  { value: 'after_n_months', label: 'After N months' }
];

export const LEAVE_POLICY_PRORATION_OPTIONS: readonly { value: LeavePolicyProrationMethod; label: string }[] = [
  { value: 'calendar_days', label: 'Calendar days' },
  { value: 'working_days', label: 'Working days' }
];

export const LEAVE_POLICY_APPROVAL_MODE_OPTIONS: readonly { value: LeavePolicyApprovalMode; label: string }[] = [
  { value: 'any_one', label: 'Any one approver' },
  { value: 'all_must_approve', label: 'All approvers' },
  { value: 'in_order', label: 'In order' }
];
```

- [ ] **Step 4: Add the mapper implementation**

Create `src/app/modules/leave/utils/leave-policy-form.mapper.ts`:

```ts
import {
  CreateLeavePolicyRequest,
  LeavePolicyFormDraft
} from '../models/leave-policy.model';

export function createEmptyLeavePolicyFormDraft(): LeavePolicyFormDraft {
  return {
    name: '',
    description: null,
    country: '',
    jobLevel: null,
    accrualMethod: 'annual',
    accrualStart: 'immediately',
    accrualAfterNMonths: null,
    prorationMethod: 'calendar_days',
    probationRestriction: false,
    minimumTenureMonths: 0,
    firstYearReducedPercent: null,
    minimumNoticeDays: 0,
    maxConsecutiveDays: null,
    minDaysPerRequest: 0.5,
    maxTeamAbsencePercent: null,
    approvalMode: 'any_one',
    effectiveFrom: '',
    leaveTypes: [],
    blackoutPeriods: [],
    legalEntityIds: []
  };
}

export function validateLeavePolicyFormDraft(draft: LeavePolicyFormDraft): readonly string[] {
  const errors: string[] = [];

  if (!draft.name.trim()) errors.push('Policy name is required.');
  if (!draft.country.trim()) errors.push('Country is required.');
  if (!draft.effectiveFrom.trim()) errors.push('Effective date is required.');
  if (draft.leaveTypes.length === 0) errors.push('Add at least one leave type rule.');
  if (draft.legalEntityIds.length === 0) errors.push('Select at least one legal entity.');
  if (draft.accrualStart === 'after_n_months' && (!draft.accrualAfterNMonths || draft.accrualAfterNMonths < 1)) {
    errors.push('Enter the number of months before accrual starts.');
  }

  for (const rule of draft.leaveTypes) {
    if (!rule.leaveTypeId) errors.push('Each leave type rule needs a leave type.');
    if (rule.annualEntitlementDays <= 0) errors.push('Annual entitlement days must be greater than 0.');
    if (rule.monthlyAccrualDays !== null && rule.monthlyAccrualDays < 0) {
      errors.push('Monthly accrual days cannot be negative.');
    }
  }

  for (const blackout of draft.blackoutPeriods) {
    if (!blackout.startDate || !blackout.endDate) errors.push('Each blackout period needs a start and end date.');
    if (blackout.startDate && blackout.endDate && blackout.endDate < blackout.startDate) {
      errors.push('Blackout period end date must be on or after start date.');
    }
  }

  return [...new Set(errors)];
}

export function toCreateLeavePolicyRequest(
  draft: LeavePolicyFormDraft,
  confirmReplaceExistingLegalEntityAssignments: boolean
): CreateLeavePolicyRequest {
  return {
    ...draft,
    name: draft.name.trim(),
    description: emptyToNull(draft.description),
    country: draft.country.trim().toUpperCase(),
    jobLevel: emptyToNull(draft.jobLevel),
    blackoutPeriods: draft.blackoutPeriods.map((period) => ({
      startDate: period.startDate,
      endDate: period.endDate,
      reason: emptyToNull(period.reason)
    })),
    confirmReplaceExistingLegalEntityAssignments
  };
}

function emptyToNull(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
```

- [ ] **Step 5: Run mapper tests to verify GREEN**

Run: `npx ng test --include src/app/modules/leave/utils/leave-policy-form.mapper.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/leave/models/leave-policy.model.ts src/app/modules/leave/utils/leave-policy-form.mapper.ts src/app/modules/leave/utils/leave-policy-form.mapper.spec.ts
git commit -m "feat(leave): add leave policy form model"
```

---

### Task 2: Leave Policy API Service

**Files:**
- Create: `src/app/modules/leave/data-access/leave-policy-api.service.ts`
- Test: `src/app/modules/leave/data-access/leave-policy-api.service.spec.ts`

**Interfaces:**
- Consumes: model types from Task 1.
- Produces:
  - `list(): Observable<readonly LeavePolicyListItemResponse[]>`
  - `get(policyId: string): Observable<LeavePolicyResponse>`
  - `create(payload: CreateLeavePolicyRequest): Observable<LeavePolicyResponse>`
  - `clone(policyId: string, payload: CloneLeavePolicyRequest): Observable<LeavePolicyResponse>`

- [ ] **Step 1: Write failing API service tests**

Create `src/app/modules/leave/data-access/leave-policy-api.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeavePolicyApiService } from './leave-policy-api.service';
import { CreateLeavePolicyRequest } from '../models/leave-policy.model';

describe('LeavePolicyApiService', () => {
  let service: LeavePolicyApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(LeavePolicyApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists policies from the backend route', () => {
    service.list().subscribe((items) => expect(items.length).toBe(1));

    const req = http.expectOne(`${environment.apiUrl}/leave/policies`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'p1', name: 'Policy', leaveTypes: [], legalEntities: [] }]);
  });

  it('creates policies with the exact payload provided by the form mapper', () => {
    const payload: CreateLeavePolicyRequest = {
      name: 'Policy',
      description: null,
      country: 'LK',
      jobLevel: null,
      accrualMethod: 'annual',
      accrualStart: 'immediately',
      accrualAfterNMonths: null,
      prorationMethod: 'calendar_days',
      probationRestriction: false,
      minimumTenureMonths: 0,
      firstYearReducedPercent: null,
      minimumNoticeDays: 7,
      maxConsecutiveDays: null,
      minDaysPerRequest: 0.5,
      maxTeamAbsencePercent: null,
      approvalMode: 'any_one',
      effectiveFrom: '2026-01-01',
      leaveTypes: [],
      blackoutPeriods: [],
      legalEntityIds: ['le1'],
      confirmReplaceExistingLegalEntityAssignments: false
    };

    service.create(payload).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/leave/policies`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'p1', ...payload, version: 1, isActive: true, legalEntities: [], createdAt: '2026-01-01T00:00:00Z' });
  });

  it('clones a policy through the policy-specific clone route', () => {
    const payload = {
      name: 'Cloned policy',
      country: 'LK',
      legalEntityIds: ['le1'],
      effectiveFrom: '2026-02-01',
      confirmReplaceExistingLegalEntityAssignments: false
    };

    service.clone('p1', payload).subscribe();

    const req = http.expectOne(`${environment.apiUrl}/leave/policies/p1/clone`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'p2', name: 'Cloned policy', leaveTypes: [], legalEntities: [] });
  });
});
```

- [ ] **Step 2: Run API tests to verify RED**

Run: `npx ng test --include src/app/modules/leave/data-access/leave-policy-api.service.spec.ts`

Expected: FAIL because `LeavePolicyApiService` does not exist.

- [ ] **Step 3: Add the API service**

Create `src/app/modules/leave/data-access/leave-policy-api.service.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CloneLeavePolicyRequest,
  CreateLeavePolicyRequest,
  LeavePolicyListItemResponse,
  LeavePolicyResponse
} from '../models/leave-policy.model';

@Injectable({ providedIn: 'root' })
export class LeavePolicyApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/leave/policies`;

  list(): Observable<readonly LeavePolicyListItemResponse[]> {
    return this.http.get<readonly LeavePolicyListItemResponse[]>(this.baseUrl);
  }

  get(policyId: string): Observable<LeavePolicyResponse> {
    return this.http.get<LeavePolicyResponse>(`${this.baseUrl}/${policyId}`);
  }

  create(payload: CreateLeavePolicyRequest): Observable<LeavePolicyResponse> {
    return this.http.post<LeavePolicyResponse>(this.baseUrl, payload);
  }

  clone(policyId: string, payload: CloneLeavePolicyRequest): Observable<LeavePolicyResponse> {
    return this.http.post<LeavePolicyResponse>(`${this.baseUrl}/${policyId}/clone`, payload);
  }
}
```

- [ ] **Step 4: Run API tests to verify GREEN**

Run: `npx ng test --include src/app/modules/leave/data-access/leave-policy-api.service.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/data-access/leave-policy-api.service.ts src/app/modules/leave/data-access/leave-policy-api.service.spec.ts
git commit -m "feat(leave): add leave policy api service"
```

---

### Task 3: Leave Policy Signal Store

**Files:**
- Create: `src/app/modules/leave/state/leave-policy.store.ts`
- Test: `src/app/modules/leave/state/leave-policy.store.spec.ts`

**Interfaces:**
- Consumes: `LeavePolicyApiService` from Task 2.
- Produces:
  - `items`, `selectedPolicy`, `loading`, `loadError`, `saving`, `actionError`, `replacementConfirmationMessage`
  - `loadPolicies(): Promise<void>`
  - `loadPolicy(policyId: string): Promise<void>`
  - `createPolicy(payload: CreateLeavePolicyRequest): Promise<'created' | 'confirm-replace' | 'failed'>`
  - `clonePolicy(policyId: string, payload: CloneLeavePolicyRequest): Promise<'created' | 'confirm-replace' | 'failed'>`
  - `clearReplacementConfirmation(): void`

- [ ] **Step 1: Write failing store tests**

Create `src/app/modules/leave/state/leave-policy.store.spec.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LeavePolicyApiService } from '../data-access/leave-policy-api.service';
import { CreateLeavePolicyRequest } from '../models/leave-policy.model';
import { LeavePolicyStore } from './leave-policy.store';

function payload(confirmReplaceExistingLegalEntityAssignments = false): CreateLeavePolicyRequest {
  return {
    name: 'Policy',
    description: null,
    country: 'LK',
    jobLevel: null,
    accrualMethod: 'annual',
    accrualStart: 'immediately',
    accrualAfterNMonths: null,
    prorationMethod: 'calendar_days',
    probationRestriction: false,
    minimumTenureMonths: 0,
    firstYearReducedPercent: null,
    minimumNoticeDays: 7,
    maxConsecutiveDays: null,
    minDaysPerRequest: 0.5,
    maxTeamAbsencePercent: null,
    approvalMode: 'any_one',
    effectiveFrom: '2026-01-01',
    leaveTypes: [],
    blackoutPeriods: [],
    legalEntityIds: ['le1'],
    confirmReplaceExistingLegalEntityAssignments
  };
}

describe('LeavePolicyStore', () => {
  let api: jasmine.SpyObj<LeavePolicyApiService>;
  let store: InstanceType<typeof LeavePolicyStore>;

  beforeEach(() => {
    api = jasmine.createSpyObj<LeavePolicyApiService>('LeavePolicyApiService', ['list', 'get', 'create', 'clone']);
    TestBed.configureTestingModule({
      providers: [{ provide: LeavePolicyApiService, useValue: api }]
    });
    store = TestBed.inject(LeavePolicyStore);
  });

  it('loads policies into items and clears load errors', async () => {
    api.list.and.returnValue(of([{ id: 'p1', name: 'Policy', leaveTypes: [], legalEntities: [] } as any]));

    await store.loadPolicies();

    expect(store.items().map((p) => p.id)).toEqual(['p1']);
    expect(store.loadError()).toBeNull();
    expect(store.loading()).toBeFalse();
  });

  it('returns confirm-replace and stores the conflict message on 409 create', async () => {
    api.create.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Legal Entity Acme already has an active policy. Activating this policy will replace it. Continue?' } }))
    );

    const result = await store.createPolicy(payload(false));

    expect(result).toBe('confirm-replace');
    expect(store.replacementConfirmationMessage()).toContain('already has an active policy');
    expect(store.saving()).toBeFalse();
  });

  it('adds created policy to the top of the list after successful create', async () => {
    api.create.and.returnValue(of({ id: 'p2', name: 'Policy', leaveTypes: [], legalEntities: [] } as any));

    const result = await store.createPolicy(payload(true));

    expect(result).toBe('created');
    expect(store.items()[0].id).toBe('p2');
    expect(api.create).toHaveBeenCalledWith(payload(true));
  });
});
```

- [ ] **Step 2: Run store tests to verify RED**

Run: `npx ng test --include src/app/modules/leave/state/leave-policy.store.spec.ts`

Expected: FAIL because `LeavePolicyStore` does not exist.

- [ ] **Step 3: Add the store implementation**

Create `src/app/modules/leave/state/leave-policy.store.ts`:

```ts
import { computed, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeavePolicyApiService } from '../data-access/leave-policy-api.service';
import {
  CloneLeavePolicyRequest,
  CreateLeavePolicyRequest,
  LeavePolicyListItemResponse,
  LeavePolicyResponse
} from '../models/leave-policy.model';

interface LeavePolicyState {
  readonly items: readonly LeavePolicyListItemResponse[];
  readonly selectedPolicy: LeavePolicyResponse | null;
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly saving: boolean;
  readonly actionError: string | null;
  readonly replacementConfirmationMessage: string | null;
}

type SaveOutcome = 'created' | 'confirm-replace' | 'failed';

export const LeavePolicyStore = signalStore(
  { providedIn: 'root' },
  withState<LeavePolicyState>({
    items: [],
    selectedPolicy: null,
    loading: false,
    loadError: null,
    saving: false,
    actionError: null,
    replacementConfirmationMessage: null
  }),
  withComputed(({ items }) => ({
    activeItems: computed(() => items().filter((policy) => policy.isActive))
  })),
  withMethods((store, api = inject(LeavePolicyApiService)) => ({
    async loadPolicies(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const items = await firstValueFrom(api.list());
        patchState(store, { items, loading: false });
      } catch (err: unknown) {
        patchState(store, {
          loading: false,
          loadError: toSafeErrorMessage(err, 'Failed to load leave policies.')
        });
      }
    },

    async loadPolicy(policyId: string): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const selectedPolicy = await firstValueFrom(api.get(policyId));
        patchState(store, { selectedPolicy, loading: false });
      } catch (err: unknown) {
        patchState(store, {
          loading: false,
          loadError: toSafeErrorMessage(err, 'Failed to load leave policy details.')
        });
      }
    },

    async createPolicy(payload: CreateLeavePolicyRequest): Promise<SaveOutcome> {
      patchState(store, { saving: true, actionError: null, replacementConfirmationMessage: null });
      try {
        const created = await firstValueFrom(api.create(payload));
        patchState(store, {
          saving: false,
          selectedPolicy: created,
          items: [created, ...store.items().filter((policy) => policy.id !== created.id)]
        });
        return 'created';
      } catch (err: unknown) {
        return handleSaveError(store, err, 'Failed to create leave policy.');
      }
    },

    async clonePolicy(policyId: string, payload: CloneLeavePolicyRequest): Promise<SaveOutcome> {
      patchState(store, { saving: true, actionError: null, replacementConfirmationMessage: null });
      try {
        const created = await firstValueFrom(api.clone(policyId, payload));
        patchState(store, {
          saving: false,
          selectedPolicy: created,
          items: [created, ...store.items().filter((policy) => policy.id !== created.id)]
        });
        return 'created';
      } catch (err: unknown) {
        return handleSaveError(store, err, 'Failed to clone leave policy.');
      }
    },

    clearReplacementConfirmation(): void {
      patchState(store, { replacementConfirmationMessage: null });
    }
  }))
);

function handleSaveError(store: any, err: unknown, fallback: string): SaveOutcome {
  const message = toSafeErrorMessage(err, fallback);
  if (err instanceof HttpErrorResponse && err.status === 409) {
    patchState(store, { saving: false, replacementConfirmationMessage: message, actionError: null });
    return 'confirm-replace';
  }

  patchState(store, { saving: false, actionError: message });
  return 'failed';
}
```

- [ ] **Step 4: Run store tests to verify GREEN**

Run: `npx ng test --include src/app/modules/leave/state/leave-policy.store.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/state/leave-policy.store.ts src/app/modules/leave/state/leave-policy.store.spec.ts
git commit -m "feat(leave): add leave policy store"
```

---

### Task 4: Policy List And Detail UI

**Files:**
- Create: `src/app/modules/leave/ui/leave-policy-list-table/leave-policy-list-table.component.ts`
- Create: `src/app/modules/leave/ui/leave-policy-list-table/leave-policy-list-table.component.spec.ts`
- Create: `src/app/modules/leave/ui/leave-policy-list-table/leave-policy-list-table.component.css`
- Create: `src/app/modules/leave/ui/leave-policy-detail-panel/leave-policy-detail-panel.component.ts`
- Create: `src/app/modules/leave/ui/leave-policy-detail-panel/leave-policy-detail-panel.component.spec.ts`
- Create: `src/app/modules/leave/ui/leave-policy-detail-panel/leave-policy-detail-panel.component.css`

**Interfaces:**
- Consumes: policy response types from Task 1.
- Produces:
  - `LeavePolicyListTableComponent` with `@Input() policies`, `@Output() viewPolicy`, `@Output() clonePolicy`
  - `LeavePolicyDetailPanelComponent` with `@Input() policy`

- [ ] **Step 1: Write failing UI tests**

Create specs that assert:

```ts
it('renders policy name, legal entities, and leave type chips', () => {
  const fixture = TestBed.createComponent(LeavePolicyListTableComponent);
  fixture.componentInstance.policies = [
    {
      id: 'p1',
      name: 'Annual policy',
      description: null,
      country: 'LK',
      jobLevel: null,
      accrualMethod: 'annual',
      accrualStart: 'immediately',
      prorationMethod: 'calendar_days',
      approvalMode: 'any_one',
      effectiveFrom: '2026-01-01',
      version: 1,
      isActive: true,
      leaveTypes: [{ id: 'r1', leaveTypeId: 'lt1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'AL', annualEntitlementDays: 14, monthlyAccrualDays: null, carryForwardMaxDays: null, carryForwardExpiryMonths: null }],
      legalEntities: [{ id: 'a1', legalEntityId: 'le1', legalEntityName: 'Dapi Technologies', effectiveDate: '2026-01-01', isActive: true }],
      createdAt: '2026-01-01T00:00:00Z'
    }
  ];

  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('Annual policy');
  expect(fixture.nativeElement.textContent).toContain('Dapi Technologies');
  expect(fixture.nativeElement.textContent).toContain('Annual Leave');
});
```

- [ ] **Step 2: Run UI tests to verify RED**

Run:

```bash
npx ng test --include src/app/modules/leave/ui/leave-policy-list-table/leave-policy-list-table.component.spec.ts --include src/app/modules/leave/ui/leave-policy-detail-panel/leave-policy-detail-panel.component.spec.ts
```

Expected: FAIL because the components do not exist.

- [ ] **Step 3: Add UI components**

Implement standalone components with these key controls:

- `LeavePolicyListTableComponent`: table headers `Policy`, `Leave types`, `Legal entities`, `Rules`, `Effective`, `Status`, `Actions`; icon-only view/clone buttons with `title` and `aria-label`.
- `LeavePolicyDetailPanelComponent`: compact read-only detail section with policy metadata, type rules, legal entities, blackout periods, and request rules.

Keep cards at `border-radius: 8px`; keep font sizes compact and table-friendly; do not introduce decorative gradients, hero layout, or a second tab row. Section switching is handled by the inner Time Off sidebar.

- [ ] **Step 4: Run UI tests to verify GREEN**

Run:

```bash
npx ng test --include src/app/modules/leave/ui/leave-policy-list-table/leave-policy-list-table.component.spec.ts --include src/app/modules/leave/ui/leave-policy-detail-panel/leave-policy-detail-panel.component.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/ui/leave-policy-list-table src/app/modules/leave/ui/leave-policy-detail-panel
git commit -m "feat(leave): add leave policy list UI"
```

---

### Task 5: Seven-Step Policy Wizard

**Files:**
- Create: `src/app/modules/leave/ui/leave-policy-form-wizard/leave-policy-form-wizard.component.ts`
- Create: `src/app/modules/leave/ui/leave-policy-form-wizard/leave-policy-form-wizard.component.html`
- Create: `src/app/modules/leave/ui/leave-policy-form-wizard/leave-policy-form-wizard.component.css`
- Test: `src/app/modules/leave/ui/leave-policy-form-wizard/leave-policy-form-wizard.component.spec.ts`

**Interfaces:**
- Consumes: `LeavePolicyFormDraft`, mapper functions from Task 1, `LeaveTypeResponse` from Part 1, `LegalEntityListItem` from Organization.
- Produces:
  - `@Input() leaveTypes: readonly LeaveTypeResponse[]`
  - `@Input() legalEntities: readonly LegalEntityListItem[]`
  - `@Input() saving: boolean`
  - `@Output() save = new EventEmitter<LeavePolicyFormDraft>()`
  - `@Output() cancel = new EventEmitter<void>()`

- [ ] **Step 1: Write failing wizard tests**

Create tests asserting:

```ts
it('does not emit save while required business values are blank', () => {
  const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
  spyOn(fixture.componentInstance.save, 'emit');

  fixture.detectChanges();
  fixture.componentInstance.submit();

  expect(fixture.componentInstance.save.emit).not.toHaveBeenCalled();
  expect(fixture.nativeElement.textContent).toContain('Country is required.');
});

it('emits a draft after the user enters policy, rule, blackout, and legal entity values', () => {
  const fixture = TestBed.createComponent(LeavePolicyFormWizardComponent);
  fixture.componentInstance.leaveTypes = [{ id: 'lt1', name: 'Annual Leave', code: 'AL', category: 'annual', isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null, acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 14, carryForwardAllowed: true, maxCarryForwardDays: null, carryForwardExpiryMonths: null, proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 7, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null }];
  fixture.componentInstance.legalEntities = [{ id: 'le1', name: 'Dapi Technologies', companyCode: 'DAPI', logoFileId: null, isActive: true, isPrimary: true }];
  spyOn(fixture.componentInstance.save, 'emit');

  fixture.detectChanges();
  fixture.componentInstance.patchDraftForTest({
    name: 'Annual policy',
    country: 'LK',
    effectiveFrom: '2026-01-01',
    leaveTypes: [{ leaveTypeId: 'lt1', annualEntitlementDays: 14, monthlyAccrualDays: null, carryForwardMaxDays: 5, carryForwardExpiryMonths: 3 }],
    legalEntityIds: ['le1']
  });
  fixture.componentInstance.submit();

  expect(fixture.componentInstance.save.emit).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run wizard tests to verify RED**

Run: `npx ng test --include src/app/modules/leave/ui/leave-policy-form-wizard/leave-policy-form-wizard.component.spec.ts`

Expected: FAIL because the wizard component does not exist.

- [ ] **Step 3: Implement the wizard**

Build the wizard with seven visible steps:

1. Policy details: name, description, country code, job level, effective date.
2. Leave type rules: select active leave type, annual entitlement, monthly accrual, carry-forward max, carry-forward expiry, add/remove rule.
3. Accrual: accrual method, accrual start, after-N-months value when needed, proration.
4. Eligibility: probation restriction, minimum tenure, first-year reduced percent.
5. Request rules: minimum notice days, max consecutive days, min days per request, max team absence percent, approval mode.
6. Blackout periods: start date, end date, reason, add/remove period.
7. Legal entities and review: multi-select legal entities plus a summary of all chosen values.

The component owns a `LeavePolicyFormDraft` signal and a `validationErrors` signal. Numeric inputs convert blank strings to `null` for nullable fields. `submit()` calls `validateLeavePolicyFormDraft`; it emits only when no errors remain. Add `patchDraftForTest(partial: Partial<LeavePolicyFormDraft>): void` as a public method used only by the spec; it must merge arrays by replacement.

- [ ] **Step 4: Run wizard tests to verify GREEN**

Run: `npx ng test --include src/app/modules/leave/ui/leave-policy-form-wizard/leave-policy-form-wizard.component.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/ui/leave-policy-form-wizard
git commit -m "feat(leave): add leave policy wizard"
```

---

### Task 6: Policy Management Page

**Files:**
- Create: `src/app/modules/leave/feature/policy-management/policy-management.component.ts`
- Create: `src/app/modules/leave/feature/policy-management/policy-management.component.html`
- Create: `src/app/modules/leave/feature/policy-management/policy-management.component.css`
- Test: `src/app/modules/leave/feature/policy-management/policy-management.component.spec.ts`
- Modify: `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts`

**Interfaces:**
- Consumes: `LeavePolicyStore`, `LeaveTypeStore`, `LegalEntityApiService`, UI components from Tasks 4-5.
- Produces: a route-ready `PolicyManagementComponent`.

- [ ] **Step 1: Write failing feature tests**

Create tests asserting:

```ts
it('loads policies, leave types, and legal entities on init for manage users', async () => {
  const fixture = TestBed.createComponent(PolicyManagementComponent);
  const component = fixture.componentInstance;

  fixture.detectChanges();
  await fixture.whenStable();

  expect(component.policyStore.loadPolicies).toHaveBeenCalled();
  expect(component.leaveTypeStore.load).toHaveBeenCalled();
  expect(component.legalEntityApi.getLegalEntities).toHaveBeenCalledWith(false);
});

it('shows replace confirmation when the store returns confirm-replace', async () => {
  const fixture = TestBed.createComponent(PolicyManagementComponent);
  fixture.componentInstance.policyStore.createPolicy.and.resolveTo('confirm-replace');
  fixture.componentInstance.policyStore.replacementConfirmationMessage.and.returnValue('Legal Entity Dapi already has an active policy. Activating this policy will replace it. Continue?');

  await fixture.componentInstance.onSavePolicy(createMinimalDraftForTest());

  expect(fixture.componentInstance.replaceConfirmOpen()).toBeTrue();
});
```

Use fakes for `LeavePolicyStore`, `LeaveTypeStore`, `LegalEntityApiService`, `PermissionService`, and `NotificationService`; do not hit HTTP in this component spec.

- [ ] **Step 2: Run feature tests to verify RED**

Run: `npx ng test --include src/app/modules/leave/feature/policy-management/policy-management.component.spec.ts`

Expected: FAIL because `PolicyManagementComponent` does not exist.

- [ ] **Step 3: Implement the feature page**

`PolicyManagementComponent` must:

- inject `PermissionService`, `NotificationService`, `LeavePolicyStore`, `LeaveTypeStore`, `LegalEntityApiService`;
- expose `hasManageAccess = computed(() => permissionService.hasPermission('leave:manage'))`;
- load policies, leave types, and active legal entities when manage access is available;
- render `LeavePolicyListTableComponent`;
- open/close `LeavePolicyFormWizardComponent`;
- call `toCreateLeavePolicyRequest(draft, false)` on first save;
- when store returns `confirm-replace`, show a compact confirmation modal with the store conflict message;
- on confirm, resubmit the same draft via `toCreateLeavePolicyRequest(draft, true)`;
- on success, close the wizard, clear confirmation, show `Leave policy '<name>' created successfully.`, and reload policies.

Modify the Part 1 `TimeOffShellComponent` to append only the `Leave Policies` item to the inner sidebar:

```ts
readonly menuItems = [
  { label: 'Leave Types', route: '/time-off/types' },
  { label: 'Leave Policies', route: '/time-off/policies' }
] as const;
```

Do not add `Entitlements`, `Requests`, `Approvals`, `Team Calendar`, `Balances`, or `Audit & Year End` in this phase. If `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts` is missing, stop execution and complete Frontend Part 1 first.

- [ ] **Step 4: Run feature tests to verify GREEN**

Run: `npx ng test --include src/app/modules/leave/feature/policy-management/policy-management.component.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/policy-management src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts
git commit -m "feat(leave): add policy management page"
```

---

### Task 7: Routes, Documentation, And Verification

**Files:**
- Modify: `src/app/modules/leave/leave.routes.ts`
- Modify: `src/app/modules/leave/leave.routes.spec.ts`
- Modify: `docs/superpowers/plans/next/2026-08-21-leave-management/SUMMARY.md`
- Modify: `docs/superpowers/plans/next/SUMMARY.md`
- Modify: `docs/superpowers/plans/SUMMARY.md`

**Interfaces:**
- Consumes: `PolicyManagementComponent` from Task 6.
- Produces: `/time-off/policies` route, docs status sync.

- [ ] **Step 1: Write failing route test**

Append to `src/app/modules/leave/leave.routes.spec.ts`:

```ts
it('routes policies to the policy management page with leave manage permission', () => {
  const shellRoute = LEAVE_ROUTES.find((r) => r.path === '');
  const route = shellRoute?.children?.find((r) => r.path === 'policies');

  expect(route?.data).toEqual({ title: 'Leave Policies', permissions: ['leave:manage'] });
  expect(route?.canActivate).toContain(permissionGuard);
});
```

- [ ] **Step 2: Run route test to verify RED**

Run: `npx ng test --include src/app/modules/leave/leave.routes.spec.ts`

Expected: FAIL because the `policies` route is absent.

- [ ] **Step 3: Add the policies route**

Modify `src/app/modules/leave/leave.routes.ts` by adding this child route inside the Part 1 shell route's `children` array:

```ts
{
  path: 'policies',
  canActivate: [permissionGuard],
  data: { title: 'Leave Policies', permissions: ['leave:manage'] },
  loadComponent: () =>
    import('./feature/policy-management/policy-management.component').then((m) => m.PolicyManagementComponent)
}
```

Keep the existing default redirect from Part 1 unchanged. Do not modify `nav-items.config.ts` in this task.

- [ ] **Step 4: Update docs summaries**

In `docs/superpowers/plans/next/2026-08-21-leave-management/SUMMARY.md`, change the opening sentence to say Phase 1 and Phase 2 are written in full. Change Phase 2 status to:

```md
**Status:** written in full, see `part-2-leave-policies-frontend.md`.
```

In `docs/superpowers/plans/next/SUMMARY.md` and `docs/superpowers/plans/SUMMARY.md`, update the Leave Management row from "Phase 1 written in full" to "Phases 1-2 written in full".

- [ ] **Step 5: Run route tests and focused Leave tests**

Run:

```bash
npx ng test --include src/app/modules/leave/**/*.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 7: Manual browser smoke**

Start frontend and backend together:

```bash
npm start
```

Log in as an HR manager with `leave:manage`. Visit `/time-off/policies`. Confirm:

- list page loads without the placeholder;
- policy wizard opens;
- no country, entitlement, legal entity, carry-forward, or blackout values are prefilled as business defaults;
- selecting leave type, legal entity, and policy rules enables save;
- a 409 replacement conflict displays a confirmation modal and resubmits with confirmation;
- the inner Time Off sidebar matches the People module pattern and shows exactly `Leave Types` and `Leave Policies`;
- `/time-off/types` and `/time-off/policies` are reachable through that inner sidebar;
- the top-level Time Off sidebar item remains visible for a non-HR employee with only the `leave` module.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/leave/leave.routes.ts src/app/modules/leave/leave.routes.spec.ts docs/superpowers/plans/next/2026-08-21-leave-management/SUMMARY.md docs/superpowers/plans/next/SUMMARY.md docs/superpowers/plans/SUMMARY.md
git commit -m "feat(leave): wire leave policies route"
```

---

## Self-Review

- Spec coverage: Phase 2 route, real backend calls, 7-step policy wizard, multi-type rules, blackout periods, legal entity assignment, and replace-confirmation are covered by Tasks 1-7.
- No-hardcoded-values guard: Task 1 tests require blank business values; Task 7 manual smoke repeats the check.
- Nav hazard coverage: Global Constraints and Task 7 explicitly avoid main-sidebar children in this phase, while the inner Time Off sidebar shows only routes built so far.
- Known dependency: this plan depends on Frontend Part 1 execution because the policy wizard needs Leave Types and the leave route module.
