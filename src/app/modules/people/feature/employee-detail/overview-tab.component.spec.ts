import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewSignalsResponse, EmployeeSignal } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { SignalDrilldownStore } from '../../state/signal-drilldown.store';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
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
      getOverviewSignals: vi.fn().mockReturnValue(signalsSource),
      getOverviewSignalItems: vi.fn(() => of({ key: 'over_break', total: 0, timezone: null, items: [] })),
      getOverviewAttendanceDays: vi.fn().mockReturnValue(of({ from: '', to: '', timezone: 'UTC', days: [] })),
      getOverviewWorkTasks: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewUpcoming: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewChecklists: vi.fn().mockReturnValue(of({ groups: [] })),
      getOverviewHistory: vi.fn().mockReturnValue(of({ events: [] })),
      getOverviewRecentActivity: vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true }))
    };
    TestBed.configureTestingModule({
      imports: [EmployeeOverviewTabComponent],
      providers: [
        // Provided by the employee detail page in the app; the tab only reads it and sets its bounds.
        EmployeePeriodStore,
        { provide: PeopleApiService, useValue: api },
        { provide: ProjectDetailStore, useValue: {
          loadProject: vi.fn(), loadMyMilestones: vi.fn(), projectError: vi.fn(() => null)
        } }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.componentRef.setInput('hireDate', hireDate);
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement, store: TestBed.inject(EmployeePeriodStore) };
  }

  function setupWithSignals(signals: readonly EmployeeSignal[]) {
    return setup(null, of({ from: '2026-09-01', to: '2026-09-30', signals }));
  }

  it('renders the widgets without its own title or month controls (those live in the page header)', () => {
    const { el } = setup();

    expect(el.querySelector('app-employee-period-picker')).toBeNull();
    expect(el.querySelector('button[title="Previous month"]')).toBeNull();
    expect(el.textContent).not.toContain('Performance Overview');
    expect(el.querySelector('app-overview-attendance-widget')).toBeTruthy();
    expect(el.querySelector('app-overview-discipline-widget')).toBeNull();
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
    const { fixture, el } = setup();
    fixture.detectChanges();

    expect(el.querySelector('app-overview-kpi-strip')).toBeTruthy();
    expect(el.querySelectorAll('[data-testid="kpi-card"]')).toHaveLength(4);
    expect(el.querySelector('[data-testid="needs-attention"]')).toBeNull();
  });

  it('moves Attendance beside the chart and leaves Work and Upcoming in two columns when there are no attention signals', () => {
    const { fixture, el } = setup();
    fixture.detectChanges();
    const summarySide = el.querySelector('[data-testid="overview-summary-side"]')!;
    const operations = el.querySelector('[data-testid="overview-operations"]')!;

    expect(summarySide.querySelector('app-overview-attendance-widget')).toBeTruthy();
    expect(operations.querySelector('app-overview-attendance-widget')).toBeNull();
    expect(operations.classList.contains('md:grid-cols-2')).toBe(true);
    expect(operations.classList.contains('lg:grid-cols-3')).toBe(false);
  });

  it('keeps Attendance in the three-column operations row when Needs Attention is present', () => {
    const signals = [signal('late_clock_ins', 1, 'warning', 'attendance')];
    const { fixture, el } = setup(null, of({ from: '2026-09-01', to: '2026-09-30', signals }));
    fixture.detectChanges();
    const summarySide = el.querySelector('[data-testid="overview-summary-side"]')!;
    const operations = el.querySelector('[data-testid="overview-operations"]')!;

    expect(summarySide.querySelector('[data-testid="needs-attention"]')).toBeTruthy();
    expect(summarySide.querySelector('app-overview-attendance-widget')).toBeNull();
    expect(operations.querySelector('app-overview-attendance-widget')).toBeTruthy();
    expect(operations.classList.contains('lg:grid-cols-3')).toBe(true);
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

  it('bounds the shared month store by the hire date, so the header stepper cannot go back', () => {
    const { store } = setup('2026-09-03');

    expect(store.canGoPrevious()).toBe(false);
    expect(store.canGoNext()).toBe(false);
  });

  it('changing the month refetches the period-aware widgets but not time off', () => {
    const { fixture, api, store } = setup();

    store.setMonth('2026-05');
    fixture.detectChanges();

    expect(api.getOverviewAttendance).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31', false);
    // Attendance widget and chart follow the selected month; Time Off is year-based and makes no attendance call.
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(4);
    expect(api.getOverviewTimeOff).toHaveBeenCalledTimes(1);
  });

  it('loads the picked compare month for signals and visible widget deltas', () => {
    const { fixture, api, el, store } = setup('2026-01-01');

    store.setCompareMonth('2026-08');
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

  it('opens the matching Needs Attention row when a coloured KPI card is clicked', () => {
    const { fixture } = setupWithSignals([signal('over_break', 3, 'warning', 'attendance')]);
    const scroll = vi.fn();
    const attention = fixture.nativeElement.querySelector('app-overview-needs-attention') as HTMLElement;
    attention.scrollIntoView = scroll;

    (fixture.nativeElement.querySelector('[data-testid="kpi-card"][role="button"]') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-key="over_break"]')!.getAttribute('aria-expanded')).toBe('true');
    expect(scroll).toHaveBeenCalled();
  });

  it('closes the open row when the month changes', () => {
    const { fixture } = setupWithSignals([signal('over_break', 3, 'warning', 'attendance')]);
    (fixture.nativeElement.querySelector('[data-key="over_break"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    TestBed.inject(EmployeePeriodStore).setMonth('2026-08');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-key="over_break"]')?.getAttribute('aria-expanded') ?? 'false').toBe('false');
  });

  it('places Time Off beside Approvals and drops the employment history widget', () => {
    const { el } = setup();
    const balances = el.querySelector('[data-testid="overview-balances"]')!;

    expect(balances.querySelector('app-overview-time-off-widget')).toBeTruthy();
    expect(balances.querySelector('[data-testid="approvals-card"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="approvals-empty"]')!.textContent).toContain('All caught up');
    expect(el.querySelector('app-overview-history-widget')).toBeNull();
  });

  it('opens an Attendance card day in the shared day drawer, in the employee timezone', () => {
    const { fixture } = setup();
    const attendance = fixture.debugElement.query((d) => d.name === 'app-overview-attendance-widget').componentInstance;

    attendance.daySelected.emit({ day: { date: '2026-09-02' }, timezone: 'Asia/Colombo' });
    fixture.detectChanges();

    const selected = fixture.debugElement.injector.get(SignalDrilldownStore).selected()!;
    expect(selected.item.kind).toBe('attendance_day');
    expect(selected.item.date).toBe('2026-09-02');
    expect(selected.timezone).toBe('Asia/Colombo');
  });

  it('opens a Work card task in the shared task detail (drill-down selection)', () => {
    const { fixture } = setup();
    const work = fixture.debugElement.query((d) => d.name === 'app-overview-work-widget').componentInstance;

    work.taskSelected.emit({
      taskId: 't1', shortId: 'WEB-1', title: 'Fix cart', bucket: 'overdue', priority: 'high', statusName: 'To do',
      statusColor: '#000', dueDate: '2026-09-10', daysOverdue: 3, isCarriedOver: false, projectId: 'p1',
      projectName: 'Website', objectiveId: 'o1', moduleName: 'Checkout'
    });
    fixture.detectChanges();

    const selected = fixture.debugElement.injector.get(SignalDrilldownStore).selected()!;
    expect(selected.item.kind).toBe('task');
    expect(selected.item.id).toBe('t1');
    expect(selected.item.projectId).toBe('p1');
  });

  it('no longer renders the Discipline widget but keeps the approvals widget', () => {
    const { fixture } = setupWithSignals([]);
    expect(fixture.nativeElement.querySelector('app-overview-discipline-widget')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-overview-approvals-widget')).toBeTruthy();
  });
});
