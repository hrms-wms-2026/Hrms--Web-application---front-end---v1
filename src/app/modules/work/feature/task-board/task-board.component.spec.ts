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
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('TaskBoardComponent', () => {
  it('loads the board for the current milestoneId on init', async () => {
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      columnsWithTasks: () => [],
      tasks: () => [],
      loading: () => false,
      error: () => null,
      moveTask: vi.fn(),
      statuses: () => []
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
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
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

  it('columnsWithTasks only includes tasks whose sprintId is one of the active sprints', async () => {
    const status = {
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public'
    };
    const inSprint = {
      id: 't-in', objectiveId: 'milestone-1', shortId: 'PRJ-1', title: 'In sprint', description: null,
      categoryId: 'task' as const, statusId: 's-1', priority: 'medium' as const, storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: 'sp-active', assigneeEmployeeIds: []
    };
    const outSprint = { ...inSprint, id: 't-out', title: 'Out of sprint', sprintId: 'sp-other' };
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      columnsWithTasks: () => [{ status, tasks: [inSprint, outSprint] }],
      tasks: () => [inSprint, outSprint],
      loading: () => false,
      error: () => null,
      moveTask: vi.fn(),
      statuses: () => []
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null)
          }
        },
        {
          provide: SprintApiService,
          useValue: {
            getByObjective: vi.fn().mockReturnValue(of([{
              id: 'sp-active',
              objectiveId: 'milestone-1',
              name: 'Sprint 1',
              startDate: '2026-09-01',
              endDate: '2026-09-14',
              status: 'active',
              completedAt: null,
              achievedAt: null
            }]))
          }
        },
        { provide: ObjectiveMemberApiService, useValue: { getMembers: vi.fn().mockReturnValue(of({ items: [] })) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn() } },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
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
    fixture.detectChanges();

    const columns = (
      fixture.componentInstance as unknown as { columnsWithTasks: () => { tasks: { id: string }[] }[] }
    ).columnsWithTasks();
    const taskIds = columns.flatMap((c) => c.tasks.map((t) => t.id));
    expect(taskIds).toEqual(['t-in']);
  });

  it('resolves assignableMembers names from the employee directory instead of the raw employeeId', async () => {
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      columnsWithTasks: () => [],
      tasks: () => [],
      loading: () => false,
      error: () => null,
      moveTask: vi.fn(),
      statuses: () => []
    };
    const directoryGet = vi.fn((id: string) => (id === 'emp-1' ? { id, name: 'Nevi Peiris', initials: 'NP', avatarUrl: null } : undefined));
    const directoryEnsureLoaded = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null)
          }
        },
        { provide: SprintApiService, useValue: { getByObjective: vi.fn().mockReturnValue(of([])) } },
        {
          provide: ObjectiveMemberApiService,
          useValue: {
            getMembers: vi.fn().mockReturnValue(of({
              items: [
                { employeeId: 'emp-1', pending: false, isHead: false },
                { employeeId: 'emp-2', pending: false, isHead: false }
              ]
            }))
          }
        },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn() } },
        { provide: EmployeeDirectoryStore, useValue: { get: directoryGet, ensureLoaded: directoryEnsureLoaded } },
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
    await fixture.whenStable();

    expect(directoryEnsureLoaded).toHaveBeenCalledWith(['emp-1', 'emp-2']);
    const members = (fixture.componentInstance as unknown as { assignableMembers: () => { employeeId: string; name: string }[] }).assignableMembers();
    expect(members).toEqual([
      { employeeId: 'emp-1', name: 'Nevi Peiris' },
      { employeeId: 'emp-2', name: 'Unknown employee' }
    ]);
    expect(members.find((m) => m.employeeId === 'emp-1')?.name).not.toBe('emp-1');
    expect(members.find((m) => m.employeeId === 'emp-2')?.name).not.toBe('emp-2');
  });
});
