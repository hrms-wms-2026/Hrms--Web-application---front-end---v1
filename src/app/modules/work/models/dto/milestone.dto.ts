export interface MyProjectMilestoneDto {
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

export interface ObjectiveDetailDto {
  id: string;
  projectId: string;
  parentObjectiveId: string | null;
  isDefault: boolean;
  title: string;
  description: string | null;
  ownerId: string;
  ownerName: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  createdById: string;
  startDate: string;
  endDate: string;
  progress: number;
  actualHours: number | null;
  allocatedHours: number;
  completedHours: number;
  isActive: boolean;
  isOwner: boolean;
  isAchieved: boolean;
  achievedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ObjectiveSubtreeNodeDto extends ObjectiveDetailDto {
  children: ObjectiveSubtreeNodeDto[];
}

export interface ObjectiveSubtreeResponseDto {
  parentObjective: ObjectiveDetailDto | null;
  objective: ObjectiveSubtreeNodeDto;
}

export interface CreateObjectiveRequestDto {
  parentObjectiveId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}

export interface EditObjectiveRequestDto {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}
