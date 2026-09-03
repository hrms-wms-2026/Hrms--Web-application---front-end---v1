# Part 2: Task Category tab + simplified category editor

**Read first:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-21-work-management-project-scoped-task-status-and-category-design.md`
§4 and §6, and Part 1 in this same folder (`ProjectSettingsComponent`'s tab switcher, which this Part
plugs into — Part 1 must ship first). **Hard prerequisite:** the backend repo's companion plan Part 4
(`part-4-task-category-crud-and-docs.md`) must ship first — this Part calls those 5 new endpoints.

**Scope guard:** Work Management module only: `src/app/modules/work/**`.

## Goal

Add the second tab to `ProjectSettingsComponent` from Part 1: Task Category. Same drag-reorder-list
interaction as `BoardStructureEditorComponent`, but simpler data — a category row is just a name and a
display order, no `visibility`/`marksTaskComplete` toggles to render.

## Current state

No `TaskCategory` concept exists anywhere in the frontend yet — confirmed by an earlier repo-wide search
during this session's brainstorm (`grep -ri "task.?categor" src/app/modules/work` returned nothing). This
Part is pure net-new code, not a rename/rework like Part 1.

## Files to create

- `src/app/modules/work/models/dto/task-category.dto.ts` — `TaskCategoryDto`,
  `CreateTaskCategoryRequestDto`, `EditTaskCategoryRequestDto`, matching the backend's
  `TaskCategoryResponse(Guid Id, string Name, int DisplayOrder)` shape from the backend companion Part 4.
- `src/app/modules/work/models/task-category.model.ts` — a `TaskCategoryColumn` view model
  (`{ id: string; name: string; displayOrder: number }`), same naming convention as `TaskStatusColumn`
  in `task.model.ts` — read that file first and mirror its exact shape/field-naming style.
- `src/app/modules/work/utils/task-category.mapper.ts` — `toTaskCategoryColumn(dto): TaskCategoryColumn`,
  mirroring `toTaskStatusColumn` in `task.mapper.ts`.
- `src/app/modules/work/ui/category-list-editor/category-list-editor.component.ts` (+ `.spec.ts`) —
  the drag-reorder editor itself. Copy `BoardStructureEditorComponent`'s structure (same
  `CdkDropList`/`CdkDrag`/`CdkDragHandle` drag-reorder mechanics, same modal-based add/rename/delete
  flow) but drop the `visibility` toggle and `marksTaskComplete` radio entirely — a `DraftRow` here is
  just `{ id: string; name: string }`.
- `src/app/modules/work/feature/project-settings/task-category-settings-tab.component.ts` (+ `.spec.ts`)
  — thin wrapper, same shape as `TaskStatusSettingsTabComponent` from Part 1 (reads `projectId` as an
  `input.required<string>()`, calls the new API methods, renders `<app-category-list-editor>`).

## Files to modify

- `src/app/modules/work/data-access/task-api.service.ts` — add:
  ```typescript
  getCategories(projectId: string): Observable<TaskCategoryDto[]> {
    return this.http.get<TaskCategoryDto[]>(`${this.baseUrl}/projects/${projectId}/task-categories`);
  }

  createCategory(projectId: string, request: CreateTaskCategoryRequestDto): Observable<TaskCategoryDto> {
    return this.http.post<TaskCategoryDto>(`${this.baseUrl}/projects/${projectId}/task-categories`, request);
  }

  editCategory(id: string, request: EditTaskCategoryRequestDto): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/task-categories/${id}`, request);
  }

  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/task-categories/${id}`);
  }

  reorderTaskCategories(projectId: string, updates: { categoryId: string; displayOrder: number }[]): Observable<TaskCategoryDto[]> {
    return this.http.post<TaskCategoryDto[]>(`${this.baseUrl}/projects/${projectId}/task-categories/reorder`, { updates });
  }
  ```
  Re-verify these exact route paths/method verbs against the backend companion Part 4's actual shipped
  routes before wiring — this Part's routes above assume Part 4's controller mirrors Task Status's
  route shape exactly; confirm rather than assume if Part 4 landed with a different shape.
- `src/app/modules/work/feature/project-settings/project-settings.component.ts` (from Part 1) — wire the
  second tab to render `<app-task-category-settings-tab [projectId]="projectId()" />` when active.
- Any place that currently renders a task's category — after the backend companion Part 3 replaces
  `TaskType` with `CategoryId`, task cards/table rows/detail modals that showed a `taskType` badge need
  to resolve and show the category name instead. Grep `grep -rn "taskType\|TaskType" src/app/modules/work/`
  once the backend Part 3 has actually shipped (not before — the frontend DTOs still legitimately use
  `taskType` until then) and update each match found — not enumerated exhaustively here since it depends
  on backend Part 3's final response shape (in particular whether `WorkTaskDto` gains a `categoryName`
  field or only a raw `categoryId`, per that Part's Task 4 note about display-name lookups).

## Task 1: DTOs, model, mapper

Straightforward, mirrors Task Status's existing three files exactly (read `task.dto.ts`'s
`TaskStatusDto` shape, `task.model.ts`'s `TaskStatusColumn`, `task.mapper.ts`'s `toTaskStatusColumn`
before writing these, to match field naming/casing conventions precisely, not just structurally).

## Task 2: `CategoryListEditorComponent`

Copy-and-simplify `BoardStructureEditorComponent` per "Files to create" above. Test: add/rename/delete/
reorder all work against a mocked `TaskApiService`, matching `board-structure-editor.component.spec.ts`'s
existing test shape for the equivalent Status operations.

## Task 3: `TaskApiService` additions

Add the 5 methods. Test: one HTTP-mock test per method (URL + verb + body shape), matching
`task-api.service.spec.ts`'s existing style for the Status methods.

## Task 4: `TaskCategorySettingsTabComponent` + wire into `ProjectSettingsComponent`

Thin wrapper component, plus the tab-switcher wiring in `ProjectSettingsComponent` from Part 1.

## Task 5: Full regression pass

`npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` green.

## Definition of done

- Tasks 1-4 each committed individually.
- Task 5's full `work` module suite is green.
- Manually verify in a browser (once all backend companion Parts are live) that the Task Category tab
  loads, and create/edit/reorder/delete all work end-to-end against the live backend, and that a task's
  category now displays correctly wherever it used to show the old `taskType` badge.
