import { ApprovalKind } from '../approval.model';

export type ApprovalHistoryDirection = 'sent' | 'received';

export interface ApprovalHistoryItemDto {
  id: string;
  objectiveId: string;
  kind: ApprovalKind;
  status: 'pending' | 'approved' | 'rejected' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  direction: ApprovalHistoryDirection;
  subjectTitle: string;
  detail: string | null;
  requestedById: string;
  requestedByName: string;
  approverId: string;
  approverName: string;
  decidedById: string | null;
  decidedByName: string | null;
  decisionComment: string | null;
  createdAt: string;
  decidedAt: string | null;
}
