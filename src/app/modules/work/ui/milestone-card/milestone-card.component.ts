import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <div class="relative">
      @if (milestone().isOwner) {
        <span data-testid="settings-button" class="absolute right-2 top-2 z-10">
          <button
            type="button"
            class="rounded-md p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Milestone settings"
            (click)="settingsRequested.emit()"
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
        <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt class="text-[var(--color-text-secondary)]">Start</dt>
          <dd>{{ milestone().startDate }}</dd>
          <dt class="text-[var(--color-text-secondary)]">End</dt>
          <dd>{{ milestone().endDate }}</dd>
          <dt class="text-[var(--color-text-secondary)]">Hours</dt>
          <dd>{{ milestone().completedHours }} / {{ milestone().allocatedHours }}</dd>
        </dl>
        <div class="mt-4 flex gap-2">
          <span data-testid="view-button">
            <app-button variant="secondary" (pressed)="viewed.emit()">View</app-button>
          </span>
        </div>
      </app-card>
    </div>
  `
})
export class MilestoneCardComponent {
  milestone = input.required<Milestone>();
  viewed = output<void>();
  settingsRequested = output<void>();
}
