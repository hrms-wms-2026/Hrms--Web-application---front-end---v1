import { PlannerApiService } from '../../../work/planner/data-access/planner-api.service';
import { PlannerRangeDay } from '../../../work/planner/models/planner.models';
import { By } from '@angular/platform-browser';
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

  const workDay = (date: string, over: Partial<PlannerRangeDay> = {}) => ({
    date, editable: true, blocks: [], blockMinutes: 0, workingMinutes: 480,
    workWindow: { workStart: '09:00:00', workEnd: '18:00:00', breakMinutes: 0, breakStart: null, isWorkingDay: true, workingMinutes: 480 },
    ...over,
  }) as PlannerRangeDay;

  async function setup(opts: { allDay?: boolean; blocks?: readonly { startAt: string; endAt: string }[]; days?: readonly PlannerRangeDay[]; slot?: CreateSlot } = {}) {
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
        { provide: PlannerApiService, useValue: { getRange: () => of({ days: opts.days ?? [] }) } },
      ],
    });
    const fixture = TestBed.createComponent(WorkItemTabComponent);
    const shared: SharedCreateDraft = { title: signal('Fix login bug'), isAllDay: signal(!!opts.allDay) };
    fixture.componentRef.setInput('slot', opts.slot ?? slot);
    fixture.componentRef.setInput('timezone', 'UTC');
    fixture.componentRef.setInput('shared', shared);
    fixture.componentRef.setInput('myBlocks', opts.blocks ?? []);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const q = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
    const choose = async (id: string, value: string) => {
      fixture.debugElement.query(By.css(`[data-testid="${id}"]`)).triggerEventHandler('valueChange', value);
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

  it('a new estimate moves the End, from the Start', async () => {
    const { fixture, q } = await setup();
    const estimate = q('work-item-estimate') as HTMLInputElement;
    estimate.value = '8';
    estimate.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(q('work-item-plan')!.textContent!.trim()).toBe('8h');
    expect(fixture.componentInstance.plan()!.endMinutes).toBe(1020);
  });

  it('lists projects without the Office project', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance.projectOptions().map((o) => o.value)).toEqual(['p1']);
  });

  it('Type lists the project\'s categories except systemKey meeting, with kind icons', async () => {
    const { fixture, q, choose } = await setup();
    await choose('work-item-project', 'p1');
    expect(fixture.componentInstance.categoryOptions().map((o) => o.value)).toEqual(['c-task', 'c-bug']);
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
    }, slot, []);
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
    expect(more).toHaveBeenCalledWith({ title: 'Fix login bug', description: null, projectId: 'p1', objectiveId: 'o1', categoryId: 'c-bug',
      priority: 'medium', estimatedHours: 2, dueDate: null, slot: expect.objectContaining({ startIso: slot.startIso }), continuation: [] });
  });

  it('a changed End plans the new time and shows the new length', async () => {
    const { fixture, q, choose, flow } = await setup();
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');

    fixture.componentInstance.setEnd('12:30');
    fixture.detectChanges();
    expect(q('work-item-plan')!.textContent!.trim()).toBe('3h 30m');

    (q('work-item-create') as HTMLButtonElement).click();
    expect(flow.createAndPlan).toHaveBeenCalledWith('o1', expect.anything(), expect.objectContaining({
      startIso: slot.startIso, endIso: '2026-11-10T12:30:00.000Z', startMinutes: 540, endMinutes: 750 }), []);
  });

  it('moving the Start keeps the length', async () => {
    const { fixture } = await setup();

    fixture.componentInstance.setStart('13:00');

    expect(fixture.componentInstance.plan()).toMatchObject({ startMinutes: 780, endMinutes: 900,
      startIso: '2026-11-10T13:00:00.000Z', endIso: '2026-11-10T15:00:00.000Z' });
  });

  it('moving off a planned block clears the overlap warning', async () => {
    const { fixture, q } = await setup({ blocks: [{ startAt: '2026-11-10T10:00:00.000Z', endAt: '2026-11-10T12:00:00.000Z' }] });
    expect(q('work-item-overlap')).not.toBeNull();

    fixture.componentInstance.setStart('13:00');
    fixture.detectChanges();

    expect(q('work-item-overlap')).toBeNull();
  });

  it('an End before the Start says so and blocks Create & plan', async () => {
    const { fixture, q, choose } = await setup();
    await choose('work-item-project', 'p1');
    await choose('work-item-module', 'o1');

    fixture.componentInstance.setEnd('08:00');
    fixture.detectChanges();

    expect(q('work-item-time-invalid')).not.toBeNull();
    expect((q('work-item-create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('More options carries the changed time', async () => {
    const { fixture } = await setup();

    fixture.componentInstance.setEnd('12:00');

    expect(fixture.componentInstance.draft().slot!.endIso).toBe('2026-11-10T12:00:00.000Z');
  });

  it('a new End leaves the estimate alone', async () => {
    const { fixture } = await setup();

    fixture.componentInstance.setEnd('10:00');

    expect(fixture.componentInstance.estimate()).toBe(2);
  });

  describe('past working time', () => {
    const days = [workDay('2026-11-10'), workDay('2026-11-11')];

    it('says nothing inside working time', async () => {
      const { q } = await setup({ days });

      expect(q('work-item-overtime')).toBeNull();
    });

    it('5h from 16:30 ends at 21:30 and says how far past working time it runs', async () => {
      const { fixture, q } = await setup({ days });
      const tab = fixture.componentInstance;

      tab.setStart('16:30');
      tab.setEstimate('5');
      fixture.detectChanges();

      expect(tab.plan()!.endMinutes).toBe(1290);
      expect(q('work-item-overtime')!.textContent).toContain('3h 30m past your working time, which ends at 6:00 PM');
    });

    it('keeps working by default: one block, to the End', async () => {
      const { fixture } = await setup({ days });
      const tab = fixture.componentInstance;
      tab.setStart('16:30');
      tab.setEstimate('5');

      expect(tab.slots()).toHaveLength(1);
      expect(tab.slots()[0].endMinutes).toBe(1290);
    });

    it('continuing stops at the end of working time and starts the rest the next working morning', async () => {
      const { fixture, q } = await setup({ days });
      const tab = fixture.componentInstance;
      tab.setStart('16:30');
      tab.setEstimate('5');

      tab.overtimeChoice.set('continue');
      fixture.detectChanges();

      expect(tab.slots().map((s) => [s.date, s.startMinutes, s.endMinutes])).toEqual([['2026-11-10', 990, 1080], ['2026-11-11', 540, 750]]);
      expect(tab.slots()[1].startIso).toBe('2026-11-11T09:00:00.000Z');
      expect(q('work-item-continue-preview')!.textContent).toContain('Tue 10 Nov 4:30 PM–6:00 PM, Wed 11 Nov 9:00 AM–12:30 PM');
    });

    it('skips non-working days and works around blocks already planned', async () => {
      const off = workDay('2026-11-11', { workWindow: { ...days[0].workWindow!, isWorkingDay: false } });
      const busy = workDay('2026-11-12', { blocks: [{ startAt: '2026-11-12T09:00:00.000Z', endAt: '2026-11-12T10:00:00.000Z' }] as PlannerRangeDay['blocks'] });
      const { fixture } = await setup({ days: [days[0], off, busy] });
      const tab = fixture.componentInstance;
      tab.setStart('17:00');
      tab.setEstimate('2');

      tab.overtimeChoice.set('continue');

      expect(tab.slots()[1]).toMatchObject({ date: '2026-11-12', startMinutes: 600, endMinutes: 660 });
    });

    it('an estimate too long for the day carries what is past midnight too', async () => {
      const { fixture } = await setup({ days });
      const tab = fixture.componentInstance;
      tab.setStart('16:00');
      tab.setEstimate('10');

      tab.overtimeChoice.set('continue');

      expect(tab.slots()[0].endMinutes).toBe(1080);
      expect(tab.slots()[1].endMinutes - tab.slots()[1].startMinutes).toBe(480);
    });

    it('starting after working time informs, with nothing of today to stop at', async () => {
      const { fixture, q } = await setup({ days });
      fixture.componentInstance.setStart('19:00');
      fixture.detectChanges();

      expect(q('work-item-overtime')).not.toBeNull();
      expect(q('work-item-continue')).toBeNull();
    });

    it('says so on a non-working day', async () => {
      const { q, fixture } = await setup({ days: [workDay('2026-11-10', { workWindow: { ...days[0].workWindow!, isWorkingDay: false } })] });
      fixture.detectChanges();

      expect(q('work-item-overtime')!.textContent).toContain('not a working day');
    });

    it('Create & plan sends both parts', async () => {
      const { fixture, q, choose, flow } = await setup({ days });
      await choose('work-item-project', 'p1');
      await choose('work-item-module', 'o1');
      const tab = fixture.componentInstance;
      tab.setStart('16:30');
      tab.setEstimate('5');
      tab.overtimeChoice.set('continue');
      fixture.detectChanges();

      (q('work-item-create') as HTMLButtonElement).click();

      expect(flow.createAndPlan).toHaveBeenCalledWith('o1', expect.anything(), expect.objectContaining({ endMinutes: 1080 }),
        [expect.objectContaining({ date: '2026-11-11', startMinutes: 540 })]);
    });

    it('a failed read of working time leaves the plan unchecked, not blocked', async () => {
      const { q } = await setup({ days: [] });

      expect(q('work-item-overtime')).toBeNull();
    });
  });

  describe('from New event, with no time picked', () => {
    const noTime: CreateSlot = { ...slot, isDefault: true };

    it('fills in no date or time, and asks for them', async () => {
      const { fixture, q, choose } = await setup({ slot: noTime });
      await choose('work-item-project', 'p1');
      await choose('work-item-module', 'o1');
      const tab = fixture.componentInstance;

      expect([tab.planDate(), tab.startClock(), tab.endClock(), tab.estimate()]).toEqual([null, '', '', null]);
      expect(q('work-item-pick-time-hint')).not.toBeNull();
      expect((q('work-item-create') as HTMLButtonElement).disabled).toBe(true);
    });

    it('a date, a start and an estimate make the plan', async () => {
      const { fixture, q } = await setup({ slot: noTime });
      const tab = fixture.componentInstance;

      tab.setPlanDate('2026-11-14');
      tab.setStart('10:00');
      tab.setEstimate('2');
      fixture.detectChanges();

      expect(tab.plan()).toMatchObject({ date: '2026-11-14', startIso: '2026-11-14T10:00:00.000Z', endIso: '2026-11-14T12:00:00.000Z' });
      expect(q('work-item-pick-time-hint')).toBeNull();
    });

    it('the estimate set first gives the End when the Start is picked', async () => {
      const { fixture } = await setup({ slot: noTime });
      const tab = fixture.componentInstance;

      tab.setEstimate('3');
      tab.setStart('09:00');

      expect(tab.endClock()).toBe('12:00');
    });

    it('a due date fills the empty plan date', async () => {
      const { fixture } = await setup({ slot: noTime });

      fixture.componentInstance.setDue('2026-11-14');

      expect(fixture.componentInstance.planDate()).toBe('2026-11-14');
    });

    it('More options with no time sends no slot', async () => {
      const { fixture } = await setup({ slot: noTime });

      expect(fixture.componentInstance.draft().slot).toBeNull();
    });
  });

  it('a due date leaves a picked plan date alone, and warns when the plan is later', async () => {
    const { fixture, q } = await setup();
    const tab = fixture.componentInstance;

    tab.setDue('2026-11-09');
    fixture.detectChanges();

    expect(tab.planDate()).toBe('2026-11-10');
    expect(q('work-item-after-due')).not.toBeNull();
  });

  it('a new plan date moves the plan and checks that day', async () => {
    const { fixture, q } = await setup({ days: [workDay('2026-11-12', { blocks: [{ startAt: '2026-11-12T09:30:00.000Z', endAt: '2026-11-12T10:00:00.000Z' }] as PlannerRangeDay['blocks'] })] });
    const tab = fixture.componentInstance;

    tab.setPlanDate('2026-11-12');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tab.plan()).toMatchObject({ date: '2026-11-12', startIso: '2026-11-12T09:00:00.000Z', endIso: '2026-11-12T11:00:00.000Z' });
    expect(q('work-item-overlap')).not.toBeNull();
  });

  it('Cancel closes the popover', async () => {
    const { fixture, q } = await setup();
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);

    q('work-item-cancel')!.click();

    expect(closed).toHaveBeenCalled();
  });

  it('sends the description, and leaves it out when it is empty', async () => {
    const { fixture } = await setup();
    const tab = fixture.componentInstance;

    tab.onDescription('<p>  </p>');
    expect(tab.description()).toBeNull();

    tab.onDescription('<p>Steps to reproduce</p>');
    expect(tab.draft().description).toBe('<p>Steps to reproduce</p>');
  });
});
