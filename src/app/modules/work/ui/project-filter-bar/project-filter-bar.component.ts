import { Component, OnInit, inject, output } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { AchievedFilter } from '../../state/project-list.store';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' }
];

@Component({
  selector: 'app-project-filter-bar',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <div class="flex flex-wrap gap-3">
      <app-select
        label="Project category"
        placeholder="All categories"
        [options]="categoryOptions()"
        (valueChange)="onCategoryChange($event)"
      />
      <app-select
        label="Status"
        [options]="statusOptions"
        value="all"
        (valueChange)="onAchievedFilterChange($event)"
      />
    </div>
  `
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);

  readonly statusOptions = STATUS_OPTIONS;

  categoryChanged = output<string | null>();
  achievedFilterChanged = output<AchievedFilter>();

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  onCategoryChange(value: string): void {
    this.categoryChanged.emit(value || null);
  }

  onAchievedFilterChange(value: string): void {
    this.achievedFilterChanged.emit(value as AchievedFilter);
  }
}
