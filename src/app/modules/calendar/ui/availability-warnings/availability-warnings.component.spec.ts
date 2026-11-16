import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthStore } from '../../../../core/auth/state/auth.store';
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
  const currentEmployeeId = signal<string | null>(null);
  const rows = () => [...fixture.nativeElement.querySelectorAll('[data-testid="availability-row"]')]
    .map((el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ').trim());
  const byId = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const show = (conflicts: CalendarConflict[]) => {
    fixture.componentRef.setInput('conflicts', conflicts);
    fixture.detectChanges();
  };

  beforeEach(() => {
    currentEmployeeId.set(null);
    TestBed.configureTestingModule({
      providers: [{ provide: AuthStore, useValue: { employeeId: currentEmployeeId } }],
    });
    fixture = TestBed.createComponent(AvailabilityWarningsComponent);
    fixture.componentRef.setInput('timezone', 'UTC');
  });

  it('groups rows by person in kind order, as sentences about each person', () => {
    show([
      row('Bob', 'event', 'Standup'),
      row('Ada', 'outside_hours', 'Outside working hours (09:00–17:00)'),
      row('Ada', 'event', 'Design review'),
      row('Ada', 'leave', 'On leave'),
      row('Ada', 'holiday', 'Public holiday: Deepavali'),
    ]);

    expect(rows()).toEqual([
      'Ada is on leave · 9:00 AM–9:30 AM',
      "It's a public holiday for Ada (Deepavali) · 9:00 AM–9:30 AM",
      "Outside Ada's working hours (09:00–17:00) · 9:00 AM–9:30 AM",
      'Ada has another meeting: Design review · 9:00 AM–9:30 AM',
      'Bob has another meeting: Standup · 9:00 AM–9:30 AM',
    ]);
  });

  it('says "you" for the signed-in employee and lists them first', () => {
    currentEmployeeId.set('DAPI');
    show([
      row('Ada', 'leave', 'On leave'),
      { ...row('Dapi Owner', 'outside_hours', 'Outside working hours (09:00–18:00)'), employeeId: 'dapi' },
    ]);

    expect(rows()).toEqual([
      'This is outside your working hours (09:00–18:00) · 9:00 AM–9:30 AM',
      'Ada is on leave · 9:00 AM–9:30 AM',
    ]);
  });

  it('words every kind for the signed-in employee', () => {
    currentEmployeeId.set('Me');
    show([
      row('Me', 'leave', 'On leave'),
      row('Me', 'holiday', 'Public holiday: Poya Day'),
      row('Me', 'outside_hours', 'Non-working day'),
      row('Me', 'event', 'Standup'),
      { ...row('Me', 'event', 'Busy'), isBusyOnly: true },
    ]);

    expect(rows()).toEqual([
      "You're on leave · 9:00 AM–9:30 AM",
      "It's a public holiday for you (Poya Day) · 9:00 AM–9:30 AM",
      'This is your non-working day · 9:00 AM–9:30 AM',
      'You have another meeting: Standup · 9:00 AM–9:30 AM',
      "You're busy · 9:00 AM–9:30 AM",
    ]);
  });

  it('words busy, non-working day and names ending in s for other people', () => {
    show([
      row('James', 'leave', 'Busy'),
      row('James', 'outside_hours', 'Non-working day'),
      { ...row('James', 'event', 'Busy'), isBusyOnly: true },
    ]);

    expect(rows()).toEqual([
      'James is busy · 9:00 AM–9:30 AM',
      "It's James' non-working day · 9:00 AM–9:30 AM",
      'James is busy · 9:00 AM–9:30 AM',
    ]);
  });

  it('falls back to "Name: label" for a label it does not know', () => {
    show([row('Ada', 'outside_hours', 'Something new')]);

    expect(rows()).toEqual(['Ada: Something new · 9:00 AM–9:30 AM']);
  });

  it('treats missing kind as event', () => {
    const legacy = { ...row('Ada', 'event', 'Standup'), kind: undefined };
    show([legacy, row('Ada', 'leave', 'On leave')]);

    expect(rows()).toEqual(['Ada is on leave · 9:00 AM–9:30 AM', 'Ada has another meeting: Standup · 9:00 AM–9:30 AM']);
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
