import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { WorkApprovalsApiService } from '../data-access/work-approvals-api.service';
import { ApprovalItem } from '../models/approval.model';
import { AllocationRequestDto, EditObjectiveRequestPayloadDto } from '../models/dto/allocation-request.dto';
import { toApprovalItem } from '../utils/approval.mapper';

interface WorkApprovalsState {
  readonly taskCreationRequests: readonly ApprovalItem[];
  readonly taskEditRequests: readonly ApprovalItem[];
  readonly allocationRequests: readonly ApprovalItem[];
  readonly objectiveChangeRequests: readonly ApprovalItem[];
  readonly objectiveInvitations: readonly ApprovalItem[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: WorkApprovalsState = {
  taskCreationRequests: [],
  taskEditRequests: [],
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
      store.taskCreationRequests().length
      + store.taskEditRequests().length
      + store.allocationRequests().length
      + store.objectiveChangeRequests().length
      + store.objectiveInvitations().length
    )
  })),
  withMethods((store, api = inject(WorkApprovalsApiService)) => ({
    async loadAll(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const [taskCreation, taskEdit, allocation, objectiveChange, invitations] = await Promise.all([
          firstValueFrom(api.getMyTaskCreationRequests()),
          firstValueFrom(api.getMyTaskEditRequests()),
          firstValueFrom(api.getMyAllocationRequests()),
          firstValueFrom(api.getMyObjectiveChangeRequests()),
          firstValueFrom(api.getMyObjectiveInvitations())
        ]);
        patchState(store, {
          taskCreationRequests: taskCreation.map(toApprovalItem),
          taskEditRequests: taskEdit.map(toApprovalItem),
          allocationRequests: allocation.map(toApprovalItem),
          objectiveChangeRequests: objectiveChange.map(toApprovalItem),
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
        switch (item.kind) {
          case 'task_creation':
            await firstValueFrom(api.approveTaskCreationRequest(item.id));
            patchState(store, {
              taskCreationRequests: store.taskCreationRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'task_edit':
            await firstValueFrom(api.approveTaskEditRequest(item.id));
            patchState(store, {
              taskEditRequests: store.taskEditRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'allocation_extend': {
            const allocation = item.raw as AllocationRequestDto;
            await firstValueFrom(api.approveAllocationRequest(
              item.id,
              typeof override === 'number' ? override : allocation.payload.requestedAdditionalHours
            ));
            patchState(store, {
              allocationRequests: store.allocationRequests().filter((i) => i.id !== item.id)
            });
            break;
          }
          case 'objective_change':
            await firstValueFrom(api.approveObjectiveChangeRequest(item.id));
            patchState(store, {
              objectiveChangeRequests: store.objectiveChangeRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'objective_edit':
            await firstValueFrom(api.approveObjectiveChangeRequest(
              item.id,
              typeof override === 'object' ? override : undefined
            ));
            patchState(store, {
              objectiveChangeRequests: store.objectiveChangeRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'objective_invitation':
            await firstValueFrom(api.acceptObjectiveInvitation(item.id));
            patchState(store, {
              objectiveInvitations: store.objectiveInvitations().filter((i) => i.id !== item.id)
            });
            break;
        }
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to approve.') });
        return false;
      }
    },

    async reject(item: ApprovalItem, comment?: string): Promise<boolean> {
      patchState(store, { error: null });
      try {
        switch (item.kind) {
          case 'task_creation':
            await firstValueFrom(api.rejectTaskCreationRequest(item.id, comment ?? ''));
            patchState(store, {
              taskCreationRequests: store.taskCreationRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'task_edit':
            await firstValueFrom(api.rejectTaskEditRequest(item.id, comment ?? ''));
            patchState(store, {
              taskEditRequests: store.taskEditRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'allocation_extend':
            await firstValueFrom(api.rejectAllocationRequest(item.id));
            patchState(store, {
              allocationRequests: store.allocationRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'objective_change':
          case 'objective_edit':
            await firstValueFrom(api.rejectObjectiveChangeRequest(item.id));
            patchState(store, {
              objectiveChangeRequests: store.objectiveChangeRequests().filter((i) => i.id !== item.id)
            });
            break;
          case 'objective_invitation':
            await firstValueFrom(api.rejectObjectiveInvitation(item.id));
            patchState(store, {
              objectiveInvitations: store.objectiveInvitations().filter((i) => i.id !== item.id)
            });
            break;
        }
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to reject.') });
        return false;
      }
    }
  }))
);
