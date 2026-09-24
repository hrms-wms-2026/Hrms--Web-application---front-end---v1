import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { TaskBoardColumnComponent } from './task-board-column.component';
import { TaskCardComponent } from '../task-card/task-card.component';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { TaskApiService } from '../../data-access/task-api.service';

const task: WorkTask = {
  id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'Task', description: null,
  categoryId: 'c1', statusId: 's1', priority: 'medium', storyPoints: null, dueDate: null,
  estimatedHours: null, completedHours: 0, progressPercent: 30, sprintId: null,
  assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null, totalLoggedMinutes: 0,
  attachments: [], assignees: [],
  parentTaskId: null, subtaskTotalCount: 0, subtaskCompletedCount: 0, subtaskAssigneeEmployeeIds: []
};

const status: TaskStatusColumn = {
  id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false,
  marksTaskComplete: false, category: 'active', color: '#2563EB', visibility: 'public'
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
    fixture.componentInstance.setPriority('high');
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

  it('renders configured color and distinct ring, filled dot and check-circle indicators', () => {
    for (const category of ['not_started','active','done'] as const) {
      fixture.componentRef.setInput('status',{...status,category,color:'#123456'});fixture.detectChanges();
      const dot=fixture.nativeElement.querySelector('.task-board-column__status-dot') as HTMLElement;
      expect(dot.style.color).toBe('rgb(18, 52, 86)');
      expect(dot.classList.contains('task-board-column__status-dot--not-started')).toBe(category==='not_started');
      expect(dot.querySelector('svg')!==null).toBe(category==='done');
    }
  });

  it('renders collapse button in header and toggles collapsed state on click', () => {
    const collapseBtn = fixture.debugElement.query(By.css('.task-board-column__collapse-btn'));
    expect(collapseBtn).not.toBeNull();
    expect(collapseBtn.nativeElement.getAttribute('title')).toBe('Collapse group');

    // Initially not collapsed
    expect(fixture.componentInstance.isCollapsed()).toBe(false);
    expect(fixture.nativeElement.classList.contains('task-board-column-host--collapsed')).toBe(false);

    // Click collapse button
    collapseBtn.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isCollapsed()).toBe(true);
    expect(fixture.nativeElement.classList.contains('task-board-column-host--collapsed')).toBe(true);

    // Verify collapsed strip elements
    const collapsedStrip = fixture.debugElement.query(By.css('.task-board-column--collapsed'));
    expect(collapsedStrip).not.toBeNull();
    expect(collapsedStrip.query(By.css('.task-board-column__collapsed-title')).nativeElement.textContent).toContain('To Do');
    expect(collapsedStrip.query(By.css('.task-board-column__collapsed-count')).nativeElement.textContent).toContain('1');

    const expandBtn = collapsedStrip.query(By.css('.task-board-column__expand-btn'));
    expect(expandBtn).not.toBeNull();
    expect(expandBtn.nativeElement.getAttribute('title')).toBe('Expand group');

    // Click expand button to uncollapse
    expandBtn.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isCollapsed()).toBe(false);
    expect(fixture.nativeElement.classList.contains('task-board-column-host--collapsed')).toBe(false);
    expect(fixture.debugElement.query(By.css('.task-board-column--collapsed'))).toBeNull();
  });

  it('closes quick create card when column is collapsed', () => {
    fixture.componentInstance.openQuickCreate();
    fixture.detectChanges();
    expect(fixture.componentInstance.isQuickCreateOpen()).toBe(true);

    const collapseBtn = fixture.debugElement.query(By.css('.task-board-column__collapse-btn'));
    collapseBtn.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isCollapsed()).toBe(true);
    expect(fixture.componentInstance.isQuickCreateOpen()).toBe(false);
  });

  it('only shows 3-dot menu button to project members', () => {
    // Default isProjectMember is false
    expect(fixture.debugElement.query(By.css('.task-board-column__menu-btn'))).toBeNull();

    // Set isProjectMember to true
    fixture.componentRef.setInput('isProjectMember', true);
    fixture.detectChanges();

    const menuBtn = fixture.debugElement.query(By.css('.task-board-column__menu-btn'));
    expect(menuBtn).not.toBeNull();
    expect(menuBtn.nativeElement.getAttribute('title')).toBe('Group options');
  });

  it('opens 3-dot menu and executes collapse and edit statuses options', () => {
    fixture.componentRef.setInput('isProjectMember', true);
    fixture.detectChanges();

    const menuBtn = fixture.debugElement.query(By.css('.task-board-column__menu-btn'));
    menuBtn.nativeElement.click();
    fixture.detectChanges();

    const menu = fixture.debugElement.query(By.css('.task-board-column__menu'));
    expect(menu).not.toBeNull();
    const items = menu.queryAll(By.css('.task-board-column__menu-item'));
    expect(items.length).toBe(3);
    expect(items[0].nativeElement.textContent).toContain('Collapse group');
    expect(items[1].nativeElement.textContent).toContain('Rename');
    expect(items[2].nativeElement.textContent).toContain('Edit statuses');

    // Clicking edit statuses emits editStatusesClicked
    const editSpy = vi.fn();
    fixture.componentInstance.editStatusesClicked.subscribe(editSpy);
    items[2].nativeElement.click();
    fixture.detectChanges();

    expect(editSpy).toHaveBeenCalled();
    expect(fixture.debugElement.query(By.css('.task-board-column__menu'))).toBeNull();
  });

  it('switches to rename mode, allows changing color and name, and saves via TaskApiService', async () => {
    const api = TestBed.inject(TaskApiService);
    const editStatusSpy = vi.spyOn(api, 'editStatus').mockReturnValue(of(undefined as unknown as void));

    fixture.componentRef.setInput('isProjectMember', true);
    fixture.componentRef.setInput('projectId', 'proj-123');
    fixture.detectChanges();

    // Open menu and click Rename
    const menuBtn = fixture.debugElement.query(By.css('.task-board-column__menu-btn'));
    menuBtn.nativeElement.click();
    fixture.detectChanges();

    const renameItem = fixture.debugElement.queryAll(By.css('.task-board-column__menu-item'))[1];
    renameItem.nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.isRenaming()).toBe(true);

    // Verify rename box is displayed
    const renameBox = fixture.debugElement.query(By.css('.task-board-column__rename-box'));
    expect(renameBox).not.toBeNull();

    // Color swatch button
    const colorBtn = renameBox.query(By.css('.task-board-column__rename-color-btn'));
    expect(colorBtn).not.toBeNull();

    // Click color swatch to open palette
    colorBtn.nativeElement.click();
    fixture.detectChanges();

    const palette = fixture.debugElement.query(By.css('.task-board-column__color-palette'));
    expect(palette).not.toBeNull();
    const swatches = palette.queryAll(By.css('.task-board-column__color-swatch'));
    expect(swatches.length).toBe(4); // Gray, Green, Blue, Red

    // Select Green
    swatches[1].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.renameColor()).toBe('#16A34A');
    expect(fixture.debugElement.query(By.css('.task-board-column__color-palette'))).toBeNull();

    // Change title text
    const input = renameBox.query(By.css('.task-board-column__rename-input'));
    input.nativeElement.value = 'In Review';
    input.nativeElement.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const statusUpdatedSpy = vi.fn();
    fixture.componentInstance.statusUpdated.subscribe(statusUpdatedSpy);

    // Save
    const saveBtn = renameBox.query(By.css('.task-board-column__rename-save-btn'));
    saveBtn.nativeElement.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(editStatusSpy).toHaveBeenCalledWith('proj-123', 's1', expect.objectContaining({
      name: 'In Review',
      color: '#16A34A',
      category: 'active'
    }));
    expect(statusUpdatedSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.isRenaming()).toBe(false);
  });
});

