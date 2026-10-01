import { ActionItem, TeamActionItemsResponse } from '../models/my-team-action-items.model';
import { LedOverdueTask, LedWorkProgressResponse } from '../models/my-team-led-progress.model';
import { PriorityActionItem } from '../models/priority-action-item.model';

const GROUP_LIMIT = 5;

function formatAge(iso: string, now: Date): string {
  const diffMinutes = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 60_000);
  const diffHours = diffMinutes / 60;
  if (diffHours < 1) return '<1h ago';
  if (diffHours < 24) return `${Math.round(diffHours)}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}

function toPriorityItem(item: ActionItem, group: PriorityActionItem['group'], domain: 'people' | 'work', now: Date): PriorityActionItem {
  return {
    group,
    sourceKey: item.sourceKey,
    domain,
    entityId: item.entityId,
    title: item.title,
    subjectName: item.subjectName,
    captionLabel: formatAge(item.createdAt, now),
    link: item.link,
    overdueTask: null
  };
}

function toOverdueItem(task: LedOverdueTask): PriorityActionItem {
  return {
    group: 'overdue_work',
    sourceKey: 'work.overdue_task',
    domain: 'work',
    entityId: task.taskId,
    title: task.title,
    subjectName: task.assignees.map((a) => a.displayName).join(', ') || null,
    captionLabel: `${task.daysOverdue}d overdue`,
    link: null,
    overdueTask: { projectId: task.projectId, objectiveId: task.objectiveId, taskId: task.taskId }
  };
}

/** Deterministic V1 grouping (My Team spec §8.4): no scoring, each group capped at 5, already-
 * oldest-first inputs so a group's merged top 5 is exact with no extra sort needed beyond what's
 * below. Pure and side-effect-free - no extra fetch, no state of its own. */
export function buildPriorityActions(
  actionItems: TeamActionItemsResponse | null,
  ledProgress: LedWorkProgressResponse | null,
  now: Date = new Date(),
  callerEmployeeId: string | null = null
): PriorityActionItem[] {
  const sources = actionItems?.sources ?? [];
  const exceptionSource = sources.find((s) => s.sourceKey === 'monitoring.exception' && s.status === 'ok');

  const escalated = (exceptionSource?.topItems ?? [])
    .filter((item) => item.exceptionStatus === 'Escalated')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, GROUP_LIMIT)
    .map((item) => toPriorityItem(item, 'escalated_exception', 'people', now));

  const open = (exceptionSource?.topItems ?? [])
    .filter((item) => item.exceptionStatus === 'Open')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, GROUP_LIMIT)
    .map((item) => toPriorityItem(item, 'open_exception', 'people', now));

  const approvals = sources
    .filter((s) => s.sourceKey !== 'monitoring.exception' && s.status === 'ok')
    .flatMap((s) => s.topItems.map((item) => ({ item, domain: s.domain })))
    .sort((a, b) => {
      const byDate = a.item.createdAt.localeCompare(b.item.createdAt);
      if (byDate !== 0) return byDate;
      const bySource = a.item.sourceKey.localeCompare(b.item.sourceKey);
      if (bySource !== 0) return bySource;
      return a.item.entityId.localeCompare(b.item.entityId);
    })
    .slice(0, GROUP_LIMIT)
    .map(({ item, domain }) => toPriorityItem(item, 'pending_approval', domain, now));

  // D7: the caller's own personal overdue tasks are excluded here - they already surface on
  // My Day's own task-progress card, so re-showing them under "what should I act on as a leader"
  // would be a duplicate, not a genuinely new attention item.
  const overdueWork = (ledProgress?.overdueTasks ?? [])
    .filter((task) => !callerEmployeeId || !task.assignees.some((a) => a.employeeId === callerEmployeeId))
    .sort((a, b) => {
      if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
      return a.shortId.localeCompare(b.shortId);
    })
    .slice(0, GROUP_LIMIT)
    .map(toOverdueItem);

  return [...escalated, ...open, ...approvals, ...overdueWork];
}
