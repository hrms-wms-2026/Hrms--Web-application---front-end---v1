import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyInvitationsPanelComponent } from './my-invitations-panel.component';
import { ObjectiveInvitationDto } from '../../models/dto/objective-invitation.dto';

describe('MyInvitationsPanelComponent', () => {
  let fixture: ComponentFixture<MyInvitationsPanelComponent>;

  const invitations: ObjectiveInvitationDto[] = [
    { id: 'i1', projectId: 'p1', objectiveId: 'o1', invitedEmployeeId: 'u1', inviteType: 'leader', status: 'pending', invitedById: 'u2', decidedAt: null, createdAt: '2026-01-01' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MyInvitationsPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(MyInvitationsPanelComponent);
    fixture.componentRef.setInput('invitations', invitations);
    fixture.detectChanges();
  });

  it('renders one row per invitation with its type', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="invitation-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('leader');
  });

  it('emits acceptRequested with the invitation id', () => {
    const spy = vi.fn();
    fixture.componentInstance.acceptRequested.subscribe(spy);

    fixture.nativeElement.querySelector('[data-testid="accept-button"]').click();

    expect(spy).toHaveBeenCalledWith('i1');
  });

  it('emits rejectRequested with the invitation id', () => {
    const spy = vi.fn();
    fixture.componentInstance.rejectRequested.subscribe(spy);

    fixture.nativeElement.querySelector('[data-testid="reject-button"]').click();

    expect(spy).toHaveBeenCalledWith('i1');
  });

  it('renders nothing when there are no invitations', () => {
    fixture.componentRef.setInput('invitations', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="invitations-panel"]')).toBeNull();
  });
});
