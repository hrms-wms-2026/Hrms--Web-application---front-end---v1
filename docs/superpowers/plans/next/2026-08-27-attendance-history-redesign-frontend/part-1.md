# Attendance Detail Drawer (Data Layer + Drawer Component) Implementation Plan — Part 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully working, independently testable `AttendanceDetailDrawerComponent` — the shared drawer that will later be wired into both "My attendance history" and "Team attendance" (Part 2) — backed by new store/API plumbing that calls the backend's `GET .../history-detail` endpoint (see the companion backend plan). This part does **not** touch `time-tracking.component.ts/.html` at all except for one pure refactor (Task 1) that has no visible behavior change.

**Architecture:** Extend `TimeTrackingStore`/`TimeTrackingApiService` with one new load method each, following the exact pattern already used for `loadMyHistory`/`getMyHistory`. Extract shared formatting helpers used by both the new drawer and Part 2's list component into a new `utils/attendance-formatters.ts` module (a "targeted improvement" — three consumers would otherwise duplicate ~80 lines of formatting logic). Build the drawer as a new standalone Angular component under `feature/time-tracking/attendance-detail-drawer/`.

**Tech Stack:** Angular 21 (standalone components, signals, `@ngrx/signals` SignalStore), RxJS, Vitest + Angular `TestBed` for tests.

## Global Constraints

- **Commit strategy:** every task ends with a normal `git add`/`git commit` — the pre-existing uncommitted WIP in this repo was already committed as its own baseline commit before this plan was written, so task commits land cleanly on top of it.
- The backend endpoint this part calls (`GET /attendance/time-tracking/history-detail?employeeId=&date=`) does not exist until the companion backend plan's Task 2 is done. This part's own tests all mock `TimeTrackingApiService`/`TimeTrackingStore`, so they pass without a live backend — only Part 2's final manual-verification step needs the backend running.
- `AttendanceHistoryRow.canViewDetails` is currently always `true` server-side (hardcoded in `AttendanceReadHandler.BuildRowsAsync`) — still check it when gating row-click behavior (Part 2), but don't build extra branching around it ever being `false` today.
- Match the existing module's CSS convention exactly: compact single-line rules, `var(--color-*)` custom properties (see `time-tracking.component.css` for the exact token vocabulary — `--color-border`, `--color-surface`, `--color-surface-secondary`, `--color-text-primary`, `--color-text-secondary`, `--color-accent`, `--color-danger`/`--color-danger-subtle`/`--color-danger-text`, `--color-warning`/`--color-warning-subtle`/`--color-warning-text`, `--radius-content`). Reuse existing classes (`.time-tracking-message`, `.time-tracking-message--error`, `.empty-copy`, `.table-primary`, `.table-secondary`, `.metric-label`) where they already fit, rather than inventing near-duplicates.

---

### Task 1: Extract shared attendance formatters

**Files:**
- Create: `src/app/modules/attendance/utils/attendance-formatters.ts`
- Create: `src/app/modules/attendance/utils/attendance-formatters.spec.ts`
- Modify: `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`

**Interfaces:**
- Produces: `formatDate(value: string): string`, `formatDateTime(value: string | null, timezone?: string | null): string`, `formatMinutes(value: number | null): string`, `formatWorkAreaDate(value: string, timezone: string | null | undefined): string`, `workModeLabel(value: string | null): string`, `sourceLabel(value: string | null): string`, `statusLabel(value: string, backendLabel?: string | null): string`, `timelineEventLabel(eventType: string): string`, `validDisplayTimezone(timezone: string | null | undefined): string | null`, `DISPLAY_TIMEZONE_FALLBACK: string`. Task 4 (drawer) and Part 2's list component and `MyRequestsPanelComponent` all import these directly — these exact names and signatures are the contract the rest of this plan builds on. `formatWorkAreaDate` in particular is needed in Part 2 by **both** the extracted `MyRequestsPanelComponent` (Task 7) and the work-area-change-request creation modal that stays in `time-tracking.component.ts` — that's why it belongs here rather than on either component alone.

- [ ] **Step 1: Write the failing formatter tests**

