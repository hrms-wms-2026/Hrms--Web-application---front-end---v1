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
    <div class="obs-step-container">
      <div class="obs-step-header">
        <h3 class="obs-step-title">Track Exit Work & Progress</h3>
        <p class="obs-step-subtitle">Monitor offboarding completion rates across asset returns, access removals, and document handovers.</p>
      </div>

      <div class="obs-progress-box">
        <div class="obs-progress-box__header">
          <span class="obs-progress-box__title">Overall Exit Resolution</span>
          <span class="obs-progress-box__pct">{{ overallPercent() }}% complete</span>
        </div>
        <div class="obs-progress-bar">
          <div class="obs-progress-bar__fill" [style.width.%]="overallPercent()"></div>
        </div>
      </div>

      <div class="obs-category-grid">
        @for (row of categoryProgress(); track row.category) {
          <div class="obs-category-card">
            <span class="obs-category-card__name">{{ row.category }}</span>
            <span class="obs-category-card__stat" [class.obs-category-card__stat--done]="row.resolved === row.total && row.total > 0">
              {{ row.resolved }} / {{ row.total }} Completed
            </span>
          </div>
        }
      </div>

      <div class="obs-actions">
        <app-button variant="primary" (pressed)="store.goToStep('complete_or_bypass')">
          Continue to Task Resolution
        </app-button>
      </div>
    </div>
  `,
  styles: [`
    .obs-step-container {
      max-width: 44rem;
    }
    .obs-step-header {
      margin-bottom: 1.25rem;
    }
    .obs-step-title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-step-subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .obs-progress-box {
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      background: color-mix(in srgb, var(--color-primary) 3%, var(--color-surface));
      border: 1px solid color-mix(in srgb, var(--color-primary) 25%, var(--color-border));
      border-radius: 12px;
    }
    .obs-progress-box__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.625rem;
    }
    .obs-progress-box__title {
      font-size: 0.875rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .obs-progress-box__pct {
      font-size: 0.825rem;
      font-weight: 750;
      color: var(--color-primary);
    }
    .obs-progress-bar {
      height: 0.625rem;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--color-border) 60%, transparent);
      overflow: hidden;
    }
    .obs-progress-bar__fill {
      height: 100%;
      background: var(--color-primary);
      border-radius: 9999px;
      transition: width 0.3s ease;
    }
    .obs-category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
      gap: 0.875rem;
      margin-bottom: 1.5rem;
    }
    .obs-category-card {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 0.875rem 1rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 10px;
    }
    .obs-category-card__name {
      font-size: 0.825rem;
      font-weight: 650;
      color: var(--color-text-primary);
    }
    .obs-category-card__stat {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--color-text-secondary);
    }
    .obs-category-card__stat--done {
      color: #16a34a;
    }
    .obs-actions {
      display: flex;
      justify-content: flex-end;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingTrackExitWorkStepComponent {
  readonly employeeId = input.required<string>();
  readonly store = inject(OffboardingWizardStore);

  readonly categoryProgress = computed(() => groupTasksByCategory(this.store.tasks()));
  readonly overallPercent = computed(() => overallProgressPercent(this.store.tasks()));
}
