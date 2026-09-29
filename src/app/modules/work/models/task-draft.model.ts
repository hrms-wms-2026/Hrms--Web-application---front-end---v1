import { WorkTask } from './task.model';

export interface TaskDraftAttachment {
  readonly fileId: string;
  readonly name: string;
  readonly sizeBytes: number;
}

export interface TaskDraftSubtask {
  id: string;
  title: string;
  priority?: WorkTask['priority'];
  dueDate?: string;
  assigneeEmployeeId?: string;
  objectiveId?: string;
  categoryId?: string;
}

/** Snapshot of the "create task" form. Stored opaquely by the backend as jsonb. */
export interface TaskDraftPayload {
  readonly version: 1;
  readonly description: string;
  readonly objectiveId: string;
  readonly sprintId: string;
  readonly categoryId: string;
  readonly statusId: string;
  readonly priority: WorkTask['priority'] | null;
  readonly dueDate: string;
  readonly estimatedHours: number | null;
  readonly storyPoints: number | null;
  readonly assigneeEmployeeId: string;
  readonly subtasks: readonly TaskDraftSubtask[];
  readonly attachments: readonly TaskDraftAttachment[];
  /** Denormalised copy of attachments[].fileId - the backend reads this to clean up pending uploads. */
  readonly attachmentFileIds: readonly string[];
}

export interface TaskDraftSummary {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface TaskDraft {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly payload: TaskDraftPayload;
  readonly updatedAt: string;
}
