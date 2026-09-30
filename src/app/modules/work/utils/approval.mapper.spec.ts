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
    expect(toApprovalItem(dto({ targetType: 'sprint', actionType: 'sprint.edit' })).targetType).toBe('request');
  });

  it('sprint.start → kind work_approval titled "Start sprint: <name>"', () => {
    const item = toApprovalItem(dto({ targetType: 'sprint', actionType: 'sprint.start', targetTitle: 'Sprint 4' }));

    expect(item.kind).toBe('work_approval');
    expect(item.title).toBe('Start sprint: Sprint 4');
    expect(item.engine).toBe(true);
  });
});

describe('toApprovalItem (module requests from the engine)', () => {
  const moduleDto = (overrides: Partial<WorkApprovalRequestDto>) => dto({
    targetType: 'module', targetId: 'm-1', targetTitle: 'Payments', ...overrides
  });

  it('module.edit engine dto → kind objective_edit with raw.payload = parsed edit fields (camelCase)', () => {
    const item = toApprovalItem(moduleDto({
      actionType: 'module.edit',
      payloadJson: JSON.stringify({ title: 'Payments v2', description: null, startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15 })
    }));

    expect(item.kind).toBe('objective_edit');
    expect(item.engine).toBe(true);
    expect(item.objectiveId).toBe('m-1');
    expect(item.title).toBe('Edit: Payments v2');
    expect((item.raw as { payload: unknown }).payload).toEqual(
      { title: 'Payments v2', description: null, startDate: '2026-01-10', endDate: '2026-02-10', allocatedHours: 15 });
  });

  it('module.edit engine dto → reads legacy PascalCase payloads too', () => {
    const item = toApprovalItem(moduleDto({
      actionType: 'module.edit',
      payloadJson: JSON.stringify({ Title: 'Legacy', Description: 'd', StartDate: '2026-01-01', EndDate: '2026-02-01', AllocatedHours: 9 })
    }));

    expect((item.raw as { payload: unknown }).payload).toEqual(
      { title: 'Legacy', description: 'd', startDate: '2026-01-01', endDate: '2026-02-01', allocatedHours: 9 });
  });

  it('module.allocation_extend → kind allocation_extend with raw.payload.requestedAdditionalHours', () => {
    const item = toApprovalItem(moduleDto({
      actionType: 'module.allocation_extend', payloadJson: JSON.stringify({ RequestedAdditionalHours: 8, Reason: 'Finish integration' })
    }));

    expect(item.kind).toBe('allocation_extend');
    expect(item.title).toBe('+8h requested');
    expect(item.description).toBe('Finish integration');
    expect((item.raw as { payload: unknown }).payload).toEqual({ requestedAdditionalHours: 8, reason: 'Finish integration' });
  });

  it('module.allocation_extend carries the current allocated hours of its module from the inbox row', () => {
    const item = toApprovalItem(moduleDto({ actionType: 'module.allocation_extend', payloadJson: '{}', currentAllocatedHours: 120 }));

    expect(item.currentAllocatedHours).toBe(120);
  });

  it('module.achieve → kind objective_change', () => {
    const item = toApprovalItem(moduleDto({ actionType: 'module.achieve' }));

    expect(item.kind).toBe('objective_change');
    expect(item.title).toBe('Achieve module: Payments');
    expect(item.description).toBe('Achieve module'); // the row shows it as its details line
    expect(item.targetType).toBe('module');
  });
});
