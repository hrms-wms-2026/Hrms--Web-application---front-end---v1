import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { ChecklistTaskCategory, EmployeeChecklistTaskResponse } from '../../../models/offboarding.model';
import { OffboardingWizardStore } from '../../../state/offboarding-wizard.store';

const CATEGORY_LABELS: Record<ChecklistTaskCategory, string> = {
  asset_return: 'Assets Returned', access_removal: 'Access Removed', document_handover: 'Documents Handover',
  final_settlement: 'Final Settlement', knowledge_handover: 'Knowledge Handover', other: 'Other'
};

export interface CategoryProgress {
  readonly category: string;
  readonly total: number;
  readonly resolved: number;
}

export function groupTasksByCategory(tasks: readonly EmployeeChecklistTaskResponse[]): readonly CategoryProgress[] {
  const byCategory = new Map<string, EmployeeChecklistTaskResponse[]>();
  for (const task of tasks) {
    const key = task.category ?? 'other';
    byCategory.set(key, [...(byCategory.get(key) ?? []), task]);
  }
  return [...byCategory.entries()].map(([category, categoryTasks]) => ({
    category: CATEGORY_LABELS[category as ChecklistTaskCategory] ?? category,
    total: categoryTasks.length,
    resolved: categoryTasks.filter((t) => t.status === 'completed' || t.status === 'bypassed').length
  }));
}

export function overallProgressPercent(tasks: readonly EmployeeChecklistTaskResponse[]): number {
  if (tasks.length === 0) return 100;
  const resolved = tasks.filter((t) => t.status === 'completed' || t.status === 'bypassed').length;
  return Math.round((resolved / tasks.length) * 100);
}

@Component({
  selector: 'app-offboarding-track-exit-work-step',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="mb-4">
      <div class="h-2 rounded-full bg-[var(--color-surface-secondary)] overflow-hidden">
        <div class="h-full bg-[var(--color-accent)]" [style.width.%]="overallPercent()"></div>
      </div>
      <p class="text-xs text-[var(--color-text-secondary)] mt-1">{{ overallPercent() }}% complete</p>
    </div>
    <div class="space-y-2">
      @for (row of categoryProgress(); track row.category) {
        <div class="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
          <span class="text-sm font-medium">{{ row.category }}</span>
          <span class="text-xs text-[var(--color-text-secondary)]">{{ row.resolved }} / {{ row.total }}</span>
        </div>
      }
    </div>
    <app-button variant="primary" class="mt-4" (pressed)="store.goToStep('complete_or_bypass')">
      Continue
    </app-button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingTrackExitWorkStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  readonly categoryProgress = computed(() => groupTasksByCategory(this.store.tasks()));
  readonly overallPercent = computed(() => overallProgressPercent(this.store.tasks()));
}
