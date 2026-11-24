export interface InvitationPreviewDto {
  invitation_id: string;
  tenant_id: string;
  tenant_name: string;
  invited_email: string;
  first_name: string;
  last_name: string;
  role_name: string;
  expires_at: string;
  status: string;
  password_setup_enabled: boolean;
  google_sign_in_enabled: boolean;
  allow_google_email_mismatch: boolean;
  allowed_email_domains: string[];
  /**
   * "employee_onboarding" invitations are accepted through accept-employee; any other purpose
   * (a tenant owner invite is "general") through accept-password. Missing on older backends,
   * which only sent employee invitations to this page.
   */
  purpose?: string;
}

export const EMPLOYEE_ONBOARDING_PURPOSE = 'employee_onboarding';
