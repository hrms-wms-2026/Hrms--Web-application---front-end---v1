import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApprovalExplanationCardComponent, buildEditedPayload, buildTimeline } from './approval-explanation-card.component';
import { ApprovalDetailDto, ApprovalFeedItemDto, ApprovalFieldDto } from '../../models/dto/approval-feed.dto';

function feedItem(overrides: Partial<ApprovalFeedItemDto> = {}): ApprovalFeedItemDto {
  return {
    id: 'r1', source: 'engine', actionType: 'task.edit', targetType: 'task', targetId: 't1', targetTitle: 'Audit',
    moduleId: 'm1', moduleTitle: 'Payments', projectName: 'Apollo', status: 'pending', direction: 'received',
    requestedById: 'e1', requestedByName: 'Bala', approverId: 'e2', approverName: 'Anu', decidedById: null,
    decidedByName: null, decisionComment: null, createdAt: '2026-09-29T10:24:00Z', decidedAt: null,
    canDecide: true, canCancel: false, commentCount: 0, summary: null, ...overrides
  };
}

const fields: ApprovalFieldDto[] = [
  { key: 'Title', label: 'Title', kind: 'text', current: 'Old', requested: 'A', applied: null, changed: true, editable: true },
  { key: 'Priority', label: 'Priority', kind: 'priority', current: 'high', requested: 'high', applied: null, changed: false, editable: true },
  { key: 'EstimatedHours', label: 'Estimated hours', kind: 'hours', current: '4', requested: '6', applied: null, changed: true, editable: true }
];

function detail(overrides: Partial<ApprovalDetailDto> = {}, item: Partial<ApprovalFeedItemDto> = {}): ApprovalDetailDto {
  return {
    item: feedItem(item), requestedPayloadJson: '{"Title":"A","Priority":"high","EstimatedHours":6}', appliedPayloadJson: null,
    fields, canEditPayload: true, note: 'client asked', currentAllocatedHours: null, invitation: null, ...overrides
  };
}

describe('buildEditedPayload', () => {
  it('keeps the stored PascalCase keys and converts hours to a number', () => {
    const json = buildEditedPayload('{"Title":"A","Priority":"High"}', fields, { Title: 'B', EstimatedHours: '7.5' });
    expect(JSON.parse(json!)).toEqual({ Title: 'B', Priority: 'High', EstimatedHours: 7.5 });
  });

  it('returns undefined without edits and null for a cleared value', () => {
    expect(buildEditedPayload('{"Title":"A"}', fields, {})).toBeUndefined();
    expect(JSON.parse(buildEditedPayload('{"Title":"A"}', fields, { Title: ' ' })!)).toEqual({ Title: null });
  });
});

describe('buildTimeline', () => {
  it('ends with the rejection and its reason', () => {
    const entries = buildTimeline(detail({}, {
      status: 'rejected', decidedByName: 'B', decisionComment: 'too big', decidedAt: '2026-09-30T00:00:00Z', canDecide: false
    }));
    expect(entries.map((e) => e.text)).toEqual(['Requested by Bala', 'Rejected by B — too big']);
  });

  it('says "Approved with changes" when an edited payload was applied', () => {
    const entries = buildTimeline(detail({ appliedPayloadJson: '{"Title":"B"}' }, { status: 'approved', decidedByName: 'Anu' }));
    expect(entries[1].text).toBe('Approved with changes by Anu');
  });

  it('uses invitation wording', () => {
    const entries = buildTimeline(detail({}, { source: 'invitation', status: 'approved', decidedByName: 'Chen' }));
    expect(entries.map((e) => e.text)).toEqual(['Invited by Bala', 'Accepted by Chen']);
  });
});

