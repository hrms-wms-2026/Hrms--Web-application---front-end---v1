import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDayDetail, EmployeeAttendanceOverviewResponse } from '../../models/employee-overview.model';
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

  const detail = (date: string, over: Partial<EmployeeAttendanceDayDetail> = {}): EmployeeAttendanceDayDetail => ({
    date, status: 'present', expectedWorkingDay: true, holidayName: null, scheduledStart: '09:00', scheduledEnd: '17:30',
    clockInAt: date + 'T03:30:00Z', clockOutAt: date + 'T12:00:00Z', clockInLocal: '09:00', clockOutLocal: '17:30',
    workedMinutes: 480, requiredWorkMinutes: 480, breakMinutes: 30, lateMinutes: 0, earlyLeaveMinutes: 0,
    shortHours: false, overBreakMinutes: 0, workMode: 'Onsite', ...over
  });
  const dayList = {
    from: '2026-09-01', to: '2026-09-30', timezone: 'Asia/Colombo',
    days: [
      detail('2026-09-04', { status: 'leave', clockInAt: null, clockOutAt: null, clockInLocal: null, clockOutLocal: null, workedMinutes: 0, breakMinutes: 0 }),
      detail('2026-09-02', { status: 'late', clockInLocal: '09:45', lateMinutes: 45, shortHours: true, workedMinutes: 300 }),
      detail('2026-09-01')
    ]
  };
  const isOpen = (el: HTMLElement) => el.querySelector('[data-testid="popout-panel"]')!.classList.contains('popout-panel--open');

  function setup(
    getOverviewAttendance: ReturnType<typeof vi.fn>,
    getOverviewAttendanceDays: ReturnType<typeof vi.fn> = vi.fn().mockReturnValue(of(dayList))
  ) {
    TestBed.configureTestingModule({
      imports: [OverviewAttendanceWidgetComponent],
      providers: [provideRouter([]), { provide: PeopleApiService, useValue: { getOverviewAttendance, getOverviewAttendanceDays } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewAttendanceWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('does not load the day list until the card is opened', () => {
    const getDays = vi.fn().mockReturnValue(of(dayList));
    const { el } = setup(vi.fn().mockReturnValue(of(response)), getDays);

    expect(getDays).not.toHaveBeenCalled();
    expect(el.querySelector('[data-testid="attendance-toggle"]')!.textContent).toContain('View each day');
  });

  it('pops out on a card click with every day, newest first, and its times, hours and flags', () => {
    const getDays = vi.fn().mockReturnValue(of(dayList));
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)), getDays);

    (el.querySelector('app-widget-card') as HTMLElement).click();
    fixture.detectChanges();

    expect(isOpen(el)).toBe(true);
    expect(getDays).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    const rows = el.querySelectorAll('[data-testid="attendance-day"]');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('On approved leave');
    expect(rows[1].querySelector('[data-testid="attendance-day-times"]')!.textContent).toContain('09:45 → 17:30');
    expect(rows[1].querySelector('[data-testid="attendance-day-hours"]')!.textContent).toContain('Worked 5h');
    expect(rows[1].querySelector('[data-testid="attendance-day-flags"]')!.textContent).toContain('45m late');
    expect(rows[1].querySelector('[data-testid="attendance-day-flags"]')!.textContent).toContain('Short hours');
  });

  it('emits the clicked day with the employee timezone, keeps the list open, and reuses it when reopened', () => {
    const getDays = vi.fn().mockReturnValue(of(dayList));
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(response)), getDays);
    const selected = vi.fn();
    fixture.componentInstance.daySelected.subscribe(selected);
    (el.querySelector('[data-testid="attendance-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    (el.querySelectorAll('[data-testid="attendance-day"]')[2] as HTMLButtonElement).click();
    expect(selected).toHaveBeenCalledWith({ day: dayList.days[2], timezone: 'Asia/Colombo' });
    expect(isOpen(el)).toBe(true);

    (el.querySelector('[data-testid="attendance-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('[data-testid="attendance-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getDays).toHaveBeenCalledTimes(1);
  });

  it('requests the selected month for the employee', () => {
    const getOverviewAttendance = vi.fn().mockReturnValue(of(response));
    setup(getOverviewAttendance);

    expect(getOverviewAttendance).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows the present, late and leave counts but no missing clock-out count', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const stats = el.querySelector('[data-testid="attendance-stats"]')!.textContent!;

    expect(stats).toContain('17');
    expect(stats).toContain('Present');
    expect(stats).toContain('Late');
    expect(stats).toContain('Leave');
    expect(stats).not.toContain('Missing clock-out');
    expect(el.querySelector('[data-testid="stat-missing"]')).toBeNull();
  });

  it('draws one strip bar per day with its status class, showing a missing clock-out as present', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const bars = el.querySelectorAll('[data-testid="day-bar"]');

    expect(bars).toHaveLength(4);
    expect(bars[0].classList.contains('s--present')).toBe(true);
    expect(bars[1].classList.contains('s--late')).toBe(true);
    expect(bars[2].classList.contains('s--present')).toBe(true);
    expect(bars[2].getAttribute('title')).toBe('2026-09-03 · Present');
    expect(bars[3].classList.contains('s--leave')).toBe(true);
    expect(bars[1].getAttribute('title')).toBe('2026-09-02 · Late');
  });

  it('shows the last five real working days up to today with the same status classes as the strip', () => {
    const days = [
      { date: '2026-09-21', status: 'present' as const },
      { date: '2026-09-22', status: 'late' as const },
      { date: '2026-09-23', status: 'leave' as const },
      { date: '2026-09-24', status: 'absent' as const },
      { date: '2026-09-25', status: 'missing_clock_out' as const },
      { date: '2026-09-26', status: 'off' as const },
      { date: '2026-09-27', status: 'off' as const },
      { date: '2026-09-28', status: 'present' as const }
    ];
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, days })));
    const items = Array.from(el.querySelectorAll('[data-testid="recent-day"]'));

    expect(items.map((i) => i.getAttribute('title'))).toEqual([
      '2026-09-22 · Late',
      '2026-09-23 · On leave',
      '2026-09-24 · Absent',
      '2026-09-25 · Present',
      '2026-09-28 · Present'
    ]);
    expect(items[0].textContent).toContain('Tue');
    expect(items[0].textContent).toContain('22');
    expect(items[0].querySelector('.dot')!.classList.contains('s--late')).toBe(true);
  });

  it('leaves out future days from the recent days and hides the row when none have happened yet', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, days: [{ date: '2999-01-04', status: 'none' as const }] })));

    expect(el.querySelector('[data-testid="recent-days"]')).toBeNull();
  });

  it('has no View attendance link (the card itself opens each day)', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelector('[data-testid="view-attendance"]')).toBeNull();
    expect(el.textContent).not.toContain('View attendance');
  });

  it('filters off and none entries from a full-month day strip', () => {
    const activeDays = Array.from({ length: 8 }, (_, index) => ({
      date: `2026-09-${String(index + 1).padStart(2, '0')}`,
      status: 'present' as const
    }));
    const inactiveDays = Array.from({ length: 22 }, (_, index) => ({
      date: `2026-09-${String(index + 9).padStart(2, '0')}`,
      status: index % 2 === 0 ? 'off' as const : 'none' as const
    }));
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, days: [...activeDays, ...inactiveDays] })));

    expect(el.querySelectorAll('[data-testid="day-bar"]')).toHaveLength(8);
  });

  it('refetches when the month changes', () => {
    const getOverviewAttendance = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(getOverviewAttendance);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(getOverviewAttendance).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
    expect(getOverviewAttendance).toHaveBeenCalledTimes(2);
  });

  it('shows a bad late delta against the picked compare month', () => {
    const compare = { ...response, from: '2026-08-01', to: '2026-08-31', late: 1 };
    const get = vi.fn((_id: string, from: string) => of(from === '2026-08-01' ? compare : response));
    const { fixture, store, el } = setup(get);

    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    const delta = el.querySelector('[data-testid="stat-late"] + app-delta-badge [data-testid="delta"]')!;
    expect(delta.textContent).toContain('▲ +1');
    expect(delta.classList.contains('delta--bad')).toBe(true);
    expect(delta.getAttribute('aria-label')).toContain('Aug 2026');
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
