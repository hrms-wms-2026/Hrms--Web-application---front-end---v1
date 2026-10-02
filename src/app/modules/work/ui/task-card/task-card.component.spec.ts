import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';

import { vi } from 'vitest';
import { TaskCardComponent } from './task-card.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { EmployeeAvatarComponent } from '../employee-avatar/employee-avatar.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';
import { TaskBoardStore } from '../../state/task-board.store';

import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { environment } from '../../../../../environments/environment';

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;
  let httpMock: HttpTestingController;
  let directoryStore: { get: ReturnType<typeof vi.fn>; ensureLoaded: ReturnType<typeof vi.fn> };
  let boardStore: {
    subtasksByParentId: ReturnType<typeof vi.fn>;
    loadSubtasks: ReturnType<typeof vi.fn>;
    editTask: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    boardStore = {
      subtasksByParentId: vi.fn().mockReturnValue({}),
      loadSubtasks: vi.fn().mockResolvedValue(undefined),
      editTask: vi.fn().mockResolvedValue(true)
    };
  });

  afterEach(() => httpMock.verify());

  const task: WorkTask = {
    id: 't-1', objectiveId: 'o-1', shortId: 'PRJ-1', title: 'Do the thing', description: null,
    categoryId: 'task', statusId: 's1', priority: 'high', storyPoints: null, dueDate: null,
    estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null,
    assigneeEmployeeIds: ['emp-1', 'emp-2'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
    attachments: [], assignees: [],
    parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0, subtaskAssigneeEmployeeIds: [],
    createdAt: new Date('2026-01-01T00:00:00Z'), hasPendingApproval: false
  };

  const assignableMembers = [
    { employeeId: 'emp-1', name: 'Nevi Peiris' },
    { employeeId: 'emp-2', name: 'Sam Perera' },
    { employeeId: 'emp-3', name: 'Amal Silva' }
  ];

  const statuses: TaskStatusColumn[] = [
    { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'public' },
    { id: 's2', name: 'Done', displayOrder: 1, requiresApproval: false, marksTaskComplete: true, category: 'done', color: '#2563EB', visibility: 'public' },
    { id: 's3', name: 'Internal Review', displayOrder: 2, requiresApproval: false, marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'private' }
  ];

    function setup(overrides: {
      task?: WorkTask;
      currentEmployeeId?: string;
      assignableMembers?: { employeeId: string; name: string }[];
      directoryGet?: (id: string) => any;
    } = {}): void {

    TestBed.resetTestingModule();
    directoryStore = {
      get: vi.fn().mockImplementation(overrides.directoryGet ?? (() => undefined)),
      ensureLoaded: vi.fn().mockResolvedValue(undefined)
    };
    if (!boardStore) {
      boardStore = {
        subtasksByParentId: vi.fn().mockReturnValue({}),
        loadSubtasks: vi.fn().mockResolvedValue(undefined),
        editTask: vi.fn().mockResolvedValue(true)
      };
    }
    TestBed.configureTestingModule({
      imports: [TaskCardComponent, HttpClientTestingModule],
      providers: [
        { provide: EmployeeDirectoryStore, useValue: directoryStore },
        { provide: TaskBoardStore, useValue: boardStore }
      ]
    });
    fixture = TestBed.createComponent(TaskCardComponent);
    httpMock = TestBed.inject(HttpTestingController);

        fixture.componentRef.setInput('task', overrides.task ?? task);
    fixture.componentRef.setInput('currentEmployeeId', overrides.currentEmployeeId ?? '');

    fixture.componentRef.setInput('statuses', statuses);
    fixture.componentRef.setInput('assignableMembers', overrides.assignableMembers ?? assignableMembers);
    fixture.detectChanges();
  }

  it('shows a pending-approval badge when the task has an open request, and hides it otherwise', () => {
    setup({ task: { ...task, hasPendingApproval: true } });
    expect(fixture.nativeElement.querySelector('[data-testid="task-card-pending-approval"]')).not.toBeNull();

    setup({ task: { ...task, hasPendingApproval: false } });
    expect(fixture.nativeElement.querySelector('[data-testid="task-card-pending-approval"]')).toBeNull();
  });

  it('renders one avatar per assignee instead of a name', () => {
    setup();
    const avatars = fixture.debugElement.queryAll(By.directive(AvatarComponent));
    expect(avatars.length).toBe(2);
    const text = fixture.nativeElement.querySelector('.task-card__meta').textContent as string;
    expect(text).not.toContain('emp-1');
  });

  it('prefers the coverage-free project-member name over the management-coverage-scoped directory lookup, so it shows real initials instead of "Unknown employee"', () => {
    setup(); // both emp-1 and emp-2 are known assignable project members
    const avatars = fixture.debugElement.queryAll(By.directive(AvatarComponent));
    expect(avatars.map((a) => a.componentInstance.userName())).toEqual(['Nevi Peiris', 'Sam Perera']);
    expect(fixture.debugElement.queryAll(By.directive(EmployeeAvatarComponent)).length).toBe(0);
    expect(directoryStore.ensureLoaded).not.toHaveBeenCalled();
  });

  it('prefers the task\'s own server-resolved assignee identity (with a real avatar photo) over the project-members name-only fallback', () => {
    setup({
      task: {
        ...task,
        assigneeEmployeeIds: ['emp-1', 'emp-2'],
        assignees: [
          { employeeId: 'emp-1', name: 'Nevi Peiris', avatarUrl: 'https://files.example.test/nevi-avatar' },
          { employeeId: 'emp-2', name: 'Sam Perera', avatarUrl: null }
        ]
      }
    });
    const avatars = fixture.debugElement.queryAll(By.directive(AvatarComponent));
    expect(avatars.map((a) => a.componentInstance.avatarUrl())).toEqual(['https://files.example.test/nevi-avatar', null]);
    expect(avatars.map((a) => a.componentInstance.userName())).toEqual(['Nevi Peiris', 'Sam Perera']);
  });

  it('falls back to the directory-based avatar for an assignee who is not a current project member', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['emp-9'] } });
    const fallback = fixture.debugElement.query(By.directive(EmployeeAvatarComponent));
    expect(fallback.componentInstance.employeeId()).toBe('emp-9');
    expect(directoryStore.ensureLoaded).toHaveBeenCalledWith(['emp-9']);
  });

  it('shows a placeholder assignee icon, not nothing, when no one is assigned', () => {
    setup({ task: { ...task, assigneeEmployeeIds: [] } });
    expect(fixture.debugElement.queryAll(By.directive(EmployeeAvatarComponent)).length).toBe(0);
    expect(fixture.nativeElement.querySelector('.task-card__assignee-placeholder')).not.toBeNull();
  });

  it('shows the employee name in the tooltip instead of "Change assignee" when an assignee is assigned', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['emp-1'] } });
    const btn = fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement;
    expect(btn.getAttribute('title')).toBe('Nevi Peiris');
  });

  it('shows comma-separated employee names in the tooltip when multiple assignees are assigned', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['emp-1', 'emp-2'] } });
    const btn = fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement;
    expect(btn.getAttribute('title')).toBe('Nevi Peiris, Sam Perera');
  });

  it('shows "Add assignee" in the tooltip when no one is assigned', () => {
    setup({ task: { ...task, assigneeEmployeeIds: [] } });
    const btn = fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement;
    expect(btn.getAttribute('title')).toBe('Add assignee');
  });

  it('falls back to directory store name in tooltip if assignee is not in assignableMembers or assignees', () => {
    setup({
      task: { ...task, assigneeEmployeeIds: ['emp-9'] },
      directoryGet: (id: string) => (id === 'emp-9' ? { id: 'emp-9', name: 'External User', initials: 'EU', avatarUrl: null } : undefined)
    });
    const btn = fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement;
    expect(btn.getAttribute('title')).toBe('External User');
  });

  it('renders the assignee control and the priority/date/hours meta in a single row', () => {
    setup();
    const meta = fixture.nativeElement.querySelector('.task-card__meta') as HTMLElement;
    const anchor = meta.querySelector('.task-card__assignee-anchor');
    const priority = meta.querySelector('.task-card__priority');
    expect(anchor).not.toBeNull();
    expect(priority).not.toBeNull();
    expect(anchor?.parentElement).toBe(meta);
    expect(priority?.parentElement).toBe(meta);
  });

  it('opens the assignee popover on click without navigating to the task detail', () => {
    setup();
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(viewedSpy).not.toHaveBeenCalled();
    expect(document.body.querySelector('.task-card__assignee-popover')).not.toBeNull();
  });

  it('picking someone replaces every previously-assigned person instead of adding a second assignee', async () => {
    setup(); // fixture task starts with two assignees: ['emp-1', 'emp-2']
    const viewedSpy = vi.fn();
    const changedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    fixture.componentInstance.taskChanged.subscribe(changedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const options = document.body.querySelectorAll('.task-card__assignee-option');
    const emp3Option = Array.from(options).find((el) => (el as HTMLElement).textContent?.includes('Amal Silva')) as HTMLButtonElement;
    emp3Option.click();
    fixture.detectChanges();

    // Popover closes immediately, matching the task detail modal's single-assignee UX.
    expect(document.body.querySelector('.task-card__assignee-popover')).toBeNull();

    const unassign1 = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/assignments/emp-1`);
    expect(unassign1.request.method).toBe('DELETE');
    unassign1.flush(null);
    await fixture.whenStable();

    const unassign2 = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/assignments/emp-2`);
    expect(unassign2.request.method).toBe('DELETE');
    unassign2.flush(null);
    await fixture.whenStable();

    const assign3 = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/assignments`);
    expect(assign3.request.method).toBe('POST');
    expect(assign3.request.body).toEqual({ employeeId: 'emp-3' });
    assign3.flush(null);
    await fixture.whenStable();

    expect(changedSpy).toHaveBeenCalled();
    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('picking "Unassigned" clears everyone currently assigned and assigns no one', async () => {
    setup();
    (fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const unassignedOption = Array.from(document.body.querySelectorAll('.task-card__assignee-option'))
      .find((el) => (el as HTMLElement).textContent?.includes('Unassigned')) as HTMLButtonElement;
    unassignedOption.click();

    const unassign1 = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/assignments/emp-1`);
    unassign1.flush(null);
    await fixture.whenStable();
    const unassign2 = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/assignments/emp-2`);
    unassign2.flush(null);
    await fixture.whenStable();

    httpMock.expectNone(`${environment.apiUrl}/work/tasks/t-1/assignments`);
  });

  it('clicking the current sole assignee again is a no-op, not a second assignment', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['emp-1'] } });
    (fixture.nativeElement.querySelector('[data-testid="task-card-assignee-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const emp1Option = Array.from(document.body.querySelectorAll('.task-card__assignee-option'))
      .find((el) => (el as HTMLElement).textContent?.includes('Nevi Peiris')) as HTMLButtonElement;
    emp1Option.click();

    httpMock.expectNone(`${environment.apiUrl}/work/tasks/t-1/assignments/emp-1`);
    httpMock.expectNone(`${environment.apiUrl}/work/tasks/t-1/assignments`);
  });

  it('clicking anywhere on the card emits viewed with the task', () => {
    setup();
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('.task-card') as HTMLElement).click();

    expect(viewedSpy).toHaveBeenCalledWith(task);
  });

  it('does not render status pill on task card since column header already shows status', () => {
    setup();
    const statusEl = fixture.nativeElement.querySelector('[data-testid="task-card-status"]');
    expect(statusEl).toBeNull();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('shows the clock widget when the caller is an assignee', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1'] }, currentEmployeeId: 'e1' });
    expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeTruthy();
  });

  it('marks hasOpenSessionMine when the open session belongs to the caller', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: 'e1' }, currentEmployeeId: 'e1' });
    const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
    expect(widget.componentInstance.hasOpenSessionMine()).toBe(true);
  });

  it('marks hasOpenSessionOtherEmployee when a different employee holds the open session', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1', 'e2'], openClockSessionEmployeeId: 'e2' }, currentEmployeeId: 'e1' });
    const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
    expect(widget.componentInstance.hasOpenSessionOtherEmployee()).toBe(true);
    expect(widget.componentInstance.hasOpenSessionMine()).toBe(false);
  });

  it('does not emit viewed when Clock In is clicked inside the card', async () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1'] }, currentEmployeeId: 'e1' });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    (fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement).click();
    expect(viewedSpy).not.toHaveBeenCalled();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t-1/clock-in`);
    req.flush(null);
    await fixture.whenStable();
  });

  it('does not emit viewed when the Push popup Submit control is clicked', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: 'e1' }, currentEmployeeId: 'e1' });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();
    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('hides the clock widget for a non-assignee', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e2'] }, currentEmployeeId: 'e1' });
    expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeNull();
  });

  it('does not show a subtask toggle when the task has no subtasks', () => {
    setup({ task: { ...task, subtaskTotalCount: 0, subtaskCompletedCount: 0 } });
    expect(fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]')).toBeNull();
  });

  it('shows the subtask icon and count when the task has subtasks', () => {
    setup({ task: { ...task, subtaskTotalCount: 3, subtaskCompletedCount: 1 } });
    const toggle = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLElement;
    expect(toggle.textContent).toContain('subtasks');
    expect(toggle.textContent).toContain('1/3');
    expect(toggle.textContent).not.toContain('3 subtasks');
    expect(toggle.querySelector('.task-card__subtask-icon')).not.toBeNull();
    expect(toggle.querySelector('.task-card__subtask-count')?.textContent).toBe('1/3');
    expect(toggle.querySelector('.task-card__subtask-count-pill')).toBeNull();
  });

  it('lazy-loads subtasks on first expand and does not reload on collapse/re-expand', () => {
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const toggle = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement;

    toggle.click();
    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t-1');
    expect(boardStore.loadSubtasks).toHaveBeenCalledTimes(1);

    toggle.click(); // collapse
    toggle.click(); // re-expand
    expect(boardStore.loadSubtasks).toHaveBeenCalledTimes(1);
  });

  it('expanding does not emit viewed for the parent card', () => {
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();

    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('clicking anywhere on the subtask bar expands subtasks without emitting viewed for parent card', () => {
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    const bar = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-bar"]') as HTMLElement;
    bar.click();
    fixture.detectChanges();

    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t-1');
    expect(viewedSpy).not.toHaveBeenCalled();
    expect(bar.querySelector('[data-testid="task-card-subtask-toggle"]')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking a nested subtask row emits viewed with the subtask, not the parent', () => {
    boardStore.subtasksByParentId.mockReturnValue({
      't-1': [{ ...task, id: 'sub-1', title: 'Sub thing', subtaskTotalCount: 0, subtaskCompletedCount: 0 }]
    });
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 } });
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-sub-1"]') as HTMLElement).click();

    expect(viewedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-1' }));
  });

  it('shows a Clock In widget on a subtask assigned to the current employee', () => {
    boardStore.subtasksByParentId.mockReturnValue({
      't-1': [{ ...task, id: 'sub-1', title: 'Sub thing', assigneeEmployeeIds: ['emp-1'], subtaskTotalCount: 0, subtaskCompletedCount: 0 }]
    });
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 }, currentEmployeeId: 'emp-1' });

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const subtaskRow = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-sub-1"]') as HTMLElement;
    expect(subtaskRow.querySelector('app-task-clock-widget')).not.toBeNull();
    expect(subtaskRow.querySelector('[data-testid="clock-in-button"]')).not.toBeNull();
  });

  it('hides the clock widget on a subtask the current employee is not assigned to', () => {
    boardStore.subtasksByParentId.mockReturnValue({
      't-1': [{ ...task, id: 'sub-1', title: 'Sub thing', assigneeEmployeeIds: ['emp-2'], subtaskTotalCount: 0, subtaskCompletedCount: 0 }]
    });
    setup({ task: { ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 }, currentEmployeeId: 'emp-1' });

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const subtaskRow = fixture.nativeElement.querySelector('[data-testid="task-card-subtask-sub-1"]') as HTMLElement;
    expect(subtaskRow.querySelector('app-task-clock-widget')).toBeNull();
  });

  it('resolves subtask assignee avatarUrl from subtask assignees when parent task is assigned to someone else', () => {
    boardStore.subtasksByParentId.mockReturnValue({
      't-1': [
        {
          ...task,
          id: 'sub-1',
          title: 'Sub thing',
          assigneeEmployeeIds: ['emp-2'],
          assignees: [{ employeeId: 'emp-2', name: 'Sam Perera', avatarUrl: 'https://files.example.test/sam-avatar.jpg' }],
          subtaskTotalCount: 0,
          subtaskCompletedCount: 0
        }
      ]
    });
    // Parent task is assigned to emp-1 only; emp-2 is in assignableMembers without an avatar on the parent task
    setup({
      task: {
        ...task,
        assigneeEmployeeIds: ['emp-1'],
        assignees: [{ employeeId: 'emp-1', name: 'Nevi Peiris', avatarUrl: null }],
        subtaskTotalCount: 1,
        subtaskCompletedCount: 0
      },
      currentEmployeeId: 'emp-1'
    });

    (fixture.nativeElement.querySelector('[data-testid="task-card-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const avatarComp = fixture.debugElement.query(By.css('[data-testid="task-card-subtask-sub-1"] app-avatar'));
    expect(avatarComp).not.toBeNull();
    expect(avatarComp.componentInstance.avatarUrl()).toBe('https://files.example.test/sam-avatar.jpg');
    expect(avatarComp.componentInstance.userName()).toBe('Sam Perera');
  });

  it('opens priority popover on click and selecting a new priority updates task and emits taskChanged without opening task detail', async () => {
    setup({ task: { ...task, priority: 'medium' } });
    const viewedSpy = vi.fn();
    const changedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    fixture.componentInstance.taskChanged.subscribe(changedSpy);

    const btn = fixture.nativeElement.querySelector('[data-testid="task-card-priority-btn"]') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(viewedSpy).not.toHaveBeenCalled();
    const popover = document.body.querySelector('.task-card__priority-popover');
    expect(popover).not.toBeNull();

    const options = Array.from(popover!.querySelectorAll('.task-card__popover-option')) as HTMLButtonElement[];
    const criticalOpt = options.find((opt) => opt.textContent?.includes('Critical'))!;
    criticalOpt.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(boardStore.editTask).toHaveBeenCalledWith('t-1', expect.objectContaining({ priority: 'critical' }));
    expect(changedSpy).toHaveBeenCalled();
    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('opens due date popover on click and quick option sets due date without opening task detail', async () => {
    setup();
    const viewedSpy = vi.fn();
    const changedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    fixture.componentInstance.taskChanged.subscribe(changedSpy);

    const btn = fixture.nativeElement.querySelector('[data-testid="task-card-due-date-btn"]') as HTMLButtonElement;
    btn.click();
    fixture.detectChanges();

    expect(viewedSpy).not.toHaveBeenCalled();
    const popover = document.body.querySelector('.task-card__due-date-popover');
    expect(popover).not.toBeNull();

    const quickBtns = Array.from(popover!.querySelectorAll('.task-card__quick-btn')) as HTMLButtonElement[];
    const todayBtn = quickBtns.find((b) => b.textContent?.includes('Today'))!;
    todayBtn.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(boardStore.editTask).toHaveBeenCalledWith('t-1', expect.objectContaining({ dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }));
    expect(changedSpy).toHaveBeenCalled();
    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('shows only the icon and no text label when date is not assigned', () => {
    setup({ task: { ...task, dueDate: null } });
    const dateBtn = fixture.nativeElement.querySelector('[data-testid="task-card-due-date-btn"]') as HTMLButtonElement;
    const hoursBtn = fixture.nativeElement.querySelector('[data-testid="task-card-hours-btn"]');

    expect(dateBtn.querySelector('svg')).not.toBeNull();
    expect(dateBtn.querySelector('span')).toBeNull();
    expect(dateBtn.textContent?.trim()).toBe('');
    expect(dateBtn.classList.contains('task-card__meta-btn--icon-only')).toBe(true);
    expect(hoursBtn).toBeNull();
  });

  it('shows text label alongside the icon when date is assigned', () => {
    setup({ task: { ...task, dueDate: new Date('2026-09-17T00:00:00.000Z') } });
    const dateBtn = fixture.nativeElement.querySelector('[data-testid="task-card-due-date-btn"]') as HTMLButtonElement;

    expect(dateBtn.querySelector('span')?.textContent).toContain('Sep 17');
    expect(dateBtn.classList.contains('task-card__meta-btn--icon-only')).toBe(false);
  });

  it('shows weekday name when date is in the current week', () => {
    // Pick Saturday of the current week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + diffToMonday + 5);

    setup({ task: { ...task, dueDate: saturday } });
    const dateBtn = fixture.nativeElement.querySelector('[data-testid="task-card-due-date-btn"]') as HTMLButtonElement;

    // In current week, it shows 'Sat' (or 'Today'/'Tomorrow' if Saturday happens to be today/tomorrow)
    expect(dateBtn.querySelector('span')?.textContent?.trim()).toMatch(/^(Sat|Today|Tomorrow)$/);
  });

  it('applies overdue class when date is in the past and task is not completed', () => {
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    setup({ task: { ...task, dueDate: pastDate, statusId: 's1' } }); // s1 is not complete
    const dateBtn = fixture.nativeElement.querySelector('[data-testid="task-card-due-date-btn"]') as HTMLButtonElement;

    expect(dateBtn.classList.contains('task-card__due-date--overdue')).toBe(true);
  });
});
