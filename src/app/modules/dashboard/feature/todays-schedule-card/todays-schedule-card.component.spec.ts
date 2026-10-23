import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse, CalendarEventsResponse } from '../../../calendar/models/calendar-event.model';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { MyTaskItem } from '../../models/my-tasks.model';
import { TodaysScheduleCardComponent, compactTimeRange } from './todays-schedule-card.component';

function event(partial: Partial<CalendarEventResponse> & { id: string; title: string; startDate: string; endDate: string }): CalendarEventResponse {
  return {
    description: null, sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false,
    timezone: null, eventStatus: null, isPrivate: false, location: null, meetingLink: null,
    externalSource: null, createdById: 'creator-1', isRecurringOccurrence: false, recurrenceMasterId: null,
    originalStart: null, participants: null, hasConflict: false,
    ...partial
  };
}

describe('TodaysScheduleCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(
    events: CalendarEventsResponse | 'error' = { events: [] },
    timezone = 'Asia/Colombo',
    tasks: MyTaskItem[] | 'error' = []
  ): Promise<{
    fixture: ComponentFixture<TodaysScheduleCardComponent>;
    getEvents: ReturnType<typeof vi.fn>;
    getMyTimezone: ReturnType<typeof vi.fn>;
    getMyTasks: ReturnType<typeof vi.fn>;
  }> {
    const getEvents = vi.fn(() => (events === 'error' ? throwError(() => new Error('network error')) : of(events)));
    const getMyTimezone = vi.fn(() => of({ timezone }));
    const getMyTasks = vi.fn(() => (tasks === 'error' ? throwError(() => new Error('network error')) : of({ tasks })));

    await TestBed.configureTestingModule({
      imports: [TodaysScheduleCardComponent],
      providers: [
        provideRouter([]),
        { provide: CalendarEventApiService, useValue: { getEvents, getMyTimezone } },
        { provide: MyTasksApiService, useValue: { getMyTasks } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    return { fixture, getEvents, getMyTimezone, getMyTasks };
  }

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
      'In Progress',
      'Upcoming'
    ]);
    expect(rows[2].textContent).toContain('Review PR');
    expect(rows[1].querySelector('[data-testid="todays-schedule-row"]')!.className).toContain('bg-emerald-50');
  });

  it('picks a row icon from the event title, falling back to the calendar icon', async () => {
    const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
    const { fixture } = await setup({
      events: [
        event({ id: 'a', title: 'Daily Standup', startDate: at(10), endDate: at(20) }),
        event({ id: 'b', title: 'Code Review (PR #482)', startDate: at(30), endDate: at(40) }),
        event({ id: 'c', title: 'Feature Discussion', startDate: at(50), endDate: at(60) }),
        event({ id: 'd', title: 'Client Meeting', startDate: at(70), endDate: at(80) }),
        event({ id: 'e', title: 'Lunch', startDate: at(90), endDate: at(100) })
      ]
    });
    const kinds = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="todays-schedule-icon"]')).map(
      (el) => (el as HTMLElement).dataset['kind']
    );
    expect(kinds).toEqual(['team', 'code', 'chat', 'doc', 'calendar']);
  });

  it('shows one AM/PM suffix for a range that stays in the same half of the day', () => {
    expect(compactTimeRange(new Date(2026, 9, 22, 9, 0), new Date(2026, 9, 22, 9, 30))).toBe('09:00 – 09:30 AM');
    expect(compactTimeRange(new Date(2026, 9, 22, 11, 30), new Date(2026, 9, 22, 12, 30))).toBe('11:30 AM – 12:30 PM');
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

  it('lists tasks due today and overdue after the meetings, linking each to its project board', async () => {
    const at = (minutes: number): string => new Date(Date.now() + minutes * 60_000).toISOString();
    const { fixture, getMyTasks } = await setup({ events: [event({ id: 'm', title: 'Daily Standup', startDate: at(30), endDate: at(45) })] }, 'Asia/Colombo', [
      task({ taskId: 't-today', title: 'Write release notes', isOverdue: false, projectName: 'Onexso' }),
      task({ taskId: 't-late', title: 'Fix login bug', isOverdue: true, projectName: 'Watercraft' })
    ]);
    expect(getMyTasks).toHaveBeenCalledWith(0);
    const rows: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="todays-schedule-item"]'));
    expect(rows.map((r) => r.dataset['status'])).toEqual(['upcoming', 'overdue', 'due']);
    expect(rows[1].textContent).toContain('Fix login bug');
    expect(rows[1].textContent).toContain('Watercraft');
    expect(rows[1].textContent).toContain('Overdue');
    expect(rows[2].textContent).toContain('Due today');
    const link: HTMLAnchorElement = rows[2].querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/work/p-1/board?taskId=t-today');
  });

  it('shows tasks without meetings, and the empty state only when there are neither', async () => {
    const withTasks = await setup({ events: [] }, 'Asia/Colombo', [task({ taskId: 't1', title: 'Only a task' })]);
    expect(withTasks.fixture.nativeElement.querySelector('[data-testid="todays-schedule-empty"]')).toBeNull();
    expect(withTasks.fixture.nativeElement.textContent).toContain('Only a task');
    TestBed.resetTestingModule();
    const failedTasks = await setup({ events: [] }, 'Asia/Colombo', 'error');
    expect(failedTasks.fixture.nativeElement.querySelector('[data-testid="todays-schedule-empty"]')).not.toBeNull();
  });
});

function task(partial: Partial<MyTaskItem> & { taskId: string; title: string }): MyTaskItem {
  return {
    shortId: 'T-1', dueDate: '2026-10-22', isOverdue: false, projectId: 'p-1', projectName: 'Project',
    objectiveId: 'o-1', priority: 'medium',
    ...partial
  };
}
