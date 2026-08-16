import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { TaskBacklogComponent } from './task-backlog.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';

describe('TaskBacklogComponent', () => {
  it('loads the board for the current milestoneId on init', async () => {
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      tasks: () => [],
      statuses: () => [],
      loading: () => false,
      error: () => null
    };
    const projectStoreStub = {
      milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
      getMilestoneDetail: vi.fn().mockResolvedValue(null)
    };

    TestBed.configureTestingModule({
      imports: [TaskBacklogComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        { provide: ProjectDetailStore, useValue: projectStoreStub },
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadBoard).toHaveBeenCalledWith('milestone-1');
  });
});
