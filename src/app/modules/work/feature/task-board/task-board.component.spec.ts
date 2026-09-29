import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskBoardComponent } from './task-board.component';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';
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

  it('shows all tasks by default and only filters by sprint when explicitly selected', async () => {
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

    // Sprints are not auto-selected; all tasks are shown by default
    let columns = (
      fixture.componentInstance as unknown as { columnsWithTasks: () => { tasks: { id: string }[] }[] }
    ).columnsWithTasks();
    let taskIds = columns.flatMap((c) => c.tasks.map((t) => t.id));
    expect(taskIds).toEqual(['t-in', 't-out']);

    // When the user explicitly selects a sprint, only tasks in that sprint are shown
    (fixture.componentInstance as unknown as { onFilterFieldChanged: (e: { key: string; values: string[] }) => void })
      .onFilterFieldChanged({ key: 'sprint', values: ['sp-active'] });
    fixture.detectChanges();

    columns = (
      fixture.componentInstance as unknown as { columnsWithTasks: () => { tasks: { id: string }[] }[] }
    ).columnsWithTasks();
    taskIds = columns.flatMap((c) => c.tasks.map((t) => t.id));
    expect(taskIds).toEqual(['t-in']);
  });

  it('hides tasks in a Draft sprint under "All sprints", but shows them when that sprint is explicitly selected', async () => {
    const status = { id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public' };
    const inDraftSprint = {
      id: 't-draft', objectiveId: 'milestone-1', shortId: 'PRJ-1', title: 'In draft sprint', description: null,
      categoryId: 'task' as const, statusId: 's-1', priority: 'medium' as const, storyPoints: null,
      dueDate: null, estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: 'sp-draft', assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
    };
    const noSprint = { ...inDraftSprint, id: 't-none', title: 'No sprint', sprintId: null };
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      columnsWithTasks: () => [{ status, tasks: [inDraftSprint, noSprint] }],
      tasks: () => [inDraftSprint, noSprint],
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
              id: 'sp-draft',
              objectiveId: 'milestone-1',
              name: 'Sprint 2',
              startDate: null,
              endDate: null,
              status: 'draft',
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

    // Under the default 'All sprints' filter, the Draft-sprint task is hidden; the sprint-less task stays visible
    let columns = (
      fixture.componentInstance as unknown as { columnsWithTasks: () => { tasks: { id: string }[] }[] }
    ).columnsWithTasks();
    let taskIds = columns.flatMap((c) => c.tasks.map((t) => t.id));
    expect(taskIds).toEqual(['t-none']);

    // Explicitly selecting the Draft sprint still shows its task
    (fixture.componentInstance as unknown as { onFilterFieldChanged: (e: { key: string; values: string[] }) => void })
      .onFilterFieldChanged({ key: 'sprint', values: ['sp-draft'] });
    fixture.detectChanges();

    columns = (
      fixture.componentInstance as unknown as { columnsWithTasks: () => { tasks: { id: string }[] }[] }
    ).columnsWithTasks();
    taskIds = columns.flatMap((c) => c.tasks.map((t) => t.id));
    expect(taskIds).toEqual(['t-draft']);
  });

  it('filters the board by the selected assignees, and shows all when the filter is empty', async () => {
    const status = { id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public' };
    const base = {
      objectiveId: 'milestone-1', shortId: 'PRJ', title: 'T', description: null, categoryId: 'task' as const,
      statusId: 's-1', priority: 'medium' as const, storyPoints: null, dueDate: null, estimatedHours: 5,
      completedHours: 0, progressPercent: 0, sprintId: null, openClockSessionEmployeeId: null,
      openClockSessionClockInAt: null, totalLoggedMinutes: 0, subtaskAssigneeEmployeeIds: [] as string[]
    };
    const t1 = { ...base, id: 't1', assigneeEmployeeIds: ['emp-a'] };
    const t2 = { ...base, id: 't2', assigneeEmployeeIds: ['emp-b'] };
    const t3 = { ...base, id: 't3', assigneeEmployeeIds: [] };
    const t4 = { ...base, id: 't4', assigneeEmployeeIds: [], subtaskAssigneeEmployeeIds: ['emp-a'] };
    const storeStub = {
      loadBoard: vi.fn().mockResolvedValue(undefined),
      columnsWithTasks: () => [{ status, tasks: [t1, t2, t3, t4] }],
      tasks: () => [t1, t2, t3, t4],
      loading: () => false, error: () => null, moveTask: vi.fn(), statuses: () => []
    };

    TestBed.configureTestingModule({
      imports: [TaskBoardComponent],
      providers: [
        { provide: TaskBoardStore, useValue: storeStub },
        { provide: ProjectDetailStore, useValue: {
          milestones: () => [{ objectiveId: 'milestone-1', title: 'M', isOwner: true }],
          getMilestoneDetail: vi.fn().mockResolvedValue(null), loadMyMilestones: vi.fn().mockResolvedValue(undefined),
          loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => []
        }},
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

    const instance = fixture.componentInstance as unknown as {
      setAssigneeFilter: (ids: string[]) => void;
      columnsWithTasks: () => { tasks: { id: string }[] }[];
    };

    instance.setAssigneeFilter(['emp-a']);
    fixture.detectChanges();
    // t4 isn't directly assigned to emp-a, but a subtask of it is - it should still surface
    // under the filter since subtasks aren't independent board cards.
    expect(instance.columnsWithTasks().flatMap((c) => c.tasks.map((t) => t.id))).toEqual(['t1', 't4']);

    instance.setAssigneeFilter([]);
    fixture.detectChanges();
    expect(instance.columnsWithTasks().flatMap((c) => c.tasks.map((t) => t.id))).toEqual(['t1', 't2', 't3', 't4']);
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
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(loadProjectMembers).toHaveBeenCalledWith('project-1');
    const members = (fixture.componentInstance as unknown as { assignableMembers: () => { employeeId: string; name: string; avatarUrl: string | null }[] }).assignableMembers();
    expect(members).toEqual([
      { employeeId: 'emp-1', name: 'Nevi Peiris', avatarUrl: null },
      { employeeId: 'emp-2', name: 'Unknown employee', avatarUrl: null }
    ]);
  });

  it('enriches assignableMembers with avatarUrl from loaded tasks on the board', async () => {
    const storeStub = {
      loadBoard: vi.fn().mockResolvedValue(undefined),
      columnsWithTasks: () => [],
      tasks: () => [
        {
          id: 'task-10',
          shortId: 'HWPORTAL-10',
          title: 'A task',
          assigneeEmployeeIds: ['emp-1'],
          assignees: [{ employeeId: 'emp-1', name: 'Nevi Peiris', avatarUrl: 'https://files.example.test/nevi.png' }]
        }
      ],
      subtasksByParentId: () => ({}),
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
            milestones: () => [],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadMyMilestones: vi.fn().mockResolvedValue(undefined),
            loadProjectMembers: vi.fn().mockResolvedValue(undefined),
            projectMembers: () => [
              { employeeId: 'emp-1', name: 'Nevi Peiris', pending: false, isHead: false }
            ]
          }
        },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskApiService, useValue: { createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const members = (fixture.componentInstance as unknown as { assignableMembers: () => { employeeId: string; name: string; avatarUrl: string | null }[] }).assignableMembers();
    expect(members).toEqual([
      { employeeId: 'emp-1', name: 'Nevi Peiris', avatarUrl: 'https://files.example.test/nevi.png' }
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

  it('opens the task modal in edit mode when a card is viewed, and create mode from the toolbar', async () => {
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

    const inst = fixture.componentInstance as unknown as {
      onTaskViewed: (t: unknown) => void;
      goToCreate: () => void;
      taskModalOpen: () => boolean;
      taskModalMode: () => string;
      taskModalTaskId: () => string;
    };

    inst.onTaskViewed({ id: 't-9', objectiveId: 'milestone-1' });
    expect(inst.taskModalOpen()).toBe(true);
    expect(inst.taskModalMode()).toBe('edit');
    expect(inst.taskModalTaskId()).toBe('t-9');

    inst.goToCreate();
    expect(inst.taskModalMode()).toBe('create');
    expect(inst.taskModalTaskId()).toBe('');
    expect(inst.taskModalOpen()).toBe(true);
  });

  it('creates task, assigns, moves status and reloads board when onQuickTaskCreated is invoked', async () => {
    const createTask = vi.fn().mockResolvedValue({ id: 't-new', statusId: 's-default' });
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const storeStub = {
      loadBoard,
      createTask,
      columnsWithTasks: () => [],
      tasks: () => [],
      loading: () => false,
      error: () => null,
      moveTask: vi.fn(),
      statuses: () => []
    };
    const taskApiStub = {
      createTaskCreationRequest: vi.fn(),
      assignTask: vi.fn().mockReturnValue(of(undefined)),
      moveTaskStatus: vi.fn().mockReturnValue(of(undefined)),
      getCategories: vi.fn().mockReturnValue(of([]))
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
        { provide: TaskApiService, useValue: taskApiStub },
        { provide: EmployeeDirectoryStore, useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) } },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const resolveSpy = vi.fn();
    await fixture.componentInstance.onQuickTaskCreated({
      title: 'Quick Task 1',
      statusId: 's-custom',
      priority: 'high',
      assigneeId: 'emp-1',
      objectiveId: 'milestone-1',
      categoryId: 'cat-1',
      resolve: resolveSpy
    });

    expect(createTask).toHaveBeenCalledWith('milestone-1', expect.objectContaining({
      title: 'Quick Task 1',
      priority: 'high',
      categoryId: 'cat-1'
    }));
    expect(taskApiStub.assignTask).toHaveBeenCalledWith('t-new', 'emp-1');
    expect(taskApiStub.moveTaskStatus).toHaveBeenCalledWith('t-new', 's-custom');
    expect(resolveSpy).toHaveBeenCalledWith(true);
  });

  it('opens BoardStructureEditorComponent when editStatusesClicked is emitted from column', async () => {
    const status = {
      id: 's-1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public'
    };
    const storeStub = {
      loadBoard: vi.fn().mockResolvedValue(undefined),
      columnsWithTasks: () => [{ status, tasks: [] }],
      tasks: () => [],
      loading: () => false,
      error: () => null,
      moveTask: vi.fn(),
      statuses: () => [status]
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
        { provide: TaskApiService, useValue: { getStatuses: vi.fn().mockReturnValue(of([])), createTaskCreationRequest: vi.fn(), assignTask: vi.fn(), getCategories: vi.fn().mockReturnValue(of([])) } },
        { provide: EmployeeDirectoryStore, useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) } },
        { provide: ActivatedRoute, useValue: routeStub() },
        { provide: Router, useValue: { navigate: vi.fn() } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBoardComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance['boardStructureEditorOpen']()).toBe(false);

    const column = fixture.debugElement.query(By.directive(TaskBoardColumnComponent));
    expect(column).not.toBeNull();
    column.componentInstance.editStatusesClicked.emit();
    fixture.detectChanges();

    expect(fixture.componentInstance['boardStructureEditorOpen']()).toBe(true);
  });
});

