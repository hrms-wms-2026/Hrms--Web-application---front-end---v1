# Milestone Cards + Tree View — Part 1: Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `ProjectApiService`/`ProjectDetailStore` with the Objective endpoints (`GetObjective`, `EditObjective`, `AchieveObjective`, `UnachieveObjective`) and the new `isOwner` field, so Part 2's UI has a working data layer to call. Self-contained: no UI in this part.

**Architecture:** Mirrors the existing Project equivalents in the same two files exactly (`ProjectApiService.getById/edit/achieve/unachieve`, `ProjectDetailStore.loadProject`). `EditObjective`/`AchieveObjective`/`UnachieveObjective` each have an immediate-vs-pending split (`200`/`204` vs `202`), which Project's equivalents don't have — surfaced via `observe: 'response'` so the store can branch on `res.status`.

**Tech Stack:** Angular 21, RxJS, NgRx Signal Store, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-milestone-cards-and-tree-view-design.md`
**Depends on:** `HRMS-Backend-v1` plan `docs/superpowers/plans/next/2026-08-10-milestone-ownership-and-subtree-access.md` must be merged/deployed first — `isOwner` won't exist in the API response until then, and `GetObjectiveSubtree` will still `403` non-owners until that plan's Task 2 ships. This part's tests use mocked HTTP, so they don't require the real backend to be running — but don't deploy this part's frontend behavior against a backend that hasn't shipped the dependency yet.

## Global Constraints

- Reuse `ObjectiveDetailDto`/`ObjectiveDetailResponse`-equivalent shapes already in `src/app/modules/work/models/dto/milestone.dto.ts` — don't create a duplicate type for the same shape.
- `EditObjectivePayload`/`AchieveObjective`/`UnachieveObjective` never touch the `identifier` field — Objectives don't have one, unlike Projects.
- Every new store method follows the existing `patchState(store, { error: null })` → `try`/`catch` → `extractError(err, fallback)` pattern already in both stores — no new error-handling shape.

---

### Task 1: `isOwner` on `Milestone` model/DTO

**Files:**
- Modify: `src/app/modules/work/models/milestone.model.ts`
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`
- Modify: `src/app/modules/work/utils/project.mapper.ts`
- Test: `src/app/modules/work/utils/project.mapper.spec.ts`

**Interfaces:**
- Produces: `Milestone.isOwner: boolean`, `MyProjectMilestoneDto.isOwner: boolean` — consumed by Part 2's `MilestoneCardComponent`.

- [ ] **Step 1: Write the failing test**

Open `src/app/modules/work/utils/project.mapper.spec.ts`, find the existing test for `toMilestone` (search for `toMilestone`), and add a new test right after it:

```typescript
  it('maps isOwner through unchanged', () => {
    const dto: MyProjectMilestoneDto = {
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null,
      membershipIsActive: true, membershipRemovedAt: null, isOwner: true
    };

    const result = toMilestone(dto);

    expect(result.isOwner).toBe(true);
  });
```

If `MyProjectMilestoneDto` isn't already imported at the top of this spec file, add it: `import { MyProjectMilestoneDto } from '../models/dto/milestone.dto';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/utils/project.mapper.spec.ts --watch=false`
Expected: FAIL — TypeScript compile error, `isOwner` does not exist on the DTO literal.

- [ ] **Step 3: Add `isOwner` to the DTO and model**

In `src/app/modules/work/models/dto/milestone.dto.ts`, add `isOwner: boolean;` as the last property of `MyProjectMilestoneDto`:

```typescript
export interface MyProjectMilestoneDto {
  objectiveId: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  ownerId: string;
  ownerName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  completedHours: number;
  objectiveIsActive: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  membershipIsActive: boolean;
  membershipRemovedAt: string | null;
  isOwner: boolean;
}
```

In `src/app/modules/work/models/milestone.model.ts`, add `isOwner: boolean;` as the last property of `Milestone`:

```typescript
export interface Milestone {
  objectiveId: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  ownerId: string;
  ownerName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  completedHours: number;
  objectiveIsActive: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  membershipIsActive: boolean;
  membershipRemovedAt: string | null;
  isOwner: boolean;
}
```

- [ ] **Step 4: `toMilestone` already spreads the DTO — verify no change needed**

