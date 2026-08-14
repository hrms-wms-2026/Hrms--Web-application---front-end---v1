import { Component, input, output } from '@angular/core';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-card',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [],
  template: `
    <div
      data-testid="milestone-card"
      class="relative flex h-14 w-full flex-col justify-between cursor-pointer rounded-xl border px-3 py-2 transition-all duration-200"
      [class.bg-[var(--color-accent)]]="selected()"
      [class.border-[var(--color-accent)]]="selected()"
      [class.shadow-md]="selected()"
      [class.bg-[var(--color-surface)]]="!selected()"
      [class.border-[var(--color-border)]]="!selected()"
      [class.shadow-sm]="!selected()"
      [class.hover:shadow-md]="!selected()"
      (click)="viewed.emit()"
    >
      <!-- Top row: title + settings icon -->
      <div class="flex items-center justify-between gap-1">
        <h3
          class="text-sm font-semibold leading-snug pr-1 transition-colors truncate"
          [class.text-white]="selected()"
          [class.text-[var(--color-text-primary)]]="!selected()"
          [title]="milestone().title"
        >
          {{ milestone().title }}
        </h3>
        @if (milestone().isOwner) {
          <span data-testid="settings-button" class="shrink-0">
            <button
              type="button"
              class="flex items-center justify-center rounded-md p-0.5 transition-colors"
              [class.text-white]="selected()"
              [class.text-[var(--color-text-secondary)]]="!selected()"
              [class.hover:bg-[var(--color-surface-secondary)]]="!selected()"
              aria-label="Module settings"
              (click)="onSettingsClick($event)"
            >
              <!-- Vertical ellipsis (three dots) -->
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"/>
                <circle cx="12" cy="12" r="1.5"/>
                <circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
          </span>
        }
      </div>

      <!-- Bottom: owner + hours -->
      <div class="flex items-center justify-between gap-1 text-[11px] leading-none">
        <p
          class="truncate transition-colors"
          [class.text-blue-100]="selected()"
          [class.text-[var(--color-text-secondary)]]="!selected()"
        >
          {{ milestone().ownerName }}
        </p>
        <p
          class="font-medium shrink-0 transition-colors"
          [class.text-white]="selected()"
          [class.text-[var(--color-text-primary)]]="!selected()"
        >
          {{ milestone().completedHours }}/{{ milestone().allocatedHours }}h
        </p>
      </div>
    </div>
  `
})
export class MilestoneCardComponent {
  milestone = input.required<Milestone>();
  selected = input(false);
  viewed = output<void>();
  settingsRequested = output<void>();

  onSettingsClick(event: Event): void {
    event.stopPropagation();
    this.settingsRequested.emit();
  }
}
