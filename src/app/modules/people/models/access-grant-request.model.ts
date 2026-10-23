/** A person who can decide an onboarding approval (GET /onboarding/drafts/approval-preview). */
export interface OnboardingApprover {
  readonly userId: string;
  readonly employeeId: string | null;
  readonly name: string;
}

/** Who will have to approve adding someone to a position: the position access approvers (when its access template
 *  requires approval and the caller can't approve it themselves) and the billing managers (when no seat is free).
 *  seatsAvailable is null when the company's seat policy is not configured. */
export interface OnboardingApprovalPreview {
  readonly positionApprovalRequired: boolean;
  readonly positionApprovalBypassed: boolean;
  readonly positionApprovers: readonly OnboardingApprover[];
  readonly seatsAvailable: boolean | null;
  readonly availableSeats: number | null;
  readonly seatApprovers: readonly OnboardingApprover[];
}
