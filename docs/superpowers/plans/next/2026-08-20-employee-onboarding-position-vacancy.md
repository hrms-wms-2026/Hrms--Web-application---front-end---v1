# Employee Onboarding Position Vacancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep all active matching positions visible in Add Employee onboarding, show concise vacancy text, disable full positions, and block invalid onboarding submissions before they are sent.

**Architecture:** Reuse the existing `PositionListItemResponse` contract as the source of truth for vacancy state. Centralize vacancy formatting and validation in the Add Employee wizard/store flow so the select options, stale selection clearing, checklist reset behavior, and submit blocking all stay consistent across reloads and navigation steps.

**Tech Stack:** Angular 21, TypeScript, NgRx Signal Store, Angular Reactive Forms, Vitest, Angular HttpTestingController

## Global Constraints

- Work only in `C:\onevoNew\Hrms--Web-application---front-end---v1`.
- Do not change backend unless frontend inspection proves `assignedCount` and `maxOccupancy` are missing from the API response.
- Do not hide full positions; show them disabled with explicit vacancy text.
- Use vacancy calculation `availableSeats = maxOccupancy - assignedCount`; treat `availableSeats <= 0` as full.
- Do not show backend field names like `maxOccupancy`, `assignedCount`, `positionType`, or `currentOccupancyCheckSupported` in the UI.
- Use concise HR-facing option text: `Position Name [2]` and `Position Name [No vacancy]`.
- If a selected position becomes invalid or full after reload, clear the position, clear checklist selection, clear edited checklist tasks, and show `The selected position no longer has a vacancy. Choose another position.`
- Block Continue, Save Draft, and Finalize with inline position validation when the selected position is missing, not in current options, or full.
- Keep backend authoritative, but do not send avoidable invalid payloads from the frontend.
- Do not commit or push.

---

### Task 1: Add failing tests for vacancy option rendering and submit blocking

**Files:**
- Modify: `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`
- Test: `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`

**Interfaces:**
- Consumes: current wizard position select bound to `store.positions()`
- Produces: test coverage for visible full positions, disabled full positions, inline vacancy errors, blocked submit paths, and stale selection clearing

- [ ] **Step 1: Write the failing tests**

```ts
it('renders available and full positions with concise vacancy labels', async () => {
  await setupWithCompany();
  flushDepartmentAndPositionLoad({
    positions: [
      { id: 'pos-open', name: 'Software Engineer', maxOccupancy: 3, assignedCount: 1, isActive: true },
      { id: 'pos-full', name: 'Project Manager', maxOccupancy: 1, assignedCount: 1, isActive: true }
    ]
  });

  const options = Array.from(fixture.nativeElement.querySelectorAll('select option'));
  expect(options.some((o) => o.textContent?.includes('Software Engineer [2]'))).toBe(true);
  expect(options.some((o) => o.textContent?.includes('Project Manager [No vacancy]'))).toBe(true);
});

it('disables the full position option in the position select', async () => {
  await setupWithCompany();
  flushDepartmentAndPositionLoad({
    positions: [
      { id: 'pos-open', name: 'Software Engineer', maxOccupancy: 3, assignedCount: 1, isActive: true },
      { id: 'pos-full', name: 'Project Manager', maxOccupancy: 1, assignedCount: 1, isActive: true }
    ]
  });

  const fullOption = Array.from(fixture.nativeElement.querySelectorAll('select option'))
    .find((option) => option.textContent?.includes('Project Manager [No vacancy]')) as HTMLOptionElement;
  expect(fullOption.disabled).toBe(true);
});

it('blocks continue, save draft, and finalize when the selected position has no vacancy', async () => {
  // arrange a stale selected full position, trigger validation, and assert no onboarding request fires
});

it('clears a selected position and checklist edits when the refreshed position becomes full', async () => {
  // arrange valid selection + selected checklist + edited tasks, reload positions with assignedCount >= maxOccupancy, assert all cleared
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch --include src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`

Expected: FAIL because the current position labels do not include vacancy text, full positions are not disabled, and stale-full validation/reset behavior is not implemented.

- [ ] **Step 3: Write minimal implementation**

```ts
// Add helpers and signals in the wizard/store so tests can observe:
// - vacancy-aware option labels
// - disabled full options
// - inline vacancy error message
// - stale selection clearing with checklist reset
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --no-watch --include src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`

Expected: PASS for the new vacancy-specific cases.

### Task 2: Implement vacancy-aware option mapping and validation in the wizard/store

**Files:**
- Modify: `src/app/modules/people/state/add-employee-wizard.store.ts`
- Modify: `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.ts`
- Modify: `src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.html`

**Interfaces:**
- Consumes: `PositionListItemResponse` with `id`, `name`, `maxOccupancy`, `assignedCount`, `reportsToPositionId`
- Produces: vacancy-aware select options, store helpers for selection validity, reset behavior for invalid/full positions, and inline messaging surface for the component

