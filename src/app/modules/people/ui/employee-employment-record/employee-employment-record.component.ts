import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { formatTenure } from '../../utils/employee-view.utils';

@Component({
  selector: 'app-employee-employment-record',
  standalone: true,
  imports: [CardComponent, DatePipe],
  template: `
    <app-card title="Employment Record">
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Hire date</dt>
        <dd class="font-medium text-[var(--color-text-primary)]">{{ hireDate() | date: 'dd MMM yyyy' }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Tenure</dt>
        <dd class="font-medium text-[var(--color-text-primary)]">{{ tenure() }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Probation</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="probation">{{ probationLabel() }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Status</dt>
        <dd class="font-medium text-[var(--color-text-primary)]">{{ statusLabel() }}</dd>
      </dl>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentRecordComponent {
  readonly hireDate = input.required<string>();
  readonly probationEndDate = input<string | null>(null);
  readonly status = input.required<string>();

  readonly tenure = computed(() => formatTenure(this.hireDate()));

  readonly probationLabel = computed(() => {
    const end = this.probationEndDate();
    if (!end) return 'Not applicable';
    const endDate = new Date(end);
    if (isNaN(endDate.getTime())) return 'Not applicable';
    return endDate.getTime() <= Date.now()
      ? 'Completed'
      : `Ends ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  });

  readonly statusLabel = computed(() => {
    const s = this.status().trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
  });
}
