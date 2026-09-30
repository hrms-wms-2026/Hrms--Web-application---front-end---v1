import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { TaskFilterBarComponent, TaskFilterFieldConfig } from '../../../work/ui/task-filter-bar/task-filter-bar.component';
import { WorkDropdownOption } from '../../../work/ui/work-dropdown/work-dropdown.component';
import { DepartmentApiService } from '../../../organization/data-access/department-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EMPLOYMENT_TYPE_OPTIONS } from '../../models/employment-type-options';
import { EMPTY_EMPLOYEE_FILTERS, EmployeeListFilters } from '../../utils/employee-list-url-state';

@Component({
  selector: 'app-employee-filter-popover',
  standalone: true,
  imports: [TaskFilterBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-task-filter-bar
      [fields]="filterFields()"
      [values]="filterValues()"
      [emitFieldChangedOnClear]="false"
      [hint]="hint()"
      hintTestId="filter-no-company"
      (fieldChanged)="onFieldChanged($event)"
      (allCleared)="onAllCleared()"
      (panelOpened)="loadOptions()"
    />
    @if (loadError(); as error) {
      <p class="efp__error" role="alert">{{ error }}</p>
    }
  `,
  styles: [`
    :host { display: inline-block; }
    .efp__error { margin: 4px 0 0; font-size: 12px; color: var(--color-danger-text, var(--color-danger)); }
  `]
})
export class EmployeeFilterPopoverComponent {
  private readonly departmentApi = inject(DepartmentApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly peopleApi = inject(PeopleApiService);

  readonly value = input.required<EmployeeListFilters>();
  readonly legalEntityId = input<string | null>(null);
  readonly applied = output<EmployeeListFilters>();

  protected readonly departmentOptions = signal<WorkDropdownOption[]>([]);
  protected readonly positionOptions = signal<WorkDropdownOption[]>([]);
  protected readonly managerOptions = signal<WorkDropdownOption[]>([]);
  protected readonly loadError = signal<string | null>(null);

  private loadedForLegalEntityId: string | null = null;

  readonly hint = computed(() =>
    !this.legalEntityId() ? 'Select a company to filter by department, position or manager.' : null
  );

  readonly filterFields = computed<readonly TaskFilterFieldConfig[]>(() => {
    const le = this.legalEntityId();
    const fields: TaskFilterFieldConfig[] = [];
    if (le) {
      fields.push(
        {
          key: 'departmentId',
          label: 'Department',
          icon: 'department',
          kind: 'single',
          options: this.departmentOptions()
        },
        {
          key: 'positionId',
          label: 'Position',
          icon: 'position',
          kind: 'single',
          options: this.positionOptions()
        }
      );
    }
    fields.push({
      key: 'employmentTypes',
      label: 'Employment Type',
      icon: 'type',
      kind: 'multi',
      options: EMPLOYMENT_TYPE_OPTIONS.map((t) => ({ value: t.value, label: t.label }))
    });
    if (le) {
      fields.push({
        key: 'managerId',
        label: 'Reporting Manager',
        icon: 'people',
        kind: 'single',
        options: this.managerOptions()
      });
    }
    return fields;
  });

  readonly filterValues = computed<Record<string, readonly string[]>>(() => {
    const v = this.value();
    const res: Record<string, string[]> = {};
    if (v.departmentId) res['departmentId'] = [v.departmentId];
    if (v.positionId) res['positionId'] = [v.positionId];
    if (v.employmentTypes && v.employmentTypes.length > 0) res['employmentTypes'] = [...v.employmentTypes];
    if (v.managerId) res['managerId'] = [v.managerId];
    return res;
  });

  loadOptions(): void {
    const legalEntityId = this.legalEntityId();
    if (!legalEntityId || legalEntityId === this.loadedForLegalEntityId) return;
    this.loadedForLegalEntityId = legalEntityId;
    this.loadError.set(null);
    forkJoin({
      departments: this.departmentApi.listFlat(legalEntityId, { pageSize: 100 }),
      positions: this.positionApi.listFlat(legalEntityId, { pageSize: 100, includeInactive: false }),
      managers: this.peopleApi.listEmployees({ legalEntityId, pageSize: 100 })
    }).subscribe({
      next: ({ departments, positions, managers }) => {
        this.departmentOptions.set(departments.items.map((d) => ({ value: d.id, label: d.name })));
        this.positionOptions.set(positions.items.map((p) => ({ value: p.id, label: p.name })));
        this.managerOptions.set(managers.items.map((m) => ({ value: m.id, label: m.fullName })));
      },
      error: () => {
        this.loadedForLegalEntityId = null;
        this.loadError.set('Could not load filter options.');
      }
    });
  }

  protected onFieldChanged(change: { key: string; values: string[] }): void {
    const current = this.value();
    let next: EmployeeListFilters;
    switch (change.key) {
      case 'departmentId':
        next = { ...current, departmentId: change.values[0] || null };
        break;
      case 'positionId':
        next = { ...current, positionId: change.values[0] || null };
        break;
      case 'employmentTypes':
        next = { ...current, employmentTypes: change.values };
        break;
      case 'managerId':
        next = { ...current, managerId: change.values[0] || null };
        break;
      default:
        return;
    }
    this.applied.emit(next);
  }

  protected onAllCleared(): void {
    this.applied.emit(EMPTY_EMPLOYEE_FILTERS);
  }
}
