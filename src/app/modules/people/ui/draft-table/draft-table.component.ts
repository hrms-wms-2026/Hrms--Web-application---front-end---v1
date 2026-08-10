import { Component, input, output } from '@angular/core';
import { HasPermissionDirective } from '../../../../shared/directives/has-permission.directive';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { DRAFT_REASON_LABELS, DRAFT_STATUS_LABELS, DraftListItemResponse } from '../../models/onboarding-draft.model';

/**
 * Presentational only. Draft status/reason codes are always translated through
 * DRAFT_STATUS_LABELS/DRAFT_REASON_LABELS - the raw snake_case codes never reach the DOM.
 */
@Component({
  selector: 'app-draft-table',
  standalone: true,
  imports: [HasPermissionDirective, EmptyStateComponent],
  template: `
    @if (drafts().length === 0) {
      <app-empty-state title="No drafts" description="Onboarding drafts you save will appear here." />
    } @else {
      <div class="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table class="w-full text-left text-sm">
          <thead class="bg-[var(--color-surface-secondary)] text-xs font-medium text-[var(--color-text-secondary)]">
            <tr>
              <th class="px-4 py-3">Employee name</th>
              <th class="px-4 py-3">Position</th>
              <th class="px-4 py-3">Department</th>
              <th class="px-4 py-3">Draft status</th>
              <th class="px-4 py-3">Reason</th>
              <th class="px-4 py-3">Last saved step</th>
              <th class="px-4 py-3">Started by</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[var(--color-border)]">
            @for (draft of drafts(); track draft.id) {
              <tr>
                <td class="px-4 py-3 font-medium text-[var(--color-text-primary)]">{{ draft.employeeName }}</td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ draft.positionName || '—' }}</td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ draft.departmentName || '—' }}</td>
                <td class="px-4 py-3">
                  <span class="rounded-full bg-[var(--color-surface-secondary)] px-2 py-0.5 text-xs">
                    {{ statusLabels[draft.status] }}
                  </span>
                </td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">
                  {{ draft.draftReason ? reasonLabels[draft.draftReason] : '—' }}
                </td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ stepLabel(draft.lastSavedStep) }}</td>
                <td class="px-4 py-3 text-[var(--color-text-secondary)]">{{ draft.startedByName }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    *appHasPermission="'employees:write'"
                    type="button"
                    class="text-sm font-medium text-[var(--color-accent)] hover:underline"
                    (click)="continueDraft.emit(draft.id)"
                  >
                    Continue Draft
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `
})
export class DraftTableComponent {
  drafts = input.required<readonly DraftListItemResponse[]>();
  continueDraft = output<string>();

  readonly statusLabels = DRAFT_STATUS_LABELS;
  readonly reasonLabels = DRAFT_REASON_LABELS;

  stepLabel(step: string): string {
    return step
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
