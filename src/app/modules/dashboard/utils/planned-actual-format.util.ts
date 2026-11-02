import { KpiTile } from '../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { minutesText } from './team-presence-format.util';

/**
 * Planned vs actual (2026-11-02 design match, sections 7.3 and 7.4): Planner minutes only. Planned = task + meeting
 * minutes; actual = clocked task time, split into in plan (inside a matching block), outside slot and no plan. Never
 * estimate hours or attendance minutes.
 */

/** The in plan / outside slot / no plan colours of Team Progress's planned-vs-worked band (team-progress-time CSS). */
export const PLANNED_ACTUAL_COLORS = {
  planned: '#cbd5e1',
  scheduled: '#3b82f6',
  outside: '#f59e0b',
  noPlan: 'repeating-linear-gradient(135deg, #f59e0b 0 4px, #fde68a 4px 8px)',
} as const;

export interface PlannedActualRow {
  id: string;
  label: string;
  avatarFileId?: string | null;
  planned: number;
  scheduled: number;
  outside: number;
  noPlan: number;
  /** Item completion % (the schedule's own figure); null or absent = "—". */
  completion?: number | null;
}

export interface PlannedActualSummary {
  planned: number;
  actual: number;
  /** scheduled ÷ actual; null without actual time. */
  inPlanPercent: number | null;
  unscheduled: number;
}

/** One column of the week chart. Future days carry planned only. */
export interface PlannedActualDay {
  date: string;
  planned: number;
  scheduled: number;
  outside: number;
  noPlan: number;
  coveragePercent: number | null;
}

export function actualOf(row: Pick<PlannedActualRow, 'scheduled' | 'outside' | 'noPlan'>): number {
  return row.scheduled + row.outside + row.noPlan;
}

/** One decimal, half away from zero. */
function round1(value: number): number {
  return Math.sign(value) * (Math.round(Math.abs(value) * 10) / 10);
}

export function summarizePlannedActual(rows: readonly PlannedActualRow[]): PlannedActualSummary {
  const sum = (pick: (r: PlannedActualRow) => number) =>
    rows.reduce((total, r) => total + pick(r), 0);
  const actual = sum(actualOf);
  return {
    planned: sum((r) => r.planned),
    actual,
    inPlanPercent: actual > 0 ? round1((sum((r) => r.scheduled) * 100) / actual) : null,
    unscheduled: sum((r) => r.outside + r.noPlan),
  };
}

/** The chart's 100%: the larger of planned and actual over every row, so nothing draws past its track; at least 1. */
export function plannedActualScale(rows: readonly PlannedActualRow[]): number {
  return Math.max(1, ...rows.map((r) => Math.max(r.planned, actualOf(r))));
}

/** A share of the scale for a bar width or height, one decimal. */
export function plannedActualShare(minutes: number, scale: number): number {
  return scale > 0 ? Math.round((minutes * 1000) / scale) / 10 : 0;
}

function arrow(change: number): string {
  return change > 0 ? '↑' : '↓';
}

function minutesHint(now: number, before: number): string {
  if (now === before) return '→ same as last week';
  return `${arrow(now - before)} ${minutesText(Math.abs(now - before))} vs last week`;
}

/** Planned · Actual · In plan % · Unscheduled, with "vs last week" hints when a previous summary is given. */
export function plannedActualTiles(
  s: PlannedActualSummary,
  previous?: PlannedActualSummary | null,
): KpiTile[] {
  let inPlanHint: string | undefined;
  if (previous && s.inPlanPercent !== null && previous.inPlanPercent !== null) {
    const change = round1(s.inPlanPercent - previous.inPlanPercent);
    inPlanHint =
      change === 0
        ? '→ same as last week'
        : `${arrow(change)} ${Math.abs(change)} pts vs last week`;
  }
  return [
    {
      label: 'Planned',
      value: minutesText(s.planned),
      hint: previous ? minutesHint(s.planned, previous.planned) : undefined,
      icon: 'clipboard-list',
      tone: 'neutral',
      testId: 'pa-tile-planned',
    },
    {
      label: 'Actual',
      value: minutesText(s.actual),
      hint: previous ? minutesHint(s.actual, previous.actual) : undefined,
      icon: 'clock',
      tone: 'accent',
      testId: 'pa-tile-actual',
    },
    {
      label: 'In plan',
      value: s.inPlanPercent === null ? '—' : `${s.inPlanPercent}%`,
      hint: inPlanHint,
      icon: 'check-circle',
      tone: 'success',
      testId: 'pa-tile-in-plan',
    },
    {
      label: 'Unscheduled',
      value: minutesText(s.unscheduled),
      hint: previous ? minutesHint(s.unscheduled, previous.unscheduled) : undefined,
      icon: 'alert-triangle',
      tone: s.unscheduled > 0 ? 'warning' : 'neutral',
      testId: 'pa-tile-unscheduled',
    },
  ];
}
