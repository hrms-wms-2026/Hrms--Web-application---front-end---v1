import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewDisciplineWidgetComponent } from './overview-discipline-widget.component';

describe('OverviewDisciplineWidgetComponent', () => {
  const response: EmployeeAttendanceDisciplineResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    lateClockIns: 2,
    earlyClockOuts: 1,
    missingClockOuts: 1,
    overBreakDays: 3,
    overBreakMinutes: 45,
    locationTrackingEnabled: true,
    locationViolations: 4
  };

  function setup(getOverviewAttendanceDiscipline: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewDisciplineWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewAttendanceDiscipline } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewDisciplineWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const row = (el: HTMLElement, key: string) => el.querySelector(`[data-testid="discipline-${key}"]`)!.textContent!;

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
  });

  it('shows each discipline measure', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(row(el, 'late')).toContain('2');
    expect(row(el, 'early')).toContain('1');
    expect(row(el, 'missing')).toContain('1');
    expect(row(el, 'over-break')).toContain('3 days');
    expect(row(el, 'over-break')).toContain('45 min');
    expect(row(el, 'location')).toContain('4 alerts');
  });

  it('says None for over-break when there are no over-break days', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, overBreakDays: 0, overBreakMinutes: 0 })));

    expect(row(el, 'over-break')).toContain('None');
  });

  it('uses the singular for one over-break day and one alert', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, overBreakDays: 1, overBreakMinutes: 10, locationViolations: 1 })));

    expect(row(el, 'over-break')).toContain('1 day');
    expect(row(el, 'over-break')).not.toContain('1 days');
    expect(row(el, 'location')).toContain('1 alert');
    expect(row(el, 'location')).not.toContain('1 alerts');
  });

  it('shows Not monitored for location when tracking is off', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, locationTrackingEnabled: false, locationViolations: null })));

    expect(row(el, 'location')).toContain('Not monitored');
  });

  it('refetches when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31', false);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