`toMilestone` in `project.mapper.ts` is currently `export function toMilestone(dto: MyProjectMilestoneDto): Milestone { return { ...dto }; }` — since it's a full spread and both interfaces now share the same shape, no code change is needed here. Confirm this by reading the function before moving on; if it has been changed to a field-by-field mapper since this plan was written, add `isOwner: dto.isOwner` explicitly instead.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/utils/project.mapper.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/models/milestone.model.ts src/app/modules/work/models/dto/milestone.dto.ts src/app/modules/work/utils/project.mapper.spec.ts
git commit -m "feat(work): add isOwner to Milestone model/DTO"
```

---

### Task 2: `ProjectApiService.getObjectiveById`

**Files:**
- Modify: `src/app/modules/work/data-access/project-api.service.ts`
- Test: `src/app/modules/work/data-access/project-api.service.spec.ts`

**Interfaces:**
- Produces: `ProjectApiService.getObjectiveById(id: string): Observable<ObjectiveDetailDto>` — consumed by Task 4's `ProjectDetailStore.getMilestoneDetail`.

- [ ] **Step 1: Write the failing test**

In `project-api.service.spec.ts`, add this test after the existing `'gets a milestone subtree'` test:

```typescript
  it('gets an objective by id', () => {
    const dto = { id: 'o1', title: 'Design Phase' } as ObjectiveDetailDto;
    service.getObjectiveById('o1').subscribe((res) => expect(res).toEqual(dto));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1`);
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });
```

Add `ObjectiveDetailDto` to the existing `import { MyProjectMilestoneDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';` line, making it `import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/data-access/project-api.service.spec.ts --watch=false`
Expected: FAIL — `service.getObjectiveById is not a function`.

- [ ] **Step 3: Add the method**

In `project-api.service.ts`, add this method right after `getMilestoneSubtree`:

```typescript
  getObjectiveById(id: string): Observable<ObjectiveDetailDto> {
    return this.http.get<ObjectiveDetailDto>(`${environment.apiUrl}/work/objectives/${id}`);
  }
```

Add `ObjectiveDetailDto` to the existing `import { MyProjectMilestoneDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';` line the same way as Step 1.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/data-access/project-api.service.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/data-access/project-api.service.ts src/app/modules/work/data-access/project-api.service.spec.ts
git commit -m "feat(work): add ProjectApiService.getObjectiveById"
```

---

### Task 3: `ProjectApiService.editObjective` / `achieveObjective` / `unachieveObjective`

**Files:**
- Modify: `src/app/modules/work/data-access/project-api.service.ts`
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`
- Test: `src/app/modules/work/data-access/project-api.service.spec.ts`

**Interfaces:**
- Produces: `EditObjectiveRequestDto { title: string; description: string; startDate: string; endDate: string; allocatedHours: number; }`, `ProjectApiService.editObjective(id: string, payload: EditObjectiveRequestDto): Observable<HttpResponse<ObjectiveDetailDto>>`, `ProjectApiService.achieveObjective(id: string): Observable<HttpResponse<void>>`, `ProjectApiService.unachieveObjective(id: string): Observable<HttpResponse<void>>` — all three return the full `HttpResponse` (not just the body) specifically so Task 4's store can branch on `res.status` (`200`/`204` = applied immediately, `202` = pending change request). Consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Add these three tests to `project-api.service.spec.ts`, after the `'gets an objective by id'` test from Task 2:

```typescript
  it('edits an objective and reports the applied-immediately status', () => {
    const dto = { id: 'o1', title: 'Design Phase v2' } as ObjectiveDetailDto;
    const payload: EditObjectiveRequestDto = {
      title: 'Design Phase v2', description: 'Updated scope', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    };
    service.editObjective('o1', payload).subscribe((res) => {
      expect(res.status).toBe(200);
      expect(res.body).toEqual(dto);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(dto, { status: 200, statusText: 'OK' });
  });

  it('edits an objective and reports the pending-approval status', () => {
    const payload: EditObjectiveRequestDto = {
      title: 'Design Phase v2', description: 'Updated scope', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    };
    service.editObjective('o1', payload).subscribe((res) => expect(res.status).toBe(202));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1`);
    req.flush({ id: 'cr1', status: 'pending' }, { status: 202, statusText: 'Accepted' });
  });

  it('achieves an objective', () => {
    service.achieveObjective('o1').subscribe((res) => expect(res.status).toBe(204));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1/achieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('unachieves an objective', () => {
    service.unachieveObjective('o1').subscribe((res) => expect(res.status).toBe(204));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1/unachieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
```

Add `EditObjectiveRequestDto` to the milestone DTO import line.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/data-access/project-api.service.spec.ts --watch=false`
Expected: FAIL — `EditObjectiveRequestDto` doesn't exist, `editObjective`/`achieveObjective`/`unachieveObjective` are not functions.

- [ ] **Step 3: Add `EditObjectiveRequestDto` to the milestone DTO file**

In `src/app/modules/work/models/dto/milestone.dto.ts`, add at the end of the file:

```typescript
export interface EditObjectiveRequestDto {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}
```

- [ ] **Step 4: Add the three methods**

In `project-api.service.ts`, add `HttpResponse` to the existing `import { HttpClient, HttpParams } from '@angular/common/http';` line (`import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';`), add `EditObjectiveRequestDto` to the milestone DTO import, and add these three methods after `getObjectiveById`:

```typescript
  editObjective(id: string, payload: EditObjectiveRequestDto): Observable<HttpResponse<ObjectiveDetailDto>> {
    return this.http.put<ObjectiveDetailDto>(`${environment.apiUrl}/work/objectives/${id}`, payload, { observe: 'response' });
  }

  achieveObjective(id: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${environment.apiUrl}/work/objectives/${id}/achieve`, {}, { observe: 'response' });
  }

  unachieveObjective(id: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${environment.apiUrl}/work/objectives/${id}/unachieve`, {}, { observe: 'response' });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/data-access/project-api.service.spec.ts --watch=false`
Expected: PASS, all tests including the four new ones.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/data-access/project-api.service.ts src/app/modules/work/models/dto/milestone.dto.ts src/app/modules/work/data-access/project-api.service.spec.ts
git commit -m "feat(work): add ProjectApiService.editObjective/achieveObjective/unachieveObjective"
```

---

### Task 4: `ProjectDetailStore` gains milestone edit/achieve methods

**Files:**
- Modify: `src/app/modules/work/state/project-detail.store.ts`
- Test: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectApiService.getObjectiveById`, `editObjective`, `achieveObjective`, `unachieveObjective` from Tasks 2-3.
- Produces: `ProjectDetailStore.getMilestoneDetail(id: string): Promise<ObjectiveDetail | null>`, `editMilestone(id: string, payload: EditObjectiveRequestDto): Promise<{ success: boolean; pending: boolean }>`, `achieveMilestone(id: string): Promise<{ success: boolean; pending: boolean }>`, `unachieveMilestone(id: string): Promise<{ success: boolean; pending: boolean }>`, and a new `milestoneActionError()` state selector — consumed by Part 2's `ProjectDetailComponent`. `ObjectiveDetail` is a new type alias: `export type ObjectiveDetail = ObjectiveDetailDto;` added to `src/app/modules/work/models/milestone.model.ts` (the DTO and the frontend-facing model are the same shape here — no separate mapper needed, matching how `ObjectiveSubtreeNodeDto` is already used directly as `MilestoneTreeNode`'s DTO source without an intermediate type for every field).

**Why a new `milestoneActionError` field, not the existing `projectError`/`milestonesError`:** both existing fields drive full-section `@else if` branches in `project-detail.component.html` (`projectError` replaces the whole project header; `milestonesError` replaces the whole card grid). If a milestone Edit/Achieve action reused either one, a failed modal submit would silently blank out an already-successfully-loaded page section behind the still-open modal. This is a real latent bug already present in `ProjectListStore`/`ProjectListComponent` today (`store.error()` is shared between the list-load failure and the Create/Edit/Delete/Achieve modals' failures) — noted here so it isn't copied forward into new code, but fixing the existing Project one is out of this plan's scope; flag it separately if wanted.

- [ ] **Step 1: Write the failing tests**

Open `project-detail.store.spec.ts` and find its `setup(...)` helper (used by the existing `loadProject`/`loadMyMilestones` tests) to see its exact shape, then add these four tests at the end of the file, just above the final closing `}` of the `describe` block — adapt the mock-building calls to match whatever `setup` already looks like in this file (it wraps `TestBed.configureTestingModule` with a mocked `ProjectApiService`, following the same pattern as `project-list.store.spec.ts`'s `setup` you can cross-reference):

```typescript
  it('getMilestoneDetail returns the mapped detail on success', async () => {
    const dto: ObjectiveDetailDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
      description: 'Scope the design work', ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
      startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
      allocatedHours: 20, completedHours: 0, isActive: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
    };
    const store = setup({ getObjectiveById: () => of(dto) } as Partial<ProjectApiService>);

    const result = await store.getMilestoneDetail('o1');

    expect(result).toEqual(dto);
  });

  it('getMilestoneDetail returns null and sets error on failure', async () => {
    const store = setup({
      getObjectiveById: () => throwError(() => ({ error: { detail: 'not found' } }))
    } as Partial<ProjectApiService>);

    const result = await store.getMilestoneDetail('o1');

    expect(result).toBeNull();
    expect(store.milestoneActionError()).toBe('not found');
  });

  it('editMilestone reports pending:false when applied immediately (200)', async () => {
    const dto = { id: 'o1' } as ObjectiveDetailDto;
    const store = setup({
      editObjective: () => of(new HttpResponse({ body: dto, status: 200 }))
    } as Partial<ProjectApiService>);

    const result = await store.editMilestone('o1', {
      title: 'Design Phase v2', description: 'Updated', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    });

    expect(result).toEqual({ success: true, pending: false });
  });

  it('editMilestone reports pending:true on 202', async () => {
    const store = setup({
      editObjective: () => of(new HttpResponse({ body: null, status: 202 }))
    } as Partial<ProjectApiService>);

    const result = await store.editMilestone('o1', {
      title: 'Design Phase v2', description: 'Updated', startDate: '2026-01-01', endDate: '2026-03-01', allocatedHours: 25
    });

    expect(result).toEqual({ success: true, pending: true });
  });

  it('achieveMilestone reports pending:false on 204', async () => {
    const store = setup({
      achieveObjective: () => of(new HttpResponse<void>({ status: 204 }))
    } as Partial<ProjectApiService>);

    const result = await store.achieveMilestone('o1');

    expect(result).toEqual({ success: true, pending: false });
  });

  it('unachieveMilestone reports success:false and sets error on failure', async () => {
    const store = setup({
      unachieveObjective: () => throwError(() => ({ error: { detail: 'not achieved' } }))
    } as Partial<ProjectApiService>);

    const result = await store.unachieveMilestone('o1');

    expect(result).toEqual({ success: false, pending: false });
    expect(store.milestoneActionError()).toBe('not achieved');
  });
```

Add `of`, `throwError` to the existing `rxjs` import if not already there, add `HttpResponse` to a new `import { HttpResponse } from '@angular/common/http';`, and add `ObjectiveDetailDto` to the milestone DTO import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/state/project-detail.store.spec.ts --watch=false`
Expected: FAIL — `store.getMilestoneDetail`/`editMilestone`/`achieveMilestone`/`unachieveMilestone` are not functions.

- [ ] **Step 3: Add `ObjectiveDetail` type alias**

In `src/app/modules/work/models/milestone.model.ts`, add at the end of the file:

```typescript
export type ObjectiveDetail = import('./dto/milestone.dto').ObjectiveDetailDto;
```

- [ ] **Step 4: Add the `milestoneActionError` state field**

`ProjectDetailState` (top of `project-detail.store.ts`) currently ends its interface with `readonly subtreeError: string | null;`. Add one more field after it:

```typescript
  readonly milestoneActionError: string | null;
```

`initialState` currently ends with `subtreeError: null`. Add the matching default:

```typescript
  milestoneActionError: null
```

- [ ] **Step 5: Add the four store methods**

In `project-detail.store.ts`, add `EditObjectiveRequestDto`, `ObjectiveDetailDto` to the milestone DTO import line, add `import { ObjectiveDetail } from '../models/milestone.model';` (or extend the existing models import), and add these four methods inside `withMethods`, after `clearSelectedSubtree`. Each writes to the new `milestoneActionError` field — never `projectError`/`milestonesError` — so a failed modal action can't blank out an already-loaded page section (see this task's Interfaces note above):

```typescript
    async getMilestoneDetail(id: string): Promise<ObjectiveDetail | null> {
      try {
        const detail = await firstValueFrom(api.getObjectiveById(id));
        patchState(store, { milestoneActionError: null });
        return detail;
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to load milestone.') });
        return null;
      }
    },

    async editMilestone(id: string, payload: EditObjectiveRequestDto): Promise<{ success: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(api.editObjective(id, payload));
        patchState(store, { milestoneActionError: null });
        return { success: true, pending: res.status === 202 };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to save changes.') });
        return { success: false, pending: false };
      }
    },

    async achieveMilestone(id: string): Promise<{ success: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(api.achieveObjective(id));
        patchState(store, { milestoneActionError: null });
        return { success: true, pending: res.status === 202 };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to achieve milestone.') });
        return { success: false, pending: false };
      }
    },

    async unachieveMilestone(id: string): Promise<{ success: boolean; pending: boolean }> {
      try {
        const res = await firstValueFrom(api.unachieveObjective(id));
        patchState(store, { milestoneActionError: null });
        return { success: true, pending: res.status === 202 };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to unachieve milestone.') });
        return { success: false, pending: false };
      }
    }
```

`extractError` already exists in this file (used by `loadProject`/`loadMyMilestones`/`loadMilestoneSubtree`) — reuse it, don't redefine it.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/state/project-detail.store.spec.ts --watch=false`
Expected: PASS, all tests including the six new ones.

- [ ] **Step 7: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts src/app/modules/work/models/milestone.model.ts
git commit -m "feat(work): add ProjectDetailStore milestone edit/achieve/unachieve methods"
```
