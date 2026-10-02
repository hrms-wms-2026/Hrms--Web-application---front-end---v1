# Leave hourly ledger — Frontend Part 1: Overnight work hours UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** General Settings Default work hours accepts overnight `22:00`–`06:00` and shows live `{hours} working hours / day · this is 1 leave day`.

**Architecture:** Shared TS helper mirroring backend `WorkDayHoursCalculator`. Validator stops treating `start >= end` as invalid. Existing title summary is reused and extended. No leave module changes in this part.

**Tech Stack:** Angular 21, Vitest.

**Spec:** `docs/superpowers/specs/next/2026-09-09-leave-hourly-ledger-design.md` § Work-day hours. Backend Part 1 must allow overnight on the API or save will 400.

**Depends on:** backend `2026-09-09-leave-hourly-ledger/part-1-work-day-hours-and-overnight.md`.

---

### Task 1: `work-day-hours.ts` helper

**Files:**
- Create: `src/app/modules/organization/utils/work-day-hours.ts`
- Create: `src/app/modules/organization/utils/work-day-hours.spec.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { computeWorkDayHours, isOvernightWorkWindow } from './work-day-hours';

describe('computeWorkDayHours', () => {
  it('returns null when either time is missing', () => {
    expect(computeWorkDayHours(null, '18:00', 60)).toBeNull();
    expect(computeWorkDayHours('09:00', '', 60)).toBeNull();
  });

  it('subtracts break on a same-day window', () => {
    expect(computeWorkDayHours('09:00', '18:00', 60)).toBe(8);
  });

  it('counts overnight 22:00-06:00 as 8 hours', () => {
    expect(computeWorkDayHours('22:00', '06:00', 0)).toBe(8);
    expect(isOvernightWorkWindow('22:00', '06:00')).toBe(true);
  });

  it('returns a non-positive value when break covers the shift', () => {
    expect(computeWorkDayHours('09:00', '10:00', 120)).toBe(-1);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```
npm test -- --include='**/work-day-hours.spec.ts' --watch=false
```

- [ ] **Step 3: Implement**

```typescript
function minutes(hhmm: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm.trim())) return null;
  const [h, m] = hhmm.trim().split(':').map(Number);
  return h * 60 + m;
}

export function isOvernightWorkWindow(start: string, end: string): boolean {
  const a = minutes(start);
  const b = minutes(end);
  if (a === null || b === null) return false;
  return b <= a;
}

export function computeWorkDayHours(
  start: string | null | undefined,
  end: string | null | undefined,
  breakMinutes: number | string | null | undefined
): number | null {
  if (!start || !end) return null;
  const a = minutes(start);
  const b = minutes(end);
  if (a === null || b === null) return null;
  let delta = b - a;
  if (delta <= 0) delta += 24 * 60;
  const brk = Math.max(0, Number(breakMinutes) || 0);
  return Math.round((delta - brk) / 60 * 100) / 100;
}
```

- [ ] **Step 4: Re-run — expect PASS**

```
npm test -- --include='**/work-day-hours.spec.ts' --watch=false
```

- [ ] **Step 5: Commit**

```
git add src/app/modules/organization/utils/work-day-hours.ts src/app/modules/organization/utils/work-day-hours.spec.ts
git commit -m "feat(org): add work-day-hours helper with overnight windows"
```

---

### Task 2: Validator + live line + next-day label

**Files:**
- Modify: `src/app/modules/organization/utils/general-settings-validators.ts`
- Modify: `src/app/modules/organization/utils/general-settings-validators.spec.ts`
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.ts`
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.html`
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts`

- [ ] **Step 1: Change validator tests**

Replace the two `start_not_before_end` cases with:

```typescript
it('is valid for overnight 22:00-06:00', () => {
  const group = makeGroup('22:00', '06:00');
  expect(group.valid).toBe(true);
  expect(group.errors).toBeNull();
});

it('returns start_equals_end_ok as overnight 24h (equal times valid)', () => {
  const group = makeGroup('09:00', '09:00');
  expect(group.valid).toBe(true);
});
```

Keep `both_required`.

In `workTimePairValidator`, delete the `start >= end` branch. After both times present, return null (overnight is valid). Optional extra: if `computeWorkDayHours` `<= 0`, return `{ workTimePair: 'break_covers_shift' }`.

- [ ] **Step 2: Run validator spec — FAIL then implement until PASS**

```
npm test -- --include='**/general-settings-validators.spec.ts' --watch=false
```

- [ ] **Step 3: `getWorkingHoursSummary`**

Replace the body so overnight works. Use `computeWorkDayHours`. Return null when hours is null or `<= 0`. Format:

`${hours.toFixed(1)} working hours / day · this is 1 leave day`

HTML: keep the title summary. Under the 3 fields add:

```html
@if (getWorkingHoursSummary(); as summary) {
  <p class="gs-work-hours-live" data-testid="work-hours-live-line">{{ summary }}</p>
}
@if (isOvernightWindow()) {
  <p class="gs-work-hours-nextday">End time is the next calendar day.</p>
}
```

Replace the `start_not_before_end` error paragraph with `break_covers_shift` → “Break duration must be shorter than the work window.”

`isOvernightWindow()`: `isOvernightWorkWindow(form.controls.workStartTime.value, form.controls.workEndTime.value)`.

Add a spec: form `22:00`/`06:00`/`0` → summary contains `8.0 working hours` and isOvernight true. Previously `getWorkingHoursSummary` returned null for start >= end — that assertion if any must flip.

- [ ] **Step 4: Run**

```
npm test -- --include='**/general-settings.component.spec.ts' --watch=false
npm test -- --include='**/general-settings-validators.spec.ts' --watch=false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```
git add src/app/modules/organization/utils/general-settings-validators.ts src/app/modules/organization/utils/general-settings-validators.spec.ts src/app/modules/organization/feature/general-settings
git commit -m "feat(org): overnight work windows and live leave-day hours line"
```
