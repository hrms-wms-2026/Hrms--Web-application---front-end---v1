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
    return fixture.nativeElement as HTMLElement;
  }

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
    ]);

    const row = el.querySelector('[data-testid="recent-row"]')!.textContent!;
    expect(row).toContain('UI refinement');
    expect(row).toContain('Design System');
    expect(row).toContain('In Progress');
    expect(row).toContain('Medium');
    expect(row).toContain('Sep 16');
    expect(row).toContain('5');
  });

  it('shows the empty state with no tasks', () => {
    expect(setup([]).querySelector('[data-testid="widget-empty"]')).toBeTruthy();
  });
});
