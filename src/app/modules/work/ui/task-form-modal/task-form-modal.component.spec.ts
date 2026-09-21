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
    deletePendingFile: vi.fn().mockReturnValue(of(undefined)),
    getFileUrl: vi.fn((fileId: string) => `http://test/api/v1/work/tasks/files/${fileId}`)
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

  it('loads sprints and allows selecting sprint in edit mode', async () => {
    const sprintApi = TestBed.inject(SprintApiService);
    expect(sprintApi.getByProject).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.sprintId()).toBe('');

    fixture.componentInstance.selectSprint('spr-123');
    expect(fixture.componentInstance.sprintId()).toBe('spr-123');

    await fixture.componentInstance.submit();
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ sprintId: 'spr-123' }));
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

  it('inherits the module from the prefillSprintId input when prefillModuleId is not specified', async () => {
    await build({ sprint: 'sp1' });
    expect(fixture.componentInstance.sprintId()).toBe('sp1');
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
    expect(fixture.componentInstance.errors()['objectiveId']).toBeFalsy();
  });

  it('inherits the module when a sprint is selected via selectSprint', async () => {
    await build();
    fixture.componentInstance.selectedObjectiveId.set('');
    fixture.componentInstance.selectSprint('sp1');
    expect(fixture.componentInstance.sprintId()).toBe('sp1');
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('o1');
    expect(fixture.componentInstance.errors()['objectiveId']).toBeFalsy();
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

  it('applyTextColor runs execCommand foreColor and syncs description', async () => {
    await build();
    // jsdom does not implement document.execCommand, so vi.spyOn (which requires the property to
    // already exist) cannot be used here - stub it directly instead.
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    fixture.componentInstance.applyTextColor('#e03131');
    expect(execSpy).toHaveBeenCalledWith('foreColor', false, '#e03131');
    expect(fixture.componentInstance.showTextColorPopover()).toBe(false);
  });

  it('applyHighlight runs execCommand hiliteColor', async () => {
    await build();
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    fixture.componentInstance.applyHighlight('#fff3bf');
    expect(execSpy).toHaveBeenCalledWith('hiliteColor', false, '#fff3bf');
  });

  it('insertImage uploads the file and inserts an <img> at the saved selection', async () => {
    await build();
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await fixture.componentInstance.onImageFileSelected({ target: input } as unknown as Event);

    expect(api['uploadPendingFile']).toHaveBeenCalledWith(file, 'task_description_image');
    expect(execSpy).toHaveBeenCalledWith('insertImage', false, expect.stringContaining('/tasks/files/f1'));
  });

  it('a failed image upload does not touch the editor and surfaces an error', async () => {
    await build();
    api['uploadPendingFile'] = vi.fn().mockReturnValue(throwError(() => new Error('boom')));
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });

    await fixture.componentInstance.onImageFileSelected({ target: input } as unknown as Event);

    expect(execSpy).not.toHaveBeenCalledWith('insertImage', expect.anything(), expect.anything());
    expect(fixture.componentInstance.errorMessage()).toBeTruthy();
  });
});

