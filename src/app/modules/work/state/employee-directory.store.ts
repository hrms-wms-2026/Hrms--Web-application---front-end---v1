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
  withMethods((store, peopleApi = inject(PeopleApiService)) => ({
    get(employeeId: string): EmployeeSummary | undefined {
      return store.byId()[employeeId];
    },

    async ensureLoaded(employeeIds: readonly string[]): Promise<void> {
      const cached = store.byId();
      const missing = [...new Set(employeeIds)].filter((id) => !cached[id]);
      if (missing.length === 0) return;

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

      patchState(store, { byId: { ...store.byId(), ...additions } });
    }
  }))
);
