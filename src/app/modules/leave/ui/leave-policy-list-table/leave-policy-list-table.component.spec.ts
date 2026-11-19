import { TestBed } from '@angular/core/testing';
import { LeavePolicyListTableComponent } from './leave-policy-list-table.component';

describe('LeavePolicyListTableComponent', () => {
  it('shows the leave type, amount in hours, reach and the scheduled change', () => {
    const fixture = TestBed.createComponent(LeavePolicyListTableComponent);
    fixture.componentInstance.policies = [{
      id: 'p1', name: 'Annual - standard', leaveTypeId: 't1', leaveTypeName: 'Annual Leave', leaveTypeColor: '#2563EB',
      amountHours: 8, amountPeriod: 'month', currentVersionNumber: 1, nextVersionEffectiveFrom: '2026-11-01',
      assignmentCount: 2, assignedToSummary: ['Whole company: Dapi Technologies', 'Engineering'], isActive: true
    }];
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Annual - standard');
    expect(text).toContain('Annual Leave');
    expect(text).toContain('8 h / month');
    expect(text).toContain('Whole company: Dapi Technologies · Engineering');
    expect(text).toContain('v1 · next on 1 Nov');
  });
});
