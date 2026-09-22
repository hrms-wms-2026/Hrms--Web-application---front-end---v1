# Centralized File Upload — Phase 1 Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One shared `FileApiService` (`upload`, `delete`, `getFileUrl`) that every avatar/photo
display and upload spot uses, replacing the one-off `ProfileApiService.getAvatarUrl`/
`PeopleApiService.getAvatarUrl` helpers and signed-URL-based `avatarUrl` fields added earlier
this session — all superseded by the backend's generic `GET/POST/DELETE /api/v1/files`.

**Architecture:** `FileApiService.getFileUrl(fileId)` returns `${apiUrl}/files/{fileId}` — a URL
that streams through our own API (proven reachable, unlike the direct Cloudflare R2 signed URLs
this session discovered don't reliably load in the browser here). Every place currently building
an avatar URL from a per-feature helper or a pre-resolved backend URL field switches to building
it from a raw `avatarFileId`/`employeeId` via this one service instead. `AvatarComponent`'s
existing `(error)` → initials fallback (already proven, untouched) means "no avatar set" and "this
specific file 404s" both degrade the same way with no new handling needed.

**Tech Stack:** Angular (standalone components, signals), Vitest.

**Spec:** `docs/superpowers/specs/next/2026-09-22-centralized-file-upload-design.md`. Backend companion (must ship first): `HRMS-Backend-v1/docs/superpowers/plans/next/2026-09-22-centralized-file-upload-phase1-backend.md`.

## Global Constraints

- `FileApiService.getFileUrl` is pure (no HTTP call), exactly like every other `getXUrl` helper already in this codebase (`legal-entity-api.service.ts`, `project-api.service.ts`) — do not memoize or cache it.
- No component may build a file/avatar URL manually (string interpolation of `environment.apiUrl`) — always through `FileApiService.getFileUrl`.
- `avatarFileId`/`avatarUrl` model fields that are being replaced in this plan are renamed, not left as unused dead fields alongside a new one.

---

### Task 1: `FileApiService`

**Files:**
- Create: `src/app/shared/data-access/file-api.service.ts`
- Test: `src/app/shared/data-access/file-api.service.spec.ts`

**Interfaces:**
- Produces: `FileApiService.getFileUrl(fileId: string): string`, `.upload(file: File, purpose: string): Observable<{fileId, originalFileName, fileSizeBytes, contentType}>`, `.delete(fileId: string): Observable<void>` — every later task in this plan and Part 2 (project/task attachments, not in this plan) depends on this exact shape.

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/data-access/file-api.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { FileApiService } from './file-api.service';
import { environment } from '../../../environments/environment';

describe('FileApiService', () => {
  let service: FileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds a file URL from the file id, no request', () => {
    expect(service.getFileUrl('file-1')).toBe(`${environment.apiUrl}/files/file-1`);
    httpMock.expectNone(`${environment.apiUrl}/files/file-1`);
  });

  it('uploads a file with its purpose as multipart form data', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    service.upload(file, 'employee_avatar').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/files`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('purpose')).toBe('employee_avatar');
    req.flush({ fileId: 'file-1', originalFileName: 'a.png', fileSizeBytes: 1, contentType: 'image/png' });
  });

  it('deletes a file by id', () => {
    service.delete('file-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/files/file-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --include="src/app/shared/data-access/file-api.service.spec.ts" --watch=false`
Expected: FAIL — `FileApiService` doesn't exist.

- [ ] **Step 3: Implement the service**

Create `src/app/shared/data-access/file-api.service.ts`:

```typescript
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UploadedFile {
  fileId: string;
  originalFileName: string;
  fileSizeBytes: number;
  contentType: string;
}

@Injectable({ providedIn: 'root' })
export class FileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/files`;

  /** Pure helper - no request. Streams through our own API (never a direct object-storage URL). */
  getFileUrl(fileId: string): string {
    return `${this.base}/${fileId}`;
  }

  upload(file: File, purpose: string): Observable<UploadedFile> {
    const formData = new FormData();
    formData.append('purpose', purpose);
    formData.append('file', file);
    return this.http.post<UploadedFile>(this.base, formData);
  }

  delete(fileId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${fileId}`);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --include="src/app/shared/data-access/file-api.service.spec.ts" --watch=false`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/data-access/file-api.service.ts src/app/shared/data-access/file-api.service.spec.ts
git commit -m "feat: add FileApiService, the single frontend entry point for the generic files endpoint"
```

---

### Task 2: Rewire the profile avatar (self-view) onto `FileApiService`

**Files:**
- Modify: `src/app/modules/profile/data-access/profile-api.service.ts` (remove `uploadAvatar`'s old multipart shape and `getAvatarUrl`)
- Modify: `src/app/modules/profile/state/profile.store.ts` (`uploadAvatar` calls `FileApiService.upload` then links via the profile API)
- Modify: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.ts` (`avatarUrl` computed uses `FileApiService.getFileUrl`)
- Modify: `src/app/layouts/main-layout/main-layout.component.ts` (topbar `avatarUrl` computed uses `FileApiService.getFileUrl`)
- Update the corresponding `.spec.ts` files for each

**Interfaces:**
- Consumes: `FileApiService.upload`/`getFileUrl` (Task 1). Backend companion plan's `PUT /employees/me/avatar` still exists in this phase (Task 5 of the backend plan only deletes `SetMyAvatarCommand`/`GetMyAvatarQuery`/`GetEmployeeAvatarQuery` — the self-service `PUT` is untouched); this task does **not** change what backend endpoint uploads the file, only how the *display* URL is built, since the backend plan's Task 6 already made `MyPersonalInformationResponse.AvatarFileId` come from `entity_assets`.

- [ ] **Step 1: Write the failing test**

In `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts`, change the `profileApiMockProvider` from mocking `ProfileApiService.getAvatarUrl` to mocking `FileApiService.getFileUrl`:

```typescript
import { FileApiService } from '../../../../shared/data-access/file-api.service';

const fileApiMockProvider = {
  provide: FileApiService,
  useValue: { getFileUrl: (fileId: string) => `https://api.test/files/${fileId}` }
};
```

Replace every `profileApiMockProvider` reference in the file with `fileApiMockProvider`, and update the two avatar-URL assertions (`renders the avatar image src...`, `shows no avatar image...`) to expect `https://api.test/files/file-9` instead of the old `https://api.test/employees/me/avatar?v=file-9` shape.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --include="src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts" --watch=false`
Expected: FAIL — component still injects `ProfileApiService` for the avatar URL, not `FileApiService`.

- [ ] **Step 3: Rewire the component**

In `personal-info-form.component.ts`, replace the `ProfileApiService`-based `avatarUrl` computed with:

```typescript
import { FileApiService } from '../../../../shared/data-access/file-api.service';
// ...
private readonly fileApi = inject(FileApiService);

readonly avatarUrl = computed(() => {
  const fileId = this.personalInformation().avatarFileId;
  return fileId ? this.fileApi.getFileUrl(fileId) : null;
});
```

(Remove the `ProfileApiService` injection here if `avatarUrl` was its only use in this component — check first with a grep for other `profileApi.` usages in the file before removing the import/injection.)

- [ ] **Step 4: Rewire the topbar**

In `src/app/layouts/main-layout/main-layout.component.ts`, replace the `ProfileApiService`-based `avatarUrl` computed (added earlier this session) with the same `FileApiService.getFileUrl` pattern as Step 3. Update `main-layout.component.spec.ts`'s `profileApiStub` to a `fileApiStub = { getFileUrl: (fileId: string) => ... }` provided as `FileApiService`, replacing every `ProfileApiService`/`profileApiStub` reference added earlier this session in that spec file.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx ng test --include="src/app/modules/profile/**/*.spec.ts" --include="src/app/layouts/main-layout/main-layout.component.spec.ts" --include="src/app/layouts/main-layout/main-layout.tray-presence.spec.ts" --watch=false`
Expected: PASS, all green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: build the profile/topbar avatar URL through FileApiService instead of a per-feature helper"
```

---

### Task 3: Rewire task-form-modal + member-management-popup onto `FileApiService`

**Files:**
- Modify: `src/app/modules/work/ui/task-form-modal/task-form-modal.component.ts`
- Modify: `src/app/modules/work/ui/member-management-popup/member-management-popup.component.ts`
- Modify: `src/app/modules/work/models/dto/objective-invitation.dto.ts` (rename `avatarUrl` → `avatarFileId`)
- Update the corresponding `.spec.ts` files

**Interfaces:**
- Consumes: `FileApiService.getFileUrl` (Task 1), `ObjectiveMemberItemDto.avatarFileId` (backend plan Task 7 already renames the wire field to `avatarFileId`).

- [ ] **Step 1: Rename the DTO field**

In `objective-invitation.dto.ts`, change `avatarUrl: string | null;` to `avatarFileId: string | null;` on `ObjectiveMemberItemDto`.

- [ ] **Step 2: Write the failing tests**

In `task-form-modal.component.spec.ts`, replace the `members` fixture's `avatarUrl: '...'`/`avatarUrl: null` with `avatarFileId: 'file-e1'`/`avatarFileId: null`, and change the two avatar-rendering test assertions (`renders the current assignee avatar image...`, `renders avatar images...for every member...`) to expect a URL built via a mocked `FileApiService.getFileUrl` (add `{ provide: FileApiService, useValue: { getFileUrl: (id: string) => \`https://api.test/files/${id}\` } }` to the providers array) instead of the raw `avatarUrl` value passed straight through.

In `member-management-popup.component.spec.ts`, same rename in the `objectiveMembers` fixture (`avatarFileId` instead of `avatarUrl`) and same `FileApiService` mock provider addition, updating the avatar-image assertion accordingly.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx ng test --include="src/app/modules/work/ui/task-form-modal/task-form-modal.component.spec.ts" --include="src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts" --watch=false`
Expected: FAIL — components still read `.avatarUrl` and don't inject `FileApiService`.

- [ ] **Step 4: Rewire `task-form-modal.component.ts`**

Replace the `PeopleApiService` injection added earlier this session with `FileApiService`. Change:
- `assignableMembers` signal type: `avatarUrl: string | null` → `avatarFileId: string | null`
- `loadMembers()`'s mapping: `avatarUrl: m.avatarUrl` → `avatarFileId: m.avatarFileId` (from `ObjectiveMemberItemDto`, Step 1)
- `assigneeAvatarUrl` computed and `getSubtaskAssigneeAvatarUrl(employeeId)`: both currently look up `.avatarUrl` on the found member — change to look up `.avatarFileId`, then pass through `this.fileApi.getFileUrl(fileId)` (return `null` if no `avatarFileId`, matching the existing null-safe pattern)
- Every template `[avatarUrl]="member.avatarUrl"` → `[avatarUrl]="member.avatarFileId ? fileApi.getFileUrl(member.avatarFileId) : null"` (4 occurrences — the popover list in both the header-chip and property-row assignee pickers, the subtask popover list, the new-subtask popover list)

- [ ] **Step 5: Rewire `member-management-popup.component.ts`**

Inject `FileApiService`. Change the objective-scope row's `[avatarUrl]="member.avatarUrl"` to `[avatarUrl]="member.avatarFileId ? fileApi.getFileUrl(member.avatarFileId) : null"`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx ng test --include="src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, full work-module suite green.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: build objective-member avatar URLs through FileApiService instead of a signed R2 URL"
```

---

### Task 4: Rewire `EmployeeDirectoryStore` + People module read paths onto `FileApiService`

**Files:**
- Modify: `src/app/modules/work/state/employee-directory.store.ts`
- Modify: `src/app/modules/people/models/employee.model.ts` (`EmployeeListItemResponse.avatarUrl` → `avatarFileId`, matching the backend plan's Task 6 rename)
- Delete: `PeopleApiService.getAvatarUrl` (the one-off added earlier this session, superseded)
- Update the corresponding `.spec.ts` files

**Interfaces:**
- Consumes: `FileApiService.getFileUrl` (Task 1).

- [ ] **Step 1: Rename the model field**

In `employee.model.ts`, change `readonly avatarUrl?: string | null;` to `readonly avatarFileId?: string | null;` on `EmployeeListItemResponse`.

- [ ] **Step 2: Delete the superseded helper**

In `people-api.service.ts`, remove the `getAvatarUrl(employeeId)` method added earlier this session. Remove its test from `people-api.service.spec.ts`.

- [ ] **Step 3: Write the failing test**

In `employee-directory.store.spec.ts`, the existing avatar-URL test (`ensureLoaded carries the resolved avatarUrl through...`) currently flushes `{ ...employee, avatarUrl: 'https://api.test/employees/emp-1/avatar' }` and asserts `store.get('emp-1')?.avatarUrl` equals that raw string. Change it to flush `{ ...employee, avatarFileId: 'file-1' }`, provide a mocked `FileApiService` (`{ getFileUrl: (id) => \`https://api.test/files/${id}\` }`), and assert `store.get('emp-1')?.avatarUrl` equals `'https://api.test/files/file-1'` (the store's own output field stays named `avatarUrl` on `EmployeeSummary` — only the *input* DTO field and the *resolution mechanism* changed).

- [ ] **Step 4: Run the test to verify it fails**

Run: `npx ng test --include="src/app/modules/work/state/employee-directory.store.spec.ts" --watch=false`
Expected: FAIL — store still reads `employee.avatarUrl` directly with no `FileApiService`.

- [ ] **Step 5: Rewire the store**

In `employee-directory.store.ts`, inject `FileApiService`, and change:

```typescript
additions[id] = employee
  ? { id: employee.id, name: employee.fullName, initials: buildInitials(employee.fullName), avatarUrl: employee.avatarUrl ?? null }
  : { id, name: 'Unknown employee', initials: '?', avatarUrl: null };
```

to:

```typescript
additions[id] = employee
  ? { id: employee.id, name: employee.fullName, initials: buildInitials(employee.fullName), avatarUrl: employee.avatarFileId ? fileApi.getFileUrl(employee.avatarFileId) : null }
  : { id, name: 'Unknown employee', initials: '?', avatarUrl: null };
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx ng test --include="src/app/modules/work/state/employee-directory.store.spec.ts" --include="src/app/modules/people/data-access/people-api.service.spec.ts" --watch=false`
Expected: PASS, all green.

- [ ] **Step 7: Run the full suite and commit**

Run: `npx ng test --watch=false 2>&1 | tail -20`
Expected: full suite passes (aside from the same pre-existing unrelated unhandled-error warning noted throughout this session).

```bash
git add -A
git commit -m "refactor: resolve People-module/task-card avatars through FileApiService instead of a signed R2 URL"
```

## Self-Review Notes

- Spec coverage: this plan rewires every frontend avatar consumer touched earlier this session (profile, topbar, task-form-modal, member-management-popup, employee-directory store) onto the one real centralized mechanism. It does **not** touch project logo/banner or task-attachment upload UI, or build the shared `<app-file-upload>` picker component — that is Part 2, scoped separately once this backend+frontend Phase 1 pair ships and is confirmed working live.
- No placeholders: every step has real, compilable TypeScript.
- Type consistency: `avatarFileId` is `string | null` everywhere in this plan; the only place a URL string exists is the return value of `FileApiService.getFileUrl`, never stored back into a model.
