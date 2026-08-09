import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CardComponent, ButtonComponent],
  template: `
    <app-card [title]="project().name">
      <div class="flex items-center justify-between">
        <p class="text-xs text-[var(--color-text-secondary)]">{{ project().identifier }}</p>
        @if (project().isAchieved) {
          <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
            Achieved
          </span>
        }
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Start</dt>
        <dd>{{ project().startDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Target</dt>
        <dd>{{ project().targetDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Hours</dt>
        <dd>{{ project().completedHours }} / {{ project().allocatedHours }}</dd>
      </dl>
      <div class="mt-4 flex gap-2">
        <span data-testid="view-button">
          <app-button variant="secondary" (pressed)="viewed.emit()">View</app-button>
        </span>
        @if (project().isLead) {
          <span data-testid="edit-button">
            <app-button variant="secondary" (pressed)="edited.emit()">Edit</app-button>
          </span>
          <span data-testid="achieve-button">
            <app-button variant="primary" (pressed)="achieveToggled.emit()">
              {{ project().isAchieved ? 'Unachieve' : 'Achieve' }}
            </app-button>
          </span>
        }
      </div>
    </app-card>
  `
})
export class ProjectCardComponent {
  project = input.required<Project>();
  viewed = output<void>();
  edited = output<void>();
  achieveToggled = output<void>();
}
