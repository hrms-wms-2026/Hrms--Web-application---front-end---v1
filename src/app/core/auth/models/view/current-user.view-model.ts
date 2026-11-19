import { LegalDocumentDto } from '../dto/legal-document.dto';

export interface CurrentUserViewModel {
  email: string;
  employeeId: string | null;
  permissions: string[];
  activeModules: string[];
  /** True when the user manages anyone (management coverage) - see PermissionService.MANAGES_PEOPLE. */
  managesPeople: boolean;
  authenticated: boolean;
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
  workspaceSlug: string | null;
  /** True only for the base-host "every gate cleared, hand off to tenant host" outcome. */
  redirectRequired: boolean;
  continueUrl: string | null;
}
