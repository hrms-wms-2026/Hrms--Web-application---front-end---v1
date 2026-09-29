import { ApprovalItem } from '../models/approval.model';
import { EditObjectiveRequestPayloadDto } from '../models/dto/allocation-request.dto';
import { ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { WorkApprovalRequestDto } from '../models/dto/work-approval.dto';

const WORK_ACTION_LABELS: Record<string, string> = {
  'task.create': 'New task',
  'task.edit': 'Edit task',
  'task.delete': 'Delete task',
  'module.edit': 'Edit module',
  'module.delete': 'Delete module',
  'module.transfer': 'Transfer module',
  'module.achieve': 'Achieve module',
  'module.unachieve': 'Reopen module',
  'module.allocation_extend': 'More hours',
  'sprint.create': 'New sprint',
  'sprint.edit': 'Edit sprint',
  'sprint.start': 'Start sprint',
  'sprint.complete': 'Complete sprint',
  'sprint.achieve': 'Achieve sprint',
  'sprint.delete': 'Delete sprint',
};

export function toApprovalItem(dto: WorkApprovalRequestDto): ApprovalItem;
export function toApprovalItem(dto: ObjectiveInvitationDto): ApprovalItem;
export function toApprovalItem(dto: WorkApprovalRequestDto | ObjectiveInvitationDto): ApprovalItem {
  if ('actionType' in dto) {
    const request = dto as WorkApprovalRequestDto;
    // Payloads copied from the old objective_change_requests table may be PascalCase.
    const payload = safeParse(request.payloadJson);

    if (request.actionType === 'module.edit') {
      const edit: EditObjectiveRequestPayloadDto = {
        title: payload?.['title'] ?? payload?.['Title'] ?? request.targetTitle,
        description: payload?.['description'] ?? payload?.['Description'] ?? null,
        startDate: payload?.['startDate'] ?? payload?.['StartDate'] ?? '',
        endDate: payload?.['endDate'] ?? payload?.['EndDate'] ?? '',
        allocatedHours: payload?.['allocatedHours'] ?? payload?.['AllocatedHours'] ?? 0
      };
      return {
        id: request.id, kind: 'objective_edit', objectiveId: request.targetId ?? '', engine: true,
        title: `Edit: ${edit.title}`, description: edit.description ?? '', requestedByName: request.requestedByName,
        targetTitle: request.targetTitle, targetType: 'module', targetId: request.targetId,
        createdAt: request.createdAt, raw: { ...request, payload: edit }
      };
    }

    if (request.actionType === 'module.allocation_extend') {
      const hours: number = payload?.['requestedAdditionalHours'] ?? payload?.['RequestedAdditionalHours'] ?? 0;
      const reason: string = payload?.['reason'] ?? payload?.['Reason'] ?? '';
      return {
        id: request.id, kind: 'allocation_extend', objectiveId: request.targetId ?? '', engine: true,
        title: `+${hours}h requested`, description: reason, requestedByName: request.requestedByName,
        targetTitle: request.targetTitle, targetType: 'module', targetId: request.targetId,
        createdAt: request.createdAt, raw: { ...request, payload: { requestedAdditionalHours: hours, reason } }
      };
    }

    if (request.actionType.startsWith('module.')) {
      return {
        id: request.id, kind: 'objective_change', objectiveId: request.targetId ?? '', engine: true,
        title: `${WORK_ACTION_LABELS[request.actionType] ?? 'Change'}: ${request.targetTitle}`, description: WORK_ACTION_LABELS[request.actionType] ?? '',
        requestedByName: request.requestedByName, targetTitle: request.targetTitle, targetType: 'module',
        targetId: request.targetId, createdAt: request.createdAt, raw: request
      };
    }

    return {
      id: request.id,
      kind: 'work_approval',
      objectiveId: '',                       // already project-scoped by the endpoint
      title: `${WORK_ACTION_LABELS[request.actionType] ?? 'Change'}: ${request.targetTitle}`,
      // The row shows the target's title as its heading, so the action goes in the details line.
      description: WORK_ACTION_LABELS[request.actionType] ?? '',
      requestedByName: request.requestedByName,
      targetTitle: request.targetTitle,
      targetType: request.targetType === 'sprint' || request.targetType === 'project' ? 'request' : request.targetType,
      targetId: request.targetId,
      createdAt: request.createdAt,
      engine: true,
      raw: request
    };
  }

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

function safeParse(json: string | null | undefined): Record<string, any> | null {
  if (!json) return null;
  try { return JSON.parse(json) as Record<string, any>; } catch { return null; }
}
