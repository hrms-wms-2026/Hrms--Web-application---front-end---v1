import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewSignalsResponse, EmployeeSignal } from '../../models/employee-overview.model';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30));
  });

  afterEach(() => vi.useRealTimers());

  const signal = (
    key: string,
    rank: number,
    severity: EmployeeSignal['severity'],
    category: EmployeeSignal['category']
  ): EmployeeSignal => ({
    key,
    rank,
    severity,
    category,
    value: 2,
    unit: 'count',
    denominator: null,
    label: `2 ${key}`,
    detail: `${key} detail`
  });

  function setup(
    hireDate: string | null = null,
    signalsSource: Observable<EmployeeOverviewSignalsResponse> = of({ from: '', to: '', signals: [] })
  ) {
    const api = {
      getOverviewAttendance: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })
      ),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(
        of({ from: '2026-09-01', to: '2026-09-30', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })
      ),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(
        of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })
      ),
      getOverviewDelivery: vi.fn().mockReturnValue(
        of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })
      ),
      getOverviewActivity: vi.fn().mockReturnValue(
        of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })
      ),
      getOverviewApprovals: vi.fn().mockReturnValue(
        of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] })
      ),
      getOverviewSignals: vi.fn().mockReturnValue(signalsSource)
    };
    TestBed.configureTestingModule({
      imports: [EmployeeOverviewTabComponent],
      providers: [{ provide: PeopleApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.componentRef.setInput('hireDate', hireDate);
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the period picker and the three widgets', () => {
    const { el } = setup();

    expect(el.querySelector('app-employee-period-picker')).toBeTruthy();
    expect(el.querySelector('app-overview-attendance-widget')).toBeTruthy();
    expect(el.querySelector('app-overview-discipline-widget')).toBeTruthy();
    expect(el.querySelector('app-overview-time-off-widget')).toBeTruthy();
  });

  it('loads every widget for the employee', () => {
    const { api } = setup();

    expect(api.getOverviewAttendance).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
    expect(api.getOverviewTimeOff).toHaveBeenCalledWith('emp-1');
  });

  it('shows four KPI skeletons until signals settle', () => {
    const pending = new Subject<EmployeeOverviewSignalsResponse>();
    const { el } = setup(null, pending);

    expect(el.querySelectorAll('[data-testid="kpi-skeleton"]')).toHaveLength(4);
    expect(el.querySelector('[data-testid="kpi-card"]')).toBeNull();
  });

  it('renders four baseline KPI cards and no Needs Attention card without signals', () => {
    const { el } = setup();

    expect(el.querySelector('app-overview-kpi-strip')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="kpi-card"]')).toHaveLength(4);
    expect(el.querySelector('[data-testid="needs-attention"]')).toBeNull();
  });

  it('keeps signal order in the KPI strip and Needs Attention rows', () => {
    const signals = [
      signal('overdue_tasks', 1, 'critical', 'work'),
      signal('late_clock_ins', 2, 'warning', 'attendance')
    ];
    const { el } = setup(null, of({ from: '2026-09-01', to: '2026-09-30', signals }));
    const cards = el.querySelectorAll('[data-testid="kpi-card"]');
    const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-testid="attention-row"]'));

    expect(cards[0].textContent).toContain('Overdue tasks');
    expect(rows.map((row) => row.dataset['key'])).toEqual(['overdue_tasks', 'late_clock_ins']);
  });

  it('requests signals for the employee and selected period', () => {
    const { api } = setup();

    expect(api.getOverviewSignals).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('disables both month-stepper buttons when employment starts in the current month', () => {
    const { el } = setup('2026-09-03');

    expect((el.querySelector('button[title="Previous month"]') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('button[title="Next month"]') as HTMLButtonElement).disabled).toBe(true);
  });

  it('changing the month refetches the period-aware widgets but not time off', () => {
    const { fixture, api, el } = setup();
    const picker = el.querySelector('app-employee-period-picker') as HTMLElement;
    expect(picker).toBeTruthy();

    // The picker's onChange writes the tab-scoped store; drive it the same way the select does.
    const pickerInstance = fixture.debugElement.query((d) => d.name === 'app-employee-period-picker').componentInstance;
    pickerInstance.onChange('2026-05');
    fixture.detectChanges();

    expect(api.getOverviewAttendance).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31', false);
    // Attendance widget, chart, and Time Off monthly-leave line all follow the selected month.
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(6);
    expect(api.getOverviewTimeOff).toHaveBeenCalledTimes(1);
  });

  it('loads the picked compare month for signals and visible widget deltas', () => {
    const { fixture, api, el } = setup('2026-01-01');
    const compareButton = [...el.querySelectorAll('button')].find((button) => button.textContent?.includes('Compare'))!;

    compareButton.click();
    fixture.detectChanges();
    const picker = fixture.debugElement.query((element) => element.name === 'app-employee-compare-picker');
    const select = picker.query((element) => element.name === 'app-select').componentInstance;
    select.valueChange.emit('2026-08');
    fixture.detectChanges();

    for (const method of [
      api.getOverviewSignals,
      api.getOverviewAttendance,
      api.getOverviewWork,
      api.getOverviewApprovals
    ]) {
      expect(method).toHaveBeenCalledWith('emp-1', '2026-08-01', '2026-08-31');
    }
    expect(el.querySelector('app-overview-kpi-strip [data-testid="delta"]')).toBeTruthy();
  });
});
