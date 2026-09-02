export type WorkArea = 'onsite' | 'remote';

export type WorkAreaChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface WorkAreaChangeRequestPayload {
  date: string;
  requestedWorkArea: WorkArea;
  reason: string;
}

export interface WorkAreaChangeApproverResponse {
  employeeId: string;
  userId: string;
  displayName: string;
  positionName: string | null;
}

export interface WorkAreaChangeRequestPreviewResponse {
  date: string;
  timezone: string;
  currentExpectedWorkArea: string;
  requestedWorkArea: string;
  reason: string;
  receiver: WorkAreaChangeApproverResponse;
}

export interface WorkAreaChangeRequestResponse {
  id: string;
  employeeId: string;
  legalEntityId: string;
  requesterDisplayName: string;
  timezone: string;
  date: string;
  currentExpectedWorkArea: string;
  requestedWorkArea: string;
  reason: string;
  status: WorkAreaChangeRequestStatus;
  requestedAt: string;
  reviewedById: string | null;
  reviewerDisplayName: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  receiver: WorkAreaChangeApproverResponse | null;
}

export interface WorkAreaChangeRequestQuery {
  from?: string;
  to?: string;
  status?: WorkAreaChangeRequestStatus;
  pageNumber: number;
  pageSize: number;
}

export interface ReviewWorkAreaChangeRequestPayload {
  reviewComment: string | null;
}

export const WORK_AREA_OPTIONS: readonly { value: WorkArea; label: string }[] = [
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' }
];

export const WORK_AREA_CHANGE_STATUS_LABELS: Readonly<Record<WorkAreaChangeRequestStatus, string>> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

export function workAreaLabel(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'onsite') return 'On-site';
  if (normalized === 'remote') return 'Remote';
  return 'Work area unavailable';
}

export function workAreaChangeStatusLabel(value: string | null | undefined): string {
  return WORK_AREA_CHANGE_STATUS_LABELS[value as WorkAreaChangeRequestStatus] ?? 'Request status unavailable';
}
