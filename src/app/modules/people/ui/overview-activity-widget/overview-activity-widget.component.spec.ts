import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeActivityOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewActivityWidgetComponent } from './overview-activity-widget.component';

describe('OverviewActivityWidgetComponent', () => {
  const response: EmployeeActivityOverviewResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    activityMonitoringEnabled: true,
    activeMinutes: 150,
    idleMinutes: 72,
    meetingMinutes: 65,
    daysWithData: 12,
    previous: null
  };

  function setup(getOverviewActivity: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewActivityWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewActivity } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewActivityWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!;

  it('requests the month with comparison off by default', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
  });

  it('shows active, idle and meeting time as hours and minutes', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'activity-active')).toContain('2h 30m');
    expect(text(el, 'activity-idle')).toContain('1h 12m');
    expect(text(el, 'activity-meeting')).toContain('1h 05m');
  });

  it('shows deltas with the right tone: more active is good, more idle is bad, meetings are neutral', () => {
    const previous = { activeMinutes: 100, idleMinutes: 50, meetingMinutes: 30, daysWithData: 10 };
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, previous })));
    const delta = (id: string) => el.querySelector(`[data-testid="${id}"] [data-testid="delta"]`)!;

    expect(delta('activity-active-delta').textContent).toContain('+0h 50m');
    expect(delta('activity-active-delta').classList.contains('delta--good')).toBe(true);
    expect(delta('activity-idle-delta').classList.contains('delta--bad')).toBe(true);
    expect(delta('activity-meeting-delta').classList.contains('delta--neutral')).toBe(true);
  });

  it('shows no deltas without previous data', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(el.querySelector('[data-testid="delta"]')).toBeNull();
  });

  it('says monitoring is not enabled when the employee is not monitored', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, activityMonitoringEnabled: false, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0, daysWithData: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('not enabled');
  });

  it('says nothing was recorded when monitoring is on but no day has data', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, daysWithData: 0, activeMinutes: 0, idleMinutes: 0, meetingMinutes: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain('No activity recorded');
  });

  it('asks for the previous period once comparison is on, and refetches on a month change', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setCompare('previous');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-09-01', '2026-09-30', true);

    store.setMonth('2026-08');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31', true);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
