# API Layer Shared Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the frontend one way to build query strings and call the API (`toHttpParams`, `dateOnly`, `ApiClient`), move the whole Leave module onto it as the reference, write the rules down, and stop new hand-built `HttpParams` from coming back.

**Source task:** `docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md` (priority 4, 1 person, 1 day, no dependencies).

**Architecture:** A pure function `toHttpParams(obj)` in `shared/data-access/api-params.ts` does all query-string rules (skip `null`/`undefined`/`''`, keep `false` and `0`, `Date` → ISO, arrays → repeated key). A root `ApiClient` in `shared/data-access/api-client.ts` wraps `HttpClient`, always prefixes `environment.apiUrl`, and runs every `params` object through `toHttpParams`. Module API services keep returning backend DTOs unchanged; only their plumbing changes. A baseline guard script (same pattern as `scripts/check-hardcoded-colors.mjs`) blocks new `new HttpParams(` outside the helper and prints the per-module migration list.

**Tech Stack:** Angular 21, `@angular/common/http`, Vitest via `@angular/build:unit-test` (`HttpTestingController`), Node ESM scripts.

---

## Before you start

- **Branch:** work from a fresh branch off `origin/Development`, **not** the current `feat/meeting-details-schedule-card` checkout (it is 53 commits ahead and has uncommitted work). Use a worktree:

  ```powershell
  git -C C:\HR2\Hrms--Web-application---front-end---v1 fetch origin
  git -C C:\HR2\Hrms--Web-application---front-end---v1 worktree add ..\_wt-api-helpers -b chore/api-layer-shared-helpers origin/Development
  ```

  All paths below are relative to that worktree root. Run `npm install` there once (it also turns on the pre-push hook).
- **Bring this plan into the worktree first.** It was written on `feat/meeting-details-schedule-card` and is not on `origin/Development`. Copy `docs/superpowers/plans/next/2026-11-18-api-layer-shared-helpers.md` into the worktree, add the same two index rows there (`docs/superpowers/plans/SUMMARY.md` table row and the `docs/superpowers/plans/next/SUMMARY.md` bullet), and commit them as the first commit (`docs(plans): add API layer shared helpers plan`). In the old checkout, `next/SUMMARY.md` also holds someone else's uncommitted edit, so do not copy that file over wholesale: add only this plan's bullet.
- The Leave services, Leave models, `package.json`, `scripts/` and `docs/core/ARCHITECTURE.md` were checked on 2026-11-18 and are identical on `origin/Development` and the branch this plan was written from, so the full-file replacements in Task 4 are safe. If you start much later, re-run `git diff --stat origin/Development -- src/app/modules/leave/data-access` against the plan's date and re-check any file that changed.
- **Behaviour must not change.** Every Leave request must send exactly the same URL and query string as today. The existing Leave specs match the full URL including query order (`expectOne(\`...?year=2026&departmentId=dept-1&search=anu\`)`), so they are the safety net. Task 1 adds the missing cases before anything moves.
- **Query key order = object literal key order.** In migrated services, always build the params object as an explicit literal in the same order the old `.set()` calls used. Never pass a caller's filter object straight through: its key order (and any extra fields) would leak into the URL.
- **Zero warnings rule (CLAUDE.md):** `npm run lint` must report 0 errors / 0 warnings, and `npm run check:warnings` must be clean before you finish.
- **Single-spec command used in this plan:**

  ```powershell
  npx ng test --watch=false --include="src/app/modules/leave/data-access/**/*.spec.ts"
  ```

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/app/shared/data-access/api-params.ts` | Create | `toHttpParams()`, `dateOnly()`: the only place that builds `HttpParams` |
| `src/app/shared/data-access/api-params.spec.ts` | Create | Unit tests: empty values, `false`/`0`, dates, arrays, order, bad input |
| `src/app/shared/models/paged-result.model.ts` | Create | Shared `PagedResult<T>` list shape (`items`, `pageNumber`, `pageSize`, `totalCount`) |
| `src/app/shared/data-access/api-client.ts` | Create | `ApiClient`: `get`, `getPage`, `getBlob`, `post`, `postBlob`, `put`, `delete` on `environment.apiUrl` |
| `src/app/shared/data-access/api-client.spec.ts` | Create | Unit tests for URL building, params, methods, blob |
| `src/app/modules/leave/data-access/*-api.service.ts` (8 files) | Modify | Use `ApiClient`; no `HttpClient`/`HttpParams` imports left |
| `src/app/modules/leave/data-access/{leave-balance,leave-calendar,leave-request,leave-entitlement,leave-approval}-api.service.spec.ts` | Modify | Append safety-net query-string tests (Task 1) |
| `scripts/check-http-params.mjs` | Create | Guard + `--update` + `--report` |
| `scripts/http-params-baseline.json` | Create (generated) | Allowed `new HttpParams(` count per not-yet-migrated file; may only shrink |
| `package.json` | Modify | Add guard to `lint`, add `check:http-params` |
| `docs/core/ARCHITECTURE.md` | Modify | Replace stale §5.1 (envelope example) with the real API layer rules |
| `docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md` | Modify | Append generated "Remaining modules" table |

`getPage` and `PagedResult` are added with unit tests only. Leave has no paged endpoint, and the two existing paged DTOs (`attendance/models/time-tracking.model.ts`, `work/models/dto/project.dto.ts`) are **not** migrated in this task; they are listed for the next pass.

Naming note: the task text says `getOne`. This plan names it `get<T>` because Leave uses it for both single objects and arrays; `getOne` would read wrong on list calls.

---

### Task 1: Safety-net tests for Leave query strings (on the old code)

These must pass **before** any migration. They lock in today's exact URLs for the filter-heavy methods that the current specs only partly cover (`false`, `0`, empty string, full key order).

**Files:**
- Modify: `src/app/modules/leave/data-access/leave-balance-api.service.spec.ts` (append)
- Modify: `src/app/modules/leave/data-access/leave-calendar-api.service.spec.ts` (append)
- Modify: `src/app/modules/leave/data-access/leave-request-api.service.spec.ts` (append)
- Modify: `src/app/modules/leave/data-access/leave-entitlement-api.service.spec.ts` (append)
- Modify: `src/app/modules/leave/data-access/leave-approval-api.service.spec.ts` (append)

Each block is a separate top-level `describe` appended at the **end** of the file, with its own TestBed setup, so you never have to edit the existing one-line specs. The imports at the top of each file already include `provideHttpClient`, `HttpTestingController`, `provideHttpClientTesting`, `TestBed` and `environment`. Add any missing service import shown.

- [ ] **Step 1: Append to `leave-balance-api.service.spec.ts`**

```ts

describe('LeaveBalanceApiService query strings (API helper safety net)', () => {
  let service: LeaveBalanceApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveBalanceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveBalanceApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('team sends every filter in a fixed order', () => {
    service.team(2026, { search: 'anu', leaveTypeId: 'type-1', departmentId: 'dept-1' }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/balances/team?year=2026&departmentId=dept-1&leaveTypeId=type-1&search=anu`).flush([]);
  });

  it('all sends employmentStatusId 0 and skips an empty search', () => {
    service.all(2026, { employmentStatusId: 0, search: '' }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/balances/all?year=2026&employmentStatusId=0`).flush([]);
  });

  it('all sends every filter in a fixed order', () => {
    service
      .all(2026, { search: 'anu', employmentStatusId: 2, leaveTypeId: 'type-1', departmentId: 'dept-1', legalEntityId: 'le-1' })
      .subscribe();
    http
      .expectOne(
        `${environment.apiUrl}/leave/balances/all?year=2026&legalEntityId=le-1&departmentId=dept-1&leaveTypeId=type-1&employmentStatusId=2&search=anu`
      )
      .flush([]);
  });
});
```

- [ ] **Step 2: Append to `leave-calendar-api.service.spec.ts`**

```ts

describe('LeaveCalendarApiService query strings (API helper safety net)', () => {
  let service: LeaveCalendarApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveCalendarApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveCalendarApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends includeTentative=false when it is false', () => {
    service.getMonth({ year: 2026, month: 9, includeTentative: false }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/calendar?year=2026&month=9&includeTentative=false`).flush({});
  });

  it('lists holidays for a from/to range', () => {
    service.listHolidays('2026-01-01', '2026-12-31').subscribe();
    http.expectOne(`${environment.apiUrl}/leave/holidays?from=2026-01-01&to=2026-12-31`).flush([]);
  });
});
```

- [ ] **Step 3: Append to `leave-request-api.service.spec.ts`**

```ts

describe('LeaveRequestApiService query strings (API helper safety net)', () => {
  let service: LeaveRequestApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveRequestApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveRequestApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listMine sends every filter in a fixed order', () => {
    service.listMine({ leaveTypeId: 'type-1', toDate: '2026-12-31', fromDate: '2026-01-01', status: 'pending' }).subscribe();
    http
      .expectOne(`${environment.apiUrl}/leave/requests/my?status=pending&fromDate=2026-01-01&toDate=2026-12-31&leaveTypeId=type-1`)
      .flush([]);
  });

  it('listMine skips empty filters', () => {
    service.listMine({ status: '' }).subscribe();
    http.expectOne(`${environment.apiUrl}/leave/requests/my`).flush([]);
  });
});
```

- [ ] **Step 4: Append to `leave-entitlement-api.service.spec.ts`**

```ts

describe('LeaveEntitlementApiService query strings (API helper safety net)', () => {
  let service: LeaveEntitlementApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveEntitlementApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveEntitlementApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list sends every filter in a fixed order', () => {
    service.list(2026, { search: 'anu', leaveTypeId: 'type-1', departmentId: 'dept-1', legalEntityId: 'le-1' }).subscribe();
    http
      .expectOne(`${environment.apiUrl}/leave/entitlements?year=2026&legalEntityId=le-1&departmentId=dept-1&leaveTypeId=type-1&search=anu`)
      .flush([]);
  });

  it('balance audit sends every filter, then page and pageSize', () => {
    service
      .listBalanceAudit(
        { toDate: '2026-12-31', fromDate: '2026-01-01', changeType: 'accrual', leaveTypeId: 'type-1', employeeId: 'emp-1' },
        2,
        50
      )
      .subscribe();
    http
      .expectOne(
        `${environment.apiUrl}/leave/balance-audit?employeeId=emp-1&leaveTypeId=type-1&changeType=accrual&fromDate=2026-01-01&toDate=2026-12-31&page=2&pageSize=50`
      )
      .flush([]);
  });
});
```

- [ ] **Step 5: Append to `leave-approval-api.service.spec.ts`**

```ts

describe('LeaveApprovalApiService query strings (API helper safety net)', () => {
  let service: LeaveApprovalApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveApprovalApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeaveApprovalApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listAll sends every filter in a fixed order with status last', () => {
    service
      .listAll({ status: 'approved', toDate: '2026-01-31', fromDate: '2026-01-01', leaveTypeId: 'type-1', search: 'anu' })
      .subscribe();
    http
      .expectOne(
        `${environment.apiUrl}/leave/requests/all?search=anu&leaveTypeId=type-1&fromDate=2026-01-01&toDate=2026-01-31&status=approved`
      )
      .flush([]);
  });
});
```

- [ ] **Step 6: Run the Leave data-access specs on the OLD code**

Run: `npx ng test --watch=false --include="src/app/modules/leave/data-access/**/*.spec.ts"`
Expected: all PASS, no warnings. If a new test fails here, the expected URL is wrong, not the service: fix the expectation to match today's behaviour, never the service.

