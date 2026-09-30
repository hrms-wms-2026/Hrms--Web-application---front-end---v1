import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityByHourResponse } from '../../models/employee-work-activity.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { ActivityByHourWidgetComponent } from './activity-by-hour-widget.component';

describe('ActivityByHourWidgetComponent', () => {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, activeMinutes: hour === 10 ? 40 : 0 }));
  const byHour: EmployeeActivityByHourResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    activityMonitoringEnabled: true,
    timezone: 'UTC',
    lastActivityAt: '2026-09-15T14:41:00Z',
    hours
  };

  function setup(response = byHour) {
    TestBed.configureTestingModule({
      imports: [ActivityByHourWidgetComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getWorkActivityByHour: vi.fn().mockReturnValue(of(response)) } },
        EmployeePeriodStore
      ]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(ActivityByHourWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws the hourly chart from 9AM to 5PM at least and shows last activity', () => {
    const el = setup();
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(9);
    expect(el.textContent).toContain('9AM');
    expect(el.querySelector('[data-testid="last-activity"]')!.textContent).toContain('2:41');
  });

  it('says so when activity monitoring is off', () => {
    const el = setup({ ...byHour, activityMonitoringEnabled: false, hours: [], lastActivityAt: null });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('Activity monitoring is off for this employee');
  });
});
