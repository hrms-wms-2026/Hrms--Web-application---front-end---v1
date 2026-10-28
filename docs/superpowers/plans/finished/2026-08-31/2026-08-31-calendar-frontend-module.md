# Calendar Frontend Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tenant-app Calendar feature: a month-view calendar page reachable from the existing sidebar `Calendar` nav item, with create/edit/delete of events (including participants) and recurrence support (Daily/Weekly/Monthly, this-event/all-events editing), replacing today's `loadPlaceholder` stub at `/calendar`.

**Architecture:** A new lazy-loaded `modules/calendar/` feature module following this repo's existing `modules/leave/` shape exactly: `data-access/` (HTTP), `models/`, `state/` (an `@ngrx/signals` store), `feature/` (the routed page), `ui/` (presentational components), `utils/` (pure recurrence/grid helpers). The month grid and event form are custom-built with the existing shared `app-date-picker`/`app-input`/`app-select`/`app-modal` components and Tailwind tokens - no new UI library.

**Tech Stack:** Angular (standalone components, signals, `@ngrx/signals`), Reactive Forms, Vitest (`ng test`), Tailwind v4 with this repo's `--color-*` design tokens.

**Spec:** `docs/superpowers/specs/finished/2026-08-31/2026-08-31-calendar-r1-recurrence-and-frontend-design.md` (copy from the backend repo `HRMS-Backend-v1` if not already present here - it covers both the backend recurrence engine, already shipped on `feature/calendar-recurrence-engine`, and this plan's "Part 2 — Frontend Architecture"). This plan implements Part 2 against that backend's **actual shipped contract**, confirmed by live testing during backend implementation:
- `GET api/v1/calendar?from=&to=` → `{ events: CalendarEventViewModel[] }`, each item carrying `isRecurringOccurrence`, `recurrenceMasterId`, `originalStart`.
- `POST api/v1/calendar` (`CreateCalendarEventRequest`, includes `recurrenceRule` - required whenever `recurrence != 'none'`).
- `PUT api/v1/calendar/{id}` / `DELETE api/v1/calendar/{id}` - plain events and already-detached occurrences.
- `PUT api/v1/calendar/{id}/occurrence` (body carries `originalStart` + `scope: 'ThisEventOnly' | 'AllEvents'`) / `DELETE api/v1/calendar/{id}/occurrence?originalStart=` - recurring virtual occurrences, addressed by the master's id.

## Global Constraints

- Branch off this repo's current `development` tip.
- Match existing conventions exactly: `signalStore({ providedIn: 'root' }, withState(...), withMethods((store, api = inject(XApiService)) => ({...})))` for state, `firstValueFrom(api.x())` + try/catch + `patchState` (not `.subscribe`) in every store method, errors via `toSafeErrorMessage(err, fallback)` from `src/app/core/services/error-handler.service.ts`.
- Reuse shared UI: `app-date-picker` (`src/app/shared/ui/date-picker`), `app-input`/`app-select`/`app-button` (`src/app/shared/ui/{input,select,button}`), `app-modal` (`src/app/shared/ui/modal`).
- No new npm dependency for the month grid or recurrence text - both are small enough to hand-write, matching this repo's existing "no calendar library" pattern noted during design.
- Recurrence UI in R1 is a plain dropdown (Does not repeat / Daily / Weekly / Monthly) with no multi-day-of-week "Custom" builder - `recurrence-rule.util.ts` only ever emits `FREQ=<X>` or `FREQ=<X>;UNTIL=<...>`, matching the backend's default-to-DTSTART-weekday/day-of-month behavior.
- Test with Vitest via `TestBed` + `HttpTestingController` (stores) or `{ provide: X, useValue: { ...vi.fn() } }` mocks (components) - this repo's actual pattern, not Angular Testing Library.

---

### Task 1: Models and API service

**Files:**
- Create: `src/app/modules/calendar/models/calendar-event.model.ts`
- Create: `src/app/modules/calendar/data-access/calendar-event-api.service.ts`
- Test: `src/app/modules/calendar/data-access/calendar-event-api.service.spec.ts`

**Interfaces:**
- Produces: `CalendarEventResponse`, `CalendarEventsResponse`, `CreateCalendarEventRequest`, `UpdateCalendarEventRequest`, `RecurrenceEditScope`, `EditRecurringOccurrenceRequest`, `CalendarEventApiService`.

- [ ] **Step 1: Write the models**

```ts
// src/app/modules/calendar/models/calendar-event.model.ts
export interface CalendarEventResponse {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  sourceType: string;
  color: string | null;
  recurrence: string;
  isAllDay: boolean;
  timezone: string | null;
  eventStatus: string | null;
  isPrivate: boolean;
  location: string | null;
  meetingLink: string | null;
  externalSource: string | null;
  createdById: string;
  isRecurringOccurrence: boolean;
  recurrenceMasterId: string | null;
  originalStart: string | null;
}

export interface CalendarEventsResponse {
  events: readonly CalendarEventResponse[];
}

export interface CreateCalendarEventRequest {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  color: string | null;
  recurrence: string;
  participantEmployeeIds: readonly string[];
  recurrenceRule: string | null;
}

export interface UpdateCalendarEventRequest {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  color: string | null;
  recurrence: string;
}

export type RecurrenceEditScope = 'ThisEventOnly' | 'AllEvents';

export interface EditRecurringOccurrenceRequest {
  originalStart: string;
  scope: RecurrenceEditScope;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingLink: string | null;
  color: string | null;
}
```

- [ ] **Step 2: Write the failing API service test**

```ts
// src/app/modules/calendar/data-access/calendar-event-api.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalendarEventApiService } from './calendar-event-api.service';

describe('CalendarEventApiService', () => {
  let service: CalendarEventApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CalendarEventApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CalendarEventApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getEvents requests the date range as query params', () => {
    service.getEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z').subscribe();
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/calendar` && r.params.get('from') === '2026-09-01T00:00:00Z' && r.params.get('to') === '2026-09-30T00:00:00Z'
    );
    req.flush({ events: [] });
  });

  it('create posts to the base url', () => {
    service.create({
      title: 'Standup', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      isAllDay: false, timezone: 'UTC', location: null, meetingLink: null, color: null,
      recurrence: 'none', participantEmployeeIds: [], recurrenceRule: null
    }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('editOccurrence puts to {masterId}/occurrence', () => {
    service.editOccurrence('master-1', {
      originalStart: '2026-09-08T09:00:00Z', scope: 'ThisEventOnly', title: 'X', description: null,
      startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z', isAllDay: false,
      timezone: 'UTC', location: null, meetingLink: null, color: null
    }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/master-1/occurrence`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('cancelOccurrence deletes {masterId}/occurrence with originalStart as a query param', () => {
    service.cancelOccurrence('master-1', '2026-09-15T09:00:00Z').subscribe();
    const req = http.expectOne(
      (r) => r.url === `${environment.apiUrl}/calendar/master-1/occurrence` && r.params.get('originalStart') === '2026-09-15T09:00:00Z'
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `ng test --include='**/calendar-event-api.service.spec.ts'`
Expected: FAIL - `CalendarEventApiService` does not exist yet.

- [ ] **Step 4: Write the service**

```ts
// src/app/modules/calendar/data-access/calendar-event-api.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CalendarEventResponse, CalendarEventsResponse, CreateCalendarEventRequest,
  EditRecurringOccurrenceRequest, UpdateCalendarEventRequest
} from '../models/calendar-event.model';

@Injectable({ providedIn: 'root' })
export class CalendarEventApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/calendar`;

  getEvents(from: string, to: string): Observable<CalendarEventsResponse> {
    return this.http.get<CalendarEventsResponse>(this.baseUrl, { params: { from, to } });
  }

  create(payload: CreateCalendarEventRequest): Observable<CalendarEventResponse> {
    return this.http.post<CalendarEventResponse>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateCalendarEventRequest): Observable<CalendarEventResponse> {
    return this.http.put<CalendarEventResponse>(`${this.baseUrl}/${id}`, payload);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  editOccurrence(masterId: string, payload: EditRecurringOccurrenceRequest): Observable<CalendarEventResponse> {
    return this.http.put<CalendarEventResponse>(`${this.baseUrl}/${masterId}/occurrence`, payload);
  }

  cancelOccurrence(masterId: string, originalStart: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${masterId}/occurrence`, { params: { originalStart } });
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `ng test --include='**/calendar-event-api.service.spec.ts'`
Expected: 4 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/models/ src/app/modules/calendar/data-access/
git commit -m "feat(calendar): add CalendarEventApiService and models"
```

---

### Task 2: `CalendarEventStore`

**Files:**
- Create: `src/app/modules/calendar/state/calendar-event.store.ts`
- Test: `src/app/modules/calendar/state/calendar-event.store.spec.ts`

**Interfaces:**
- Consumes: `CalendarEventApiService` (Task 1).
- Produces: `CalendarEventStore` with signals `events`, `loading`, `loadError`, `saving`, `actionError`; methods `loadEvents(from, to)`, `createEvent(payload)`, `updateEvent(id, payload)`, `deleteEvent(id)`, `editOccurrence(masterId, payload, from, to)`, `cancelOccurrence(masterId, originalStart, from, to)`.

- [ ] **Step 1: Write the failing store tests**

```ts
// src/app/modules/calendar/state/calendar-event.store.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CalendarEventResponse } from '../models/calendar-event.model';
import { CalendarEventStore } from './calendar-event.store';

function makeEvent(overrides: Partial<CalendarEventResponse> = {}): CalendarEventResponse {
  return {
    id: 'e1', title: 'Standup', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, ...overrides
  };
}

describe('CalendarEventStore', () => {
  let store: InstanceType<typeof CalendarEventStore>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CalendarEventStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(CalendarEventStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads events into state', async () => {
    const work = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent()] });
    await work;
    expect(store.events().map((e) => e.id)).toEqual(['e1']);
    expect(store.loadError()).toBeNull();
  });

  it('sets loadError on a failed load', async () => {
    const work = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ detail: 'boom' }, { status: 500, statusText: 'Error' });
    await work;
    expect(store.loadError()).toBeTruthy();
  });

  it('createEvent appends the created event on success', async () => {
    const work = store.createEvent({
      title: 'New', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      isAllDay: false, timezone: 'UTC', location: null, meetingLink: null, color: null,
      recurrence: 'none', participantEmployeeIds: [], recurrenceRule: null
    });
    http.expectOne(`${environment.apiUrl}/calendar`).flush(makeEvent({ id: 'e2', title: 'New' }));
    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).toContain('e2');
  });

  it('deleteEvent removes the event from state on success', async () => {
    TestBed.runInInjectionContext(() => {});
    // seed state via a load first
    const load = store.loadEvents('2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'e3' })] });
    await load;

    const work = store.deleteEvent('e3');
    http.expectOne(`${environment.apiUrl}/calendar/e3`).flush(null);
    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).not.toContain('e3');
  });

  it('editOccurrence refreshes events after a successful edit', async () => {
    const work = store.editOccurrence('master-1', {
      originalStart: '2026-09-08T09:00:00Z', scope: 'ThisEventOnly', title: 'X', description: null,
      startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z', isAllDay: false,
      timezone: 'UTC', location: null, meetingLink: null, color: null
    }, '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');

    http.expectOne(`${environment.apiUrl}/calendar/master-1/occurrence`).flush(makeEvent());
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'refreshed' })] });

    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).toEqual(['refreshed']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --include='**/calendar-event.store.spec.ts'`
Expected: FAIL - `CalendarEventStore` does not exist yet.

- [ ] **Step 3: Write the store**

```ts
// src/app/modules/calendar/state/calendar-event.store.ts
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { CalendarEventApiService } from '../data-access/calendar-event-api.service';
import {
  CalendarEventResponse, CreateCalendarEventRequest, EditRecurringOccurrenceRequest, UpdateCalendarEventRequest
} from '../models/calendar-event.model';

interface CalendarEventState {
  readonly events: readonly CalendarEventResponse[];
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly saving: boolean;
  readonly actionError: string | null;
}

export const CalendarEventStore = signalStore(
  { providedIn: 'root' },
  withState<CalendarEventState>({ events: [], loading: false, loadError: null, saving: false, actionError: null }),
  withMethods((store, api = inject(CalendarEventApiService)) => ({
    async loadEvents(from: string, to: string): Promise<void> {
      patchState(store, { loading: true, loadError: null });
      try {
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { events: response.events, loading: false });
      } catch (err) {
        patchState(store, { loading: false, loadError: toSafeErrorMessage(err, 'Failed to load calendar events.') });
      }
    },
    async createEvent(payload: CreateCalendarEventRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        const created = await firstValueFrom(api.create(payload));
        patchState(store, { saving: false, events: [...store.events(), created] });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to create event.') });
        return false;
      }
    },
    async updateEvent(id: string, payload: UpdateCalendarEventRequest): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        const updated = await firstValueFrom(api.update(id, payload));
        patchState(store, { saving: false, events: store.events().map((e) => (e.id === id ? updated : e)) });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update event.') });
        return false;
      }
    },
    async deleteEvent(id: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.delete(id));
        patchState(store, { saving: false, events: store.events().filter((e) => e.id !== id) });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to delete event.') });
        return false;
      }
    },
    async editOccurrence(
      masterId: string, payload: EditRecurringOccurrenceRequest, from: string, to: string
    ): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.editOccurrence(masterId, payload));
        // A this-event/all-events edit can change which virtual occurrences exist (a detached
        // row swaps in for one virtual date) - re-fetching the range is the simplest correct way
        // to reconcile state rather than patching the returned single item into the flat list.
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { saving: false, events: response.events });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to update this occurrence.') });
        return false;
      }
    },
    async cancelOccurrence(masterId: string, originalStart: string, from: string, to: string): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.cancelOccurrence(masterId, originalStart));
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { saving: false, events: response.events });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to cancel this occurrence.') });
        return false;
      }
    }
  }))
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `ng test --include='**/calendar-event.store.spec.ts'`
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/calendar/state/
git commit -m "feat(calendar): add CalendarEventStore"
```

---

### Task 3: Recurrence and month-grid utilities

**Files:**
- Create: `src/app/modules/calendar/utils/recurrence-rule.util.ts`
- Test: `src/app/modules/calendar/utils/recurrence-rule.util.spec.ts`
- Create: `src/app/modules/calendar/utils/calendar-grid.util.ts`
- Test: `src/app/modules/calendar/utils/calendar-grid.util.spec.ts`

**Interfaces:**
- Produces: `RecurrenceFrequency`, `RecurrenceEndMode`, `buildRecurrenceRule(frequency, endMode, untilDate)`, `describeRecurrence(frequency, endMode, untilDate)`, `buildMonthGrid(year, month)` returning `readonly CalendarGridDay[]` (`{ date: string; isCurrentMonth: boolean; isToday: boolean }`, 42 cells / 6 weeks, Monday-start).

- [ ] **Step 1: Write the failing recurrence-rule tests**

```ts
// src/app/modules/calendar/utils/recurrence-rule.util.spec.ts
import { buildRecurrenceRule, describeRecurrence } from './recurrence-rule.util';

