import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SprintApiService } from '../../data-access/sprint-api.service';
import { TaskApiService } from '../../data-access/task-api.service';
import { SprintTaskPickerComponent, orderSprintsForTimeline } from './sprint-task-picker.component';

const s = (id: string, startDate: string | null) => ({ id, projectId: 'p1', name: id, goal: null, startDate, endDate: null,
  status: startDate ? 'active' : 'draft', completedAt: null, achievedAt: null, canManage: false } as const);

describe('orderSprintsForTimeline', () => {
  it('orders dated sprints by start date, then dateless drafts in API order', () => {
    const ordered = orderSprintsForTimeline([s('d1', null), s('late', '2026-10-01'), s('d2', null), s('early', '2026-09-01')]);
    expect(ordered.map((x) => x.id)).toEqual(['early', 'late', 'd1', 'd2']);
  });
});

describe('SprintTaskPickerComponent', () => {
  it('ticking a sprint selects its tasks except ones locked by a whole-module tick', async () => {
    TestBed.configureTestingModule({ imports: [SprintTaskPickerComponent], providers: [
      { provide: SprintApiService, useValue: { getByProject: () => of([s('sp1', '2026-09-01')]) } },
      { provide: TaskApiService, useValue: { getBySprintId: () => of([
        { id: 'a', title: 'A', objectiveId: 'o1', sprintId: 'sp1' }, { id: 'b', title: 'B', objectiveId: 'o2', sprintId: 'sp1' }]) } }] });
    const fixture = TestBed.createComponent(SprintTaskPickerComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('lockedObjectiveIds', new Set(['o2']));
    fixture.detectChanges();
    await fixture.whenStable();
    let emitted: Set<string> | undefined;
    fixture.componentInstance.selectedTaskIdsChange.subscribe((v) => (emitted = v));
    await fixture.componentInstance.onSprintToggled('sp1');
    expect([...(emitted ?? [])]).toEqual(['a']);
  });

  it('ticking a not-yet-expanded sprint whose pickable tasks are already selected does not deselect them (Finding 3)', async () => {
    // sp1 is never expanded here, so sprintTasks() has no cached entry at click time and
    // checkState() reads 'unchecked' even though the one pickable task ('a') is already
    // selected. The click should keep it selected rather than reading as a full deselect.
    TestBed.configureTestingModule({ imports: [SprintTaskPickerComponent], providers: [
      { provide: SprintApiService, useValue: { getByProject: () => of([s('sp1', '2026-09-01')]) } },
      { provide: TaskApiService, useValue: { getBySprintId: () => of([
        { id: 'a', title: 'A', objectiveId: 'o1', sprintId: 'sp1' }, { id: 'b', title: 'B', objectiveId: 'o2', sprintId: 'sp1' }]) } }] });
    const fixture = TestBed.createComponent(SprintTaskPickerComponent);
    fixture.componentRef.setInput('projectId', 'p1');
    fixture.componentRef.setInput('lockedObjectiveIds', new Set(['o2']));
    fixture.componentRef.setInput('selectedTaskIds', new Set(['a']));
    fixture.detectChanges();
    await fixture.whenStable();
    let emitted: Set<string> | undefined;
    fixture.componentInstance.selectedTaskIdsChange.subscribe((v) => (emitted = v));
    await fixture.componentInstance.onSprintToggled('sp1');
    expect([...(emitted ?? [])]).toEqual(['a']);
  });
});
