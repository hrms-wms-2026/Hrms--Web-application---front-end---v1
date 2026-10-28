# Bulk Employee Onboarding (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Settings sub-page where HR uploads a CSV, maps columns with a live row-1 preview, sees partial-success validation results, reviews the resulting onboarding drafts, and bulk-finalizes selected ones — polling the two background-processed steps.

**Architecture:** One NgRx Signal Store (`bulk-onboarding.store.ts`) drives a single step-gated feature component through the backend's six endpoints (upload, preview, validate, create-drafts, get-status, finalize). Physically lives in `modules/people/` (co-located with the onboarding-draft code it depends on) but routes under `/settings/bulk-onboarding`, matching how `general-settings` already lives in `modules/organization/` while routing under `/settings/`.

**Tech Stack:** Angular 21 standalone components, NgRx Signal Store, RxJS `HttpClient` (existing stack, no new packages).

**Depends on:** the backend plan (`HRMS-Backend-v1/docs/superpowers/plans/finished/2026-08-18/2026-08-18-bulk-employee-onboarding-backend.md`) must be implemented first — every task below calls a real endpoint from it.

**Spec:** `docs/superpowers/specs/finished/2026-08-18/2026-08-18-bulk-employee-onboarding-frontend-design.md`

## Global Constraints

- CSV only — no `.xlsx` file picker option (spec §2).
- No Reporting Manager field anywhere in the UI (spec §2 — corrected during backend planning: `Employee`/`onboarding_drafts` have no such column at all).
- Route: `/settings/bulk-onboarding`, physical home: `modules/people/feature/bulk-onboarding/`.
- Permission gate: `employees:write` (landing action is upload, not read), `requiredModules: ['core_hr']` on the nav entry for consistency with sibling `core_hr`-gated nav items.
- Bulk-created drafts reuse `DRAFT_STATUS_LABELS`/`DRAFT_REASON_LABELS` from the existing `onboarding-draft.model.ts` — no new status copy invented.
- State management: NgRx Signal Store, no `BehaviorSubject`, component-local UI state via `signal()`.

---

## Task 1: Bulk onboarding model types

