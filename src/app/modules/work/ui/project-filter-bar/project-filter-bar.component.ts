import {
  Component,
  OnInit,
  inject,
  output,
  signal,
  computed,
  HostListener,
  ElementRef,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { SelectOption } from '../../../../shared/ui/select/select.component';
import { ProjectCategoryStore } from '../../state/project-category.store';
import { AchievedFilter } from '../../state/project-list.store';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
];

@Component({
  selector: 'app-project-filter-bar',
  standalone: true,
  imports: [NgClass],
  template: `
    <div class="flex items-center gap-2">
      <!-- Category Dropdown -->
      <div class="relative" #categoryDropdown>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] min-w-[140px]"
          (click)="toggleCategoryDropdown()"
          [attr.aria-expanded]="categoryOpen()"
          aria-haspopup="listbox"
        >
          <span class="flex-1 text-left truncate">{{ selectedCategoryLabel() }}</span>
          <svg
            class="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-150"
            [ngClass]="{ 'rotate-180': categoryOpen() }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        @if (categoryOpen()) {
          <div
            class="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
            role="listbox"
            aria-label="Project category"
          >
            <div class="max-h-52 overflow-y-auto py-1" style="scrollbar-width:none;-ms-overflow-style:none">
              <button
                type="button"
                class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-secondary)]"
                [ngClass]="{
                  'font-semibold text-[var(--color-accent)]': !selectedCategory(),
                  'text-[var(--color-text-primary)]': selectedCategory()
                }"
                (click)="selectCategory(null)"
              >
                @if (!selectedCategory()) {
                  <svg class="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                } @else {
                  <span class="h-3.5 w-3.5 shrink-0"></span>
                }
                All categories
              </button>
              @for (opt of categoryOptions(); track opt.value) {
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-secondary)]"
                  [ngClass]="{
                    'font-semibold text-[var(--color-accent)]': selectedCategory() === opt.value,
                    'text-[var(--color-text-primary)]': selectedCategory() !== opt.value
                  }"
                  (click)="selectCategory(opt.value)"
                >
                  @if (selectedCategory() === opt.value) {
                    <svg class="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  } @else {
                    <span class="h-3.5 w-3.5 shrink-0"></span>
                  }
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>
        }
      </div>

      <!-- Status Dropdown -->
      <div class="relative" #statusDropdown>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)] min-w-[140px]"
          (click)="toggleStatusDropdown()"
          [attr.aria-expanded]="statusOpen()"
          aria-haspopup="listbox"
        >
          <span class="flex-1 text-left truncate">{{ selectedStatusLabel() }}</span>
          <svg
            class="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform duration-150"
            [ngClass]="{ 'rotate-180': statusOpen() }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        @if (statusOpen()) {
          <div
            class="absolute left-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
            role="listbox"
            aria-label="Status"
          >
            <div class="py-1">
              @for (opt of statusOptions; track opt.value) {
                <button
                  type="button"
                  class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-surface-secondary)]"
                  [ngClass]="{
                    'font-semibold text-[var(--color-accent)]': selectedStatus() === opt.value,
                    'text-[var(--color-text-primary)]': selectedStatus() !== opt.value
                  }"
                  (click)="selectStatus(opt.value)"
                >
                  @if (selectedStatus() === opt.value) {
                    <svg class="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  } @else {
                    <span class="h-3.5 w-3.5 shrink-0"></span>
                  }
                  {{ opt.label }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ProjectFilterBarComponent implements OnInit {
  private readonly categoryStore = inject(ProjectCategoryStore);
  private readonly el = inject(ElementRef);

  readonly statusOptions = STATUS_OPTIONS;

  categoryChanged = output<string | null>();
  achievedFilterChanged = output<AchievedFilter>();

  categoryOpen = signal(false);
  statusOpen = signal(false);
  selectedCategory = signal<string | null>(null);
  selectedStatus = signal<string>('all');

  selectedCategoryLabel = computed(() => {
    const val = this.selectedCategory();
    if (!val) return 'All categories';
    const found = this.categoryOptions().find((o) => o.value === val);
    return found?.label ?? 'All categories';
  });

  selectedStatusLabel = computed(() => {
    const found = this.statusOptions.find((o) => o.value === this.selectedStatus());
    return found?.label ?? 'All statuses';
  });

  ngOnInit(): void {
    this.categoryStore.loadCategories();
  }

  categoryOptions(): SelectOption[] {
    return this.categoryStore.categories().map((c) => ({ value: c.id, label: c.name }));
  }

  toggleCategoryDropdown(): void {
    this.categoryOpen.update((v) => !v);
    if (this.categoryOpen()) this.statusOpen.set(false);
  }

  toggleStatusDropdown(): void {
    this.statusOpen.update((v) => !v);
    if (this.statusOpen()) this.categoryOpen.set(false);
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.categoryOpen.set(false);
      this.statusOpen.set(false);
    }
  }
}
