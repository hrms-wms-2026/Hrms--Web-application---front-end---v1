export type AttendanceCorrectionType = 'clock_in' | 'clock_out' | 'break' | 'full_day';
export type AttendanceCorrectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | string;

export interface AttendanceCorrectionBreakRequest {
  breakStart: string;
  breakEnd: string;
  breakType: string;
}

export interface AttendanceCorrectionBreakResponse extends AttendanceCorrectionBreakRequest {}

export interface AttendanceCorrectionPreviewRequest {
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  requestedBreaks: readonly AttendanceCorrectionBreakRequest[] | null;
  reason: string;
  notes: string | null;
}

export interface AttendanceCorrectionApprover {
  employeeId: string;
  userId: string;
  displayName: string;
  positionName: string | null;
}

export interface AttendanceCorrectionPreviewResponse {
  approvalRequired: boolean;
  approver: AttendanceCorrectionApprover | null;
}

export interface AttendanceCorrectionRequest extends AttendanceCorrectionPreviewRequest {}

export interface AttendanceCorrectionResponse {
  id: string;
  employeeId: string;
  legalEntityId: string;
  timezone: string;
  workDate: string;
  correctionType: AttendanceCorrectionType;
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  requestedBreaks: readonly AttendanceCorrectionBreakResponse[] | null;
  reason: string;
  notes: string | null;
  status: AttendanceCorrectionStatus;
  approvalRequired: boolean;
  requestedById: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
  approver: AttendanceCorrectionApprover | null;
  requesterDisplayName: string | null;
}

export type AttendanceCorrectionListItem = AttendanceCorrectionResponse;
export type AttendanceCorrectionApprovalListItem = AttendanceCorrectionResponse;

export interface ApproveAttendanceCorrectionRequest {
  reviewComment: string | null;
}

export interface RejectAttendanceCorrectionRequest {
  reviewComment: string;
}

export type CancelAttendanceCorrectionResponse = AttendanceCorrectionResponse;

export const CORRECTION_TYPE_OPTIONS: readonly { value: AttendanceCorrectionType; label: string }[] = [
  { value: 'clock_in', label: 'Clock-in time' },
  { value: 'clock_out', label: 'Clock-out time' },
  { value: 'break', label: 'Break time' },
  { value: 'full_day', label: 'Full day' }
];

export const CORRECTION_STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
};

export function correctionTypeLabel(value: string | null | undefined): string {
  return CORRECTION_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? 'Attendance correction';
}

export function correctionStatusLabel(value: string | null | undefined): string {
  if (!value) return 'Unknown status';
  return CORRECTION_STATUS_LABELS[value] ?? 'Request status unavailable';
}
