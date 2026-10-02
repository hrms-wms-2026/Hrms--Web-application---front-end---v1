import { LeaveRequestConflictSnapshotResponse } from './leave-request.model';

/** Matches ONEVO.Application.Features.Leave.Approval.DTOs.Responses.* verbatim. */
export interface LeaveApprovalWarningResponse {
  code: string;
  message: string;
}

export interface LeavePendingApprovalListItemResponse {
  requestId: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startAt: string;
  endAt: string;
  totalHours: number;
  paidHours: number;
  unpaidHours: number;
  status: 'pending' | 'information_requested';
  submittedAt: string;
}

export interface LeaveRequestAllListItemResponse {
  requestId: string;
  employeeId: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  startAt: string;
  endAt: string;
  totalHours: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'information_requested';
  submittedAt: string;
}

export interface LeaveApprovalApproverResponse {
  approverEmployeeId: string;
  approverName: string;
  sequenceOrder: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'information_requested';
  comment: string | null;
  delegatedFromApproverId: string | null;
  decidedAt: string | null;
}

export interface LeaveApprovalInfoMessageResponse {
  senderEmployeeId: string;
  message: string;
  createdAt: string;
}

export interface LeaveApprovalDetailResponse {
  requestId: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  startAt: string;
  endAt: string;
  totalHours: number;
  paidHours: number;
  unpaidHours: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'information_requested';
  reason: string | null;
  approvers: LeaveApprovalApproverResponse[];
  infoMessages: LeaveApprovalInfoMessageResponse[];
  submissionConflictSnapshotJson: string | null;
  currentWarnings: LeaveApprovalWarningResponse[];
  remainingHours: number;
}

export interface LeaveApprovalDecisionResponse {
  requestId: string;
  status: string;
  currentApproverState: string;
  paidHoursMovedFromPending: number;
  unpaidHours: number;
  remainingHours: number;
  currentWarnings: LeaveApprovalWarningResponse[];
}

export interface LeaveApprovalBulkItemResponse {
  requestId: string;
  success: boolean;
  status: string | null;
  error: string | null;
}

export interface LeaveApprovalBulkResultResponse {
  items: LeaveApprovalBulkItemResponse[];
  successCount: number;
  failureCount: number;
}

/** Matches ONEVO.Api.Contracts.Leave.Approvals.* verbatim. */
export interface ApproveLeaveRequestRequest {
  comment: string | null;
}

export interface RejectLeaveRequestRequest {
  reason: string;
}

export interface RequestLeaveInformationRequest {
  question: string;
}

export interface RespondLeaveInformationRequest {
  message: string;
  fileRecordIds: string[] | null;
}

export interface BulkApproveLeaveRequestsRequest {
  requestIds: string[];
  comment: string | null;
}

export interface BulkRejectLeaveRequestsRequest {
  requestIds: string[];
  reason: string;
}

export interface LeaveApprovalListFilter {
  search?: string;
  leaveTypeId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface LeaveApprovalDelegateResponse {
  id: string;
  delegateEmployeeId: string;
  delegateName: string;
  startDate: string;
  endDate: string;
}

export interface CreateLeaveApprovalDelegateRequest {
  delegateEmployeeId: string;
  startDate: string;
  endDate: string;
}

export interface LeaveRequestAllListFilter extends LeaveApprovalListFilter {
  status?: string;
}

/** Helper for rendering `submissionConflictSnapshotJson` - parses it back to Phase 4's shape. */
export function parseSubmissionConflictSnapshot(json: string | null): LeaveRequestConflictSnapshotResponse | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as LeaveRequestConflictSnapshotResponse;
  } catch {
    return null;
  }
}
