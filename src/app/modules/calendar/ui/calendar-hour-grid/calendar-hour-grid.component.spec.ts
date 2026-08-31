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
