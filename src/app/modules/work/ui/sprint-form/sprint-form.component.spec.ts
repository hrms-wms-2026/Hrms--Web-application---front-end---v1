import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { SprintFormComponent } from './sprint-form.component';
import { SprintListStore } from '../../state/sprint-list.store';
import { TaskApiService } from '../../data-access/task-api.service';
import { Sprint } from '../../models/sprint.model';

describe('SprintFormComponent', () => {
  let fixture: ComponentFixture<SprintFormComponent>;
  let storeStub: any;
  const taskApi = {
    getBySprintId: vi.fn().mockReturnValue(of([{ id: 't1', objectiveId: 'o1', sprintId: 'sp-1' }])),
    getTasks: vi.fn().mockReturnValue(of([]))
  };
  const sprint: Sprint = {
    id: 'sp-1', projectId: 'p-1', name: 'Sprint One', goal: null, startDate: null, endDate: null,
    status: 'draft', completedAt: null, achievedAt: null, canManage: true
  };

  function setup(inputs: Record<string, unknown> = {}): void {
    storeStub = {
      error: signal(null),
      create: vi.fn().mockResolvedValue(true),
      edit: vi.fn().mockResolvedValue(true),
      setTasks: vi.fn().mockResolvedValue(true)
    };
    TestBed.configureTestingModule({
      imports: [SprintFormComponent],
      providers: [
        { provide: SprintListStore, useValue: storeStub },
        { provide: TaskApiService, useValue: taskApi }
      ]
    });
    fixture = TestBed.createComponent(SprintFormComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('projectId', 'p-1');
    fixture.componentRef.setInput('modules', [
      { objectiveId: 'o1', title: 'Design', isEffectiveOwner: true },
      { objectiveId: 'o2', title: 'Build', isEffectiveOwner: false }
    ]);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('create sends name, goal and picked task ids at project level', async () => {
    setup();
    const c = fixture.componentInstance as any;
    c.name.set('Sprint X');
    c.goal.set('Ship it');
    c.selectedTaskIds.set(new Set(['t1', 't2']));
    const created = vi.fn();
    c.created.subscribe(created);

    await c.submit();

    expect(storeStub.create).toHaveBeenCalledWith('p-1', { name: 'Sprint X', goal: 'Ship it', taskIds: ['t1', 't2'] });
    expect(created).toHaveBeenCalled();
  });

  it('only modules the user effectively owns are pickable', () => {
    setup();
    const c = fixture.componentInstance as any;
    expect([...c.allowedObjectiveIds()]).toEqual(['o1']);
  });

  it('requires a name', async () => {
    setup();
    await (fixture.componentInstance as any).submit();

    expect(storeStub.create).not.toHaveBeenCalled();
    expect((fixture.componentInstance as any).nameError()).toContain('required');
  });

  it('edit sends only the add/remove diff', async () => {
    setup({ mode: 'edit', sprint });
    await fixture.whenStable();
    const c = fixture.componentInstance as any;
    expect([...c.selectedTaskIds()]).toEqual(['t1']);

    c.selectedTaskIds.set(new Set(['t9']));
    await c.submit();

    expect(storeStub.edit).toHaveBeenCalled();
    expect(storeStub.setTasks).toHaveBeenCalledWith('sp-1', { addTaskIds: ['t9'], removeTaskIds: ['t1'] }, 'p-1');
  });

  it('edit with unchanged tasks skips setTasks', async () => {
    setup({ mode: 'edit', sprint });
    await fixture.whenStable();

    await (fixture.componentInstance as any).submit();

    expect(storeStub.setTasks).not.toHaveBeenCalled();
  });
});
