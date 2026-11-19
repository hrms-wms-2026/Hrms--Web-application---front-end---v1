import { TestBed } from '@angular/core/testing';
import { InboxItemDetailDto, InboxItemDto } from '../../models/inbox.dto';
import { InboxItemCardComponent, InboxCardAction } from './inbox-item-card.component';

function item(extra: Partial<InboxItemDto> = {}): InboxItemDto {
  return {
    source: 'work', kind: 'approval', id: 'a1', category: 'request', actionType: 'task.edit', title: 'Audit events', subtitle: 'Edit title',
    status: 'pending', direction: 'received', severity: null, contextType: 'project', contextId: 'p1', contextName: 'Apollo',
    requestedBy: { id: 'e1', name: 'Bala' }, requestedTo: { id: 'e2', name: 'Anu' }, createdAt: '2026-10-13T08:00:00Z',
    updatedAt: '2026-10-13T08:00:00Z', availableActions: [], unreadMessages: 0, isPending: true, facets: {}, ...extra
  };
}

function detail(extra: Partial<InboxItemDetailDto> = {}, itemExtra: Partial<InboxItemDto> = {}): InboxItemDetailDto {
  return {
    item: item(itemExtra),
    steps: [
      { key: 'requested', label: 'Requested', actor: { id: 'e1', name: 'Bala' }, at: '2026-10-13T08:00:00Z', state: 'done', note: null },
      { key: 'decision', label: 'Waiting for Anu', actor: { id: 'e2', name: 'Anu' }, at: null, state: 'current', note: null }
    ],
    summary: 'Edit title', changeSet: [{ field: 'title', label: 'Title', before: 'Old', after: 'New', kind: 'text', editable: true, applied: null }],
    explanation: 'Typo in the title', explanationDetails: null,
    target: { route: ['/work', 'p1', 'board'], label: 'Open task', queryParams: { taskId: 't1' } }, editablePayloadJson: '{"title":"New"}',
    ...extra
  };
}

const APPROVE = { key: 'approve', label: 'Approve', tone: 'primary' as const, needsComment: false, needsPayload: false };
const REJECT = { key: 'reject', label: 'Reject', tone: 'danger' as const, needsComment: true, needsPayload: false };
const REVERT = { key: 'revert', label: 'Revert decision', tone: 'neutral' as const, needsComment: false, needsPayload: false };

