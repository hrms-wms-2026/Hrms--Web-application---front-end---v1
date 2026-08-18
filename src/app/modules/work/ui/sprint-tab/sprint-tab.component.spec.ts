import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { SprintTabComponent } from './sprint-tab.component';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

describe('SprintTabComponent', () => {
  let fixture: ComponentFixture<SprintTabComponent>;
  const mockSprint: Sprint = {
    id: 'sprint-1',
    objectiveId: 'obj-1',
    name: 'Sprint 1',
    startDate: new Date('2026-08-18'),
    endDate: new Date('2026-08-25'),
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  const mockTasks: WorkTask[] = [];
  const mockStatusNames: Record<string, string> = {};

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SprintTabComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(SprintTabComponent);
    fixture.componentRef.setInput('sprint', mockSprint);
    fixture.componentRef.setInput('isObjectiveOwner', false);
    fixture.componentRef.setInput('tasks', mockTasks);
    fixture.componentRef.setInput('statusNames', mockStatusNames);
    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();
  });

  it('shows an Edit button to the owner (and only the owner), emitting editRequested when clicked', () => {
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

  it('status is a dropdown for the owner, plain text for a member', () => {
    // Test with isObjectiveOwner = false (should show plain text)
    let statusSelect = fixture.nativeElement.querySelector('.sprint-tab__status-select');
    let statusText = fixture.nativeElement.querySelector('.sprint-tab__status-text');
    expect(statusSelect).toBeNull();
    expect(statusText).not.toBeNull();

    // Test with isObjectiveOwner = true (should show dropdown)
    fixture.componentRef.setInput('isObjectiveOwner', true);
    fixture.detectChanges();
    statusSelect = fixture.nativeElement.querySelector('.sprint-tab__status-select');
    statusText = fixture.nativeElement.querySelector('.sprint-tab__status-text');
    expect(statusSelect).not.toBeNull();
    expect(statusText).toBeNull();
  });

  it('clicking Expand toggles the expanded output/state and reveals the task list', () => {
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

  it('resyncs the <select> back to the real sprint status after a rejected/no-op pick', async () => {
    fixture.componentRef.setInput('isObjectiveOwner', true);
    fixture.detectChanges();

    const statusChangeSpy = vi.fn();
    fixture.componentInstance.statusChangeRequested.subscribe(statusChangeSpy);

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.sprint-tab__status-select');
    // Simulate the user picking "Incomplete" - the browser updates its own DOM value immediately,
    // even before Angular's change handler runs.
    select.value = 'incomplete';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(statusChangeSpy).toHaveBeenCalledWith('incomplete');
    // Immediately after the change event, the native element still shows the picked value...
    expect(select.value).toBe('incomplete');

    // ...but since the parent never accepted the pick, sprint().status ('active') never changed,
    // so the [value] binding alone would never rewrite the DOM. The queued microtask must do it.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    expect(select.value).toBe('active');
    expect(fixture.componentInstance.sprint().status).toBe('active');
  });

  it('the + button emits createTaskRequested only when expanded', () => {
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
});
