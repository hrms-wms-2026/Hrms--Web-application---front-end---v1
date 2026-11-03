import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import { vi } from 'vitest';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { TaskApiService } from '../../work/data-access/task-api.service';
import { CreateTaskRequestDto } from '../../work/models/dto/task.dto';
import { CreateSlot } from '../ui/planner-create-popover/planner-create-draft';
import { PlannerLayerStore } from './planner-layer.store';
import { WorkItemPlanFlow } from './work-item-plan-flow.service';

describe('WorkItemPlanFlow', () => {
  const slot: CreateSlot = { date: '2026-11-10', startMinutes: 540, endMinutes: 660, startIso: '2026-11-10T09:00:00.000Z', endIso: '2026-11-10T11:00:00.000Z' };
  const dto: CreateTaskRequestDto = { title: 'Fix login bug', categoryId: 'c1', priority: 'medium', estimatedHours: 2, sprintId: null };
  const task = { id: 't1', shortId: 'WEB-7', title: 'Fix login bug' };

  function setup(opts: { create?: unknown; assign?: unknown; blocks?: boolean[] } = {}) {
    const createTask = vi.fn(() => opts.create ?? of(task));
    const assignTask = vi.fn(() => opts.assign ?? of(undefined));
    const outcomes = [...(opts.blocks ?? [true])];
    const error = signal<string | null>(null);
    const createBlock = vi.fn(async () => {
      const ok = outcomes.length > 1 ? outcomes.shift()! : outcomes[0];
      error.set(ok ? null : 'This overlaps another planned block.');
      return ok;
    });
    TestBed.configureTestingModule({
      providers: [
        WorkItemPlanFlow,
        { provide: TaskApiService, useValue: { createTask, assignTask } },
        { provide: PlannerLayerStore, useValue: { createBlock, error } },
        { provide: AuthStore, useValue: { employeeId: () => 'me' } },
      ],
    });
    return { flow: TestBed.inject(WorkItemPlanFlow), createTask, assignTask, createBlock };
  }

  it('201 → assign me → block → done', async () => {
    const { flow, createTask, assignTask, createBlock } = setup();

    await flow.createAndPlan('o1', dto, slot);

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(assignTask).toHaveBeenCalledWith('t1', 'me');
    expect(createBlock).toHaveBeenCalledWith('t1', slot.startIso, slot.endIso);
    expect(flow.state()).toEqual({ kind: 'done', taskId: 't1' });
  });

  it('202 → pending, no assign/block call; dto carried assigneeEmployeeId=me and the slot', async () => {
    const { flow, createTask, assignTask, createBlock } = setup({ create: of({ approvalRequestId: 'r1' }) });

    await flow.createAndPlan('o1', dto, slot);

    expect(createTask).toHaveBeenCalledWith('o1', { ...dto, assigneeEmployeeId: 'me', planStartAt: slot.startIso, planEndAt: slot.endIso });
    expect(assignTask).not.toHaveBeenCalled();
    expect(createBlock).not.toHaveBeenCalled();
    expect(flow.state()).toEqual({ kind: 'pending' });
  });

  it('block refused → notPlanned with the store error; retryPlanning sends only createBlock for the same task, then done', async () => {
    const { flow, createTask, createBlock } = setup({ blocks: [false, true] });

    await flow.createAndPlan('o1', dto, slot);
    expect(flow.state()).toEqual({ kind: 'notPlanned', taskId: 't1', shortId: 'WEB-7', reason: 'This overlaps another planned block.' });

    await flow.retryPlanning();

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createBlock).toHaveBeenCalledTimes(2);
    expect(createBlock).toHaveBeenLastCalledWith('t1', slot.startIso, slot.endIso);
    expect(flow.state()).toEqual({ kind: 'done', taskId: 't1' });
  });

  it('a second createAndPlan while busy sends nothing', async () => {
    const pending = new Subject<unknown>();
    const { flow, createTask } = setup({ create: pending.asObservable() });

    const first = flow.createAndPlan('o1', dto, slot);
    await flow.createAndPlan('o1', dto, slot);
    pending.next(task);
    pending.complete();
    await first;

    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('create fails without a status (network) → unknown, no second create', async () => {
    const { flow, createTask } = setup({ create: throwError(() => new HttpErrorResponse({ status: 0 })) });

    await flow.createAndPlan('o1', dto, slot);

    expect(flow.state()).toEqual({ kind: 'unknown' });
    expect(createTask).toHaveBeenCalledTimes(1);
  });

  it('create refused by the server → error with its message', async () => {
    const { flow } = setup({ create: throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Not enough hours left.' } })) });

    await flow.createAndPlan('o1', dto, slot);

    expect(flow.state().kind).toBe('error');
  });

  it('retryPlanning failing again keeps notPlanned and never calls createTask', async () => {
    const { flow, createTask } = setup({ blocks: [false, false] });

    await flow.createAndPlan('o1', dto, slot);
    await flow.retryPlanning();

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(flow.state().kind).toBe('notPlanned');
  });

  it('assign fails after 201 → notPlanned with the assign error, item kept', async () => {
    const { flow, createBlock } = setup({ assign: throwError(() => new HttpErrorResponse({ status: 403, error: { detail: 'Only this milestone\'s owner can assign tasks.' } })) });

    await flow.createAndPlan('o1', dto, slot);

    expect(createBlock).not.toHaveBeenCalled();
    expect(flow.state()).toMatchObject({ kind: 'notPlanned', taskId: 't1', shortId: 'WEB-7' });
  });

  it('planExisting plans a task created elsewhere (the full form)', async () => {
    const { flow, createTask, createBlock } = setup();

    await flow.planExisting('t9', 'WEB-9', slot);

    expect(createTask).not.toHaveBeenCalled();
    expect(createBlock).toHaveBeenCalledWith('t9', slot.startIso, slot.endIso);
    expect(flow.state()).toEqual({ kind: 'done', taskId: 't9' });
  });
});
