# Project Detail Milestone Tree View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/work/projects/:id` (`ProjectDetailComponent`) into 4 separate cards — compact header, tab-bar, an explorer-style milestone tree (2/3 width), and a detail panel (1/3 width) — with click-to-re-center tree navigation, replacing the horizontal milestone-card row.

**Architecture:** The store's existing `loadMilestoneSubtree(objectiveId)` already returns everything one screen of the tree needs (`parentObjective` for context + the clicked node's full nested subtree); this plan extends that one response to also drive the detail panel (no second network call per click) and rebuilds the presentation layer around it: a reworked recursive `MilestoneTreeNodeComponent` (explorer connector-line styling, local expand/collapse, click-to-select), a new `MilestoneTreeComponent` wrapper (adds the parent-context row), a new `MilestoneDetailPanelComponent`, and a new generic `TabsComponent` in `shared/ui/`.

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals`, RxJS (`firstValueFrom` at the data-access boundary only), Vitest (`vi.fn()`), Tailwind + `--color-*` CSS custom properties for theming — matches the rest of `src/app/modules/work/`.

## Global Constraints

- **Dependency order:** requires `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-10-project-detail-milestone-tree-view-backend.md` to have shipped first — `ObjectiveDetailDto`/`ObjectiveSubtreeNodeDto` below assume the backend's `ownerName`/`reportingManagerName`/`isOwner` (+ `isAchieved`/`achievedAt` on subtree nodes) fields already exist in the real API response.
- `feature/` = smart container, `ui/` = dumb/presentational (`input()`/`output()` only, no store injection, no API calls) — per `docs/core/ARCHITECTURE.md` §2 "Layer Purpose — Quick Reference". Every new `ui/` component in this plan follows that.
- No `BehaviorSubject`; `NgRx Signal Store` for the shared store, `signal()` for component-local UI state — per `ARCHITECTURE.md` §4.
- Every async list/detail view renders all four states (loading / error / empty / data) — never a blank area — per `ARCHITECTURE.md` §7.4.
- `MilestoneSettingsModalComponent`'s internal Edit/Achieve/Unachieve logic is **explicitly preserved as-is** (user instruction, design doc "Out of scope") — only its trigger's wiring (which component owns the id it fetches detail for) changes.
- Code and docs change together, same commit — `docs/core/ARCHITECTURE.md` gets updated in Task 8 as part of this plan, not deferred.

---

### Task 1: DTOs, mapper, and store — carry owner/manager names and per-node detail through the subtree response

**Files:**
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`
- Modify: `src/app/modules/work/utils/project.mapper.ts`
- Modify: `src/app/modules/work/utils/project.mapper.spec.ts`
- Modify: `src/app/modules/work/state/project-detail.store.ts`
- Modify: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: the backend plan's new `ownerName`/`reportingManagerName`/`isOwner` fields on both `GetObjectiveById` and `GetObjectiveSubtree`, and `isAchieved`/`achievedAt` now also on subtree nodes.
- Produces: `toObjectiveDetail(dto: ObjectiveSubtreeNodeDto): ObjectiveDetail` (new mapper function). `ProjectDetailStore` gains two new readonly signals: `selectedSubtreeParent: () => { id: string; title: string } | null` and `selectedMilestoneDetail: () => ObjectiveDetail | null`, both populated by the existing `loadMilestoneSubtree(objectiveId)` method (no new store method, no new API call).

- [ ] **Step 1: Write the failing mapper test**

In `src/app/modules/work/utils/project.mapper.spec.ts`, add the import and a new test. Also update the two existing `ObjectiveSubtreeNodeDto` object literals (root at line ~59 and the `children[0]` entry) to include the three new required fields, since the DTO interface is about to require them. Replace the whole file with:

```typescript
import { toProject, toProjectDetail, toMilestone, toMilestoneTreeNode, toObjectiveDetail } from './project.mapper';
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto } from '../models/dto/milestone.dto';
import { ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';

describe('project.mapper', () => {
  it('maps a ProjectListItemDto to a Project', () => {
    const dto: ProjectListItemDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null
    };
    expect(toProject(dto)).toEqual({
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null
    });
  });

  it('maps a ProjectDetailDto to a ProjectDetail', () => {
    const dto: ProjectDetailDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: 'Rebuild',
      leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB',
      actualHours: 12, allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false,
      achievedAt: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true
    };
    const result = toProjectDetail(dto);
    expect(result.description).toBe('Rebuild');
    expect(result.isAchieved).toBe(false);
    expect(result.createdAt).toBe('2026-08-01T00:00:00Z');
  });

  it('maps a MyProjectMilestoneDto to a Milestone', () => {
    const dto: MyProjectMilestoneDto = {
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null,
      membershipIsActive: true, membershipRemovedAt: null, isOwner: false
    };
    expect(toMilestone(dto).ownerName).toBe('Jane Doe');
  });

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

  it('maps an ObjectiveSubtreeNodeDto to a MilestoneTreeNode, recursively', () => {
    const dto: ObjectiveSubtreeNodeDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isAchieved: false, achievedAt: null,
      isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null,
      children: [
        {
          id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
          description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u1', reportingManagerName: 'Jane Doe',
          createdById: 'u1', startDate: '2026-08-01', endDate: '2026-09-01', progress: 0, actualHours: null,
          allocatedHours: 10, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
          isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
        }
      ]
    };
    const result = toMilestoneTreeNode(dto);
    expect(result.title).toBe('Root');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].title).toBe('Child');
    expect(result.children[0].children).toEqual([]);
  });

  it('maps an ObjectiveSubtreeNodeDto to an ObjectiveDetail, dropping children', () => {
    const dto: ObjectiveSubtreeNodeDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: 'Scope', ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u2', reportingManagerName: 'John Smith',
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isAchieved: true, achievedAt: '2026-08-05T00:00:00Z',
      isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
    };

    const result = toObjectiveDetail(dto);

    expect(result).toEqual({
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: 'Scope', ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u2', reportingManagerName: 'John Smith',
      createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, isAchieved: true, achievedAt: '2026-08-05T00:00:00Z',
      isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
    });
    expect('children' in result).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- project.mapper.spec.ts`
Expected: FAIL — `toObjectiveDetail` is not exported, and the `ObjectiveSubtreeNodeDto` literals don't yet have the new required fields (TypeScript compile error).

- [ ] **Step 3: Add the new fields to the DTOs**

