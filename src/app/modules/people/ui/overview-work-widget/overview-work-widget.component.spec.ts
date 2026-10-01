import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeWorkOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewWorkWidgetComponent } from './overview-work-widget.component';

describe('OverviewWorkWidgetComponent', () => {
  const response: EmployeeWorkOverviewResponse = {
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

  function setup(getOverviewWork: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewWorkWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewWork } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewWorkWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  const text = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`)!.textContent!;

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows assigned, completed, in progress and overdue counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));

    expect(text(el, 'work-assigned')).toContain('24');
    expect(text(el, 'work-completed')).toContain('18');
    expect(text(el, 'work-in-progress')).toContain('5');
    expect(text(el, 'work-overdue')).toContain('1');
  });

  it('draws a progress bar whose segments are proportional to the counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const width = (id: string) => (el.querySelector(`[data-testid="${id}"]`) as HTMLElement).style.width;

    expect(width('seg-completed')).toBe('75%');
    expect(parseFloat(width('seg-in-progress'))).toBeCloseTo(20.83, 1);
    expect(parseFloat(width('seg-overdue'))).toBeCloseTo(4.17, 1);
  });

  it('shows the completion and on-time rates, and a dash when the on-time rate is unknown', () => {
    const known = setup(vi.fn().mockReturnValue(of(response)));
    expect(text(known.el, 'work-completion-rate')).toContain('75%');
    expect(text(known.el, 'work-ontime-rate')).toContain('89%');

    TestBed.resetTestingModule();
    const unknown = setup(vi.fn().mockReturnValue(of({ ...response, onTimeRatePercent: null })));
    expect(text(unknown.el, 'work-ontime-rate')).toContain('—');
  });

  it('shows the empty state when no tasks belong to the period', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, assigned: 0, completed: 0, inProgress: 0, overdue: 0 })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('refetches when the month changes', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();

    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');
  });

  it('shows a good completed delta against the picked compare month', () => {
    const compare = { ...response, from: '2026-08-01', to: '2026-08-31', completed: 15 };
    const get = vi.fn((_id: string, from: string) => of(from === '2026-08-01' ? compare : response));
    const { fixture, store, el } = setup(get);

    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    const delta = el.querySelector('[data-testid="delta"]')!;
    expect(delta.textContent).toContain('▲ +3');
    expect(delta.classList.contains('delta--good')).toBe(true);
  });

  it('shows the no-access state on 403', () => {
    const { el } = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });
});
