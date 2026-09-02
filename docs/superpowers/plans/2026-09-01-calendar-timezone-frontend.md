# Calendar Timezone Correctness and Unsaved-Changes Guard — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Calendar view (form, Month/Week/Day/Agenda grids) consistently converts stored UTC instants to the *viewer's own* effective timezone - fetched once from the backend's new `/calendar/my-timezone` endpoint - replacing today's three mutually-inconsistent implicit timezone assumptions. Add a "discard changes?" guard before closing a dirty event form.

**Architecture:** A new pure-function shared utility (`src/app/shared/utils/timezone.util.ts`), generalized from the proven `Intl.DateTimeFormat`-based conversion already used privately in `time-tracking.component.ts`, is consumed by the Calendar store (to fetch/cache the viewer's timezone) and by every Calendar display component (to bucket/position/format consistently). No new dependency - everything is native `Intl`.

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-calendar-timezone-and-unsaved-guard-design.md` (Parts 3-7). This plan implements the frontend half; the backend half (Parts 1-2) has already shipped on `feature/calendar-recurrence-engine` - `CalendarEvent.Timezone` is now the organizer's real effective timezone, and `Timezone` has been removed from the backend's Create/Update/EditRecurringOccurrence request contracts.

## Global Constraints

- Branch off `feature/calendar-frontend-module` (the latest shipped frontend Calendar work) in this repo.
- All timezone conversion goes through the new `src/app/shared/utils/timezone.util.ts` - no component hand-rolls its own `Intl.DateTimeFormat` call once this ships.
- `time-tracking.component.ts`/`correction-approvals.component.ts` are **not** migrated to the new shared utility in this plan - their private copies keep working as-is (explicitly out of scope per the design spec).
- The `timezone` field is removed from the frontend's `CreateCalendarEventRequest`, `UpdateCalendarEventRequest`, and `EditRecurringOccurrenceRequest` models, matching the backend contracts these already changed to (the backend now ignores/no-longer-accepts this field - sending it would just be dead weight).
- `CalendarHourGridComponent`'s own layout math (`calendar-hour-grid.util.ts`'s `layoutDayEvents`) does **not** need to change - it already does correct relative-to-`dayStart` arithmetic; only the *value* passed as `dayStart` needs to become timezone-aware (computed via the new shared utility), which fixes its positioning without touching the util file or its 7 existing passing tests.
- Every view component's new `timezone` input defaults to `'UTC'`, so every existing test fixture (which uses UTC-suffixed ISO strings) keeps passing unchanged without needing to set the new input.

---

### Task 1: Shared timezone conversion utility

**Files:**
- Create: `src/app/shared/utils/timezone.util.ts`
- Create: `src/app/shared/utils/timezone.util.spec.ts`

**Interfaces:**
- Produces: `isValidTimezone(timezone: string): boolean`, `dateOnlyInTimezone(isoUtc: string, timezone: string): string`, `utcIsoToLocalParts(isoUtc: string, timezone: string): { date: string; time: string }`, `localPartsToUtcIso(date: string, time: string, timezone: string): string`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/shared/utils/timezone.util.spec.ts
import { describe, expect, it } from 'vitest';
import { dateOnlyInTimezone, isValidTimezone, localPartsToUtcIso, utcIsoToLocalParts } from './timezone.util';

describe('timezone.util', () => {
  describe('isValidTimezone', () => {
    it('accepts a real IANA id', () => {
      expect(isValidTimezone('Asia/Colombo')).toBe(true);
    });

    it('rejects a bogus id', () => {
      expect(isValidTimezone('Not/AZone')).toBe(false);
    });
  });

  describe('dateOnlyInTimezone', () => {
    it('returns the UTC calendar date for the UTC timezone', () => {
      expect(dateOnlyInTimezone('2026-09-01T09:00:00Z', 'UTC')).toBe('2026-09-01');
    });

    it('returns the earlier calendar date for a timezone behind UTC', () => {
      // 2026-09-01T02:00:00Z is still 2026-08-31 in America/New_York (UTC-4 in September, DST)
      expect(dateOnlyInTimezone('2026-09-01T02:00:00Z', 'America/New_York')).toBe('2026-08-31');
    });

    it('returns the later calendar date for a timezone ahead of UTC', () => {
      // 2026-09-01T20:00:00Z is already 2026-09-02 in Asia/Colombo (UTC+5:30)
      expect(dateOnlyInTimezone('2026-09-01T20:00:00Z', 'Asia/Colombo')).toBe('2026-09-02');
    });
  });

  describe('utcIsoToLocalParts', () => {
    it('splits a UTC instant into local date and time for the given timezone', () => {
      expect(utcIsoToLocalParts('2026-09-01T09:00:00Z', 'Asia/Colombo')).toEqual({ date: '2026-09-01', time: '14:30' });
    });
  });

  describe('localPartsToUtcIso', () => {
    it('converts local wall-clock parts back to the correct UTC instant', () => {
      const iso = localPartsToUtcIso('2026-09-01', '14:30', 'Asia/Colombo');
      expect(new Date(iso).toISOString()).toBe('2026-09-01T09:00:00.000Z');
    });

    it('round-trips through utcIsoToLocalParts', () => {
      const original = '2026-03-10T15:45:00Z';
      const { date, time } = utcIsoToLocalParts(original, 'America/New_York');
      const iso = localPartsToUtcIso(date, time, 'America/New_York');
      expect(new Date(iso).toISOString()).toBe(new Date(original).toISOString());
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include "**/timezone.util.spec.ts" --watch=false`
Expected: FAIL - `timezone.util.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

Generalized from the proven algorithm already used privately in `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts` (`localDateTimeToIso`, `dateOnlyForZone`, `validDisplayTimezone`):

```typescript
// src/app/shared/utils/timezone.util.ts

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function dateOnlyInTimezone(isoUtc: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(isoUtc));
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

export function utcIsoToLocalParts(isoUtc: string, timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(new Date(isoUtc));
  return {
    date: `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`,
    time: `${part(parts, 'hour')}:${part(parts, 'minute')}`
  };
}

export function localPartsToUtcIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(candidate);
    const shownHour = Number(part(parts, 'hour'));
    const shownMinute = Number(part(parts, 'minute'));
    const delta = ((shownHour * 60 + shownMinute) - (hour * 60 + minute)) * 60_000;
    if (!delta) return candidate.toISOString();
    candidate = new Date(candidate.getTime() - delta);
  }
  return candidate.toISOString();
}

