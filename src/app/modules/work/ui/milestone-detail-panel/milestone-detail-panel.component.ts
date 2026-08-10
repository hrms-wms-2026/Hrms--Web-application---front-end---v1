import { Component, input, output } from '@angular/core';
import { ObjectiveDetail } from '../../models/milestone.model';

@Component({
  selector: 'app-milestone-detail-panel',
  standalone: true,
  template: `
    @if (milestone(); as milestone) {
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-sm font-semibold text-[var(--color-text-primary)]">{{ milestone.title }}</h3>
        @if (milestone.isOwner) {
          <button
            type="button"
            data-testid="settings-button"
            class="rounded-md p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
            aria-label="Milestone settings"
            (click)="settingsRequested.emit()"
          >⚙</button>
        }
      </div>
      <p class="mt-1 text-xs text-[var(--color-text-secondary)]">{{ milestone.ownerName ?? '—' }}</p>
      <dl class="mt-3 grid grid-cols-[100px_1fr] gap-y-1.5 text-xs">
        <dt class="text-[var(--color-text-secondary)]">Reporting Mgr</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.reportingManagerName ?? '—' }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Start</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.startDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">End</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.endDate }}</dd>
        <dt class="text-[var(--color-text-secondary)]">Hours</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.completedHours }} / {{ milestone.allocatedHours }}h</dd>
        <dt class="text-[var(--color-text-secondary)]">Progress</dt>
        <dd class="text-[var(--color-text-primary)]">{{ milestone.progress }}%</dd>
      </dl>
      <span class="mt-3 inline-block rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
        {{ milestone.isAchieved ? 'Achieved' : 'Not achieved' }}
      </span>
    } @else {
      <p class="text-sm text-[var(--color-text-secondary)]">Select a milestone to see its detail.</p>
    }
  `
})
export class MilestoneDetailPanelComponent {
  milestone = input<ObjectiveDetail | null>(null);
  settingsRequested = output<void>();
}
