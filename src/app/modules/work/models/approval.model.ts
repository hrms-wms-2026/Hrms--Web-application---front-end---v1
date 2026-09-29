import { AllocationRequestPayloadDto, EditObjectiveRequestPayloadDto } from './dto/allocation-request.dto';
import { ObjectiveInvitationDto } from './dto/objective-invitation.dto';
import { WorkApprovalRequestDto } from './dto/work-approval.dto';

export type ApprovalKind =
  | 'work_approval'
  | 'allocation_extend'
  | 'objective_change'
  | 'objective_edit'
  | 'objective_invitation';

/** An approval-engine request; module edit/allocation items also carry their parsed payload, which
 *  the row shows (and lets the approver adjust) before approving. */
export type EngineApprovalRaw = WorkApprovalRequestDto & {
  payload?: AllocationRequestPayloadDto | EditObjectiveRequestPayloadDto;
};

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  /** The module (objective) this request belongs to - used to scope the Approvals page to the
   *  project currently being viewed ('' for engine requests, which are already project-scoped). */
  objectiveId: string;
  title: string;
  description: string;
  requestedByName: string | null;
  /** Human-readable context for the object affected by this request. */
  targetTitle?: string | null;
  targetType?: 'task' | 'module' | 'request';
  targetId?: string | null;
  currentAllocatedHours?: number | null;
  createdAt: string;
  /** True when decided through the unified approvals API (every request except invitations). */
  engine?: boolean;
  raw: EngineApprovalRaw | ObjectiveInvitationDto;
}
