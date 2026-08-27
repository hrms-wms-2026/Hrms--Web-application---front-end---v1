> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one reusable dropdown primitive and one reusable Tabs primitive for the Work Management frontend, migrate every authorized Work Management consumer and the preferences sub-tabs onto those primitives, preserve the existing visible behaviors and accessibility attributes, and remove the now-unused `WorkDropdownComponent` implementation.

**Architecture:** `shared/ui/select/select.component.ts` remains the canonical native-select primitive. It will gain an optional leading icon variant and retain its existing signal-input/output API. `shared/ui/tabs/tabs.component.ts` will provide a small value-based tab-list primitive with a `tabs` input, an active `value` input, and a `valueChange` output; the preferences modal will use it for its existing nested sub-tab list while retaining its preferences-specific sidebar and icon treatment. Work Management filters will use `app-select` directly, and raw native selects in task and sprint creation will be replaced by the same primitive. The compact and artwork-heavy `project-card` and `task-card` layouts do not fit `app-card`'s fixed title/section/padding structure; `project-explanation-card` already uses `app-card`, so no speculative card rewrite is needed.

**Tech Stack:** Angular standalone components, signal inputs/outputs, native HTML select semantics, Angular template control flow, TypeScript, and the repository's existing Karma/Jasmine test runner.

**Spec:** `docs/superpowers/specs/next/2026-08-26-work-management-component-tuning-design.md` §2 Part B1. The current code was verified before this plan: `app-select` exposes `label`, `placeholder`, `options`, `disabled`, `value`, `error`, and `valueChange`; `app-work-dropdown` supplies the Work Management-only icon variants (`module`, `status`, `category`, `sprint`, `filter`); `module-filter-select`, `task-board`, `task-backlog`, `my-task`, `project-filter-bar`, `sprint-tab`, and `task-table` import or render `app-work-dropdown`; `task-create-modal` and `sprint-create-form` contain raw native selects; `preferences-modal` owns the current nested sub-tab buttons; and `project-explanation-card` already wraps its content in `app-card`.

## Global Constraints

- Touch only `src/app/modules/work/**`, `src/app/shared/ui/**`, and this plan under `docs/superpowers/**`. Do not edit any other frontend path.
- Do not touch `.github/**`, any `*.yml`/`*.yaml`, Dockerfile, build script, or other pipeline/build-infrastructure file.
- Preserve the existing public behavior of every migrated filter: the same selected values, labels, callbacks, accessible labels, default options, responsive layout, and filter state transitions must remain intact.
- Keep the existing `app-select` public inputs and `valueChange` output source-compatible. New icon support must be optional, so existing non-Work Management consumers do not change.
- Do not keep two dropdown implementations. After the migration, `work-dropdown.component.ts`, `WorkDropdownComponent`, `WorkDropdownOption`, and `app-work-dropdown` must have no non-test references and the legacy component file must be deleted.
- Do not broaden card styling merely to claim migration. `project-explanation-card` is already a consumer of `app-card`; document `project-card` and `task-card` as intentionally retained because their banner/artwork and compact interactive card structures do not fit the current shared card API.
- Run the relevant focused tests before each commit, then run `npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"` before the final B1 commit. Never run a frontend dev server.

---

### Task 1: Extend the canonical shared Select with the Work Management icon variant

**Files:**
- Modify: `src/app/shared/ui/select/select.component.ts`
- Modify: `src/app/shared/ui/select/select.component.spec.ts`

**Interfaces:**
- Consumes: existing `SelectOption` and `SelectComponent` inputs/outputs.
- Produces: optional `icon` input typed as `'module' | 'status' | 'category' | 'sprint' | 'filter'`, with `valueChange` unchanged.

- [ ] **Step 1: Add failing icon-variant tests.**

In `select.component.spec.ts`, add a test that sets `icon` to `module`, renders the component, and asserts that the select wrapper contains a leading SVG with `aria-hidden="true"`. Add a second test that sets a normal option list and confirms the existing `valueChange` behavior still emits the selected option value. Use the same `TestBed`/fixture shape already present in that spec; do not introduce a new testing abstraction.

The new assertion should be concrete, not a placeholder:

```typescript
it('renders the requested Work Management leading icon without changing native select semantics', () => {
  fixture.componentRef.setInput('options', [{ value: 'all', label: 'All modules' }]);
  fixture.componentRef.setInput('value', 'all');
  fixture.componentRef.setInput('icon', 'module');
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('select')).not.toBeNull();
  expect(fixture.nativeElement.querySelector('[data-testid="select-leading-icon"]')).not.toBeNull();
});
```

- [ ] **Step 2: Implement the optional icon input and template paths.**

