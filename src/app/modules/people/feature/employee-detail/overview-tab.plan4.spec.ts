import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ProjectDetailStore } from '../../../work/state/project-detail.store';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent plan 4 widgets', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30));
  });

  afterEach(() => vi.useRealTimers());

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
      getOverviewUpcoming: vi.fn().mockReturnValue(of({ from: '', to: '', items: [] })),
      getOverviewChecklists: vi.fn().mockReturnValue(of({ groups: [] })),
      getOverviewHistory: vi.fn().mockReturnValue(of({ events: [] })),
      getOverviewRecentActivity: vi.fn().mockReturnValue(of({ items: [], nextBefore: null, isPartial: true }))
    };
    TestBed.configureTestingModule({
      imports: [EmployeeOverviewTabComponent],
      providers: [
        { provide: PeopleApiService, useValue: api },
        { provide: ProjectDetailStore, useValue: {
          loadProject: vi.fn(), loadMyMilestones: vi.fn(), projectError: vi.fn(() => null)
        } }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.componentRef.setInput('hireDate', '2026-01-01');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the four new widgets', () => {
    const { el } = setup();

    for (const tag of [
      'app-overview-upcoming-widget',
      'app-overview-checklists-widget',
      'app-overview-history-widget',
      'app-overview-recent-activity-widget'
    ]) {
      expect(el.querySelector(tag), tag).toBeTruthy();
    }
  });

  it('places Upcoming in the operations row and keeps the lifetime widgets below it', () => {
    const { el } = setup();
    const upcoming = el.querySelector('app-overview-upcoming-widget')!;
    const operations = el.querySelector('[data-testid="overview-operations"]')!;
    const lifetime = el.querySelector('[data-testid="overview-lifetime"]')!;

    expect(operations.querySelector('app-overview-upcoming-widget')).toBe(upcoming);
    expect(operations.textContent).not.toContain('Activity monitoring is not enabled');
    expect(lifetime.querySelector('app-overview-upcoming-widget')).toBeNull();
    expect(lifetime.querySelector('app-overview-checklists-widget')).toBeTruthy();
    expect(lifetime.querySelector('app-overview-history-widget')).toBeTruthy();
    expect(el.querySelector('section[aria-labelledby="insights-heading"] app-overview-upcoming-widget')).toBeNull();

    const insights = el.querySelector('section[aria-labelledby="insights-heading"]')!;
    const activity = el.querySelector('app-overview-recent-activity-widget')!;
    expect(insights.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not display the Checklists card when there are no checklist groups', () => {
    const { el } = setup();
    const checklists = el.querySelector('app-overview-checklists-widget') as HTMLElement;

    expect(checklists.style.display).toBe('none');
  });

  it('loads each new widget once for the employee, with the documented page sizes', () => {
    const { api } = setup();

    expect(api.getOverviewUpcoming).toHaveBeenCalledWith('emp-1', 14);
    expect(api.getOverviewChecklists).toHaveBeenCalledWith('emp-1');
    expect(api.getOverviewHistory).toHaveBeenCalledWith('emp-1', 10);
    expect(api.getOverviewRecentActivity).toHaveBeenCalledWith('emp-1', null, 20);
  });

  it('does not refetch any of them when the month or the comparison changes', () => {
    const { fixture, api, el } = setup();

    fixture.debugElement.query((d) => d.name === 'app-employee-period-picker').componentInstance.onChange('2026-05');
    fixture.detectChanges();

    const compareButton = [...el.querySelectorAll('button')].find((button) => button.textContent?.includes('Compare'))!;
    compareButton.click();
    fixture.detectChanges();
    const compare = fixture.debugElement.query((d) => d.name === 'app-employee-compare-picker');
    compare.query((d) => d.name === 'app-select').componentInstance.valueChange.emit('2026-04');
    fixture.detectChanges();

    // The period-aware widgets did follow both changes...
    expect(api.getOverviewAttendance).toHaveBeenCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getOverviewAttendance).toHaveBeenCalledWith('emp-1', '2026-04-01', '2026-04-30');
    // ...while the lifetime/forward-looking ones loaded exactly once.
    expect(api.getOverviewUpcoming).toHaveBeenCalledTimes(1);
    expect(api.getOverviewChecklists).toHaveBeenCalledTimes(1);
    expect(api.getOverviewHistory).toHaveBeenCalledTimes(1);
    expect(api.getOverviewRecentActivity).toHaveBeenCalledTimes(1);
  });
});