- [ ] **Step 7: Commit**

```powershell
git add src/app/modules/leave/data-access/*.spec.ts
git commit -m "test(leave): lock current API query strings before helper migration"
```

---

### Task 2: `toHttpParams` and `dateOnly`

**Files:**
- Create: `src/app/shared/data-access/api-params.ts`
- Test: `src/app/shared/data-access/api-params.spec.ts`

Rules the helper implements (from the task):
- skips `null`, `undefined` and `''`
- **keeps `false` and `0`** (Leave sends `includeInactive=false`, `confirmed=false`, `includeTentative=false`, `employmentStatusId=0`)
- strings pass through unchanged (Leave already sends date-only strings like `2026-01-01`)
- a `Date` becomes a full UTC ISO instant (`toISOString()`)
- date-only values go through `dateOnly(date)`, which uses the **local calendar day**. Never `toISOString().slice(0, 10)`: that shifts the day for anyone east or west of UTC, which is the exact bug the task describes.
- arrays repeat the key (`id=a&id=b`), skipping empty items; an empty array sends nothing
- keys keep the order of the object literal
- anything else (objects, `NaN`, invalid `Date`) throws, so a bug shows up in tests instead of as `[object Object]` in a URL

It takes `T extends object`, not `Record<string, …>`: the Leave filter types are `interface`s, which have no index signature and would not compile against a `Record`.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/data-access/api-params.spec.ts`:

```ts
import { dateOnly, toHttpParams } from './api-params';

