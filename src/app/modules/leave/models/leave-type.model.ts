/** A leave type is only the kind of leave. Every amount and rule lives on its policies. */
export interface LeaveTypeResponse {
  id: string;
  name: string;
  code: string;
  description: string | null;
  color: string;
  isPaid: boolean;
  applicableGender: 'all' | 'male' | 'female';
  requiresDocument: boolean;
  documentRequiredAfterHours: number | null;
  acceptedDocumentTypes: string[];
  isActive: boolean;
  createdAt: string;
  policyCount: number;
}

export interface CreateLeaveTypeRequest {
  name: string;
  code: string;
  description: string | null;
  color: string;
  isPaid: boolean;
  applicableGender: LeaveTypeResponse['applicableGender'];
  requiresDocument: boolean;
  documentRequiredAfterHours: number | null;
  acceptedDocumentTypes: string[];
}

/** Code is immutable after creation and deliberately absent from update requests. */
export type UpdateLeaveTypeRequest = Omit<CreateLeaveTypeRequest, 'code'>;

export const LEAVE_TYPE_COLORS = [
  '#2563EB', '#16A34A', '#DB2777', '#7C3AED', '#EA580C', '#0891B2', '#CA8A04', '#475569'
] as const;
