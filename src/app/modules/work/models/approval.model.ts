import { AllocationRequestDto, ObjectiveChangeRequestDto, ObjectiveEditRequestDto } from './dto/allocation-request.dto';
import { ObjectiveInvitationDto } from './dto/objective-invitation.dto';
import { TaskCreationRequestDto } from './dto/task-creation-request.dto';
import { TaskEditRequestDto } from './dto/task-edit-request.dto';

export type ApprovalKind =
  | 'task_creation'
  | 'task_edit'
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
  createdAt: string;
  raw: TaskCreationRequestDto | TaskEditRequestDto | AllocationRequestDto | ObjectiveChangeRequestDto | ObjectiveEditRequestDto | ObjectiveInvitationDto;
}
