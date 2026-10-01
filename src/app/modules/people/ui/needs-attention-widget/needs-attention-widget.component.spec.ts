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
    return { el: fixture.nativeElement as HTMLElement, get };
  }

  it('lists tasks with their issue, status, points and a board link', () => {
    const { el, get } = setup({ asOf: '2026-09-15', totalCount: 1, items: [item] });

    expect(get).toHaveBeenCalledWith('emp-1');
    const row = el.querySelector('[data-testid="attention-row"]')!;
    expect(row.textContent).toContain('Engine specification');
    expect(row.textContent).toContain('Watercraft Platform');
    expect(row.textContent).toContain('2 days overdue');
    expect(row.textContent).toContain('In Progress');
    expect(row.textContent).toContain('5');
    const link = row.querySelector('a')!;
    expect(link.getAttribute('href')).toContain('/work/p-1/board');
    expect(link.getAttribute('href')).toContain('highlightTaskId=t-1');
  });

  it('shows how many more there are beyond the first five', () => {
    const { el } = setup({ asOf: '2026-09-15', totalCount: 8, items: [item] });
    expect(el.textContent).toContain('+7 more');
  });

  it('shows the empty state when nothing needs attention', () => {
    const { el } = setup({ asOf: '2026-09-15', totalCount: 0, items: [] });
    expect(el.querySelector('[data-testid="widget-empty"]')!.textContent).toContain(
      'Nothing overdue or due in the next 3 days'
    );
  });
});
