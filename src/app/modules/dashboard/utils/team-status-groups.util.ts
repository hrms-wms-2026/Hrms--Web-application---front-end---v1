import { TeamTodayMember } from '../models/my-team-today.model';

/** 'late' is the isLate overlay; every other key is a TeamTodayMember.status value. */
export type TeamStatusFilter = 'working' | 'on_break' | 'late' | 'absent' | 'on_leave' | 'not_started';

export interface TeamStatusGroup {
  key: string;
  label: string;
  members: TeamTodayMember[];
}

export interface TeamStatusPartition {
  /** People the manager may need to follow up on, grouped by why. */
  exceptionGroups: TeamStatusGroup[];
  /** Everyone else (working normally, on break, clocked out, on leave, not scheduled). */
  others: TeamTodayMember[];
}

const EXCEPTION_ORDER = ['late', 'absent', 'not_started', 'attention'];

const EXCEPTION_LABEL: Record<string, string> = {
  late: 'Late',
  absent: 'Absent',
  not_started: 'Not started',
  attention: 'Needs attention'
};

function exceptionKey(member: TeamTodayMember): string | null {
  if (member.isLate) return 'late';
  if (member.status === 'absent' || member.status === 'not_started') return member.status;
  if (member.attentionSeverity) return 'attention';
  return null;
}

export function matchesTeamStatusFilter(member: TeamTodayMember, filter: TeamStatusFilter): boolean {
  return filter === 'late' ? member.isLate : member.status === filter;
}

/** Exceptions-first view of Team Status: a manager only needs to scan the people who are late,
 * absent or not started; the rest fold into one "others" line. With a filter, it returns just the
 * matching members as one group. Member order within a group is the backend's (attention first). */
export function partitionTeamMembers(
  members: readonly TeamTodayMember[],
  filter: TeamStatusFilter | null,
  filterLabel = ''
): TeamStatusPartition {
  if (filter) {
    return {
      exceptionGroups: [{ key: filter, label: filterLabel, members: members.filter((m) => matchesTeamStatusFilter(m, filter)) }],
      others: []
    };
  }

  const buckets = new Map<string, TeamTodayMember[]>();
  const others: TeamTodayMember[] = [];
  for (const member of members) {
    const key = exceptionKey(member);
    if (!key) {
      others.push(member);
      continue;
    }
    const bucket = buckets.get(key) ?? [];
    bucket.push(member);
    buckets.set(key, bucket);
  }

  const exceptionGroups = EXCEPTION_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    label: EXCEPTION_LABEL[key],
    members: buckets.get(key)!
  }));
  return { exceptionGroups, others };
}
