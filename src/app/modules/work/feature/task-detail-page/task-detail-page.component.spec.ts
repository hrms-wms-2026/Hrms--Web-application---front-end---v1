import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskDetailPageComponent } from './task-detail-page.component';
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
    moveTaskStatus: vi.fn().mockReturnValue(of(undefined))
  };
}

describe('TaskDetailPageComponent - edit mode', () => {
  let fixture: ComponentFixture<TaskDetailPageComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let milestones: ReturnType<typeof signal<{ objectiveId: string; isOwner: boolean }[]>>;

  beforeEach(async () => {
    api = baseApi();
    milestones = signal<{ objectiveId: string; isOwner: boolean }[]>([{ objectiveId: 'o1', isOwner: true }]);

    await TestBed.configureTestingModule({
      imports: [TaskDetailPageComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: { createTask: vi.fn(), error: () => null } },
        { provide: ProjectDetailStore, useValue: { milestones, loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [] } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: ActivatedRoute, useValue: {
          snapshot: {
            data: {},
            paramMap: { get: (k: string) => (k === 'taskId' ? 't1' : null) },
            queryParamMap: { get: () => null }
          },
          parent: { snapshot: { paramMap: { get: () => 'p1' } } }
        } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  });

  it('loads the task by its route id and seeds the form', () => {
    expect(api['getTaskById']).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.title()).toBe('First');
    expect(fixture.componentInstance.statusId()).toBe('s1');
  });

  it('does not persist anything until Save Changes is pressed', () => {
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.statusId.set('s2');
    expect(api['editTask']).not.toHaveBeenCalled();
    expect(api['moveTaskStatus']).not.toHaveBeenCalled();
    expect(api['createTaskEditRequest']).not.toHaveBeenCalled();
  });

  it('on Save Changes: moves status if changed, then edits the task (owner path)', async () => {
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.statusId.set('s2');
    await fixture.componentInstance.submit();
    expect(api['moveTaskStatus']).toHaveBeenCalledWith('t1', 's2');
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
  });

  it('does not move status on Save when it is unchanged', async () => {
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['moveTaskStatus']).not.toHaveBeenCalled();
    expect(api['editTask']).toHaveBeenCalled();
  });

  it('non-owner Save Changes routes through createTaskEditRequest', async () => {
    milestones.set([{ objectiveId: 'o1', isOwner: false }]);
    fixture.detectChanges();
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['createTaskEditRequest']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
    expect(api['editTask']).not.toHaveBeenCalled();
  });

  it('blocks Save when the title is emptied', async () => {
    fixture.componentInstance.title.set('   ');
    await fixture.componentInstance.submit();
    expect(api['editTask']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['title']).toBeTruthy();
  });
});

describe('TaskDetailPageComponent - create mode', () => {
  let fixture: ComponentFixture<TaskDetailPageComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let createTask: ReturnType<typeof vi.fn>;

  async function build(opts: { module?: string; sprint?: string; sprintRequired?: string; isOwner?: boolean } = {}): Promise<void> {
    api = baseApi();
    createTask = vi.fn().mockResolvedValue({ id: 't-new', objectiveId: 'o1' });
    const query: Record<string, string | null> = {
      module: opts.module ?? null,
      sprint: opts.sprint ?? null,
      sprintRequired: opts.sprintRequired ?? null
    };

    await TestBed.configureTestingModule({
      imports: [TaskDetailPageComponent],
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
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: ActivatedRoute, useValue: {
          snapshot: {
            data: { mode: 'create' },
            paramMap: { get: () => null },
            queryParamMap: { get: (k: string) => query[k] ?? null }
          },
          parent: { snapshot: { paramMap: { get: () => 'p1' } } }
        } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(TaskDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((r) => setTimeout(r, 0));
    fixture.detectChanges();
  }

  it('is in create mode with an empty title when the route data says so', async () => {
    await build();
    expect(fixture.componentInstance.mode()).toBe('create');
    expect(fixture.componentInstance.title()).toBe('');
    expect(api['getTaskById']).not.toHaveBeenCalled();
  });

  it('prefills the module from the ?module query param', async () => {
    await build({ module: 'o1' });
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
  });

  it('owner submit calls TaskBoardStore.createTask and navigates to the new task', async () => {
    await build({ sprintRequired: 'false' });
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'New task', categoryId: 'c1' }));
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/work', 'p1', 'task', 't-new']);
  });

  it('non-owner submit routes through createTaskCreationRequest', async () => {
    await build({ sprintRequired: 'false', isOwner: false });
    fixture.componentInstance.title.set('Ask');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(api['createTaskCreationRequest']).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'Ask' }));
    expect(createTask).not.toHaveBeenCalled();
  });

  it('shows the allocation slack hint when createTask returns an InsufficientAllocationErrorDto', async () => {
    await build({ sprintRequired: 'false' });
    createTask.mockResolvedValue({ availableSlackHours: 3, suggestedAction: 'extend_allocation' });
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.allocationHint()?.availableSlackHours).toBe(3);
  });

  it('blocks submit when module or category is missing', async () => {
    await build({ sprintRequired: 'false' });
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('');
    await fixture.componentInstance.submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['objectiveId']).toBeTruthy();
  });
});
