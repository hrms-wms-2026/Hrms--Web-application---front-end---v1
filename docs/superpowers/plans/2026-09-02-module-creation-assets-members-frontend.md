# Module Creation Screen — Assets, Members, Date Range Picker (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the module/sub-module creation & edit dialog (`sub-module-form.component.ts`) to add a single consolidated asset-upload section and a create-mode Members/owner picker, and swap the two plain date inputs for the app's existing shared date-range-picker — consuming the backend endpoints built in the companion backend plan (`docs/superpowers/plans/2026-09-02-objective-asset-attachments-backend.md` in `HRMS-Backend-v1`).

**Architecture:** `sub-module-form.component.ts` gains a new `app-asset-upload-list` presentational child component (dropzone + status rows, no API access of its own) and drives asset uploads/deletes itself in edit mode (it already knows the objective id via `initialValue()`), while in create mode it stages `File[]` locally and hands them to the parent (`milestone-tree-tab.component.ts`) alongside the create payload — the parent already owns the create-API call and is the only place that learns the new objective's id.

**Tech Stack:** Angular 21, standalone components, signals (`input()`/`output()`/`signal()`), `@ngrx/signals` `signalStore`, Vitest (`vi.fn()`), `TestBed`.

**Base branch:** `feature/employee-management-phase1-foundation` (this feature area does not exist on `main`). Work on `docs/module-creation-assets-design`, which is already based on it, or a fresh branch off it. **Depends on the backend plan being deployed/available** — endpoints `POST`/`GET`/`DELETE /work/objectives/{id}/assets(/...)` and the `assets` field on `GET /work/objectives/{id}` must exist for Tasks 3–4 to work end-to-end; the component/unit tests in Tasks 1–3 mock the API and don't need a live backend.

## Global Constraints

- Links (external URLs) are explicitly out of scope — file uploads only (per the approved spec).
- The Members section applies to **create mode only** — `EditObjectiveRequestDto` has no head/member fields, and edit-mode membership changes already go through the separate `app-member-management-popup` (`scope="objective"`) elsewhere; do not duplicate that here.
- File type/size validation is enforced server-side (backend plan, Task 1) — the frontend does not need to replicate the allow-list, but should let the server's 400 error surface via the existing `errorMessage`/status mechanisms.
- `environment.apiUrl` already includes the API version prefix — objective asset endpoints are `` `${environment.apiUrl}/work/objectives/${id}/assets` `` and `` `${environment.apiUrl}/work/objectives/${id}/assets/${assetId}` ``, matching every other objective-scoped call in `ProjectApiService`.

---

### Task 1: DTOs, API service methods, and store actions for objective assets

**Files:**
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`
- Modify: `src/app/modules/work/data-access/project-api.service.ts`
- Modify: `src/app/modules/work/state/project-detail.store.ts`
- Modify: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Produces: `ObjectiveAssetDto` type; `ProjectApiService.uploadObjectiveAsset(objectiveId: string, file: File): Observable<ObjectiveAssetDto>`, `.deleteObjectiveAsset(objectiveId: string, assetId: string): Observable<void>`; `ProjectDetailStore.createSubModule(...)` now also returns `objectiveId`; new `ProjectDetailStore.uploadMilestoneAsset(objectiveId: string, file: File): Promise<{ success: boolean; asset?: ObjectiveAssetDto }>` and `.deleteMilestoneAsset(objectiveId: string, assetId: string): Promise<{ success: boolean }>` — all consumed by Task 4.

- [ ] **Step 1: Write the failing store tests**

In `src/app/modules/work/state/project-detail.store.spec.ts`, first fix the existing `createSubModule` success assertion (it will break once the method starts returning `objectiveId`) — change:

```typescript
    expect(result).toEqual({ success: true });
```

to:

```typescript
    expect(result).toEqual({ success: true, objectiveId: 'o3' });
