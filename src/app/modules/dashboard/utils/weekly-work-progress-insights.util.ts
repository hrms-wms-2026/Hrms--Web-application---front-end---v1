import { formatMinutes } from '../util/timeline-segments.util';
import { WeekDayProgress, WeeklyWorkProgressResponse } from '../models/weekly-work-progress.model';

export interface WeeklyInsight {
  tone: 'positive' | 'warning' | 'info';
  text: string;
}

const MAX_INSIGHTS = 4;
/** Clocked-in time above worked time that is worth pointing out. */
const UNTRACKED_THRESHOLD_MINUTES = 60;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** This week's progress minus last week's, in percentage points (one decimal); null when last week had no target. */
export function progressDeltaPoints(res: WeeklyWorkProgressResponse): number | null {
  if (res.lastWeek.expectedMinutes === 0) return null;
  return Math.round((res.thisWeek.progressPercent - res.lastWeek.progressPercent) * 10) / 10;
}

/** The popup's Key Insights, in a fixed order, at most four. Built only from the payload. */
export function buildWeeklyInsights(res: WeeklyWorkProgressResponse): WeeklyInsight[] {
  const week = res.thisWeek;
  const insights: WeeklyInsight[] = [];

  const lastWorked = res.lastWeek.workedMinutes;
  if (lastWorked > 0 && week.workedMinutes !== lastWorked) {
    const change = Math.round((Math.abs(week.workedMinutes - lastWorked) / lastWorked) * 100);
    const more = week.workedMinutes > lastWorked;
    insights.push({
      tone: more ? 'positive' : 'warning',
      text: `Worked ${change}% ${more ? 'more' : 'fewer'} hours than last week.`
    });
  }

  if (res.plannerEnabled && week.expectedMinutes > 0) {
    insights.push({ tone: 'info', text: `Schedule coverage is ${Math.round(week.planningCoveragePercent)}%.` });
  }

  const below = week.days.filter((d) => d.date < res.today && isBelow(d, res.plannerEnabled));
  if (below.length > 0) {
    insights.push({
      tone: 'warning',
      text: `${joinNames(below.map((d) => dayName(d.date)))} ${below.length === 1 ? 'is' : 'are'} below ${res.plannerEnabled ? 'schedule' : 'expected'}.`
    });
  }

  if (week.status === 'on_track') insights.push({ tone: 'positive', text: 'On track to meet weekly target.' });
  else if (week.status === 'ahead') insights.push({ tone: 'positive', text: 'Ahead of weekly target.' });
  else if (week.status === 'behind') insights.push({ tone: 'warning', text: 'Behind weekly target.' });

  const untracked = week.attendanceMinutes - week.workedMinutes;
  if (untracked > UNTRACKED_THRESHOLD_MINUTES) {
    insights.push({ tone: 'info', text: `Clocked in ${formatMinutes(untracked)} without task time.` });
  }

  return insights.slice(0, MAX_INSIGHTS);
}

/** With the planner on, a day is judged against what was scheduled for it; otherwise against what was expected. */
function isBelow(day: WeekDayProgress, plannerEnabled: boolean): boolean {
  const target = plannerEnabled ? day.scheduledMinutes : day.expectedMinutes;
  return target > 0 && day.workedMinutes < target;
}

/** "Mon" from a yyyy-MM-dd date, without going through UTC (no time-zone shift). */
function dayName(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return DAY_NAMES[new Date(y, m - 1, d).getDay()];
}

function joinNames(names: string[]): string {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