describe('TaskFormModalComponent - slash command palette', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    api = baseApi();
    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: { createTask: vi.fn(), error: () => null } },
        { provide: ProjectDetailStore, useValue: { milestones: signal([]), loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [] } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('open', true);
    await flush(fixture);
  });

  it('filteredSlashCommands filters by keyword, label, and description', () => {
    const comp = fixture.componentInstance;
    expect(comp.allSlashCommands.length).toBe(15);

    comp.slashQuery.set('');
    expect(comp.filteredSlashCommands().length).toBe(15);

    comp.slashQuery.set('bold');
    expect(comp.filteredSlashCommands().some((c) => c.id === 'bold')).toBe(true);

    comp.slashQuery.set('h1');
    expect(comp.filteredSlashCommands().some((c) => c.id === 'h1')).toBe(true);

    comp.slashQuery.set('todo');
    expect(comp.filteredSlashCommands().some((c) => c.id === 'checklist')).toBe(true);

    comp.slashQuery.set('xyznotfound123');
    expect(comp.filteredSlashCommands().length).toBe(0);
  });

  it('ArrowDown and ArrowUp navigate the filtered commands with wrap-around', () => {
    const comp = fixture.componentInstance;
    comp.showSlashMenu.set(true);
    comp.slashQuery.set('');
    comp.slashSelectedIndex.set(0);

    const total = comp.filteredSlashCommands().length;

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(comp.slashSelectedIndex()).toBe(1);

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(comp.slashSelectedIndex()).toBe(0);

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(comp.slashSelectedIndex()).toBe(total - 1);
  });

  it('Escape closes the slash menu without closing the modal', () => {
    const comp = fixture.componentInstance;
    comp.showSlashMenu.set(true);
    const closedSpy = vi.fn();
    comp.closed.subscribe(closedSpy);

    comp.onEscape();
    expect(comp.showSlashMenu()).toBe(false);
    expect(closedSpy).not.toHaveBeenCalled();
  });

  it('Enter executes the selected slash command and closes menu', () => {
    const comp = fixture.componentInstance;
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.showSlashMenu.set(true);
    comp.slashQuery.set('bold');
    comp.slashSelectedIndex.set(0);

    comp.onEditorKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(comp.showSlashMenu()).toBe(false);
    expect(execSpy).toHaveBeenCalledWith('bold', false, undefined);
  });

  it('executeSlashCommand for link opens the link popover', () => {
    const comp = fixture.componentInstance;
    comp.showSlashMenu.set(true);

    comp.executeSlashCommand('link');

    expect(comp.showSlashMenu()).toBe(false);
    expect(comp.showLinkPopover()).toBe(true);
  });

  it('executeSlashCommand for highlight applies highlight color', () => {
    const comp = fixture.componentInstance;
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.executeSlashCommand('highlight');

    expect(execSpy).toHaveBeenCalledWith('hiliteColor', false, '#fff3bf');
  });

  it('executeSlashCommand for divider inserts horizontal rule', () => {
    const comp = fixture.componentInstance;
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    comp.executeSlashCommand('divider');

    expect(execSpy).toHaveBeenCalledWith('insertHorizontalRule', false, undefined);
  });
});

