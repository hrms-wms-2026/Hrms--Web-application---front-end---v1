import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { NeedsAttentionWidgetComponent } from './needs-attention-widget.component';

describe('NeedsAttentionWidgetComponent', () => {
  const item = {
    taskId: 't-1',
    shortId: 'WEB-1',
    title: 'Engine specification',
    projectId: 'p-1',
    projectName: 'Watercraft Platform',
    statusName: 'In Progress',
    statusColor: '#2563EB',
    storyPoints: 5,
    dueDate: '2026-09-13',
    reason: 'overdue' as const,
    overdueDays: 2,
    daysUntilDue: null
  };

  function setup(response: unknown) {
    const get = vi.fn().mockReturnValue(of(response));
    TestBed.configureTestingModule({
      imports: [NeedsAttentionWidgetComponent],
      providers: [provideRouter([]), { provide: PeopleApiService, useValue: { getWorkActivityNeedsAttention: get } }]
    });
    const fixture = TestBed.createComponent(NeedsAttentionWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, get };
  }

  const many = (n: number) => Array.from({ length: n }, (_, i) => ({ ...item, taskId: `t-${i}`, title: `Task ${i}` }));

  it('lists tasks with their issue, status, points and a board link', () => {
    const { el, get } = setup({ asOf: '2026-09-15', totalCount: 1, items: [item] });

    expect(get).toHaveBeenCalledWith('emp-1');
    const row = el.querySelector('[data-testid="attention-row"]')!;
    expect(row.textContent).toContain('Engine specification');
    expect(row.textContent).toContain('Watercraft Platform');
    expect(row.textContent).toContain('2 days overdue');
    expect(row.textContent).toContain('In Progress');
    expect(row.textContent).toContain('WEB-1');
    expect(row.getAttribute('href')).toContain('/work/p-1/board');
    expect(row.getAttribute('href')).toContain('highlightTaskId=t-1');
  });

  it('shows three rows, and View all expands to every item', () => {
    const { fixture, el } = setup({ asOf: '2026-09-15', totalCount: 8, items: many(8) });
    expect(el.querySelectorAll('[data-testid="attention-row"]').length).toBe(3);

    const toggle = el.querySelector<HTMLButtonElement>('[data-testid="attention-toggle"]')!;
    expect(toggle.textContent).toContain('View all');
    toggle.click();
    fixture.detectChanges();

    expect(el.querySelectorAll('[data-testid="attention-row"]').length).toBe(8);
    expect(toggle.textContent).toContain('Show less');
  });

  it('always offers View all, even when every item already fits', () => {
    const { el } = setup({ asOf: '2026-09-15', totalCount: 3, items: many(3) });
    expect(el.querySelectorAll('[data-testid="attention-row"]').length).toBe(3);
    expect(el.querySelector('[data-testid="attention-toggle"]')!.textContent).toContain('View all');
  });

  it('shows the empty state when nothing needs attention', () => {
    const { el } = setup({ asOf: '2026-09-15', totalCount: 0, items: [] });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain(
      'Nothing overdue or due in the next 3 days'
    );
  });
});
