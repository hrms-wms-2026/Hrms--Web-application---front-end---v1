export interface ObjectiveMemberItemDto {
  employeeId: string;
  isHead: boolean;
  pending: boolean;
  inviteType: 'member' | 'leader' | null;
  invitationId: string | null;
  sinceOrInvitedAt: string;
}

export interface ObjectiveMemberListDto {
  items: ObjectiveMemberItemDto[];
}

export interface ObjectiveInvitationDto {
  id: string;
  projectId: string;
  objectiveId: string;
  invitedEmployeeId: string;
  inviteType: 'member' | 'leader';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  invitedById: string;
  decidedAt: string | null;
  createdAt: string;
}
