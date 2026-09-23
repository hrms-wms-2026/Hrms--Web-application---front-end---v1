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
    projectId: 'p-1',
    name: 'Sprint 1',
    goal: null,
    startDate: new Date('2026-08-18'),
    endDate: new Date('2026-08-25'),
    status: 'active',
    completedAt: null,
    achievedAt: null,
    canManage: true
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

  it('shows Edit in the capsule to the owner (and only the owner), emitting editRequested when clicked', () => {
    setup({ isObjectiveOwner: false });
    expect(fixture.nativeElement.querySelector('.sprint-tab__edit')).toBeNull();

    fixture.componentRef.setInput('isObjectiveOwner', true);
    fixture.detectChanges();

    const editButton = fixture.nativeElement.querySelector('.sprint-tab__edit') as HTMLButtonElement;
    expect(editButton).not.toBeNull();

    const editSpy = vi.fn();
    fixture.componentInstance.editRequested.subscribe(editSpy);
    openMenu();
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

  it('draft sprint shows "No dates set" and a Start sprint button', () => {
    setup({ sprint: { ...baseSprint, status: 'draft', startDate: null, endDate: null } });
    expect(fixture.nativeElement.textContent).toContain('No dates set');
    expect(fixture.nativeElement.querySelector('[data-testid="start-sprint"]')).toBeTruthy();
  });

  it('active sprint shows a Close sprint action and no status dropdown', () => {
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

  it('emits completeRequested when Close sprint is clicked', () => {
    setup({ sprint: { ...baseSprint, status: 'active' } });
    const handler = vi.fn();
    (fixture.componentInstance as any).completeRequested.subscribe(handler);
    openMenu();
    fixture.nativeElement.querySelector('[data-testid="complete-sprint"]').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('complete sprint renders read-only with no action buttons', () => {
    setup({ sprint: { ...baseSprint, status: 'complete' } });
    expect(fixture.nativeElement.querySelector('[data-testid="start-sprint"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="complete-sprint"]')).toBeNull();
  });

  function openMenu(): void {
    (fixture.nativeElement.querySelector('[data-testid="sprint-more-actions"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  afterEach(() => {
    // The open-menu id is shared across rows; close it so tests stay independent.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });

  it('shows only circular Start + More buttons in the header, with no old text buttons or body + icon button', () => {
    setup({ sprint: { ...baseSprint, status: 'draft', startDate: null, endDate: null }, expanded: true });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.sprint-tab__actions > .sprint-tab__circle').length).toBe(2);
    expect(el.textContent).not.toContain('View details');
    expect(el.textContent).not.toContain('Start sprint →');
    expect(el.querySelector('.sprint-tab__body .sprint-tab__add-task')).toBeNull();
  });

  it('the More button opens the capsule and turns into a close X that collapses it', () => {
    setup();
    const actions = fixture.nativeElement.querySelector('.sprint-tab__actions') as HTMLElement;
    const more = fixture.nativeElement.querySelector('[data-testid="sprint-more-actions"]') as HTMLButtonElement;
    expect(actions.classList).not.toContain('is-open');
    expect(more.getAttribute('aria-expanded')).toBe('false');

    openMenu();
    expect(actions.classList).toContain('is-open');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    expect(more.getAttribute('data-tooltip')).toBe('Close menu');

    more.click();
    fixture.detectChanges();
    expect(actions.classList).not.toContain('is-open');
  });

  it('capsule icons carry tooltips for edit, add task and close sprint', () => {
    setup();
    const tips = Array.from(fixture.nativeElement.querySelectorAll('.sprint-tab__capsule [data-tooltip]'))
      .map(b => (b as HTMLElement).getAttribute('data-tooltip'));
    expect(tips).toEqual(['Edit sprint', 'Add task in sprint', 'Close sprint']);
  });

  it('Add task in sprint emits createTaskRequested (even when collapsed) and closes the capsule', () => {
    setup({ expanded: false });
    const spy = vi.fn();
    fixture.componentInstance.createTaskRequested.subscribe(spy);
    openMenu();
    (fixture.nativeElement.querySelector('.sprint-tab__add-task') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.sprint-tab__actions').classList).not.toContain('is-open');
  });

  it('non-owners only get Add task in the capsule, and no Start button', () => {
    setup({ isObjectiveOwner: false, sprint: { ...baseSprint, status: 'draft', startDate: null, endDate: null } });
    expect(fixture.nativeElement.querySelector('[data-testid="start-sprint"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.sprint-tab__capsule button').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.sprint-tab__add-task')).not.toBeNull();
  });

  it('clicking outside the action area closes the capsule', () => {
    setup();
    openMenu();
    document.body.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sprint-tab__actions').classList).not.toContain('is-open');
  });

  it('opening another sprint menu closes this one', () => {
    setup();
    const other = TestBed.createComponent(SprintTabComponent);
    other.componentRef.setInput('sprint', { ...baseSprint, id: 'sprint-2' });
    other.componentRef.setInput('isObjectiveOwner', true);
    other.componentRef.setInput('tasks', []);
    other.componentRef.setInput('statusNames', {});
    other.detectChanges();

    openMenu();
    (other.nativeElement.querySelector('[data-testid="sprint-more-actions"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    other.detectChanges();

    expect(fixture.nativeElement.querySelector('.sprint-tab__actions').classList).not.toContain('is-open');
    expect(other.nativeElement.querySelector('.sprint-tab__actions').classList).toContain('is-open');
  });

  it('shows a board-style "+ Add Task" at the end of an expanded sprint that emits createTaskRequested', () => {
    setup({ expanded: true });
    const spy = vi.fn();
    fixture.componentInstance.createTaskRequested.subscribe(spy);
    const footer = fixture.nativeElement.querySelector('[data-testid="sprint-footer-add-task"]') as HTMLButtonElement;
    expect(footer.textContent).toContain('Add Task');
    footer.click();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('has no footer Add Task on a completed sprint', () => {
    setup({ sprint: { ...baseSprint, status: 'complete' }, expanded: true });
    expect(fixture.nativeElement.querySelector('[data-testid="sprint-footer-add-task"]')).toBeNull();
  });
});
