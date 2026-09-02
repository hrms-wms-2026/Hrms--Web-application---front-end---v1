# Calendar Week/Day/Agenda Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Week, Day, and Agenda views to the already-shipped Calendar month view (`feature/calendar-frontend-module`), with Week/Day rendered as a real hourly grid (all-day row, time-positioned events, overlap-packing, current-time indicator) — not a simplified list.

**Architecture:** A pure `layoutDayEvents` utility computes each timed event's position/size as 0-1 fractions of a 24-hour column using the standard calendar column-packing algorithm; a shared `CalendarHourGridComponent` renders that positioning for however many day-columns it's given (1 for Day, 7 for Week); `CalendarAgendaViewComponent` is a flat date-grouped list with no grid. `CalendarPageComponent`'s `view` signal widens to drive which feature component is shown and what date range gets requested.

**Tech Stack:** Angular (standalone components, signals), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-calendar-r1-recurrence-and-frontend-design.md`, "Week/Day/Agenda Views (scope revision)" section - this plan implements that section exactly.

## Global Constraints

- Branch off `feature/calendar-frontend-module` (the already-shipped, already-tested Month view work), not `Development`.
- Reuse `CalendarEventStore`, `CalendarEventApiService`, `CalendarEventFormModalComponent` unchanged - only new `ui/`/`feature/` view components and `CalendarPageComponent`'s range/view logic change.
- The overlap-packing algorithm is a pure, DOM-free function so its hardest logic is unit-testable without `TestBed`.
- Match this codebase's existing conventions: `OnPush` change detection, `computed()` for derived view state, `input()`/`output()` signal-based component APIs (matching `CalendarMonthGridComponent`'s own style, since these are its siblings), Tailwind `var(--color-*)` tokens, `data-testid` attributes for test hooks.
- Drag-and-drop rescheduling is explicitly out of scope even though the grid now shows real time positions.

---

### Task 1: `layoutDayEvents` overlap-packing utility

**Files:**
- Create: `src/app/modules/calendar/utils/calendar-hour-grid.util.ts`
- Test: `src/app/modules/calendar/utils/calendar-hour-grid.util.spec.ts`

**Interfaces:**
- Consumes: `CalendarEventResponse` (existing model).
- Produces: `PositionedEvent { event, top, height, left, width }` (all 0-1 fractions), `layoutDayEvents(events: readonly CalendarEventResponse[], dayStart: Date): readonly PositionedEvent[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/modules/calendar/utils/calendar-hour-grid.util.spec.ts
import { CalendarEventResponse } from '../models/calendar-event.model';
import { layoutDayEvents } from './calendar-hour-grid.util';

function makeEvent(id: string, startHHmm: string, endHHmm: string, isAllDay = false): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate: `2026-09-01T${startHHmm}:00Z`, endDate: `2026-09-01T${endHHmm}:00Z`,
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null
  };
}

const dayStart = new Date('2026-09-01T00:00:00Z');

