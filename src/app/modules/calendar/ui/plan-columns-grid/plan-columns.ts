import { PlannerPersonDay, TeamPlannerMember } from '../../../work/planner/models/team-planner.models';
import { LoadBand, dayLoad, formatHours, loadBand } from '../../utils/team-load';

/** One thing on a column (team planner, 2026-11-03). Times are instants; the grid places them in the viewer's zone. */
export interface PlanItem {
  key: string;
  kind: 'block' | 'meeting' | 'busy' | 'leave' | 'leavePending';
  label: string;
  startIso: string;
  endIso: string;
}

/** A person on the team day, or one day of a person's week. */
export interface PlanColumn {
  key: string;
  /** The column's date in the viewer's zone ('YYYY-MM-DD'). */
  date: string;
  title: string;
  subtitle: string | null;
  loadLabel: string;
  band: LoadBand;
  loadPct: number;
  items: readonly PlanItem[];
  /** The work window as instants; null when the day has none (the whole column is off-hours). */
  workStartIso: string | null;
  workEndIso: string | null;
}

/** What someone else sees of a private meeting (the API's masked title). */
const PRIVATE_TITLE = 'Private meeting';

/** Blocks, meetings that still happen, and leave, in that order. */
export function planItemsOf(day: PlannerPersonDay): PlanItem[] {
  const blocks: PlanItem[] = day.blocks.map((b) => ({ key: `b:${b.id}`, kind: 'block', label: b.taskTitle, startIso: b.startAt, endIso: b.endAt }));
  const meetings: PlanItem[] = day.meetings.filter((m) => !m.cancelled).map((m) => {
    const busy = m.isPrivate && m.title === PRIVATE_TITLE;
    return { key: `m:${m.taskId}`, kind: busy ? 'busy' : 'meeting', label: busy ? 'Busy' : m.title, startIso: m.startAt, endIso: m.endAt };
  });
  const leaves: PlanItem[] = day.leaves.map((l, i) => ({
    key: `l:${i}:${l.startAt}`,
    kind: l.status === 'approved' ? 'leave' : l.status === 'pending' ? 'leavePending' : 'busy',
    label: l.status === 'approved' ? 'Leave' : l.status === 'pending' ? 'Leave (pending)' : 'Busy',
    startIso: l.startAt, endIso: l.endAt,
  }));
  return [...blocks, ...meetings, ...leaves];
}

function loadOf(day: PlannerPersonDay | undefined): Pick<PlanColumn, 'loadLabel' | 'band' | 'loadPct'> {
  const load = day ? dayLoad(day) : 0;
  const capacity = day?.capacityMinutes ?? 0;
  const hours = (m: number) => (m > 0 ? formatHours(m) : '0h');
  return {
    loadLabel: day?.onLeave ? 'On leave' : `${hours(load)} / ${hours(capacity)}`,
    band: loadBand(load, capacity, day?.onLeave ?? false),
    loadPct: capacity > 0 ? Math.min(100, (load / capacity) * 100) : load > 0 ? 100 : 0,
  };
}

function zoneLabel(timezone: string): string {
  return `${(timezone.split('/').pop() ?? timezone).replace(/_/g, ' ')} time`;
}

/** A member's column for <date> on the team day. */
export function memberColumn(member: TeamPlannerMember, date: string, viewerZone: string): PlanColumn {
  const day = member.days.find((d) => d.date === date) ?? member.days[0];
  const subtitle = [
    member.directReportCount > 0 ? `Lead · ${member.directReportCount} report${member.directReportCount === 1 ? '' : 's'}` : null,
    member.timezone !== viewerZone ? zoneLabel(member.timezone) : null,
  ].filter((s): s is string => !!s).join(' · ') || null;
  return {
    key: member.employeeId, date, title: member.name, subtitle, ...loadOf(day),
    items: day ? planItemsOf(day) : [], workStartIso: day?.workStartAt ?? null, workEndIso: day?.workEndAt ?? null,
  };
}

/** One day of a person's week ("Mon 2"). */
export function personDayColumn(day: PlannerPersonDay): PlanColumn {
  const label = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });
  return {
    key: day.date, date: day.date, title: label, subtitle: null, ...loadOf(day),
    items: planItemsOf(day), workStartIso: day.workStartAt, workEndIso: day.workEndAt,
  };
}
