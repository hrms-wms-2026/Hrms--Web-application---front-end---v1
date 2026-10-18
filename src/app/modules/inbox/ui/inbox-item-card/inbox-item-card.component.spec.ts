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

  it('shows the summary, status, steps and change set; the explanation opens from its collapsed header', () => {
    const { fixture, el } = render(detail());

    expect(el.querySelector('[data-testid="inbox-card-title"]')?.textContent).toContain('Update task details');
    expect(el.querySelector('[data-testid="inbox-card-status"]')?.textContent).toContain('Pending');
    expect(el.querySelectorAll('[data-testid="inbox-step"]')).toHaveLength(2);
    expect(el.querySelector('[data-testid="inbox-change-set"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="inbox-card-explanation"]')).toBeNull();

    (el.querySelector('[data-testid="inbox-card-explanation-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="inbox-card-explanation"]')?.textContent).toContain('Typo in the title');
  });

  it('says when there is no explanation, and Hide asks the page to collapse the panel', () => {
    const { fixture, el } = render(detail({ explanation: null }));
    const hidden = vi.fn();
    fixture.componentInstance.hide.subscribe(hidden);

    (el.querySelector('[data-testid="inbox-card-explanation-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('No explanation was given for this ticket.');

    (el.querySelector('[data-testid="inbox-card-hide"]') as HTMLButtonElement).click();
    expect(hidden).toHaveBeenCalled();
  });

  it('shows a loading state and an error', () => {
    expect(render(null, { loading: true }).el.textContent).toContain('Loading');
    TestBed.resetTestingModule();
    expect(render(null, { error: 'Inbox item not found.' }).el.querySelector('[role="alert"]')?.textContent).toContain('Inbox item not found.');
  });

  it('renders one button per available action and approves with the approver edits', () => {
    const { fixture, el, actions } = render(detail({}, { availableActions: [APPROVE, REJECT] }));
    const input = el.querySelector('[data-testid="inbox-edit-title"]') as HTMLInputElement;
    input.value = 'Newer';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).click();

    expect(Array.from(el.querySelectorAll('[data-testid^="inbox-action-"]')).map((b) => b.getAttribute('data-testid')))
      .toEqual(['inbox-action-reject', 'inbox-action-approve']);
    expect(actions).toEqual([{ key: 'approve', body: { editedPayloadJson: '{"title":"Newer"}' } }]);
  });

  it('does not offer editing when the item has no editable payload', () => {
    const { el } = render(detail({ editablePayloadJson: null }, { availableActions: [APPROVE] }));
    expect(el.querySelector('[data-testid="inbox-edit-title"]')).toBeNull();
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

  it('opens the target and disables actions while busy', () => {
    const { fixture, el } = render(detail({}, { availableActions: [APPROVE] }), { busy: true });
    const targets: unknown[] = [];
    fixture.componentInstance.openTarget.subscribe((t) => targets.push(t));

    (el.querySelector('[data-testid="inbox-card-open-target"]') as HTMLButtonElement).click();

    expect(targets).toEqual([{ route: ['/work', 'p1', 'board'], label: 'Open task', queryParams: { taskId: 't1' } }]);
    expect((el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an alert explanation with its details and no decision buttons', () => {
    const { el } = render(detail(
      { changeSet: [], editablePayloadJson: null, explanation: 'Over capacity by 40h', explanationDetails: { allocatedHours: '100', requiredHours: '140' } },
      { category: 'alert', kind: 'monitor_alert', actionType: 'monitor.module_over_capacity', status: 'open', direction: 'info', severity: 'high',
        availableActions: [{ key: 'open_target', label: 'Open', tone: 'neutral', needsComment: false, needsPayload: false }] }));

    expect(el.querySelector('[data-testid="inbox-card-title"]')?.textContent).toContain('Module over capacity');
    expect(el.querySelector('[data-testid="inbox-card-details"]')?.textContent).toContain('140');
    expect(el.querySelector('[data-testid^="inbox-action-"]')).toBeNull();
  });

  it('shows the action error', () => {
    const { el } = render(detail(), { actionError: 'Only the approver can decide.' });
    expect(el.querySelector('[data-testid="inbox-card-action-error"]')?.textContent).toContain('Only the approver can decide.');
  });
});
