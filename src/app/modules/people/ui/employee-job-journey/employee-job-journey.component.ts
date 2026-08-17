import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';

@Component({
  selector: 'app-employee-job-journey',
  standalone: true,
  template: `
    <ol class="flex flex-col gap-3">
      @for (entry of entries(); track $index) {
        <li data-testid="journey-entry" class="rounded-lg border border-[var(--color-border)] p-3 text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium">{{ entry.positionName }}</span>
            @if (entry.changeReason) {
              <span class="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-xs">{{ entry.changeReason }}</span>
            }
          </div>
          <p class="text-[var(--color-text-secondary)]">{{ entry.departmentName || '—' }}</p>
          <p class="text-xs text-[var(--color-text-secondary)]">{{ entry.effectiveFrom }} – {{ entry.effectiveTo || 'Present' }}</p>
          <p class="text-xs text-[var(--color-text-secondary)]">
            Changed by {{ entry.initiatedByName }}
            @if (entry.approvedByName) {
              · Approved by {{ entry.approvedByName }}
            }
          </p>
        </li>
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeJobJourneyComponent {
  readonly entries = input.required<readonly PositionHistoryEntryResponse[]>();
}
