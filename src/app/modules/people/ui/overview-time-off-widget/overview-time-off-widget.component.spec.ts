import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceOverviewResponse, EmployeeTimeOffResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewTimeOffWidgetComponent } from './overview-time-off-widget.component';

describe('OverviewTimeOffWidgetComponent', () => {
  const response: EmployeeTimeOffResponse = {
    year: 2026,
    balances: [
      { leaveTypeId: 't1', leaveTypeName: 'Annual leave', leaveTypeCode: 'AL', entitledHours: 96, usedHours: 0, pendingHours: 0, remainingHours: 96, isNegative: false },
      { leaveTypeId: 't2', leaveTypeName: 'Sick leave', leaveTypeCode: 'SL', entitledHours: 64, usedHours: 70.5, pendingHours: 0, remainingHours: -6.5, isNegative: true }
    ],
    nextLeave: { leaveTypeId: 't1', leaveTypeName: 'Annual leave', startDate: '2026-09-23', endDate: '2026-09-25', totalHours: 24 }
  };

  const attendance: EmployeeAttendanceOverviewResponse = {
    from: '2026-09-01', to: '2026-09-30', workingDays: 22, present: 18, late: 1,
    missingClockOuts: 0, leaveDays: 3, days: []
  };

  function setup(
    getOverviewTimeOff: ReturnType<typeof vi.fn>,
    getOverviewAttendance: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(of(attendance))
  ) {
    TestBed.configureTestingModule({
      imports: [OverviewTimeOffWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewTimeOff, getOverviewAttendance } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewTimeOffWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('requests time off for the employee without a period', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1');
  });

  it('fills its row so it lines up with the Approvals card beside it', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.classList.contains('h-full')).toBe(true);
  });

  it('lists each balance as remaining hours out of entitled', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="balance-row"]');

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Annual leave');
    expect(rows[0].textContent).toContain('96 h');
    expect(rows[0].textContent).toContain('/ 96 h');
  });

  it('marks an overdrawn balance', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="balance-row"]');

    expect(rows[1].textContent).toContain('6.5 h overdrawn');
    expect(rows[0].textContent).not.toContain('overdrawn');
  });

  it('shows the empty state when there are no balances, even with an upcoming leave (Upcoming shows that)', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, balances: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('does not refetch when the month changes and makes no attendance call of its own', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const getAttendance = vi.fn().mockReturnValue(of(attendance));
    const { fixture, store, el } = setup(get, getAttendance);

    store.setMonth('2026-05');
    fixture.detectChanges();

    expect(get).toHaveBeenCalledTimes(1);
    expect(getAttendance).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="next-leave"]')).toBeFalsy();
  });

  it('fills an overdrawn bar in full and others by the share remaining', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const bars = el.querySelectorAll('[role="progressbar"]');

    expect(bars[0].getAttribute('aria-valuenow')).toBe('100');
    expect(bars[1].getAttribute('aria-valuenow')).toBe('100');
    expect((bars[1].firstElementChild as HTMLElement).className).toContain('bg-[var(--color-danger)]');
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