Create `src/app/modules/attendance/utils/attendance-formatters.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  formatWorkAreaDate,
  sourceLabel,
  statusLabel,
  timelineEventLabel,
  workModeLabel
} from './attendance-formatters';

describe('attendance-formatters', () => {
  it('formatDate renders a short month/day/year in UTC', () => {
    const expected = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 7, 27, 12)));
    expect(formatDate('2026-08-27')).toBe(expected);
  });

  it('formatDate rejects a malformed date', () => {
    expect(formatDate('not-a-date')).toBe('Date unavailable');
  });

  it('formatDateTime renders a time in the given timezone', () => {
    const expected = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).format(new Date('2026-08-27T10:00:00Z'));
    expect(formatDateTime('2026-08-27T10:00:00Z', 'UTC')).toBe(expected);
  });

  it('formatDateTime returns an em dash for a null value', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('formatMinutes renders hours and minutes', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(null)).toBe('—');
  });

  it('workModeLabel maps known codes and falls back for null', () => {
    expect(workModeLabel('onsite')).toBe('Onsite');
    expect(workModeLabel(null)).toBe('Not specified');
  });

  it('sourceLabel maps known codes and falls back for null', () => {
    expect(sourceLabel('desktop_tray')).toBe('Desktop tray');
    expect(sourceLabel(null)).toBe('—');
  });

  it('statusLabel prefers the backend label when present, otherwise humanizes the code', () => {
    expect(statusLabel('clocked_in', 'Custom label')).toBe('Custom label');
    expect(statusLabel('clocked_in')).toBe('Clocked in');
  });

  it('timelineEventLabel maps each known event type', () => {
    expect(timelineEventLabel('ClockIn')).toBe('Clocked in');
    expect(timelineEventLabel('ClockOut')).toBe('Clocked out');
    expect(timelineEventLabel('BreakStart')).toBe('Break started');
    expect(timelineEventLabel('BreakEnd')).toBe('Break ended');
  });

  it('formatWorkAreaDate renders a date in the given timezone, falling back to formatDate for an invalid value', () => {
    const expected = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 7, 27, 12)));
    expect(formatWorkAreaDate('2026-08-27', 'UTC')).toBe(expected);
    expect(formatWorkAreaDate('not-a-date', 'UTC')).toBe('Date unavailable');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/attendance/utils/attendance-formatters.spec.ts`
Expected: FAIL — `./attendance-formatters` does not exist yet.

- [ ] **Step 3: Create the formatters module**

Create `src/app/modules/attendance/utils/attendance-formatters.ts`:

```ts
export const DISPLAY_TIMEZONE_FALLBACK = 'UTC';

export function validDisplayTimezone(timezone: string | null | undefined): string | null {
  const candidate = timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

export function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

export function formatDateTime(value: string | null, timezone?: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const displayTimezone = validDisplayTimezone(timezone);
  if (!displayTimezone) {
    return '—';
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: displayTimezone
    }).format(date);
  } catch {
    // Invalid runtime timezone data must not surface a technical error to users.
    return '—';
  }
}

export function formatMinutes(value: number | null): string {
  if (value === null || value < 0) {
    return '—';
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (hours === 0) {
    return `${minutes}m`;
  }
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function humanizeValue(value: string, knownValues: Record<string, string>): string {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (knownValues[normalized]) {
    return knownValues[normalized];
  }
  if (!normalized) {
    return 'Not specified';
  }
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function statusLabel(value: string, backendLabel?: string | null): string {
  const label = backendLabel?.trim();
  if (label) {
    return label;
  }

  return humanizeValue(value, {
    not_clocked_in: 'Not clocked in',
    clocked_in: 'Clocked in',
    on_break: 'On break',
    clocked_out: 'Clocked out',
    present: 'Present',
    absent: 'Absent',
    late: 'Late',
    off_day: 'Off day'
  });
}

export function workModeLabel(value: string | null): string {
  return value ? humanizeValue(value, { onsite: 'Onsite', remote: 'Remote', hybrid: 'Hybrid', field: 'Field' }) : 'Not specified';
}

export function sourceLabel(value: string | null): string {
  return value ? humanizeValue(value, { web: 'Web', desktop_tray: 'Desktop tray', biometric: 'Biometric' }) : '—';
}

export function timelineEventLabel(eventType: string): string {
  switch (eventType) {
    case 'ClockIn': return 'Clocked in';
    case 'ClockOut': return 'Clocked out';
    case 'BreakStart': return 'Break started';
    case 'BreakEnd': return 'Break ended';
    default: return eventType;
  }
}

export function formatWorkAreaDate(value: string, timezone: string | null | undefined): string {
  const displayTimezone = validDisplayTimezone(timezone);
  if (!displayTimezone || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const [year, month, day] = value.split('-').map(Number);
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(new Date(Date.UTC(year, month - 1, day, 12)));
  } catch {
    return formatDate(value);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/attendance/utils/attendance-formatters.spec.ts`
Expected: PASS.

- [ ] **Step 5: Delegate `time-tracking.component.ts` to the shared formatters (no behavior change)**

This step only moves code — the component's public method names, signatures, and behavior are unchanged, so `time-tracking.component.spec.ts` needs no edits and should stay green throughout.

In `src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts`, add this import near the other relative imports (after the `TimeTrackingAction, TimeTrackingStore` import):

```ts
import {
  DISPLAY_TIMEZONE_FALLBACK as SHARED_DISPLAY_TIMEZONE_FALLBACK,
  formatDate as formatDateShared,
  formatDateTime as formatDateTimeShared,
  formatMinutes as formatMinutesShared,
  formatWorkAreaDate as formatWorkAreaDateShared,
  sourceLabel as sourceLabelShared,
  statusLabel as statusLabelShared,
  validDisplayTimezone as validDisplayTimezoneShared,
  workModeLabel as workModeLabelShared
} from '../../utils/attendance-formatters';
```

