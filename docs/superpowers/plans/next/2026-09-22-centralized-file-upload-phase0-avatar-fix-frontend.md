# Profile Avatar URL Fix (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an uploaded profile photo actually render in the Profile modal, by building the
avatar's display URL from a real file id the same way every other logo/photo feature in this app
already does, and by refetching the profile after upload instead of patching an unresolvable raw
file id into state.

**Architecture:** No new architecture — mirrors the existing `LegalEntityApiService.getLogoUrl` /
`ProjectApiService.getLogoUrl` pattern exactly: a pure `getAvatarUrl(fileId)` helper on
`ProfileApiService` builds `${apiUrl}/employees/me/avatar?v={fileId}` (cache-busted by file id), and
`PersonalInfoFormComponent` computes the `<app-avatar [avatarUrl]>` binding from that helper instead
of passing a raw model field straight through — the exact same shape as
`project-card.component.ts`'s `logoUrl` computed. `PersonalInformation.avatarUrl: string | null` is
renamed to `avatarFileId: string | null` since the backend now sends a raw file id, not a URL (see
the backend companion plan, which must ship first).

**Tech Stack:** Angular (standalone components, signals, `@ngrx/signals` stores), Vitest.

**Spec:** `docs/superpowers/specs/next/2026-09-22-centralized-file-upload-design.md` (§ "Phase 0"). Depends on: `HRMS-Backend-v1/docs/superpowers/plans/next/2026-09-22-centralized-file-upload-phase0-avatar-fix-backend.md` — that plan must ship first; this one consumes its `avatarFileId` field and its new `GET /employees/me/avatar` endpoint.

## Global Constraints

- URL-builder helpers on API services are pure (no HTTP call) and cache-bust with `?v={fileId}` —
  copy the exact convention from `legal-entity-api.service.ts:67-69` and
  `project-api.service.ts:26-28`, do not invent a different query param name.
- Every `ProfileStore` method that mutates server-visible state refetches via `this.loadProfile()`
  afterward rather than hand-patching derived fields into local state — `uploadAvatar` is the one
  existing exception this plan removes; do not introduce a new one.
- Tests use Vitest (`vi.fn()`/`vi.mock`), not Jest — see existing spec files in this module for the
  exact mocking style to follow.

---

### Task 1: `ProfileApiService.getAvatarUrl()` — pure URL builder

**Files:**
- Modify: `src/app/modules/profile/data-access/profile-api.service.ts`
- Test: `src/app/modules/profile/data-access/profile-api.service.spec.ts`

**Interfaces:**
- Produces: `ProfileApiService.getAvatarUrl(fileId: string): string` — Task 2's
  `PersonalInfoFormComponent` calls this exact method.

- [ ] **Step 1: Write the failing test**

Add to `src/app/modules/profile/data-access/profile-api.service.spec.ts` (alongside the existing
`uploadAvatar` test):

```typescript
  it('builds a cache-busted avatar URL from the file id', () => {
    expect(service.getAvatarUrl('file-abc')).toBe(`${environment.apiUrl}/employees/me/avatar?v=file-abc`);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/modules/profile/data-access/profile-api.service.spec.ts`
Expected: FAIL — `service.getAvatarUrl is not a function`.

- [ ] **Step 3: Implement the helper**

In `src/app/modules/profile/data-access/profile-api.service.ts`, add this method (next to
`uploadAvatar`, after line 31):

```typescript
  /** Pure helper - no request. `?v=` busts the browser's image cache after a re-upload. */
  getAvatarUrl(fileId: string): string {
    return `${this.base}/avatar?v=${fileId}`;
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/modules/profile/data-access/profile-api.service.spec.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/profile/data-access/profile-api.service.ts src/app/modules/profile/data-access/profile-api.service.spec.ts
git commit -m "feat: add ProfileApiService.getAvatarUrl pure URL builder"
```

---

### Task 2: Rename `avatarUrl` to `avatarFileId` and wire the display URL

**Files:**
- Modify: `src/app/modules/profile/models/profile.model.ts:19`
- Modify: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.ts`
- Modify: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.html:10`
- Test: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts`
- Test: `src/app/modules/profile/state/profile.store.spec.ts:11` (fixture only, compile fix)

**Interfaces:**
- Consumes: `ProfileApiService.getAvatarUrl` (Task 1).
- Produces: `PersonalInformation.avatarFileId: string | null` — Task 3's `profile.store.ts` and its
  spec both reference this exact field name instead of `avatarUrl`.

- [ ] **Step 1: Rename the model field**

In `src/app/modules/profile/models/profile.model.ts`, change line 19 from:

```typescript
  avatarUrl: string | null;
```

to:

```typescript
  avatarFileId: string | null;
