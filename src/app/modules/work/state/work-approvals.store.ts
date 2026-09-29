import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { WorkApprovalsApiService } from '../data-access/work-approvals-api.service';
import { ApprovalItem } from '../models/approval.model';
import { EditObjectiveRequestPayloadDto } from '../models/dto/allocation-request.dto';
import { toApprovalItem } from '../utils/approval.mapper';

interface WorkApprovalsState {
  /** Task and sprint requests from the unified approval engine inbox, already scoped to one project. */
  readonly workApprovals: readonly ApprovalItem[];
  /** module.allocation_extend requests from the same inbox. */
  readonly allocationRequests: readonly ApprovalItem[];
  /** Every other module.* request (edit, delete, transfer, achieve, unachieve) from the same inbox. */
  readonly objectiveChangeRequests: readonly ApprovalItem[];
  readonly objectiveInvitations: readonly ApprovalItem[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: WorkApprovalsState = {
  workApprovals: [],
  allocationRequests: [],
  objectiveChangeRequests: [],
  objectiveInvitations: [],
  loading: false,
  error: null
};

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const WorkApprovalsStore = signalStore(
  { providedIn: 'root' },
  withState<WorkApprovalsState>(initialState),
  withComputed((store) => ({
    pendingCount: computed(() =>
      store.workApprovals().length
      + store.allocationRequests().length
      + store.objectiveChangeRequests().length
      + store.objectiveInvitations().length
    )
  })),
  withMethods((store, api = inject(WorkApprovalsApiService)) => {
    /** Drops a decided item from whichever engine list holds it. */
    const removeEngineItem = (id: string) => patchState(store, {
      workApprovals: store.workApprovals().filter((i) => i.id !== id),
      allocationRequests: store.allocationRequests().filter((i) => i.id !== id),
      objectiveChangeRequests: store.objectiveChangeRequests().filter((i) => i.id !== id)
    });

    return {
      /** projectId loads the approval-engine inbox for that project; without it the engine lists
       *  are empty (the engine inbox is per project). */
      async loadAll(projectId?: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [engine, invitations] = await Promise.all([
            projectId ? firstValueFrom(api.getProjectApprovals(projectId, 'inbox')) : Promise.resolve([]),
            firstValueFrom(api.getMyObjectiveInvitations())
          ]);
          // Status-template requests are listed (and decided) by the task-status panel on the same
          // page, so they are left out here to avoid showing them twice.
          const items = engine
            .filter((i) => i.actionType !== 'project.status_template_change')
            .map(toApprovalItem);
          patchState(store, {
            workApprovals: items.filter((i) => i.kind === 'work_approval'),
            allocationRequests: items.filter((i) => i.kind === 'allocation_extend'),
            objectiveChangeRequests: items.filter((i) => i.kind === 'objective_change' || i.kind === 'objective_edit'),
            objectiveInvitations: invitations.map(toApprovalItem),
            loading: false
          });
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to load approvals.'), loading: false });
        }
      },

      async approve(item: ApprovalItem, override?: number | EditObjectiveRequestPayloadDto): Promise<boolean> {
        patchState(store, { error: null });
        try {
          if (item.engine) {
            // The approver may lower the hours of an allocation request or adjust an edit's fields;
            // the engine applies the edited payload instead of the requested one.
            let edited: string | undefined;
            if (item.kind === 'allocation_extend' && typeof override === 'number') {
              const reason = (item.raw as { payload?: { reason?: string } }).payload?.reason ?? '';
              edited = JSON.stringify({ requestedAdditionalHours: override, reason });
            } else if (item.kind === 'objective_edit' && override && typeof override === 'object') {
              edited = JSON.stringify(override);
            }
            await firstValueFrom(api.approveWorkApproval(item.id, edited));
            removeEngineItem(item.id);
            return true;
          }

          await firstValueFrom(api.acceptObjectiveInvitation(item.id));
          patchState(store, { objectiveInvitations: store.objectiveInvitations().filter((i) => i.id !== item.id) });
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to approve.') });
          return false;
        }
      },

      async reject(item: ApprovalItem, comment?: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          if (item.engine) {
            await firstValueFrom(api.rejectWorkApproval(item.id, comment));
            removeEngineItem(item.id);
            return true;
          }

          await firstValueFrom(api.rejectObjectiveInvitation(item.id));
          patchState(store, { objectiveInvitations: store.objectiveInvitations().filter((i) => i.id !== item.id) });
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to reject.') });
          return false;
        }
      }
    };
  })
);
