import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeHistoryResponse } from '../../models/employee-overview.model';
import { OverviewHistoryWidgetComponent } from './overview-history-widget.component';

describe('OverviewHistoryWidgetComponent', () => {
  const response: EmployeeHistoryResponse = {
    events: [
      { kind: 'position_changed', title: 'Position changed', detail: 'Senior → Watercraft Engineer', date: '2025-09-10' },
      { kind: 'leave_approved', title: 'Leave approved', detail: 'Annual leave (24 h)', date: '2025-08-28' },
      { kind: 'joined', title: 'Joined company', detail: null, date: '2024-02-01' }
    ]
  };

  function setup(getOverviewHistory: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewHistoryWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewHistory } }]
    });
    const fixture = TestBed.createComponent(OverviewHistoryWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the latest 10 events for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', 10);
  });

  it('lists each event with its title, detail and dated with a year', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="history-event"]');

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Position changed');
    expect(rows[0].textContent).toContain('Senior → Watercraft Engineer');
    expect(rows[0].textContent).toContain('Sep 10, 2025');
    expect(rows[2].textContent).toContain('Joined company');
    expect(rows[2].textContent).toContain('Feb 1, 2024');
  });

  it('omits the detail line when there is none', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const joined = el.querySelectorAll('[data-testid="history-event"]')[2];

    expect(joined.querySelectorAll('[data-testid="history-detail"]')).toHaveLength(0);
  });

  it('shows the empty state when there is no history', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ events: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
