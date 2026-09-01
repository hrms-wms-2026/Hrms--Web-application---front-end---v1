import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarMonthGridComponent } from './calendar-month-grid.component';

function makeEvent(id: string, startDate: string): CalendarEventResponse {
  return {
    id, title: `Event ${id}`, description: null, startDate, endDate: startDate,
    sourceType: 'manual', color: '#2563EB', recurrence: 'none', isAllDay: false, timezone: 'UTC',
    eventStatus: null, isPrivate: false, location: null, meetingLink: null, externalSource: null,
    createdById: 'u1', isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
  };
}

describe('CalendarMonthGridComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarMonthGridComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarMonthGridComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarMonthGridComponent);
    fixture.componentRef.setInput('year', 2026);
    fixture.componentRef.setInput('month', 9);
    fixture.componentRef.setInput('events', [makeEvent('e1', '2026-09-01T09:00:00Z')]);
    fixture.detectChanges();
  });

  it('renders 42 day cells', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="calendar-day-cell"]').length).toBe(42);
  });

  it('places an event chip on its correct day', () => {
    const cell = fixture.nativeElement.querySelector('[data-date="2026-09-01"]');
    expect(cell.querySelector('[data-testid="calendar-event-chip"]')).not.toBeNull();
  });

  it('shows "+N more" when a day has more than 3 events', () => {
    const many = Array.from({ length: 5 }, (_, i) => makeEvent(`e${i}`, '2026-09-10T09:00:00Z'));
    fixture.componentRef.setInput('events', many);
    fixture.detectChanges();
    const cell = fixture.nativeElement.querySelector('[data-date="2026-09-10"]');
    expect(cell.textContent).toContain('+2 more');
  });

  it('emits eventClick when a chip is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.eventClick.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-event-chip"]').click();
    expect(spy).toHaveBeenCalledWith('e1');
  });
});