describe('toHttpParams', () => {
  it('returns empty params for an empty object', () => {
    expect(toHttpParams({}).keys()).toEqual([]);
  });

  it('skips null, undefined and empty strings', () => {
    const params = toHttpParams({ a: null, b: undefined, c: '', d: 'x' });
    expect(params.keys()).toEqual(['d']);
    expect(params.get('d')).toBe('x');
  });

  it('keeps false and 0', () => {
    const params = toHttpParams({ includeInactive: false, employmentStatusId: 0 });
    expect(params.get('includeInactive')).toBe('false');
    expect(params.get('employmentStatusId')).toBe('0');
  });

  it('keeps strings unchanged, including whitespace-only ones', () => {
    expect(toHttpParams({ fromDate: '2026-01-01', search: ' ' }).toString()).toBe('fromDate=2026-01-01&search=%20');
  });

  it('keeps the key order of the object literal', () => {
    expect(toHttpParams({ year: 2026, departmentId: 'd1', search: 'anu' }).toString()).toBe('year=2026&departmentId=d1&search=anu');
  });

  it('sends a Date as a full UTC ISO instant', () => {
    const at = new Date(Date.UTC(2026, 0, 15, 9, 30, 0));
    expect(toHttpParams({ at }).get('at')).toBe('2026-01-15T09:30:00.000Z');
  });

  it('repeats the key for arrays and skips empty items', () => {
    const params = toHttpParams({ ids: ['a', '', null, 'b'] });
    expect(params.getAll('ids')).toEqual(['a', 'b']);
    expect(params.toString()).toBe('ids=a&ids=b');
  });

  it('sends nothing for an empty array', () => {
    expect(toHttpParams({ ids: [] }).keys()).toEqual([]);
  });

  it('throws on an invalid Date', () => {
    expect(() => toHttpParams({ at: new Date('nope') })).toThrowError('toHttpParams: "at" is an invalid Date');
  });

  it('throws on NaN', () => {
    expect(() => toHttpParams({ page: Number.NaN })).toThrowError('toHttpParams: "page" is not a finite number');
  });

  it('throws on a nested object', () => {
    expect(() => toHttpParams({ filter: { a: 1 } })).toThrowError('toHttpParams: "filter" has unsupported type object');
  });

  it('accepts an interface-typed value', () => {
    interface Filter { search?: string; leaveTypeId?: string; }
    const filter: Filter = { search: 'anu' };
    expect(toHttpParams(filter).toString()).toBe('search=anu');
  });
});

