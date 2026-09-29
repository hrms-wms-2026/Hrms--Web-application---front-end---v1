import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { WorkDropdownComponent, WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { AchievedFilter } from '../../state/project-list.store';

const STATUS_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
];

@Component({
  selector: 'app-project-filter-bar',
  standalone: true,
  imports: [WorkDropdownComponent],
  template: `
    <div class="flex flex-wrap items-center justify-end gap-2">
      <app-work-dropdown
        [options]="categoryOptions()"
        [multiple]="true"
        [values]="selectedCategories()"
        allLabel="All categories"
        size="sm"
        accessibleLabel="Project category filter"
        leadingIcon="category"
        (valuesChanged)="selectCategories($event)"
      />
      <app-work-dropdown
        [options]="statusOptions"
        [selected]="selectedStatus()"
        size="sm"
        accessibleLabel="Project status filter"
        leadingIcon="status"
        (selectionChanged)="selectStatus($event)"
      />
    </div>
  `
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  readonly statusOptions = STATUS_OPTIONS;
  readonly categoryOptions = computed<WorkDropdownOption[]>(() =>
    this.categoryStore.categories().map((category) => ({ value: category.id, label: category.name }))
  );

  categoriesChanged = output<string[]>();
  achievedFilterChanged = output<AchievedFilter>();

  selectedCategories = signal<string[]>([]);
  selectedStatus = signal<string>('all');

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  selectCategories(values: string[]): void {
    this.selectedCategories.set(values);
    this.categoriesChanged.emit(values);
  }

  selectStatus(value: string): void {
    this.selectedStatus.set(value);
    this.achievedFilterChanged.emit(value as AchievedFilter);
  }
}
