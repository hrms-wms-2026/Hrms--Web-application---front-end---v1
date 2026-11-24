import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TaskFilterBarComponent, TaskFilterFieldConfig } from '../../../work/ui/task-filter-bar/task-filter-bar.component';
import { EmployeeFilterOptionsStore } from '../../data-access/employee-filter-options.store';
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
  /** Option lists are shared with the table's header menus (provided by the employee list page). */
  private readonly options = inject(EmployeeFilterOptionsStore);

  readonly value = input.required<EmployeeListFilters>();
  readonly legalEntityId = input<string | null>(null);
  readonly applied = output<EmployeeListFilters>();

  protected readonly departmentOptions = this.options.departments;
  protected readonly positionOptions = this.options.positions;
  protected readonly managerOptions = this.options.managers;
  protected readonly loadError = this.options.error;

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
          kind: 'multi',
          options: this.departmentOptions()
        },
        {
          key: 'positionId',
          label: 'Position',
          icon: 'position',
          kind: 'multi',
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
        kind: 'multi',
        options: this.managerOptions()
      });
    }
    return fields;
  });

  readonly filterValues = computed<Record<string, readonly string[]>>(() => {
    const v = this.value();
    const res: Record<string, string[]> = {};
    if (v.departmentIds.length > 0) res['departmentId'] = [...v.departmentIds];
    if (v.positionIds.length > 0) res['positionId'] = [...v.positionIds];
    if (v.employmentTypes && v.employmentTypes.length > 0) res['employmentTypes'] = [...v.employmentTypes];
    if (v.managerIds.length > 0) res['managerId'] = [...v.managerIds];
    return res;
  });

  loadOptions(): void {
    this.options.load(this.legalEntityId());
  }

  protected onFieldChanged(change: { key: string; values: string[] }): void {
    const current = this.value();
    let next: EmployeeListFilters;
    switch (change.key) {
      case 'departmentId':
        next = { ...current, departmentIds: change.values };
        break;
      case 'positionId':
        next = { ...current, positionIds: change.values };
        break;
      case 'employmentTypes':
        next = { ...current, employmentTypes: change.values };
        break;
      case 'managerId':
        next = { ...current, managerIds: change.values };
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