Keep `SelectOption` unchanged. Add the input and a path map beside the component:

```typescript
export type SelectIcon = 'module' | 'status' | 'category' | 'sprint' | 'filter';

const SELECT_ICON_PATHS: Record<SelectIcon, string> = {
  module: 'M4 5h16v14H4z M8 9h8M8 13h5',
  status: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z M12 8v4l2.5 2',
  category: 'M4 6h16M7 12h10M10 18h4',
  sprint: 'M4 5h16v14H4z M8 9h8M8 13h5',
  filter: 'M3 7h18M6 7v10M18 7v10M9 17h6'
};
```

Add `icon = input<SelectIcon | undefined>(undefined);` and a `selectIconPath` method returning `SELECT_ICON_PATHS[icon]`. In the template, render the icon before the native `<select>` only when `icon()` is set, with `data-testid="select-leading-icon"`, `aria-hidden="true"`, and the same stroke attributes already used by Work Management icons. Keep the existing label/error IDs, placeholder behavior, `disabled` binding, native `<select>`, and `valueChange` handler intact. Add only the minimum wrapper classes needed for the icon to sit beside the select; do not replace the native control with a custom menu.

- [ ] **Step 3: Run the shared Select spec.**

Run the repository's existing focused Angular test invocation for this file, using the command syntax verified in `package.json`. Expected result: all existing Select tests plus the new icon test pass.

- [ ] **Step 4: Commit the canonical Select change.**

```bash
git add src/app/shared/ui/select/select.component.ts src/app/shared/ui/select/select.component.spec.ts
git commit -m "feat(work): extend shared select with Work Management icons"
```

---

### Task 2: Add and prove the shared Tabs primitive

**Files:**
- Add: `src/app/shared/ui/tabs/tabs.component.ts`
- Add: `src/app/shared/ui/tabs/tabs.component.spec.ts`

**Interfaces:**
- Consumes: `readonly TabOption[]`, where `TabOption` is `{ value: string; label: string }`, plus the active `value`.
- Produces: `valueChange: output<string>()` when a tab button is clicked.

- [ ] **Step 1: Write the failing Tabs tests.**

Create a standalone host fixture in `tabs.component.spec.ts` following the existing shared UI spec pattern. Cover the exact public behavior that the preferences modal needs: labels render in input order, the active tab has `aria-selected="true"` and an active class, and clicking another tab emits its value. The test must use concrete data:

```typescript
const tabs = [
  { value: 'appearance', label: 'Appearance' },
  { value: 'notifications', label: 'Notifications' }
] as const;
```

- [ ] **Step 2: Implement the standalone Tabs component.**

Implement the component with this public shape and accessible structure:

```typescript
export interface TabOption { value: string; label: string; }

@Component({
  selector: 'app-tabs',
  standalone: true,
  template: `
    <div role="tablist" class="flex gap-1" aria-label="Tabs">
      @for (tab of tabs(); track tab.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="tab.value === value()"
          [class.app-tabs__tab--active]="tab.value === value()"
          (click)="valueChange.emit(tab.value)"
        >{{ tab.label }}</button>
      }
    </div>
  `
})
export class TabsComponent {
  tabs = input<readonly TabOption[]>([]);
  value = input('');
  valueChange = output<string>();
}
```

Use the repository's design tokens for focus, border, surface, accent, and text colors in the component styles. Do not add content projection in this part: the preferences modal only needs a reusable label list and active value, and a smaller API matches the existing `app-card`/`app-modal` primitives.

- [ ] **Step 3: Run the Tabs spec and commit.**

Run the focused shared Tabs spec and confirm it is green, then commit:

```bash
git add src/app/shared/ui/tabs/tabs.component.ts src/app/shared/ui/tabs/tabs.component.spec.ts
git commit -m "feat(work): add shared tabs primitive"
```

---

### Task 3: Replace all Work Management filter dropdown consumers

**Files:**
- Modify: `src/app/modules/work/ui/module-filter-select/module-filter-select.component.ts`
- Modify: `src/app/modules/work/ui/project-filter-bar/project-filter-bar.component.ts`
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.ts`
- Modify: `src/app/modules/work/feature/my-task/my-task.component.ts`
- Modify: `src/app/modules/work/ui/sprint-tab/sprint-tab.component.ts`
- Modify: `src/app/modules/work/ui/task-table/task-table.component.ts`
- Modify: `src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts` only where its imports/assertions reference the old dropdown.
- Delete: `src/app/modules/work/ui/work-dropdown/work-dropdown.component.ts`

**Interfaces:**
- Every migrated consumer imports `SelectComponent` and `SelectOption` from `shared/ui/select/select.component`.
- Each former `(selectionChanged)` binding becomes `(valueChange)` with the same handler expression.
- Each former `WorkDropdownOption` type becomes `SelectOption`; each former `leadingIcon` value becomes `[icon]="'module'"`, `[icon]="'status'"`, `[icon]="'category'"`, `[icon]="'sprint'"`, or `[icon]="'filter'"`.

- [ ] **Step 1: Update the module-filter-select consumer.**

Replace its `WorkDropdownComponent` import with `SelectComponent`, change `imports` to `[SelectComponent]`, change its option type to `SelectOption`, and replace both templates with the shared API while preserving labels, accessible labels, full-width layout, and event targets:

```html
<app-select
  [options]="moduleOptions()"
  [value]="selected()"
  label="Module"
  [icon]="'module'"
  (valueChange)="selectionChanged.emit($event)"
