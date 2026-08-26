import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { TaskTableComponent } from './task-table.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { environment } from '../../../../../environments/environment';

const task: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0
};

const status: TaskStatusColumn = {
  id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false,
  marksTaskComplete: false, visibility: 'public'
};

describe('TaskTableComponent', () => {
  let fixture: ComponentFixture<TaskTableComponent>;
  let httpMock: HttpTestingController;

  afterEach(() => httpMock.verify());

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskTableComponent, HttpClientTestingModule] });
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
});
