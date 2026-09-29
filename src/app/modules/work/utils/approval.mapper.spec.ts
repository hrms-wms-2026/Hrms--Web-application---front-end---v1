import { toApprovalItem } from './approval.mapper';
import { WorkApprovalRequestDto } from '../models/dto/work-approval.dto';

function dto(overrides: Partial<WorkApprovalRequestDto> = {}): WorkApprovalRequestDto {
  return {
    id: 'w1', projectId: 'p1', actionType: 'task.edit', targetType: 'task', targetId: 't-1',
    targetTitle: 'Fix login', status: 'pending', requestedByEmployeeId: 'e1', requestedByName: 'Sam Lee',
    approverEmployeeId: 'e2', approverName: 'Owner', payloadJson: '{}', decisionComment: null,
    createdAt: '2026-09-28T00:00:00Z', decidedAt: null, ...overrides
  };
}

describe('toApprovalItem (work approvals)', () => {
  it('maps WorkApprovalRequestDto to kind work_approval with title "<label>: <targetTitle>" and targetType/targetId from the dto', () => {
    const item = toApprovalItem(dto());

    expect(item.kind).toBe('work_approval');
    expect(item.title).toBe('Edit task: Fix login');
    expect(item.targetType).toBe('task');
    expect(item.targetId).toBe('t-1');
    expect(item.requestedByName).toBe('Sam Lee');
    expect(item.objectiveId).toBe('');
  });

  it('labels create and delete requests, and a create has no target yet', () => {
    expect(toApprovalItem(dto({ actionType: 'task.create', targetId: null })).title).toBe('New task: Fix login');
    expect(toApprovalItem(dto({ actionType: 'task.create', targetId: null })).targetId).toBeNull();
    expect(toApprovalItem(dto({ actionType: 'task.delete' })).title).toBe('Delete task: Fix login');
  });

  it('treats sprint and project targets as a plain request (no module/task link)', () => {
    expect(toApprovalItem(dto({ targetType: 'project', actionType: 'project.status_template_change' })).targetType).toBe('request');
    expect(toApprovalItem(dto({ targetType: 'sprint', actionType: 'sprint.edit' })).title).toBe('Change: Fix login');
  });
});
