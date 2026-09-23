import { TaskStatusColumn, WorkTask } from './task.model';

export interface Milestone {
  objectiveId: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  ownerId: string;
  ownerName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  completedHours: number;
  objectiveIsActive: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  membershipIsActive: boolean;
  membershipRemovedAt: string | null;
  isOwner: boolean;
  /** True only for the actual owner (or an ancestor's owner), never a plain member - unlike
   *  isOwner (which is effective-manager: owner OR active member). Use this wherever a check
   *  must match the backend's IsEffectiveOwnerAsync gate (e.g. task edit save-vs-request). */
  isEffectiveOwner: boolean;
}

export type MilestoneTreeNodeKind = 'objective' | 'sprint' | 'task';
export type SprintTaskLoadState = 'unloaded' | 'loading' | 'loaded' | 'error';

export interface MilestoneTreeNode {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isAchieved: boolean;
  ownerName: string | null;
  isOwner: boolean;
  children: MilestoneTreeNode[];
  kind?: MilestoneTreeNodeKind;
  sprintTaskLoadState?: SprintTaskLoadState;
  status?: string;
  parentObjectiveId?: string;
  statusNames?: Record<string, string>;
  taskSource?: WorkTask;
  taskStatuses?: readonly TaskStatusColumn[];
}

export type ObjectiveDetail = import('./dto/milestone.dto').ObjectiveDetailDto;
