import { ApprovalItem } from '../models/approval.model';
import { AllocationRequestDto, AllocationRequestPayloadDto, EditObjectiveRequestPayloadDto, ObjectiveChangeRequestDto } from '../models/dto/allocation-request.dto';
import { ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { TaskCreationRequestDto } from '../models/dto/task-creation-request.dto';
import { TaskEditRequestDto } from '../models/dto/task-edit-request.dto';

export function toApprovalItem(dto: TaskCreationRequestDto): ApprovalItem;
export function toApprovalItem(dto: TaskEditRequestDto): ApprovalItem;
export function toApprovalItem(dto: AllocationRequestDto): ApprovalItem;
export function toApprovalItem(dto: ObjectiveChangeRequestDto): ApprovalItem;
export function toApprovalItem(dto: ObjectiveInvitationDto): ApprovalItem;
export function toApprovalItem(
  dto: TaskCreationRequestDto | TaskEditRequestDto | AllocationRequestDto | ObjectiveChangeRequestDto | ObjectiveInvitationDto
): ApprovalItem {
  if ('taskId' in dto) {
    const request = dto as TaskEditRequestDto;
    return {
      id: request.id,
      kind: 'task_edit',
      objectiveId: request.objectiveId,
      title: `Edit: ${request.payload.title}`,
      description: request.payload.description ?? '',
      requestedByName: request.requestedByName,
      targetTitle: request.payload.title,
      targetType: 'task',
      targetId: request.taskId,
      createdAt: request.createdAt,
      raw: request
    };
  }

  if ('payload' in dto && 'categoryId' in dto.payload) {
    const request = dto as TaskCreationRequestDto;
    return {
      id: request.id,
      kind: 'task_creation',
      objectiveId: request.objectiveId,
      title: request.payload.title,
      description: request.payload.description ?? '',
      requestedByName: request.requestedByName ?? null,
      targetTitle: request.payload.title,
      targetType: 'request',
      targetId: null,
      createdAt: request.createdAt,
      raw: request
    };
  }

  if ('requestType' in dto && dto.requestType === 'extend_allocation' && 'payload' in dto) {
    const request = dto as AllocationRequestDto;
    return {
      id: request.id,
      kind: 'allocation_extend',
      objectiveId: request.objectiveId,
      title: `+${request.payload.requestedAdditionalHours}h requested`,
      description: request.payload.reason,
      requestedByName: request.requestedByName ?? null,
      targetTitle: request.objectiveTitle ?? null,
      targetType: 'module',
      targetId: request.objectiveId,
      currentAllocatedHours: request.currentAllocatedHours ?? null,
      createdAt: request.createdAt,
      raw: request
    };
  }

  if ('inviteType' in dto) {
    const invitation = dto as ObjectiveInvitationDto;
    return {
      id: invitation.id,
      kind: 'objective_invitation',
      objectiveId: invitation.objectiveId,
      title: `Invited as ${invitation.inviteType}`,
      description: `Milestone ${invitation.objectiveId}`,
      requestedByName: null,
      targetType: 'module',
      targetId: invitation.objectiveId,
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
      objectiveId: change.objectiveId,
      title: payload ? `+${payload.requestedAdditionalHours}h requested` : 'Allocation extension',
      description: payload?.reason ?? 'Extend allocation',
      requestedByName: change.requestedByName ?? null,
      targetTitle: change.objectiveTitle ?? null,
      targetType: 'module',
      targetId: change.objectiveId,
      currentAllocatedHours: change.currentAllocatedHours ?? null,
      createdAt: change.createdAt,
      raw: {
        id: change.id,
        objectiveId: change.objectiveId,
        requestedById: change.requestedById,
        requestedByName: change.requestedByName ?? null,
        objectiveTitle: change.objectiveTitle ?? null,
        projectId: change.projectId ?? null,
        currentAllocatedHours: change.currentAllocatedHours ?? null,
        requestType: 'extend_allocation',
        status: change.status,
        payload: payload ?? { requestedAdditionalHours: 0, reason: '' },
        createdAt: change.createdAt
      }
    };
  }

  if (change.requestType === 'edit') {
    const payload = parseEditPayload(change.payloadJson);
    return {
      id: change.id,
      kind: 'objective_edit',
      objectiveId: change.objectiveId,
      title: payload ? `Edit: ${payload.title}` : 'Milestone edit',
      description: change.objectiveTitle ? `Module: ${change.objectiveTitle}` : '',
      requestedByName: change.requestedByName ?? null,
      targetTitle: change.objectiveTitle ?? null,
      targetType: 'module',
      targetId: change.objectiveId,
      createdAt: change.createdAt,
      raw: {
        id: change.id,
        objectiveId: change.objectiveId,
        requestType: 'edit',
        status: change.status,
        payload: payload ?? { title: '', description: null, startDate: '', endDate: '', allocatedHours: 0 },
        createdAt: change.createdAt
      }
    };
  }

  return {
    id: change.id,
    kind: 'objective_change',
    objectiveId: change.objectiveId,
    title: change.requestType.replaceAll('_', ' '),
    description: change.objectiveTitle ? `Module: ${change.objectiveTitle}` : '',
    requestedByName: change.requestedByName ?? null,
    targetTitle: change.objectiveTitle ?? null,
    targetType: 'module',
    targetId: change.objectiveId,
    createdAt: change.createdAt,
    raw: change
  };
}

function parseAllocationPayload(payloadJson: string | null): AllocationRequestPayloadDto | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as AllocationRequestPayloadDto & {
      RequestedAdditionalHours?: number;
      Reason?: string;
    };
    const requestedAdditionalHours = parsed.requestedAdditionalHours ?? parsed.RequestedAdditionalHours;
    const reason = parsed.reason ?? parsed.Reason;
    if (typeof requestedAdditionalHours === 'number' && typeof reason === 'string') {
      return { requestedAdditionalHours, reason };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function parseEditPayload(payloadJson: string | null): EditObjectiveRequestPayloadDto | null {
  if (!payloadJson) return null;
  try {
    const parsed = JSON.parse(payloadJson) as EditObjectiveRequestPayloadDto;
    if (typeof parsed.title === 'string' && typeof parsed.startDate === 'string'
      && typeof parsed.endDate === 'string' && typeof parsed.allocatedHours === 'number') {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}
