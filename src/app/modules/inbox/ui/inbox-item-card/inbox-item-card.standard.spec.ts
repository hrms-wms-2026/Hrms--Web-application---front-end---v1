import { Component, Type, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InboxCapability, InboxItemDetailDto, InboxItemDto, InboxKindDescriptorDto } from '../../models/inbox.dto';
import { INBOX_DETAIL_RENDERERS } from '../../renderers/inbox-detail-renderers';
import { InboxCardAction, InboxItemCardComponent } from './inbox-item-card.component';

/** FS1: the card renders every kind from its actions + descriptor (dialogs, edit form, revert banner, renderers). */

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
    item: item(itemExtra), steps: [], summary: null,
    changeSet: [{ field: 'title', label: 'Title', before: 'Old', after: 'New', kind: 'text', editable: true, applied: null }],
    explanation: 'Typo in the title', explanationDetails: null, target: null, editablePayloadJson: '{"title":"New"}', ...extra
  };
}

const APPROVE = { key: 'approve', label: 'Approve', tone: 'primary' as const, needsComment: false, needsPayload: false };

describe('InboxItemCardComponent (FS1 standard)', () => {
  function render(d: InboxItemDetailDto, extra: Record<string, unknown> = {}, renderers: Record<string, Type<unknown>> = {}) {
    TestBed.configureTestingModule({
      imports: [InboxItemCardComponent],
      providers: [{ provide: INBOX_DETAIL_RENDERERS, useValue: renderers }]
    });
    const fixture = TestBed.createComponent(InboxItemCardComponent);
    fixture.componentRef.setInput('detail', d);
    for (const [k, v] of Object.entries(extra)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const actions: InboxCardAction[] = [];
    fixture.componentInstance.action.subscribe((a) => actions.push(a));
    const q = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const click = (id: string) => { ((q(id)?.querySelector('button') ?? q(id)) as HTMLButtonElement).click(); fixture.detectChanges(); };
    return { fixture, el: fixture.nativeElement as HTMLElement, actions, q, click };
  }

  afterEach(() => TestBed.resetTestingModule());

  const ALERT_RESOLVE = {
    key: 'resolve', label: 'Resolve', tone: 'primary' as const, needsComment: false, needsPayload: true,
    meta: { outcomes: 'excused,confirmed,convert_to_leave' }
  };
  const alertDetail = detail({
    changeSet: [
      { field: 'outcome', label: 'Outcome', before: null, after: 'confirmed', kind: 'select', editable: true, applied: null },
      { field: 'leaveTypeId', label: 'Leave type', before: null, after: null, kind: 'select', editable: true, applied: null,
        options: [{ value: 'lt1', label: 'Annual leave' }] }
    ],
    editablePayloadJson: null
  }, { source: 'attendance', kind: 'alert', category: 'alert', actionType: 'absent_days', title: 'Absent - Pat', availableActions: [ALERT_RESOLVE] });

  it('resolve opens the outcome picker with the action outcomes and the leave types of the change set', () => {
    const { fixture, q, click, actions } = render(alertDetail);

    click('inbox-action-resolve');
    expect(q('inbox-outcome-dialog')).not.toBeNull();
    click('inbox-outcome-convert_to_leave');
    (q('inbox-outcome-leave-type')?.querySelector('[data-testid="select-trigger"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    const options = Array.from(document.querySelectorAll('[data-testid="select-panel"] [data-testid="select-option"]')) as HTMLButtonElement[];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Annual leave']);
    expect(q('inbox-outcome-leave-hint')?.textContent).toContain('balance');
    options[0].click();
    fixture.detectChanges();
    click('inbox-outcome-confirm');

    expect(actions).toEqual([{ key: 'resolve', body: { outcome: 'convert_to_leave', comment: null, leaveTypeId: 'lt1' } }]);
  });

  it('an alert change set is not an approve form', () => {
    expect(render(alertDetail).el.querySelector('[data-testid="inbox-edit-outcome"]')).toBeNull();
  });

  it('escalate opens the escalate dialog with the target preview and sends the note as the comment', () => {
    const escalate = { key: 'escalate', label: 'Escalate', tone: 'danger' as const, needsComment: true, needsPayload: false, meta: { escalateTo: 'Maya' } };
    const { q, click, actions } = render(detail({}, { availableActions: [escalate] }));

    click('inbox-action-escalate');
    expect(q('inbox-escalate-target')?.textContent).toContain('Maya');
    expect(q('inbox-comment-dialog')).toBeNull();
    click('inbox-escalate-confirm');

    expect(actions).toEqual([{ key: 'escalate', body: { comment: null } }]);
  });

  it('forward opens the forward dialog naming the recipient', () => {
    const forward = { key: 'forward', label: 'Send to Anu', tone: 'neutral' as const, needsComment: false, needsPayload: false, meta: { forwardTo: 'Anu', forwardToId: 'e9' } };
    const { q, click, actions } = render(detail({}, { availableActions: [forward] }));

    click('inbox-action-forward');
    expect(q('inbox-forward-dialog')?.textContent).toContain('Send to Anu');
    click('inbox-forward-confirm');

    expect(actions).toEqual([{ key: 'forward', body: { comment: null } }]);
  });

  it('a revert with a deadline shows the undo banner instead of a footer button, and undo asks to confirm', () => {
    const until = new Date(Date.now() + 10 * 60_000).toISOString();
    const revert = { key: 'revert', label: 'Undo', tone: 'neutral' as const, needsComment: false, needsPayload: false, meta: { revertableUntil: until } };
    const { fixture, el, q, click, actions } = render(detail({}, { status: 'approved', isPending: false, availableActions: [revert] }));

    expect(el.querySelector('[data-testid="inbox-action-revert"]')).toBeNull();
    expect(q('inbox-revert-banner')).not.toBeNull();
    click('inbox-revert-undo');
    expect(actions).toEqual([]);
    fixture.componentInstance['onRevertConfirmed']();

    expect(actions).toEqual([{ key: 'revert', body: {} }]);
  });

  it('approvals are editable when the kind declares edit-before-approve, even without a payload', () => {
    const leave = detail({
      editablePayloadJson: null,
      changeSet: [{ field: 'startAt', label: 'From', before: null, after: '2026-10-13T09:00:00.000Z', kind: 'datetime', editable: true, applied: null }]
    }, { source: 'leave', kind: 'request', actionType: 'annual', availableActions: [APPROVE] });
    const descriptor: InboxKindDescriptorDto = {
      source: 'leave', kind: 'request', label: 'Leave request', category: 'request', capabilities: InboxCapability.EditBeforeApprove, detailRenderer: null
    };

    expect(render(leave).el.querySelector('[data-testid="inbox-edit-startAt"]')).toBeNull();
    TestBed.resetTestingModule();
    const { el, fixture, actions } = render(leave, { descriptor });
    const input = el.querySelector('[data-testid="inbox-edit-startAt"]') as HTMLInputElement;
    input.value = '2026-10-14T10:00';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (el.querySelector('[data-testid="inbox-action-approve"]') as HTMLButtonElement).click();

    expect(el.querySelector('.card__eyebrow')?.textContent).toContain('Leave request');
    expect(actions).toEqual([{ key: 'approve', body: { editedPayloadJson: JSON.stringify({ startAt: new Date('2026-10-14T10:00').toISOString() }) } }]);
  });

  it('a validation error from the server shows above the form, not in the footer', () => {
    const { el } = render(detail({}, { availableActions: [APPROVE] }), { actionError: 'Overlaps another leave.', actionErrorInline: true });
    expect(el.querySelector('[data-testid="inbox-card-inline-error"]')?.textContent).toContain('Overlaps another leave.');
    expect(el.querySelector('[data-testid="inbox-card-action-error"]')).toBeNull();
  });

  it('renders the kind detail renderer with the parsed extra payload, else the default view', () => {
    @Component({ selector: 'app-test-renderer', standalone: true, template: `<p data-testid="test-renderer">{{ extra()?.['balance'] }}</p>` })
    class TestRendererComponent {
      extra = input<Record<string, unknown> | null>(null);
      detail = input<InboxItemDetailDto | null>(null);
    }
    const descriptor: InboxKindDescriptorDto = {
      source: 'leave', kind: 'request', label: 'Leave request', category: 'request', capabilities: 0, detailRenderer: 'leave-request'
    };
    const withExtra = detail({ extraJson: '{"balance":"12h"}' });

    const { el } = render(withExtra, { descriptor }, { 'leave-request': TestRendererComponent });
    expect(el.querySelector('[data-testid="test-renderer"]')?.textContent).toContain('12h');
    expect(el.querySelector('[data-testid="inbox-card-renderer"]')?.textContent).toContain('Additional information');

    TestBed.resetTestingModule();
    const fallback = render(withExtra, { descriptor: { ...descriptor, detailRenderer: 'unknown' } }).el;
    expect(fallback.querySelector('[data-testid="inbox-card-renderer"]')).toBeNull();
    expect(fallback.querySelector('[data-testid="inbox-card-explanation-toggle"]')).not.toBeNull();
  });

  // ---- FL: leave ---------------------------------------------------------------------------------

  const leaveRange = [
    { field: 'startAt', label: 'From', before: null, after: '2026-10-20T09:00:00Z', kind: 'datetime', editable: false, applied: null },
    { field: 'endAt', label: 'To', before: null, after: '2026-10-21T17:00:00Z', kind: 'datetime', editable: false, applied: null },
    { field: 'total_hours', label: 'Total', before: null, after: '16', kind: 'hours', editable: false, applied: null }
  ];

  it('change decision asks approve or reject and sends it as the decision', () => {
    const change = { key: 'change_decision', label: 'Change decision', tone: 'neutral' as const, needsComment: true, needsPayload: true };
    const { fixture, q, click, actions } = render(detail({ changeSet: leaveRange }, { source: 'leave', kind: 'request', status: 'approved', isPending: false, availableActions: [change] }));

    click('inbox-action-change_decision');
    expect(q('inbox-outcome-approve')).not.toBeNull();
    click('inbox-outcome-reject');
    const note = q('inbox-outcome-note') as HTMLTextAreaElement;
    note.value = 'Cover fell through';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    click('inbox-outcome-confirm');

    expect(actions).toEqual([{ key: 'change_decision', body: { decision: 'reject', comment: 'Cover fell through' } }]);
  });

  it('cancelling a leave with a date range uses the full/partial leave cancel dialog', () => {
    const cancel = { key: 'cancel', label: 'Cancel request', tone: 'danger' as const, needsComment: true, needsPayload: false };
    const { fixture, actions } = render(detail({ changeSet: leaveRange }, { source: 'leave', kind: 'request', title: 'Annual leave - Pat', availableActions: [cancel] }));

    (fixture.nativeElement.querySelector('[data-testid="inbox-action-cancel"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(document.body.textContent).toContain('Are you sure you want to cancel this leave request?');
    expect(document.querySelector('[data-testid="inbox-comment-dialog"]')).toBeNull();

    (fixture.componentInstance as unknown as { onLeaveCancel(c: { reason: string | null; effectiveDate: string | null; expectedVersion: null }): void })
      .onLeaveCancel({ reason: 'Plans changed', effectiveDate: '2026-10-21', expectedVersion: null });
    expect(actions).toEqual([{ key: 'cancel', body: { comment: 'Plans changed', effectiveDate: '2026-10-21' } }]);
  });
});
