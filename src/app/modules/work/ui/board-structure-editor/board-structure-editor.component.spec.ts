import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { BoardStructureEditorComponent } from './board-structure-editor.component';
import { TaskApiService } from '../../data-access/task-api.service';
import { TaskStatusChangeRequestApiService } from '../../data-access/task-status-change-request-api.service';
import { TaskStatusCategory, TaskStatusColumn } from '../../models/task.model';

describe('BoardStructureEditorComponent', () => {
  const statuses: TaskStatusColumn[] = [
    {
      id: 's4',
      name: 'Done',
      displayOrder: 3,
      requiresApproval: false,
      marksTaskComplete: true,
      visibility: 'private',
      category: 'done',
      color: '#16A34A',
    },
    {
      id: 's1',
      name: 'To Do',
      displayOrder: 0,
      requiresApproval: false,
      marksTaskComplete: false,
      visibility: 'public',
      category: 'not_started',
      color: '#94A3B8',
    },
    {
      id: 's3',
      name: 'Review',
      displayOrder: 2,
      requiresApproval: true,
      approverId: 'approver',
      marksTaskComplete: false,
      visibility: 'private',
      category: 'active',
      color: '#7C3AED',
    },
    {
      id: 's2',
      name: 'In Process',
      displayOrder: 1,
      requiresApproval: false,
      marksTaskComplete: false,
      visibility: 'public',
      category: 'active',
      color: '#2563EB',
    },
  ];
  type Access = { canEditDirectly: boolean; canRequest: boolean };
  const direct: Access = { canEditDirectly: true, canRequest: false };
  function changeRequestApiMock(access: Access) {
    return {
      getForProject: vi.fn().mockReturnValue(of({ ...access, requests: [] })),
      create: vi.fn().mockImplementation((_projectId: string, changes: unknown, note: string | null) =>
        of({ id: 'req-1', status: 'pending', changes, note, canCancel: true, canDecide: false }),
      ),
      cancel: vi.fn().mockReturnValue(of(undefined)),
    };
  }
  function setup(access: Access = direct) {
    const changeRequestApi = changeRequestApiMock(access);
    const api = {
      reorderTaskStatuses: vi.fn().mockReturnValue(of([])),
      editStatus: vi.fn().mockReturnValue(of(undefined)),
      createStatus: vi.fn().mockReturnValue(of({ ...statuses[3], id: 's5', name: 'Blocked' })),
      deleteStatus: vi.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [BoardStructureEditorComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: TaskStatusChangeRequestApiService, useValue: changeRequestApi },
      ],
    });
    const fixture = TestBed.createComponent(BoardStructureEditorComponent);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('statuses', statuses);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, api, changeRequestApi };
  }
  function drop(
    component: BoardStructureEditorComponent,
    source: TaskStatusCategory,
    target: TaskStatusCategory,
    index = 0,
  ) {
    const previousContainer = {
      id: 'board-structure-drop-' + source,
      data: component.rowsFor(source)(),
    };
    const container =
      source === target
        ? previousContainer
        : { id: 'board-structure-drop-' + target, data: component.rowsFor(target)() };
    component.onDrop(
      { previousContainer, container, previousIndex: index, currentIndex: 0 } as Parameters<
        typeof component.onDrop
      >[0],
      target,
    );
  }
  it('renders groups, names, lock toggles and no Done add button', () => {
    const { fixture } = setup();
    expect(fixture.nativeElement.querySelectorAll('.board-structure__group')).toHaveLength(3);
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll(
          '.board-structure__name',
        ) as NodeListOf<HTMLInputElement>,
      ).map((input) => input.value),
    ).toEqual(['To Do', 'In Process', 'Review', 'Done']);
    expect(fixture.nativeElement.querySelector('[aria-label="Add Done status"]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[aria-pressed="true"]')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('input[type="radio"]')).toBeNull();
  });
  it('moves between groups and persists category, color and visibility without a completion flag', async () => {
    const { component, api } = setup();
    drop(component, 'not_started', 'active');
    component.setColor('s1', '#123456');
    component.toggleVisibility('s1');
    await component.save();
    expect(api.reorderTaskStatuses.mock.calls[0][1][0]).toEqual({
      statusId: 's1',
      displayOrder: 0,
      category: 'active',
      color: '#123456',
      visibility: 'private',
    });
  });
  it('guards Done transfers and the last Active row in both drag and delete methods', async () => {
    const { component, api } = setup();
    drop(component, 'active', 'not_started');
    drop(component, 'active', 'not_started');
    drop(component, 'done', 'active');
    drop(component, 'not_started', 'done');
    expect(component.rowsFor('active')()).toHaveLength(1);
    expect(component.rowsFor('done')()).toHaveLength(1);
    await component.deleteRow('s3');
    await component.deleteRow('s4');
    component.startAdd('done');
    await component.confirmAdd();
    expect(api.deleteStatus).not.toHaveBeenCalled();
    expect(api.createStatus).not.toHaveBeenCalled();
  });
  it('persists inline renames while retaining approval settings and excluding server-owned fields', async () => {
    const { component, api, fixture } = setup();
    const input = fixture.nativeElement.querySelectorAll(
      '.board-structure__name',
    )[2] as HTMLInputElement;
    input.value = 'Approval';
    input.dispatchEvent(new Event('input'));
    await component.save();
    expect(api.editStatus).toHaveBeenCalledWith('project-1', 's3', {
      name: 'Approval',
      displayOrder: 2,
      requiresApproval: true,
      approverId: 'approver',
      visibility: 'private',
      category: 'active',
      color: '#7C3AED',
    });
  });
  it('retains unsaved edits after add/delete causes the parent to refresh inputs', async () => {
    const { component, fixture, api } = setup();
    component.rename('s1', 'Ready');
    component.setColor('s1', '#123456');
    component.startAdd('active');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector(
      '[aria-label="New status name"]',
    ) as HTMLInputElement;
    input.value = 'Blocked';
    input.dispatchEvent(new Event('input'));
    await component.confirmAdd();
    fixture.componentRef.setInput('statuses', [
      ...statuses,
      { ...statuses[3], id: 's5', name: 'Blocked' },
    ]);
    fixture.detectChanges();
    await component.deleteRow('s3');
    fixture.componentRef.setInput(
      'statuses',
      statuses.filter((row) => row.id !== 's3'),
    );
    fixture.detectChanges();
    expect(component.rowsFor('not_started')()[0]).toMatchObject({
      name: 'Ready',
      color: '#123456',
    });
    await component.save();
    expect(api.reorderTaskStatuses.mock.calls[0][1]).toHaveLength(4);
  });
  it('reinitializes on reopening and exposes backend errors without closing', async () => {
    const { component, fixture, api } = setup();
    const closed = vi.fn();
    component.closed.subscribe(closed);
    component.rename('s1', 'Draft');
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(component.rowsFor('not_started')()[0].name).toBe('To Do');
    api.reorderTaskStatuses.mockReturnValue(
      throwError(() => ({ error: { detail: 'Changed by another manager.' } })),
    );
    await component.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Changed by another manager.',
    );
    expect(closed).not.toHaveBeenCalled();
  });
  it('opens the shared swatch picker and applies its selection', () => {
    const { fixture, component } = setup();
    (fixture.nativeElement.querySelector('.board-structure__color') as HTMLButtonElement).click();
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        'app-color-swatch-picker [title="Red"]',
      ) as HTMLButtonElement
    ).click();
    expect(component.rowsFor('not_started')()[0].color).toBe('#dc2626');
  });
  it('shows add button on Done and allows adding when Done has 0 rows', async () => {
    const noDoneStatuses = statuses.filter((s) => s.category !== 'done');
    const api = {
      reorderTaskStatuses: vi.fn().mockReturnValue(of([])),
      editStatus: vi.fn().mockReturnValue(of(undefined)),
      createStatus: vi.fn().mockReturnValue(
        of({ ...statuses[0], id: 's5', name: 'Finished', category: 'done' }),
      ),
      deleteStatus: vi.fn().mockReturnValue(of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [BoardStructureEditorComponent],
      providers: [
        { provide: TaskApiService, useValue: api },
        { provide: TaskStatusChangeRequestApiService, useValue: changeRequestApiMock(direct) },
      ],
    });
    const fixture = TestBed.createComponent(BoardStructureEditorComponent);
    fixture.componentRef.setInput('projectId', 'project-1');
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('statuses', noDoneStatuses);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(fixture.nativeElement.querySelector('[aria-label="Add Done status"]')).not.toBeNull();
    component.startAdd('done');
    component['newStatusName'].set('Finished');
    await component.confirmAdd();
    expect(api.createStatus).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({ category: 'done', name: 'Finished' }),
    );
  });
  describe('as a member of a non-top module (request mode)', () => {
    const requester: Access = { canEditDirectly: false, canRequest: true };

    it('holds adds, deletes and edits locally and sends them as one change request', async () => {
      const { component, fixture, api, changeRequestApi } = setup(requester);
      component.rename('s1', 'Backlog');
      component.startAdd('active');
      component['newStatusName'].set('Blocked');
      await component.confirmAdd();
      await component.deleteRow('s3');
      component['requestNote'].set('please');
      await component.save();

      expect(api.createStatus).not.toHaveBeenCalled();
      expect(api.deleteStatus).not.toHaveBeenCalled();
      expect(api.editStatus).not.toHaveBeenCalled();
      expect(api.reorderTaskStatuses).not.toHaveBeenCalled();
      const [projectId, changes, note] = changeRequestApi.create.mock.calls[0];
      expect(projectId).toBe('project-1');
      expect(note).toBe('please');
      expect(changes.adds).toEqual([
        expect.objectContaining({ tempKey: 'new-1', name: 'Blocked', category: 'active' }),
      ]);
      expect(changes.updates).toEqual([
        expect.objectContaining({
          statusId: 's1',
          from: expect.objectContaining({ name: 'To Do' }),
          to: expect.objectContaining({ name: 'Backlog' }),
        }),
      ]);
      expect(changes.deletes).toEqual([{ statusId: 's3', name: 'Review' }]);
      expect(changes.baseOrder).toEqual(['s1', 's2', 's3', 's4']);
      expect(changes.order).toEqual(['s1', 's2', 'new-1', 's4']);

      // The live statuses are shown again until the request is approved.
      fixture.detectChanges();
      expect(component.rowsFor('not_started')()[0].name).toBe('To Do');
      expect(fixture.nativeElement.querySelector('[data-testid="status-request-sent"]')).not.toBeNull();
    });

    it('labels the primary action and refuses to send an empty request', async () => {
      const { component, fixture, changeRequestApi } = setup(requester);
      expect(fixture.nativeElement.textContent).toContain('Send for approval');
      expect(fixture.nativeElement.querySelector('[data-testid="status-request-notice"]')).not.toBeNull();
      await component.save();
      expect(changeRequestApi.create).not.toHaveBeenCalled();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
        'no changes',
      );
    });
  });

  it('is read-only for someone with no module role in the project', async () => {
    const { component, fixture, api, changeRequestApi } = setup({
      canEditDirectly: false,
      canRequest: false,
    });
    component.rename('s1', 'Nope');
    await component.save();
    fixture.detectChanges();
    expect(component.rowsFor('not_started')()[0].name).toBe('To Do');
    expect(api.reorderTaskStatuses).not.toHaveBeenCalled();
    expect(changeRequestApi.create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[data-testid="status-readonly-notice"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Update');
  });
});
