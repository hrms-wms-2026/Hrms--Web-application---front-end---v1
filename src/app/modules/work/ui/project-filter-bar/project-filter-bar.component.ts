import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { WorkDropdownOption } from '../work-dropdown/work-dropdown.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { AchievedFilter } from '../../state/project-list.store';
import { FilterBarComponent, FilterFieldConfig } from '../../../../shared/ui/filter-bar/filter-bar.component';

const STATUS_OPTIONS: readonly WorkDropdownOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
];

@Component({
  selector: 'app-project-filter-bar',
  standalone: true,
  imports: [FilterBarComponent],
  template: `
    <app-filter-bar
      [fields]="filterFields()"
      [values]="filterValues()"
      (fieldChanged)="onFieldChanged($event)"
    />
  `
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  readonly statusOptions = STATUS_OPTIONS;
  readonly categoryOptions = computed<WorkDropdownOption[]>(() =>
    this.categoryStore.categories().map((category) => ({ value: category.id, label: category.name }))
  );

  readonly filterFields = computed<FilterFieldConfig[]>(() => [
    { key: 'category', label: 'Category', icon: 'category', kind: 'multi', options: this.categoryOptions() },
    { key: 'status', label: 'Status', icon: 'status', kind: 'single', options: this.statusOptions, defaultValues: ['all'] }
  ]);

  categoriesChanged = output<string[]>();
  achievedFilterChanged = output<AchievedFilter>();

  selectedCategories = signal<string[]>([]);
  selectedStatus = signal<string>('all');

  readonly filterValues = computed<Record<string, string[]>>(() => ({
    category: this.selectedCategories(),
    status: [this.selectedStatus()]
  }));

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  onFieldChanged(event: { key: string; values: string[] }): void {
    if (event.key === 'category') {
      this.selectCategories(event.values);
    } else if (event.key === 'status') {
      this.selectStatus(event.values[0] ?? 'all');
    }
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
