import { TestBed } from '@angular/core/testing';
import { EmployeeSignalItem, EmployeeSignalItemsResponse } from '../../models/employee-overview.model';
import { SignalItemsListComponent } from './signal-items-list.component';

const base: EmployeeSignalItem = {
  kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: '35 min over allowance',
  occurredAt: null, projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null
};
const res = (items: EmployeeSignalItem[], total = items.length): EmployeeSignalItemsResponse =>
  ({ key: 'k', total, timezone: 'Asia/Colombo', items });

function setup(inputs: { response?: EmployeeSignalItemsResponse | null; loading?: boolean; error?: boolean; fullListUrl?: string | null }) {
  TestBed.configureTestingModule({ imports: [SignalItemsListComponent] });
  const fixture = TestBed.createComponent(SignalItemsListComponent);
  fixture.componentRef.setInput('response', inputs.response ?? null);
  fixture.componentRef.setInput('loading', inputs.loading ?? false);
  fixture.componentRef.setInput('error', inputs.error ?? false);
  fixture.componentRef.setInput('fullListUrl', inputs.fullListUrl ?? null);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('SignalItemsListComponent', () => {
  it('shows skeleton rows while loading', () => {
    const { el } = setup({ loading: true });
    expect(el.querySelectorAll('[data-testid="signal-items-skeleton"]').length).toBeGreaterThan(0);
  });

  it('shows an error with a retry button that emits retry', () => {
    const { fixture, el } = setup({ error: true });
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    (el.querySelector('[data-testid="signal-items-retry"]') as HTMLButtonElement).click();
    expect(retry).toHaveBeenCalled();
  });

  it('renders day items and emits itemSelected on click', () => {
    const { fixture, el } = setup({ response: res([base]) });
    const selected = vi.fn();
    fixture.componentInstance.itemSelected.subscribe(selected);
    const row = el.querySelector('[data-testid="signal-item"]') as HTMLButtonElement;
    expect(row.textContent).toContain('Wed 2 Sep');
    expect(row.textContent).toContain('35 min over allowance');
    row.click();
    expect(selected).toHaveBeenCalledWith(base);
  });

  it('groups tasks under their project with a count', () => {
    const t = (id: string, project: string, projectName: string): EmployeeSignalItem =>
      ({ ...base, kind: 'task', id, title: `Task ${id}`, projectId: project, projectName, dueDate: '2026-09-10', subtitle: projectName });
    const { el } = setup({ response: res([t('1', 'p1', 'Apollo'), t('2', 'p2', 'Zeus'), t('3', 'p1', 'Apollo')]) });
    const groups = Array.from(el.querySelectorAll('[data-testid="signal-task-group"]'));
    expect(groups.map((g) => g.querySelector('[data-testid="signal-task-group-name"]')!.textContent!.trim()))
      .toEqual(['Apollo (2)', 'Zeus (1)']);
  });

  it('expands an approval inline with a review link instead of emitting itemSelected', () => {
    const approval: EmployeeSignalItem = { ...base, kind: 'approval', id: 'r-1', title: 'Leave request',
      subtitle: 'Annual · 2026-10-03 → 2026-10-05', approvalKind: 'leave', requestedAt: '2026-09-28T05:00:00Z' };
    const { fixture, el } = setup({ response: res([approval]) });
    const selected = vi.fn();
    fixture.componentInstance.itemSelected.subscribe(selected);

    (el.querySelector('[data-testid="signal-item"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(selected).not.toHaveBeenCalled();
    const review = el.querySelector('[data-testid="approval-review-link"]') as HTMLAnchorElement;
    expect(review.getAttribute('href')).toBe('/time-off/team-approvals');
  });

  it('shows "+N more" with the full-list link when the list is capped', () => {
    const { el } = setup({ response: res([base], 57), fullListUrl: '/attendance/alerts' });
    const more = el.querySelector('[data-testid="signal-items-more"]') as HTMLAnchorElement;
    expect(more.textContent).toContain('+56 more');
    expect(more.getAttribute('href')).toBe('/attendance/alerts');
  });
});
