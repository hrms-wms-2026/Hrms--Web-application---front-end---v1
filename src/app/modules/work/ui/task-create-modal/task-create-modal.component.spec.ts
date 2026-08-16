import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TaskCreateModalComponent } from './task-create-modal.component';
import { TaskBoardStore } from '../../state/task-board.store';

describe('TaskCreateModalComponent', () => {
  function setup(isObjectiveOwner: boolean, createTaskResult: unknown) {
    const createTask = vi.fn().mockResolvedValue(createTaskResult);
    TestBed.configureTestingModule({
      imports: [TaskCreateModalComponent],
      providers: [{ provide: TaskBoardStore, useValue: { createTask, error: () => null } }]
    });
    const fixture = TestBed.createComponent(TaskCreateModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('isObjectiveOwner', isObjectiveOwner);
    return { fixture, createTask };
  }

  it('owner submit calls store.createTask directly', async () => {
    const { fixture, createTask } = setup(true, { id: 't-1', shortId: 'T-1', title: 'New task' });
    fixture.detectChanges();

    await fixture.componentInstance.submit({ title: 'New task', taskType: 'task', priority: 'medium' });

    expect(createTask).toHaveBeenCalledWith('obj-1', expect.objectContaining({ title: 'New task' }));
  });
});
