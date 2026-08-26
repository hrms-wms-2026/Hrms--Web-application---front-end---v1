import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { TaskTableComponent } from './task-table.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

const task: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null
};

const status: TaskStatusColumn = {
  id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false,
  marksTaskComplete: false, visibility: 'public'
};

describe('TaskTableComponent', () => {
  let fixture: ComponentFixture<TaskTableComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskTableComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskTableComponent);
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
});
