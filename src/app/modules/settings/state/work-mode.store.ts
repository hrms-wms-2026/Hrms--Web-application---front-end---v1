import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, catchError, of } from 'rxjs';
import { computed } from '@angular/core';
import { WorkModeApiService } from '../data-access/work-mode-api.service';
import { UpsertWorkModeRequest, WorkMode, MAX_WORK_MODES_PER_LEGAL_ENTITY } from '../models/work-mode.model';

interface WorkModeState {
  legalEntityId: string | null;
  items: WorkMode[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: WorkModeState = {
  legalEntityId: null,
  items: [],
  loading: false,
  saving: false,
  error: null
};

export const WorkModeStore = signalStore(
  withState(initialState),
  withComputed(({ items }) => ({
    atCap: computed(() => items().filter(m => m.isActive).length >= MAX_WORK_MODES_PER_LEGAL_ENTITY)
  })),
  withMethods((store, api = inject(WorkModeApiService)) => ({
    load: rxMethod<string>(
      pipe(
        tap(legalEntityId => patchState(store, { legalEntityId, loading: true, error: null })),
        switchMap(legalEntityId =>
          api.list(legalEntityId, false).pipe(
            tap(items => patchState(store, { items, loading: false })),
            catchError(() => {
              patchState(store, { loading: false, error: 'Failed to load work modes.' });
              return of(null);
            })
          )
        )
      )
    ),
    create(payload: UpsertWorkModeRequest) {
      const legalEntityId = store.legalEntityId();
      if (!legalEntityId) return;
      patchState(store, { saving: true, error: null });
      api.create(legalEntityId, payload).subscribe({
        next: created => patchState(store, { items: [...store.items(), created], saving: false }),
        error: () => patchState(store, { saving: false, error: 'Failed to create work mode.' })
      });
    },
    update(id: string, payload: UpsertWorkModeRequest) {
      const legalEntityId = store.legalEntityId();
      if (!legalEntityId) return;
      patchState(store, { saving: true, error: null });
      api.update(legalEntityId, id, payload).subscribe({
        next: updated => patchState(store, {
          items: store.items().map(m => (m.id === id ? updated : m)),
          saving: false
        }),
        error: () => patchState(store, { saving: false, error: 'Failed to update work mode.' })
      });
    },
    deactivate(id: string) {
      const legalEntityId = store.legalEntityId();
      if (!legalEntityId) return;
      patchState(store, { saving: true, error: null });
      api.deactivate(legalEntityId, id).subscribe({
        next: () => patchState(store, {
          items: store.items().filter(m => m.id !== id),
          saving: false
        }),
        error: () => patchState(store, { saving: false, error: 'Failed to deactivate work mode. It may be in use.' })
      });
    }
  }))
);
