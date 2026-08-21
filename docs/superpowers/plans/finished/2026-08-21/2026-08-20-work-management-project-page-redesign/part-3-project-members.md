# Part 3: Add project member API + members popup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. One commit per numbered task. Depends on Parts 1–2.

**Goal:** Wire `POST /api/v1/work/projects/{id}/members` into the explanation-card Member popup and into wizard confirm (staged employees).

**Spec:** `docs/superpowers/specs/next/2026-08-20-work-management-project-page-redesign-design.md`

**Status:** done

## Global Constraints

Same as Part 1. Reuse `AddObjectiveMemberOutcomeDto`. Do not change `ObjectiveMemberApiService` or `AddObjectiveMember` UI.

## Tasks

### Task 1: `ProjectApiService.addMember`

**Files:** `project-api.service.ts` + `.spec.ts`

- [x] `addMember(projectId: string, employeeId: string): Observable<HttpResponse<AddObjectiveMemberOutcomeDto>>` → `POST ${base}/{projectId}/members` body `{ employeeId }`, `observe: 'response'`.
- [x] Test: POST url/body/status 202, same shape as `ObjectiveMemberApiService.addMember`.
- [x] Commit: `feat(work): add POST /work/projects/{id}/members to ProjectApiService.`

### Task 2: Store `addProjectMember` + invite after create

**Files:** `project-list.store.ts` + `.spec.ts`, `project-list.component.ts` (create submit)

- [x] `addProjectMember(projectId, employeeId): Promise<boolean>` — calls `api.addMember`, maps errors like other methods. Do not fail the whole create if a later invite 409s — log via `patchState` error only after create succeeded; still return true from create.
- [x] `createProject`: after successful create, for each `payload.memberEmployeeIds` call `addMember` then `loadProjects()`.
- [x] Create submit already reloads via `createProject`. Tests: create with two member ids fires two POSTs after the create POST (mock `addMember` + `create` + `listMine`).
- [x] Commit: `feat(work): invite staged members after creating a project.`

### Task 3: `ProjectMembersPopupComponent` + list wiring

**Files:** Create `src/app/modules/work/ui/project-members-popup/` + spec. Modify `project-list.component.ts` + `.html` + `.spec.ts`. Update ARCHITECTURE work tree.

- [x] Popup modeled on `ObjectiveMembersPopupComponent` but add-only: list `project.members` with `app-avatar` + `displayName`. `+ Add member` → `app-employee-picker` → `addRequested.emit(employeeId)`. No remove/transfer.
- [x] List: `membersModalOpen` + selected project. On `membersRequested`, open popup. On add, `store.addProjectMember(selected.id, employeeId)` then `loadProjects()`.
- [x] Tests: lead sees Member button; clicking opens popup; picking an employee calls add.
- [x] Commit: `feat(work): open a project-level members popup from the explanation card.`
