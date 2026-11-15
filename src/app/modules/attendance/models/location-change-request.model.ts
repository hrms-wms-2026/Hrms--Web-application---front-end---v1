export type LocationChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'applied';

export interface LocationChangeRequestResponse {
  id: string;
  employeeId: string;
  requesterDisplayName: string;
  requestedLatitude: number;
  requestedLongitude: number;
  requestedAccuracyMeters: number | null;
  reason: string;
  status: LocationChangeRequestStatus;
  requestedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  appliedAt: string | null;
}

export interface LocationChangeRequestQuery {
  status?: LocationChangeRequestStatus;
  pageNumber: number;
  pageSize: number;
}

export interface ReviewLocationChangeRequestPayload {
  reviewComment: string | null;
}
