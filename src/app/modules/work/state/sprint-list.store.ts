import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { SprintApiService } from '../data-access/sprint-api.service';
import { toSprint } from '../utils/sprint.mapper';
import { Sprint } from '../models/sprint.model';
import {
  CompleteSprintRequestDto, CreateSprintRequestDto, EditSprintRequestDto, SetSprintTasksRequestDto,
  StartSprintRequestDto
} from '../models/dto/sprint.dto';
import { isPendingApproval } from '../models/dto/work-approval.dto';

interface SprintListState {
  readonly sprints: readonly Sprint[];
  readonly loading: boolean;
  readonly error: string | null;
  /** 'Sent for approval.' after the last create/start/edit/complete/achieve/remove came back 202; null when applied. */
  readonly approvalNotice: string | null;
}

const initialState: SprintListState = { sprints: [], loading: false, error: null, approvalNotice: null };

const SENT_FOR_APPROVAL = 'Sent for approval.';

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const SprintListStore = signalStore(
  { providedIn: 'root' },
  withState<SprintListState>(initialState),
  withMethods((store, api = inject(SprintApiService), notifications = inject(NotificationService)) => {
    /** The backend decides direct vs approval; a 202 body means the change is waiting on an approver. */
    const noteOutcome = (res: unknown) => {
      const pending = isPendingApproval(res);
      patchState(store, { approvalNotice: pending ? SENT_FOR_APPROVAL : null });
      if (pending) notifications.info(SENT_FOR_APPROVAL);
    };

    return {
      async loadForProject(projectId: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const dtos = await firstValueFrom(api.getByProject(projectId));
          patchState(store, { sprints: dtos.map(toSprint), loading: false });
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to load sprints.'), loading: false });
        }
      },

      async create(projectId: string, request: CreateSprintRequestDto): Promise<boolean> {
        patchState(store, { error: null });
        try {
          noteOutcome(await firstValueFrom(api.create(projectId, request)));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to create the sprint.') });
          return false;
        }
      },

      async setTasks(sprintId: string, request: SetSprintTasksRequestDto, projectId: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          await firstValueFrom(api.setTasks(sprintId, request));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to update the sprint tasks.') });
          return false;
        }
      },

      async start(sprintId: string, request: StartSprintRequestDto, projectId: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          noteOutcome(await firstValueFrom(api.start(sprintId, request)));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to start the sprint.') });
          return false;
        }
      },

      async edit(sprintId: string, request: EditSprintRequestDto, projectId: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          noteOutcome(await firstValueFrom(api.edit(sprintId, request)));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to update the sprint.') });
          return false;
        }
      },

      async complete(sprintId: string, request: CompleteSprintRequestDto, projectId: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          noteOutcome(await firstValueFrom(api.complete(sprintId, request)));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Every task in this sprint must be complete first.') });
          return false;
        }
      },

      async achieve(sprintId: string, projectId: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          noteOutcome(await firstValueFrom(api.achieve(sprintId)));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to achieve the sprint.') });
          return false;
        }
      },

      /** Deletes a complete or achieved sprint (its tasks return to the backlog), or sends the deletion for approval. */
      async remove(sprintId: string, projectId: string): Promise<boolean> {
        patchState(store, { error: null });
        try {
          noteOutcome(await firstValueFrom(api.delete(sprintId)));
          await this.loadForProject(projectId);
          return true;
        } catch (err) {
          patchState(store, { error: extractError(err, 'Failed to delete the sprint.') });
          return false;
        }
      }
    };
  })
);
