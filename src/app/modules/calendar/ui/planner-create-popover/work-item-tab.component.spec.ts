import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ProjectApiService } from '../../../work/data-access/project-api.service';
import { TaskApiService } from '../../../work/data-access/task-api.service';
import { PlanFlowState, WorkItemPlanFlow } from '../../state/work-item-plan-flow.service';
import { CreateSlot, SharedCreateDraft } from './planner-create-draft';
import { WorkItemTabComponent } from './work-item-tab.component';

describe('WorkItemTabComponent', () => {
  // 2026-11-10 is a Tuesday.
  const slot: CreateSlot = { date: '2026-11-10', startMinutes: 540, endMinutes: 660, startIso: '2026-11-10T09:00:00.000Z', endIso: '2026-11-10T11:00:00.000Z' };
  const categories = [
    { id: 'c-task', name: 'task', displayOrder: 0, kind: 'task' },
    { id: 'c-bug', name: 'bug', displayOrder: 1, kind: 'bug' },
    { id: 'c-meet', name: 'meeting', displayOrder: 2, systemKey: 'meeting', isSystem: true, kind: 'meeting' },
  ];

  async function setup(opts: { allDay?: boolean; blocks?: readonly { startAt: string; endAt: string }[] } = {}) {
    const state = signal<PlanFlowState>({ kind: 'idle' });
    const flow = {
      state, createAndPlan: vi.fn(async () => undefined), retryPlanning: vi.fn(async () => undefined), reset: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [WorkItemTabComponent],
      providers: [
        { provide: WorkItemPlanFlow, useValue: flow },
        { provide: ProjectApiService, useValue: {
          listMine: () => of({ items: [{ id: 'off', name: 'Office', systemPurpose: 'office' }, { id: 'p1', name: 'Acme' }], totalCount: 2 }),
          getProjectTree: () => of([{ id: 'o1', title: 'Delivery' }]),
        } },
        { provide: TaskApiService, useValue: { getCategories: () => of(categories) } },
      ],
    });
    const fixture = TestBed.createComponent(WorkItemTabComponent);
    const shared: SharedCreateDraft = { title: signal('Fix login bug'), isAllDay: signal(!!opts.allDay) };
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('shared', shared);
    fixture.componentRef.setInput('myBlocks', opts.blocks ?? []);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const choose = async (id: string, value: string) => {
      const el = q(id) as HTMLSelectElement;
      el.value = value;
      el.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    return { fixture, q, choose, flow, state, shared };
  }

  it('Estimate starts at the slot length and can be changed', async () => {
    const { fixture, q } = await setup();
    const estimate = q('work-item-estimate') as HTMLInputElement;
    expect(estimate.value).toBe('2');
    estimate.value = '8';
    estimate.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.estimate()).toBe(8);
  });

  it('editing the estimate does not change the plan, and the plan label shows "Plan 9:00–11:00 · 2h"', async () => {
    const { fixture, q } = await setup();
    const estimate = q('work-item-estimate') as HTMLInputElement;
    estimate.value = '8';
    estimate.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('work-item-plan')!.textContent!.trim()).toBe('Plan 9:00–11:00 · 2h');
  });

  it('lists projects without the Office project', async () => {
    const { q } = await setup();
    const options = Array.from((q('work-item-project') as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(['', 'p1']);
  });

  it('Type lists the project\'s categories except systemKey meeting, with kind icons', async () => {
    const { q, choose } = await setup();
    await choose('work-item-project', 'p1');
    const options = Array.from((q('work-item-type') as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(['c-task', 'c-bug']);
    await choose('work-item-type', 'c-bug');
    expect(q('work-item-type-icon')).not.toBeNull();
  });

  it('Create & plan sends the item to the flow with the slot', async () => {
    const { q, choose, flow } = await setup();
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');
    await choose('work-item-type', 'c-bug');

    q('work-item-create')!.click();

    expect(flow.createAndPlan).toHaveBeenCalledWith('o1', {
      title: 'Fix login bug', categoryId: 'c-bug', priority: 'medium', estimatedHours: 2, sprintId: null,
    }, slot);
  });

  it('Create & plan is disabled with "Turn off All day to plan a work item." when all-day', async () => {
    const { q, choose } = await setup({ allDay: true });
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');
    expect((q('work-item-create') as HTMLButtonElement).disabled).toBe(true);
    expect(q('work-item-all-day-note')!.textContent!.trim()).toBe('Turn off All day to plan a work item.');
  });

  it('warns (not blocks) when the slot overlaps one of my blocks', async () => {
    const { q, choose } = await setup({ blocks: [{ startAt: '2026-11-10T10:00:00.000Z', endAt: '2026-11-10T12:00:00.000Z' }] });
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');
    expect(q('work-item-overlap')).not.toBeNull();
    expect((q('work-item-create') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows Retry planning and Pick another time when notPlanned', async () => {
    const { fixture, q, state, flow } = await setup();
    const pick = vi.fn();
    fixture.componentInstance.pickAnotherTime.subscribe(pick);
    state.set({ kind: 'notPlanned', taskId: 't1', shortId: 'WEB-7', reason: 'This overlaps another planned block.' });
    fixture.detectChanges();

    expect(q('work-item-not-planned')!.textContent).toContain('Created WEB-7, not planned: This overlaps another planned block.');
    q('work-item-retry')!.click();
    expect(flow.retryPlanning).toHaveBeenCalledTimes(1);
    q('work-item-pick-time')!.click();
    expect(pick).toHaveBeenCalledWith(expect.objectContaining({ taskId: 't1', title: 'Fix login bug' }));
  });

  it('pending shows when it will be planned', async () => {
    const { fixture, q, state } = await setup();
    state.set({ kind: 'pending' });
    fixture.detectChanges();
    expect(q('work-item-pending')!.textContent!.trim())
      .toBe('Sent for approval. Once approved it\'s yours and planned for Tue 09:00–11:00.');
  });

  it('a lost create response says to check the Task list', async () => {
    const { fixture, q, state } = await setup();
    state.set({ kind: 'unknown' });
    fixture.detectChanges();
    expect(q('work-item-unknown')!.textContent!.trim())
      .toBe('We couldn\'t confirm the work item was created. Check your Task list before trying again.');
  });

  // Review finding 2: the item exists (or may) in these states, so Create & plan must not send it again.
  it('Create & plan is disabled when notPlanned, pending or unknown', async () => {
    const { fixture, q, choose, state } = await setup();
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');
    for (const s of [{ kind: 'notPlanned', taskId: 't1', shortId: 'WEB-7', reason: 'x' }, { kind: 'pending' }, { kind: 'unknown' }] as PlanFlowState[]) {
      state.set(s);
      fixture.detectChanges();
      expect((q('work-item-create') as HTMLButtonElement).disabled).toBe(true);
    }
    state.set({ kind: 'error', message: 'Not enough hours left.' });
    fixture.detectChanges();
    expect((q('work-item-create') as HTMLButtonElement).disabled).toBe(false);
  });

  it('does not reset the flow when the tab is created (the page resets it when the popover opens)', async () => {
    const { flow } = await setup();
    expect(flow.reset).not.toHaveBeenCalled();
  });

  it('emits done when the flow is done', async () => {
    const { fixture, state } = await setup();
    const done = vi.fn();
    fixture.componentInstance.done.subscribe(done);
    state.set({ kind: 'done', taskId: 't1' });
    fixture.detectChanges();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('More options emits the WorkItemDraft', async () => {
    const { fixture, q, choose } = await setup();
    const more = vi.fn();
    fixture.componentInstance.moreOptions.subscribe(more);
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');
    await choose('work-item-type', 'c-bug');
    q('work-item-more')!.click();
    expect(more).toHaveBeenCalledWith({ title: 'Fix login bug', projectId: 'p1', objectiveId: 'o1', categoryId: 'c-bug',
      priority: 'medium', estimatedHours: 2, dueDate: null, slot });
  });
});
