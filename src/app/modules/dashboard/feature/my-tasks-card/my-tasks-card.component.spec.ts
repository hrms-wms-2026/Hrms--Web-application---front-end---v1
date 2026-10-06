import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MyTasksApiService } from '../../data-access/my-tasks-api.service';
import { MyTaskItem, MyTasksResponse } from '../../models/my-tasks.model';
import { MyTasksCardComponent } from './my-tasks-card.component';

function makeTask(overrides: Partial<MyTaskItem> = {}): MyTaskItem {
  return {
    taskId: 'task-1',
    shortId: 'T-1',
    title: 'Fix login bug',
    dueDate: '2026-08-20',
    isOverdue: false,
    projectId: 'project-1',
    projectName: 'Acme Website',
    objectiveId: 'objective-1',
    priority: 'high',
    ...overrides
  };
}

describe('MyTasksCardComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function setup(response: MyTasksResponse | 'error' = { tasks: [] }): Promise<{
    fixture: ComponentFixture<MyTasksCardComponent>;
    getMyTasks: ReturnType<typeof vi.fn>;
  }> {
    const getMyTasks = vi.fn(() => (response === 'error' ? throwError(() => new Error('network error')) : of(response)));

    await TestBed.configureTestingModule({
      imports: [MyTasksCardComponent],
      providers: [provideRouter([]), { provide: MyTasksApiService, useValue: { getMyTasks } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(MyTasksCardComponent);
    fixture.detectChanges();
    return { fixture, getMyTasks };
  }

  it('loads tasks on init', async () => {
    const { getMyTasks } = await setup();
    expect(getMyTasks).toHaveBeenCalledOnce();
  });

  it('shows the empty state when there are no tasks', async () => {
    const { fixture } = await setup({ tasks: [] });
    expect(fixture.nativeElement.querySelector('[data-testid="my-tasks-empty"]')).not.toBeNull();
  });

  it('splits tasks into overdue and due-soon sections', async () => {
    const { fixture } = await setup({
      tasks: [
        makeTask({ taskId: 'overdue-1', isOverdue: true, title: 'Overdue task' }),
        makeTask({ taskId: 'upcoming-1', isOverdue: false, title: 'Upcoming task' })
      ]
    });

    const overdueList = fixture.nativeElement.querySelector('[data-testid="my-tasks-overdue-list"]');
    const upcomingList = fixture.nativeElement.querySelector('[data-testid="my-tasks-upcoming-list"]');
    expect(overdueList?.textContent).toContain('Overdue task');
    expect(upcomingList?.textContent).toContain('Upcoming task');
    expect(fixture.nativeElement.querySelector('[data-testid="my-tasks-empty"]')).toBeNull();
  });

  it('links each task row to its detail modal on the project board', async () => {
    const { fixture } = await setup({ tasks: [makeTask()] });

    const row: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="my-tasks-row"]');
    expect(row.getAttribute('href')).toBe('/work/project-1/board?taskId=task-1');
  });

  it('falls back to the empty state when the request fails', async () => {
    const { fixture } = await setup('error');
    expect(fixture.nativeElement.querySelector('[data-testid="my-tasks-empty"]')).not.toBeNull();
  });

  it('shows at most 4 tasks total, overdue first', async () => {
    const overdue = Array.from({ length: 3 }, (_, i) => makeTask({ taskId: `overdue-${i}`, isOverdue: true, title: `Overdue ${i}` }));
    const upcoming = Array.from({ length: 5 }, (_, i) => makeTask({ taskId: `upcoming-${i}`, isOverdue: false, title: `Upcoming ${i}` }));
    const { fixture } = await setup({ tasks: [...overdue, ...upcoming] });

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="my-tasks-row"]');
    expect(rows.length).toBe(4);
    // 3 overdue slots filled first, only 1 upcoming slot left
    expect(fixture.nativeElement.querySelectorAll('[data-testid="my-tasks-overdue-list"] [data-testid="my-tasks-row"]').length).toBe(3);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="my-tasks-upcoming-list"] [data-testid="my-tasks-row"]').length).toBe(1);
  });

  it('links "View all tasks" to the most urgent task\'s project board', async () => {
    const { fixture } = await setup({
      tasks: [
        makeTask({ taskId: 'overdue-1', isOverdue: true, projectId: 'project-9', objectiveId: 'objective-9' }),
        makeTask({ taskId: 'upcoming-1', isOverdue: false })
      ]
    });

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="my-tasks-view-all-link"]');
    expect(link.getAttribute('href')).toBe('/work/project-9/board');
  });

  it('does not show "View all tasks" when there are no tasks', async () => {
    const { fixture } = await setup({ tasks: [] });
    expect(fixture.nativeElement.querySelector('[data-testid="my-tasks-view-all-link"]')).toBeNull();
  });

  it('shows a "+N more" count when there are more tasks than the visible cap', async () => {
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask({ taskId: `task-${i}`, isOverdue: false }));
    const { fixture } = await setup({ tasks });

    const hiddenCount: HTMLElement = fixture.nativeElement.querySelector('[data-testid="my-tasks-hidden-count"]');
    expect(hiddenCount.textContent).toContain('+2 more');
  });

  it('does not show a "+N more" count when all tasks fit within the visible cap', async () => {
    const { fixture } = await setup({ tasks: [makeTask()] });
    expect(fixture.nativeElement.querySelector('[data-testid="my-tasks-hidden-count"]')).toBeNull();
  });
});