describe('buildRecurrenceRule', () => {
  it('returns null for "none"', () => {
    expect(buildRecurrenceRule('none', 'never', null)).toBeNull();
  });

  it('returns a bare FREQ for "never" end mode', () => {
    expect(buildRecurrenceRule('daily', 'never', null)).toBe('FREQ=DAILY');
    expect(buildRecurrenceRule('weekly', 'never', null)).toBe('FREQ=WEEKLY');
    expect(buildRecurrenceRule('monthly', 'never', null)).toBe('FREQ=MONTHLY');
  });

  it('appends UNTIL for "until" end mode with a date', () => {
    expect(buildRecurrenceRule('weekly', 'until', '2026-12-31')).toBe('FREQ=WEEKLY;UNTIL=20261231T235959Z');
  });

  it('falls back to bare FREQ if "until" mode has no date yet', () => {
    expect(buildRecurrenceRule('weekly', 'until', null)).toBe('FREQ=WEEKLY');
  });
});

describe('describeRecurrence', () => {
  it('describes "none" as "Does not repeat"', () => {
    expect(describeRecurrence('none', 'never', null)).toBe('Does not repeat');
  });

  it('describes a never-ending frequency', () => {
    expect(describeRecurrence('daily', 'never', null)).toBe('Daily');
  });

  it('describes an until-dated frequency', () => {
    expect(describeRecurrence('weekly', 'until', '2026-12-31')).toBe('Weekly, until 2026-12-31');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/recurrence-rule.util.spec.ts'`
Expected: FAIL - module does not exist yet.

- [ ] **Step 3: Write `recurrence-rule.util.ts`**

```ts
// src/app/modules/calendar/utils/recurrence-rule.util.ts
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly';
export type RecurrenceEndMode = 'never' | 'until';

export function buildRecurrenceRule(
  frequency: RecurrenceFrequency, endMode: RecurrenceEndMode, untilDate: string | null
): string | null {
  if (frequency === 'none') return null;
  const freqPart = `FREQ=${frequency.toUpperCase()}`;
  if (endMode === 'until' && untilDate) {
    return `${freqPart};UNTIL=${untilDate.replace(/-/g, '')}T235959Z`;
  }
  return freqPart;
}

export function describeRecurrence(
  frequency: RecurrenceFrequency, endMode: RecurrenceEndMode, untilDate: string | null
): string {
  if (frequency === 'none') return 'Does not repeat';
  const label = frequency.charAt(0).toUpperCase() + frequency.slice(1);
  if (endMode === 'until' && untilDate) return `${label}, until ${untilDate}`;
  return label;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `ng test --include='**/recurrence-rule.util.spec.ts'`
Expected: 7 passing tests.

- [ ] **Step 5: Write the failing calendar-grid tests**

```ts
// src/app/modules/calendar/utils/calendar-grid.util.spec.ts
import { buildMonthGrid } from './calendar-grid.util';

describe('buildMonthGrid', () => {
  it('returns 42 cells (6 weeks)', () => {
    expect(buildMonthGrid(2026, 9).length).toBe(42);
  });

  it('starts on the Monday on/before the 1st of the month', () => {
    // September 2026: the 1st is a Tuesday, so the grid starts Monday Aug 31
    const grid = buildMonthGrid(2026, 9);
    expect(grid[0].date).toBe('2026-08-31');
    expect(grid[0].isCurrentMonth).toBe(false);
  });

  it('marks days in the requested month as isCurrentMonth', () => {
    const grid = buildMonthGrid(2026, 9);
    const sep1 = grid.find((d) => d.date === '2026-09-01');
    expect(sep1?.isCurrentMonth).toBe(true);
  });

  it('marks exactly one day as isToday when today falls in the grid', () => {
    const grid = buildMonthGrid(2026, 9);
    const todayCount = grid.filter((d) => d.isToday).length;
    expect(todayCount).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `ng test --include='**/calendar-grid.util.spec.ts'`
Expected: FAIL - module does not exist yet.

- [ ] **Step 7: Write `calendar-grid.util.ts`**

```ts
// src/app/modules/calendar/utils/calendar-grid.util.ts
export interface CalendarGridDay {
  readonly date: string; // 'YYYY-MM-DD'
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** month is 1-indexed (1 = January) to match this module's other date-string conventions. */
export function buildMonthGrid(year: number, month: number): readonly CalendarGridDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const jsDay = firstOfMonth.getDay(); // 0 = Sunday
  const daysBackToMonday = jsDay === 0 ? 6 : jsDay - 1;
  const gridStart = new Date(year, month - 1, 1 - daysBackToMonday);

  const todayStr = toDateString(new Date());
  const days: CalendarGridDay[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    const dateStr = toDateString(cellDate);
    days.push({ date: dateStr, isCurrentMonth: cellDate.getMonth() === month - 1, isToday: dateStr === todayStr });
  }
  return days;
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `ng test --include='**/calendar-grid.util.spec.ts'`
Expected: 4 passing tests.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/calendar/utils/
git commit -m "feat(calendar): add recurrence-rule and month-grid pure utilities"
```

---

### Task 4: `CalendarParticipantPickerComponent`

**Files:**
- Create: `src/app/modules/calendar/ui/calendar-participant-picker/calendar-participant-picker.component.ts`
- Test: `src/app/modules/calendar/ui/calendar-participant-picker/calendar-participant-picker.component.spec.ts`

**Interfaces:**
- Consumes: `PeopleApiService.listEmployees` (existing, `src/app/modules/people/data-access/people-api.service.ts`), `ModalComponent` (existing, `src/app/shared/ui/modal`).
- Produces: `CalendarParticipantPickerComponent` - multi-select fork of the existing single-select `employee-picker`: `open` input, `selectedIds` input, `selectedIdsChange`/`closed` outputs.

- [ ] **Step 1: Write the failing component test**

```ts
// src/app/modules/calendar/ui/calendar-participant-picker/calendar-participant-picker.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { CalendarParticipantPickerComponent } from './calendar-participant-picker.component';

describe('CalendarParticipantPickerComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarParticipantPickerComponent>>;
  let peopleApi: { listEmployees: ReturnType<typeof vi.fn> };

  const employees = [
    { id: 'emp-1', fullName: 'Ada Lovelace', email: 'ada@example.com', departmentName: 'Engineering' },
    { id: 'emp-2', fullName: 'Grace Hopper', email: 'grace@example.com', departmentName: 'Engineering' }
  ];

  beforeEach(async () => {
    peopleApi = { listEmployees: vi.fn().mockReturnValue(of({ items: employees, totalCount: 2, page: 1, pageSize: 20 })) };
    await TestBed.configureTestingModule({
      imports: [CalendarParticipantPickerComponent],
      providers: [{ provide: PeopleApiService, useValue: peopleApi }]
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarParticipantPickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('selectedIds', ['emp-1']);
    fixture.detectChanges();
  });

  it('queries employees when opened', () => {
    expect(peopleApi.listEmployees).toHaveBeenCalledWith({ search: '', page: 1, pageSize: 20 });
  });

  it('renders a row per result with the already-selected one marked', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute('data-selected')).toBe('true');
    expect(rows[1].getAttribute('data-selected')).toBe('false');
  });

  it('emits selectedIdsChange with the toggled id added', () => {
    const spy = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(spy);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    rows[1].click();
    expect(spy).toHaveBeenCalledWith(['emp-1', 'emp-2']);
  });

  it('emits selectedIdsChange with the toggled id removed when already selected', () => {
    const spy = vi.fn();
    fixture.componentInstance.selectedIdsChange.subscribe(spy);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-participant-picker-row"]');
    rows[0].click();
    expect(spy).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-participant-picker.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/ui/calendar-participant-picker/calendar-participant-picker.component.ts
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';

@Component({
  selector: 'app-calendar-participant-picker',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" title="Add participants" (closed)="closed.emit()">
      <input
        data-testid="calendar-participant-picker-search"
        type="text"
        placeholder="Search by name or email"
        class="mb-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]"
        (input)="onSearchInput($event)"
      />
      <div class="flex max-h-64 flex-col gap-1 overflow-y-auto">
        @for (employee of results(); track employee.id) {
          <button
            type="button"
            data-testid="calendar-participant-picker-row"
            [attr.data-selected]="isSelected(employee.id)"
            class="flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-secondary)]"
            (click)="toggle(employee.id)"
          >
            <span class="flex flex-col items-start">
              <span class="font-medium text-[var(--color-text-primary)]">{{ employee.fullName }}</span>
              <span class="text-[10px] text-[var(--color-text-secondary)]">{{ employee.email }} · {{ employee.departmentName }}</span>
            </span>
            @if (isSelected(employee.id)) {
              <span class="text-[var(--color-accent)]">✓</span>
            }
          </button>
        }
      </div>
    </app-modal>
  `
})
export class CalendarParticipantPickerComponent {
  private readonly peopleApi = inject(PeopleApiService);

  open = input(false);
  selectedIds = input<readonly string[]>([]);
  selectedIdsChange = output<readonly string[]>();
  closed = output<void>();

  results = signal<readonly EmployeeListItemResponse[]>([]);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query('');
      }
    });
  }

  onSearchInput(event: Event): void {
    this.query((event.target as HTMLInputElement).value);
  }

  isSelected(employeeId: string): boolean {
    return this.selectedIds().includes(employeeId);
  }

  toggle(employeeId: string): void {
    const current = this.selectedIds();
    const next = current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId];
    this.selectedIdsChange.emit(next);
  }

  private query(search: string): void {
    this.peopleApi.listEmployees({ search, page: 1, pageSize: 20 }).subscribe((page) => this.results.set(page.items));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `ng test --include='**/calendar-participant-picker.component.spec.ts'`
Expected: 4 passing tests. If `PeopleApiService.listEmployees`'s actual parameter shape or `EmployeeListItemResponse`'s fields differ from what's assumed here, read `src/app/modules/people/data-access/people-api.service.ts` and `src/app/modules/people/models/employee.model.ts` and adjust to match exactly rather than guessing.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-participant-picker/
git commit -m "feat(calendar): add CalendarParticipantPickerComponent"
```

---

### Task 5: `CalendarEventFormModalComponent`

**Files:**
- Create: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts`
- Create: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.html`
- Test: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `app-input`/`app-select`/`app-date-picker`/`app-button`/`app-modal` (existing shared UI), `buildRecurrenceRule`/`RecurrenceFrequency`/`RecurrenceEndMode` (Task 3), `RecurrenceEditScope` (Task 1), `CalendarParticipantPickerComponent` (Task 4).
- Produces: `CalendarEventFormModalComponent` with `@Input() open`, `@Input() event: CalendarEventResponse | null` (edit mode when set), `@Input() saving`, `@Output() save = new EventEmitter<CalendarEventFormSubmission>()`, `@Output() delete = new EventEmitter<RecurrenceEditScope | null>()`, `@Output() cancel = new EventEmitter<void>()`. `CalendarEventFormSubmission` = `{ create: CreateCalendarEventRequest } | { update: UpdateCalendarEventRequest; scope: RecurrenceEditScope | null }` - `scope` is `null` for a plain event or an already-detached occurrence, and `'ThisEventOnly' | 'AllEvents'` (user-chosen via two buttons) when editing a still-recurring virtual occurrence. The `delete` output carries the same `scope` semantics for the delete action.

- [ ] **Step 1: Write the failing component test**

```ts
// src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { CalendarEventFormModalComponent } from './calendar-event-form-modal.component';

describe('CalendarEventFormModalComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventFormModalComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarEventFormModalComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('marks the form invalid until title and dates are filled', () => {
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('does not emit save when the form is invalid', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit();
    expect(spy).not.toHaveBeenCalled();
  });

  it('hides the recurrence-until control until "until" end mode is chosen', () => {
    expect(fixture.componentInstance.form.controls.recurrenceEndMode.value).toBe('never');
    const untilField = fixture.nativeElement.querySelector('[data-testid="calendar-form-recurrence-until"]');
    expect(untilField).toBeNull();
  });

  it('emits a create payload with a built recurrenceRule when the form is valid and weekly is chosen', () => {
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.form.patchValue({
      title: 'Standup', startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '09:30',
      recurrenceFrequency: 'weekly', recurrenceEndMode: 'never'
    });
    fixture.componentInstance.onSubmit();
    expect(spy).toHaveBeenCalledTimes(1);
    const submission = spy.mock.calls[0][0];
    expect('create' in submission).toBe(true);
    expect((submission as { create: { recurrence: string; recurrenceRule: string | null } }).create.recurrenceRule).toBe('FREQ=WEEKLY');
  });

  it('pre-fills the form and emits an update payload with scope=null for a plain event', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.title.value).toBe('Existing');

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.componentInstance.onSubmit(null);
    const submission = spy.mock.calls[0][0] as { update: unknown; scope: unknown };
    expect('update' in submission).toBe(true);
    expect(submission.scope).toBeNull();

    // a plain event shows one Save button, no this-event/all-events choice and no delete-scope choice
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-this-event"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-plain"]')).not.toBeNull();
  });

  it('offers a this-event/all-events choice and emits the chosen scope for a recurring occurrence', () => {
    fixture.componentRef.setInput('event', {
      id: 'occurrence-id', title: 'Standup', description: null, startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'weekly', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: true, recurrenceMasterId: 'master-1', originalStart: '2026-09-08T09:00:00Z'
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-save-this-event"]').click();

    const submission = spy.mock.calls[0][0] as { update: unknown; scope: unknown };
    expect(submission.scope).toBe('ThisEventOnly');
  });

  it('emits the delete output with the chosen scope', () => {
    fixture.componentRef.setInput('event', {
      id: 'occurrence-id', title: 'Standup', description: null, startDate: '2026-09-08T09:00:00Z', endDate: '2026-09-08T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'weekly', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: true, recurrenceMasterId: 'master-1', originalStart: '2026-09-08T09:00:00Z'
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.delete.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-delete-all-events"]').click();
    expect(spy).toHaveBeenCalledWith('AllEvents');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-event-form-modal.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { CalendarEventResponse, CreateCalendarEventRequest, RecurrenceEditScope, UpdateCalendarEventRequest } from '../../models/calendar-event.model';
import { RecurrenceEndMode, RecurrenceFrequency, buildRecurrenceRule } from '../../utils/recurrence-rule.util';
import { CalendarParticipantPickerComponent } from '../calendar-participant-picker/calendar-participant-picker.component';

export type CalendarEventFormSubmission =
  | { create: CreateCalendarEventRequest }
  | { update: UpdateCalendarEventRequest; scope: RecurrenceEditScope | null };

@Component({
  selector: 'app-calendar-event-form-modal',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, ButtonComponent, InputComponent, SelectComponent,
    ModalComponent, DatePickerComponent, CalendarParticipantPickerComponent
  ],
  templateUrl: './calendar-event-form-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarEventFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() open = false;
  @Input() event: CalendarEventResponse | null = null;
  @Input() saving = false;
  @Output() save = new EventEmitter<CalendarEventFormSubmission>();
  @Output() delete = new EventEmitter<RecurrenceEditScope | null>();
  @Output() cancel = new EventEmitter<void>();

  readonly recurrenceOptions = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }
  ];

  readonly participantPickerOpen = signal(false);
  readonly participantIds = signal<readonly string[]>([]);

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    startDate: ['', Validators.required],
    startTime: ['09:00', Validators.required],
    endDate: ['', Validators.required],
    endTime: ['10:00', Validators.required],
    isAllDay: [false],
    location: [''],
    meetingLink: [''],
    color: ['#2563EB'],
    recurrenceFrequency: ['none' as RecurrenceFrequency],
    recurrenceEndMode: ['never' as RecurrenceEndMode],
    recurrenceUntilDate: ['']
  });

  get isEdit(): boolean {
    return !!this.event;
  }

  ngOnChanges(): void {
    if (!this.event) return;
    const [startDate, startTimeRaw] = this.event.startDate.split('T');
    const [endDate, endTimeRaw] = this.event.endDate.split('T');
    this.form.patchValue({
      title: this.event.title,
      description: this.event.description ?? '',
      startDate,
      startTime: startTimeRaw.slice(0, 5),
      endDate,
      endTime: endTimeRaw.slice(0, 5),
      isAllDay: this.event.isAllDay,
      location: this.event.location ?? '',
      meetingLink: this.event.meetingLink ?? '',
      color: this.event.color ?? '#2563EB'
    });
  }

  openParticipantPicker(): void {
    this.participantPickerOpen.set(true);
  }

  onSubmit(scope: RecurrenceEditScope | null = null): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const startDate = `${raw.startDate}T${raw.startTime}:00Z`;
    const endDate = `${raw.endDate}T${raw.endTime}:00Z`;
    const recurrence = raw.recurrenceFrequency ?? 'none';
    const recurrenceRule = buildRecurrenceRule(recurrence as RecurrenceFrequency, raw.recurrenceEndMode as RecurrenceEndMode, raw.recurrenceUntilDate || null);

    if (this.isEdit) {
      this.save.emit({
        update: {
          title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
          isAllDay: !!raw.isAllDay, timezone: 'UTC', location: raw.location || null,
          meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence
        },
        scope
      });
      return;
    }

    this.save.emit({
      create: {
        title: raw.title!.trim(), description: raw.description || null, startDate, endDate,
        isAllDay: !!raw.isAllDay, timezone: 'UTC', location: raw.location || null,
        meetingLink: raw.meetingLink || null, color: raw.color || null, recurrence,
        participantEmployeeIds: this.participantIds(), recurrenceRule
      }
    });
  }

  onDelete(scope: RecurrenceEditScope | null = null): void {
    this.delete.emit(scope);
  }
}
```

- [ ] **Step 4: Write the template**

```html
<!-- src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.html -->
<app-modal [open]="open" [title]="isEdit ? 'Edit event' : 'New event'" (closed)="cancel.emit()">
  <!-- No (ngSubmit)/type="submit" here on purpose: a recurring occurrence needs an explicit
       this-event/all-events choice, so every save action is a type="button" click handler below
       rather than the form's native submit event (which would bypass that choice on Enter). -->
  <form [formGroup]="form" class="flex flex-col gap-3">
    <app-input label="Title" formControlName="title" [required]="true" />

    <div class="grid grid-cols-2 gap-3">
      <app-date-picker label="Start date" [value]="form.controls.startDate.value ?? ''" (valueChange)="form.controls.startDate.setValue($event)" />
      <input type="time" formControlName="startTime" class="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm" />
      <app-date-picker label="End date" [value]="form.controls.endDate.value ?? ''" (valueChange)="form.controls.endDate.setValue($event)" />
      <input type="time" formControlName="endTime" class="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm" />
    </div>

    <label class="flex items-center gap-2 text-sm">
      <input type="checkbox" formControlName="isAllDay" />
      All day
    </label>

    <app-input label="Location" formControlName="location" />
    <app-input label="Meeting link" formControlName="meetingLink" />

    <app-select label="Repeat" [options]="recurrenceOptions" [value]="form.controls.recurrenceFrequency.value" (valueChange)="form.controls.recurrenceFrequency.setValue($event)" />

    @if (form.controls.recurrenceFrequency.value !== 'none') {
      <div class="flex items-center gap-3 text-sm">
        <label class="flex items-center gap-1.5">
          <input type="radio" formControlName="recurrenceEndMode" value="never" />
          Never ends
        </label>
        <label class="flex items-center gap-1.5">
          <input type="radio" formControlName="recurrenceEndMode" value="until" />
          Ends on
        </label>
      </div>
      @if (form.controls.recurrenceEndMode.value === 'until') {
        <app-date-picker
          data-testid="calendar-form-recurrence-until"
          label="Ends on"
          [value]="form.controls.recurrenceUntilDate.value ?? ''"
          (valueChange)="form.controls.recurrenceUntilDate.setValue($event)"
        />
      }
    }

    @if (!isEdit) {
      <div class="flex items-center justify-between">
        <span class="text-sm text-[var(--color-text-secondary)]">{{ participantIds().length }} participant(s)</span>
        <app-button type="button" variant="secondary" (click)="openParticipantPicker()">Add participants</app-button>
      </div>
    }

    @if (isEdit && event?.isRecurringOccurrence) {
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div class="flex gap-2">
          <app-button type="button" variant="danger" data-testid="calendar-form-delete-this-event" (click)="onDelete('ThisEventOnly')">Delete this event</app-button>
          <app-button type="button" variant="danger" data-testid="calendar-form-delete-all-events" (click)="onDelete('AllEvents')">Delete all events</app-button>
        </div>
        <div class="flex gap-2">
          <app-button type="button" variant="secondary" (click)="cancel.emit()">Cancel</app-button>
          <app-button type="button" variant="secondary" data-testid="calendar-form-save-this-event" [loading]="saving" (click)="onSubmit('ThisEventOnly')">Save this event</app-button>
          <app-button type="button" data-testid="calendar-form-save-all-events" [loading]="saving" (click)="onSubmit('AllEvents')">Save all events</app-button>
        </div>
      </div>
    } @else {
      <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
        @if (isEdit) {
          <app-button type="button" variant="danger" data-testid="calendar-form-delete-plain" (click)="onDelete(null)">Delete</app-button>
        } @else {
          <span></span>
        }
        <div class="flex gap-2">
          <app-button type="button" variant="secondary" (click)="cancel.emit()">Cancel</app-button>
          <app-button type="button" data-testid="calendar-form-save-plain" [loading]="saving" (click)="onSubmit(null)">{{ isEdit ? 'Save changes' : 'Create event' }}</app-button>
        </div>
      </div>
    }
  </form>
</app-modal>

<app-calendar-participant-picker
  [open]="participantPickerOpen()"
  [selectedIds]="participantIds()"
  (selectedIdsChange)="participantIds.set($event)"
  (closed)="participantPickerOpen.set(false)"
/>
```

If `app-button`'s `variant`/`loading` inputs or `app-select`'s `options`/`value`/`valueChange` API differ from what's assumed here, read `src/app/shared/ui/button/button.component.ts` and `src/app/shared/ui/select/select.component.ts` first and adjust the template to match their real public API exactly - in particular, confirm what destructive-action variant name (if any) `app-button` actually supports before using `variant="danger"` on the delete buttons above; fall back to `variant="secondary"` with red text via a class binding if no dedicated destructive variant exists.

- [ ] **Step 5: Run tests to verify they pass**

Run: `ng test --include='**/calendar-event-form-modal.component.spec.ts'`
Expected: 5 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-event-form-modal/
git commit -m "feat(calendar): add CalendarEventFormModalComponent"
```

---

### Task 6: Month grid presentational components

**Files:**
- Create: `src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.ts`
- Create: `src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.html`
- Test: `src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.spec.ts`

**Interfaces:**
- Consumes: `buildMonthGrid`/`CalendarGridDay` (Task 3), `CalendarEventResponse` (Task 1).
- Produces: `CalendarMonthGridComponent` - `year`/`month` inputs (numbers), `events` input (`readonly CalendarEventResponse[]`), `dayClick`/`eventClick` outputs. Caps each day cell at 3 visible chips with a "+N more" overflow that emits `dayClick` for that date.

- [ ] **Step 1: Write the failing component test**

```ts
// src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarMonthGridComponent } from './calendar-month-grid.component';

function makeEvent(id: string, startDate: string): CalendarEventResponse {
  return {
    id, title: `Event ${id}`, description: null, startDate, endDate: startDate,
    sourceType: 'manual', color: '#2563EB', recurrence: 'none', isAllDay: false, timezone: 'UTC',
    eventStatus: null, isPrivate: false, location: null, meetingLink: null, externalSource: null,
    createdById: 'u1', isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null
  };
}

describe('CalendarMonthGridComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarMonthGridComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarMonthGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarMonthGridComponent);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('month', 9);
    fixture.componentRef.setInput('events', [makeEvent('e1', '2026-09-01T09:00:00Z')]);
    fixture.detectChanges();
  });

  it('renders 42 day cells', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-day-cell"]').length).toBe(42);
  });

  it('places an event chip on its correct day', () => {
    const cell = fixture.nativeElement.querySelector('[data-date="2026-09-01"]');
    expect(cell.querySelector('[data-testid="calendar-event-chip"]')).not.toBeNull();
  });

  it('shows "+N more" when a day has more than 3 events', () => {
    const many = Array.from({ length: 5 }, (_, i) => makeEvent(`e${i}`, '2026-09-10T09:00:00Z'));
    fixture.componentRef.setInput('events', many);
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelector('[data-date="2026-09-10"]');
    expect(cell.textContent).toContain('+2 more');
  });

  it('emits eventClick when a chip is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.eventClick.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-event-chip"]').click();
    expect(spy).toHaveBeenCalledWith('e1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-month-grid.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarGridDay, buildMonthGrid } from '../../utils/calendar-grid.util';

const MAX_VISIBLE_PER_DAY = 3;

interface DayCellViewModel {
  readonly day: CalendarGridDay;
  readonly visible: readonly CalendarEventResponse[];
  readonly overflowCount: number;
}

@Component({
  selector: 'app-calendar-month-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-month-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarMonthGridComponent {
  year = input.required<number>();
  month = input.required<number>();
  events = input<readonly CalendarEventResponse[]>([]);

  dayClick = output<string>();
  eventClick = output<string>();

  readonly cells = computed<readonly DayCellViewModel[]>(() => {
    const grid = buildMonthGrid(this.year(), this.month());
    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = event.startDate.slice(0, 10);
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    return grid.map((day) => {
      const dayEvents = byDate.get(day.date) ?? [];
      return {
        day,
        visible: dayEvents.slice(0, MAX_VISIBLE_PER_DAY),
        overflowCount: Math.max(0, dayEvents.length - MAX_VISIBLE_PER_DAY)
      };
    });
  });
}
```

- [ ] **Step 4: Write the template**

```html
<!-- src/app/modules/calendar/ui/calendar-month-grid/calendar-month-grid.component.html -->
<div class="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-border)]">
  @for (cell of cells(); track cell.day.date) {
    <div
      data-testid="calendar-day-cell"
      [attr.data-date]="cell.day.date"
      class="flex min-h-24 flex-col gap-1 bg-[var(--color-surface)] p-1.5"
      [class.opacity-50]="!cell.day.isCurrentMonth"
      (click)="dayClick.emit(cell.day.date)"
    >
      <span
        class="self-end text-xs"
        [class.font-semibold]="cell.day.isToday"
        [class.text-[var(--color-accent)]]="cell.day.isToday"
      >
        {{ cell.day.date.slice(-2) }}
      </span>

      @for (event of cell.visible; track event.id) {
        <button
          type="button"
          data-testid="calendar-event-chip"
          class="truncate rounded px-1.5 py-0.5 text-left text-[11px] text-white"
          [style.background-color]="event.color || 'var(--color-accent)'"
          (click)="$event.stopPropagation(); eventClick.emit(event.id)"
        >
          {{ event.title }}
        </button>
      }

      @if (cell.overflowCount > 0) {
        <span class="text-[10px] text-[var(--color-text-secondary)]">+{{ cell.overflowCount }} more</span>
      }
    </div>
  }
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `ng test --include='**/calendar-month-grid.component.spec.ts'`
Expected: 4 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-month-grid/
git commit -m "feat(calendar): add CalendarMonthGridComponent"
```

---

### Task 7: Calendar page, routes, and placeholder replacement

**Files:**
- Create: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts`
- Create: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.html`
- Create: `src/app/modules/calendar/calendar.routes.ts`
- Modify: `src/app/app.routes.ts` (replace the `loadPlaceholder` calendar entry)
- Test: `src/app/modules/calendar/calendar.routes.spec.ts`

**Interfaces:**
- Consumes: `CalendarEventStore` (Task 2), `CalendarMonthGridComponent` (Task 6), `CalendarEventFormModalComponent` (Task 5), `buildMonthGrid`'s date range for the visible month (padded to the full 42-cell grid, so adjacent-month overflow days' events load too).

