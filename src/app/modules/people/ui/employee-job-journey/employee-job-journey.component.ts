import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';

@Component({
  selector: 'app-employee-job-journey',
  standalone: true,
  template: `
    <div class="space-y-4">
      <h3 class="text-base font-semibold text-[var(--color-text-primary)]">
        Employment History
      </h3>

      @if (entries().length === 0) {
        <p class="text-xs text-[var(--color-text-secondary)]">No position history entries recorded yet.</p>
      } @else {
        <div class="relative pl-6 border-l-2 border-[var(--color-border)] space-y-5 ml-2.5 my-2">
          @for (entry of entries(); track $index) {
            <div data-testid="journey-entry" class="relative group">
              <!-- Timeline Node Dot -->
              <span class="absolute -left-[1.9375rem] top-1 w-3.5 h-3.5 rounded-full bg-[var(--color-accent)] ring-4 ring-[var(--color-surface)]"></span>

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-sm text-[var(--color-text-primary)]">{{ entry.positionName }}</span>
                  @if (entry.changeReason) {
                    <span class="rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] px-2.5 py-0.5 text-xs font-medium border border-[var(--color-border)]">
                      {{ entry.changeReason }}
                    </span>
                  }
                </div>
                <span class="text-xs font-medium text-[var(--color-text-secondary)]">
                  {{ entry.effectiveFrom }} – {{ entry.effectiveTo || 'Present' }}
                </span>
              </div>

              <p class="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {{ entry.departmentName || 'No department' }}
                · Changed by {{ entry.initiatedByName }}
                @if (entry.approvedByName) {
                  · Approved by {{ entry.approvedByName }}
                }
              </p>
            </div>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobJourneyComponent {
  readonly entries = input.required<readonly PositionHistoryEntryResponse[]>();
}
