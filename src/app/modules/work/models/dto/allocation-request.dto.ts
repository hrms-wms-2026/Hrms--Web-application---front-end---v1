export interface AllocationRequestPayloadDto {
  requestedAdditionalHours: number;
  reason: string;
}

export interface AllocationRequestDto {
  id: string;
  objectiveId: string;
  requestType: 'extend_allocation';
  status: 'pending' | 'approved' | 'rejected';
  payload: AllocationRequestPayloadDto;
  createdAt: string;
}

/** Wire shape for existing objective change-request list endpoint (includes extend_allocation). */
export interface ObjectiveChangeRequestDto {
  id: string;
  objectiveId: string;
  requestType: string;
  requestedById: string;
  reportingManagerId: string;
  status: 'pending' | 'approved' | 'rejected';
  payloadJson: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  createdAt: string;
}
