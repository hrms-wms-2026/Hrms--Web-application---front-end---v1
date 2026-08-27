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

  it('links each task row to its project/objective my-task page', async () => {
    const { fixture } = await setup({ tasks: [makeTask()] });

    const row: HTMLAnchorElement = fixture.nativeElement.querySelector('[data-testid="my-tasks-row"]');
    expect(row.getAttribute('href')).toBe('/work/project-1/milestones/objective-1/my-task');
  });

  it('falls back to the empty state when the request fails', async () => {
    const { fixture } = await setup('error');
    expect(fixture.nativeElement.querySelector('[data-testid="my-tasks-empty"]')).not.toBeNull();
  });
});