- [ ] **Step 1: Write the page component**

```ts
// src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { buildMonthGrid } from '../../utils/calendar-grid.util';
import { CalendarMonthGridComponent } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { CalendarEventFormModalComponent, CalendarEventFormSubmission } from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';
import { RecurrenceEditScope } from '../../models/calendar-event.model';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CalendarMonthGridComponent, CalendarEventFormModalComponent],
  templateUrl: './calendar-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarPageComponent {
  readonly store = inject(CalendarEventStore);

  readonly view = signal<'month'>('month'); // wired for future week/day/agenda views - only 'month' is ever set in R1
  readonly cursor = signal(new Date());
  readonly formOpen = signal(false);
  readonly editingEvent = signal<CalendarEventResponse | null>(null);

  readonly year = computed(() => this.cursor().getFullYear());
  readonly month = computed(() => this.cursor().getMonth() + 1);

  private readonly rangeEffect = effect(() => {
    const grid = buildMonthGrid(this.year(), this.month());
    const from = `${grid[0].date}T00:00:00Z`;
    const to = `${grid[grid.length - 1].date}T23:59:59Z`;
    this.store.loadEvents(from, to);
  });

  previousMonth(): void {
    const d = this.cursor();
    this.cursor.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.cursor();
    this.cursor.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  goToToday(): void {
    this.cursor.set(new Date());
  }

  openCreate(): void {
    this.editingEvent.set(null);
    this.formOpen.set(true);
  }

  openEdit(eventId: string): void {
    const found = this.store.events().find((e) => e.id === eventId) ?? null;
    this.editingEvent.set(found);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
  }

  private currentRange(): { from: string; to: string } {
    const grid = buildMonthGrid(this.year(), this.month());
    return { from: `${grid[0].date}T00:00:00Z`, to: `${grid[grid.length - 1].date}T23:59:59Z` };
  }

  async onSave(submission: CalendarEventFormSubmission): Promise<void> {
    const editing = this.editingEvent();
    let ok: boolean;

    if ('update' in submission && editing) {
      if (submission.scope && editing.recurrenceMasterId) {
        // scope is 'ThisEventOnly' or 'AllEvents', chosen via the form's own two buttons - both
        // route through the occurrence endpoint, which is the only one that understands scope.
        const { from, to } = this.currentRange();
        ok = await this.store.editOccurrence(
          editing.recurrenceMasterId,
          { originalStart: editing.originalStart!, scope: submission.scope, ...submission.update },
          from, to
        );
      } else {
        // scope is null: a plain manual event, or an already-detached occurrence edited by its own id.
        ok = await this.store.updateEvent(editing.id, submission.update);
      }
    } else if ('create' in submission) {
      ok = await this.store.createEvent(submission.create);
    } else {
      ok = false;
    }

    if (ok) this.closeForm();
  }

  async onDelete(scope: RecurrenceEditScope | null): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const { from, to } = this.currentRange();

    if (scope === 'ThisEventOnly' && editing.recurrenceMasterId) {
      await this.store.cancelOccurrence(editing.recurrenceMasterId, editing.originalStart!, from, to);
    } else if (scope === 'AllEvents' && editing.recurrenceMasterId) {
      // Deleting the master's own id (never itself present in store.events()) leaves the now-gone
      // virtual occurrences stranded in local state until reloaded - reload explicitly afterward
      // rather than relying on deleteEvent's plain id-filter, which can't match a master's id.
      await this.store.deleteEvent(editing.recurrenceMasterId);
      await this.store.loadEvents(from, to);
    } else {
      await this.store.deleteEvent(editing.id);
    }
    this.closeForm();
  }
}
```

