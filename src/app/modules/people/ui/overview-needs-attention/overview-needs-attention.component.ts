import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  EmployeeSignal,
  EmployeeSignalCategory,
  EmployeeSignalSeverity
} from '../../models/employee-overview.model';
import { Delta } from '../../utils/employee-overview.utils';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

@Component({
  selector: 'app-overview-needs-attention',
  standalone: true,
  imports: [DeltaBadgeComponent],
  template: `
    @if (signals().length > 0) {
      <div
        data-testid="needs-attention"
        class="rounded-2xl border border-[#fef08a] bg-[#fefce8] p-5"
      >
        <div class="mb-2 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700" aria-hidden="true">!</span>
            <h3 class="text-sm font-bold text-slate-900">Needs Attention</h3>
          </div>
          <span class="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            {{ signals().length }} {{ signals().length === 1 ? 'item' : 'items' }}
          </span>
        </div>

        <div class="divide-y divide-amber-200/70">
          @for (signal of signals(); track signal.key; let i = $index) {
            <div
              class="flex items-center justify-between gap-3 py-3"
              data-testid="attention-row"
              [attr.data-key]="signal.key"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  [class]="dotClass[signal.severity]"
                  aria-hidden="true"
                >{{ icon[signal.category] }}</span>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-slate-900">{{ signal.label }}</p>
                  <p class="mt-0.5 text-[11px] text-slate-500">{{ signal.detail }}</p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <app-delta-badge [delta]="deltas()[i] ?? null" [against]="against()" />
                <span
                  class="rounded px-2 py-0.5 text-[11px] font-semibold"
                  [class]="chipClass[signal.severity]"
                >{{ chipText[signal.severity] }}</span>
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewNeedsAttentionComponent {
  readonly signals = input.required<readonly EmployeeSignal[]>();
  readonly deltas = input<readonly (Delta | null)[]>([]);
  readonly against = input<string | null>(null);

  readonly dotClass: Record<EmployeeSignalSeverity, string> = {
    critical: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  };

  readonly chipClass: Record<EmployeeSignalSeverity, string> = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700'
  };

  readonly chipText: Record<EmployeeSignalSeverity, string> = {
    critical: 'Urgent',
    warning: 'Warning',
    info: 'Review'
  };

  readonly icon: Record<EmployeeSignalCategory, string> = {
    attendance: '⏱',
    work: '!',
    approvals: '✓',
    monitoring: '◉'
  };
}
