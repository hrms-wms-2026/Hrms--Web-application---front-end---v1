import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceListTableComponent } from './leave-balance-list-table.component';

describe('LeaveBalanceListTableComponent', () => {
  let fixture: ComponentFixture<LeaveBalanceListTableComponent>;

  const balances: LeaveBalanceResponse[] = [
    {
      employeeId: 'emp-1', employeeNumber: 'EMP-001', employeeName: 'Anu Raman', departmentId: null, departmentName: null,
      legalEntityId: null, legalEntityName: null, leaveTypeId: 'type-1', leaveTypeName: 'Annual Leave', leaveTypeCode: 'ANNUAL',
      year: 2026, entitledHours: 112, annualHours: 112, carriedForwardHours: 0, usedHours: 8, pendingHours: 0, remainingHours: 104,
      isNegative: false, carryForwardExpiresOn: null
    }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LeaveBalanceListTableComponent] }).compileComponents();
    fixture = TestBed.createComponent(LeaveBalanceListTableComponent);
    fixture.componentRef.setInput('balances', balances);
  });

  it('labels duration columns as hours', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Entitled hours');
    expect(text).toContain('Used hours');
    expect(text).toContain('Pending hours');
    expect(text).toContain('Remaining hours');
  });

  it('hides the days-at-rate subtitle when workDayHours is unset', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="balance-days-at-rate"]')).toBeNull();
  });

  it('shows days at Xh/day when workDayHours is set', () => {
    fixture.componentRef.setInput('workDayHours', 8);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="balance-days-at-rate"]').textContent.trim()).toBe('14 days at 8.0h/day');
  });
});
