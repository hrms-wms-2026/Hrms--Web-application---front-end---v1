import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { MeetingsAvailabilityService } from '../../meetings/state/meetings-availability.service';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TaskFormModalComponent } from './task-form-modal.component';
import { ProjectMonitorApiService } from '../../data-access/project-monitor-api.service';
import { MONITOR_CHECK_DEBOUNCE_MS } from '../sub-module-form/sub-module-form.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { ProjectApiService } from '../../data-access/project-api.service';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardStore } from '../../state/task-board.store';
import { CurrentEmployeeStore } from '../../state/current-employee.store';
import { TaskCommentApiService } from '../../data-access/task-comment-api.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { UnsavedChangesService } from '../../../../shared/services/unsaved-changes.service';
import { DraftsStore } from '../../../../shared/state/drafts.store';
import { TaskDraftApiService } from '../../data-access/task-draft-api.service';

function baseCommentApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    getComments: vi.fn().mockReturnValue(of([])),
    postComment: vi.fn().mockReturnValue(of({})),
    postReply: vi.fn().mockReturnValue(of({})),
    editComment: vi.fn().mockReturnValue(of({})),
    deleteComment: vi.fn().mockReturnValue(of(undefined)),
    addReaction: vi.fn().mockReturnValue(of(undefined)),
    removeReaction: vi.fn().mockReturnValue(of(undefined))
  };
}

const taskDto = {
  id: 't1', objectiveId: 'o1', shortId: 'P-1', title: 'First', description: 'desc',
  categoryId: 'c1', statusId: 's1', priority: 'high' as const, storyPoints: 2, dueDate: '2026-09-01',
  estimatedHours: 4, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: ['e1'],
  openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
  attachments: [{ fileId: 'f1', fileName: 'spec.pdf', fileSizeBytes: 2048, contentType: 'application/pdf' }],
  createdAt: '2026-01-22T09:00:00Z'
};

