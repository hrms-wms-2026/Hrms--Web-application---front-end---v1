import { Router, provideRouter } from '@angular/router';
import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse, CalendarEventsResponse } from '../../../calendar/models/calendar-event.model';
import { TodaysScheduleCardComponent, joinLinkOf } from './todays-schedule-card.component';
import { MeetingApiService } from '../../../work/meetings/data-access/meeting-api.service';
import { MeetingListItem, MeetingSeriesLinkResponse } from '../../../work/meetings/models/meeting.models';
import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { PlannerRangeBlockView, PlannerRangeResponse } from '../../../work/planner/models/planner.models';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { TaskFormModalComponent } from '../../../work/ui/task-form-modal/task-form-modal.component';

/** Stands in for the task popup, which needs the whole work module behind it. */
@Component({ selector: 'app-task-form-modal', standalone: true, template: '' })
class TaskFormModalStub {
  readonly open = input(false);
  readonly mode = input('edit');
  readonly projectId = input('');
  readonly taskId = input<string | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();
}

function projectsStub(projectError: string | null = null) {
  return {
    loadProject: vi.fn(() => Promise.resolve()),
    loadMyMilestones: vi.fn(() => Promise.resolve()),
    projectError: () => projectError,
  };
}

function useTestDoubles(projects = projectsStub()) {
  TestBed.overrideProvider(ProjectDetailStore, { useValue: projects });
  TestBed.overrideComponent(TodaysScheduleCardComponent, {
    remove: { imports: [TaskFormModalComponent] },
    add: { imports: [TaskFormModalStub] },
  });
}

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
  beforeEach(() => useTestDoubles());
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
        { provide: MeetingApiService, useValue: { list: vi.fn(() => of([])), getLink: vi.fn(() => of({ joinUrl: null })) } },
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
  beforeEach(() => useTestDoubles());
  afterEach(() => TestBed.resetTestingModule());

  const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
  const meeting = (id: string, title: string, start: string, end: string): MeetingListItem => ({
    taskId: id, shortId: `ACME-${id}`, seriesId: `s-${id}`, originalStart: start, startAt: start, endAt: end, isAllDay: false,
    title, status: 'scheduled', isPrivate: false, projectId: 'p1', objectiveId: 'o1', myRole: 'attendee', myResponse: 'accepted',
  });

  async function setup(
    events: CalendarEventResponse[], meetings: MeetingListItem[],
    getLink: (seriesId: string) => Observable<MeetingSeriesLinkResponse> = () => of({ joinUrl: null })
  ) {
    const list = vi.fn(() => of(meetings));
    const getLinkSpy = vi.fn(getLink);
    await TestBed.configureTestingModule({
      imports: [TodaysScheduleCardComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarEventApiService, useValue: { getEvents: vi.fn(() => of({ events })), getMyTimezone: vi.fn(() => of({ timezone: 'UTC' })) } },
        { provide: MeetingApiService, useValue: { list, getLink: getLinkSpy } },
        { provide: PlannerApiService, useValue: { getRange: vi.fn(() => of(noPlan)) } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, list, getLink: getLinkSpy };
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

  describe('Join', () => {
    // The clock is noon UTC today (the viewer zone here), so 13:00 is upcoming and 09:00 has ended, whatever the real time.
    const today = new Date();
    const todayAt = (h: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), h)).toISOString();
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(todayAt(12)));
    });
    afterEach(() => vi.useRealTimers());

    const teams = (url: string): MeetingSeriesLinkResponse => ({ joinUrl: url });
    const joinOf = (row: HTMLElement) => row.querySelector<HTMLAnchorElement>('[data-testid="todays-meeting-join-btn"]');

    it("offers Join on an upcoming meeting's Teams link, in a new tab, without opening the meeting drawer", async () => {
      const { fixture, getLink } = await setup([], [meeting('a', 'Sprint review', todayAt(13), todayAt(14))],
        () => of(teams('https://teams.microsoft.com/l/meetup-join/abc')));
      const row: HTMLElement = fixture.nativeElement.querySelector('[data-testid="todays-meetings-item"]');
      const join = joinOf(row)!;

      expect(getLink).toHaveBeenCalledExactlyOnceWith('s-a');
      expect(join.getAttribute('href')).toBe('https://teams.microsoft.com/l/meetup-join/abc');
      expect(join.target).toBe('_blank');
      expect(join.rel).toContain('noopener');
      // The Meeting badge turns into Join while it is hovered (or the row is focused).
      const badge = row.querySelector<HTMLElement>('[data-testid="todays-meeting-badge"]')!;
      expect(badge.textContent?.trim()).toBe('Meeting');
      expect(badge.className).toContain('group-hover/join:hidden');
      expect(join.className).toContain('hidden');
      expect(join.className).toContain('group-hover/join:inline-flex');
      expect(badge.parentElement).toBe(join.parentElement);

      join.addEventListener('click', (e) => e.preventDefault());
      join.click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-meeting-occurrence-drawer')).toBeNull();
    });

    it('offers no Join when the meeting has no link, it has ended, or the link could not be read', async () => {
      const { fixture } = await setup([], [
        meeting('none', 'No link', todayAt(13), todayAt(14)),
        meeting('done', 'Ended', todayAt(9), todayAt(10)),
        meeting('err', 'Broken', todayAt(15), todayAt(16)),
      ], (seriesId) => seriesId === 's-none' ? of({ joinUrl: null })
        : seriesId === 's-err' ? throwError(() => new Error('403')) : of(teams('https://zoom.us/j/1')));
      const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="todays-meetings-item"]'));
      expect(rows.map((r) => joinOf(r))).toEqual([null, null, null]);
      // The plain Meeting badge stays, with nothing to swap to.
      expect(rows.map((r) => r.querySelector('[data-testid="todays-meeting-badge"]')?.textContent?.trim())).toEqual(['Meeting', 'Meeting', 'Meeting']);
    });

    it("the organizer joins by the organizer link, labelled with the provider", () => {
      expect(joinLinkOf({
        joinUrl: 'https://zoom.us/j/1',
        link: { linkId: 'l', provider: 'zoom', status: 'active', joinUrl: 'https://zoom.us/j/1', organizerJoinUrl: 'https://zoom.us/s/1',
          failureReason: null, generation: 1, releasePending: false },
      })).toEqual({ url: 'https://zoom.us/s/1', label: 'Join on Zoom' });
      expect(joinLinkOf({ joinUrl: 'javascript:alert(1)' })).toBeNull();
    });
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
    events?: CalendarEventResponse[]; plannerFails?: boolean; projectError?: string;
  }) {
    const projects = projectsStub(options.projectError ?? null);
    useTestDoubles(projects);
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
        { provide: MeetingApiService, useValue: { list: vi.fn(() => of(options.meetings ?? [])), getLink: vi.fn(() => of({ joinUrl: null })) } },
        { provide: PlannerApiService, useValue: { getRange } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, getRange, projects };
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

  it('opens a planned task in the task popup on the dashboard', async () => {
    const { fixture, el, projects } = await setup({ blocks: [block('a', 'Fix login', todayAt(14), todayAt(15))] });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    expect(el.querySelector('app-task-form-modal')).toBeNull();

    el.querySelector<HTMLElement>('[data-testid="todays-schedule-task-link"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(projects.loadProject).toHaveBeenCalledWith('proj-1');
    expect(projects.loadMyMilestones).toHaveBeenCalledWith('proj-1');
    expect(navigate).not.toHaveBeenCalled();
    const popup = fixture.debugElement.query((d) => d.componentInstance instanceof TaskFormModalStub)!.componentInstance as TaskFormModalStub;
    expect(popup.taskId()).toBe('task-a');
    expect(popup.projectId()).toBe('proj-1');

    popup.closed.emit();
    fixture.detectChanges();
    expect(el.querySelector('app-task-form-modal')).toBeNull();
  });

  it("opens the project's board instead when the task's project can't load", async () => {
    const { fixture, el } = await setup({ blocks: [block('a', 'Fix login', todayAt(14), todayAt(15))], projectError: 'Forbidden' });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    el.querySelector<HTMLElement>('[data-testid="todays-schedule-task-link"]')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).toHaveBeenCalledWith(['/work', 'proj-1', 'board'], { queryParams: { taskId: 'task-a' } });
    expect(el.querySelector('app-task-form-modal')).toBeNull();
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