- [ ] **Step 2: Write the template**

```html
<!-- src/app/modules/calendar/feature/calendar-page/calendar-page.component.html -->
<div class="flex h-full flex-col gap-4 p-4">
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <app-button type="button" variant="secondary" (click)="previousMonth()">&lsaquo;</app-button>
      <app-button type="button" variant="secondary" (click)="goToToday()">Today</app-button>
      <app-button type="button" variant="secondary" (click)="nextMonth()">&rsaquo;</app-button>
      <span class="ml-2 text-lg font-semibold text-[var(--color-text-primary)]">
        {{ cursor() | date: 'MMMM yyyy' }}
      </span>
    </div>
    <app-button type="button" (click)="openCreate()">New event</app-button>
  </div>

  @if (store.loadError()) {
    <p class="text-sm text-red-600">{{ store.loadError() }}</p>
  }

  <app-calendar-month-grid
    [year]="year()"
    [month]="month()"
    [events]="store.events()"
    (eventClick)="openEdit($event)"
  />
</div>

<app-calendar-event-form-modal
  [open]="formOpen()"
  [event]="editingEvent()"
  [saving]="store.saving()"
  (save)="onSave($event)"
  (delete)="onDelete($event)"
  (cancel)="closeForm()"
/>
```

- [ ] **Step 3: Write `calendar.routes.ts`**

