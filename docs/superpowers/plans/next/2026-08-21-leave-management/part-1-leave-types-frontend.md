# Leave Management — Part 1: Leave Types Admin Screen (Frontend Phase 1 of 9)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Leave Types admin screen (spec Screen 1) end to end against the real backend from `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-21-leave-management/part-1-schema-and-leave-types.md` — list, create, edit, deactivate — wired to `/time-off/types` inside a People-module-style Time Off inner sidebar.

**Architecture:** Mirrors the `organization` module's `Department` screen exactly: `data-access` HttpClient service → `state` signalStore → `ui` presentational table + form modal → `feature` page component composing them, permission-gated via `PermissionService.hasPermission()` (UX only — the backend's `leave:manage` check from the backend plan's Task 8/10/11 is the real boundary). The Time Off module gets its own inner sidebar layout in this phase; it shows only routes that actually exist, so Part 1 displays `Leave Types` only and later phases append menu items as they ship.

**Tech Stack:** Angular 21, `@ngrx/signals`, reactive forms, Vitest + `HttpTestingController`.

**Spec:** `docs/superpowers/specs/next/2026-08-21-leave-management-design.md`

## Global Constraints

- Branch from `origin/Development`, not `main` — per the frontend architecture skill, `origin/main` is a stale one-commit skeleton with no auth/layouts/nav; `origin/Development` is the real trunk this module's dependencies (nav shell, `PermissionService`, shared/ui components) live on.
- Leave module only — do not touch `organization`, `people`, or `core/`.
- Keep the main dark sidebar as a single `Time Off` item. Add a People-module-style inner sidebar inside the Time Off route, and never show menu items for unbuilt pages.
- `Code` is never editable after create (backend enforces this by omitting it from `UpdateLeaveTypeRequest` entirely) — the edit form must not render a Code field at all, matching that contract.
- This plan assumes the backend part-1 plan is deployed and reachable at `${environment.apiUrl}/leave/types`. If it isn't yet, `leave-type-api.service.spec.ts`'s `HttpTestingController` tests still pass (they never hit a real network), but manual verification (Task 6) must wait.

---

### Task 1: `leave-type.model.ts` + `leave-type-api.service.ts`

**Files:**
- Create: `src/app/modules/leave/models/leave-type.model.ts`
- Create: `src/app/modules/leave/data-access/leave-type-api.service.ts`
- Test: `src/app/modules/leave/data-access/leave-type-api.service.spec.ts`

- [ ] **Step 1: Model, matching the backend's `LeaveTypeResponse`/`CreateLeaveTypeRequest`/`UpdateLeaveTypeRequest` field-for-field**

```typescript
export interface LeaveTypeResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'unpaid' | 'custom';
  isPaid: boolean;
  requiresApproval: boolean;
  requiresDocument: boolean;
  documentRequiredAfterDays: number | null;
  acceptedDocumentTypes: string[];
  maxConsecutiveDays: number | null;
  defaultDaysPerYear: number;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  carryForwardExpiryMonths: number | null;
  proRataForNewJoiners: boolean;
  applicableGender: 'all' | 'male' | 'female';
  minimumNoticeDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateLeaveTypeRequest {
  name: string;
  code: string;
  description: string | null;
  category: LeaveTypeResponse['category'];
  isPaid: boolean;
  requiresApproval: boolean;
  requiresDocument: boolean;
  documentRequiredAfterDays: number | null;
  acceptedDocumentTypes: string[];
  maxConsecutiveDays: number | null;
  defaultDaysPerYear: number;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  carryForwardExpiryMonths: number | null;
  proRataForNewJoiners: boolean;
  applicableGender: LeaveTypeResponse['applicableGender'];
  minimumNoticeDays: number;
}

// Same shape as CreateLeaveTypeRequest minus `code` — the backend's UpdateLeaveTypeRequest
// has no Code field at all (Code is immutable after create).
export type UpdateLeaveTypeRequest = Omit<CreateLeaveTypeRequest, 'code'>;
```

- [ ] **Step 2: Write the failing test**

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveTypeApiService } from './leave-type-api.service';
import { CreateLeaveTypeRequest, LeaveTypeResponse } from '../models/leave-type.model';

