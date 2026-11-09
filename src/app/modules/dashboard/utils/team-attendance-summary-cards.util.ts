import { SummaryCardModel, SummaryChip, SummaryRankRow } from '../models/summary-card.model';
import { TeamAttendanceEmployeeRow, TeamAttendanceSummaryResponse } from '../models/team-attendance.model';
import { summaryDelta } from './summary-card-format.util';
import { departmentsWorstFirst } from './team-attendance-format.util';

/** The most rows a card lists (the popup has the rest). */
export const SUMMARY_CARD_ROWS = 3;

const TONE = { rate: 'var(--color-cat-green)', departments: 'var(--color-cat-blue)', attention: 'var(--color-cat-amber)', leave: 'var(--color-cat-violet)' } as const;
const CHIP = { late: 'var(--color-cat-amber)', absent: 'var(--color-cat-red)', leave: 'var(--color-cat-blue)' } as const;
/** A department under this rate is drawn amber. */
const DEPARTMENT_WARN_RATE = 90;

const pct = (rate: number | null): string => (rate === null ? '—' : `${rate}%`);

/** The attention ranking as fetched with sort 'attention' (null while loading). */
export interface AttentionRows {
  readonly rows: readonly TeamAttendanceEmployeeRow[] | null;
  readonly error: boolean;
}

function attentionRow(row: TeamAttendanceEmployeeRow): SummaryRankRow | null {
  const n = { late: 0, absent: 0, leave: 0 };
  for (const day of row.days) {
    if (day.bucket === 'late' || day.bucket === 'absent' || day.bucket === 'leave') n[day.bucket] += 1;
  }
  const chips: SummaryChip[] = (['late', 'absent', 'leave'] as const)
    .filter((k) => n[k] > 0)
    .map((k) => ({ text: `${n[k]} ${k}`, tone: CHIP[k] }));
  return chips.length ? { id: row.employeeId, name: row.name, avatarFileId: row.avatarFileId, chips } : null;
}

/**
 * Team attendance's summary cards (design 2026-11-07), each from the popup section it summarises: the period
 * rate (Daily attendance), departments (By department), who needs attention (Employee ranking, fetched with
 * sort 'attention') and who is on leave today (the KPI row).
 */
export function teamAttendanceSummaryCards(data: TeamAttendanceSummaryResponse, attention: AttentionRows): SummaryCardModel[] {
  const ranked = (attention.rows ?? []).map(attentionRow).filter((r): r is SummaryRankRow => r !== null);
  const leave = data.todayPreview.filter((p) => p.bucket === 'leave').slice(0, SUMMARY_CARD_ROWS);
  return [
    {
      id: 'att-rate',
      title: 'Attendance rate',
      icon: 'calendar-check',
      tone: TONE.rate,
      section: 'trend',
      state: 'ready',
      body: {
        kind: 'spark',
        figure: pct(data.periodRate),
        delta: summaryDelta(data.deltaPp, 'pp', true, data.mode === 'week' ? 'vs last week' : 'vs last month'),
        points: data.trend.map((p) => p.rate)
      }
    },
    {
      id: 'att-departments',
      title: 'By department',
      icon: 'building',
      tone: TONE.departments,
      section: 'departments',
      state: 'ready',
      body: {
        kind: 'hbars',
        headline: `Overall ${pct(data.periodRate)}`,
        rows: departmentsWorstFirst(data.departmentRates).slice(0, SUMMARY_CARD_ROWS).map((d) => ({
          label: d.name,
          percent: d.rate,
          tone: d.rate !== null && d.rate < DEPARTMENT_WARN_RATE ? CHIP.late : TONE.departments
        }))
      }
    },
    {
      id: 'att-attention',
      title: 'Needs attention',
      icon: 'alert-circle',
      tone: TONE.attention,
      section: 'ranking',
      state: attention.rows !== null ? 'ready' : attention.error ? 'error' : 'loading',
      body:
        attention.rows !== null
          ? { kind: 'rank', count: null, countLabel: '', rows: ranked.slice(0, SUMMARY_CARD_ROWS), empty: 'No one needs attention' }
          : null
    },
    {
      id: 'att-leave',
      title: 'On leave today',
      icon: 'plane',
      tone: TONE.leave,
      section: 'summary',
      state: 'ready',
      body: {
        kind: 'people',
        count: String(data.todayCounts.onLeave),
        countLabel: data.todayCounts.onLeave === 1 ? 'person' : 'people',
        rows: leave.map((p) => ({ id: p.employeeId, name: p.name, avatarFileId: p.avatarFileId, chip: p.department ?? 'On leave' })),
        empty: 'No one on leave'
      }
    }
  ];
}
