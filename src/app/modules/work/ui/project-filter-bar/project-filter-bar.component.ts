import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { AchievedFilter } from '../../state/project-list.store';

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
];

@Component({
  selector: 'app-project-filter-bar',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <div class="flex flex-wrap items-start justify-end gap-2">
      <app-select
        [options]="categoryOptions()"
        [value]="selectedCategory() ?? 'all'"
        ariaLabel="Project category filter"
        [icon]="'category'"
        (valueChange)="selectCategoryFromDropdown($event)"
      />
      <app-select
        [options]="statusOptions"
        [value]="selectedStatus()"
        ariaLabel="Project status filter"
        [icon]="'status'"
        (valueChange)="selectStatusFromDropdown($event)"
      />
    </div>
  `
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  readonly statusOptions = STATUS_OPTIONS;
  readonly categoryOptions = computed<SelectOption[]>(() => [
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
