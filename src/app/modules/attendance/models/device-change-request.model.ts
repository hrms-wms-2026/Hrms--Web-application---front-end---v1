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

export const DEVICE_CHANGE_STATUS_LABELS: Readonly<Record<DeviceChangeRequestStatus, string>> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected'
};

export function deviceChangeStatusLabel(value: string | null | undefined): string {
  return DEVICE_CHANGE_STATUS_LABELS[value as DeviceChangeRequestStatus] ?? 'Request status unavailable';
}
