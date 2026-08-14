import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObjectiveMembersPopupComponent } from './objective-members-popup.component';
import { ObjectiveMemberItemDto } from '../../models/dto/objective-invitation.dto';

describe('ObjectiveMembersPopupComponent', () => {
  let fixture: ComponentFixture<ObjectiveMembersPopupComponent>;

  const members: ObjectiveMemberItemDto[] = [
    { employeeId: 'head1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' },
    { employeeId: 'mem1', isHead: false, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-02' },
    { employeeId: 'pend1', isHead: false, pending: true, inviteType: 'member', invitationId: 'inv1', sinceOrInvitedAt: '2026-01-03' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ObjectiveMembersPopupComponent] }).compileComponents();
    fixture = TestBed.createComponent(ObjectiveMembersPopupComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
  });

  it('renders a row per member, tagging pending ones "Request pending"', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    expect(rows.length).toBe(3);
    const pendingRow = Array.from(rows).find((r: any) => r.dataset.employeeId === 'pend1') as HTMLElement;
    expect(pendingRow.querySelector('[data-testid="pending-tag"]')!.textContent!.trim()).toBe('Request pending');
  });

  it('marks the head row with a Leader badge', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const headRow = Array.from(rows).find((r: any) => r.dataset.employeeId === 'head1') as HTMLElement;
    expect(headRow.querySelector('[data-testid="leader-badge"]')).not.toBeNull();
  });

  it('emits removeRequested with the row userId when its remove button is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.removeRequested.subscribe(spy);

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const memberRow = Array.from(rows).find((r: any) => r.dataset.employeeId === 'mem1') as HTMLElement;
    (memberRow.querySelector('[data-testid="remove-button"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('mem1');
  });

  it('does not render remove/transfer actions when canManage is false', () => {
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="remove-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="transfer-button"]')).toBeNull();
  });

  it('does not render a remove button on the head row (transfer is the only way to move headship)', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const headRow = Array.from(rows).find((r: any) => r.dataset.employeeId === 'head1') as HTMLElement;
    expect(headRow.querySelector('[data-testid="remove-button"]')).toBeNull();
  });
});
