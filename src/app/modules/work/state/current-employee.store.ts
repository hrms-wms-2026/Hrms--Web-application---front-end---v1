import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { TaskApiService } from '../data-access/task-api.service';

interface CurrentEmployeeState {
  readonly employeeId: string | null;
}

const initialState: CurrentEmployeeState = { employeeId: null };

export const CurrentEmployeeStore = signalStore(
  { providedIn: 'root' },
  withState<CurrentEmployeeState>(initialState),
  withMethods((store, taskApi = inject(TaskApiService)) => {
    let inFlight: Promise<void> | null = null;

    return {
      id(): string {
        return store.employeeId() ?? '';
      },

      async ensureLoaded(): Promise<void> {
        if (store.employeeId() !== null) return;
        if (!inFlight) {
          inFlight = (async () => {
            try {
              const { employeeId } = await firstValueFrom(taskApi.getCurrentEmployee());
              patchState(store, { employeeId });
            } catch {
              // No employee record for the caller (e.g. a platform admin with no Work
              // Management seat) - leave employeeId null, isAssignee checks stay false.
            }
          })().finally(() => {
            inFlight = null;
          });
        }
        await inFlight;
      }
    };
  })
);
