import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent layout', () => {
  function setup() {
    const api = {
      getOverviewAttendance: vi.fn().mockReturnValue(of({ from: '', to: '', workingDays: 0, present: 0, late: 0, missingClockOuts: 0, leaveDays: 0, days: [] })),
      getOverviewAttendanceDiscipline: vi.fn().mockReturnValue(of({ from: '', to: '', lateClockIns: 0, earlyClockOuts: 0, missingClockOuts: 0, overBreakDays: 0, overBreakMinutes: 0, locationTrackingEnabled: false, locationViolations: null })),
      getOverviewTimeOff: vi.fn().mockReturnValue(of({ year: 2026, balances: [], nextLeave: null })),
      getOverviewWork: vi.fn().mockReturnValue(of({ from: '', to: '', assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })),
      getOverviewDelivery: vi.fn().mockReturnValue(of({ from: '', to: '', tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })),
      getOverviewActivity: vi.fn().mockReturnValue(of({ from: '', to: '', activityMonitoringEnabled: true, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })),
      getOverviewApprovals: vi.fn().mockReturnValue(of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] })),
      getOverviewSignals: vi.fn().mockReturnValue(of({ from: '', to: '', signals: [] })),
      getOverviewSignalItems: vi.fn(() => of({ key: '', total: 0, timezone: null, items: [] })),
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
        EmployeePeriodStore,
        { provide: PeopleApiService, useValue: api },
        { provide: ProjectDetailStore, useValue: {
          loadProject: vi.fn(), loadMyMilestones: vi.fn(), projectError: vi.fn(() => null)
        } }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.componentRef.setInput('hireDate', '2020-01-01');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders all widgets including productivity discipline chart', () => {
    const { el } = setup();

    for (const tag of [
      'app-overview-productivity-discipline-chart',
      'app-overview-attendance-widget',
      'app-overview-time-off-widget',
      'app-overview-work-widget',
      'app-overview-approvals-widget',
      'app-overview-delivery-widget'
    ]) {
      expect(el.querySelector(tag), tag).toBeTruthy();
    }
  });

  it('keeps Delivery under the Productivity & Work Insights heading and removes Discipline', () => {
    const { el } = setup();
    const section = el.querySelector('section[aria-labelledby="insights-heading"]')!;

    expect(section.querySelector('#insights-heading')!.textContent).toContain('Productivity & Work Insights');
    expect(section.querySelector('app-overview-activity-widget')).toBeNull();
    expect(section.querySelector('app-overview-discipline-widget')).toBeNull();
    expect(section.querySelector('app-overview-delivery-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-attendance-widget')).toBeNull();
  });

  it('loads every new widget for the employee', () => {
    const { api } = setup();

    expect(api.getOverviewWork).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewApprovals).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewDelivery).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
  });

  it('orders the rows: KPI strip, chart + side, operations, Time Off + Approvals, then Checklists + Recent Activity', () => {
    const { el } = setup();
    const order = [
      'app-overview-kpi-strip',
      'app-overview-productivity-discipline-chart',
      '[data-testid="overview-operations"]',
      '[data-testid="overview-balances"]',
      '[data-testid="overview-lifetime"]'
    ].map((selector) => el.querySelector(selector)!);

    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });
});
