import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Milestone } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
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
        @if (milestone().isOwner) {
          <span data-testid="edit-button">
            <app-button variant="secondary" (pressed)="editRequested.emit()">Edit</app-button>
          </span>
          <span data-testid="achieve-button">
            <app-button variant="primary" (pressed)="achieveToggled.emit()">
              {{ milestone().isAchieved ? 'Unachieve' : 'Achieve' }}
            </app-button>
          </span>
        }
      </div>
    </app-card>
  `
})
export class MilestoneCardComponent {
  milestone = input.required<Milestone>();
  viewed = output<void>();
  editRequested = output<void>();
  achieveToggled = output<void>();
}
