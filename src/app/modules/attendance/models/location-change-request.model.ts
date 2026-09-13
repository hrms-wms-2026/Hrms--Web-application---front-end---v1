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

export const LOCATION_CHANGE_STATUS_LABELS: Readonly<Record<LocationChangeRequestStatus, string>> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  applied: 'Applied'
};

export function locationChangeStatusLabel(value: string | null | undefined): string {
  return LOCATION_CHANGE_STATUS_LABELS[value as LocationChangeRequestStatus] ?? 'Request status unavailable';
}
