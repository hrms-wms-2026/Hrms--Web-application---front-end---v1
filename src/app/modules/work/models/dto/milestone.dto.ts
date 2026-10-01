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
  isEffectiveOwner: boolean;
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
  assets?: ObjectiveAssetDto[];
}

export interface ObjectiveSubtreeNodeDto extends ObjectiveDetailDto {
  children: ObjectiveSubtreeNodeDto[];
}

export interface ObjectiveSubtreeResponseDto {
  parentObjective: ObjectiveDetailDto | null;
  objective: ObjectiveSubtreeNodeDto;
}

export interface ObjectiveAssetDto {
  id: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  uploadedAt: string;
  downloadUrl: string;
}

export interface CreateObjectiveMemberInvitationRequestDto {
  employeeId: string;
  type: 'member' | 'leader';
}

export interface CreateObjectiveRequestDto {
  parentObjectiveId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  headEmployeeId?: string | null;
  memberInvitations?: CreateObjectiveMemberInvitationRequestDto[];
}

export interface AddObjectiveMemberOutcomeDto {
  alreadyMember: boolean;
  invitation: import('./objective-invitation.dto').ObjectiveInvitationDto | null;
}

export interface TransferObjectiveHeadOutcomeDto {
  applied: boolean;
  /** Set when the transfer was sent for approval instead of applied. */
  approvalRequestId?: string | null;
  pendingInvitation: import('./objective-invitation.dto').ObjectiveInvitationDto | null;
}

export interface EditObjectiveRequestDto {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}
