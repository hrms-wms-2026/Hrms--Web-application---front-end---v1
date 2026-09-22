import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { SprintTabComponent } from './sprint-tab.component';
import { Sprint } from '../../models/sprint.model';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';

describe('SprintTabComponent', () => {
  let fixture: ComponentFixture<SprintTabComponent>;

  const baseSprint: Sprint = {
    id: 'sprint-1',
    objectiveId: 'obj-1',
    name: 'Sprint 1',
    goal: null,
    startDate: new Date('2026-08-18'),
    endDate: new Date('2026-08-25'),
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  const mockTasks: WorkTask[] = [];
  const mockStatusNames: Record<string, string> = {};

  function setup(overrides: {
    sprint?: Sprint;
    isObjectiveOwner?: boolean;
    tasks?: readonly WorkTask[];
    statusNames?: Record<string, string>;
    statuses?: readonly TaskStatusColumn[];
    objectiveOwners?: Record<string, boolean>;
    currentEmployeeId?: string;
    expanded?: boolean;
  } = {}): void {
    TestBed.configureTestingModule({
      imports: [SprintTabComponent]
    });
    fixture = TestBed.createComponent(SprintTabComponent);
    fixture.componentRef.setInput('sprint', overrides.sprint ?? baseSprint);
    fixture.componentRef.setInput('isObjectiveOwner', overrides.isObjectiveOwner ?? true);
    fixture.componentRef.setInput('tasks', overrides.tasks ?? mockTasks);
    fixture.componentRef.setInput('statusNames', overrides.statusNames ?? mockStatusNames);
    if (overrides.statuses !== undefined) {
      fixture.componentRef.setInput('statuses', overrides.statuses);
    }
    if (overrides.objectiveOwners !== undefined) {
      fixture.componentRef.setInput('objectiveOwners', overrides.objectiveOwners);
    }
    if (overrides.currentEmployeeId !== undefined) {
      fixture.componentRef.setInput('currentEmployeeId', overrides.currentEmployeeId);
    }
    fixture.componentRef.setInput('expanded', overrides.expanded ?? false);
    fixture.detectChanges();
  }

  it('shows an Edit button to the owner (and only the owner), emitting editRequested when clicked', () => {
    setup({ isObjectiveOwner: false });
    expect(fixture.nativeElement.querySelector('.sprint-tab__edit')).toBeNull();

    fixture.componentRef.setInput('isObjectiveOwner', true);
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector('.sprint-tab__edit') as HTMLButtonElement;
    expect(editButton).not.toBeNull();

    const editSpy = vi.fn();
    fixture.componentInstance.editRequested.subscribe(editSpy);
    editButton.click();

    expect(editSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking Expand toggles the expanded output/state and reveals the task list', () => {
    setup();
    const toggledSpy = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggledSpy);

    // Initially collapsed
    let taskList = fixture.nativeElement.querySelector('.sprint-tab__body');
    expect(taskList).toBeNull();

    // Click expand button
    const expandButton = fixture.debugElement.query(By.css('.sprint-tab__expand'));
    expandButton.nativeElement.click();
    expect(toggledSpy).toHaveBeenCalledTimes(1);

    // Simulate expanded state
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    taskList = fixture.nativeElement.querySelector('.sprint-tab__body');
    expect(taskList).not.toBeNull();
  });

  it('the + button emits createTaskRequested only when expanded', () => {
    setup();
    const createTaskSpy = vi.fn();
    fixture.componentInstance.createTaskRequested.subscribe(createTaskSpy);

    // When collapsed, + button should not be present
    let addButton = fixture.nativeElement.querySelector('.sprint-tab__add-task');
    expect(addButton).toBeNull();

    // Expand the sprint
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();

    // Now + button should be present and clickable
    addButton = fixture.nativeElement.querySelector('.sprint-tab__add-task');
    expect(addButton).not.toBeNull();
    addButton.click();
    expect(createTaskSpy).toHaveBeenCalledTimes(1);
  });

  it('draft sprint shows "No dates set" and a Start sprint button', () => {
    setup({ sprint: { ...baseSprint, status: 'draft', startDate: null, endDate: null } });
    expect(fixture.nativeElement.textContent).toContain('No dates set');
    expect(fixture.nativeElement.querySelector('[data-testid="start-sprint"]')).toBeTruthy();
  });

  it('active sprint shows a Complete Sprint button and no status dropdown', () => {
    setup({ sprint: { ...baseSprint, status: 'active' } });
    expect(fixture.nativeElement.querySelector('[data-testid="complete-sprint"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-work-dropdown')).toBeNull();
  });

  it('emits startRequested when Start sprint is clicked', () => {
    setup({ sprint: { ...baseSprint, status: 'draft', startDate: null, endDate: null } });
    const handler = vi.fn();
    (fixture.componentInstance as any).startRequested.subscribe(handler);
    fixture.nativeElement.querySelector('[data-testid="start-sprint"]').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('emits completeRequested when Complete Sprint is clicked', () => {
    setup({ sprint: { ...baseSprint, status: 'active' } });
    const handler = vi.fn();
    (fixture.componentInstance as any).completeRequested.subscribe(handler);
    fixture.nativeElement.querySelector('[data-testid="complete-sprint"]').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('complete sprint renders read-only with no action buttons', () => {
    setup({ sprint: { ...baseSprint, status: 'complete' } });
    expect(fixture.nativeElement.querySelector('[data-testid="start-sprint"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="complete-sprint"]')).toBeNull();
  });
});