- [ ] **Step 1: Write the failing test for stale selection clearing**

```ts
it('shows inline vacancy feedback after a selected position becomes full on refresh', async () => {
  // select open position, then reload with assignedCount equal to maxOccupancy
  expect(fixture.componentInstance.form.controls.positionId.value).toBe('');
  expect(fixture.nativeElement.textContent).toContain(
    'The selected position no longer has a vacancy. Choose another position.'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --no-watch --include src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`

Expected: FAIL because refreshed full positions are currently neither invalidated nor surfaced inline.

- [ ] **Step 3: Write minimal implementation**

```ts
type PositionVacancyStatus = {
  availableSeats: number;
  isFull: boolean;
  option: SelectOption;
};

function getAvailableSeats(position: PositionListItemResponse): number {
  return position.maxOccupancy - (position.assignedCount ?? 0);
}

function toPositionOption(position: PositionListItemResponse): SelectOption {
  const availableSeats = getAvailableSeats(position);
  return {
    value: position.id,
    label: availableSeats <= 0
      ? `${position.name} [No vacancy]`
      : `${position.name} [${availableSeats}]`,
    disabled: availableSeats <= 0
  };
}
```

- [ ] **Step 4: Extend the implementation to validate before navigation and submission**

```ts
private selectedPositionIssue(): 'required' | 'missing' | 'full' | null {
  // derive from current form value + current position items
}

private clearInvalidPositionSelection(): void {
  this.form.controls.positionId.setValue('');
  this.store.clearSelectedChecklistTemplate();
  this.store.setPosition('', null);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx ng test --no-watch --include src/app/modules/people/feature/add-employee-wizard/add-employee-wizard.component.spec.ts`

Expected: PASS for stale reload clearing, inline messaging, and submit blocking.

### Task 3: Add focused shared select regression coverage

**Files:**
- Modify: `src/app/shared/ui/select/select.component.spec.ts`
- Test: `src/app/shared/ui/select/select.component.spec.ts`

**Interfaces:**
- Consumes: `SelectOption { value: string; label: string; disabled?: boolean }`
- Produces: regression coverage proving disabled options render as native disabled options without changing existing selection behavior

- [ ] **Step 1: Write the failing test**

```ts
it('renders disabled options as disabled without affecting enabled options', () => {
  const fixture = TestBed.createComponent(SelectComponent);
  fixture.componentRef.setInput('options', [
    { value: 'open', label: 'Software Engineer [2]' },
    { value: 'full', label: 'Project Manager [No vacancy]', disabled: true }
  ]);
  fixture.detectChanges();

  const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
  expect(select.options[0].disabled).toBe(false);
  expect(select.options[1].disabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails only if the shared select behavior regresses**

Run: `npx ng test --no-watch --include src/app/shared/ui/select/select.component.spec.ts`

Expected: PASS immediately if existing support already covers the case; otherwise FAIL and drive the smallest safe fix.

- [ ] **Step 3: Write minimal implementation only if needed**

```ts
<option
  [value]="option.value"
  [selected]="option.value === value()"
  [disabled]="option.disabled || false"
>
  {{ option.label }}
</option>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --no-watch --include src/app/shared/ui/select/select.component.spec.ts`

Expected: PASS with backward-compatible placeholder and selection behavior intact.

### Task 4: Run requested verification and write the report

**Files:**
- Create: `EMPLOYEE_ONBOARDING_POSITION_VACANCY_FRONTEND_REPORT.md`
- Modify: any touched source/spec files from Tasks 1-3

**Interfaces:**
- Consumes: final implementation diff, final vacancy calculation, verification output
- Produces: user-facing report with root cause, changed files, API fields relied on, tests run, skipped checks, and remaining risks

- [ ] **Step 1: Run the requested people specs**

Run: `npx ng test --no-watch --include src/app/modules/people/**/*.spec.ts`

Expected: PASS for updated onboarding-related people specs.

- [ ] **Step 2: Run the build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 3: Run whitespace/diff validation**

Run: `git diff --check`

Expected: no diff formatting errors.

- [ ] **Step 4: Write the report**

```md
# Employee Onboarding Position Vacancy Frontend Report

## Root cause
- Positions were mapped to plain name-only select options, so occupancy state was invisible and not enforced before submission.

## Exact vacancy calculation used
- `availableSeats = maxOccupancy - assignedCount`
- `isFull = availableSeats <= 0`

## API fields relied on
- `id`
- `name`
- `maxOccupancy`
- `assignedCount`
- `reportsToPositionId`
```

- [ ] **Step 5: Re-run the smallest failing command if any verification step fails, fix forward, and update the report with skipped checks or remaining risks**

Run: re-run only the failed command after the fix.

Expected: final report matches the actual verification evidence.
