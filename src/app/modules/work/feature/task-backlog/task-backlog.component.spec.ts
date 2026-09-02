import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { TaskBacklogComponent } from './task-backlog.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

describe('TaskBacklogComponent', () => {
  const sprint1: Sprint = {
    id: 'sp-1',
    objectiveId: 'milestone-1',
    name: 'Sprint One',
    startDate: new Date('2026-08-17'),
    endDate: new Date('2026-08-31'),
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  const sprint2: Sprint = {
    id: 'sp-2',
    objectiveId: 'milestone-1',
    name: 'Sprint Two',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-14'),
    status: 'future',
    completedAt: null,
    achievedAt: null
  };

  function makeTask(id: string, sprintId: string | null): WorkTask {
    return {
      id,
      objectiveId: 'milestone-1',
      shortId: `T-${id}`,
      title: `Task ${id}`,
      description: null,
      categoryId: 'task',
      statusId: 'status-1',
      priority: 'medium',
      storyPoints: null,
      dueDate: null,
      estimatedHours: null,
      completedHours: 0,
      progressPercent: 0,
      sprintId,
      assigneeEmployeeIds: [], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
    };
  }

  function setup(options: {
    isOwner?: boolean;
    sprints?: Sprint[];
    tasks?: WorkTask[];
    sprintCreate?: ReturnType<typeof vi.fn>;
    sprintsSignal?: ReturnType<typeof signal<Sprint[]>>;
    sprintErrorSignal?: ReturnType<typeof signal<string | null>>;
    sprintComplete?: ReturnType<typeof vi.fn>;
    sprintAchieve?: ReturnType<typeof vi.fn>;
    sprintSetStatus?: ReturnType<typeof vi.fn>;
    taskErrorSignal?: ReturnType<typeof signal<string | null>>;
  } = {}) {
    const isOwner = options.isOwner ?? true;
    const sprintsSignal = options.sprintsSignal ?? signal<Sprint[]>(options.sprints ?? [sprint1, sprint2]);
    const sprintErrorSignal = options.sprintErrorSignal ?? signal<string | null>(null);
    const taskErrorSignal = options.taskErrorSignal ?? signal<string | null>(null);
    const loadBoard = vi.fn().mockResolvedValue(undefined);
    const moveTask = vi.fn().mockResolvedValue(undefined);
    const loadForProject = vi.fn().mockResolvedValue(undefined);
    const sprintCreate = options.sprintCreate ?? vi.fn().mockResolvedValue(true);
    const sprintComplete = options.sprintComplete ?? vi.fn().mockResolvedValue(true);
    const sprintAchieve = options.sprintAchieve ?? vi.fn().mockResolvedValue(true);
    const sprintSetStatus = options.sprintSetStatus ?? vi.fn().mockResolvedValue(true);
    const loadProjectMembers = vi.fn().mockResolvedValue(undefined);
    const navigate = vi.fn().mockResolvedValue(true);

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TaskBacklogComponent],
      providers: [
        {
          provide: TaskBoardStore,
          useValue: {
            loadBoard,
            moveTask,
            tasks: () => options.tasks ?? [],
            statuses: () => [],
            loading: () => false,
            error: taskErrorSignal
          }
        },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadProjectMembers,
            projectMembers: () => []
          }
        },
        {
          provide: TaskApiService,
          useValue: {
            createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
            assignTask: vi.fn().mockReturnValue(of(undefined)),
            editTask: vi.fn().mockReturnValue(of({})),
            createTaskEditRequest: vi.fn().mockReturnValue(of({})),
            getCategories: vi.fn().mockReturnValue(of([]))
          }
        },
        {
          provide: EmployeeDirectoryStore,
          useValue: { get: vi.fn().mockReturnValue(undefined), ensureLoaded: vi.fn().mockResolvedValue(undefined) }
        },
        {
          provide: SprintListStore,
          useValue: {
            sprints: sprintsSignal,
            error: sprintErrorSignal,
            loading: signal(false),
            loadForProject,
            create: sprintCreate,
            edit: vi.fn(),
            complete: sprintComplete,
            achieve: sprintAchieve,
            setStatus: sprintSetStatus
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'project-1' : null) } } }
        },
        { provide: Router, useValue: { navigate } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
    fixture.detectChanges();
    return { fixture, loadBoard, moveTask, loadForProject, sprintCreate, sprintsSignal, sprintErrorSignal, taskErrorSignal, sprintComplete, sprintAchieve, sprintSetStatus, loadProjectMembers, navigate };
  }

  it('renders one SprintTabComponent per sprint', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);
  });

  it("expanding a sprint shows only that sprint's tasks", async () => {
    const tasks = [makeTask('t-1', 'sp-1'), makeTask('t-2', 'sp-2')];
    const { fixture } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = fixture.debugElement.queryAll(By.directive(SprintTabComponent));
    const sprint1Tab = tabs.find((t) => (t.componentInstance as SprintTabComponent).sprint().id === 'sp-1')!;

    (sprint1Tab.componentInstance as SprintTabComponent).toggled.emit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t-1"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t-2"]')).toBeNull();
  });

  it('the sprint tab\'s + button opens the task modal in create mode', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = fixture.debugElement.queryAll(By.directive(SprintTabComponent));
    const sprint1Tab = tabs.find((t) => (t.componentInstance as SprintTabComponent).sprint().id === 'sp-1')!;

    (sprint1Tab.componentInstance as SprintTabComponent).createTaskRequested.emit();

    const inst = fixture.componentInstance as unknown as { taskModalOpen: () => boolean; taskModalMode: () => string };
    expect(inst.taskModalOpen()).toBe(true);
    expect(inst.taskModalMode()).toBe('create');
  });

  it("creating a sprint immediately reflects in this component's own sprint list without a page reload", async () => {
    const sprintsSignal = signal<Sprint[]>([sprint1]);
    const sprintCreate = vi.fn().mockImplementation(async () => {
      sprintsSignal.set([sprint1, sprint2]);
      return true;
    });
    const { fixture } = setup({ sprints: [sprint1], sprintsSignal, sprintCreate });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(1);

    const createSprintButton = Array.from(fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Create Sprint'));
    createSprintButton?.click();
    fixture.detectChanges();

    await fixture.componentInstance['sprintStore'].create('milestone-1', { name: 'x', startDate: '', endDate: '' }, false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sprintCreate).toHaveBeenCalled();
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);
  });

  it('builds assignableMembers from projectMembers, using the server-resolved name', async () => {
    const loadProjectMembers = vi.fn().mockResolvedValue(undefined);

    TestBed.configureTestingModule({
      imports: [TaskBacklogComponent],
      providers: [
        {
          provide: TaskBoardStore,
          useValue: {
            loadBoard: vi.fn().mockResolvedValue(undefined),
            moveTask: vi.fn().mockResolvedValue(undefined),
            tasks: () => [],
            statuses: () => [],
            loading: () => false,
            error: () => null
          }
        },
        {
          provide: ProjectDetailStore,
          useValue: {
            milestones: () => [{ objectiveId: 'milestone-1', title: 'Milestone One', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null),
            loadProjectMembers,
            projectMembers: () => [
              { employeeId: 'emp-1', name: 'Nevi Peiris', pending: false, isHead: false },
              { employeeId: 'emp-2', name: null, pending: false, isHead: false }
            ]
          }
        },
        {
          provide: TaskApiService,
          useValue: {
            createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
            assignTask: vi.fn().mockReturnValue(of(undefined)),
            editTask: vi.fn().mockReturnValue(of({})),
            createTaskEditRequest: vi.fn().mockReturnValue(of({})),
            getCategories: vi.fn().mockReturnValue(of([]))
          }
        },
        {
          provide: SprintListStore,
          useValue: {
            sprints: signal([]),
            error: signal(null),
            loading: signal(false),
            loadForProject: vi.fn().mockResolvedValue(undefined),
            create: vi.fn(),
            edit: vi.fn(),
            complete: vi.fn(),
            achieve: vi.fn()
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'project-1' : null) } } }
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.whenStable();

    expect(loadProjectMembers).toHaveBeenCalledWith('project-1');
    const members = (fixture.componentInstance as unknown as { assignableMembers: () => { employeeId: string; name: string }[] }).assignableMembers();
    expect(members).toEqual([
      { employeeId: 'emp-1', name: 'Nevi Peiris' },
      { employeeId: 'emp-2', name: 'Unknown employee' }
    ]);
  });

  it('loads the board for the routed project id on init', async () => {
    const { loadBoard, loadForProject } = setup();
    expect(loadBoard).toHaveBeenCalledWith('project-1');
    expect(loadForProject).toHaveBeenCalledWith('project-1');
  });

  it('routes task-status changes from a table row to store.moveTask', async () => {
    const tasks = [makeTask('t-1', 'sp-1')];
    const { fixture, moveTask } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['onTaskStatusChangeRequested']({ taskId: 't-1', newStatusId: 'status-2' });

    expect(moveTask).toHaveBeenCalledWith('t-1', 'status-2');
  });

  it('opens the task modal in edit mode when a task is viewed', async () => {
    const tasks = [makeTask('t-1', 'sp-1')];
    const { fixture } = setup({ tasks });
    await fixture.whenStable();

    fixture.componentInstance['onTaskViewed'](tasks[0]);

    const inst = fixture.componentInstance as unknown as { taskModalOpen: () => boolean; taskModalMode: () => string; taskModalTaskId: () => string };
    expect(inst.taskModalOpen()).toBe(true);
    expect(inst.taskModalMode()).toBe('edit');
    expect(inst.taskModalTaskId()).toBe('t-1');
  });

  it('routes any sprint-status pick from the sprint tab to sprintStore.setStatus - the owner override always wins', async () => {
    const { fixture, sprintSetStatus } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'complete');
    expect(sprintSetStatus).toHaveBeenCalledWith('sp-1', 'complete', 'milestone-1', false, 'project-1');

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'active');
    expect(sprintSetStatus).toHaveBeenCalledWith('sp-1', 'active', 'milestone-1', false, 'project-1');
  });

  it('does not call setStatus for a non-owner even if the handler is invoked directly', async () => {
    const { fixture, sprintSetStatus } = setup({ isOwner: false });
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'active');

    expect(sprintSetStatus).not.toHaveBeenCalled();
  });

  // Sprint creation has no pending/request path (SprintApiService.create has no member-request
  // variant), so the button - and the form it opens - must not be shown to a non-owner.
  it('does not show the Create Sprint button (or form) to a non-owner', async () => {
    const { fixture } = setup({ isOwner: false });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Create Sprint');

    fixture.componentInstance['createSprintOpen'].set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sprint-form')).toBeNull();
  });

  it('shows the Create Sprint button to an owner', async () => {
    const { fixture } = setup({ isOwner: true });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Create Sprint');
  });

  it('sprint status filter defaults to All and narrows the rendered sprint tabs by status', async () => {
    const { fixture } = setup({ isOwner: true, sprints: [sprint1, sprint2] });
    await fixture.whenStable();
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('[aria-label="Sprint status filter"]') as HTMLElement;
    expect(trigger.textContent).toContain('All sprint statuses');
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);

    fixture.componentInstance['setSprintStatusFilter']('future');
    fixture.detectChanges();

    const tabs = fixture.debugElement.queryAll(By.directive(SprintTabComponent));
    expect(tabs.length).toBe(1);
    expect((tabs[0].componentInstance as SprintTabComponent).sprint().id).toBe('sp-2');
  });

  it("renders sprintStore.error() in the component's own template, always-visible", async () => {
    const sprintErrorSignal = signal<string | null>(null);
    const { fixture } = setup({ sprintErrorSignal });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    sprintErrorSignal.set('Every task in this sprint must be complete first.');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Every task in this sprint must be complete first.');
  });

  it('routes future/active/incomplete picks through to setStatus too, not just complete/achieved', async () => {
    const { fixture, sprintSetStatus } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'future');

    expect(sprintSetStatus).toHaveBeenCalledWith('sp-1', 'future', 'milestone-1', false, 'project-1');
  });

  it('shows store.error() as a retryable error state when the task load fails, instead of silently rendering empty sprint tabs', async () => {
    const taskErrorSignal = signal<string | null>(null);
    const { fixture, loadBoard } = setup({ taskErrorSignal });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    taskErrorSignal.set('Failed to load tasks.');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('[role="alert"]');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toContain('Failed to load tasks.');
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(0);

    loadBoard.mockClear();
    const retryButton = errorEl.querySelector('button') as HTMLButtonElement;
    retryButton.click();
    expect(loadBoard).toHaveBeenCalledWith('project-1');
  });

  it('renders tasks with sprintId: null in an "Unsorted" section, clickable via the same onTaskViewed path', async () => {
    const tasks = [makeTask('t-1', 'sp-1'), makeTask('t-unsorted', null)];
    const { fixture, navigate } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    const unsortedSection = fixture.nativeElement.querySelector('.task-backlog__unsorted');
    expect(unsortedSection).not.toBeNull();
    expect(unsortedSection.textContent).toContain('Unsorted');

    const row = fixture.nativeElement.querySelector('[data-testid="task-row-t-unsorted"]');
    expect(row).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t-1"]')).toBeNull();

    const viewButton = row.querySelector('.task-table__view-btn') as HTMLButtonElement;
    viewButton.click();
    fixture.detectChanges();

    const inst = fixture.componentInstance as unknown as { taskModalOpen: () => boolean; taskModalTaskId: () => string };
    expect(inst.taskModalOpen()).toBe(true);
    expect(inst.taskModalTaskId()).toBe('t-unsorted');
  });

  it('does not render the Unsorted section when there are no unsorted tasks', async () => {
    const tasks = [makeTask('t-1', 'sp-1')];
    const { fixture } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.task-backlog__unsorted')).toBeNull();
  });
});
