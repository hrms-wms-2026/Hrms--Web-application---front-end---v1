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

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const buttonTexts = buttons.map((b) => b.textContent?.trim());

    expect(buttonTexts).not.toContain('Approve');
    expect(buttonTexts).not.toContain('Approve & Send Invite');
    expect(buttonTexts).not.toContain('Reject');
    expect(buttonTexts.every((t) => t === 'Continue Draft')).toBe(true);
  });

  it('shows the Continue Draft action when the caller holds employees:write', async () => {
    await setup([draft], true);
    const button = fixture.nativeElement.querySelector('button');
    expect(button?.textContent).toContain('Continue Draft');
  });

  it('hides the Continue Draft action without employees:write', async () => {
    await setup([draft], false);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('emits continueDraft with the draft id when clicked', async () => {
    await setup([draft], true);
    const emitted: string[] = [];
    fixture.componentInstance.continueDraft.subscribe((id) => emitted.push(id));

    fixture.nativeElement.querySelector('button')?.click();

    expect(emitted).toEqual(['draft-1']);
  });

  it('does not render Continue Draft for a finalized draft, and shows a disabled Finalized label instead', async () => {
    const finalizedDraft: DraftListItemResponse = { ...draft, id: 'draft-finalized', status: 'finalized', draftReason: 'invitation_sent' };
    await setup([finalizedDraft], true);

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('Continue Draft'))).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Finalized');
  });

  it('does not render Continue Draft for a draft whose reason is invitation_sent, even if status has not flipped yet', async () => {
    const inviteSentDraft: DraftListItemResponse = { ...draft, id: 'draft-invited', status: 'draft', draftReason: 'invitation_sent' };
    await setup([inviteSentDraft], true);

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('Continue Draft'))).toBe(false);
  });

  it('still renders Continue Draft for draft/waiting_for_seat/waiting_for_position_approval statuses when the caller holds employees:write', async () => {
    const draftStatus: DraftListItemResponse = { ...draft, id: 'draft-a', status: 'draft', draftReason: 'saved_manually' };
    const waitingForSeat: DraftListItemResponse = { ...draft, id: 'draft-b', status: 'waiting_for_seat', draftReason: 'waiting_for_seat' };
    const waitingForApproval: DraftListItemResponse = {
      ...draft,
      id: 'draft-c',
      status: 'waiting_for_position_approval',
      draftReason: 'waiting_for_position_approval'
    };
    await setup([draftStatus, waitingForSeat, waitingForApproval], true);

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButtons = buttons.filter((b) => b.textContent?.includes('Continue Draft'));
    expect(continueButtons.length).toBe(3);
  });
});
