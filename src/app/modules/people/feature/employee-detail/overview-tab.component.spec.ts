import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeOverviewTabComponent } from './overview-tab.component';

describe('EmployeeOverviewTabComponent', () => {
  function setup() {
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
      )
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
    // 2 on initial load (attendance widget + chart widget), 2 after month change
    expect(api.getOverviewAttendance).toHaveBeenCalledTimes(4);
    expect(api.getOverviewTimeOff).toHaveBeenCalledTimes(1);
  });
});
