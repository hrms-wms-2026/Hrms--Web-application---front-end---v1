import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { EmployeeLeavePolicyApiService } from '../../../leave/data-access/employee-leave-policy-api.service';
import { LeavePolicyApiService } from '../../../leave/data-access/leave-policy-api.service';
import { EmployeeLeavePolicyRow, LeavePolicyListItem } from '../../../leave/models/leave-policy.model';
import { EmployeeLeavePoliciesComponent } from './employee-leave-policies.component';

const rows: EmployeeLeavePolicyRow[] = [
  { leaveTypeId: 't-annual', leaveTypeName: 'Annual Leave', leaveTypeColor: '#2563EB', policyId: 'p-company', policyName: 'Annual - company', sourceKind: 'legal_entity', sourceName: 'Dapi Technologies', amountHours: 8, amountPeriod: 'month', isOverride: false },
  { leaveTypeId: 't-sick', leaveTypeName: 'Sick Leave', leaveTypeColor: '#16A34A', policyId: 'p-mine', policyName: 'Sick - senior', sourceKind: 'employee', sourceName: 'Priya Nair', amountHours: 80, amountPeriod: 'year', isOverride: true },
  { leaveTypeId: 't-casual', leaveTypeName: 'Casual Leave', leaveTypeColor: '#475569', policyId: null, policyName: null, sourceKind: null, sourceName: null, amountHours: null, amountPeriod: null, isOverride: false }
];

const policies: LeavePolicyListItem[] = [
  { id: 'p-company', name: 'Annual - company', leaveTypeId: 't-annual', leaveTypeName: 'Annual Leave', leaveTypeColor: '#2563EB', amountHours: 8, amountPeriod: 'month', currentVersionNumber: 1, nextVersionEffectiveFrom: null, assignmentCount: 1, assignedToSummary: [], isActive: true },
  { id: 'p-senior', name: 'Annual - senior', leaveTypeId: 't-annual', leaveTypeName: 'Annual Leave', leaveTypeColor: '#2563EB', amountHours: 12, amountPeriod: 'month', currentVersionNumber: 1, nextVersionEffectiveFrom: null, assignmentCount: 0, assignedToSummary: [], isActive: true },
  { id: 'p-sick', name: 'Sick - senior', leaveTypeId: 't-sick', leaveTypeName: 'Sick Leave', leaveTypeColor: '#16A34A', amountHours: 80, amountPeriod: 'year', currentVersionNumber: 1, nextVersionEffectiveFrom: null, assignmentCount: 1, assignedToSummary: [], isActive: true }
];

describe('EmployeeLeavePoliciesComponent', () => {
  let api: { list: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> };

  async function render(canChange: boolean): Promise<ComponentFixture<EmployeeLeavePoliciesComponent>> {
    api = { list: vi.fn(() => of(rows)), set: vi.fn(() => of(undefined)), reset: vi.fn(() => of(undefined)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeLeavePolicyApiService, useValue: api },
        { provide: LeavePolicyApiService, useValue: { list: vi.fn(() => of(policies)) } },
        { provide: PermissionService, useValue: { hasAnyPermission: () => canChange, hasPermission: () => canChange } },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeLeavePoliciesComponent);
    fixture.componentRef.setInput('employeeId', 'e1');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return fixture;
  }

  it('shows each leave type with its policy, source and amount', async () => {
    const text = (await render(true)).nativeElement.textContent as string;
    expect(text).toContain('Annual - company');
    expect(text).toContain('Company');
    expect(text).toContain('8 h / month');
    expect(text).toContain('Employee');
    expect(text).toContain('No policy');
  });

  it('offers Assign for a type without a policy and Reset only for overrides', async () => {
    const fixture = await render(true);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="change-policy"]');
    expect(Array.from(buttons).map((b) => b.textContent?.trim())).toEqual(['Change', 'Change', 'Assign']);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="reset-policy"]').length).toBe(1);
  });

  it('hides every action without permission', async () => {
    const fixture = await render(false);
    expect(fixture.nativeElement.querySelector('[data-testid="change-policy"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="reset-policy"]')).toBeNull();
  });

  it('only offers policies of the row\'s leave type and saves the choice', async () => {
    const fixture = await render(true);
    const c = fixture.componentInstance;
    await c.openChange(rows[0]);
    expect(c.policyOptions().map((o) => o.value)).toEqual(['p-company', 'p-senior']);
    expect(c.policyOptions()[1].label).toBe('Annual - senior — 12 h / month');
    c.selectedPolicyId.set('p-senior');
    await c.saveChange();
    expect(api.set).toHaveBeenCalledWith('e1', 't-annual', 'p-senior');
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('resets an override after confirmation', async () => {
    const fixture = await render(true);
    const c = fixture.componentInstance;
    c.askReset(rows[1]);
    await c.confirmReset();
    expect(api.reset).toHaveBeenCalledWith('e1', 't-sick');
  });

  it('ignores a late answer for the previous employee', async () => {
    const slow = new Subject<EmployeeLeavePolicyRow[]>();
    const fixture = await render(true);
    api.list.mockImplementation((id: string) => id === 'e-old' ? slow : of([rows[2]]));
    fixture.componentRef.setInput('employeeId', 'e-old');
    fixture.detectChanges();
    fixture.componentRef.setInput('employeeId', 'e-new');
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    slow.next(rows);
    slow.complete();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.componentInstance.rows().map((r) => r.leaveTypeId)).toEqual(['t-casual']);
  });

  it('fetches the policy list each time the dialog opens', async () => {
    const fixture = await render(true);
    const policyApi = TestBed.inject(LeavePolicyApiService) as unknown as { list: ReturnType<typeof vi.fn> };
    await fixture.componentInstance.openChange(rows[0]);
    await fixture.componentInstance.openChange(rows[0]);
    expect(policyApi.list).toHaveBeenCalledTimes(2);
  });
});
