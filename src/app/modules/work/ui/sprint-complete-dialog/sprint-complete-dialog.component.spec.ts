import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { SprintCompleteDialogComponent } from './sprint-complete-dialog.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { Sprint } from '../../models/sprint.model';
import { WorkTask } from '../../models/task.model';

describe('SprintCompleteDialogComponent', () => {
  let fixture: ComponentFixture<SprintCompleteDialogComponent>;
  let storeStub: { complete: ReturnType<typeof vi.fn> };

  const sprint: Sprint = {
    id: 'sp-1', objectiveId: 'obj-1', name: 'Sprint 1', goal: null,
    startDate: new Date('2026-09-01'), endDate: new Date('2026-09-14'), status: 'active', completedAt: null, achievedAt: null
  };
  const otherSprint: Sprint = { ...sprint, id: 'sp-2', name: 'Sprint 2', status: 'draft' };

  function buildTask(overrides: Partial<WorkTask> = {}): WorkTask {
    return {
      id: 't-default',
      objectiveId: 'obj-1',
      shortId: '#1',
      title: 'Default task',
      description: null,
      categoryId: 'cat-1',
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
      activeEventId: null,
      activeEventName: null,
      attachments: [],
      ...overrides
    };
  }

  const tasks: WorkTask[] = [
    buildTask({ id: 't1', estimatedHours: 4, statusId: 'done' }),
    buildTask({ id: 't2', estimatedHours: 3, statusId: 'todo' })
  ];

  function setup(overrides: Record<string, unknown> = {}): void {
    storeStub = { complete: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      imports: [SprintCompleteDialogComponent],
      providers: [{ provide: SprintListStore, useValue: storeStub }]
    });
    fixture = TestBed.createComponent(SprintCompleteDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('sprint', sprint);
    fixture.componentRef.setInput('tasks', tasks);
    fixture.componentRef.setInput('otherSprints', [otherSprint]);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    for (const [key, value] of Object.entries(overrides)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
  }

  it('defaults to Move to Backlog and completes with that disposition', async () => {
    setup();
    const component = fixture.componentInstance as any;
    expect(component.disposition()).toBe('backlog');
    const completed = vi.fn();
    component.completed.subscribe(completed);

    await component.submit();

    expect(storeStub.complete).toHaveBeenCalledWith('sp-1', { disposition: 'backlog' }, 'obj-1', false, undefined);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it('requires a target sprint when disposition is sprint', async () => {
    setup();
    const component = fixture.componentInstance as any;
    component.disposition.set('sprint');
    await component.submit();

    expect(storeStub.complete).not.toHaveBeenCalled();
    expect(component.targetError()).toBeTruthy();
  });

  it('completes with the chosen target sprint', async () => {
    setup();
    const component = fixture.componentInstance as any;
    component.disposition.set('sprint');
    component.targetSprintId.set('sp-2');

    await component.submit();

    expect(storeStub.complete).toHaveBeenCalledWith('sp-1', { disposition: 'sprint', targetSprintId: 'sp-2' }, 'obj-1', false, undefined);
  });
});