function part(parts: readonly Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value ?? '00';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include "**/timezone.util.spec.ts" --watch=false`
Expected: all pass. `America/New_York` and `Asia/Colombo` are both loaded in the test environment's ICU data - if any date-arithmetic test is off by the DST transition date used, adjust the fixture date rather than the implementation (the algorithm itself is already proven correct in production via Attendance).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/utils/timezone.util.ts src/app/shared/utils/timezone.util.spec.ts
git commit -m "feat(shared): add timezone conversion utility"
```

---

### Task 2: Fetch and cache the viewer's effective timezone; remove the dead `timezone` request field

**Files:**
- Modify: `src/app/modules/calendar/models/calendar-event.model.ts`
- Modify: `src/app/modules/calendar/data-access/calendar-event-api.service.ts`
- Modify: `src/app/modules/calendar/data-access/calendar-event-api.service.spec.ts`
- Modify: `src/app/modules/calendar/state/calendar-event.store.ts`
- Modify: `src/app/modules/calendar/state/calendar-event.store.spec.ts`
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts`

**Interfaces:**
- Produces: `CalendarEventApiService.getMyTimezone(): Observable<{ timezone: string }>`, `CalendarEventStore.myTimezone()`, `CalendarEventStore.loadMyTimezone(): Promise<void>`.

- [ ] **Step 1: Remove the dead `timezone` field from the three request models**

In `calendar-event.model.ts`, remove `timezone: string | null;` from `CreateCalendarEventRequest`, `UpdateCalendarEventRequest`, and `EditRecurringOccurrenceRequest` (three separate interfaces - remove the line from each; leave `CalendarEventResponse.timezone` untouched, that's the read-side field and still meaningful).

- [ ] **Step 2: Write the failing API service test**

Add to `calendar-event-api.service.spec.ts`:
```typescript
  it('getMyTimezone requests my-timezone', () => {
    service.getMyTimezone().subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/my-timezone`);
    expect(req.request.method).toBe('GET');
    req.flush({ timezone: 'Asia/Colombo' });
  });
```
Also remove `timezone: 'UTC',` (or whatever literal was there) from the existing `create`/`update`/`editOccurrence` test payloads in this same file, since those fields no longer exist on the request types (compile errors otherwise).

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx ng test --include "**/calendar-event-api.service.spec.ts" --watch=false`
Expected: FAIL - `getMyTimezone` does not exist yet.

- [ ] **Step 4: Add the service method**

```typescript
  getMyTimezone(): Observable<{ timezone: string }> {
    return this.http.get<{ timezone: string }>(`${this.baseUrl}/my-timezone`);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --include "**/calendar-event-api.service.spec.ts" --watch=false`
Expected: all pass.

- [ ] **Step 6: Write the failing store test**

Add to `calendar-event.store.spec.ts`:
```typescript
  it('loadMyTimezone populates myTimezone from the API', async () => {
    const work = store.loadMyTimezone();
    http.expectOne(`${environment.apiUrl}/calendar/my-timezone`).flush({ timezone: 'Asia/Colombo' });
    await work;
    expect(store.myTimezone()).toBe('Asia/Colombo');
  });
```
Also remove `timezone: 'UTC',` (or whatever literal is present) from any `create`/`update`/`editOccurrence` payload object literals used elsewhere in this spec file's test bodies (compile errors otherwise, same as Task 2 Step 2).

- [ ] **Step 7: Run tests to verify they fail**

Run: `npx ng test --include "**/calendar-event.store.spec.ts" --watch=false`
Expected: FAIL - `myTimezone`/`loadMyTimezone` don't exist yet.

- [ ] **Step 8: Add the state and method**

Widen `CalendarEventState`:
```typescript
  readonly myTimezone: string;
```
Widen the initial state object: `myTimezone: 'UTC',` (alongside the existing `conflicts: [], checkingConflicts: false`).

Add the method (after `clearConflicts`):
```typescript
    async loadMyTimezone(): Promise<void> {
      try {
        const response = await firstValueFrom(api.getMyTimezone());
        patchState(store, { myTimezone: response.timezone });
      } catch {
        // Falls back to the 'UTC' default already in state - a failed fetch should not block
        // the calendar from rendering, just leave times shown in UTC.
      }
    }
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx ng test --include "**/calendar-event.store.spec.ts" --watch=false`
Expected: all pass.

- [ ] **Step 10: Load it once from the page**

In `calendar-page.component.ts`, add a call in the constructor (or as a field initializer alongside the existing `rangeEffect`) that fires once, not on every range change:
```typescript
  constructor() {
    this.store.loadMyTimezone();
  }
```
(Add an explicit `constructor()` if one doesn't already exist on this class - it currently has none, only field initializers and `rangeEffect`.)

- [ ] **Step 11: Commit**

```bash
git add src/app/modules/calendar/models/calendar-event.model.ts src/app/modules/calendar/data-access/calendar-event-api.service.ts src/app/modules/calendar/data-access/calendar-event-api.service.spec.ts src/app/modules/calendar/state/calendar-event.store.ts src/app/modules/calendar/state/calendar-event.store.spec.ts src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts
git commit -m "feat(calendar): fetch and cache the viewer's effective timezone; drop the dead timezone request field"
```

---

### Task 3: The event form displays and saves in the viewer's timezone

**Files:**
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.html`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts`
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.html`

**Interfaces:**
- Consumes: `utcIsoToLocalParts`, `localPartsToUtcIso` (Task 1), `CalendarEventStore.myTimezone()` (Task 2).
- Produces: `CalendarEventFormModalComponent.myTimezone` input (`string`, default `'UTC'`).

- [ ] **Step 1: Write the failing tests**

Add to `calendar-event-form-modal.component.spec.ts`:
```typescript
  it('pre-fills the form using the viewer timezone, not raw UTC digits', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'Asia/Colombo', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();

    // 2026-09-01T09:00:00Z is 14:30 in Asia/Colombo (UTC+5:30)
    expect(fixture.componentInstance.form.controls.startTime.value).toBe('14:30');
  });

  it('converts local wall-clock input to the correct UTC instant on save', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '14:30', endDate: '2026-09-01', endTime: '15:00'
    });

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);

    const submission = spy.mock.calls[0][0] as { create: { startDate: string; endDate: string } };
    expect(new Date(submission.create.startDate).toISOString()).toBe('2026-09-01T09:00:00.000Z');
  });

  it('shows a hint naming the timezone times are displayed in', () => {
    fixture.componentRef.setInput('myTimezone', 'Asia/Colombo');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Asia/Colombo');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include "**/calendar-event-form-modal.component.spec.ts" --watch=false`
Expected: FAIL - `myTimezone` input doesn't exist yet, pre-fill/save still use raw UTC digits.

- [ ] **Step 3: Add the input and use it for conversion**

In `calendar-event-form-modal.component.ts`, add the import:
```typescript
import { localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
```
Add the input (alongside `checkingConflicts`):
```typescript
  @Input() myTimezone = 'UTC';
```

Replace the `ngOnChanges` pre-fill block's date/time parsing:
```typescript
  ngOnChanges(): void {
    if (this.event) {
      const start = utcIsoToLocalParts(this.event.startDate, this.myTimezone);
      const end = utcIsoToLocalParts(this.event.endDate, this.myTimezone);
      this.form.patchValue({
        title: this.event.title,
        description: this.event.description ?? '',
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
        isAllDay: this.event.isAllDay,
        location: this.event.location ?? '',
        meetingLink: this.event.meetingLink ?? '',
        color: this.event.color ?? '#2563EB'
      });
      return;
    }

    if (this.prefillStart) {
      const [date, time] = this.prefillStart.split('T');
      this.form.patchValue({ startDate: date, startTime: time ?? '09:00', endDate: date, endTime: time ?? '10:00' });
    }
  }
```
(The `prefillStart` branch is unchanged - it's already fed a local wall-clock date/time string by `CalendarPageComponent.onSlotClick`, which builds it from the clicked grid slot, not from a UTC instant.)

Replace `scheduleConflictCheck`'s payload construction:
```typescript
      this.checkConflicts.emit({
        participantEmployeeIds: ids,
        startDate: localPartsToUtcIso(raw.startDate, raw.startTime, this.myTimezone),
        endDate: localPartsToUtcIso(raw.endDate, raw.endTime, this.myTimezone)
      });
```

Replace `onSubmit`'s `startDate`/`endDate` construction and remove the hardcoded `timezone: 'UTC',` from both the `update` and `create` payload objects (the field no longer exists on either request type per Task 2 Step 1):
```typescript
    const raw = this.form.getRawValue();
    const startDate = localPartsToUtcIso(raw.startDate, raw.startTime, this.myTimezone);
    const endDate = localPartsToUtcIso(raw.endDate, raw.endTime, this.myTimezone);
    const recurrence = raw.recurrenceFrequency ?? 'none';
    const recurrenceRule = buildRecurrenceRule(recurrence as RecurrenceFrequency, raw.recurrenceEndMode as RecurrenceEndMode, raw.recurrenceUntilDate || null);

    if (this.isEdit) {
      this.save.emit({
        update: {
          title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
          isAllDay: !!raw.isAllDay, location: raw.location || null,
          meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence
        },
        scope
      });
      return;
    }

    this.save.emit({
      create: {
        title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
        isAllDay: !!raw.isAllDay, location: raw.location || null,
        meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence,
        participantEmployeeIds: this.participantIds(), recurrenceRule
      }
    });
```

- [ ] **Step 4: Add the timezone hint to the template**

In `calendar-event-form-modal.component.html`, inside the "When" section, right after the date/time grid's closing `</div>` and before the "All day" row:
```html
      <span class="text-xs text-[var(--color-text-secondary)]">Times shown in {{ myTimezone }}</span>
```

- [ ] **Step 5: Wire the input from the page**

In `calendar-page.component.html`, add to the `<app-calendar-event-form-modal>` bindings:
```html
  [myTimezone]="store.myTimezone()"
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --include "**/calendar-event-form-modal.component.spec.ts" --watch=false`
Expected: all pass, including every pre-existing test in this file (which default `myTimezone` to `'UTC'` and use UTC-suffixed fixtures, so their behavior is unchanged).

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-event-form-modal/ src/app/modules/calendar/feature/calendar-page/calendar-page.component.html
git commit -m "feat(calendar): event form displays and saves in the viewer's timezone"
```

---

### Task 4: Month/Week/Day/Agenda views bucket and position in the viewer's timezone

**Files:**
- Modify: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.ts`
- Modify: `src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.ts`
- Modify: `src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.ts`
- Modify: `src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.ts`
- Modify: `src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.html`
- Modify: `src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.ts`
- Modify: `src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.html`
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.html`
- Modify: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.spec.ts`

**Interfaces:**
- Consumes: `dateOnlyInTimezone`, `utcIsoToLocalParts`, `localPartsToUtcIso` (Task 1).
- Produces: a `timezone` signal input (default `'UTC'`) on `CalendarHourGridComponent`, `CalendarMonthGridComponent`, `CalendarAgendaViewComponent`, `CalendarWeekViewComponent`, `CalendarDayViewComponent`.

`calendar-hour-grid.util.ts` (`layoutDayEvents`) is **not** modified - its relative-to-`dayStart` arithmetic is already correct; only the `dayStart` value the caller computes and passes in changes.

- [ ] **Step 1: Write the failing hour-grid test**

Add to `calendar-hour-grid.component.spec.ts` (check the file's existing fixture-building helper/pattern first and match its style):
```typescript
  it('buckets an event into the correct day column using the given timezone, not the raw UTC date', () => {
    // 2026-09-01T20:00:00Z is already 2026-09-02 local time in Asia/Colombo (UTC+5:30)
    fixture.componentRef.setInput('timezone', 'Asia/Colombo');
    fixture.componentRef.setInput('days', ['2026-09-01', '2026-09-02']);
    fixture.componentRef.setInput('events', [
      { id: 'e1', title: 'Late Event', description: null, startDate: '2026-09-01T20:00:00Z', endDate: '2026-09-01T20:30:00Z',
        sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
        isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
        isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null }
    ]);
    fixture.detectChanges();

    expect(fixture.componentInstance.columns()[0].positioned.length).toBe(0);
    expect(fixture.componentInstance.columns()[1].positioned.length).toBe(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --include "**/calendar-hour-grid.component.spec.ts" --watch=false`
Expected: FAIL - `timezone` input doesn't exist yet, event buckets into `2026-09-01` (raw UTC date) instead of `2026-09-02`.

- [ ] **Step 3: Fix `CalendarHourGridComponent`**

Add the import:
```typescript
import { dateOnlyInTimezone, localPartsToUtcIso, utcIsoToLocalParts } from '../../../../shared/utils/timezone.util';
```
Add the input (alongside `events`):
```typescript
  timezone = input<string>('UTC');
```
Replace the `columns` computed:
```typescript
  readonly columns = computed<readonly DayColumnViewModel[]>(() => {
    const timezone = this.timezone();
    const nowIso = new Date().toISOString();
    const todayStr = dateOnlyInTimezone(nowIso, timezone);
    const nowParts = utcIsoToLocalParts(nowIso, timezone);
    const [nowHour, nowMinute] = nowParts.time.split(':').map(Number);

    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = dateOnlyInTimezone(event.startDate, timezone);
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    return this.days().map((date) => {
      const dayEvents = byDate.get(date) ?? [];
      const dayStart = new Date(localPartsToUtcIso(date, '00:00', timezone));
      const isToday = date === todayStr;
      return {
        date,
        isToday,
        allDayEvents: dayEvents.filter((e) => e.isAllDay),
        positioned: layoutDayEvents(dayEvents, dayStart),
        nowFraction: isToday ? (nowHour * 60 + nowMinute) / 1440 : null
      };
    });
  });
```
Remove the now-unused `toDateString` function and its `import` of nothing extra (it was only used by the old `todayStr`/`dayStart` computation being replaced - check whether it's still referenced elsewhere in the file before deleting; if not, delete it).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --include "**/calendar-hour-grid.component.spec.ts" --watch=false`
Expected: all pass, including every pre-existing test (which default `timezone` to `'UTC'`, so the old UTC-slice behavior is preserved for them).

- [ ] **Step 5: Fix `CalendarMonthGridComponent`**

Add the import and input, replace the bucketing line:
```typescript
import { dateOnlyInTimezone } from '../../../../shared/utils/timezone.util';
```
```typescript
  timezone = input<string>('UTC');
```
```typescript
      const dateKey = dateOnlyInTimezone(event.startDate, this.timezone());
```
(replacing `const dateKey = event.startDate.slice(0, 10);`)

- [ ] **Step 6: Fix `CalendarAgendaViewComponent`**

Same fix:
```typescript
import { dateOnlyInTimezone } from '../../../../shared/utils/timezone.util';
```
```typescript
  timezone = input<string>('UTC');
```
```typescript
      const dateKey = dateOnlyInTimezone(event.startDate, this.timezone());
```

- [ ] **Step 7: Thread `timezone` through Week/Day views**

In `calendar-week-view.component.ts` and `calendar-day-view.component.ts`, add:
```typescript
  timezone = input<string>('UTC');
```
In `calendar-week-view.component.html` and `calendar-day-view.component.html`, add the binding to the existing `<app-calendar-hour-grid>` element:
```html
<app-calendar-hour-grid [days]="days()" [events]="events()" [timezone]="timezone()" (eventClick)="eventClick.emit($event)" (slotClick)="slotClick.emit($event)" />
```

- [ ] **Step 8: Wire `timezone` from the page into all four views**

In `calendar-page.component.html`, add `[timezone]="store.myTimezone()"` to each of the four view elements:
```html
    @case ('month') {
      <app-calendar-month-grid [year]="year()" [month]="month()" [events]="store.events()" [timezone]="store.myTimezone()" (eventClick)="openEdit($event)" />
    }
    @case ('week') {
      <app-calendar-week-view [weekStart]="weekStart()" [events]="store.events()" [timezone]="store.myTimezone()" (eventClick)="openEdit($event)" (slotClick)="onSlotClick($event)" />
    }
    @case ('day') {
      <app-calendar-day-view [date]="dayDate()" [events]="store.events()" [timezone]="store.myTimezone()" (eventClick)="openEdit($event)" (slotClick)="onSlotClick($event)" />
    }
    @case ('agenda') {
      <app-calendar-agenda-view [events]="store.events()" [timezone]="store.myTimezone()" (eventClick)="openEdit($event)" />
    }
```

- [ ] **Step 9: Run the full Calendar test suite**

Run: `npx ng test --include "src/app/modules/calendar/**/*.spec.ts" --watch=false`
Expected: all pass, including every pre-existing test across Month/Week/Day/Agenda/hour-grid specs.

- [ ] **Step 10: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-hour-grid/ src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.ts src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.ts src/app/modules/calendar/feature/calendar-week-view/ src/app/modules/calendar/feature/calendar-day-view/ src/app/modules/calendar/feature/calendar-page/calendar-page.component.html
git commit -m "feat(calendar): bucket and position events by the viewer's timezone across all views"
```

---

### Task 5: Unsaved-changes exit guard

**Files:**
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.html`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `ConfirmModalComponent` (`src/app/shared/ui/confirm-modal/confirm-modal.component.ts` - `open`, `title`, `message`, `confirmLabel`, `cancelLabel` inputs; `confirmed`, `cancelled` outputs; already exists, used elsewhere for delete confirmations).

- [ ] **Step 1: Write the failing tests**

Add to `calendar-event-form-modal.component.spec.ts`:
```typescript
  it('emits cancel immediately when the form is not dirty', () => {
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);
    fixture.componentInstance.attemptClose();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('shows a discard-confirmation instead of emitting cancel when the form is dirty', () => {
    fixture.componentInstance.form.patchValue({ title: 'Something typed' });
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();

    expect(spy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(true);
  });

  it('emits cancel after the discard is confirmed', () => {
    fixture.componentInstance.form.patchValue({ title: 'Something typed' });
    fixture.componentInstance.attemptClose();

    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);
    fixture.componentInstance.confirmDiscard();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(false);
  });

  it('treats a non-empty participant selection as dirty even with an untouched form', () => {
    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    const spy = vi.fn();
    fixture.componentInstance.cancel.subscribe(spy);

    fixture.componentInstance.attemptClose();

    expect(spy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.discardConfirmOpen()).toBe(true);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include "**/calendar-event-form-modal.component.spec.ts" --watch=false`
Expected: FAIL - `attemptClose`/`discardConfirmOpen`/`confirmDiscard` don't exist yet.

- [ ] **Step 3: Add the guard**

Add the import:
```typescript
import { ConfirmModalComponent } from '../../../../shared/ui/confirm-modal/confirm-modal.component';
```
Add it to the component's `imports` array (alongside `AvatarComponent`).

Add a field and methods (near `participantPickerOpen`):
```typescript
  readonly discardConfirmOpen = signal(false);

  private isDirty(): boolean {
    return this.form.dirty || this.participantIds().length > 0;
  }

  attemptClose(): void {
    if (this.isDirty()) {
      this.discardConfirmOpen.set(true);
      return;
    }
    this.cancel.emit();
  }

  confirmDiscard(): void {
    this.discardConfirmOpen.set(false);
    this.cancel.emit();
  }

  cancelDiscard(): void {
    this.discardConfirmOpen.set(false);
  }
```

- [ ] **Step 4: Route every close path through `attemptClose`**

In `calendar-event-form-modal.component.html`:
- Replace `<app-modal ... (closed)="cancel.emit()">` with `<app-modal ... (closed)="attemptClose()">`.
- Replace both `(click)="cancel.emit()"` Cancel-button bindings (one in the recurring-occurrence footer branch, one in the plain footer branch) with `(click)="attemptClose()"`.

Add the confirm dialog markup at the end of the file (after the existing `<app-calendar-participant-picker ... />` element):
```html
<app-confirm-modal
  [open]="discardConfirmOpen()"
  title="Discard changes?"
  message="You have unsaved changes. Discard them?"
  confirmLabel="Discard"
  cancelLabel="Keep editing"
  (confirmed)="confirmDiscard()"
  (cancelled)="cancelDiscard()"
/>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --include "**/calendar-event-form-modal.component.spec.ts" --watch=false`
Expected: all pass, including every pre-existing test - note that a couple of existing tests call `fixture.componentInstance.form.patchValue(...)` directly and then check `save`/`delete` outputs, not `cancel`, so they're unaffected by this change; none of them call `cancel.emit()` or click the Cancel button, so none needed updating.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-event-form-modal/
git commit -m "feat(calendar): confirm before discarding unsaved event form changes"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend unit suite**

Run: `npx ng test --watch=false`
Expected: same result as the pre-existing baseline (5 pre-existing, unrelated failures across `nav-access.spec.ts`, `clock-in-policy-form.component.spec.ts`, `connect-device.component.spec.ts` - confirmed pre-existing earlier this session) plus every Calendar-related test passing, zero new failures.

- [ ] **Step 2: Manual E2E in the browser**

Start the dev server, log in, open Calendar:
1. `GET /api/v1/calendar/my-timezone` should fire once when the Calendar page loads (check network tab) - confirm the returned timezone matches the logged-in user's profile.
2. Create a new event, typing a specific time (e.g. 2:00 PM) - confirm the request body's `startDate` is the correct UTC instant for that wall-clock time in the resolved timezone (compare against what `GET /calendar/my-timezone` returned).
3. Open that event again in Edit mode - confirm the form shows the same 2:00 PM you typed, not a UTC-shifted value.
4. Switch to Week/Day view - confirm the event appears at the correct hour position and in the correct day column.
5. Click Cancel on a form with no changes - confirm it closes immediately, no prompt.
6. Open a form, type something, click Cancel - confirm the "Discard changes?" prompt appears; click "Keep editing" - confirm the form stays open with your typed value intact; click Cancel again then "Discard" - confirm it closes and the typed value is gone next time you open a fresh form.
