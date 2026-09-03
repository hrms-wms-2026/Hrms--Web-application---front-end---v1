import { AllocationRequestDto, ObjectiveChangeRequestDto } from './dto/allocation-request.dto';
import { ObjectiveInvitationDto } from './dto/objective-invitation.dto';
import { TaskCreationRequestDto } from './dto/task-creation-request.dto';

export type ApprovalKind =
  | 'task_creation'
  | 'allocation_extend'
  | 'objective_change'
  | 'objective_invitation';

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  title: string;
  description: string;
  requestedByName: string | null;
  createdAt: string;
  raw: TaskCreationRequestDto | AllocationRequestDto | ObjectiveChangeRequestDto | ObjectiveInvitationDto;
}
