import { LeaveCalendarAbsenceResponse, LeaveCalendarDayResponse } from '../models/leave-calendar.model';
import { absentOn, buildAvailabilityWeeks, coverageConflictDays, upcomingAbsenceCount } from './team-availability.util';

function absence(overrides: Partial<LeaveCalendarAbsenceResponse>): LeaveCalendarAbsenceResponse {
  return {
    requestId: 'r1',
    employeeId: 'e1',
    employeeName: 'Abitha Devendran',
    departmentId: null,
    departmentName: null,
    legalEntityId: null,
    legalEntityName: null,
    leaveTypeId: 't1',
    leaveTypeName: 'Annual Leave',
    leaveTypeCode: 'AL',
    typeColorHex: null,
    status: 'approved',
    isTentative: false,
    isPartialCancellationHistory: false,
    startAt: '2026-10-05T09:00:00Z',
    endAt: '2026-10-07T18:00:00Z',
    totalHours: 24,
    ...overrides
  };
}

function day(date: string, absences: LeaveCalendarAbsenceResponse[] = [], holidays: string[] = []): LeaveCalendarDayResponse {
  return { date, dayOfWeek: '', absences, holidays: holidays.map((name) => ({ date, name, legalEntityId: null, legalEntityName: null, source: 'company' })) };
}

describe('buildAvailabilityWeeks', () => {
  it('lays October 2026 out in Sunday-first weeks with days outside the month marked', () => {
    const weeks = buildAvailabilityWeeks(2026, 10, []);
    expect(weeks.length).toBe(5);
    expect(weeks[0].days[0]).toEqual({ date: '2026-09-27', dayOfMonth: 27, inMonth: false });
    expect(weeks[0].days[4]).toEqual({ date: '2026-10-01', dayOfMonth: 1, inMonth: true });
  });

  it('draws one bar per request across the days it covers, stacking overlaps in lanes', () => {
    const a = absence({});
    const b = absence({ requestId: 'r2', employeeId: 'e2', employeeName: 'Suthan', leaveTypeName: 'Sick Leave', isTentative: true });
    const days = [day('2026-10-05', [a]), day('2026-10-06', [a, b]), day('2026-10-07', [a])];
    const week = buildAvailabilityWeeks(2026, 10, days)[1];
    expect(week.bars).toEqual([
      { id: 'leave:r1', label: 'Abitha Devendran – Annual Leave', kind: 'approved', start: 1, end: 3, lane: 0, date: '2026-10-05' },
      { id: 'leave:r2', label: 'Suthan – Sick Leave', kind: 'pending', start: 2, end: 2, lane: 1, date: '2026-10-06' }
    ]);
    expect(week.lanes).toBe(2);
  });

  it('shows holidays as bars and hides people filtered out', () => {
    const days = [day('2026-10-05', [absence({})], ['Diwali'])];
    const week = buildAvailabilityWeeks(2026, 10, days, () => false)[1];
    expect(week.bars.map((bar) => bar.kind)).toEqual(['holiday']);
  });
});

describe('absentOn / upcomingAbsenceCount / coverageConflictDays', () => {
  const days = [
    day('2026-10-29', [absence({ employeeId: 'e1' }), absence({ requestId: 'r2', employeeId: 'e2', isTentative: true })]),
    day('2026-10-30', [absence({ requestId: 'r3', employeeId: 'e3', startAt: '2026-10-30T09:00:00Z' })]),
    day('2026-11-10', [absence({ requestId: 'r4', employeeId: 'e4', startAt: '2026-11-10T09:00:00Z' })])
  ];

  it('splits who is off on a date into approved and pending', () => {
    const { approved, pending } = absentOn(days, '2026-10-29');
    expect([...approved]).toEqual(['e1']);
    expect([...pending]).toEqual(['e2']);
  });

  it('counts requests starting in the next seven days', () => {
    expect(upcomingAbsenceCount(days, '2026-10-29', 7)).toBe(1);
  });

  it('counts days where at least a quarter of the team is off', () => {
    expect(coverageConflictDays(days, 8)).toBe(1);
    expect(coverageConflictDays(days, 0)).toBe(0);
  });
});
