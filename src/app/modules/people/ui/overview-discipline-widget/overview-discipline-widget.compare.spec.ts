import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeAttendanceDisciplineResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewDisciplineWidgetComponent } from './overview-discipline-widget.component';

describe('OverviewDisciplineWidgetComponent comparison', () => {
  const current: EmployeeAttendanceDisciplineResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    lateClockIns: 2,
    earlyClockOuts: 1,
    missingClockOuts: 0,
    overBreakDays: 3,
    overBreakMinutes: 45,
    locationTrackingEnabled: true,
    locationViolations: 4,
    previous: { lateClockIns: 5, earlyClockOuts: 1, missingClockOuts: 1, overBreakDays: 1, overBreakMinutes: 10, locationViolations: 1 }
  };

  function setup(response: EmployeeAttendanceDisciplineResponse) {
    const get = vi.fn().mockReturnValue(of(response));
    TestBed.configureTestingModule({
      imports: [OverviewDisciplineWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewAttendanceDiscipline: get } }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewDisciplineWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, get, el: fixture.nativeElement as HTMLElement };
  }

  const delta = (el: HTMLElement, key: string) =>
    el.querySelector(`[data-testid="discipline-${key}-delta"] [data-testid="delta"]`);

  it('shows a good delta when a lower-is-better metric dropped, and a bad one when it rose', () => {
    const { el } = setup(current);

    expect(delta(el, 'late')!.textContent).toContain('-3');
    expect(delta(el, 'late')!.classList.contains('delta--good')).toBe(true);
    expect(delta(el, 'over-break')!.textContent).toContain('+2');
    expect(delta(el, 'over-break')!.classList.contains('delta--bad')).toBe(true);
    expect(delta(el, 'location')!.classList.contains('delta--bad')).toBe(true);
  });

  it('shows a flat delta when a metric is unchanged', () => {
    const { el } = setup(current);

    expect(delta(el, 'early')!.textContent).toContain('No change');
  });

  it('shows no deltas without previous data', () => {
    const { el } = setup({ ...current, previous: null });

    expect(el.querySelector('[data-testid="delta"]')).toBeNull();
  });

  it('skips the location delta when either side has no location figure', () => {
    const { el } = setup({ ...current, locationTrackingEnabled: false, locationViolations: null, previous: { ...current.previous!, locationViolations: null } });

    expect(delta(el, 'location')).toBeNull();
  });

  it('keeps legacy previous-period comparison off until explicit compare ranges are wired', () => {
    const { fixture, get } = setup(current);

    TestBed.inject(EmployeePeriodStore).setCompareMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
