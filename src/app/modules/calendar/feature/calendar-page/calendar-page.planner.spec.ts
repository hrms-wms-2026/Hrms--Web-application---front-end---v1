import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/services/notification.service';
import { PlannerFocusResponse, PlannerRangeBlockView, PlannerRangeDay, PlannerWorkWindow } from '../../../work/planner/models/planner.models';
import { PlannerAvailability, PlannerAvailabilityService } from '../../../work/planner/state/planner-availability.service';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarEventStore } from '../../state/calendar-event.store';
import { CalendarWeekViewComponent } from '../calendar-week-view/calendar-week-view.component';
import { CalendarPageComponent } from './calendar-page.component';

/** Planner = Calendar (2026-10-27 design): the calendar page with the planner layer on and off. */

const base = `${environment.apiUrl}/planner`;
const weekday: PlannerWorkWindow = {
  workStart: '09:00:00', workEnd: '17:00:00', breakMinutes: 60, breakStart: '12:30:00', isWorkingDay: true, workingMinutes: 420,
};
const focus: PlannerFocusResponse = {
  today: '2026-11-02', weekEnd: '2026-11-08',
  groups: [
    { reason: 'overdue', count: 2, items: [] }, { reason: 'due_today', count: 0, items: [] },
    { reason: 'due_this_week', count: 1, items: [] }, { reason: 'backlog', count: 0, items: [] },
  ],
};

function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

function block(id: string, date: string, from: string, to: string): PlannerRangeBlockView {
  return {
    id, taskId: `t-${id}`, projectId: 'p1', taskTitle: `Task ${id}`, startAt: `${date}T${from}:00Z`, endAt: `${date}T${to}:00Z`,
    plannedMinutes: (Date.parse(`${date}T${to}:00Z`) - Date.parse(`${date}T${from}:00Z`)) / 60000, actualMinutes: 0, stillAssigned: true,
  };
}

