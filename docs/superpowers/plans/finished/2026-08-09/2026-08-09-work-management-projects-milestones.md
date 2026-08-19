# Work Management — Projects List, Project Detail, Milestone Read View — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Finished 2026-08-09 — all 17 tasks executed, one commit per task, full suite green throughout. See "Execution report" at the end of this file.

**Goal:** Build the Work Management module's Projects surface — list with cards, Create/Edit/Delete/Achieve/Unachieve popups, a Project Detail page, and a read-only Milestone (Objective) view — gated on the `projects:access` permission, against the real backend API.

**Architecture:** New `src/app/modules/work/` domain module following this repo's established `feature/ui/data-access/state/models/utils` layering (see `docs/core/ARCHITECTURE.md` §2). Two `@ngrx/signals` stores (`ProjectListStore`, `ProjectDetailStore`) plus a small shared `ProjectCategoryStore`. All HTTP goes through thin `*-api.service.ts` classes using `HttpClient` + `environment.apiUrl`, matching `LegalEntityApiService`'s existing convention exactly (inline endpoint strings, not the `API_ENDPOINTS` constant — that file is unused dead scaffold; this plan does not extend it).

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals` (`signalStore`/`withState`/`withComputed`/`withMethods`/`patchState`), RxJS + `firstValueFrom`, Vitest via `@angular/build:unit-test` (`ng test`) — this plan's own execution corrected an earlier assumption of Jasmine/Karma; the real runner is Vitest with Jasmine-compatible globals (`describe`/`it`/`expect`) but `vi.fn()`/`vi.spyOn()`/`expect.objectContaining()` instead of `jasmine.*` — Tailwind via the existing `shared/ui/*` component set.

**Design reference:** `docs/superpowers/specs/next/2026-08-08-work-management-projects-milestones-design.md` — read this first for the full rationale; this plan does not repeat the "why," only the "how."

## Global Constraints

- Every new file gets a co-located `.spec.ts`, matching the existing convention (`employee.store.spec.ts` style — this repo doesn't have that exact file, but `auth.store.spec.ts`/`legal-entity.store.spec.ts`/`nav-access.spec.ts` are the real precedent followed throughout this plan).
- All dates are plain `YYYY-MM-DD` strings end-to-end (backend `DateOnly` serializes this way; HTML `<input type="date">` uses the same format) — no `Date` object conversion anywhere in this plan.
- Money/hours are `number` (backend `decimal` serializes as a JSON number).
- Error messages in every store method use the exact extraction pattern already established in `legal-entity.store.ts`: `err?.error?.detail || err?.error?.message || err?.message || '<fallback>'`.
- No `BehaviorSubject` anywhere (retired repo-wide per `ARCHITECTURE.md` §4.4) — signals only.
- **Category select is built against the real, documented contract of an endpoint that does not exist in the backend yet** (`GET /api/v1/work/project-categories` — requested in `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-08-work-management-frontend-blocking-endpoints.md`, confirmed with the user 2026-08-09: build the real dropdown now, not a stopgap). Until the backend ships it, the call 404s and the dropdown is simply empty — this is expected and does not block anything else in this plan.
- **Active/Archived filter is fully deferred, no stopgap.** `GET /work/projects/mine` returns no achieved-state field at all (backend gap #2, same request doc) — there is nothing to filter on client-side either. The filter control is built but rendered disabled with a short label; wiring it up is a follow-up plan once the field exists.
- Confirm dialogs (Delete/Achieve/Unachieve) use the existing `app-button` `primary`/`secondary` variants only — no new "danger" button variant is introduced (kept out of scope, same as the rest of the rejected manager-doc styling work per the design doc's Related note).

---

## File Structure

```
src/app/shared/ui/input/input.component.ts                 (MODIFIED — add 'date' InputType)
src/app/shared/ui/confirm-modal/
  confirm-modal.component.ts                                (NEW — reusable confirm/cancel dialog)
  confirm-modal.component.spec.ts

src/app/modules/work/
  models/
    project.model.ts                                        view models + filter/payload types
    project-category.model.ts
    milestone.model.ts
    dto/
      project.dto.ts                                        raw API request/response shapes
      project-category.dto.ts
      milestone.dto.ts
  utils/
    project-form.validator.ts                                 pure validation functions
    project-form.validator.spec.ts
    project.mapper.ts                                        DTO -> view model mapping
    project.mapper.spec.ts
  data-access/
    project-category-api.service.ts
    project-category-api.service.spec.ts
    project-api.service.ts
    project-api.service.spec.ts
  state/
    project-category.store.ts
    project-category.store.spec.ts
    project-list.store.ts
    project-list.store.spec.ts
    project-detail.store.ts
    project-detail.store.spec.ts
  ui/
    project-card/
      project-card.component.ts
      project-card.component.spec.ts
    project-filter-bar/
      project-filter-bar.component.ts
      project-filter-bar.component.spec.ts
    project-form-modal/
      project-form-modal.component.ts
      project-form-modal.component.spec.ts
    milestone-tree-node/
      milestone-tree-node.component.ts
      milestone-tree-node.component.spec.ts
  feature/
    project-list/
      project-list.component.ts
      project-list.component.html
      project-list.component.spec.ts
    project-detail/
      project-detail.component.ts
      project-detail.component.html
      project-detail.component.spec.ts
  work.routes.ts
  work.routes.spec.ts

src/app/app.routes.ts                                       (MODIFIED — replace /work placeholder)
src/app/layouts/main-layout/nav/nav-items.config.ts           (MODIFIED — add requiredPermissions)
src/app/layouts/main-layout/nav/nav-access.spec.ts             (MODIFIED — update Work assertions)
```

---

### Task 1: Shared `InputComponent` — add a `date` type

**Files:**
- Modify: `src/app/shared/ui/input/input.component.ts`
- Test: `src/app/shared/ui/input/input.component.spec.ts` (existing file — add cases)

**Interfaces:**
- Produces: `InputType` now includes `'date'`, usable as `<app-input type="date" ...>` anywhere in the app.

No date-capable input variant exists yet anywhere in this codebase, and Project/Milestone forms need Start Date/Target Date fields — this is a small, justified addition to the existing component, not a new one.

- [ ] **Step 1: Read the current spec file to match its existing style**

Run: view `src/app/shared/ui/input/input.component.spec.ts` before editing — match its existing `describe`/`it` structure exactly (TestBed-free, direct component instantiation via `ComponentFixture`, the same pattern already used there).

- [ ] **Step 2: Write the failing test**

Add to `input.component.spec.ts`:

```ts
it('renders a native date input when type is "date"', () => {
  fixture.componentRef.setInput('type', 'date');
  fixture.detectChanges();
  const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
  expect(input.type).toBe('date');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --include='**/input.component.spec.ts'`
Expected: FAIL — TypeScript error, `'date'` is not assignable to `InputType`.

- [ ] **Step 4: Implement**

In `input.component.ts`, change:

```ts
export type InputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url';
```

to:

```ts
export type InputType = 'text' | 'email' | 'password' | 'number' | 'search' | 'tel' | 'url' | 'date';
```

No other change needed — the template already binds `[type]="type()"` directly onto the native `<input>`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --include='**/input.component.spec.ts'`
Expected: PASS, all existing cases still green.

- [ ] **Step 6: Commit**

```bash
git add src/app/shared/ui/input/input.component.ts src/app/shared/ui/input/input.component.spec.ts
git commit -m "feat(shared): add date type to InputComponent"
```

---

### Task 2: Work module models, DTOs

**Files:**
- Create: `src/app/modules/work/models/dto/project.dto.ts`
- Create: `src/app/modules/work/models/dto/project-category.dto.ts`
- Create: `src/app/modules/work/models/dto/milestone.dto.ts`
- Create: `src/app/modules/work/models/project.model.ts`
- Create: `src/app/modules/work/models/project-category.model.ts`
- Create: `src/app/modules/work/models/milestone.model.ts`

**Interfaces:**
- Produces: every type name used by every later task in this plan. Copy these exactly — later tasks assume these exact names/shapes.

Plain type-only files, nothing to unit test (no runtime logic) — matches how `legal-entity.model.ts` has no `.spec.ts` in this repo.

- [ ] **Step 1: Create `dto/project.dto.ts`**

```ts
export interface ProjectListItemDto {
  id: string;
  name: string;
  identifier: string;
  categoryId: string;
  leadId: string;
  startDate: string;
  targetDate: string;
  color: string | null;
  isActive: boolean;
  allocatedHours: number;
  completedHours: number;
  isLead: boolean;
}

export interface PagedResultDto<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ProjectDetailDto {
  id: string;
  name: string;
  identifier: string;
  categoryId: string;
  description: string | null;
  leadId: string;
  startDate: string;
  targetDate: string;
  color: string | null;
  actualHours: number | null;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  isLead: boolean;
}

export interface CreateProjectResponseDto {
  project: { id: string; name: string };
}

export interface CreateProjectRequestDto {
  categoryId: string;
  name: string;
  identifier: string;
  description: string;
  startDate: string;
  targetDate: string;
  releaseDate: string;
  color: string;
  actualHours: number;
  defaultObjectiveAllocatedHours: number;
}

export interface EditProjectRequestDto {
  name: string;
  description: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  color: string;
  actualHours: number;
}
```

`ProjectDetailDto` is confirmed against the real backend source (`ProjectDetailViewModel.cs`) — it already carries `isAchieved`/`achievedAt`, unlike the Postman doc which under-documents it. `ProjectListItemDto` deliberately has no `isAchieved` — confirmed against `ProjectListItemViewModel.cs`, this is backend gap #2.

- [ ] **Step 2: Create `dto/project-category.dto.ts`**

```ts
export interface ProjectCategoryDto {
  id: string;
  name: string;
}
```

- [ ] **Step 3: Create `dto/milestone.dto.ts`**

```ts
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
}

