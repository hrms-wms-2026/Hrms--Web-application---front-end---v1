import { inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DepartmentApiService } from '../../organization/data-access/department-api.service';
import { PositionApiService } from '../../organization/data-access/position-api.service';
import { PeopleApiService } from './people-api.service';

export interface EmployeeFilterOption { readonly value: string; readonly label: string; }

/**
 * Department / position / manager options for the Employees filters, loaded lazily per company.
 * Shared by the toolbar Filter popover and the table's header menus so both show the same lists.
 * Provided by EmployeeListComponent, so a new visit to the page loads fresh options.
 */
@Injectable()
export class EmployeeFilterOptionsStore {
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly peopleApi = inject(PeopleApiService);

  readonly departments = signal<EmployeeFilterOption[]>([]);
  readonly positions = signal<EmployeeFilterOption[]>([]);
  readonly managers = signal<EmployeeFilterOption[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private loadedFor: string | null = null;

  load(legalEntityId: string | null): void {
    if (!legalEntityId || legalEntityId === this.loadedFor) return;
    this.loadedFor = legalEntityId;
    this.error.set(null);
    this.loading.set(true);
    forkJoin({
      departments: this.departmentApi.listFlat(legalEntityId, { pageSize: 100 }),
      positions: this.positionApi.listFlat(legalEntityId, { pageSize: 100, includeInactive: false }),
      managers: this.peopleApi.listEmployees({ legalEntityId, pageSize: 100 })
    }).subscribe({
      next: ({ departments, positions, managers }) => {
        this.departments.set(departments.items.map((d) => ({ value: d.id, label: d.name })));
        this.positions.set(positions.items.map((p) => ({ value: p.id, label: p.name })));
        this.managers.set(managers.items.map((m) => ({ value: m.id, label: m.fullName })));
        this.loading.set(false);
      },
      error: () => {
        this.loadedFor = null;
        this.loading.set(false);
        this.error.set('Could not load filter options.');
      }
    });
  }
}
