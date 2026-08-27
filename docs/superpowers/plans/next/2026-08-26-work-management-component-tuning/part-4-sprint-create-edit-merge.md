> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Work Management Sprint Create and Sprint Edit forms into one mode-aware component without changing create/edit API behavior or the two existing call-site workflows.

**Architecture:** Keep the existing Sprint Create and Sprint Edit visual/form primitives in a single standalone `SprintFormComponent` with `mode: 'create' | 'edit'`, an optional `sprint` input for edit mode, and the existing module picker only in create mode. The component emits `created` in create mode, `saved` in edit mode, and `cancelled` in both modes. The owning Work Management call sites continue to perform store mutations and refresh their relevant data; the merged component does not inject or call APIs directly.

**Tech Stack:** Angular standalone components, signal inputs/outputs, existing shared `ModalComponent`, `InputComponent`, `ButtonComponent`, `SelectComponent`, `SprintListStore`, `CreateSprintRequestDto`, `EditSprintRequestDto`, Vitest, and the repository's Angular test runner.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B4. “Module” remains display copy; existing code-level `objective`/`milestone`/`sprint` naming conventions remain unchanged.

## Global Constraints

- Work only in frontend Work Management paths and this plan file. Do not touch backend, unrelated modules, shared UI primitives, CI, routes outside Work Management, or build files.
- Preserve current create behavior, including module selection, owner/request mode, date/name validation, and `activeOnly` handling.
- Preserve current edit behavior, including edit payload shape, validation, cancel behavior, and store refresh semantics.
- Do not leave two full duplicate form implementations. After migration, delete the old component only when no Work Management source or test imports it.
- Keep API/store orchestration in the existing parent components; the merged form remains presentational/form-state code.

---

### Task 1: Inventory current form contracts and write red/contract tests

**Files:**
- Modify: `src/app/modules/work/ui/sprint-create-form/sprint-create-form.component.spec.ts`
- Modify: `src/app/modules/work/ui/sprint-edit-form/sprint-edit-form.component.spec.ts`
- Add: `src/app/modules/work/ui/sprint-form/sprint-form.component.spec.ts`

- [ ] **Step 1: Capture the create-mode contract.**

Move or duplicate the existing create tests into the new merged component spec. Cover module options, required module validation, name/start/end values, owner versus request mode, creation output, and cancel output. The test must assert the module picker is present only in create mode and uses the canonical `app-select` nested native select.

- [ ] **Step 2: Capture the edit-mode contract.**

Move or duplicate the existing edit tests into the merged component spec. Cover initial sprint values, edit mode without a module picker, date/name validation, the typed `saved` payload, and cancel output. The test must assert the component does not call a store/API service directly.

- [ ] **Step 3: Run the new merged spec and confirm red.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/sprint-form/sprint-form.component.spec.ts
```

Expected red result: the merged component does not yet exist. Preserve the old specs until the new component is green and call sites are migrated.

---

### Task 2: Implement the mode-aware SprintFormComponent

**Files:**
- Add: `src/app/modules/work/ui/sprint-form/sprint-form.component.ts`
- Add: `src/app/modules/work/ui/sprint-form/sprint-form.component.spec.ts`

- [ ] **Step 1: Define the component API.**

Use a typed public contract similar to:

```typescript
mode = input<'create' | 'edit'>('create');
open = input(false);
objectiveId = input('');
modules = input<readonly SprintCreateModuleOption[]>([]);
isObjectiveOwner = input(false);
sprint = input<Sprint | null>(null);
submitting = input(false);
errorMessage = input<string | null>(null);
created = output<void>();
saved = output<EditSprintRequestDto>();
cancelled = output<void>();
```

If the current Sprint Edit component uses a different DTO or output name, follow the existing parent contract and document the actual final API in the component spec.

- [ ] **Step 2: Implement create/edit local draft state.**

Initialize fields from `sprint()` when edit mode is active. Reset to empty values for create mode. Render `Module` only when `mode() === 'create'` and `modules().length > 0`; map options to the B1 shared `SelectComponent`. Render the same Name, Start date, and End date inputs in both modes. Render the action label as `Create sprint`/`Request sprint` for create mode based on ownership and `Save changes` for edit mode.

- [ ] **Step 3: Preserve validation and typed outputs.**

Retain required name/start/end validation and end-date ordering. On create, emit the existing create event only after validation. On edit, emit `saved` with the existing edit DTO only after validation. Never call a store or HTTP service from this component. Keep `submitting` on the Save/Create action and disable Cancel while submitting.

- [ ] **Step 4: Run the merged component spec and verify green.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/sprint-form/sprint-form.component.spec.ts
```

---

### Task 3: Migrate Work Management call sites and remove duplicate forms

**Files:**
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`
- Delete only after the source audit: `src/app/modules/work/ui/sprint-create-form/sprint-create-form.component.ts`
- Delete only after the source audit: `src/app/modules/work/ui/sprint-edit-form/sprint-edit-form.component.ts`

- [ ] **Step 1: Replace imports and template tags.**

In Task Backlog, replace the create-form import/tag with `SprintFormComponent` in create mode and map its existing create output to the current store call. In MilestoneTreeTab, use the same component in create mode for `createSprintOpen` and edit mode for `editSprintOpen`, mapping `created` and `saved` to the existing handlers. Preserve all existing input values, current node/objective context, and refresh behavior.

- [ ] **Step 2: Preserve parent-specific error/submitting state.**

Pass the existing `createSprintSubmitting`/`editSprintSubmitting` and error signals to the merged component. Do not merge parent store methods or change the Work Management state stores.

- [ ] **Step 3: Update call-site tests and audit references.**

Run a source-only search for `SprintCreateFormComponent`, `SprintEditFormComponent`, `app-sprint-create-form`, and `app-sprint-edit-form` under `src/app/modules/work`. Update only Work Management specs and remove the old components when the search is empty.

- [ ] **Step 4: Run focused call-site tests.**

```bash
npx ng test --watch=false --include=src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts --include=src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts
```

- [ ] **Step 5: Commit B4.**

```bash
git add src/app/modules/work/ui/sprint-form/sprint-form.component.ts src/app/modules/work/ui/sprint-form/sprint-form.component.spec.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts docs/superpowers/plans/next/2026-08-26-work-management-component-tuning/part-4-sprint-create-edit-merge.md
git rm src/app/modules/work/ui/sprint-create-form/sprint-create-form.component.ts src/app/modules/work/ui/sprint-edit-form/sprint-edit-form.component.ts
git commit -m "refactor(work): merge sprint create and edit forms"
```

Stage only actual changed files.

## Self-Review Checklist

- [ ] One mode-aware Sprint form is the only Work Management implementation for create/edit sprint fields.
- [ ] Create mode still supports module selection and owner/request behavior.
- [ ] Edit mode still pre-fills existing sprint data and emits the same typed edit payload.
- [ ] Task Backlog and Milestone Tree refresh behavior is unchanged.
- [ ] No backend or unrelated module files changed.
- [ ] B5/B6/B7 were not started in this part.
