import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SprintStartDialogComponent } from './sprint-start-dialog.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

describe('SprintStartDialogComponent', () => {
  let fixture: ComponentFixture<SprintStartDialogComponent>;
  let storeStub: { start: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  function buildTask(overrides: Partial<WorkTask> = {}): WorkTask {
    return {
      id: 't',
      objectiveId: 'obj-1',
      shortId: 'T-1',
      title: 'Task',
      description: null,
      categoryId: 'task',
      statusId: 'todo',
      priority: 'medium',
      storyPoints: null,
      dueDate: null,
      estimatedHours: null,
      completedHours: 0,
      progressPercent: 0,
      sprintId: 'sp-1',
      assigneeEmployeeIds: [],
      openClockSessionEmployeeId: null,
      openClockSessionClockInAt: null,
      totalLoggedMinutes: 0,
      attachments: [],
      ...overrides
    } as WorkTask;
  }

  const sprint: Sprint = {
    id: 'sp-1', projectId: 'p-1', name: 'Sprint 1', goal: 'Old goal',
    startDate: null, endDate: null, status: 'draft', completedAt: null, achievedAt: null, canManage: true
  };

  const tasks: WorkTask[] = [
    buildTask({ id: 't1', estimatedHours: 4, assigneeEmployeeIds: ['e1'] }),
    buildTask({ id: 't2', estimatedHours: null, assigneeEmployeeIds: [] })
  ];

  function setup(overrides: Record<string, unknown> = {}): void {
    storeStub = { start: vi.fn().mockResolvedValue(true), error: vi.fn().mockReturnValue(null) };
    TestBed.configureTestingModule({
      imports: [SprintStartDialogComponent],
      providers: [{ provide: SprintListStore, useValue: storeStub }]
    });
    fixture = TestBed.createComponent(SprintStartDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('sprint', sprint);
    fixture.componentRef.setInput('tasks', tasks);
    fixture.componentRef.setInput('projectId', 'p-1');
    for (const [key, value] of Object.entries(overrides)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  it('pre-fills the goal from the sprint and summarizes tasks/hours/assignees', () => {
    setup();
    const component = fixture.componentInstance as any;
    expect(component.goal()).toBe('Old goal');
    expect(component.taskCount()).toBe(2);
    expect(component.totalEstimatedHours()).toBe(4);
    expect(component.assigneeCount()).toBe(1);
    expect(component.hasUnestimatedTasks()).toBe(true);
    expect(component.hasUnassignedTasks()).toBe(true);
  });

  it('starts the sprint with the chosen dates and emits started', async () => {
    setup();
    const component = fixture.componentInstance as any;
    component.startDate.set('2026-09-21');
    component.endDate.set('2026-10-02');
    const started = vi.fn();
    component.started.subscribe(started);

    await component.submit();

    expect(storeStub.start).toHaveBeenCalledWith(
      'sp-1', { startDate: '2026-09-21', endDate: '2026-10-02', goal: 'Old goal' }, 'p-1'
    );
    expect(started).toHaveBeenCalledTimes(1);
  });

  it('does not submit when either date is missing', async () => {
    setup();
    const component = fixture.componentInstance as any;
    component.startDate.set('2026-09-21');
    component.endDate.set('');
    await component.submit();

    expect(storeStub.start).not.toHaveBeenCalled();
    expect(component.dateError()).toBeTruthy();
  });

  it('auto-calculates and pre-selects upcoming sprint start and end dates on open', () => {
    setup();
    const component = fixture.componentInstance as any;
    expect(component.startDate()).toBeTruthy();
    expect(component.endDate()).toBeTruthy();
    expect(component.startDate() <= component.endDate()).toBe(true);
  });

  it('renders date range picker and updates dates via onDateRangeChange', async () => {
    setup();
    const component = fixture.componentInstance as any;
    expect(fixture.nativeElement.querySelector('app-date-range-picker')).not.toBeNull();

    component.onDateRangeChange({ from: '2026-09-25', to: '2026-10-05' });
    expect(component.startDate()).toBe('2026-09-25');
    expect(component.endDate()).toBe('2026-10-05');
    expect(component.dateError()).toBeNull();
  });
});
