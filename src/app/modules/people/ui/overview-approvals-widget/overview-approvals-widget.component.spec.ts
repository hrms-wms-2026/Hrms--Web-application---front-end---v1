import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeApprovalActivityResponse, EmployeeApprovalItem } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { OverviewApprovalsWidgetComponent } from './overview-approvals-widget.component';

describe('OverviewApprovalsWidgetComponent', () => {
  const item = (over: Partial<EmployeeApprovalItem>): EmployeeApprovalItem => ({
    id: 'i1', kind: 'leave', label: 'Leave request', detail: 'Annual leave · 2026-09-23 → 2026-09-25',
    status: 'pending', requestedAt: '2026-09-12T09:00:00+00:00', decidedAt: null, approverName: null, ...over
  });

  const response: EmployeeApprovalActivityResponse = {
    from: '2026-09-01',
    to: '2026-09-30',
    pending: 2,
    approved: 1,
    rejected: 1,
    total: 4,
    items: [
      item({ id: 'i1' }),
      item({ id: 'i2', kind: 'task_creation', label: 'Task creation', detail: 'Checkout', approverName: 'Abitha Devendran', requestedAt: '2026-09-10T09:00:00+00:00' }),
      item({ id: 'i3', kind: 'attendance_correction', label: 'Attendance correction', detail: '2026-09-04 · clock out', status: 'approved', requestedAt: '2026-09-05T09:00:00+00:00', decidedAt: '2026-09-06T09:00:00+00:00' }),
      item({ id: 'i4', kind: 'work_area_change', label: 'Work area change', detail: null, status: 'rejected', requestedAt: '2026-09-02T09:00:00+00:00' })
    ]
  };

  function setup(getOverviewApprovals: ReturnType<typeof vi.fn>) {
    TestBed.configureTestingModule({
      imports: [OverviewApprovalsWidgetComponent],
      providers: [{ provide: PeopleApiService, useValue: { getOverviewApprovals } }, EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setMonth('2026-09');
    const fixture = TestBed.createComponent(OverviewApprovalsWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, store, el: fixture.nativeElement as HTMLElement };
  }

  it('requests the selected month for the employee', () => {
    const get = vi.fn().mockReturnValue(of(response));
    setup(get);

    expect(get).toHaveBeenCalledWith('emp-1', '2026-09-01', '2026-09-30');
  });

  it('shows the pending, approved and rejected counts', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const counts = el.querySelector('[data-testid="approvals-counts"]')!.textContent!;

    expect(counts).toContain('2');
    expect(counts).toContain('Pending');
    expect(counts).toContain('Approved');
    expect(counts).toContain('Rejected');
  });

  it('lists each item with its label, detail, status and short date', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="approval-item"]');

    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('Leave request');
    expect(rows[0].textContent).toContain('Annual leave · 2026-09-23 → 2026-09-25');
    expect(rows[0].textContent).toContain('Pending');
    expect(rows[0].textContent).toContain('Sep 12');
    expect(rows[2].textContent).toContain('Approved');
    expect(rows[3].textContent).toContain('Rejected');
  });

  it('shows who a pending Work Management request is awaiting, and nothing for other kinds', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const rows = el.querySelectorAll('[data-testid="approval-item"]');

    expect(rows[1].textContent).toContain('Awaiting Abitha Devendran');
    expect(rows[0].textContent).not.toContain('Awaiting');
  });

  it('shows who decided a decided request when the API names them', () => {
    const decided: EmployeeApprovalActivityResponse = {
      ...response,
      items: [item({ id: 'd1', kind: 'task_edit', label: 'Task edit', status: 'approved', approverName: 'Grace Hopper', decidedAt: '2026-09-11T09:00:00+00:00' })]
    };
    const { el } = setup(vi.fn().mockReturnValue(of(decided)));

    expect(el.querySelector('[data-testid="approval-item"]')!.textContent).toContain('by Grace Hopper');
  });

  it('tags each row with its status class for styling', () => {
    const { el } = setup(vi.fn().mockReturnValue(of(response)));
    const pills = el.querySelectorAll('[data-testid="approval-status"]');

    expect(pills[0].classList.contains('pill--pending')).toBe(true);
    expect(pills[2].classList.contains('pill--approved')).toBe(true);
    expect(pills[3].classList.contains('pill--rejected')).toBe(true);
  });

  it('notes how many older items are not listed', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, total: 14 })));

    expect(el.textContent).toContain('Showing the latest 4 of 14');
  });

  it('shows the empty state when there are no requests', () => {
    const { el } = setup(vi.fn().mockReturnValue(of({ ...response, pending: 0, approved: 0, rejected: 0, total: 0, items: [] })));

    expect(el.querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });

  it('refetches when the month changes and shows the no-access state on 403', () => {
    const get = vi.fn().mockReturnValue(of(response));
    const { fixture, store } = setup(get);

    store.setMonth('2026-08');
    fixture.detectChanges();
    expect(get).toHaveBeenLastCalledWith('emp-1', '2026-08-01', '2026-08-31');

    TestBed.resetTestingModule();
    const forbidden = setup(vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 }))));
    expect(forbidden.el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
  });

  it('shows a neutral pending delta against the picked compare month', () => {
    const compare = { ...response, from: '2026-08-01', to: '2026-08-31', pending: 1 };
    const get = vi.fn((_id: string, from: string) => of(from === '2026-08-01' ? compare : response));
    const { fixture, store, el } = setup(get);

    store.setCompareMonth('2026-08');
    fixture.detectChanges();

    const delta = el.querySelector('[data-testid="delta"]')!;
    expect(delta.textContent).toContain('▲ +1');
    expect(delta.classList.contains('delta--neutral')).toBe(true);
  });
});
