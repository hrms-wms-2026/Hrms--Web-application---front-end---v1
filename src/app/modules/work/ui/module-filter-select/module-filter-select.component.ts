import { Component, computed, input, output } from '@angular/core';
import { ActivityFilter } from '../../utils/project.mapper';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';

@Component({
  selector: 'app-module-filter-select',
  standalone: true,
  imports: [WorkDropdownComponent],
  template: `
    <div class="flex flex-wrap items-start gap-3" data-testid="module-filter-bar">
      <app-work-dropdown
        [options]="moduleOptions()"
        [selected]="selected()"
        fieldLabel="Module"
        accessibleLabel="Module filter"
        leadingIcon="module"
        [fullWidth]="true"
        data-testid="module-filter-dropdown"
        (selectionChanged)="selectionChanged.emit($event)"
      />
      <app-work-dropdown
        [options]="statusOptions"
        [selected]="activityFilter()"
        fieldLabel="Status"
        accessibleLabel="Activity status filter"
        leadingIcon="status"
        [fullWidth]="true"
        data-testid="module-activity-filter-dropdown"
        (selectionChanged)="onActivityFilterSelected($event)"
      />
    </div>
  `
})
export class ModuleFilterSelectComponent {
  options = input.required<{ id: string; title: string }[]>();
  selected = input.required<string>();
  selectionChanged = output<string>();

  activityFilter = input.required<ActivityFilter>();
  activityFilterChanged = output<ActivityFilter>();

  readonly statusOptions: readonly WorkDropdownOption[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  readonly moduleOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'all', label: 'All modules' },
    ...this.options().map((option) => ({ value: option.id, label: option.title }))
  ]);

  onActivityFilterSelected(value: string): void {
    this.activityFilterChanged.emit(value as ActivityFilter);
  }
}
