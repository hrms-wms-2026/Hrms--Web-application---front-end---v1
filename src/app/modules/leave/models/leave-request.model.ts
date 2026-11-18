import type { ApiSchema } from '../../../shared/api-types/api-schema';
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
  /** Multi-step approval progress ("1 of 2 approved"); skipped and cancelled approvers are not counted. */
  approvedApproverCount?: number;
  approverCount?: number;
}

/** Matches ONEVO.Application.Features.Storage.File.DTOs.Responses.FileRecordDto (camelCase). */
export interface LeaveUploadedDocument {
  id: string;
  originalFileName: string;
}

/** Generated from the backend contract (`npm run api:types`). */
export type SubmitLeaveRequestRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestRequest'>;

/** Generated from the backend contract (`npm run api:types`). */
export type SubmitLeaveRequestOnBehalfRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestOnBehalfRequest'>;

export interface LeaveRequestListFilter {
  status?: string;
  fromDate?: string;
  toDate?: string;
  leaveTypeId?: string;
}

/** Generated from the backend contract (`npm run api:types`). */
export type CancelLeaveRequestRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>;

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