```ts
// src/app/modules/calendar/calendar.routes.ts
import { Routes } from '@angular/router';

export const CALENDAR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./feature/calendar-page/calendar-page.component').then((m) => m.CalendarPageComponent),
    data: { title: 'Calendar' }
  }
];
```

- [ ] **Step 4: Write the failing routes test**

```ts
// src/app/modules/calendar/calendar.routes.spec.ts
import { CALENDAR_ROUTES } from './calendar.routes';

describe('CALENDAR_ROUTES', () => {
  it('registers a single root route', () => {
    expect(CALENDAR_ROUTES.length).toBe(1);
    expect(CALENDAR_ROUTES[0].path).toBe('');
  });

  it('lazy-loads CalendarPageComponent', async () => {
    const loaded = await (CALENDAR_ROUTES[0].loadComponent as () => Promise<unknown>)();
    expect(loaded).toBeDefined();
  });
});
```

Run: `ng test --include='**/calendar.routes.spec.ts'`
Expected: passes once Steps 1-3 exist (there is no separate "fails first" step here since this test only exercises the routes file written in this same step, matching this repo's existing `leave.routes.spec.ts`/`work.routes.spec.ts` convention of testing the finished routes array rather than TDD-ing route registration).

- [ ] **Step 5: Replace the placeholder route in `app.routes.ts`**

Find the existing line (documented at `app.routes.ts` line 77 as of this plan):
```ts
{ path: 'calendar', loadComponent: loadPlaceholder, data: { title: 'Calendar' } },
```
Replace it with:
```ts
{
  path: 'calendar',
  canActivate: [permissionGuard],
  data: { permissions: ['calendar:read'], modules: ['calendar'] },
  loadChildren: () => import('./modules/calendar/calendar.routes').then((module) => module.CALENDAR_ROUTES)
},
```
(matching the `time-off`/`people` entries exactly - `permissionGuard` and `loadPlaceholder` are already imported at the top of this file, no new imports needed for this edit itself.)

- [ ] **Step 6: Run the full test suite**

Run: `ng test`
Expected: all Calendar module tests pass (the ones from Tasks 1-7), zero new failures elsewhere.

- [ ] **Step 7: Run lint and build**

Run: `ng lint` then `ng build`
Expected: no lint errors in the new `modules/calendar/` files, build succeeds.

- [ ] **Step 8: Manually verify in the browser**

Start the frontend dev server (`preview_start` with the `tenant-frontend` launch config, or `npm start`) and the backend dev server (`feature/calendar-recurrence-engine`, already merged/available per the branch decision made after the backend plan). Log in as the seeded `dapi` tenant owner, navigate to `/calendar`:
1. Confirm the month grid renders with Prev/Next/Today controls and the current month highlighted correctly.
2. Click "New event", create a plain event, confirm it appears in the correct day cell.
3. Click "New event" again, set Repeat to "Weekly", leave "Never ends", create it - confirm it appears on the same weekday across the visible month.
4. Click one recurring occurrence's chip - confirm the form shows the "Save this event" / "Save all events" button pair (not a single Save button). Edit its title and click "Save this event" - confirm only that occurrence changed while the others keep the original title, and that re-opening it now shows the plain single-Save-button layout (it's a detached event now).
5. Click a different occurrence's chip, edit its title, and click "Save all events" - confirm every remaining untouched occurrence in the series picked up the new title, while the already-detached one from step 4 is unaffected.
6. Click another occurrence's chip and click "Delete this event" - confirm only that date disappears, the rest of the series remains.
7. Click a remaining occurrence's chip and click "Delete all events" - confirm the entire series disappears from the grid.
8. Click "New event" once more, add 1-2 participants via "Add participants", create it, confirm no console errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/calendar/feature/ src/app/modules/calendar/calendar.routes.ts src/app/modules/calendar/calendar.routes.spec.ts src/app/app.routes.ts
git commit -m "feat(calendar): add CalendarPageComponent and wire /calendar routing"
```
