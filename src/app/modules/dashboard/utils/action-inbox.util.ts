import { ActionItemLink, TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { wholeDaysSince } from './priority-actions.util';
import { isExceptionSource } from './exception-sources.util';

export { isExceptionSource };

export type InboxKind = 'approval' | 'exception' | 'overdue';
export type InboxFilter = 'all' | InboxKind;

export interface InboxItem {
  readonly key: string;
  readonly kind: InboxKind;
  readonly sourceKey: string;
  /** The request id the source's own API uses (task id for overdue work). */
  readonly entityId: string;
  /** Short type tag shown on the row, e.g. "Leave", "Objective", "Overdue". */
  readonly tag: string;
  readonly title: string;
  /** The requester (approvals), the employee (exceptions) or the assignees (overdue tasks). */
  readonly subject: string | null;
  /** Whose photo the row shows: the requester / employee, or an overdue task's first assignee. */
  readonly subjectEmployeeId: string | null;
  /** When the wait started (ms) - created (approvals, exceptions) or due (overdue tasks). Sort key. */
  readonly waitingSince: number;
  /** Days waiting (approvals, exceptions) or days late (overdue tasks). */
  readonly ageDays: number;
  /** "3h ago" / "6d ago" / "7d late". */
  readonly ageLabel: string;
  /** Exceptions only: Open / Escalated / Acknowledged. */
  readonly exceptionStatus: string | null;
  readonly link: ActionItemLink | null;
  readonly overdueTask: { projectId: string; objectiveId: string; taskId: string } | null;
}

export interface InboxCounts {
  /** Real pending totals from the backend, not just the rows loaded. */
  readonly all: number;
  readonly approval: number;
  readonly exception: number;
  readonly overdue: number;
}

const TAG: Record<string, string> = {
  'leave.approval': 'Leave',
  'attendance.correction': 'Attendance',
  'attendance.work_area': 'Work-area',
  'attendance.location': 'Location',
  'attendance.device_change': 'Device',
  'monitoring.exception': 'Alert',
  'calendar.meeting_exception': 'Meeting alert',
  'work.task_creation': 'Task creation',
  'work.task_edit': 'Task edit',
  'work.objective_change': 'Objective',
  'work.status_template_change': 'Status template',
  'work.overdue_task': 'Overdue'
};

function ageLabel(iso: string, now: Date): string {
  const hours = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return '<1h ago';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${wholeDaysSince(iso, now)}d ago`;
}

/**
 * Option B "one inbox": every pending approval, open exception and overdue task in one list,
 * strictly by how long each has been waiting (longest first), each row tagged with its type. The
 * caller's own overdue tasks are left out (they are on My Tasks). Pure: built from the two responses the dashboard already loads.
 */
export function buildActionInbox(
  actionItems: TeamActionItemsResponse | null,
  ledProgress: LedWorkProgressResponse | null,
  now: Date = new Date(),
  callerEmployeeId: string | null = null
): InboxItem[] {
  const items: InboxItem[] = [];

  for (const source of actionItems?.sources ?? []) {
    if (source.status !== 'ok') continue;
    const kind: InboxKind = isExceptionSource(source.sourceKey) ? 'exception' : 'approval';
    for (const item of source.topItems) {
      items.push({
        key: `${source.sourceKey}:${item.entityId}`,
        kind,
        sourceKey: source.sourceKey,
        entityId: item.entityId,
        tag: TAG[source.sourceKey] ?? source.sourceKey,
        title: item.title,
        subject: item.subjectName,
        subjectEmployeeId: item.subjectEmployeeId,
        waitingSince: new Date(item.createdAt).getTime(),
        ageDays: wholeDaysSince(item.createdAt, now),
        ageLabel: ageLabel(item.createdAt, now),
        exceptionStatus: item.exceptionStatus,
        link: item.link,
        overdueTask: null
      });
    }
  }

  for (const task of ledProgress?.overdueTasks ?? []) {
    if (callerEmployeeId && task.assignees.some((a) => a.employeeId === callerEmployeeId)) continue;
    items.push({
      key: `work.overdue_task:${task.taskId}`,
      kind: 'overdue',
      sourceKey: 'work.overdue_task',
      entityId: task.taskId,
      tag: TAG['work.overdue_task'],
      title: task.title,
      subject: task.assignees.map((a) => a.displayName).join(', ') || null,
      subjectEmployeeId: task.assignees[0]?.employeeId ?? null,
      waitingSince: now.getTime() - task.daysOverdue * 86_400_000,
      ageDays: task.daysOverdue,
      ageLabel: `${task.daysOverdue}d late`,
      exceptionStatus: null,
      link: null,
      overdueTask: { projectId: task.projectId, objectiveId: task.objectiveId, taskId: task.taskId }
    });
  }

  return items.sort((a, b) => a.waitingSince - b.waitingSince || a.key.localeCompare(b.key));
}

/** Chip counts from the backend's real totals, so they never shrink to the rows loaded. */
export function inboxCounts(
  actionItems: TeamActionItemsResponse | null,
  ledProgress: LedWorkProgressResponse | null,
  inbox: readonly InboxItem[]
): InboxCounts {
  const ok = (actionItems?.sources ?? []).filter((source) => source.status === 'ok');
  const approval = ok.filter((s) => !isExceptionSource(s.sourceKey)).reduce((sum, s) => sum + s.pendingCount, 0);
  const exception = ok.filter((s) => isExceptionSource(s.sourceKey)).reduce((sum, s) => sum + s.pendingCount, 0);
  // The backend total includes the caller's own overdue tasks; the inbox leaves those out, so count
  // the rows when every overdue task was returned, and the total otherwise.
  const overdueRows = inbox.filter((item) => item.kind === 'overdue').length;
  const allOverdueReturned = !ledProgress || ledProgress.overdueTasks.length >= ledProgress.overdueTotal;
  const overdue = allOverdueReturned ? overdueRows : Math.max(overdueRows, ledProgress!.overdueTotal);
  return { all: approval + exception + overdue, approval, exception, overdue };
}

export function filterInbox(items: readonly InboxItem[], filter: InboxFilter): InboxItem[] {
  return filter === 'all' ? [...items] : items.filter((item) => item.kind === filter);
}

const AGE_CLASS = {
  late: 'text-[var(--color-danger)] font-semibold',
  soon: 'text-[var(--color-warning)] font-semibold',
  fresh: 'text-[var(--color-text-muted)]'
} as const;

/** 5d+ (and any overdue task) red, 3d+ amber. Full class strings for Tailwind JIT. */
export function inboxAgeClass(item: InboxItem): string {
  if (item.kind === 'overdue' || item.exceptionStatus === 'Escalated' || item.ageDays >= 5) return AGE_CLASS.late;
  if (item.ageDays >= 3) return AGE_CLASS.soon;
  return AGE_CLASS.fresh;
}

/** The small icon on the avatar's corner that says what kind of request the row is. */
export type InboxBadge = 'leave' | 'attendance' | 'location' | 'device' | 'alert' | 'task' | 'objective' | 'overdue';

const BADGE: Record<string, InboxBadge | undefined> = {
  'leave.approval': 'leave',
  'attendance.correction': 'attendance',
  'attendance.work_area': 'location',
  'attendance.location': 'location',
  'attendance.device_change': 'device',
  'monitoring.exception': 'alert',
  'calendar.meeting_exception': 'alert',
  'work.task_creation': 'task',
  'work.task_edit': 'task',
  'work.objective_change': 'objective',
  'work.status_template_change': 'task',
  'work.overdue_task': 'overdue'
};

export function inboxBadge(item: InboxItem): InboxBadge {
  return BADGE[item.sourceKey] ?? (item.kind === 'exception' ? 'alert' : 'task');
}