describe('dateOnly', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(dateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('keeps the local day late in the evening (no UTC shift)', () => {
    expect(dateOnly(new Date(2026, 0, 15, 23, 30))).toBe('2026-01-15');
  });

  it('keeps the local day just after midnight (no UTC shift)', () => {
    expect(dateOnly(new Date(2026, 11, 31, 0, 15))).toBe('2026-12-31');
  });

  it('throws on an invalid Date', () => {
    expect(() => dateOnly(new Date('nope'))).toThrowError('dateOnly: invalid Date');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --watch=false --include="src/app/shared/data-access/api-params.spec.ts"`
Expected: FAIL, cannot resolve `./api-params`.

- [ ] **Step 3: Write the implementation**

Create `src/app/shared/data-access/api-params.ts`:

```ts
import { HttpParams } from '@angular/common/http';

/**
 * The one place that turns a plain object into query-string params for the ONEVO API.
 *
 * - skips null, undefined and '' (an empty filter must not reach the backend as a value)
 * - keeps false and 0
 * - strings pass through unchanged; use dateOnly() for date-only values
 * - a Date becomes a full UTC ISO instant
 * - arrays repeat the key (ids=a&ids=b), skipping empty items
 * - keys keep the order of the object literal
 *
 * Takes `object` rather than a Record so interface-typed filters can be passed in.
 */
export function toHttpParams<T extends object>(values: T): HttpParams {
  let params = new HttpParams();
  for (const [key, raw] of Object.entries(values) as [string, unknown][]) {
    const items: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      const value = formatParam(key, item);
      if (value !== null) params = params.append(key, value);
    }
  }
  return params;
}

/** A date-only value (yyyy-MM-dd) for the local calendar day. Never shifts the day through UTC. */
export function dateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error('dateOnly: invalid Date');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatParam(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`toHttpParams: "${key}" is not a finite number`);
    return String(value);
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Error(`toHttpParams: "${key}" is an invalid Date`);
    return value.toISOString();
  }
  throw new Error(`toHttpParams: "${key}" has unsupported type ${typeof value}`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --watch=false --include="src/app/shared/data-access/api-params.spec.ts"`
Expected: PASS (16 tests), no warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/app/shared/data-access/api-params.ts src/app/shared/data-access/api-params.spec.ts
git commit -m "feat(shared): add toHttpParams and dateOnly query helpers"
```

---

### Task 3: `PagedResult<T>` and `ApiClient`

**Files:**
- Create: `src/app/shared/models/paged-result.model.ts`
- Create: `src/app/shared/data-access/api-client.ts`
- Test: `src/app/shared/data-access/api-client.spec.ts`

`environment.apiUrl` has no trailing slash (every service today writes `${environment.apiUrl}/leave/...`), so paths must start with `/`. `url()` throws otherwise, which also rules out a double slash.

Blob downloads (Leave has a GET export and a POST export) get their own `getBlob` / `postBlob`, so Leave can drop `HttpClient` completely. FormData uploads go through `post` unchanged: `HttpClient` sets the multipart header itself.

- [ ] **Step 1: Create the shared paged type**

Create `src/app/shared/models/paged-result.model.ts`:

```ts
/**
 * The backend's paged list shape (ONEVO PagedResult<T>). Some endpoints add totalPages / hasNext /
 * hasPrevious; extend this interface in the module model for those instead of redefining items/totalCount.
 */
export interface PagedResult<T> {
  readonly items: readonly T[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/app/shared/data-access/api-client.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { ApiClient } from './api-client';

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('builds urls on environment.apiUrl with exactly one slash', () => {
    expect(api.url('/leave/types')).toBe(`${environment.apiUrl}/leave/types`);
    expect(api.url('/leave/types')).not.toContain('//leave');
  });

  it('rejects a path without a leading slash', () => {
    expect(() => api.url('leave/types')).toThrowError("ApiClient: path must start with '/': leave/types");
  });

  it('get sends params through toHttpParams', () => {
    let body: readonly string[] | undefined;
    api.get<readonly string[]>('/leave/types', { params: { includeInactive: false, search: '' } }).subscribe((r) => (body = r));
    const req = http.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`);
    expect(req.request.method).toBe('GET');
    req.flush(['a']);
    expect(body).toEqual(['a']);
  });

  it('get without params sends no query string', () => {
    api.get<unknown>('/leave/balances/work-window').subscribe();
    http.expectOne(`${environment.apiUrl}/leave/balances/work-window`).flush({});
  });

  it('getPage returns the paged shape', () => {
    const page: PagedResult<string> = { items: ['a'], pageNumber: 2, pageSize: 25, totalCount: 26 };
    let result: PagedResult<string> | undefined;
    api.getPage<string>('/employees', { params: { pageNumber: 2, pageSize: 25 } }).subscribe((r) => (result = r));
    http.expectOne(`${environment.apiUrl}/employees?pageNumber=2&pageSize=25`).flush(page);
    expect(result).toEqual(page);
  });

  it('getBlob asks for a blob response', () => {
    api.getBlob('/leave/balance-audit/export', { params: { leaveTypeId: 'type-1' } }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/balance-audit/export?leaveTypeId=type-1`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['x']));
  });

  it('post sends the body and optional params', () => {
    api.post<void>('/leave/types/t1/deactivate', {}, { params: { confirmed: false } }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/types/t1/deactivate?confirmed=false`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);
  });

  it('post passes FormData through untouched', () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'x.pdf'));
    api.post<unknown>('/leave/requests/documents', form).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/requests/documents`);
    expect(req.request.body).toBe(form);
    req.flush({});
  });

  it('postBlob posts the body and asks for a blob response', () => {
    api.postBlob('/leave/entitlements/generate/preview/export', { year: 2026 }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/leave/entitlements/generate/preview/export`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('blob');
    expect(req.request.body).toEqual({ year: 2026 });
    req.flush(new Blob(['x']));
  });

  it('put sends the body', () => {
    api.put<void>('/employees/e1/leave-policies/t1', { policyId: 'p1' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/employees/e1/leave-policies/t1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ policyId: 'p1' });
    req.flush(null);
  });

  it('delete sends a DELETE', () => {
    api.delete('/leave/holidays/h1').subscribe();
    expect(http.expectOne(`${environment.apiUrl}/leave/holidays/h1`).request.method).toBe('DELETE');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx ng test --watch=false --include="src/app/shared/data-access/api-client.spec.ts"`
Expected: FAIL, cannot resolve `./api-client`.

- [ ] **Step 4: Write the implementation**

Create `src/app/shared/data-access/api-client.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResult } from '../models/paged-result.model';
import { toHttpParams } from './api-params';

export interface ApiRequestOptions {
  /** Plain object; goes through toHttpParams (skips empty values, keeps false/0, key order kept). */
  readonly params?: object;
}

/**
 * Thin HttpClient wrapper for the ONEVO API. Always targets environment.apiUrl and always builds the
 * query string with toHttpParams. Module API services use this instead of HttpClient/HttpParams and
 * return backend DTOs unchanged; mapping to view models lives in the store or a mapper file.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  /** `path` must start with '/', e.g. '/leave/types'. */
  url(path: string): string {
    if (!path.startsWith('/')) throw new Error(`ApiClient: path must start with '/': ${path}`);
    return `${environment.apiUrl}${path}`;
  }

  get<T>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.get<T>(this.url(path), { params: toHttpParams(options.params ?? {}) });
  }

  getPage<T>(path: string, options: ApiRequestOptions = {}): Observable<PagedResult<T>> {
    return this.http.get<PagedResult<T>>(this.url(path), { params: toHttpParams(options.params ?? {}) });
  }

  getBlob(path: string, options: ApiRequestOptions = {}): Observable<Blob> {
    return this.http.get(this.url(path), { params: toHttpParams(options.params ?? {}), responseType: 'blob' });
  }

  post<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.post<T>(this.url(path), body, { params: toHttpParams(options.params ?? {}) });
  }

  postBlob(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<Blob> {
    return this.http.post(this.url(path), body, { params: toHttpParams(options.params ?? {}), responseType: 'blob' });
  }

  put<T>(path: string, body: unknown, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.put<T>(this.url(path), body, { params: toHttpParams(options.params ?? {}) });
  }

  delete<T = void>(path: string, options: ApiRequestOptions = {}): Observable<T> {
    return this.http.delete<T>(this.url(path), { params: toHttpParams(options.params ?? {}) });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx ng test --watch=false --include="src/app/shared/data-access/api-client.spec.ts"`
Expected: PASS (11 tests), no warnings.

- [ ] **Step 6: Commit**

```powershell
git add src/app/shared/models/paged-result.model.ts src/app/shared/data-access/api-client.ts src/app/shared/data-access/api-client.spec.ts
git commit -m "feat(shared): add ApiClient and shared PagedResult type"
```

---

### Task 4: Move the Leave module onto `ApiClient`

Replace each file's **whole content** with the code below. Public method names, argument lists and return types do not change, so stores, components and the existing specs keep working. After this task no Leave service imports `HttpClient` or `HttpParams`.

**Files (all in `src/app/modules/leave/data-access/`):**
- Modify: `employee-leave-policy-api.service.ts`
- Modify: `leave-approval-api.service.ts`
- Modify: `leave-balance-api.service.ts`
- Modify: `leave-calendar-api.service.ts`
- Modify: `leave-entitlement-api.service.ts`
- Modify: `leave-policy-api.service.ts`
- Modify: `leave-request-api.service.ts`
- Modify: `leave-type-api.service.ts`

- [ ] **Step 1: `employee-leave-policy-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { EmployeeLeavePolicyRow } from '../models/leave-policy.model';

/** Client for /api/v1/employees/{employeeId}/leave-policies. */
@Injectable({ providedIn: 'root' })
export class EmployeeLeavePolicyApiService {
  private readonly api = inject(ApiClient);

  private path(employeeId: string): string {
    return `/employees/${employeeId}/leave-policies`;
  }

  list(employeeId: string): Observable<readonly EmployeeLeavePolicyRow[]> {
    return this.api.get<readonly EmployeeLeavePolicyRow[]>(this.path(employeeId));
  }

  set(employeeId: string, leaveTypeId: string, policyId: string): Observable<void> {
    return this.api.put<void>(`${this.path(employeeId)}/${leaveTypeId}`, { policyId });
  }

  reset(employeeId: string, leaveTypeId: string): Observable<void> {
    return this.api.delete<void>(`${this.path(employeeId)}/${leaveTypeId}`);
  }
}
```

- [ ] **Step 2: `leave-approval-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  ApproveLeaveRequestRequest,
  ChangeLeaveDecisionRequest,
  LeaveApprovalDecisionResponse,
  LeaveApprovalDetailResponse,
  LeaveApprovalListFilter,
  LeavePendingApprovalListItemResponse,
  LeaveRequestAllListFilter,
  LeaveRequestAllListItemResponse,
  RejectLeaveRequestRequest
} from '../models/leave-approval.model';
import { CancelLeaveRequestRequest, CancelLeaveRequestResponse } from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveApprovalsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveApprovalApiService {
  private readonly api = inject(ApiClient);

  listAll(filter: LeaveRequestAllListFilter): Observable<LeaveRequestAllListItemResponse[]> {
    return this.api.get<LeaveRequestAllListItemResponse[]>('/leave/requests/all', {
      params: { ...listParams(filter), status: filter.status }
    });
  }

  /** Requests waiting on the caller's decision (leave:approve). */
  listPendingApprovals(): Observable<LeavePendingApprovalListItemResponse[]> {
    return this.api.get<LeavePendingApprovalListItemResponse[]>('/leave/requests/pending-approvals');
  }

  getDetail(requestId: string): Observable<LeaveApprovalDetailResponse> {
    return this.api.get<LeaveApprovalDetailResponse>(`/leave/requests/${requestId}/approval`);
  }

  /** HR's read-only view (leave:read) of any request, used by the All Requests ledger. */
  getLedgerDetail(requestId: string): Observable<LeaveApprovalDetailResponse> {
    return this.api.get<LeaveApprovalDetailResponse>(`/leave/requests/${requestId}/detail`);
  }

  approve(requestId: string, payload: ApproveLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.api.post<LeaveApprovalDecisionResponse>(`/leave/requests/${requestId}/approve`, payload);
  }

  reject(requestId: string, payload: RejectLeaveRequestRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.api.post<LeaveApprovalDecisionResponse>(`/leave/requests/${requestId}/reject`, payload);
  }

  changeDecision(requestId: string, payload: ChangeLeaveDecisionRequest): Observable<LeaveApprovalDecisionResponse> {
    return this.api.post<LeaveApprovalDecisionResponse>(`/leave/requests/${requestId}/change-decision`, payload);
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.api.post<CancelLeaveRequestResponse>(`/leave/requests/${requestId}/cancel`, payload);
  }
}

/** Key order here is the query-string order the backend and specs expect. */
function listParams(filter: LeaveApprovalListFilter): object {
  return { search: filter.search, leaveTypeId: filter.leaveTypeId, fromDate: filter.fromDate, toDate: filter.toDate };
}
```

- [ ] **Step 3: `leave-balance-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { LeaveBalanceAllFilter, LeaveBalanceResponse, LeaveBalanceTeamFilter, LeaveWorkWindowResponse } from '../models/leave-balance.model';

/** Client for ONEVO.Api's LeaveBalancesController at /api/v1/leave/balances. */
@Injectable({ providedIn: 'root' })
export class LeaveBalanceApiService {
  private readonly api = inject(ApiClient);

  my(year: number): Observable<LeaveBalanceResponse[]> {
    return this.api.get<LeaveBalanceResponse[]>('/leave/balances/my', { params: { year } });
  }

  team(year: number, filter: LeaveBalanceTeamFilter): Observable<LeaveBalanceResponse[]> {
    return this.api.get<LeaveBalanceResponse[]>('/leave/balances/team', {
      params: { year, departmentId: filter.departmentId, leaveTypeId: filter.leaveTypeId, search: filter.search }
    });
  }

  all(year: number, filter: LeaveBalanceAllFilter): Observable<LeaveBalanceResponse[]> {
    return this.api.get<LeaveBalanceResponse[]>('/leave/balances/all', {
      params: {
        year,
        legalEntityId: filter.legalEntityId,
        departmentId: filter.departmentId,
        leaveTypeId: filter.leaveTypeId,
        employmentStatusId: filter.employmentStatusId,
        search: filter.search
      }
    });
  }

  workWindow(): Observable<LeaveWorkWindowResponse> {
    return this.api.get<LeaveWorkWindowResponse>('/leave/balances/work-window');
  }
}
```

- [ ] **Step 4: `leave-calendar-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { CreateLeaveHolidayRequest, LeaveCalendarFilter, LeaveCalendarMonthResponse, LeaveHolidayResponse } from '../models/leave-calendar.model';

/** Client for ONEVO.Api's LeaveCalendarController at /api/v1/leave/calendar. */
@Injectable({ providedIn: 'root' })
export class LeaveCalendarApiService {
  private readonly api = inject(ApiClient);

  getMonth(filter: LeaveCalendarFilter): Observable<LeaveCalendarMonthResponse> {
    return this.api.get<LeaveCalendarMonthResponse>('/leave/calendar', {
      params: { year: filter.year, month: filter.month, departmentId: filter.departmentId, includeTentative: filter.includeTentative }
    });
  }

  listHolidays(from: string, to: string): Observable<LeaveHolidayResponse[]> {
    return this.api.get<LeaveHolidayResponse[]>('/leave/holidays', { params: { from, to } });
  }

  createHoliday(payload: CreateLeaveHolidayRequest): Observable<LeaveHolidayResponse> {
    return this.api.post<LeaveHolidayResponse>('/leave/holidays', payload);
  }

  deleteHoliday(id: string): Observable<void> {
    return this.api.delete<void>(`/leave/holidays/${id}`);
  }
}
```

- [ ] **Step 5: `leave-entitlement-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  LeaveBalanceAuditListFilter,
  LeaveBalanceAuditResponse,
  LeaveEntitlementGenerationPreviewResponse,
  LeaveEntitlementGenerationResultResponse,
  LeaveEntitlementListFilter,
  LeaveEntitlementResponse,
  RecalculateEntitlementRequest
} from '../models/leave-entitlement.model';

