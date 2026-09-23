import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { CalendarEventAttendanceComponent } from './calendar-event-attendance.component';

describe('CalendarEventAttendanceComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventAttendanceComponent>>;
  let api: { getMeetingAttendance: ReturnType<typeof vi.fn> };

  function setup(response: { available: boolean; attendees: unknown[] }) {
    api = { getMeetingAttendance: vi.fn().mockReturnValue(of(response)) };
    TestBed.configureTestingModule({
      imports: [CalendarEventAttendanceComponent],
      providers: [{ provide: CalendarEventApiService, useValue: api }]
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventAttendanceComponent);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.detectChanges();
  }

  it('requests attendance for the given event id', () => {
    setup({ available: false, attendees: [] });
    expect(api.getMeetingAttendance).toHaveBeenCalledWith('event-1');
  });

  it('renders each attendee when data is available', () => {
    setup({
      available: true,
      attendees: [
        { name: 'Ada Lovelace', email: 'ada@example.com', joinedAt: '2026-09-23T10:00:00Z', leftAt: '2026-09-23T10:30:00Z', durationSeconds: 1800 }
      ]
    });
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-attendance-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Ada Lovelace');
    expect(rows[0].textContent).toContain('30m');
  });

  it('falls back to the email when no name is present', () => {
    setup({
      available: true,
      attendees: [{ name: null, email: 'guest@example.com', joinedAt: '2026-09-23T10:00:00Z', leftAt: null, durationSeconds: null }]
    });
    const row = fixture.nativeElement.querySelector('[data-testid="calendar-attendance-row"]');
    expect(row.textContent).toContain('guest@example.com');
  });

  it('shows an unavailable state when attendance has not synced yet', () => {
    setup({ available: false, attendees: [] });
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-attendance-unavailable"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-attendance-row"]')).toBeNull();
  });
});
