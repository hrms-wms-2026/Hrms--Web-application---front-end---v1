import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { CalendarEventMeetingStatusComponent } from './calendar-event-meeting-status.component';

describe('CalendarEventMeetingStatusComponent', () => {
  function setup(status: string, provider = 'zoom') {
    const api = {
      getMeeting: vi.fn().mockReturnValue(of({ status, provider, joinUrl: null, failureReason: null })),
      retryMeeting: vi.fn().mockReturnValue(of({ joinUrl: 'https://zoom.us/j/1' })),
      removeMeeting: vi.fn().mockReturnValue(of(undefined)),
      confirmMeetingCleanup: vi.fn().mockReturnValue(of(undefined))
    };
    TestBed.configureTestingModule({
      imports: [CalendarEventMeetingStatusComponent],
      providers: [{ provide: CalendarEventApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(CalendarEventMeetingStatusComponent);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.detectChanges();
    return { fixture, api };
  }

  it('renders nothing for an active meeting', () => {
    const { fixture } = setup('active');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-meeting-status"]')).toBeNull();
  });

  it('offers Retry and Remove when the status is unknown', () => {
    const { fixture, api } = setup('provisioning_unknown');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Meeting link status unknown');
    (fixture.nativeElement.querySelector('[data-testid="calendar-meeting-retry"]') as HTMLButtonElement).click();
    expect(api.retryMeeting).toHaveBeenCalledWith('event-1');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-meeting-remove"]')).not.toBeNull();
  });

  it('asks the organizer to clean up and confirm when unresolved', () => {
    const { fixture, api } = setup('unresolved');
    expect(fixture.nativeElement.textContent).toContain('may still exist');
    (fixture.nativeElement.querySelector('[data-testid="calendar-meeting-confirm-cleanup"]') as HTMLButtonElement).click();
    expect(api.confirmMeetingCleanup).toHaveBeenCalledWith('event-1');
  });

  it('says the link could not be created when failed', () => {
    const { fixture } = setup('failed', 'microsoft_teams');
    expect(fixture.nativeElement.textContent).toContain("couldn't be created");
  });
});
