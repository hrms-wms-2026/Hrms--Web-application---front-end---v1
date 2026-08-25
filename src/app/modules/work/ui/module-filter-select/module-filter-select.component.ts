import { Component, computed, input, output, signal } from '@angular/core';
import { ActivityFilter } from '../../utils/project.mapper';

type OpenMenu = 'module' | 'status' | null;

@Component({
  selector: 'app-module-filter-select',
  standalone: true,
  template: `
    <div class="flex flex-wrap items-start gap-3" data-testid="module-filter-bar">
      <div class="flex min-w-[min(100%,16rem)] flex-1 flex-col gap-1">
        <span class="text-xs font-medium text-[var(--color-text-secondary)]">Module</span>
        <div class="relative">
          <button
            type="button"
            class="flex h-11 w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-sm font-medium text-[var(--color-text-primary)] shadow-sm transition-[border-color,box-shadow] hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            [attr.aria-expanded]="openMenu() === 'module'"
            aria-haspopup="listbox"
            data-testid="module-filter-trigger"
            (click)="toggleMenu('module', $event)"
          >
            <svg class="h-4 w-4 shrink-0 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 7h18" />
              <path d="M6 7v10" />
              <path d="M18 7v10" />
              <path d="M9 17h6" />
            </svg>
            <span class="min-w-0 flex-1 truncate">{{ selectedModuleLabel() }}</span>
            <svg class="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform" [class.rotate-180]="openMenu() === 'module'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          @if (openMenu() === 'module') {
            <div class="absolute left-0 right-0 top-12 z-40 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl" data-testid="module-filter-menu" role="listbox">
              <button type="button" class="{{ optionClass(selected() === 'all') }}" [attr.aria-selected]="selected() === 'all'" (click)="selectModule('all', $event)">All modules</button>
              @for (option of options(); track option.id) {
                <button type="button" class="{{ optionClass(selected() === option.id) }}" [attr.aria-selected]="selected() === option.id" (click)="selectModule(option.id, $event)">{{ option.title }}</button>
              }
            </div>
          }
        </div>
      </div>

      <div class="flex min-w-[min(100%,12rem)] flex-1 flex-col gap-1">
        <span class="text-xs font-medium text-[var(--color-text-secondary)]">Status</span>
        <div class="relative">
          <button
            type="button"
            class="flex h-11 w-full items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-sm font-medium text-[var(--color-text-primary)] shadow-sm transition-[border-color,box-shadow] hover:border-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus-ring)]"
            [attr.aria-expanded]="openMenu() === 'status'"
            aria-haspopup="listbox"
            data-testid="module-activity-filter-trigger"
            (click)="toggleMenu('status', $event)"
          >
            <svg class="h-4 w-4 shrink-0 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2.5 2" />
            </svg>
            <span class="min-w-0 flex-1 truncate">{{ selectedStatusLabel() }}</span>
            <svg class="h-4 w-4 shrink-0 text-[var(--color-text-secondary)] transition-transform" [class.rotate-180]="openMenu() === 'status'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          @if (openMenu() === 'status') {
            <div class="absolute left-0 right-0 top-12 z-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl" data-testid="module-activity-filter-menu" role="listbox">
              <button type="button" class="{{ optionClass(activityFilter() === 'all') }}" [attr.aria-selected]="activityFilter() === 'all'" (click)="selectActivity('all', $event)">All</button>
              <button type="button" class="{{ optionClass(activityFilter() === 'active') }}" [attr.aria-selected]="activityFilter() === 'active'" (click)="selectActivity('active', $event)">Active</button>
              <button type="button" class="{{ optionClass(activityFilter() === 'inactive') }}" [attr.aria-selected]="activityFilter() === 'inactive'" (click)="selectActivity('inactive', $event)">Inactive</button>
            </div>
          }
        </div>
      </div>
    </div>
  `
})
export class ModuleFilterSelectComponent {
  options = input.required<{ id: string; title: string }[]>();
  selected = input.required<string>();
  selectionChanged = output<string>();

  activityFilter = input.required<ActivityFilter>();
  activityFilterChanged = output<ActivityFilter>();
  openMenu = signal<OpenMenu>(null);

  selectedModuleLabel = computed(() => {
    if (this.selected() === 'all') return 'All modules';
    return this.options().find((option) => option.id === this.selected())?.title ?? 'All modules';
  });

  selectedStatusLabel = computed(() => {
    if (this.activityFilter() === 'active') return 'Active';
    if (this.activityFilter() === 'inactive') return 'Inactive';
    return 'All';
  });

  toggleMenu(menu: Exclude<OpenMenu, null>, event: Event): void {
    event.stopPropagation();
    this.openMenu.update((current) => current === menu ? null : menu);
  }

  selectModule(value: string, event: Event): void {
    event.stopPropagation();
    this.openMenu.set(null);
    this.selectionChanged.emit(value);
  }

  selectActivity(value: ActivityFilter, event: Event): void {
    event.stopPropagation();
    this.openMenu.set(null);
    this.activityFilterChanged.emit(value);
  }

  optionClass(selected: boolean): string {
    return selected
      ? 'flex w-full items-center rounded-md bg-[var(--color-accent)] px-3 py-2 text-left text-sm font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)]'
      : 'flex w-full items-center rounded-md px-3 py-2 text-left text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-secondary)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-focus-ring)]';
  }
}
