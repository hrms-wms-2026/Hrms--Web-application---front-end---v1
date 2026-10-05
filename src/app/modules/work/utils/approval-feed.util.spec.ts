import {
  APPROVAL_TYPE_META,
  approvalMenuItems,
  approvalSubtitle,
  approvalTitle,
  approvalTypeKey,
  buildApprovalFilterFields,
  matchesApprovalFilters,
  sortFeed,
  statusLabel
} from './approval-feed.util';
import { ApprovalFeedItemDto } from '../models/dto/approval-feed.dto';

const base: ApprovalFeedItemDto = {
  id: '1', source: 'engine', actionType: 'task.edit', targetType: 'task', targetId: 't', targetTitle: 'T',
  moduleId: 'm1', moduleTitle: 'M1', projectName: 'P', status: 'pending', direction: 'received',
  requestedById: 'e1', requestedByName: 'A', approverId: 'e2', approverName: 'B', decidedById: null, decidedByName: null,
  decisionComment: null, createdAt: '2026-09-29T10:00:00Z', decidedAt: null, canDecide: true, canCancel: false,
  commentCount: 0, summary: null
};

describe('approval-feed.util', () => {
  it('maps action types to type keys', () => {
    expect(approvalTypeKey('task.create')).toBe('task_creation');
    expect(approvalTypeKey('task.edit')).toBe('task_update');
    expect(approvalTypeKey('task.delete')).toBe('task_deletion');
    expect(approvalTypeKey('module.allocation_extend')).toBe('allocation');
    expect(approvalTypeKey('module.invitation')).toBe('invitation');
    expect(approvalTypeKey('module.edit')).toBe('module_update');
    expect(approvalTypeKey('sprint.start')).toBe('sprint');
    expect(approvalTypeKey('project.status_template_change')).toBe('status_template');
    expect(APPROVAL_TYPE_META['allocation'].label).toBe('Allocation');
  });

  it('builds titles, subtitles and status labels', () => {
    expect(approvalTitle(base)).toBe('Update task details');
    expect(approvalTitle({ ...base, actionType: 'something.new' })).toBe('Request');
    expect(approvalSubtitle(base)).toBe('T');
    expect(approvalSubtitle({ ...base, summary: '+5h - scope' })).toBe('T · +5h - scope');
    expect(statusLabel({ ...base, status: 'approved' })).toBe('Approved');
    expect(statusLabel({ ...base, source: 'invitation', status: 'approved' })).toBe('Accepted');
    expect(statusLabel({ ...base, source: 'invitation', status: 'rejected' })).toBe('Declined');
    expect(statusLabel({ ...base, source: 'invitation', status: 'stale' })).toBe('Expired');
    expect(statusLabel({ ...base, status: 'stale' })).toBe('Outdated');
  });

  it('sorts pending first, then newest first', () => {
    const rows = sortFeed([
      { ...base, id: 'old-decided', status: 'approved', createdAt: '2026-09-30T00:00:00Z' },
      { ...base, id: 'old-pending', createdAt: '2026-09-01T00:00:00Z' },
      { ...base, id: 'new-pending', createdAt: '2026-09-29T00:00:00Z' }
    ]);
    expect(rows.map((r) => r.id)).toEqual(['new-pending', 'old-pending', 'old-decided']);
  });

  it('filters by type, status, direction, module, requester and date window', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    expect(matchesApprovalFilters(base, { type: ['task_update'] }, now)).toBe(true);
    expect(matchesApprovalFilters(base, { type: ['allocation'] }, now)).toBe(false);
    expect(matchesApprovalFilters(base, { status: ['approved'] }, now)).toBe(false);
    expect(matchesApprovalFilters(base, { direction: ['sent'] }, now)).toBe(false);
    expect(matchesApprovalFilters(base, { direction: ['all'] }, now)).toBe(true);
    expect(matchesApprovalFilters(base, { module: ['m1'] }, now)).toBe(true);
    expect(matchesApprovalFilters(base, { requestedBy: ['e9'] }, now)).toBe(false);
    expect(matchesApprovalFilters(base, { requestedOn: ['7'] }, now)).toBe(true);
    expect(matchesApprovalFilters(base, { requestedOn: ['any'] }, now)).toBe(true);
    expect(matchesApprovalFilters({ ...base, createdAt: '2026-08-01T00:00:00Z' }, { requestedOn: ['7'] }, now)).toBe(false);
  });

  it('builds filter fields from the loaded rows only', () => {
    const fields = buildApprovalFilterFields([base]);
    expect(fields.map((f) => f.key)).toEqual(['direction', 'type', 'status', 'module', 'requestedBy', 'requestedOn']);
    expect(fields.find((f) => f.key === 'module')!.options).toEqual([{ value: 'm1', label: 'M1' }]);
    expect(fields.find((f) => f.key === 'type')!.options).toEqual([{ value: 'task_update', label: 'Task Update' }]);
  });
});

describe('approvalMenuItems', () => {
  it('offers Approve for a decidable row and never Reject', () => {
    const menu = approvalMenuItems(base);
    expect(menu.map((m) => m.id)).toEqual(['view', 'approve', 'open', 'copy']);
    expect(menu.some((m) => m.id === 'reject' || /reject|decline/i.test(m.label))).toBe(false);

    const sent = approvalMenuItems({ ...base, canDecide: false, canCancel: true, direction: 'sent' });
    expect(sent.map((m) => m.label)).toEqual(['View details', 'Open task', 'Cancel request', 'Copy link']);

    const decided = approvalMenuItems({ ...base, status: 'approved', targetType: 'project', targetId: null });
    expect(decided.map((m) => m.id)).toEqual(['view', 'copy']);
  });

  it('an invitation row offers Accept and Open module', () => {
    const menu = approvalMenuItems({ ...base, source: 'invitation', actionType: 'module.invitation', targetType: 'module' });
    expect(menu.map((m) => m.label)).toEqual(['View details', 'Accept', 'Open module', 'Copy link']);
  });
});
