import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDeliveryResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewDeliveryWidgetComponent } from './overview-delivery-widget.component';

describe('OverviewDeliveryWidgetComponent', () => {
  const response: EmployeeDeliveryResponse = {
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

  function setup(getOverviewDelivery: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewDeliveryWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewDelivery } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewDeliveryWidgetComponent);
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

  it('shows tasks completed, on-time completion and story points as x / y', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'delivery-tasks')).toContain('18 / 21');
    expect(text(el, 'delivery-ontime')).toContain('16 / 18');
    expect(text(el, 'delivery-points')).toContain('34 / 42');
  });

  it('refetches when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31', false);
  });

  it('shows the empty state when there are no tasks', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, tasksAssigned: 0, tasksCompleted: 0, onTimeCompleted: 0, completedWithDueDate: 0, storyPointsAssigned: 0, storyPointsCompleted: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
