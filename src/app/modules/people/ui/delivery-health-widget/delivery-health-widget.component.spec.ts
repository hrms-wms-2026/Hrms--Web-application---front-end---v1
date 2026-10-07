import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { DeliveryHealthWidgetComponent } from './delivery-health-widget.component';

describe('DeliveryHealthWidgetComponent', () => {
  const work = {
    from: '2026-09-01',
    to: '2026-09-30',
    assigned: 24,
    completed: 18,
    inProgress: 5,
    overdue: 1,
    notStarted: 0,
    completionRatePercent: 75,
    onTimeRatePercent: 89
  };
  const delivery = {
    from: '2026-09-01',
    to: '2026-09-30',
    tasksAssigned: 21,
    tasksCompleted: 18,
    onTimeCompleted: 16,
    completedWithDueDate: 18,
    storyPointsAssigned: 42,
    storyPointsCompleted: 34,
    previous: null
  };
  const trend = { months: [{ month: '2026-04', completed: 12 }, { month: '2026-09', completed: 18 }] };

  function setup(delivery$ = of(delivery), trend$ = of(trend)) {
    const api = {
      getOverviewWork: vi.fn().mockReturnValue(of(work)),
      getOverviewDelivery: vi.fn().mockReturnValue(delivery$),
      getWorkActivityDeliveryTrend: vi.fn().mockReturnValue(trend$)
    };
    TestBed.configureTestingModule({
      imports: [DeliveryHealthWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: api }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(DeliveryHealthWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, api, store, el: fixture.nativeElement as HTMLElement };
  }

  it('shows completion rate, task and story point counts, and the monthly trend - no on-time rate', () => {
    const { el } = setup();

    expect(el.querySelector('[data-testid="delivery-health-completion-rate"]')!.textContent).toContain('75%');
    expect(el.querySelector('[data-testid="delivery-health-ontime-rate"]')).toBeNull();
    expect(el.textContent).not.toContain('On-time completion');
    expect(el.querySelector('[data-testid="delivery-health-tasks"]')!.textContent).toContain('18 / 21');
    expect(el.querySelector('[data-testid="delivery-health-points"]')!.textContent).toContain('34 / 42');
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(2);
  });

  it('still shows the completion rate when the counts endpoint fails', () => {
    const { el } = setup(throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(el.querySelector('[data-testid="widget-loading"]')).toBeNull();
    expect(el.querySelector('[data-testid="delivery-health-completion-rate"]')!.textContent).toContain('75%');
    expect(el.querySelector('[data-testid="delivery-health-tasks"]')).toBeNull();
  });

  it('still shows the rates and counts when the trend endpoint fails', () => {
    const { el } = setup(of(delivery), throwError(() => new HttpErrorResponse({ status: 500 })));

    expect(el.querySelector('[data-testid="delivery-health-completion-rate"]')!.textContent).toContain('75%');
    expect(el.querySelector('[data-testid="delivery-health-tasks"]')!.textContent).toContain('18 / 21');
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(0);
    expect(el.textContent).toContain('Could not load the monthly delivery trend.');
  });

  it('requests the three endpoints for the selected month', () => {
    const { api } = setup();

    expect(api.getOverviewWork).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    expect(api.getOverviewDelivery).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
    expect(api.getWorkActivityDeliveryTrend).toHaveBeenCalledWith('emp-1', '2026-09-30');
  });

  it('shows the completion-rate change against the comparison month when Compare is on', () => {
    const { fixture, api, store, el } = setup();
    api.getOverviewWork.mockImplementation((_id: string, from: string) =>
      of(from === '2026-08-01' ? { ...work, completionRatePercent: 70 } : work)
    );

    expect(el.querySelector('[data-testid="delta"]')).toBeNull();
    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    const deltas = [...el.querySelectorAll('[data-testid="delta"]')].map((d) => d.textContent);
    expect(deltas.length).toBe(1);
    expect(deltas[0]).toContain('+5%');
    expect(el.textContent).toContain('Comparing with');
  });
});