function baseApi(): Record<string, ReturnType<typeof vi.fn>> {
  return {
    getTaskById: vi.fn().mockReturnValue(of(taskDto)),
    getStatuses: vi.fn().mockReturnValue(of([
      { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's2', name: 'Doing', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
      { id: 's3', name: 'Done', displayOrder: 2, requiresApproval: false, approverId: null, marksTaskComplete: true, visibility: 'public' }
    ])),
    getCategories: vi.fn().mockReturnValue(of([{ id: 'c1', name: 'Feature', displayOrder: 0 }])),
    getTaskHistory: vi.fn().mockReturnValue(of([])),
    editTask: vi.fn().mockReturnValue(of(taskDto)),
    deleteTask: vi.fn().mockReturnValue(of(undefined)),
    duplicateTask: vi.fn().mockReturnValue(of(taskDto)),
    convertToSubtask: vi.fn().mockReturnValue(of(taskDto)),
    assignTask: vi.fn().mockReturnValue(of(undefined)),
    unassignTask: vi.fn().mockReturnValue(of(undefined)),
    moveTaskStatus: vi.fn().mockReturnValue(of(undefined)),
    uploadPendingFile: vi.fn().mockReturnValue(of({ fileId: 'f1', originalFileName: 'a.png', fileSizeBytes: 100, contentType: 'image/png' })),
    deletePendingFile: vi.fn().mockReturnValue(of(undefined)),
    downloadFile: vi.fn().mockReturnValue(of(new Blob(['file'], { type: 'application/pdf' }))),
    getFileUrl: vi.fn((fileId: string) => `http://test/api/v1/work/tasks/files/${fileId}`),
    getCurrentEmployee: vi.fn().mockReturnValue(of({ employeeId: 'e1' }))
  };
}

const taskDraftApiStub = {
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn()
};
const draftsStoreStub = { load: vi.fn() };

beforeEach(() => {
  taskDraftApiStub.get.mockReset();
  taskDraftApiStub.create.mockReset().mockImplementation((projectId: string, title: string) =>
    of({ id: 'd-new', projectId, title, payload: {}, updatedAt: '' }));
  taskDraftApiStub.update.mockReset().mockImplementation((id: string, projectId: string, title: string) =>
    of({ id, projectId, title, payload: {}, updatedAt: '' }));
  taskDraftApiStub.remove.mockReset().mockReturnValue(of(undefined));
  draftsStoreStub.load.mockReset();
});

async function flush(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((r) => setTimeout(r, 0));
  fixture.detectChanges();
}

describe('TaskFormModalComponent - edit mode', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let milestones: ReturnType<typeof signal<{ objectiveId: string; title: string; isOwner: boolean; isEffectiveOwner: boolean }[]>>;
  let members: { employeeId: string; name: string; avatarUrl: string | null }[];

  beforeEach(async () => {
    api = baseApi();
    milestones = signal<{ objectiveId: string; title: string; isOwner: boolean; isEffectiveOwner: boolean }[]>(
      [{ objectiveId: 'o1', title: 'Module 1', isOwner: true, isEffectiveOwner: true }]
    );
    members = [
      { employeeId: 'e1', name: 'Ann', avatarUrl: 'https://api.test/employees/e1/avatar' },
      { employeeId: 'e2', name: 'Bob', avatarUrl: null }
    ];

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: TaskCommentApiService, useValue: baseCommentApi() },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        {
          provide: TaskBoardStore,
          useValue: {
            createTask: vi.fn(),
            error: () => null,
            tasks: () => [
              { id: 't1', shortId: 'P-1', title: 'First', statusId: 's1' },
              { id: 't2', shortId: 'P-2', title: 'Second', statusId: 's2' },
              { id: 't3', shortId: 'P-3', title: 'Third (done)', statusId: 's3' }
            ]
          }
        },
        { provide: ProjectDetailStore, useValue: { milestones, loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => members, project: () => null } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: TaskDraftApiService, useValue: taskDraftApiStub },
        { provide: DraftsStore, useValue: draftsStoreStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('taskId', 't1');
    fixture.componentRef.setInput('open', true);
    await flush(fixture);
  });

  it('warns (without blocking) when the assignee cannot finish their work by the due date', async () => {
    const monitor = TestBed.inject(ProjectMonitorApiService);
    const checkTask = vi.spyOn(monitor, 'checkTask').mockReturnValue(of({
      warnings: [{ code: 'employee_deadline_overload', message: 'Ann has 30 h of work due by Oct 7 but only 24 h of working time.', employeeId: 'e1' }]
    }));

    fixture.componentInstance.dueDate.set('2026-10-07');
    fixture.componentInstance.estimatedHours.set(10);
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, MONITOR_CHECK_DEBOUNCE_MS + 50));
    await flush(fixture);

    expect(checkTask).toHaveBeenLastCalledWith('p1', {
      taskId: 't1', assigneeEmployeeIds: ['e1'], dueDate: '2026-10-07', estimatedHours: 10
    });
    expect(fixture.nativeElement.querySelector('[data-testid="monitor-warnings"]').textContent)
      .toContain('Ann has 30 h of work due by Oct 7');
  });

  it('loads the task by its id input and seeds the form', () => {
    expect(api['getTaskById']).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.title()).toBe('First');
    expect(fixture.componentInstance.statusId()).toBe('s1');
    expect(fixture.componentInstance.assigneeEmployeeId()).toBe('e1');
  });

  it('shares a deep link that identifies the open task', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const notificationService = TestBed.inject(NotificationService);
    const success = vi.spyOn(notificationService, 'success');

    (fixture.nativeElement.querySelector('.tfm-header-share-btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/work/p1/board?taskId=t1'));
    expect(success).toHaveBeenCalledWith('Task link copied to clipboard.');
  });

  it('shows a plain description until the description section is clicked', async () => {
    expect(fixture.componentInstance.descRte()?.contentEditor()?.nativeElement.textContent).toContain('desc');
    expect(fixture.componentInstance.descRte()?.isReadOnlyMode()).toBe(true);
    const toolbar = fixture.nativeElement.querySelector('[data-testid="task-description-section"] .tfm-editor__toolbar') as HTMLElement;
    expect(getComputedStyle(toolbar).display).toBe('none');

    fixture.componentInstance.descRte()!.contentEditor()!.nativeElement.click();
    await flush(fixture);

    expect(fixture.componentInstance.descRte()?.editorActive()).toBe(true);
    expect(fixture.componentInstance.descRte()?.isReadOnlyMode()).toBe(false);
    expect(getComputedStyle(toolbar).display).not.toBe('none');
    expect(fixture.nativeElement.querySelector('app-rich-text-editor')?.classList).toContain('rte--borderless');
  });

  it('keeps the rich-text editor mounted after focus moves so editing is not interrupted', async () => {
    fixture.componentInstance.descRte()!.focus();
    await flush(fixture);

    const outsideButton = document.createElement('button');
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    await flush(fixture);
    outsideButton.remove();

    expect(fixture.componentInstance.descRte()?.editorActive()).toBe(true);
    expect(fixture.componentInstance.descRte()).toBeTruthy();
  });

  it('preserves inline rich-text formatting while the toolbar is hidden', () => {
    fixture.componentInstance.descRte()!.setHtml(
      '<div><span style="color: red; font-style: italic; background-color: pink;">Formatted</span></div>'
    );
    fixture.detectChanges();

    const formatted = fixture.componentInstance.descRte()!.contentEditor()!.nativeElement.querySelector('span') as HTMLElement;

    expect(getComputedStyle(formatted).color).toBe('rgb(255, 0, 0)');
    expect(getComputedStyle(formatted).fontStyle).toBe('italic');
    expect(getComputedStyle(formatted).backgroundColor).toBe('rgb(255, 192, 203)');
  });

  it('mounts app-task-comments with the current task id in edit mode', () => {
    fixture.detectChanges();

    const commentsEl: HTMLElement | null = fixture.nativeElement.querySelector('app-task-comments');
    expect(commentsEl).not.toBeNull();
  });

  it('renders the Activity section with All, Comments, History, and Work log tabs in edit mode', () => {
    fixture.detectChanges();

    const activitySection = fixture.nativeElement.querySelector('[data-testid="task-activity-section"]');
    expect(activitySection).not.toBeNull();
    expect(activitySection.textContent).toContain('Activity');
    expect(fixture.nativeElement.querySelector('[data-testid="tab-all"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tab-comments"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tab-history"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="tab-work-log"]')).not.toBeNull();
  });

  it('switches active activity tab and toggles sort order', () => {
    fixture.detectChanges();

    expect(fixture.componentInstance.activityTab()).toBe('comments');
    const historyTab = fixture.nativeElement.querySelector('[data-testid="tab-history"]') as HTMLButtonElement;
    historyTab.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activityTab()).toBe('history');

    expect(fixture.componentInstance.activitySortOrder()).toBe('desc');
    const sortBtn = fixture.nativeElement.querySelector('[data-testid="sort-activity-btn"]') as HTMLButtonElement;
    sortBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activitySortOrder()).toBe('asc');
  });

  it('shows the module name as visible text next to the header module icon', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="header-module-name"]') as HTMLElement;
    expect(el.textContent?.trim()).toBe('Module 1');
  });

  it('updates the module name if milestones finishes loading after the modal already opened', () => {
    milestones.set([]);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('[data-testid="header-module-name"]') as HTMLElement).textContent?.trim())
      .toBe('Select module');

    milestones.set([{ objectiveId: 'o1', title: 'Module 1', isOwner: true, isEffectiveOwner: true }]);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('[data-testid="header-module-name"]') as HTMLElement).textContent?.trim())
      .toBe('Module 1');
  });

  it('shows the task creation date near the kebab menu', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="task-created-at"]') as HTMLElement;
    expect(el.textContent?.trim()).toBe('Created Jan 22');
  });

  it('shows the more-actions kebab menu with Duplicate and Delete', () => {
    fixture.detectChanges();
    const moreBtn = fixture.nativeElement.querySelector('[data-testid="task-more-actions-button"]') as HTMLButtonElement;
    expect(moreBtn).not.toBeNull();

    moreBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-duplicate-action"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="task-delete-action"]')).not.toBeNull();
  });

  it('Delete action opens a confirm dialog; confirming calls deleteTask and emits saved + closed', async () => {
    fixture.detectChanges();
    const savedSpy = vi.fn();
    const closedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.componentInstance.openDeleteConfirm();
    fixture.detectChanges();
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(true);

    await fixture.componentInstance.onDeleteConfirmed();

    expect(api['deleteTask']).toHaveBeenCalledWith('t1');
    expect(savedSpy).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('Delete answered with 202 shows "sent for approval" and keeps the modal open', async () => {
    api['deleteTask'].mockReturnValue(of({ approvalRequestId: 'r1' }));
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');
    fixture.detectChanges();
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.componentInstance.openDeleteConfirm();
    await fixture.componentInstance.onDeleteConfirmed();

    expect(info).toHaveBeenCalledWith('Task deletion sent for approval.');
    expect(closedSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(false);
  });

  it('Delete failure keeps the confirm dialog open and shows the error', async () => {
    api['deleteTask'].mockReturnValue(throwError(() => ({ error: { detail: 'Only the owner can delete.' } })));
    fixture.detectChanges();

    fixture.componentInstance.openDeleteConfirm();
    await fixture.componentInstance.onDeleteConfirmed();

    expect(fixture.componentInstance.deleteConfirmOpen()).toBe(true);
    expect(fixture.componentInstance.deleteError()).toBe('Only the owner can delete.');
  });

  it('scopes the Duplicate dialog module list to modules the caller owns', () => {
    milestones.set([
      { objectiveId: 'o1', title: 'Module 1', isOwner: true, isEffectiveOwner: true },
      { objectiveId: 'o2', title: 'Module 2 (member only)', isOwner: false, isEffectiveOwner: false }
    ]);
    fixture.detectChanges();

    fixture.componentInstance.openDuplicateDialog();
    fixture.detectChanges();

    expect(fixture.componentInstance.duplicateDialogOpen()).toBe(true);
    expect(fixture.componentInstance.duplicateModuleOptions()).toEqual([{ objectiveId: 'o1', title: 'Module 1' }]);
  });

  it('confirming duplicate calls duplicateTask with the chosen options and emits saved + closed', async () => {
    fixture.detectChanges();
    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);

    await fixture.componentInstance.onDuplicateConfirmed({
      title: 'First (copy)', destinationObjectiveId: 'o1',
      copyAttachments: true, copyAssignees: true, copyComments: false, copyDueDate: true
    });

    expect(api['duplicateTask']).toHaveBeenCalledWith('t1', {
      title: 'First (copy)', destinationObjectiveId: 'o1',
      copyAttachments: true, copyAssignees: true, copyComments: false, copyDueDate: true
    });
    expect(savedSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.duplicateDialogOpen()).toBe(false);
  });

  it('Duplicate failure keeps the dialog open and shows the error', async () => {
    api['duplicateTask'].mockReturnValue(throwError(() => ({ error: { detail: 'Not enough allocation left.' } })));
    fixture.detectChanges();
    fixture.componentInstance.openDuplicateDialog();

    await fixture.componentInstance.onDuplicateConfirmed({
      title: 'Copy', destinationObjectiveId: 'o1',
      copyAttachments: false, copyAssignees: false, copyComments: false, copyDueDate: false
    });

    expect(fixture.componentInstance.duplicateDialogOpen()).toBe(true);
    expect(fixture.componentInstance.duplicateError()).toBe('Not enough allocation left.');
  });

  it('shows Convert to subtask for a top-level task but not for a subtask', () => {
    fixture.detectChanges();
    const moreBtn = fixture.nativeElement.querySelector('[data-testid="task-more-actions-button"]') as HTMLButtonElement;
    moreBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-convert-to-subtask-action"]')).not.toBeNull();

    fixture.componentInstance.task.update((t) => (t ? { ...t, parentTaskId: 'parent-1' } : t));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-convert-to-subtask-action"]')).toBeNull();
  });

  it('Convert to subtask candidates exclude the task itself and completed tasks', () => {
    fixture.detectChanges();
    fixture.componentInstance.openConvertToSubtaskDialog();
    fixture.detectChanges();

    expect(fixture.componentInstance.convertToSubtaskDialogOpen()).toBe(true);
    expect(fixture.componentInstance.convertToSubtaskCandidates()).toEqual([{ id: 't2', shortId: 'P-2', title: 'Second' }]);
  });

  it('confirming convert-to-subtask calls convertToSubtask and emits saved + closed', async () => {
    fixture.detectChanges();
    const savedSpy = vi.fn();
    const closedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);
    fixture.componentInstance.closed.subscribe(closedSpy);

    await fixture.componentInstance.onConvertToSubtaskConfirmed({ newParentTaskId: 't2' });

    expect(api['convertToSubtask']).toHaveBeenCalledWith('t1', { newParentTaskId: 't2' });
    expect(savedSpy).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.convertToSubtaskDialogOpen()).toBe(false);
  });

  it('Convert-to-subtask failure keeps the dialog open and shows the error', async () => {
    api['convertToSubtask'].mockReturnValue(throwError(() => ({ error: { detail: "A subtask cannot itself have subtasks." } })));
    fixture.detectChanges();
    fixture.componentInstance.openConvertToSubtaskDialog();

    await fixture.componentInstance.onConvertToSubtaskConfirmed({ newParentTaskId: 't2' });

    expect(fixture.componentInstance.convertToSubtaskDialogOpen()).toBe(true);
    expect(fixture.componentInstance.convertToSubtaskError()).toBe('A subtask cannot itself have subtasks.');
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

  it('renders the current assignee avatar image from the resolved avatarUrl', () => {
    const img = fixture.nativeElement.querySelector('.tfm-avatar-circle .avatar__image') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://api.test/employees/e1/avatar');
  });

  it('renders avatar images (or initials fallback) for every member in the assignee picker list', () => {
    fixture.componentInstance.togglePopover('assignee', new MouseEvent('click'));
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('.tfm-popover__item');
    const bobRow = Array.from(rows).find((el) => (el as HTMLElement).textContent?.includes('Bob')) as HTMLElement;
    expect(bobRow.querySelector('.avatar__fallback, .avatar__icon')).toBeTruthy();
    expect(bobRow.querySelector('.avatar__image')).toBeNull();

    const annRow = Array.from(rows).find((el) => (el as HTMLElement).textContent?.includes('Ann')) as HTMLElement;
    const annImg = annRow.querySelector('.avatar__image') as HTMLImageElement;
    expect(annImg.src).toBe('https://api.test/employees/e1/avatar');
  });

  it('edit by non-owner calls editTask (not an edit request) and shows the "sent for approval" info toast on 202', async () => {
    milestones.set([{ objectiveId: 'o1', title: 'Module 1', isOwner: false, isEffectiveOwner: false }]);
    api['editTask'].mockReturnValue(of({ approvalRequestId: 'r1' }));
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');
    fixture.detectChanges();
    fixture.componentInstance.title.set('Edited');
    await fixture.componentInstance.submit();
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
    expect(info).toHaveBeenCalledWith('Task edit sent for approval.');
  });

  it('a member whose field edits go for approval still gets the reassignment applied', async () => {
    // Reassignment is its own, separately-permitted action: it applies even when the backend
    // answers the field edit with a 202 "sent for approval".
    milestones.set([{ objectiveId: 'o1', title: 'Module 1', isOwner: true, isEffectiveOwner: false }]);
    api['editTask'].mockReturnValue(of({ approvalRequestId: 'r1' }));
    fixture.detectChanges();
    fixture.componentInstance.title.set('Edited');
    fixture.componentInstance.assigneeEmployeeId.set('e2');
    await fixture.componentInstance.submit();
    expect(api['editTask']).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Edited' }));
    expect(api['unassignTask']).toHaveBeenCalledWith('t1', 'e1');
    expect(api['assignTask']).toHaveBeenCalledWith('t1', 'e2');
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

  it('downloads an attachment when its file name is clicked', async () => {
    const objectUrl = 'blob:task-attachment';
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    (fixture.nativeElement.querySelector('.tal-pill-download') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api['downloadFile']).toHaveBeenCalledWith('f1');
    expect(createObjectUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith(objectUrl);

    createObjectUrl.mockRestore();
    revokeObjectUrl.mockRestore();
    anchorClick.mockRestore();
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

describe('TaskFormModalComponent - assignee display outside milestone scope', () => {
  it('resolves the assignee name/avatar from the task\'s own identity when the assignee is missing from assignableMembers', async () => {
    const scopedOutTaskDto = {
      ...taskDto,
      assigneeEmployeeIds: ['e3'],
      assignees: [{ employeeId: 'e3', name: 'Chandra Silva', avatarFileId: null, avatarUrl: null }]
    };
    const api = { ...baseApi(), getTaskById: vi.fn().mockReturnValue(of(scopedOutTaskDto)) };

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: TaskCommentApiService, useValue: baseCommentApi() },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: { createTask: vi.fn(), error: () => null, tasks: () => [] } },
        {
          provide: ProjectDetailStore,
          useValue: {
            // The viewer's reachable milestones only surface e1/e2 - e3 (the actual assignee) is
            // outside that scope, mirroring an admin-assigned task a lower-permission viewer opens.
            milestones: signal([{ objectiveId: 'o1', title: 'Module 1', isOwner: true, isEffectiveOwner: true }]),
            loadProjectMembers: vi.fn().mockResolvedValue(undefined),
            projectMembers: () => [
              { employeeId: 'e1', name: 'Ann', avatarUrl: null },
              { employeeId: 'e2', name: 'Bob', avatarUrl: null }
            ],
            project: () => ({
              members: [
                { userId: 'e1', displayName: 'Ann', avatarFileId: null },
                { userId: 'e2', displayName: 'Bob', avatarFileId: null },
                { userId: 'e3', displayName: 'Chandra Silva (roster)', avatarFileId: null }
              ],
              memberCount: 3
            })
          }
        },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: TaskDraftApiService, useValue: taskDraftApiStub },
        { provide: DraftsStore, useValue: draftsStoreStub }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('taskId', 't1');
    fixture.componentRef.setInput('open', true);
    await flush(fixture);

    expect(fixture.componentInstance.assigneeEmployeeId()).toBe('e3');
    // Resolved from the task's own server-side identity, not the raw GUID and not the roster's
    // (deliberately different) name, proving assignableMembers isn't the only source consulted.
    expect(fixture.componentInstance.assigneeName()).toBe('Chandra Silva');
  });
});

describe('TaskFormModalComponent - create mode', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let createTask: ReturnType<typeof vi.fn>;

  async function build(opts: { module?: string; sprint?: string; isOwner?: boolean; draftId?: string; allowMeeting?: boolean;
    categories?: unknown[] } = {}): Promise<void> {
    api = baseApi();
    if (opts.categories) api['getCategories'] = vi.fn().mockReturnValue(of(opts.categories));
    createTask = vi.fn().mockResolvedValue({ id: 't-new', objectiveId: 'o1' });

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaskApiService, useValue: api },
        { provide: ProjectApiService, useValue: {
          getMyMilestones: vi.fn().mockReturnValue(of([{ objectiveId: 'o1', title: 'Mod 1', isOwner: opts.isOwner ?? true }]))
        } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([
          { id: 'sp1', projectId: 'p1', name: 'Sprint 1', startDate: '2026-09-01', endDate: '2026-09-14', status: 'active', completedAt: null, achievedAt: null, canManage: true }
        ])) } },
        { provide: TaskBoardStore, useValue: { createTask, createSubtask: vi.fn().mockResolvedValue({}), error: () => null } },
        { provide: ProjectDetailStore, useValue: { milestones: signal([]), loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [], project: () => null } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: TaskDraftApiService, useValue: taskDraftApiStub },
        { provide: DraftsStore, useValue: draftsStoreStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskFormModalComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('mode', 'create');
    if (opts.module) fixture.componentRef.setInput('prefillModuleId', opts.module);
    if (opts.sprint) fixture.componentRef.setInput('prefillSprintId', opts.sprint);
    if (opts.draftId) fixture.componentRef.setInput('draftId', opts.draftId);
    if (opts.allowMeeting) fixture.componentRef.setInput('allowMeeting', true);
    fixture.componentRef.setInput('open', true);
    await flush(fixture);
  }

  describe('the "meeting" category', () => {
    const categories = [
      { id: 'c-meeting', name: 'meeting', displayOrder: 0, systemKey: 'meeting' },
      { id: 'c-task', name: 'task', displayOrder: 1 },
    ];
    const el = (testId: string) => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;

    it('never opens on "meeting", even when it is the first category', async () => {
      await build({ allowMeeting: true, categories });
      expect(fixture.componentInstance.categoryId()).toBe('c-task');
      expect(el('embedded-meeting-form')).toBeNull();
    });

    it('turns the form into the meeting form, keeping the title, and back again', async () => {
      await build({ allowMeeting: true, categories, module: 'o1' });
      fixture.componentInstance.title.set('Sprint review');
      fixture.componentInstance.categoryId.set('c-meeting');
      fixture.detectChanges();

      const meeting = fixture.debugElement.query(By.css('app-meeting-form-modal'));
      expect(meeting).not.toBeNull();
      expect(meeting.componentInstance.embedded()).toBe(true);
      expect(meeting.componentInstance.placement()).toEqual({ projectId: 'p1', objectiveId: 'o1' });
      expect(meeting.componentInstance.form.controls.title.value).toBe('Sprint review');
      // The meeting form brings its own Cancel and Create; the task footer steps aside.
      expect((fixture.nativeElement.querySelector('.tfm__foot') as HTMLElement).style.display).toBe('none');
      expect(el('add-subtask-button')).toBeNull();

      fixture.componentInstance.categoryId.set('c-task');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('app-meeting-form-modal'))).toBeNull();
      expect(el('add-subtask-button')).not.toBeNull();
    });

    it('is not offered where meetings are not allowed (other screens, edit), so no plain task becomes a "meeting"', async () => {
      await build({ categories });
      expect(fixture.componentInstance.pickableCategories().map((c) => c.id)).toEqual(['c-task']);
    });

    it('is not offered once the server says meetings are off', async () => {
      await build({ allowMeeting: true, categories });
      TestBed.inject(MeetingsAvailabilityService).noteError(new HttpErrorResponse({ status: 503, error: { code: 'meetings_disabled' } }));
      expect(fixture.componentInstance.pickableCategories().map((c) => c.id)).toEqual(['c-task']);
    });

    it('hands a created meeting to the host and closes', async () => {
      await build({ allowMeeting: true, categories });
      const created = vi.fn();
      const closed = vi.fn();
      fixture.componentInstance.meetingCreated.subscribe(created);
      fixture.componentInstance.closed.subscribe(closed);
      const event = { outcome: 'created', seriesId: 's1', occurrenceTaskId: 'm1', originalStart: '2026-11-02T03:30:00Z' };

      fixture.componentInstance.onMeetingCreated(event as never);

      expect(created).toHaveBeenCalledWith(event);
      expect(closed).toHaveBeenCalled();
    });
  });

  it('starts with an empty title and never loads a task', async () => {
    await build();
    expect(fixture.componentInstance.title()).toBe('');
    expect(api['getTaskById']).not.toHaveBeenCalled();
  });

  const savedDraft = {
    id: 'd1', projectId: 'p1', title: 'Saved title', updatedAt: '',
    payload: {
      version: 1, description: '<p>hi</p>', objectiveId: 'o1', sprintId: '', categoryId: 'c1', statusId: '',
      priority: 'high', dueDate: '2026-10-01', estimatedHours: 3, storyPoints: null, assigneeEmployeeId: '',
      subtasks: [{ id: 's1', title: 'Sub' }],
      attachments: [{ fileId: 'f1', name: 'x.pdf', sizeBytes: 10 }], attachmentFileIds: ['f1']
    }
  };
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('closing an untouched create form closes immediately (prefills are not changes)', async () => {
    await build({ module: 'o1' });
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.componentInstance.onCancel();
    await settle();

    expect(closedSpy).toHaveBeenCalled();
    expect(TestBed.inject(UnsavedChangesService).prompt()).toBeNull();
  });

  it('closing after typing asks; Save draft creates the draft, refreshes the bar and closes', async () => {
    await build();
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.componentInstance.title.set('Fix login');

    fixture.componentInstance.onCancel();
    const unsaved = TestBed.inject(UnsavedChangesService);
    await settle();
    expect(unsaved.prompt()?.canSaveDraft).toBe(true);
    unsaved.choose('save');
    await settle();

    expect(taskDraftApiStub.create).toHaveBeenCalledWith('p1', 'Fix login', expect.objectContaining({ version: 1 }));
    expect(draftsStoreStub.load).toHaveBeenCalled();
    expect(closedSpy).toHaveBeenCalled();
  });

  it('Keep editing leaves the modal open', async () => {
    await build();
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.componentInstance.title.set('Typed');

    fixture.componentInstance.onCancel();
    await settle();
    TestBed.inject(UnsavedChangesService).choose('keep');
    await settle();

    expect(closedSpy).not.toHaveBeenCalled();
    expect(taskDraftApiStub.create).not.toHaveBeenCalled();
  });

  it('Discard deletes pending attachments that are not part of a saved draft', async () => {
    await build();
    fixture.componentInstance.attachedFiles.set([{ fileId: 'f-new', name: 'a.png', sizeBytes: 1 }]);

    fixture.componentInstance.onCancel();
    await settle();
    TestBed.inject(UnsavedChangesService).choose('discard');
    await settle();

    expect(api['deletePendingFile']).toHaveBeenCalledWith('f-new');
  });

  it('opening with draftId hydrates the form and is not dirty until edited', async () => {
    taskDraftApiStub.get.mockReturnValue(of(savedDraft));
    await build({ draftId: 'd1' });
    const comp = fixture.componentInstance;
    const closedSpy = vi.fn();
    comp.closed.subscribe(closedSpy);

    expect(comp.title()).toBe('Saved title');
    expect(comp.priority()).toBe('high');
    expect(comp.draftSubtasks().map((st) => st.title)).toEqual(['Sub']);
    expect(comp.attachedFiles().map((f) => f.fileId)).toEqual(['f1']);

    comp.onCancel();
    await settle();

    expect(closedSpy).toHaveBeenCalled();
    expect(api['deletePendingFile']).not.toHaveBeenCalledWith('f1');
  });

  it('saving again from a resumed draft updates instead of creating', async () => {
    taskDraftApiStub.get.mockReturnValue(of(savedDraft));
    await build({ draftId: 'd1' });
    fixture.componentInstance.title.set('Changed');

    fixture.componentInstance.onCancel();
    await settle();
    TestBed.inject(UnsavedChangesService).choose('save');
    await settle();

    expect(taskDraftApiStub.update).toHaveBeenCalledWith('d1', 'p1', 'Changed', expect.anything());
    expect(taskDraftApiStub.create).not.toHaveBeenCalled();
  });

  it('creating the task deletes the draft it came from', async () => {
    taskDraftApiStub.get.mockReturnValue(of(savedDraft));
    await build({ draftId: 'd1' });

    await fixture.componentInstance.submitCreateWithAction('create_and_close');
    await settle();

    expect(createTask).toHaveBeenCalled();
    expect(taskDraftApiStub.update).not.toHaveBeenCalled();
    expect(taskDraftApiStub.remove).toHaveBeenCalledWith('d1');
    expect(draftsStoreStub.load).toHaveBeenCalled();
  });

  it('an action item create carries the meeting occurrence it was raised from', async () => {
    taskDraftApiStub.get.mockReturnValue(of(savedDraft));
    await build({ draftId: 'd1' });
    fixture.componentRef.setInput('sourceMeetingOccurrenceId', 'occ-1');

    await fixture.componentInstance.submitCreateWithAction('create_and_close');
    await settle();

    expect(createTask).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sourceMeetingOccurrenceId: 'occ-1' }));
  });

  it('an ordinary create sends no source occurrence', async () => {
    taskDraftApiStub.get.mockReturnValue(of(savedDraft));
    await build({ draftId: 'd1' });

    await fixture.componentInstance.submitCreateWithAction('create_and_close');
    await settle();

    expect(createTask.mock.calls[0][1].sourceMeetingOccurrenceId).toBeUndefined();
  });

  it('a create sent for approval detaches the draft attachments before deleting the draft', async () => {
    taskDraftApiStub.get.mockReturnValue(of(savedDraft));
    await build({ draftId: 'd1', isOwner: false });
    createTask.mockResolvedValue({ approvalRequestId: 'r1' });

    await fixture.componentInstance.submitCreateWithAction('create_and_close');
    await settle();

    expect(createTask).toHaveBeenCalled();
    expect(taskDraftApiStub.update).toHaveBeenCalledWith(
      'd1', 'p1', 'Saved title', expect.objectContaining({ attachments: [], attachmentFileIds: [] }));
    expect(taskDraftApiStub.remove).toHaveBeenCalledWith('d1');
  });

  it('uses the shared click-to-edit, borderless description in create mode', async () => {
    await build();
    const editor = fixture.componentInstance.descRte()!;
    const toolbar = fixture.nativeElement.querySelector('.tfm-editor__toolbar') as HTMLElement;

    expect(editor.isReadOnlyMode()).toBe(true);
    expect(getComputedStyle(toolbar).display).toBe('none');
    expect(fixture.nativeElement.querySelector('app-rich-text-editor')?.classList).toContain('rte--borderless');

    editor.contentEditor()!.nativeElement.click();
    fixture.detectChanges();

    expect(editor.editorActive()).toBe(true);
    expect(getComputedStyle(toolbar).display).not.toBe('none');
    expect(editor.contentEmpty()).toBe(true);
    expect(editor.contentEditor()!.nativeElement.classList).toContain('tfm-editor__content--empty');
  });

  it('aligns title and description text and uses a neutral focus line without glow', async () => {
    await build();
    const title = fixture.nativeElement.querySelector('.tfm-title-input') as HTMLInputElement;
    const description = fixture.componentInstance.descRte()!.contentEditor()!.nativeElement;

    expect(getComputedStyle(title).paddingLeft).toBe('8px');
    expect(getComputedStyle(description).paddingLeft).toBe('8px');

    title.focus();
    fixture.detectChanges();

    expect(['', 'none']).toContain(getComputedStyle(title).boxShadow);
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

  it('selectSprint sets the sprint without touching the module (sprints are project-scoped)', async () => {
    await build();
    fixture.componentInstance.selectedObjectiveId.set('');
    fixture.componentInstance.selectSprint('sp1');
    expect(fixture.componentInstance.sprintId()).toBe('sp1');
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('');
  });

  it('creates with no sprint selected — sprint is optional', async () => {
    await build();
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    fixture.componentInstance.sprintId.set('');
    fixture.componentInstance.setPriority('medium');
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
    fixture.componentInstance.setPriority('medium');
    await fixture.componentInstance.submit();
    expect(createdSpy).toHaveBeenCalledWith('t-new');
  });

  it('create by non-owner calls createTask and shows "sent for approval" on 202', async () => {
    await build({ isOwner: false });
    createTask.mockResolvedValue({ approvalRequestId: 'r1' });
    const info = vi.spyOn(TestBed.inject(NotificationService), 'info');
    const createdSpy = vi.fn();
    const closedSpy = vi.fn();
    fixture.componentInstance.created.subscribe(createdSpy);
    fixture.componentInstance.closed.subscribe(closedSpy);
    fixture.componentInstance.title.set('Ask');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    fixture.componentInstance.setPriority('medium');
    await fixture.componentInstance.submit();
    expect(createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ title: 'Ask' }));
    expect(info).toHaveBeenCalledWith('Task sent for approval.');
    expect(createdSpy).toHaveBeenCalledWith('');
    expect(closedSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.submitting()).toBe(false);
  });

  it('shows the allocation slack hint when createTask reports insufficient allocation', async () => {
    await build();
    createTask.mockResolvedValue({ availableSlackHours: 3, suggestedAction: 'extend_allocation' });
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    fixture.componentInstance.setPriority('medium');
    await fixture.componentInstance.submit();
    expect(fixture.componentInstance.allocationHint()?.availableSlackHours).toBe(3);
  });

  it('blocks submit when the module is missing (module is required)', async () => {
    await build();
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('');
    fixture.componentInstance.categoryId.set('c1');
    fixture.componentInstance.setPriority('medium');
    await fixture.componentInstance.submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['objectiveId']).toBeTruthy();
  });

  it('blocks submit when priority is not chosen (priority is required, no more silent Medium default)', async () => {
    await build();
    fixture.componentInstance.title.set('X');
    fixture.componentInstance.selectedObjectiveId.set('o1');
    fixture.componentInstance.categoryId.set('c1');
    expect(fixture.componentInstance.priority()).toBeNull();
    await fixture.componentInstance.submit();
    expect(createTask).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errors()['priority']).toBeTruthy();
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
    fixture.componentInstance.setPriority('medium');

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

  it('renders Due Date chip with consistent tfm-chip styling and label', async () => {
    // Pin the clock so the due date is not 'Today'/'Yesterday'/'Tomorrow'.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-08-01T09:00:00'));
    try {
      await build();
      const chipBtn = fixture.nativeElement.querySelector('[data-testid="tfm-due-date-chip"]') as HTMLButtonElement | null;
      expect(chipBtn).toBeTruthy();
      expect(chipBtn?.classList.contains('tfm-chip')).toBe(true);
      expect(chipBtn?.querySelector('.tfm-chip-label')?.textContent?.trim()).toBe('Due date');

      fixture.componentInstance.dueDate.set('2026-10-15');
      fixture.detectChanges();
      expect(chipBtn?.querySelector('.tfm-chip-label')?.textContent?.trim()).toBe('Oct 15');
    } finally {
      vi.useRealTimers();
    }
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
    fixture.componentInstance.setPriority('medium');
    await fixture.componentInstance.submitCreateWithAction('create_and_close');

    expect(createTask).toHaveBeenCalledWith('o1', expect.objectContaining({ attachmentFileIds: ['f1'] }));
  });

  it('onBackdrop cleans up any still-pending attachments', async () => {
    await build();
    fixture.componentInstance.attachedFiles.set([{ fileId: 'f1', name: 'a.png', sizeBytes: 100 }]);
    fixture.componentInstance.onBackdrop();
    await new Promise<void>((resolve) => setTimeout(resolve));
    TestBed.inject(UnsavedChangesService).choose('discard');
    await new Promise<void>((resolve) => setTimeout(resolve));

    expect(api['deletePendingFile']).toHaveBeenCalledWith('f1');
  });

  it('uses the shared rich-text editor for the description and syncs its HTML', async () => {
    await build();
    const rte = fixture.componentInstance.descRte();
    expect(rte).toBeTruthy();

    rte!.htmlChange.emit('<div>From editor</div>');
    expect(fixture.componentInstance.description()).toBe('<div>From editor</div>');

    rte!.uploadFailed.emit('Failed to insert shot.png.');
    expect(fixture.componentInstance.errorMessage()).toBe('Failed to insert shot.png.');
  });

  it('files picked via the editor "/attach" command are uploaded as task attachments', async () => {
    await build();
    const file = new File(['x'], 'spec.pdf', { type: 'application/pdf' });

    fixture.componentInstance.descRte()!.filesAttached.emit([file]);
    await flush(fixture);

    expect(api['uploadPendingFile']).toHaveBeenCalledWith(file, 'task_attachment');
  });
});

