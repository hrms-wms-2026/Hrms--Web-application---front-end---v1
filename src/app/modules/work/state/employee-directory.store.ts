import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PeopleApiService } from '../../people/data-access/people-api.service';
import { EmployeeSummary, buildInitials } from '../models/employee-summary.model';
import { FileApiService } from '../../../shared/data-access/file-api.service';

interface EmployeeDirectoryState {
  readonly byId: Readonly<Record<string, EmployeeSummary>>;
}

const initialState: EmployeeDirectoryState = { byId: {} };

export const EmployeeDirectoryStore = signalStore(
  { providedIn: 'root' },
  withState<EmployeeDirectoryState>(initialState),
  withMethods((store, peopleApi = inject(PeopleApiService), fileApi = inject(FileApiService)) => {
    const inFlight = new Map<string, Promise<void>>();

    return {
      get(employeeId: string): EmployeeSummary | undefined {
        return store.byId()[employeeId];
      },

      async ensureLoaded(employeeIds: readonly string[]): Promise<void> {
        const cached = store.byId();
        const missing = [...new Set(employeeIds)].filter((id) => !cached[id] && !inFlight.has(id));

        const pending = [...new Set(employeeIds)]
          .filter((id) => inFlight.has(id))
          .map((id) => inFlight.get(id)!);

        if (missing.length === 0) {
          if (pending.length > 0) await Promise.all(pending);
          return;
        }

        const fetchPromise = (async () => {
          // GET /employees/{id}/identity - name + avatar only, gated on nothing beyond
          // authentication (unlike the full employees:read-gated GET /employees/{id}), since
          // resolving who owns/is assigned to something is universal display data, not an HR
          // record. Still caught defensively: a genuinely-deleted employeeId 404s.
          const fetched = await Promise.all(
            missing.map((id) => firstValueFrom(peopleApi.getEmployeeIdentity(id)).catch(() => null))
          );

          const additions: Record<string, EmployeeSummary> = {};
          fetched.forEach((identity, index) => {
            const id = missing[index]!;
            // A failed lookup (404, employee no longer exists) is cached as an unresolved
            // placeholder too, not left "missing" - otherwise every fresh mount that needs this
            // id (a new row, a new card) retries the same doomed request forever, since there is
            // no negative cache without this.
            additions[id] = identity
              ? {
                  id: identity.id,
                  name: identity.name,
                  initials: buildInitials(identity.name),
                  avatarUrl: identity.avatarFileId ? fileApi.getFileUrl(identity.avatarFileId) : null
                }
              : { id, name: 'Unknown employee', initials: '?', avatarUrl: null };
          });

          if (Object.keys(additions).length > 0) {
            patchState(store, { byId: { ...store.byId(), ...additions } });
          }
        })();

        missing.forEach((id) => {
          inFlight.set(
            id,
            fetchPromise.finally(() => inFlight.delete(id))
          );
        });

        await Promise.all([fetchPromise, ...pending]);
      }
    };
  })
);
