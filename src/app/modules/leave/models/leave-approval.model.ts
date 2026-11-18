import type { ApiSchema } from '../../../shared/api-types/api-schema';
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
  status: 'pending';
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  submittedAt: string;
  approverNames: string[];
}

export interface LeaveApprovalApproverResponse {
  approverEmployeeId: string;
  approverName: string;
  sequenceOrder: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'cancelled';
  comment: string | null;
  delegatedFromApproverId: string | null;
  decidedAt: string | null;
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null;
  approvers: LeaveApprovalApproverResponse[];
  submissionConflictSnapshotJson: string | null;
  currentWarnings: LeaveApprovalWarningResponse[];
  remainingHours: number;
  /** True only when the caller is the approver whose turn it is on a still-open request. */
  canDecide: boolean;
  /** True when the caller made this approve/reject decision and the leave hasn't started yet. */
  canChangeDecision: boolean;
}

export interface ChangeLeaveDecisionRequest {
  decision: 'approve' | 'reject';
  comment: string | null;
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

/** Generated from the backend contract (`npm run api:types`). */
export type ApproveLeaveRequestRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.ApproveLeaveRequestRequest'>;

/** Matches ONEVO.Api.Contracts.Leave.Approvals.* verbatim. */
export interface RejectLeaveRequestRequest {
  reason: string;
}

export interface LeaveApprovalListFilter {
  search?: string;
  leaveTypeId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface LeaveRequestAllListFilter extends LeaveApprovalListFilter {
  status?: string;
}

/** Helper for rendering `submissionConflictSnapshotJson` - parses it back to Phase 4's shape. */
export function parseSubmissionConflictSnapshot(
  json: string | null,
): LeaveRequestConflictSnapshotResponse | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as LeaveRequestConflictSnapshotResponse;
  } catch {
    return null;
  }
}
