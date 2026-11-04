import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { StartOffboardingModalComponent } from '../../ui/start-offboarding-modal/start-offboarding-modal.component';
import { EmployeeDirectoryStore } from '../../../work/state/employee-directory.store';
import { OffboardingWizardStep, OffboardingWizardStore, offboardingStepsFor } from '../../state/offboarding-wizard.store';
import { OffboardingChooseChecklistStepComponent } from './steps/offboarding-choose-checklist-step.component';
import { OffboardingReviewTasksStepComponent } from './steps/offboarding-review-tasks-step.component';
import { OffboardingTrackExitWorkStepComponent } from './steps/offboarding-track-exit-work-step.component';
import { OffboardingCompleteOrBypassStepComponent } from './steps/offboarding-complete-or-bypass-step.component';
import { OffboardingCompleteExitStepComponent } from './steps/offboarding-complete-exit-step.component';

export const STEP_LABELS: Record<OffboardingWizardStep, string> = {
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
    BreadcrumbHeaderComponent, ButtonComponent, EmptyStateComponent, LoaderComponent, StartOffboardingModalComponent,
    OffboardingChooseChecklistStepComponent,
    OffboardingReviewTasksStepComponent, OffboardingTrackExitWorkStepComponent,
    OffboardingCompleteOrBypassStepComponent, OffboardingCompleteExitStepComponent
  ],
  template: `
    <header class="ow-page-header">
      <app-breadcrumb-header parentLabel="Offboarding" [currentLabel]="employeeName()" parentUrl="/people/offboarding" icon="people" />
    </header>

    @if (!store.record() && store.loading()) {
      <app-loader label="Loading offboarding…" />
    } @else if (!hasOpenOffboarding()) {
      <app-empty-state
        title="This employee isn't being offboarded"
        description="Start an offboarding to set the exit details, then choose their exit checklist."
      />
      <div class="ow-empty-action">
        <app-button variant="primary" data-testid="wizard-start-offboarding" (pressed)="startOpen.set(true)">+ Start Offboarding</app-button>
      </div>
      <app-start-offboarding-modal
        [open]="startOpen()"
        [employeeId]="employeeId()"
        (closed)="startOpen.set(false)"
      />
    } @else {
      <nav class="ow-step-flow" aria-label="Offboarding progress steps">
        @for (step of stepOrder(); track step; let i = $index) {
          <div
            class="ow-step-flow__item"
            [class.ow-step-flow__item--active]="step === store.step()"
            [class.ow-step-flow__item--completed]="i < stepIndex()"
          >
            <span class="ow-step-flow__number">
              @if (i < stepIndex()) {
                ✓
              } @else {
                {{ i + 1 }}
              }
            </span>
            <span class="ow-step-flow__label">{{ stepLabels[step] }}</span>
          </div>
          @if (i < stepOrder().length - 1) {
            <div class="ow-step-flow__divider"></div>
          }
        }
      </nav>

      <main class="ow-step-content">
        @switch (store.step()) {
          @case ('choose_checklist') { <app-offboarding-choose-checklist-step [employeeId]="employeeId()" /> }
          @case ('review_tasks') { <app-offboarding-review-tasks-step [employeeId]="employeeId()" /> }
          @case ('track_exit_work') { <app-offboarding-track-exit-work-step [employeeId]="employeeId()" /> }
          @case ('complete_or_bypass') { <app-offboarding-complete-or-bypass-step [employeeId]="employeeId()" /> }
          @case ('complete_exit') { <app-offboarding-complete-exit-step [employeeId]="employeeId()" /> }
        }
      </main>
    }
  `,
  styles: [`
    .ow-page-header {
      margin-top: -1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border);
    }
    .ow-step-flow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
      padding: 0.875rem 1.25rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
      overflow-x: auto;
    }
    .ow-step-flow__item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--color-text-secondary);
      font-size: 0.8125rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .ow-step-flow__number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 1.625rem;
      height: 1.625rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-border) 60%, transparent);
      color: var(--color-text-secondary);
      font-size: 0.75rem;
      font-weight: 700;
      transition: all 0.2s ease;
    }
    .ow-step-flow__item--active {
      color: var(--color-text-primary);
      font-weight: 650;
    }
    .ow-step-flow__item--active .ow-step-flow__number {
      background: var(--color-primary);
      color: var(--color-text-on-solid);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent);
    }
    .ow-step-flow__item--completed {
      color: var(--color-text-primary);
    }
    .ow-step-flow__item--completed .ow-step-flow__number {
      background: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface));
      color: var(--color-primary);
    }
    .ow-step-flow__divider {
      flex: 1;
      min-width: 0.75rem;
      height: 2px;
      margin: 0 0.5rem;
      background: color-mix(in srgb, var(--color-border) 60%, transparent);
      border-radius: 1px;
    }
    .ow-empty-action {
      display: flex;
      justify-content: center;
      margin-top: 1rem;
    }
    .ow-step-content {
      padding: 1.5rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 14px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingWizardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly store = inject(OffboardingWizardStore);
  private readonly directory = inject(EmployeeDirectoryStore);

  /** Without a checklist, the Review Tasks and Complete or Bypass steps are left out. */
  readonly stepOrder = computed(() => offboardingStepsFor(this.store.record()));
  readonly stepLabels = STEP_LABELS;
  readonly employeeId = computed(() => this.route.snapshot.paramMap.get('id') ?? '');
  readonly stepIndex = computed(() => this.stepOrder().indexOf(this.store.step()));
  /** A cancelled (or missing) record means there is nothing to continue - offer to start one instead. */
  readonly hasOpenOffboarding = computed(() => {
    const record = this.store.record();
    return !!record && record.status !== 'cancelled';
  });
  readonly startOpen = signal(false);
  /** Breadcrumb: Offboarding > {employee}. */
  readonly employeeName = computed(() => {
    const name = this.directory.byId()[this.employeeId()]?.name;
    return name && name !== 'Unknown employee' ? name : 'Employee';
  });

  constructor() {
    const id = this.employeeId();
    if (id) {
      void this.directory.ensureLoaded([id]);
      // The store is app-wide; clear the previous employee's state before loading this one.
      this.store.reset();
      void this.store.loadOffboarding(id);
    } else {
      void this.router.navigate(['/people/employees']);
    }
  }
}
