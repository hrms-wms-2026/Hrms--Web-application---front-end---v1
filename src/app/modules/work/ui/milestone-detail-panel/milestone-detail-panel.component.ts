import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ProgressRingComponent } from '../../../../shared/ui/progress-ring/progress-ring.component';
import { MilestoneTreeNode } from '../../models/milestone.model';
import { getDeadlineStatus } from '../../utils/deadline.util';

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  host: { class: 'block h-full flex flex-col' },
  imports: [
    CardComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent,
    ButtonComponent, AvatarComponent, ProgressRingComponent
  ],
  template: `
    @if (loading()) {
      <app-loader label="Loading milestone…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="retry.emit()" />
    } @else if (detail(); as d) {
      <app-card>
        <div class="flex flex-col gap-4 text-sm p-1">
          <!-- Title & Achieved Badge -->
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
            <h2 class="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{{ d.title }}</h2>
            @if (d.isAchieved) {
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600/20">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Achieved
              </span>
            }
          </div>

          <!-- Owner Capsule -->
          <div class="flex items-center gap-2.5">
            <span style="--color-profile-bg: var(--color-accent); --color-text-primary: white;" class="inline-flex rounded-lg ring-1 ring-white/90">
              <app-avatar [userName]="d.ownerName" size="sm" />
            </span>
            <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ d.ownerName ?? 'Unassigned' }}</span>
          </div>

          @if (d.description) {
            <p class="text-xs leading-relaxed text-[var(--color-text-secondary)]">{{ d.description }}</p>
          }

          <!-- Progress Ring & Details Cards -->
          <div class="flex items-center gap-5 pt-1">
            <div data-testid="progress-chart" class="shrink-0 flex items-center justify-center">
              <app-progress-ring [progress]="d.progress" [size]="96" [strokeWidth]="9" [gradient]="true" />
            </div>
            <dl class="grid flex-1 grid-cols-2 gap-2.5">
              <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2.5">
                <dt class="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  Start
                </dt>
                <dd class="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">{{ d.startDate }}</dd>
              </div>
              <div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2.5">
                <dt class="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  End
                </dt>
                <dd class="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">{{ d.endDate }}</dd>
                @if (!d.isAchieved && deadline(d.endDate); as dl) {
                  <dd
                    data-testid="deadline"
                    class="mt-0.5 text-[10px] font-medium"
                    [class.text-[var(--color-danger-text)]]="dl.overdue"
                    [class.text-[var(--color-text-secondary)]]="!dl.overdue"
                  >{{ dl.label }}</dd>
                }
              </div>
              <div class="col-span-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-secondary)]/40 p-2.5">
                <dt class="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <polyline points="12 7 12 12 15 14" />
                  </svg>
                  Hours
                </dt>
                <dd class="mt-0.5 text-xs font-semibold text-[var(--color-text-primary)]">{{ d.completedHours }} / {{ d.allocatedHours }}</dd>
              </div>
            </dl>
          </div>

          <!-- Actions Row (Clean & Modern: Edit | Achieve | + Create sub) -->
          @if (d.isOwner) {
            <div data-testid="action-row" class="mt-2 flex flex-nowrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
              <span data-testid="edit-button" class="flex-1">
                <app-button variant="secondary" size="sm" class="w-full" (pressed)="editRequested.emit()">Edit</app-button>
              </span>
              <span data-testid="achieve-button" class="flex-1">
                <app-button variant="secondary" size="sm" class="w-full" (pressed)="achieveToggleRequested.emit()">{{ d.isAchieved ? 'Unachieve' : 'Achieve' }}</app-button>
              </span>
              <span data-testid="create-sub-button" class="flex-1">
                <app-button variant="primary" size="sm" class="w-full" (pressed)="createSubRequested.emit()">+ Create sub</app-button>
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

  deadline(endDate: string) {
    return getDeadlineStatus(endDate);
  }
}
