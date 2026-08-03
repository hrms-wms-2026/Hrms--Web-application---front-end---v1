import { LegalDocumentDto } from '../dto/legal-document.dto';

export interface CurrentUserViewModel {
  email: string;
  permissions: string[];
  activeModules: string[];
  authenticated: boolean;
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
  workspaceSlug: string | null;
  /** True only for the base-host "every gate cleared, hand off to tenant host" outcome. */
  redirectRequired: boolean;
  continueUrl: string | null;
}
