import { LegalDocumentDto } from './legal-document.dto';
import { WorkspaceDto } from './workspace.dto';

export interface AuthResponseDto {
  authenticated: boolean;
  user: { email: string; employeeId?: string | null; display_name?: string | null };
  permissions: string[];
  active_modules: string[];
  must_change_password: boolean;
  mfa_required: boolean;
  legal_acceptance_required: boolean;
  pending_legal_documents: LegalDocumentDto[] | null;
  expires_at: string | null;
  continue_url: string | null;
  workspace: WorkspaceDto | null;
  /**
   * Present only on the "every gate cleared, but this response is still on the base host" outcome
   * (TenantSessionExchangeResponseDto server-side). authenticated is false and continue_url points
   * at the tenant host's /auth/continue - the SPA must navigate there instead of treating this as a
   * signed-in session.
   */
  redirect_required?: boolean;
}