describe('TaskFormModalComponent - description editor enter key & checklist handling', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    api = baseApi();
    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: { createTask: vi.fn(), error: () => null } },
        { provide: ProjectDetailStore, useValue: { milestones: signal([]), loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [] } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('open', true);
    await flush(fixture);
  });

  it('onEditorFocus calls execCommand defaultParagraphSeparator div', () => {
    const execSpy = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof execSpy }).execCommand = execSpy;

    fixture.componentInstance.onEditorFocus();
    expect(execSpy).toHaveBeenCalledWith('defaultParagraphSeparator', false, 'div');
  });

  it('Enter inside a checklist item with text creates a new checklist item below', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    expect(editor).toBeTruthy();
    if (!editor) return;

    const item = comp.createChecklistItem('Buy groceries');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan.firstChild ?? textSpan, 13);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    const checkItems = editor.querySelectorAll('.tfm-check-item');
    expect(checkItems.length).toBe(2);
  });

  it('Enter inside an empty checklist item exits checklist to a normal div line', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan, 0);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.querySelector('.tfm-check-item')).toBeNull();
    const div = editor.querySelector('div');
    expect(div).toBeTruthy();
    expect(div?.querySelector('br')).toBeTruthy();
  });

  it('Backspace at the start of a checklist item converts it to a normal line', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('Some item');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan.firstChild ?? textSpan, 0);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.querySelector('.tfm-check-item')).toBeNull();
    expect(editor.textContent).toContain('Some item');
  });

  it('Enter inside a heading exits to a normal div line below it', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const h2 = document.createElement('h2');
    h2.textContent = 'Section Title';
    editor.appendChild(h2);

    const range = document.createRange();
    range.setStart(h2.firstChild!, 13);
    range.collapse(true);

    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    comp.onEditorKeydown(event);

    expect(event.defaultPrevented).toBe(true);
    expect(editor.children.length).toBe(2);
    expect(editor.children[0].tagName).toBe('H2');
    expect(editor.children[1].tagName).toBe('DIV');
  });

  it('toggling checkbox marks item with is-checked and updates description', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('Do homework');
    editor.appendChild(item);

    const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;

    comp.onEditorChange({ target: checkbox } as unknown as Event);

    expect(item.classList.contains('is-checked')).toBe(true);
    expect(checkbox.hasAttribute('checked')).toBe(true);
    expect(comp.description()).toContain('is-checked');
  });

  it('toggleHeading(h1) turns H1 on, and clicking it again turns it OFF back to a normal div', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const div = document.createElement('div');
    div.textContent = 'My Title';
    editor.appendChild(div);

    const range = document.createRange();
    range.setStart(div.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.toggleHeading('h1');
    const h1 = editor.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toContain('My Title');

    const h1Range = document.createRange();
    h1Range.setStart(h1!.firstChild!, 2);
    h1Range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(h1Range);

    comp.toggleHeading('h1');
    expect(editor.querySelector('h1')).toBeNull();
    const turnedOffDiv = editor.querySelector('div');
    expect(turnedOffDiv).toBeTruthy();
    expect(turnedOffDiv?.textContent).toContain('My Title');
  });

  it('toggleChecklist turns checklist OFF when currently on a checklist item', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const item = comp.createChecklistItem('Checklist task');
    editor.appendChild(item);

    const textSpan = item.querySelector('.tfm-check-text')!;
    const range = document.createRange();
    range.setStart(textSpan.firstChild ?? textSpan, 4);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    expect(editor.querySelector('.tfm-check-item')).toBeTruthy();

    comp.toggleChecklist();

    expect(editor.querySelector('.tfm-check-item')).toBeNull();
    expect(editor.textContent).toContain('Checklist task');
  });

  it('toggleCode turns code OFF when selection is inside a code tag', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const code = document.createElement('code');
    code.textContent = 'const x = 1;';
    editor.appendChild(code);

    const range = document.createRange();
    range.setStart(code.firstChild!, 3);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    expect(editor.querySelector('code')).toBeTruthy();

    comp.toggleCode();

    expect(editor.querySelector('code')).toBeNull();
    expect(editor.textContent).toContain('const x = 1;');
  });

  it('updateActiveFormats accurately detects active formats at cursor position', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    const h1 = document.createElement('h1');
    const bold = document.createElement('b');
    bold.textContent = 'Bold Title';
    h1.appendChild(bold);
    editor.appendChild(h1);

    const range = document.createRange();
    range.setStart(bold.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.activeFormats().h1).toBe(true);
    expect(comp.activeFormats().bold).toBe(true);
    expect(comp.activeFormats().italic).toBe(false);
  });

  it('toggleHeading on one line leaves sibling lines untouched', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div>Line 1</div><div>Line 2</div><div>Line 3</div>';
    comp.normalizeBlockLines(editor);

    const line2 = editor.children[1] as HTMLElement;
    const range = document.createRange();
    range.setStart(line2.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.toggleHeading('h1');

    expect(editor.children.length).toBe(3);
    expect(editor.children[0].tagName.toLowerCase()).toBe('div');
    expect(editor.children[0].textContent).toContain('Line 1');
    expect(editor.children[1].tagName.toLowerCase()).toBe('h1');
    expect(editor.children[1].textContent).toContain('Line 2');
    expect(editor.children[2].tagName.toLowerCase()).toBe('div');
    expect(editor.children[2].textContent).toContain('Line 3');
  });

  it('formatNormalText converts only targeted heading leaving other headings untouched', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<h1>Heading 1</h1><h1>Heading 2</h1>';
    comp.normalizeBlockLines(editor);

    const firstH1 = editor.children[0] as HTMLElement;
    const range = document.createRange();
    range.setStart(firstH1.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.formatNormalText();

    expect(editor.children[0].tagName.toLowerCase()).toBe('div');
    expect(editor.children[0].textContent).toContain('Heading 1');
    expect(editor.children[1].tagName.toLowerCase()).toBe('h1');
    expect(editor.children[1].textContent).toContain('Heading 2');
  });

  it('isSlashCommandActive indicates current active formatting correctly', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<h2>Subtitle</h2>';
    comp.normalizeBlockLines(editor);

    const h2 = editor.children[0] as HTMLElement;
    const range = document.createRange();
    range.setStart(h2.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.isSlashCommandActive('h2')).toBe(true);
    expect(comp.isSlashCommandActive('h1')).toBe(false);
    expect(comp.isSlashCommandActive('p')).toBe(false);
  });

  it('detects link format and does not falsely mark underline on a link', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div><a href="https://angular.io" class="tfm-preview-link">Angular</a></div>';
    comp.normalizeBlockLines(editor);

    const a = editor.querySelector('a') as HTMLAnchorElement;
    expect(a).toBeTruthy();

    const range = document.createRange();
    range.setStart(a.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.updateActiveFormats();

    expect(comp.activeFormats().link).toBe(true);
    expect(comp.activeFormats().underline).toBe(false);
    expect(comp.isSlashCommandActive('link')).toBe(true);
    expect(comp.isSlashCommandActive('underline')).toBe(false);
  });

  it('removeLink unwraps an existing anchor tag back to plain text', () => {
    const comp = fixture.componentInstance;
    const editor = comp.descEditor()?.nativeElement;
    if (!editor) return;

    editor.innerHTML = '<div><a href="https://angular.io" class="tfm-preview-link">Angular</a></div>';
    comp.normalizeBlockLines(editor);

    const a = editor.querySelector('a') as HTMLAnchorElement;
    const range = document.createRange();
    range.setStart(a.firstChild!, 2);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    comp.removeLink();

    expect(editor.querySelector('a')).toBeNull();
    expect(editor.textContent).toContain('Angular');
    expect(comp.activeFormats().link).toBe(false);
  });
});

