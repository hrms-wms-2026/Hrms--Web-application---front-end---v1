import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskCreateModalComponent } from './task-create-modal.component';
import { TaskBoardStore } from '../../state/task-board.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { Sprint } from '../../models/sprint.model';

describe('TaskCreateModalComponent', () => {
  const sprint: Sprint = {
    id: 'sp-1',
    objectiveId: 'obj-1',
    name: 'Sprint 1',
    startDate: new Date('2026-09-01'),
    endDate: new Date('2026-09-14'),
    status: 'active',
    completedAt: null,
    achievedAt: null
  };

  const sprint2: Sprint = {
    id: 'sp-2',
    objectiveId: 'obj-1',
    name: 'Sprint 2',
    startDate: new Date('2026-09-15'),
    endDate: new Date('2026-09-28'),
    status: 'future',
    completedAt: null,
    achievedAt: null
  };

  function setup(isObjectiveOwner: boolean, createTaskResult: unknown) {
    const createTask = vi.fn().mockResolvedValue(createTaskResult);
    const assignTask = vi.fn().mockReturnValue(of(undefined));
    const getCategories = vi.fn().mockReturnValue(of([{ id: 'cat-1', name: 'Task', displayOrder: 0 }]));
    TestBed.configureTestingModule({
      imports: [TaskCreateModalComponent],
      providers: [
        { provide: TaskBoardStore, useValue: { createTask, error: () => null } },
        {
          provide: TaskApiService,
          useValue: {
            createTaskCreationRequest: vi.fn().mockReturnValue(of({})),
            assignTask,
            getCategories
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(TaskCreateModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('objectiveId', 'obj-1');
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('isObjectiveOwner', isObjectiveOwner);
    fixture.componentRef.setInput('activeSprints', [sprint]);
    fixture.componentRef.setInput('assignableMembers', [{ employeeId: 'emp-1', name: 'Ada' }]);
    return { fixture, createTask, assignTask };
  }

  it('owner submit calls store.createTask directly', async () => {
    const { fixture, createTask } = setup(true, { id: 't-1', shortId: 'T-1', title: 'New task' });
    fixture.detectChanges();

    await fixture.componentInstance.submit({
      title: 'New task',
      categoryId: 'cat-1',
      priority: 'medium',
      sprintId: 'sp-1'
    });

    expect(createTask).toHaveBeenCalledWith('obj-1', expect.objectContaining({ title: 'New task' }));
  });

  it('does not submit until a sprint is selected', async () => {
    // Use two active sprints so the single-sprint auto-fill doesn't pre-select one for us -
    // this test is specifically about the visible-dropdown, nothing-chosen-yet case.
    const { fixture, createTask } = setup(true, { id: 't-1', shortId: 'T-1', title: 'New task' });
    fixture.componentRef.setInput('activeSprints', [sprint, sprint2]);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.title.set('New task');

    await fixture.componentInstance.submit();

    expect(createTask).not.toHaveBeenCalled();
  });

  it('on submit with an assignee selected, calls createTask then assignTask with the returned task id, in order', async () => {
    const order: string[] = [];
    const { fixture, createTask, assignTask } = setup(true, { id: 'task-1', shortId: 'T-1', title: 'New task' });
    createTask.mockImplementation(async () => {
      order.push('create');
      return { id: 'task-1', shortId: 'T-1', title: 'New task' };
    });
    assignTask.mockImplementation(() => {
      order.push('assign');
      return of(undefined);
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.sprintId.set('sp-1');
    fixture.componentInstance.assigneeEmployeeId.set('emp-1');

    await fixture.componentInstance.submit();

    expect(order).toEqual(['create', 'assign']);
    expect(assignTask).toHaveBeenCalledWith('task-1', 'emp-1');
  });

  it('on submit with no assignee selected, calls createTask only, never assignTask', async () => {
    const { fixture, createTask, assignTask } = setup(true, { id: 'task-1', shortId: 'T-1', title: 'New task' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.title.set('New task');
    fixture.componentInstance.sprintId.set('sp-1');

    await fixture.componentInstance.submit();

    expect(createTask).toHaveBeenCalled();
    expect(assignTask).not.toHaveBeenCalled();
  });

  it('with exactly one active sprint, hides the dropdown and pre-fills sprintId', () => {
    const { fixture } = setup(true, null);
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('select.task-create-modal__sprint-select');
    const fixedText = fixture.nativeElement.querySelector('[data-testid="sprint-fixed"]');

    expect(select).toBeNull();
    expect(fixedText).not.toBeNull();
    expect(fixedText.textContent).toContain('Sprint 1');
    expect(fixture.componentInstance.sprintId()).toBe('sp-1');
  });

  it('with multiple active sprints, shows the dropdown and does not pre-fill sprintId', () => {
    const { fixture } = setup(true, null);
    fixture.componentRef.setInput('activeSprints', [sprint, sprint2]);
    fixture.detectChanges();

    const fixedText = fixture.nativeElement.querySelector('[data-testid="sprint-fixed"]');
    const sprintSelect = fixture.nativeElement.querySelector('[data-testid="task-create-sprint-select"] select') as HTMLSelectElement;
    const options = Array.from(sprintSelect.options).map((o) => o.textContent?.trim());

    expect(fixedText).toBeNull();
    expect(options).toEqual(['Select a sprint', 'Sprint 1', 'Sprint 2']);
    expect(fixture.componentInstance.sprintId()).toBe('');
  });

  it('omits the sprint field and allows a null sprintId when sprint is optional', async () => {
    const { fixture, createTask } = setup(true, { id: 't-1' });
    fixture.componentRef.setInput('activeSprints', []);
    fixture.componentRef.setInput('sprintRequired', false);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.title.set('Backlog task');

    await fixture.componentInstance.submit();

    expect(fixture.nativeElement.querySelector('select.task-create-modal__sprint-select')).toBeNull();
    expect(createTask).toHaveBeenCalledWith('obj-1', expect.objectContaining({ title: 'Backlog task', sprintId: null }));
  });

  describe('with a modules list (Backlog\'s project-wide context)', () => {
    function setupWithModules(createTaskResult: unknown = { id: 't-1', shortId: 'T-1', title: 'New task' }) {
      const { fixture, createTask, assignTask } = setup(false, createTaskResult);
      fixture.componentRef.setInput('sprintRequired', false);
      fixture.componentRef.setInput('activeSprints', [sprint, sprint2, { ...sprint, id: 'sp-3', objectiveId: 'obj-2', name: 'Sprint 3' }]);
      fixture.componentRef.setInput('modules', [
        { objectiveId: 'obj-1', title: 'Module One', isOwner: true },
        { objectiveId: 'obj-2', title: 'Module Two', isOwner: false }
      ]);
      fixture.detectChanges();
      return { fixture, createTask, assignTask };
    }

    it('renders a Module dropdown and blocks submit until one is chosen', async () => {
      const { fixture, createTask } = setupWithModules();
      fixture.componentInstance.title.set('New task');

      const moduleSelect = fixture.nativeElement.querySelector('app-select select') as HTMLSelectElement;
      const options = Array.from(moduleSelect.options).map((o) => o.textContent?.trim());
      expect(options).toEqual(['Select a module', 'Module One', 'Module Two']);

      await fixture.componentInstance.submit();

      expect(createTask).not.toHaveBeenCalled();
      expect(fixture.componentInstance.errors()['objectiveId']).toBeTruthy();
    });

    it('narrows Sprint options to the selected module and follows that module\'s ownership for Create vs Request', async () => {
      const { fixture, createTask } = setupWithModules();
      await fixture.whenStable();
      fixture.componentInstance.title.set('New task');
      fixture.componentInstance.selectedObjectiveId.set('obj-1');
      fixture.detectChanges();

      const sprintOptionLabels = fixture.componentInstance.sprintOptions().map((s) => s.name);
      expect(sprintOptionLabels).toEqual(['Sprint 1', 'Sprint 2']);
      expect(fixture.componentInstance.effectiveIsObjectiveOwner()).toBe(true);

      await fixture.componentInstance.submit();

      expect(createTask).toHaveBeenCalledWith('obj-1', expect.objectContaining({ title: 'New task' }));
    });

    it('submits as a creation request (not createTask) when the selected module is not owned', async () => {
      const { fixture, createTask } = setupWithModules();
      await fixture.whenStable();
      const taskApi = TestBed.inject(TaskApiService) as unknown as { createTaskCreationRequest: ReturnType<typeof vi.fn> };
      fixture.componentInstance.title.set('New task');
      fixture.componentInstance.selectedObjectiveId.set('obj-2');

      await fixture.componentInstance.submit();

      expect(createTask).not.toHaveBeenCalled();
      expect(taskApi.createTaskCreationRequest).toHaveBeenCalledWith('obj-2', expect.objectContaining({ title: 'New task' }));
    });
  });
});
