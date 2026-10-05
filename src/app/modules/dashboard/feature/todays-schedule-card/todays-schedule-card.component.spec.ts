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

  it('highlights the nearest upcoming event as Next up', async () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 60_000).toISOString();
    const later = new Date(now.getTime() + 90 * 60_000).toISOString();
    const past = new Date(now.getTime() - 60 * 60_000).toISOString();

    const { fixture } = await setup({
      events: [
        event({ id: 'past', title: 'Past standup', startDate: past, endDate: past }),
        event({ id: 'later', title: 'Later review', startDate: later, endDate: later }),
        event({ id: 'soon', title: 'Soon sync', startDate: soon, endDate: soon })
      ]
    });

    const nextUp: HTMLElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-next-up"]');
    expect(nextUp.textContent).toContain('Soon sync');
  });

  it('limits the agenda list to 4 items', async () => {
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
    expect(rows.length).toBeLessThanOrEqual(4);
  });

  it('falls back to an empty list when the request fails', async () => {
    const { fixture } = await setup('error');
    expect(fixture.nativeElement.textContent).toContain('No events scheduled today');
  });

  it('links "View schedule" to /calendar', async () => {
    const { fixture } = await setup();
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-view-link"]');
    expect(link.getAttribute('href')).toBe('/calendar');
  });

  it('renders Start Meeting button when user is the organizer of the next event with a meeting link', async () => {
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

    const btn: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-next-meeting-btn"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Start Meeting');
    expect(btn.getAttribute('href')).toBe('https://us05web.zoom.us/j/81793600600');
    expect(fixture.nativeElement.textContent).toContain('Zoom');
  });

  it('renders Join Meeting button when user is a participant of the next event with a meeting link', async () => {
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

    const btn: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="todays-schedule-next-meeting-btn"]');
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Join Meeting');
    expect(btn.getAttribute('href')).toBe('https://teams.microsoft.com/l/meetup-join/123');
    expect(fixture.nativeElement.textContent).toContain('Teams');
  });
});
