import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { TaskTableComponent } from './task-table.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskBoardStore } from '../../state/task-board.store';
import { environment } from '../../../../../environments/environment';

const task: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
  attachments: [], assignees: [],
  parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0
};

const status: TaskStatusColumn = {
  id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false,
  marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'public'
};

describe('TaskTableComponent', () => {
  let fixture: ComponentFixture<TaskTableComponent>;
  let httpMock: HttpTestingController;
  let boardStore: { subtasksByParentId: ReturnType<typeof vi.fn>; loadSubtasks: ReturnType<typeof vi.fn> };

  afterEach(() => httpMock.verify());

  beforeEach(() => {
    TestBed.resetTestingModule();
    boardStore = {
      subtasksByParentId: vi.fn().mockReturnValue({}),
      loadSubtasks: vi.fn().mockResolvedValue(undefined)
    };
    TestBed.configureTestingModule({
      imports: [TaskTableComponent, HttpClientTestingModule],
      providers: [{ provide: TaskBoardStore, useValue: boardStore }]
    });
    fixture = TestBed.createComponent(TaskTableComponent);
    httpMock = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('tasks', [task]);
    fixture.componentRef.setInput('statuses', [status]);
    fixture.componentRef.setInput('currentEmployeeId', 'e1');
    fixture.detectChanges();
  });

  it('shows the clock widget for an assignee row', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t1"] app-task-clock-widget')).toBeTruthy();
  });

  it('passes open-session ownership to the row clock widget', () => {
    fixture.componentRef.setInput('tasks', [{ ...task, openClockSessionEmployeeId: 'e2' }]);
    fixture.detectChanges();
    const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
    expect(widget.componentInstance.hasOpenSessionOtherEmployee()).toBe(true);
    expect(widget.componentInstance.hasOpenSessionMine()).toBe(false);
  });

  it('re-emits taskChanged from the row clock widget', () => {
    const changedSpy = vi.fn();
    fixture.componentInstance.taskChanged.subscribe(changedSpy);
    const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
    widget.componentInstance.pushed.emit(task);
    expect(changedSpy).toHaveBeenCalled();
  });

  it('does not emit viewed when Clock In is clicked inside the row', async () => {
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    (fixture.nativeElement.querySelector('[data-testid="task-row-t1"] [data-testid="clock-in-button"]') as HTMLButtonElement).click();
    expect(viewedSpy).not.toHaveBeenCalled();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/tasks/t1/clock-in`);
    req.flush(null);
    await fixture.whenStable();
  });

  it('does not emit viewed when the row Push popup Submit control is clicked', () => {
    fixture.componentRef.setInput('tasks', [{ ...task, openClockSessionEmployeeId: 'e1' }]);
    fixture.detectChanges();
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);
    (fixture.nativeElement.querySelector('[data-testid="push-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="push-submit-button"]') as HTMLButtonElement).click();
    expect(viewedSpy).not.toHaveBeenCalled();
  });

  it('hides the clock widget for a non-assignee row', () => {
    fixture.componentRef.setInput('tasks', [{ ...task, assigneeEmployeeIds: ['e2'] }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeNull();
  });

  it('shows a subtask toggle row only for tasks that have subtasks', () => {
    fixture.componentRef.setInput('tasks', [
      { ...task, id: 't1', subtaskTotalCount: 0 },
      { ...task, id: 't2', shortId: 'T-2', subtaskTotalCount: 2, subtaskCompletedCount: 1 }
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="task-row-t1-subtask-toggle"]')).toBeNull();
    const toggle = fixture.nativeElement.querySelector('[data-testid="task-row-t2-subtask-toggle"]') as HTMLElement;
    expect(toggle).not.toBeNull();
    expect(toggle.textContent).toContain('1/2');
  });

  it('lazy-loads subtasks on first expand of a task row', () => {
    fixture.componentRef.setInput('tasks', [{ ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 }]);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="task-row-t1-subtask-toggle"]') as HTMLButtonElement).click();

    expect(boardStore.loadSubtasks).toHaveBeenCalledWith('t1');
    expect(boardStore.loadSubtasks).toHaveBeenCalledTimes(1);
  });

  it('clicking a nested subtask row emits viewed with the subtask, not the parent', () => {
    const subtask = { ...task, id: 'sub-1', title: 'Sub thing', subtaskTotalCount: 0 };
    boardStore.subtasksByParentId.mockReturnValue({ t1: [subtask] });
    fixture.componentRef.setInput('tasks', [{ ...task, subtaskTotalCount: 1, subtaskCompletedCount: 0 }]);
    fixture.detectChanges();
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('[data-testid="task-row-t1-subtask-toggle"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="task-row-sub-1"]') as HTMLElement).click();

    expect(viewedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sub-1' }));
  });

  it('renders no checkbox column when selectable is false (the default)', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="task-table-select-all"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="task-select-t1"]')).toBeNull();
  });

  describe('selectable mode', () => {
    const task2: WorkTask = { ...task, id: 't2', shortId: 'T-2' };

    beforeEach(() => {
      fixture.componentRef.setInput('tasks', [task, task2]);
      fixture.componentRef.setInput('selectable', true);
      fixture.componentRef.setInput('objectiveOwners', { o1: true });
      fixture.detectChanges();
    });

    it('renders no checkbox for a row whose module the caller does not own', () => {
      fixture.componentRef.setInput('objectiveOwners', {});
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="task-select-t1"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="task-select-t2"]')).toBeNull();
    });

    it('emits selectionChanged when a row checkbox is toggled, without emitting viewed', () => {
      const selectionSpy = vi.fn();
      const viewedSpy = vi.fn();
      fixture.componentInstance.selectionChanged.subscribe(selectionSpy);
      fixture.componentInstance.viewed.subscribe(viewedSpy);

      (fixture.nativeElement.querySelector('[data-testid="task-select-t1"]') as HTMLInputElement).click();

      expect(selectionSpy).toHaveBeenCalledWith({ taskId: 't1', selected: true });
      expect(viewedSpy).not.toHaveBeenCalled();
    });

    it('reflects selectedIds on each row checkbox', () => {
      fixture.componentRef.setInput('selectedIds', new Set(['t1']));
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('[data-testid="task-select-t1"]') as HTMLInputElement).checked).toBe(true);
      expect((fixture.nativeElement.querySelector('[data-testid="task-select-t2"]') as HTMLInputElement).checked).toBe(false);
    });

    it('header checkbox is checked only when every visible row is selected', () => {
      fixture.componentRef.setInput('selectedIds', new Set(['t1']));
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('[data-testid="task-table-select-all"]') as HTMLInputElement).checked).toBe(false);

      fixture.componentRef.setInput('selectedIds', new Set(['t1', 't2']));
      fixture.detectChanges();
      expect((fixture.nativeElement.querySelector('[data-testid="task-table-select-all"]') as HTMLInputElement).checked).toBe(true);
    });

    it('emits selectAllChanged with the selectable task ids when the header checkbox is toggled', () => {
      const selectAllSpy = vi.fn();
      fixture.componentInstance.selectAllChanged.subscribe(selectAllSpy);

      (fixture.nativeElement.querySelector('[data-testid="task-table-select-all"]') as HTMLInputElement).click();

      expect(selectAllSpy).toHaveBeenCalledWith({ taskIds: ['t1', 't2'], selected: true });
    });
  });
});
