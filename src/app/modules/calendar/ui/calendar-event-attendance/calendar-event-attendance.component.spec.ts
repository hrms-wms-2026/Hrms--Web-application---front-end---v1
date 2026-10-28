import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CalendarEventApiService } from '../../data-access/calendar-event-api.service';
import { CalendarEventAttendanceComponent } from './calendar-event-attendance.component';

describe('CalendarEventAttendanceComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventAttendanceComponent>>;
  let api: { getMeetingAttendance: ReturnType<typeof vi.fn> };

  function setup(response: { available: boolean; attendees: unknown[]; syncStatus?: string; incidents?: unknown[] }) {
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

  it('shows when each attendee joined and left', () => {
    setup({
      available: true,
      attendees: [{ name: 'Ada', email: null, joinedAt: '2026-09-23T10:00:00Z', leftAt: '2026-09-23T10:30:00Z', durationSeconds: 1800 }]
    });
    const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-attendance-row"]').textContent)
      .toContain(`${time('2026-09-23T10:00:00Z')} – ${time('2026-09-23T10:30:00Z')}`);
  });

  it('lists the incidents the meeting raised, marking the estimated ones, even without an attendance report', () => {
    setup({
      available: false, attendees: [],
      incidents: [
        { employeeName: 'Pat Doe', rule: 'Missed meetings', occurrenceStart: '2026-09-23T10:00:00Z', estimated: true },
        { employeeName: 'Sam Lee', rule: 'Late decline', occurrenceStart: '2026-09-23T10:00:00Z', estimated: false }
      ]
    });
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-incident-row"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Pat Doe');
    expect(rows[0].textContent).toContain('Missed meetings');
    expect(rows[0].querySelector('[data-testid="calendar-incident-estimated"]')).not.toBeNull();
    expect(rows[1].querySelector('[data-testid="calendar-incident-estimated"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-attendance-unavailable"]')).toBeTruthy();
  });

  it('shows an unavailable state when attendance has not synced yet', () => {
    setup({ available: false, attendees: [], syncStatus: 'pending' });
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-attendance-unavailable"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-attendance-row"]')).toBeNull();
  });

  it('explains that attendance arrives after the meeting while it is pending', () => {
    setup({ available: false, attendees: [], syncStatus: 'pending' });
    expect(fixture.nativeElement.textContent).toContain('Attendance appears after the meeting ends');
  });

  it('never says nobody attended when no data was received', () => {
    setup({ available: false, attendees: [], syncStatus: 'attendance_unavailable' });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain("didn't send attendance data");
    expect(text).not.toContain('Nobody joined');
  });

  it('says the fetch failed when it did', () => {
    setup({ available: false, attendees: [], syncStatus: 'sync_failed' });
    expect(fixture.nativeElement.textContent).toContain("couldn't fetch attendance");
  });

  it('says nobody joined only for a final, empty report', () => {
    setup({ available: true, attendees: [], syncStatus: 'synced' });
    expect(fixture.nativeElement.textContent).toContain('Nobody joined this meeting');
  });
});