/>
<app-select
  [options]="statusOptions"
  [value]="activityFilter()"
  label="Status"
  [icon]="'status'"
  (valueChange)="onActivityFilterSelected($event)"
/>
```

Wrap the two selects with the existing flex container. If the shared Select has no `fullWidth` input, use the existing parent flex classes rather than adding a new Select API solely for this consumer.

- [ ] **Step 2: Update the five feature/filter consumers.**

In `task-board`, `task-backlog`, `my-task`, `project-filter-bar`, `sprint-tab`, and `task-table`, replace only the dropdown import, standalone `imports` entry, option type, selector, icon input, and output name. Preserve each existing `options`, `selected`, accessible label, and handler expression. For example, the board toolbar conversion is:

```typescript
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
// imports: [..., SelectComponent]
protected readonly objectiveOptions = computed<SelectOption[]>(() => [
  { value: 'all', label: 'All modules' },
  ...this.modules().map((module) => ({ value: module.objectiveId, label: module.title }))
]);
```

```html
<app-select [options]="objectiveOptions()" [value]="objectiveFilter()" label="Module filter" [icon]="'module'" (valueChange)="setObjectiveFilter($event)" />
```

Use the same exact substitution for sprint/status/category filters. Replace CSS selectors targeting `app-work-dropdown` with the equivalent `app-select` host selector only where needed for the existing responsive sizing; do not redesign the toolbars.

- [ ] **Step 3: Update the affected Work Management spec and remove the legacy file.**

Change only old selector/import/type assertions in `task-backlog.component.spec.ts` to the new `app-select` API. Run a repository-wide source search for `WorkDropdownComponent`, `WorkDropdownOption`, `app-work-dropdown`, and `work-dropdown.component`; expected result is no non-test source reference. Delete `work-dropdown.component.ts` after the search is clean.

- [ ] **Step 4: Run the affected Work Management specs and commit.**

Run the focused specs for `task-board`, `task-backlog`, `my-task`, `module-filter-select`, `project-filter-bar`, `sprint-tab`, and `task-table`. Confirm all are green, then commit:

```bash
git add src/app/modules/work/feature/task-board/task-board.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.ts src/app/modules/work/feature/task-backlog/task-backlog.component.spec.ts src/app/modules/work/feature/my-task/my-task.component.ts src/app/modules/work/ui/module-filter-select/module-filter-select.component.ts src/app/modules/work/ui/project-filter-bar/project-filter-bar.component.ts src/app/modules/work/ui/sprint-tab/sprint-tab.component.ts src/app/modules/work/ui/task-table/task-table.component.ts

git rm src/app/modules/work/ui/work-dropdown/work-dropdown.component.ts
git commit -m "refactor(work): replace legacy dropdown consumers with shared select"
```

---

### Task 4: Replace raw native selects in task and sprint creation

**Files:**
- Modify: `src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts`
- Modify: `src/app/modules/work/ui/sprint-create-form/sprint-create-form.component.ts`
- Modify their existing specs if selectors or imported standalone dependencies need updating.

**Interfaces:**
- `TaskCreateModalComponent` imports `SelectComponent` and supplies `SelectOption[]` for modules, sprints, members, categories, and priority.
- `SprintCreateFormComponent` imports `SelectComponent` and supplies `SelectOption[]` for the module picker.
- Existing signals, validation messages, fixed single-sprint rendering, request/create branching, and submit behavior remain unchanged.

- [ ] **Step 1: Convert every raw task-create select.**

Replace the module native select with:

```html
<app-select
  [options]="modules().map((module) => ({ value: module.objectiveId, label: module.title }))"
  [value]="selectedObjectiveId()"
  label="Module"
  placeholder="Select a module"
  [error]="errors()['objectiveId'] || ''"
  (valueChange)="selectedObjectiveId.set($event)"
