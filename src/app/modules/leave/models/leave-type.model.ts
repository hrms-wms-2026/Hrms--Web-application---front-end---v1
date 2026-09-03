export interface LeaveTypeResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'unpaid' | 'custom';
  isPaid: boolean;
  requiresApproval: boolean;
  requiresDocument: boolean;
  documentRequiredAfterDays: number | null;
  acceptedDocumentTypes: string[];
  maxConsecutiveDays: number | null;
  defaultDaysPerYear: number;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  carryForwardExpiryMonths: number | null;
  proRataForNewJoiners: boolean;
  applicableGender: 'all' | 'male' | 'female';
  minimumNoticeDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateLeaveTypeRequest {
  name: string;
  code: string;
  description: string | null;
  category: LeaveTypeResponse['category'];
  isPaid: boolean;
  requiresApproval: boolean;
  requiresDocument: boolean;
  documentRequiredAfterDays: number | null;
  acceptedDocumentTypes: string[];
  maxConsecutiveDays: number | null;
  defaultDaysPerYear: number;
  carryForwardAllowed: boolean;
  maxCarryForwardDays: number | null;
  carryForwardExpiryMonths: number | null;
  proRataForNewJoiners: boolean;
  applicableGender: LeaveTypeResponse['applicableGender'];
  minimumNoticeDays: number;
}

/** Code is immutable after creation and deliberately absent from update requests. */
export type UpdateLeaveTypeRequest = Omit<CreateLeaveTypeRequest, 'code'>;