describe('layoutDayEvents', () => {
  it('excludes all-day events', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00', true)], dayStart);
    expect(result).toEqual([]);
  });

  it('positions a single event at the correct top/height fraction, full width', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00')], dayStart);
    expect(result).toHaveLength(1);
    expect(result[0].top).toBeCloseTo(9 * 60 / 1440);
    expect(result[0].height).toBeCloseTo(60 / 1440);
    expect(result[0].left).toBe(0);
    expect(result[0].width).toBe(1);
  });

  it('gives non-overlapping sequential events full width each', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00'), makeEvent('b', '11:00', '12:00')], dayStart);
    expect(result.every((p) => p.width === 1 && p.left === 0)).toBe(true);
  });

  it('splits two directly-overlapping events into two half-width columns', () => {
    const result = layoutDayEvents([makeEvent('a', '09:00', '10:00'), makeEvent('b', '09:30', '10:30')], dayStart);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.width === 0.5)).toBe(true);
    const lefts = result.map((p) => p.left).sort();
    expect(lefts).toEqual([0, 0.5]);
  });

  it('lets a later event reuse a column once its predecessor in that column has ended', () => {
    // a: 09:00-10:00, b: 09:30-11:00 (overlaps a), c: 10:30-11:30 (overlaps b only, not a)
    // a and c can share a column; b needs its own -> 2 columns total
    const result = layoutDayEvents(
      [makeEvent('a', '09:00', '10:00'), makeEvent('b', '09:30', '11:00'), makeEvent('c', '10:30', '11:30')],
      dayStart
    );
    const widths = new Set(result.map((p) => p.width));
    expect(widths).toEqual(new Set([0.5]));
  });

  it('clamps a start before dayStart and an end after dayStart+24h to the visible column', () => {
    const spanning = makeEvent('a', '09:00', '10:00');
    (spanning as { startDate: string }).startDate = '2026-08-31T23:00:00Z'; // starts the day before
    (spanning as { endDate: string }).endDate = '2026-09-02T01:00:00Z'; // ends the day after
    const result = layoutDayEvents([spanning], dayStart);
    expect(result[0].top).toBe(0);
    expect(result[0].height).toBe(1);
  });

  it('sorts by start time regardless of input order', () => {
    const result = layoutDayEvents([makeEvent('late', '14:00', '15:00'), makeEvent('early', '09:00', '10:00')], dayStart);
    expect(result[0].event.id).toBe('early');
    expect(result[1].event.id).toBe('late');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `ng test --include='**/calendar-hour-grid.util.spec.ts'`
Expected: FAIL - module does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/app/modules/calendar/utils/calendar-hour-grid.util.ts
import { CalendarEventResponse } from '../models/calendar-event.model';

export interface PositionedEvent {
  readonly event: CalendarEventResponse;
  readonly top: number;    // 0-1 fraction of a 24h column's height
  readonly height: number; // 0-1 fraction
  readonly left: number;   // 0-1 fraction of the day-column width
  readonly width: number;  // 0-1 fraction
}

const MINUTES_PER_DAY = 24 * 60;
const MIN_HEIGHT_FRACTION = 15 / MINUTES_PER_DAY; // a floor so very short events stay clickable

function minutesSince(date: Date, referenceStart: Date): number {
  return (date.getTime() - referenceStart.getTime()) / (1000 * 60);
}

/** Timed (non-all-day) events for ONE day, laid out with the standard calendar column-packing
 * algorithm: events are sorted by start time and chained into overlap clusters (transitively -
 * if A overlaps B and B overlaps C, all three share a cluster even if A and C don't directly
 * overlap, matching how Google Calendar itself resolves this case). Within a cluster, each event
 * greedily reuses the first column whose most recent event has already ended, else opens a new
 * one; width/left are then divided evenly across the cluster's column count. */
export function layoutDayEvents(events: readonly CalendarEventResponse[], dayStart: Date): readonly PositionedEvent[] {
  const timed = events.filter((e) => !e.isAllDay);
  const sorted = [...timed].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const clusters: CalendarEventResponse[][] = [];
  let currentCluster: CalendarEventResponse[] = [];
  let clusterEnd = -Infinity;
  for (const event of sorted) {
    const start = new Date(event.startDate).getTime();
    const end = new Date(event.endDate).getTime();
    if (currentCluster.length > 0 && start >= clusterEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterEnd = -Infinity;
    }
    currentCluster.push(event);
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (currentCluster.length > 0) clusters.push(currentCluster);

  const positioned: PositionedEvent[] = [];
  for (const cluster of clusters) {
    const columnEndTimes: number[] = [];
    const columnOf = new Map<CalendarEventResponse, number>();
    for (const event of cluster) {
      const start = new Date(event.startDate).getTime();
      const end = new Date(event.endDate).getTime();
      let assigned = -1;
      for (let c = 0; c < columnEndTimes.length; c++) {
        if (columnEndTimes[c] <= start) { assigned = c; break; }
      }
      if (assigned === -1) {
        assigned = columnEndTimes.length;
        columnEndTimes.push(end);
      } else {
        columnEndTimes[assigned] = end;
      }
      columnOf.set(event, assigned);
    }
    const numColumns = columnEndTimes.length;
    for (const event of cluster) {
      const startMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, minutesSince(new Date(event.startDate), dayStart)));
      const endMinutes = Math.min(MINUTES_PER_DAY, Math.max(0, minutesSince(new Date(event.endDate), dayStart)));
      const top = startMinutes / MINUTES_PER_DAY;
      const height = Math.max(MIN_HEIGHT_FRACTION, (endMinutes - startMinutes) / MINUTES_PER_DAY);
      const col = columnOf.get(event)!;
      positioned.push({ event, top, height, left: col / numColumns, width: 1 / numColumns });
    }
  }
  return positioned;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `ng test --include='**/calendar-hour-grid.util.spec.ts'`
Expected: 7 passing tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/calendar/utils/calendar-hour-grid.util.ts src/app/modules/calendar/utils/calendar-hour-grid.util.spec.ts
git commit -m "feat(calendar): add layoutDayEvents hourly-grid overlap-packing utility"
```

---

### Task 2: `CalendarHourGridComponent`

**Files:**
- Create: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.ts`
- Create: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.html`
- Test: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.spec.ts`

**Interfaces:**
- Consumes: `layoutDayEvents`/`PositionedEvent` (Task 1), `CalendarEventResponse`.
- Produces: `CalendarHourGridComponent` - `days: input.required<readonly string[]>()` (`'YYYY-MM-DD'` dates, one per column), `events: input<readonly CalendarEventResponse[]>([])`, `eventClick: output<string>()`, `slotClick: output<{ date: string; hour: number }>()`.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent } from './calendar-hour-grid.component';

function makeEvent(id: string, date: string, startHHmm: string, endHHmm: string, isAllDay = false): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate: `${date}T${startHHmm}:00Z`, endDate: `${date}T${endHHmm}:00Z`,
    sourceType: 'manual', color: '#2563EB', recurrence: 'none', isAllDay, timezone: 'UTC', eventStatus: null,
    isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
    isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null
  };
}

