import { LegalDocumentDto } from './legal-document.dto';

export interface AuthResponseDto {
  authenticated: boolean;
  user: { email: string };
  permissions: string[];
  active_modules: string[];
  must_change_password: boolean;
  mfa_required: boolean;
  legal_acceptance_required: boolean;
  pending_legal_documents: LegalDocumentDto[] | null;
  expires_at: string | null;
  continue_url: string | null;
}
