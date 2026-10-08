import { ActionItemLink } from './my-team-action-items.model';

export type PriorityActionGroup = 'escalated_exception' | 'open_exception' | 'pending_approval' | 'overdue_work';

export interface PriorityActionItem {
  group: PriorityActionGroup;
  sourceKey: string;
  domain: 'people' | 'work';
  entityId: string;
  title: string;
  subjectName: string | null;
  /** Compact "Xh"/"Xd ago" for exceptions/approvals, "Xd overdue" for overdue work. */
  captionLabel: string;
  /** Whole days the item has waited (approvals/exceptions) or is overdue (overdue_work) - drives
   * the caption's urgency tone only, never the ordering (D7). */
  ageDays: number;
  /** Present for every group except overdue_work, which routes via its own project/objective/task fields. */
  link: ActionItemLink | null;
  overdueTask: { projectId: string; objectiveId: string; taskId: string } | null;
}
