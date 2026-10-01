import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkActivityTabComponent } from './work-activity-tab.component';

describe('EmployeeWorkActivityTabComponent', () => {
  function setup() {
    const empty = { from: '2026-09-01', to: '2026-09-30' };
    const api = {
      getOverviewWork: vi
        .fn()
        .mockReturnValue(of({ ...empty, assigned: 0, completed: 0, inProgress: 0, overdue: 0, notStarted: 0, completionRatePercent: 0, onTimeRatePercent: null })),
      getOverviewDelivery: vi
        .fn()
        .mockReturnValue(
          of({ ...empty, tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0, previous: null })
        ),
      getWorkActivityDeliveryTrend: vi.fn().mockReturnValue(of({ months: [] })),
      getWorkActivityNeedsAttention: vi.fn().mockReturnValue(of({ asOf: '2026-09-15', totalCount: 0, items: [] })),
      getWorkActivityRecentTasks: vi.fn().mockReturnValue(of({ items: [] })),
      getOverviewActivity: vi
        .fn()
        .mockReturnValue(of({ ...empty, activityMonitoringEnabled: false, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0, previous: null })),
      getWorkActivityByHour: vi
        .fn()
        .mockReturnValue(of({ ...empty, activityMonitoringEnabled: false, timezone: 'UTC', lastActivityAt: null, hours: [] })),
      getWorkActivityAppUsage: vi.fn().mockReturnValue(of({ ...empty, applicationTrackingEnabled: false, totalMinutes: 0, apps: [] })),
      getWorkActivityWorkPattern: vi
        .fn()
        .mockReturnValue(of({ ...empty, activityMonitoringEnabled: false, focusBlocks: 0, topApp: null, topAppMinutes: 0, longestIdle: null }))
    };
    TestBed.configureTestingModule({
      imports: [EmployeeWorkActivityTabComponent],
      providers: [provideRouter([]), { provide: PeopleApiService, useValue: api }]
    });
    const fixture = TestBed.createComponent(EmployeeWorkActivityTabComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the period picker and all cards', () => {
    const { el } = setup();

    for (const selector of [
      'app-employee-period-picker',
      'app-work-summary-widget',
      'app-needs-attention-widget',
      'app-delivery-health-widget',
      'app-recorded-activity-widget',
      'app-recent-tasks-widget',
      'app-app-usage-widget',
      'app-work-pattern-widget'
    ]) {
      expect(el.querySelector(selector), selector).toBeTruthy();
    }
  });

  it('changing the month reloads the period cards but not the "now" cards', () => {
    const { fixture, api } = setup();
    const picker = fixture.debugElement.query((d) => d.name === 'app-employee-period-picker').componentInstance;

    picker.onChange('2026-05');
    fixture.detectChanges();

    expect(api.getOverviewWork).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getWorkActivityAppUsage).toHaveBeenLastCalledWith('emp-1', '2026-05-01', '2026-05-31');
    expect(api.getWorkActivityNeedsAttention).toHaveBeenCalledTimes(1);
    expect(api.getWorkActivityRecentTasks).toHaveBeenCalledTimes(1);
  });
});
