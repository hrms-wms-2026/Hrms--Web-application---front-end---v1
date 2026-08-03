export interface LegalAcceptanceDecisionDto {
  document_type: string;
  version: string;
  decision: 'accepted' | 'declined';
}

export interface LegalAcceptanceRequestDto {
  acceptances: LegalAcceptanceDecisionDto[];
}
