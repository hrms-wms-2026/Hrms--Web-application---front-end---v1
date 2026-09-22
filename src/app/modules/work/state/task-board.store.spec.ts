import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TaskBoardStore } from './task-board.store';
import { TaskApiService } from '../data-access/task-api.service';

describe('TaskBoardStore', () => {
  function setup(apiOverrides: Partial<TaskApiService> = {}) {
    const api = {
      getStatuses: () => of([{ id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }]),
      getTasksByProject: () => of([{
        id: 't-1', objectiveId: 'obj-1', shortId: 'PRJ-1', title: 'Do it', description: null,
        categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null
      }]),
      moveTaskStatus: () => of(undefined),
      getSubtasks: () => of([]),
      createSubtask: () => of({} as any),
      ...apiOverrides
    };

    TestBed.configureTestingModule({
      providers: [TaskBoardStore, { provide: TaskApiService, useValue: api }]
    });
    return TestBed.inject(TaskBoardStore);
  }

  it('loadBoard populates statuses and tasks grouped by column', async () => {
    const store = setup();
    await store.loadBoard('proj-1');

    expect(store.statuses().length).toBe(1);
    expect(store.tasks().length).toBe(1);
    expect(store.columnsWithTasks()[0].tasks.length).toBe(1);
  });

  it('moveTask optimistically updates statusId then confirms via API', async () => {
    const store = setup();
    await store.loadBoard('proj-1');

    await store.moveTask('t-1', 's-2');

    expect(store.tasks()[0].statusId).toBe('s-2');
  });

  it('moveTask reverts local state if the API call fails', async () => {
    const store = setup({ moveTaskStatus: () => throwError(() => ({ error: { detail: 'nope' } })) });
    await store.loadBoard('proj-1');

    await store.moveTask('t-1', 's-2');

    expect(store.tasks()[0].statusId).toBe('s-1');
    expect(store.error()).toBe('nope');
  });

  it('loadSubtasks populates subtasksByParentId for that parent', async () => {
    const store = setup({
      getSubtasks: () => of([{
        id: 'sub-1', objectiveId: 'obj-1', shortId: 'PRJ-2', title: 'Sub', description: null,
        categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: null,
        parentTaskId: 't-1', subtaskTotalCount: 0, subtaskCompletedCount: 0
      }] as any)
    });

    await store.loadSubtasks('t-1');

    expect(store.subtasksByParentId()['t-1'].length).toBe(1);
    expect(store.subtasksByParentId()['t-1'][0].title).toBe('Sub');
  });

  it('createSubtask increments the parent task subtaskTotalCount using the real response', async () => {
    const store = setup({
      createSubtask: () => of({
        id: 'sub-1', objectiveId: 'obj-1', shortId: 'PRJ-2', title: 'Sub', description: null,
        categoryId: 'task', statusId: 's-1', priority: 'medium', storyPoints: null,
        dueDate: null, estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: null,
        parentTaskId: 't-1', subtaskTotalCount: 0, subtaskCompletedCount: 0
      } as any)
    });
    await store.loadBoard('proj-1');

    const created = await store.createSubtask('t-1', { title: 'Sub' } as any);

    expect(created?.title).toBe('Sub');
    expect(store.subtasksByParentId()['t-1'].length).toBe(1);
    expect(store.tasks().find((t) => t.id === 't-1')?.subtaskTotalCount).toBe(1);
  });
});
