import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewAttendanceWidgetComponent } from './overview-attendance-widget.component';

describe('OverviewAttendanceWidgetComponent', () => {
  const response: EmployeeAttendanceOverviewResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    workingDays: 22,
    present: 17,
    late: 2,
    missingClockOuts: 1,
    leaveDays: 3,
    days: [
      { date: '2026-09-01', status: 'present' },
      { date: '2026-09-02', status: 'late' },
      { date: '2026-09-03', status: 'missing_clock_out' },
      { date: '2026-09-04', status: 'leave' },
      { date: '2026-09-05', status: 'off' }
    ]
  };

  function setup(getOverviewAttendance: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewAttendanceWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewAttendance } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewAttendanceWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the selected month for the employee', () => {
    const getOverviewAttendance = vi.fn().mockReturnValue(of(response));
    setup(getOverviewAttendance);

    expect(getOverviewAttendance).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows the present, late, missing clock-out and leave counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const stats = el.querySelector('[data-testid="attendance-stats"]')!.textContent!;

    expect(stats).toContain('17');
    expect(stats).toContain('Present');
    expect(stats).toContain('Late');
    expect(stats).toContain('Missing clock-out');
    expect(stats).toContain('Leave');
    expect(el.querySelector('[data-testid="stat-missing"]')!.textContent).toContain('1');
  });

  it('draws one strip bar per day with its status class and an accessible title', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const bars = el.querySelectorAll('[data-testid="day-bar"]');

    expect(bars).toHaveLength(5);
    expect(bars[0].classList.contains('day--present')).toBe(true);
    expect(bars[1].classList.contains('day--late')).toBe(true);
    expect(bars[2].classList.contains('day--missing_clock_out')).toBe(true);
    expect(bars[3].classList.contains('day--leave')).toBe(true);
    expect(bars[4].classList.contains('day--off')).toBe(true);
    expect(bars[1].getAttribute('title')).toBe('2026-09-02 · Late');
  });

  it('refetches when the month changes', () => {
    const getOverviewAttendance = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(getOverviewAttendance);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(getOverviewAttendance).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
    expect(getOverviewAttendance).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when the period has no attendance days', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, days: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403 and an error state with retry on other failures', () => {
    const forbidden = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(forbidden.el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();

    TestBed.resetTestingModule();
    const getOverviewAttendance = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(response));
    const failed = setup(getOverviewAttendance);
    (failed.el.querySelector('app-error-state button') as HTMLButtonElement).click();
    failed.fixture.detectChanges();

    expect(getOverviewAttendance).toHaveBeenCalledTimes(2);
    expect(failed.el.querySelector('[data-testid="attendance-stats"]')).toBeTruthy();
  });
});