Replace `src/app/modules/work/models/dto/milestone.dto.ts` with:

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
  isAchieved: boolean;
  achievedAt: string | null;
  isOwner: boolean;
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

export interface EditObjectiveRequestDto {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}
```

(`achievedAt`/`isAchieved` are no longer marked optional or commented as "subtree never returns this" — the backend plan makes both endpoints return them.)

- [ ] **Step 4: Add `toObjectiveDetail` to the mapper**

In `src/app/modules/work/utils/project.mapper.ts`, add the import of `ObjectiveDetail` and the new function. Replace the file with:

```typescript
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { Project, ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../models/milestone.model';

export function toProject(dto: ProjectListItemDto): Project {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, isAchieved: dto.isAchieved, achievedAt: dto.achievedAt
  };
}

export function toProjectDetail(dto: ProjectDetailDto): ProjectDetail {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, isAchieved: dto.isAchieved, achievedAt: dto.achievedAt,
    description: dto.description, actualHours: dto.actualHours, createdAt: dto.createdAt,
    updatedAt: dto.updatedAt
  };
}

export function toMilestone(dto: MyProjectMilestoneDto): Milestone {
  return { ...dto };
}

export function toMilestoneTreeNode(dto: ObjectiveSubtreeNodeDto): MilestoneTreeNode {
  return {
    id: dto.id, title: dto.title, startDate: dto.startDate, endDate: dto.endDate,
    progress: dto.progress, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isActive: dto.isActive, children: dto.children.map(toMilestoneTreeNode)
  };
}

export function toObjectiveDetail(dto: ObjectiveSubtreeNodeDto): ObjectiveDetail {
  const { children, ...detail } = dto;
  return detail;
}
```

- [ ] **Step 5: Run the mapper test to verify it passes**

Run: `npm test -- project.mapper.spec.ts`
Expected: all tests PASS.

- [ ] **Step 6: Write the failing store test**

In `src/app/modules/work/state/project-detail.store.spec.ts`, update the `ObjectiveDetailDto`/`ObjectiveSubtreeResponseDto` fixtures to the new required shape and add assertions for the two new signals. Replace the whole file with:

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ProjectDetailStore } from './project-detail.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveDetailDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';

describe('ProjectDetailStore', () => {
  function setup(apiOverrides: Partial<ProjectApiService> = {}) {
    TestBed.configureTestingModule({ providers: [{ provide: ProjectApiService, useValue: apiOverrides }] });
    return TestBed.inject(ProjectDetailStore);
  }

  const projectDto: ProjectDetailDto = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', description: null,
    leadId: 'u1', startDate: '2026-08-01', targetDate: '2026-12-01', color: null, actualHours: null,
    allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isLead: true
  };

  it('loads a project successfully', async () => {
    const store = setup({ getById: () => of(projectDto) } as Partial<ProjectApiService>);
    await store.loadProject('p1');
    expect(store.project()?.name).toBe('Website Revamp');
    expect(store.projectLoading()).toBe(false);
  });

  it('sets projectError on failure', async () => {
    const store = setup({ getById: () => throwError(() => ({ error: { detail: 'Not found' } })) } as Partial<ProjectApiService>);
    await store.loadProject('p1');
    expect(store.projectError()).toBe('Not found');
    expect(store.project()).toBeNull();
  });

  it('loads milestones independently of the project', async () => {
    const milestones: MyProjectMilestoneDto[] = [{
      objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
      ownerId: 'u1', ownerName: 'Jane', reportingManagerId: null, reportingManagerName: null,
      startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
      objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
      isOwner: false
    }];
    const store = setup({ getMyMilestones: () => of(milestones) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestones()).toHaveLength(1);
    expect(store.milestonesLoading()).toBe(false);
  });

  it('loads a milestone subtree and populates the tree, parent context, and detail signals together', async () => {
    const response: ObjectiveSubtreeResponseDto = {
      parentObjective: {
        id: 'root', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root Milestone',
        description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
        createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
        isOwner: false, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
      },
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: 'root', isDefault: false, title: 'Design Phase',
        description: 'Scope the design work', ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: 'u2', reportingManagerName: 'John Smith',
        createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
        isOwner: true, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
      }
    };
    const store = setup({ getMilestoneSubtree: () => of(response) } as Partial<ProjectApiService>);
    await store.loadMilestoneSubtree('o1');

    expect(store.selectedSubtree()?.title).toBe('Design Phase');
    expect(store.selectedSubtreeParent()).toEqual({ id: 'root', title: 'Root Milestone' });
    expect(store.selectedMilestoneDetail()?.ownerName).toBe('Jane Doe');
    expect(store.selectedMilestoneDetail()?.reportingManagerName).toBe('John Smith');
    expect(store.selectedMilestoneDetail()?.isOwner).toBe(true);

    store.clearSelectedSubtree();
    expect(store.selectedSubtree()).toBeNull();
    expect(store.selectedSubtreeParent()).toBeNull();
    expect(store.selectedMilestoneDetail()).toBeNull();
  });

  it('sets selectedSubtreeParent to null for the default (root) objective', async () => {
    const response: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        id: 'root', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root Milestone',
        description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
        createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
        isOwner: false, createdAt: '2026-08-01T00:00:00Z', updatedAt: null, children: []
      }
    };
    const store = setup({ getMilestoneSubtree: () => of(response) } as Partial<ProjectApiService>);
    await store.loadMilestoneSubtree('root');

    expect(store.selectedSubtreeParent()).toBeNull();
  });

  it('getMilestoneDetail returns the mapped detail on success', async () => {
    const dto: ObjectiveDetailDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
      description: 'Scope the design work', ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
      createdById: 'u1', startDate: '2026-01-01', endDate: '2026-03-01', progress: 0, actualHours: null,
      allocatedHours: 20, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
      isOwner: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: null
    };
    const store = setup({ getObjectiveById: () => of(dto) } as Partial<ProjectApiService>);

    const result = await store.getMilestoneDetail('o1');

    expect(result).toEqual(dto);
    expect(result?.isAchieved).toBe(false);
  });

  it('getMilestoneDetail returns null and sets milestoneActionError on failure', async () => {
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
      editObjective: () => of(new HttpResponse<ObjectiveDetailDto>({ body: null, status: 202 }))
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

  it('unachieveMilestone reports success:false and sets milestoneActionError on failure', async () => {
    const store = setup({
      unachieveObjective: () => throwError(() => ({ error: { detail: 'not achieved' } }))
    } as Partial<ProjectApiService>);

    const result = await store.unachieveMilestone('o1');

    expect(result).toEqual({ success: false, pending: false });
    expect(store.milestoneActionError()).toBe('not achieved');
  });
});
```

