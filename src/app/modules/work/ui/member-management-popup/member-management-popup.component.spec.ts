import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { MemberManagementPopupComponent } from './member-management-popup.component';

describe('MemberManagementPopupComponent', () => {
  let fixture: ComponentFixture<MemberManagementPopupComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MemberManagementPopupComponent] });
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
      { employeeId: 'e1', name: 'Employee One', avatarUrl: null, isHead: true, pending: false },
      { employeeId: 'e2', name: 'Employee Two', avatarUrl: null, isHead: false, pending: true }
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

  it('renders the member avatar image when an objective member has an avatarUrl', () => {
    fixture.componentRef.setInput('scope', 'objective');
    fixture.componentRef.setInput('objectiveMembers', [
      { employeeId: 'e1', name: 'Employee One', avatarUrl: 'https://api.test/employees/e1/avatar', isHead: false, pending: false }
    ]);
    fixture.detectChanges();

    const img = fixture.nativeElement.querySelector('.avatar__image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://api.test/employees/e1/avatar');
  });
});