Delete the line `const DISPLAY_TIMEZONE_FALLBACK = 'UTC';` near the top of the file, and every remaining reference to `DISPLAY_TIMEZONE_FALLBACK` in the file becomes `SHARED_DISPLAY_TIMEZONE_FALLBACK` (there are two: inside `displayTimezone` computed's `|| DISPLAY_TIMEZONE_FALLBACK` fallback, and inside `toDateTimeOffset`'s `?? DISPLAY_TIMEZONE_FALLBACK`).

Every remaining reference to the bare function name `validDisplayTimezone(...)` in the file (inside `toDateTimeOffset` and `localTimeForInput` — `formatWorkAreaDate`'s own body is being replaced below, not edited in place) becomes `validDisplayTimezoneShared(...)`.

Replace the instance method `formatWorkAreaDate`:

```ts
  formatWorkAreaDate(value: string, timezone: string | null | undefined): string {
    const displayTimezone = validDisplayTimezone(timezone);
    if (!displayTimezone || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return this.formatDate(value);
    const [year, month, day] = value.split('-').map(Number);
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: displayTimezone }).format(new Date(Date.UTC(year, month - 1, day, 12)));
    } catch {
      return this.formatDate(value);
    }
  }
```

with:

```ts
  formatWorkAreaDate(value: string, timezone: string | null | undefined): string {
    return formatWorkAreaDateShared(value, timezone);
  }
```

Replace the six instance methods:

```ts
  statusLabel(value: string, backendLabel?: string | null): string {
    const label = backendLabel?.trim();
    if (label) {
      return label;
    }

    return humanizeValue(value, {
      not_clocked_in: 'Not clocked in',
      clocked_in: 'Clocked in',
      on_break: 'On break',
      clocked_out: 'Clocked out',
      present: 'Present',
      absent: 'Absent',
      late: 'Late',
      off_day: 'Off day'
    });
  }

  workModeLabel(value: string | null): string {
    return value ? humanizeValue(value, { onsite: 'Onsite', remote: 'Remote', hybrid: 'Hybrid', field: 'Field' }) : 'Not specified';
  }

  sourceLabel(value: string | null): string {
    return value ? humanizeValue(value, { web: 'Web', desktop_tray: 'Desktop tray', biometric: 'Biometric' }) : '—';
  }

  formatDate(value: string): string {
    return formatDate(value);
  }

  formatDateTime(value: string | null, timezone?: string | null): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    const displayTimezone = validDisplayTimezone(timezone);
    if (!displayTimezone) {
      return '—';
    }

    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: displayTimezone
      }).format(date);
    } catch {
      // Invalid runtime timezone data must not surface a technical error to users.
      return '—';
    }
  }

  formatMinutes(value: number | null): string {
    if (value === null || value < 0) {
      return '—';
    }
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    if (hours === 0) {
      return `${minutes}m`;
    }
    return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
  }
```

with:

```ts
  statusLabel(value: string, backendLabel?: string | null): string {
    return statusLabelShared(value, backendLabel);
  }

  workModeLabel(value: string | null): string {
    return workModeLabelShared(value);
  }

  sourceLabel(value: string | null): string {
    return sourceLabelShared(value);
  }

  formatDate(value: string): string {
    return formatDateShared(value);
  }

  formatDateTime(value: string | null, timezone?: string | null): string {
    return formatDateTimeShared(value, timezone);
  }

  formatMinutes(value: number | null): string {
    return formatMinutesShared(value);
  }
```

At the bottom of the file, delete these three module-level functions entirely (they are now dead code — `humanizeValue` was only used by the three instance methods just replaced, and `validDisplayTimezone`/`formatDate` are now imported):

```ts
function validDisplayTimezone(timezone: string | null | undefined): string | null {
  const candidate = timezone?.trim() || DISPLAY_TIMEZONE_FALLBACK;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return 'Date unavailable';
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}
```

and:

```ts
function humanizeValue(value: string, knownValues: Record<string, string>): string {
  const normalized = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  if (knownValues[normalized]) {
    return knownValues[normalized];
  }
  if (!normalized) {
    return 'Not specified';
  }
  return normalized
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
```

Leave `humanizeAttendanceMessage` in place (it doesn't call `humanizeValue` and isn't part of this extraction).

- [ ] **Step 6: Run the full attendance module test suite to confirm no regression**

Run: `npx vitest run src/app/modules/attendance`
Expected: PASS — every existing attendance test (including `time-tracking.component.spec.ts`) still passes unchanged, plus the new `attendance-formatters.spec.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/attendance/utils/attendance-formatters.ts src/app/modules/attendance/utils/attendance-formatters.spec.ts src/app/modules/attendance/feature/time-tracking/time-tracking.component.ts
git commit -m "refactor: extract shared attendance formatters used by the new detail drawer and list component"
```

---

### Task 2: `AttendanceDayDetail` model + API service method

**Files:**
- Modify: `src/app/modules/attendance/models/time-tracking.model.ts`
- Modify: `src/app/modules/attendance/data-access/time-tracking-api.service.ts`
- Modify: `src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts`

**Interfaces:**
- Produces: `TimelineEvent`, `ActivityAppUsage`, `ActivityDailySummary`, `AttendanceDayDetail` interfaces (model); `TimeTrackingApiService.getDayDetail(employeeId: string, date: string): Observable<AttendanceDayDetail>`. Task 3 (store) calls this method exactly.

- [ ] **Step 1: Write the failing API service test**

Add to `src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts`, add `AttendanceDayDetail` to the existing model import, and add this test (anywhere inside the `describe('TimeTrackingApiService', ...)` block):

```ts
it('getDayDetail calls the history-detail endpoint with employeeId and date', () => {
  const detail: AttendanceDayDetail = {
    summary: {
      attendanceRecordId: 'record-1',
      workDate: '2026-08-27',
      employee: null,
      clockInAt: '2026-08-27T04:00:00Z',
      clockOutAt: null,
      isActive: true,
      breakMinutes: 0,
      totalWorkedMinutes: 120,
      expectedWorkMode: 'onsite',
      attendanceSource: 'web',
      status: 'clocked_in',
      canViewDetails: true,
      canRequestCorrection: true,
      canRequestWorkAreaChange: false,
      canCorrect: false
    },
    timelineEvents: [{ eventType: 'ClockIn', timestamp: '2026-08-27T04:00:00Z', source: 'web' }],
    dailyActivity: null
  };

  service.getDayDetail('employee-1', '2026-08-27').subscribe((response) => expect(response).toEqual(detail));

  const request = httpMock.expectOne(`${base}/history-detail?employeeId=employee-1&date=2026-08-27`);
  expect(request.request.method).toBe('GET');
  request.flush(detail);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts`
Expected: FAIL — `AttendanceDayDetail` and `getDayDetail` don't exist yet.

- [ ] **Step 3: Add the models**

Append to `src/app/modules/attendance/models/time-tracking.model.ts`:

```ts
export interface TimelineEvent {
  eventType: 'ClockIn' | 'ClockOut' | 'BreakStart' | 'BreakEnd';
  timestamp: string;
  source: string;
}

export interface ActivityAppUsage {
  appName: string;
  totalSeconds: number;
  category: string;
}

export interface ActivityDailySummary {
  totalActiveMinutes: number;
  totalIdleMinutes: number;
  totalMeetingMinutes: number;
  activePercentage: number;
  activityScore: number;
  dataCoveragePercentage: number;
  topApps: ActivityAppUsage[];
}

export interface AttendanceDayDetail {
  summary: AttendanceHistoryRow;
  timelineEvents: TimelineEvent[];
  dailyActivity: ActivityDailySummary | null;
}
```

- [ ] **Step 4: Add the API service method**

In `src/app/modules/attendance/data-access/time-tracking-api.service.ts`, add `AttendanceDayDetail` to the existing model import block, and add this method after `getCoveredHistory`:

```ts
  getDayDetail(employeeId: string, date: string): Observable<AttendanceDayDetail> {
    const params = new HttpParams().set('employeeId', employeeId).set('date', date);
    return this.http.get<AttendanceDayDetail>(`${this.basePath}/history-detail`, { params });
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/attendance/models/time-tracking.model.ts src/app/modules/attendance/data-access/time-tracking-api.service.ts src/app/modules/attendance/data-access/time-tracking-api.service.spec.ts
git commit -m "feat: add AttendanceDayDetail model and TimeTrackingApiService.getDayDetail"
```

---

### Task 3: Store — `loadDayDetail` / `clearDayDetail`

**Files:**
- Modify: `src/app/modules/attendance/state/time-tracking.store.ts`
- Modify: `src/app/modules/attendance/state/time-tracking.store.spec.ts`

**Interfaces:**
- Consumes: `TimeTrackingApiService.getDayDetail(employeeId, date)` from Task 2.
- Produces: `store.dayDetail: Signal<AttendanceDayDetail | null>`, `store.dayDetailLoading: Signal<boolean>`, `store.dayDetailError: Signal<string | null>`, `store.loadDayDetail(employeeId: string, workDate: string): Promise<void>`, `store.clearDayDetail(): void`. Task 4 (drawer) reads/calls these exact names.

- [ ] **Step 1: Write the failing store tests**

Add to `src/app/modules/attendance/state/time-tracking.store.spec.ts`. Add `getDayDetail: ReturnType<typeof vi.fn>;` to the `api` type declaration and `getDayDetail: vi.fn(() => of(dayDetail)),` to the `api` object in `beforeEach` (define a `dayDetail` fixture constant near the top of the file, alongside `today`/`workAreaRequest`):

```ts
const dayDetail: AttendanceDayDetail = {
  summary: {
    attendanceRecordId: 'record-1',
    workDate: '2026-08-22',
    employee: null,
    clockInAt: '2026-08-22T04:00:00Z',
    clockOutAt: '2026-08-22T12:30:00Z',
    isActive: false,
    breakMinutes: 45,
    totalWorkedMinutes: 465,
    expectedWorkMode: 'onsite',
    attendanceSource: 'web',
    status: 'clocked_out',
    canViewDetails: true,
    canRequestCorrection: true,
    canRequestWorkAreaChange: false,
    canCorrect: false
  },
  timelineEvents: [],
  dailyActivity: null
};
```

Add `AttendanceDayDetail` to the existing `import { AttendanceTodayResponse } from '../models/time-tracking.model';` line.

Add these tests inside the `describe('TimeTrackingStore', ...)` block:

```ts
it('loads day detail and exposes it on the store', async () => {
  await store.loadDayDetail('employee-1', '2026-08-22');

  expect(api.getDayDetail).toHaveBeenCalledWith('employee-1', '2026-08-22');
  expect(store.dayDetail()).toEqual(dayDetail);
  expect(store.dayDetailLoading()).toBe(false);
  expect(store.dayDetailError()).toBeNull();
});

it('clears any previous day detail before loading a new one', async () => {
  await store.loadDayDetail('employee-1', '2026-08-22');
  expect(store.dayDetail()).not.toBeNull();

  const pending = new Subject<AttendanceDayDetail>();
  api.getDayDetail.mockReturnValueOnce(pending);
  const loadPromise = store.loadDayDetail('employee-2', '2026-08-23');

  expect(store.dayDetail()).toBeNull();
  expect(store.dayDetailLoading()).toBe(true);

  pending.next(dayDetail);
  pending.complete();
  await loadPromise;
});

it('sets a friendly error and clears loading when getDayDetail fails', async () => {
  api.getDayDetail.mockReturnValueOnce(throwError(() => new Error('network error')));

  await store.loadDayDetail('employee-1', '2026-08-22');

  expect(store.dayDetailLoading()).toBe(false);
  expect(store.dayDetailError()).toBe('A friendly attendance error.');
  expect(store.dayDetail()).toBeNull();
});

it('clearDayDetail resets detail state', async () => {
  await store.loadDayDetail('employee-1', '2026-08-22');
  store.clearDayDetail();

  expect(store.dayDetail()).toBeNull();
  expect(store.dayDetailLoading()).toBe(false);
  expect(store.dayDetailError()).toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/attendance/state/time-tracking.store.spec.ts`
Expected: FAIL — `store.loadDayDetail`/`store.dayDetail`/etc. don't exist yet.

- [ ] **Step 3: Add the state fields**

In `src/app/modules/attendance/state/time-tracking.store.ts`, add `AttendanceDayDetail` to the existing model import block. Add this constant near the other `export const TIME_TRACKING_*_ERROR` constants:

```ts
export const TIME_TRACKING_DAY_DETAIL_ERROR = 'Could not load attendance details. Try again.';
```

Add to the `TimeTrackingState` interface (after `readonly selectedCoveredEmployeeId: string | null;`):

```ts
  readonly dayDetail: AttendanceDayDetail | null;
  readonly dayDetailLoading: boolean;
  readonly dayDetailError: string | null;
```

Add to `initialState` (after `selectedCoveredEmployeeId: null,`):

```ts
  dayDetail: null,
  dayDetailLoading: false,
  dayDetailError: null,
```

- [ ] **Step 4: Add the store methods**

Add these two methods to the object returned from `withMethods`, right after `loadCoveredHistory`:

```ts
      async loadDayDetail(employeeId: string, workDate: string): Promise<void> {
        if (store.dayDetailLoading()) return;
        patchState(store, { dayDetailLoading: true, dayDetailError: null, dayDetail: null });
        try {
          const detail = await firstValueFrom(api.getDayDetail(employeeId, workDate));
          patchState(store, { dayDetail: detail, dayDetailLoading: false, dayDetailError: null });
        } catch (error) {
          patchState(store, { dayDetailLoading: false, dayDetailError: errors.toSafeMessage(error, TIME_TRACKING_DAY_DETAIL_ERROR) });
        }
      },

      clearDayDetail(): void {
        patchState(store, { dayDetail: null, dayDetailLoading: false, dayDetailError: null });
      },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/attendance/state/time-tracking.store.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/attendance/state/time-tracking.store.ts src/app/modules/attendance/state/time-tracking.store.spec.ts
git commit -m "feat: add TimeTrackingStore.loadDayDetail/clearDayDetail"
```

---

### Task 4: `AttendanceDetailDrawerComponent`

**Files:**
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.ts`
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.html`
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.css`
- Create: `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.spec.ts`

**Interfaces:**
- Consumes: `store.dayDetail/dayDetailLoading/dayDetailError/loadDayDetail` from Task 3; `formatDate/formatDateTime/formatMinutes/workModeLabel/sourceLabel/statusLabel/timelineEventLabel` from Task 1.
- Produces: `AttendanceDetailSelection { employeeId: string; workDate: string }` (exported type); component selector `app-attendance-detail-drawer` with inputs `selection: AttendanceDetailSelection | null` (default `null`), `displayTimezone: string` (default `'UTC'`), outputs `closed: void` and `requestCorrection: AttendanceHistoryRow` (emits `store.dayDetail()!.summary` when the Summary section's "Request correction" button is clicked — only rendered when `detail.summary.canRequestCorrection` is true). Part 2 renders `<app-attendance-detail-drawer [selection]="selectedDetail()" [displayTimezone]="displayTimezone()" (closed)="closeDetailDrawer()" (requestCorrection)="openCorrection($event)" />` in both the My-history and Team-attendance sections, reusing the existing `openCorrection(row: AttendanceHistoryRow)` method already on `time-tracking.component.ts` — this exact selector/input/output contract is what Part 2 wires up, so do not rename any of them. This replaces the "Request correction" link that used to live in the table's now-removed Actions column — it's the only place left to trigger a correction request, so it must be wired, not dropped.

- [ ] **Step 1: Write the failing component tests**

Create `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.spec.ts`:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceDayDetail } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import { AttendanceDetailDrawerComponent, AttendanceDetailSelection } from './attendance-detail-drawer.component';

const detail: AttendanceDayDetail = {
  summary: {
    attendanceRecordId: 'record-1',
    workDate: '2026-08-27',
    employee: null,
    clockInAt: '2026-08-27T04:00:00Z',
    clockOutAt: '2026-08-27T12:30:00Z',
    isActive: false,
    breakMinutes: 45,
    totalWorkedMinutes: 465,
    expectedWorkMode: 'onsite',
    attendanceSource: 'web',
    status: 'clocked_out',
    canViewDetails: true,
    canRequestCorrection: true,
    canRequestWorkAreaChange: false,
    canCorrect: false,
    statusLabel: 'Clocked out'
  },
  timelineEvents: [
    { eventType: 'ClockIn', timestamp: '2026-08-27T04:00:00Z', source: 'web' },
    { eventType: 'ClockOut', timestamp: '2026-08-27T12:30:00Z', source: 'web' }
  ],
  dailyActivity: {
    totalActiveMinutes: 200,
    totalIdleMinutes: 40,
    totalMeetingMinutes: 30,
    activePercentage: 83,
    activityScore: 91,
    dataCoveragePercentage: 95,
    topApps: [{ appName: 'VS Code', totalSeconds: 3600, category: 'productive' }]
  }
};

interface DrawerStoreMock {
  dayDetail: ReturnType<typeof signal<AttendanceDayDetail | null>>;
  dayDetailLoading: ReturnType<typeof signal<boolean>>;
  dayDetailError: ReturnType<typeof signal<string | null>>;
  loadDayDetail: ReturnType<typeof vi.fn>;
  clearDayDetail: ReturnType<typeof vi.fn>;
}

describe('AttendanceDetailDrawerComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(options: {
    selection?: AttendanceDetailSelection | null;
    data?: AttendanceDayDetail | null;
    loading?: boolean;
    error?: string | null;
  } = {}): Promise<{ fixture: ComponentFixture<AttendanceDetailDrawerComponent>; store: DrawerStoreMock }> {
    const store: DrawerStoreMock = {
      dayDetail: signal(options.data ?? null),
      dayDetailLoading: signal(options.loading ?? false),
      dayDetailError: signal(options.error ?? null),
      loadDayDetail: vi.fn(() => Promise.resolve()),
      clearDayDetail: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AttendanceDetailDrawerComponent],
      providers: [{ provide: TimeTrackingStore, useValue: store }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceDetailDrawerComponent);
    fixture.componentRef.setInput('selection', options.selection === undefined ? { employeeId: 'employee-1', workDate: '2026-08-27' } : options.selection);
    fixture.componentRef.setInput('displayTimezone', 'UTC');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, store };
  }

  it('requests the detail for the given selection on open', async () => {
    const { store } = await setup();
    expect(store.loadDayDetail).toHaveBeenCalledWith('employee-1', '2026-08-27');
  });

  it('renders nothing when there is no selection', async () => {
    const { fixture, store } = await setup({ selection: null });
    expect((fixture.nativeElement as HTMLElement).querySelector('.drawer-panel')).toBeNull();
    expect(store.loadDayDetail).not.toHaveBeenCalled();
  });

  it('renders the loading state', async () => {
    const { fixture } = await setup({ loading: true });
    expect((fixture.nativeElement as HTMLElement).querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders a retryable error state', async () => {
    const { fixture } = await setup({ error: 'Could not load attendance details. Try again.' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Could not load attendance details. Try again.');
  });

  it('renders summary, timeline, and daily activity sections when data loads', async () => {
    const { fixture } = await setup({ data: detail });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Summary');
    expect(text).toContain('Timeline');
    expect(text).toContain('Daily activity');
    expect(text).toContain('Clocked in');
    expect(text).toContain('Clocked out');
    expect(text).toContain('productive');
  });

  it('renders a friendly empty state when daily activity is null', async () => {
    const { fixture } = await setup({ data: { ...detail, dailyActivity: null } });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No activity data recorded for this day.');
  });

  it('emits closed when the close button is clicked', async () => {
    const { fixture } = await setup({ data: detail });
    const emitted = vi.fn();
    fixture.componentInstance.closed.subscribe(emitted);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.drawer-close')!.click();
    expect(emitted).toHaveBeenCalledTimes(1);
  });

  it('emits requestCorrection with the summary row when canRequestCorrection is true', async () => {
    const { fixture } = await setup({ data: detail });
    const emitted = vi.fn();
    fixture.componentInstance.requestCorrection.subscribe(emitted);

    fixture.componentInstance.emitRequestCorrection();

    expect(emitted).toHaveBeenCalledWith(detail.summary);
  });

  it('does not render a Request correction button when canRequestCorrection is false', async () => {
    const { fixture } = await setup({ data: { ...detail, summary: { ...detail.summary, canRequestCorrection: false } } });
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Request correction');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.spec.ts`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Create the component class**

Create `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { AttendanceHistoryRow } from '../../../models/time-tracking.model';
import { TimeTrackingStore } from '../../../state/time-tracking.store';
import {
  formatDate,
  formatDateTime,
  formatMinutes,
  sourceLabel,
  statusLabel,
  timelineEventLabel,
  workModeLabel
} from '../../../utils/attendance-formatters';

export interface AttendanceDetailSelection {
  employeeId: string;
  workDate: string;
}

@Component({
  selector: 'app-attendance-detail-drawer',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './attendance-detail-drawer.component.html',
  styleUrl: './attendance-detail-drawer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AttendanceDetailDrawerComponent {
  readonly store = inject(TimeTrackingStore);

  readonly selection = input<AttendanceDetailSelection | null>(null);
  readonly displayTimezone = input<string>('UTC');
  readonly closed = output<void>();
  readonly requestCorrection = output<AttendanceHistoryRow>();

  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatMinutes = formatMinutes;
  readonly workModeLabel = workModeLabel;
  readonly sourceLabel = sourceLabel;
  readonly statusLabel = statusLabel;
  readonly timelineEventLabel = timelineEventLabel;

  readonly appUsageByCategory = computed(() => {
    const activity = this.store.dayDetail()?.dailyActivity;
    if (!activity) return [];
    const totals = new Map<string, number>();
    for (const app of activity.topApps) {
      const category = app.category || 'unknown';
      totals.set(category, (totals.get(category) ?? 0) + Math.round(app.totalSeconds / 60));
    }
    return Array.from(totals.entries()).map(([category, minutes]) => ({ category, minutes }));
  });

  constructor() {
    effect(() => {
      const selected = this.selection();
      if (selected) {
        void this.store.loadDayDetail(selected.employeeId, selected.workDate);
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  retry(): void {
    const selected = this.selection();
    if (selected) {
      void this.store.loadDayDetail(selected.employeeId, selected.workDate);
    }
  }

  emitRequestCorrection(): void {
    const detail = this.store.dayDetail();
    if (detail) {
      this.requestCorrection.emit(detail.summary);
    }
  }
}
```

- [ ] **Step 4: Create the template**

Create `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.html`:

```html
@if (selection(); as sel) {
  <div class="drawer-backdrop" (click)="close()"></div>
  <aside class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="attendance-detail-heading">
    <header class="drawer-header">
      <div>
        <p class="eyebrow">Attendance detail</p>
        <h2 id="attendance-detail-heading">{{ formatDate(sel.workDate) }}</h2>
      </div>
      <button type="button" class="drawer-close" aria-label="Close" (click)="close()">&#x2715;</button>
    </header>

    @if (store.dayDetailLoading()) {
      <div class="drawer-skeleton" aria-busy="true" aria-label="Loading attendance detail"></div>
    } @else if (store.dayDetailError()) {
      <div class="time-tracking-message time-tracking-message--error" role="alert">
        <p>{{ store.dayDetailError() }}</p>
        <app-button type="button" variant="secondary" size="sm" (pressed)="retry()">Try again</app-button>
      </div>
    } @else if (store.dayDetail(); as detail) {
      <section class="drawer-section" aria-labelledby="drawer-summary-heading">
        <h3 id="drawer-summary-heading">Summary</h3>
        <dl class="drawer-summary-grid">
          <div><dt>Clock in</dt><dd>{{ formatDateTime(detail.summary.clockInAt, displayTimezone()) }}</dd></div>
          <div><dt>Clock out</dt><dd>{{ formatDateTime(detail.summary.clockOutAt, displayTimezone()) }}</dd></div>
          <div><dt>Break</dt><dd>{{ formatMinutes(detail.summary.breakMinutes) }}</dd></div>
          <div><dt>Worked time</dt><dd>{{ formatMinutes(detail.summary.totalWorkedMinutes) }}</dd></div>
          <div><dt>Work mode</dt><dd>{{ workModeLabel(detail.summary.expectedWorkMode) }}</dd></div>
          <div><dt>Source</dt><dd>{{ sourceLabel(detail.summary.attendanceSource) }}</dd></div>
          <div><dt>Status</dt><dd>{{ statusLabel(detail.summary.status, detail.summary.statusLabel) }}</dd></div>
        </dl>
        @if (detail.summary.canRequestCorrection) {
          <app-button type="button" variant="secondary" size="sm" (pressed)="emitRequestCorrection()">Request correction</app-button>
        }
      </section>

      <section class="drawer-section" aria-labelledby="drawer-timeline-heading">
        <h3 id="drawer-timeline-heading">Timeline</h3>
        @if (detail.timelineEvents.length === 0) {
          <p class="empty-copy">No clock or break events recorded for this day.</p>
        } @else {
          <ol class="drawer-timeline">
            @for (event of detail.timelineEvents; track event.timestamp + event.eventType) {
              <li>
                <span class="drawer-timeline-label">{{ timelineEventLabel(event.eventType) }}</span>
                <span class="drawer-timeline-time">{{ formatDateTime(event.timestamp, displayTimezone()) }}</span>
                <span class="table-secondary">{{ sourceLabel(event.source) }}</span>
              </li>
            }
          </ol>
        }
      </section>

      <section class="drawer-section" aria-labelledby="drawer-activity-heading">
        <h3 id="drawer-activity-heading">Daily activity</h3>
        @if (detail.dailyActivity; as activity) {
          <div class="drawer-stat-grid">
            <div class="drawer-stat"><span class="metric-label">Active time</span><strong>{{ formatMinutes(activity.totalActiveMinutes) }}</strong></div>
            <div class="drawer-stat"><span class="metric-label">Idle time</span><strong>{{ formatMinutes(activity.totalIdleMinutes) }}</strong></div>
            <div class="drawer-stat"><span class="metric-label">Meeting time</span><strong>{{ formatMinutes(activity.totalMeetingMinutes) }}</strong></div>
            <div class="drawer-stat"><span class="metric-label">Activity score</span><strong>{{ activity.activityScore }}</strong></div>
          </div>
          @if (appUsageByCategory().length > 0) {
            <ul class="drawer-app-usage">
              @for (item of appUsageByCategory(); track item.category) {
                <li><span class="table-primary">{{ item.category }}</span><span class="table-secondary">{{ formatMinutes(item.minutes) }}</span></li>
              }
            </ul>
          }
        } @else {
          <p class="empty-copy">No activity data recorded for this day.</p>
        }
      </section>
    }
  </aside>
}
```

- [ ] **Step 5: Create the styles**

Create `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.css`:

```css
:host{display:contents}.drawer-backdrop{position:fixed;inset:0;z-index:1150;background:rgba(0,0,0,.45)}.drawer-panel{position:fixed;top:0;right:0;bottom:0;z-index:1151;display:flex;width:min(28rem,100vw);flex-direction:column;gap:1rem;overflow-y:auto;padding:1.5rem;background:var(--color-surface);box-shadow:-8px 0 24px rgba(0,0,0,.18)}.drawer-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.drawer-close{border:0;background:transparent;color:var(--color-text-secondary);font-size:1rem;cursor:pointer}.drawer-close:hover{color:var(--color-text-primary)}.drawer-section{display:flex;flex-direction:column;gap:.6rem;padding-top:1rem;border-top:1px solid color-mix(in srgb,var(--color-border) 75%,transparent)}.drawer-section:first-of-type{padding-top:0;border-top:0}.drawer-section h3{margin:0;color:var(--color-text-primary);font-size:.8125rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}.drawer-summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin:0}.drawer-summary-grid dt{color:var(--color-text-secondary);font-size:.6875rem}.drawer-summary-grid dd{margin:0;color:var(--color-text-primary);font-weight:600}.drawer-timeline{display:flex;flex-direction:column;gap:.5rem;margin:0;padding:0;list-style:none}.drawer-timeline li{display:flex;align-items:baseline;gap:.5rem;font-size:.8125rem}.drawer-timeline-label{flex:1;color:var(--color-text-primary);font-weight:600}.drawer-timeline-time{color:var(--color-text-secondary)}.drawer-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.6rem}.drawer-stat{display:flex;flex-direction:column;gap:.25rem;padding:.75rem;border-radius:10px;background:color-mix(in srgb,var(--color-surface-secondary) 40%,var(--color-surface))}.drawer-stat strong{color:var(--color-text-primary);font-size:.9375rem}.drawer-app-usage{display:flex;flex-direction:column;gap:.4rem;margin:.25rem 0 0;padding:0;list-style:none}.drawer-app-usage li{display:flex;align-items:center;justify-content:space-between;font-size:.8125rem}.drawer-skeleton{height:16rem;border-radius:var(--radius-content);background:var(--color-surface-secondary);animation:time-tracking-pulse 1.5s ease-in-out infinite}@keyframes time-tracking-pulse{50%{opacity:.55}}@media(max-width:520px){.drawer-panel{width:100vw}}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/
git commit -m "feat: add AttendanceDetailDrawerComponent (summary/timeline/daily activity)"
```

---

## After this part

Part 2 (`part-2.md` in this same folder) wires this drawer into `time-tracking.component`, extracts the trimmed history list component, moves "My requests" beside it, and does the manual browser verification against the live backend.
