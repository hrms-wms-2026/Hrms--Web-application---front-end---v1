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
  openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
  attachments: [{ fileId: 'f1', fileName: 'spec.pdf', fileSizeBytes: 2048, contentType: 'application/pdf' }]
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
    moveTaskStatus: vi.fn().mockReturnValue(of(undefined)),
    uploadPendingFile: vi.fn().mockReturnValue(of({ fileId: 'f1', originalFileName: 'a.png', fileSizeBytes: 100, contentType: 'image/png' })),
    deletePendingFile: vi.fn().mockReturnValue(of(undefined))
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

  it('seeds attachedFiles from the loaded task and renders the Attachments card', () => {
    expect(fixture.componentInstance.attachedFiles()).toEqual([{ fileId: 'f1', name: 'spec.pdf', sizeBytes: 2048 }]);
    const pill = fixture.nativeElement.querySelector('.tal-pill');
    expect(pill.textContent).toContain('spec.pdf');
  });

  it('on Save Changes: includes the current attachedFiles ids in the edit payload', async () => {
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ attachmentFileIds: ['f1'] }));
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

  it('automatically inherits module and active sprint when there is only one module in the project', async () => {
    await build();
    // In build(), exactly 1 module 'o1' and 1 active sprint 'sp1' are returned
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
    expect(fixture.componentInstance.sprintId()).toBe('sp1');
  });

  it('supports "Create & add another": creates task, emits created, keeps modal open, and resets title/description', async () => {
    await build();
    const createdSpy = vi.fn();
    const closedSpy = vi.fn();
    fixture.componentInstance.created.subscribe(createdSpy);
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.componentInstance.title.set('First quick task');
    fixture.componentInstance.description.set('Quick details');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');

    await fixture.componentInstance.submitCreateWithAction('create_and_add_another');

    expect(createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'First quick task' }));
    expect(createdSpy).toHaveBeenCalledWith('t-new');
    expect(closedSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.title()).toBe('');
    expect(fixture.componentInstance.description()).toBe('');
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
    expect(fixture.componentInstance.categoryId()).toBe('c1');
    expect(fixture.componentInstance.successToastMessage()).toBeTruthy();
  });

  it('sets quick due date preset correctly and closes popover', async () => {
    await build();
    fixture.componentInstance.activePopover.set('dueDate');
    fixture.componentInstance.setQuickDueDate(0); // Today
    expect(fixture.componentInstance.dueDate()).toBeTruthy();
    expect(fixture.componentInstance.activePopover()).toBeNull();
  });

  it('displays More fields section by default and allows toggling to hide or show', async () => {
    await build();
    expect(fixture.componentInstance.showMoreFields()).toBe(true);

    const toggleBtn = fixture.nativeElement.querySelector('.tfm-more-toggle') as HTMLButtonElement | null;
    expect(toggleBtn).toBeTruthy();

    toggleBtn?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showMoreFields()).toBe(false);

    const actionBtn = fixture.nativeElement.querySelector('.tfm-more-action') as HTMLButtonElement | null;
    expect(actionBtn?.textContent?.trim()).toBe('Show');

    actionBtn?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showMoreFields()).toBe(true);
  });

  it('uploads a selected file immediately and adds it to attachedFiles', async () => {
    await build();
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await fixture.componentInstance.onFilesSelected({ target: input } as unknown as Event);

    expect(api['uploadPendingFile']).toHaveBeenCalledWith(file, 'task_attachment');
    expect(fixture.componentInstance.attachedFiles()).toEqual([{ fileId: 'f1', name: 'a.png', sizeBytes: 100 }]);
  });

  it('removeAttachedFile deletes the pending upload and drops the pill', async () => {
    await build();
    fixture.componentInstance.attachedFiles.set([{ fileId: 'f1', name: 'a.png', sizeBytes: 100 }]);
    await fixture.componentInstance.removeAttachedFile('f1');

    expect(api['deletePendingFile']).toHaveBeenCalledWith('f1');
    expect(fixture.componentInstance.attachedFiles()).toEqual([]);
  });

  it('submit includes attachmentFileIds in the create payload', async () => {
    await build();
    fixture.componentInstance.attachedFiles.set([{ fileId: 'f1', name: 'a.png', sizeBytes: 100 }]);
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    await fixture.componentInstance.submitCreateWithAction('create_and_close');

    expect(createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ attachmentFileIds: ['f1'] }));
  });

  it('onBackdrop cleans up any still-pending attachments', async () => {
    await build();
    fixture.componentInstance.attachedFiles.set([{ fileId: 'f1', name: 'a.png', sizeBytes: 100 }]);
    fixture.componentInstance.onBackdrop();

    expect(api['deletePendingFile']).toHaveBeenCalledWith('f1');
  });
});

