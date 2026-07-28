import { LegalDocumentDto } from '../dto/legal-document.dto';

export interface CurrentUserViewModel {
  email: string;
  permissions: string[];
  activeModules: string[];
  authenticated: boolean;
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
}
