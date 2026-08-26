import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TaskClockWidgetComponent } from './task-clock-widget.component';
import { WorkTask } from '../../models/task.model';

const baseTask: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 'st1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null, assigneeEmployeeIds: ['e1']
};

describe('TaskClockWidgetComponent', () => {
  let fixture: ComponentFixture<TaskClockWidgetComponent>;

  function setup(overrides: Partial<{ task: WorkTask; hasOpenSessionMine: boolean; hasOpenSessionOtherEmployee: boolean; isAssignee: boolean }> = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskClockWidgetComponent, HttpClientTestingModule] });
    fixture = TestBed.createComponent(TaskClockWidgetComponent);
    fixture.componentRef.setInput('task', overrides.task ?? baseTask);
    fixture.componentRef.setInput('hasOpenSessionMine', overrides.hasOpenSessionMine ?? false);
    fixture.componentRef.setInput('hasOpenSessionOtherEmployee', overrides.hasOpenSessionOtherEmployee ?? false);
    fixture.componentRef.setInput('isAssignee', overrides.isAssignee ?? true);
    fixture.detectChanges();
  }

  it('shows an enabled Clock In button when the caller is an assignee with no open session and the task is not locked', () => {
    setup();
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('disables Clock In when the task is locked at 100%', () => {
    setup({ task: { ...baseTask, progressPercent: 100 } });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('complete');
  });

  it('disables Clock In when someone else has an open session on this task', () => {
    setup({ hasOpenSessionOtherEmployee: true });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('in progress');
  });

  it('disables Clock In when the caller is not an assignee', () => {
    setup({ isAssignee: false });
    const btn = fixture.nativeElement.querySelector('[data-testid="clock-in-button"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.title).toContain('assignee');
  });

  it('shows a Push button instead of Clock In when the caller has an open session', () => {
    setup({ hasOpenSessionMine: true });
    expect(fixture.nativeElement.querySelector('[data-testid="clock-in-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="push-button"]')).toBeTruthy();
  });
});