/** Client for ONEVO.Api's LeaveEntitlementsController at /api/v1/leave/entitlements. */
@Injectable({ providedIn: 'root' })
export class LeaveEntitlementApiService {
  private readonly api = inject(ApiClient);

  list(year: number, filter: LeaveEntitlementListFilter): Observable<LeaveEntitlementResponse[]> {
    return this.api.get<LeaveEntitlementResponse[]>('/leave/entitlements', {
      params: {
        year,
        legalEntityId: filter.legalEntityId,
        departmentId: filter.departmentId,
        leaveTypeId: filter.leaveTypeId,
        search: filter.search
      }
    });
  }

  previewGenerate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationPreviewResponse> {
    return this.api.post<LeaveEntitlementGenerationPreviewResponse>('/leave/entitlements/generate/preview', payload);
  }

  generate(payload: GenerateEntitlementsRequest): Observable<LeaveEntitlementGenerationResultResponse> {
    return this.api.post<LeaveEntitlementGenerationResultResponse>('/leave/entitlements/generate', payload);
  }

  createManual(payload: CreateManualEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.api.post<LeaveEntitlementResponse>('/leave/entitlements/manual', payload);
  }

  adjust(entitlementId: string, payload: AdjustEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.api.put<LeaveEntitlementResponse>(`/leave/entitlements/${entitlementId}/adjust`, payload);
  }

  recalculate(entitlementId: string, payload: RecalculateEntitlementRequest): Observable<LeaveEntitlementResponse> {
    return this.api.post<LeaveEntitlementResponse>(`/leave/entitlements/${entitlementId}/recalculate`, payload);
  }

  listBalanceAudit(filter: LeaveBalanceAuditListFilter, page: number, pageSize: number): Observable<LeaveBalanceAuditResponse[]> {
    return this.api.get<LeaveBalanceAuditResponse[]>('/leave/balance-audit', {
      params: { ...auditParams(filter), page, pageSize }
    });
  }

  exportBalanceAudit(filter: LeaveBalanceAuditListFilter): Observable<Blob> {
    return this.api.getBlob('/leave/balance-audit/export', { params: auditParams(filter) });
  }

  exportGeneratePreview(payload: GenerateEntitlementsRequest): Observable<Blob> {
    return this.api.postBlob('/leave/entitlements/generate/preview/export', payload);
  }
}