```

(this is the only line inside the `'createSubModule returns success:true and clears milestoneActionError on success'` test that changes — its `setup({ createObjective: () => of({ id: 'o3' } as ObjectiveDetailDto) })` mock already returns `id: 'o3'`, which the fixed implementation will now read.)

Then add these two new tests, placed right after the existing `createSubModule` failure test:

```typescript
  it('uploadMilestoneAsset returns success:true with the uploaded asset on success', async () => {
    const asset: ObjectiveAssetDto = {
      id: 'a1', fileName: 'plan.pdf', sizeBytes: 2048, contentType: 'application/pdf',
      uploadedAt: '2026-09-02T00:00:00Z', downloadUrl: 'https://signed.example/plan.pdf'
    };
    const store = setup({ uploadObjectiveAsset: () => of(asset) } as Partial<ProjectApiService>);

    const result = await store.uploadMilestoneAsset('o1', new File(['x'], 'plan.pdf'));

    expect(result).toEqual({ success: true, asset });
    expect(store.milestoneActionError()).toBeNull();
  });

  it('uploadMilestoneAsset returns success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      uploadObjectiveAsset: () => throwError(() => ({ error: { detail: 'file too large' } }))
    } as Partial<ProjectApiService>);

    const result = await store.uploadMilestoneAsset('o1', new File(['x'], 'huge.zip'));

    expect(result).toEqual({ success: false });
    expect(store.milestoneActionError()).toBe('file too large');
  });

  it('deleteMilestoneAsset returns success:true and clears milestoneActionError on success', async () => {
    const store = setup({ deleteObjectiveAsset: () => of(undefined) } as Partial<ProjectApiService>);

    const result = await store.deleteMilestoneAsset('o1', 'a1');

    expect(result).toEqual({ success: true });
    expect(store.milestoneActionError()).toBeNull();
  });

  it('deleteMilestoneAsset returns success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      deleteObjectiveAsset: () => throwError(() => ({ error: { detail: 'asset not found' } }))
    } as Partial<ProjectApiService>);

    const result = await store.deleteMilestoneAsset('o1', 'a1');

    expect(result).toEqual({ success: false });
    expect(store.milestoneActionError()).toBe('asset not found');
  });