describe('ApprovalExplanationCardComponent', () => {
  let fixture: ComponentFixture<ApprovalExplanationCardComponent>;
  let el: HTMLElement;
  const q = (id: string) => el.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  function render(d: ApprovalDetailDto): void {
    fixture.componentRef.setInput('detail', d);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ApprovalExplanationCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(ApprovalExplanationCardComponent);
    el = fixture.nativeElement;
  });

  it('shows Current / Requested and highlights changed rows', () => {
    render(detail());

    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-testid="approval-card-field"]'));
    expect(rows.map((r) => r.dataset['key'])).toEqual(['Title', 'Priority', 'EstimatedHours']);
    expect(rows[0].classList).toContain('approval-card__row--changed');
    expect(rows[1].classList).not.toContain('approval-card__row--changed');
    expect(rows[2].textContent).toContain('4h');
    expect(q('approval-card-note')!.textContent).toContain('client asked');
    expect(el.textContent).toContain('Update task details');
    // Only Current and Requested - no separate "Approve value" / "Approved" column.
    expect(el.textContent).not.toContain('Approve value');
  });

  it('the Requested value is the editable input for the approver', () => {
    render(detail());
    const input = q('approval-edit-Title') as HTMLInputElement;
    expect(input.value).toBe('A');
    expect(q('approval-card-requested')).toBeNull();
  });

  it('a longtext field (e.g. Description) gets an editable textarea too', () => {
    const withDescription = [...fields, { key: 'Description', label: 'Description', kind: 'longtext' as const, current: null, requested: 'Driver soak harness notes', applied: null, changed: true, editable: true }];
    render(detail({ fields: withDescription, requestedPayloadJson: '{"Title":"A","Description":"Driver soak harness notes"}' }));

    const textarea = q('approval-edit-Description') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('Driver soak harness notes');

    textarea.value = 'Updated notes';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.approve.subscribe((v: string | undefined) => emitted.push(v));
    q('approval-card-approve')?.click();
    expect(JSON.parse(emitted[0]!)).toEqual({ Title: 'A', Description: 'Updated notes' });
  });

  it('once decided the Requested value is read-only and shows what was applied', () => {
    render(detail({ canEditPayload: false, fields: fields.map((f) => ({ ...f, editable: false })) }));
    expect(q('approval-edit-Title')).toBeNull();
    expect(q('approval-card-requested')!.textContent!.trim()).toBe('A');

    render(detail({ canEditPayload: false, appliedPayloadJson: '{"Title":"B"}', fields: fields.map((f) => ({ ...f, editable: false, applied: f.key === 'Title' ? 'B' : null })) },
      { status: 'approved', canDecide: false }));
    expect(q('approval-edit-Title')).toBeNull();
    expect(q('approval-card-requested')!.textContent!.trim()).toBe('B');
    expect(q('approval-card-originally')!.textContent).toContain('Requested A');
  });

  it('Approve emits the edited payload; without edits it emits undefined', () => {
    render(detail());
    const emitted: (string | undefined)[] = [];
    fixture.componentInstance.approve.subscribe((v) => emitted.push(v));

    q('approval-card-approve')!.click();
    const input = q('approval-edit-Title') as HTMLInputElement;
    input.value = 'B';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q('approval-card-approve')!.click();

    expect(emitted[0]).toBeUndefined();
    expect(JSON.parse(emitted[1]!)).toEqual({ Title: 'B', Priority: 'high', EstimatedHours: 6 });
  });

  it('an invalid hours value shows an inline error and does not emit', () => {
    render(detail());
    let emitted = false;
    fixture.componentInstance.approve.subscribe(() => (emitted = true));

    const input = q('approval-edit-EstimatedHours') as HTMLInputElement;
    input.value = '0';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    q('approval-card-approve')!.click();
    fixture.detectChanges();

    expect(emitted).toBe(false);
    expect(q('approval-edit-error-EstimatedHours')!.textContent).toContain('greater than zero');
  });

  it('Reject opens the reminder dialog and "Reject without reason" emits null', () => {
    render(detail());
    const reasons: (string | null)[] = [];
    fixture.componentInstance.reject.subscribe((r) => reasons.push(r));

    q('approval-card-reject')!.click();
    fixture.detectChanges();
    expect(q('approval-reject-dialog')).not.toBeNull();
    (q('approval-reject-without-reason')!.querySelector('button') ?? q('approval-reject-without-reason')!).click();
    fixture.detectChanges();

    expect(reasons).toEqual([null]);
    expect(q('approval-reject-dialog')).toBeNull();
  });

  it("a requester's pending row shows only Cancel request", () => {
    render(detail({ canEditPayload: false }, { direction: 'sent', canDecide: false, canCancel: true }));
    let cancelled = false;
    fixture.componentInstance.cancelRequest.subscribe(() => (cancelled = true));

    expect(q('approval-card-approve')).toBeNull();
    expect(q('approval-card-reject')).toBeNull();
    q('approval-card-cancel')!.click();
    expect(cancelled).toBe(true);
  });

  it('a decided row has no footer', () => {
    render(detail({ canEditPayload: false }, { status: 'approved', canDecide: false }));
    expect(q('approval-card-footer')).toBeNull();
  });

  it('an invitation shows the invitation block and Accept / Decline', () => {
    render(detail({
      fields: [], canEditPayload: false, note: null, requestedPayloadJson: null,
      invitation: {
        inviteeId: 'e3', inviteeName: 'Chen', inviteType: 'leader', invitedById: 'e1', invitedByName: 'Bala',
        moduleId: 'm1', moduleTitle: 'Payments', expiresAt: null
      }
    }, { source: 'invitation', actionType: 'module.invitation', targetType: 'module' }));

    expect(q('approval-card-invitation')!.textContent).toContain('Chen');
    expect(q('approval-card-invitation')!.textContent).toContain('leader');
    expect(q('approval-card-approve')!.textContent!.trim()).toBe('Accept');
    expect(q('approval-card-reject')!.textContent!.trim()).toBe('Decline');
    expect(q('approval-card-changes')).toBeNull();
  });

  it('allocation rows show the before/after line and update it live', () => {
    render(detail({
      currentAllocatedHours: 200,
      requestedPayloadJson: '{"requestedAdditionalHours":50,"reason":"scope"}',
      fields: [{ key: 'requestedAdditionalHours', label: 'Additional hours', kind: 'hours', current: null, requested: '50', applied: null, changed: true, editable: true }]
    }, { actionType: 'module.allocation_extend', targetType: 'module' }));

    expect(q('approval-card-allocation')!.textContent).toContain('250h');
    const input = q('approval-edit-requestedAdditionalHours') as HTMLInputElement;
    input.value = '20';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('approval-card-allocation')!.textContent).toContain('220h');
  });

  it('close emits closed', () => {
    render(detail());
    let closed = false;
    fixture.componentInstance.closed.subscribe(() => (closed = true));
    q('approval-card-close')!.click();
    expect(closed).toBe(true);
  });
});
