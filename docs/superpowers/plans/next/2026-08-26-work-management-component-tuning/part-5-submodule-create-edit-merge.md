> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Work Management Create Sub-module modal and Module Settings modal into one mode-aware form while preserving create payloads, edit payloads, achieved-state behavior, validation, and the MilestoneTreeTab orchestration.

**Architecture:** Introduce one `SubModuleFormComponent` with `mode: 'create' | 'edit'`. Create mode receives `parentObjectiveId` and emits `created: CreateObjectiveRequestDto`; edit mode receives `initialValue: ObjectiveDetail` and emits `saved: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }`. The parent remains responsible for `ProjectDetailStore.createSubModule`, edit/unachieve/achieve ordering, errors, loading, and tree refresh. The Achieved control is rendered only in edit mode.

**Tech Stack:** Angular standalone components, signal inputs/outputs, existing shared `ModalComponent`, `InputComponent`, `ButtonComponent`, `CreateObjectiveRequestDto`, `EditObjectiveRequestDto`, `ObjectiveDetail`, Vitest, and the existing Work Management test runner.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B5. “Module” remains user-facing copy; existing objective/milestone code naming remains unchanged.

## Global Constraints

- Work only in frontend Work Management paths and this authorized plan file. Do not touch backend, unrelated modules, shared UI primitives, CI, routes outside Work Management, or build files.
- Do not leave two duplicate full forms. Delete the old Create Sub-module and Milestone Settings component implementations and specs only after all Work Management source references are migrated and the merged form is green.
- Preserve create validation and exact `CreateObjectiveRequestDto` shape, including `description: null` when empty.
- Preserve edit validation and exact `EditObjectiveRequestDto` shape, plus `achievedChanged`/`achieved` semantics.
- Preserve the Default Module rule: edit mode disables Achieved and displays the current explanatory copy; create mode has no Achieved control.
- The merged form must not inject stores or call APIs directly. Parent store orchestration remains unchanged.

---

### Task 1: Define the merged form contract with tests

**Files:**
- Add: `src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts`

- [ ] **Step 1: Add create-mode tests.**

Cover rendering title/description/start/end/allocated-hours fields, validation for title/start/end/date ordering/negative hours, exact create payload, and Cancel. Assert there is no Achieved control in create mode.

- [ ] **Step 2: Add edit-mode tests.**

Cover prefill from `ObjectiveDetail`, exact edit payload after Save, Achieved unchanged/on/off event semantics, Default Module disabled toggle plus explanation, validation, and Cancel. Assert edit mode does not emit `created` and create mode does not emit `saved`.

- [ ] **Step 3: Run the new spec and confirm red.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts
```

Expected red result: the merged component does not exist yet. Keep the two old specs until migration is complete.

---

### Task 2: Implement `SubModuleFormComponent`

**Files:**
- Add: `src/app/modules/work/ui/sub-module-form/sub-module-form.component.ts`
- Add/modify: `src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts`

- [ ] **Step 1: Define typed inputs/outputs.**

```typescript
mode = input<'create' | 'edit'>('create');
open = input(false);
parentObjectiveId = input('');
initialValue = input<ObjectiveDetail | null>(null);
submitting = input(false);
errorMessage = input('');
created = output<CreateObjectiveRequestDto>();
saved = output<{ fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }>();
closed = output<void>();
```

- [ ] **Step 2: Implement shared draft fields and initialization.**

Use one set of title, description, startDate, endDate, and allocatedHours signals. Re-seed from `initialValue()` in edit mode and reset to blank/zero for create mode when the form opens or the initial value changes. Keep local field errors and the existing `onAllocatedHoursChange` conversion behavior.

- [ ] **Step 3: Implement the shared template.**

Reuse the existing field test ids (`title-field`, `description-field`, `start-date-field`, `end-date-field`, `allocated-hours-field`, `submit-button`, `cancel-button`). Use `Create sub Module`/`Module settings` titles and `Create`/`Save changes` labels according to mode. Render the Achieved checkbox and Default Module explanation only when `mode() === 'edit'`. Keep the existing `ModalComponent`, `InputComponent`, and `ButtonComponent` imports.

- [ ] **Step 4: Implement exact create/edit submit behavior.**

Validate the shared fields. In create mode emit:

```typescript
{
  parentObjectiveId: this.parentObjectiveId(),
  title: this.title(),
  description: this.description() || null,
  startDate: this.startDate(),
  endDate: this.endDate(),
  allocatedHours: this.allocatedHours()
}
```

In edit mode emit fields plus `achievedChanged` and `achieved`, using the initial `isAchieved` value. Do not inject a store or call an API.

- [ ] **Step 5: Run the merged form spec and verify green.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts
```

---

### Task 3: Migrate MilestoneTreeTab and remove the duplicates

**Files:**
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`
- Delete after audit: `src/app/modules/work/ui/create-sub-module-modal/create-sub-module-modal.component.ts`
- Delete after audit: `src/app/modules/work/ui/create-sub-module-modal/create-sub-module-modal.component.spec.ts`
- Delete after audit: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts`
- Delete after audit: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts`

- [ ] **Step 1: Replace imports and standalone component registration.**

Replace both old imports with `SubModuleFormComponent` and register only the merged component in `MilestoneTreeTabComponent.imports`.

- [ ] **Step 2: Replace the create and edit template instances.**

Map the current create modal to:

```html
<app-sub-module-form
  mode="create"
  [open]="createModalOpen()"
  [parentObjectiveId]="createModalParentId()"
  [submitting]="createModalSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (created)="onCreateModalCreated($event)"
  (closed)="createModalOpen.set(false)"
/>
```

Map the current settings modal to:

```html
<app-sub-module-form
  mode="edit"
  [open]="settingsOpen()"
  [initialValue]="settingsInitialValue()"
  [submitting]="settingsSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (saved)="onSettingsSaved($event)"
  (closed)="settingsOpen.set(false)"
/>
```

Preserve the existing parent handlers and tree reloads exactly.

- [ ] **Step 3: Update parent assertions and audit references.**

Change only stale selectors from `app-create-sub-module-modal`/`app-milestone-settings-modal` to `app-sub-module-form`. Run a source-only search for the old selectors and class names under `src/app/modules/work`. Delete old source/spec files only when no references remain.

- [ ] **Step 4: Run focused Work Management tests.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts --include=src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts
```

- [ ] **Step 5: Commit B5.**

```bash
git add src/app/modules/work/ui/sub-module-form/sub-module-form.component.ts src/app/modules/work/ui/sub-module-form/sub-module-form.component.spec.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.html src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts docs/superpowers/plans/next/2026-08-26-work-management-component-tuning/part-5-submodule-create-edit-merge.md
git add -u src/app/modules/work/ui/create-sub-module-modal src/app/modules/work/ui/milestone-settings-modal
git commit -m "refactor(work): merge sub-module create and edit forms"
```

Stage only actual changed files.

## Self-Review Checklist

- [ ] One mode-aware form owns all shared sub-module fields.
- [ ] Create and edit payloads retain their exact existing shapes.
- [ ] Achieved is edit-only, with Default Module behavior preserved.
- [ ] Parent store orchestration and tree refresh ordering are unchanged.
- [ ] No old form source/spec references remain in Work Management.
- [ ] No backend or unrelated files changed.
- [ ] B6/B7 were not started in this part.
