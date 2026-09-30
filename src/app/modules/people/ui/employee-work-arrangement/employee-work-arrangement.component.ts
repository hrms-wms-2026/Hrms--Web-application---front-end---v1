import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';

/** Time zone and schedule are deliberately absent: no per-employee source exists yet (spec §3). */
@Component({
  selector: 'app-employee-work-arrangement',
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card title="Work Arrangement">
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Work mode</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="value">{{ workModeLabel() || '—' }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Legal entity</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="value">{{ legalEntityName() || '—' }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Primary location</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="value">{{ primaryLocation() }}</dd>
      </dl>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkArrangementComponent {
  readonly workModeLabel = input<string | null>(null);
  readonly legalEntityName = input<string | null>(null);
  readonly primaryLocation = input.required<string>();
}
