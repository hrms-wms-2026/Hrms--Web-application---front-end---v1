import { Component, input, output } from '@angular/core';
import { AvatarStackComponent } from '../../../../shared/ui/avatar-stack/avatar-stack.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Project } from '../../models/project.model';
import { MemberButtonComponent } from '../member-button/member-button.component';

@Component({
  selector: 'app-project-explanation-card',
  standalone: true,
  imports: [AvatarStackComponent, ButtonComponent, CardComponent, MemberButtonComponent],
  template: `
    <app-card>
      <div data-testid="project-explanation-card" class="flex flex-col gap-3 p-1">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h2 class="truncate text-base font-semibold text-[var(--color-text-primary)]">{{ project().name }}</h2>
            <p class="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">{{ project().identifier }}</p>
          </div>
          @if (project().isLead) {
            <div class="flex items-center gap-1">
              <app-member-button [memberCount]="project().memberCount" (pressed)="membersRequested.emit()" />
              <span data-testid="settings-button">
                <button
                  type="button"
                  class="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
                  aria-label="Project settings"
                  (click)="settingsRequested.emit()"
                >
                  <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.75" />
                    <circle cx="12" cy="12" r="1.75" />
                    <circle cx="12" cy="19" r="1.75" />
                  </svg>
                </button>
              </span>
            </div>
          }
        </div>

        @if (project().description; as description) {
          <p data-testid="explanation-description" class="text-xs leading-relaxed text-[var(--color-text-secondary)]">{{ description }}</p>
        }

        <dl class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt class="text-[10px] text-[var(--color-text-secondary)]">Start</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ project().startDate }}</dd>
          </div>
          <div>
            <dt class="text-[10px] text-[var(--color-text-secondary)]">Target</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ project().targetDate }}</dd>
          </div>
          <div>
            <dt class="text-[10px] text-[var(--color-text-secondary)]">Allocated</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ project().allocatedHours }}h</dd>
          </div>
          <div>
            <dt class="text-[10px] text-[var(--color-text-secondary)]">Completed</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ project().completedHours }}h</dd>
          </div>
        </dl>

        @if (project().members.length > 0) {
          <app-avatar-stack [members]="project().members" [totalCount]="project().memberCount" [maxVisible]="6" size="sm" />
        }

        <div class="mt-1 flex flex-wrap justify-end gap-2">
          @if (project().isLead && !project().isAchieved) {
            <span data-testid="achieve-button">
              <app-button variant="secondary" (pressed)="achieveRequested.emit()">Achieve project</app-button>
            </span>
          }
          <span data-testid="view-button">
            <app-button variant="primary" (pressed)="viewed.emit()">View project</app-button>
          </span>
        </div>
      </div>
    </app-card>
  `
})
export class ProjectExplanationCardComponent {
  project = input.required<Project>();
  viewed = output<void>();
  achieveRequested = output<void>();
  settingsRequested = output<void>();
  membersRequested = output<void>();
}
