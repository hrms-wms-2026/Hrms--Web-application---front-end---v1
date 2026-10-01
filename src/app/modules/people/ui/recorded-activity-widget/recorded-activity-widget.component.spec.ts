import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityByHourResponse } from '../../models/employee-work-activity.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { RecordedActivityWidgetComponent } from './recorded-activity-widget.component';

describe('RecordedActivityWidgetComponent', () => {
  const activity = {
    from: '2026-09-01',
    to: '2026-09-30',
    activityMonitoringEnabled: true,
    activeMinutes: 150,
    idleMinutes: 12,
    meetingMinutes: 65,
    daysWithData: 20,
    previous: null
  };
  const byHour: EmployeeActivityByHourResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    activityMonitoringEnabled: true,
    timezone: 'America/New_York',
    lastActivityAt: '2026-09-30T18:41:00Z',
    hours: [
      { hour: 9, activeMinutes: 10 },
      { hour: 10, activeMinutes: 30 }
    ]
  };

  function setup(activity$ = of(activity), byHour$ = of(byHour)) {
    const api = {
      getOverviewActivity: vi.fn().mockReturnValue(activity$),
      getWorkActivityByHour: vi.fn().mockReturnValue(byHour$)
    };
    TestBed.configureTestingModule({
      imports: [RecordedActivityWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: api }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(RecordedActivityWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, api, el: fixture.nativeElement as HTMLElement };
  }

  it('shows active, idle and meeting time plus last activity and the hourly chart', () => {
    const { el } = setup();

    expect(el.textContent).toContain('2h 30m');
    expect(el.textContent).toContain('Active time');
    expect(el.textContent).toContain('12m');
    expect(el.textContent).toContain('Idle time');
    expect(el.textContent).toContain('1h 05m');
    expect(el.textContent).toContain('Meeting time');
    expect(el.textContent).toContain('Last activity');
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(2);
  });

  it('still shows the period totals when the hourly endpoint fails', () => {
    const { el } = setup(of(activity), throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(el.querySelector('[data-testid="widget-loading"]')).toBeNull();
    expect(el.querySelector('[data-testid="widget-empty"]')).toBeNull();
    expect(el.textContent).toContain('2h 30m');
    expect(el.textContent).toContain('Active time');
    expect(el.textContent).not.toContain('Last activity');
    expect(el.textContent).toContain('Could not load activity by time of day.');
  });

  it('requests both endpoints for the selected month without comparison', () => {
    const { api } = setup();

    expect(api.getOverviewActivity).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
    expect(api.getWorkActivityByHour).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows the empty state when activity monitoring is off', () => {
    const off = { ...activity, activityMonitoringEnabled: false, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0 };
    const offHour = { ...byHour, activityMonitoringEnabled: false, lastActivityAt: null, hours: [] };
    const { el } = setup(of(off), of(offHour));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });
});