```

- [ ] **Step 2: Fix the now-broken fixtures (compile step, no behavior change)**

In `src/app/modules/profile/state/profile.store.spec.ts:11`, change
`legalEntityTimezone: null, avatarUrl: null, addresses: []` to
`legalEntityTimezone: null, avatarFileId: null, addresses: []`.

In `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts:9`, change
`legalEntityTimezone: 'Asia/Colombo', avatarUrl: null, addresses: []` to
`legalEntityTimezone: 'Asia/Colombo', avatarFileId: null, addresses: []`.

- [ ] **Step 3: Write the failing test for the computed display URL**

In `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts`, add the
import and a provider to each of the 3 existing `TestBed.configureTestingModule` calls, then add a
new test. First, add this import at the top of the file (after the existing imports):

```typescript
import { ProfileApiService } from '../../data-access/profile-api.service';
```

Then change all 3 occurrences of:

```typescript
    await TestBed.configureTestingModule({ imports: [PersonalInfoFormComponent, ReactiveFormsModule] }).compileComponents();
```

to:

```typescript
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [{
        provide: ProfileApiService,
        useValue: { getAvatarUrl: (fileId: string) => `https://api.test/employees/me/avatar?v=${fileId}` }
      }]
    }).compileComponents();
```

Then add this new test at the end of the `describe` block:

```typescript
  it('renders the avatar image src built from avatarFileId via ProfileApiService.getAvatarUrl', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [{
        provide: ProfileApiService,
        useValue: { getAvatarUrl: (fileId: string) => `https://api.test/employees/me/avatar?v=${fileId}` }
      }]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', { ...samplePersonalInfo, avatarFileId: 'file-9' });
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.avatar__image');
    expect(img.src).toBe('https://api.test/employees/me/avatar?v=file-9');
  });

  it('shows no avatar image when avatarFileId is null', async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalInfoFormComponent, ReactiveFormsModule],
      providers: [{
        provide: ProfileApiService,
        useValue: { getAvatarUrl: (fileId: string) => `https://api.test/employees/me/avatar?v=${fileId}` }
      }]
    }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.avatar__image')).toBeNull();
  });
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts`
Expected: FAIL — compile error (`avatarFileId` doesn't exist on `PersonalInformation` output type
until Step 1's rename propagates, and the component doesn't yet inject `ProfileApiService` or expose
an `avatarUrl` computed).

- [ ] **Step 5: Wire the component**

In `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.ts`:

Add to the imports (top of file):

```typescript
import { ChangeDetectionStrategy, Component, OnChanges, computed, inject, input, output } from '@angular/core';
import { ProfileApiService } from '../../data-access/profile-api.service';
```

(replacing the existing `import { ChangeDetectionStrategy, Component, OnChanges, input, output } from '@angular/core';` line — this just adds `computed` and `inject` to the existing import).

Inside the class body, add the injected service and a computed URL (after the existing `avatarSelected` output on line 25):

```typescript
  private readonly profileApi = inject(ProfileApiService);

  readonly avatarUrl = computed(() => {
    const fileId = this.personalInformation().avatarFileId;
    return fileId ? this.profileApi.getAvatarUrl(fileId) : null;
  });
```

- [ ] **Step 6: Wire the template**

In `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.html:10`, change:

```html
        [avatarUrl]="personalInformation().avatarUrl"
```

to:

```html
        [avatarUrl]="avatarUrl()"
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts src/app/modules/profile/state/profile.store.spec.ts`
Expected: PASS, all tests in both files green.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/profile/models/profile.model.ts src/app/modules/profile/ui/personal-info-form/personal-info-form.component.ts src/app/modules/profile/ui/personal-info-form/personal-info-form.component.html src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts src/app/modules/profile/state/profile.store.spec.ts
git commit -m "fix: build the profile avatar's display URL from a real file id instead of avatarUrl"
```

---

### Task 3: `profile.store.ts` — refetch after avatar upload instead of patching a raw id

**Files:**
- Modify: `src/app/modules/profile/state/profile.store.ts:57-75`
- Test: `src/app/modules/profile/state/profile.store.spec.ts`

**Interfaces:**
- Consumes: `ProfileApiService.uploadAvatar(file: File): Observable<{ avatarFileId: string | null }>` (unchanged), `this.loadProfile()` (existing store method).

- [ ] **Step 1: Write the failing test**

Add to `src/app/modules/profile/state/profile.store.spec.ts` (needs `uploadAvatar` added to the
`apiMock` shape declared at the top of the file — change
`let apiMock: { getMyProfile: ReturnType<typeof vi.fn> };` to
`let apiMock: { getMyProfile: ReturnType<typeof vi.fn>; uploadAvatar: ReturnType<typeof vi.fn> };`
and add `uploadAvatar: vi.fn()` to the object built in `beforeEach`):