describe('CalendarPageComponent planner layer', () => {
  let http: HttpTestingController;
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarPageComponent>>;
  const state = signal<PlannerAvailability>('on');
  const notify = { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() };
  const events = signal<readonly CalendarEventResponse[]>([]);
  let blocksFor: (date: string) => PlannerRangeBlockView[] = () => [];

  function fakeStore() {
    return {
      events, saving: signal(false), conflicts: signal([]), checkingConflicts: signal(false), eligibleNominees: signal([]),
      hasTeamsCapableConnection: signal(false), hasZoomCapableConnection: signal(false), meetingActionSaving: signal(false),
      myTimezone: signal('UTC'), loadError: signal<string | null>(null), actionError: signal<string | null>(null),
      loadEvents: vi.fn(), loadMyTimezone: vi.fn(), loadMeetingConnectionStatus: vi.fn(), clearConflicts: vi.fn(),
      clearEligibleNominees: vi.fn(),
    };
  }

  function answerRange(req: TestRequest): void {
    const days: PlannerRangeDay[] = datesBetween(req.request.params.get('from')!, req.request.params.get('to')!).map((date) => {
      const window = { ...weekday, isWorkingDay: !isWeekend(date), workingMinutes: isWeekend(date) ? 0 : 420 };
      const blocks = blocksFor(date);
      return { date, editable: true, workWindow: window, blocks, blockMinutes: blocks.reduce((s, b) => s + b.plannedMinutes, 0),
        workingMinutes: window.workingMinutes };
    });
    req.flush({ timezone: 'UTC', today: days[0].date, days });
  }

  /** Answers every planner read the page has made so far. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      await new Promise((resolve) => setTimeout(resolve));
      http.match((r) => r.url === `${base}/me/range`).forEach(answerRange);
      http.match(`${base}/me/focus`).forEach((r) => r.flush(focus));
      http.match((r) => r.url === `${base}/me`).forEach((r) => r.flush({
        date: r.request.params.get('date'), timezone: 'UTC', editable: true, blocks: [], meetings: [], dueTasks: [],
        totals: { plannedMinutes: 0, actualMinutes: 45 }, attendanceMinutes: 120,
      }));
      fixture.detectChanges();
    }
  }

  function setup(on = true): void {
    state.set(on ? 'on' : 'off');
    events.set([]);
    blocksFor = () => [];
    Object.values(notify).forEach((f) => f.mockClear());
    try { localStorage.clear(); } catch { /* storage may be unavailable */ }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: CalendarEventStore, useValue: fakeStore() },
        { provide: PlannerAvailabilityService, useValue: { state, markAvailable: vi.fn(), probe: vi.fn() } },
        { provide: NotificationService, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
  }

  const q = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);

  it('is the plain calendar while the planner is off', async () => {
    setup(false);
    await settle();

    http.expectNone((r) => r.url.startsWith(base));
    expect(q('planner-focus-panel')).toBeNull();
    expect(q('planner-focus-toggle')).toBeNull();
  });

  it('Day view shows the day totals and the Focus panel, which cannot be closed there', async () => {
    setup();
    fixture.componentInstance.setView('day');
    await settle();

    const totals = q('planner-day-totals')!.textContent!.replace(/\s+/g, ' ');
    const workingDay = !isWeekend(fixture.componentInstance.dayDate());
    expect(totals).toContain(workingDay ? 'Working hours 7h' : 'Working hours 0m');
    expect(totals).toContain('Actual / attendance 45m / 2h');
    expect(q('planner-focus-panel')).not.toBeNull();
    expect(q('planner-focus-close')).toBeNull();
    expect(q('planner-focus-toggle')!.textContent).toContain('Focus · 3');
  });

  it('Week view shows the panel until it is closed, and remembers that', async () => {
    setup();
    fixture.componentInstance.setView('week');
    await settle();
    expect(q('planner-focus-panel')).not.toBeNull();

    q('planner-focus-close')!.click();
    fixture.detectChanges();

    expect(q('planner-focus-panel')).toBeNull();
    expect(localStorage.getItem('planner.focusOpen')).toBe('false');
    q('planner-focus-toggle')!.click();
    fixture.detectChanges();
    expect(q('planner-focus-panel')).not.toBeNull();
  });

  it('Week view leaves out rest days until Show weekend is on', async () => {
    setup();
    fixture.componentInstance.setView('week');
    await settle();
    const week = () => fixture.debugElement.query(By.directive(CalendarWeekViewComponent)).componentInstance as CalendarWeekViewComponent;
    const grid = () => fixture.debugElement.query((de) => de.name === 'app-calendar-hour-grid').componentInstance;

    expect(grid().days().length).toBe(5);
    q('planner-show-weekend')!.click();
    fixture.detectChanges();
    expect(grid().days().length).toBe(7);
    expect(week()).toBeTruthy();
  });

  it('Move after with no room left that day says so and moves nothing', async () => {
    setup();
    fixture.componentInstance.setView('day');
    const date = fixture.componentInstance.dayDate();
    blocksFor = (d) => (d === date ? [block('a', d, '09:00', '16:00'), block('b', d, '16:00', '17:00')] : []);
    await settle();

    fixture.componentInstance.onBlockMoveAfter({ block: block('b', date, '16:00', '17:00'), date, afterMinute: 1000 });

    const [y, m, d] = date.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '');
    expect(notify.warning).toHaveBeenCalledWith(`No free time left on ${label} for this block`);
    http.expectNone((r) => r.url.includes('/me/blocks'));
  });

  it('Month view sums each day into a chip', async () => {
    setup();
    const today = fixture.componentInstance.dayDate();
    events.set([{ id: 'm1', title: 'Sync', startDate: `${today}T13:00:00Z`, endDate: `${today}T14:00:00Z`, isAllDay: false,
      itemKind: 'meeting', participants: null } as CalendarEventResponse]);
    blocksFor = (d) => (d === today ? [block('a', d, '09:00', '10:00'), block('b', d, '10:00', '10:30')] : []);
    fixture.componentInstance.setView('month');
    await settle();

    const chip = fixture.nativeElement.querySelector(`[data-date="${today}"] [data-testid="planner-month-summary"]`) as HTMLElement;
    expect(chip.textContent!.replace(/\s+/g, ' ').trim()).toBe('2 tasks · 1 meeting · 2h 30m');
  });

  it('Agenda lists planned blocks among the events, in time order', async () => {
    setup();
    const today = fixture.componentInstance.dayDate();
    events.set([{ id: 'e1', title: 'Standup', startDate: `${today}T09:30:00Z`, endDate: `${today}T09:45:00Z`, isAllDay: false,
      participants: null } as CalendarEventResponse]);
    blocksFor = (d) => (d === today ? [block('a', d, '09:00', '09:30'), block('b', d, '10:00', '11:00')] : []);
    fixture.componentInstance.setView('agenda');
    await settle();

    const rows = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="calendar-agenda-row"], [data-testid="planner-agenda-block"]'))
      .map((e) => Array.from((e as HTMLElement).querySelectorAll('span')).map((s) => s.textContent!.trim()).filter(Boolean).join(' '));
    expect(rows.slice(0, 3)).toEqual(['09:00 Planned task Task a', '09:30 Standup', '10:00 Planned task Task b']);
  });
});
