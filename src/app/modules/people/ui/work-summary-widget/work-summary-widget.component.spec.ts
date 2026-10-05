import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { WorkSummaryWidgetComponent } from './work-summary-widget.component';

describe('WorkSummaryWidgetComponent', () => {
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

  function setup(getOverviewWork: ReturnType<typeof vi.fn>, getOverviewDelivery: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [WorkSummaryWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewWork, getOverviewDelivery } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(WorkSummaryWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('shows completed of assigned, in progress, overdue and story points as KPI cards', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(work)), vi.fn().mockReturnValue(of(delivery)));

    expect(el.textContent).toContain('24');
    expect(el.textContent).toContain('24 assigned');
    expect(el.textContent).toContain('18');
    expect(el.textContent).toContain('Tasks completed');
    expect(el.textContent).toContain('5');
    expect(el.textContent).toContain('In progress');
    expect(el.textContent).toContain('1');
    expect(el.textContent).toContain('Overdue tasks');
    expect(el.textContent).toContain('/42');
    expect(el.querySelectorAll('[data-testid="kpi-card"]').length).toBe(4);
    expect(el.querySelector('[data-testid="kpi-card"][role="button"]')).toBeNull();
    expect(el.textContent).toContain('Story points');
  });

  it('requests both endpoints without comparison for the selected month', () => {
    const getOverviewWork = vi.fn().mockReturnValue(of(work));
    const getOverviewDelivery = vi.fn().mockReturnValue(of(delivery));
    setup(getOverviewWork, getOverviewDelivery);

    expect(getOverviewWork).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
    expect(getOverviewDelivery).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30', false);
  });

  it('shows the work cards without waiting on the delivery endpoint', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(work)), vi.fn().mockReturnValue(NEVER));

    expect(el.querySelector('[data-testid="widget-loading"]')).toBeNull();
    expect(el.textContent).toContain('24');
    expect(el.textContent).toContain('24 assigned');
    expect(el.textContent).not.toContain('Story points');
  });

  it('shows the no-access state when the work endpoint is forbidden', () => {
    const { el } = setup(
      vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))),
      vi.fn().mockReturnValue(of(delivery))
    );

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });

  it('still shows the work stats when only the delivery endpoint is forbidden', () => {
    const { el } = setup(
      vi.fn().mockReturnValue(of(work)),
      vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })))
    );

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeNull();
    expect(el.textContent).toContain('24 assigned');
    expect(el.textContent).not.toContain('Story points');
  });

  it('shows each card change against the comparison month when Compare is on', () => {
    const getOverviewWork = vi.fn().mockImplementation((_id: string, from: string) =>
      of(from === '2026-08-01' ? { ...work, completed: 10 } : work)
    );
    const { fixture, store, el } = setup(getOverviewWork, vi.fn().mockReturnValue(of(delivery)));

    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    expect(getOverviewWork).toHaveBeenCalledWith('emp-1', '2026-08-01', '2026-08-31');
    expect(el.querySelector('app-delta-badge')?.textContent).toContain('8');
  });
});
