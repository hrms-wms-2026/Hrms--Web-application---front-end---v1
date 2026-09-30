import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { DeliveryTrendWidgetComponent } from './delivery-trend-widget.component';

describe('DeliveryTrendWidgetComponent', () => {
  function setup(response: unknown) {
    const get = vi.fn().mockReturnValue(of(response));
    TestBed.configureTestingModule({
      imports: [DeliveryTrendWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getWorkActivityDeliveryTrend: get } }, EmployeePeriodStore]
    });
    TestBed.inject(EmployeePeriodStore).setMonth('2026-09');
    const fixture = TestBed.createComponent(DeliveryTrendWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, get };
  }

  it('requests the trend ending at the selected month and draws it', () => {
    const { el, get } = setup({
      months: [
        { month: '2026-04', completed: 22 },
        { month: '2026-05', completed: 24 },
        { month: '2026-06', completed: 18 },
        { month: '2026-07', completed: 20 },
        { month: '2026-08', completed: 26 },
        { month: '2026-09', completed: 30 }
      ]
    });

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-30');
    expect(el.querySelectorAll('[data-testid="bar"]').length).toBe(6);
    expect(el.textContent).toContain('Sep');
  });

  it('shows the empty state with no completed tasks in the window', () => {
    const el = setup({ months: [{ month: '2026-09', completed: 0 }] }).el;
    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });
});