describe('InboxItemCardComponent', () => {
  function render(d: InboxItemDetailDto | null, extra: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({ imports: [InboxItemCardComponent] });
    const fixture = TestBed.createComponent(InboxItemCardComponent);
    fixture.componentRef.setInput('detail', d);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const actions: InboxCardAction[] = [];
    fixture.componentInstance.action.subscribe((a) => actions.push(a));
    return { fixture, el: fixture.nativeElement as HTMLElement, actions };
  }

  it('shows the summary, status and steps; the change set lives in the chat, not here', () => {
    const { el } = render(detail());

    expect(el.querySelector('[data-testid="inbox-card-title"]')?.textContent).toContain('Update task details');
    expect(el.querySelector('[data-testid="inbox-card-status"]')?.textContent).toContain('Pending');
    expect(el.querySelectorAll('[data-testid="inbox-step"]')).toHaveLength(2);
    expect(el.querySelector('[data-testid="inbox-change-set"]')).toBeNull();
    expect(el.textContent).not.toContain('Explanation');
  });

  it('has no facts block (status, type, people, dates) and no open-target link: the header and sections carry it', () => {
    const { el } = render(detail());

    expect(el.querySelector('[data-testid="inbox-card-project"]')).toBeNull();
    expect(el.querySelector('[data-testid="inbox-card-open-target"]')).toBeNull();
    expect(el.textContent).not.toContain('Requested by');
    expect(el.textContent).not.toContain('Requested to');
    expect(el.textContent).not.toContain('Severity');
  });

  it('shows a loading state and an error', () => {
    expect(render(null, { loading: true }).el.textContent).toContain('Loading');
    TestBed.resetTestingModule();
    expect(render(null, { error: 'Inbox item not found.' }).el.querySelector('[role="alert"]')?.textContent).toContain('Inbox item not found.');
  });

  it('renders one button per available action and approves with the approver edits', () => {
    const { fixture, el, actions } = render(detail({}, { availableActions: [APPROVE, REJECT] }));
    // The chat's changes message reports the edits to the card.
    expect(fixture.componentInstance.canEdit()).toBe(true);
    fixture.componentInstance.setEdits({ title: 'Newer' });
    fixture.detectChanges();

    (el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).click();

    expect(Array.from(el.querySelectorAll('[data-testid^="inbox-action-"]')).map((b) => b.getAttribute('data-testid')))
      .toEqual(['inbox-action-reject', 'inbox-action-approve']);
    expect(actions).toEqual([{ key: 'approve', body: { editedPayloadJson: '{"title":"Newer"}' } }]);
  });

  it('does not offer editing when the item has no editable payload', () => {
    const { fixture } = render(detail({ editablePayloadJson: null }, { availableActions: [APPROVE] }));
    expect(fixture.componentInstance.canEdit()).toBe(false);
  });

  it('asks for a comment before a comment action and sends it', () => {
    const { fixture, el, actions } = render(detail({}, { availableActions: [REJECT] }));

    (el.querySelector('[data-testid="inbox-action-reject"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const dialog = document.querySelector('[data-testid="inbox-comment-dialog"]');
    expect(dialog).not.toBeNull();
    fixture.componentInstance['onCommentConfirmed']('Not now');

    expect(actions).toEqual([{ key: 'reject', body: { comment: 'Not now' } }]);
  });

  it('confirms before reverting a decision', () => {
    const { fixture, el, actions } = render(detail({}, { status: 'approved', isPending: false, availableActions: [REVERT] }));

    (el.querySelector('[data-testid="inbox-action-revert"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(actions).toEqual([]);
    fixture.componentInstance['onRevertConfirmed']();

    expect(actions).toEqual([{ key: 'revert', body: {} }]);
  });

  it('disables actions while busy', () => {
    const { el } = render(detail({}, { availableActions: [APPROVE] }), { busy: true });
    expect((el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a late clock-in as Attendance details and its Outcome, without the deduction facts', () => {
    const { el } = render(detail({
      changeSet: [
        { field: 'signal', label: 'Alert', before: null, after: 'Late clock-in', kind: 'text', editable: false, applied: null },
        { field: 'work_date', label: 'Day', before: null, after: '2026-10-12', kind: 'date', editable: false, applied: null },
        { field: 'clock_in', label: 'Clocked in', before: null, after: '9:20 AM', kind: 'text', editable: false, applied: null },
        { field: 'expected_in', label: 'Expected', before: null, after: '9:00 AM', kind: 'text', editable: false, applied: null },
        { field: 'minutes', label: 'Late by', before: null, after: '20 min', kind: 'text', editable: false, applied: null },
        { field: 'outcome', label: 'Outcome', before: null, after: 'confirmed', kind: 'select', editable: true, applied: null,
          options: [{ value: 'excused', label: 'Excused - stop counting it' }, { value: 'confirmed', label: 'Confirmed - keep counting it' }] }
      ],
      editablePayloadJson: null, explanation: null, explanationDetails: null, target: null,
      facts: [{ label: 'Deducted', value: '0.5 h from Annual Leave' }]
    }, { source: 'attendance', kind: 'alert', category: 'alert', status: 'open', direction: 'received' }));

    const details = el.querySelector('[data-testid="inbox-card-details"]')!;
    expect(details.querySelector('h4')!.textContent).toBe('Attendance details');
    expect(Array.from(details.querySelectorAll('[data-testid="inbox-card-detail-row"]'))
      .map((r) => `${r.querySelector('dt')!.textContent!.trim()} ${r.querySelector('dd')!.textContent!.trim()}`))
      .toEqual(['Scheduled start 9:00 AM', 'Actual clock-in 9:20 AM', 'Delay 20 min']);
    expect(el.querySelector('[data-testid="inbox-card-outcome"]')!.textContent).toContain('Confirmed - keep counting it');
    expect(el.textContent).not.toContain('Deducted');
    expect(el.querySelector('[data-testid="inbox-card-steps"] h4')!.textContent).toBe('Request steps');
  });

  it('shows a leave as Request details with the employee note, and no approval note', () => {
    const { el } = render(detail({
      steps: [
        { key: 'submitted', label: 'Submitted', actor: { id: 'e1', name: 'Bala' }, at: '2026-10-10T10:00:00Z', state: 'done', note: null },
        { key: 'approver:1', label: 'Approved', actor: { id: 'e2', name: 'Anu' }, at: '2026-10-11T10:00:00Z', state: 'done', note: 'Approved for the demo.' }
      ],
      changeSet: [
        { field: 'leave_type', label: 'Leave type', before: null, after: 'Annual Leave', kind: 'text', editable: false, applied: null },
        { field: 'startAt', label: 'From', before: null, after: '2026-10-15T09:00:00', kind: 'datetime', editable: false, applied: null },
        { field: 'endAt', label: 'To', before: null, after: '2026-10-15T17:00:00', kind: 'datetime', editable: false, applied: null },
        { field: 'total_hours', label: 'Total', before: null, after: '8', kind: 'hours', editable: false, applied: null },
        { field: 'reason', label: 'Reason', before: null, after: 'Personal matters.', kind: 'text', editable: false, applied: null }
      ],
      editablePayloadJson: null, explanation: 'Personal matters.', target: null
    }, { source: 'leave', kind: 'request', status: 'approved', isPending: false, title: 'Annual Leave approved' }));

    const rows = Array.from(el.querySelectorAll('[data-testid="inbox-card-detail-row"] dt')).map((r) => r.textContent!.trim());
    expect(rows).toEqual(['Leave type', 'Date', 'Duration', 'Requested on', 'Approved on']);
    expect(el.querySelector('[data-testid="inbox-card-details"]')!.textContent).toContain('8 hours');
    expect(el.querySelector('[data-testid="inbox-card-decided"]')!.textContent).toContain('Approved on');
    const note = el.querySelector('[data-testid="inbox-card-note"]')!;
    expect(note.textContent).toContain("Employee's note");
    expect(note.textContent).toContain('Personal matters.');
    expect(note.textContent).not.toContain('Approval note');
  });

  it('shows a monitor alert with its reason and labelled evidence, no raw keys and no decision buttons', () => {
    const { el } = render(detail(
      {
        changeSet: [], editablePayloadJson: null,
        explanation: '220 h of work remain, but the team can produce only 200 h before the Oct 16 deadline.',
        explanationDetails: {
          endDate: '2026-10-16', expectedFinish: '2026-10-19', lateDays: '1', remainingHours: '220', capacityHours: '200',
          shortfallHours: '20', memberCount: '5', employeeId: '7f0c2c1e-0000-0000-0000-000000000000', somethingNew: 'x'
        }
      },
      { category: 'alert', kind: 'monitor_alert', actionType: 'monitor.module_capacity_shortfall', title: 'Hardware integration portal',
        status: 'open', direction: 'info', severity: 'high',
        availableActions: [{ key: 'open_target', label: 'Open', tone: 'neutral', needsComment: false, needsPayload: false }] }));

    expect(el.querySelector('[data-testid="inbox-card-title"]')?.textContent).toContain('Milestone cannot finish in time');
    expect(el.querySelector('[data-testid="inbox-card-description"]')?.textContent).toContain('220 h of work remain');
    const details = el.querySelector('[data-testid="inbox-card-details"]')!;
    expect(details.querySelector('h4')!.textContent).toBe('Evidence & details');
    expect(Array.from(details.querySelectorAll('[data-testid="inbox-card-detail-row"]'))
      .map((r) => `${r.querySelector('dt')!.textContent!.trim()}: ${r.querySelector('dd')!.textContent!.trim()}`))
      .toEqual([
        'Milestone: Hardware integration portal', 'Project: Apollo', 'Deadline: Oct 16, 2026', 'Expected finish: Oct 19, 2026',
        'Late by: 1 working day', 'Work remaining: 220 hours', 'Time available: 200 hours', 'Short by: 20 hours', 'Team size: 5 people'
      ]);
    expect(el.textContent).not.toContain('employeeId');
    expect(el.textContent).not.toContain('somethingNew');
    expect(el.textContent).not.toContain('Additional information');
    expect(el.querySelector('[data-testid^="inbox-action-"]')).toBeNull();
  });

  it('does not repeat a request explanation as the header description', () => {
    expect(render(detail()).el.querySelector('[data-testid="inbox-card-description"]')).toBeNull();
  });

  it('renders no per-kind Additional information block; only the exception evidence keeps its slot', () => {
    const descriptor = (detailRenderer: string) =>
      ({ source: 'attendance', kind: 'alert', label: 'Attendance alert', category: 'alert', capabilities: 0, detailRenderer });
    const alert = detail({ changeSet: [], editablePayloadJson: null, explanation: null, explanationDetails: null },
      { category: 'alert', kind: 'alert', status: 'open', direction: 'received' });

    const attendance = render(alert, { descriptor: descriptor('attendance-alert') }).el;
    expect(attendance.querySelector('[data-testid="inbox-card-renderer"]')).toBeNull();
    expect(attendance.textContent).not.toContain('Additional information');

    TestBed.resetTestingModule();
    const evidence = render(alert, { descriptor: descriptor('exception-evidence') }).el;
    expect(evidence.querySelector('[data-testid="inbox-card-renderer"]')).not.toBeNull();
  });

  it('shows the action error', () => {
    const { el } = render(detail(), { actionError: 'Only the approver can decide.' });
    expect(el.querySelector('[data-testid="inbox-card-action-error"]')?.textContent).toContain('Only the approver can decide.');
  });
});
