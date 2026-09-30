import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressRingComponent } from '../../../../shared/ui/progress-ring/progress-ring.component';
import { ProfileCompletion } from '../../utils/employee-detail.utils';
import { DetailIconComponent } from '../detail-kit/detail-icon.component';
import { SegmentedBarComponent } from '../detail-kit/segmented-bar.component';

/** Profile completion ring, progress bar and per-section checklist for the employee Personal tab. */
@Component({
  selector: 'app-employee-profile-completion',
  standalone: true,
  imports: [ProgressRingComponent, DetailIconComponent, SegmentedBarComponent],
  template: `
    <section class="completion" aria-labelledby="profile-completion-heading">
      <div class="completion__summary">
        <app-progress-ring [progress]="completion().percent" [size]="80" [strokeWidth]="8" />
        <div class="min-w-0 flex-1">
          <h3 id="profile-completion-heading" class="completion__title">Profile Completion</h3>
          <p class="completion__text" data-testid="profile-completion-text">
            Profile is {{ completion().percent }}% complete.
          </p>
          <app-segmented-bar
            class="mt-2.5 block"
            [segments]="[{ value: completion().percent, tone: 'success', label: 'Complete' }]"
            [total]="100"
            [height]="8"
          />
        </div>
      </div>
      <ul class="completion__items">
        @for (item of completion().items; track item.label) {
          <li [attr.data-complete]="item.complete">
            <span class="completion__dot" [class.completion__dot--done]="item.complete" aria-hidden="true">
              @if (item.complete) {
                <app-detail-icon name="check" [size]="12" [strokeWidth]="3" />
              }
            </span>
            <span>{{ item.label }}</span>
            <span class="sr-only">{{ item.complete ? '(complete)' : '(incomplete)' }}</span>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`
    .completion {
      border: 1px solid var(--color-border); border-radius: 0.875rem; background: var(--color-surface); padding: 1.25rem;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
    }
    .completion__summary { display: flex; align-items: center; gap: 1.25rem; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
    .completion__title { margin: 0; font-size: 1.0625rem; font-weight: 600; color: var(--color-text-primary); }
    .completion__text { margin: 0.25rem 0 0; font-size: 0.875rem; color: var(--color-text-secondary); }
    .completion__items { display: flex; flex-direction: column; gap: 0.625rem; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: var(--color-text-primary); }
    .completion__items li { display: flex; align-items: center; gap: 0.75rem; }
    .completion__dot {
      display: inline-flex; align-items: center; justify-content: center; width: 1.25rem; height: 1.25rem; border-radius: 9999px;
      border: 1.5px solid #b8c2d3; color: #fff; flex-shrink: 0;
    }
    .completion__dot--done { background: #16a34a; border-color: #16a34a; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeProfileCompletionComponent {
  readonly completion = input.required<ProfileCompletion>();
}