/** Key order here is the query-string order the backend and specs expect. */
function auditParams(filter: LeaveBalanceAuditListFilter): object {
  return {
    employeeId: filter.employeeId,
    leaveTypeId: filter.leaveTypeId,
    changeType: filter.changeType,
    fromDate: filter.fromDate,
    toDate: filter.toDate
  };
}
```

- [ ] **Step 6: `leave-policy-api.service.ts`**

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  AddLeavePolicyVersionRequest,
  CreateLeavePolicyRequest,
  LeavePolicyAssignmentConflict,
  LeavePolicyAssignmentTarget,
  LeavePolicyConflictError,
  LeavePolicyDetail,
  LeavePolicyListItem,
  UpdateLeavePolicyDetailsRequest
} from '../models/leave-policy.model';

const CONFLICT_CODE = 'leave_policy.assignment_conflict';
const BASE = '/leave/policies';

/** Client for ONEVO.Api's LeavePoliciesController at /api/v1/leave/policies. */
@Injectable({ providedIn: 'root' })
export class LeavePolicyApiService {
  private readonly api = inject(ApiClient);

  list(includeInactive = false): Observable<readonly LeavePolicyListItem[]> {
    return this.api.get<readonly LeavePolicyListItem[]>(BASE, { params: { includeInactive } });
  }

  get(policyId: string): Observable<LeavePolicyDetail> {
    return this.api.get<LeavePolicyDetail>(`${BASE}/${policyId}`);
  }

  /** Emits the new policy id, or errors with LeavePolicyConflictError. */
  create(payload: CreateLeavePolicyRequest): Observable<string> {
    return this.api.post<{ id: string }>(BASE, payload).pipe(map((r) => r.id), catchError(toConflictError));
  }

  updateDetails(policyId: string, payload: UpdateLeavePolicyDetailsRequest): Observable<void> {
    return this.api.put<void>(`${BASE}/${policyId}`, payload);
  }

  addVersion(policyId: string, payload: AddLeavePolicyVersionRequest): Observable<string> {
    return this.api.post<string>(`${BASE}/${policyId}/versions`, payload);
  }

  deleteVersion(policyId: string, versionId: string): Observable<void> {
    return this.api.delete<void>(`${BASE}/${policyId}/versions/${versionId}`);
  }

  setAssignments(
    policyId: string, assignments: readonly LeavePolicyAssignmentTarget[], replaceConflicts: boolean
  ): Observable<void> {
    return this.api
      .put<unknown>(`${BASE}/${policyId}/assignments`, { assignments, replaceConflicts })
      .pipe(map(() => undefined), catchError(toConflictError));
  }

  setActive(policyId: string, isActive: boolean): Observable<void> {
    return this.api.post<void>(`${BASE}/${policyId}/${isActive ? 'activate' : 'deactivate'}`, {});
  }

  clone(policyId: string, name: string): Observable<string> {
    return this.api.post<string>(`${BASE}/${policyId}/clone`, { name });
  }
}

function toConflictError(err: unknown): Observable<never> {
  if (err instanceof HttpErrorResponse && err.status === 409) {
    const body = err.error as { code?: string; conflicts?: LeavePolicyAssignmentConflict[] } | null;
    if (body?.code === CONFLICT_CODE)
      return throwError(() => new LeavePolicyConflictError(body.conflicts ?? []));
  }
  return throwError(() => err);
}
```

- [ ] **Step 7: `leave-request-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import {
  CancelLeaveRequestRequest,
  CancelLeaveRequestResponse,
  LeaveRequestListFilter,
  LeaveRequestListItemResponse,
  LeaveRequestResponse,
  LeaveUploadedDocument,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest
} from '../models/leave-request.model';

/** Client for ONEVO.Api's LeaveRequestsController at /api/v1/leave/requests. */
@Injectable({ providedIn: 'root' })
export class LeaveRequestApiService {
  private readonly api = inject(ApiClient);

  uploadDocument(file: File): Observable<LeaveUploadedDocument> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.post<LeaveUploadedDocument>('/leave/requests/documents', form);
  }

  preview(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.api.post<LeaveRequestResponse>('/leave/requests/preview', payload);
  }

  submit(payload: SubmitLeaveRequestRequest): Observable<LeaveRequestResponse> {
    return this.api.post<LeaveRequestResponse>('/leave/requests', payload);
  }

  submitOnBehalf(payload: SubmitLeaveRequestOnBehalfRequest): Observable<LeaveRequestResponse> {
    return this.api.post<LeaveRequestResponse>('/leave/requests/on-behalf', payload);
  }

  listMine(filter: LeaveRequestListFilter): Observable<LeaveRequestListItemResponse[]> {
    return this.api.get<LeaveRequestListItemResponse[]>('/leave/requests/my', {
      params: { status: filter.status, fromDate: filter.fromDate, toDate: filter.toDate, leaveTypeId: filter.leaveTypeId }
    });
  }

  cancel(requestId: string, payload: CancelLeaveRequestRequest): Observable<CancelLeaveRequestResponse> {
    return this.api.post<CancelLeaveRequestResponse>(`/leave/requests/${requestId}/cancel`, payload);
  }
}
```

- [ ] **Step 8: `leave-type-api.service.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../../shared/data-access/api-client';
import { CreateLeaveTypeRequest, LeaveTypeResponse, UpdateLeaveTypeRequest } from '../models/leave-type.model';

/** Client for ONEVO.Api's LeaveTypesController at /api/v1/leave/types. */
@Injectable({ providedIn: 'root' })
export class LeaveTypeApiService {
  private readonly api = inject(ApiClient);

  list(includeInactive: boolean): Observable<LeaveTypeResponse[]> {
    return this.api.get<LeaveTypeResponse[]>('/leave/types', { params: { includeInactive } });
  }

  get(leaveTypeId: string): Observable<LeaveTypeResponse> {
    return this.api.get<LeaveTypeResponse>(`/leave/types/${leaveTypeId}`);
  }

  create(payload: CreateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.api.post<LeaveTypeResponse>('/leave/types', payload);
  }

  update(leaveTypeId: string, payload: UpdateLeaveTypeRequest): Observable<LeaveTypeResponse> {
    return this.api.put<LeaveTypeResponse>(`/leave/types/${leaveTypeId}`, payload);
  }

  deactivate(leaveTypeId: string, confirmed: boolean): Observable<void> {
    return this.api.post<void>(`/leave/types/${leaveTypeId}/deactivate`, {}, { params: { confirmed } });
  }
}
```

- [ ] **Step 9: Confirm nothing in Leave data-access still uses `HttpClient` or `HttpParams`**

Run (Git Bash): `grep -rnE "HttpClient\b|HttpParams" src/app/modules/leave/data-access --include=*.ts | grep -v "\.spec\.ts"`
Expected: no output. (`HttpErrorResponse` in `leave-policy-api.service.ts` is fine and does not match.)

- [ ] **Step 10: Run the whole Leave module test suite**

Run: `npx ng test --watch=false --include="src/app/modules/leave/**/*.spec.ts"`
Expected: all PASS, including the Task 1 safety-net tests, with no warnings. If a URL or query-string assertion fails, the params literal in that service has the wrong key order or a missing key: compare it with the old `.set()` order shown in Task 1 and fix the service, not the URL assertion. (A different kind of failure, for example a store spec that mocks `HttpClient` directly, may need its test setup changed to provide `ApiClient`; that is fine, as long as the expected URLs stay the same.)

