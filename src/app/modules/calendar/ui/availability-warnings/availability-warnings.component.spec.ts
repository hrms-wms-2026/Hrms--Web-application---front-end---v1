import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CalendarConflict } from '../../models/calendar-event.model';
import { AvailabilityWarningsComponent } from './availability-warnings.component';

const EMPTY = '00000000-0000-0000-0000-000000000000';

function row(employeeName: string, kind: CalendarConflict['kind'], title: string): CalendarConflict {
  return {
    employeeId: employeeName, employeeName, conflictingEventId: kind === 'event' ? 'e1' : EMPTY, conflictingEventTitle: title,
    overlapStart: '2026-11-03T09:00:00Z', overlapEnd: '2026-11-03T09:30:00Z', kind,
  };
}

describe('AvailabilityWarningsComponent', () => {
  let fixture: ComponentFixture<AvailabilityWarningsComponent>;
  const rows = () => [...fixture.nativeElement.querySelectorAll('[data-testid="availability-row"]')]
    .map((el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ').trim());
  const byId = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  beforeEach(() => {
    fixture = TestBed.createComponent(AvailabilityWarningsComponent);
    fixture.componentRef.setInput('timezone', 'UTC');
  });

  it('groups rows by person in kind order', () => {
    fixture.componentRef.setInput('conflicts', [
      row('Bob', 'event', 'Standup'),
      row('Ada', 'outside_hours', 'Outside working hours (09:00–17:00)'),
      row('Ada', 'event', 'Design review'),
      row('Ada', 'leave', 'On leave'),
      row('Ada', 'holiday', 'Public holiday: Deepavali'),
    ]);
    fixture.detectChanges();

    expect(rows()).toEqual([
      'Ada: On leave · 9:00 AM–9:30 AM',
      'Ada: Public holiday: Deepavali · 9:00 AM–9:30 AM',
      'Ada: Outside working hours (09:00–17:00) · 9:00 AM–9:30 AM',
      'Ada: Design review · 9:00 AM–9:30 AM',
      'Bob: Standup · 9:00 AM–9:30 AM',
    ]);
  });

  it('treats missing kind as event', () => {
    const legacy = { ...row('Ada', 'event', 'Standup'), kind: undefined };
    fixture.componentRef.setInput('conflicts', [legacy, row('Ada', 'leave', 'On leave')]);
    fixture.detectChanges();

    expect(rows()).toEqual(['Ada: On leave · 9:00 AM–9:30 AM', 'Ada: Standup · 9:00 AM–9:30 AM']);
  });

  it('shows checking then clear state', () => {
    fixture.componentRef.setInput('conflicts', []);
    fixture.componentRef.setInput('checking', true);
    fixture.detectChanges();
    expect(byId('availability-checking')?.textContent).toContain('Checking availability…');
    expect(byId('availability-clear')).toBeNull();

    fixture.componentRef.setInput('checking', false);
    fixture.detectChanges();
    expect(byId('availability-checking')).toBeNull();
    expect(byId('availability-clear')?.textContent).toContain('Everyone is available');
  });

  it('shows first occurrence note when repeating', () => {
    fixture.componentRef.setInput('conflicts', [row('Ada', 'leave', 'On leave')]);
    fixture.componentRef.setInput('repeating', true);
    fixture.detectChanges();

    expect(byId('availability-first-occurrence')?.textContent).toContain('Checked for the first occurrence');
  });
});