describe('LeaveTypeApiService', () => {
  let service: LeaveTypeApiService;
  let httpMock: HttpTestingController;

  const mockType: LeaveTypeResponse = {
    id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual',
    isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null,
    acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20,
    carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3,
    proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0,
    isActive: true, createdAt: '2026-08-21T00:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LeaveTypeApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(LeaveTypeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists leave types', async () => {
    const promise = new Promise<LeaveTypeResponse[]>((resolve) => {
      service.list(false).subscribe((res) => resolve(res));
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`);
    expect(req.request.method).toBe('GET');
    req.flush([mockType]);

    expect(await promise).toEqual([mockType]);
  });

  it('creates a leave type', async () => {
    const payload: CreateLeaveTypeRequest = {
      name: 'Sick Leave', code: 'SICK', description: null, category: 'sick',
      isPaid: true, requiresApproval: true, requiresDocument: true, documentRequiredAfterDays: 3,
      acceptedDocumentTypes: ['pdf'], maxConsecutiveDays: null, defaultDaysPerYear: 10,
      carryForwardAllowed: false, maxCarryForwardDays: null, carryForwardExpiryMonths: null,
      proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0
    };
    const promise = new Promise<LeaveTypeResponse>((resolve) => {
      service.create(payload).subscribe((res) => resolve(res));
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/leave/types`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockType);

    expect(await promise).toEqual(mockType);
  });

  it('deactivates a leave type', async () => {
    const promise = new Promise<void>((resolve) => {
      service.deactivate('type-1', false).subscribe(() => resolve());
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/leave/types/type-1/deactivate?confirmed=false`);
    expect(req.request.method).toBe('POST');
    req.flush(null);

    await promise;
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- leave-type-api.service.spec.ts`
Expected: FAIL — `LeaveTypeApiService` does not exist.

- [ ] **Step 4: Implement the service**

```typescript
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../models/leave-type.model';

/** Targets ONEVO.Api's LeaveTypesController (/api/v1/leave/types). See
 * HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-21-leave-management/part-1-schema-and-leave-types.md. */
@Injectable({ providedIn: 'root' })
export class LeaveTypeApiService {
  private readonly http = inject(HttpClient);

  list(includeInactive: boolean): Observable<LeaveTypeResponse[]> {
    const params = new HttpParams().set('includeInactive', includeInactive);
    return this.http.get<LeaveTypeResponse[]>(`${environment.apiUrl}/leave/types`, { params });
  }

  get(leaveTypeId: string): Observable<LeaveTypeResponse> {
    return this.http.get<LeaveTypeResponse>(`${environment.apiUrl}/leave/types/${leaveTypeId}`);
  }

  create(payload: CreateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.http.post<LeaveTypeResponse>(`${environment.apiUrl}/leave/types`, payload);
  }

  update(leaveTypeId: string, payload: UpdateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.http.put<LeaveTypeResponse>(`${environment.apiUrl}/leave/types/${leaveTypeId}`, payload);
  }

  deactivate(leaveTypeId: string, confirmed: boolean): Observable<void> {
    const params = new HttpParams().set('confirmed', confirmed);
    return this.http.post<void>(`${environment.apiUrl}/leave/types/${leaveTypeId}/deactivate`, {}, { params });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- leave-type-api.service.spec.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/leave/models/leave-type.model.ts src/app/modules/leave/data-access/leave-type-api.service.ts src/app/modules/leave/data-access/leave-type-api.service.spec.ts
git commit -m "feat(leave): add LeaveType model and API service"
```

---

### Task 2: `leave-type.store.ts`

**Files:**
- Create: `src/app/modules/leave/state/leave-type.store.ts`
- Test: `src/app/modules/leave/state/leave-type.store.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveTypeResponse } from '../models/leave-type.model';
import { LeaveTypeStore } from './leave-type.store';

describe('LeaveTypeStore', () => {
  let store: InstanceType<typeof LeaveTypeStore>;
  let httpMock: HttpTestingController;

  const mockType: LeaveTypeResponse = {
    id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual',
    isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null,
    acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20,
    carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3,
    proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0,
    isActive: true, createdAt: '2026-08-21T00:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LeaveTypeStore, provideHttpClient(), provideHttpClientTesting()]
    });
    store = TestBed.inject(LeaveTypeStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads leave types into state', async () => {
    const loadPromise = store.load();
    httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`).flush([mockType]);
    await loadPromise;

    expect(store.items()).toEqual([mockType]);
    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBeNull();
  });

  it('sets loadError on failed load', async () => {
    const loadPromise = store.load();
    httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`)
      .flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await loadPromise;

    expect(store.items()).toEqual([]);
    expect(store.loadError()).toBeTruthy();
  });

  it('createLeaveType reloads the list on success', async () => {
    const createPromise = store.createLeaveType({
      name: 'Sick Leave', code: 'SICK', description: null, category: 'sick',
      isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null,
      acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 10,
      carryForwardAllowed: false, maxCarryForwardDays: null, carryForwardExpiryMonths: null,
      proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0
    });

    httpMock.expectOne(`${environment.apiUrl}/leave/types`).flush(mockType);
    // A microtask tick is required here so createLeaveType's `await this.load()` continuation
    // actually issues the reload GET before the next expectOne runs - same fix already used in
    // position.store.spec.ts's own create-then-reload test.
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`).flush([mockType]);

    expect(await createPromise).toBe(true);
    expect(store.items()).toEqual([mockType]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- leave-type.store.spec.ts`
Expected: FAIL — `LeaveTypeStore` does not exist.

- [ ] **Step 3: Implement the store**

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { LeaveTypeApiService } from '../data-access/leave-type-api.service';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../models/leave-type.model';

export interface LeaveTypeState {
  readonly items: readonly LeaveTypeResponse[];
  readonly includeInactive: boolean;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly loadError: string | null;
  readonly actionError: string | null;
}

const initialState: LeaveTypeState = {
  items: [],
  includeInactive: false,
  loading: false,
  saving: false,
  loadError: null,
  actionError: null
};

export const LeaveTypeStore = signalStore(
  { providedIn: 'root' },
  withState<LeaveTypeState>(initialState),
  withMethods((store, api = inject(LeaveTypeApiService)) => ({
    setIncludeInactive(includeInactive: boolean): void {
      patchState(store, { includeInactive });
      this.load();
    },

    async load(): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const items = await firstValueFrom(api.list(store.includeInactive()));
        patchState(store, { items, loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load leave types.') });
      }
    },

    async createLeaveType(payload: CreateLeaveTypeRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.create(payload));
        patchState(store, { saving: false });
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create leave type.') });
        return false;
      }
    },

    async updateLeaveType(leaveTypeId: string, payload: UpdateLeaveTypeRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.update(leaveTypeId, payload));
        patchState(store, { saving: false });
        await this.load();
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update leave type.') });
        return false;
      }
    },

    // Returns 'confirm' when the backend reports pending requests and needs confirmed=true
    // resubmission (backend DeactivateLeaveTypeCommandHandler, 409 with the count in the message).
    async deactivateLeaveType(leaveTypeId: string, confirmed: boolean): Promise<'success' | 'confirm' | 'error'> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.deactivate(leaveTypeId, confirmed));
        patchState(store, { saving: false });
        await this.load();
        return 'success';
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 409 && !confirmed) {
          patchState(store, { saving: false });
          return 'confirm';
        }
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to deactivate leave type.') });
        return 'error';
      }
    }
  }))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- leave-type.store.spec.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/state/leave-type.store.ts src/app/modules/leave/state/leave-type.store.spec.ts
git commit -m "feat(leave): add LeaveTypeStore"
```

---

### Task 3: `leave-type-list-table` (ui)

**Files:**
- Create: `src/app/modules/leave/ui/leave-type-list-table/leave-type-list-table.component.ts`
- Create: `src/app/modules/leave/ui/leave-type-list-table/leave-type-list-table.component.html`
- Create: `src/app/modules/leave/ui/leave-type-list-table/leave-type-list-table.component.css`

Presentational component — no store injected, matching `DepartmentListTableComponent`'s pattern exactly (Input/Output only, no direct API/state access).

- [ ] **Step 1: Component class**

```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaveTypeResponse } from '../../models/leave-type.model';

@Component({
  selector: 'app-leave-type-list-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leave-type-list-table.component.html',
  styleUrl: './leave-type-list-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveTypeListTableComponent {
  @Input({ required: true }) leaveTypes: readonly LeaveTypeResponse[] = [];
  @Input() canManage = false;

  @Output() editLeaveType = new EventEmitter<LeaveTypeResponse>();
  @Output() deactivateLeaveType = new EventEmitter<LeaveTypeResponse>();

  readonly openMenuId = signal<string | null>(null);

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  toggleMenu(id: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update((current) => (current === id ? null : id));
  }

  closeMenu(): void {
    this.openMenuId.set(null);
  }

  onEdit(type: LeaveTypeResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.editLeaveType.emit(type);
  }

  onDeactivate(type: LeaveTypeResponse, event: Event): void {
    event.stopPropagation();
    this.closeMenu();
    this.deactivateLeaveType.emit(type);
  }
}
```

- [ ] **Step 2: Template**

```html
<div class="ltt-table-wrap">
  @if (leaveTypes.length === 0) {
    <p class="ltt-empty">No leave types configured yet.</p>
  } @else {
    <table class="ltt-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Code</th>
          <th>Category</th>
          <th>Paid</th>
          <th>Default Days/Year</th>
          <th>Status</th>
          @if (canManage) { <th></th> }
        </tr>
      </thead>
      <tbody>
        @for (type of leaveTypes; track type.id) {
          <tr>
            <td>{{ type.name }}</td>
            <td>{{ type.code }}</td>
            <td class="ltt-capitalize">{{ type.category }}</td>
            <td>{{ type.isPaid ? 'Paid' : 'Unpaid' }}</td>
            <td>{{ type.defaultDaysPerYear }}</td>
            <td>
              <span class="ltt-badge" [class.ltt-badge--inactive]="!type.isActive">
                {{ type.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            @if (canManage) {
              <td class="ltt-actions-cell">
                <button type="button" class="ltt-menu-btn" (click)="toggleMenu(type.id, $event)" aria-label="Row actions">⋮</button>
                @if (openMenuId() === type.id) {
                  <div class="ltt-menu" (click)="$event.stopPropagation()">
                    <button type="button" (click)="onEdit(type, $event)">Edit</button>
                    @if (type.isActive) {
                      <button type="button" (click)="onDeactivate(type, $event)">Deactivate</button>
                    }
                  </div>
                }
              </td>
            }
          </tr>
        }
      </tbody>
    </table>
  }
</div>
```

- [ ] **Step 3: Stylesheet**

```css
.ltt-table-wrap { width: 100%; overflow-x: auto; }
.ltt-table { width: 100%; border-collapse: collapse; }
.ltt-table th, .ltt-table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border-color, #e5e7eb); }
.ltt-capitalize { text-transform: capitalize; }
.ltt-empty { padding: 2rem; text-align: center; color: var(--text-secondary, #6b7280); }
.ltt-badge { padding: 0.125rem 0.5rem; border-radius: 999px; font-size: 0.75rem; background: var(--success-bg, #dcfce7); color: var(--success-text, #166534); }
.ltt-badge--inactive { background: var(--neutral-bg, #f3f4f6); color: var(--text-secondary, #6b7280); }
.ltt-actions-cell { position: relative; text-align: right; }
.ltt-menu-btn { background: none; border: none; cursor: pointer; font-size: 1.25rem; padding: 0.25rem 0.5rem; }
.ltt-menu { position: absolute; right: 1rem; top: 100%; background: var(--surface, #fff); border: 1px solid var(--border-color, #e5e7eb); border-radius: 0.375rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 10; display: flex; flex-direction: column; min-width: 140px; }
.ltt-menu button { padding: 0.5rem 1rem; text-align: left; background: none; border: none; cursor: pointer; }
.ltt-menu button:hover { background: var(--hover-bg, #f9fafb); }
```

- [ ] **Step 4: Build to confirm no compile errors**

Run: `npm run build`
Expected: build succeeds (no test for a pure presentational component with no logic branches beyond the menu toggle — matches `DepartmentListTableComponent`, which also has no `.spec.ts` in this repo).

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/ui/leave-type-list-table
git commit -m "feat(leave): add LeaveTypeListTableComponent"
```

---

### Task 4: `leave-type-form-modal` (ui)

**Files:**
- Create: `src/app/modules/leave/ui/leave-type-form-modal/leave-type-form-modal.component.ts`
- Create: `src/app/modules/leave/ui/leave-type-form-modal/leave-type-form-modal.component.html`
- Create: `src/app/modules/leave/ui/leave-type-form-modal/leave-type-form-modal.component.css`

Mirrors `DepartmentFormModalComponent` exactly — same backdrop/header/form/footer structure, same `app-input`/`app-select`/`app-button` usage, extended for Leave Type's larger field set. Code is only shown (read-only) when editing, never as an editable input, since the backend forbids changing it.

- [ ] **Step 1: Component class**

```typescript
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../../models/leave-type.model';

export type LeaveTypeFormValue = CreateLeaveTypeRequest;

@Component({
  selector: 'app-leave-type-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './leave-type-form-modal.component.html',
  styleUrl: './leave-type-form-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveTypeFormModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input() leaveType: LeaveTypeResponse | null = null;
  @Input() loading = false;

  @Output() save = new EventEmitter<LeaveTypeFormValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly categoryOptions = [
    { value: 'annual', label: 'Annual' },
    { value: 'sick', label: 'Sick' },
    { value: 'maternity', label: 'Maternity' },
    { value: 'paternity', label: 'Paternity' },
    { value: 'compassionate', label: 'Compassionate' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'custom', label: 'Custom' }
  ];

  readonly genderOptions = [
    { value: 'all', label: 'All' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' }
  ];

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    code: ['', [Validators.required, Validators.maxLength(20)]],
    description: [''],
    category: ['custom', Validators.required],
    isPaid: [true],
    requiresApproval: [true],
    requiresDocument: [false],
    documentRequiredAfterDays: [null as number | null],
    defaultDaysPerYear: [0, [Validators.required, Validators.min(0.5)]],
    carryForwardAllowed: [false],
    maxCarryForwardDays: [null as number | null],
    carryForwardExpiryMonths: [null as number | null],
    proRataForNewJoiners: [false],
    applicableGender: ['all', Validators.required],
    minimumNoticeDays: [0, Validators.min(0)],
    maxConsecutiveDays: [null as number | null]
  });

  get isEdit(): boolean {
    return !!this.leaveType;
  }

  ngOnInit(): void {
    if (this.leaveType) {
      this.form.patchValue({
        name: this.leaveType.name,
        code: this.leaveType.code,
        description: this.leaveType.description ?? '',
        category: this.leaveType.category,
        isPaid: this.leaveType.isPaid,
        requiresApproval: this.leaveType.requiresApproval,
        requiresDocument: this.leaveType.requiresDocument,
        documentRequiredAfterDays: this.leaveType.documentRequiredAfterDays,
        defaultDaysPerYear: this.leaveType.defaultDaysPerYear,
        carryForwardAllowed: this.leaveType.carryForwardAllowed,
        maxCarryForwardDays: this.leaveType.maxCarryForwardDays,
        carryForwardExpiryMonths: this.leaveType.carryForwardExpiryMonths,
        proRataForNewJoiners: this.leaveType.proRataForNewJoiners,
        applicableGender: this.leaveType.applicableGender,
        minimumNoticeDays: this.leaveType.minimumNoticeDays,
        maxConsecutiveDays: this.leaveType.maxConsecutiveDays
      });
      this.form.controls.code.disable();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const val = this.form.getRawValue();
    this.save.emit({
      name: (val.name || '').trim(),
      code: (val.code || '').trim().toUpperCase(),
      description: val.description?.trim() || null,
      category: val.category as LeaveTypeFormValue['category'],
      isPaid: !!val.isPaid,
      requiresApproval: !!val.requiresApproval,
      requiresDocument: !!val.requiresDocument,
      documentRequiredAfterDays: val.requiresDocument ? val.documentRequiredAfterDays : null,
      acceptedDocumentTypes: val.requiresDocument ? ['pdf', 'image'] : [],
      maxConsecutiveDays: val.maxConsecutiveDays,
      defaultDaysPerYear: val.defaultDaysPerYear ?? 0,
      carryForwardAllowed: !!val.carryForwardAllowed,
      maxCarryForwardDays: val.carryForwardAllowed ? val.maxCarryForwardDays : null,
      carryForwardExpiryMonths: val.carryForwardAllowed ? val.carryForwardExpiryMonths : null,
      proRataForNewJoiners: !!val.proRataForNewJoiners,
      applicableGender: val.applicableGender as LeaveTypeFormValue['applicableGender'],
      minimumNoticeDays: val.minimumNoticeDays ?? 0
    });
  }

  // Consumed by the feature component to build UpdateLeaveTypeRequest (no code field) on edit.
  toUpdateRequest(value: LeaveTypeFormValue): UpdateLeaveTypeRequest {
    const { code: _code, ...rest } = value;
    return rest;
  }
}
```

- [ ] **Step 2: Template**

```html
<div class="ltfm-backdrop" (click)="cancel.emit()">
  <div class="ltfm-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">

    <div class="ltfm-header">
      <div>
        <h2 class="ltfm-title">{{ isEdit ? 'Edit leave type' : 'Create leave type' }}</h2>
        <p class="ltfm-subtitle">
          {{ isEdit ? 'Update this leave type. Code cannot be changed.' : 'Add a new leave type for this company.' }}
        </p>
      </div>
      <button type="button" class="ltfm-close-btn" (click)="cancel.emit()" aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>

    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="ltfm-form">
      <div class="ltfm-grid">
        <div class="ltfm-col">
          <app-input
            label="Leave type name *"
            [value]="form.controls.name.value || ''"
            (valueChange)="form.controls.name.setValue($event)"
            (blurred)="form.controls.name.markAsTouched()"
            [error]="form.controls.name.touched && form.controls.name.invalid ? 'Name is required (max 100 chars).' : ''"
          />

          <app-input
            label="Code *"
            [value]="form.controls.code.value || ''"
            (valueChange)="form.controls.code.setValue($event)"
            (blurred)="form.controls.code.markAsTouched()"
            [disabled]="isEdit"
            [error]="form.controls.code.touched && form.controls.code.invalid ? 'Code is required (max 20 chars).' : ''"
          />
          @if (isEdit) { <p class="ltfm-hint">Code cannot be changed after create.</p> }

          <app-input
            label="Description"
            [value]="form.controls.description.value || ''"
            (valueChange)="form.controls.description.setValue($event)"
          />

          <app-select
            label="Category *"
            [options]="categoryOptions"
            [value]="form.controls.category.value || 'custom'"
            (valueChange)="form.controls.category.setValue($event)"
          />

          <app-select
            label="Applicable gender *"
            [options]="genderOptions"
            [value]="form.controls.applicableGender.value || 'all'"
            (valueChange)="form.controls.applicableGender.setValue($event)"
          />

          <app-input
            label="Default days per year *"
            type="number"
            [value]="(form.controls.defaultDaysPerYear.value ?? 0).toString()"
            (valueChange)="form.controls.defaultDaysPerYear.setValue(+$event)"
            [error]="form.controls.defaultDaysPerYear.touched && form.controls.defaultDaysPerYear.invalid ? 'Must be positive.' : ''"
          />

          <app-input
            label="Minimum notice (days)"
            type="number"
            [value]="(form.controls.minimumNoticeDays.value ?? 0).toString()"
            (valueChange)="form.controls.minimumNoticeDays.setValue(+$event)"
          />

          <app-input
            label="Max consecutive days (blank = unlimited)"
            type="number"
            [value]="(form.controls.maxConsecutiveDays.value ?? '').toString()"
            (valueChange)="form.controls.maxConsecutiveDays.setValue($event ? +$event : null)"
          />
        </div>

        <div class="ltfm-col">
          <label class="ltfm-checkbox">
            <input type="checkbox" [formControl]="form.controls.isPaid" />
            Paid leave
          </label>

          <label class="ltfm-checkbox">
            <input type="checkbox" [formControl]="form.controls.requiresApproval" />
            Requires manager approval
          </label>

          <label class="ltfm-checkbox">
            <input type="checkbox" [formControl]="form.controls.requiresDocument" />
            Requires supporting document
          </label>

          @if (form.controls.requiresDocument.value) {
            <app-input
              label="Document required after N days"
              type="number"
              [value]="(form.controls.documentRequiredAfterDays.value ?? '').toString()"
              (valueChange)="form.controls.documentRequiredAfterDays.setValue($event ? +$event : null)"
            />
          }

          <label class="ltfm-checkbox">
            <input type="checkbox" [formControl]="form.controls.carryForwardAllowed" />
            Carry-forward allowed
          </label>

          @if (form.controls.carryForwardAllowed.value) {
            <app-input
              label="Max carry-forward days"
              type="number"
              [value]="(form.controls.maxCarryForwardDays.value ?? '').toString()"
              (valueChange)="form.controls.maxCarryForwardDays.setValue($event ? +$event : null)"
              [error]="(form.controls.maxCarryForwardDays.value ?? 0) > (form.controls.defaultDaysPerYear.value ?? 0) ? 'Cannot exceed default annual entitlement.' : ''"
            />
            <app-input
              label="Carry-forward expiry (months, 1-12)"
              type="number"
              [value]="(form.controls.carryForwardExpiryMonths.value ?? '').toString()"
              (valueChange)="form.controls.carryForwardExpiryMonths.setValue($event ? +$event : null)"
            />
          }

          <label class="ltfm-checkbox">
            <input type="checkbox" [formControl]="form.controls.proRataForNewJoiners" />
            Pro-rata for new joiners
          </label>
        </div>
      </div>

      <div class="ltfm-footer">
        <app-button type="button" variant="secondary" (click)="cancel.emit()" [disabled]="loading">Cancel</app-button>
        <app-button type="submit" [loading]="loading" [disabled]="loading">
          {{ isEdit ? 'Save changes' : 'Create leave type' }}
        </app-button>
      </div>
    </form>

  </div>
</div>
```

- [ ] **Step 3: Stylesheet**

```css
.ltfm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 50; }
.ltfm-modal { background: var(--surface, #fff); border-radius: 0.5rem; max-width: 720px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; }
.ltfm-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
.ltfm-title { font-size: 1.125rem; font-weight: 600; margin: 0; }
.ltfm-subtitle { font-size: 0.875rem; color: var(--text-secondary, #6b7280); margin: 0.25rem 0 0; }
.ltfm-close-btn { background: none; border: none; cursor: pointer; padding: 0.25rem; }
.ltfm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.ltfm-col { display: flex; flex-direction: column; gap: 0.75rem; }
.ltfm-hint { font-size: 0.75rem; color: var(--text-secondary, #6b7280); margin: -0.5rem 0 0; }
.ltfm-checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.ltfm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; }
@media (max-width: 640px) { .ltfm-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Build to confirm no compile errors**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/ui/leave-type-form-modal
git commit -m "feat(leave): add LeaveTypeFormModalComponent"
```

---

### Task 5: `leave-types-management` (feature page)

**Files:**
- Create: `src/app/modules/leave/feature/leave-types-management/leave-types-management.component.ts`
- Create: `src/app/modules/leave/feature/leave-types-management/leave-types-management.component.html`
- Create: `src/app/modules/leave/feature/leave-types-management/leave-types-management.component.css`

- [ ] **Step 1: Component class**

```typescript
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveTypeResponse } from '../../models/leave-type.model';
import { LeaveTypeListTableComponent } from '../../ui/leave-type-list-table/leave-type-list-table.component';
import { LeaveTypeFormModalComponent, LeaveTypeFormValue } from '../../ui/leave-type-form-modal/leave-type-form-modal.component';

@Component({
  selector: 'app-leave-types-management',
  standalone: true,
  imports: [
    CommonModule,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LeaveTypeListTableComponent,
    LeaveTypeFormModalComponent
  ],
  templateUrl: './leave-types-management.component.html',
  styleUrl: './leave-types-management.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaveTypesManagementComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  readonly store = inject(LeaveTypeStore);

  readonly hasManageAccess = computed(() => this.permissionService.hasPermission('leave:manage'));

  readonly formModalOpen = signal(false);
  readonly editingType = signal<LeaveTypeResponse | null>(null);
  readonly pendingDeactivateType = signal<LeaveTypeResponse | null>(null);

  constructor() {
    this.store.load();
  }

  openCreateModal(): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to create leave types.");
      return;
    }
    this.editingType.set(null);
    this.formModalOpen.set(true);
  }

  openEditModal(type: LeaveTypeResponse): void {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to edit leave types.");
      return;
    }
    this.editingType.set(type);
    this.formModalOpen.set(true);
  }

  closeFormModal(): void {
    this.formModalOpen.set(false);
    this.editingType.set(null);
  }

  async onSave(val: LeaveTypeFormValue): Promise<void> {
    const editing = this.editingType();
    let success: boolean;

    if (editing) {
      const { code: _code, ...update } = val;
      success = await this.store.updateLeaveType(editing.id, update);
      if (success) this.notificationService.success(`Leave type '${val.name}' updated successfully.`);
    } else {
      success = await this.store.createLeaveType(val);
      if (success) this.notificationService.success(`Leave type '${val.name}' created successfully.`);
    }

    if (success) {
      this.closeFormModal();
    } else {
      this.notificationService.error(this.store.actionError() ?? 'Failed to save leave type.');
    }
  }

  async onDeactivateRequest(type: LeaveTypeResponse): Promise<void> {
    if (!this.hasManageAccess()) {
      this.notificationService.error("You don't have permission to deactivate leave types.");
      return;
    }
    const outcome = await this.store.deactivateLeaveType(type.id, false);
    if (outcome === 'success') {
      this.notificationService.success(`Leave type '${type.name}' deactivated.`);
    } else if (outcome === 'confirm') {
      this.pendingDeactivateType.set(type);
    } else {
      this.notificationService.error(this.store.actionError() ?? 'Failed to deactivate leave type.');
    }
  }

  async onConfirmDeactivate(): Promise<void> {
    const type = this.pendingDeactivateType();
    if (!type) return;
    const outcome = await this.store.deactivateLeaveType(type.id, true);
    this.pendingDeactivateType.set(null);
    if (outcome === 'success') {
      this.notificationService.success(`Leave type '${type.name}' deactivated. Pending requests were auto-cancelled.`);
    } else {
      this.notificationService.error(this.store.actionError() ?? 'Failed to deactivate leave type.');
    }
  }

  cancelDeactivate(): void {
    this.pendingDeactivateType.set(null);
  }
}
```

- [ ] **Step 2: Template**

```html
<div class="ltm-page">
  <div class="ltm-header">
    <div>
      <h1 class="ltm-title">Leave Types</h1>
      <p class="ltm-subtitle">Configure the leave types employees can request.</p>
    </div>
    @if (hasManageAccess()) {
      <app-button (click)="openCreateModal()">+ New leave type</app-button>
    }
  </div>

  @if (store.loading()) {
    <p class="ltm-loading">Loading leave types…</p>
  } @else if (store.loadError()) {
    <app-error-state [message]="store.loadError()!" [retryable]="true" (retry)="store.load()" />
  } @else if (store.items().length === 0) {
    <app-empty-state
      title="No leave types yet"
      description="Create your first leave type to get started."
    />
  } @else {
    <app-leave-type-list-table
      [leaveTypes]="store.items()"
      [canManage]="hasManageAccess()"
      (editLeaveType)="openEditModal($event)"
      (deactivateLeaveType)="onDeactivateRequest($event)"
    />
  }

  @if (formModalOpen()) {
    <app-leave-type-form-modal
      [leaveType]="editingType()"
      [loading]="store.saving()"
      (save)="onSave($event)"
      (cancel)="closeFormModal()"
    />
  }

  @if (pendingDeactivateType()) {
    <div class="ltm-confirm-backdrop" (click)="cancelDeactivate()">
      <div class="ltm-confirm-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <p>There are pending requests for "{{ pendingDeactivateType()!.name }}". They will be auto-cancelled. Continue?</p>
        <div class="ltm-confirm-footer">
          <app-button variant="secondary" (click)="cancelDeactivate()">Cancel</app-button>
          <app-button (click)="onConfirmDeactivate()">Deactivate anyway</app-button>
        </div>
      </div>
    </div>
  }
</div>
```

- [ ] **Step 3: Stylesheet**

```css
.ltm-page { padding: 1.5rem; }
.ltm-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
.ltm-title { font-size: 1.5rem; font-weight: 600; margin: 0; }
.ltm-subtitle { color: var(--text-secondary, #6b7280); margin: 0.25rem 0 0; }
.ltm-loading { padding: 2rem; text-align: center; color: var(--text-secondary, #6b7280); }
.ltm-confirm-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 60; }
.ltm-confirm-modal { background: var(--surface, #fff); border-radius: 0.5rem; padding: 1.5rem; max-width: 420px; }
.ltm-confirm-footer { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }
```

- [ ] **Step 4: Build to confirm no compile errors**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/leave/feature/leave-types-management
git commit -m "feat(leave): add LeaveTypesManagementComponent"
```

---

### Task 6: Routes + nav wiring

**Files:**
- Create: `src/app/modules/leave/leave.routes.ts`
- Create: `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts`
- Create: `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.html`
- Create: `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.css`
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1: Create `TimeOffShellComponent`**

Create `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-time-off-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './time-off-shell.component.html',
  styleUrl: './time-off-shell.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeOffShellComponent {
  readonly menuItems = [
    { label: 'Leave Types', route: '/time-off/types' }
  ] as const;
}
```

Create `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.html`:

```html
<div class="tos-layout">
  <aside class="tos-sidebar" aria-label="Time Off sections">
    <h2 class="tos-heading">TIME OFF</h2>
    <nav class="tos-nav">
      @for (item of menuItems; track item.route) {
        <a
          class="tos-nav-link"
          [routerLink]="item.route"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          {{ item.label }}
        </a>
      }
    </nav>
  </aside>

  <section class="tos-content">
    <router-outlet />
  </section>
</div>
```

Create `src/app/modules/leave/feature/time-off-shell/time-off-shell.component.css`:

```css
.tos-layout { display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: calc(100vh - 4rem); }
.tos-sidebar { border-right: 1px solid var(--border, #e5e7eb); background: var(--surface-muted, #f8fafc); padding: 1.5rem 1rem; }
.tos-heading { color: var(--text-secondary, #6b7280); font-size: 0.75rem; font-weight: 600; letter-spacing: 0; margin: 0 0 1rem; }
.tos-nav { display: flex; flex-direction: column; gap: 0.25rem; }
.tos-nav-link { border-radius: 0.5rem; color: var(--text-secondary, #4b5563); display: block; padding: 0.75rem 1rem; text-decoration: none; }
.tos-nav-link.is-active { background: var(--primary-soft, #eef4ff); color: var(--primary, #2563eb); font-weight: 600; }
.tos-content { min-width: 0; padding: 1.5rem; }
@media (max-width: 768px) {
  .tos-layout { grid-template-columns: 1fr; }
  .tos-sidebar { border-right: 0; border-bottom: 1px solid var(--border, #e5e7eb); }
}
```

- [ ] **Step 2: `leave.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const LEAVE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/time-off-shell/time-off-shell.component').then((m) => m.TimeOffShellComponent),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'types' // Phase 3 changes this redirect to My Balances once that screen exists
      },
      {
        path: 'types',
        loadComponent: () =>
          import('./feature/leave-types-management/leave-types-management.component').then(
            (m) => m.LeaveTypesManagementComponent
          ),
        canActivate: [permissionGuard],
        data: { title: 'Leave Types', permissions: ['leave:read'] }
      }
    ]
  }
];
```

- [ ] **Step 3: Wire into `app.routes.ts`**

Replace line 64 (`{ path: 'time-off', loadComponent: loadPlaceholder, data: { title: 'Time Off' } },`) with:

```typescript
      {
        path: 'time-off',
        canActivate: [permissionGuard],
        data: { permissions: ['leave:read-own'], modules: ['leave'] },
        loadChildren: () => import('./modules/leave/leave.routes').then((module) => module.LEAVE_ROUTES)
      },
```

- [ ] **Step 4: Do NOT add main-sidebar nav children — leave `time-off` exactly as it is**

The design doc's original Nav structure decision (adding a single `leave:manage`-gated `time-off-types` child) is wrong and must not be applied: `canAccessNavItem()` (`nav-items/nav-access.ts:16-27`) treats **any** item with a non-empty `children` array as requiring `selfOk && children.some(reachable)` — the same rule that lets `Settings` hide/show purely from child permissions. Confirmed by running `nav-access.spec.ts`'s existing `'grants Time Off on the "leave" module key, not "time_off"'` test after adding the child: it fails, because the sole child requires `leave:manage`, which a regular employee (`leave:read-own` only) doesn't have — so `children.some(...)` is `false` and the **entire Time Off nav item disappears for every non-HR employee**, not just the Leave Types link.

Leave `nav-items.config.ts:73-79`'s `time-off` entry completely untouched in this task — no edit needed. The temporary cost: a regular employee who clicks "Time Off" (visible, since `requiredModules: ['leave']` still passes) lands on `/time-off` → redirects to `/time-off/types` → `permissionGuard` denies (`leave:read` required) → redirects to `/dashboard`. That's an acceptable interim gap for a phase that only ships an HR-only screen — it's strictly better than the nav item vanishing outright. Add main-sidebar `children` only once a `leave:read-own`-reachable destination exists (Phase 3's My Balances) — never with only `leave:manage`-gated entries. The inner Time Off sidebar is different: it lives inside the page and starts with only `Leave Types`, so it does not affect top-level sidebar visibility.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification (requires backend part-1 deployed and reachable)**

Start the dev server (`npm run dev` or this repo's documented dev command) and the backend API together. Log in as an `acme` tenant user holding the `HR Manager` role (now carrying `leave:manage` after the backend plan's Task 5). Navigate to `/time-off/types`: confirm the People-module-style inner sidebar renders with `TIME OFF` and only one item, `Leave Types`; confirm no unbuilt items such as Policies, Entitlements, Requests, Approvals, Calendar, Balances, or Audit appear yet. Confirm the empty state renders, create a leave type via the modal, confirm it appears in the table, edit it (confirm the Code field is disabled), deactivate it (confirm the plain "Active"/"Inactive" pending-request flow — no pending requests exist yet since Leave Requests don't ship until Phase 4, so deactivate should succeed without the confirmation dialog).

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/leave/leave.routes.ts src/app/modules/leave/feature/time-off-shell src/app/app.routes.ts
git commit -m "feat(leave): wire /time-off/types route and nav entry"
```

---

### Task 7: Update plan status

- [ ] **Step 1: Edit `plans/next/2026-08-21-leave-management/SUMMARY.md`** — change Phase 1's `**Status:**` line to "written in full — **executed 2026-08-21**, 7/7 tasks."

- [ ] **Step 2: Add a row to `plans/next/SUMMARY.md` and `plans/SUMMARY.md`** if not already present, per this repo's docs process (`docs/superpowers/rules/PROCESS_RULES.md`).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/next/2026-08-21-leave-management/SUMMARY.md docs/superpowers/plans/next/SUMMARY.md docs/superpowers/plans/SUMMARY.md
git commit -m "docs(leave): mark frontend Phase 1 executed"
```