describe('CalendarHourGridComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarHourGridComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarHourGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarHourGridComponent);
    fixture.componentRef.setInput('days', ['2026-09-01', '2026-09-02']);
    fixture.componentRef.setInput('events', [
      makeEvent('timed', '2026-09-01', '09:00', '10:00'),
      makeEvent('allday', '2026-09-02', '00:00', '23:59', true)
    ]);
    fixture.detectChanges();
  });

  it('renders 24 hour labels', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-hour-label"]').length).toBe(24);
  });

  it('renders one day column per input day', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-hour-day-column"]').length).toBe(2);
  });

  it('places the timed event as a positioned block in its own day column', () => {
    const column = fixture.nativeElement.querySelector('[data-date="2026-09-01"]');
    const block = column.querySelector('[data-testid="calendar-hour-event-block"]');
    expect(block).not.toBeNull();
    expect(block.style.top).not.toBe('');
  });

  it('places the all-day event in the all-day row, not the hourly area', () => {
    const allDayRow = fixture.nativeElement.querySelector('[data-testid="calendar-hour-allday-row"]');
    expect(allDayRow.querySelector('[data-testid="calendar-hour-allday-chip"]')).not.toBeNull();
  });

  it('emits eventClick when a positioned event block is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.eventClick.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-hour-event-block"]').click();
    expect(spy).toHaveBeenCalledWith('timed');
  });

  it('emits slotClick with the clicked column\'s date when an empty area is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.slotClick.subscribe(spy);
    const column = fixture.nativeElement.querySelector('[data-date="2026-09-01"] [data-testid="calendar-hour-slots"]');
    column.click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].date).toBe('2026-09-01');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-hour-grid.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { PositionedEvent, layoutDayEvents } from '../../utils/calendar-hour-grid.util';

interface DayColumnViewModel {
  readonly date: string;
  readonly isToday: boolean;
  readonly allDayEvents: readonly CalendarEventResponse[];
  readonly positioned: readonly PositionedEvent[];
  readonly nowFraction: number | null; // 0-1, only set when isToday
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-calendar-hour-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-hour-grid.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarHourGridComponent {
  days = input.required<readonly string[]>();
  events = input<readonly CalendarEventResponse[]>([]);

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();

  readonly hours = HOURS;

  readonly columns = computed<readonly DayColumnViewModel[]>(() => {
    const now = new Date();
    const todayStr = toDateString(now);
    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = event.startDate.slice(0, 10);
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    return this.days().map((date) => {
      const dayEvents = byDate.get(date) ?? [];
      const dayStart = new Date(`${date}T00:00:00`);
      const isToday = date === todayStr;
      return {
        date,
        isToday,
        allDayEvents: dayEvents.filter((e) => e.isAllDay),
        positioned: layoutDayEvents(dayEvents, dayStart),
        nowFraction: isToday ? (now.getHours() * 60 + now.getMinutes()) / 1440 : null
      };
    });
  });

  onSlotClick(date: string, event: MouseEvent, columnEl: HTMLElement): void {
    const rect = columnEl.getBoundingClientRect();
    const fraction = (event.clientY - rect.top) / rect.height;
    const hour = Math.max(0, Math.min(23, Math.floor(fraction * 24)));
    this.slotClick.emit({ date, hour });
  }
}
```

- [ ] **Step 4: Write the template**

```html
<!-- src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.html -->
<div class="flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)]">
  <div data-testid="calendar-hour-allday-row" class="flex border-b border-[var(--color-border)] bg-[var(--color-surface)]">
    <div class="w-14 shrink-0 border-r border-[var(--color-border)] p-1 text-[10px] text-[var(--color-text-secondary)]">All day</div>
    @for (column of columns(); track column.date) {
      <div [attr.data-date]="column.date" class="flex flex-1 flex-col gap-1 border-r border-[var(--color-border)] p-1 last:border-r-0">
        @for (event of column.allDayEvents; track event.id) {
          <button
            type="button"
            data-testid="calendar-hour-allday-chip"
            class="truncate rounded px-1.5 py-0.5 text-left text-[11px] text-white"
            [style.background-color]="event.color || 'var(--color-accent)'"
            (click)="eventClick.emit(event.id)"
          >
            {{ event.title }}
          </button>
        }
      </div>
    }
  </div>