- [ ] **Step 7: Run the store test to verify it fails**

Run: `npm test -- project-detail.store.spec.ts`
Expected: FAIL — `selectedSubtreeParent`/`selectedMilestoneDetail` don't exist on the store yet.

- [ ] **Step 8: Add the two new state fields and populate them in `loadMilestoneSubtree`**

Replace `src/app/modules/work/state/project-detail.store.ts` with:

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { toMilestone, toMilestoneTreeNode, toObjectiveDetail, toProjectDetail } from '../utils/project.mapper';
import { ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../models/milestone.model';
import { EditObjectiveRequestDto } from '../models/dto/milestone.dto';

interface ProjectDetailState {
  readonly project: ProjectDetail | null;
  readonly projectLoading: boolean;
  readonly projectError: string | null;
  readonly milestones: readonly Milestone[];
  readonly milestonesLoading: boolean;
  readonly milestonesError: string | null;
  readonly selectedSubtree: MilestoneTreeNode | null;
  readonly selectedSubtreeParent: { id: string; title: string } | null;
  readonly selectedMilestoneDetail: ObjectiveDetail | null;
  readonly subtreeLoading: boolean;
  readonly subtreeError: string | null;
  readonly milestoneActionError: string | null;
}

const initialState: ProjectDetailState = {
  project: null, projectLoading: false, projectError: null,
  milestones: [], milestonesLoading: false, milestonesError: null,
  selectedSubtree: null, selectedSubtreeParent: null, selectedMilestoneDetail: null,
  subtreeLoading: false, subtreeError: null,
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
        patchState(store, { milestonesError: extractError(err, 'Failed to load milestones.'), milestonesLoading: false });
      }
    },

    async loadMilestoneSubtree(objectiveId: string): Promise<void> {
      patchState(store, { subtreeLoading: true, subtreeError: null });
      try {
        const response = await firstValueFrom(api.getMilestoneSubtree(objectiveId));
        patchState(store, {
          selectedSubtree: toMilestoneTreeNode(response.objective),
          selectedSubtreeParent: response.parentObjective
            ? { id: response.parentObjective.id, title: response.parentObjective.title }
            : null,
          selectedMilestoneDetail: toObjectiveDetail(response.objective),
          subtreeLoading: false
        });
      } catch (err) {
        patchState(store, { subtreeError: extractError(err, 'Failed to load milestone.'), subtreeLoading: false });
      }
    },

    clearSelectedSubtree(): void {
      patchState(store, { selectedSubtree: null, selectedSubtreeParent: null, selectedMilestoneDetail: null, subtreeError: null });
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
    }
  }))
);
```

- [ ] **Step 9: Run the store test to verify it passes**

Run: `npm test -- project-detail.store.spec.ts`
Expected: all tests PASS.

- [ ] **Step 10: Commit**

```bash
git add src/app/modules/work/models/dto/milestone.dto.ts src/app/modules/work/utils/project.mapper.ts src/app/modules/work/utils/project.mapper.spec.ts src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat: carry owner/manager names and per-node detail through the milestone subtree response"
```

---

### Task 2: `TabsComponent` — generic reusable tab-bar

**Files:**
- Create: `src/app/shared/ui/tabs/tabs.component.ts`
- Test: `src/app/shared/ui/tabs/tabs.component.spec.ts`

**Interfaces:**
- Produces: `TabItem { id: string; label: string; disabled?: boolean }` and `TabsComponent` with `tabs = input.required<TabItem[]>()`, `activeId = input<string | null>(null)`, `tabChange = output<string>()`.

- [ ] **Step 1: Write the failing test**

Create `src/app/shared/ui/tabs/tabs.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabsComponent, TabItem } from './tabs.component';

