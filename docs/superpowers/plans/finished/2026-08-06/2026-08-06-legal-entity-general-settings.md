# Legal Entity General Settings Page (Frontend Part 2C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Settings → General Settings page for the currently selected Legal Entity/Company: load `GET .../general-settings`, edit, validate, and save via `PUT .../general-settings`, gated behind `org:manage`.

**Architecture:** New `general-settings.store.ts` (form/detail state, separate from `LegalEntityStore`'s selection state) + two new methods on the existing `LegalEntityApiService` + a new `GeneralSettingsComponent` (Reactive Forms) wired into the already-scaffolded `/settings/general` route (currently a placeholder). No backend changes. No new shared/ui primitives — `input`, `select`, `button`, `card`, `page-header`, `empty-state`, `error-state` already exist and are reused as-is.

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals` Signal Store, `@angular/forms` ReactiveFormsModule, Vitest + `TestBed` + `HttpTestingController` (repo's actual test runner — ignore the architecture doc's Jest examples).

## Global Constraints

- Backend contract is exact and final — field names below are copied verbatim from `UpdateLegalEntityGeneralSettingsRequest.cs`, `LegalEntityGeneralSettingsResponse.cs`, `LegalEntityAddressDto.cs`, and `UpdateLegalEntityGeneralSettingsCommandValidator.cs`. Do not add, rename, or omit fields.
- Route: `PUT /api/v1/org/legal-entities/{id}/general-settings` — `id` comes from the route/selected company, never from the request body. Request body must **never** contain `id`, `tenantId`, `parentLegalEntityId`, or `logoFileId`.
- Permission: viewing and saving General Settings both require `org:manage` (stronger than the `org:read` that gates the company selector). The route already enforces this via `permissionGuard` + `data: { permissions: ['org:manage'] }` at `app.routes.ts:41-44` — do not weaken it. The component adds its own `PermissionService` check as defense for direct/embedded use.
- No country/currency lookup table exists backend-side (`countryCode`/`currencyCode` are free `maxLength(3)` strings, no allow-list). Render as plain text inputs, not dropdowns backed by a fabricated lookup.
- No logo upload endpoint exists (`LegalEntitiesController.cs:15-18` — deliberately not wired). Render a disabled, read-only logo placeholder. Do not call `DELETE .../logo`.
- `firstDayOfWeek` and every value in `standardWorkingDays` are backend-validated as integers `1–7` (`InclusiveBetween(1,7)` / `Must(d => d is >=1 and <=7)`). This plan assumes ISO-8601 weekday numbering (Monday=1 … Sunday=7) since the backend does not otherwise document which integer maps to which day — call this out in the final report as an assumption, not a confirmed backend fact.
- `financialYearStartMonth` is backend-validated `1–12` (`InclusiveBetween(1,12)`).
- `timeFormat` must be exactly `'12h'` or `'24h'`; `status` must be exactly `'active'` or `'inactive'` (case-sensitive per `AllowedStatuses.Contains(s?.ToLowerInvariant())` — backend lowercases before comparing, but send lowercase from the frontend to avoid relying on that).
- `dateFormat` has **no backend enum** — only `NotEmpty` + `maxLength(20)`. Do not invent a closed set of accepted values; a curated dropdown for UX is fine as long as free text within 20 chars would also be accepted (i.e., don't add a stricter frontend validator than the backend enforces).
- `website`, when non-blank, must parse as an **absolute** URI (`Uri.TryCreate(url, UriKind.Absolute, ...)`); `email`, when non-blank, must be a valid email. Both are otherwise optional — send `null`, never `""`, when empty.
- `registeredBusinessAddress` is an object (`LegalEntityAddressDto`), not a string: `{ line1?, line2?, city?, state?, postalCode?, country? }`, each independently optional with its own `maxLength` (255/255/100/100/20/100). It has its own free-text `country` field, distinct from the top-level `countryCode` — keep both.
- Company selection reload must fully reset form state before loading the new company's data — no field from company A may render while company B is loading, and a stale in-flight response for A must never overwrite B's already-loaded state (guard on `legalEntityId` before patching).
- Do not modify `nav-items.config.ts`, `nav-access.ts`, or `sub-sidebar.component.*`. The Settings nav parent is visible purely from child visibility (`canAccessNavItem` in `nav-access.ts:16-27`); adding an ungated child there would make the whole Settings rail item visible to users with zero settings permissions — an explicit gating regression this task forbids. The three sub-sidebar items with no backend permission string yet (Policy Configuration, Devices & Connections, Audit Log) are rendered as **inert, non-routed placeholder rows inside the General Settings page body** instead — see Task 5.
- No lint script/config exists in this repo — do not claim "lint passed"; state "no lint script configured" in the report instead.

---

### Task 1: Frontend models for General Settings

**Files:**
- Modify: `src/app/modules/organization/models/legal-entity.model.ts`

**Interfaces:**
- Produces: `LegalEntityAddress`, `LegalEntityGeneralSettings`, `UpdateLegalEntityGeneralSettingsRequest` — consumed by Tasks 2, 3, 5.

- [ ] **Step 1: Append the new interfaces**

Add to the end of `legal-entity.model.ts` (keep the existing `LegalEntityListItem` untouched):

```typescript
/**
 * Matches backend LegalEntityGeneralSettingsResponse DTO verbatim
 * (LegalEntityGeneralSettingsResponse.cs). Also the Create Company response shape,
 * but Part 2C only consumes this via GET/PUT general-settings.
 */
export interface LegalEntityAddress {
  readonly line1: string | null;
  readonly line2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
}

export interface LegalEntityGeneralSettings {
  readonly id: string;
  readonly name: string;
  readonly companyCode: string | null;
  readonly logoFileId: string | null;
  readonly registrationNumber: string | null;
  readonly taxRegistrationNumber: string | null;
  readonly vatGstNumber: string | null;
  readonly email: string | null;
  readonly phoneNumber: string | null;
  readonly website: string | null;
  readonly countryCode: string;
  readonly currencyCode: string;
  readonly timezone: string | null;
  readonly financialYearStartMonth: number;
  readonly firstDayOfWeek: number;
  readonly standardWorkingDays: readonly number[];
  readonly defaultLanguage: string;
  readonly dateFormat: string;
  readonly timeFormat: '12h' | '24h';
  readonly status: 'active' | 'inactive';
  readonly registeredBusinessAddress: LegalEntityAddress | null;
}

/**
 * Matches backend UpdateLegalEntityGeneralSettingsRequest verbatim
 * (UpdateLegalEntityGeneralSettingsRequest.cs). Deliberately excludes id,
 * tenantId, parentLegalEntityId, logoFileId - none of those are part of this
 * request's field set server-side.
 */
export interface UpdateLegalEntityGeneralSettingsRequest {
  name: string;
  companyCode: string;
  registrationNumber: string;
  taxRegistrationNumber: string | null;
  vatGstNumber: string | null;
  email: string | null;
  phoneNumber: string | null;
  website: string | null;
  countryCode: string;
  currencyCode: string;
  timezone: string;
  financialYearStartMonth: number;
  firstDayOfWeek: number;
  standardWorkingDays: number[];
  defaultLanguage: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  status: 'active' | 'inactive';
  registeredBusinessAddress: LegalEntityAddress | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.json --noEmit` (or skip straight to Task 2's build, since this file has no consumers yet — either is fine, no test to run for a pure interface file).

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/organization/models/legal-entity.model.ts
git commit -m "feat(organization): add LegalEntityGeneralSettings models"
```

---

### Task 2: API service methods

**Files:**
- Modify: `src/app/modules/organization/data-access/legal-entity-api.service.ts`
- Modify: `src/app/modules/organization/data-access/legal-entity-api.service.spec.ts`

**Interfaces:**
- Consumes: `LegalEntityGeneralSettings`, `UpdateLegalEntityGeneralSettingsRequest` (Task 1).
- Produces: `LegalEntityApiService.getGeneralSettings(legalEntityId): Observable<LegalEntityGeneralSettings>`, `LegalEntityApiService.updateGeneralSettings(legalEntityId, payload): Observable<LegalEntityGeneralSettings>` — consumed by Task 3.

- [ ] **Step 1: Write failing tests**

Append to `legal-entity-api.service.spec.ts` (reuse the existing `describe`, `beforeEach`, `httpMock` from the file already there):

```typescript
import { LegalEntityGeneralSettings, UpdateLegalEntityGeneralSettingsRequest } from '../models/legal-entity.model';

// ... inside the existing describe('LegalEntityApiService', ...) block, add:

const mockGeneralSettings: LegalEntityGeneralSettings = {
  id: 'company-1',
  name: 'OneVo Technologies',
  companyCode: 'OVT',
  logoFileId: null,
  registrationNumber: 'REG-001',
  taxRegistrationNumber: null,
  vatGstNumber: null,
  email: 'ops@onevo.example',
  phoneNumber: null,
  website: null,
  countryCode: 'LKA',
  currencyCode: 'LKR',
  timezone: 'Asia/Colombo',
  financialYearStartMonth: 4,
  firstDayOfWeek: 1,
  standardWorkingDays: [1, 2, 3, 4, 5],
  defaultLanguage: 'en',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  status: 'active',
  registeredBusinessAddress: null
};

it('fetches general settings for a legal entity', () => {
  service.getGeneralSettings('company-1').subscribe((result) => {
    expect(result).toEqual(mockGeneralSettings);
  });

  const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-1/general-settings`);
  expect(req.request.method).toBe('GET');
  req.flush(mockGeneralSettings);
});