describe('TaskFormModalComponent - subtasks section', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let boardStore: {
    createTask: ReturnType<typeof vi.fn>;
    error: () => string | null;
    subtasksByParentId: ReturnType<typeof vi.fn>;
    loadSubtasks: ReturnType<typeof vi.fn>;
    createSubtask: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = baseApi();
    boardStore = {
      createTask: vi.fn(),
      error: () => null,
      subtasksByParentId: vi.fn().mockReturnValue({
        t1: [
          {
            id: 'sub-1',
            title: 'Subtask 1',
            priority: 'high',
            statusId: 's1',
            assigneeEmployeeIds: ['e1'],
            parentTaskId: 't1',
            subtaskTotalCount: 0,
            subtaskCompletedCount: 0
          }
        ]
      }),
      loadSubtasks: vi.fn().mockResolvedValue(undefined),
      createSubtask: vi.fn().mockResolvedValue({ id: 'sub-2', title: 'New Sub' })
    };

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: boardStore },
        { provide: ProjectDetailStore, useValue: { milestones: signal([]), loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [{ employeeId: 'e1', name: 'Ann' }] } },
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

  it('calls loadSubtasks on edit mode load', () => {
    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t1');
  });

  it('renders existing subtasks and subtask progress count', () => {
    expect(fixture.componentInstance.subtasks().length).toBe(1);
    const subtaskRow = fixture.nativeElement.querySelector('[data-testid="subtask-row-sub-1"]');
    expect(subtaskRow).not.toBeNull();
    expect(subtaskRow.textContent).toContain('Subtask 1');
  });

  it('allows opening and cancelling subtask add form', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="subtask-add-title"]')).toBeNull();
    (fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="subtask-add-title"]')).not.toBeNull();

    (fixture.nativeElement.querySelector('[data-testid="subtask-add-cancel"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="subtask-add-title"]')).toBeNull();
  });

  it('creates a new subtask via boardStore.createSubtask', async () => {
    (fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    fixture.componentInstance.newSubtaskTitle.set('Fresh subtask');
    fixture.componentInstance.newSubtaskDueDate.set('2026-10-01');
    fixture.componentInstance.newSubtaskAssigneeId.set('e1');
    fixture.detectChanges();

    await fixture.componentInstance.saveNewSubtask('t1');

    expect(boardStore.createSubtask).toHaveBeenCalledWith('t1', {
      title: 'Fresh subtask',
      dueDate: '2026-10-01',
      assigneeEmployeeId: 'e1'
    });
    expect(fixture.componentInstance.addingSubtask()).toBe(false);
  });
});


