export interface PendingAccessGrantRequestResponse {
  readonly id: string;
  readonly actionType: 'onboarding_position_access' | 'position_change_access';
  readonly employeeName: string | null;
  readonly targetPositionName: string;
  readonly changeReason: string | null;
  readonly requestedByName: string;
  readonly requestedAt: string;
  readonly invitedFullName?: string | null;
}
