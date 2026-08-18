# Unified Tree-Table Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the milestone card grid + per-module Tree/Board/Backlog/My Task/List sub-menu on Project Detail with one unified, mockup-style tree table rooted at the project, plus a working "Create sub Module" flow.

**Architecture:** `ProjectDetailComponent` becomes the sole owner of tree state (no more nested router-outlet per milestone). It loads the full Objective tree in two existing-endpoint calls, renders `MilestoneTreeNodeComponent` (reworked into a table row) and `MilestoneDetailPanelComponent` (reworked with owner avatar + actions) side by side, and opens a new `CreateSubModuleModalComponent` for the create flow.

**Tech Stack:** Angular 21 standalone components, NgRx Signal Store, RxJS, Vitest + Angular TestBed, Tailwind + CSS custom properties.

## Global Constraints

- **Depends on the backend plan landing first (or at least the same session):** `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-12-objective-viewmodel-owner-fields-fix.md` — until it lands, `GET /work/objectives/{id}/tree` won't actually return `ownerName`/`isOwner`/`isAchieved` on non-root nodes even though this plan's DTOs expect them. Run that plan's Task 1 before this plan's Task 4 (store rework), or the store's mapped `MilestoneTreeNode.ownerName`/`isOwner` will silently be `null`/`false` for every node in manual testing (TypeScript won't catch this — it's a runtime data-shape issue, not a compile error).
- Visual restyle only, real data — no `Type`, release-milestone tag, `Status` workflow, or task-count columns (per the approved design's scope decision #1). Do not add UI for fields that don't exist on any DTO in this plan.
- Reuse `app-avatar` (`src/app/shared/ui/avatar/avatar.component.ts`) unchanged for owner display — do not build a new avatar component or add per-user coloring.
- Follow `docs/core/ARCHITECTURE.md` §7.4: every async view needs all four states (loading/error/empty/data).
- `feature → ui → state → data-access` dependency direction (`ARCHITECTURE.md` §2) — components never call `HttpClient` directly, always through `ProjectApiService` via `ProjectDetailStore`.

---

### Task 1: DTOs — add owner/achieved fields, flat tree item, create request

**Files:**
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`
- Test: none (pure type declarations; verified by Task 2's compiling test suite)

**Interfaces:**
- Produces: `ObjectiveDetailDto` (now includes `ownerName`, `reportingManagerName`, `isOwner`, `achievedAt`, and `isAchieved` as a required, not optional, field — matches the wire shape once the backend fix lands), `ObjectiveSubtreeNodeDto` (inherits all of the above via `extends ObjectiveDetailDto`), `ObjectiveTreeItemDto` (new, matches `ObjectiveTreeItemViewModel`), `CreateObjectiveRequestDto` (new, matches `CreateObjectiveRequest` minus `headUserId`, which this UI never collects — the backend defaults it to the creator when omitted).

- [ ] **Step 1: Replace the DTO file's contents**

Full new content for `src/app/modules/work/models/dto/milestone.dto.ts`:

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
}

export interface ObjectiveSubtreeNodeDto extends ObjectiveDetailDto {
  children: ObjectiveSubtreeNodeDto[];
}

export interface ObjectiveSubtreeResponseDto {
  parentObjective: ObjectiveDetailDto | null;
  objective: ObjectiveSubtreeNodeDto;
}

export interface ObjectiveTreeItemDto {
  id: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isAchieved: boolean;
}

export interface CreateObjectiveRequestDto {
  parentObjectiveId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}

export interface EditObjectiveRequestDto {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}
```

- [ ] **Step 2: Run the TypeScript build to find every call site that breaks**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: FAIL — `project-detail.store.spec.ts` and any object literal built from the old, shorter `ObjectiveDetailDto` (e.g. `{ id: 'o2', ..., isAchieved: false }` without `ownerName`/`reportingManagerName`/`isOwner`/`achievedAt`) now has missing-property errors. This is expected and fixed in Task 4 (store) — do not fix test fixtures yet, just confirm the compiler flags them so nothing is silently stale.

- [ ] **Step 3: Commit**

```bash
git add src/app/modules/work/models/dto/milestone.dto.ts
git commit -m "feat(work): extend Objective DTOs with owner names, isOwner, achieved state, flat tree item, create request"
```

---

### Task 2: `ProjectApiService` — add flat-tree and create-objective calls

**Files:**
- Modify: `src/app/modules/work/data-access/project-api.service.ts`
- Modify: `src/app/modules/work/data-access/project-api.service.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveTreeItemDto`, `CreateObjectiveRequestDto`, `ObjectiveDetailDto` (Task 1).
- Produces: `getObjectiveTreeFlat(projectId: string): Observable<ObjectiveTreeItemDto[]>`, `createObjective(payload: CreateObjectiveRequestDto): Observable<ObjectiveDetailDto>` — both consumed by `ProjectDetailStore` in Task 4.

- [ ] **Step 1: Write the failing tests**

Add to `src/app/modules/work/data-access/project-api.service.spec.ts` (append inside the existing `describe` block, following the file's existing `HttpTestingController` pattern — read the file first to match its exact setup helper name):

```typescript
it('getObjectiveTreeFlat GETs the flat project tree', () => {
  let result: ObjectiveTreeItemDto[] | undefined;
  service.getObjectiveTreeFlat('p1').subscribe((r) => (result = r));

  const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/objectives`);
  expect(req.request.method).toBe('GET');
  req.flush([{ id: 'o1', parentObjectiveId: null, isDefault: true, title: 'Root', ownerId: 'u1', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false }]);

  expect(result?.[0].isDefault).toBe(true);
});

