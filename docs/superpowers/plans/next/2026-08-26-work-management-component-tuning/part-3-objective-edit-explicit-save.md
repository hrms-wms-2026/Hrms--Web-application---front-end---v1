> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalize Work Management Objective editing so form changes are local until the user presses the existing explicit **Save changes** button. A successful save must persist the full edit payload through the existing Work Management store/API path, refresh the tree, and close the modal; validation or API failures must keep the modal open and preserve the user's inputs.

**Architecture:** Keep `MilestoneSettingsModalComponent` as a local draft form. It already gathers title, description, dates, allocated hours, and achieved state and emits a single `saved` event only from its Save button. Keep `MilestoneTreeTabComponent.onSettingsSaved` as the orchestration boundary for the existing Work Management store methods, including the achieved/unachieved transition ordering. Do not add blur handlers, debounce timers, effects that call the API, or new endpoints. The only persistence trigger is the explicit Save changes button.

**Tech Stack:** Angular standalone components, signal inputs/outputs, existing Work Management `MilestoneSettingsModalComponent`, `MilestoneTreeTabComponent`, `ProjectDetailStore`, `EditObjectiveRequestDto`, shared `ModalComponent`/`InputComponent`/`ButtonComponent`, Vitest, and the repository's Angular test runner.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B3. The user explicitly selected **Option 3 — Explicit Save button** on 2026-08-27. No autosave behavior is authorized in this part.

## Global Constraints

- Work only in frontend Work Management paths: `src/app/modules/work/**` and this authorized `docs/superpowers/**` plan. Do not touch unrelated modules, shared UI primitives, backend, CI, pipelines, migrations, or build infrastructure for B3.
- Do not introduce a second Save button, autosave timer, blur save, debounced API call, or direct `ProjectApiService` call from the modal.
- Preserve the existing achieved-state behavior: unachieve before edit when turning achieved off, edit fields, achieve after edit when turning achieved on. Stop on failure, leave the modal open, and keep `settingsSubmitting` accurate.
- Preserve validation: title/start/end required, end date not before start, and allocated hours non-negative. Validation failures must emit no save event.
- Preserve all user's entered draft values when the store/API reports an error. A later explicit Save may retry with the same draft.
- Keep the edit payload typed as `EditObjectiveRequestDto`; do not use `any` in production code.

---

### Task 1: Lock down explicit-save modal behavior with tests

**Files:**
- Modify: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts`
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts`

- [ ] **Step 1: Add/strengthen modal tests.**

Use the existing modal spec setup and add tests that:

1. Changing title, dates, allocated hours, or achieved checkbox does not emit `saved` before the explicit Save button is pressed.
2. Clicking the explicit Save button emits exactly one event containing the complete `EditObjectiveRequestDto` and the correct `achievedChanged`/`achieved` values.
3. Invalid draft values do not emit `saved` and show the field-level error.
4. A rejected edit is not reset by an input update; the component keeps its entered values until the parent closes/reinitializes it.

Use `data-testid="submit-button"` already present in the modal and assert the nested button click. Do not add tests for blur, debounce, or live API calls because those behaviors are explicitly not required.

- [ ] **Step 2: Add/strengthen tree orchestration tests.**

In the existing `MilestoneTreeTabComponent` spec, cover the explicit Save boundary:

```typescript
it('does not call the store before the settings Save event', () => {
  setup('o1');
  fixture.detectChanges();

  expect(storeStub.editMilestone).not.toHaveBeenCalled();
  expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(1);
});

it('persists settings only after explicit Save and refreshes the Work Management tree', async () => {
  setup('o1');
  fixture.detectChanges();
  const component = fixture.componentInstance;

  await component.onSettingsSaved({
    fields: {
      title: 'Updated module', description: 'Updated description',
      startDate: '2026-01-01', endDate: '2026-12-01', allocatedHours: 48
    },
    achievedChanged: false,
    achieved: false
  });

  expect(storeStub.editMilestone).toHaveBeenCalledWith('o1', expect.objectContaining({
    title: 'Updated module', allocatedHours: 48
  }));
  expect(storeStub.loadProjectTree).toHaveBeenCalledTimes(2);
});
```

Also retain the existing achieved transition tests and add a failure case proving the modal remains open (`settingsOpen()` stays true) when `editMilestone` returns `{ success: false }`.

- [ ] **Step 3: Run the focused B3 tests and confirm the intended red result if a behavior is missing.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts --include=src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts
```

If the current code already satisfies the explicit-save contract, the new tests may be green immediately. In that case, perform only the scoped hardening needed by the tests and do not invent additional behavior.

---

### Task 2: Harden the explicit Save implementation without changing the API contract

**Files:**
- Modify: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts` only if Task 1 identifies a real gap.
- Modify: `src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts` only if Task 1 identifies a real gap.
- Modify: corresponding Work Management specs.

- [ ] **Step 1: Verify the modal has one persistence trigger.**

The only path that may emit `saved` is `submit()`, called by the explicit Save changes button. Input handlers may update signals and validation may update local errors, but neither may call the store or emit `saved`. Keep the existing `[loading]="submitting()"` binding and disable Cancel while the parent is saving.

- [ ] **Step 2: Verify parent save ordering and failure handling.**

Keep this sequence in `onSettingsSaved`:

```typescript
this.settingsSubmitting.set(true);

if (event.achievedChanged && !event.achieved) {
  const result = await this.store.unachieveMilestone(node.id);
  if (!result.success) {
    this.settingsSubmitting.set(false);
    return;
  }
}

const editResult = await this.store.editMilestone(node.id, event.fields);
if (!editResult.success) {
  this.settingsSubmitting.set(false);
  return;
}

if (event.achievedChanged && event.achieved) {
  const result = await this.store.achieveMilestone(node.id);
  if (!result.success) {
    this.settingsSubmitting.set(false);
    return;
  }
}

this.settingsSubmitting.set(false);
this.settingsOpen.set(false);
await this.loadTree({ force: true });
```

If the current implementation already matches, do not rewrite it. Add only the missing regression test or a minimal typed fix. Do not add a second edit endpoint or bypass `ProjectDetailStore`.

- [ ] **Step 3: Run focused tests and commit B3.**

```bash
npx ng test --watch=false --include=src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts --include=src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts
git add src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.ts src/app/modules/work/feature/milestone-tree-tab/milestone-tree-tab.component.spec.ts docs/superpowers/plans/next/2026-08-26-work-management-component-tuning/part-3-objective-edit-explicit-save.md
git commit -m "test(work): lock objective editing to explicit save"
```

Stage only files that actually changed. If source code requires no modification, commit the new Work Management regression tests and plan status only.

---

## Self-Review Checklist

- [ ] No API/store call happens on input, blur, debounce, or effect.
- [ ] Save changes is the only persistence trigger.
- [ ] Complete typed edit payload reaches `ProjectDetailStore.editMilestone`.
- [ ] Achieve/unachieve ordering remains unchanged and failure leaves the modal open.
- [ ] Validation errors are local and prevent the saved event.
- [ ] User-entered values remain available after a failed save.
- [ ] Only Work Management frontend and authorized docs paths changed.
- [ ] B4 has not been started; no autosave timing was guessed beyond the user's explicit Save selection.
