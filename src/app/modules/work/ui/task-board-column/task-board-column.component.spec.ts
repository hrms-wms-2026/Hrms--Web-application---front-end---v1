import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { TaskBoardColumnComponent } from './task-board-column.component';
import { TaskCardComponent } from '../task-card/task-card.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

const task: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
  attachments: []
};

const status: TaskStatusColumn = {
  id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false,
  marksTaskComplete: false, visibility: 'public'
};

describe('TaskBoardColumnComponent', () => {
  let fixture: ComponentFixture<TaskBoardColumnComponent>;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskBoardColumnComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskBoardColumnComponent);
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('tasks', [task]);
    fixture.componentRef.setInput('currentEmployeeId', 'e1');
    fixture.detectChanges();
  });

  it('threads currentEmployeeId to the task card', () => {
    const card = fixture.debugElement.query(By.directive(TaskCardComponent));
    expect(card.componentInstance.currentEmployeeId()).toBe('e1');
  });

  it('re-emits taskChanged from the task card', () => {
    const changedSpy = vi.fn();
    fixture.componentInstance.taskChanged.subscribe(changedSpy);
    const card = fixture.debugElement.query(By.directive(TaskCardComponent));
    card.componentInstance.taskChanged.emit();
    expect(changedSpy).toHaveBeenCalled();
  });
});
