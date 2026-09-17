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

  it('renders the hover "+" button in the header and always-visible "+ Add Task" button at the bottom', () => {
    const addBtn = fixture.debugElement.query(By.css('.task-board-column__add-btn'));
    expect(addBtn).not.toBeNull();
    expect(addBtn.nativeElement.getAttribute('title')).toBe('Add Task');

    const alwaysBtn = fixture.debugElement.query(By.css('.task-board-column__always-add-btn'));
    expect(alwaysBtn).not.toBeNull();
    expect(alwaysBtn.nativeElement.textContent).toContain('Add Task');
  });

  it('opens quick task card when header "+" button or always-visible button is clicked', () => {
    expect(fixture.debugElement.query(By.css('.quick-task-card'))).toBeNull();

    const addBtn = fixture.debugElement.query(By.css('.task-board-column__add-btn'));
    addBtn.nativeElement.click();
    fixture.detectChanges();

    const card = fixture.debugElement.query(By.css('.quick-task-card'));
    expect(card).not.toBeNull();
    const input = card.query(By.css('.quick-task-card__input'));
    expect(input).not.toBeNull();
    expect(input.nativeElement.placeholder).toBe('Task Name...');

    // Save button disabled initially
    const saveBtn = card.query(By.css('.quick-task-card__save-btn'));
    expect(saveBtn.nativeElement.disabled).toBe(true);
  });

  it('emits quickTaskCreated when title is entered and Save is clicked', async () => {
    fixture.componentRef.setInput('modules', [{ objectiveId: 'o1', title: 'Milestone 1', isOwner: true }]);
    fixture.componentRef.setInput('categories', [{ id: 'c1', name: 'General', displayOrder: 1, isDefault: true }]);
    fixture.detectChanges();

    fixture.componentInstance.openQuickCreate();
    fixture.detectChanges();

    const emitSpy = vi.fn();
    fixture.componentInstance.quickTaskCreated.subscribe((e) => {
      emitSpy(e);
      e.resolve(true);
    });

    fixture.componentInstance.quickTitle.set('My quick task');
    fixture.componentInstance.quickPriority.set('high');
    fixture.detectChanges();

    const saveBtn = fixture.debugElement.query(By.css('.quick-task-card__save-btn'));
    expect(saveBtn.nativeElement.disabled).toBe(false);

    await fixture.componentInstance.submitQuickTask();
    fixture.detectChanges();

    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'My quick task',
      statusId: 's1',
      priority: 'high',
      objectiveId: 'o1',
      categoryId: 'c1'
    }));
    expect(fixture.componentInstance.quickTitle()).toBe('');
  });

  it('closes quick task card on escape', () => {
    fixture.componentInstance.openQuickCreate();
    fixture.detectChanges();
    expect(fixture.componentInstance.isQuickCreateOpen()).toBe(true);

    fixture.componentInstance.onEscape();
    fixture.detectChanges();
    expect(fixture.componentInstance.isQuickCreateOpen()).toBe(false);
  });
});