it('updates general settings with a PUT to the route-scoped id', () => {
  const payload: UpdateLegalEntityGeneralSettingsRequest = {
    name: 'OneVo Technologies',
    companyCode: 'OVT',
    registrationNumber: 'REG-001',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: 'ops@onevo.example',
    phoneNumber: null,
    website: null,
    countryCode: 'LKA',
    currencyCode: 'LKR',
    timezone: 'Asia/Colombo',
    financialYearStartMonth: 4,
    firstDayOfWeek: 1,
    standardWorkingDays: [1, 2, 3, 4, 5],
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    status: 'active',
    registeredBusinessAddress: null
  };

  service.updateGeneralSettings('company-1', payload).subscribe((result) => {
    expect(result).toEqual(mockGeneralSettings);
  });

  const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-1/general-settings`);
  expect(req.request.method).toBe('PUT');
  expect(req.request.body).toEqual(payload);
  req.flush(mockGeneralSettings);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false legal-entity-api.service.spec`
Expected: FAIL — `getGeneralSettings is not a function` / `updateGeneralSettings is not a function`.

- [ ] **Step 3: Implement**

In `legal-entity-api.service.ts`, update the import and add the two methods:

```typescript
import { LegalEntityGeneralSettings, LegalEntityListItem, UpdateLegalEntityGeneralSettingsRequest } from '../models/legal-entity.model';

// ... inside the class, after getLegalEntities():

getGeneralSettings(legalEntityId: string): Observable<LegalEntityGeneralSettings> {
  return this.http.get<LegalEntityGeneralSettings>(
    `${environment.apiUrl}/org/legal-entities/${legalEntityId}/general-settings`
  );
}

updateGeneralSettings(
  legalEntityId: string,
  payload: UpdateLegalEntityGeneralSettingsRequest
): Observable<LegalEntityGeneralSettings> {
  return this.http.put<LegalEntityGeneralSettings>(
    `${environment.apiUrl}/org/legal-entities/${legalEntityId}/general-settings`,
    payload
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watch=false legal-entity-api.service.spec`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/organization/data-access/legal-entity-api.service.ts src/app/modules/organization/data-access/legal-entity-api.service.spec.ts
git commit -m "feat(organization): add General Settings GET/PUT to LegalEntityApiService"
```

---

### Task 3: `LegalEntityStore` — patch selector list item after save

**Files:**
- Modify: `src/app/modules/organization/state/legal-entity.store.ts`
- Modify: `src/app/modules/organization/state/legal-entity.store.spec.ts`

**Interfaces:**
- Produces: `LegalEntityStore.updateCompanyDisplay(id, changes: { name: string; companyCode: string | null; isActive: boolean })` — consumed by Task 4's `GeneralSettingsComponent` after a successful save, so the topbar company selector and any other `companies()` consumer reflect a changed name/code/status without a full re-fetch.

- [ ] **Step 1: Write failing test**

Append to `legal-entity.store.spec.ts`:

```typescript
it('updateCompanyDisplay patches name/companyCode/isActive on the matching company only', async () => {
  const loadPromise = store.loadCompanies();
  const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
  req.flush(mockCompanies);
  await loadPromise;

  store.updateCompanyDisplay('comp-1', { name: 'Alpha Corp Renamed', companyCode: 'ALPHA2', isActive: false });

  const updated = store.companies().find((c) => c.id === 'comp-1');
  expect(updated).toEqual({ ...mockCompanies[0], name: 'Alpha Corp Renamed', companyCode: 'ALPHA2', isActive: false });
  expect(store.companies().find((c) => c.id === 'comp-2')).toEqual(mockCompanies[1]);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false legal-entity.store.spec`
Expected: FAIL — `store.updateCompanyDisplay is not a function`.

- [ ] **Step 3: Implement**

In `legal-entity.store.ts`, add a new method inside the existing `withMethods((store, api = inject(LegalEntityApiService)) => ({ ... }))` block, after `selectCompany`:

```typescript
    updateCompanyDisplay(
      legalEntityId: string,
      changes: { name: string; companyCode: string | null; isActive: boolean }
    ): void {
      patchState(store, {
        companies: store.companies().map((c) => (c.id === legalEntityId ? { ...c, ...changes } : c))
      });
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watch=false legal-entity.store.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/organization/state/legal-entity.store.ts src/app/modules/organization/state/legal-entity.store.spec.ts
git commit -m "feat(organization): add updateCompanyDisplay to LegalEntityStore"
```

---

### Task 4: `GeneralSettingsStore` — detail/form-load state

**Files:**
- Create: `src/app/modules/organization/state/general-settings.store.ts`
- Create: `src/app/modules/organization/state/general-settings.store.spec.ts`

**Interfaces:**
- Consumes: `LegalEntityApiService.getGeneralSettings`/`updateGeneralSettings` (Task 2), `LegalEntityGeneralSettings`/`UpdateLegalEntityGeneralSettingsRequest` (Task 1).
- Produces: `GeneralSettingsStore` with signals `legalEntityId()`, `settings()`, `loading()`, `saving()`, `loadError()`, `saveError()` and methods `load(legalEntityId: string): Promise<void>`, `save(legalEntityId: string, payload: UpdateLegalEntityGeneralSettingsRequest): Promise<LegalEntityGeneralSettings | null>`, `clear(): void` — consumed by Task 5's `GeneralSettingsComponent`.

- [ ] **Step 1: Write failing tests**

Create `general-settings.store.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LegalEntityGeneralSettings } from '../models/legal-entity.model';
import { GeneralSettingsStore } from './general-settings.store';

describe('GeneralSettingsStore', () => {
  let store: InstanceType<typeof GeneralSettingsStore>;
  let httpMock: HttpTestingController;

  const settingsA: LegalEntityGeneralSettings = {
    id: 'company-a',
    name: 'Company A',
    companyCode: 'A',
    logoFileId: null,
    registrationNumber: 'REG-A',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: null,
    phoneNumber: null,
    website: null,
    countryCode: 'LKA',
    currencyCode: 'LKR',
    timezone: 'Asia/Colombo',
    financialYearStartMonth: 1,
    firstDayOfWeek: 1,
    standardWorkingDays: [1, 2, 3, 4, 5],
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    status: 'active',
    registeredBusinessAddress: null
  };

  const settingsB: LegalEntityGeneralSettings = { ...settingsA, id: 'company-b', name: 'Company B', companyCode: 'B' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GeneralSettingsStore, provideHttpClient(), provideHttpClientTesting()]
    });
    store = TestBed.inject(GeneralSettingsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads settings for a legal entity', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    expect(store.settings()).toEqual(settingsA);
    expect(store.legalEntityId()).toBe('company-a');
    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBeNull();
  });

  it('clears prior settings immediately when load() is called for a different company (no cross-company leak)', () => {
    // First load resolves synchronously-enough for this assertion to matter:
    // call load() for B and assert stale A data is gone from state before B's response arrives.
    void store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);

    void store.load('company-b');
    // Before company-b's response is flushed, settings must already be cleared.
    expect(store.settings()).toBeNull();
    expect(store.legalEntityId()).toBe('company-b');

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`).flush(settingsB);
  });

  it('ignores a stale in-flight response if the target company changed before it resolved', async () => {
    const loadAPromise = store.load('company-a');
    const reqA = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);

    // Switch to B before A's response arrives.
    const loadBPromise = store.load('company-b');
    const reqB = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`);

    reqB.flush(settingsB);
    await loadBPromise;
    reqA.flush(settingsA); // stale - must not overwrite B
    await loadAPromise;

    expect(store.settings()).toEqual(settingsB);
    expect(store.legalEntityId()).toBe('company-b');
  });

  it('sets loadError on failure', async () => {
    const loadPromise = store.load('company-a');
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ detail: 'Not found.' }, { status: 404, statusText: 'Not Found' });
    await loadPromise;

    expect(store.loadError()).toBe('Not found.');
    expect(store.settings()).toBeNull();
  });

  it('clear() resets to initial state', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    store.clear();

    expect(store.settings()).toBeNull();
    expect(store.legalEntityId()).toBeNull();
  });

  it('save() PUTs and updates settings on success', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const savePromise = store.save('company-a', {
      name: 'Company A Renamed',
      companyCode: 'A',
      registrationNumber: 'REG-A',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: null,
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5],
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      status: 'active',
      registeredBusinessAddress: null
    });

    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ ...settingsA, name: 'Company A Renamed' });

    const result = await savePromise;
    expect(result?.name).toBe('Company A Renamed');
    expect(store.settings()?.name).toBe('Company A Renamed');
    expect(store.saving()).toBe(false);
  });

  it('save() sets saveError and keeps prior settings on failure', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const savePromise = store.save('company-a', {
      name: '',
      companyCode: 'A',
      registrationNumber: 'REG-A',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: null,
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5],
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      status: 'active',
      registeredBusinessAddress: null
    });

    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ errors: { Name: ['Company name is required.'] } }, { status: 422, statusText: 'Unprocessable Entity' });

    const result = await savePromise;
    expect(result).toBeNull();
    expect(store.saveError()).toBe('Company name is required.');
    expect(store.settings()).toEqual(settingsA); // failed values kept in form by the component, not the store
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --watch=false general-settings.store.spec`
Expected: FAIL — module `./general-settings.store` not found.

- [ ] **Step 3: Implement**

Create `general-settings.store.ts`:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { LegalEntityApiService } from '../data-access/legal-entity-api.service';
import { LegalEntityGeneralSettings, UpdateLegalEntityGeneralSettingsRequest } from '../models/legal-entity.model';

export interface GeneralSettingsState {
  readonly legalEntityId: string | null;
  readonly settings: LegalEntityGeneralSettings | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly loadError: string | null;
  readonly saveError: string | null;
}

const initialState: GeneralSettingsState = {
  legalEntityId: null,
  settings: null,
  loading: false,
  saving: false,
  loadError: null,
  saveError: null
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { detail?: string; title?: string; message?: string; errors?: Record<string, string[] | string> } }).error;
    if (body?.detail) return body.detail;
    if (body?.message) return body.message;
    if (body?.title && body.title !== 'One or more validation errors occurred.') return body.title;
    if (body?.errors) {
      const firstKey = Object.keys(body.errors)[0];
      if (firstKey && body.errors[firstKey]) {
        const val = body.errors[firstKey];
        return Array.isArray(val) ? val[0] : val;
      }
    }
  }
  return fallback;
}

/**
 * Holds the loaded General Settings detail for one company at a time, kept
 * deliberately separate from LegalEntityStore's selection/list state so a
 * company switch can clear form-related state without touching the selector.
 */
export const GeneralSettingsStore = signalStore(
  { providedIn: 'root' },
  withState<GeneralSettingsState>(initialState),
  withMethods((store, api = inject(LegalEntityApiService)) => ({
    async load(legalEntityId: string): Promise<void> {
      // Reset immediately so a prior company's fields never render while the new company loads.
      patchState(store, { ...initialState, legalEntityId, loading: true });
      try {
        const settings = await firstValueFrom(api.getGeneralSettings(legalEntityId));
        if (store.legalEntityId() !== legalEntityId) {
          return; // selection moved on again before this resolved - drop it
        }
        patchState(store, { settings, loading: false });
      } catch (err) {
        if (store.legalEntityId() !== legalEntityId) {
          return;
        }
        patchState(store, { loading: false, loadError: extractErrorMessage(err, 'Failed to load General Settings.') });
      }
    },

    clear(): void {
      patchState(store, initialState);
    },

    async save(
      legalEntityId: string,
      payload: UpdateLegalEntityGeneralSettingsRequest
    ): Promise<LegalEntityGeneralSettings | null> {
      patchState(store, { saving: true, saveError: null });
      try {
        const settings = await firstValueFrom(api.updateGeneralSettings(legalEntityId, payload));
        if (store.legalEntityId() === legalEntityId) {
          patchState(store, { settings, saving: false });
        }
        return settings;
      } catch (err) {
        patchState(store, { saving: false, saveError: extractErrorMessage(err, 'Failed to save General Settings.') });
        return null;
      }
    }
  }))
);
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watch=false general-settings.store.spec`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/organization/state/general-settings.store.ts src/app/modules/organization/state/general-settings.store.spec.ts
git commit -m "feat(organization): add GeneralSettingsStore"
```

---

### Task 5: Form option constants + validators

**Files:**
- Create: `src/app/modules/organization/utils/general-settings-options.ts`
- Create: `src/app/modules/organization/utils/general-settings-validators.ts`
- Create: `src/app/modules/organization/utils/general-settings-validators.spec.ts`

**Interfaces:**
- Produces: `WEEKDAY_OPTIONS`, `FINANCIAL_YEAR_MONTH_OPTIONS`, `TIME_FORMAT_OPTIONS`, `STATUS_OPTIONS`, `DATE_FORMAT_OPTIONS` (all `SelectOption[]`/plain arrays); `nonEmptyArrayValidator()`, `absoluteUrlValidator()`, `oneOfValidator(allowed)` (all `ValidatorFn`) — consumed by Task 6.

- [ ] **Step 1: Create option constants (no test needed — static data)**

Create `general-settings-options.ts`:

```typescript
import { SelectOption } from '../../../shared/ui/select/select.component';

