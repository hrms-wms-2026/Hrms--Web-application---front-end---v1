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
    <div class="flex flex-wrap items-start justify-end gap-2">
      <app-work-dropdown
        [options]="categoryOptions()"
        [selected]="selectedCategory() ?? 'all'"
        accessibleLabel="Project category filter"
        leadingIcon="category"
        (selectionChanged)="selectCategoryFromDropdown($event)"
      />
      <app-work-dropdown
        [options]="statusOptions"
        [selected]="selectedStatus()"
        accessibleLabel="Project status filter"
        leadingIcon="status"
        (selectionChanged)="selectStatusFromDropdown($event)"
      />
    </div>
  `
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  readonly statusOptions = STATUS_OPTIONS;
  readonly categoryOptions = computed<WorkDropdownOption[]>(() => [
    { value: 'all', label: 'All categories' },
    ...this.categoryStore.categories().map((category) => ({ value: category.id, label: category.name }))
  ]);

  categoryChanged = output<string | null>();
  achievedFilterChanged = output<AchievedFilter>();

  // Retained as state-compatible methods for existing consumers and tests.
  categoryOpen = signal(false);
  statusOpen = signal(false);
  selectedCategory = signal<string | null>(null);
  selectedStatus = signal<string>('all');

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  toggleCategoryDropdown(): void {
    this.categoryOpen.update((value) => !value);
    if (this.categoryOpen()) this.statusOpen.set(false);
  }

  toggleStatusDropdown(): void {
    this.statusOpen.update((value) => !value);
    if (this.statusOpen()) this.categoryOpen.set(false);
  }

  selectCategoryFromDropdown(value: string): void {
    this.selectCategory(value === 'all' ? null : value);
  }

  selectStatusFromDropdown(value: string): void {
    this.selectStatus(value);
  }

  selectCategory(value: string | null): void {
    this.selectedCategory.set(value);
    this.categoryOpen.set(false);
    this.categoryChanged.emit(value);
  }

  selectStatus(value: string): void {
    this.selectedStatus.set(value);
    this.statusOpen.set(false);
    this.achievedFilterChanged.emit(value as AchievedFilter);
  }
}
