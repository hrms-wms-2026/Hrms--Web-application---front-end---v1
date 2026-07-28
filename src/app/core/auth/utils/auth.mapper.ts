import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { CurrentUserViewModel } from '../models/view/current-user.view-model';

export function toCurrentUserViewModel(dto: AuthResponseDto): CurrentUserViewModel {
  return {
    email: dto.user.email,
    permissions: dto.permissions,
    activeModules: dto.active_modules,
    authenticated: dto.authenticated,
    legalAcceptanceRequired: dto.legal_acceptance_required,
    pendingLegalDocuments: dto.pending_legal_documents ?? []
  };
}
