import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskBoardComponent } from './task-board.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('TaskBoardComponent', () => {
  function routeStub() {
    return {
      snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'project-1' : null) }, queryParamMap: { get: () => null } }
    };
  }

  it('loads the board for the routed project id on init', async () => {
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
      milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      loadProjectMembers: vi.fn().mockResolvedValue(undefined),
      projectMembers: () => []
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        { provide: ProjectDetailStore, useValue: projectStoreStub },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadBoard).toHaveBeenCalledWith('project-1');
  });

  it('columnsWithTasks only includes tasks whose sprintId is one of the active sprints', async () => {
    const status = {
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public'
    };
    const inSprint = {
      id: 't-in', objectiveId: 'milestone-1', shortId: 'PRJ-1', title: 'In sprint', description: null,
      categoryId: 'task' as const, statusId: 's-1', priority: 'medium' as const, storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: 'sp-active', assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
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
            milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadMyMilestones: vi.fn().mockResolvedValue(undefined),
            loadProjectMembers: vi.fn().mockResolvedValue(undefined),
            projectMembers: () => []
          }
        },
        {
          provide: SprintApiService,
          useValue: {
            getByProject: vi.fn().mockReturnValue(of([{
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
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
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

  it('sprint filter "Individual task" shows only tasks with no sprint assigned', async () => {
    const status = {
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public'
    };
    const base = {
      objectiveId: 'milestone-1', shortId: 'PRJ-1', description: null,
      categoryId: 'task' as const, statusId: 's-1', priority: 'medium' as const, storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
    };
    const individualTask = { ...base, id: 't-individual', title: 'Individual', sprintId: null };
    const sprintTask = { ...base, id: 't-sprint', title: 'In sprint', sprintId: 'sp-active' };
    const storeStub = {
      loadBoard: vi.fn().mockResolvedValue(undefined),
      columnsWithTasks: () => [{ status, tasks: [individualTask, sprintTask] }],
      tasks: () => [individualTask, sprintTask],
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
            milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadMyMilestones: vi.fn().mockResolvedValue(undefined),
            loadProjectMembers: vi.fn().mockResolvedValue(undefined),
            projectMembers: () => []
          }
        },
        {
          provide: SprintApiService,
          useValue: {
            getByProject: vi.fn().mockReturnValue(of([{
              id: 'sp-active', objectiveId: 'milestone-1', name: 'Sprint 1',
              startDate: '2026-09-01', endDate: '2026-09-14', status: 'active', completedAt: null, achievedAt: null
            }]))
          }
        },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const instance = fixture.componentInstance as unknown as {
      sprintFilter: { set: (v: string) => void };
      columnsWithTasks: () => { tasks: { id: string }[] }[];
    };
    instance.sprintFilter.set('individual');
    fixture.detectChanges();

    const taskIds = instance.columnsWithTasks().flatMap((c) => c.tasks.map((t) => t.id));
    expect(taskIds).toEqual(['t-individual']);
  });

  it('builds assignableMembers from projectMembers, using the server-resolved name', async () => {
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
    // Still exercised: employeeNames (existing task-card assignees, a separate concern from the
    // create-task dropdown) still resolves via the directory, since WorkTaskResponse only carries
    // raw EmployeeId GUIDs.
    const directoryEnsureLoaded = vi.fn().mockResolvedValue(undefined);
    const loadProjectMembers = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadMyMilestones: vi.fn().mockResolvedValue(undefined),
            loadProjectMembers,
            projectMembers: () => [
              { employeeId: 'emp-1', name: 'Nevi Peiris', pending: false, isHead: false },
              { employeeId: 'emp-2', name: null, pending: false, isHead: false }
            ]
          }
        },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        { provide: EmployeeDirectoryStore, useValue: { get: vi.fn(), ensureLoaded: directoryEnsureLoaded } },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(loadProjectMembers).toHaveBeenCalledWith('project-1');
    expect(directoryEnsureLoaded).toHaveBeenCalledWith(['emp-1', 'emp-2']);
    const members = (fixture.componentInstance as unknown as { assignableMembers: () => { employeeId: string; name: string }[] }).assignableMembers();
    expect(members).toEqual([
      { employeeId: 'emp-1', name: 'Nevi Peiris' },
      { employeeId: 'emp-2', name: 'Unknown employee' }
    ]);
  });

  it('shows store.error() as a retryable error state, and Retry calls loadBoard again', async () => {
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const errorValues = ['Failed to load the board.', null] as const;
    let errorIndex = 0;
    const storeStub = {
      loadBoard,
      columnsWithTasks: () => [],
      tasks: () => [],
      loading: () => false,
      error: () => errorValues[errorIndex],
      moveTask: vi.fn(),
      statuses: () => []
    };
    const projectStoreStub = {
      milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      loadProjectMembers: vi.fn().mockResolvedValue(undefined),
      projectMembers: () => []
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        { provide: ProjectDetailStore, useValue: projectStoreStub },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Failed to load the board.');

    loadBoard.mockClear();
    const retryButton = alert.querySelector('button') as HTMLButtonElement;
    retryButton.click();

    expect(loadBoard).toHaveBeenCalledWith('project-1');
  });

  it('navigates to the task detail page when a card is viewed', async () => {
    const storeStub = {
      loadBoard: vi.fn().mockResolvedValue(undefined),
      columnsWithTasks: () => [],
      tasks: () => [],
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
            milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadMyMilestones: vi.fn().mockResolvedValue(undefined),
            loadProjectMembers: vi.fn().mockResolvedValue(undefined),
            projectMembers: () => []
          }
        },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        { provide: EmployeeDirectoryStore, useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) } },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.onTaskViewed({ id: 't-9', objectiveId: 'milestone-1' } as never);

    expect(navigate).toHaveBeenCalledWith(['/work', 'project-1', 'task', 't-9']);

    (fixture.componentInstance as unknown as { goToCreate: () => void }).goToCreate();
    expect(navigate).toHaveBeenCalledWith(['/work', 'project-1', 'task', 'new']);
  });
});
