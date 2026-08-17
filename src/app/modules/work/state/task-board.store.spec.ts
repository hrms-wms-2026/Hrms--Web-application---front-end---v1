import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TaskBoardStore } from './task-board.store';
import { TaskApiService } from '../data-access/task-api.service';

describe('TaskBoardStore', () => {
  function setup(apiOverrides: Partial<TaskApiService> = {}) {
    const api = {
      getStatuses: () => of([{ id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }]),
      getTasks: () => of([{
        id: 't-1', objectiveId: 'obj-1', shortId: 'PRJ-1', title: 'Do it', description: null,
        taskType: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0
      }]),
      moveTaskStatus: () => of(undefined),
      ...apiOverrides
    };

    TestBed.configureTestingModule({
      providers: [TaskBoardStore, { provide: TaskApiService, useValue: api }]
    });
    return TestBed.inject(TaskBoardStore);
  }

  it('loadBoard populates statuses and tasks grouped by column', async () => {
    const store = setup();
    await store.loadBoard('obj-1');

    expect(store.statuses().length).toBe(1);
    expect(store.tasks().length).toBe(1);
    expect(store.columnsWithTasks()[0].tasks.length).toBe(1);
  });

  it('moveTask optimistically updates statusId then confirms via API', async () => {
    const store = setup();
    await store.loadBoard('obj-1');

    await store.moveTask('t-1', 's-2');

    expect(store.tasks()[0].statusId).toBe('s-2');
  });

  it('moveTask reverts local state if the API call fails', async () => {
    const store = setup({ moveTaskStatus: () => throwError(() => ({ error: { detail: 'nope' } })) });
    await store.loadBoard('obj-1');

    await store.moveTask('t-1', 's-2');

    expect(store.tasks()[0].statusId).toBe('s-1');
    expect(store.error()).toBe('nope');
  });
});
