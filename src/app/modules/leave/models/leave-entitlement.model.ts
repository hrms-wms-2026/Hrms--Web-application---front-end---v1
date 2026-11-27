import type { ApiSchema } from '../../../shared/api-types/api-schema';
/** Matches the Leave Entitlements backend response and mutation contracts exactly. */
export interface LeaveEntitlementResponse {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  year: number;
  totalHours: number;
  carriedForwardHours: number;
  usedHours: number;
  pendingHours: number;
  remainingHours: number;
  source: 'auto' | 'manual';
  manualReason: string | null;
  isOverUtilized: boolean;
  warning: string | null;
  createdAt: string;
  updatedAt: string | null;
}
export interface LeaveEntitlementListFilter {
  legalEntityId?: string;
  departmentId?: string;
  leaveTypeId?: string;
  search?: string;
}
/** Generated from the backend contract (`npm run api:types`). */
export type GenerateEntitlementsRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.GenerateEntitlementsRequest'>;
export interface LeaveEntitlementGenerationLineResponse {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  totalHours: number;
  carriedForwardHours: number;
  remainingHours: number;
  probationRestrictionApplied: boolean;
  forfeitedHours: number;
  carryForwardExpiresOn: string | null;
  warning: string | null;
}
export interface LeaveEntitlementGenerationSkipResponse {
  employeeId: string | null;
  employeeName: string | null;
  reason: string;
}
export interface LeaveEntitlementGenerationErrorResponse {
  employeeId: string | null;
  employeeName: string | null;
  reason: string;
}
export interface LeaveEntitlementGenerationPreviewResponse {
  year: number;
  employeeCount: number;
  entitlementLineCount: number;
  lines: LeaveEntitlementGenerationLineResponse[];
  skipped: LeaveEntitlementGenerationSkipResponse[];
}
export interface LeaveEntitlementGenerationResultResponse {
  year: number;
  createdCount: number;
  skippedCount: number;
  errorCount: number;
  created: LeaveEntitlementGenerationLineResponse[];
  skipped: LeaveEntitlementGenerationSkipResponse[];
  errors: LeaveEntitlementGenerationErrorResponse[];
}
export interface CreateManualEntitlementRequest {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalHours: number;
  carriedForwardHours: number;
  reason: string;
}
export interface AdjustEntitlementRequest {
  totalHours: number;
  carriedForwardHours: number;
  reason: string;
  confirmNegativeRemaining: boolean;
}
/** Generated from the backend contract (`npm run api:types`). */
export type RecalculateEntitlementRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.RecalculateEntitlementRequest'>;
export interface LeaveBalanceAuditResponse {
  id: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  changeType: 'accrual' | 'deduction' | 'carry_forward' | 'forfeiture' | 'adjustment';
  hoursChanged: number;
  balanceAfter: number;
  reason: string | null;
  relatedRequestId: string | null;
  createdAt: string;
}
export interface LeaveBalanceAuditListFilter {
  employeeId?: string;
  leaveTypeId?: string;
  changeType?: string;
  fromDate?: string;
  toDate?: string;
}
