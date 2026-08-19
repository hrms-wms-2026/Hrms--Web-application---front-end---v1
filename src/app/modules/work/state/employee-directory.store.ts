import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PeopleApiService } from '../../people/data-access/people-api.service';
import { EmployeeSummary, buildInitials } from '../models/employee-summary.model';

interface EmployeeDirectoryState {
  readonly byId: Readonly<Record<string, EmployeeSummary>>;
}

const initialState: EmployeeDirectoryState = { byId: {} };

export const EmployeeDirectoryStore = signalStore(
  { providedIn: 'root' },
  withState<EmployeeDirectoryState>(initialState),
  withMethods((store, peopleApi = inject(PeopleApiService)) => {
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
          const fetched = await Promise.all(
            missing.map((id) => firstValueFrom(peopleApi.getEmployee(id)).catch(() => null))
          );

          const additions: Record<string, EmployeeSummary> = {};
          fetched.forEach((employee, index) => {
            if (!employee) return;
            additions[missing[index]!] = {
              id: employee.id,
              name: employee.fullName,
              initials: buildInitials(employee.fullName),
              avatarUrl: null // no avatar field on EmployeeListItemResponse today - see plan's Global Constraints
            };
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
