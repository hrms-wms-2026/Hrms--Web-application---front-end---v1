import { LegalAcceptanceDecisionDto } from './legal-acceptance-request.dto';

export interface AcceptEmployeeInvitationRequestDto {
  password: string;
  confirm_password: string;
  acceptances: LegalAcceptanceDecisionDto[];
}
