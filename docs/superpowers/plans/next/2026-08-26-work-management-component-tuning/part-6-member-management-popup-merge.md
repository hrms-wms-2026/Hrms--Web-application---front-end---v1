> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the two Work Management member-management popup implementations into one scope-aware component while preserving project-member display/add behavior and objective-member leader/remove/pending behavior.

**Architecture:** Introduce one `MemberManagementPopupComponent` with `scope: 'project' | 'objective'`. Project scope receives normalized `{ id, name, isHead?, pending? }` members and exposes `addRequested`/`closed`; objective scope receives the existing objective member DTOs and exposes add/remove/transfer/closed. The component owns only display/picker UI; parent components remain responsible for the API/store operations and refreshes. Use the existing `EmployeePickerComponent`. Keep the canonical shared `SelectComponent` as the only dropdown primitive if a scope control is needed; do not add another dropdown implementation.

**Tech Stack:** Angular standalone components, signal inputs/outputs, existing shared `ModalComponent`, `ButtonComponent`, `AvatarComponent`, `EmployeeAvatarComponent`, `EmployeePickerComponent`, `EmployeeDirectoryStore`, Work Management member DTOs, Vitest, and the repository's Angular test runner.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B6. The existing `member-button` and `employee-picker` components are already shared and must not be rewritten.

## Global Constraints

- Work only in frontend Work Management paths and this authorized plan file. Do not touch backend, unrelated modules, shared UI primitives, CI, routes outside Work Management, or build files.
- Preserve all existing project and objective member operations, including add, remove/cancel pending, make leader, leader badge, pending tag, loading/error inputs, and close behavior.
- Do not duplicate the two full popup templates in the merged component. Scope-specific conditional sections are allowed where the behaviors genuinely differ.
- Do not change API services, stores, DTOs, employee picker behavior, or permission decisions. Parent handlers and refreshes remain the source of truth.
- Preserve accessible labels, test ids, and button semantics where possible so existing parent tests remain meaningful.

---

### Task 1: Define normalized popup contracts with failing tests

**Files:**
- Add: `src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts`

- [ ] **Step 1: Add project-scope tests.**

Cover project member rows, Avatar display, manager-only Add member button, EmployeePicker selection emitting `addRequested`, and close output. Use normalized member objects with stable ids/names.

- [ ] **Step 2: Add objective-scope tests.**

Cover EmployeeAvatar/directory name rendering, leader badge, pending tag, manager-only Remove/Cancel and Make leader actions, correct `removeRequested`/`transferRequested` events, add-member picker event, loading input preservation, and close output.

- [ ] **Step 3: Run the new spec and confirm red.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts
```

Expected red result: the unified component does not exist yet. Keep both old popups until call-site migration is complete.

---

### Task 2: Implement the scope-aware member popup

**Files:**
- Add: `src/app/modules/work/ui/member-management-popup/member-management-popup.component.ts`
- Add/modify: `src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts`

- [ ] **Step 1: Define typed inputs/outputs.**

Use a narrow normalized project-member shape and preserve the objective DTO:

```typescript
export interface ProjectMemberPopupItem {
  id: string;
  name: string;
}

scope = input<'project' | 'objective'>('project');
open = input(false);
projectMembers = input<readonly ProjectMemberPopupItem[]>([]);
objectiveMembers = input<readonly ObjectiveMemberItemDto[]>([]);
loading = input(false);
canManage = input(false);
addRequested = output<string>();
removeRequested = output<string>();
transferRequested = output<string>();
closed = output<void>();
```

If the project parent already has `ProjectMemberAvatar` objects, normalize them in the parent binding or define the input as a typed union adapter; do not use `any`.

- [ ] **Step 2: Preserve shared modal/picker behavior.**

Render one `app-modal` and one `app-employee-picker`. Use a local picker mode (`'member' | 'leader' | null`) only when objective scope needs leader selection. Project scope's add action emits `addRequested`; objective scope's add and leader actions emit the correct event after picker selection. The picker closes on selection or close.

- [ ] **Step 3: Render scope-specific member rows without duplicate popup components.**

For project scope, render the existing Avatar/name row and Add member action. For objective scope, render the directory-backed name, EmployeeAvatar, Leader badge, pending tag, Remove/Cancel, and Make leader controls. Keep `data-testid="member-row"`, `leader-badge`, `pending-tag`, `remove-button`, `transfer-button`, and `add-member-button` semantics.

- [ ] **Step 4: Run the unified popup spec and verify green.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts
```

---

### Task 3: Migrate Work Management call sites and delete duplicates

**Files:**
- Locate and modify only Work Management call sites importing `ProjectMembersPopupComponent` or `ObjectiveMembersPopupComponent`.
- Modify corresponding Work Management specs.
- Delete after source audit: `src/app/modules/work/ui/project-members-popup/project-members-popup.component.ts` and its spec.
- Delete after source audit: `src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.ts` and its spec.

- [ ] **Step 1: Migrate project scope.**

Replace the project popup import/tag with `MemberManagementPopupComponent`, pass `scope="project"`, map existing `ProjectMemberAvatar` values to `{ id: userId, name: displayName }`, and preserve `canManage`, `addRequested`, and `closed` bindings.

- [ ] **Step 2: Migrate objective scope.**

Replace the objective popup import/tag with the same component, pass `scope="objective"`, bind `objectiveMembers`, `loading`, `canManage`, and preserve add/remove/transfer/closed handlers exactly.

- [ ] **Step 3: Audit and delete old implementations.**

Search only `src/app/modules/work` for old class names/selectors. Update stale tests to `app-member-management-popup` or the scope input. Delete the old source/spec files only when the search is empty.

- [ ] **Step 4: Run focused parent and popup tests.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts --include="src/app/modules/work/**/*.spec.ts"
```

- [ ] **Step 5: Commit B6.**

```bash
git add src/app/modules/work/ui/member-management-popup/member-management-popup.component.ts src/app/modules/work/ui/member-management-popup/member-management-popup.component.spec.ts <actual Work Management parent files> docs/superpowers/plans/next/2026-08-26-work-management-component-tuning/part-6-member-management-popup-merge.md
git add -u src/app/modules/work/ui/project-members-popup src/app/modules/work/ui/objective-members-popup
git commit -m "refactor(work): merge project and objective member popups"
```

Stage only actual changed files.

## Self-Review Checklist

- [ ] One scope-aware Work Management member popup replaces both duplicate implementations.
- [ ] Project add-member and objective add/remove/transfer/pending behaviors are preserved.
- [ ] Employee picker remains shared and unchanged.
- [ ] No backend or unrelated module files changed.
- [ ] B7 deep audit remains for the final phase.