/** ISO-8601 weekday numbering (Monday=1 ... Sunday=7), matching the backend's
 * firstDayOfWeek/standardWorkingDays InclusiveBetween(1,7) range. The backend
 * does not itself document which integer maps to which day - this is the
 * ISO-8601 convention, called out in the Part 2C report as an assumption. */
export const WEEKDAY_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 7, label: 'Sunday' }
];

export const FIRST_DAY_OF_WEEK_OPTIONS: readonly SelectOption[] = WEEKDAY_OPTIONS.map((d) => ({
  value: String(d.value),
  label: d.label
}));

export const FINANCIAL_YEAR_MONTH_OPTIONS: readonly SelectOption[] = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
].map((label, i) => ({ value: String(i + 1), label }));

/** Backend enforces exactly these two values (AllowedTimeFormats). */
export const TIME_FORMAT_OPTIONS: readonly SelectOption[] = [
  { value: '12h', label: '12-hour' },
  { value: '24h', label: '24-hour' }
];

/** Backend enforces exactly these two values (AllowedStatuses). */
export const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' }
];

/** Curated for UX only - backend only enforces NotEmpty + maxLength(20), no enum.
 * Any of these values (all <= 20 chars) will be accepted by the backend. */
export const DATE_FORMAT_OPTIONS: readonly SelectOption[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' }
];
```

- [ ] **Step 2: Write failing validator tests**

Create `general-settings-validators.spec.ts`:

```typescript
import { FormControl } from '@angular/forms';
import { absoluteUrlValidator, nonEmptyArrayValidator, oneOfValidator } from './general-settings-validators';

