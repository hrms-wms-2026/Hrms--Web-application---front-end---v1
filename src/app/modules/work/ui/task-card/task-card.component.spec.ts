import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { vi } from 'vitest';
import { TaskCardComponent } from './task-card.component';
import { TaskClockWidgetComponent } from '../task-clock-widget/task-clock-widget.component';

import { TaskStatusColumn, WorkTask } from '../../models/task.model';

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;

  const task: WorkTask = {
    id: 't-1', objectiveId: 'o-1', shortId: 'PRJ-1', title: 'Do the thing', description: null,
    categoryId: 'task', statusId: 's1', priority: 'high', storyPoints: null, dueDate: null,
    estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null,
    assigneeEmployeeIds: ['emp-1', 'emp-2'], openClockSessionEmployeeId: null
  };

  const statuses: TaskStatusColumn[] = [
    { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public' },
    { id: 's2', name: 'Done', displayOrder: 1, requiresApproval: false, marksTaskComplete: true, visibility: 'public' },
    { id: 's3', name: 'Internal Review', displayOrder: 2, requiresApproval: false, marksTaskComplete: false, visibility: 'private' }
  ];

    function setup(overrides: { employeeNames?: Record<string, string>; task?: WorkTask; currentEmployeeId?: string } = {}): void {

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskCardComponent] });
    fixture = TestBed.createComponent(TaskCardComponent);
        fixture.componentRef.setInput('task', overrides.task ?? task);
    fixture.componentRef.setInput('currentEmployeeId', overrides.currentEmployeeId ?? '');

    fixture.componentRef.setInput('statuses', statuses);
    fixture.componentRef.setInput('employeeNames', overrides.employeeNames ?? { 'emp-1': 'Nevi Peiris', 'emp-2': 'Sam Perera' });
    fixture.detectChanges();
  }

  it('shows the resolved assignee names, not the raw employee ids', () => {
    setup();
    const text = fixture.nativeElement.querySelector('.task-card__assignees').textContent as string;
    expect(text).toContain('Nevi Peiris');
    expect(text).toContain('Sam Perera');
    expect(text).not.toContain('emp-1');
  });

  it('falls back to "Unknown employee" for an id missing from employeeNames', () => {
    setup({ employeeNames: {} });
    const text = fixture.nativeElement.querySelector('.task-card__assignees').textContent as string;
    expect(text).toContain('Unknown employee');
  });

  it('clicking anywhere on the card emits viewed with the task', () => {
    setup();
    const viewedSpy = vi.fn();
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    (fixture.nativeElement.querySelector('.task-card') as HTMLElement).click();

    expect(viewedSpy).toHaveBeenCalledWith(task);
  });

  it('shows the current status as plain text, not an editable control', () => {
    setup();
    const statusEl = fixture.nativeElement.querySelector('[data-testid="task-card-status"]');
    expect(statusEl.textContent.trim()).toBe('To Do');
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
  });

  it('falls back to the raw statusId if the status is not in the provided list', () => {
    setup();
    fixture.componentRef.setInput('task', { ...task, statusId: 'missing-status' });
    fixture.detectChanges();
    const statusEl = fixture.nativeElement.querySelector('[data-testid="task-card-status"]');
    expect(statusEl.textContent.trim()).toBe('missing-status');
  });

  it('shows the clock widget when the caller is an assignee', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1'] }, currentEmployeeId: 'e1' });
    expect(fixture.nativeElement.querySelector('app-task-clock-widget')).toBeTruthy();
  });

  it('marks hasOpenSessionMine when the open session belongs to the caller', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: 'e1' }, currentEmployeeId: 'e1' });
    const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
    expect(widget.componentInstance.hasOpenSessionMine()).toBe(true);
  });

  it('marks hasOpenSessionOtherEmployee when a different employee holds the open session', () => {
    setup({ task: { ...task, assigneeEmployeeIds: ['e1', 'e2'], openClockSessionEmployeeId: 'e2' }, currentEmployeeId: 'e1' });
    const widget = fixture.debugElement.query(By.directive(TaskClockWidgetComponent));
    expect(widget.componentInstance.hasOpenSessionOtherEmployee()).toBe(true);
    expect(widget.componentInstance.hasOpenSessionMine()).toBe(false);
  });
});