```typescript
  it('uploads the avatar then refetches the profile so the resolved avatarFileId is used', async () => {
    apiMock.getMyProfile.mockReturnValueOnce(of(sampleProfile));
    await store.loadProfile();

    const updatedProfile = {
      ...sampleProfile,
      personalInformation: { ...sampleProfile.personalInformation, avatarFileId: 'new-file-id' }
    };
    apiMock.uploadAvatar.mockReturnValue(of({ avatarFileId: 'new-file-id' }));
    apiMock.getMyProfile.mockReturnValueOnce(of(updatedProfile));

    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const result = await store.uploadAvatar(file);

    expect(result).toBe(true);
    expect(apiMock.getMyProfile).toHaveBeenCalledTimes(2);
    expect(store.profile()?.personalInformation.avatarFileId).toBe('new-file-id');
    expect(store.saving()).toBe(false);
  });

  it('sets saveError and does not refetch when the avatar upload fails', async () => {
    apiMock.getMyProfile.mockReturnValueOnce(of(sampleProfile));
    await store.loadProfile();

    apiMock.uploadAvatar.mockReturnValue(throwError(() => new Error('Upload failed')));

    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    const result = await store.uploadAvatar(file);

    expect(result).toBe(false);
    expect(store.saveError()).toBe('Failed to upload avatar.');
    expect(apiMock.getMyProfile).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/profile/state/profile.store.spec.ts`
Expected: FAIL — `apiMock.uploadAvatar` is `undefined` (not yet added to the mock), and/or the first
new test's `avatarFileId` assertion fails since the current implementation patches the raw id instead
of refetching.

- [ ] **Step 3: Fix the mock shape**

In `src/app/modules/profile/state/profile.store.spec.ts`, change:

```typescript
  let apiMock: { getMyProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { getMyProfile: vi.fn() };
```

to:

```typescript
  let apiMock: { getMyProfile: ReturnType<typeof vi.fn>; uploadAvatar: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { getMyProfile: vi.fn(), uploadAvatar: vi.fn() };
```

- [ ] **Step 4: Fix the store method**

In `src/app/modules/profile/state/profile.store.ts`, replace the `uploadAvatar` method (lines 57-75):

```typescript
    async uploadAvatar(file: File): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        const result = await firstValueFrom(api.uploadAvatar(file));
        const current = store.profile();
        if (current) {
          patchState(store, {
            profile: { ...current, personalInformation: { ...current.personalInformation, avatarUrl: result.avatarFileId } },
            saving: false
          });
        } else {
          patchState(store, { saving: false });
        }
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to upload avatar.') });
        return false;
      }
    },
```

with:

```typescript
    async uploadAvatar(file: File): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.uploadAvatar(file));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to upload avatar.') });
        return false;
      }
    },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/profile/state/profile.store.spec.ts`
Expected: PASS, all tests in the file green (the 2 pre-existing plus the 2 new ones).

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/profile/state/profile.store.ts src/app/modules/profile/state/profile.store.spec.ts
git commit -m "fix: refetch profile after avatar upload instead of patching an unresolved raw file id"
```

---

### Task 4: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Run the full profile module test suite**

Run: `npx vitest run src/app/modules/profile`
Expected: PASS, 0 failures.

- [ ] **Step 2: Manual check against the dev servers**

Requires the backend companion plan (Task 3's `GET /employees/me/avatar` endpoint) already deployed.

1. Start both dev servers (Angular + backend).
2. Log in, open the Profile modal → Personal Information tab.
3. Click "Change photo", pick an image file.
4. Expect: the avatar circle updates to show the new photo within the same view, no page reload
   needed (fulfilled by `loadProfile()`'s refetch updating `personalInformation.avatarFileId`, which
   the `avatarUrl` computed turns into a fresh `<img src>` with a new `?v=` cache-bust value).
5. Reload the page fully and reopen the Profile modal — the photo should still show (proves the
   backend's `GET /employees/me/avatar` endpoint, not just an optimistic local update, is serving it).

## Self-Review Notes

- Spec coverage: implements exactly the frontend half of the spec's "Phase 0" section. Phase 2's
  shared `<app-file-upload>` component and migration of the other 4 upload sites are intentionally
  out of scope here — separate future plan, per the spec's phased delivery section.
- No placeholders: every step has real, compilable TypeScript/HTML; the manual-verification task is
  explicitly a verification task, not a stand-in for missing automated coverage.
- Type consistency checked: `avatarFileId` is `string | null` consistently across
  `PersonalInformation`, `PersonalInfoFormComponent`, and both spec files — never conflated with the
  removed `avatarUrl` name anywhere in this plan.
