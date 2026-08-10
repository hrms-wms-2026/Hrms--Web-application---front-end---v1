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

export interface MilestoneTreeNode {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  progress: number;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  children: MilestoneTreeNode[];
}

export type ObjectiveDetail = import('./dto/milestone.dto').ObjectiveDetailDto;
