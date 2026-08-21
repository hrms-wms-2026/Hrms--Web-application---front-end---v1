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
}

export type MilestoneTreeNodeKind = 'objective' | 'sprint' | 'task';
export type SprintTaskLoadState = 'unloaded' | 'loading' | 'loaded' | 'error';

export interface MilestoneTreeNode {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
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
}

export type ObjectiveDetail = import('./dto/milestone.dto').ObjectiveDetailDto;