Then run the full suite, because other modules (dashboard, people) also inject Leave services:

Run: `npx ng test --watch=false`
Expected: all PASS, no warnings.

- [ ] **Step 11: Commit**

```powershell
git add src/app/modules/leave/data-access
git commit -m "refactor(leave): use shared ApiClient and toHttpParams in all Leave API services"
```

---

### Task 5: Guard against new hand-built `HttpParams`

A plain lint error on `new HttpParams(` would fail `npm run lint` for the ~37 files that are not migrated yet, and CLAUDE.md requires lint to report 0 errors. So copy the colours guard: a per-file baseline that may only shrink.

**Files:**
- Create: `scripts/check-http-params.mjs`
- Create (generated): `scripts/http-params-baseline.json`
- Modify: `package.json` (scripts block, lines 10-15)

- [ ] **Step 1: Write the script**

Create `scripts/check-http-params.mjs`:

```js
#!/usr/bin/env node
/**
 * Guard: no new hand-built HttpParams.
 *
 * Query strings go through toHttpParams() in src/app/shared/data-access/api-params.ts (usually via
 * ApiClient), so empty values, false/0, dates and arrays follow one set of rules. This script counts
 * `new HttpParams(` per non-spec .ts file under src/app and fails when a file has more than its entry in
 * scripts/http-params-baseline.json. The baseline holds the files not migrated yet. It may only shrink.
 *
 *   node scripts/check-http-params.mjs           check (used by `npm run lint`)
 *   node scripts/check-http-params.mjs --update  rewrite the baseline after migrating a file
 *   node scripts/check-http-params.mjs --report  per-module table of what is left to migrate
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src', 'app');
const BASELINE = path.join(root, 'scripts', 'http-params-baseline.json');
const HELPER = 'src/app/shared/data-access/api-params.ts';

const NEW_PARAMS = /new\s+HttpParams\s*\(/g;
const HTTP_CALL = /\bhttp\s*\.\s*(?:get|post|put|patch|delete|request)\s*[<(]/g;

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

const rel = (file) => path.relative(root, file).split(path.sep).join('/');
const files = walk(SRC, []).filter((f) => rel(f) !== HELPER);

const counts = {};
for (const file of files) {
  const n = (fs.readFileSync(file, 'utf8').match(NEW_PARAMS) ?? []).length;
  if (n) counts[rel(file)] = n;
}

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`Baseline written: ${Object.keys(sorted).length} files, ${Object.values(sorted).reduce((a, b) => a + b, 0)} call sites.`);
  process.exit(0);
}

if (process.argv.includes('--report')) {
  const area = (file) => {
    const m = /^src\/app\/modules\/([^/]+)\//.exec(file);
    return m ? m[1] : file.split('/')[2];
  };
  const byArea = {};
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const httpCalls = (text.match(HTTP_CALL) ?? []).length;
    const params = counts[rel(file)] ?? 0;
    if (!httpCalls && !params) continue;
    const row = (byArea[area(rel(file))] ??= { files: 0, httpCalls: 0, params: 0 });
    row.files += 1;
    row.httpCalls += httpCalls;
    row.params += params;
  }
  const rows = Object.entries(byArea).sort(([, a], [, b]) => b.httpCalls - a.httpCalls);
  console.log('| Module | Files calling HttpClient | Raw HttpClient calls | `new HttpParams(` sites |');
  console.log('|---|---|---|---|');
  for (const [name, r] of rows) console.log(`| ${name} | ${r.files} | ${r.httpCalls} | ${r.params} |`);
  process.exit(0);
}

const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
const over = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
if (over.length) {
  console.error('✖ New hand-built HttpParams. Use ApiClient (src/app/shared/data-access/api-client.ts) or toHttpParams() instead:');
  for (const [file, n] of over) console.error(`  ${file}: ${n} (allowed ${baseline[file] ?? 0})`);
  process.exit(1);
}
const shrunk = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n).length;
console.log(`✔ No new hand-built HttpParams.${shrunk ? ` ${shrunk} file(s) now below baseline: run --update to lock it in.` : ''}`);
```

- [ ] **Step 2: Generate the baseline (after the Leave migration)**

Run: `node scripts/check-http-params.mjs --update`
Expected: `Baseline written: N files, M call sites.` Then confirm no Leave file is listed:

Run (Git Bash): `grep -c "modules/leave" scripts/http-params-baseline.json`
Expected: `0`

- [ ] **Step 3: Wire it into `package.json`**

In `package.json`, change the `lint` script and add `check:http-params` next to `check:colors`:

```json
    "lint": "ng lint && node scripts/check-hardcoded-colors.mjs && node scripts/check-http-params.mjs",
    "check:colors": "node scripts/check-hardcoded-colors.mjs",
    "check:http-params": "node scripts/check-http-params.mjs",
```

- [ ] **Step 4: Check the guard passes**

Run: `npm run check:http-params`
Expected: `✔ No new hand-built HttpParams.`

- [ ] **Step 5: Check the guard fails on a new site, then undo**

Temporarily add this line at the end of `src/app/modules/leave/data-access/leave-type-api.service.ts`:

```ts
export const guardProbe = new HttpParams();
```

Run: `npm run check:http-params`
Expected: exit code 1 and `src/app/modules/leave/data-access/leave-type-api.service.ts: 1 (allowed 0)`.

Then remove the line again and re-run: `npm run check:http-params` → `✔`.

- [ ] **Step 6: Commit**

```powershell
git add scripts/check-http-params.mjs scripts/http-params-baseline.json package.json
git commit -m "chore(lint): guard against new hand-built HttpParams outside the shared helper"
```

---

### Task 6: Write the API layer rules into `docs/core/ARCHITECTURE.md`

§5.1 still shows an `ApiResponse<T>{data,message,success}` envelope with `.pipe(map(res => res.data))`. The code never did this. PROCESS_RULES rule 2 says the doc must match real decisions, so replace §5.1 only. The file is already truncated further down (around §7.5), so do not touch anything else.

**Files:**
- Modify: `docs/core/ARCHITECTURE.md`, from the line `### 5.1 REST API with Typed Responses` up to (not including) `### 5.2 Interceptor Chain — Registration Order`

- [ ] **Step 1: Replace the §5.1 block with this text**

````markdown
### 5.1 API Layer Rules (decided 2026-11-18)

There is **no response envelope**. The backend returns the DTO itself, and lists return either an array or `PagedResult<T>` (`shared/models/paged-result.model.ts`: `items`, `pageNumber`, `pageSize`, `totalCount`).

**Rules**

1. **API services call `ApiClient`, not `HttpClient`.** `shared/data-access/api-client.ts` always targets `environment.apiUrl` (paths start with `/`) and has `get`, `getPage`, `getBlob`, `post`, `postBlob`, `put`, `delete`.
2. **Query strings go through `toHttpParams()`** (`shared/data-access/api-params.ts`), which `ApiClient` calls for every `params` object. Do not write `new HttpParams(`; `npm run lint` runs `scripts/check-http-params.mjs` and fails on new ones.
   - `null`, `undefined` and `''` are skipped; `false` and `0` are sent.
   - A `Date` is sent as a full UTC ISO instant. For a date-only value, send `dateOnly(date)` (local calendar day). Never use `toISOString().slice(0, 10)`.
   - Arrays repeat the key: `ids=a&ids=b`.
   - Build `params` as an explicit object literal in the order the backend expects. Do not pass a caller's filter object straight through.
3. **API services return backend DTOs unchanged.** Models in `models/` match the backend response types exactly.
4. **Mapping to view models happens in the store or a mapper file** (`utils/<x>.mapper.ts`), never in the API service. Error translation that turns a known backend error code into a typed error (for example `LeavePolicyConflictError`) may stay in the service as a `catchError`.
5. **Components never call an API service directly when a store exists for that data.** They read store signals and call store methods.
6. Every API service has a header comment naming the backend controller and route it targets.

**Reference module:** Leave (`modules/leave/data-access/`) follows all of these.

```typescript
// modules/leave/data-access/leave-type-api.service.ts
/** Client for ONEVO.Api's LeaveTypesController at /api/v1/leave/types. */
@Injectable({ providedIn: 'root' })
export class LeaveTypeApiService {
  private readonly api = inject(ApiClient);

  list(includeInactive: boolean): Observable<LeaveTypeResponse[]> {
    return this.api.get<LeaveTypeResponse[]>('/leave/types', { params: { includeInactive } });
  }

  deactivate(leaveTypeId: string, confirmed: boolean): Observable<void> {
    return this.api.post<void>(`/leave/types/${leaveTypeId}/deactivate`, {}, { params: { confirmed } });
  }
}
```

Modules not moved yet are listed in `docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md`. Move a module by switching its services to `ApiClient`, then run `node scripts/check-http-params.mjs --update` so the baseline shrinks.

````

- [ ] **Step 2: Fix the §2 folder tree**

The §2 folder tree (around line 127) still lists `shared/models/api-response.model.ts` and `pagination.model.ts`. Neither exists. Replace those two tree lines with:

```text
│       ├── paged-result.model.ts
```

and add, under the `shared/` part of the tree, a `data-access/` entry:

```text
│   ├── data-access/
│   │   ├── api-client.ts
│   │   ├── api-params.ts
│   │   └── file-api.service.ts
```

Then run (Git Bash): `grep -n "ApiResponse\|api-response.model\|PaginatedResponse" docs/core/ARCHITECTURE.md`
Expected: no output.

- [ ] **Step 3: Check the table of contents still points at §5.1**

Run (Git Bash): `grep -n "5.1" docs/core/ARCHITECTURE.md | head -5`
Expected: the TOC line near the top still links to §5.1. If its anchor text was `REST API with Typed Responses`, update the TOC entry to `API Layer Rules`.

- [ ] **Step 4: Commit**

```powershell
git add docs/core/ARCHITECTURE.md
git commit -m "docs(core): replace stale API envelope section with the real API layer rules"
```

---

### Task 7: List the remaining modules and run the full checks

**Files:**
- Modify: `docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md` (append)

- [ ] **Step 1: Generate the per-module table**

Run: `node scripts/check-http-params.mjs --report`
Expected: a Markdown table with one row per module (`people`, `dashboard`, `work`, `attendance`, `organization`, `inbox`, `settings`, `core`, `shared`, …). `leave` must not appear, or must show `0` in both count columns. Sanity check: the raw `HttpClient` calls column should add up to roughly the task's 508 figure, minus the Leave calls moved here. If it is far lower, some services name the field something other than `http`; widen `HTTP_CALL` in the script before pasting.

- [ ] **Step 2: Append the result to the task file**

Append to `docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md`, pasting the table printed in Step 1 under the heading:

```markdown

## Status (2026-11-18)

- Helpers: `src/app/shared/data-access/api-params.ts` (`toHttpParams`, `dateOnly`) and `src/app/shared/data-access/api-client.ts` (`ApiClient`), with unit tests.
- Reference module: Leave. All 8 API services use `ApiClient`; no `HttpClient` or `HttpParams` left.
- Guard: `scripts/check-http-params.mjs` runs in `npm run lint`; baseline `scripts/http-params-baseline.json` may only shrink.
- Rules: `docs/core/ARCHITECTURE.md` §5.1.
- Not done here: the two module-local `PagedResultDto` types (attendance, work) still need to move to `shared/models/paged-result.model.ts`.

### Remaining modules

Generated with `node scripts/check-http-params.mjs --report`. Highest call count first.

<paste the table from Step 1 here>
```

Replace the `<paste …>` line with the actual table output; do not leave it in.

- [ ] **Step 3: Run the full frontend checks**

Run each and confirm:

- `npm run lint` → ESLint 0 errors / 0 warnings, `✔ No new hard-coded colours.`, `✔ No new hand-built HttpParams.`
- `npm run check:warnings` → no `[WARNING]` or `[ERROR]` lines
- `npx ng test --watch=false` → all unit tests green, no warnings

CLAUDE.md also mentions `pwsh ../dev-env/scripts/verify.ps1 frontend`. On 2026-11-18 there was no `dev-env` folder under `C:\HR2` on this PC, so the three commands above are the gate. If `dev-env` exists on your machine, check how the script finds the frontend repo before running it: if the main checkout path is hard-coded, it would test the wrong tree instead of this worktree.

- [ ] **Step 4: Live smoke check of Leave in the browser**

The unit tests prove the URLs did not change. Still open the app once (Chrome, admin host per the team's local setup) and load:
- Time Off → My balances (`/leave/balances/my?year=…`)
- Time Off → Leave types with "show inactive" off and on (`includeInactive=false/true`)
- Time Off → All requests with a date filter (`/leave/requests/all?fromDate=…`)
- Balance audit → Export (blob download works)

In DevTools → Network, each request URL must match what it was before (same keys, same order). Note the result in the commit message.

- [ ] **Step 5: Commit**

```powershell
git add "docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md"
git commit -m "docs(improvements): record task 04 status and remaining modules to migrate"
```

---

## Done when (from the task)

| Task requirement | Covered by |
|---|---|
| `toHttpParams(object)`: skips null/undefined/'', one date format, arrays repeat the key | Task 2 |
| `ApiClient` with `getPage`, `getOne` (`get`), `post`, `put`, `delete` on `environment.apiUrl` | Task 3 |
| Layer rules in `docs/core/` | Task 6 |
| One module (Leave) moved as the reference | Tasks 1 + 4 |
| Lint rule / script that flags `new HttpParams(` outside the helper | Task 5 |
| Helper has unit tests for dates, arrays and empty values | Task 2 |
| Remaining modules listed with call-site counts | Task 7 |
