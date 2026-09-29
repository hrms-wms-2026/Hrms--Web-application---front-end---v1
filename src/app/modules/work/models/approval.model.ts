import { AllocationRequestDto, ObjectiveChangeRequestDto, ObjectiveEditRequestDto } from './dto/allocation-request.dto';
import { ObjectiveInvitationDto } from './dto/objective-invitation.dto';
import { WorkApprovalRequestDto } from './dto/work-approval.dto';

export type ApprovalKind =
  | 'work_approval'
  | 'allocation_extend'
  | 'objective_change'
  | 'objective_edit'
  | 'objective_invitation';

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  /** The module (objective) this request belongs to - used to scope the Approvals page to the
   *  project currently being viewed, since the backend "mine" endpoints return pending requests
   *  across every project the caller owns modules in. */
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
  raw: WorkApprovalRequestDto | AllocationRequestDto | ObjectiveChangeRequestDto | ObjectiveEditRequestDto | ObjectiveInvitationDto;
}
