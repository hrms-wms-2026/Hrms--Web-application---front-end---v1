export type DeviceChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface DeviceChangeRequestResponse {
  id: string;
  employeeId: string;
  requesterDisplayName: string;
  newDeviceName: string;
  newDeviceOs: string;
  status: DeviceChangeRequestStatus;
  requestedAt: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
}

export interface DeviceChangeRequestQuery {
  pageNumber: number;
  pageSize: number;
}

export interface ReviewDeviceChangeRequestPayload {
  reviewComment: string | null;
}
