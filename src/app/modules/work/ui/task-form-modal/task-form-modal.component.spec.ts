import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TaskFormModalComponent } from './task-form-modal.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';

const taskDto = {
  id: 't1', objectiveId: 'o1', shortId: 'P-1', title: 'First', description: 'desc',
  categoryId: 'c1', statusId: 's1', priority: 'high' as const, storyPoints: 2, dueDate: '2026-09-01',
  estimatedHours: 4, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: ['e1'],
  openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
};

function baseApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    getTaskById: vi.fn().mockReturnValue(of(taskDto)),
    getStatuses: vi.fn().mockReturnValue(of([
      { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's2', name: 'Doing', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
    ])),
    getCategories: vi.fn().mockReturnValue(of([{ id: 'c1', name: 'Feature', displayOrder: 0 }])),
    getTaskHistory: vi.fn().mockReturnValue(of([])),
    editTask: vi.fn().mockReturnValue(of(taskDto)),
    createTaskEditRequest: vi.fn().mockReturnValue(of({})),
    createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
    assignTask: vi.fn().mockReturnValue(of(undefined)),
    unassignTask: vi.fn().mockReturnValue(of(undefined)),
    moveTaskStatus: vi.fn().mockReturnValue(of(undefined))
  };
}

async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

describe('TaskFormModalComponent - edit mode', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let milestones: ReturnType<typeof signal<{ objectiveId: string; isOwner: boolean }[]>>;
  let members: { employeeId: string; name: string }[];

  beforeEach(async () => {
    api = baseApi();
    milestones = signal<{ objectiveId: string; isOwner: boolean }[]>([{ objectiveId: 'o1', isOwner: true }]);
    members = [{ employeeId: 'e1', name: 'Ann' }, { employeeId: 'e2', name: 'Bob' }];

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: { createTask: vi.fn(), error: () => null } },
        { provide: ProjectDetailStore, useValue: { milestones, loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => members } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('taskId', 't1');
    fixture.componentRef.setInput('open', true);
    await flush(fixture);
  });

  it('loads the task by its id input and seeds the form', () => {
    expect(api['getTaskById']).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.title()).toBe('First');
    expect(fixture.componentInstance.statusId()).toBe('s1');
    expect(fixture.componentInstance.assigneeEmployeeId()).toBe('e1');
  });

  it('on Save Changes: moves status if changed, then edits the task (owner path)', async () => {
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.statusId.set('s2');
    await fixture.componentInstance.submit();
    expect(api['moveTaskStatus']).toHaveBeenCalledWith('t1', 's2');
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
  });

  it('emits saved and closed after a successful edit', async () => {
    const savedSpy = vi.fn();
    const closedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(savedSpy).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('reassigns the task when the assignee is changed (owner path)', async () => {
    fixture.componentInstance.assigneeEmployeeId.set('e2');
    await fixture.componentInstance.submit();
    expect(api['unassignTask']).toHaveBeenCalledWith('t1', 'e1');
    expect(api['assignTask']).toHaveBeenCalledWith('t1', 'e2');
  });

  it('does not touch assignments when the assignee is unchanged', async () => {
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['assignTask']).not.toHaveBeenCalled();
    expect(api['unassignTask']).not.toHaveBeenCalled();
  });

  it('non-owner Save routes through createTaskEditRequest and skips reassignment', async () => {
    milestones.set([{ objectiveId: 'o1', isOwner: false }]);
    fixture.detectChanges();
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.assigneeEmployeeId.set('e2');
    await fixture.componentInstance.submit();
    expect(api['createTaskEditRequest']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
    expect(api['editTask']).not.toHaveBeenCalled();
    expect(api['assignTask']).not.toHaveBeenCalled();
  });

  it('blocks Save when the title is emptied', async () => {
    fixture.componentInstance.title.set('   ');
    await fixture.componentInstance.submit();
    expect(api['editTask']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['title']).toBeTruthy();
  });
});

describe('TaskFormModalComponent - create mode', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let createTask: ReturnType<typeof vi.fn>;

  async function build(opts: { module?: string; sprint?: string; isOwner?: boolean } = {}): Promise<void> {
    api = baseApi();
    createTask = vi.fn().mockResolvedValue({ id: 't-new', objectiveId: 'o1' });

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: {
          getMyMilestones: vi.fn().mockReturnValue(of([{ objectiveId: 'o1', title: 'Mod 1', isOwner: opts.isOwner ?? true }]))
        } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([
          { id: 'sp1', objectiveId: 'o1', name: 'Sprint 1', startDate: '2026-09-01', endDate: '2026-09-14', status: 'active', completedAt: null, achievedAt: null }
        ])) } },
        { provide: TaskBoardStore, useValue: { createTask, error: () => null } },
        { provide: ProjectDetailStore, useValue: { milestones: signal([]), loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [] } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'create');
    if (opts.module) fixture.componentRef.setInput('prefillModuleId', opts.module);
    if (opts.sprint) fixture.componentRef.setInput('prefillSprintId', opts.sprint);
    fixture.componentRef.setInput('open', true);
    await flush(fixture);
  }

  it('starts with an empty title and never loads a task', async () => {
    await build();
    expect(fixture.componentInstance.title()).toBe('');
    expect(api['getTaskById']).not.toHaveBeenCalled();
  });

  it('prefills the module from the prefillModuleId input', async () => {
    await build({ module: 'o1' });
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
  });

  it('creates with no sprint selected — sprint is optional', async () => {
    await build();
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    fixture.componentInstance.sprintId.set('');
    await fixture.componentInstance.submit();
    expect(createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'New task', sprintId: null }));
    expect(fixture.componentInstance.errors()['sprintId']).toBeFalsy();
  });

  it('emits created with the new task id after an owner create', async () => {
    await build();
    const createdSpy = vi.fn();
    fixture.componentInstance.created.subscribe(createdSpy);
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(createdSpy).toHaveBeenCalledWith('t-new');
  });

  it('non-owner submit routes through createTaskCreationRequest', async () => {
    await build({ isOwner: false });
    fixture.componentInstance.title.set('Ask');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(api['createTaskCreationRequest']).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'Ask' }));
    expect(createTask).not.toHaveBeenCalled();
  });

  it('surfaces an error and clears submitting when a non-owner create request fails', async () => {
    await build({ isOwner: false });
    api['createTaskCreationRequest'].mockReturnValue(throwError(() => ({ error: { detail: 'Sprint is closed.' } })));
    fixture.componentInstance.title.set('Ask');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.errorMessage()).toBe('Sprint is closed.');
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('shows the allocation slack hint when createTask reports insufficient allocation', async () => {
    await build();
    createTask.mockResolvedValue({ availableSlackHours: 3, suggestedAction: 'extend_allocation' });
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.allocationHint()?.availableSlackHours).toBe(3);
  });

  it('blocks submit when the module is missing (module is required)', async () => {
    await build();
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['objectiveId']).toBeTruthy();
  });
});
