/** Matches the shared Leave Balances backend response used by My, Team, and All views. */
export interface LeaveBalanceResponse {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  legalEntityId: string | null;
  legalEntityName: string | null;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  entitledHours: number;
  annualHours: number;
  carriedForwardHours: number;
  usedHours: number;
  pendingHours: number;
  remainingHours: number;
  isNegative: boolean;
  carryForwardExpiresOn: string | null;
  policyName?: string | null;
  amountHours?: number | null;
  amountPeriod?: 'month' | 'year' | null;
}

/** Matches ONEVO.Application.Features.Leave.Balance.DTOs.Responses.LeaveWorkWindowResponse. */
export interface LeaveWorkWindowResponse {
  workStartTime: string | null;
  workEndTime: string | null;
  breakDurationMinutes: number | null;
  timezone: string | null;
}

export interface LeaveBalanceTeamFilter { departmentId?: string; leaveTypeId?: string; search?: string; }
export interface LeaveBalanceAllFilter extends LeaveBalanceTeamFilter { legalEntityId?: string; employmentStatusId?: number; }
