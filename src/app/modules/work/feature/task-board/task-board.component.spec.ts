import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskBoardComponent } from './task-board.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { TaskApiService } from '../../data-access/task-api.service';

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
    const projectStoreStub = {
      milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
      getMilestoneDetail: vi.fn().mockResolvedValue(null)
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        { provide: ProjectDetailStore, useValue: projectStoreStub },
        { provide: SprintApiService, useValue: { getByObjective: vi.fn().mockReturnValue(of([])) } },
        { provide: ObjectiveMemberApiService, useValue: { getMembers: vi.fn().mockReturnValue(of({ items: [] })) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } },
            snapshot: { queryParamMap: { get: () => null } }
          }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadBoard).toHaveBeenCalledWith('milestone-1');
  });
});
