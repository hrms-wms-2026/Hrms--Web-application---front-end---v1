import { ApprovalItem } from '../models/approval.model';
import { AllocationRequestDto, AllocationRequestPayloadDto, ObjectiveChangeRequestDto } from '../models/dto/allocation-request.dto';
import { ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { TaskCreationRequestDto } from '../models/dto/task-creation-request.dto';

export function toApprovalItem(dto: TaskCreationRequestDto): ApprovalItem;
export function toApprovalItem(dto: AllocationRequestDto): ApprovalItem;
export function toApprovalItem(dto: ObjectiveChangeRequestDto): ApprovalItem;
export function toApprovalItem(dto: ObjectiveInvitationDto): ApprovalItem;
export function toApprovalItem(
  dto: TaskCreationRequestDto | AllocationRequestDto | ObjectiveChangeRequestDto | ObjectiveInvitationDto
): ApprovalItem {
  if ('payload' in dto && 'categoryId' in dto.payload) {
    const request = dto as TaskCreationRequestDto;
    return {
      id: request.id,
      kind: 'task_creation',
      title: request.payload.title,
      description: `Requested for objective ${request.objectiveId}`,
      requestedByName: null,
      createdAt: request.createdAt,
      raw: request
    };
  }

  if ('requestType' in dto && dto.requestType === 'extend_allocation' && 'payload' in dto) {
    const request = dto as AllocationRequestDto;
    return {
      id: request.id,
      kind: 'allocation_extend',
      title: `+${request.payload.requestedAdditionalHours}h requested`,
      description: request.payload.reason,
      requestedByName: null,
      createdAt: request.createdAt,
      raw: request
    };
  }

  if ('inviteType' in dto) {
    const invitation = dto as ObjectiveInvitationDto;
    return {
      id: invitation.id,
      kind: 'objective_invitation',
      title: `Invited as ${invitation.inviteType}`,
      description: `Milestone ${invitation.objectiveId}`,
      requestedByName: null,
      createdAt: invitation.createdAt,
      raw: invitation
    };
  }

  const change = dto as ObjectiveChangeRequestDto;
  if (change.requestType === 'extend_allocation') {
    const payload = parseAllocationPayload(change.payloadJson);
    return {
      id: change.id,
      kind: 'allocation_extend',
      title: payload ? `+${payload.requestedAdditionalHours}h requested` : 'Allocation extension',
      description: payload?.reason ?? 'Extend allocation',
      requestedByName: null,
      createdAt: change.createdAt,
      raw: {
        id: change.id,
        objectiveId: change.objectiveId,
        requestType: 'extend_allocation',
        status: change.status,
        payload: payload ?? { requestedAdditionalHours: 0, reason: '' },
        createdAt: change.createdAt
      }
    };
  }

  return {
    id: change.id,
    kind: 'objective_change',
    title: change.requestType.replaceAll('_', ' '),
    description: `Objective ${change.objectiveId}`,
    requestedByName: null,
    createdAt: change.createdAt,
    raw: change
  };
}

function parseAllocationPayload(payloadJson: string | null): AllocationRequestPayloadDto | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as AllocationRequestPayloadDto;
    if (typeof parsed.requestedAdditionalHours === 'number' && typeof parsed.reason === 'string') {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}