describe('TabsComponent', () => {
  let fixture: ComponentFixture<TabsComponent>;

  const tabs: TabItem[] = [
    { id: 'tree', label: 'Tree' },
    { id: 'list', label: 'List', disabled: true }
  ];

  function setup(activeId: string | null = 'tree'): void {
    TestBed.configureTestingModule({ imports: [TabsComponent] });
    fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', tabs);
    fixture.componentRef.setInput('activeId', activeId);
    fixture.detectChanges();
  }

  it('renders a button per tab', () => {
    setup();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Tree');
    expect(buttons[1].textContent).toContain('List');
  });

  it('emits tabChange with the clicked tab id', () => {
    setup();
    let emitted: string | null = null;
    fixture.componentInstance.tabChange.subscribe((id: string) => (emitted = id));
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    (buttons[0] as HTMLButtonElement).click();
    expect(emitted).toBe('tree');
  });

  it('does not emit tabChange when a disabled tab is clicked', () => {
    setup();
    let emitted = false;
    fixture.componentInstance.tabChange.subscribe(() => (emitted = true));
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    (buttons[1] as HTMLButtonElement).click();
    expect(emitted).toBe(false);
  });

  it('marks the active tab as selected', () => {
    setup('tree');
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    expect(buttons[0].getAttribute('aria-selected')).toBe('true');
    expect(buttons[1].getAttribute('aria-selected')).toBe('false');
  });

  it('disables the button element for a disabled tab', () => {
    setup();
    const buttons = fixture.nativeElement.querySelectorAll('[data-testid="tab"]');
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- shared/ui/tabs/tabs.component.spec.ts`
Expected: FAIL — `tabs.component.ts` doesn't exist yet.

- [ ] **Step 3: Create `TabsComponent`**

Create `src/app/shared/ui/tabs/tabs.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';

export interface TabItem {
  id: string;
  label: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div class="flex gap-1" role="tablist">
      @for (tab of tabs(); track tab.id) {
        <button
          type="button"
          role="tab"
          data-testid="tab"
          class="border-b-2 px-3 py-2 text-sm transition-colors"
          [attr.aria-selected]="tab.id === activeId()"
          [disabled]="tab.disabled ?? false"
          [class.border-[var(--color-accent)]]="tab.id === activeId()"
          [class.text-[var(--color-accent)]]="tab.id === activeId()"
          [class.font-semibold]="tab.id === activeId()"
          [class.border-transparent]="tab.id !== activeId()"
          [class.text-[var(--color-text-secondary)]]="tab.id !== activeId()"
          [class.opacity-40]="tab.disabled"
          [class.cursor-not-allowed]="tab.disabled"
          (click)="onTabClick(tab)"
        >{{ tab.label }}</button>
      }
    </div>
  `
})
export class TabsComponent {
  tabs = input.required<TabItem[]>();
  activeId = input<string | null>(null);
  tabChange = output<string>();

  onTabClick(tab: TabItem): void {
    if (tab.disabled) return;
    this.tabChange.emit(tab.id);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- shared/ui/tabs/tabs.component.spec.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/tabs/tabs.component.ts src/app/shared/ui/tabs/tabs.component.spec.ts
git commit -m "feat: add generic reusable TabsComponent"
```

---

### Task 3: Rework `MilestoneTreeNodeComponent` — explorer connector styling, expand/collapse, click-to-select

**Files:**
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`
- Modify: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneTreeNode` (unchanged shape — `id`, `title`, `progress`, `isActive`, `children`; `startDate`/`endDate`/hours are no longer rendered in the row itself, they live in the detail panel now).
- Produces: `selected = output<string>()` (bubbles a clicked node's id all the way up through the recursion — every recursive instance re-emits its children's `selected` events unchanged). New inputs: `selectedId = input<string | null>(null)` (highlight), `depth = input(0)` (indentation, incremented on each recursive call).

- [ ] **Step 1: Write the failing test**

Replace `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts` with:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeNodeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeNodeComponent>;

  const leaf: MilestoneTreeNode = {
    id: 'o1', title: 'Design Phase', startDate: '2026-01-15', endDate: '2026-03-01',
    progress: 40, allocatedHours: 20, completedHours: 8, isActive: true, children: []
  };

  const withChild: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
    allocatedHours: 20, completedHours: 0, isActive: true,
    children: [{
      id: 'o2', title: 'Child', startDate: '2026-01-20', endDate: '2026-02-01', progress: 0,
      allocatedHours: 5, completedHours: 0, isActive: true, children: []
    }]
  };

  function setup(node: MilestoneTreeNode, selectedId: string | null = null): void {
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.detectChanges();
  }

  it('renders a node with no children, showing only its name and progress', () => {
    setup(leaf);
    expect(fixture.nativeElement.textContent).toContain('Design Phase');
    expect(fixture.nativeElement.textContent).toContain('40%');
    expect(fixture.nativeElement.textContent).not.toContain('2026-01-15');
  });

  it('renders nested children recursively', () => {
    setup(withChild);
    expect(fixture.nativeElement.textContent).toContain('Root');
    expect(fixture.nativeElement.textContent).toContain('Child');
  });

  it('does not render an expand toggle for a leaf node', () => {
    setup(leaf);
    expect(fixture.nativeElement.querySelector('[data-testid="expand-toggle"]')).toBeNull();
  });

  it('renders an expand toggle for a node with children', () => {
    setup(withChild);
    expect(fixture.nativeElement.querySelector('[data-testid="expand-toggle"]')).not.toBeNull();
  });

  it('emits selected with the row\'s own id when the row is clicked', () => {
    setup(leaf);
    let emitted: string | null = null;
    fixture.componentInstance.selected.subscribe((id: string) => (emitted = id));
    (fixture.nativeElement.querySelector('[data-testid="tree-row"]') as HTMLElement).click();
    expect(emitted).toBe('o1');
  });

  it('bubbles a child row\'s selected event up unchanged', () => {
    setup(withChild);
    let emitted: string | null = null;
    fixture.componentInstance.selected.subscribe((id: string) => (emitted = id));
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="tree-row"]');
    (rows[1] as HTMLElement).click();
    expect(emitted).toBe('o2');
  });

  it('collapses children when the expand toggle is clicked, without emitting selected', () => {
    setup(withChild);
    let emitted = false;
    fixture.componentInstance.selected.subscribe(() => (emitted = true));
    (fixture.nativeElement.querySelector('[data-testid="expand-toggle"]') as HTMLElement).click();
    expect(emitted).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Child');
  });

  it('applies a highlight to the row matching selectedId', () => {
    setup(leaf, 'o1');
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="tree-row"]');
    expect(row.className).toContain('bg-[var(--color-surface-secondary)]');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- milestone-tree-node.component.spec.ts`
Expected: FAIL — current component renders start/end dates and hours in the row, has no `[data-testid="tree-row"]`/`[data-testid="expand-toggle"]`, no `selected` output, no `selectedId` input.

- [ ] **Step 3: Rewrite `MilestoneTreeNodeComponent`**

Replace `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts` with:

```typescript
import { Component, input, output, signal } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    <div class="relative" [style.paddingLeft.px]="depth() > 0 ? 22 : 0">
      @if (depth() > 0) {
        <span class="pointer-events-none absolute left-[7px] top-0 h-[15px] w-[10px] border-b border-l border-[var(--color-border)]"></span>
      }
      <div
        data-testid="tree-row"
        class="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-surface-secondary)]"
        [class.bg-[var(--color-surface-secondary)]]="selectedId() === node().id"
        [class.font-semibold]="selectedId() === node().id"
        [class.text-[var(--color-accent)]]="selectedId() === node().id"
        (click)="selected.emit(node().id)"
      >
        @if (node().children.length > 0) {
          <button
            type="button"
            data-testid="expand-toggle"
            class="flex h-4 w-4 shrink-0 items-center justify-center text-[10px] text-[var(--color-text-secondary)]"
            [attr.aria-label]="expanded() ? 'Collapse' : 'Expand'"
            (click)="toggleExpanded($event)"
          >{{ expanded() ? '▾' : '▸' }}</button>
        } @else {
          <span class="w-4 shrink-0"></span>
        }
        <span class="flex-1 truncate text-[var(--color-text-primary)]">{{ node().title }}</span>
        <span class="shrink-0 text-xs text-[var(--color-text-secondary)]">{{ node().progress }}%</span>
      </div>
      @if (expanded() && node().children.length > 0) {
        <div>
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node [node]="child" [selectedId]="selectedId()" [depth]="depth() + 1" (selected)="selected.emit($event)" />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent {
  node = input.required<MilestoneTreeNode>();
  selectedId = input<string | null>(null);
  depth = input(0);
  selected = output<string>();

  expanded = signal(true);

  toggleExpanded(event: Event): void {
    event.stopPropagation();
    this.expanded.update(v => !v);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- milestone-tree-node.component.spec.ts`
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts
git commit -m "refactor: rework MilestoneTreeNodeComponent into an explorer-style, click-to-select tree row"
```

---

### Task 4: `MilestoneTreeComponent` — parent-context row + the recursive tree

**Files:**
- Create: `src/app/modules/work/ui/milestone-tree/milestone-tree.component.ts`
- Test: `src/app/modules/work/ui/milestone-tree/milestone-tree.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneTreeNodeComponent` from Task 3.
- Produces: `MilestoneTreeComponent` with `root = input.required<MilestoneTreeNode>()`, `parent = input<{ id: string; title: string } | null>(null)`, `nodeSelected = output<string>()`. The root row is always rendered as the currently-focused/highlighted node (its own id is passed as `MilestoneTreeNodeComponent`'s `selectedId`) — because every click re-centers the whole subtree response, the response's own root is always the focused node, so no separate "which id is selected" input is needed on this wrapper.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-tree/milestone-tree.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeComponent } from './milestone-tree.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeComponent>;

  const root: MilestoneTreeNode = {
    id: 'o1', title: 'Root', startDate: '2026-01-01', endDate: '2026-03-01',
    progress: 0, allocatedHours: 20, completedHours: 0, isActive: true, children: []
  };

  function setup(parent: { id: string; title: string } | null = null): void {
    fixture = TestBed.createComponent(MilestoneTreeComponent);
    fixture.componentRef.setInput('root', root);
    fixture.componentRef.setInput('parent', parent);
    fixture.detectChanges();
  }

  it('does not render a parent row when parent is null', () => {
    setup(null);
    expect(fixture.nativeElement.querySelector('[data-testid="tree-parent-row"]')).toBeNull();
  });

  it('renders a parent context row when parent is set', () => {
    setup({ id: 'p1', title: 'Parent Milestone' });
    const row = fixture.nativeElement.querySelector('[data-testid="tree-parent-row"]');
    expect(row.textContent).toContain('Parent Milestone');
  });

  it('emits nodeSelected with the parent id when the parent row is clicked', () => {
    setup({ id: 'p1', title: 'Parent Milestone' });
    let emitted: string | null = null;
    fixture.componentInstance.nodeSelected.subscribe((id: string) => (emitted = id));
    (fixture.nativeElement.querySelector('[data-testid="tree-parent-row"]') as HTMLElement).click();
    expect(emitted).toBe('p1');
  });

  it('emits nodeSelected with the root id when the root row is clicked', () => {
    setup(null);
    let emitted: string | null = null;
    fixture.componentInstance.nodeSelected.subscribe((id: string) => (emitted = id));
    (fixture.nativeElement.querySelector('[data-testid="tree-row"]') as HTMLElement).click();
    expect(emitted).toBe('o1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- milestone-tree.component.spec.ts`
Expected: FAIL — `milestone-tree.component.ts` doesn't exist yet.

- [ ] **Step 3: Create `MilestoneTreeComponent`**

Create `src/app/modules/work/ui/milestone-tree/milestone-tree.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { MilestoneTreeNodeComponent } from '../milestone-tree-node/milestone-tree-node.component';

@Component({
  selector: 'app-milestone-tree',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    @if (parent(); as parentRef) {
      <div
        data-testid="tree-parent-row"
        class="mb-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
        (click)="nodeSelected.emit(parentRef.id)"
      >
        <span aria-hidden="true">↑</span>
        <span class="truncate">{{ parentRef.title }}</span>
      </div>
    }
    <app-milestone-tree-node [node]="root()" [selectedId]="root().id" (selected)="nodeSelected.emit($event)" />
  `
})
export class MilestoneTreeComponent {
  root = input.required<MilestoneTreeNode>();
  parent = input<{ id: string; title: string } | null>(null);
  nodeSelected = output<string>();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- milestone-tree.component.spec.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-tree/milestone-tree.component.ts src/app/modules/work/ui/milestone-tree/milestone-tree.component.spec.ts
git commit -m "feat: add MilestoneTreeComponent wrapper with parent-context row"
```

---

### Task 5: `MilestoneDetailPanelComponent`

**Files:**
- Create: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`
- Test: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveDetail` (`src/app/modules/work/models/milestone.model.ts` — already an alias for `ObjectiveDetailDto`, now carrying `ownerName`/`reportingManagerName`/`isOwner` per Task 1).
- Produces: `MilestoneDetailPanelComponent` with `milestone = input<ObjectiveDetail | null>(null)`, `settingsRequested = output<void>()`.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneDetailPanelComponent } from './milestone-detail-panel.component';
import { ObjectiveDetail } from '../../models/milestone.model';

describe('MilestoneDetailPanelComponent', () => {
  let fixture: ComponentFixture<MilestoneDetailPanelComponent>;

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: false, title: 'Design Phase',
    description: 'Scope the design work', ownerId: 'u1', ownerName: 'Jane Doe',
    reportingManagerId: 'u2', reportingManagerName: 'John Smith', createdById: 'u1',
    startDate: '2026-01-01', endDate: '2026-03-01', progress: 40, actualHours: null,
    allocatedHours: 20, completedHours: 8, isActive: true, isAchieved: false,
    achievedAt: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: null, isOwner: true
  };

  function setup(value: ObjectiveDetail | null): void {
    fixture = TestBed.createComponent(MilestoneDetailPanelComponent);
    fixture.componentRef.setInput('milestone', value);
    fixture.detectChanges();
  }

  it('shows a placeholder when nothing is selected', () => {
    setup(null);
    expect(fixture.nativeElement.textContent).toContain('Select a milestone');
  });

  it('renders the milestone fields', () => {
    setup(detail);
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Design Phase');
    expect(text).toContain('Jane Doe');
    expect(text).toContain('John Smith');
    expect(text).toContain('8 / 20h');
    expect(text).toContain('40%');
    expect(text).toContain('Not achieved');
  });

  it('shows the gear button only when isOwner is true', () => {
    setup(detail);
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).not.toBeNull();
  });

  it('hides the gear button when isOwner is false', () => {
    setup({ ...detail, isOwner: false });
    expect(fixture.nativeElement.querySelector('[data-testid="settings-button"]')).toBeNull();
  });

  it('emits settingsRequested when the gear is clicked', () => {
    setup(detail);
    let emitted = false;
    fixture.componentInstance.settingsRequested.subscribe(() => (emitted = true));
    (fixture.nativeElement.querySelector('[data-testid="settings-button"]') as HTMLButtonElement).click();
    expect(emitted).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- milestone-detail-panel.component.spec.ts`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Create `MilestoneDetailPanelComponent`**

Create `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`:

```typescript
import { Component, input, output } from '@angular/core';
import { ObjectiveDetail } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  template: `
    @if (milestone(); as milestone) {
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">{{ milestone.title }}</h3>
        @if (milestone.isOwner) {
          <button
            type="button"
            data-testid="settings-button"
            class="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Milestone settings"
            (click)="settingsRequested.emit()"
          >⚙</button>
        }
      </div>
      <p class="mt-1 text-xs text-[var(--color-text-secondary)]">{{ milestone.ownerName ?? '—' }}</p>
      <dl class="mt-3 grid grid-cols-[100px_1fr] gap-y-1.5 text-xs">
        <dt class="text-[var(--color-text-secondary)]">Reporting Mgr</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.reportingManagerName ?? '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Start</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.startDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">End</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.endDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Hours</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.completedHours }} / {{ milestone.allocatedHours }}h</dd>
        <dt class="text-[var(--color-text-secondary)]">Progress</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.progress }}%</dd>
      </dl>
      <span class="mt-3 inline-block rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
        {{ milestone.isAchieved ? 'Achieved' : 'Not achieved' }}
      </span>
    } @else {
      <p class="text-sm text-[var(--color-text-secondary)]">Select a milestone to see its detail.</p>
    }
  `
})
export class MilestoneDetailPanelComponent {
  milestone = input<ObjectiveDetail | null>(null);
  settingsRequested = output<void>();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- milestone-detail-panel.component.spec.ts`
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts
git commit -m "feat: add MilestoneDetailPanelComponent"
```

---

### Task 6: Rewire `ProjectDetailComponent` — compact header, tab-bar, tree + detail cards

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: `TabsComponent`/`TabItem` (Task 2), `MilestoneTreeComponent` (Task 4), `MilestoneDetailPanelComponent` (Task 5), `store.selectedSubtreeParent()`/`store.selectedMilestoneDetail()` (Task 1).
- Produces: `onTreeNodeSelected(id: string): void` (replaces `onMilestoneSelected(milestone: Milestone)`), `onMilestoneSettingsRequested(): void` (no longer takes a `Milestone` argument — reads the currently focused id from `store.selectedMilestoneDetail()`). `MilestoneSettingsModalComponent`'s own logic and the `getMilestoneDetail`/race-guard pattern are preserved exactly as before (per the design doc's explicit "don't touch this logic" instruction) — only the id source changes from a clicked card to the store's currently-focused milestone.

- [ ] **Step 1: Write the failing test**

Replace `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts` with:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { Milestone, MilestoneTreeNode, ObjectiveDetail } from '../../models/milestone.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: any;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
  };

  const milestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
    objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
    isOwner: true
  };

  const treeNode: MilestoneTreeNode = {
    id: 'o1', title: 'Default', startDate: '2026-08-01', endDate: '2026-12-01',
    progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, children: []
  };

  const detail: ObjectiveDetail = {
    id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    description: null, ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    createdById: 'u1', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
    allocatedHours: 40, completedHours: 0, isActive: true, isAchieved: false, achievedAt: null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: null, isOwner: true
  };

  beforeEach(async () => {
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      milestones: () => [milestone],
      milestonesLoading: () => false,
      milestonesError: () => null,
      selectedSubtree: () => treeNode,
      selectedSubtreeParent: () => null,
      selectedMilestoneDetail: () => detail,
      subtreeLoading: () => false,
      subtreeError: () => null,
      loadProject: vi.fn().mockResolvedValue(undefined),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      clearSelectedSubtree: vi.fn(),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      milestoneActionError: () => null
    };

    await TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: { paramMap: of({ get: (key: string) => (key === 'id' ? 'p1' : null) }) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
  });

  it('loads the project and its milestones for the routed id', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadProject).toHaveBeenCalledWith('p1');
    expect(storeStub.loadMyMilestones).toHaveBeenCalledWith('p1');
  });

  it('renders the compact project header, without a milestone card row', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.querySelector('app-milestone-card')).toBeNull();
  });

  it('auto-selects the first milestone once milestones load, via the subtree API', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('does not attempt to select anything when there are no milestones', async () => {
    storeStub.milestones = () => [];
    fixture.detectChanges();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();

    expect(storeStub.loadMilestoneSubtree).not.toHaveBeenCalled();
  });

  it('re-centers the tree when a tree node is selected', () => {
    fixture.detectChanges();
    fixture.componentInstance.onTreeNodeSelected('o2');
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o2');
  });

  it('renders the milestone tree once selectedSubtree resolves', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree')).not.toBeNull();
  });

  it('renders the detail panel with the focused milestone', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-detail-panel')).not.toBeNull();
  });

  it('resets stale subtree state on init', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.clearSelectedSubtree).toHaveBeenCalled();
  });

  it('opens the settings modal and fetches the full detail for the currently focused milestone', async () => {
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue({ ...detail, description: 'Full scope' });
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested();

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.milestoneSettingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('does nothing when settings are requested with no focused milestone', () => {
    storeStub.selectedMilestoneDetail = () => null;
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested();

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(false);
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.editMilestone).toHaveBeenCalledWith('o1', {
      title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40
    });
    expect(storeStub.achieveMilestone).not.toHaveBeenCalled();
    expect(storeStub.unachieveMilestone).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(false);
  });

  it('edits then achieves, in that order, when the toggle is turned on', async () => {
    const calls: string[] = [];
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    storeStub.achieveMilestone = vi.fn().mockImplementation(async () => { calls.push('achieve'); return { success: true, pending: false }; });
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(calls).toEqual(['edit', 'achieve']);
  });

  it('unachieves then edits, in that order, when the toggle is turned off', async () => {
    const calls: string[] = [];
    storeStub.unachieveMilestone = vi.fn().mockImplementation(async () => { calls.push('unachieve'); return { success: true, pending: false }; });
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(calls).toEqual(['unachieve', 'edit']);
  });

  it('stops the sequence and keeps the modal open if the first step fails', async () => {
    storeStub.unachieveMilestone = vi.fn().mockResolvedValue({ success: false, pending: false });
    const editSpy = vi.fn();
    storeStub.editMilestone = editSpy;
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(editSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
  });

  it('reloads the current subtree after a successful save', async () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested();
    storeStub.loadMilestoneSubtree.mockClear();

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- project-detail.component.spec.ts`
Expected: FAIL — `onTreeNodeSelected` doesn't exist, `onMilestoneSettingsRequested` still expects a `Milestone` argument, `app-milestone-tree`/`app-milestone-detail-panel` aren't rendered.

- [ ] **Step 3: Rewrite the component class**

Replace `src/app/modules/work/feature/project-detail/project-detail.component.ts` with:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeComponent } from '../../ui/milestone-tree/milestone-tree.component';
import { MilestoneDetailPanelComponent } from '../../ui/milestone-detail-panel/milestone-detail-panel.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { TabsComponent, TabItem } from '../../../../shared/ui/tabs/tabs.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneTreeComponent, MilestoneDetailPanelComponent, MilestoneSettingsModalComponent, TabsComponent, CardComponent,
    LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private projectId = '';

  readonly tabs: TabItem[] = [
    { id: 'tree', label: 'Tree' },
    { id: 'list', label: 'List', disabled: true },
    { id: 'board', label: 'Board', disabled: true }
  ];
  activeTabId = signal('tree');

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  private targetMilestoneId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.clearSelectedSubtree();
    this.store.loadProject(this.projectId);
    await this.store.loadMyMilestones(this.projectId);
    const milestones = this.store.milestones();
    if (milestones.length > 0) {
      this.onTreeNodeSelected(milestones[0].objectiveId);
    }
  }

  onTreeNodeSelected(id: string): void {
    this.store.loadMilestoneSubtree(id);
  }

  onMilestoneSettingsRequested(): void {
    const id = this.store.selectedMilestoneDetail()?.id;
    if (!id) return;
    this.targetMilestoneId.set(id);
    this.milestoneSettingsOpen.set(true);
    this.loadFullMilestoneDetail(id);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestoneId() === id) {
      this.milestoneSettingsInitialValue.set(detail);
    }
  }

  async onMilestoneSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const id = this.targetMilestoneId();
    if (!id) return;
    this.milestoneSettingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(id);
      if (!unachieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(id, event.fields);
    if (!editResult.success) {
      this.milestoneSettingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(id);
      if (!achieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    this.milestoneSettingsSubmitting.set(false);
    this.milestoneSettingsOpen.set(false);
    await this.store.loadMilestoneSubtree(id);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }

  retrySubtree(): void {
    const id = this.store.selectedMilestoneDetail()?.id;
    if (id) this.store.loadMilestoneSubtree(id);
  }
}
```

Note on preserving the settings logic (design doc, "Out of scope"): `loadFullMilestoneDetail` still calls `store.getMilestoneDetail(id)` exactly as before — the only change is which value feeds `id`: previously the id came from the clicked `Milestone` card object, now it comes from `store.selectedMilestoneDetail()?.id` (the currently tree-focused node). The race-guard (`this.targetMilestoneId() === id`) is the same check as the old `this.targetMilestone()?.objectiveId === id`, just comparing against an id signal instead of a whole cached `Milestone` object, since there's no longer a `Milestone` object at this call site.

- [ ] **Step 4: Rewrite the template**

Replace `src/app/modules/work/feature/project-detail/project-detail.component.html` with:

```html
<div class="mb-3">
  @if (store.projectLoading()) {
    <app-loader label="Loading project…" />
  } @else if (store.projectError()) {
    <app-error-state [message]="store.projectError()!" [retryable]="true" (retry)="retryProject()" />
  } @else if (store.project(); as project) {
    <app-card>
      <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div class="truncate">
          <span class="font-semibold text-[var(--color-text-primary)]">{{ project.name }}</span>
          <span class="ml-2 text-xs text-[var(--color-text-secondary)]">{{ project.identifier }} · {{ project.description ?? '' }}</span>
        </div>
        <div class="flex shrink-0 gap-4 text-xs text-[var(--color-text-secondary)]">
          <span>Start: {{ project.startDate }}</span>
          <span>Target: {{ project.targetDate }}</span>
          <span>Hours: {{ project.completedHours }} / {{ project.allocatedHours }}</span>
        </div>
      </div>
    </app-card>
  }
</div>

<div class="mb-3">
  <app-card>
    <app-tabs [tabs]="tabs" [activeId]="activeTabId()" (tabChange)="activeTabId.set($event)" />
  </app-card>
</div>

@if (activeTabId() === 'tree') {
  <div class="flex flex-col gap-3 md:flex-row">
    <div class="md:flex-[2]">
      <app-card>
        @if (store.milestonesLoading() || store.subtreeLoading()) {
          <app-loader label="Loading milestones…" />
        } @else if (store.milestonesError()) {
          <app-error-state [message]="store.milestonesError()!" [retryable]="true" (retry)="retryMilestones()" />
        } @else if (store.subtreeError()) {
          <app-error-state [message]="store.subtreeError()!" [retryable]="true" (retry)="retrySubtree()" />
        } @else if (store.milestones().length === 0) {
          <app-empty-state title="No milestones yet" />
        } @else if (store.selectedSubtree(); as subtree) {
          <app-milestone-tree [root]="subtree" [parent]="store.selectedSubtreeParent()" (nodeSelected)="onTreeNodeSelected($event)" />
        }
      </app-card>
    </div>
    <div class="md:flex-1">
      <app-card>
        <app-milestone-detail-panel [milestone]="store.selectedMilestoneDetail()" (settingsRequested)="onMilestoneSettingsRequested()" />
      </app-card>
    </div>
  </div>
}

<app-milestone-settings-modal
  [open]="milestoneSettingsOpen()"
  [initialValue]="milestoneSettingsInitialValue()"
  [submitting]="milestoneSettingsSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (saved)="onMilestoneSettingsSaved($event)"
  (closed)="milestoneSettingsOpen.set(false)"
/>
```

(`PageHeaderComponent` is dropped from the `imports` array — it was imported in the previous version of this component but never referenced in the template; this rewrite is a natural point to remove that pre-existing dead import.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- project-detail.component.spec.ts`
Expected: all 15 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/project-detail/project-detail.component.ts src/app/modules/work/feature/project-detail/project-detail.component.html src/app/modules/work/feature/project-detail/project-detail.component.spec.ts
git commit -m "feat: rework Project Detail into compact header + tab-bar + tree/detail cards"
```

---

### Task 7: Delete the now-unused `MilestoneCardComponent`

**Files:**
- Delete: `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`
- Delete: `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`

**Interfaces:** None — pure deletion. Confirmed by search that no other file in the codebase imports `MilestoneCardComponent` (Task 6 already removed the only importer).

- [ ] **Step 1: Confirm nothing else references it**

Run (from the repo root): `grep -rl "milestone-card" src/app --include=*.ts | grep -v ui/milestone-card`
Expected: no output (empty) — confirming Task 6 was the only consumer.

- [ ] **Step 2: Delete the files**

```bash
git rm src/app/modules/work/ui/milestone-card/milestone-card.component.ts src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts
```

- [ ] **Step 3: Run the full work-module test suite to confirm nothing broke**

Run: `npm test -- src/app/modules/work`
Expected: all tests PASS (no references to the deleted files anywhere).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused MilestoneCardComponent (superseded by the milestone tree view)"
```

---

### Task 8: Update `docs/core/ARCHITECTURE.md` (same-commit doc sync, `PROCESS_RULES.md` rule 6)

**Files:**
- Modify: `docs/core/ARCHITECTURE.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add `tabs/` to the shared UI folder tree**

In `docs/core/ARCHITECTURE.md` §2, find:

```
│   ├── ui/
│   │   ├── button/
│   │   ├── table/
│   │   ├── modal/
│   │   ├── card/
│   │   └── loader/
```

Replace with:

```
│   ├── ui/
│   │   ├── button/
│   │   ├── table/
│   │   ├── modal/
│   │   ├── card/
│   │   ├── loader/
│   │   └── tabs/                              ← generic horizontal tab-bar, added 2026-08-10 for Project Detail
```

- [ ] **Step 2: Update the `work/` module's `ui/` folder tree**

Find:

```
│   │   ├── ui/
│   │   │   ├── project-card/
│   │   │   │   └── project-card.component.ts
│   │   │   ├── project-filter-bar/
│   │   │   │   └── project-filter-bar.component.ts
│   │   │   ├── project-form-modal/            # Create only
│   │   │   │   └── project-form-modal.component.ts
│   │   │   ├── project-settings-modal/        # Edit + Achieved toggle
│   │   │   │   └── project-settings-modal.component.ts
│   │   │   ├── milestone-tree-node/
│   │   │   │   └── milestone-tree-node.component.ts
│   │   │   ├── milestone-card/
│   │   │   │   └── milestone-card.component.ts
│   │   │   └── milestone-settings-modal/       # Edit + Achieved toggle
│   │   │       └── milestone-settings-modal.component.ts
```

Replace with:

```
│   │   ├── ui/
│   │   │   ├── project-card/
│   │   │   │   └── project-card.component.ts
│   │   │   ├── project-filter-bar/
│   │   │   │   └── project-filter-bar.component.ts
│   │   │   ├── project-form-modal/            # Create only
│   │   │   │   └── project-form-modal.component.ts
│   │   │   ├── project-settings-modal/        # Edit + Achieved toggle
│   │   │   │   └── project-settings-modal.component.ts
│   │   │   ├── milestone-tree/                # parent-context row + recursive tree, added 2026-08-10
│   │   │   │   └── milestone-tree.component.ts
│   │   │   ├── milestone-tree-node/            # explorer-style recursive row, reworked 2026-08-10
│   │   │   │   └── milestone-tree-node.component.ts
│   │   │   ├── milestone-detail-panel/         # added 2026-08-10, replaces milestone-card's settings entry point
│   │   │   │   └── milestone-detail-panel.component.ts
│   │   │   └── milestone-settings-modal/       # Edit + Achieved toggle
│   │   │       └── milestone-settings-modal.component.ts
```

- [ ] **Step 3: Extend the existing 2026-08-10 sync note**

Find the complete note paragraph in §2 (it's one single line in the file — reproduced here wrapped for readability, but it is one unbroken paragraph, so match/replace the whole thing as one block):

```
> **Note (2026-08-10):** `work/` below is kept in sync with the actual built module (see rule 6 in `docs/superpowers/rules/PROCESS_RULES.md`) — same for `auth/`, `dashboard/`, `core/`, and `shared/`. `organization/` and `public/` also exist in the real codebase today but aren't reflected in this tree yet. `employees/`, `leave/`, `attendance/`, `payroll/`, `recruitment/`, `performance/`, `reports/`, `tenant-admin/`, and `settings/` below are the **original planning-time module skeletons** — none of them exist under `src/app/modules/` yet; treat them as a proposed shape for future modules, not a current-state description. Don't assume a listing here means the code exists — check `src/app/modules/` directly for what's actually built.
```

Replace with the same paragraph plus one appended sentence at the end:

```
> **Note (2026-08-10):** `work/` below is kept in sync with the actual built module (see rule 6 in `docs/superpowers/rules/PROCESS_RULES.md`) — same for `auth/`, `dashboard/`, `core/`, and `shared/`. `organization/` and `public/` also exist in the real codebase today but aren't reflected in this tree yet. `employees/`, `leave/`, `attendance/`, `payroll/`, `recruitment/`, `performance/`, `reports/`, `tenant-admin/`, and `settings/` below are the **original planning-time module skeletons** — none of them exist under `src/app/modules/` yet; treat them as a proposed shape for future modules, not a current-state description. Don't assume a listing here means the code exists — check `src/app/modules/` directly for what's actually built. Project Detail (`feature/project-detail/`) is now a 4-card layout (compact header, tab-bar, milestone tree, detail panel) — see `docs/superpowers/specs/next/2026-08-10-project-detail-milestone-tree-view-design.md`; the former horizontal milestone-card row and `MilestoneCardComponent` were removed the same day.
```

- [ ] **Step 4: Commit**

```bash
git add docs/core/ARCHITECTURE.md
git commit -m "docs: sync ARCHITECTURE.md with the Project Detail milestone tree view"
```

---

## After this plan finishes

- Move this plan file from `plans/next/` to `plans/finished/<completion-date>/` and update `plans/SUMMARY.md`, `plans/finished/SUMMARY.md`, `plans/next/SUMMARY.md` per `FILE_CREATION_RULES.md` rule 5.
- Move `docs/superpowers/specs/next/2026-08-10-project-detail-milestone-tree-view-design.md` to `specs/finished/<completion-date>/` and update `specs/SUMMARY.md`/`specs/finished/SUMMARY.md`/`specs/next/SUMMARY.md` the same way, once both this plan and the backend plan are done.
- Manual smoke test in the browser: open a seeded project's detail page, confirm the tab bar shows only "Tree" active with "List"/"Board" visibly disabled, click through 2-3 levels of a milestone tree, confirm the parent-context row appears and re-centers correctly, confirm the gear only appears when viewing a milestone you own.
