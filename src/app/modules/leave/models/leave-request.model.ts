/** Matches ONEVO.Application.Features.Leave.Request.DTOs.Responses.* verbatim. */
export interface LeaveRequestBalanceImpactResponse {
  currentRemainingHours: number;
  pendingAfterSubmitHours: number;
  remainingAfterSubmitHours: number;
}

export interface LeaveRequestApproverResponse {
  approverEmployeeId: string;
  approverName: string;
  sequenceOrder: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  delegatedFromApproverId: string | null;
}

export interface LeaveRequestWarningResponse {
  code: string;
  message: string;
}

export interface LeaveRequestCalendarConflictResponse {
  source: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
}

export interface LeaveRequestConflictSnapshotResponse {
  warnings: LeaveRequestWarningResponse[];
  calendarConflicts: LeaveRequestCalendarConflictResponse[];
  teamAbsencePercent: number | null;
}

export interface LeaveRequestResponse {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startAt: string;
  endAt: string;
  totalHours: number;
  paidHours: number;
  unpaidHours: number;
  exceedsBalanceByHours?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  noticePeriodMissed: boolean;
  submittedOnBehalfOfBy: string | null;
  balanceImpact: LeaveRequestBalanceImpactResponse;
  approvers: LeaveRequestApproverResponse[];
  conflictSnapshot: LeaveRequestConflictSnapshotResponse;
  createdAt: string;
}

export interface LeaveRequestListItemResponse {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startAt: string;
  endAt: string;
  totalHours: number;
  paidHours: number;
  unpaidHours: number;
  exceedsBalanceByHours?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  noticePeriodMissed: boolean;
  approvedByName: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Matches ONEVO.Application.Features.Storage.File.DTOs.Responses.FileRecordDto (camelCase). */
export interface LeaveUploadedDocument {
  id: string;
  originalFileName: string;
}

/** Matches ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestRequest verbatim. Shared by preview and submit. */
export interface SubmitLeaveRequestRequest {
  leaveTypeId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
  fileRecordIds: string[] | null;
}

/** Matches ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestOnBehalfRequest verbatim. */
export interface SubmitLeaveRequestOnBehalfRequest extends SubmitLeaveRequestRequest {
  employeeId: string;
}

export interface LeaveRequestListFilter {
  status?: string;
  fromDate?: string;
  toDate?: string;
  leaveTypeId?: string;
}

/** Matches ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest verbatim. */
export interface CancelLeaveRequestRequest {
  reason: string | null;
  effectiveDate: string | null;
  expectedVersion: string | null;
}

/** Matches ONEVO.Application.Features.Leave.Cancellation.DTOs.Responses.CancelLeaveRequestResponse verbatim. */
export interface CancelLeaveRequestResponse {
  requestId: string;
  status: string;
  isPartialCancellation: boolean;
  effectiveDate: string | null;
  releasedPendingHours: number;
  restoredUsedHours: number;
  remainingHours: number;
  reason: string | null;
  cancelledAt: string;
}