```

Add `ObjectiveAssetDto` to the existing DTO import line at the top of the file:

```typescript
import { MyProjectMilestoneDto, ObjectiveDetailDto, CreateObjectiveRequestDto, AddObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto, ObjectiveAssetDto } from '../models/dto/milestone.dto';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/work/state/project-detail.store.spec.ts`
Expected: FAIL — `uploadObjectiveAsset`/`deleteObjectiveAsset` don't exist on `ProjectApiService` yet, `uploadMilestoneAsset`/`deleteMilestoneAsset` don't exist on the store yet, and the fixed `createSubModule` assertion fails against the current (unpatched) return value.

- [ ] **Step 3: Add `ObjectiveAssetDto` to the DTO file**

In `src/app/modules/work/models/dto/milestone.dto.ts`, add this interface (anywhere near the other Objective-related interfaces, e.g. right after `CreateObjectiveMemberInvitationRequestDto`):

```typescript
export interface ObjectiveAssetDto {
  id: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
  downloadUrl: string;
}
```

Then add an `assets` field to `ObjectiveDetailDto` — append it as the last field:

```typescript
export interface ObjectiveDetailDto {
  id: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  description: string | null;
  ownerId: string;
  ownerName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  createdById: string;
  startDate: string;
  endDate: string;
  progress: number;
  actualHours: number | null;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isOwner: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  assets: ObjectiveAssetDto[];
}
```

(only the added `assets: ObjectiveAssetDto[];` line at the end is new — every other field stays as-is)

- [ ] **Step 4: Add the API service methods**

In `src/app/modules/work/data-access/project-api.service.ts`, add these two methods at the end of the class, right after `createObjective`:

```typescript
  uploadObjectiveAsset(objectiveId: string, file: File): Observable<ObjectiveAssetDto> {
    const formData = new FormData();
    formData.set('File', file);
    return this.http.post<ObjectiveAssetDto>(`${environment.apiUrl}/work/objectives/${objectiveId}/assets`, formData);
  }

  deleteObjectiveAsset(objectiveId: string, assetId: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/work/objectives/${objectiveId}/assets/${assetId}`);
  }
```

Add `ObjectiveAssetDto` to the existing DTO import line at the top:

```typescript
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto, EditObjectiveRequestDto, CreateObjectiveRequestDto, AddObjectiveMemberOutcomeDto, ObjectiveAssetDto } from '../models/dto/milestone.dto';
```

- [ ] **Step 5: Fix `createSubModule` and add the two new store actions**

In `src/app/modules/work/state/project-detail.store.ts`, replace the `createSubModule` method:

```typescript
    async createSubModule(payload: CreateObjectiveRequestDto): Promise<{ success: boolean; objectiveId?: string }> {
      try {
        const created = await firstValueFrom(api.createObjective(payload));
        patchState(store, { milestoneActionError: null });
        return { success: true, objectiveId: created.id };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to create sub-module.') });
        return { success: false };
      }
    },
```

(only the return type and the two lines inside the `try` block change — the `catch` block stays identical)

Then add these two new methods immediately after it (still inside the same `withMethods((...) => ({ ... }))` object literal):

```typescript
    async uploadMilestoneAsset(objectiveId: string, file: File): Promise<{ success: boolean; asset?: ObjectiveAssetDto }> {
      try {
        const asset = await firstValueFrom(api.uploadObjectiveAsset(objectiveId, file));
        patchState(store, { milestoneActionError: null });
        return { success: true, asset };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to upload file.') });
        return { success: false };
      }
    },

    async deleteMilestoneAsset(objectiveId: string, assetId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(api.deleteObjectiveAsset(objectiveId, assetId));
        patchState(store, { milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to delete file.') });
        return { success: false };
      }
    },
```

Add `ObjectiveAssetDto` to whatever DTO import line this file already has for `CreateObjectiveRequestDto` (add it alongside the other milestone DTO imports at the top of the file).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/work/state/project-detail.store.spec.ts`
Expected: PASS (all tests in the file, including the 4 new ones and the fixed one)

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/models/dto/milestone.dto.ts src/app/modules/work/data-access/project-api.service.ts src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat: add objective asset DTOs, API methods, and store actions"
```

---

### Task 2: New `app-asset-upload-list` presentational component

**Files:**
- Create: `src/app/modules/work/ui/asset-upload-list/asset-upload-list.component.ts`
- Create: `src/app/modules/work/ui/asset-upload-list/asset-upload-list.component.spec.ts`

**Interfaces:**
- Produces: `AssetRowView { id: string; fileName: string; sizeBytes: number; status: 'staged' | 'uploading' | 'uploaded' | 'error'; errorMessage?: string }`; component selector `app-asset-upload-list` with `rows: input<readonly AssetRowView[]>`, `disabled: input(false)`, `filesPicked: output<File[]>`, `removeRequested: output<string>`, `retryRequested: output<string>` — consumed by Task 3.

This component is purely presentational — no API access, no knowledge of create vs. edit mode. It renders one dropzone (drag/drop not required, a native file `<input>` is sufficient — the reference design and existing codebase precedent, `project-form-modal`'s logo/banner picker, are both click-to-browse, no drag-and-drop logic) plus a list of rows.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/asset-upload-list/asset-upload-list.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AssetUploadListComponent, AssetRowView } from './asset-upload-list.component';

describe('AssetUploadListComponent', () => {
  let fixture: ComponentFixture<AssetUploadListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AssetUploadListComponent] });
    fixture = TestBed.createComponent(AssetUploadListComponent);
  });

  it('renders one row per input row with its status', () => {
    const rows: AssetRowView[] = [
      { id: 'a1', fileName: 'plan.pdf', sizeBytes: 2048, status: 'uploaded' },
      { id: 'a2', fileName: 'huge.zip', sizeBytes: 30_000_000, status: 'error', errorMessage: 'File exceeds the maximum allowed size.' }
    ];
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();

    const renderedRows = fixture.nativeElement.querySelectorAll('[data-testid="asset-row"]');
    expect(renderedRows.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('plan.pdf');
    expect(fixture.nativeElement.textContent).toContain('File exceeds the maximum allowed size.');
  });

  it('emits filesPicked with the selected files', () => {
    fixture.detectChanges();
    const picked = vi.fn();
    (fixture.componentInstance as any).filesPicked.subscribe(picked);
    const file = new File(['content'], 'plan.pdf', { type: 'application/pdf' });
    const input: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="asset-file-input"]');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    input.dispatchEvent(new Event('change'));

    expect(picked).toHaveBeenCalledWith([file]);
  });

  it('emits removeRequested with the row id when Remove is clicked', () => {
    fixture.componentRef.setInput('rows', [{ id: 'a1', fileName: 'plan.pdf', sizeBytes: 2048, status: 'uploaded' } as AssetRowView]);
    fixture.detectChanges();
    const removed = vi.fn();
    (fixture.componentInstance as any).removeRequested.subscribe(removed);

    (fixture.nativeElement.querySelector('[data-testid="asset-remove-button"]') as HTMLElement).click();

    expect(removed).toHaveBeenCalledWith('a1');
  });

  it('shows a retry control only for error rows, and emits retryRequested with the row id', () => {
    fixture.componentRef.setInput('rows', [{ id: 'a2', fileName: 'huge.zip', sizeBytes: 30_000_000, status: 'error', errorMessage: 'too big' } as AssetRowView]);
    fixture.detectChanges();
    const retried = vi.fn();
    (fixture.componentInstance as any).retryRequested.subscribe(retried);

    const retryButton = fixture.nativeElement.querySelector('[data-testid="asset-retry-button"]') as HTMLElement;
    expect(retryButton).not.toBeNull();
    retryButton.click();

    expect(retried).toHaveBeenCalledWith('a2');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/modules/work/ui/asset-upload-list/asset-upload-list.component.spec.ts`
Expected: FAIL — the component file doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `src/app/modules/work/ui/asset-upload-list/asset-upload-list.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';

export interface AssetRowView {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: 'staged' | 'uploading' | 'uploaded' | 'error';
  errorMessage?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

@Component({
  selector: 'app-asset-upload-list',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="flex flex-col gap-2">
      <div class="relative flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6">
        <span class="text-xs text-[var(--color-text-secondary)]">Drop files here or click to browse</span>
        <input
          data-testid="asset-file-input"
          type="file"
          multiple
          [disabled]="disabled()"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          (change)="onFileInputChange($event)"
        />
      </div>

      @for (row of rows(); track row.id) {
        <div data-testid="asset-row" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
          <div class="flex flex-col">
            <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ row.fileName }}</span>
            <span class="text-[10px] text-[var(--color-text-secondary)]">
              {{ formatSize(row.sizeBytes) }}
              @if (row.status === 'staged') { · Pending upload }
              @if (row.status === 'uploading') { · Uploading… }
              @if (row.status === 'error') { · {{ row.errorMessage ?? 'Upload failed.' }} }
            </span>
          </div>
          <div class="flex items-center gap-1">
            @if (row.status === 'error') {
              <span data-testid="asset-retry-button" (click)="retryRequested.emit(row.id)">
                <app-button variant="secondary" size="sm">Retry</app-button>
              </span>
            }
            <span data-testid="asset-remove-button" (click)="removeRequested.emit(row.id)">
              <app-button variant="secondary" size="sm">Remove</app-button>
            </span>
          </div>
        </div>
      }
    </div>
  `
})
export class AssetUploadListComponent {
  rows = input<readonly AssetRowView[]>([]);
  disabled = input(false);

  filesPicked = output<File[]>();
  removeRequested = output<string>();
  retryRequested = output<string>();

  protected readonly formatSize = formatSize;

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      this.filesPicked.emit(files);
    }
    input.value = '';
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app/modules/work/ui/asset-upload-list/asset-upload-list.component.spec.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/asset-upload-list/
git commit -m "feat: add standalone asset-upload-list component"
```

---

### Task 3: Redesign `sub-module-form`: date range picker, Members (create-only), Assets

**Files:**
- Modify: `src/app/modules/work/ui/sub-module-form/sub-module-form.component.ts`
- Modify: `src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts`

**Interfaces:**
- Consumes: `AssetUploadListComponent`/`AssetRowView` (Task 2), `ProjectApiService.uploadObjectiveAsset`/`.deleteObjectiveAsset` (Task 1), `EmployeePickerComponent` (existing), `EmployeeDirectoryStore` (existing, `.get(id)` / `.ensureLoaded(ids)`), `DateRangePickerComponent` (existing).
- Produces: `created = output<{ payload: CreateObjectiveRequestDto; assetFiles: readonly File[] }>()` — **this output's emitted type changes** from the current `output<CreateObjectiveRequestDto>()`. Task 4 updates the one consumer (`milestone-tree-tab.component.ts`) accordingly.

This task rewrites the whole component in one step — the date-range-picker swap, Members section, and Assets section all touch overlapping regions of this same ~150-line file, so splitting them into separate partial-edit tasks would leave the file in an inconsistent state between steps. This is the smallest unit that can be reviewed as a whole ("the redesigned dialog") and carries its own full test cycle.

- [ ] **Step 1: Write the failing tests (extend the existing spec file)**

Replace the full contents of `src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SubModuleFormComponent } from './sub-module-form.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { ProjectApiService } from '../../data-access/project-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('SubModuleFormComponent', () => {
  let fixture: ComponentFixture<SubModuleFormComponent>;
  let api: { uploadObjectiveAsset: ReturnType<typeof vi.fn>; deleteObjectiveAsset: ReturnType<typeof vi.fn> };

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: 'parent-1', isDefault: false,
    title: 'Design Phase', description: 'Scope design', ownerId: 'u1', ownerName: 'Arun',
    reportingManagerId: 'm1', reportingManagerName: 'Manager', createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
    allocatedHours: 20, completedHours: 0, isActive: true, isOwner: true,
    isAchieved: false, achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
    assets: [{ id: 'a1', fileName: 'existing.pdf', sizeBytes: 1024, contentType: 'application/pdf', uploadedAt: '2026-01-01T00:00:00Z', downloadUrl: 'https://signed.example/existing.pdf' }]
  };

  beforeEach(() => {
    api = { uploadObjectiveAsset: vi.fn(), deleteObjectiveAsset: vi.fn() };
    TestBed.configureTestingModule({
      imports: [SubModuleFormComponent],
      providers: [
        { provide: ProjectApiService, useValue: api },
        { provide: EmployeeDirectoryStore, useValue: { get: () => ({ name: 'Nadia Shah' }), ensureLoaded: vi.fn() } }
      ]
    });
    fixture = TestBed.createComponent(SubModuleFormComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('emits the create payload with headEmployeeId/memberInvitations built from picked members', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('New Module');
    component.description.set('Details');
    component.startDate.set('2026-04-01');
    component.endDate.set('2026-05-01');
    component.allocatedHours.set(12);
    component.onMemberPicked('emp-1');
    component.onMemberPicked('emp-2');
    component.onSetOwner('emp-2');
    const created = vi.fn();
    component.created.subscribe(created);

    component.submit();

    expect(created).toHaveBeenCalledWith({
      payload: {
        parentObjectiveId: 'parent-1', title: 'New Module', description: 'Details',
        startDate: '2026-04-01', endDate: '2026-05-01', allocatedHours: 12,
        headEmployeeId: 'emp-2', memberInvitations: [{ employeeId: 'emp-1', type: 'member' }]
      },
      assetFiles: []
    });
  });

  it('has no Members section in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="members-section"]')).toBeNull();
  });

  it('emits staged files as assetFiles on create submit, without uploading them', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('New Module');
    component.startDate.set('2026-04-01');
    component.endDate.set('2026-05-01');
    const file = new File(['content'], 'plan.pdf', { type: 'application/pdf' });
    component.onAssetFilesPicked([file]);
    const created = vi.fn();
    component.created.subscribe(created);

    component.submit();

    expect(api.uploadObjectiveAsset).not.toHaveBeenCalled();
    expect(created).toHaveBeenCalledWith(expect.objectContaining({ assetFiles: [file] }));
  });

  it('prefills existing assets in edit mode as uploaded rows', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    expect(component.assetRows()).toEqual([{ id: 'a1', fileName: 'existing.pdf', sizeBytes: 1024, status: 'uploaded' }]);
  });

  it('uploads a picked file immediately in edit mode and marks it uploaded on success', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    const uploaded = { id: 'a2', fileName: 'new.pdf', sizeBytes: 512, contentType: 'application/pdf', uploadedAt: '2026-01-02T00:00:00Z', downloadUrl: 'https://signed.example/new.pdf' };
    api.uploadObjectiveAsset.mockReturnValue(of(uploaded));
    const file = new File(['content'], 'new.pdf', { type: 'application/pdf' });

    component.onAssetFilesPicked([file]);
    expect(component.assetRows().find((r: any) => r.fileName === 'new.pdf').status).toBe('uploading');
    await Promise.resolve();
    await Promise.resolve();

    expect(api.uploadObjectiveAsset).toHaveBeenCalledWith('o1', file);
    expect(component.assetRows().find((r: any) => r.id === 'a2').status).toBe('uploaded');
  });

  it('marks a failed edit-mode upload as error and allows retry', async () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    api.uploadObjectiveAsset.mockReturnValueOnce(throwError(() => new Error('rejected')));
    const file = new File(['content'], 'bad.exe', { type: 'application/x-msdownload' });

    component.onAssetFilesPicked([file]);
    await Promise.resolve();
    await Promise.resolve();

    const failedRow = component.assetRows().find((r: any) => r.fileName === 'bad.exe');
    expect(failedRow.status).toBe('error');

    api.uploadObjectiveAsset.mockReturnValue(of({ id: 'a3', fileName: 'bad.exe', sizeBytes: 1, contentType: 'x', uploadedAt: 'now', downloadUrl: 'x' }));
    component.onAssetRetry(failedRow.id);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.assetRows().find((r: any) => r.id === 'a3').status).toBe('uploaded');
  });

  it('deletes an uploaded asset immediately in edit mode on remove', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    api.deleteObjectiveAsset.mockReturnValue(of(undefined));

    component.onAssetRemove('a1');

    expect(api.deleteObjectiveAsset).toHaveBeenCalledWith('o1', 'a1');
    expect(component.assetRows()).toEqual([]);
  });

  it('prefills edit mode and emits fields with achieved metadata', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;
    component.title.set('Updated Module');
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.submit();

    expect(component.description()).toBe('Scope design');
    expect(saved).toHaveBeenCalledWith({
      fields: {
        title: 'Updated Module', description: 'Scope design',
        startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 20
      },
      achievedChanged: false,
      achieved: false
    });
  });

  it('shows the Default Module explanation and disables Achieved in edit mode', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    const achieved = fixture.nativeElement.querySelector('[data-testid="achieved-field"] input') as HTMLInputElement;

    expect(achieved.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Default Module follows');
  });

  it('blocks invalid create values and shows field errors', () => {
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('parentObjectiveId', 'parent-1');
    fixture.detectChanges();
    const created = vi.fn();
    (fixture.componentInstance as any).created.subscribe(created);

    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(created).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts`
Expected: FAIL to compile / FAIL — `onMemberPicked`, `onSetOwner`, `onAssetFilesPicked`, `assetRows`, `onAssetRetry`, `onAssetRemove` don't exist yet; `created`'s payload shape doesn't match; `ObjectiveDetail`'s `assets` field doesn't exist on the type yet (fixed by Task 1, already merged if these plans run in order).

- [ ] **Step 3: Rewrite the component**

Replace the full contents of `src/app/modules/work/ui/sub-module-form/sub-module-form.component.ts`:

```typescript
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DateRangePickerComponent } from '../../../../shared/ui/date-range-picker/date-range-picker.component';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { AssetUploadListComponent, AssetRowView } from '../asset-upload-list/asset-upload-list.component';
import { ProjectApiService } from '../../data-access/project-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { ObjectiveDetail } from '../../models/milestone.model';
import { CreateObjectiveRequestDto, EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

interface SelectedMember {
  employeeId: string;
  isOwner: boolean;
}

@Component({
  selector: 'app-sub-module-form',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent, DateRangePickerComponent, EmployeePickerComponent, AssetUploadListComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'edit' ? 'Module settings' : 'Create sub Module'" size="lg" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="title-field">
          <app-input label="Title" [value]="title()" [error]="errors()['title'] ?? ''" (valueChange)="title.set($event)" />
        </span>
        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>
        <span data-testid="date-range-field">
          <app-date-range-picker [from]="startDate()" [to]="endDate()" (rangeChange)="onRangeChange($event)" />
          @if (errors()['startDate'] || errors()['endDate']) {
            <p class="text-xs text-[var(--color-danger-text)]">{{ errors()['startDate'] || errors()['endDate'] }}</p>
          }
        </span>
        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        @if (mode() === 'edit') {
          <span data-testid="achieved-field" class="flex items-center gap-2">
            <input type="checkbox" id="sub-module-achieved-toggle" [checked]="achieved()" [disabled]="isDefault()" (change)="onAchievedChange($event)" />
            <label for="sub-module-achieved-toggle" class="text-sm text-[var(--color-text-primary)]">Achieved</label>
            @if (isDefault()) {
              <span class="text-xs text-[var(--color-text-secondary)]">(Achieve the project instead — the Default Module follows the project's own achieved state)</span>
            }
          </span>
        }

        @if (mode() === 'create') {
          <div data-testid="members-section" class="flex flex-col gap-2">
            <span class="text-xs font-semibold text-[var(--color-text-primary)]">Members</span>
            <span data-testid="add-member-button">
              <app-button variant="secondary" size="sm" (pressed)="memberPickerOpen.set(true)">+ Add member</app-button>
            </span>
            @for (member of members(); track member.employeeId) {
              <div data-testid="member-row" [attr.data-employee-id]="member.employeeId" class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
                <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ directory.get(member.employeeId)?.name ?? 'Unknown employee' }}</span>
                <div class="flex items-center gap-1">
                  @if (member.isOwner) {
                    <span data-testid="owner-badge" class="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">Owner</span>
                  } @else {
                    <span data-testid="make-owner-button" (click)="onSetOwner(member.employeeId)">
                      <app-button variant="secondary" size="sm">Make owner</app-button>
                    </span>
                  }
                  <span data-testid="remove-member-button" (click)="onMemberRemove(member.employeeId)">
                    <app-button variant="secondary" size="sm">Remove</app-button>
                  </span>
                </div>
              </div>
            }
          </div>
          <app-employee-picker [open]="memberPickerOpen()" (selected)="onMemberPicked($event)" (closed)="memberPickerOpen.set(false)" />
        }

        <div data-testid="assets-section" class="flex flex-col gap-2">
          <span class="text-xs font-semibold text-[var(--color-text-primary)]">Assets</span>
          <app-asset-upload-list
            [rows]="assetRows()"
            [disabled]="submitting()"
            (filesPicked)="onAssetFilesPicked($event)"
            (removeRequested)="onAssetRemove($event)"
            (retryRequested)="onAssetRetry($event)"
          />
        </div>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
              {{ mode() === 'edit' ? 'Save changes' : 'Create' }}
            </app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class SubModuleFormComponent {
  private readonly api = inject(ProjectApiService);
  protected readonly directory = inject(EmployeeDirectoryStore);

  mode = input<'create' | 'edit'>('create');
  open = input(false);
  parentObjectiveId = input('');
  initialValue = input<ObjectiveDetail | null>(null);
  submitting = input(false);
  errorMessage = input('');

  created = output<{ payload: CreateObjectiveRequestDto; assetFiles: readonly File[] }>();
  saved = output<{ fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  startDate = signal('');
  endDate = signal('');
  allocatedHours = signal(0);
  achieved = signal(false);
  isDefault = signal(false);
  errors = signal<Record<string, string>>({});

  members = signal<SelectedMember[]>([]);
  memberPickerOpen = signal(false);

  assetRows = signal<AssetRowView[]>([]);
  private pendingFiles = new Map<string, File>();
  private nextLocalId = 0;

  constructor() {
    effect(() => {
      this.open();
      const value = this.initialValue();
      if (this.mode() === 'edit' && value) {
        this.title.set(value.title);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.endDate.set(value.endDate);
        this.allocatedHours.set(value.allocatedHours);
        this.achieved.set(value.isAchieved ?? false);
        this.isDefault.set(value.isDefault);
        this.assetRows.set((value.assets ?? []).map((a) => ({ id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes, status: 'uploaded' as const })));
      } else if (this.mode() === 'create') {
        this.title.set('');
        this.description.set('');
        this.startDate.set('');
        this.endDate.set('');
        this.allocatedHours.set(0);
        this.achieved.set(false);
        this.isDefault.set(false);
        this.assetRows.set([]);
        this.members.set([]);
      }
      this.pendingFiles.clear();
      this.errors.set({});
    });
  }

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
  }

  onAchievedChange(event: Event): void {
    this.achieved.set((event.target as HTMLInputElement).checked);
  }

  onRangeChange(range: { from: string; to: string }): void {
    this.startDate.set(range.from);
    this.endDate.set(range.to);
  }

  onMemberPicked(employeeId: string): void {
    this.memberPickerOpen.set(false);
    if (this.members().some((m) => m.employeeId === employeeId)) return;
    const isFirst = this.members().length === 0;
    this.members.update((list) => [...list, { employeeId, isOwner: isFirst }]);
    void this.directory.ensureLoaded([employeeId]);
  }

  onMemberRemove(employeeId: string): void {
    this.members.update((list) => list.filter((m) => m.employeeId !== employeeId));
  }

  onSetOwner(employeeId: string): void {
    this.members.update((list) => list.map((m) => ({ ...m, isOwner: m.employeeId === employeeId })));
  }

  onAssetFilesPicked(files: File[]): void {
    for (const file of files) {
      const id = `local-${this.nextLocalId++}`;
      this.pendingFiles.set(id, file);
      if (this.mode() === 'edit') {
        this.assetRows.update((rows) => [...rows, { id, fileName: file.name, sizeBytes: file.size, status: 'uploading' }]);
        void this.uploadEditModeAsset(id, file);
      } else {
        this.assetRows.update((rows) => [...rows, { id, fileName: file.name, sizeBytes: file.size, status: 'staged' }]);
      }
    }
  }

  onAssetRetry(id: string): void {
    const file = this.pendingFiles.get(id);
    if (!file) return;
    this.assetRows.update((rows) => rows.map((row) => (row.id === id ? { ...row, status: 'uploading' as const, errorMessage: undefined } : row)));
    void this.uploadEditModeAsset(id, file);
  }

  onAssetRemove(id: string): void {
    const objectiveId = this.initialValue()?.id;
    const row = this.assetRows().find((r) => r.id === id);
    this.pendingFiles.delete(id);
    if (this.mode() === 'edit' && objectiveId && row?.status === 'uploaded') {
      this.assetRows.update((rows) => rows.filter((r) => r.id !== id));
      void firstValueFrom(this.api.deleteObjectiveAsset(objectiveId, id)).catch(() => undefined);
      return;
    }
    this.assetRows.update((rows) => rows.filter((r) => r.id !== id));
  }

  private async uploadEditModeAsset(localId: string, file: File): Promise<void> {
    const objectiveId = this.initialValue()?.id;
    if (!objectiveId) return;
    try {
      const asset = await firstValueFrom(this.api.uploadObjectiveAsset(objectiveId, file));
      this.pendingFiles.delete(localId);
      this.assetRows.update((rows) => rows.map((row) =>
        row.id === localId ? { id: asset.id, fileName: asset.fileName, sizeBytes: asset.sizeBytes, status: 'uploaded' as const } : row));
    } catch {
      this.assetRows.update((rows) => rows.map((row) =>
        row.id === localId ? { ...row, status: 'error' as const, errorMessage: 'Upload failed.' } : row));
    }
  }

  submit(): void {
    const errors: Record<string, string> = {};
    if (!this.title().trim()) errors['title'] = 'Title is required.';
    if (!this.startDate()) errors['startDate'] = 'Start date is required.';
    if (!this.endDate()) errors['endDate'] = 'End date is required.';
    else if (this.startDate() && this.endDate() < this.startDate()) errors['endDate'] = 'End date cannot be before the start date.';
    if (this.allocatedHours() < 0) errors['allocatedHours'] = 'Allocated hours cannot be negative.';

    this.errors.set(errors);
    if (Object.keys(errors).length > 0) return;

    if (this.mode() === 'create') {
      const owner = this.members().find((m) => m.isOwner);
      const others = this.members().filter((m) => !m.isOwner);
      const assetFiles = this.assetRows()
        .filter((row) => row.status === 'staged')
        .map((row) => this.pendingFiles.get(row.id))
        .filter((file): file is File => file !== undefined);

      this.created.emit({
        payload: {
          parentObjectiveId: this.parentObjectiveId(),
          title: this.title(),
          description: this.description() || null,
          startDate: this.startDate(),
          endDate: this.endDate(),
          allocatedHours: this.allocatedHours(),
          headEmployeeId: owner ? owner.employeeId : null,
          memberInvitations: others.map((m) => ({ employeeId: m.employeeId, type: 'member' as const }))
        },
        assetFiles
      });
      return;
    }

    const initial = this.initialValue();
    this.saved.emit({
      fields: {
        title: this.title(),
        description: this.description(),
        startDate: this.startDate(),
        endDate: this.endDate(),
        allocatedHours: this.allocatedHours()
      },
      achievedChanged: initial !== null && this.achieved() !== (initial?.isAchieved ?? false),
      achieved: this.achieved()
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/sub-module-form/sub-module-form.component.ts src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts
git commit -m "feat: redesign sub-module-form with date range picker, members, and assets"
```

---

### Task 4: Wire the create-mode asset-upload loop into `milestone-tree-tab`

**Files:**
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`

**Interfaces:**
- Consumes: `SubModuleFormComponent`'s new `created` output shape (Task 3), `ProjectDetailStore.createSubModule`/`.uploadMilestoneAsset` (Task 1).

The `(created)="onCreateModalCreated($event)"` binding in `milestone-tree-tab.component.html` needs no change — only the handler's parameter type and body change, since the event shape changed.

- [ ] **Step 1: Fix the failing test**

In `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`, update the `createSubModule` mock (around line 88) to also return an `objectiveId`, since the fixed handler will read it:

```typescript
      createSubModule: vi.fn().mockResolvedValue({ success: true, objectiveId: 'o1' }),
```

Add `uploadMilestoneAsset` to the same `storeStub` object literal (alongside `createSubModule`):

```typescript
      uploadMilestoneAsset: vi.fn().mockResolvedValue({ success: true }),
```

Update the existing `'reloads the tree and closes the modal after a successful create'` test's call to the new event shape:

```typescript
  it('reloads the tree and closes the modal after a successful create', async () => {
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.createModalParentId.set('o1');
    fixture.componentInstance.createModalOpen.set(true);
    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: []
    });

    expect(storeStub.createSubModule).toHaveBeenCalled();
    expect(storeStub.uploadMilestoneAsset).not.toHaveBeenCalled();
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
    expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(2);
  });
```

Add a new test right after it, asserting the upload loop runs for staged files:

```typescript
  it('uploads each staged asset file to the newly created objective before closing the modal', async () => {
    setup('o1');
    fixture.detectChanges();
    const fileA = new File(['a'], 'plan.pdf');
    const fileB = new File(['b'], 'notes.docx');

    await fixture.componentInstance.onCreateModalCreated({
      payload: { parentObjectiveId: 'o1', title: 'Design Phase', description: null, startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20 },
      assetFiles: [fileA, fileB]
    });

    expect(storeStub.uploadMilestoneAsset).toHaveBeenCalledWith('o1', fileA);
    expect(storeStub.uploadMilestoneAsset).toHaveBeenCalledWith('o1', fileB);
    expect(fixture.componentInstance.createModalOpen()).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`
Expected: FAIL — `onCreateModalCreated` still expects the old flat payload shape and never calls `uploadMilestoneAsset`.

- [ ] **Step 3: Update `onCreateModalCreated`**

In `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`, replace the method:

```typescript
  async onCreateModalCreated(event: { payload: CreateObjectiveRequestDto; assetFiles: readonly File[] }): Promise<void> {
    this.createModalSubmitting.set(true);
    const result = await this.store.createSubModule(event.payload);
    if (result.success && result.objectiveId) {
      for (const file of event.assetFiles) {
        await this.store.uploadMilestoneAsset(result.objectiveId, file);
      }
    }
    this.createModalSubmitting.set(false);
    if (result.success) {
      this.createModalOpen.set(false);
      await this.loadTree({ force: true });
    }
  }
```

(only the parameter type, and the new `if (result.success && result.objectiveId) { ... }` block, are new — the rest of the method is unchanged)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`
Expected: PASS (all tests, including the 2 updated/new ones)

- [ ] **Step 5: Run the full frontend test suite as a final check**

Run: `npx vitest run`
Expected: PASS, no regressions elsewhere (particularly anywhere else that might construct `ObjectiveDetail`/`ObjectiveDetailDto` object literals without an `assets` field — TypeScript will catch these at build time; run `npx tsc --noEmit` too if `vitest run` doesn't already type-check strictly).

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts
git commit -m "feat: upload staged asset files to the newly created sub-module"
```

---

## Manual verification (after both plans are implemented)

This plan's automated tests cover behavior in isolation with mocked APIs. Before considering the feature done, run the actual dev server against the real backend (once the backend plan is deployed) and verify in the browser:

1. Open "Create sub module" — confirm one Assets dropzone (not four cards), the date range picker (not two separate date fields), and a Members section with search/add/owner-toggle.
2. Create a sub-module with 2+ files attached and 1+ members — confirm the modal stays open (showing loading state) until uploads finish, then closes and the tree reloads.
3. Open "Module settings" (edit) on that sub-module — confirm the previously uploaded files appear, immediately upload a new file (no Save step needed), immediately remove one (no Save step needed), and confirm there is **no** Members section in this dialog.
4. Try uploading a disallowed file type (e.g. `.exe`) — confirm a clear error surfaces (via `errorMessage` in create mode, or the row's error status in edit mode).
