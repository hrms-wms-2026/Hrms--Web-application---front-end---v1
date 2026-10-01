import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
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
      getOverviewApprovals: vi.fn().mockReturnValue(of({ from: '', to: '', pending: 0, approved: 0, rejected: 0, total: 0, items: [] }))
    };
    TestBed.configureTestingModule({
      imports: [EmployeeOverviewTabComponent],
      providers: [{ provide: PeopleApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(EmployeeOverviewTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders both pickers and all seven widgets', () => {
    const { el } = setup();

    for (const tag of [
      'app-employee-period-picker',
      'app-employee-compare-picker',
      'app-overview-attendance-widget',
      'app-overview-time-off-widget',
      'app-overview-work-widget',
      'app-overview-approvals-widget',
      'app-overview-activity-widget',
      'app-overview-discipline-widget',
      'app-overview-delivery-widget'
    ]) {
      expect(el.querySelector(tag), tag).toBeTruthy();
    }
  });

  it('groups Activity, Discipline and Delivery under the Productivity & Work Insights heading', () => {
    const { el } = setup();
    const section = el.querySelector('section[aria-labelledby="insights-heading"]')!;

    expect(section.querySelector('#insights-heading')!.textContent).toContain('Productivity & Work Insights');
    expect(section.querySelector('app-overview-activity-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-discipline-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-delivery-widget')).toBeTruthy();
    expect(section.querySelector('app-overview-attendance-widget')).toBeNull();
  });

  it('loads every new widget for the employee', () => {
    const { api } = setup();

    expect(api.getOverviewWork).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewApprovals).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String));
    expect(api.getOverviewActivity).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
    expect(api.getOverviewDelivery).toHaveBeenCalledWith('emp-1', expect.any(String), expect.any(String), false);
  });

  it('switching comparison on refetches only the comparison-capable widgets, with compare=true', () => {
    const { fixture, api, el } = setup();
    const picker = fixture.debugElement.query((d) => d.name === 'app-employee-compare-picker').componentInstance;
    expect(el.querySelector('app-employee-compare-picker')).toBeTruthy();

    picker.onChange('previous');
    fixture.detectChanges();

    expect(api.getOverviewActivity).toHaveBeenLastCalledWith('emp-1', expect.any(String), expect.any(String), true);
    expect(api.getOverviewDelivery).toHaveBeenLastCalledWith('emp-1', expect.any(String), expect.any(String), true);
    expect(api.getOverviewAttendanceDiscipline).toHaveBeenLastCalledWith('emp-1', expect.any(String), expect.any(String), true);
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(1);
    expect(api.getOverviewWork).toHaveBeenCalledTimes(1);
    expect(api.getOverviewApprovals).toHaveBeenCalledTimes(1);
    expect(api.getOverviewTimeOff).toHaveBeenCalledTimes(1);
  });
});
