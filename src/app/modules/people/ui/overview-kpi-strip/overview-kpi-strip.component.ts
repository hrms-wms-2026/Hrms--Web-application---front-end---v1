import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Delta } from '../../utils/employee-overview.utils';
import { KpiCard, KpiTone } from '../../utils/overview-kpi-cards';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

@Component({
  selector: 'app-overview-kpi-strip',
  standalone: true,
  imports: [DeltaBadgeComponent],
  template: `
    <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      @for (card of cards(); track card.key; let i = $index) {
        <div
          data-testid="kpi-card"
          class="rounded-2xl border p-4 sm:p-5 flex min-h-36 flex-col justify-between shadow-xs"
          [class]="toneClass[card.tone]"
        >
          <div class="flex items-start justify-between gap-3">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 text-sm font-bold"
              aria-hidden="true"
            >●</span>
            <div class="text-right text-2xl font-bold tracking-tight sm:text-3xl">
              {{ card.value }}{{ card.suffix }}
              @if (card.denominator !== null) {
                <span class="text-lg font-normal text-slate-400">/{{ card.denominator }}</span>
              }
            </div>
          </div>
          <div class="mt-3">
            <span class="block text-sm font-medium text-slate-700">{{ card.label }}</span>
            <div class="mt-0.5 flex items-center justify-between gap-2">
              <span class="text-xs font-semibold">{{ card.detail }}</span>
              <app-delta-badge [delta]="deltas()[i] ?? null" [against]="against()" />
            </div>
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewKpiStripComponent {
  readonly cards = input.required<readonly KpiCard[]>();
  readonly deltas = input<readonly (Delta | null)[]>([]);
  readonly against = input<string | null>(null);

  readonly toneClass: Record<KpiTone, string> = {
    critical: 'bg-red-50 border-red-100 text-red-600',
    warning: 'bg-amber-50 border-amber-100 text-amber-600',
    info: 'bg-blue-50 border-blue-100 text-blue-600',
    baseline: 'bg-emerald-50 border-emerald-100 text-emerald-600'
  };
}
