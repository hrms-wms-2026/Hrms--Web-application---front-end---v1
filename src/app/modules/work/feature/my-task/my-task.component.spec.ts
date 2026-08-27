import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MyTaskComponent } from './my-task.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintListStore } from '../../state/sprint-list.store';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { TaskBoardColumnComponent } from '../../ui/task-board-column/task-board-column.component';

const myTasks = [
  { id: 't1', objectiveId: 'o1', shortId: 'T-1', title: 'First', description: null, categoryId: 'c1', statusId: 's1', priority: 'high' as const, storyPoints: null, dueDate: '2026-09-01', estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: 'sp1', assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null },
  { id: 't2', objectiveId: 'o1', shortId: 'T-2', title: 'Second', description: null, categoryId: 'c1', statusId: 's1', priority: 'low' as const, storyPoints: null, dueDate: '2026-09-05', estimatedHours: null, completedHours: 0, progressPercent: 0, sprintId: 'sp2', assigneeEmployeeIds: ['e1'], openClockSessionEmployeeId: null, openClockSessionClockInAt: null }
];

describe('MyTaskComponent', () => {
  let fixture: ComponentFixture<MyTaskComponent>;
  let taskApiSpy: { getMyTasks: ReturnType<typeof vi.fn>; getStatuses: ReturnType<typeof vi.fn>; getCurrentEmployee: ReturnType<typeof vi.fn>; moveTaskStatus: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    taskApiSpy = {
      getMyTasks: vi.fn().mockReturnValue(of(myTasks)),
      getStatuses: vi.fn().mockReturnValue(of([
        { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' },
        { id: 's2', name: 'Doing', displayOrder: 1, requiresApproval: false, approverId: null, marksTaskComplete: false, visibility: 'public' }
      ])),
      getCurrentEmployee: vi.fn().mockReturnValue(of({ employeeId: 'e1' })),
      moveTaskStatus: vi.fn().mockReturnValue(of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [MyTaskComponent],
      providers: [
        { provide: TaskApiService, useValue: taskApiSpy },
        { provide: SprintListStore, useValue: { sprints: signal([]) } },
        { provide: ProjectDetailStore, useValue: { milestones: signal([{ objectiveId: 'o1', isOwner: false }]) } },
        { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: { get: () => 'p1' } } } } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(MyTaskComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  });

  it('fetches my tasks for the current project on init', () => {
    expect(taskApiSpy.getMyTasks).toHaveBeenCalledWith('p1', undefined);
  });

  it('defaults to Board view', () => {
    expect(fixture.componentInstance.view()).toBe('board');
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.error()).toBeNull();
    expect(fixture.componentInstance.filteredTasks().length).toBe(2);
    const testIds = Array.from(fixture.nativeElement.querySelectorAll('[data-testid]') as NodeListOf<Element>).map((el) => el.getAttribute('data-testid'));
    expect(testIds).toContain('my-task-board-view');
    expect(testIds).not.toContain('my-task-list-view');
  });

  // Regression: the board view's app-task-board-column was rendered without a
  // [currentEmployeeId] binding at all, so every card's isAssignee() silently defaulted to
  // false and the Clock In widget never showed for the current user's own tasks - the exact
  // same tasks the "My Task" page exists to surface.
  it('shows the clock widget on a Board-view card for the current employee\'s own task', () => {
    const widget = fixture.nativeElement.querySelector('app-task-clock-widget');
    expect(widget).toBeTruthy();
  });

  it('switches to List view on toggle click', () => {
    fixture.nativeElement.querySelector('[data-testid="my-task-view-toggle-list"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="my-task-list-view"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="my-task-board-view"]')).toBeNull();
  });

  it('filters the visible list by the search box, client-side', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="my-task-search"]') as HTMLInputElement;
    input.value = 'first';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredTasks().length).toBe(1);
    expect(fixture.componentInstance.filteredTasks()[0].title).toBe('First');
  });

  it('refetches with the selected sprintId when the Sprint filter changes', () => {
    fixture.componentInstance.setSprintFilter('sp1');
    expect(taskApiSpy.getMyTasks).toHaveBeenCalledWith('p1', 'sp1');
  });

  it('matches shortId case-insensitively in the search filter', () => {
    fixture.componentInstance.search.set('t-2');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredTasks().map((task) => task.id)).toEqual(['t2']);

    fixture.componentInstance.search.set('FIRST');
    fixture.detectChanges();
    expect(fixture.componentInstance.filteredTasks().map((task) => task.id)).toEqual(['t1']);
  });

  it('keeps the active search term when the sprint filter refetches tasks', async () => {
    taskApiSpy.getMyTasks.mockReturnValue(of([myTasks[0]]));
    fixture.componentInstance.search.set('first');
    fixture.componentInstance.setSprintFilter('sp1');
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fixture.componentInstance.search()).toBe('first');
    expect(fixture.componentInstance.filteredTasks().map((task) => task.id)).toEqual(['t1']);
  });

  it('preserves view and sprint filter across reload', async () => {
    fixture.componentInstance.view.set('list');
    fixture.componentInstance.sprintFilter.set('sp1');
    fixture.componentInstance.reload();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.componentInstance.view()).toBe('list');
    expect(fixture.componentInstance.sprintFilter()).toBe('sp1');
  });

  it('clears loading and reports an error when loading fails', async () => {
    taskApiSpy.getMyTasks.mockReturnValue(throwError(() => new Error('unavailable')));
    fixture.componentInstance.reload();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.error()).toBe('Failed to load your tasks.');
  });

  it('shows the no-search-results empty state when tasks exist but no task matches', () => {
    fixture.componentInstance.search.set('does-not-match');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tasks match your search.');
  });

  it('shows an empty state distinguishing no-tasks from no-search-results', async () => {
    taskApiSpy.getMyTasks.mockReturnValue(of([]));
    fixture.componentInstance.reload();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No tasks assigned to you');
  });

  it('navigates to the task detail page when a task is viewed', () => {
    const navigate = TestBed.inject(Router).navigate as ReturnType<typeof vi.fn>;
    fixture.componentInstance.onTaskViewed({ id: 't5', objectiveId: 'o1' } as never);
    expect(navigate).toHaveBeenCalledWith(['/work', 'p1', 'task', 't5']);
  });

  // Regression: the Board-view column emits (taskDropped) on a cross-column drop, but the
  // My Task template never bound that output, so dragging a card to another status column
  // snapped back and never persisted the status change.
  it('persists the status change when a Board-view card is dropped into another column', async () => {
    taskApiSpy.getMyTasks.mockClear();

    const column = fixture.debugElement.query(By.directive(TaskBoardColumnComponent));
    expect(column).toBeTruthy();
    column.triggerEventHandler('taskDropped', { taskId: 't1', newStatusId: 's2' });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(taskApiSpy.moveTaskStatus).toHaveBeenCalledWith('t1', 's2');
    expect(taskApiSpy.getMyTasks).toHaveBeenCalled();
  });
});