describe('nonEmptyArrayValidator', () => {
  it('fails on an empty array', () => {
    const control = new FormControl<number[]>([], { nonNullable: true, validators: [nonEmptyArrayValidator()] });
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ required: true });
  });

  it('passes when at least one value is present', () => {
    const control = new FormControl<number[]>([1], { nonNullable: true, validators: [nonEmptyArrayValidator()] });
    expect(control.valid).toBe(true);
  });
});

describe('absoluteUrlValidator', () => {
  it('passes on empty value (optional field)', () => {
    const control = new FormControl<string | null>(null, { validators: [absoluteUrlValidator()] });
    expect(control.valid).toBe(true);
  });

  it('fails on a relative/schemeless value', () => {
    const control = new FormControl<string | null>('example.com', { validators: [absoluteUrlValidator()] });
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ absoluteUrl: true });
  });

  it('passes on a valid absolute URL', () => {
    const control = new FormControl<string | null>('https://example.com', { validators: [absoluteUrlValidator()] });
    expect(control.valid).toBe(true);
  });
});

describe('oneOfValidator', () => {
  const validator = oneOfValidator(['12h', '24h']);

  it('passes on empty value (required validator handles emptiness separately)', () => {
    const control = new FormControl<string | null>(null, { validators: [validator] });
    expect(control.valid).toBe(true);
  });

  it('fails on a value outside the allowed set', () => {
    const control = new FormControl<string | null>('36h', { validators: [validator] });
    expect(control.valid).toBe(false);
    expect(control.errors).toEqual({ oneOf: true });
  });

  it('passes on an allowed value', () => {
    const control = new FormControl<string | null>('24h', { validators: [validator] });
    expect(control.valid).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- --watch=false general-settings-validators.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `general-settings-validators.ts`:

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Angular's built-in Validators.required treats [] as truthy (non-empty array
 * always passes) - this closes that gap for standardWorkingDays. */
export function nonEmptyArrayValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as unknown[] | null;
    return value && value.length > 0 ? null : { required: true };
  };
}

/** Mirrors backend's Uri.TryCreate(url, UriKind.Absolute, out _) - only
 * validates when a value is present, matching the backend's .When(...) guard. */
export function absoluteUrlValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    try {
      new URL(value);
      return null;
    } catch {
      return { absoluteUrl: true };
    }
  };
}

/** Defense for timeFormat/status beyond what a constrained <select> already
 * guarantees - only validates when a value is present. */
