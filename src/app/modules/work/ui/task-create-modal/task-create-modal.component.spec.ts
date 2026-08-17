import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskCreateModalComponent } from './task-create-modal.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { Sprint } from '../../models/sprint.model';

describe('TaskCreateModalComponent', () => {
  const sprint: Sprint = {
    id: 'sp-1',
    objectiveId: 'obj-1',
    name: 'Sprint 1',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-14'),
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  function setup(isObjectiveOwner: boolean, createTaskResult: unknown) {
    const createTask = vi.fn().mockResolvedValue(createTaskResult);
    const assignTask = vi.fn().mockReturnValue(of(undefined));
    TestBed.configureTestingModule({
      imports: [TaskCreateModalComponent],
      providers: [
        { provide: TaskBoardStore, useValue: { createTask, error: () => null } },
        {
          provide: TaskApiService,
          useValue: {
            createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
            assignTask
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(TaskCreateModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('isObjectiveOwner', isObjectiveOwner);
    fixture.componentRef.setInput('activeSprints', [sprint]);
    fixture.componentRef.setInput('assignableMembers', [{ employeeId: 'emp-1', name: 'Ada' }]);
    return { fixture, createTask, assignTask };
  }

  it('owner submit calls store.createTask directly', async () => {
    const { fixture, createTask } = setup(true, { id: 't-1', shortId: 'T-1', title: 'New task' });
    fixture.detectChanges();

    await fixture.componentInstance.submit({
      title: 'New task',
      taskType: 'task',
      priority: 'medium',
      sprintId: 'sp-1'
    });

    expect(createTask).toHaveBeenCalledWith('obj-1', expect.objectContaining({ title: 'New task' }));
  });

  it('does not submit until a sprint is selected', async () => {
    const { fixture, createTask } = setup(true, { id: 't-1', shortId: 'T-1', title: 'New task' });
    fixture.detectChanges();
    fixture.componentInstance.title.set('New task');

    await fixture.componentInstance.submit();

    expect(createTask).not.toHaveBeenCalled();
  });

  it('on submit with an assignee selected, calls createTask then assignTask with the returned task id, in order', async () => {
    const order: string[] = [];
    const { fixture, createTask, assignTask } = setup(true, { id: 'task-1', shortId: 'T-1', title: 'New task' });
    createTask.mockImplementation(async () => {
      order.push('create');
      return { id: 'task-1', shortId: 'T-1', title: 'New task' };
    });
    assignTask.mockImplementation(() => {
      order.push('assign');
      return of(undefined);
    });
    fixture.detectChanges();
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.sprintId.set('sp-1');
    fixture.componentInstance.assigneeEmployeeId.set('emp-1');

    await fixture.componentInstance.submit();

    expect(order).toEqual(['create', 'assign']);
    expect(assignTask).toHaveBeenCalledWith('task-1', 'emp-1');
  });

  it('on submit with no assignee selected, calls createTask only, never assignTask', async () => {
    const { fixture, createTask, assignTask } = setup(true, { id: 'task-1', shortId: 'T-1', title: 'New task' });
    fixture.detectChanges();
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.sprintId.set('sp-1');

    await fixture.componentInstance.submit();

    expect(createTask).toHaveBeenCalled();
    expect(assignTask).not.toHaveBeenCalled();
  });
});
