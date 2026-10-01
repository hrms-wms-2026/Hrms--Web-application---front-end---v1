import { TaskStatusCategory } from '../task.model';

export interface TaskStatusSnapshotDto {
  name: string;
  category: TaskStatusCategory;
  color: string;
  visibility: 'public' | 'private';
}

export interface TaskStatusChangeSetDto {
  adds: (TaskStatusSnapshotDto & { tempKey: string })[];
  updates: { statusId: string; from: TaskStatusSnapshotDto; to: TaskStatusSnapshotDto }[];
  deletes: { statusId: string; name: string }[];
  /** Existing status ids in the order the requester started from. */
  baseOrder: string[];
  /** Full intended order: existing status ids plus add tempKeys. */
  order: string[];
}

export type TaskStatusChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'stale';

export interface TaskStatusChangeRequestDto {
  id: string;
  projectId: string;
  status: TaskStatusChangeRequestStatus;
  requestedByEmployeeId: string;
  requesterDisplayName: string;
  note: string | null;
  changes: TaskStatusChangeSetDto & { reordersExisting?: boolean };
  createdAt: string;
  decidedByEmployeeId: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  canDecide: boolean;
  canCancel: boolean;
}

export interface ProjectTaskStatusChangeRequestsDto {
  canEditDirectly: boolean;
  canRequest: boolean;
  requests: TaskStatusChangeRequestDto[];
}