  <div class="flex max-h-[70vh] overflow-y-auto">
    <div class="w-14 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      @for (hour of hours; track hour) {
        <div data-testid="calendar-hour-label" class="h-12 border-b border-[var(--color-border)] px-1 text-[10px] text-[var(--color-text-secondary)]">
          {{ hour === 0 ? '12 AM' : hour < 12 ? hour + ' AM' : hour === 12 ? '12 PM' : (hour - 12) + ' PM' }}
        </div>
      }
    </div>

    @for (column of columns(); track column.date) {
      <div [attr.data-date]="column.date" class="relative flex-1 border-r border-[var(--color-border)] last:border-r-0">
        <div
          data-testid="calendar-hour-slots"
          class="absolute inset-0"
          (click)="onSlotClick(column.date, $event, $any($event.currentTarget))"
        >
          @for (hour of hours; track hour) {
            <div class="h-12 border-b border-[var(--color-border)]"></div>
          }
        </div>

        @if (column.nowFraction !== null) {
          <div class="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-red-500" [style.top.%]="column.nowFraction * 100"></div>
        }

        @for (positioned of column.positioned; track positioned.event.id) {
          <button
            type="button"
            data-testid="calendar-hour-event-block"
            class="absolute overflow-hidden rounded px-1 text-left text-[11px] text-white"
            [style.top.%]="positioned.top * 100"
            [style.height.%]="positioned.height * 100"
            [style.left.%]="positioned.left * 100"
            [style.width.%]="positioned.width * 100"
            [style.background-color]="positioned.event.color || 'var(--color-accent)'"
            (click)="$event.stopPropagation(); eventClick.emit(positioned.event.id)"
          >
            {{ positioned.event.title }}
          </button>
        }
      </div>
    }
  </div>
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `ng test --include='**/calendar-hour-grid.component.spec.ts'`
Expected: 6 passing tests. If the `slotClick` test's Y-offset math doesn't line up with jsdom's zero-sized `getBoundingClientRect()` in the test environment, relax that one assertion to just check the emitted `date` (already what it does) and drop any hour-value assertion - jsdom doesn't lay out real pixel heights, so `hour` isn't meaningfully testable there.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-hour-grid/
git commit -m "feat(calendar): add CalendarHourGridComponent (shared Week/Day hourly grid)"
```

---

### Task 3: `CalendarWeekViewComponent`

**Files:**
- Create: `src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.ts`
- Create: `src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.html`
- Test: `src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.spec.ts`

**Interfaces:**
- Consumes: `CalendarHourGridComponent` (Task 2).
- Produces: `CalendarWeekViewComponent` - `weekStart: input.required<string>()` (`'YYYY-MM-DD'`, a Monday), `events: input<readonly CalendarEventResponse[]>([])`, `eventClick`/`slotClick` outputs (passed through from the grid).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { CalendarWeekViewComponent } from './calendar-week-view.component';

describe('CalendarWeekViewComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarWeekViewComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarWeekViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarWeekViewComponent);
    fixture.componentRef.setInput('weekStart', '2026-08-31'); // a Monday
    fixture.detectChanges();
  });

  it('passes 7 consecutive days starting at weekStart to the hour grid', () => {
    const grid = fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid');
    const days: readonly string[] = grid.componentInstance.days();
    expect(days).toEqual(['2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-week-view.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent } from '../../ui/calendar-hour-grid/calendar-hour-grid.component';

@Component({
  selector: 'app-calendar-week-view',
  standalone: true,
  imports: [CommonModule, CalendarHourGridComponent],
  templateUrl: './calendar-week-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarWeekViewComponent {
  weekStart = input.required<string>();
  events = input<readonly CalendarEventResponse[]>([]);

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();

  readonly days = computed<readonly string[]>(() => {
    const [y, m, d] = this.weekStart().split('-').map(Number);
    const start = new Date(y, m - 1, d);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    });
  });
}
```

- [ ] **Step 4: Write the template**