/>
```

Apply the same API to sprint, assignee, category, and priority. Keep the single-sprint fixed span. Preserve the optional-sprint placeholder (`No sprint`), unassigned option, category/priority values, and all current error messages. Add small computed option arrays where the template currently uses `@for`; do not put complex non-pure expressions in templates if the surrounding component uses computed signals.

- [ ] **Step 2: Convert the sprint-create module picker.**

Import `SelectComponent`, replace the raw module `<select>` with an `app-select` using `modules()` mapped to `{ value, label }`, bind `selectedObjectiveId()`, and pass `moduleError()` through the existing `error` input. Keep the current `effectiveObjectiveId`, owner filtering, submit validation, and reset behavior.

- [ ] **Step 3: Run the create-form specs and commit.**

Run both component specs and verify the module/sprint/member/category/priority values and validation errors still render. Then commit:

```bash
git add src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts src/app/modules/work/ui/sprint-create-form/sprint-create-form.component.ts
git commit -m "refactor(work): use shared select in task and sprint forms"
```

---

### Task 5: Migrate preferences sub-tabs and complete the card audit

**Files:**
- Modify: `src/app/shared/ui/preferences-modal/preferences-modal.component.ts`
- Modify: `src/app/shared/ui/preferences-modal/preferences-modal.component.spec.ts` only for the new `app-tabs` selector/role assertions.
- Modify: `src/app/modules/work/ui/project-explanation-card/project-explanation-card.component.ts` only if the current `app-card` wrapper needs a minimal formatting correction exposed by the test.
- Documentation/status note: this plan file only; do not create a second design/spec file.

**Interfaces:**
- `PreferencesModalComponent` imports `TabsComponent` and passes its existing `subTabs()` and `activeSubTabId()` through `[tabs]` and `[value]`, forwarding `(valueChange)` to `selectSubTab`.
- Main preference sidebar behavior, `activeTabIdChange`, profile expansion, icon paths, modal sizing, and content projection remain unchanged.

- [ ] **Step 1: Replace the ad-hoc sub-tab button loop.**

Add `TabsComponent` to the modal imports and replace only the `@for (subTab of subTabs())` button block with:

```html
@if (tab.id === subTabsForTabId() && isProfileExpanded()) {
  <app-tabs
    [tabs]="subTabs()"
    [value]="activeSubTabId()"
    [attr.aria-label]="tab.label + ' sections'"
    (valueChange)="selectSubTab($event)"
  />
}
```

If `TabOption` and `PreferenceSubTab` have the same `{ id, label }` shape but different property names, map them in a computed signal in the modal rather than weakening the shared Tabs type. Keep the existing preferences CSS for the sidebar and add only a scoped style override if needed to retain the current nested-subtab visual hierarchy.

- [ ] **Step 2: Verify the card audit against current code.**

Confirm `project-explanation-card.component.ts` already imports `CardComponent` and has an `<app-card>` wrapper. Do not change `project-card.component.ts` or `task-card.component.ts`: the first has a banner-artwork/flip container and action footer that do not fit `app-card`'s fixed section/padding structure, and the second is a compact clickable drag/clock card with its own hover and interaction styles. Record this conclusion in the final report rather than introducing a wrapper that changes layout or event behavior.

- [ ] **Step 3: Run the preferences and full Work Management tests, then commit B1.**

Run the focused preferences and shared Tabs specs, then the mandatory full command:

```bash
npx ng test --watch=false --include="**/modules/work/**/*.spec.ts"
```

Also run the shared Select/Tabs/preferences specs if the Angular include pattern does not select them. Confirm no source reference remains to the deleted dropdown and no files outside the scope guard changed. Commit:

```bash
git add src/app/shared/ui/preferences-modal/preferences-modal.component.ts src/app/shared/ui/preferences-modal/preferences-modal.component.spec.ts

git commit -m "refactor(work): migrate preferences sub-tabs to shared tabs"
```

## Self-Review Checklist

- [ ] The plan covers every B1 requirement: one canonical dropdown, Work Management icon support, migration of filter/form consumers, deletion of the duplicate dropdown, a shared Tabs primitive with a proven preferences consumer, and a card audit.
- [ ] Every cited file and public API was checked against the current repository before this plan was written; no step relies on a stale line number.
- [ ] Every implementation step contains concrete TypeScript or HTML, not a placeholder such as “update as needed.”
- [ ] Existing `app-select` consumers remain source-compatible because `icon` is optional and no old input/output is renamed.
- [ ] No database, backend, API contract, route, CI, or build-infrastructure change is part of B1.
- [ ] The two explicitly excluded card migrations are justified by the actual current layouts, while `project-explanation-card` is confirmed already migrated.
- [ ] The B1 plan stops before B2; the B2 approver-edit-amount ambiguity is not guessed or implemented here.
