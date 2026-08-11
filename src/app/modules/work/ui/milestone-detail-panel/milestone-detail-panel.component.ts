import { Component, input, output } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ObjectiveDetail } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  imports: [CardComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent],
  template: `
    @if (loading()) {
      <app-loader label="Loading milestone…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="retry.emit()" />
    } @else if (detail(); as d) {
      <app-card [title]="d.title">
        <div class="flex flex-col gap-3 text-sm">
          @if (d.description) {
            <p class="text-[var(--color-text-secondary)]">{{ d.description }}</p>
          }
          <dl class="grid grid-cols-2 gap-3">
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
              <dd>{{ d.startDate }}</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">End</dt>
              <dd>{{ d.endDate }}</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Progress</dt>
              <dd>{{ d.progress }}%</dd>
            </div>
            <div>
              <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
              <dd>{{ d.completedHours }} / {{ d.allocatedHours }}</dd>
            </div>
          </dl>
          @if (d.isAchieved) {
            <span class="w-fit rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Achieved
            </span>
          }
        </div>
      </app-card>
    } @else {
      <app-empty-state title="Select a milestone" description="Click any node in the tree to see its detail here." />
    }
  `
})
export class MilestoneDetailPanelComponent {
  detail = input<ObjectiveDetail | null>(null);
  loading = input(false);
  error = input<string | null>(null);
  retry = output<void>();
}