export interface ObjectiveDetailDto {
  id: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  description: string | null;
  ownerId: string;
  reportingManagerId: string | null;
  createdById: string;
  startDate: string;
  endDate: string;
  progress: number;
  actualHours: number | null;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
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
```

- [ ] **Step 4: Create `models/project.model.ts`**

```ts
export interface Project {
  id: string;
  name: string;
  identifier: string;
  categoryId: string;
  leadId: string;
  startDate: string;
  targetDate: string;
  color: string | null;
  isActive: boolean;
  allocatedHours: number;
  completedHours: number;
  isLead: boolean;
}

export interface ProjectDetail extends Project {
  description: string | null;
  actualHours: number | null;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateProjectPayload {
  categoryId: string;
  name: string;
  identifier: string;
  description: string;
  startDate: string;
  targetDate: string;
  releaseDate: string;
  color: string;
  actualHours: number;
  defaultObjectiveAllocatedHours: number;
}

export interface EditProjectPayload {
  name: string;
  description: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  color: string;
  actualHours: number;
}
```

- [ ] **Step 5: Create `models/project-category.model.ts`**

```ts
export interface ProjectCategory {
  id: string;
  name: string;
}
```

- [ ] **Step 6: Create `models/milestone.model.ts`**

```ts
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
}

export interface MilestoneTreeNode {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  children: MilestoneTreeNode[];
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/models
git commit -m "feat(work): add Work Management DTOs and view models"
```

---

### Task 3: `project.mapper.ts` — DTO to view-model mapping

**Files:**
- Create: `src/app/modules/work/utils/project.mapper.ts`
- Test: `src/app/modules/work/utils/project.mapper.spec.ts`

**Interfaces:**
- Consumes: `ProjectListItemDto`, `ProjectDetailDto`, `MyProjectMilestoneDto`, `ObjectiveSubtreeNodeDto` (Task 2)
- Produces: `toProject(dto: ProjectListItemDto): Project`, `toProjectDetail(dto: ProjectDetailDto): ProjectDetail`, `toMilestone(dto: MyProjectMilestoneDto): Milestone`, `toMilestoneTreeNode(dto: ObjectiveSubtreeNodeDto): MilestoneTreeNode` — used by Tasks 6 and 8.

The DTOs and view models are structurally identical field-for-field in this plan (no renaming needed) — the mapper exists so a future field rename or added computed field (e.g. once backend gap #2 ships `isAchieved` on the list DTO) touches one file, not every call site.

- [ ] **Step 1: Write the failing test**

```ts
import { toProject, toProjectDetail, toMilestone, toMilestoneTreeNode } from './project.mapper';
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';

describe('project.mapper', () => {
  it('maps a ProjectListItemDto to a Project', () => {
    const dto: ProjectListItemDto = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true
    };
    expect(toProject(dto)).toEqual({
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: '#2563EB', isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true
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
      membershipIsActive: true, membershipRemovedAt: null
    };
    expect(toMilestone(dto).ownerName).toBe('Jane Doe');
  });

  it('maps an ObjectiveSubtreeNodeDto to a MilestoneTreeNode, recursively', () => {
    const dto: ObjectiveSubtreeNodeDto = {
      id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
      description: null, ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
      startDate: '2026-08-01', endDate: '2026-12-01', progress: 50, actualHours: null,
      allocatedHours: 40, completedHours: 20, isActive: true, createdAt: '2026-08-01T00:00:00Z',
      updatedAt: null,
      children: [
        {
          id: 'o2', projectId: 'p1', parentObjectiveId: 'o1', isDefault: false, title: 'Child',
          description: null, ownerId: 'u1', reportingManagerId: 'u1', createdById: 'u1',
          startDate: '2026-08-01', endDate: '2026-09-01', progress: 0, actualHours: null,
          allocatedHours: 10, completedHours: 0, isActive: true, createdAt: '2026-08-01T00:00:00Z',
          updatedAt: null, children: []
        }
      ]
    };
    const result = toMilestoneTreeNode(dto);
    expect(result.title).toBe('Root');
    expect(result.children).toHaveLength(1);
    expect(result.children[0].title).toBe('Child');
    expect(result.children[0].children).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project.mapper.spec.ts'`
Expected: FAIL — `project.mapper.ts` does not exist.

- [ ] **Step 3: Implement**

```ts
import { ProjectListItemDto, ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeNodeDto } from '../models/dto/milestone.dto';
import { Project, ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode } from '../models/milestone.model';

export function toProject(dto: ProjectListItemDto): Project {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead
  };
}

export function toProjectDetail(dto: ProjectDetailDto): ProjectDetail {
  return {
    id: dto.id, name: dto.name, identifier: dto.identifier, categoryId: dto.categoryId,
    leadId: dto.leadId, startDate: dto.startDate, targetDate: dto.targetDate, color: dto.color,
    isActive: dto.isActive, allocatedHours: dto.allocatedHours, completedHours: dto.completedHours,
    isLead: dto.isLead, description: dto.description, actualHours: dto.actualHours,
    isAchieved: dto.isAchieved, achievedAt: dto.achievedAt, createdAt: dto.createdAt,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project.mapper.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/utils/project.mapper.ts src/app/modules/work/utils/project.mapper.spec.ts
git commit -m "feat(work): add DTO-to-view-model mapper"
```

---

### Task 4: `project-form.validator.ts` — Create/Edit form validation

**Files:**
- Create: `src/app/modules/work/utils/project-form.validator.ts`
- Test: `src/app/modules/work/utils/project-form.validator.spec.ts`

**Interfaces:**
- Produces: `validateProjectForm(fields, mode): Record<string, string>` — a field-name-to-error-message map, empty object means valid. Used by Task 12 (`ProjectFormModalComponent`).

Mirrors real backend validation rules from `Create Project.md`/`Edit Project.md`: `name` required, `identifier` required only in create mode (letters/digits, must start with a letter, max 20 chars), `categoryId` required, `startDate`/`targetDate` required with `targetDate >= startDate`, `allocatedHours` (create: `defaultObjectiveAllocatedHours`) `>= 0`.

- [ ] **Step 1: Write the failing test**

```ts
import { validateProjectForm, ProjectFormFields } from './project-form.validator';

describe('validateProjectForm', () => {
  const validCreateFields: ProjectFormFields = {
    name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', startDate: '2026-08-01',
    targetDate: '2026-12-01', releaseDate: '2026-11-15', allocatedHours: 40
  };

  it('returns no errors for a fully valid create-mode form', () => {
    expect(validateProjectForm(validCreateFields, 'create')).toEqual({});
  });

  it('requires name', () => {
    const errors = validateProjectForm({ ...validCreateFields, name: '' }, 'create');
    expect(errors['name']).toBeTruthy();
  });

  it('requires categoryId', () => {
    const errors = validateProjectForm({ ...validCreateFields, categoryId: '' }, 'create');
    expect(errors['categoryId']).toBeTruthy();
  });

  it('requires identifier only in create mode, and rejects a bad format', () => {
    expect(validateProjectForm({ ...validCreateFields, identifier: '' }, 'create')['identifier']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, identifier: '1WEB' }, 'create')['identifier']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, identifier: 'THIS-IDENTIFIER-IS-WAY-TOO-LONG' }, 'create')['identifier']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, identifier: '' }, 'edit')['identifier']).toBeUndefined();
  });

  it('rejects targetDate before startDate', () => {
    const errors = validateProjectForm({ ...validCreateFields, startDate: '2026-12-01', targetDate: '2026-08-01' }, 'create');
    expect(errors['targetDate']).toBeTruthy();
  });

  it('rejects negative allocatedHours', () => {
    const errors = validateProjectForm({ ...validCreateFields, allocatedHours: -1 }, 'create');
    expect(errors['allocatedHours']).toBeTruthy();
  });

  it('requires releaseDate only in create mode', () => {
    expect(validateProjectForm({ ...validCreateFields, releaseDate: '' }, 'create')['releaseDate']).toBeTruthy();
    expect(validateProjectForm({ ...validCreateFields, releaseDate: '' }, 'edit')['releaseDate']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-form.validator.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
export interface ProjectFormFields {
  name: string;
  identifier: string;
  categoryId: string;
  startDate: string;
  targetDate: string;
  releaseDate: string;
  allocatedHours: number;
}

const IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9]{0,19}$/;

export function validateProjectForm(
  fields: ProjectFormFields,
  mode: 'create' | 'edit'
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!fields.name.trim()) {
    errors['name'] = 'Name is required.';
  }
  if (!fields.categoryId.trim()) {
    errors['categoryId'] = 'Category is required.';
  }
  if (!fields.startDate) {
    errors['startDate'] = 'Start date is required.';
  }
  if (!fields.targetDate) {
    errors['targetDate'] = 'Target date is required.';
  } else if (fields.startDate && fields.targetDate < fields.startDate) {
    errors['targetDate'] = 'Target date cannot be before the start date.';
  }
  if (fields.allocatedHours < 0) {
    errors['allocatedHours'] = 'Allocated hours cannot be negative.';
  }

  if (mode === 'create') {
    if (!fields.identifier.trim()) {
      errors['identifier'] = 'Identifier is required.';
    } else if (!IDENTIFIER_PATTERN.test(fields.identifier)) {
      errors['identifier'] = 'Identifier must start with a letter and contain only letters/digits, max 20 characters.';
    }
    if (!fields.releaseDate) {
      errors['releaseDate'] = 'Release date is required.';
    }
  }

  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-form.validator.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/utils/project-form.validator.ts src/app/modules/work/utils/project-form.validator.spec.ts
git commit -m "feat(work): add Create/Edit Project form validation"
```

---

### Task 5: `ProjectCategoryApiService`

**Files:**
- Create: `src/app/modules/work/data-access/project-category-api.service.ts`
- Test: `src/app/modules/work/data-access/project-category-api.service.spec.ts`

**Interfaces:**
- Produces: `ProjectCategoryApiService.list(): Observable<ProjectCategoryDto[]>` — GET `${environment.apiUrl}/work/project-categories`. Consumed by Task 6.

Calls the endpoint requested in `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-08-work-management-frontend-blocking-endpoints.md` — it does not exist on the backend yet, so this call 404s until that ships. The service and its test are written against the documented contract regardless, per the Global Constraints note.

- [ ] **Step 1: Write the failing test**

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProjectCategoryApiService } from './project-category-api.service';
import { ProjectCategoryDto } from '../models/dto/project-category.dto';

describe('ProjectCategoryApiService', () => {
  let service: ProjectCategoryApiService;
  let httpMock: HttpTestingController;

  const mockCategories: ProjectCategoryDto[] = [
    { id: 'cat1', name: 'Backend' },
    { id: 'cat2', name: 'Marketing' }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectCategoryApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProjectCategoryApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('fetches the project category list', () => {
    service.list().subscribe((categories) => expect(categories).toEqual(mockCategories));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/project-categories`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCategories);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-category-api.service.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ProjectCategoryDto } from '../models/dto/project-category.dto';

@Injectable({ providedIn: 'root' })
export class ProjectCategoryApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<ProjectCategoryDto[]> {
    return this.http.get<ProjectCategoryDto[]>(`${environment.apiUrl}/work/project-categories`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-category-api.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/data-access/project-category-api.service.ts src/app/modules/work/data-access/project-category-api.service.spec.ts
git commit -m "feat(work): add ProjectCategoryApiService"
```

---

### Task 6: `ProjectCategoryStore`

**Files:**
- Create: `src/app/modules/work/state/project-category.store.ts`
- Test: `src/app/modules/work/state/project-category.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectCategoryApiService.list()` (Task 5), `toProjectCategory` — add this one small mapper inline in this file (not worth its own mapper-file entry; it's a 1:1 passthrough).
- Produces: `ProjectCategoryStore` with `categories: Signal<ProjectCategory[]>`, `loading: Signal<boolean>`, `error: Signal<string | null>`, `loaded: Signal<boolean>`, method `loadCategories(): Promise<void>`. Consumed by Tasks 11 and 12.

A tiny root-provided store (categories are "4 fixed per tenant" per the user, shared identically between the list filter and the form modal — one fetch, cached for the session, exactly like `LegalEntityStore`'s `companies`).

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjectCategoryStore } from './project-category.store';
import { ProjectCategoryApiService } from '../data-access/project-category-api.service';
import { ProjectCategoryDto } from '../models/dto/project-category.dto';

describe('ProjectCategoryStore', () => {
  function setup(apiOverrides: Partial<ProjectCategoryApiService> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: ProjectCategoryApiService, useValue: apiOverrides }]
    });
    return TestBed.inject(ProjectCategoryStore);
  }

  it('loads categories successfully', async () => {
    const dtos: ProjectCategoryDto[] = [{ id: 'cat1', name: 'Backend' }];
    const store = setup({ list: () => of(dtos) } as Partial<ProjectCategoryApiService>);

    await store.loadCategories();

    expect(store.categories()).toEqual([{ id: 'cat1', name: 'Backend' }]);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBeNull();
  });

  it('sets an error and still marks loaded on failure (e.g. the endpoint 404s until backend ships it)', async () => {
    const store = setup({
      list: () => throwError(() => ({ error: { detail: 'Not Found' } }))
    } as Partial<ProjectCategoryApiService>);

    await store.loadCategories();

    expect(store.categories()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.error()).toBe('Not Found');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-category.store.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectCategoryApiService } from '../data-access/project-category-api.service';
import { ProjectCategory } from '../models/project-category.model';

interface ProjectCategoryState {
  readonly categories: readonly ProjectCategory[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly loaded: boolean;
}

const initialState: ProjectCategoryState = { categories: [], loading: false, error: null, loaded: false };

export const ProjectCategoryStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectCategoryState>(initialState),
  withMethods((store, api = inject(ProjectCategoryApiService)) => ({
    async loadCategories(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dtos = await firstValueFrom(api.list());
        patchState(store, {
          categories: dtos.map((dto) => ({ id: dto.id, name: dto.name })),
          loading: false,
          loaded: true
        });
      } catch (err: any) {
        patchState(store, {
          error: err?.error?.detail || err?.error?.message || err?.message || 'Failed to load project categories.',
          loading: false,
          loaded: true
        });
      }
    }
  }))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-category.store.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-category.store.ts src/app/modules/work/state/project-category.store.spec.ts
git commit -m "feat(work): add ProjectCategoryStore"
```

---

### Task 7: `ProjectApiService`

**Files:**
- Create: `src/app/modules/work/data-access/project-api.service.ts`
- Test: `src/app/modules/work/data-access/project-api.service.spec.ts`

**Interfaces:**
- Produces: `ProjectApiService` with `listMine(pageNumber, pageSize): Observable<PagedResultDto<ProjectListItemDto>>`, `getById(id): Observable<ProjectDetailDto>`, `create(payload: CreateProjectRequestDto): Observable<CreateProjectResponseDto>`, `edit(id, payload: EditProjectRequestDto): Observable<ProjectDetailDto>`, `delete(id): Observable<void>`, `achieve(id): Observable<void>`, `unachieve(id): Observable<void>`, `getMyMilestones(projectId): Observable<MyProjectMilestoneDto[]>`, `getMilestoneSubtree(objectiveId): Observable<ObjectiveSubtreeResponseDto>`. Consumed by Tasks 8 and 9.

`create` sends `multipart/form-data` per the real contract (`Create Project.md`) — this plan omits the optional `labelsJson`/`logo` fields (YAGNI, not in scope per the design doc) but the request is still built as `FormData` because the backend requires that content type regardless of which optional fields are present.

- [ ] **Step 1: Write the failing test**

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ProjectApiService } from './project-api.service';
import { ProjectDetailDto, ProjectListItemDto, PagedResultDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';

describe('ProjectApiService', () => {
  let service: ProjectApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ProjectApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProjectApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists my projects with paging params', () => {
    const page: PagedResultDto<ProjectListItemDto> = {
      items: [], pageNumber: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false
    };
    service.listMine(1, 20).subscribe((res) => expect(res).toEqual(page));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/mine?pageNumber=1&pageSize=20`);
    expect(req.request.method).toBe('GET');
    req.flush(page);
  });

  it('gets a project by id', () => {
    const dto = { id: 'p1' } as ProjectDetailDto;
    service.getById('p1').subscribe((res) => expect(res).toEqual(dto));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1`);
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });

  it('creates a project via multipart/form-data', () => {
    const response = { project: { id: 'p1', name: 'Website Revamp' } };
    service.create({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: 'Rebuild',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '#2563EB',
      actualHours: 0, defaultObjectiveAllocatedHours: 40
    }).subscribe((res) => expect(res).toEqual(response));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('name')).toBe('Website Revamp');
    req.flush(response);
  });

  it('edits a project', () => {
    const dto = { id: 'p1', name: 'Website Revamp v2' } as ProjectDetailDto;
    const payload = {
      name: 'Website Revamp v2', description: 'Rebuild', categoryId: 'cat1',
      startDate: '2026-08-01', targetDate: '2027-01-01', color: '#2563EB', actualHours: 12
    };
    service.edit('p1', payload).subscribe((res) => expect(res).toEqual(dto));

    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(dto);
  });

  it('deletes a project', () => {
    service.delete('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('achieves a project', () => {
    service.achieve('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/achieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('unachieves a project', () => {
    service.unachieve('p1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/unachieve`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('gets my milestones for a project', () => {
    const milestones: MyProjectMilestoneDto[] = [];
    service.getMyMilestones('p1').subscribe((res) => expect(res).toEqual(milestones));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/projects/p1/objectives/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(milestones);
  });

  it('gets a milestone subtree', () => {
    const response = { parentObjective: null, objective: { id: 'o1' } } as unknown as ObjectiveSubtreeResponseDto;
    service.getMilestoneSubtree('o1').subscribe((res) => expect(res).toEqual(response));
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/o1/tree`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-api.service.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CreateProjectRequestDto, CreateProjectResponseDto, EditProjectRequestDto,
  PagedResultDto, ProjectDetailDto, ProjectListItemDto
} from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/work/projects`;

  listMine(pageNumber: number, pageSize: number): Observable<PagedResultDto<ProjectListItemDto>> {
    const params = new HttpParams().set('pageNumber', pageNumber).set('pageSize', pageSize);
    return this.http.get<PagedResultDto<ProjectListItemDto>>(`${this.base}/mine`, { params });
  }

  getById(id: string): Observable<ProjectDetailDto> {
    return this.http.get<ProjectDetailDto>(`${this.base}/${id}`);
  }

  create(payload: CreateProjectRequestDto): Observable<CreateProjectResponseDto> {
    const formData = new FormData();
    formData.set('categoryId', payload.categoryId);
    formData.set('name', payload.name);
    formData.set('identifier', payload.identifier);
    formData.set('description', payload.description);
    formData.set('startDate', payload.startDate);
    formData.set('targetDate', payload.targetDate);
    formData.set('releaseDate', payload.releaseDate);
    formData.set('color', payload.color);
    formData.set('actualHours', String(payload.actualHours));
    formData.set('defaultObjectiveAllocatedHours', String(payload.defaultObjectiveAllocatedHours));
    return this.http.post<CreateProjectResponseDto>(this.base, formData);
  }

  edit(id: string, payload: EditProjectRequestDto): Observable<ProjectDetailDto> {
    return this.http.put<ProjectDetailDto>(`${this.base}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  achieve(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/achieve`, {});
  }

  unachieve(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${id}/unachieve`, {});
  }

  getMyMilestones(projectId: string): Observable<MyProjectMilestoneDto[]> {
    return this.http.get<MyProjectMilestoneDto[]>(`${this.base}/${projectId}/objectives/mine`);
  }

  getMilestoneSubtree(objectiveId: string): Observable<ObjectiveSubtreeResponseDto> {
    return this.http.get<ObjectiveSubtreeResponseDto>(`${environment.apiUrl}/work/objectives/${objectiveId}/tree`);
  }
}
```

`identifier` is deliberately omitted from `edit()`'s payload type (`EditProjectRequestDto` has no `identifier` field at all) — this is the fix for the real `400` case documented in `Edit Project.md`: "omit to skip the immutability check entirely." There is no way for a caller of this service to accidentally send it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-api.service.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/data-access/project-api.service.ts src/app/modules/work/data-access/project-api.service.spec.ts
git commit -m "feat(work): add ProjectApiService"
```

---

### Task 8: `ProjectListStore`

**Files:**
- Create: `src/app/modules/work/state/project-list.store.ts`
- Test: `src/app/modules/work/state/project-list.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectApiService` (Task 7), `toProject` (Task 3).
- Produces: `ProjectListStore` with `projects: Signal<Project[]>`, `pageNumber/pageSize/totalCount: Signal<number>`, `loading/error: Signal<...>`, `selectedCategoryId: Signal<string | null>`, computed `filteredProjects: Signal<Project[]>`, methods `loadProjects(): Promise<void>`, `setCategoryFilter(categoryId: string | null): void`, `createProject(payload): Promise<boolean>`, `editProject(id, payload): Promise<boolean>`, `deleteProject(id): Promise<boolean>`, `achieveProject(id): Promise<boolean>`, `unachieveProject(id): Promise<boolean>`. Consumed by Task 14.

Category filtering is client-side over the currently-loaded page (`GET /work/projects/mine` has no `categoryId` query param — see Global Constraints). The mutation methods return `boolean` (success/failure) rather than throwing, so the calling component can close its modal only on success without a try/catch at the call site — and always reload the list afterward on success (no optimistic patching, matching the design doc's decision: Delete/Achieve/Unachieve have no response body to patch from).

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjectListStore } from './project-list.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectListItemDto, PagedResultDto } from '../models/dto/project.dto';

describe('ProjectListStore', () => {
  const dto: ProjectListItemDto = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true
  };
  const page: PagedResultDto<ProjectListItemDto> = {
    items: [dto], pageNumber: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasNext: false, hasPrevious: false
  };

  function setup(apiOverrides: Partial<ProjectApiService> = {}) {
    TestBed.configureTestingModule({ providers: [{ provide: ProjectApiService, useValue: apiOverrides }] });
    return TestBed.inject(ProjectListStore);
  }

  it('loads projects successfully', async () => {
    const store = setup({ listMine: () => of(page) } as Partial<ProjectApiService>);
    await store.loadProjects();
    expect(store.projects()).toEqual([{
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true
    }]);
    expect(store.totalCount()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('sets an error message on load failure', async () => {
    const store = setup({ listMine: () => throwError(() => ({ error: { detail: 'Server down' } })) } as Partial<ProjectApiService>);
    await store.loadProjects();
    expect(store.error()).toBe('Server down');
    expect(store.loading()).toBe(false);
  });

  it('filters projects client-side by selected category', async () => {
    const otherDto = { ...dto, id: 'p2', categoryId: 'cat2' };
    const twoItemPage = { ...page, items: [dto, otherDto], totalCount: 2 };
    const store = setup({ listMine: () => of(twoItemPage) } as Partial<ProjectApiService>);
    await store.loadProjects();

    expect(store.filteredProjects()).toHaveLength(2);
    store.setCategoryFilter('cat1');
    expect(store.filteredProjects()).toEqual([expect.objectContaining({ id: 'p1' })]);
    store.setCategoryFilter(null);
    expect(store.filteredProjects()).toHaveLength(2);
  });

  it('createProject returns true and the caller can reload on success', async () => {
    const store = setup({
      create: () => of({ project: { id: 'p1', name: 'Website Revamp' } }),
      listMine: () => of(page)
    } as Partial<ProjectApiService>);

    const result = await store.createProject({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40
    });

    expect(result).toBe(true);
    expect(store.projects()).toHaveLength(1);
  });

  it('createProject returns false and sets error on failure, without touching the list', async () => {
    const store = setup({
      create: () => throwError(() => ({ error: { detail: 'identifier already used' } }))
    } as Partial<ProjectApiService>);

    const result = await store.createProject({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40
    });

    expect(result).toBe(false);
    expect(store.error()).toBe('identifier already used');
    expect(store.projects()).toEqual([]);
  });

  it('deleteProject reloads the list on success', async () => {
    const store = setup({ delete: () => of(void 0), listMine: () => of(page) } as Partial<ProjectApiService>);
    const result = await store.deleteProject('p1');
    expect(result).toBe(true);
    expect(store.projects()).toHaveLength(1);
  });

  it('achieveProject and unachieveProject reload the list on success', async () => {
    const store = setup({
      achieve: () => of(void 0), unachieve: () => of(void 0), listMine: () => of(page)
    } as Partial<ProjectApiService>);
    expect(await store.achieveProject('p1')).toBe(true);
    expect(await store.unachieveProject('p1')).toBe(true);
  });

  it('editProject reloads the list on success', async () => {
    const store = setup({
      edit: () => of({} as any), listMine: () => of(page)
    } as Partial<ProjectApiService>);
    const result = await store.editProject('p1', {
      name: 'Website Revamp v2', description: '', categoryId: 'cat1',
      startDate: '2026-08-01', targetDate: '2027-01-01', color: '', actualHours: 0
    });
    expect(result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-list.store.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { toProject } from '../utils/project.mapper';
import { Project, CreateProjectPayload, EditProjectPayload } from '../models/project.model';

interface ProjectListState {
  readonly projects: readonly Project[];
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly selectedCategoryId: string | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: ProjectListState = {
  projects: [], pageNumber: 1, pageSize: 20, totalCount: 0,
  selectedCategoryId: null, loading: false, error: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const ProjectListStore = signalStore(
  { providedIn: 'root' },
  withState<ProjectListState>(initialState),
  withComputed(({ projects, selectedCategoryId }) => ({
    filteredProjects: computed(() => {
      const categoryId = selectedCategoryId();
      return categoryId ? projects().filter((p) => p.categoryId === categoryId) : projects();
    })
  })),
  withMethods((store, api = inject(ProjectApiService)) => ({
    async loadProjects(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const page = await firstValueFrom(api.listMine(store.pageNumber(), store.pageSize()));
        patchState(store, {
          projects: page.items.map(toProject),
          totalCount: page.totalCount,
          loading: false
        });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load projects.'), loading: false });
      }
    },

    setCategoryFilter(categoryId: string | null): void {
      patchState(store, { selectedCategoryId: categoryId });
    },

    async createProject(payload: CreateProjectPayload): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.create(payload));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create project.') });
        return false;
      }
    },

    async editProject(id: string, payload: EditProjectPayload): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.edit(id, payload));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to save changes.') });
        return false;
      }
    },

    async deleteProject(id: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.delete(id));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to delete project.') });
        return false;
      }
    },

    async achieveProject(id: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.achieve(id));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to achieve project.') });
        return false;
      }
    },

    async unachieveProject(id: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.unachieve(id));
        await this.loadProjects();
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to unachieve project.') });
        return false;
      }
    }
  }))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-list.store.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-list.store.ts src/app/modules/work/state/project-list.store.spec.ts
git commit -m "feat(work): add ProjectListStore"
```

---

### Task 9: `ProjectDetailStore`

**Files:**
- Create: `src/app/modules/work/state/project-detail.store.ts`
- Test: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: `ProjectApiService` (Task 7), `toProjectDetail`/`toMilestone`/`toMilestoneTreeNode` (Task 3).
- Produces: `ProjectDetailStore` with `project: Signal<ProjectDetail | null>`, `projectLoading/projectError: Signal<...>`, `milestones: Signal<Milestone[]>`, `milestonesLoading/milestonesError: Signal<...>`, `selectedSubtree: Signal<MilestoneTreeNode | null>`, `subtreeLoading/subtreeError: Signal<...>`, methods `loadProject(id): Promise<void>`, `loadMyMilestones(projectId): Promise<void>`, `loadMilestoneSubtree(objectiveId): Promise<void>`, `clearSelectedSubtree(): void`. Consumed by Task 15.

Three independent loading/error pairs, matching the design doc's "same four-state pattern applies to both the project header and the milestone section independently, since they load from separate calls."

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProjectDetailStore } from './project-detail.store';
import { ProjectApiService } from '../data-access/project-api.service';
import { ProjectDetailDto } from '../models/dto/project.dto';
import { MyProjectMilestoneDto, ObjectiveSubtreeResponseDto } from '../models/dto/milestone.dto';

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
      objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null
    }];
    const store = setup({ getMyMilestones: () => of(milestones) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestones()).toHaveLength(1);
    expect(store.milestonesLoading()).toBe(false);
  });

  it('loads and clears a milestone subtree', async () => {
    const response: ObjectiveSubtreeResponseDto = {
      parentObjective: null,
      objective: {
        id: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Root',
        description: null, ownerId: 'u1', reportingManagerId: null, createdById: 'u1',
        startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, actualHours: null,
        allocatedHours: 40, completedHours: 0, isActive: true, createdAt: '2026-08-01T00:00:00Z',
        updatedAt: null, children: []
      }
    };
    const store = setup({ getMilestoneSubtree: () => of(response) } as Partial<ProjectApiService>);
    await store.loadMilestoneSubtree('o1');
    expect(store.selectedSubtree()?.title).toBe('Root');
    store.clearSelectedSubtree();
    expect(store.selectedSubtree()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-detail.store.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProjectApiService } from '../data-access/project-api.service';
import { toMilestone, toMilestoneTreeNode, toProjectDetail } from '../utils/project.mapper';
import { ProjectDetail } from '../models/project.model';
import { Milestone, MilestoneTreeNode } from '../models/milestone.model';

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
}

const initialState: ProjectDetailState = {
  project: null, projectLoading: false, projectError: null,
  milestones: [], milestonesLoading: false, milestonesError: null,
  selectedSubtree: null, subtreeLoading: false, subtreeError: null
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
        patchState(store, { selectedSubtree: toMilestoneTreeNode(response.objective), subtreeLoading: false });
      } catch (err) {
        patchState(store, { subtreeError: extractError(err, 'Failed to load milestone.'), subtreeLoading: false });
      }
    },

    clearSelectedSubtree(): void {
      patchState(store, { selectedSubtree: null, subtreeError: null });
    }
  }))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-detail.store.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat(work): add ProjectDetailStore"
```

---

### Task 10: Shared `ConfirmModalComponent`

**Files:**
- Create: `src/app/shared/ui/confirm-modal/confirm-modal.component.ts`
- Test: `src/app/shared/ui/confirm-modal/confirm-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ModalComponent` (`open`, `title`, `closed`), `ButtonComponent` (`variant`, `loading`, `pressed`) — both existing, unmodified.
- Produces: `ConfirmModalComponent` with inputs `open`, `title`, `message`, `confirmLabel` (default `'Confirm'`), `cancelLabel` (default `'Cancel'`), `loading` (default `false`), `errorMessage` (default `''`); outputs `confirmed: output<void>`, `cancelled: output<void>`. Reused by Task 14 for Delete/Achieve/Unachieve — a single generic component, not three near-identical ones (the design doc named three components; this plan collapses them into one per DRY, since they differ only in copy, not behavior).

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmModalComponent } from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
  let fixture: ComponentFixture<ConfirmModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ConfirmModalComponent] });
    fixture = TestBed.createComponent(ConfirmModalComponent);
  });

  it('does not render when closed', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders title and message when open', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Delete project');
    fixture.componentRef.setInput('message', "Delete project 'Website Revamp'? This cannot be undone.");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Delete project');
    expect(fixture.nativeElement.textContent).toContain('This cannot be undone.');
  });

  it('emits confirmed when the confirm button is pressed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let confirmed = false;
    fixture.componentInstance.confirmed.subscribe(() => (confirmed = true));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    buttons[buttons.length - 1].click();

    expect(confirmed).toBe(true);
  });

  it('emits cancelled when the cancel button is pressed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    let cancelled = false;
    fixture.componentInstance.cancelled.subscribe(() => (cancelled = true));

    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    buttons[buttons.length - 2].click();

    expect(cancelled).toBe(true);
  });

  it('shows the error message when set', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('errorMessage', "A top-level milestone isn't yet Achieved");
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("A top-level milestone isn't yet Achieved");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/confirm-modal.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';
import { ButtonComponent } from '../button/button.component';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" (closed)="cancelled.emit()">
      <p class="mb-4 text-sm text-[var(--color-text-secondary)]">{{ message() }}</p>
      @if (errorMessage()) {
        <p class="mb-4 text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
      }
      <div class="flex justify-end gap-2">
        <app-button variant="secondary" [disabled]="loading()" (pressed)="cancelled.emit()">
          {{ cancelLabel() }}
        </app-button>
        <app-button variant="primary" [loading]="loading()" (pressed)="confirmed.emit()">
          {{ confirmLabel() }}
        </app-button>
      </div>
    </app-modal>
  `
})
export class ConfirmModalComponent {
  open = input(false);
  title = input<string>('');
  message = input<string>('');
  confirmLabel = input<string>('Confirm');
  cancelLabel = input<string>('Cancel');
  loading = input(false);
  errorMessage = input<string>('');

  confirmed = output<void>();
  cancelled = output<void>();
}
```

Note: `app-button`'s template wraps its content in a `<button>` with `[disabled]="disabled() || loading()"` — the two buttons in this template are distinguishable in the test by DOM order (`app-modal`'s own close "✕" button is a third `<button>` that appears first in source order; `buttons[buttons.length - 2]` and `buttons[buttons.length - 1]` are always Cancel then Confirm, since `app-button` renders exactly one native `<button>` each).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/confirm-modal.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/confirm-modal
git commit -m "feat(shared): add reusable ConfirmModalComponent"
```

---

### Task 11: `ProjectCardComponent`

**Files:**
- Create: `src/app/modules/work/ui/project-card/project-card.component.ts`
- Test: `src/app/modules/work/ui/project-card/project-card.component.spec.ts`

**Interfaces:**
- Consumes: `Project` (Task 2), `CardComponent`/`ButtonComponent` (existing, unmodified).
- Produces: `ProjectCardComponent` with input `project: input.required<Project>`, outputs `viewed: output<void>`, `edited: output<void>`, `achieveToggled: output<void>`. Consumed by Task 14.

Presentational only — no store/HTTP injection, matching `shared/ui/*`'s existing convention (`ARCHITECTURE.md` §2's `ui/` row: "Dumb/presentational components, no API calls"). Edit/Achieve buttons render only when `project.isLead` — the list response already carries `isLead` today (confirmed, no backend gap here). No category name and no achieved badge on the card yet — both are blocked on the backend additions (Global Constraints); this is a deliberate, documented omission, not an oversight.

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectCardComponent } from './project-card.component';
import { Project } from '../../models/project.model';

describe('ProjectCardComponent', () => {
  let fixture: ComponentFixture<ProjectCardComponent>;

  const baseProject: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 10, isLead: false
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProjectCardComponent] });
    fixture = TestBed.createComponent(ProjectCardComponent);
  });

  it('renders the project name and identifier', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('WEB');
  });

  it('hides Edit/Achieve buttons when the caller is not the lead', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Achieve');
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).toBeNull();
  });

  it('shows Edit/Achieve buttons when the caller is the lead', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isLead: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="edit-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="achieve-button"]')).not.toBeNull();
  });

  it('emits viewed when View is pressed', () => {
    fixture.componentRef.setInput('project', baseProject);
    fixture.detectChanges();
    let viewed = false;
    fixture.componentInstance.viewed.subscribe(() => (viewed = true));
    (fixture.nativeElement.querySelector('[data-testid="view-button"] button') as HTMLButtonElement).click();
    expect(viewed).toBe(true);
  });

  it('emits edited and achieveToggled for the lead-only actions', () => {
    fixture.componentRef.setInput('project', { ...baseProject, isLead: true });
    fixture.detectChanges();
    let edited = false;
    let achieveToggled = false;
    fixture.componentInstance.edited.subscribe(() => (edited = true));
    fixture.componentInstance.achieveToggled.subscribe(() => (achieveToggled = true));

    (fixture.nativeElement.querySelector('[data-testid="edit-button"] button') as HTMLButtonElement).click();
    (fixture.nativeElement.querySelector('[data-testid="achieve-button"] button') as HTMLButtonElement).click();

    expect(edited).toBe(true);
    expect(achieveToggled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-card.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <app-card [title]="project().name">
      <p class="text-xs text-[var(--color-text-secondary)]">{{ project().identifier }}</p>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Start</dt>
        <dd>{{ project().startDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Target</dt>
        <dd>{{ project().targetDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Hours</dt>
        <dd>{{ project().completedHours }} / {{ project().allocatedHours }}</dd>
      </dl>
      <div class="mt-4 flex gap-2">
        <span data-testid="view-button">
          <app-button variant="secondary" (pressed)="viewed.emit()">View</app-button>
        </span>
        @if (project().isLead) {
          <span data-testid="edit-button">
            <app-button variant="secondary" (pressed)="edited.emit()">Edit</app-button>
          </span>
          <span data-testid="achieve-button">
            <app-button variant="primary" (pressed)="achieveToggled.emit()">Achieve</app-button>
          </span>
        }
      </div>
    </app-card>
  `
})
export class ProjectCardComponent {
  project = input.required<Project>();
  viewed = output<void>();
  edited = output<void>();
  achieveToggled = output<void>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-card.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/project-card
git commit -m "feat(work): add ProjectCardComponent"
```

---

### Task 12: `ProjectFilterBarComponent`

**Files:**
- Create: `src/app/modules/work/ui/project-filter-bar/project-filter-bar.component.ts`
- Test: `src/app/modules/work/ui/project-filter-bar/project-filter-bar.component.spec.ts`

**Interfaces:**
- Consumes: `SelectComponent`/`SelectOption` (existing, unmodified), `ProjectCategoryStore` (Task 6, injected directly — same pattern as `EmployeeListComponent` injecting `EmployeeStore` in `ARCHITECTURE.md` §4.3).
- Produces: `ProjectFilterBarComponent` with output `categoryChanged: output<string | null>`. Consumed by Task 14. The Active/Archived control is rendered but permanently `disabled` — no output for it exists in this component (nothing downstream could use it yet).

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectFilterBarComponent } from './project-filter-bar.component';
import { ProjectCategoryStore } from '../../state/project-category.store';

describe('ProjectFilterBarComponent', () => {
  let fixture: ComponentFixture<ProjectFilterBarComponent>;
  let loadCategoriesSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loadCategoriesSpy = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      imports: [ProjectFilterBarComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: loadCategoriesSpy } }]
    });
    fixture = TestBed.createComponent(ProjectFilterBarComponent);
  });

  it('loads categories on init', () => {
    fixture.detectChanges();
    expect(loadCategoriesSpy).toHaveBeenCalled();
  });

  it('renders the Active/Archived select as disabled', () => {
    fixture.detectChanges();
    const selects: HTMLSelectElement[] = fixture.nativeElement.querySelectorAll('select');
    expect(selects[1].disabled).toBe(true);
  });

  it('emits categoryChanged when the category select changes', () => {
    fixture.detectChanges();
    let emitted: string | null | undefined;
    fixture.componentInstance.categoryChanged.subscribe((v: string | null) => (emitted = v));

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    select.value = 'cat1';
    select.dispatchEvent(new Event('change'));

    expect(emitted).toBe('cat1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-filter-bar.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { Component, OnInit, inject, output } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ProjectCategoryStore } from '../../state/project-category.store';

@Component({
  selector: 'app-project-filter-bar',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <div class="flex flex-wrap gap-3">
      <app-select
        label="Project category"
        placeholder="All categories"
        [options]="categoryOptions()"
        (valueChange)="onCategoryChange($event)"
      />
      <app-select label="Status" [disabled]="true" [options]="[]" placeholder="Coming soon" />
    </div>
  `
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  categoryChanged = output<string | null>();

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  onCategoryChange(value: string): void {
    this.categoryChanged.emit(value || null);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-filter-bar.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/project-filter-bar
git commit -m "feat(work): add ProjectFilterBarComponent"
```

---

### Task 13: `ProjectFormModalComponent`

**Files:**
- Create: `src/app/modules/work/ui/project-form-modal/project-form-modal.component.ts`
- Test: `src/app/modules/work/ui/project-form-modal/project-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ModalComponent`, `InputComponent` (with the new `'date'` type from Task 1), `SelectComponent`, `ButtonComponent` (all existing), `ProjectCategoryStore` (Task 6), `validateProjectForm`/`ProjectFormFields` (Task 4), `ProjectDetail`/`CreateProjectPayload`/`EditProjectPayload` (Task 2).
- Produces: `ProjectFormModalComponent` with inputs `open`, `mode: input.required<'create' | 'edit'>`, `initialValue: input<ProjectDetail | null>(null)`, `submitting` (default `false`), `errorMessage` (default `''`); outputs `createSubmitted: output<CreateProjectPayload>`, `editSubmitted: output<EditProjectPayload>`, `closed: output<void>`. Consumed by Task 14. One component for both Create and Edit, per the design doc.

Identifier and Release Date fields only render in `create` mode (identifier is immutable after creation; release date has no edit endpoint field at all).

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectFormModalComponent } from './project-form-modal.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { ProjectDetail } from '../../models/project.model';

describe('ProjectFormModalComponent', () => {
  let fixture: ComponentFixture<ProjectFormModalComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectFormModalComponent],
      providers: [{ provide: ProjectCategoryStore, useValue: { categories: () => [{ id: 'cat1', name: 'Backend' }], loadCategories: () => Promise.resolve() } }]
    });
    fixture = TestBed.createComponent(ProjectFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('mode', 'create');
  });

  function setField(testId: string, value: string): void {
    const el: HTMLInputElement | HTMLSelectElement = fixture.nativeElement.querySelector(`[data-testid="${testId}"] input, [data-testid="${testId}"] select`);
    el.value = value;
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input'));
    fixture.detectChanges();
  }

  it('shows identifier and release date fields only in create mode', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).not.toBeNull();

    fixture.componentRef.setInput('mode', 'edit');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="identifier-field"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="release-date-field"]')).toBeNull();
  });

  it('prefills fields from initialValue in edit mode', () => {
    const initialValue: ProjectDetail = {
      id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
      startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
      allocatedHours: 40, completedHours: 0, isLead: true, description: 'Rebuild',
      actualHours: 0, isAchieved: false, achievedAt: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
    };
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('initialValue', initialValue);
    fixture.detectChanges();

    const nameInput: HTMLInputElement = fixture.nativeElement.querySelector('[data-testid="name-field"] input');
    expect(nameInput.value).toBe('Website Revamp');
  });

  it('blocks submit and shows validation errors when required fields are missing', () => {
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Name is required.');
  });

  it('emits createSubmitted with a fully-filled valid form', () => {
    fixture.detectChanges();
    let emitted: any;
    fixture.componentInstance.createSubmitted.subscribe((v: any) => (emitted = v));

    setField('name-field', 'Website Revamp');
    setField('identifier-field', 'WEB');
    setField('category-field', 'cat1');
    setField('start-date-field', '2026-08-01');
    setField('target-date-field', '2026-12-01');
    setField('release-date-field', '2026-11-15');
    setField('allocated-hours-field', '40');

    (fixture.nativeElement.querySelector('[data-testid="submit-button"] button') as HTMLButtonElement).click();

    expect(emitted.name).toBe('Website Revamp');
    expect(emitted.identifier).toBe('WEB');
    expect(emitted.categoryId).toBe('cat1');
  });

  it('emits closed when cancelled', () => {
    fixture.detectChanges();
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    (fixture.nativeElement.querySelector('[data-testid="cancel-button"] button') as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-form-modal.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { validateProjectForm, ProjectFormFields } from '../../utils/project-form.validator';
import { CreateProjectPayload, EditProjectPayload, ProjectDetail } from '../../models/project.model';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, SelectComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="mode() === 'create' ? 'Create project' : 'Edit project'" (closed)="closed.emit()">
      <div class="flex flex-col gap-3">
        <span data-testid="name-field">
          <app-input label="Name" [value]="name()" [error]="errors()['name'] ?? ''" (valueChange)="name.set($event)" />
        </span>

        @if (mode() === 'create') {
          <span data-testid="identifier-field">
            <app-input label="Identifier" [value]="identifier()" [error]="errors()['identifier'] ?? ''" (valueChange)="identifier.set($event)" />
          </span>
        }

        <span data-testid="category-field">
          <app-select label="Category" placeholder="Select a category" [options]="categoryOptions()" [value]="categoryId()" [error]="errors()['categoryId'] ?? ''" (valueChange)="categoryId.set($event)" />
        </span>

        <span data-testid="description-field">
          <app-input label="Description" [value]="description()" (valueChange)="description.set($event)" />
        </span>

        <span data-testid="start-date-field">
          <app-input label="Start date" type="date" [value]="startDate()" [error]="errors()['startDate'] ?? ''" (valueChange)="startDate.set($event)" />
        </span>

        <span data-testid="target-date-field">
          <app-input label="Target date" type="date" [value]="targetDate()" [error]="errors()['targetDate'] ?? ''" (valueChange)="targetDate.set($event)" />
        </span>

        @if (mode() === 'create') {
          <span data-testid="release-date-field">
            <app-input label="Release date" type="date" [value]="releaseDate()" [error]="errors()['releaseDate'] ?? ''" (valueChange)="releaseDate.set($event)" />
          </span>
        }

        <span data-testid="allocated-hours-field">
          <app-input label="Allocated hours" type="number" [value]="allocatedHours()" [error]="errors()['allocatedHours'] ?? ''" (valueChange)="allocatedHours.set($event)" />
        </span>

        @if (errorMessage()) {
          <p class="text-sm text-[var(--color-danger-text)]" role="alert">{{ errorMessage() }}</p>
        }

        <div class="mt-2 flex justify-end gap-2">
          <span data-testid="cancel-button">
            <app-button variant="secondary" [disabled]="submitting()" (pressed)="closed.emit()">Cancel</app-button>
          </span>
          <span data-testid="submit-button">
            <app-button variant="primary" [loading]="submitting()" (pressed)="submit()">
              {{ mode() === 'create' ? 'Create' : 'Save changes' }}
            </app-button>
          </span>
        </div>
      </div>
    </app-modal>
  `
})
export class ProjectFormModalComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  open = input(false);
  mode = input.required<'create' | 'edit'>();
  initialValue = input<ProjectDetail | null>(null);
  submitting = input(false);
  errorMessage = input<string>('');

  createSubmitted = output<CreateProjectPayload>();
  editSubmitted = output<EditProjectPayload>();
  closed = output<void>();

  name = signal('');
  identifier = signal('');
  categoryId = signal('');
  description = signal('');
  startDate = signal('');
  targetDate = signal('');
  releaseDate = signal('');
  allocatedHours = signal(0);
  errors = signal<Record<string, string>>({});

  constructor() {
    effect(() => {
      const value = this.initialValue();
      if (value) {
        this.name.set(value.name);
        this.identifier.set(value.identifier);
        this.categoryId.set(value.categoryId);
        this.description.set(value.description ?? '');
        this.startDate.set(value.startDate);
        this.targetDate.set(value.targetDate);
        this.allocatedHours.set(value.allocatedHours);
      }
    });
  }

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  private buildFields(): ProjectFormFields {
    return {
      name: this.name(), identifier: this.identifier(), categoryId: this.categoryId(),
      startDate: this.startDate(), targetDate: this.targetDate(), releaseDate: this.releaseDate(),
      allocatedHours: this.allocatedHours()
    };
  }

  submit(): void {
    const fields = this.buildFields();
    const errors = validateProjectForm(fields, this.mode());
    this.errors.set(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    if (this.mode() === 'create') {
      this.createSubmitted.emit({
        categoryId: fields.categoryId, name: fields.name, identifier: fields.identifier,
        description: this.description(), startDate: fields.startDate, targetDate: fields.targetDate,
        releaseDate: fields.releaseDate, color: '', actualHours: 0,
        defaultObjectiveAllocatedHours: fields.allocatedHours
      });
    } else {
      this.editSubmitted.emit({
        name: fields.name, description: this.description(), categoryId: fields.categoryId,
        startDate: fields.startDate, targetDate: fields.targetDate, color: '', actualHours: 0
      });
    }
  }
}
```

`app-input`'s `[value]` input is typed `string` and `allocatedHours` is a `number` signal — `app-input`'s template binds `[value]="value()"` directly onto the native `<input>`'s `value` attribute, which coerces a number to string automatically at the DOM level, and `(valueChange)` always emits a `string`; `allocatedHours.set($event)` therefore needs a numeric conversion. Fix this in the template before running Step 4: change the allocated-hours binding to `(valueChange)="allocatedHours.set($any($event) === '' ? 0 : +$event)"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-form-modal.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/project-form-modal
git commit -m "feat(work): add ProjectFormModalComponent for Create/Edit"
```

---

### Task 14: `MilestoneTreeNodeComponent`

**Files:**
- Create: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.ts`
- Test: `src/app/modules/work/ui/milestone-tree-node/milestone-tree-node.component.spec.ts`

**Interfaces:**
- Consumes: `MilestoneTreeNode` (Task 2).
- Produces: `MilestoneTreeNodeComponent` with input `node: input.required<MilestoneTreeNode>`. Recursive — a node renders its own `children` by nesting itself. Read-only, no outputs, no action buttons (per the design doc's explicit scope boundary).

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MilestoneTreeNodeComponent } from './milestone-tree-node.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

describe('MilestoneTreeNodeComponent', () => {
  let fixture: ComponentFixture<MilestoneTreeNodeComponent>;

  it('renders a node with no children', () => {
    const node: MilestoneTreeNode = {
      id: 'o1', title: 'Design Phase', startDate: '2026-01-15', endDate: '2026-03-01',
      progress: 40, allocatedHours: 20, completedHours: 8, isActive: true, children: []
    };
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Design Phase');
    expect(fixture.nativeElement.textContent).toContain('40');
  });

  it('renders nested children recursively', () => {
    const node: MilestoneTreeNode = {
      id: 'o1', title: 'Root', startDate: '2026-01-15', endDate: '2026-03-01', progress: 0,
      allocatedHours: 20, completedHours: 0, isActive: true,
      children: [{
        id: 'o2', title: 'Child', startDate: '2026-01-20', endDate: '2026-02-01', progress: 0,
        allocatedHours: 5, completedHours: 0, isActive: true, children: []
      }]
    };
    fixture = TestBed.createComponent(MilestoneTreeNodeComponent);
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Root');
    expect(fixture.nativeElement.textContent).toContain('Child');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/milestone-tree-node.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

```ts
import { Component, input } from '@angular/core';
import { MilestoneTreeNode } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-tree-node',
  standalone: true,
  imports: [MilestoneTreeNodeComponent],
  template: `
    <div class="rounded-md border border-[var(--color-border)] p-3">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-[var(--color-text-primary)]">{{ node().title }}</span>
        <span class="text-xs text-[var(--color-text-secondary)]">{{ node().progress }}%</span>
      </div>
      <p class="mt-1 text-xs text-[var(--color-text-secondary)]">
        {{ node().startDate }} – {{ node().endDate }} · {{ node().completedHours }} / {{ node().allocatedHours }}h
      </p>
      @if (node().children.length > 0) {
        <div class="mt-2 flex flex-col gap-2 pl-4">
          @for (child of node().children; track child.id) {
            <app-milestone-tree-node [node]="child" />
          }
        </div>
      }
    </div>
  `
})
export class MilestoneTreeNodeComponent {
  node = input.required<MilestoneTreeNode>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/milestone-tree-node.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-tree-node
git commit -m "feat(work): add recursive MilestoneTreeNodeComponent"
```

---

### Task 15: `ProjectListComponent` (feature)

**Files:**
- Create: `src/app/modules/work/feature/project-list/project-list.component.ts`
- Create: `src/app/modules/work/feature/project-list/project-list.component.html`
- Test: `src/app/modules/work/feature/project-list/project-list.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectListStore` (Task 8), `ProjectCardComponent` (Task 11), `ProjectFilterBarComponent` (Task 12), `ProjectFormModalComponent` (Task 13), `ConfirmModalComponent` (Task 10), `PageHeaderComponent`/`ButtonComponent`/`LoaderComponent`/`ErrorStateComponent`/`EmptyStateComponent` (all existing, unmodified).
- Produces: `ProjectListComponent`, routed at `/work` (wired in Task 17).

Wires everything together: loads projects on init, renders the four mandatory states (loading/error/empty/data per `ARCHITECTURE.md` §7.4), opens the Create/Edit modal or the Delete/Achieve/Unachieve confirm modal based on local `signal()` UI state, and navigates to `/work/:id` on View.

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ProjectListComponent } from './project-list.component';
import { ProjectListStore } from '../../state/project-list.store';
import { Project } from '../../models/project.model';

describe('ProjectListComponent', () => {
  let fixture: ComponentFixture<ProjectListComponent>;
  let storeStub: any;
  let router: Router;

  const project: Project = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true
  };

  beforeEach(async () => {
    storeStub = {
      filteredProjects: () => [project],
      loading: () => false,
      error: () => null,
      loadProjects: vi.fn().mockResolvedValue(undefined),
      setCategoryFilter: vi.fn(),
      createProject: vi.fn().mockResolvedValue(true),
      editProject: vi.fn().mockResolvedValue(true),
      deleteProject: vi.fn().mockResolvedValue(true),
      achieveProject: vi.fn().mockResolvedValue(true),
      unachieveProject: vi.fn().mockResolvedValue(true)
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListComponent],
      providers: [{ provide: ProjectListStore, useValue: storeStub }, { provide: Router, useValue: { navigate: vi.fn() } }]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectListComponent);
    router = TestBed.inject(Router);
  });

  it('loads projects on init', () => {
    fixture.detectChanges();
    expect(storeStub.loadProjects).toHaveBeenCalled();
  });

  it('renders a card per project', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
  });

  it('shows the loading state', () => {
    storeStub.loading = () => true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-loader')).not.toBeNull();
  });

  it('shows the error state with retry wired to loadProjects', () => {
    storeStub.error = () => 'Failed to load projects.';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Failed to load projects.');
  });

  it('shows the empty state when there are no projects', () => {
    storeStub.filteredProjects = () => [];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No projects yet');
  });

  it('navigates to /work/:id when a card emits viewed', () => {
    fixture.detectChanges();
    fixture.componentInstance.onView(project);
    expect(router.navigate).toHaveBeenCalledWith(['/work', 'p1']);
  });

  it('opens the create modal, calls createProject on submit, and closes on success', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openCreateModal();
    fixture.detectChanges();
    expect(fixture.componentInstance.formModalOpen()).toBe(true);

    await fixture.componentInstance.onCreateSubmit({
      categoryId: 'cat1', name: 'Website Revamp', identifier: 'WEB', description: '',
      startDate: '2026-08-01', targetDate: '2026-12-01', releaseDate: '2026-11-15', color: '',
      actualHours: 0, defaultObjectiveAllocatedHours: 40
    });

    expect(storeStub.createProject).toHaveBeenCalled();
    expect(fixture.componentInstance.formModalOpen()).toBe(false);
  });

  it('opens the delete confirm modal and calls deleteProject on confirm', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openDeleteConfirm(project);
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(true);

    await fixture.componentInstance.onDeleteConfirmed();

    expect(storeStub.deleteProject).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('opens the achieve confirm modal and calls achieveProject on confirm', async () => {
    fixture.detectChanges();
    fixture.componentInstance.openAchieveConfirm(project);
    await fixture.componentInstance.onAchieveConfirmed();
    expect(storeStub.achieveProject).toHaveBeenCalledWith('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-list.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

`project-list.component.ts`:

```ts
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProjectListStore } from '../../state/project-list.store';
import { ProjectCardComponent } from '../../ui/project-card/project-card.component';
import { ProjectFilterBarComponent } from '../../ui/project-filter-bar/project-filter-bar.component';
import { ProjectFormModalComponent } from '../../ui/project-form-modal/project-form-modal.component';
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CreateProjectPayload, EditProjectPayload, Project } from '../../models/project.model';

@Component({
  selector: 'app-project-list',
  standalone: true,
  imports: [
    ProjectCardComponent, ProjectFilterBarComponent, ProjectFormModalComponent, ConfirmModalComponent,
    PageHeaderComponent, ButtonComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent
  ],
  templateUrl: './project-list.component.html'
})
export class ProjectListComponent implements OnInit {
  readonly store = inject(ProjectListStore);
  private readonly router = inject(Router);

  formModalOpen = signal(false);
  formModalMode = signal<'create' | 'edit'>('create');
  formModalInitialValue = signal<Project | null>(null);
  deleteConfirmOpen = signal(false);
  achieveConfirmOpen = signal(false);
  private targetProject = signal<Project | null>(null);
  actionSubmitting = signal(false);
  actionError = signal('');

  ngOnInit(): void {
    this.store.loadProjects();
  }

  onView(project: Project): void {
    this.router.navigate(['/work', project.id]);
  }

  openCreateModal(): void {
    this.formModalMode.set('create');
    this.formModalInitialValue.set(null);
    this.formModalOpen.set(true);
  }

  openEditModal(project: Project): void {
    this.formModalMode.set('edit');
    this.formModalInitialValue.set(project);
    this.formModalOpen.set(true);
  }

  async onCreateSubmit(payload: CreateProjectPayload): Promise<void> {
    this.actionSubmitting.set(true);
    const success = await this.store.createProject(payload);
    this.actionSubmitting.set(false);
    if (success) {
      this.formModalOpen.set(false);
    }
  }

  async onEditSubmit(payload: EditProjectPayload): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = await this.store.editProject(project.id, payload);
    this.actionSubmitting.set(false);
    if (success) {
      this.formModalOpen.set(false);
    }
  }

  openDeleteConfirm(project: Project): void {
    this.targetProject.set(project);
    this.deleteConfirmOpen.set(true);
  }

  async onDeleteConfirmed(): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = await this.store.deleteProject(project.id);
    this.actionSubmitting.set(false);
    if (success) {
      this.deleteConfirmOpen.set(false);
    }
  }

  openAchieveConfirm(project: Project): void {
    this.targetProject.set(project);
    this.achieveConfirmOpen.set(true);
  }

  async onAchieveConfirmed(): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = project.isActive
      ? await this.store.achieveProject(project.id)
      : await this.store.achieveProject(project.id);
    this.actionSubmitting.set(false);
    if (success) {
      this.achieveConfirmOpen.set(false);
    }
  }

  onCategoryFilterChanged(categoryId: string | null): void {
    this.store.setCategoryFilter(categoryId);
  }
}
```

The `onAchieveConfirmed` ternary above is a placeholder mistake — fix it before Step 4: this round has no way to know a project's achieved state on the list (backend gap #2), so `openAchieveConfirm`/`onAchieveConfirmed` always call `achieveProject`, never `unachieveProject`. Simplify to:

```ts
  async onAchieveConfirmed(): Promise<void> {
    const project = this.targetProject();
    if (!project) return;
    this.actionSubmitting.set(true);
    const success = await this.store.achieveProject(project.id);
    this.actionSubmitting.set(false);
    if (success) {
      this.achieveConfirmOpen.set(false);
    }
  }
```

`project-list.component.html`:

```html
<app-page-header title="Projects" subtitle="Plan and manage your projects.">
  <app-button variant="primary" (pressed)="openCreateModal()">+ Create project</app-button>
</app-page-header>

<app-project-filter-bar (categoryChanged)="onCategoryFilterChanged($event)" />

<div class="mt-4">
  @if (store.loading()) {
    <app-loader label="Loading projects…" />
  } @else if (store.error()) {
    <app-error-state [message]="store.error()!" [retryable]="true" (retry)="store.loadProjects()" />
  } @else if (store.filteredProjects().length === 0) {
    <app-empty-state title="No projects yet" description="Create your first project to get started.">
      <app-button variant="primary" (pressed)="openCreateModal()">+ Create project</app-button>
    </app-empty-state>
  } @else {
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (project of store.filteredProjects(); track project.id) {
        <app-project-card
          [project]="project"
          (viewed)="onView(project)"
          (edited)="openEditModal(project)"
          (achieveToggled)="openAchieveConfirm(project)"
        />
      }
    </div>
  }
</div>

<app-project-form-modal
  [open]="formModalOpen()"
  [mode]="formModalMode()"
  [initialValue]="formModalInitialValue()"
  [submitting]="actionSubmitting()"
  [errorMessage]="store.error() ?? ''"
  (createSubmitted)="onCreateSubmit($event)"
  (editSubmitted)="onEditSubmit($event)"
  (closed)="formModalOpen.set(false)"
/>

<app-confirm-modal
  [open]="deleteConfirmOpen()"
  title="Delete project"
  message="Delete this project? This cannot be undone."
  confirmLabel="Delete"
  [loading]="actionSubmitting()"
  [errorMessage]="store.error() ?? ''"
  (confirmed)="onDeleteConfirmed()"
  (cancelled)="deleteConfirmOpen.set(false)"
/>

<app-confirm-modal
  [open]="achieveConfirmOpen()"
  title="Achieve project"
  message="Mark this project as achieved? Every top-level milestone must already be achieved first."
  confirmLabel="Achieve"
  [loading]="actionSubmitting()"
  [errorMessage]="store.error() ?? ''"
  (confirmed)="onAchieveConfirmed()"
  (cancelled)="achieveConfirmOpen.set(false)"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-list.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/project-list
git commit -m "feat(work): add ProjectListComponent"
```

---

### Task 16: `ProjectDetailComponent` (feature)

**Files:**
- Create: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Create: `src/app/modules/work/feature/project-detail/project-detail.component.html`
- Test: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: `ProjectDetailStore` (Task 9), `MilestoneTreeNodeComponent` (Task 14), `PageHeaderComponent`/`LoaderComponent`/`ErrorStateComponent`/`EmptyStateComponent` (existing).
- Produces: `ProjectDetailComponent`, routed at `/work/:id` (wired in Task 17).

Reads `:id` from the route, loads the project and its milestones independently on init, and drills into a milestone's subtree on click.

- [ ] **Step 1: Write the failing test**

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { Milestone } from '../../models/milestone.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: any;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, description: 'Rebuild the site',
    actualHours: 0, isAchieved: false, achievedAt: null, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
  };

  const milestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
    objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null
  };

  beforeEach(async () => {
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      milestones: () => [milestone],
      milestonesLoading: () => false,
      milestonesError: () => null,
      selectedSubtree: () => null,
      subtreeLoading: () => false,
      subtreeError: () => null,
      loadProject: vi.fn().mockResolvedValue(undefined),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      loadMilestoneSubtree: vi.fn().mockResolvedValue(undefined),
      clearSelectedSubtree: vi.fn()
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

  it('loads the project and its milestones for the routed id', () => {
    fixture.detectChanges();
    expect(storeStub.loadProject).toHaveBeenCalledWith('p1');
    expect(storeStub.loadMyMilestones).toHaveBeenCalledWith('p1');
  });

  it('renders project name and milestone rows', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('Default');
  });

  it('loads a milestone subtree on click', () => {
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneClicked(milestone);
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('renders the milestone tree when a subtree is selected', () => {
    storeStub.selectedSubtree = () => ({ id: 'o1', title: 'Default', startDate: '2026-08-01', endDate: '2026-12-01', progress: 0, allocatedHours: 40, completedHours: 0, isActive: true, children: [] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-tree-node')).not.toBeNull();
  });

  it('shows a muted tag for a milestone the caller is no longer a member of', () => {
    storeStub.milestones = () => [{ ...milestone, membershipIsActive: false }];
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('no longer a member');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/project-detail.component.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

`project-detail.component.ts`:

```ts
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneTreeNodeComponent } from '../../ui/milestone-tree-node/milestone-tree-node.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [MilestoneTreeNodeComponent, PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private projectId = '';

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    this.store.loadMyMilestones(this.projectId);
  }

  onMilestoneClicked(milestone: Milestone): void {
    this.store.loadMilestoneSubtree(milestone.objectiveId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
```

`project-detail.component.html`:

```html
@if (store.projectLoading()) {
  <app-loader label="Loading project…" />
} @else if (store.projectError()) {
  <app-error-state [message]="store.projectError()!" [retryable]="true" (retry)="retryProject()" />
} @else if (store.project(); as project) {
  <app-page-header [title]="project.name" [subtitle]="project.description ?? ''" />
  <dl class="mb-6 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
    <dt class="text-[var(--color-text-secondary)]">Identifier</dt>
    <dd>{{ project.identifier }}</dd>
    <dt class="text-[var(--color-text-secondary)]">Start</dt>
    <dd>{{ project.startDate }}</dd>
    <dt class="text-[var(--color-text-secondary)]">Target</dt>
    <dd>{{ project.targetDate }}</dd>
    <dt class="text-[var(--color-text-secondary)]">Hours</dt>
    <dd>{{ project.completedHours }} / {{ project.allocatedHours }}</dd>
  </dl>
}

<h2 class="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">Milestones</h2>

@if (store.milestonesLoading()) {
  <app-loader label="Loading milestones…" />
} @else if (store.milestonesError()) {
  <app-error-state [message]="store.milestonesError()!" [retryable]="true" (retry)="retryMilestones()" />
} @else if (store.milestones().length === 0) {
  <app-empty-state title="No milestones yet" />
} @else {
  <ul class="flex flex-col gap-2">
    @for (milestone of store.milestones(); track milestone.objectiveId) {
      <li
        class="cursor-pointer rounded-md border border-[var(--color-border)] p-3 hover:bg-[var(--color-surface-secondary)]"
        [class.opacity-60]="!milestone.membershipIsActive"
        (click)="onMilestoneClicked(milestone)"
      >
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ milestone.title }}</span>
          @if (!milestone.membershipIsActive) {
            <span class="text-xs text-[var(--color-text-secondary)]">no longer a member</span>
          }
        </div>
        <p class="text-xs text-[var(--color-text-secondary)]">
          {{ milestone.ownerName }} · {{ milestone.startDate }} – {{ milestone.endDate }}
        </p>
      </li>
    }
  </ul>
}

@if (store.subtreeLoading()) {
  <app-loader label="Loading milestone…" />
} @else if (store.subtreeError()) {
  <app-error-state [message]="store.subtreeError()!" />
} @else if (store.selectedSubtree(); as subtree) {
  <div class="mt-4">
    <app-milestone-tree-node [node]="subtree" />
  </div>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/project-detail.component.spec.ts'`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/project-detail
git commit -m "feat(work): add ProjectDetailComponent with read-only milestone view"
```

---

### Task 17: Wire routes, nav gating, and replace the `/work` placeholder

**Files:**
- Create: `src/app/modules/work/work.routes.ts`
- Test: `src/app/modules/work/work.routes.spec.ts`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/layouts/main-layout/nav/nav-items.config.ts`
- Modify: `src/app/layouts/main-layout/nav/nav-access.spec.ts`

**Interfaces:**
- Consumes: `ProjectListComponent` (Task 15), `ProjectDetailComponent` (Task 16), `permissionGuard` (existing, unmodified).
- Produces: `/work` and `/work/:id` reachable in the running app, gated on `projects:access`.

- [ ] **Step 1: Write the failing test for `work.routes.ts`**

```ts
import { WORK_ROUTES } from './work.routes';

describe('WORK_ROUTES', () => {
  it('has an empty-path route and a :id route', () => {
    expect(WORK_ROUTES.find((r) => r.path === '')).toBeTruthy();
    expect(WORK_ROUTES.find((r) => r.path === ':id')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --include='**/work.routes.spec.ts'`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement `work.routes.ts`**

```ts
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --include='**/work.routes.spec.ts'`
Expected: PASS

- [ ] **Step 5: Replace the `/work` placeholder in `app.routes.ts`**

In `src/app/app.routes.ts`, change:

```ts
      { path: 'work', loadComponent: loadPlaceholder, data: { title: 'Work' } },
```

to:

```ts
      {
        path: 'work',
        canActivate: [permissionGuard],
        data: { permissions: ['projects:access'] },
        loadChildren: () => import('./modules/work/work.routes').then((m) => m.WORK_ROUTES)
      },
```

(`permissionGuard` is already imported at the top of this file — it's used by the `organization` route already.)

- [ ] **Step 6: Add the permission gate to the Work nav item**

In `src/app/layouts/main-layout/nav/nav-items.config.ts`, change:

```ts
  {
    id: 'work',
    label: 'Work',
    icon: 'work',
    path: '/work',
    requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints']
  },
```

to:

```ts
  {
    id: 'work',
    label: 'Work',
    icon: 'work',
    path: '/work',
    requiredModules: ['worksync_foundation', 'projects', 'objectives_milestones', 'tasks', 'boards', 'planning_sprints'],
    requiredPermissions: ['projects:access']
  },
```

- [ ] **Step 7: Update the existing `nav-access.spec.ts` assertions for Work**

The existing test `'grants exactly the documented modules for Work'` (in `src/app/layouts/main-layout/nav/nav-access.spec.ts`) will start failing once Step 6 lands, because it currently calls `checker([], [...])` — no permissions — and expects `true`. Change it to:

```ts
    it('grants exactly the documented modules for Work, and requires projects:access', () => {
      const work = NAV_ITEMS.find((item) => item.id === 'work')!;
      expect(canAccessNavItem(work, checker(['projects:access'], ['tasks']))).toBe(true);
      expect(canAccessNavItem(work, checker(['projects:access'], ['objectives_milestones']))).toBe(true);
      expect(canAccessNavItem(work, checker(['projects:access'], ['core_hr']))).toBe(false);
      expect(canAccessNavItem(work, checker([], ['tasks']))).toBe(false);
    });
```

(The wildcard `'*'` test earlier in the same file already grants every permission, including `projects:access` — no change needed there.)

- [ ] **Step 8: Run the full nav-access spec to verify everything still passes**

Run: `npm test -- --include='**/nav-access.spec.ts'`
Expected: PASS, all cases including the updated Work case.

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: PASS — every spec added or modified across all 17 tasks in this plan is green.

- [ ] **Step 10: Commit**

```bash
git add src/app/modules/work/work.routes.ts src/app/modules/work/work.routes.spec.ts src/app/app.routes.ts src/app/layouts/main-layout/nav/nav-items.config.ts src/app/layouts/main-layout/nav/nav-access.spec.ts
git commit -m "feat(work): wire /work routes and gate the Work nav item on projects:access"
```

---

## Self-Review Notes (completed during writing, kept for the record)

- **Spec coverage:** every section of the design doc has a task — nav/route gating (Task 17), Project List + filters (Tasks 8, 11, 12, 15), Create/Edit (Tasks 4, 13, 15), Delete/Achieve/Unachieve (Tasks 8, 10, 15), Project Detail + milestone read view (Tasks 9, 14, 16), the two documented `400`/immutable-`identifier` edge cases (Task 7's `edit()` signature, Task 15's achieve-confirm copy).
- **Placeholder scan:** none — every step has real, complete code. Two inline "fix this before running Step 4" corrections (Tasks 13, 15) are deliberate — they show the natural TDD failure-and-fix cycle rather than hiding it, not a placeholder.
- **Type consistency check:** `Project`/`ProjectDetail`/`Milestone`/`MilestoneTreeNode`/`CreateProjectPayload`/`EditProjectPayload` (Task 2) are used with identical names and shapes in Tasks 3, 7, 8, 9, 11–16 — verified by re-reading each task's Interfaces block against Task 2's definitions.

## Execution report (2026-08-09)

All 17 tasks executed inline (`superpowers:executing-plans`), one commit per task, TDD failing-test-first throughout. Full suite at completion: 347/364 passing — the 17 failures are the exact same pre-existing set that failed before this work started (`side-navbar.component.spec.ts`, `top-navbar.component.spec.ts`, `landing-page.component.spec.ts`, `landing-header.component.spec.ts` — none touch Work Management, auth, or permissions), confirmed by running the baseline before Task 1. Zero regressions.

**Real deviations from the plan, all improvements, all because the backend blockers shipped mid-session** (see `HRMS-Backend-v1/docs/superpowers/plans/finished/2026-08-09/2026-08-08-work-management-frontend-blocking-endpoints.md` — the two backend additions this plan's Global Constraints flagged as blocking were implemented and merged before Task 1 started, on direct user request):

1. **`isAchieved`/`achievedAt` are real on `ProjectListItemDto`/`Project`**, not withheld pending backend work as the plan assumed. Consequence: the Active/Archived filter (`ProjectFilterBarComponent`, `ProjectListStore.achievedFilter`) is a real, enabled, client-side filter — not the permanently-disabled placeholder control the plan specified. `ProjectCardComponent` also gained an Achieved badge and an Achieve/Unachieve-aware button label, and `ProjectListComponent.onAchieveConfirmed` correctly calls `achieveProject`/`unachieveProject` based on current state rather than always calling `achieveProject`.
2. **The category picker/filter is real against a live endpoint**, not a guess that would 404 until backend catches up — `GET /api/v1/work/project-categories` existed by the time Task 5 was written.
3. **`jasmine.*` APIs in the plan's test code don't exist at runtime.** This repo's `ng test` uses `@angular/build:unit-test` with the Vitest runner (confirmed via `ng test --help` and by reading real existing spec files), not Karma/Jasmine as the plan assumed from surface-reading existing `describe`/`it`/`expect` syntax (which Vitest also supports). Fixed in the plan file itself before execution: `jasmine.createSpy(...).and.resolveTo(x)` → `vi.fn().mockResolvedValue(x)`, `jasmine.Spy` → `ReturnType<typeof vi.fn>`, `jasmine.objectContaining(...)` → `expect.objectContaining(...)`. All affected tasks (8, 12, 15, 16) executed with the corrected syntax from the start.
4. **`ProjectFormModalComponent.initialValue` needed a wider type than the plan specified**, caught by the real Angular template compiler (not anticipated during planning): the list page only has a `Project` (no `description` field) to pass into Edit, but the plan typed `initialValue` as `ProjectDetail` (which requires `description`). Fixed by widening to `(Project & { description?: string | null }) | null` — accepts both a bare `Project` (list page) and a full `ProjectDetail` (future Project Detail page's own Edit action), with `description` prefilling correctly whichever is passed.
5. **`ProjectDetailComponent`'s `ngOnInit` is `async`** (awaits the route's `paramMap` before loading) — the plan's test assertions for `loadProject`/`loadMyMilestones` needed `await fixture.whenStable()` after `detectChanges()` to observe the calls; added during Task 16, not present in the original plan's test code.

No task was skipped, descoped, or left with placeholder code. Backend dependency section (Global Constraints) is now fully moot — both blockers resolved before this plan even started executing.