it('createObjective POSTs to /work/objectives', () => {
  const payload: CreateObjectiveRequestDto = {
    parentObjectiveId: 'o1', title: 'Design Phase', description: null,
    startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
  };
  let result: ObjectiveDetailDto | undefined;
  service.createObjective(payload).subscribe((r) => (result = r));

  const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives`);
  expect(req.request.method).toBe('POST');
  expect(req.request.body).toEqual(payload);
  req.flush({ id: 'o2', title: 'Design Phase' } as ObjectiveDetailDto);

  expect(result?.id).toBe('o2');
});
```

Add `ObjectiveTreeItemDto`, `CreateObjectiveRequestDto` to the existing `milestone.dto` import at the top of the spec file.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- project-api.service.spec.ts`
Expected: FAIL — `service.getObjectiveTreeFlat is not a function` / `service.createObjective is not a function`.

- [ ] **Step 3: Add the two methods**

In `src/app/modules/work/data-access/project-api.service.ts`, update the import line to include the new DTOs:

```typescript
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto, EditObjectiveRequestDto, ObjectiveTreeItemDto, CreateObjectiveRequestDto } from '../models/dto/milestone.dto';
```

Add these two methods to the `ProjectApiService` class, after `getMilestoneSubtree`:

```typescript
  getObjectiveTreeFlat(projectId: string): Observable<ObjectiveTreeItemDto[]> {
    return this.http.get<ObjectiveTreeItemDto[]>(`${environment.apiUrl}/work/projects/${projectId}/objectives`);
  }

  createObjective(payload: CreateObjectiveRequestDto): Observable<ObjectiveDetailDto> {
    return this.http.post<ObjectiveDetailDto>(`${environment.apiUrl}/work/objectives`, payload);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- project-api.service.spec.ts`
Expected: PASS, all tests in the file green (including the two new ones).

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/data-access/project-api.service.ts src/app/modules/work/data-access/project-api.service.spec.ts
git commit -m "feat(work): add getObjectiveTreeFlat and createObjective to ProjectApiService"
```

---

### Task 3: `MilestoneTreeNode` model + mapper — carry owner/achieved data, add `findTreeNode`

**Files:**
- Modify: `src/app/modules/work/models/milestone.model.ts`
- Modify: `src/app/modules/work/utils/project.mapper.ts`
- Modify: `src/app/modules/work/utils/project.mapper.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveSubtreeNodeDto` (Task 1).
- Produces: `MilestoneTreeNode` now has `description`, `isAchieved`, `ownerName`, `isOwner`. New pure function `findTreeNode(root: MilestoneTreeNode, id: string): MilestoneTreeNode | null`, consumed by `ProjectDetailComponent` in Task 6 to resolve the detail panel's content from the already-fetched tree (no extra network call on row click).

- [ ] **Step 1: Write the failing tests**

Add to `src/app/modules/work/utils/project.mapper.spec.ts` (append to the existing `describe` block):

```typescript
describe('toMilestoneTreeNode', () => {
  it('maps description, isAchieved, ownerName, and isOwner', () => {
    const dto: ObjectiveSubtreeNodeDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: 'Root scope', ownerId: 'u1', ownerName: 'Arun Kumar',
      reportingManagerId: null, reportingManagerName: null, createdById: 'u1',
      startDate: '2026-01-01', endDate: '2026-12-01', progress: 72, actualHours: null,
      allocatedHours: 40, completedHours: 29, isActive: true, isOwner: true,
      isAchieved: false, achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null,
      children: []
    };

    const node = toMilestoneTreeNode(dto);

    expect(node).toEqual({
      id: 'o1', title: 'Root', description: 'Root scope', startDate: '2026-01-01', endDate: '2026-12-01',
      progress: 72, allocatedHours: 40, completedHours: 29, isActive: true, isAchieved: false,
      ownerName: 'Arun Kumar', isOwner: true, children: []
    });
  });
});

describe('findTreeNode', () => {
  const leaf: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
    ownerName: 'Diya', isOwner: false, children: []
  };
  const root: MilestoneTreeNode = {
    id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01',
    progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
    ownerName: 'Arun', isOwner: true, children: [leaf]
  };

  it('finds the root node by id', () => {
    expect(findTreeNode(root, 'o1')).toBe(root);
  });

  it('finds a nested child node by id', () => {
    expect(findTreeNode(root, 'o2')).toBe(leaf);
  });

  it('returns null when the id is not in the tree', () => {
    expect(findTreeNode(root, 'missing')).toBeNull();
  });
});
```

Add `ObjectiveSubtreeNodeDto` and `findTreeNode`/`MilestoneTreeNode` to the spec file's existing imports as needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- project.mapper.spec.ts`
Expected: FAIL — `toMilestoneTreeNode` result is missing `description`/`isAchieved`/`ownerName`/`isOwner`; `findTreeNode is not defined`.

- [ ] **Step 3: Update the model**

In `src/app/modules/work/models/milestone.model.ts`, replace the `MilestoneTreeNode` interface:

```typescript
export interface MilestoneTreeNode {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  progress: number;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isAchieved: boolean;
  ownerName: string | null;
  isOwner: boolean;
  children: MilestoneTreeNode[];
}
```

(Leave `Milestone` and `ObjectiveDetail` in this file unchanged.)

- [ ] **Step 4: Update the mapper**

In `src/app/modules/work/utils/project.mapper.ts`, replace `toMilestoneTreeNode` and add `findTreeNode`:

```typescript
export function toMilestoneTreeNode(dto: ObjectiveSubtreeNodeDto): MilestoneTreeNode {
  return {
    id: dto.id, title: dto.title, description: dto.description, startDate: dto.startDate, endDate: dto.endDate,
    progress: dto.progress, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isActive: dto.isActive, isAchieved: dto.isAchieved, ownerName: dto.ownerName, isOwner: dto.isOwner,
    children: dto.children.map(toMilestoneTreeNode)
  };
}

export function findTreeNode(root: MilestoneTreeNode, id: string): MilestoneTreeNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findTreeNode(child, id);
    if (found) return found;
  }
  return null;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- project.mapper.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/models/milestone.model.ts src/app/modules/work/utils/project.mapper.ts src/app/modules/work/utils/project.mapper.spec.ts
git commit -m "feat(work): carry owner/achieved data on MilestoneTreeNode, add findTreeNode helper"
```

---

### Task 4: `ProjectDetailStore` — unified tree loading, create-sub-module, remove per-node detail fetch

**Files:**
- Modify: `src/app/modules/work/state/project-detail.store.ts`
- Modify: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectApiService.getObjectiveTreeFlat`, `.getMilestoneSubtree`, `.createObjective` (Task 2); `toMilestoneTreeNode` (Task 3).
- Produces: `loadProjectTree(projectId: string): Promise<void>` (replaces the old `loadMilestoneSubtree(objectiveId)` entry point — the store now finds the root itself instead of receiving an id), `createSubModule(payload: CreateObjectiveRequestDto): Promise<{ success: boolean }>`. Removes `nodeDetail`/`nodeDetailLoading`/`nodeDetailError`/`loadNodeDetail`/`clearNodeDetail` (detail is now derived client-side via `findTreeNode` on `selectedSubtree`, not fetched separately). `selectedSubtree`/`subtreeLoading`/`subtreeError`/`clearSelectedSubtree` keep their existing names and shapes. `milestones`/`milestonesLoading`/`milestonesError`/`loadMyMilestones`, `getMilestoneDetail`, `editMilestone`, `achieveMilestone`, `unachieveMilestone`, `milestoneActionError` are all unchanged — still used by the settings-modal flow (Task 6).

- [ ] **Step 1: Write the failing tests**

In `src/app/modules/work/state/project-detail.store.spec.ts`:
1. Remove the three `loadNodeDetail`/`clearNodeDetail` tests (lines with `it('loadNodeDetail ...')`, `it('clearNodeDetail ...')`, and `it('loadNodeDetail does not affect ...')`) — these test methods that no longer exist.
2. Update the `'loads and clears a milestone subtree'` test's DTO literal and every other `ObjectiveDetailDto`/`ObjectiveSubtreeNodeDto`-shaped object literal in the file to include the new required fields from Task 1 (`ownerName`, `reportingManagerName`, `isOwner`, `achievedAt`) — e.g. the `objective` object in that test gains `ownerName: 'Arun', reportingManagerName: null, isOwner: true, achievedAt: null` alongside its existing fields; the `getMilestoneDetail`/`editMilestone`-related literals gain the same.
3. Add:

```typescript
it('loadProjectTree finds the default objective from the flat list, then loads its subtree', async () => {
  const flat: ObjectiveTreeItemDto[] = [
    { id: 'o1', parentObjectiveId: null, isDefault: true, title: 'Root', ownerId: 'u1', startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false }
  ];
  const subtreeResponse: ObjectiveSubtreeResponseDto = {
    parentObjective: null,
    objective: {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: null, ownerId: 'u1', ownerName: 'Arun', reportingManagerId: null, reportingManagerName: null,
      createdById: 'u1', startDate: '2026-01-01', endDate: '2026-12-01', progress: 0, actualHours: null,
      allocatedHours: 40, completedHours: 0, isActive: true, isOwner: true, isAchieved: false, achievedAt: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: null, children: []
    }
  };
  const store = setup({
    getObjectiveTreeFlat: () => of(flat),
    getMilestoneSubtree: (id: string) => { expect(id).toBe('o1'); return of(subtreeResponse); }
  } as Partial<ProjectApiService>);

  await store.loadProjectTree('p1');

  expect(store.selectedSubtree()?.title).toBe('Root');
  expect(store.subtreeLoading()).toBe(false);
});

it('loadProjectTree sets subtreeError when the project has no default objective', async () => {
  const store = setup({ getObjectiveTreeFlat: () => of([]) } as Partial<ProjectApiService>);

  await store.loadProjectTree('p1');

  expect(store.subtreeError()).toBe('This project has no root module.');
  expect(store.subtreeLoading()).toBe(false);
});

it('loadProjectTree sets subtreeError on a network failure', async () => {
  const store = setup({
    getObjectiveTreeFlat: () => throwError(() => ({ error: { detail: 'Server error' } }))
  } as Partial<ProjectApiService>);

  await store.loadProjectTree('p1');

  expect(store.subtreeError()).toBe('Server error');
});

it('createSubModule returns success:true and clears milestoneActionError on success', async () => {
  const store = setup({
    createObjective: () => of({ id: 'o3' } as ObjectiveDetailDto)
  } as Partial<ProjectApiService>);

  const result = await store.createSubModule({
    parentObjectiveId: 'o1', title: 'Design Phase', description: null,
    startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
  });

  expect(result).toEqual({ success: true });
  expect(store.milestoneActionError()).toBeNull();
});

it('createSubModule returns success:false and sets milestoneActionError on failure', async () => {
  const store = setup({
    createObjective: () => throwError(() => ({ error: { detail: 'date range exceeds parent' } }))
  } as Partial<ProjectApiService>);

  const result = await store.createSubModule({
    parentObjectiveId: 'o1', title: 'Design Phase', description: null,
    startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
  });

  expect(result).toEqual({ success: false });
  expect(store.milestoneActionError()).toBe('date range exceeds parent');
});
```

Add `ObjectiveTreeItemDto`, `CreateObjectiveRequestDto` to the spec file's `milestone.dto` import.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- project-detail.store.spec.ts`
Expected: FAIL — `store.loadProjectTree`/`store.createSubModule` don't exist; removed-method tests should already be deleted so they don't fail instead.

- [ ] **Step 3: Rewrite the store**

Full new content for `src/app/modules/work/state/project-detail.store.ts`:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { toMilestone, toMilestoneTreeNode, toProjectDetail } from '../utils/project.mapper';
import { ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../models/dto/milestone.dto';

interface ProjectDetailState {
  readonly project: ProjectDetail | null;
  readonly projectLoading: boolean;
  readonly projectError: string | null;
  readonly milestones: readonly Milestone[];
  readonly milestonesLoading: boolean;
  readonly milestonesError: string | null;
  readonly selectedSubtree: MilestoneTreeNode | null;
  readonly subtreeLoading: boolean;
  readonly subtreeError: string | null;
  readonly milestoneActionError: string | null;
}

const initialState: ProjectDetailState = {
  project: null, projectLoading: false, projectError: null,
  milestones: [], milestonesLoading: false, milestonesError: null,
  selectedSubtree: null, subtreeLoading: false, subtreeError: null,
  milestoneActionError: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const ProjectDetailStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectDetailState>(initialState),
  withMethods((store, api = inject(ProjectApiService)) => ({
    async loadProject(id: string): Promise<void> {
      patchState(store, { projectLoading: true, projectError: null });
      try {
        const dto = await firstValueFrom(api.getById(id));
        patchState(store, { project: toProjectDetail(dto), projectLoading: false });
      } catch (err) {
        patchState(store, { projectError: extractError(err, 'Failed to load project.'), projectLoading: false, project: null });
      }
    },

    async loadMyMilestones(projectId: string): Promise<void> {
      patchState(store, { milestonesLoading: true, milestonesError: null });
      try {
        const dtos = await firstValueFrom(api.getMyMilestones(projectId));
        patchState(store, { milestones: dtos.map(toMilestone), milestonesLoading: false });
      } catch (err) {
        patchState(store, { milestonesError: extractError(err, 'Failed to load modules.'), milestonesLoading: false });
      }
    },

    async loadProjectTree(projectId: string): Promise<void> {
      patchState(store, { subtreeLoading: true, subtreeError: null });
      try {
        const flat = await firstValueFrom(api.getObjectiveTreeFlat(projectId));
        const root = flat.find((o) => o.isDefault);
        if (!root) {
          patchState(store, { subtreeError: 'This project has no root module.', subtreeLoading: false });
          return;
        }
        const response = await firstValueFrom(api.getMilestoneSubtree(root.id));
        patchState(store, { selectedSubtree: toMilestoneTreeNode(response.objective), subtreeLoading: false });
      } catch (err) {
        patchState(store, { subtreeError: extractError(err, 'Failed to load project tree.'), subtreeLoading: false });
      }
    },

    clearSelectedSubtree(): void {
      patchState(store, { selectedSubtree: null, subtreeError: null });
    },

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
    },

    async createSubModule(payload: CreateObjectiveRequestDto): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(api.createObjective(payload));
        patchState(store, { milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to create sub-module.') });
        return { success: false };
      }
    }
  }))
);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- project-detail.store.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat(work): rework ProjectDetailStore for unified project-rooted tree loading and sub-module creation"
```

---

### Task 5: `MilestoneTreeNodeComponent` — table-row layout with progress, owner avatar, due date, add affordance

**Files:**
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneTreeNode` (Task 3), `AvatarComponent` (`src/app/shared/ui/avatar/avatar.component.ts`, unchanged).
- Produces: new `output()` `createRequested: MilestoneTreeNode` (emits the node under which to create a sub-module — only reachable via a button rendered when `node().isOwner` is true). Existing `selected` output and `node`/`selectedId`/`expandedByDefault` inputs keep their names and types.

- [ ] **Step 1: Update the existing tests for the new fixture shape and add new ones**

In `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`, update the `leaf`/`root` fixtures to the new `MilestoneTreeNode` shape (add `description`, `isAchieved`, `ownerName`, `isOwner`):

```typescript
const leaf: MilestoneTreeNode = {
  id: 'o2', title: 'Child', description: null, startDate: '2026-01-20', endDate: '2026-02-01',
  progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
  ownerName: 'Diya Perera', isOwner: false, children: []
};

const root: MilestoneTreeNode = {
  id: 'o1', title: 'Root', description: null, startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
  allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false,
  ownerName: 'Arun Kumar', isOwner: true, children: [leaf]
};
```

The existing `'renders the node title and progress, without dates or hours'` test's assertion `expect(fixture.nativeElement.textContent).not.toContain('2026-01-20')` must change — the new row DOES show the due date, so update it to:

```typescript
it('renders the node title, progress, owner initials, and due date', () => {
  setup(leaf);
  expect(fixture.nativeElement.textContent).toContain('Child');
  expect(fixture.nativeElement.textContent).toContain('40%');
  expect(fixture.nativeElement.textContent).toContain('2026-02-01');
  expect(fixture.nativeElement.querySelector('app-avatar')).not.toBeNull();
});
```

Add:

```typescript
it('shows a create-sub-module button only when the node is owned by the caller', () => {
  setup(root);
  expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
});

it('does not show a create-sub-module button when the node is not owned by the caller', () => {
  setup(leaf);
  expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).toBeNull();
});

it('create-sub-module button click emits createRequested with the node, without emitting selected', () => {
  setup(root);
  const created: MilestoneTreeNode[] = [];
  let selectedCount = 0;
  fixture.componentInstance.createRequested.subscribe((n) => created.push(n));
  fixture.componentInstance.selected.subscribe(() => selectedCount++);

  (fixture.nativeElement.querySelector('[data-testid="create-sub-button"]') as HTMLElement).click();

  expect(created).toEqual([root]);
  expect(selectedCount).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- milestone-tree-node.component.spec.ts`
Expected: FAIL — no `app-avatar`, no `[data-testid="create-sub-button"]`, no `createRequested` output yet; the due-date assertion fails against the current template.

- [ ] **Step 3: Rewrite the component**

Full new content for `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`:

```typescript
import { Component, OnInit, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, AvatarComponent],
  template: `
    <div>
      <div
        class="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-3 rounded-md px-2 py-1.5 cursor-pointer hover:bg-[var(--color-surface-secondary)]"
        [class.ring-2]="node().id === selectedId()"
        [class.ring-[var(--color-focus-ring)]]="node().id === selectedId()"
        data-testid="tree-row"
        (click)="selected.emit(node())"
      >
        <span class="flex items-center gap-1.5 min-w-0">
          @if (node().children.length > 0) {
            <button
              type="button"
              class="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-text-secondary)] transition-transform"
              [style.transform]="expanded() ? 'rotate(90deg)' : 'rotate(0deg)'"
              data-testid="chevron"
              [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
              (click)="toggleExpanded($event)"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          } @else {
            <span class="h-4 w-4 shrink-0"></span>
          }
          <span class="truncate text-sm text-[var(--color-text-primary)]">{{ node().title }}</span>
          @if (node().isAchieved) {
            <span class="shrink-0 rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">Achieved</span>
          }
        </span>

        <span class="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]" data-testid="progress-cell">
          <span class="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]">
            <span class="block h-full rounded-full bg-[var(--color-accent)]" [style.width.%]="node().progress"></span>
          </span>
          {{ node().progress }}%
        </span>

        <span data-testid="owner-cell">
          <app-avatar [userName]="node().ownerName" size="sm" />
        </span>

        <span class="text-xs text-[var(--color-text-secondary)]" data-testid="due-date-cell">{{ node().endDate }}</span>

        @if (node().isOwner) {
          <button
            type="button"
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)] hover:text-[var(--color-text-primary)]"
            data-testid="create-sub-button"
            aria-label="Create sub Module"
            (click)="onCreateClick($event)"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        }
      </div>

      @if (node().children.length > 0 && expanded()) {
        <div class="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-border)] pl-3">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node
              [node]="child"
              [selectedId]="selectedId()"
              [expandedByDefault]="false"
              (selected)="selected.emit($event)"
              (createRequested)="createRequested.emit($event)"
            />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent implements OnInit {
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  expandedByDefault = input(true);
  selected = output<MilestoneTreeNode>();
  createRequested = output<MilestoneTreeNode>();

  expanded = signal(true);

  ngOnInit(): void {
    this.expanded.set(this.expandedByDefault());
  }

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.set(!this.expanded());
  }

  onCreateClick(event: Event): void {
    event.stopPropagation();
    this.createRequested.emit(this.node());
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- milestone-tree-node.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts
git commit -m "feat(work): rework MilestoneTreeNodeComponent into a table row with progress, owner avatar, due date, and create-sub affordance"
```

---

### Task 6: `MilestoneDetailPanelComponent` — owner avatar, Edit + Create sub Module actions, no View Details button

**Files:**
- Modify: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`
- Modify: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneTreeNode` (Task 3, replaces `ObjectiveDetail` as the panel's input type — the panel now renders the already-fetched tree node, not a separately-fetched detail object), `AvatarComponent`.
- Produces: `detail` input retyped to `MilestoneTreeNode | null`. New outputs `editRequested: void`, `createSubRequested: void`, both only emittable when the rendered row has an `[data-testid]` gate on `detail.isOwner` (matching Task 5's pattern). No "View details" button exists anywhere in this component — confirmed by a spec assertion.

- [ ] **Step 1: Write the failing tests**

Full new content for `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneDetailPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailPanelComponent>;

  const detail: MilestoneTreeNode = {
    id: 'o2', title: 'Child', description: 'Child scope', startDate: '2026-01-20', endDate: '2026-02-01',
    progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: true,
    ownerName: 'Arun Kumar', isOwner: true, children: []
  };

  function setup(overrides: Partial<{ detail: MilestoneTreeNode | null; loading: boolean; error: string | null }> = {}): void {
    fixture = TestBed.createComponent(MilestoneDetailPanelComponent);
    fixture.componentRef.setInput('detail', overrides.detail ?? null);
    fixture.componentRef.setInput('loading', overrides.loading ?? false);
    fixture.componentRef.setInput('error', overrides.error ?? null);
    fixture.detectChanges();
  }

  it('shows the loading state', () => {
    setup({ loading: true });
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state and emits retry on click', () => {
    setup({ error: 'Failed to load' });
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));

    (fixture.nativeElement.querySelector('app-error-state button') as HTMLButtonElement).click();

    expect(retried).toBe(true);
  });

  it('shows a select-a-milestone prompt when nothing is selected', () => {
    setup();
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('renders full detail: title, description, dates, progress, hours, owner avatar, Achieved badge', () => {
    setup({ detail });
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Child');
    expect(text).toContain('Child scope');
    expect(text).toContain('2026-01-20');
    expect(text).toContain('2026-02-01');
    expect(text).toContain('40%');
    expect(text).toContain('2 / 5');
    expect(text).toContain('Achieved');
    expect(fixture.nativeElement.querySelector('app-avatar')).not.toBeNull();
  });

  it('omits the Achieved badge when the milestone is not achieved', () => {
    setup({ detail: { ...detail, isAchieved: false } });
    expect(fixture.nativeElement.textContent).not.toContain('Achieved');
  });

  it('never renders a View details button', () => {
    setup({ detail });
    expect(fixture.nativeElement.textContent).not.toContain('View details');
  });

  it('shows Edit and Create sub Module actions when isOwner is true', () => {
    setup({ detail });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).not.toBeNull();
  });

  it('hides Edit and Create sub Module actions when isOwner is false', () => {
    setup({ detail: { ...detail, isOwner: false } });
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="create-sub-button"]')).toBeNull();
  });

  it('emits editRequested and createSubRequested on their respective clicks', () => {
    setup({ detail });
    let edited = false;
    let createdSub = false;
    fixture.componentInstance.editRequested.subscribe(() => (edited = true));
    fixture.componentInstance.createSubRequested.subscribe(() => (createdSub = true));

    (fixture.nativeElement.querySelector('[data-testid="edit-button"]') as HTMLElement).click();
    (fixture.nativeElement.querySelector('[data-testid="create-sub-button"]') as HTMLElement).click();

    expect(edited).toBe(true);
    expect(createdSub).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- milestone-detail-panel.component.spec.ts`
Expected: FAIL — component still takes `ObjectiveDetail`, has no avatar/actions/outputs.

- [ ] **Step 3: Rewrite the component**

Full new content for `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  host: { class: 'block h-full flex flex-col' },
  imports: [CardComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, ButtonComponent, AvatarComponent],
  template: `
    @if (loading()) {
      <app-loader label="Loading milestone…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="retry.emit()" />
    } @else if (detail(); as d) {
      <app-card [title]="d.title">
        <div class="flex flex-col gap-3 text-sm">
          <div class="flex items-center gap-2">
            <app-avatar [userName]="d.ownerName" size="md" />
            <span class="text-[var(--color-text-secondary)]">{{ d.ownerName ?? 'Unassigned' }}</span>
          </div>
          @if (d.description) {
            <p class="text-[var(--color-text-secondary)]">{{ d.description }}</p>
          }
          <dl class="grid grid-cols-2 gap-3">
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
              <dd>{{ d.startDate }}</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">End</dt>
              <dd>{{ d.endDate }}</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Progress</dt>
              <dd>{{ d.progress }}%</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
              <dd>{{ d.completedHours }} / {{ d.allocatedHours }}</dd>
            </div>
          </dl>
          @if (d.isAchieved) {
            <span class="w-fit rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
          @if (d.isOwner) {
            <div class="mt-2 flex gap-2">
              <span data-testid="edit-button">
                <app-button variant="secondary" (pressed)="editRequested.emit()">Edit</app-button>
              </span>
              <span data-testid="create-sub-button">
                <app-button variant="primary" (pressed)="createSubRequested.emit()">+ Create sub Module</app-button>
              </span>
            </div>
          }
        </div>
      </app-card>
    } @else {
      <app-empty-state title="Select a milestone" description="Click any node in the tree to see its detail here." />
    }
  `
})
export class MilestoneDetailPanelComponent {
  detail = input<MilestoneTreeNode | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  retry = output<void>();
  editRequested = output<void>();
  createSubRequested = output<void>();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- milestone-detail-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts
git commit -m "feat(work): rework MilestoneDetailPanelComponent with owner avatar and Edit/Create sub Module actions, no View details button"
```

---

### Task 7: `CreateSubModuleModalComponent` (new)

**Files:**
- Create: `src/app/modules/work/ui/create-sub-module-modal/create-sub-module-modal.component.ts`
- Create: `src/app/modules/work/ui/create-sub-module-modal/create-sub-module-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ModalComponent`, `InputComponent`, `ButtonComponent` (all existing, unchanged — same API as used by `MilestoneSettingsModalComponent`).
- Produces: inputs `open: boolean`, `submitting: boolean`, `errorMessage: string`; output `created: CreateObjectiveRequestDto` (parentObjectiveId is NOT collected from the form — it's set by the parent component from whichever node the user clicked "+" on, then merged in before emitting — see Step 3), `closed: void`. Consumed by `ProjectDetailComponent` in Task 8.

- [ ] **Step 1: Write the failing tests**

Create `src/app/modules/work/ui/create-sub-module-modal/create-sub-module-modal.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CreateSubModuleModalComponent } from './create-sub-module-modal.component';

describe('CreateSubModuleModalComponent', () => {
  let fixture: ComponentFixture<CreateSubModuleModalComponent>;

  function setup(overrides: Partial<{ open: boolean; parentObjectiveId: string; submitting: boolean; errorMessage: string }> = {}): void {
    fixture = TestBed.createComponent(CreateSubModuleModalComponent);
    fixture.componentRef.setInput('open', overrides.open ?? true);
    fixture.componentRef.setInput('parentObjectiveId', overrides.parentObjectiveId ?? 'o1');
    fixture.componentRef.setInput('submitting', overrides.submitting ?? false);
    fixture.componentRef.setInput('errorMessage', overrides.errorMessage ?? '');
    fixture.detectChanges();
  }

  function setFieldValue(testId: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`[data-testid="${testId}"] input`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('requires title, start date, and end date before submitting', () => {
    setup();
    let emitted = false;
    fixture.componentInstance.created.subscribe(() => (emitted = true));

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Title is required.');
  });

  it('rejects an end date before the start date', () => {
    setup();
    setFieldValue('title-field', 'Design Phase');
    setFieldValue('start-date-field', '2026-03-01');
    setFieldValue('end-date-field', '2026-01-01');

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(fixture.nativeElement.textContent).toContain('End date cannot be before the start date.');
  });

  it('emits created with the entered fields and the parentObjectiveId input on valid submit', () => {
    setup({ parentObjectiveId: 'o1' });
    let payload: any;
    fixture.componentInstance.created.subscribe((p) => (payload = p));

    setFieldValue('title-field', 'Design Phase');
    setFieldValue('start-date-field', '2026-01-15');
    setFieldValue('end-date-field', '2026-03-01');
    setFieldValue('allocated-hours-field', '20');

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(payload).toEqual({
      parentObjectiveId: 'o1', title: 'Design Phase', description: '',
      startDate: '2026-01-15', endDate: '2026-03-01', allocatedHours: 20
    });
  });

  it('emits closed when cancel is clicked', () => {
    setup();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));

    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();

    expect(closed).toBe(true);
  });

  it('renders the server error message when present', () => {
    setup({ errorMessage: 'date range exceeds parent' });
    expect(fixture.nativeElement.textContent).toContain('date range exceeds parent');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- create-sub-module-modal.component.spec.ts`
Expected: FAIL — the component/file doesn't exist yet.

- [ ] **Step 3: Create the component**

`src/app/modules/work/ui/create-sub-module-modal/create-sub-module-modal.component.ts`:

```typescript
import { Component, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CreateObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-create-sub-module-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Create sub Module" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="title-field">
          <app-input label="Title" [value]="title()" [error]="errors()['title'] ?? ''" (valueChange)="title.set($event)" />
        </span>
        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>
        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>
        <span data-testid="end-date-field">
          <app-input label="End date" type="date" [value]="endDate()" [error]="errors()['endDate'] ?? ''" (valueChange)="endDate.set($event)" />
        </span>
        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHoursDisplay()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="onAllocatedHoursChange($event)" />
        </span>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">Create</app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class CreateSubModuleModalComponent {
  open = input(false);
  parentObjectiveId = input.required<string>();
  submitting = input(false);
  errorMessage = input<string>('');

  created = output<CreateObjectiveRequestDto>();
  closed = output<void>();

  title = signal('');
  description = signal('');
  startDate = signal('');
  endDate = signal('');
  allocatedHours = signal(0);
  errors = signal<Record<string, string>>({});

  allocatedHoursDisplay(): string {
    return String(this.allocatedHours());
  }

  onAllocatedHoursChange(value: string): void {
    this.allocatedHours.set(value === '' ? 0 : Number(value));
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

    this.created.emit({
      parentObjectiveId: this.parentObjectiveId(),
      title: this.title(), description: this.description() || null,
      startDate: this.startDate(), endDate: this.endDate(), allocatedHours: this.allocatedHours()
    });
  }
}
```

Note the test expects `description: ''` (empty string) in the emitted payload but the component emits `this.description() || null`. Fix the test's expectation to `description: null` — the DTO type is `string | null` and an untouched description field should serialize as `null`, not `''`, matching `CreateObjectiveRequestDto`'s declared type from Task 1.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- create-sub-module-modal.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/create-sub-module-modal/
git commit -m "feat(work): add CreateSubModuleModalComponent"
```

---

### Task 8: `ProjectDetailComponent` — unified tree page, wire create flow, drop card grid/sub-menu routes

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`
- Modify: `src/app/modules/work/work.routes.ts`
- Modify: `src/app/modules/work/work.routes.spec.ts`
- Delete: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`, `.html`, `.spec.ts` (superseded — its entire responsibility moves into `ProjectDetailComponent`)

**Interfaces:**
- Consumes: `ProjectDetailStore.loadProjectTree`, `.createSubModule`, `.selectedSubtree`, `.subtreeLoading`, `.subtreeError` (Task 4); `findTreeNode` (Task 3); `MilestoneTreeNodeComponent`, `MilestoneDetailPanelComponent` (Tasks 5–6); `CreateSubModuleModalComponent` (Task 7); `MilestoneSettingsModalComponent` (unchanged).
- Produces: no child route under `':id'` anymore — `ProjectDetailComponent` is a leaf route.

- [ ] **Step 1: Delete the superseded milestone-tree-tab feature**

```bash
git rm src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts
```

- [ ] **Step 2: Update `work.routes.ts`**

Full new content for `src/app/modules/work/work.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const WORK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/project-list/project-list.component').then((m) => m.ProjectListComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./feature/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent)
  }
];
```

- [ ] **Step 3: Update `work.routes.spec.ts`**

Read the existing file first and remove any assertions referencing the deleted `milestones/:milestoneId/(tree|board|backlog|my-task|list)` child routes and the `''` redirect under them (they no longer exist). Keep/adapt the assertions that `''` resolves to `ProjectListComponent` and `':id'` resolves to `ProjectDetailComponent` with no `children` array.

- [ ] **Step 4: Write the failing component test**

Full new content for `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let store: ProjectDetailStore;

  const tree: MilestoneTreeNode = {
    id: 'o1', title: 'Root', description: null, startDate: '2026-01-01', endDate: '2026-12-01',
    progress: 72, allocatedHours: 40, completedHours: 29, isActive: true, isAchieved: false,
    ownerName: 'Arun Kumar', isOwner: true,
    children: [
      { id: 'o2', title: 'Child', description: null, startDate: '2026-01-10', endDate: '2026-02-01',
        progress: 40, allocatedHours: 5, completedHours: 2, isActive: true, isAchieved: false,
        ownerName: 'Diya', isOwner: false, children: [] }
    ]
  };

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [{ provide: ActivatedRoute, useValue: { paramMap: of(new Map([['id', 'p1']])) } }]
    }).compileComponents();

    store = TestBed.inject(ProjectDetailStore);
    spyOn(store, 'loadProject').and.resolveTo();
    spyOn(store, 'loadProjectTree').and.callFake(async () => {
      Object.defineProperty(store, 'selectedSubtree', { value: () => tree, configurable: true });
    });

    fixture = TestBed.createComponent(ProjectDetailComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads the project and the unified tree on init', async () => {
    await setup();
    expect(store.loadProject).toHaveBeenCalledWith('p1');
    expect(store.loadProjectTree).toHaveBeenCalledWith('p1');
  });

  it('renders the root tree node', async () => {
    await setup();
    expect(fixture.nativeElement.textContent).toContain('Root');
  });

  it('selecting a node shows its detail via findTreeNode, with no extra API call', async () => {
    await setup();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-milestone-detail-panel')).not.toBeNull();
  });

  it('clicking create-sub-module on a node opens the create modal with that node as parent', async () => {
    await setup();
    const createButtons = fixture.nativeElement.querySelectorAll('[data-testid="create-sub-button"]');
    (createButtons[0] as HTMLElement).click();
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('app-create-sub-module-modal');
    expect(modal).not.toBeNull();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test -- project-detail.component.spec.ts`
Expected: FAIL — the component still has the old card-grid/sub-menu template and no `createSubModule`/`findTreeNode`-based selection wiring.

- [ ] **Step 6: Rewrite the component**

Full new content for `src/app/modules/work/feature/project-detail/project-detail.component.ts`:

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { MilestoneDetailPanelComponent } from '../../ui/milestone-detail-panel/milestone-detail-panel.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { CreateSubModuleModalComponent } from '../../ui/create-sub-module-modal/create-sub-module-modal.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto, CreateObjectiveRequestDto } from '../../models/dto/milestone.dto';
import { findTreeNode } from '../../utils/project.mapper';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneTreeNodeComponent, MilestoneDetailPanelComponent, MilestoneSettingsModalComponent,
    CreateSubModuleModalComponent, CardComponent, PageHeaderComponent, LoaderComponent, ErrorStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private projectId = '';

  selectedNodeId = signal<string | null>(null);
  selectedNode = computed<MilestoneTreeNode | null>(() => {
    const tree = this.store.selectedSubtree();
    const id = this.selectedNodeId();
    if (!tree || !id) return null;
    return findTreeNode(tree, id);
  });

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);

  createModalOpen = signal(false);
  createModalParentId = signal('');
  createModalSubmitting = signal(false);

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    await this.store.loadProjectTree(this.projectId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryTree(): void {
    this.store.loadProjectTree(this.projectId);
  }

  onNodeSelected(node: MilestoneTreeNode): void {
    this.selectedNodeId.set(node.id);
  }

  onCreateSubRequested(node: MilestoneTreeNode): void {
    this.createModalParentId.set(node.id);
    this.createModalOpen.set(true);
  }

  onCreateModalCreated(payload: CreateObjectiveRequestDto): void {
    this.createModalSubmitting.set(true);
    this.store.createSubModule(payload).then((result) => {
      this.createModalSubmitting.set(false);
      if (result.success) {
        this.createModalOpen.set(false);
        this.store.loadProjectTree(this.projectId);
      }
    });
  }

  async onEditRequested(): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    this.milestoneSettingsOpen.set(true);
    const detail = await this.store.getMilestoneDetail(node.id);
    if (detail && this.selectedNode()?.id === node.id) {
      this.milestoneSettingsInitialValue.set(detail);
    }
  }

  async onMilestoneSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const node = this.selectedNode();
    if (!node) return;
    this.milestoneSettingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(node.id);
      if (!unachieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(node.id, event.fields);
    if (!editResult.success) {
      this.milestoneSettingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(node.id);
      if (!achieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    this.milestoneSettingsSubmitting.set(false);
    this.milestoneSettingsOpen.set(false);
    await this.store.loadProjectTree(this.projectId);
  }
}
```

- [ ] **Step 7: Rewrite the template**

Full new content for `src/app/modules/work/feature/project-detail/project-detail.component.html`:

```html
@if (store.projectLoading()) {
  <app-loader label="Loading project…" />
} @else if (store.projectError()) {
  <app-error-state [message]="store.projectError()!" [retryable]="true" (retry)="retryProject()" />
} @else if (store.project(); as project) {
  <div class="flex flex-wrap items-center justify-between gap-4 pb-2 mb-2.5 border-b border-[var(--color-border)]">
    <div>
      <h1 class="text-base font-semibold text-[var(--color-text-primary)]">{{ project.name }}</h1>
      <p class="text-xs text-[var(--color-text-secondary)]">{{ project.identifier }} · {{ project.description ?? '' }}</p>
    </div>
    <dl class="flex gap-6 text-sm">
      <div>
        <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
        <dd>{{ project.startDate }}</dd>
      </div>
      <div>
        <dt class="text-xs text-[var(--color-text-secondary)]">Target</dt>
        <dd>{{ project.targetDate }}</dd>
      </div>
      <div>
        <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
        <dd>{{ project.completedHours }} / {{ project.allocatedHours }}</dd>
      </div>
    </dl>
  </div>
}

<div class="flex flex-col md:flex-row gap-4 h-full min-h-[220px]">
  <div class="w-full md:w-[62%] shrink-0 flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
    @if (store.subtreeLoading()) {
      <app-loader label="Loading tree…" />
    } @else if (store.subtreeError()) {
      <app-error-state [message]="store.subtreeError()!" [retryable]="true" (retry)="retryTree()" />
    } @else if (store.selectedSubtree(); as tree) {
      <div class="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 border-b border-[var(--color-border)] px-2 pb-2 text-xs font-medium text-[var(--color-text-secondary)]">
        <span>Work item</span>
        <span>Progress</span>
        <span>Owner</span>
        <span>Due date</span>
        <span></span>
      </div>
      <app-milestone-tree-node
        [node]="tree"
        [selectedId]="selectedNodeId()"
        [expandedByDefault]="true"
        (selected)="onNodeSelected($event)"
        (createRequested)="onCreateSubRequested($event)"
      />
    }
  </div>
  <div class="w-full flex-1 flex flex-col">
    <app-milestone-detail-panel
      class="h-full block"
      [detail]="selectedNode()"
      [loading]="false"
      [error]="null"
      (editRequested)="onEditRequested()"
      (createSubRequested)="selectedNode() && onCreateSubRequested(selectedNode()!)"
    />
  </div>
</div>

<app-milestone-settings-modal
  [open]="milestoneSettingsOpen()"
  [initialValue]="milestoneSettingsInitialValue()"
  [submitting]="milestoneSettingsSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (saved)="onMilestoneSettingsSaved($event)"
  (closed)="milestoneSettingsOpen.set(false)"
/>

<app-create-sub-module-modal
  [open]="createModalOpen()"
  [parentObjectiveId]="createModalParentId()"
  [submitting]="createModalSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (created)="onCreateModalCreated($event)"
  (closed)="createModalOpen.set(false)"
/>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- project-detail.component.spec.ts`
Expected: PASS.

- [ ] **Step 9: Run the full frontend test suite**

Run: `npm test`
Expected: PASS across the whole suite. Fix any remaining fixture-shape mismatches surfaced by Task 1's DTO change that weren't already caught in Tasks 3–7 (e.g. any other spec file constructing an `ObjectiveDetailDto`/`ObjectiveSubtreeNodeDto` literal — search with `grep -rl "ObjectiveDetailDto\|ObjectiveSubtreeNodeDto" src/app/modules/work --include=*.spec.ts` and add the new required fields to each).

- [ ] **Step 10: Manual verification in the browser**

Start the dev server, navigate to a project with at least one nested milestone, and confirm: the tree renders as a table with progress/owner/due-date columns; clicking a row updates the detail panel instantly (check the Network tab — no request fires on row click); the "+" button (row and panel) only appears on nodes/details where the caller is Head; creating a sub-module succeeds and the tree refreshes; Edit still opens the existing settings modal and Achieve/Unachieve still work.

- [ ] **Step 11: Commit**

```bash
git add -A -- src/app/modules/work docs/superpowers/specs docs/superpowers/plans
git commit -m "feat(work): unify Project Detail into one mockup-style tree table with create-sub-module flow"
```
