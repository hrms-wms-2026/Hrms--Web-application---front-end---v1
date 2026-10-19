import { InboxFilterFieldDto, InboxItemDto } from '../models/inbox.dto';
import {
  inboxIconTone,
  inboxMenuItems,
  inboxStatusLabel,
  inboxStatusTone,
  inboxSubtitle,
  inboxTitle,
  inboxTypeMeta,
  toFilterFields
} from './inbox-item.util';

function item(extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'work', kind: 'approval', id: 'a1', category: 'request', actionType: 'task.edit', title: 'Audit events', subtitle: 'Edit title',
    status: 'pending', direction: 'received', severity: null, contextType: 'project', contextId: 'p1', contextName: 'Apollo',
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: { id: 'e2', name: 'Anu' }, createdAt: '2026-10-13T08:00:00Z',
    updatedAt: '2026-10-13T08:00:00Z', availableActions: [], unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

describe('inbox item util', () => {
  it('titles requests by action and alerts by rule', () => {
    expect(inboxTitle(item())).toBe('Update task details');
    expect(inboxTitle(item({ kind: 'invitation', actionType: 'module.invitation' }))).toBe('Add member to module');
    expect(inboxTitle(item({ category: 'alert', kind: 'monitor_alert', actionType: 'monitor.task_overdue' }))).toBe('Task past its due date');
    expect(inboxTitle(item({ source: 'leave', kind: 'request', actionType: 'leave.request' }))).toBe('Audit events');
  });

  it('subtitles with the target and its summary', () => {
    expect(inboxSubtitle(item())).toBe('Audit events · Edit title');
    expect(inboxSubtitle(item({ subtitle: null }))).toBe('Audit events');
  });

  it('maps type meta for requests, invitations and alerts', () => {
    expect(inboxTypeMeta(item({ actionType: 'task.create' })).icon).toBe('task-plus');
    expect(inboxTypeMeta(item({ actionType: 'module.invitation' })).label).toBe('Module Invitation');
    expect(inboxTypeMeta(item({ category: 'alert', actionType: 'monitor.module_over_capacity', severity: 'high' }))).toEqual({ label: 'Alert', tone: 'danger', icon: 'alert' });
    expect(inboxTypeMeta(item({ category: 'alert', actionType: 'monitor.x', severity: 'medium' })).tone).toBe('warning');
  });

  it('labels statuses per kind', () => {
    expect(inboxStatusLabel(item())).toBe('Pending');
    expect(inboxStatusLabel(item({ kind: 'invitation', status: 'approved' }))).toBe('Accepted');
    expect(inboxStatusLabel(item({ kind: 'invitation', status: 'rejected' }))).toBe('Declined');
    expect(inboxStatusLabel(item({ status: 'stale' }))).toBe('Outdated');
    expect(inboxStatusLabel(item({ category: 'alert', status: 'open' }))).toBe('Open');
    expect(inboxStatusLabel(item({ category: 'alert', status: 'resolved' }))).toBe('Resolved');
  });

  it('colours live tickets by state and finished ones gray', () => {
    expect(inboxStatusTone(item())).toBe('warning');
    expect(inboxStatusTone(item({ status: 'in_progress' }))).toBe('info');
    expect(inboxStatusTone(item({ category: 'alert', status: 'open', severity: 'medium' }))).toBe('accent');
    expect(inboxStatusTone(item({ category: 'alert', status: 'open', severity: 'critical' }))).toBe('danger');
    expect(inboxStatusTone(item({ category: 'alert', status: 'acknowledged' }))).toBe('info');
    for (const status of ['approved', 'rejected', 'cancelled', 'resolved']) {
      expect(inboxStatusTone(item({ status, isPending: false }))).toBe('neutral');
    }
    const alert = item({ category: 'alert', status: 'open', severity: 'medium' });
    expect(inboxIconTone(alert, inboxTypeMeta(alert))).toBe('warning');
    expect(inboxIconTone(item(), inboxTypeMeta(item()))).toBe('warning');
    expect(inboxIconTone(item({ status: 'approved', isPending: false }), inboxTypeMeta(item()))).toBe('neutral');
  });

  it('builds the row menu from the item actions; reject is never a one-click menu entry', () => {
    const menu = inboxMenuItems(item({
      availableActions: [
        { key: 'approve', label: 'Approve', tone: 'primary', needsComment: false, needsPayload: false },
        { key: 'reject', label: 'Reject', tone: 'danger', needsComment: true, needsPayload: false },
        { key: 'cancel', label: 'Cancel request', tone: 'neutral', needsComment: false, needsPayload: false }
      ]
    }), true);

    expect(menu.map((m) => m.id)).toEqual(['view', 'action:approve', 'action:cancel', 'open', 'copy']);
    expect(inboxMenuItems(item(), false).map((m) => m.id)).toEqual(['view', 'copy']);
  });

  it('leaves actions that need a comment or an edited payload to the card dialogs (e.g. the leave full/partial cancel)', () => {
    const menu = inboxMenuItems(item({
      source: 'leave', kind: 'request',
      availableActions: [
        { key: 'approve', label: 'Approve', tone: 'primary', needsComment: false, needsPayload: true },
        { key: 'cancel', label: 'Cancel request', tone: 'danger', needsComment: true, needsPayload: false }
      ]
    }), true);

    expect(menu.map((m) => m.id)).toEqual(['view', 'open', 'copy']);
  });

  it('turns provider filter fields into filter-bar fields with icons', () => {
    const fields: InboxFilterFieldDto[] = [
      { key: 'project', label: 'Project', multi: true, options: [{ value: 'p1', label: 'Apollo' }] },
      { key: 'requestedBy', label: 'Requested by', multi: true, options: [] },
      { key: 'module', label: 'Module', multi: true, options: [{ value: 'm1', label: 'Payments' }] },
      { key: 'odd', label: 'Odd', multi: false, options: [{ value: 'x', label: 'X' }] },
      { key: 'direction', label: 'Direction', multi: true, options: [{ value: 'sent', label: 'Sent' }] }
    ];

    const result = toFilterFields(fields);

    expect(result.map((f) => [f.key, f.icon, f.kind])).toEqual([
      ['project', 'category', 'multi'], ['module', 'module', 'multi'], ['odd', 'type', 'single'], ['requestedOn', 'calendar', 'single']
    ]);
    expect(result.find((f) => f.key === 'requestedOn')?.defaultValues).toEqual(['any']);
  });
});

describe('inbox item util for non-WM kinds (FS1)', () => {
  const leave = item({ source: 'leave', kind: 'request', actionType: 'annual', title: 'Annual leave - Pat Doe', subtitle: '13 Oct – 15 Oct' });
  const descriptor = { source: 'leave', kind: 'request', label: 'Leave request', category: 'request' as const, capabilities: 0, detailRenderer: null };

  it('titles by the item itself and labels by the kind descriptor', () => {
    expect(inboxTitle(leave)).toBe('Annual leave - Pat Doe');
    expect(inboxSubtitle(leave)).toBe('13 Oct – 15 Oct');
    expect(inboxTypeMeta(leave, descriptor).label).toBe('Leave request');
    expect(inboxTypeMeta(leave).label).toBe('Request');
  });

  it('alerts of other sources keep the alert look but their own title', () => {
    const alert = item({ source: 'attendance', kind: 'alert', category: 'alert', actionType: 'late_clock_ins', title: 'Late clock-in - Pat', severity: 'warning' });
    expect(inboxTitle(alert)).toBe('Late clock-in - Pat');
    expect(inboxTypeMeta(alert, { ...descriptor, source: 'attendance', kind: 'alert', label: 'Attendance alert', category: 'alert' }))
      .toEqual({ label: 'Attendance alert', tone: 'warning', icon: 'alert' });
  });

  it('humanizes statuses it has no label for instead of calling them outdated', () => {
    expect(inboxStatusLabel({ ...leave, status: 'on_hold' })).toBe('On hold');
    expect(inboxStatusLabel({ ...leave, status: 'approved' })).toBe('Approved');
    expect(inboxStatusLabel({ ...leave, category: 'alert', status: 'excused' })).toBe('Excused');
    expect(inboxStatusLabel({ ...leave, category: 'alert', status: 'acknowledged' })).toBe('Acknowledged');
  });
});
