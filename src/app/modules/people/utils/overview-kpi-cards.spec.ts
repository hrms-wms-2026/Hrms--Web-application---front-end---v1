import {
  EmployeeAttendanceOverviewResponse,
  EmployeeSignal,
  EmployeeWorkOverviewResponse
} from '../models/employee-overview.model';
import { buildKpiCards } from './overview-kpi-cards';

describe('buildKpiCards', () => {
  const sig = (
    key: string,
    rank: number,
    severity: EmployeeSignal['severity'] = 'warning'
  ): EmployeeSignal => ({
    key,
    rank,
    severity,
    category: 'attendance',
    value: 2,
    unit: 'count',
    denominator: 10,
    label: `2 ${key}`,
    detail: 'd'
  });

  const attendance: EmployeeAttendanceOverviewResponse = {
    from: '',
    to: '',
    workingDays: 22,
    present: 18,
    late: 0,
    missingClockOuts: 0,
    leaveDays: 1,
    days: []
  };

  const work: EmployeeWorkOverviewResponse = {
    from: '',
    to: '',
    assigned: 6,
    completed: 1,
    inProgress: 2,
    overdue: 1,
    notStarted: 2,
    completionRatePercent: 17,
    onTimeRatePercent: 50
  };

  it('no signals -> four baselines in fixed order', () => {
    expect(buildKpiCards([], attendance, work).map((card) => card.key)).toEqual([
      'days_attended',
      'tasks_completed',
      'on_time_delivery',
      'leave_days'
    ]);
  });

  it('two signals -> signals first, then first two baselines', () => {
    const cards = buildKpiCards([sig('over_break', 3), sig('late_clock_ins', 4)], attendance, work);

    expect(cards.map((card) => card.key)).toEqual([
      'over_break',
      'late_clock_ins',
      'days_attended',
      'tasks_completed'
    ]);
    expect(cards[0].tone).toBe('warning');
  });

  it('five signals -> first four only, API order kept', () => {
    const keys = ['absent_days', 'missing_clock_outs', 'over_break', 'late_clock_ins', 'early_clock_outs'];

    expect(buildKpiCards(keys.map((key, index) => sig(key, index + 1)), attendance, work).map((card) => card.key))
      .toEqual(keys.slice(0, 4));
  });

  it('days attended baseline uses present / workingDays', () => {
    const card = buildKpiCards([], attendance, work)[0];

    expect([card.value, card.denominator]).toEqual([18, 22]);
  });

  it('missing sources still yield four cards with zeros', () => {
    expect(buildKpiCards([], null, null)).toHaveLength(4);
  });

  it('over_break card shows minutes under a short title', () => {
    const signal = { ...sig('over_break', 3), unit: 'minutes' as const, value: 40, denominator: 2 };

    expect(buildKpiCards([signal], attendance, work)[0]).toMatchObject({
      label: 'Over-break',
      value: 40,
      suffix: 'min',
      denominator: null
    });
  });
});
