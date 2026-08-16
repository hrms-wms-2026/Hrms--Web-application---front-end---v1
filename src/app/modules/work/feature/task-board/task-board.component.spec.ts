import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { TaskBoardComponent } from './task-board.component';
import { TaskBoardStore } from '../../state/task-board.store';

describe('TaskBoardComponent', () => {
  it('loads the board for the current milestoneId on init', async () => {
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      columnsWithTasks: () => [],
      loading: () => false,
      error: () => null,
      moveTask: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadBoard).toHaveBeenCalledWith('milestone-1');
  });
});
