import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { ObjectiveMembersPopupComponent } from './objective-members-popup.component';
import { ObjectiveMemberItemDto } from '../../models/dto/objective-invitation.dto';
import { EmployeePickerComponent } from '../employee-picker/employee-picker.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';

describe('ObjectiveMembersPopupComponent', () => {
  let fixture: ComponentFixture<ObjectiveMembersPopupComponent>;

  const members: ObjectiveMemberItemDto[] = [
    { employeeId: 'head1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' },
    { employeeId: 'mem1', isHead: false, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-02' },
    { employeeId: 'pend1', isHead: false, pending: true, inviteType: 'member', invitationId: 'inv1', sinceOrInvitedAt: '2026-01-03' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectiveMembersPopupComponent],
      providers: [{
        provide: PeopleApiService,
        useValue: { listEmployees: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 20 })) }
      }]
    }).compileComponents();
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

  it('opens the employee picker when + Add member is clicked', () => {
    (fixture.nativeElement.querySelector('[data-testid="add-member-button"]') as HTMLElement).click();
    fixture.detectChanges();

    const picker = fixture.debugElement.query(By.directive(EmployeePickerComponent));
    expect(picker.componentInstance.open()).toBe(true);
    expect(fixture.componentInstance.pickerOpen()).toBe('member');
  });

  it('re-emits the picker selection as addRequested in member mode', () => {
    const spy = vi.fn();
    fixture.componentInstance.addRequested.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="add-member-button"]') as HTMLElement).click();
    fixture.detectChanges();

    const picker = fixture.debugElement.query(By.directive(EmployeePickerComponent));
    picker.componentInstance.selected.emit('e9');

    expect(spy).toHaveBeenCalledWith('e9');
    expect(fixture.componentInstance.pickerOpen()).toBeNull();
  });

  it('re-emits the picker selection as transferRequested in leader mode', () => {
    const spy = vi.fn();
    fixture.componentInstance.transferRequested.subscribe(spy);

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const memberRow = Array.from(rows).find((r: any) => r.dataset.employeeId === 'mem1') as HTMLElement;
    (memberRow.querySelector('[data-testid="transfer-button"]') as HTMLElement).click();
    fixture.detectChanges();

    const picker = fixture.debugElement.query(By.directive(EmployeePickerComponent));
    expect(picker.componentInstance.open()).toBe(true);
    picker.componentInstance.selected.emit('e8');

    expect(spy).toHaveBeenCalledWith('e8');
    expect(fixture.componentInstance.pickerOpen()).toBeNull();
  });
});
