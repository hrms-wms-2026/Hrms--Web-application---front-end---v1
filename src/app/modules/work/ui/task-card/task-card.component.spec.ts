import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TaskCardComponent } from './task-card.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

describe('TaskCardComponent', () => {
  let fixture: ComponentFixture<TaskCardComponent>;

  const task: WorkTask = {
    id: 't-1', objectiveId: 'o-1', shortId: 'PRJ-1', title: 'Do the thing', description: null,
    taskType: 'task', statusId: 's1', priority: 'high', storyPoints: null, dueDate: null,
    estimatedHours: 5, completedHours: 0, progressPercent: 0, sprintId: null,
    assigneeEmployeeIds: ['emp-1', 'emp-2']
  };

  const statuses: TaskStatusColumn[] = [
    { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public' },
    { id: 's2', name: 'Done', displayOrder: 1, requiresApproval: false, marksTaskComplete: true, visibility: 'public' },
    { id: 's3', name: 'Internal Review', displayOrder: 2, requiresApproval: false, marksTaskComplete: false, visibility: 'private' }
  ];

  function setup(overrides: { isObjectiveOwner?: boolean; employeeNames?: Record<string, string> } = {}): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [TaskCardComponent] });
    fixture = TestBed.createComponent(TaskCardComponent);
    fixture.componentRef.setInput('task', task);
    fixture.componentRef.setInput('statuses', statuses);
    fixture.componentRef.setInput('isObjectiveOwner', overrides.isObjectiveOwner ?? false);
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

  it('only shows public statuses in the dropdown for a non-owner, all statuses for the owner', () => {
    setup({ isObjectiveOwner: false });
    let options = Array.from(fixture.nativeElement.querySelectorAll('.task-card__status-select option') as NodeListOf<HTMLOptionElement>)
      .map((o) => o.textContent?.trim());
    expect(options).toEqual(['To Do', 'Done']);

    setup({ isObjectiveOwner: true });
    options = Array.from(fixture.nativeElement.querySelectorAll('.task-card__status-select option') as NodeListOf<HTMLOptionElement>)
      .map((o) => o.textContent?.trim());
    expect(options).toEqual(['To Do', 'Done', 'Internal Review']);
  });

  it('picking a status from the dropdown emits statusChangeRequested but not viewed (no card-click bubble)', () => {
    setup({ isObjectiveOwner: true });
    const statusSpy = vi.fn();
    const viewedSpy = vi.fn();
    fixture.componentInstance.statusChangeRequested.subscribe(statusSpy);
    fixture.componentInstance.viewed.subscribe(viewedSpy);

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.task-card__status-select');
    select.value = 's2';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    expect(statusSpy).toHaveBeenCalledWith('s2');
    expect(viewedSpy).not.toHaveBeenCalled();
  });
});
