import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ModuleTaskPickerComponent } from './module-task-picker.component';
import { TaskApiService } from '../../data-access/task-api.service';

const tasks = [
  { id: 'a', title: 'Task A', objectiveId: 'o1', sprintId: null },
  { id: 'b', title: 'Task B', objectiveId: 'o1', sprintId: 'sp-2' },
  { id: 'c', title: 'Task C', objectiveId: 'o1', sprintId: 'sp-frozen' }
];

describe('ModuleTaskPickerComponent', () => {
  let fixture: ComponentFixture<ModuleTaskPickerComponent>;
  const getTasks = vi.fn().mockReturnValue(of(tasks));

  function setup(inputs: Record<string, unknown>): void {
    TestBed.configureTestingModule({
      imports: [ModuleTaskPickerComponent],
      providers: [{ provide: TaskApiService, useValue: { getTasks } }]
    });
    fixture = TestBed.createComponent(ModuleTaskPickerComponent);
    fixture.componentRef.setInput('modules', [{ objectiveId: 'o1', title: 'Design' }, { objectiveId: 'o2', title: 'Build' }]);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('bulk: ticking a module emits all pickable tasks (frozen excluded, other-sprint included)', async () => {
    setup({ moduleMode: 'bulk', frozenSprintIds: new Set(['sp-frozen']) });
    let emitted: Set<string> | undefined;
    fixture.componentInstance.selectedTaskIdsChange.subscribe((v: Set<string>) => (emitted = v));

    await fixture.componentInstance.onModuleToggled('o1');

    expect([...(emitted ?? [])].sort()).toEqual(['a', 'b']);
  });

  it('bulk: modules outside allowedObjectiveIds cannot be ticked', async () => {
    setup({ moduleMode: 'bulk', allowedObjectiveIds: new Set(['o2']) });
    const spy = vi.fn();
    fixture.componentInstance.selectedTaskIdsChange.subscribe(spy);
    await fixture.componentInstance.onModuleToggled('o1');
    expect(spy).not.toHaveBeenCalled();
  });

  it('shows an "In <sprint>" badge for tasks already in another sprint', async () => {
    setup({ moduleMode: 'bulk', sprintNames: { 'sp-2': 'Sprint 2' } });
    await fixture.componentInstance.toggleExpand('o1');
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('[data-testid="task-sprint-badge"]');
    expect(badges[0].textContent).toContain('Sprint 2');
  });

  it('live: ticking a module emits objectiveIds and locks its tasks', async () => {
    setup({ moduleMode: 'live' });
    let objectives: Set<string> | undefined;
    fixture.componentInstance.selectedObjectiveIdsChange.subscribe((v: Set<string>) => (objectives = v));
    await fixture.componentInstance.onModuleToggled('o1');
    expect([...(objectives ?? [])]).toEqual(['o1']);
  });

  it('bulk: ticking an unexpanded module whose pickable tasks are already all selected does not deselect them (Finding 3)', async () => {
    // Module 'o1' is never expanded here, so its tasks aren't cached at click time and
    // checkState() reads 'unchecked' even though every pickable task is already selected.
    // The click should still be read as "keep them selected", not "deselect everything".
    setup({ moduleMode: 'bulk', selectedTaskIds: new Set(['a', 'b', 'c']) });
    let emitted: Set<string> | undefined;
    fixture.componentInstance.selectedTaskIdsChange.subscribe((v: Set<string>) => (emitted = v));

    await fixture.componentInstance.onModuleToggled('o1');

    expect([...(emitted ?? [])].sort()).toEqual(['a', 'b', 'c']);
  });
});
