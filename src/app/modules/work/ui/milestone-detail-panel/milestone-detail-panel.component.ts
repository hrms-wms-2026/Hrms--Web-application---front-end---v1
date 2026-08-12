import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { MilestoneTreeNode } from '../../models/milestone.model';

const PROGRESS_RADIUS = 28;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  host: { class: 'block h-full flex flex-col' },
  imports: [CardComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, ButtonComponent, AvatarComponent],
  template: `
    @if (loading()) {
      <app-loader label="Loading milestone…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="retry.emit()" />
    } @else if (detail(); as d) {
      <app-card [title]="d.title">
        <div class="flex flex-col gap-3 text-sm">
          <div class="flex items-center gap-2">
            <span style="--color-profile-bg: var(--color-accent); --color-text-primary: white;">
              <app-avatar [userName]="d.ownerName" size="md" />
            </span>
            <span class="text-[var(--color-text-secondary)]">{{ d.ownerName ?? 'Unassigned' }}</span>
          </div>
          @if (d.description) {
            <p class="text-[var(--color-text-secondary)]">{{ d.description }}</p>
          }

          <div class="flex items-center gap-4">
            <div class="relative flex h-16 w-16 shrink-0 items-center justify-center" data-testid="progress-chart">
              <svg viewBox="0 0 64 64" width="64" height="64" class="-rotate-90" aria-hidden="true">
                <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-surface-secondary)" stroke-width="6" />
                <circle
                  cx="32" cy="32" r="28" fill="none" stroke="var(--color-accent)" stroke-width="6" stroke-linecap="round"
                  [attr.stroke-dasharray]="circumference"
                  [attr.stroke-dashoffset]="progressDashOffset(d.progress)"
                />
              </svg>
              <span class="absolute text-xs font-semibold text-[var(--color-text-primary)]">{{ d.progress }}%</span>
            </div>
            <dl class="grid flex-1 grid-cols-2 gap-3">
              <div>
                <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
                <dd>{{ d.startDate }}</dd>
              </div>
              <div>
                <dt class="text-xs text-[var(--color-text-secondary)]">End</dt>
                <dd>{{ d.endDate }}</dd>
              </div>
              <div class="col-span-2">
                <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
                <dd>{{ d.completedHours }} / {{ d.allocatedHours }}</dd>
              </div>
            </dl>
          </div>

          @if (d.isAchieved) {
            <span class="w-fit rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
          @if (d.isOwner) {
            <div class="mt-2 flex flex-wrap gap-2">
              <span data-testid="edit-button">
                <app-button variant="secondary" (pressed)="editRequested.emit()">Edit Module</app-button>
              </span>
              <span data-testid="achieve-button">
                <app-button variant="secondary" (pressed)="achieveToggleRequested.emit()">{{ d.isAchieved ? 'Unachieve Module' : 'Achieve Module' }}</app-button>
              </span>
              <span data-testid="create-sub-button">
                <app-button variant="primary" (pressed)="createSubRequested.emit()">+ Create sub Module</app-button>
              </span>
            </div>
          }
        </div>
      </app-card>
    } @else {
      <app-empty-state title="Select a milestone" description="Click any node in the tree to see its detail here." />
    }
  `
})
export class MilestoneDetailPanelComponent {
  detail = input<MilestoneTreeNode | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  retry = output<void>();
  editRequested = output<void>();
  createSubRequested = output<void>();
  achieveToggleRequested = output<void>();

  readonly circumference = PROGRESS_CIRCUMFERENCE;

  progressDashOffset(progress: number): number {
    const clamped = Math.max(0, Math.min(100, progress));
    return this.circumference * (1 - clamped / 100);
  }
}
