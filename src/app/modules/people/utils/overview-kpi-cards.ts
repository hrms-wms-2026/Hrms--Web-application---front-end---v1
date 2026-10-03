import {
  EmployeeAttendanceOverviewResponse,
  EmployeeSignal,
  EmployeeWorkOverviewResponse
} from '../models/employee-overview.model';

export type KpiTone = 'critical' | 'warning' | 'info' | 'baseline';

export interface KpiCard {
  readonly key: string;
  readonly tone: KpiTone;
  readonly label: string;
  readonly value: number;
  readonly denominator: number | null;
  readonly suffix: string;
  readonly detail: string;
  readonly polarity: 'higher-better' | 'lower-better';
}

/** Short card titles; API labels are sentences intended for Needs Attention rows. */
const SIGNAL_TITLES: Record<string, string> = {
  absent_days: 'Absent days',
  missing_clock_outs: 'Missing clock-outs',
  over_break: 'Over-break',
  late_clock_ins: 'Late arrivals',
  early_clock_outs: 'Early clock-outs',
  short_hours_days: 'Short-hours days',
  location_violations: 'Location alerts',
  overdue_tasks: 'Overdue tasks',
  pending_approvals: 'Pending approvals',
  off_schedule_work: 'Off-schedule work',
  idle_activity_alerts: 'Idle alerts',
  monitoring_exceptions: 'Monitoring exceptions'
};

const BASELINE_READERS: Record<
  string,
  (attendance: EmployeeAttendanceOverviewResponse | null, work: EmployeeWorkOverviewResponse | null) => number | null
> = {
  days_attended: (attendance) => attendance?.present ?? null,
  tasks_completed: (_attendance, work) => work?.completed ?? null,
  on_time_delivery: (_attendance, work) => (work ? work.onTimeRatePercent ?? 0 : null),
  leave_days: (attendance) => attendance?.leaveDays ?? null
};

export function kpiValue(
  key: string,
  signals: readonly EmployeeSignal[] | null,
  attendance: EmployeeAttendanceOverviewResponse | null,
  work: EmployeeWorkOverviewResponse | null
): number | null {
  const baseline = BASELINE_READERS[key];
  if (baseline) return baseline(attendance, work);
  if (!signals) return null;
  return signals.find((signal) => signal.key === key)?.value ?? 0;
}

export function buildKpiCards(
  signals: readonly EmployeeSignal[],
  attendance: EmployeeAttendanceOverviewResponse | null,
  work: EmployeeWorkOverviewResponse | null
): readonly KpiCard[] {
  const fromSignal = (signal: EmployeeSignal): KpiCard => ({
    key: signal.key,
    tone: signal.severity,
    label: SIGNAL_TITLES[signal.key] ?? signal.label,
    value: signal.value,
    denominator: signal.unit === 'minutes' ? null : signal.denominator,
    suffix: signal.unit === 'minutes' ? 'min' : signal.unit === 'percent' ? '%' : '',
    detail: signal.detail,
    polarity: 'lower-better'
  });

  const baselines: KpiCard[] = [
    {
      key: 'days_attended',
      tone: 'baseline',
      label: 'Days attended',
      value: attendance?.present ?? 0,
      denominator: attendance?.workingDays ?? 0,
      suffix: '',
      detail:
        attendance && attendance.workingDays > 0
          ? `${Math.round((attendance.present / attendance.workingDays) * 100)}% of working days`
          : 'No working days yet',
      polarity: 'higher-better'
    },
    {
      key: 'tasks_completed',
      tone: 'baseline',
      label: 'Tasks completed',
      value: work?.completed ?? 0,
      denominator: work?.assigned ?? 0,
      suffix: '',
      detail: `${work?.completionRatePercent ?? 0}% completion rate`,
      polarity: 'higher-better'
    },
    {
      key: 'on_time_delivery',
      tone: 'baseline',
      label: 'On-time delivery',
      value: work?.onTimeRatePercent ?? 0,
      denominator: null,
      suffix: '%',
      detail: 'Completed by due date',
      polarity: 'higher-better'
    },
    {
      key: 'leave_days',
      tone: 'baseline',
      label: 'Leave days',
      value: attendance?.leaveDays ?? 0,
      denominator: null,
      suffix: '',
      detail: 'Approved time off this month',
      polarity: 'lower-better'
    }
  ];

  return [...signals.slice(0, 4).map(fromSignal), ...baselines].slice(0, 4);
}
