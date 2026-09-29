export interface AllocationRequestPayloadDto {
  requestedAdditionalHours: number;
  reason: string;
}

export interface EditObjectiveRequestPayloadDto {
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
}
