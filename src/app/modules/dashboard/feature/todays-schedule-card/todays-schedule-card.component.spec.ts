import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse, CalendarEventsResponse } from '../../../calendar/models/calendar-event.model';
import { TodaysScheduleCardComponent } from './todays-schedule-card.component';
import { MeetingApiService } from '../../../work/meetings/data-access/meeting-api.service';
import { MeetingListItem } from '../../../work/meetings/models/meeting.models';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { PlannerRangeBlockView, PlannerRangeResponse } from '../../../work/planner/models/planner.models';

function event(partial: Partial<CalendarEventResponse> & { id: string; title: string; startDate: string; endDate: string }): CalendarEventResponse {
  return {
    description: null, sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false,
    timezone: null, eventStatus: null, isPrivate: false, location: null, meetingLink: null,
    externalSource: null, createdById: 'creator-1', isRecurringOccurrence: false, recurrenceMasterId: null,
    originalStart: null, participants: null, hasConflict: false,
    ...partial
  };
}

const noPlan: PlannerRangeResponse = { timezone: 'UTC', today: '', days: [] };

describe('TodaysScheduleCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    events: CalendarEventsResponse | 'error' = { events: [] },
    timezone = 'Asia/Colombo'
  ): Promise<{
    fixture: ComponentFixture<TodaysScheduleCardComponent>;
    getEvents: ReturnType<typeof vi.fn>;
    getMyTimezone: ReturnType<typeof vi.fn>;
  }> {
    const getEvents = vi.fn(() => (events === 'error' ? throwError(() => new Error('network error')) : of(events)));
    const getMyTimezone = vi.fn(() => of({ timezone }));

    await TestBed.configureTestingModule({
      imports: [TodaysScheduleCardComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarEventApiService, useValue: { getEvents, getMyTimezone } },
        { provide: MeetingApiService, useValue: { list: vi.fn(() => of([])) } },
        { provide: PlannerApiService, useValue: { getRange: vi.fn(() => of(noPlan)) } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    return { fixture, getEvents, getMyTimezone };
  }

  it('the hover refresh button fetches today again', async () => {
    const { fixture, getEvents } = await setup();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="popout-expand"]')).toBeNull();
    (el.querySelector('[data-testid="popout-refresh"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getEvents).toHaveBeenCalledTimes(2);
  });

  it('resolves the viewer timezone before fetching events, and requests a UTC range covering today', async () => {
    const { getEvents, getMyTimezone } = await setup();
    expect(getMyTimezone).toHaveBeenCalledOnce();
    expect(getEvents).toHaveBeenCalledOnce();
    const [from, to] = getEvents.mock.calls[0];
    expect(new Date(from).getTime()).toBeLessThan(new Date(to).getTime());
  });

  it('shows an intentional empty state when there are no events today', async () => {
    const { fixture } = await setup({ events: [] });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('No events scheduled today');
    expect(text).toContain('Your calendar is clear for the day.');
    expect(fixture.nativeElement.querySelector('[data-testid="todays-schedule-empty"]')).not.toBeNull();
  });

  it('lists events in time order with Completed / In Progress / Upcoming chips', async () => {
    const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
    const { fixture } = await setup({
      events: [
        event({ id: 'later', title: 'Later review', startDate: at(90), endDate: at(120), description: 'Review PR' }),
        event({ id: 'past', title: 'Past standup', startDate: at(-120), endDate: at(-90) }),
        event({ id: 'now', title: 'Running sync', startDate: at(-10), endDate: at(20) })
      ]
    });

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="todays-schedule-item"]'));
    expect(rows.map((r) => r.dataset['status'])).toEqual(['completed', 'inProgress', 'upcoming']);
    expect(rows.map((r) => r.querySelector('[data-testid="todays-schedule-status"]')!.textContent!.trim())).toEqual([
      'Completed',
      'In progress',
      'Upcoming'
    ]);
    expect(rows[2].textContent).toContain('Review PR');
  });

  it('limits the agenda list to 5 items', async () => {
    const now = new Date();
    const events = Array.from({ length: 6 }, (_, i) =>
      event({
        id: `evt-${i}`,
        title: `Event ${i}`,
        startDate: new Date(now.getTime() + (i + 1) * 15 * 60_000).toISOString(),
        endDate: new Date(now.getTime() + (i + 1) * 15 * 60_000).toISOString()
      })
    );

    const { fixture } = await setup({ events });
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="todays-schedule-item"]');
    expect(rows.length).toBe(5);
  });

  it('falls back to an empty list when the request fails', async () => {
    const { fixture } = await setup('error');
    expect(fixture.nativeElement.textContent).toContain('No events scheduled today');
  });

  it('links "View Calendar" to /calendar', async () => {
    const { fixture } = await setup();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-view-link"]');
    expect(link.getAttribute('href')).toBe('/calendar');
  });

  it('renders Start Meeting button when user is the organizer of an event with a meeting link', async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60_000).toISOString();
    const { fixture } = await setup({
      events: [
        event({
          id: 'zoom-1',
          title: 'Design Sync',
          startDate: soon,
          endDate: soon,
          meetingLink: 'https://us05web.zoom.us/j/81793600600',
          isOrganizer: true
        })
      ]
    });

    const btn: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-meeting-btn"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent!.trim()).toBe('Start');
    expect(btn.title).toBe('Start Zoom Meeting');
    expect(btn.getAttribute('href')).toBe('https://us05web.zoom.us/j/81793600600');
  });

  it('renders Join Meeting button when user is a participant of an event with a meeting link', async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60_000).toISOString();
    const { fixture } = await setup({
      events: [
        event({
          id: 'teams-1',
          title: 'Sprint Planning',
          startDate: soon,
          endDate: soon,
          meetingLink: 'https://teams.microsoft.com/l/meetup-join/123',
          isOrganizer: false
        })
      ]
    });

    const btn: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-meeting-btn"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent!.trim()).toBe('Join');
    expect(btn.title).toBe('Join Teams Meeting');
    expect(btn.getAttribute('href')).toBe('https://teams.microsoft.com/l/meetup-join/123');
  });

  it('renders item count, total time, and meetings/events counts in stats bar', async () => {
    const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
    const { fixture } = await setup({
      events: [
        event({ id: 'e1', title: 'Daily standup', startDate: at(-60), endDate: at(-30), meetingLink: 'https://zoom.us/j/1' }),
        event({ id: 'e2', title: 'Sprint planning', startDate: at(0), endDate: at(60), meetingLink: 'https://teams.microsoft.com/l/2' }),
        event({ id: 'e3', title: 'Feature development', startDate: at(90), endDate: at(150) })
      ]
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('3 items scheduled today');
    expect(text).toContain('2h 30m');
    expect(text).toContain('Total time');
    expect(text).toContain('2 Meetings');
    expect(text).toContain('1 Event');
  });

  it('a calendar event is a Meeting only when it has a meeting link, never from its title', async () => {
    const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
    const { fixture } = await setup({
      events: [event({ id: 'e1', title: 'Code review meeting', startDate: at(30), endDate: at(60) })]
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('0 Meetings');
    expect(text).toContain('1 Event');
  });

  it('an empty day offers only Add Quick Event, no sample schedule', async () => {
    const { fixture } = await setup();
    const empty: HTMLElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-empty"]');

    expect(empty).not.toBeNull();
    expect(empty.textContent).toContain('Add Quick Event');
    expect(empty.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders Open planner link with calendar path and text', async () => {
    const { fixture } = await setup();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-view-link"]');
    expect(link.getAttribute('href')).toBe('/calendar');
    expect(link.textContent).toContain('Open planner');
  });
});

describe('TodaysScheduleCardComponent - meetings', () => {
  afterEach(() => TestBed.resetTestingModule());

  const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
  const meeting = (id: string, title: string, start: string, end: string): MeetingListItem => ({
    taskId: id, shortId: `ACME-${id}`, seriesId: `s-${id}`, originalStart: start, startAt: start, endAt: end, isAllDay: false,
    title, status: 'scheduled', isPrivate: false, projectId: 'p1', objectiveId: 'o1', myRole: 'attendee', myResponse: 'accepted',
  });

  async function setup(events: CalendarEventResponse[], meetings: MeetingListItem[]) {
    const list = vi.fn(() => of(meetings));
    await TestBed.configureTestingModule({
      imports: [TodaysScheduleCardComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarEventApiService, useValue: { getEvents: vi.fn(() => of({ events })), getMyTimezone: vi.fn(() => of({ timezone: 'UTC' })) } },
        { provide: MeetingApiService, useValue: { list } },
        { provide: PlannerApiService, useValue: { getRange: vi.fn(() => of(noPlan)) } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, list };
  }

  it("today's meetings lists only today's items, sorted by start", async () => {
    const today = new Date();
    const todayAt = (h: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), h)).toISOString();
    const tomorrow = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1, 9)).toISOString();
    const { fixture, list } = await setup([], [
      meeting('b', 'Afternoon review', todayAt(15), todayAt(16)),
      meeting('x', 'Tomorrow planning', tomorrow, tomorrow),
      meeting('a', 'Morning standup', todayAt(9), todayAt(10)),
    ]);

    expect(list).toHaveBeenCalledOnce();
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="todays-meetings-item"]'));
    expect(rows.map((r) => r.querySelector('[data-testid="meeting-card-title"]')?.textContent?.trim()))
      .toEqual(['Morning standup', 'Afternoon review']);
  });

  it('legacy events are labelled Calendar event', async () => {
    const { fixture } = await setup([event({ id: 'e1', title: 'Dentist', startDate: at(60), endDate: at(90) })], []);
    const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-item"]');
    expect(row.querySelector('[data-testid="todays-schedule-kind"]')?.textContent?.trim()).toBe('Calendar event');
  });

  it('a cancelled meeting is left out of the meetings list', async () => {
    const today = new Date();
    const todayAt = (h: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), h)).toISOString();
    const { fixture } = await setup([], [
      { ...meeting('c', 'Called off', todayAt(15), todayAt(16)), status: 'cancelled' },
      meeting('a', 'Morning standup', todayAt(9), todayAt(10)),
    ]);

    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="todays-meetings-item"]'));
    expect(rows.map((r) => r.querySelector('[data-testid="meeting-card-title"]')?.textContent?.trim()))
      .toEqual(['Morning standup']);
  });

  it('a task meeting the calendar feed also returns is listed once, under the meetings', async () => {
    // A fixed hour of today (the viewer zone is UTC here), so the test does not depend on the time it runs at.
    const today = new Date();
    const todayAt = (h: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), h)).toISOString();
    const m = meeting('a', 'Morning standup', todayAt(9), todayAt(10));
    const { fixture } = await setup(
      [event({ id: 'a', title: 'Morning standup', startDate: m.startAt, endDate: m.endAt, itemKind: 'meeting' })], [m]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="todays-schedule-item"]').length).toBe(0);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="todays-meetings-item"]').length).toBe(1);
  });
});

