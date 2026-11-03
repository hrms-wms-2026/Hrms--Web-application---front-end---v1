import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';
import { TaskApiService } from '../../work/data-access/task-api.service';
import { CreateTaskRequestDto } from '../../work/models/dto/task.dto';
import { isPendingApproval } from '../../work/models/dto/work-approval.dto';
import { CreateSlot } from '../ui/planner-create-popover/planner-create-draft';
import { PlannerLayerStore } from './planner-layer.store';

export type PlanFlowState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; taskId: string }
  | { kind: 'pending' }
  | { kind: 'notPlanned'; taskId: string; shortId: string; reason: string }
  | { kind: 'unknown' }
  | { kind: 'error'; message: string };

/**
 * "Create & plan" for the Planner create popover (2026-11-03 design): create the work item, assign the caller, plan
 * it at the picked slot. It is several calls, so: one run at a time; the item is created at most once (once its id is
 * known nothing re-sends the create); a refused block keeps the item and offers Retry planning; a lost create response
 * is never retried on its own, because the item may already exist.
 */
@Injectable()
export class WorkItemPlanFlow {
  private readonly tasks = inject(TaskApiService);
  private readonly planner = inject(PlannerLayerStore);
  private readonly auth = inject(AuthStore);

  private readonly current = signal<PlanFlowState>({ kind: 'idle' });
  readonly state = this.current.asReadonly();
  private planned: { taskId: string; shortId: string; slot: CreateSlot } | null = null;

  async createAndPlan(objectiveId: string, dto: CreateTaskRequestDto, slot: CreateSlot): Promise<void> {
    if (this.current().kind === 'busy') return;
    const me = this.auth.employeeId();
    this.current.set({ kind: 'busy' });
    let created;
    try {
      created = await firstValueFrom(this.tasks.createTask(objectiveId, {
        ...dto, ...(me ? { assigneeEmployeeId: me } : {}), planStartAt: slot.startIso, planEndAt: slot.endIso,
      }));
    } catch (err) {
      this.current.set(err instanceof HttpErrorResponse && err.status === 0
        ? { kind: 'unknown' }
        : { kind: 'error', message: toSafeErrorMessage(err, 'The work item could not be created.') });
      return;
    }
    if (isPendingApproval(created)) {
      this.current.set({ kind: 'pending' });
      return;
    }
    this.planned = { taskId: created.id, shortId: created.shortId, slot };
    try {
      if (me) await firstValueFrom(this.tasks.assignTask(created.id, me));
    } catch (err) {
      this.current.set({ kind: 'notPlanned', taskId: created.id, shortId: created.shortId,
        reason: toSafeErrorMessage(err, 'It could not be assigned to you.') });
      return;
    }
    await this.plan();
  }

  /** Re-sends only the block for the item already created. */
  async retryPlanning(): Promise<void> {
    if (!this.planned || this.current().kind === 'busy') return;
    this.current.set({ kind: 'busy' });
    await this.plan();
  }

  /** Plans an item created elsewhere (the full work item form, "More options"). */
  async planExisting(taskId: string, shortId: string, slot: CreateSlot): Promise<void> {
    if (this.current().kind === 'busy') return;
    this.planned = { taskId, shortId, slot };
    this.current.set({ kind: 'busy' });
    await this.plan();
  }

  reset(): void {
    this.planned = null;
    this.current.set({ kind: 'idle' });
  }

  private async plan(): Promise<void> {
    const { taskId, shortId, slot } = this.planned!;
    const ok = await this.planner.createBlock(taskId, slot.startIso, slot.endIso);
    this.current.set(ok
      ? { kind: 'done', taskId }
      : { kind: 'notPlanned', taskId, shortId, reason: this.planner.error() ?? 'It could not be planned.' });
  }
}
