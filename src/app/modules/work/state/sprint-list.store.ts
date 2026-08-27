import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { SprintApiService } from '../data-access/sprint-api.service';
import { toSprint } from '../utils/sprint.mapper';
import { Sprint, SprintStatus } from '../models/sprint.model';
import { CreateSprintRequestDto, EditSprintRequestDto } from '../models/dto/sprint.dto';

interface SprintListState {
  readonly sprints: readonly Sprint[];
  readonly loading: boolean;
  readonly error: string | null;
}

const initialState: SprintListState = { sprints: [], loading: false, error: null };

function extractError(err: any, fallback: string): string {
  return err?.error?.detail || err?.error?.message || err?.message || fallback;
}

export const SprintListStore = signalStore(
  { providedIn: 'root' },
  withState<SprintListState>(initialState),
  withMethods((store, api = inject(SprintApiService)) => ({
    async load(objectiveId: string, activeOnly: boolean): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dtos = await firstValueFrom(api.getByObjective(objectiveId, activeOnly));
        patchState(store, { sprints: dtos.map(toSprint), loading: false });
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to load sprints.'), loading: false });
      }
    },

    async create(objectiveId: string, request: CreateSprintRequestDto, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.create(objectiveId, request));
        await this.load(objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to create the sprint.') });
        return false;
      }
    },

    async edit(sprintId: string, request: EditSprintRequestDto, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.edit(sprintId, request));
        await this.load(objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to update the sprint.') });
        return false;
      }
    },

    async complete(sprintId: string, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.complete(sprintId));
        await this.load(objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Every task in this sprint must be complete first.') });
        return false;
      }
    },

    async achieve(sprintId: string, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.achieve(sprintId));
        await this.load(objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to achieve the sprint.') });
        return false;
      }
    },

    async setStatus(sprintId: string, status: SprintStatus, objectiveId: string, activeOnly: boolean): Promise<boolean> {
      patchState(store, { error: null });
      try {
        await firstValueFrom(api.setStatus(sprintId, status));
        await this.load(objectiveId, activeOnly);
        return true;
      } catch (err) {
        patchState(store, { error: extractError(err, 'Failed to change the sprint status.') });
        return false;
      }
    }
  }))
);
