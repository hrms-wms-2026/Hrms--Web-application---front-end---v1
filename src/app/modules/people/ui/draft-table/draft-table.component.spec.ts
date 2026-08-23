import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { DraftListItemResponse } from '../../models/onboarding-draft.model';
import { DraftTableComponent } from './draft-table.component';

describe('DraftTableComponent', () => {
  let fixture: ComponentFixture<DraftTableComponent>;

  const draft: DraftListItemResponse = {
    id: 'draft-1',
    displayName: 'Ada Lovelace',
    positionName: 'Software Engineer',
    departmentName: 'Engineering',
    status: 'waiting_for_seat',
    draftReason: 'waiting_for_seat',
    lastSavedStep: 'employee_details',
    startedByName: 'HR Starter'
  };

  async function setup(drafts: readonly DraftListItemResponse[], hasPermission: boolean) {
    await TestBed.configureTestingModule({
      imports: [DraftTableComponent],
      providers: [{ provide: PermissionService, useValue: { hasPermission: () => hasPermission, hasAnyPermission: () => hasPermission } }]
    }).compileComponents();

    fixture = TestBed.createComponent(DraftTableComponent);
    fixture.componentRef.setInput('drafts', drafts);
    fixture.detectChanges();
  }

  it('renders the empty state when there are no drafts', async () => {
    await setup([], true);
    expect(fixture.nativeElement.textContent).toContain('No drafts');
  });

  it('displays displayName and does not use employeeName', async () => {
    await setup([draft], true);
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
  });

  it('translates draft status and new reason codes to display text, never rendering the raw snake_case code', async () => {
    const approvalPendingDraft: DraftListItemResponse = {
      ...draft,
      id: 'draft-pending',
      status: 'waiting_for_position_approval',
      draftReason: 'waiting_for_position_approval'
    };
    const rejectedDraft: DraftListItemResponse = { ...draft, id: 'draft-2', status: 'draft', draftReason: 'position_approval_rejected' };
    const seatConfigDraft: DraftListItemResponse = { ...draft, id: 'draft-3', draftReason: 'seat_configuration_required' };
    const inviteSentDraft: DraftListItemResponse = { ...draft, id: 'draft-4', draftReason: 'invitation_sent' };

    await setup([draft, approvalPendingDraft, rejectedDraft, seatConfigDraft, inviteSentDraft], true);
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Draft');
    expect(text).toContain('Waiting for position approval');
    expect(text).toContain('Position approval rejected');
    expect(text).toContain('Waiting for seat');
    expect(text).toContain('Seat configuration required');
    expect(text).toContain('Invitation sent');
    expect(text).not.toContain('waiting_for_seat');
    expect(text).not.toContain('waiting_for_position_approval');
    expect(text).not.toContain('position_approval_rejected');
    expect(text).not.toContain('seat_configuration_required');
    expect(text).not.toContain('invitation_sent');
  });

  it('does not render fake Approve or Reject buttons without accessGrantRequestId for approval-pending or rejected drafts', async () => {
    const approvalPendingDraft: DraftListItemResponse = {
      ...draft,
      id: 'draft-pending',
      status: 'waiting_for_position_approval',
      draftReason: 'waiting_for_position_approval'
    };
    const rejectedDraft: DraftListItemResponse = {
      ...draft,
      id: 'draft-rejected',
      status: 'draft',
      draftReason: 'position_approval_rejected'
    };

    await setup([approvalPendingDraft, rejectedDraft], true);

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Approve');
    expect(text).not.toContain('Reject');
  });

  it('emits continueDraft with the draft id when row is clicked and caller holds employees:write', async () => {
    await setup([draft], true);
    const emitted: string[] = [];
    fixture.componentInstance.continueDraft.subscribe((id) => emitted.push(id));

    const row = fixture.nativeElement.querySelector('.draft-row') as HTMLTableRowElement;
    row?.click();

    expect(emitted).toEqual(['draft-1']);
  });

  it('does not emit continueDraft when row is clicked if caller lacks employees:write', async () => {
    await setup([draft], false);
    const emitted: string[] = [];
    fixture.componentInstance.continueDraft.subscribe((id) => emitted.push(id));

    const row = fixture.nativeElement.querySelector('.draft-row') as HTMLTableRowElement;
    row?.click();

    expect(emitted).toEqual([]);
  });

  it('does not emit continueDraft for a finalized draft', async () => {
    const finalizedDraft: DraftListItemResponse = { ...draft, id: 'draft-finalized', status: 'finalized', draftReason: 'invitation_sent' };
    await setup([finalizedDraft], true);
    const emitted: string[] = [];
    fixture.componentInstance.continueDraft.subscribe((id) => emitted.push(id));

    const row = fixture.nativeElement.querySelector('.draft-row') as HTMLTableRowElement;
    row?.click();

    expect(emitted).toEqual([]);
  });
});
