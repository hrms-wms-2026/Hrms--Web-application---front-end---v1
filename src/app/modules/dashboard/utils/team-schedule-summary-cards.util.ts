import { SummaryCardModel, SummaryRankRow } from '../models/summary-card.model';
import { TeamScheduleMember, TeamScheduleResponse, TeamScheduleWeekResponse } from '../models/team-schedule.model';
import { summaryDelta } from './summary-card-format.util';
import { SUMMARY_CARD_ROWS } from './team-attendance-summary-cards.util';
import { inMeetingNow, isNotPlanned, isOnLeave, isOverCapacity, loadMinutes } from './team-schedule-format.util';
import { WIDGET } from './widget-palette';

const TONE = { coverage: WIDGET.shade2, planActual: WIDGET.shade2b, needsPlan: WIDGET.shade3, now: WIDGET.shade1 } as const;
/** "Right now" segments, darkest to lightest by importance; the key names them. */
const NOW_TONE = {
  working: WIDGET.shade1,
  meeting: WIDGET.shade3,
  break: WIDGET.shade3b,
  leave: WIDGET.shade2,
  notPlanned: WIDGET.shade4
} as const;
/** Chip tones: over capacity is maroon, a milder warning the mild chip. */
const RED = WIDGET.maroon;
const AMBER = WIDGET.shade3;
/** Every colour these cards use, for the colour guard spec. */
export const TEAM_SCHEDULE_CARD_COLORS = { ...TONE, ...NOW_TONE, red: RED, amber: AMBER } as const;
/** From this load an over-capacity chip is red. */
const LOAD_RED_PERCENT = 120;

const hours = (minutes: number): number => Math.round(minutes / 60);

function needsPlanRows(members: readonly TeamScheduleMember[]): SummaryRankRow[] {
  const notPlanned = members
    .filter(isNotPlanned)
    .map((m) => ({ id: m.employeeId, name: m.displayName, avatarFileId: m.avatarFileId, chips: [{ text: 'not planned', tone: NOW_TONE.notPlanned }] }));
  const over = members
    .filter(isOverCapacity)
    .map((m) => ({ m, load: Math.round((loadMinutes(m) * 100) / (m.expectedMinutes ?? 1)) }))
    .sort((a, b) => b.load - a.load)
    .map(({ m, load }) => ({
      id: m.employeeId,
      name: m.displayName,
      avatarFileId: m.avatarFileId,
      chips: [{ text: `${load}% load`, tone: load >= LOAD_RED_PERCENT ? RED : AMBER }]
    }));
  return [...notPlanned, ...over].slice(0, SUMMARY_CARD_ROWS);
}

/**
 * Today's team schedule's summary cards (design 2026-11-07), each from the popup section it summarises: this week's
 * coverage and planned vs actual (the popup's week view), who needs a plan (the ranking) and where everyone is right
 * now (the day's status). Not planned, over capacity and on leave use the card's own rules, so the counts match.
 */
export function teamScheduleSummaryCards(dayData: TeamScheduleResponse, week: TeamScheduleWeekResponse | null, weekFailed = false): SummaryCardModel[] {
  const weekState = week ? 'ready' : weekFailed ? 'error' : 'loading';
  const members = dayData.members;
  const plannerOn = week?.plannerEnabled ?? dayData.plannerEnabled;
  const planned = (week?.days ?? []).map((d) => d.plannedTaskMinutes + d.plannedMeetingMinutes);
  const clocked = (week?.days ?? []).map((d) => d.clockedMinutes);
  const plannedSum = planned.reduce((a, b) => a + b, 0);
  const clockedSum = clocked.reduce((a, b) => a + b, 0);
  const coverage = plannerOn ? (week?.totals.coveragePercent ?? null) : null;
  const previousCoverage = week?.previous.coveragePercent ?? null;

  const meeting = members.filter(inMeetingNow).length;
  const onLeave = members.filter(isOnLeave).length;
  const working = members.filter((m) => m.presenceStatus === 'working' && !inMeetingNow(m)).length;
  const onBreak = members.filter((m) => m.presenceStatus === 'on_break').length;

  return [
    {
      id: 'ts-coverage',
      title: 'Coverage',
      icon: 'calendar-clock',
      tone: TONE.coverage,
      section: 'coverage',
      state: weekState,
      body: week
        ? {
            kind: 'meter',
            figure: coverage === null ? '—' : `${Math.round(coverage)}%`,
            delta: coverage === null || previousCoverage === null ? null : summaryDelta(coverage - previousCoverage, 'pp', true, 'vs last week'),
            percent: coverage,
            caption: plannerOn ? `${hours(week.totals.scheduledMinutes)} / ${hours(week.totals.plannedMinutes)} h planned` : 'Planner is off'
          }
        : null
    },
    {
      id: 'ts-plan-actual',
      title: 'Planned vs actual',
      icon: 'bar-chart',
      tone: TONE.planActual,
      section: 'planned-actual',
      state: weekState,
      body: week
        ? {
            kind: 'pair',
            figure: plannedSum > 0 ? `${Math.round((clockedSum * 100) / plannedSum)}%` : '—',
            delta: null,
            pairs: planned.map((p, i) => [hours(p), hours(clocked[i])] as const),
            legend: ['Planned', 'Actual']
          }
        : null
    },
    {
      id: 'ts-needs-plan',
      title: 'Needs a plan',
      icon: 'user-x',
      tone: TONE.needsPlan,
      section: 'ranking',
      state: 'ready',
      body: { kind: 'rank', count: null, countLabel: '', rows: needsPlanRows(members), empty: 'Everyone has a plan' }
    },
    {
      id: 'ts-now',
      title: 'Right now',
      icon: 'activity',
      tone: TONE.now,
      section: 'status',
      state: 'ready',
      body: {
        kind: 'chips',
        count: String(dayData.summary.people),
        countLabel: dayData.summary.people === 1 ? 'person' : 'people',
        items: [
          { label: 'Working', value: working, tone: NOW_TONE.working },
          { label: 'In meeting', value: meeting, tone: NOW_TONE.meeting },
          { label: 'On break', value: onBreak, tone: NOW_TONE.break },
          { label: 'On leave', value: onLeave, tone: NOW_TONE.leave },
          // Presence only, so the chips add up to the head count; Not planned has its own card.
          { label: 'Not in', value: Math.max(0, members.length - working - meeting - onBreak - onLeave), tone: NOW_TONE.notPlanned }
        ]
      }
    }
  ];
}
