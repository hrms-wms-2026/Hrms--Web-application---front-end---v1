import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { WorkPatternWidgetComponent } from './work-pattern-widget.component';

describe('WorkPatternWidgetComponent', () => {
  function setup(response: unknown) {
    TestBed.configureTestingModule({
      imports: [WorkPatternWidgetComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getWorkActivityWorkPattern: vi.fn().mockReturnValue(of(response)) } },
        EmployeePeriodStore
      ]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(WorkPatternWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const base = { from: '2026-09-01', to: '2026-09-30', activityMonitoringEnabled: true };

  it('shows focus blocks, top app and longest idle', () => {
    const el = setup({
      ...base,
      focusBlocks: 3,
      topApp: 'Code.exe',
      topAppMinutes: 72,
      longestIdle: { start: '2026-09-15T06:12:00Z', end: '2026-09-15T06:40:00Z', minutes: 28 }
    });

    expect(el.querySelector('[data-testid="pattern-focus"]')!.textContent).toContain('3');
    const topApp = el.querySelector('[data-testid="pattern-top-app"]')!.textContent;
    expect(topApp).toContain('Code');
    expect(topApp).not.toContain('.exe');
    expect(el.querySelector('[data-testid="pattern-top-app"]')!.textContent).toContain('1h 12m');
    expect(el.querySelector('[data-testid="pattern-idle"]')!.textContent).toContain('28m');
  });

  it('shows a dash for the top app when application tracking is off', () => {
    const el = setup({ ...base, focusBlocks: 0, topApp: null, topAppMinutes: 0, longestIdle: null });
    expect(el.querySelector('[data-testid="pattern-top-app"]')!.textContent).toContain('—');
  });

  it('says so when activity monitoring is off', () => {
    const el = setup({ ...base, activityMonitoringEnabled: false, focusBlocks: 0, topApp: null, topAppMinutes: 0, longestIdle: null });
    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });
});