```html
<!-- src/app/modules/calendar/feature/calendar-week-view/calendar-week-view.component.html -->
<app-calendar-hour-grid [days]="days()" [events]="events()" (eventClick)="eventClick.emit($event)" (slotClick)="slotClick.emit($event)" />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `ng test --include='**/calendar-week-view.component.spec.ts'`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/feature/calendar-week-view/
git commit -m "feat(calendar): add CalendarWeekViewComponent"
```

---

### Task 4: `CalendarDayViewComponent`

**Files:**
- Create: `src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.ts`
- Create: `src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.html`
- Test: `src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.spec.ts`

**Interfaces:**
- Consumes: `CalendarHourGridComponent` (Task 2).
- Produces: `CalendarDayViewComponent` - `date: input.required<string>()`, `events: input<readonly CalendarEventResponse[]>([])`, `eventClick`/`slotClick` outputs.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { CalendarDayViewComponent } from './calendar-day-view.component';

describe('CalendarDayViewComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarDayViewComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarDayViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarDayViewComponent);
    fixture.componentRef.setInput('date', '2026-09-01');
    fixture.detectChanges();
  });

  it('passes exactly the one input date to the hour grid', () => {
    const grid = fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid');
    expect(grid.componentInstance.days()).toEqual(['2026-09-01']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-day-view.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarHourGridComponent } from '../../ui/calendar-hour-grid/calendar-hour-grid.component';

@Component({
  selector: 'app-calendar-day-view',
  standalone: true,
  imports: [CommonModule, CalendarHourGridComponent],
  templateUrl: './calendar-day-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarDayViewComponent {
  date = input.required<string>();
  events = input<readonly CalendarEventResponse[]>([]);

  eventClick = output<string>();
  slotClick = output<{ date: string; hour: number }>();

  readonly days = computed<readonly string[]>(() => [this.date()]);
}
```

- [ ] **Step 4: Write the template**

```html
<!-- src/app/modules/calendar/feature/calendar-day-view/calendar-day-view.component.html -->
<app-calendar-hour-grid [days]="days()" [events]="events()" (eventClick)="eventClick.emit($event)" (slotClick)="slotClick.emit($event)" />
```

- [ ] **Step 5: Run test to verify it passes**

Run: `ng test --include='**/calendar-day-view.component.spec.ts'`
Expected: 1 passing test.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/feature/calendar-day-view/
git commit -m "feat(calendar): add CalendarDayViewComponent"
```

---

### Task 5: `CalendarAgendaViewComponent`

**Files:**
- Create: `src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.ts`
- Create: `src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.html`
- Test: `src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.spec.ts`

**Interfaces:**
- Consumes: `CalendarEventResponse`.
- Produces: `CalendarAgendaViewComponent` - `events: input<readonly CalendarEventResponse[]>([])`, `eventClick: output<string>()`. No grid; groups events by date, sorted chronologically.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarAgendaViewComponent } from './calendar-agenda-view.component';

function makeEvent(id: string, startDate: string): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate, endDate: startDate,
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC',
    eventStatus: null, isPrivate: false, location: null, meetingLink: null, externalSource: null,
    createdById: 'u1', isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null
  };
}

