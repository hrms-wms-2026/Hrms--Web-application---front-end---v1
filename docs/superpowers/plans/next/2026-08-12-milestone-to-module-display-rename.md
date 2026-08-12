# "Milestone" → "Module" Display-Text Rename (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the 6 literal "Milestone"-wording UI strings in the Work Management module to "Module" wording, with zero changes to component/class/file/route/DTO names.

**Architecture:** Four independent one-line-ish string edits, one task per file/component. Each task adds a regression test asserting the new text renders, then makes the edit. No new components, no new state, no routing changes.

**Tech Stack:** Angular 18 standalone components, Vitest via `ng test`, NgRx Signal Store.

## Global Constraints

- Scope is Work Management only (`src/app/modules/work/**`) — do not touch any other module. A teammate owns other modules in this repo; do not modify or rebuild anything outside these 4 files + their spec files.
- Do NOT rename any component, class, file, selector, route segment, property, or method containing "Milestone"/"milestone" — only the 6 literal display strings listed in the design doc change. See `docs/superpowers/specs/next/2026-08-12-milestone-to-module-display-rename-design.md` for the full rationale and the explicit out-of-scope list.
- Every edit is a plain string-literal change — no logic changes. Keep diffs minimal.
- One commit per task.

---

### Task 1: `ProjectDetailComponent` — loading label + empty-state title

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html:31,35`
- Test: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: existing `storeStub` shape already defined in the spec file's `beforeEach` (`milestonesLoading: () => false`, `milestones: () => [milestone, milestone2]`, etc.) — override per-test, do not change the shared stub shape.
- Produces: nothing consumed by later tasks — this task is self-contained.

- [ ] **Step 1: Write the failing tests**

Add these two `it` blocks inside the existing `describe('ProjectDetailComponent', ...)` block in `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts` (place them after the existing tests, before the closing `});` of the describe block):

```typescript
  it('shows "Loading modules…" while milestones are loading', () => {
    storeStub.milestonesLoading = () => true;
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading modules…');
  });

  it('shows "No modules yet" when there are no milestones', () => {
    storeStub.milestones = () => [];
    storeStub.milestonesLoading = () => false;
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No modules yet');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: the 2 new tests FAIL (actual text is still "Loading milestones…" / "No milestones yet"); all pre-existing tests in this file still PASS.

- [ ] **Step 3: Update the template**

In `src/app/modules/work/feature/project-detail/project-detail.component.html`, change line 31:

```html
  <app-loader label="Loading milestones…" />
```
to:
```html
  <app-loader label="Loading modules…" />
```

And change line 35:

```html
  <app-empty-state title="No milestones yet" />
```
to:
```html
  <app-empty-state title="No modules yet" />
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: all tests in this file PASS, including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/project-detail/project-detail.component.html src/app/modules/work/feature/project-detail/project-detail.component.spec.ts
git commit -m "feat(work-management): rename Milestone display text to Module in Project Detail loading/empty states"
```

---

### Task 2: `MilestoneCardComponent` — settings button aria-label

**Files:**
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.ts:40`
- Test: `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`

**Interfaces:**
- Consumes: existing `baseMilestone` fixture and `setup()` helper already defined in the spec file.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the existing `describe('MilestoneCardComponent', ...)` block in `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts` (after the existing tests, before the closing `});`):

```typescript
  it('labels the settings button "Module settings"', () => {
    setup({ ...baseMilestone, isOwner: true });
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="settings-button"] button');
    expect(button.getAttribute('aria-label')).toBe('Module settings');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: FAIL — actual `aria-label` is still `"Milestone settings"`.

- [ ] **Step 3: Update the component**

In `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`, change line 40:

```typescript
              aria-label="Milestone settings"
```
to:
```typescript
              aria-label="Module settings"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: PASS, all tests in this file green.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-card/milestone-card.component.ts src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts
git commit -m "feat(work-management): rename Milestone Card settings aria-label to Module settings"
```

---

### Task 3: `MilestoneSettingsModalComponent` — modal title + Default-Milestone help text

**Files:**
- Modify: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts:13,35`
- Test: `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts`

**Interfaces:**
- Consumes: existing `detail` fixture and `beforeEach` setup already defined in the spec file (`fixture`, `TestBed.configureTestingModule`).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing tests**

Add these two `it` blocks inside the existing `describe('MilestoneSettingsModalComponent', ...)` block in `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts` (after the existing tests, before the closing `});`):

```typescript
  it('shows "Module settings" as the modal title', () => {
    fixture.componentRef.setInput('initialValue', detail);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Module settings');
  });

  it('shows the Default-Module explanation for the default objective', () => {
    fixture.componentRef.setInput('initialValue', { ...detail, isDefault: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('the Default Module follows');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts --watch=false`
Expected: both new tests FAIL (actual text still says "Milestone settings" / "Default Milestone"); pre-existing tests still PASS. (The pre-existing test titled `'disables the Achieved toggle for the Default Milestone'` at line 31 is a test *name* only, not an assertion on this text — it is unaffected and stays green throughout; do not rename it as part of this task.)

- [ ] **Step 3: Update the component**

In `src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts`, change line 13:

```typescript
    <app-modal [open]="open()" title="Milestone settings" (closed)="closed.emit()">
```
to:
```typescript
    <app-modal [open]="open()" title="Module settings" (closed)="closed.emit()">
```

And change line 35:

```typescript
            <span class="text-xs text-[var(--color-text-secondary)]">(Achieve the project instead — the Default Milestone follows the project's own achieved state)</span>
```
to:
```typescript
            <span class="text-xs text-[var(--color-text-secondary)]">(Achieve the project instead — the Default Module follows the project's own achieved state)</span>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts --watch=false`
Expected: all tests in this file PASS, including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.spec.ts
git commit -m "feat(work-management): rename Milestone Settings modal title and Default-Milestone help text to Module"
```

---

### Task 4: `ProjectDetailStore` — milestones-load error message

**Files:**
- Modify: `src/app/modules/work/state/project-detail.store.ts:58`
- Test: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: existing `setup()` helper from the spec file (`setup(apiOverrides: Partial<ProjectApiService>)`), and `throwError` from `rxjs` (already imported at the top of the spec file).
- Produces: nothing consumed by later tasks. This is the final task in this plan.

- [ ] **Step 1: Write the failing test**

Add this `it` block inside the existing `describe('ProjectDetailStore', ...)` block in `src/app/modules/work/state/project-detail.store.spec.ts`, directly after the existing `'loads milestones independently of the project'` test (which ends at line 48):

```typescript
  it('sets milestonesError on failure', async () => {
    const store = setup({ getMyMilestones: () => throwError(() => ({ error: { detail: 'Server error' } })) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestonesError()).toBe('Server error');
  });

  it('falls back to "Failed to load modules." when the server gives no error detail', async () => {
    const store = setup({ getMyMilestones: () => throwError(() => ({})) } as Partial<ProjectApiService>);
    await store.loadMyMilestones('p1');
    expect(store.milestonesError()).toBe('Failed to load modules.');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/state/project-detail.store.spec.ts --watch=false`
Expected: the first new test PASSES already (it asserts the server-provided `'Server error'` message, which `extractError` already prefers over the fallback — this exercises the failure path but isn't itself proof of the rename). The second new test FAILS: actual fallback message is still `'Failed to load milestones.'`.

- [ ] **Step 3: Update the store**

In `src/app/modules/work/state/project-detail.store.ts`, change line 58:

```typescript
        patchState(store, { milestonesError: extractError(err, 'Failed to load milestones.'), milestonesLoading: false });
```
to:
```typescript
        patchState(store, { milestonesError: extractError(err, 'Failed to load modules.'), milestonesLoading: false });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/state/project-detail.store.spec.ts --watch=false`
Expected: all tests in this file PASS, including both new ones.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat(work-management): rename Milestone-load fallback error message to Module"
```

---

### Task 5: Full module regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the full work module test suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: all tests pass, 0 failures.

- [ ] **Step 2: Grep-verify no leftover old wording in the 4 touched files**

Run: `grep -n "Loading milestones…\|No milestones yet\|Milestone settings\|Default Milestone\|Failed to load milestones\." src/app/modules/work/feature/project-detail/project-detail.component.html src/app/modules/work/ui/milestone-card/milestone-card.component.ts src/app/modules/work/ui/milestone-settings-modal/milestone-settings-modal.component.ts src/app/modules/work/state/project-detail.store.ts`
Expected: no matches (exit code 1 / empty output). If any match remains, it was missed in Tasks 1-4 — fix it and re-run this step before proceeding.

- [ ] **Step 3: Commit** (only if Step 2 surfaced a fix)

```bash
git add -A src/app/modules/work
git commit -m "fix(work-management): catch remaining Milestone display-text wording"
```
