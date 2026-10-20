import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CalendarEventApiService } from '../../../calendar/data-access/calendar-event-api.service';
import { CalendarEventResponse, CalendarEventsResponse } from '../../../calendar/models/calendar-event.model';
import { TodaysScheduleCardComponent } from './todays-schedule-card.component';

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
        { provide: CalendarEventApiService, useValue: { getEvents, getMyTimezone } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TodaysScheduleCardComponent);
    fixture.detectChanges();
    return { fixture, getEvents, getMyTimezone };
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
});