describe('TodaysScheduleCardComponent - planner blocks', () => {
  afterEach(() => TestBed.resetTestingModule());

  // Fixed hours of today in UTC, the viewer zone here, so a test never depends on the time it runs at.
  const today = new Date();
  const todayAt = (h: number, m = 0): string =>
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), h, m)).toISOString();

  const block = (id: string, title: string, start: string, end: string, more: Partial<PlannerRangeBlockView> = {}): PlannerRangeBlockView => ({
    id, taskId: `task-${id}`, projectId: 'proj-1', projectName: 'E-pos_System', taskTitle: title, startAt: start, endAt: end,
    plannedMinutes: 60, actualMinutes: 0, stillAssigned: true, ...more
  });
  const meeting = (id: string, title: string, start: string, end: string): MeetingListItem => ({
    taskId: id, shortId: `ACME-${id}`, seriesId: `s-${id}`, originalStart: start, startAt: start, endAt: end, isAllDay: false,
    title, status: 'scheduled', isPrivate: false, projectId: 'p1', objectiveId: 'o1', myRole: 'attendee', myResponse: 'accepted',
  } as MeetingListItem);

  async function setup(options: {
    blocks?: PlannerRangeBlockView[]; otherDayBlocks?: PlannerRangeBlockView[]; meetings?: MeetingListItem[];
    events?: CalendarEventResponse[]; plannerFails?: boolean;
  }) {
    const getRange = vi.fn((from: string): Observable<PlannerRangeResponse> => options.plannerFails
      ? throwError(() => new Error('503 planner_disabled'))
      : of({
          timezone: 'UTC', today: from,
          days: [
            { date: '1999-01-01', editable: false, workWindow: null, blocks: options.otherDayBlocks ?? [], blockMinutes: 0, workingMinutes: 0 },
            { date: from, editable: true, workWindow: null, blocks: options.blocks ?? [], blockMinutes: 0, workingMinutes: 0 },
          ]
        }));
    await TestBed.configureTestingModule({
      imports: [TodaysScheduleCardComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarEventApiService, useValue: { getEvents: vi.fn(() => of({ events: options.events ?? [] })), getMyTimezone: vi.fn(() => of({ timezone: 'UTC' })) } },
        { provide: MeetingApiService, useValue: { list: vi.fn(() => of(options.meetings ?? [])) } },
        { provide: PlannerApiService, useValue: { getRange } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, getRange };
  }

  const taskRows = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLElement>('[data-testid="todays-schedule-task"]'));

  it("asks the planner for today only, in the viewer's zone", async () => {
    const { getRange } = await setup({});
    const expected = today.toISOString().slice(0, 10);
    expect(getRange).toHaveBeenCalledExactlyOnceWith(expected, expected);
  });

  it('lists a planned task with its time, project and a Task badge', async () => {
    const { el } = await setup({ blocks: [block('a', 'Due-today demo task 8', todayAt(14), todayAt(15, 30))] });
    const row = taskRows(el)[0];
    expect(row.textContent).toContain('Due-today demo task 8');
    expect(row.textContent).toContain('E-pos_System');
    expect(row.querySelector('[data-testid="todays-schedule-task-badge"]')?.textContent?.trim()).toBe('Task');
  });

  it("links a planned task to it on its project's board", async () => {
    const { el } = await setup({ blocks: [block('a', 'Fix login', todayAt(14), todayAt(15))] });
    const link = el.querySelector<HTMLAnchorElement>('[data-testid="todays-schedule-task-link"]')!;
    expect(link.getAttribute('href')).toBe('/work/proj-1/board?taskId=task-a');
  });

  it("leaves out another day's blocks", async () => {
    const { el } = await setup({ blocks: [block('a', 'Today', todayAt(9), todayAt(10))], otherDayBlocks: [block('b', 'Elsewhere', todayAt(11), todayAt(12))] });
    expect(taskRows(el).length).toBe(1);
    expect(el.textContent).not.toContain('Elsewhere');
  });

  it('merges tasks, meetings and events into one numbered timeline in time order', async () => {
    const { el } = await setup({
      blocks: [block('t', 'Afternoon task', todayAt(14), todayAt(15))],
      meetings: [meeting('m', 'Morning standup', todayAt(9), todayAt(10))],
      events: [event({ id: 'e', title: 'Lunch talk', startDate: todayAt(12), endDate: todayAt(13) })],
    });
    const rows = Array.from(el.querySelectorAll<HTMLElement>(
      '[data-testid="todays-meetings-item"], [data-testid="todays-schedule-item"], [data-testid="todays-schedule-task"]'));
    expect(rows.map((r) => r.dataset['testid'])).toEqual(['todays-meetings-item', 'todays-schedule-item', 'todays-schedule-task']);
    expect(el.textContent).toContain('3 items scheduled today');
  });

  it('marks a planned task by the time now', async () => {
    const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
    const { el } = await setup({ blocks: [
      block('done', 'Done', at(-120), at(-90)), block('now', 'Now', at(-10), at(20)), block('next', 'Next', at(90), at(120))
    ] });
    expect(taskRows(el).map((r) => r.dataset['status'])).toEqual(['completed', 'inProgress', 'upcoming']);
  });

  it('counts tasks in the summary', async () => {
    const { el } = await setup({ blocks: [block('a', 'One', todayAt(9), todayAt(10)), block('b', 'Two', todayAt(11), todayAt(12))] });
    expect(el.querySelector('[data-testid="todays-schedule-tasks-count"]')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('2 Tasks');
  });

  it('counts overlapping time once in the total', async () => {
    const { el } = await setup({
      blocks: [block('a', 'Long task', todayAt(9, 30), todayAt(11, 30))],
      meetings: [meeting('m', 'Weekly sync', todayAt(10), todayAt(11))],
    });
    expect(el.textContent).toContain('2h');
    expect(el.textContent).not.toContain('3h');
  });

  it('still shows the rest of the day when the planner is off', async () => {
    const { el } = await setup({ plannerFails: true, events: [event({ id: 'e', title: 'Dentist', startDate: todayAt(12), endDate: todayAt(13) })] });
    expect(el.textContent).toContain('Dentist');
    expect(taskRows(el).length).toBe(0);
    expect(el.querySelector('[data-testid="todays-schedule-skeleton"]')).toBeNull();
  });

  it('a day with only planned tasks is not shown as empty', async () => {
    const { el } = await setup({ blocks: [block('a', 'Only task', todayAt(9), todayAt(10))] });
    expect(el.querySelector('[data-testid="todays-schedule-empty"]')).toBeNull();
  });

  it('has one Open planner link and one card frame', async () => {
    const { el } = await setup({});
    expect(el.querySelectorAll('[data-testid="todays-schedule-view-link"]').length).toBe(1);
    expect(el.querySelectorAll('section').length).toBe(1);
  });

  it('keeps the hover refresh and uses theme colours on the link', async () => {
    const { el } = await setup({});
    expect(el.querySelector('section')!.classList.contains('group')).toBe(true);
    expect(el.querySelector('[data-testid="popout-refresh"]')).not.toBeNull();
    const link = el.querySelector('[data-testid="todays-schedule-view-link"]')!;
    expect(link.className).toContain('var(--color-accent)');
    expect(link.className).not.toContain('border-blue-400');
  });
});