**Files:**
- Create: `src/app/modules/people/models/bulk-onboarding.model.ts`
- Test: none (pure type declarations — covered indirectly by every later task's tests)

**Interfaces:**
- Produces every type later tasks import: `BulkOnboardingBatchResponse`, `BulkOnboardingBatchDetailResponse`, `BulkOnboardingBatchRowDetail`, `RowPreviewResponse`, `ValidateBulkOnboardingBatchResponse`, `RowValidationResultItem`, `BulkOnboardingColumnMapping`, `UploadBulkOnboardingBatchPayload`, `BulkOnboardingBatchStatus` (union type), `BulkOnboardingRowStatus` (union type).

- [ ] **Step 1: Write the model file**

```typescript
// src/app/modules/people/models/bulk-onboarding.model.ts
/**
 * Matches backend Contracts (HRMS-Backend-v1 src/ONEVO.Api/Contracts/CoreHr/BulkOnboarding/*).
 * See docs/superpowers/specs/finished/2026-08-18/2026-08-18-bulk-employee-onboarding-frontend-design.md.
 */

export type BulkOnboardingBatchStatus =
  | 'mapping_pending'
  | 'validated'
  | 'draft_creation_pending'
  | 'drafts_created'
  | 'finalize_pending'
  | 'finalize_completed';

export type BulkOnboardingRowStatus =
  | 'pending_mapping'
  | 'valid'
  | 'invalid'
  | 'draft_created'
  | 'draft_failed'
  | 'finalized'
  | 'waiting_for_seat'
  | 'waiting_for_position_approval'
  | 'finalize_failed';

/** System field ids the mapping UI offers - keys of BulkOnboardingColumnMapping. */
export type BulkOnboardingSystemField =
  | 'firstName' | 'lastName' | 'workEmail' | 'startDate' | 'employmentType'
  | 'workMode' | 'department' | 'position' | 'checklistTemplate' | 'employeeNumber';

export type BulkOnboardingColumnMapping = Partial<Record<BulkOnboardingSystemField, string | null>>;

export interface UploadBulkOnboardingBatchPayload {
  file: File;
  legalEntityId: string;
  defaultWorkModeId: number | null;
  defaultEmploymentType: string | null;
  defaultChecklistTemplateId: string | null;
}

export interface BulkOnboardingBatchResponse {
  readonly id: string;
  readonly status: BulkOnboardingBatchStatus;
  readonly totalRows: number;
  readonly validRows: number | null;
  readonly invalidRows: number | null;
  readonly detectedColumns: readonly string[];
  readonly suggestedMapping: BulkOnboardingColumnMapping;
}

export interface RowPreviewResponse {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly workEmail: string | null;
  readonly startDate: string | null;
  readonly employmentType: string | null;
  readonly workModeName: string | null;
  readonly departmentName: string | null;
  readonly positionName: string | null;
  readonly checklistTemplateName: string | null;
  readonly employeeNumber: string | null;
}

export interface RowValidationResultItem {
  readonly rowNumber: number;
  readonly status: BulkOnboardingRowStatus;
  readonly errorMessage: string | null;
}

export interface ValidateBulkOnboardingBatchResponse {
  readonly validRows: number;
  readonly invalidRows: number;
  readonly rows: readonly RowValidationResultItem[];
}

export interface BulkOnboardingBatchRowDetail {
  readonly rowNumber: number;
  readonly status: BulkOnboardingRowStatus;
  readonly errorMessage: string | null;
  readonly onboardingDraftId: string | null;
}

export interface BulkOnboardingBatchDetailResponse {
  readonly id: string;
  readonly status: BulkOnboardingBatchStatus;
  readonly totalRows: number;
  readonly validRows: number | null;
  readonly invalidRows: number | null;
  readonly rows: readonly BulkOnboardingBatchRowDetail[];
}

export const BULK_ONBOARDING_SYSTEM_FIELD_LABELS: Record<BulkOnboardingSystemField, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  workEmail: 'Work Email',
  startDate: 'Start Date',
  employmentType: 'Employment Type',
  workMode: 'Work Mode',
  department: 'Department',
  position: 'Position',
  checklistTemplate: 'Checklist Template',
  employeeNumber: 'Employee Number'
};
```

- [ ] **Step 2: Verify the project still builds**

Run: `npx tsc --noEmit -p tsconfig.app.json` (or the project's usual `npm run build` — use whichever this repo's CI already runs; check `package.json` scripts)
Expected: no new type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/people/models/bulk-onboarding.model.ts
git commit -m "feat: add bulk onboarding model types"
```

---

## Task 2: `BulkOnboardingApiService`

**Files:**
- Create: `src/app/modules/people/data-access/bulk-onboarding-api.service.ts`
- Test: `src/app/modules/people/data-access/bulk-onboarding-api.service.spec.ts`

**Interfaces:**
- Consumes: model types (Task 1).
- Produces:
```typescript
@Injectable({ providedIn: 'root' })
export class BulkOnboardingApiService {
  upload(payload: UploadBulkOnboardingBatchPayload): Observable<BulkOnboardingBatchResponse>;
  preview(batchId: string, mapping: BulkOnboardingColumnMapping): Observable<RowPreviewResponse>;
  validate(batchId: string, mapping: BulkOnboardingColumnMapping): Observable<ValidateBulkOnboardingBatchResponse>;
  requestCreateDrafts(batchId: string): Observable<BulkOnboardingBatchResponse>;
  getBatch(batchId: string): Observable<BulkOnboardingBatchDetailResponse>;
  requestFinalize(batchId: string, onboardingDraftIds: readonly string[]): Observable<BulkOnboardingBatchResponse>;
}
```
Task 3's store calls every one of these six methods by these exact names.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/people/data-access/bulk-onboarding-api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { BulkOnboardingApiService } from './bulk-onboarding-api.service';

describe('BulkOnboardingApiService', () => {
  let service: BulkOnboardingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(BulkOnboardingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('upload() posts multipart form data to /onboarding/bulk-batches', () => {
    const file = new File(['a,b\n1,2'], 'employees.csv', { type: 'text/csv' });
    service.upload({ file, legalEntityId: 'le-1', defaultWorkModeId: 1, defaultEmploymentType: 'full_time', defaultChecklistTemplateId: null })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 'batch-1', status: 'mapping_pending', totalRows: 1, validRows: null, invalidRows: null, detectedColumns: ['a', 'b'], suggestedMapping: {} });
  });

  it('preview() posts the mapping to /onboarding/bulk-batches/{id}/preview', () => {
    service.preview('batch-1', { firstName: 'First Name' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mapping: { firstName: 'First Name' } });
    req.flush({ firstName: 'Jane', lastName: null, workEmail: null, startDate: null, employmentType: null, workModeName: null, departmentName: null, positionName: null, checklistTemplateName: null, employeeNumber: null });
  });

  it('requestFinalize() posts selected draft ids to /finalize', () => {
    service.requestFinalize('batch-1', ['draft-1', 'draft-2']).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1/finalize`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ onboardingDraftIds: ['draft-1', 'draft-2'] });
    req.flush({ id: 'batch-1', status: 'finalize_pending', totalRows: 2, validRows: 2, invalidRows: 0, detectedColumns: [], suggestedMapping: {} });
  });

  it('getBatch() gets /onboarding/bulk-batches/{id}', () => {
    service.getBatch('batch-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'batch-1', status: 'drafts_created', totalRows: 1, validRows: 1, invalidRows: 0, rows: [] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --include='**/bulk-onboarding-api.service.spec.ts'` (match this project's actual test runner invocation from `package.json` — copy the pattern any existing `*-api.service.spec.ts` file's `describe` block already assumes, e.g. `people-api.service.spec.ts` if one exists, otherwise the Karma/Jest command in `package.json`'s `test` script)
Expected: FAIL — `BulkOnboardingApiService` does not exist.

- [ ] **Step 3: Implement the service**

```typescript
// src/app/modules/people/data-access/bulk-onboarding-api.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  BulkOnboardingBatchDetailResponse,
  BulkOnboardingBatchResponse,
  BulkOnboardingColumnMapping,
  RowPreviewResponse,
  UploadBulkOnboardingBatchPayload,
  ValidateBulkOnboardingBatchResponse
} from '../models/bulk-onboarding.model';

/**
 * Targets HRMS-Backend-v1 BulkOnboardingController
 * (POST /api/v1/onboarding/bulk-batches, POST .../{id}/preview, POST .../{id}/validate,
 * POST .../{id}/create-drafts, GET .../{id}, POST .../{id}/finalize).
 */
@Injectable({ providedIn: 'root' })
export class BulkOnboardingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/onboarding/bulk-batches`;

  upload(payload: UploadBulkOnboardingBatchPayload): Observable<BulkOnboardingBatchResponse> {
    const form = new FormData();
    form.append('file', payload.file, payload.file.name);
    form.append('legalEntityId', payload.legalEntityId);
    if (payload.defaultWorkModeId !== null) form.append('defaultWorkModeId', String(payload.defaultWorkModeId));
    if (payload.defaultEmploymentType !== null) form.append('defaultEmploymentType', payload.defaultEmploymentType);
    if (payload.defaultChecklistTemplateId !== null) form.append('defaultChecklistTemplateId', payload.defaultChecklistTemplateId);

    return this.http.post<BulkOnboardingBatchResponse>(this.baseUrl, form);
  }

  preview(batchId: string, mapping: BulkOnboardingColumnMapping): Observable<RowPreviewResponse> {
    return this.http.post<RowPreviewResponse>(`${this.baseUrl}/${batchId}/preview`, { mapping });
  }

  validate(batchId: string, mapping: BulkOnboardingColumnMapping): Observable<ValidateBulkOnboardingBatchResponse> {
    return this.http.post<ValidateBulkOnboardingBatchResponse>(`${this.baseUrl}/${batchId}/validate`, { mapping });
  }

  requestCreateDrafts(batchId: string): Observable<BulkOnboardingBatchResponse> {
    return this.http.post<BulkOnboardingBatchResponse>(`${this.baseUrl}/${batchId}/create-drafts`, {});
  }

  getBatch(batchId: string): Observable<BulkOnboardingBatchDetailResponse> {
    return this.http.get<BulkOnboardingBatchDetailResponse>(`${this.baseUrl}/${batchId}`);
  }

  requestFinalize(batchId: string, onboardingDraftIds: readonly string[]): Observable<BulkOnboardingBatchResponse> {
    return this.http.post<BulkOnboardingBatchResponse>(`${this.baseUrl}/${batchId}/finalize`, { onboardingDraftIds });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same test command from Step 2.
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/data-access/bulk-onboarding-api.service.ts src/app/modules/people/data-access/bulk-onboarding-api.service.spec.ts
git commit -m "feat: add BulkOnboardingApiService"
```

---

## Task 3: `BulkOnboardingStore`

**Files:**
- Create: `src/app/modules/people/state/bulk-onboarding.store.ts`
- Test: `src/app/modules/people/state/bulk-onboarding.store.spec.ts`

**Interfaces:**
- Consumes: `BulkOnboardingApiService` (Task 2).
- Produces:
```typescript
export const BulkOnboardingStore = signalStore(
  { providedIn: 'root' },
  withState<BulkOnboardingState>(initialBulkOnboardingState),
  withMethods((store, api = inject(BulkOnboardingApiService)) => ({
    async upload(payload: UploadBulkOnboardingBatchPayload): Promise<void>;
    updateMapping(field: BulkOnboardingSystemField, csvColumn: string | null): void; // patches mapping + triggers debounced preview
    async validate(): Promise<void>;
    async createDrafts(): Promise<void>; // then polls until terminal
    toggleRowSelection(onboardingDraftId: string): void;
    async finalizeSelected(): Promise<void>; // then polls until terminal
    reset(): void;
  }))
);
```
Task 5's component injects `BulkOnboardingStore` and calls these methods by these exact names; reads `store.batch()`, `store.rows()`, `store.mapping()`, `store.preview()`, `store.loading()`, `store.error()`, `store.selectedDraftIds()`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/people/state/bulk-onboarding.store.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BulkOnboardingStore } from './bulk-onboarding.store';
import { BulkOnboardingApiService } from '../data-access/bulk-onboarding-api.service';

describe('BulkOnboardingStore', () => {
  let store: InstanceType<typeof BulkOnboardingStore>;
  let apiMock: jest.Mocked<BulkOnboardingApiService>;

  beforeEach(() => {
    apiMock = {
      upload: jest.fn(), preview: jest.fn(), validate: jest.fn(),
      requestCreateDrafts: jest.fn(), getBatch: jest.fn(), requestFinalize: jest.fn()
    } as unknown as jest.Mocked<BulkOnboardingApiService>;

    TestBed.configureTestingModule({
      providers: [BulkOnboardingStore, { provide: BulkOnboardingApiService, useValue: apiMock }]
    });
    store = TestBed.inject(BulkOnboardingStore);
  });

  it('upload() success stores the batch and suggested mapping', async () => {
    apiMock.upload.mockReturnValue(of({
      id: 'batch-1', status: 'mapping_pending', totalRows: 2, validRows: null, invalidRows: null,
      detectedColumns: ['Email'], suggestedMapping: { workEmail: 'Email' }
    }));

    await store.upload({ file: new File([], 'x.csv'), legalEntityId: 'le-1', defaultWorkModeId: null, defaultEmploymentType: null, defaultChecklistTemplateId: null });

    expect(store.batch()?.id).toBe('batch-1');
    expect(store.mapping().workEmail).toBe('Email');
    expect(store.loading()).toBe(false);
  });

  it('upload() failure sets error and does not set a batch', async () => {
    apiMock.upload.mockReturnValue(throwError(() => new Error('too many rows')));

    await store.upload({ file: new File([], 'x.csv'), legalEntityId: 'le-1', defaultWorkModeId: null, defaultEmploymentType: null, defaultChecklistTemplateId: null });

    expect(store.batch()).toBeNull();
    expect(store.error()).toContain('too many rows');
  });

  it('validate() stores per-row results and valid/invalid counts', async () => {
    apiMock.validate.mockReturnValue(of({
      validRows: 1, invalidRows: 1,
      rows: [
        { rowNumber: 1, status: 'valid', errorMessage: null },
        { rowNumber: 2, status: 'invalid', errorMessage: 'Last name is required.' }
      ]
    }));
    // seed a batch id first via upload or a direct patch helper, matching whatever seam this store exposes for test setup

    await store.validate();

    expect(store.validationResult()?.invalidRows).toBe(1);
  });

  it('toggleRowSelection() adds and removes a draft id from the selection set', () => {
    store.toggleRowSelection('draft-1');
    expect(store.selectedDraftIds()).toContain('draft-1');

    store.toggleRowSelection('draft-1');
    expect(store.selectedDraftIds()).not.toContain('draft-1');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --include='**/bulk-onboarding.store.spec.ts'`
Expected: FAIL — `BulkOnboardingStore` does not exist.

- [ ] **Step 3: Implement the store**

```typescript
// src/app/modules/people/state/bulk-onboarding.store.ts
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { BulkOnboardingApiService } from '../data-access/bulk-onboarding-api.service';
import {
  BulkOnboardingBatchDetailResponse,
  BulkOnboardingBatchResponse,
  BulkOnboardingColumnMapping,
  BulkOnboardingSystemField,
  RowPreviewResponse,
  UploadBulkOnboardingBatchPayload,
  ValidateBulkOnboardingBatchResponse
} from '../models/bulk-onboarding.model';

export interface BulkOnboardingState {
  readonly batch: BulkOnboardingBatchResponse | null;
  readonly mapping: BulkOnboardingColumnMapping;
  readonly preview: RowPreviewResponse | null;
  readonly validationResult: ValidateBulkOnboardingBatchResponse | null;
  readonly detail: BulkOnboardingBatchDetailResponse | null;
  readonly selectedDraftIds: readonly string[];
  readonly loading: boolean;
  readonly polling: boolean;
  readonly error: string | null;
}

const TERMINAL_STATUSES = new Set(['drafts_created', 'finalize_completed']);
const POLL_INTERVAL_MS = 2000;

const initialState: BulkOnboardingState = {
  batch: null, mapping: {}, preview: null, validationResult: null, detail: null,
  selectedDraftIds: [], loading: false, polling: false, error: null
};

export const BulkOnboardingStore = signalStore(
  { providedIn: 'root' },
  withState<BulkOnboardingState>(initialState),
  withMethods((store, api = inject(BulkOnboardingApiService)) => ({
    async upload(payload: UploadBulkOnboardingBatchPayload): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const batch = await firstValueFrom(api.upload(payload));
        patchState(store, { batch, mapping: { ...batch.suggestedMapping }, loading: false });
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to upload the file.'), loading: false });
      }
    },

    updateMapping(field: BulkOnboardingSystemField, csvColumn: string | null): void {
      patchState(store, (state) => ({ mapping: { ...state.mapping, [field]: csvColumn } }));
      void this['refreshPreview']();
    },

    async refreshPreview(): Promise<void> {
      const batch = store.batch();
      if (!batch) return;
      try {
        const preview = await firstValueFrom(api.preview(batch.id, store.mapping()));
        patchState(store, { preview });
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to preview the mapping.') });
      }
    },

    async validate(): Promise<void> {
      const batch = store.batch();
      if (!batch) return;
      patchState(store, { loading: true, error: null });
      try {
        const validationResult = await firstValueFrom(api.validate(batch.id, store.mapping()));
        patchState(store, { validationResult, loading: false });
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to validate the batch.'), loading: false });
      }
    },

    async createDrafts(): Promise<void> {
      const batch = store.batch();
      if (!batch) return;
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(api.requestCreateDrafts(batch.id));
        await this['pollUntilTerminal'](batch.id);
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to start draft creation.'), loading: false });
      }
    },

    toggleRowSelection(onboardingDraftId: string): void {
      patchState(store, (state) => ({
        selectedDraftIds: state.selectedDraftIds.includes(onboardingDraftId)
          ? state.selectedDraftIds.filter((id) => id !== onboardingDraftId)
          : [...state.selectedDraftIds, onboardingDraftId]
      }));
    },

    async finalizeSelected(): Promise<void> {
      const batch = store.batch();
      if (!batch || store.selectedDraftIds().length === 0) return;
      patchState(store, { loading: true, error: null });
      try {
        await firstValueFrom(api.requestFinalize(batch.id, store.selectedDraftIds()));
        await this['pollUntilTerminal'](batch.id);
      } catch (err: unknown) {
        patchState(store, { error: toSafeErrorMessage(err, 'Failed to start finalize.'), loading: false });
      }
    },

    async pollUntilTerminal(batchId: string): Promise<void> {
      patchState(store, { polling: true });
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const detail = await firstValueFrom(api.getBatch(batchId));
        patchState(store, { detail });
        if (TERMINAL_STATUSES.has(detail.status)) break;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      patchState(store, { polling: false, loading: false });
    },

    reset(): void {
      patchState(store, initialState);
    }
  }))
);
```

(The `this['refreshPreview']`/`this['pollUntilTerminal']` bracket-call style works around `withMethods`' object-literal `this` typing for one method calling a sibling method defined in the same `withMethods` block — **before writing the file, check how an existing store in this codebase that has the same need (one store method calling another) actually solves it**, e.g. search `add-employee-wizard.store.ts` or `employee.store.ts` for a method-calling-method pattern, and use that established idiom instead of the bracket-index workaround shown here if one already exists — don't introduce a new idiom the codebase doesn't already use.)

- [ ] **Step 4: Run tests to verify they pass**

Run the same test command from Step 2.
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/state/bulk-onboarding.store.ts src/app/modules/people/state/bulk-onboarding.store.spec.ts
git commit -m "feat: add BulkOnboardingStore"
```

---

## Task 4: Route + nav registration

**Files:**
- Modify: `src/app/app.routes.ts:67-95` (the `settings` route's `children` array)
- Modify: `src/app/layouts/main-layout/nav/nav-items.config.ts:110-141` (the `settings` nav item's `children` array)
- Modify: `src/app/app.routes.spec.ts` — add a resolution assertion for the new route
- Modify: `src/app/layouts/main-layout/nav/nav-access.spec.ts` (or wherever `NAV_ITEMS`/`canAccessNavItem` is tested for the `settings` children) — add coverage for the new nav entry's permission+module gate

**Interfaces:**
- Consumes: nothing new.
- Produces: `/settings/bulk-onboarding` route resolving to `BulkOnboardingComponent` (Task 5); nav entry `id: 'settings-bulk-onboarding'`.

- [ ] **Step 1: Write the failing route test**

```typescript
// Add to src/app/app.routes.spec.ts, inside the existing settings describe block
it('resolves /settings/bulk-onboarding to BulkOnboardingComponent', async () => {
  const success = await router.navigateByUrl('/settings/bulk-onboarding');
  expect(success).toBe(true);
  expect(router.url).toBe('/settings/bulk-onboarding');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/app.routes.spec.ts'`
Expected: FAIL — no such route.

- [ ] **Step 3: Register the route and nav entry**

```typescript
// src/app/app.routes.ts - inside the 'settings' route's children array, alongside 'general'/'roles'/'notifications'
{
  path: 'bulk-onboarding',
  loadComponent: () =>
    import('./modules/people/feature/bulk-onboarding/bulk-onboarding.component').then(
      (m) => m.BulkOnboardingComponent
    ),
  canActivate: [permissionGuard],
  data: { title: 'Bulk Onboarding', permissions: ['employees:write'] }
},
```

```typescript
// src/app/layouts/main-layout/nav/nav-items.config.ts - inside the 'settings' item's children array
{
  id: 'settings-bulk-onboarding',
  label: 'Bulk Onboarding',
  path: '/settings/bulk-onboarding',
  requiredModules: ['core_hr'],
  requiredPermissions: ['employees:write']
},
```

- [ ] **Step 4: Add nav-access coverage**

```typescript
// Add to nav-access.spec.ts (exact file confirmed in Task inventory above), following the
// existing pattern used for other settings children in that same file:
it('settings-bulk-onboarding requires both core_hr module and employees:write permission', () => {
  const item: NavItem = {
    id: 'settings-bulk-onboarding', label: 'Bulk Onboarding', path: '/settings/bulk-onboarding',
    requiredModules: ['core_hr'], requiredPermissions: ['employees:write']
  };

  expect(canAccessNavItem(item, checker(['employees:write'], ['core_hr']))).toBe(true);
  expect(canAccessNavItem(item, checker(['employees:write'], []))).toBe(false); // module missing
  expect(canAccessNavItem(item, checker([], ['core_hr']))).toBe(false); // permission missing
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --include='**/app.routes.spec.ts' --include='**/nav-access.spec.ts'`
Expected: PASS, including the two pre-existing `/settings` redirect assertions (unchanged — this task only adds a sibling child).

- [ ] **Step 6: Commit**

```bash
git add src/app/app.routes.ts src/app/app.routes.spec.ts src/app/layouts/main-layout/nav/nav-items.config.ts src/app/layouts/main-layout/nav/nav-access.spec.ts
git commit -m "feat: register bulk onboarding route and nav entry"
```

---

## Task 5: `BulkOnboardingComponent` — Upload + Map Columns steps

**Files:**
- Create: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.ts`
- Create: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.html`
- Create: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.css`
- Test: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.spec.ts`

**Interfaces:**
- Consumes: `BulkOnboardingStore` (Task 3), `BULK_ONBOARDING_SYSTEM_FIELD_LABELS` (Task 1), existing `SelectOption`/select component and `LegalEntityApiService`/department-position selects already used by `add-employee-wizard.component.ts` for the batch-defaults form (reuse those existing selects rather than building new dropdown components).
- Produces: the routed component. Task 6 extends the same file with the remaining steps (Validate/Review/Finalize) — this task establishes the step-gated template shell (`@switch` on a local `currentStep` signal) that Task 6 adds cases to.

- [ ] **Step 1: Write the failing component tests for the upload/mapping steps**

```typescript
// src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BulkOnboardingComponent } from './bulk-onboarding.component';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';

describe('BulkOnboardingComponent', () => {
  let fixture: ComponentFixture<BulkOnboardingComponent>;
  let storeMock: Partial<InstanceType<typeof BulkOnboardingStore>>;

  beforeEach(async () => {
    storeMock = {
      batch: jest.fn().mockReturnValue(null) as any,
      mapping: jest.fn().mockReturnValue({}) as any,
      preview: jest.fn().mockReturnValue(null) as any,
      loading: jest.fn().mockReturnValue(false) as any,
      error: jest.fn().mockReturnValue(null) as any,
      upload: jest.fn(),
      updateMapping: jest.fn()
    };

    await TestBed.configureTestingModule({
      imports: [BulkOnboardingComponent],
      providers: [{ provide: BulkOnboardingStore, useValue: storeMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(BulkOnboardingComponent);
  });

  it('starts on the upload step', () => {
    fixture.detectChanges();
    expect(fixture.componentInstance.currentStep()).toBe('upload');
  });

  it('advances to the mapping step once a batch exists', () => {
    (storeMock.batch as jest.Mock).mockReturnValue({
      id: 'batch-1', status: 'mapping_pending', totalRows: 1, validRows: null, invalidRows: null,
      detectedColumns: ['Email'], suggestedMapping: {}
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.currentStep()).toBe('map-columns');
  });

  it('calling onMappingFieldChange delegates to store.updateMapping', () => {
    fixture.detectChanges();
    fixture.componentInstance.onMappingFieldChange('workEmail', 'Email');

    expect(storeMock.updateMapping).toHaveBeenCalledWith('workEmail', 'Email');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --include='**/bulk-onboarding.component.spec.ts'`
Expected: FAIL — `BulkOnboardingComponent` does not exist.

- [ ] **Step 3: Implement the component (upload + map-columns steps only — Task 6 adds the rest)**

```typescript
// src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.ts
import { Component, computed, inject, signal } from '@angular/core';
import { BulkOnboardingStore } from '../../state/bulk-onboarding.store';
import { BULK_ONBOARDING_SYSTEM_FIELD_LABELS, BulkOnboardingSystemField } from '../../models/bulk-onboarding.model';

type BulkOnboardingStep = 'upload' | 'map-columns' | 'validate' | 'review' | 'finalize';

@Component({
  selector: 'app-bulk-onboarding',
  standalone: true,
  imports: [],
  templateUrl: './bulk-onboarding.component.html',
  styleUrl: './bulk-onboarding.component.css'
})
export class BulkOnboardingComponent {
  store = inject(BulkOnboardingStore);

  readonly fieldLabels = BULK_ONBOARDING_SYSTEM_FIELD_LABELS;
  readonly fieldIds = Object.keys(BULK_ONBOARDING_SYSTEM_FIELD_LABELS) as BulkOnboardingSystemField[];

  private readonly manualStep = signal<BulkOnboardingStep | null>(null);

  currentStep = computed<BulkOnboardingStep>(() => {
    if (this.manualStep()) return this.manualStep()!;
    if (!this.store.batch()) return 'upload';
    return 'map-columns';
  });

  async onFileSelected(event: Event, legalEntityId: string, defaultWorkModeId: number | null, defaultEmploymentType: string | null): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await this.store.upload({ file, legalEntityId, defaultWorkModeId, defaultEmploymentType, defaultChecklistTemplateId: null });
  }

  onMappingFieldChange(field: BulkOnboardingSystemField, csvColumn: string | null): void {
    this.store.updateMapping(field, csvColumn);
  }

  goToStep(step: BulkOnboardingStep): void {
    this.manualStep.set(step);
  }
}
```

```html
<!-- src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.html -->
<div class="bulk-onboarding-page">
  <h1>Bulk Onboarding</h1>

  @if (store.error()) {
    <div class="error-banner" role="alert">{{ store.error() }}</div>
  }

  @switch (currentStep()) {
    @case ('upload') {
      <section>
        <h2>Upload CSV</h2>
        <input type="file" accept=".csv" (change)="onFileSelected($event, 'placeholder-legal-entity-id', null, null)" [disabled]="store.loading()" />
        <!-- Batch-default selects (Legal Entity required, Work Mode/Employment Type/Checklist Template
             optional) reuse the existing select component already used by add-employee-wizard -
             wired up fully when this task's ui markup is written for real; the file input above
             stays wired to the real form values, not the placeholder string shown here. -->
      </section>
    }
    @case ('map-columns') {
      <section>
        <h2>Map Columns</h2>
        @for (field of fieldIds; track field) {
          <label>
            {{ fieldLabels[field] }}
            <select (change)="onMappingFieldChange(field, $any($event.target).value || null)">
              <option value="">-- not mapped --</option>
              @for (column of store.batch()?.detectedColumns; track column) {
                <option [value]="column" [selected]="store.mapping()[field] === column">{{ column }}</option>
              }
            </select>
          </label>
        }
        @if (store.preview(); as preview) {
          <div class="preview-panel">
            <p>Row 1 preview: {{ preview.firstName }} {{ preview.lastName }} — {{ preview.workEmail }}</p>
            <p>Department: {{ preview.departmentName ?? 'not resolved' }}, Position: {{ preview.positionName ?? 'not resolved' }}</p>
          </div>
        }
      </section>
    }
  }
</div>
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same test command from Step 2.
Expected: PASS (all 3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/feature/bulk-onboarding
git commit -m "feat: add BulkOnboardingComponent upload and map-columns steps"
```

---

## Task 6: `BulkOnboardingComponent` — Validate + Review + Finalize steps

**Files:**
- Modify: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.ts`
- Modify: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.html`
- Modify: `src/app/modules/people/feature/bulk-onboarding/bulk-onboarding.component.spec.ts`

**Interfaces:**
- Consumes: `BulkOnboardingStore.validate/createDrafts/toggleRowSelection/finalizeSelected` (Task 3), `DRAFT_STATUS_LABELS`/`DRAFT_REASON_LABELS` (existing, `onboarding-draft.model.ts`).
- Produces: the complete 5-step flow described in the frontend spec §4.

- [ ] **Step 1: Write the failing tests**

```typescript
// Add to bulk-onboarding.component.spec.ts
it('validate step shows partial-success summary and per-row errors', () => {
  (storeMock.validationResult as any) = jest.fn().mockReturnValue({
    validRows: 1, invalidRows: 1,
    rows: [
      { rowNumber: 1, status: 'valid', errorMessage: null },
      { rowNumber: 2, status: 'invalid', errorMessage: 'Last name is required.' }
    ]
  });
  storeMock.batch = jest.fn().mockReturnValue({ id: 'batch-1', status: 'validated', totalRows: 2, validRows: 1, invalidRows: 1, detectedColumns: [], suggestedMapping: {} }) as any;
  fixture.componentInstance.goToStep('validate');
  fixture.detectChanges();

  const text = fixture.nativeElement.textContent as string;
  expect(text).toContain('Last name is required.');
});

it('toggling a review row calls store.toggleRowSelection with the draft id', () => {
  fixture.detectChanges();
  fixture.componentInstance.onToggleRow('draft-1');

  expect(storeMock.toggleRowSelection).toHaveBeenCalledWith('draft-1');
});

it('clicking finalize calls store.finalizeSelected', async () => {
  fixture.detectChanges();
  await fixture.componentInstance.onFinalizeSelected();

  expect(storeMock.finalizeSelected).toHaveBeenCalled();
});
```

(Add `toggleRowSelection: jest.fn()`, `finalizeSelected: jest.fn()`, `createDrafts: jest.fn()`, `validationResult: jest.fn().mockReturnValue(null)`, `detail: jest.fn().mockReturnValue(null)`, `selectedDraftIds: jest.fn().mockReturnValue([])`, `polling: jest.fn().mockReturnValue(false)` to the existing `storeMock` object from Task 5.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --include='**/bulk-onboarding.component.spec.ts'`
Expected: FAIL — `onToggleRow`/`onFinalizeSelected` do not exist yet, `validate` case not rendered.

- [ ] **Step 3: Extend the component**

```typescript
// Add to BulkOnboardingComponent class body:
onToggleRow(onboardingDraftId: string): void {
  this.store.toggleRowSelection(onboardingDraftId);
}

async onValidate(): Promise<void> {
  await this.store.validate();
  this.goToStep('validate');
}

async onCreateDrafts(): Promise<void> {
  await this.store.createDrafts();
  this.goToStep('review');
}

async onFinalizeSelected(): Promise<void> {
  await this.store.finalizeSelected();
  this.goToStep('finalize');
}
```

```html
<!-- Add cases to the @switch in bulk-onboarding.component.html -->
@case ('validate') {
  <section>
    <h2>Validation Summary</h2>
    <p>{{ store.validationResult()?.validRows }} valid / {{ store.validationResult()?.invalidRows }} invalid of {{ store.batch()?.totalRows }} rows</p>
    <table>
      <tbody>
        @for (row of store.validationResult()?.rows; track row.rowNumber) {
          @if (row.status === 'invalid') {
            <tr><td>Row {{ row.rowNumber }}</td><td>{{ row.errorMessage }}</td></tr>
          }
        }
      </tbody>
    </table>
    <button type="button" (click)="onCreateDrafts()" [disabled]="store.loading() || store.polling()">
      Create {{ store.validationResult()?.validRows }} drafts
    </button>
  </section>
}
@case ('review') {
  <section>
    <h2>Review</h2>
    @if (store.polling()) {
      <p aria-busy="true">Creating drafts…</p>
    } @else {
      <table>
        <tbody>
          @for (row of store.detail()?.rows; track row.rowNumber) {
            @if (row.onboardingDraftId) {
              <tr>
                <td><input type="checkbox" (change)="onToggleRow(row.onboardingDraftId)" /></td>
                <td>Row {{ row.rowNumber }}</td>
                <td>{{ row.status }}</td>
              </tr>
            }
          }
        </tbody>
      </table>
      <button type="button" (click)="onFinalizeSelected()" [disabled]="store.loading()">
        Finalize {{ store.selectedDraftIds().length }} selected
      </button>
    }
  </section>
}
@case ('finalize') {
  <section>
    <h2>Finalize</h2>
    @if (store.polling()) {
      <p aria-busy="true">Finalizing…</p>
    } @else {
      <table>
        <tbody>
          @for (row of store.detail()?.rows; track row.rowNumber) {
            <tr><td>Row {{ row.rowNumber }}</td><td>{{ row.status }}</td></tr>
          }
        </tbody>
      </table>
    }
  </section>
}
```

Add a "Continue to Validate" button at the end of the `map-columns` case calling `(click)="onValidate()"` (wire this in alongside the existing mapping markup from Task 5).

- [ ] **Step 4: Run tests to verify they pass**

Run the same test command from Step 2.
Expected: PASS (all 6 tests across both component test additions)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/people/feature/bulk-onboarding
git commit -m "feat: add BulkOnboardingComponent validate, review, and finalize steps"
```

---

## Task 7: Manual verification against the running app

**Files:** none — this task is a manual check, not new code.

- [ ] **Step 1: Start both backend and frontend dev servers**

Run the backend API (`dotnet run --project src/ONEVO.Api`) and the frontend dev server (`npm start` or this repo's usual dev command), both against a tenant with `employees:write` and `core_hr` module enabled.

- [ ] **Step 2: Walk the full flow in a browser**

Navigate to Settings, confirm "Bulk Onboarding" appears in the sub-sidebar. Upload a small real CSV (3-5 rows, at least one intentionally invalid row — e.g. missing last name). Confirm: mapping auto-suggests correctly, row-1 preview resolves department/position names, validate shows partial success with the invalid row's specific reason, create-drafts polls to completion and the drafts appear both in this batch's review screen and in the existing My Drafts list (spec §4 intentional overlap), finalize-selected polls to completion and shows the four-way outcome per row.

- [ ] **Step 3: Confirm no regressions in the existing single-employee onboarding flow**

Walk the existing Add Employee wizard end-to-end once (same permission, same tenant) — this is the regression check for the backend plan's Task 4 (`IOnboardingDraftWriteService` extraction) from the frontend's perspective: identical behavior to before this feature existed.

- [ ] **Step 4: Report findings**

No commit for this task — it's verification, not code. If Step 2 or 3 surfaces a bug, fix it as a new bite-sized task appended to this plan (write a failing test first, per this plan's own convention) rather than patching silently.

---

## Plan Self-Review Notes

- **Spec coverage:** Upload with defaults (Task 5), ephemeral mapping + row-1 preview (Task 5), partial-success validation display (Task 6), background create-drafts with polling (Task 6), review/select (Task 6), background finalize with four-way outcome display (Task 6), nav placement under Settings with `core_hr` + `employees:write` gating (Task 4), route/nav spec updates without breaking the existing `/settings` redirect test (Task 4).
- **Type consistency:** `BulkOnboardingSystemField` (Task 1) is the single source of the mapping-field id list — Task 5/6's component iterates `fieldIds` derived from the same object rather than a second hardcoded list, so the two can't drift.
- **No Reporting Manager references anywhere** in this plan, consistent with the backend plan's Global Constraints correction.
