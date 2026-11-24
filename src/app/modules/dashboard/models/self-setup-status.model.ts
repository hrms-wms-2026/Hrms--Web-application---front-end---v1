/** GET /api/v1/onboarding/drafts/self-setup - can the signed-in user add themselves as an employee? */
export interface SelfSetupStatusDto {
  readonly has_employee_profile: boolean;
  readonly has_legal_entity: boolean;
  readonly has_department: boolean;
  readonly has_position: boolean;
  readonly can_add_self: boolean;
  readonly first_name: string;
  readonly last_name: string;
  readonly work_email: string;
}
