import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { signal } from '@angular/core';
import { TaskBacklogComponent } from './task-backlog.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ObjectiveMemberApiService } from '../../data-access/objective-member-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { SprintTabComponent } from '../../ui/sprint-tab/sprint-tab.component';
import { TaskCreateModalComponent } from '../../ui/task-create-modal/task-create-modal.component';
import { TaskDetailModalComponent } from '../../ui/task-detail-modal/task-detail-modal.component';
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
      taskType: 'task',
      statusId: 'status-1',
      priority: 'medium',
      storyPoints: null,
      dueDate: null,
      estimatedHours: null,
      completedHours: 0,
      progressPercent: 0,
      sprintId
    };
  }

  function setup(options: {
    isOwner?: boolean;
    sprints?: Sprint[];
    tasks?: WorkTask[];
    sprintLoad?: ReturnType<typeof vi.fn>;
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
    const sprintLoad = options.sprintLoad ?? vi.fn().mockResolvedValue(undefined);
    const sprintCreate = options.sprintCreate ?? vi.fn().mockResolvedValue(true);
    const sprintComplete = options.sprintComplete ?? vi.fn().mockResolvedValue(true);
    const sprintAchieve = options.sprintAchieve ?? vi.fn().mockResolvedValue(true);
    const sprintSetStatus = options.sprintSetStatus ?? vi.fn().mockResolvedValue(true);

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
            milestones: () => [{ objectiveId: 'milestone-1', isOwner }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null)
          }
        },
        { provide: ObjectiveMemberApiService, useValue: { getMembers: vi.fn().mockReturnValue(of({ items: [] })) } },
        {
          provide: TaskApiService,
          useValue: {
            createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
            assignTask: vi.fn().mockReturnValue(of(undefined)),
            editTask: vi.fn().mockReturnValue(of({})),
            createTaskEditRequest: vi.fn().mockReturnValue(of({}))
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
            load: sprintLoad,
            create: sprintCreate,
            edit: vi.fn(),
            complete: sprintComplete,
            achieve: sprintAchieve,
            setStatus: sprintSetStatus
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
    fixture.detectChanges();
    return { fixture, loadBoard, moveTask, sprintLoad, sprintCreate, sprintsSignal, sprintErrorSignal, taskErrorSignal, sprintComplete, sprintAchieve, sprintSetStatus };
  }

  it('renders one SprintTabComponent per sprint, owner sees all statuses, member sees active-only', async () => {
    const owner = setup({ isOwner: true });
    await owner.fixture.whenStable();
    owner.fixture.detectChanges();
    expect(owner.fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);
    expect(owner.sprintLoad).toHaveBeenCalledWith('milestone-1', false);

    const member = setup({ isOwner: false });
    await member.fixture.whenStable();
    member.fixture.detectChanges();
    expect(member.fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);
    expect(member.sprintLoad).toHaveBeenCalledWith('milestone-1', true);
  });

  it("expanding a sprint shows only that sprint's tasks", async () => {
    const tasks = [makeTask('t-1', 'sp-1'), makeTask('t-2', 'sp-2')];
    const { fixture } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = fixture.debugElement.queryAll(By.directive(SprintTabComponent));
    const sprint1Tab = tabs.find((t) => (t.componentInstance as SprintTabComponent).sprint().id === 'sp-1')!;

    // Expand sprint 1 by emitting its toggled output (mirrors clicking its header).
    (sprint1Tab.componentInstance as SprintTabComponent).toggled.emit();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t-1"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t-2"]')).toBeNull();
  });

  it('the sprint create-task + button opens the create modal with sprintId pre-filled and the dropdown hidden', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    const tabs = fixture.debugElement.queryAll(By.directive(SprintTabComponent));
    const sprint1Tab = tabs.find((t) => (t.componentInstance as SprintTabComponent).sprint().id === 'sp-1')!;

    (sprint1Tab.componentInstance as SprintTabComponent).createTaskRequested.emit();
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(TaskCreateModalComponent)).componentInstance as TaskCreateModalComponent;
    expect(modal.open()).toBe(true);
    expect(modal.activeSprints()).toEqual([sprint1]);

    fixture.detectChanges();
    const fixedText = fixture.nativeElement.querySelector('[data-testid="sprint-fixed"]');
    const select = fixture.nativeElement.querySelector('select.task-create-modal__sprint-select');
    expect(fixedText).not.toBeNull();
    expect(fixedText.textContent).toContain('Sprint One');
    expect(select).toBeNull();
  });

  it("creating a sprint immediately reflects in this component's own sprint list and the create-task modal's dropdown, without a page reload", async () => {
    const sprintsSignal = signal<Sprint[]>([sprint1]);
    const sprintCreate = vi.fn().mockImplementation(async () => {
      sprintsSignal.set([sprint1, sprint2]);
      return true;
    });
    const { fixture } = setup({ sprints: [sprint1], sprintsSignal, sprintCreate });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(1);

    // Open the inline sprint-create form and submit it - mirrors the SprintCreateFormComponent's
    // own submit(), which calls SprintListStore.create() directly (no manual "reload" call needed;
    // the store's own signal update is what both this list and the modal's dropdown read from).
    const createButton = Array.from(fixture.nativeElement.querySelectorAll('button') as HTMLButtonElement[])
      .find((b) => b.textContent?.includes('Create Sprint'));
    createButton?.click();
    fixture.detectChanges();

    await fixture.componentInstance['sprintStore'].create('milestone-1', { name: 'x', startDate: '', endDate: '' }, false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sprintCreate).toHaveBeenCalled();
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);

    // Open the create-task modal generically (no specific sprint clicked) and confirm the new
    // sprint is already present in its dropdown data, without any page reload.
    expect(fixture.componentInstance['createModalSprints']()).toEqual([sprint1, sprint2]);
  });

  it('resolves assignableMembers names from the employee directory instead of the raw employeeId', async () => {
    const directoryGet = vi.fn((id: string) => (id === 'emp-1' ? { id, name: 'Nevi Peiris', initials: 'NP', avatarUrl: null } : undefined));
    const directoryEnsureLoaded = vi.fn().mockResolvedValue(undefined);

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
            milestones: () => [{ objectiveId: 'milestone-1', isOwner: true }],
            getMilestoneDetail: vi.fn().mockResolvedValue(null)
          }
        },
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
        {
          provide: TaskApiService,
          useValue: {
            createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
            assignTask: vi.fn().mockReturnValue(of(undefined)),
            editTask: vi.fn().mockReturnValue(of({})),
            createTaskEditRequest: vi.fn().mockReturnValue(of({}))
          }
        },
        { provide: EmployeeDirectoryStore, useValue: { get: directoryGet, ensureLoaded: directoryEnsureLoaded } },
        {
          provide: SprintListStore,
          useValue: {
            sprints: signal([]),
            error: signal(null),
            loading: signal(false),
            load: vi.fn().mockResolvedValue(undefined),
            create: vi.fn(),
            edit: vi.fn(),
            complete: vi.fn(),
            achieve: vi.fn()
          }
        },
        {
          provide: ActivatedRoute,
          useValue: { parent: { snapshot: { paramMap: { get: () => 'milestone-1' } } } }
        }
      ]
    });

    const fixture = TestBed.createComponent(TaskBacklogComponent);
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

  it('loads the board for the current milestoneId on init', async () => {
    const { loadBoard } = setup();
    expect(loadBoard).toHaveBeenCalledWith('milestone-1');
  });

  it('routes task-status changes from the detail modal to store.moveTask', async () => {
    const tasks = [makeTask('t-1', 'sp-1')];
    const { fixture, moveTask } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance['onTaskViewed'](tasks[0]);
    fixture.detectChanges();
    fixture.componentInstance['onTaskStatusChangeRequested']('status-2');

    expect(moveTask).toHaveBeenCalledWith('t-1', 'status-2');
  });

  it('routes any sprint-status pick from the sprint tab to sprintStore.setStatus - the owner override always wins', async () => {
    const { fixture, sprintSetStatus } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'complete');
    expect(sprintSetStatus).toHaveBeenCalledWith('sp-1', 'complete', 'milestone-1', false);

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'active');
    expect(sprintSetStatus).toHaveBeenCalledWith('sp-1', 'active', 'milestone-1', false);
  });

  it('does not call setStatus for a non-owner even if the handler is invoked directly', async () => {
    const { fixture, sprintSetStatus } = setup({ isOwner: false });
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'active');

    expect(sprintSetStatus).not.toHaveBeenCalled();
  });

  // Finding 1: a non-owner has no working "create sprint" path (SprintApiService.create has no
  // member-request variant), so the button - and the form it opens - must not be shown to them.
  it('does not show the Create Sprint button (or form) to a non-owner', async () => {
    const { fixture } = setup({ isOwner: false });
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('Create Sprint');

    fixture.componentInstance['createSprintOpen'].set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sprint-create-form')).toBeNull();
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

    const select = fixture.nativeElement.querySelector('[data-testid="sprint-status-filter"]') as HTMLSelectElement;
    expect(select.value).toBe('all');
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(2);

    select.value = 'future';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const tabs = fixture.debugElement.queryAll(By.directive(SprintTabComponent));
    expect(tabs.length).toBe(1);
    expect((tabs[0].componentInstance as SprintTabComponent).sprint().id).toBe('sp-2');
  });

  // Finding 2: a failed Complete/Achieve sets sprintStore.error(), which must be rendered
  // somewhere always-visible (not just inside the create form, which may not be open).
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

  // Owner override always wins: every status, including ones the date-driven SprintLifecycleJob
  // would otherwise own (future/active/incomplete), is a real call - not a silent no-op.
  it('routes future/active/incomplete picks through to setStatus too, not just complete/achieved', async () => {
    const { fixture, sprintSetStatus } = setup();
    await fixture.whenStable();
    fixture.detectChanges();

    await fixture.componentInstance['onSprintStatusChangeRequested']('sp-1', 'future');

    expect(sprintSetStatus).toHaveBeenCalledWith('sp-1', 'future', 'milestone-1', false);
  });

  // Finding 4: a failed task load must be shown to the user, matching TaskBoardComponent's
  // behavior, instead of silently rendering sprint tabs with empty task lists.
  it('shows store.error() when the task load fails, instead of silently rendering empty sprint tabs', async () => {
    const taskErrorSignal = signal<string | null>(null);
    const { fixture } = setup({ taskErrorSignal });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.task-backlog__error')).toBeNull();

    taskErrorSignal.set('Failed to load tasks.');
    fixture.detectChanges();

    const errorEl = fixture.nativeElement.querySelector('.task-backlog__error');
    expect(errorEl).not.toBeNull();
    expect(errorEl.textContent).toContain('Failed to load tasks.');
    // Sprint tabs should not render alongside the error.
    expect(fixture.debugElement.queryAll(By.directive(SprintTabComponent)).length).toBe(0);
  });

  // Finding 5: a task with sprintId === null has nowhere to render inside the per-sprint tabs -
  // it must appear in an always-visible "Unsorted" section, and remain clickable there.
  it('renders tasks with sprintId: null in an "Unsorted" section, clickable via the same onTaskViewed path', async () => {
    const tasks = [makeTask('t-1', 'sp-1'), makeTask('t-unsorted', null)];
    const { fixture } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    const unsortedSection = fixture.nativeElement.querySelector('.task-backlog__unsorted');
    expect(unsortedSection).not.toBeNull();
    expect(unsortedSection.textContent).toContain('Unsorted');

    const row = fixture.nativeElement.querySelector('[data-testid="task-row-t-unsorted"]');
    expect(row).not.toBeNull();
    // The task should NOT also show up inside a sprint tab.
    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t-1"]')).toBeNull();

    const viewButton = row.querySelector('.task-table__view-btn') as HTMLButtonElement;
    viewButton.click();
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(TaskDetailModalComponent)).componentInstance as TaskDetailModalComponent;
    expect(modal.open()).toBe(true);
    expect(modal.task()).toEqual(tasks[1]);
  });

  it('does not render the Unsorted section when there are no unsorted tasks', async () => {
    const tasks = [makeTask('t-1', 'sp-1')];
    const { fixture } = setup({ tasks });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.task-backlog__unsorted')).toBeNull();
  });
});
