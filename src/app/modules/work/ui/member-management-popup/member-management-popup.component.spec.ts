import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MemberManagementPopupComponent } from './member-management-popup.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('MemberManagementPopupComponent', () => {
  let fixture: ComponentFixture<MemberManagementPopupComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MemberManagementPopupComponent],
      providers: [
        { provide: PeopleApiService, useValue: { listEmployees: vi.fn().mockReturnValue(of({ items: [] })) } }
      ]
    });
    fixture = TestBed.createComponent(MemberManagementPopupComponent);
    fixture.componentRef.setInput('open', true);
  });

  it('renders project members and routes the add picker selection', () => {
    fixture.componentRef.setInput('scope', 'project');
    fixture.componentRef.setInput('projectMembers', [{ id: 'u1', name: 'Project Member' }]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="member-row"]').length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Project Member');
    expect(fixture.nativeElement.querySelector('[data-testid="add-member-button"]')).not.toBeNull();

    const addRequested = vi.fn();
    fixture.componentInstance.addRequested.subscribe(addRequested);
    (fixture.componentInstance as any).pickerOpen.set('member');
    fixture.componentInstance.onEmployeePicked('u2');

    expect(addRequested).toHaveBeenCalledWith('u2');
  });

  it('shows the add-member picker inline in the same dialog, not as a stacked second modal', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', []);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    (fixture.componentInstance as any).pickerOpen.set('member');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-modal').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="employee-picker-search"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Choose a person');
  });

  it('renders objective badges and routes remove and transfer actions', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', [
      { employeeId: 'e1', isHead: true, pending: false },
      { employeeId: 'e2', isHead: false, pending: true }
    ]);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="leader-badge"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="pending-tag"]')).not.toBeNull();

    const removeRequested = vi.fn();
    const transferRequested = vi.fn();
    fixture.componentInstance.removeRequested.subscribe(removeRequested);
    fixture.componentInstance.transferRequested.subscribe(transferRequested);
    (fixture.componentInstance as any).removeRequested.emit('e2');
    (fixture.componentInstance as any).pickerOpen.set('leader');
    fixture.componentInstance.onEmployeePicked('e3');

    expect(removeRequested).toHaveBeenCalledWith('e2');
    expect(transferRequested).toHaveBeenCalledWith('e3');
  });

  it('renders each objective member\'s name straight from the DTO, not a coverage-scoped directory lookup', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', [
      { employeeId: 'e1', name: 'Arun Kumar', isHead: true, pending: false },
      { employeeId: 'e2', name: null, isHead: false, pending: false }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Arun Kumar');
    expect(fixture.nativeElement.textContent).toContain('Unknown employee');
  });

  it('shows the objective name in the modal title when provided, and falls back to "Members" otherwise', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', []);
    fixture.componentRef.setInput('objectiveName', 'Backend Revamp');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Members — Backend Revamp');

    fixture.componentRef.setInput('objectiveName', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('h2')?.textContent?.trim()).toBe('Members');
  });

  it('shows Accept/Decline for my own pending invitation instead of the manager Cancel button', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', [
      { employeeId: 'e1', isHead: true, pending: false },
      { employeeId: 'me', isHead: false, pending: true, invitationId: 'inv-1' }
    ]);
    fixture.componentRef.setInput('currentEmployeeId', 'me');
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="accept-invitation-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="decline-invitation-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="remove-button"]')).toBeNull();

    const acceptRequested = vi.fn();
    const declineRequested = vi.fn();
    fixture.componentInstance.invitationAcceptRequested.subscribe(acceptRequested);
    fixture.componentInstance.invitationDeclineRequested.subscribe(declineRequested);

    fixture.nativeElement.querySelector('[data-testid="accept-invitation-button"]').click();
    fixture.nativeElement.querySelector('[data-testid="decline-invitation-button"]').click();

    expect(acceptRequested).toHaveBeenCalledWith('inv-1');
    expect(declineRequested).toHaveBeenCalledWith('inv-1');
  });

  it('still shows Cancel (not Accept/Decline) for a pending invitation you sent to someone else', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', [
      { employeeId: 'e2', isHead: false, pending: true, invitationId: 'inv-2' }
    ]);
    fixture.componentRef.setInput('currentEmployeeId', 'me');
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="remove-button"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="accept-invitation-button"]')).toBeNull();
  });
});
