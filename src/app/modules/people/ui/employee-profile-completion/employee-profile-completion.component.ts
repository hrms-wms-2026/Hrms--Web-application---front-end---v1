import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ProgressRingComponent } from '../../../../shared/ui/progress-ring/progress-ring.component';
import { ProfileCompletion } from '../../utils/employee-detail.utils';

/** Profile completion ring and per-section checklist for the employee Personal tab. */
@Component({
  selector: 'app-employee-profile-completion',
  standalone: true,
  imports: [ProgressRingComponent],
  template: `
    <section class="completion" aria-labelledby="profile-completion-heading">
      <div class="completion__summary">
        <app-progress-ring [progress]="completion().percent" [size]="72" [strokeWidth]="7" />
        <div class="min-w-0 flex-1">
          <h3 id="profile-completion-heading" class="text-base font-semibold text-[var(--color-text-primary)]">Profile Completion</h3>
          <p class="text-sm text-[var(--color-text-secondary)]" data-testid="profile-completion-text">
            Profile is {{ completion().percent }}% complete.
          </p>
        </div>
      </div>
      <ul class="completion__items">
        @for (item of completion().items; track item.label) {
          <li [attr.data-complete]="item.complete">
            <span class="completion__dot" [class.completion__dot--done]="item.complete" aria-hidden="true">
              @if (item.complete) {
                <svg viewBox="0 0 16 16" width="10" height="10"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
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
    .completion { border: 1px solid var(--color-border); border-radius: 0.75rem; background: var(--color-surface); padding: 1.25rem; }
    .completion__summary { display: flex; align-items: center; gap: 1rem; padding-bottom: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--color-border); }
    .completion__items { display: flex; flex-direction: column; gap: 0.625rem; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; color: var(--color-text-primary); }
    .completion__items li { display: flex; align-items: center; gap: 0.625rem; }
    .completion__dot { display: inline-flex; align-items: center; justify-content: center; width: 1.125rem; height: 1.125rem; border-radius: 9999px; border: 1.5px solid var(--color-border); color: #fff; flex-shrink: 0; }
    .completion__dot--done { background: #16a34a; border-color: #16a34a; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeProfileCompletionComponent {
  readonly completion = input.required<ProfileCompletion>();
}