describe('TaskFormModalComponent - subtasks section', () => {
  let fixture: ComponentFixture<TaskFormModalComponent>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let subtasksSignal: ReturnType<typeof signal<Record<string, any[]>>>;
  let boardStore: {
    createTask: ReturnType<typeof vi.fn>;
    error: () => string | null;
    subtasksByParentId: ReturnType<typeof vi.fn>;
    loadSubtasks: ReturnType<typeof vi.fn>;
    createSubtask: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    api = baseApi();
    subtasksSignal = signal({
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
    });
    boardStore = {
      createTask: vi.fn(),
      error: () => null,
      subtasksByParentId: vi.fn().mockImplementation(() => subtasksSignal()),
      loadSubtasks: vi.fn().mockResolvedValue(undefined),
      createSubtask: vi.fn().mockResolvedValue({ id: 'sub-2', title: 'New Sub' })
    };

    await TestBed.configureTestingModule({
      imports: [TaskFormModalComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: TaskCommentApiService, useValue: baseCommentApi() },
        { provide: ProjectApiService, useValue: { getMyMilestones: vi.fn().mockReturnValue(of([])) } },
        { provide: SprintApiService, useValue: { getByProject: vi.fn().mockReturnValue(of([])) } },
        { provide: TaskBoardStore, useValue: boardStore },
        { provide: ProjectDetailStore, useValue: { milestones: signal([{ objectiveId: 'o1', isOwner: true, isEffectiveOwner: true }]), loadProjectMembers: vi.fn().mockResolvedValue(undefined), projectMembers: () => [{ employeeId: 'e1', name: 'Ann', avatarUrl: null }], project: () => null } },
        { provide: CurrentEmployeeStore, useValue: { id: signal('e1'), ensureLoaded: vi.fn() } },
        { provide: TaskDraftApiService, useValue: taskDraftApiStub },
        { provide: DraftsStore, useValue: draftsStoreStub }
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

  it('creates a new subtask via boardStore.createSubtask and inherits parent module', async () => {
    (fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.newSubtaskModuleId()).toBe('o1');

    fixture.componentInstance.newSubtaskTitle.set('Fresh subtask');
    fixture.componentInstance.newSubtaskDueDate.set('2026-10-01');
    fixture.componentInstance.newSubtaskAssigneeId.set('e1');
    fixture.detectChanges();

    await fixture.componentInstance.saveNewSubtask('t1');

    expect(boardStore.createSubtask).toHaveBeenCalledWith('t1', expect.objectContaining({
      title: 'Fresh subtask',
      dueDate: '2026-10-01',
      assigneeEmployeeId: 'e1',
      objectiveId: 'o1',
      categoryId: 'c1'
    }));
    expect(fixture.componentInstance.addingSubtask()).toBe(false);
  });

  it('allows changing subtask module via module popover without showing module text in row', async () => {
    fixture.componentInstance.modules.set([
      { objectiveId: 'o1', title: 'Module One', isOwner: true },
      { objectiveId: 'o2', title: 'Module Two', isOwner: false }
    ]);
    (fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Verify module button exists and displays icon only (no module name text in row)
    const moduleBtn = fixture.nativeElement.querySelector('[data-testid="subtask-add-module-button"]') as HTMLButtonElement;
    expect(moduleBtn).not.toBeNull();
    expect(moduleBtn.textContent?.trim()).toBe('');

    // Open module popover
    moduleBtn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeSubtaskPopover()).toEqual({ id: 'new', type: 'module' });

    // Select module o2
    fixture.componentInstance.selectSubtaskModule('o2');
    fixture.detectChanges();

    expect(fixture.componentInstance.newSubtaskModuleId()).toBe('o2');
    expect(fixture.componentInstance.activeSubtaskPopover()).toBeNull();

    // Save and verify o2 is passed
    fixture.componentInstance.newSubtaskTitle.set('Changed module subtask');
    await fixture.componentInstance.saveNewSubtask('t1');

    expect(boardStore.createSubtask).toHaveBeenCalledWith('t1', expect.objectContaining({
      title: 'Changed module subtask',
      objectiveId: 'o2',
      categoryId: 'c1'
    }));
  });

  it('does not render subtasks table when 0 subtasks exist and not adding', async () => {
    subtasksSignal.set({});
    fixture.detectChanges();

    expect(fixture.componentInstance.subtasks().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.tfm-subtask-table-head')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tfm-subtasks-section')).toBeNull();

    // The Add subtask button is in the actions list
    const addBtn = fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]');
    expect(addBtn).not.toBeNull();
    expect(addBtn.textContent).toContain('Add subtask');
  });

  it('navigates to subtask detail when clicking a subtask row and provides return breadcrumb', async () => {
    const subTaskDto = {
      ...taskDto,
      id: 'sub-1',
      shortId: 'P-1.1',
      title: 'Subtask 1',
      parentTaskId: 't1'
    };
    api['getTaskById'].mockImplementation((id: string) => {
      if (id === 'sub-1') return of(subTaskDto);
      return of(taskDto);
    });

    const selectedSpy = vi.fn();
    fixture.componentInstance.taskSelected.subscribe(selectedSpy);

    const subtaskRow = fixture.nativeElement.querySelector('[data-testid="subtask-row-sub-1"]') as HTMLElement;
    expect(subtaskRow).not.toBeNull();
    subtaskRow.click();
    await flush(fixture);

    expect(selectedSpy).toHaveBeenCalledWith('sub-1');
    expect(fixture.componentInstance.currentTaskId()).toBe('sub-1');
    expect(fixture.componentInstance.title()).toBe('Subtask 1');
    expect(api['getTaskById']).toHaveBeenCalledWith('sub-1');

    // Breadcrumb should show parent task link
    const parentBreadcrumb = fixture.nativeElement.querySelector('[data-testid="breadcrumb-parent-task"]') as HTMLButtonElement;
    expect(parentBreadcrumb).not.toBeNull();
    expect(parentBreadcrumb.textContent).toContain('P-1');

    // Subtasks section should not be visible when viewing a subtask
    expect(fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]')).toBeNull();

    // Clicking parent link navigates back to parent task
    parentBreadcrumb.click();
    await flush(fixture);

    expect(selectedSpy).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.currentTaskId()).toBe('t1');
    expect(fixture.componentInstance.title()).toBe('First');
  });

  it('saves changes scoped to the subtask when viewing a subtask', async () => {
    const subTaskDto = {
      ...taskDto,
      id: 'sub-1',
      shortId: 'P-1.1',
      title: 'Subtask 1',
      parentTaskId: 't1'
    };
    api['getTaskById'].mockImplementation((id: string) => {
      if (id === 'sub-1') return of(subTaskDto);
      return of(taskDto);
    });

    await fixture.componentInstance.openSubtask('sub-1');
    await flush(fixture);

    fixture.componentInstance.title.set('Subtask 1 Edited');
    fixture.componentInstance.statusId.set('s2');

    await fixture.componentInstance.submit();

    expect(api['moveTaskStatus']).toHaveBeenCalledWith('sub-1', 's2');
    expect(api['editTask']).toHaveBeenCalledWith('sub-1', expect.objectContaining({ title: 'Subtask 1 Edited' }));
  });

  it('does not render table head when no subtasks exist, but allows adding subtasks', () => {
    subtasksSignal.set({ t1: [] });
    fixture.detectChanges();

    expect(fixture.componentInstance.subtasks().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.tfm-subtasks-section')).toBeNull();
    expect(fixture.nativeElement.querySelector('.tfm-subtask-table-head')).toBeNull();

    const addSubtaskBtn = fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]') as HTMLButtonElement;
    expect(addSubtaskBtn).not.toBeNull();

    addSubtaskBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tfm-subtask-inline-create')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="subtask-add-title"]')).not.toBeNull();

    // Priority button defaults to 'Priority' (not 'Normal')
    expect(fixture.componentInstance.formatSubtaskPriority(null)).toBe('Priority');
    expect(fixture.componentInstance.newSubtaskPriority()).toBeNull();

    // Toggling priority
    fixture.componentInstance.selectSubtaskPriority('critical');
    expect(fixture.componentInstance.newSubtaskPriority()).toBe('critical');
    expect(fixture.componentInstance.formatSubtaskPriority('critical')).toBe('Critical');

    // Clicking again clears back to null ('Priority')
    fixture.componentInstance.selectSubtaskPriority('critical');
    expect(fixture.componentInstance.newSubtaskPriority()).toBeNull();
    expect(fixture.componentInstance.formatSubtaskPriority(null)).toBe('Priority');
  });

  it('supports creating and removing draft subtasks in create mode without requiring assignee or date', async () => {
    fixture.componentInstance.internalMode.set('create');
    fixture.componentInstance.selectedObjectiveId.set('obj-1');
    fixture.componentInstance.categoryId.set('cat-1');
    fixture.componentInstance.priority.set('medium');
    fixture.componentInstance.title.set('New Parent Task');
    fixture.detectChanges();

    // When 0 subtasks, no table is rendered
    expect(fixture.nativeElement.querySelector('.tfm-subtasks-section')).toBeNull();
    expect(fixture.componentInstance.displayedSubtasks().length).toBe(0);

    // Open add subtask
    (fixture.nativeElement.querySelector('[data-testid="add-subtask-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.tfm-subtask-inline-create')).not.toBeNull();

    // Add subtask title only (no assignee, date, priority required)
    fixture.componentInstance.newSubtaskTitle.set('Draft Subtask A');
    await fixture.componentInstance.saveNewSubtask();
    fixture.detectChanges();

    expect(fixture.componentInstance.draftSubtasks().length).toBe(1);
    expect(fixture.componentInstance.displayedSubtasks().length).toBe(1);
    expect(fixture.componentInstance.displayedSubtasks()[0].title).toBe('Draft Subtask A');
    // Now that a subtask exists, the table is rendered
    expect(fixture.nativeElement.querySelector('.tfm-subtasks-section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.tfm-subtask-table-head')).not.toBeNull();

    // Remove draft subtask
    fixture.componentInstance.removeDraftSubtask(fixture.componentInstance.draftSubtasks()[0].id);
    fixture.detectChanges();

    expect(fixture.componentInstance.draftSubtasks().length).toBe(0);
    expect(fixture.componentInstance.displayedSubtasks().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.tfm-subtasks-section')).toBeNull();
  });

  it('renders Status column header and subtask status pill', () => {
    const statusCol = fixture.nativeElement.querySelector('.tfm-subtask-col-status');
    expect(statusCol).not.toBeNull();
    expect(statusCol.textContent).toContain('Status');

    const statusBtn = fixture.nativeElement.querySelector('[data-testid="subtask-status-sub-1"]') as HTMLButtonElement;
    expect(statusBtn).not.toBeNull();
    expect(statusBtn.textContent).toContain('To Do');
  });

  it('allows opening assignee popover and changing subtask assignee', async () => {
    const subtask = fixture.componentInstance.subtasks()[0];
    const assigneeBtn = fixture.nativeElement.querySelector('[data-testid="subtask-assignee-sub-1"]') as HTMLButtonElement;
    expect(assigneeBtn).not.toBeNull();

    // Click to open popover
    assigneeBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeSubtaskPopover()).toEqual({ id: 'sub-1', type: 'assignee' });

    // Change assignee to Ann ('e1') -> no change since already 'e1'
    await fixture.componentInstance.changeSubtaskAssignee(subtask, 'e1');
    expect(api['assignTask']).not.toHaveBeenCalled();

    // Change assignee to unassigned ('')
    await fixture.componentInstance.changeSubtaskAssignee(subtask, '');
    expect(api['unassignTask']).toHaveBeenCalledWith('sub-1', 'e1');
    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.activeSubtaskPopover()).toBeNull();
  });

  it('allows opening priority popover and changing subtask priority', async () => {
    const subtask = fixture.componentInstance.subtasks()[0];
    const priorityBtn = fixture.nativeElement.querySelector('[data-testid="subtask-priority-sub-1"]') as HTMLButtonElement;
    expect(priorityBtn).not.toBeNull();

    // Click to open popover
    priorityBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeSubtaskPopover()).toEqual({ id: 'sub-1', type: 'priority' });

    // Change priority to critical
    await fixture.componentInstance.changeSubtaskPriority(subtask, 'critical');
    expect(api['editTask']).toHaveBeenCalledWith('sub-1', expect.objectContaining({ priority: 'critical', title: 'Subtask 1' }));
    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.activeSubtaskPopover()).toBeNull();
  });

  it('allows opening status popover and changing subtask status', async () => {
    const subtask = fixture.componentInstance.subtasks()[0];
    const statusBtn = fixture.nativeElement.querySelector('[data-testid="subtask-status-sub-1"]') as HTMLButtonElement;
    expect(statusBtn).not.toBeNull();

    // Click to open popover
    statusBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeSubtaskPopover()).toEqual({ id: 'sub-1', type: 'status' });

    // Change status to s2
    await fixture.componentInstance.changeSubtaskStatus(subtask, 's2');
    expect(api['moveTaskStatus']).toHaveBeenCalledWith('sub-1', 's2');
    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t1');
    expect(fixture.componentInstance.activeSubtaskPopover()).toBeNull();
  });

  it('subtask edits emit changed (host refreshes, modal stays open) - never saved/closed', async () => {
    const comp = fixture.componentInstance;
    const subtask = comp.subtasks()[0];
    const saved = vi.fn();
    const closed = vi.fn();
    const changed = vi.fn();
    comp.saved.subscribe(saved);
    comp.closed.subscribe(closed);
    comp.changed.subscribe(changed);

    await comp.changeSubtaskPriority(subtask, 'critical');
    await comp.changeSubtaskStatus(subtask, 's2');
    await comp.changeSubtaskAssignee(subtask, 'someone-else');

    expect(changed).toHaveBeenCalledTimes(3);
    expect(saved).not.toHaveBeenCalled();
    expect(closed).not.toHaveBeenCalled();
  });

  it('renders header work item type button and allows changing category via popover', () => {
    fixture.componentInstance.categories.set([
      { id: 'c1', name: 'Feature', displayOrder: 0 },
      { id: 'c2', name: 'Bug', displayOrder: 1 }
    ]);
    fixture.detectChanges();

    const workItemBtn = fixture.nativeElement.querySelector('[data-testid="header-work-item-type-button"]') as HTMLButtonElement;
    expect(workItemBtn).not.toBeNull();
    expect(workItemBtn.textContent).toContain('Feature');

    // Clicking it opens headerCategory popover
    workItemBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activePopover()).toBe('headerCategory');

    // Selecting category 'c2' updates categoryId and categoryName
    fixture.componentInstance.selectCategory('c2');
    fixture.detectChanges();
    expect(fixture.componentInstance.categoryId()).toBe('c2');
    expect(fixture.componentInstance.categoryName()).toBe('Bug');
    expect(workItemBtn.textContent).toContain('Bug');
  });

  it('renders header module button and allows changing module via popover', () => {
    const moduleBtn = fixture.nativeElement.querySelector('[data-testid="header-module-button"]') as HTMLButtonElement;
    expect(moduleBtn).not.toBeNull();

    // Clicking it opens headerModule popover
    moduleBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activePopover()).toBe('headerModule');

    // Selecting a module
    fixture.componentInstance.selectedObjectiveId.set('obj-2');
    fixture.detectChanges();
    expect(fixture.componentInstance.selectedObjectiveId()).toBe('obj-2');
  });

  it('renders shared app-button for subtask actions and modal footer cancel', () => {
    const footerCancel = fixture.nativeElement.querySelector('.tfm__foot app-button');
    expect(footerCancel).not.toBeNull();
    expect(footerCancel.textContent).toContain('Cancel');

    // Open add subtask
    fixture.componentInstance.startAddSubtask();
    fixture.detectChanges();

    const subtaskCancel = fixture.nativeElement.querySelector('[data-testid="subtask-add-cancel"]');
    const subtaskSave = fixture.nativeElement.querySelector('[data-testid="subtask-add-save"]');
    expect(subtaskCancel?.tagName.toLowerCase()).toBe('app-button');
    expect(subtaskSave?.tagName.toLowerCase()).toBe('app-button');
  });

  it('renders tag button in subtask creation row and allows selecting category via popover', () => {
    fixture.componentInstance.categories.set([
      { id: 'c1', name: 'Task', displayOrder: 0 },
      { id: 'c2', name: 'Bug', displayOrder: 1 }
    ]);
    fixture.componentInstance.startAddSubtask();
    fixture.detectChanges();

    const tagBtn = fixture.nativeElement.querySelector('[data-testid="subtask-add-tag-button"]') as HTMLButtonElement;
    expect(tagBtn).not.toBeNull();

    // Click to open category popover
    tagBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.activeSubtaskPopover()).toEqual({ id: 'new', type: 'tag' });

    // Select category 'c2'
    fixture.componentInstance.selectSubtaskCategory('c2');
    fixture.detectChanges();
    expect(fixture.componentInstance.newSubtaskCategoryId()).toBe('c2');
    expect(fixture.componentInstance.activeSubtaskPopover()).toBeNull();
  });

  it('renders date button in subtask creation row and shows date text when selected', () => {
    fixture.componentInstance.startAddSubtask();
    fixture.detectChanges();

    const dateBtn = fixture.nativeElement.querySelector('[data-testid="subtask-add-date-button"]') as HTMLButtonElement;
    expect(dateBtn).not.toBeNull();
    // Initially has icon and no label text
    expect(dateBtn.querySelector('span')).toBeNull();

    // Click date button to open popover
    dateBtn.click();
    fixture.detectChanges();

    const popover = document.body.querySelector('.dp-popover');
    expect(popover).not.toBeNull();

    // Select date
    fixture.componentInstance.newSubtaskDueDate.set('2026-09-17');
    fixture.detectChanges();

    // Button now shows formatted date text instead of just an icon
    const dateLabel = dateBtn.querySelector('span');
    expect(dateLabel).not.toBeNull();
    expect(dateLabel!.textContent?.trim()).toBe('Sep 17');
  });
});


