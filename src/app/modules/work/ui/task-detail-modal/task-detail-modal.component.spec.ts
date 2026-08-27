import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TaskDetailModalComponent } from './task-detail-modal.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskStatusColumn, WorkTask } from '../../models/task.model';
import { WorkTaskDto } from '../../models/dto/task.dto';

describe('TaskDetailModalComponent', () => {
  const task: WorkTask = {
    id: 't1', objectiveId: 'o1', shortId: 'EPOS-1', title: 'Do the thing', description: 'Details here',
    categoryId: 'task', statusId: 's1', priority: 'high', storyPoints: 3, dueDate: new Date('2026-09-20'),
    estimatedHours: 8, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: []
  };
  const updatedDto: WorkTaskDto = {
    id: 't1', objectiveId: 'o1', shortId: 'EPOS-1', title: 'Updated title', description: 'Details here',
    categoryId: 'task', statusId: 's1', priority: 'high', storyPoints: 3, dueDate: '2026-09-20',
    estimatedHours: 8, completedHours: 0, progressPercent: 0, sprintId: null, assigneeEmployeeIds: []
  };
  const statuses: TaskStatusColumn[] = [
    { id: 's1', name: 'To Do', displayOrder: 0, requiresApproval: false, marksTaskComplete: false, visibility: 'public' },
    { id: 's2', name: 'In Progress', displayOrder: 1, requiresApproval: false, marksTaskComplete: false, visibility: 'public' },
    { id: 's3', name: 'Internal Review', displayOrder: 2, requiresApproval: false, marksTaskComplete: false, visibility: 'private' }
  ];

  function setup(isObjectiveOwner: boolean, statusList: TaskStatusColumn[] = statuses) {
    const editTask = vi.fn().mockReturnValue(of(updatedDto));
    const createTaskEditRequest = vi.fn().mockReturnValue(of({}));
    const getCategories = vi.fn().mockReturnValue(of([{ id: 'task', name: 'Task', displayOrder: 0 }]));
    TestBed.configureTestingModule({
      imports: [TaskDetailModalComponent],
      providers: [
        { provide: TaskApiService, useValue: { editTask, createTaskEditRequest, getCategories } }
      ]
    });
    const fixture = TestBed.createComponent(TaskDetailModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('task', task);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('isObjectiveOwner', isObjectiveOwner);
    fixture.componentRef.setInput('statuses', statusList);
    return { fixture, editTask, createTaskEditRequest };
  }

  it('shows the task shortId in the modal title and populates the form fields from the bound task', () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('EPOS-1');

    const instance = fixture.componentInstance;
    expect(instance.title()).toBe('Do the thing');
    expect(instance.description()).toBe('Details here');
    expect(instance.priority()).toBe('high');
    expect(instance.dueDate()).toBe('2026-09-20');
    expect(instance.estimatedHours()).toBe(8);
    expect(instance.storyPoints()).toBe(3);
  });

  it('re-seeds the form from the real task values when reopened, discarding an abandoned edit (reopen with same task object)', () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    const instance = fixture.componentInstance;
    expect(instance.title()).toBe('Do the thing');

    // User edits the title but never saves.
    instance.title.set('An abandoned edit');
    expect(instance.title()).toBe('An abandoned edit');

    // User closes the modal without saving.
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();

    // User reopens the SAME task (same object reference, as the store would provide).
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('task', task);
    fixture.detectChanges();

    expect(instance.title()).toBe('Do the thing');
    expect(instance.description()).toBe('Details here');
    expect(instance.priority()).toBe('high');
    expect(instance.dueDate()).toBe('2026-09-20');
    expect(instance.estimatedHours()).toBe(8);
    expect(instance.storyPoints()).toBe(3);
  });

  it('resets the form when the task input is cleared', () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    fixture.componentRef.setInput('task', null);
    fixture.detectChanges();

    const instance = fixture.componentInstance;
    expect(instance.title()).toBe('');
    expect(instance.description()).toBe('');
    expect(instance.dueDate()).toBe('');
    expect(instance.estimatedHours()).toBeNull();
    expect(instance.storyPoints()).toBeNull();
  });

  it('emits closed when the modal closes', () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    fixture.componentInstance.onClose();
    expect(spy).toHaveBeenCalled();
  });

  it('owner sees a "Save changes" button that calls editTask directly', async () => {
    const { fixture, editTask, createTaskEditRequest } = setup(true);
    fixture.detectChanges();

    const buttonText = (fixture.nativeElement.textContent as string);
    expect(buttonText).toContain('Save changes');
    expect(buttonText).not.toContain('Request');

    fixture.componentInstance.title.set('Updated title');
    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);

    await fixture.componentInstance.submit('t1');

    expect(editTask).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Updated title', priority: 'high' }));
    expect(createTaskEditRequest).not.toHaveBeenCalled();
    expect(savedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', title: 'Updated title' }));
  });

  it('non-owner member sees a "Request" button that calls createTaskEditRequest instead', async () => {
    const { fixture, editTask, createTaskEditRequest } = setup(false);
    fixture.detectChanges();

    const buttonText = (fixture.nativeElement.textContent as string);
    expect(buttonText).toContain('Request');
    expect(buttonText).not.toContain('Save changes');

    fixture.componentInstance.title.set('Updated title');
    const requestedSpy = vi.fn();
    fixture.componentInstance.requested.subscribe(requestedSpy);

    await fixture.componentInstance.submit('t1');

    expect(createTaskEditRequest).toHaveBeenCalledWith('t1', expect.objectContaining({ title: 'Updated title', priority: 'high' }));
    expect(editTask).not.toHaveBeenCalled();
    expect(requestedSpy).toHaveBeenCalled();
  });

  it('builds the submit payload matching EditTaskRequestDto shape', async () => {
    const { fixture, editTask } = setup(true);
    fixture.detectChanges();
    fixture.componentInstance.description.set('');
    fixture.componentInstance.estimatedHours.set(null);
    fixture.componentInstance.storyPoints.set(null);
    fixture.componentInstance.dueDate.set('');

    await fixture.componentInstance.submit('t1');

    expect(editTask).toHaveBeenCalledWith('t1', {
      title: 'Do the thing',
      description: undefined,
      priority: 'high',
      dueDate: undefined,
      estimatedHours: undefined,
      storyPoints: undefined
    });
  });

  it('blocks submit with an empty title, surfaces a field error, and calls neither editTask nor createTaskEditRequest', async () => {
    const { fixture, editTask, createTaskEditRequest } = setup(true);
    fixture.detectChanges();

    fixture.componentInstance.title.set('');
    await fixture.componentInstance.submit('t1');
    fixture.detectChanges();

    expect(fixture.componentInstance.errors()['title']).toBe('Title is required.');
    expect(editTask).not.toHaveBeenCalled();
    expect(createTaskEditRequest).not.toHaveBeenCalled();

    const titleInput = fixture.nativeElement.querySelector('app-input input') as HTMLInputElement;
    expect(titleInput.getAttribute('aria-invalid')).toBe('true');
    expect((fixture.nativeElement.textContent as string)).toContain('Title is required.');
  });

  it('blocks submit with a whitespace-only title', async () => {
    const { fixture, editTask, createTaskEditRequest } = setup(true);
    fixture.detectChanges();

    fixture.componentInstance.title.set('   ');
    await fixture.componentInstance.submit('t1');

    expect(fixture.componentInstance.errors()['title']).toBe('Title is required.');
    expect(editTask).not.toHaveBeenCalled();
    expect(createTaskEditRequest).not.toHaveBeenCalled();
  });

  it('status dropdown excludes private statuses for a non-owner member', () => {
    const { fixture } = setup(false);
    fixture.detectChanges();

    expect(fixture.componentInstance.availableStatuses().map((s) => s.id)).toEqual(['s1', 's2']);

    const select = fixture.nativeElement.querySelector('.task-detail__select') as HTMLSelectElement;
    const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(optionTexts).toEqual(['To Do', 'In Progress']);
  });

  it('status dropdown includes both public and private statuses for the objective owner', () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    expect(fixture.componentInstance.availableStatuses().map((s) => s.id)).toEqual(['s1', 's2', 's3']);

    const select = fixture.nativeElement.querySelector('.task-detail__select') as HTMLSelectElement;
    const optionTexts = Array.from(select.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(optionTexts).toEqual(['To Do', 'In Progress', 'Internal Review']);
  });

  it('emits statusChangeRequested with the new status id when submitting with a changed status', async () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.statusChangeRequested.subscribe(spy);
    fixture.componentInstance.statusId.set('s2');

    await fixture.componentInstance.submit('t1');

    expect(spy).toHaveBeenCalledWith('s2');
  });

  it('does not emit statusChangeRequested when submitting with the status unchanged', async () => {
    const { fixture } = setup(true);
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.statusChangeRequested.subscribe(spy);
    // statusId is seeded to the task's own statusId ('s1') by the constructor effect; leave it as-is.

    await fixture.componentInstance.submit('t1');

    expect(spy).not.toHaveBeenCalled();
  });
});
