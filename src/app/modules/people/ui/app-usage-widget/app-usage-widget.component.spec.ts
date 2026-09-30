import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { AppUsageWidgetComponent } from './app-usage-widget.component';

describe('AppUsageWidgetComponent', () => {
  function setup(response: unknown) {
    TestBed.configureTestingModule({
      imports: [AppUsageWidgetComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getWorkActivityAppUsage: vi.fn().mockReturnValue(of(response)) } },
        EmployeePeriodStore
      ]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(AppUsageWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists apps with active time and sessions', () => {
    const el = setup({
      from: '2026-09-01',
      to: '2026-09-30',
      applicationTrackingEnabled: true,
      totalMinutes: 132,
      apps: [{ appName: 'Code.exe', activeMinutes: 132, sessions: 12, lastUsedAt: '2026-09-15T14:35:00Z' }]
    });

    const row = el.querySelector('[data-testid="app-row"]')!.textContent!;
    expect(row).toContain('Code.exe');
    expect(row).toContain('2h 12m');
    expect(row).toContain('12');
  });

  it('says so when application tracking is off', () => {
    const el = setup({ from: '2026-09-01', to: '2026-09-30', applicationTrackingEnabled: false, totalMinutes: 0, apps: [] });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain(
      'Application tracking is off for this employee'
    );
  });
});
