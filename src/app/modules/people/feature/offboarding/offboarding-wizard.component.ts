import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { OffboardingWizardStep, OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import { OffboardingStartStepComponent } from './steps/offboarding-start-step.component';
import { OffboardingChooseChecklistStepComponent } from './steps/offboarding-choose-checklist-step.component';
import { OffboardingReviewTasksStepComponent } from './steps/offboarding-review-tasks-step.component';
import { OffboardingTrackExitWorkStepComponent } from './steps/offboarding-track-exit-work-step.component';
import { OffboardingCompleteOrBypassStepComponent } from './steps/offboarding-complete-or-bypass-step.component';
import { OffboardingCompleteExitStepComponent } from './steps/offboarding-complete-exit-step.component';

export const STEP_ORDER: readonly OffboardingWizardStep[] =
  ['start', 'choose_checklist', 'review_tasks', 'track_exit_work', 'complete_or_bypass', 'complete_exit'];

export const STEP_LABELS: Record<OffboardingWizardStep, string> = {
  start: 'Start Offboarding',
  choose_checklist: 'Choose Exit Checklist',
  review_tasks: 'Review Tasks',
  track_exit_work: 'Track Exit Work',
  complete_or_bypass: 'Complete or Bypass Tasks',
  complete_exit: 'Complete Employee Exit'
};

@Component({
  selector: 'app-offboarding-wizard',
  standalone: true,
  imports: [
    BreadcrumbHeaderComponent, OffboardingStartStepComponent, OffboardingChooseChecklistStepComponent,
    OffboardingReviewTasksStepComponent, OffboardingTrackExitWorkStepComponent,
    OffboardingCompleteOrBypassStepComponent, OffboardingCompleteExitStepComponent
  ],
  template: `
    <app-breadcrumb-header parentLabel="Employees" currentLabel="Offboarding" parentUrl="/people/employees" icon="people" />

    <nav class="ow-steps" aria-label="Offboarding steps">
      @for (step of stepOrder; track step; let i = $index) {
        <span class="ow-steps__chip" [class.ow-steps__chip--active]="step === store.step()" [class.ow-steps__chip--done]="i < stepIndex()">
          {{ i + 1 }}. {{ stepLabels[step] }}
        </span>
      }
    </nav>

    @switch (store.step()) {
      @case ('start') { <app-offboarding-start-step [employeeId]="employeeId()" /> }
      @case ('choose_checklist') { <app-offboarding-choose-checklist-step [employeeId]="employeeId()" /> }
      @case ('review_tasks') { <app-offboarding-review-tasks-step [employeeId]="employeeId()" /> }
      @case ('track_exit_work') { <app-offboarding-track-exit-work-step [employeeId]="employeeId()" /> }
      @case ('complete_or_bypass') { <app-offboarding-complete-or-bypass-step [employeeId]="employeeId()" /> }
      @case ('complete_exit') { <app-offboarding-complete-exit-step [employeeId]="employeeId()" /> }
    }
  `,
  styles: [`
    .ow-steps { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 1rem 0; }
    .ow-steps__chip { font-size: 0.75rem; padding: 0.375rem 0.75rem; border-radius: 999px; background: var(--color-surface-secondary); color: var(--color-text-secondary); }
    .ow-steps__chip--active { background: var(--color-accent); color: white; font-weight: 600; }
    .ow-steps__chip--done { color: var(--color-text-primary); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingWizardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(OffboardingWizardStore);

  readonly stepOrder = STEP_ORDER;
  readonly stepLabels = STEP_LABELS;
  readonly employeeId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly stepIndex = computed(() => this.stepOrder.indexOf(this.store.step()));

  constructor() {
    const id = this.employeeId();
    if (id) {
      void this.store.loadOffboarding(id);
    } else {
      void this.router.navigate(['/people/employees']);
    }
  }
}
