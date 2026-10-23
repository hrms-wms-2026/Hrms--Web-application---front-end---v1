import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { defer, firstValueFrom } from 'rxjs';
import { InboxApiService } from '../data-access/inbox-api.service';
import { InboxCapabilityFlag, InboxKindDescriptorDto, hasCapability } from '../models/inbox.dto';

interface InboxKindsState {
  readonly kinds: readonly InboxKindDescriptorDto[];
  readonly loaded: boolean;
}

/** The kind registry (GET /inbox/kinds): loaded once; the card, list and dialogs render from its capabilities. */
export const InboxKindsStore = signalStore(
  { providedIn: 'root' },
  withState<InboxKindsState>({ kinds: [], loaded: false }),
  withComputed((store) => ({
    byKey: computed(() => new Map(store.kinds().map((k) => [`${k.source}:${k.kind}`, k])))
  })),
  withMethods((store, api = inject(InboxApiService)) => {
    let pending: Promise<void> | null = null;
    return {
      /** Loads the registry the first time; a failed load is retried on the next call. */
      ensureLoaded(): Promise<void> {
        if (store.loaded()) return Promise.resolve();
        pending ??= firstValueFrom(defer(() => api.kinds()))
          .then((kinds) => patchState(store, { kinds, loaded: true }))
          .catch(() => undefined)
          .finally(() => { pending = null; });
        return pending;
      },
      descriptor(source: string, kind: string): InboxKindDescriptorDto | null {
        return store.byKey().get(`${source}:${kind}`) ?? null;
      },
      has(source: string, kind: string, flag: InboxCapabilityFlag): boolean {
        return hasCapability(store.byKey().get(`${source}:${kind}`), flag);
      }
    };
  })
);