export function oneOfValidator(allowed: readonly string[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string | null;
    if (!value) {
      return null;
    }
    return allowed.includes(value) ? null : { oneOf: true };
  };
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- --watch=false general-settings-validators.spec`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/organization/utils/general-settings-options.ts src/app/modules/organization/utils/general-settings-validators.ts src/app/modules/organization/utils/general-settings-validators.spec.ts
git commit -m "feat(organization): add General Settings form options and validators"
```

---

### Task 6: `GeneralSettingsComponent`

**Files:**
- Create: `src/app/modules/organization/feature/general-settings/general-settings.component.ts`
- Create: `src/app/modules/organization/feature/general-settings/general-settings.component.html`
- Create: `src/app/modules/organization/feature/general-settings/general-settings.component.css`
- Create: `src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts`

**Interfaces:**
- Consumes: `LegalEntityStore` (Task 3, existing), `GeneralSettingsStore` (Task 4), `LegalEntityApiService` DTOs (Task 1), option/validator constants (Task 5), `PermissionService.hasPermission('org:manage')`, `NotificationService.success/error`, shared `app-input`/`app-select`/`app-button`/`app-page-header`/`app-empty-state`/`app-error-state` components (all pre-existing, read but not modified by this task).
- Produces: `GeneralSettingsComponent` (standalone) — consumed by Task 7's route.

- [ ] **Step 1: Write the component class**

Create `general-settings.component.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { LegalEntityGeneralSettings, UpdateLegalEntityGeneralSettingsRequest } from '../../models/legal-entity.model';
import { GeneralSettingsStore } from '../../state/general-settings.store';
import { LegalEntityStore } from '../../state/legal-entity.store';
import {
  DATE_FORMAT_OPTIONS,
  FINANCIAL_YEAR_MONTH_OPTIONS,
  FIRST_DAY_OF_WEEK_OPTIONS,
  STATUS_OPTIONS,
  TIME_FORMAT_OPTIONS,
  WEEKDAY_OPTIONS
} from '../../utils/general-settings-options';
import { absoluteUrlValidator, nonEmptyArrayValidator, oneOfValidator } from '../../utils/general-settings-validators';

@Component({
  selector: 'app-general-settings',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    InputComponent,
    PageHeaderComponent,
    SelectComponent
  ],
  templateUrl: './general-settings.component.html',
  styleUrl: './general-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GeneralSettingsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  readonly legalEntityStore = inject(LegalEntityStore);
  readonly settingsStore = inject(GeneralSettingsStore);

  readonly WEEKDAY_OPTIONS = WEEKDAY_OPTIONS;
  readonly FIRST_DAY_OF_WEEK_OPTIONS = FIRST_DAY_OF_WEEK_OPTIONS;
  readonly FINANCIAL_YEAR_MONTH_OPTIONS = FINANCIAL_YEAR_MONTH_OPTIONS;
  readonly TIME_FORMAT_OPTIONS = TIME_FORMAT_OPTIONS;
  readonly STATUS_OPTIONS = STATUS_OPTIONS;
  readonly DATE_FORMAT_OPTIONS = DATE_FORMAT_OPTIONS;

  readonly hasAccess = computed(() => this.permissionService.hasPermission('org:manage'));
  readonly selectedLegalEntityId = this.legalEntityStore.selectedLegalEntity;
  readonly submitting = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    companyCode: ['', [Validators.required, Validators.maxLength(20)]],
    registrationNumber: ['', [Validators.required, Validators.maxLength(50)]],
    taxRegistrationNumber: ['', [Validators.maxLength(80)]],
    vatGstNumber: ['', [Validators.maxLength(50)]],
    email: ['', [Validators.email, Validators.maxLength(254)]],
    phoneNumber: ['', [Validators.maxLength(20)]],
    website: ['', [Validators.maxLength(255), absoluteUrlValidator()]],
    countryCode: ['', [Validators.required, Validators.maxLength(3)]],
    currencyCode: ['', [Validators.required, Validators.maxLength(3)]],
    timezone: ['', [Validators.required, Validators.maxLength(50)]],
    financialYearStartMonth: [1, [Validators.required, Validators.min(1), Validators.max(12)]],
    firstDayOfWeek: [1, [Validators.required, Validators.min(1), Validators.max(7)]],
    standardWorkingDays: this.fb.nonNullable.control<number[]>([], [nonEmptyArrayValidator()]),
    defaultLanguage: ['', [Validators.required, Validators.maxLength(10)]],
    dateFormat: ['', [Validators.required, Validators.maxLength(20)]],
    timeFormat: ['24h' as '12h' | '24h', [Validators.required, oneOfValidator(['12h', '24h'])]],
    status: ['active' as 'active' | 'inactive', [Validators.required, oneOfValidator(['active', 'inactive'])]],
    addressLine1: ['', [Validators.maxLength(255)]],
    addressLine2: ['', [Validators.maxLength(255)]],
    addressCity: ['', [Validators.maxLength(100)]],
    addressState: ['', [Validators.maxLength(100)]],
    addressPostalCode: ['', [Validators.maxLength(20)]],
    addressCountry: ['', [Validators.maxLength(100)]]
  });

  constructor() {
    // Reload (or clear) whenever the selected company changes - never patch across companies.
    effect(() => {
      const company = this.selectedLegalEntityId();
      this.form.reset(this.emptyFormValue());
      if (!company) {
        this.settingsStore.clear();
        return;
      }
      if (!this.hasAccess()) {
        return; // avoid an API call the route guard would already have blocked
      }
      void this.settingsStore.load(company.id);
    });

    // Populate the form whenever a fresh settings payload lands for the current company.
    effect(() => {
      const settings = this.settingsStore.settings();
      if (settings) {
        this.form.reset(this.toFormValue(settings));
      }
    });
  }

  isDaySelected(day: number): boolean {
    return this.form.controls.standardWorkingDays.value.includes(day);
  }

  toggleDay(day: number, checked: boolean): void {
    const current = this.form.controls.standardWorkingDays.value;
    const next = checked ? [...current, day] : current.filter((d) => d !== day);
    this.form.controls.standardWorkingDays.setValue(next);
    this.form.controls.standardWorkingDays.markAsDirty();
  }

  async onSubmit(): Promise<void> {
    const company = this.selectedLegalEntityId();
    if (!company || this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const payload = this.toRequestPayload();
      const result = await this.settingsStore.save(company.id, payload);
      if (result) {
        this.legalEntityStore.updateCompanyDisplay(company.id, {
          name: result.name,
          companyCode: result.companyCode,
          isActive: result.status === 'active'
        });
        this.notificationService.success('General Settings saved.');
      } else {
        this.notificationService.error(this.settingsStore.saveError() ?? 'Failed to save General Settings.');
        // Failed values stay in the form - no reset here.
      }
    } finally {
      this.submitting.set(false);
    }
  }

  private emptyFormValue() {
    return {
      name: '',
      companyCode: '',
      registrationNumber: '',
      taxRegistrationNumber: '',
      vatGstNumber: '',
      email: '',
      phoneNumber: '',
      website: '',
      countryCode: '',
      currencyCode: '',
      timezone: '',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [] as number[],
      defaultLanguage: '',
      dateFormat: '',
      timeFormat: '24h' as const,
      status: 'active' as const,
      addressLine1: '',
      addressLine2: '',
      addressCity: '',
      addressState: '',
      addressPostalCode: '',
      addressCountry: ''
    };
  }

  private toFormValue(settings: LegalEntityGeneralSettings) {
    return {
      name: settings.name,
      companyCode: settings.companyCode ?? '',
      registrationNumber: settings.registrationNumber ?? '',
      taxRegistrationNumber: settings.taxRegistrationNumber ?? '',
      vatGstNumber: settings.vatGstNumber ?? '',
      email: settings.email ?? '',
      phoneNumber: settings.phoneNumber ?? '',
      website: settings.website ?? '',
      countryCode: settings.countryCode,
      currencyCode: settings.currencyCode,
      timezone: settings.timezone ?? '',
      financialYearStartMonth: settings.financialYearStartMonth,
      firstDayOfWeek: settings.firstDayOfWeek,
      standardWorkingDays: [...settings.standardWorkingDays],
      defaultLanguage: settings.defaultLanguage,
      dateFormat: settings.dateFormat,
      timeFormat: settings.timeFormat,
      status: settings.status,
      addressLine1: settings.registeredBusinessAddress?.line1 ?? '',
      addressLine2: settings.registeredBusinessAddress?.line2 ?? '',
      addressCity: settings.registeredBusinessAddress?.city ?? '',
      addressState: settings.registeredBusinessAddress?.state ?? '',
      addressPostalCode: settings.registeredBusinessAddress?.postalCode ?? '',
      addressCountry: settings.registeredBusinessAddress?.country ?? ''
    };
  }

  private toRequestPayload(): UpdateLegalEntityGeneralSettingsRequest {
    const v = this.form.getRawValue();
    const nullIfBlank = (value: string): string | null => (value.trim() === '' ? null : value);

    const hasAddress = [v.addressLine1, v.addressLine2, v.addressCity, v.addressState, v.addressPostalCode, v.addressCountry].some(
      (f) => f.trim() !== ''
    );

    return {
      name: v.name,
      companyCode: v.companyCode,
      registrationNumber: v.registrationNumber,
      taxRegistrationNumber: nullIfBlank(v.taxRegistrationNumber),
      vatGstNumber: nullIfBlank(v.vatGstNumber),
      email: nullIfBlank(v.email),
      phoneNumber: nullIfBlank(v.phoneNumber),
      website: nullIfBlank(v.website),
      countryCode: v.countryCode,
      currencyCode: v.currencyCode,
      timezone: v.timezone,
      financialYearStartMonth: v.financialYearStartMonth,
      firstDayOfWeek: v.firstDayOfWeek,
      standardWorkingDays: v.standardWorkingDays,
      defaultLanguage: v.defaultLanguage,
      dateFormat: v.dateFormat,
      timeFormat: v.timeFormat,
      status: v.status,
      registeredBusinessAddress: hasAddress
        ? {
            line1: nullIfBlank(v.addressLine1),
            line2: nullIfBlank(v.addressLine2),
            city: nullIfBlank(v.addressCity),
            state: nullIfBlank(v.addressState),
            postalCode: nullIfBlank(v.addressPostalCode),
            country: nullIfBlank(v.addressCountry)
          }
        : null
    };
  }
}
```

- [ ] **Step 2: Write the template**

Create `general-settings.component.html`:

```html
@if (!hasAccess()) {
  <app-page-header title="General Settings" />
  <app-empty-state
    title="You don't have access to this."
    description="Viewing and editing General Settings requires the org:manage permission."
  />
} @else if (!selectedLegalEntityId()) {
  <app-page-header title="General Settings" />
  <app-empty-state title="Select a company to edit General Settings." />
} @else {
  <app-page-header [title]="selectedLegalEntityId()!.name" subtitle="General Settings" />

  <!-- Settings sub-navigation: General Settings is this page; Roles & Permissions and Notification
       Settings are separately gated, real routes already rendered by the global sub-sidebar (see
       side-navbar.component.html + nav-items.config.ts). Policy Configuration, Devices & Connections,
       and Audit Log have no backend permission string yet, so they are inert placeholders here rather
       than gated NAV_ITEMS entries - see Global Constraints in the plan for why. -->
  <ul class="settings-inline-nav" aria-label="More settings (coming soon)">
    <li aria-disabled="true">Policy Configuration <span class="settings-inline-nav__badge">Coming soon</span></li>
    <li aria-disabled="true">Devices &amp; Connections <span class="settings-inline-nav__badge">Coming soon</span></li>
    <li aria-disabled="true">Audit Log <span class="settings-inline-nav__badge">Coming soon</span></li>
  </ul>

  @if (settingsStore.loading()) {
    <div class="skeleton-block" aria-busy="true" aria-label="Loading General Settings"></div>
  } @else if (settingsStore.loadError()) {
    <app-error-state [message]="settingsStore.loadError()!" [retryable]="true" (retry)="settingsStore.load(selectedLegalEntityId()!.id)" />
  } @else if (settingsStore.settings()) {
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="general-settings-form">

      <section class="settings-section">
        <h2>Company Identity</h2>
        <app-input label="Company name" [value]="form.controls.name.value" (valueChange)="form.controls.name.setValue($event)"
          [error]="form.controls.name.touched && form.controls.name.invalid ? 'Company name is required (max 200 characters).' : ''" />
        <app-input label="Company code" [value]="form.controls.companyCode.value" (valueChange)="form.controls.companyCode.setValue($event)"
          [error]="form.controls.companyCode.touched && form.controls.companyCode.invalid ? 'Company code is required (max 20 characters).' : ''" />
        <app-input label="Company registration number" [value]="form.controls.registrationNumber.value" (valueChange)="form.controls.registrationNumber.setValue($event)"
          [error]="form.controls.registrationNumber.touched && form.controls.registrationNumber.invalid ? 'Registration number is required (max 50 characters).' : ''" />
        <app-input label="Tax registration number" [value]="form.controls.taxRegistrationNumber.value" (valueChange)="form.controls.taxRegistrationNumber.setValue($event)"
          [error]="form.controls.taxRegistrationNumber.invalid ? 'Max 80 characters.' : ''" />
        <app-input label="VAT/GST number" [value]="form.controls.vatGstNumber.value" (valueChange)="form.controls.vatGstNumber.setValue($event)"
          [error]="form.controls.vatGstNumber.invalid ? 'Max 50 characters.' : ''" />
        <app-select label="Status" [options]="STATUS_OPTIONS" [value]="form.controls.status.value" (valueChange)="form.controls.status.setValue($event)" />
      </section>

      <section class="settings-section">
        <h2>Contact</h2>
        <app-input label="Company email" type="email" [value]="form.controls.email.value" (valueChange)="form.controls.email.setValue($event)"
          [error]="form.controls.email.touched && form.controls.email.invalid ? 'Enter a valid email address.' : ''" />
        <app-input label="Phone number" [value]="form.controls.phoneNumber.value" (valueChange)="form.controls.phoneNumber.setValue($event)"
          [error]="form.controls.phoneNumber.invalid ? 'Max 20 characters.' : ''" />
        <app-input label="Website" type="url" [value]="form.controls.website.value" (valueChange)="form.controls.website.setValue($event)"
          [error]="form.controls.website.touched && form.controls.website.invalid ? 'Enter a full URL, e.g. https://example.com.' : ''" />

        <fieldset class="settings-address">
          <legend>Registered business address</legend>
          <app-input label="Address line 1" [value]="form.controls.addressLine1.value" (valueChange)="form.controls.addressLine1.setValue($event)" />
          <app-input label="Address line 2" [value]="form.controls.addressLine2.value" (valueChange)="form.controls.addressLine2.setValue($event)" />
          <app-input label="City" [value]="form.controls.addressCity.value" (valueChange)="form.controls.addressCity.setValue($event)" />
          <app-input label="State/Province" [value]="form.controls.addressState.value" (valueChange)="form.controls.addressState.setValue($event)" />
          <app-input label="Postal code" [value]="form.controls.addressPostalCode.value" (valueChange)="form.controls.addressPostalCode.setValue($event)" />
          <app-input label="Country" [value]="form.controls.addressCountry.value" (valueChange)="form.controls.addressCountry.setValue($event)" />
        </fieldset>
      </section>

      <section class="settings-section">
        <h2>Company Details</h2>
        <app-input label="Country code (ISO alpha-3)" [value]="form.controls.countryCode.value" (valueChange)="form.controls.countryCode.setValue($event)"
          [error]="form.controls.countryCode.touched && form.controls.countryCode.invalid ? 'Country code is required (max 3 characters).' : ''" />
        <app-input label="Currency code (ISO 4217)" [value]="form.controls.currencyCode.value" (valueChange)="form.controls.currencyCode.setValue($event)"
          [error]="form.controls.currencyCode.touched && form.controls.currencyCode.invalid ? 'Currency code is required (max 3 characters).' : ''" />
        <app-input label="Timezone" [value]="form.controls.timezone.value" (valueChange)="form.controls.timezone.setValue($event)"
          [error]="form.controls.timezone.touched && form.controls.timezone.invalid ? 'Timezone is required.' : ''" />
        <app-select label="Financial year starts in" [options]="FINANCIAL_YEAR_MONTH_OPTIONS"
          [value]="form.controls.financialYearStartMonth.value + ''" (valueChange)="form.controls.financialYearStartMonth.setValue(+$event)" />
      </section>

      <section class="settings-section">
        <h2>Regional Preferences</h2>
        <app-select label="First day of week" [options]="FIRST_DAY_OF_WEEK_OPTIONS"
          [value]="form.controls.firstDayOfWeek.value + ''" (valueChange)="form.controls.firstDayOfWeek.setValue(+$event)" />

        <fieldset class="settings-weekdays">
          <legend>Standard working days</legend>
          @for (day of WEEKDAY_OPTIONS; track day.value) {
            <label class="settings-weekday-option">
              <input type="checkbox" [checked]="isDaySelected(day.value)" (change)="toggleDay(day.value, $any($event.target).checked)" />
              {{ day.label }}
            </label>
          }
          @if (form.controls.standardWorkingDays.touched && form.controls.standardWorkingDays.invalid) {
            <p class="settings-field-error">Select at least one working day.</p>
          }
        </fieldset>

        <app-input label="Default language" [value]="form.controls.defaultLanguage.value" (valueChange)="form.controls.defaultLanguage.setValue($event)"
          [error]="form.controls.defaultLanguage.touched && form.controls.defaultLanguage.invalid ? 'Default language is required (max 10 characters).' : ''" />
        <app-select label="Date format" [options]="DATE_FORMAT_OPTIONS" [value]="form.controls.dateFormat.value" (valueChange)="form.controls.dateFormat.setValue($event)" />
        <app-select label="Time format" [options]="TIME_FORMAT_OPTIONS" [value]="form.controls.timeFormat.value" (valueChange)="form.controls.timeFormat.setValue($any($event))" />
      </section>

      <section class="settings-section">
        <h2>Logo</h2>
        <p class="settings-field-hint">Logo upload isn't available yet.</p>
        <button type="button" class="settings-logo-placeholder" disabled aria-disabled="true">Change logo</button>
      </section>

      @if (settingsStore.saveError()) {
        <app-error-state [message]="settingsStore.saveError()!" />
      }

      <div class="settings-form-actions">
        <app-button type="submit" [loading]="submitting()" [disabled]="submitting()">Save changes</app-button>
      </div>
    </form>
  }
}
```

- [ ] **Step 3: Write the stylesheet**

Create `general-settings.component.css` (tokens only, no hardcoded colors):

```css
.settings-inline-nav {
  display: flex;
  gap: 0.75rem;
  list-style: none;
  margin: 0 0 1.5rem;
  padding: 0;
  flex-wrap: wrap;
}

.settings-inline-nav li[aria-disabled='true'] {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-content);
  border: 1px dashed var(--color-border);
  color: var(--color-text-secondary);
  font-size: 0.8125rem;
  cursor: not-allowed;
}

.settings-inline-nav__badge {
  font-size: 0.6875rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 999px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
}

.general-settings-form {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 48rem;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-content);
  background: var(--color-surface);
}

.settings-section h2 {
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.settings-address,
.settings-weekdays {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  border: none;
  padding: 0;
  margin: 0;
}

.settings-address legend,
.settings-weekdays legend {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  padding: 0;
}

.settings-weekdays {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
}

.settings-weekday-option {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  color: var(--color-text-primary);
}

.settings-field-error {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-danger-text);
}

.settings-field-hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.settings-logo-placeholder {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-content);
  border: 1px solid var(--color-border);
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: not-allowed;
}

.settings-form-actions {
  display: flex;
  justify-content: flex-end;
}

.skeleton-block {
  height: 12rem;
  border-radius: var(--radius-content);
  background: var(--color-surface-secondary);
}
```

- [ ] **Step 4: Write component tests**

Create `general-settings.component.spec.ts`:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../environments/environment';
import { LegalEntityGeneralSettings } from '../../models/legal-entity.model';
import { LegalEntityStore } from '../../state/legal-entity.store';
import { GeneralSettingsComponent } from './general-settings.component';

describe('GeneralSettingsComponent', () => {
  let httpMock: HttpTestingController;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let permissionService: { hasPermission: (p: string) => boolean };

  const companies = [
    { id: 'company-a', name: 'Company A', companyCode: 'A', logoFileId: null, isActive: true, isPrimary: true },
    { id: 'company-b', name: 'Company B', companyCode: 'B', logoFileId: null, isActive: true, isPrimary: false }
  ];

  const settingsFor = (id: string, name: string): LegalEntityGeneralSettings => ({
    id,
    name,
    companyCode: id.toUpperCase(),
    logoFileId: null,
    registrationNumber: 'REG-1',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: 'ops@onevo.example',
    phoneNumber: null,
    website: null,
    countryCode: 'LKA',
    currencyCode: 'LKR',
    timezone: 'Asia/Colombo',
    financialYearStartMonth: 1,
    firstDayOfWeek: 1,
    standardWorkingDays: [1, 2, 3, 4, 5],
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    status: 'active',
    registeredBusinessAddress: null
  });

  async function setup(hasPermission: boolean) {
    permissionService = { hasPermission: () => hasPermission };

    await TestBed.configureTestingModule({
      imports: [GeneralSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PermissionService, useValue: permissionService },
        { provide: NotificationService, useValue: { success: () => {}, error: () => {}, info: () => {} } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    legalEntityStore = TestBed.inject(LegalEntityStore);
  }

  afterEach(() => httpMock.verify());

  it('shows a permission-denied empty state and never calls the API when the user lacks org:manage', async () => {
    await setup(false);
    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("You don't have access to this.");
    httpMock.expectNone(() => true);
  });

  it('shows "select a company" empty state when nothing is selected', async () => {
    await setup(true);
    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Select a company to edit General Settings.');
  });

  it('loads and renders the selected company\'s settings', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    const nameInput: HTMLInputElement | null = fixture.nativeElement.querySelector('input[id^="app-input"]');
    expect(fixture.nativeElement.textContent).toContain('Company A');
    expect(nameInput?.value).toBe('Company A');
  });

  it('reloads the form (no leaked values) when the selected company changes', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.name.setValue('Dirty unsaved edit');
    legalEntityStore.selectCompany('company-b');
    fixture.detectChanges();

    // Form must be cleared before B's response lands - no "Dirty unsaved edit" visible.
    expect(fixture.componentInstance.form.controls.name.value).not.toBe('Dirty unsaved edit');

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`).flush(settingsFor('company-b', 'Company B'));
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company B');
    expect(fixture.componentInstance.form.pristine).toBe(true);
  });

  it('save() PUTs to the route-scoped id with no tenantId/id/parentLegalEntityId/logoFileId in the body', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    await fixture.componentInstance.onSubmit();

    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    expect(putReq.request.method).toBe('PUT');
    const bodyKeys = Object.keys(putReq.request.body).sort();
    expect(bodyKeys).toEqual(
      [
        'name', 'companyCode', 'registrationNumber', 'taxRegistrationNumber', 'vatGstNumber', 'email',
        'phoneNumber', 'website', 'countryCode', 'currencyCode', 'timezone', 'financialYearStartMonth',
        'firstDayOfWeek', 'standardWorkingDays', 'defaultLanguage', 'dateFormat', 'timeFormat', 'status',
        'registeredBusinessAddress'
      ].sort()
    );
    putReq.flush(settingsFor('company-a', 'Company A'));
  });

  it('blocks submit and does not call the API when required fields are invalid', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.name.setValue('');
    await fixture.componentInstance.onSubmit();

    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
  });

  it('blocks submit when financialYearStartMonth is out of range', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.financialYearStartMonth.setValue(13);
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit when standardWorkingDays is empty', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.standardWorkingDays.setValue([]);
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit on an invalid email', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.email.setValue('not-an-email');
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit on a schemeless website URL', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.website.setValue('example.com');
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('shows a failure state and keeps typed values on API error', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    fixture.componentInstance.form.controls.name.setValue('Renamed Co');
    const submitPromise = fixture.componentInstance.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ errors: { Name: ['Company name conflict.'] } }, { status: 422, statusText: 'Unprocessable Entity' });
    await submitPromise;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Company name conflict.');
    expect(fixture.componentInstance.form.controls.name.value).toBe('Renamed Co'); // kept, not reset
  });

  it('updates the displayed company name in LegalEntityStore after a successful save', async () => {
    await setup(true);
    legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    fixture.detectChanges();

    const submitPromise = fixture.componentInstance.onSubmit();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    putReq.flush(settingsFor('company-a', 'Company A Renamed'));
    await submitPromise;

    expect(legalEntityStore.companies().find((c) => c.id === 'company-a')?.name).toBe('Company A Renamed');
  });
});
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- --watch=false general-settings.component.spec`
Expected: PASS. If any test fails on a `SelectComponent`/`InputComponent` selector mismatch, adjust the template query in the test (the components' exact rendered markup was read from `input.component.ts`/`select.component.ts` in Task research — re-check `nextUniqueId('app-input')` output format if the `querySelector` needs adjusting) rather than changing the component under test.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/organization/feature/general-settings/
git commit -m "feat(organization): add GeneralSettingsComponent"
```

---

### Task 7: Wire the route

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify (or create if it doesn't already assert this): a routing spec covering `/settings` → `/settings/general` and the `general` path resolving to the real component.

**Interfaces:**
- Consumes: `GeneralSettingsComponent` (Task 6).

- [ ] **Step 1: Update the route**

In `app.routes.ts`, replace only the `general` child's `loadComponent` (lines 40-44), leaving `canActivate`/`data` untouched:

```typescript
          {
            path: 'general',
            loadComponent: () =>
              import('./modules/organization/feature/general-settings/general-settings.component').then(
                (module) => module.GeneralSettingsComponent
              ),
            canActivate: [permissionGuard],
            data: { title: 'General Settings', permissions: ['org:manage'] }
          },
```

- [ ] **Step 2: Check for an existing app.routes.spec.ts**

Run: `find src/app -maxdepth 1 -name "app.routes.spec.ts"` (or check via Glob) — if it exists, read it first and add cases there instead of creating a duplicate file.

- [ ] **Step 3: Write/extend the routing test**

If no `app.routes.spec.ts` exists, create `src/app/app.routes.spec.ts` with at least:

```typescript
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { PermissionService } from './core/auth/state/permission.service';

describe('app routes - Settings', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PermissionService, useValue: { hasAnyPermission: () => true, hasAnyModule: () => true, hasPermission: () => true } }
      ]
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  it('redirects /settings to /settings/general', async () => {
    await router.navigateByUrl('/settings');
    expect(router.url).toBe('/settings/general');
  });

  it('resolves /settings/general to GeneralSettingsComponent', async () => {
    const success = await router.navigateByUrl('/settings/general');
    expect(success).toBe(true);
    expect(router.url).toBe('/settings/general');
  });
});
```

Note: `routes` at the top level includes `authGuard` on the `''` path wrapping `settings`, so this test's `PermissionService` stub covers `permissionGuard` only — if `authGuard` also fires and blocks navigation in this harness, mock `AuthStore.checkSession` similarly (check `auth.guard.spec.ts`, if one exists, for the exact provider shape before duplicating logic).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- --watch=false app.routes.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/app.routes.spec.ts
git commit -m "feat(organization): wire GeneralSettingsComponent into /settings/general"
```

---

### Task 8: Full verification + report

**Files:**
- Create: `FRONTEND_PART2C_LEGAL_ENTITY_GENERAL_SETTINGS_REPORT.md` (repo root of `Hrms--Web-application---front-end---v1`, matching the sibling audit report's location).

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --watch=false`
Record pass/fail counts verbatim in the report.

- [ ] **Step 2: Run builds**

Run: `npm run build`
Run: `npm run build:staging`
Record success/failure and any warnings verbatim.

- [ ] **Step 3: Whitespace check**

Run: `git diff --check`
Record output (expected empty) in the report.

- [ ] **Step 4: Manual verification (only if backend + frontend are both already running)**

If a live Acme-tenant dev environment is available: log in as Acme owner, confirm Settings in sidebar → General Settings loads selected company → switch company via topbar selector → confirm reload → save a harmless field (e.g. phone number) → refresh → confirm persisted → check console for errors. If not available, write "not run — no live backend/frontend session in this task" in the report; do not simulate or infer a result.

- [ ] **Step 5: Write the report**

Include: files changed (from `git status`/`git diff --stat`), routes added/reused, exact API endpoints + request/response field lists (from Task 1's models), permission behavior (route guard + component-level check, both gated on `org:manage`), validation behavior (list each rule + where it lives), the sub-sidebar placeholder deviation and why (cite `nav-access.ts:16-27`), the ISO-8601 weekday-numbering assumption, tests run + counts, build results, manual verification result or reason not run, and the out-of-scope list from the original task (create company, delete company, logo upload, country_id/countries lookup, departments, positions).

- [ ] **Step 6: Do not commit the report unless explicitly asked**

Per task instructions ("Do not commit or push"), leave the report file untracked/uncommitted along with confirming no backend files, OneVo-HR docs, or Postman files were touched.

---

## Self-Review Notes (from plan authoring)

- Every backend field name in Tasks 1-6 was copied from `LegalEntityGeneralSettingsResponse.cs`, `UpdateLegalEntityGeneralSettingsRequest.cs`, `LegalEntityAddressDto.cs`, and `UpdateLegalEntityGeneralSettingsCommandValidator.cs` — no invented DTO fields.
- Cross-company leak, stale in-flight response, and route-scoped save-body assertions are each covered by an explicit test in Tasks 4 and 6, matching the task spec's "no unsaved values leak" and "no tenantId sent" requirements literally rather than by inference.
- The sub-sidebar requirement is satisfied without editing `NAV_ITEMS`/`nav-access.ts`/`sub-sidebar.component.*`, preserving the existing "parent visible only if a child is reachable" gating invariant — documented as a deliberate deviation, not a silent gap, in Task 8's report.
- Logo, country/currency lookups, Create/Delete Company, and Departments/Positions are untouched — no task above creates or modifies any file under those areas.
