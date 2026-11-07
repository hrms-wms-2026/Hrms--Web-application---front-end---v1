import { describe, expect, it } from 'vitest';
import { TeamAttendanceBucket, TeamAttendanceEmployeeRow, TeamAttendanceSummaryResponse } from '../models/team-attendance.model';
import { SummaryCardBody, SummaryCardModel } from '../models/summary-card.model';
import { teamAttendanceSummaryCards } from './team-attendance-summary-cards.util';

const counts = { present: 0, late: 0, absent: 0, onLeave: 0, pending: 0 };

function summary(over: Partial<TeamAttendanceSummaryResponse> = {}): TeamAttendanceSummaryResponse {
  return {
    mode: 'week',
    rangeStart: '2026-10-26',
    rangeEnd: '2026-11-01',
    timezone: 'UTC',
    today: '2026-10-28',
    eligibleToday: 25,
    todayCounts: { ...counts, present: 18, onLeave: 3 },
    todayRate: 96,
    periodCounts: counts,
    periodRate: 94,
    previousRate: 92,
    deltaPp: 2,
    trend: [
      { date: '2026-10-26', ...counts, rate: 90 },
      { date: '2026-10-27', ...counts, rate: null },
      { date: '2026-10-28', ...counts, rate: 96 }
    ],
    todayPreview: [
      { employeeId: 'p1', name: 'Priya N', avatarFileId: null, department: 'Design', bucket: 'leave', clockInAt: null },
      { employeeId: 'p2', name: 'Ravi K', avatarFileId: null, department: null, bucket: 'late', clockInAt: null },
      { employeeId: 'p3', name: 'Kavin R', avatarFileId: 'f3', department: null, bucket: 'leave', clockInAt: null }
    ],
    departments: [],
    teamSize: 25,
    calculatedAtUtc: '2026-10-28T10:00:00Z',
    isProvisional: true,
    departmentRates: [
      { id: 'e', name: 'Engineering', people: 10, attended: 97, expected: 100, rate: 97 },
      { id: 'd', name: 'Design', people: 5, attended: 47, expected: 50, rate: 94 },
      { id: 's', name: 'Sales', people: 5, attended: 44, expected: 50, rate: 88 },
      { id: 'h', name: 'HR', people: 2, attended: 0, expected: 0, rate: null }
    ],
    ...over
  };
}

function row(id: string, name: string, buckets: TeamAttendanceBucket[]): TeamAttendanceEmployeeRow {
  return {
    employeeId: id,
    name,
    avatarFileId: null,
    department: null,
    days: buckets.map((bucket, i) => ({ date: `2026-10-${26 + i}`, bucket })),
    attended: 0,
    eligibleDays: 0,
    rate: null,
    rank: null
  };
}

const byId = (cards: SummaryCardModel[], id: string) => cards.find((c) => c.id === id)!;
const body = <K extends SummaryCardBody['kind']>(card: SummaryCardModel, kind: K) => {
  expect(card.body?.kind).toBe(kind);
  return card.body as Extract<SummaryCardBody, { kind: K }>;
};

describe('teamAttendanceSummaryCards', () => {
  const ready = { rows: [] as TeamAttendanceEmployeeRow[], error: false };

  it('orders the four cards like the popup and points each at its section', () => {
    const cards = teamAttendanceSummaryCards(summary(), ready);
    expect(cards.map((c) => [c.id, c.section])).toEqual([
      ['att-rate', 'trend'],
      ['att-departments', 'departments'],
      ['att-attention', 'ranking'],
      ['att-leave', 'summary']
    ]);
  });

  it('shows the period rate, its change in pp and the daily rates', () => {
    const rate = body(byId(teamAttendanceSummaryCards(summary(), ready), 'att-rate'), 'spark');
    expect(rate.figure).toBe('94%');
    expect(rate.delta).toEqual({ text: '+2.0 pp', good: true, suffix: 'vs last week' });
    expect(rate.points).toEqual([90, null, 96]);
  });

  it('shows a dash and no change without a period rate', () => {
    const rate = body(byId(teamAttendanceSummaryCards(summary({ periodRate: null, deltaPp: null, mode: 'month' }), ready), 'att-rate'), 'spark');
    expect(rate.figure).toBe('—');
    expect(rate.delta).toBeNull();
  });

  it('lists the three departments that need attention most, worst rate first like the popup, amber under 90%', () => {
    const d = body(byId(teamAttendanceSummaryCards(summary(), ready), 'att-departments'), 'hbars');
    expect(d.headline).toBe('Overall 94%');
    expect(d.rows.map((r) => [r.label, r.percent])).toEqual([
      ['Sales', 88],
      ['Design', 94],
      ['Engineering', 97]
    ]);
    expect(d.rows[0].tone).toBe('var(--color-cat-amber)');
    expect(d.rows[2].tone).toBe('var(--color-cat-blue)');
  });

  it('ranks people with late, absent or leave days, naming each count', () => {
    const rows = [
      row('b', 'Bob', ['absent', 'leave', 'leave']),
      row('a', 'Ann', ['late', 'late', 'present']),
      row('c', 'Cat', ['present', 'present'])
    ];
    const r = body(byId(teamAttendanceSummaryCards(summary(), { rows, error: false }), 'att-attention'), 'rank');
    expect(r.rows.map((x) => x.name)).toEqual(['Bob', 'Ann']);
    expect(r.rows[0].chips.map((c) => c.text)).toEqual(['1 absent', '2 leave']);
    expect(r.rows[1].chips.map((c) => c.text)).toEqual(['2 late']);
    expect(r.empty).toBe('No one needs attention');
  });

  it('marks the ranking card loading or failed', () => {
    expect(byId(teamAttendanceSummaryCards(summary(), { rows: null, error: false }), 'att-attention').state).toBe('loading');
    expect(byId(teamAttendanceSummaryCards(summary(), { rows: null, error: true }), 'att-attention').state).toBe('error');
  });

  it("lists who is on leave today with today's leave count", () => {
    const p = body(byId(teamAttendanceSummaryCards(summary(), ready), 'att-leave'), 'people');
    expect(p.count).toBe('3');
    expect(p.rows.map((x) => [x.name, x.chip])).toEqual([
      ['Priya N', 'Design'],
      ['Kavin R', 'On leave']
    ]);
  });
});