describe('CalendarAgendaViewComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarAgendaViewComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarAgendaViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarAgendaViewComponent);
    fixture.componentRef.setInput('events', [
      makeEvent('b', '2026-09-05T09:00:00Z'),
      makeEvent('a', '2026-09-01T09:00:00Z'),
      makeEvent('c', '2026-09-05T14:00:00Z')
    ]);
    fixture.detectChanges();
  });

  it('groups events under one date header per distinct day', () => {
    const headers = fixture.nativeElement.querySelectorAll('[data-testid="calendar-agenda-date-header"]');
    expect(headers.length).toBe(2);
  });

  it('sorts date groups and events within a group chronologically', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-agenda-row"]');
    expect(rows[0].textContent).toContain('a');
    expect(rows[1].textContent).toContain('b');
    expect(rows[2].textContent).toContain('c');
  });

  it('emits eventClick when a row is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.eventClick.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-agenda-row"]').click();
    expect(spy).toHaveBeenCalledWith('a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `ng test --include='**/calendar-agenda-view.component.spec.ts'`
Expected: FAIL - component does not exist yet.

- [ ] **Step 3: Write the component**

```ts
// src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.ts
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarEventResponse } from '../../models/calendar-event.model';

interface AgendaGroup {
  readonly date: string;
  readonly events: readonly CalendarEventResponse[];
}

@Component({
  selector: 'app-calendar-agenda-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendar-agenda-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarAgendaViewComponent {
  events = input<readonly CalendarEventResponse[]>([]);
  eventClick = output<string>();

  readonly groups = computed<readonly AgendaGroup[]>(() => {
    const byDate = new Map<string, CalendarEventResponse[]>();
    for (const event of this.events()) {
      const dateKey = event.startDate.slice(0, 10);
      const list = byDate.get(dateKey) ?? [];
      list.push(event);
      byDate.set(dateKey, list);
    }
    const dates = [...byDate.keys()].sort();
    return dates.map((date) => ({
      date,
      events: [...byDate.get(date)!].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    }));
  });
}
```

- [ ] **Step 4: Write the template**

```html
<!-- src/app/modules/calendar/feature/calendar-agenda-view/calendar-agenda-view.component.html -->
<div class="flex flex-col gap-4">
  @for (group of groups(); track group.date) {
    <div>
      <div data-testid="calendar-agenda-date-header" class="mb-1 text-sm font-semibold text-[var(--color-text-primary)]">{{ group.date }}</div>
      <div class="flex flex-col gap-1">
        @for (event of group.events; track event.id) {
          <button
            type="button"
            data-testid="calendar-agenda-row"
            class="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-secondary)]"
            (click)="eventClick.emit(event.id)"
          >
            <span class="h-2 w-2 shrink-0 rounded-full" [style.background-color]="event.color || 'var(--color-accent)'"></span>
            <span class="text-xs text-[var(--color-text-secondary)]">{{ event.startDate.slice(11, 16) }}</span>
            <span class="text-[var(--color-text-primary)]">{{ event.title }}</span>
          </button>
        }
      </div>
    </div>
  }
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `ng test --include='**/calendar-agenda-view.component.spec.ts'`
Expected: 3 passing tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/feature/calendar-agenda-view/
git commit -m "feat(calendar): add CalendarAgendaViewComponent"
```

---

### Task 6: View switcher in `CalendarPageComponent`

**Files:**
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts`
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.html`

**Interfaces:**
- Consumes: `CalendarWeekViewComponent` (Task 3), `CalendarDayViewComponent` (Task 4), `CalendarAgendaViewComponent` (Task 5).

- [ ] **Step 1: Widen the page component**

Replace `calendar-page.component.ts` in full:

```ts
// src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CalendarEventResponse, RecurrenceEditScope } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { buildMonthGrid } from '../../utils/calendar-grid.util';
import { CalendarMonthGridComponent } from '../../ui/calendar-month-grid/calendar-month-grid.component';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { CalendarDayViewComponent } from '../calendar-day-view/calendar-day-view.component';
import { CalendarAgendaViewComponent } from '../calendar-agenda-view/calendar-agenda-view.component';
import { CalendarEventFormModalComponent, CalendarEventFormSubmission } from '../../ui/calendar-event-form-modal/calendar-event-form-modal.component';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda';

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(d: Date): Date {
  const jsDay = d.getDay();
  const daysBackToMonday = jsDay === 0 ? 6 : jsDay - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBackToMonday);
}

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [
    CommonModule, ButtonComponent, CalendarMonthGridComponent, CalendarWeekViewComponent,
    CalendarDayViewComponent, CalendarAgendaViewComponent, CalendarEventFormModalComponent
  ],
  templateUrl: './calendar-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalendarPageComponent {
  readonly store = inject(CalendarEventStore);

  readonly view = signal<CalendarView>('month');
  readonly cursor = signal(new Date());
  readonly formOpen = signal(false);
  readonly editingEvent = signal<CalendarEventResponse | null>(null);
  readonly prefillStart = signal<string | null>(null);

  readonly year = computed(() => this.cursor().getFullYear());
  readonly month = computed(() => this.cursor().getMonth() + 1);
  readonly weekStart = computed(() => toDateString(startOfWeek(this.cursor())));
  readonly dayDate = computed(() => toDateString(this.cursor()));

  readonly viewLabel = computed(() => {
    const c = this.cursor();
    switch (this.view()) {
      case 'month': return c.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      case 'week': return `Week of ${this.weekStart()}`;
      case 'day': return this.dayDate();
      case 'agenda': return 'Agenda';
    }
  });

  private readonly rangeEffect = effect(() => {
    const { from, to } = this.currentRange();
    this.store.loadEvents(from, to);
  });

  private currentRange(): { from: string; to: string } {
    switch (this.view()) {
      case 'month': {
        const grid = buildMonthGrid(this.year(), this.month());
        return { from: `${grid[0].date}T00:00:00Z`, to: `${grid[grid.length - 1].date}T23:59:59Z` };
      }
      case 'week': {
        const start = this.weekStart();
        const startDate = new Date(`${start}T00:00:00`);
        const end = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 7);
        return { from: `${start}T00:00:00Z`, to: `${toDateString(end)}T00:00:00Z` };
      }
      case 'day': {
        const date = this.dayDate();
        return { from: `${date}T00:00:00Z`, to: `${date}T23:59:59Z` };
      }
      case 'agenda': {
        const start = toDateString(this.cursor());
        const end = new Date(this.cursor());
        end.setDate(end.getDate() + 30);
        return { from: `${start}T00:00:00Z`, to: `${toDateString(end)}T23:59:59Z` };
      }
    }
  }

  setView(view: CalendarView): void {
    this.view.set(view);
  }

  previous(): void {
    this.step(-1);
  }

  next(): void {
    this.step(1);
  }

  private step(direction: 1 | -1): void {
    const d = this.cursor();
    switch (this.view()) {
      case 'month':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth() + direction, 1));
        break;
      case 'week':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction * 7));
        break;
      case 'day':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction));
        break;
      case 'agenda':
        this.cursor.set(new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction * 30));
        break;
    }
  }

  goToToday(): void {
    this.cursor.set(new Date());
  }

  openCreate(prefillDate?: string): void {
    this.editingEvent.set(null);
    this.prefillStart.set(prefillDate ?? null);
    this.formOpen.set(true);
  }

  onSlotClick(slot: { date: string; hour: number }): void {
    this.openCreate(`${slot.date}T${String(slot.hour).padStart(2, '0')}:00`);
  }

  openEdit(eventId: string): void {
    const found = this.store.events().find((e) => e.id === eventId) ?? null;
    this.editingEvent.set(found);
    this.prefillStart.set(null);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
    this.prefillStart.set(null);
  }

  async onSave(submission: CalendarEventFormSubmission): Promise<void> {
    const editing = this.editingEvent();
    let ok: boolean;

    if ('update' in submission && editing) {
      if (submission.scope && editing.recurrenceMasterId) {
        const { from, to } = this.currentRange();
        ok = await this.store.editOccurrence(
          editing.recurrenceMasterId,
          { originalStart: editing.originalStart!, scope: submission.scope, ...submission.update },
          from, to
        );
      } else {
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
      await this.store.deleteEvent(editing.recurrenceMasterId);
      await this.store.loadEvents(from, to);
    } else {
      await this.store.deleteEvent(editing.id);
    }
    this.closeForm();
  }
}
```

Note: `prefillStart` is threaded through but `CalendarEventFormModalComponent` (already shipped) does not yet read a prefill input - Step 2 below adds that wiring so clicking an empty hourly slot actually pre-fills the create form's date/time, closing the loop this task's `onSlotClick` opens.

- [ ] **Step 2: Add prefill support to the existing form modal**

Modify `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts`: add an `@Input() prefillStart: string | null = null;` and extend `ngOnChanges` to apply it when creating (not editing):

```ts
  @Input() prefillStart: string | null = null;
```

(add alongside the existing `@Input()` declarations)

```ts
  ngOnChanges(): void {
    if (this.event) {
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
      return;
    }

    if (this.prefillStart) {
      const [date, time] = this.prefillStart.split('T');
      this.form.patchValue({ startDate: date, startTime: time ?? '09:00', endDate: date, endTime: time ?? '10:00' });
    }
  }
```

(replaces the existing `ngOnChanges` body - the `if (!this.event) return;` early-return becomes an `if (this.event) { ...; return; }` block followed by the new prefill branch.)

- [ ] **Step 3: Wire `prefillStart` from the page into the form modal**

In `calendar-page.component.html`, add `[prefillStart]="prefillStart()"` to the existing `<app-calendar-event-form-modal>` tag.

- [ ] **Step 4: Replace the page template**

```html
<!-- src/app/modules/calendar/feature/calendar-page/calendar-page.component.html -->
<div class="flex h-full flex-col gap-4 p-4">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex items-center gap-2">
      <app-button type="button" variant="secondary" (click)="previous()">&lsaquo;</app-button>
      <app-button type="button" variant="secondary" (click)="goToToday()">Today</app-button>
      <app-button type="button" variant="secondary" (click)="next()">&rsaquo;</app-button>
      <span class="ml-2 text-lg font-semibold text-[var(--color-text-primary)]">{{ viewLabel() }}</span>
    </div>

    <div class="flex items-center gap-2">
      <div class="flex rounded-md border border-[var(--color-border)] overflow-hidden">
        <button type="button" data-testid="calendar-view-month" class="px-3 py-1.5 text-sm" [class.bg-\[var\(--color-accent\)\]]="view() === 'month'" (click)="setView('month')">Month</button>
        <button type="button" data-testid="calendar-view-week" class="px-3 py-1.5 text-sm" [class.bg-\[var\(--color-accent\)\]]="view() === 'week'" (click)="setView('week')">Week</button>
        <button type="button" data-testid="calendar-view-day" class="px-3 py-1.5 text-sm" [class.bg-\[var\(--color-accent\)\]]="view() === 'day'" (click)="setView('day')">Day</button>
        <button type="button" data-testid="calendar-view-agenda" class="px-3 py-1.5 text-sm" [class.bg-\[var\(--color-accent\)\]]="view() === 'agenda'" (click)="setView('agenda')">Agenda</button>
      </div>
      <app-button type="button" (click)="openCreate()">New event</app-button>
    </div>
  </div>

  @if (store.loadError()) {
    <p class="text-sm text-red-600">{{ store.loadError() }}</p>
  }

  @switch (view()) {
    @case ('month') {
      <app-calendar-month-grid [year]="year()" [month]="month()" [events]="store.events()" (eventClick)="openEdit($event)" />
    }
    @case ('week') {
      <app-calendar-week-view [weekStart]="weekStart()" [events]="store.events()" (eventClick)="openEdit($event)" (slotClick)="onSlotClick($event)" />
    }
    @case ('day') {
      <app-calendar-day-view [date]="dayDate()" [events]="store.events()" (eventClick)="openEdit($event)" (slotClick)="onSlotClick($event)" />
    }
    @case ('agenda') {
      <app-calendar-agenda-view [events]="store.events()" (eventClick)="openEdit($event)" />
    }
  }
</div>

<app-calendar-event-form-modal
  [open]="formOpen()"
  [event]="editingEvent()"
  [prefillStart]="prefillStart()"
  [saving]="store.saving()"
  (save)="onSave($event)"
  (delete)="onDelete($event)"
  (cancel)="closeForm()"
/>
```

The `[class.bg-\[var\(--color-accent\)\]]` arbitrary-Tailwind-class binding syntax is fragile (this repo's `calendar-month-grid` template avoided it in favor of `[style.color]` for the same reason) - if it doesn't apply correctly when you run this, replace each with `[style.background-color]="view() === 'month' ? 'var(--color-accent)' : null"` (and pair it with `[style.color]="view() === 'month' ? 'white' : null"` for contrast), matching the pattern already used elsewhere in this module.

- [ ] **Step 5: Run the full Calendar test suite**

Run: `ng test --include='**/modules/calendar/**/*.spec.ts'`
Expected: all tests pass (the existing Month-view suite plus this task's new ones) - `calendar-event-form-modal.component.spec.ts`'s existing tests must still pass unchanged since `prefillStart` defaults to `null` and only takes effect when `event` is also `null`.

- [ ] **Step 6: Build**

Run: `ng build`
Expected: succeeds, no new errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/calendar/feature/calendar-page/ src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts
git commit -m "feat(calendar): add Month/Week/Day/Agenda view switcher to CalendarPageComponent"
```

---

### Task 7: Full verification and manual E2E

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `ng test --watch=false`
Expected: same pass count as the pre-existing baseline plus this plan's ~18 new tests; the 5 pre-existing failures already confirmed unrelated to Calendar (in `app.routes.spec.ts`, `nav-access.spec.ts`, `clock-in-policy-form`, `connect-device`) are the only acceptable failures - any other failure must be investigated and fixed before proceeding.

- [ ] **Step 2: Build**

Run: `ng build`
Expected: succeeds.

- [ ] **Step 3: Manually verify in the browser**

With both dev servers running, log in as the seeded `dapi` tenant owner, navigate to `/calendar`:
1. Click through Month → Week → Day → Agenda tabs - confirm each renders without console errors and the header label updates correctly for each.
2. In Week view, confirm a known event (e.g. one created during Month-view testing) appears as a positioned block at roughly the correct vertical position for its time, and that the all-day row is empty unless an all-day event exists in the visible week.
3. Create two overlapping timed events on the same day (e.g. 9:00-10:00 and 9:30-10:30) via "New event", switch to Day view for that date, and confirm they render side-by-side at half width rather than stacked/overlapping.
4. Click an empty area of the Day view's hourly grid - confirm the create-event form opens with the start date matching the clicked column and a start time roughly matching the clicked vertical position.
5. Switch to Agenda view - confirm events are grouped under date headers in chronological order, and clicking a row opens it for edit.
6. Confirm Prev/Next/Today behave correctly per view (month-step in Month, week-step in Week, day-step in Day, 30-day-step in Agenda).
