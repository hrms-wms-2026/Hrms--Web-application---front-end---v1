import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-card',
  standalone: true,
  imports: [CardComponent],
  template: `
    <div
      data-testid="milestone-card"
      class="relative cursor-pointer rounded-lg transition-shadow"
      [class.ring-2]="selected()"
      [class.ring-[var(--color-focus-ring)]]="selected()"
      (click)="viewed.emit()"
    >
      @if (milestone().isOwner) {
        <span data-testid="settings-button" class="absolute right-2 top-2 z-10">
          <button
            type="button"
            class="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Milestone settings"
            (click)="onSettingsClick($event)"
          >⚙</button>
        </span>
      }
      <app-card [title]="milestone().title">
        <div class="flex items-center justify-between">
          <p class="text-xs text-[var(--color-text-secondary)]">{{ milestone().ownerName }}</p>
          @if (milestone().isAchieved) {
            <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
        </div>
        <p class="mt-2 text-sm text-[var(--color-text-secondary)]">
          {{ milestone().completedHours }} / {{ milestone().allocatedHours }}h
        </p>
      </app-card>
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
