import { Component, computed, input, output } from '@angular/core';
import { ActivityFilter } from '../../utils/project.mapper';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';

@Component({
  selector: 'app-module-filter-select',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <div class="flex flex-wrap items-start gap-3" data-testid="module-filter-bar">
      <app-select
        [options]="moduleOptions()"
        [value]="selected()"
        label="Module"
        ariaLabel="Module filter"
        [icon]="'module'"
        data-testid="module-filter-dropdown"
        (valueChange)="selectionChanged.emit($event)"
      />
      <app-select
        [options]="statusOptions"
        [value]="activityFilter()"
        label="Status"
        ariaLabel="Activity status filter"
        [icon]="'status'"
        data-testid="module-activity-filter-dropdown"
        (valueChange)="onActivityFilterSelected($event)"
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

  readonly statusOptions: readonly SelectOption[] = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ];

  readonly moduleOptions = computed<SelectOption[]>(() => [
    { value: 'all', label: 'All modules' },
    ...this.options().map((option) => ({ value: option.id, label: option.title }))
  ]);

  onActivityFilterSelected(value: string): void {
    this.activityFilterChanged.emit(value as ActivityFilter);
  }
}
