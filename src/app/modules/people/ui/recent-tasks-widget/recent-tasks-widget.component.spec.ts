import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { RecentTasksWidgetComponent } from './recent-tasks-widget.component';

describe('RecentTasksWidgetComponent', () => {
  function setup(items: unknown[]) {
    TestBed.configureTestingModule({
      imports: [RecentTasksWidgetComponent],
      providers: [
        provideRouter([]),
        { provide: PeopleApiService, useValue: { getWorkActivityRecentTasks: vi.fn().mockReturnValue(of({ items })) } }
      ]
    });
    const fixture = TestBed.createComponent(RecentTasksWidgetComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture;
  }

  const task = (i: number) => ({
    taskId: `t-${i}`,
    shortId: null,
    title: `Task ${i}`,
    projectId: 'p-1',
    projectName: 'P',
    statusName: 'To Do',
    statusColor: null,
    priority: 'low',
    storyPoints: null,
    dueDate: null,
    progressPercent: 0,
    updatedToday: false
  });

  it('tags tasks changed today with "Updated today"', () => {
    const el = setup([{ ...task(1), updatedToday: true }, task(2)]).nativeElement as HTMLElement;
    const rows = el.querySelectorAll('[data-testid="recent-row"]');

    expect(rows[0].querySelector('[data-testid="recent-updated-today"]')!.textContent).toContain('Updated today');
    expect(rows[1].querySelector('[data-testid="recent-updated-today"]')).toBeNull();
  });

  it('shows task, project, status, priority, due and points', () => {
    const el = setup([
      {
        taskId: 't-1',
        shortId: 'WEB-1',
        title: 'UI refinement',
        projectId: 'p-1',
        projectName: 'Design System',
        statusName: 'In Progress',
        statusColor: '#2563EB',
        priority: 'medium',
        storyPoints: 5,
        dueDate: '2026-09-16',
        progressPercent: 40
      }
    ]).nativeElement as HTMLElement;

    const row = el.querySelector('[data-testid="recent-row"]')!.textContent!;
    expect(row).toContain('UI refinement');
    expect(row).toContain('Design System');
    expect(row).toContain('In Progress');
    expect(row).toContain('Medium');
    expect(row).toContain('Sep 16');
    expect(row).toContain('5');
  });

  it('shows 3 rows, then View all pops out the rest and Show less collapses', () => {
    const fixture = setup(Array.from({ length: 8 }, (_, i) => task(i)));
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => el.querySelectorAll('[data-testid="recent-row"]').length;
    const btn = () => el.querySelector<HTMLButtonElement>('[data-testid="recent-view-all"]')!;

    expect(rows()).toBe(3);
    expect(btn().textContent).toContain('View all');

    btn().click();
    fixture.detectChanges();
    expect(rows()).toBe(8);
    expect(btn().textContent).toContain('Show less');

    btn().click();
    fixture.detectChanges();
    expect(rows()).toBe(3);
  });

  it('hides View all when there are 3 or fewer tasks', () => {
    const el = setup(Array.from({ length: 3 }, (_, i) => task(i))).nativeElement as HTMLElement;
    expect(el.querySelectorAll('[data-testid="recent-row"]').length).toBe(3);
    expect(el.querySelector('[data-testid="recent-view-all"]')).toBeNull();
  });

  it('shows the empty state with no tasks', () => {
    expect((setup([]).nativeElement as HTMLElement).querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });
});
