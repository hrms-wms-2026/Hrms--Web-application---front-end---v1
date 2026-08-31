import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CalendarEventResponse } from '../../models/calendar-event.model';
import { CalendarAgendaViewComponent } from './calendar-agenda-view.component';

function makeEvent(id: string, startDate: string): CalendarEventResponse {
  return {
    id, title: id, description: null, startDate, endDate: startDate,
    sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC',
    eventStatus: null, isPrivate: false, location: null, meetingLink: null, externalSource: null,
    createdById: 'u1', isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null
  };
}

describe('CalendarAgendaViewComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarAgendaViewComponent>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarAgendaViewComponent] }).compileComponents();
    fixture = TestBed.createComponent(CalendarAgendaViewComponent);
    fixture.componentRef.setInput('events', [
      makeEvent('b', '2026-09-05T09:00:00Z'),
      makeEvent('a', '2026-09-01T09:00:00Z'),
      makeEvent('c', '2026-09-05T14:00:00Z')
    ]);
    fixture.detectChanges();
  });

  it('groups events under one date header per distinct day', () => {
    const headers = fixture.nativeElement.querySelectorAll('[data-testid="calendar-agenda-date-header"]');
    expect(headers.length).toBe(2);
  });

  it('sorts date groups and events within a group chronologically', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="calendar-agenda-row"]');
    expect(rows[0].textContent).toContain('a');
    expect(rows[1].textContent).toContain('b');
    expect(rows[2].textContent).toContain('c');
  });

  it('emits eventClick when a row is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.eventClick.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-agenda-row"]').click();
    expect(spy).toHaveBeenCalledWith('a');
  });
});
