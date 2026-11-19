import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Delta } from '../../utils/employee-overview.utils';
import { KpiCard, KpiTone } from '../../utils/overview-kpi-cards';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';

type KpiIcon = 'check' | 'alert' | 'calendar' | 'target' | 'clock' | 'pin' | 'inbox' | 'activity' | 'layers' | 'progress';

/** Colours for one card: tinted icon tile, value and detail line. */
interface KpiPalette {
  readonly tile: string;
  readonly value: string;
  readonly detail: string;
}

const ICONS: Record<string, KpiIcon> = {
  tasks_completed: 'check',
  overdue_tasks: 'alert',
  days_attended: 'calendar',
  absent_days: 'calendar',
  leave_days: 'calendar',
  on_time_delivery: 'target',
  late_clock_ins: 'clock',
  missing_clock_outs: 'clock',
  early_clock_outs: 'clock',
  short_hours_days: 'clock',
  over_break: 'clock',
  off_schedule_work: 'clock',
  location_violations: 'pin',
  pending_approvals: 'inbox',
  idle_activity_alerts: 'activity',
  monitoring_exceptions: 'activity',
  tasks_in_progress: 'progress',
  story_points: 'layers'
};

const TONE_PALETTES: Record<KpiTone, KpiPalette> = {
  critical: { tile: 'bg-[var(--color-danger-subtle)] text-[var(--color-danger)]', value: 'text-[var(--color-danger)]', detail: 'text-[var(--color-danger)]' },
  warning: { tile: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning)]', value: 'text-[var(--color-warning)]', detail: 'text-[var(--color-warning)]' },
  info: { tile: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]', value: 'text-[var(--color-accent)]', detail: 'text-[var(--color-accent)]' },
  baseline: { tile: 'bg-[var(--color-success-subtle)] text-[var(--color-success)]', value: 'text-[var(--color-success)]', detail: 'text-[var(--color-success)]' }
};

/** Baseline cards are told apart by colour; signal cards always take their severity colour. */
const BASELINE_PALETTES: Record<string, KpiPalette> = {
  days_attended: { tile: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]', value: 'text-[var(--color-accent)]', detail: 'text-[var(--color-accent)]' },
  on_time_delivery: { tile: 'bg-[var(--color-cat-violet-subtle)] text-[var(--color-cat-violet)]', value: 'text-[var(--color-text-primary)]', detail: 'text-[var(--color-success)]' },
  leave_days: { tile: 'bg-sky-50 text-sky-600', value: 'text-sky-600', detail: 'text-[var(--color-text-secondary)]' },
  tasks_in_progress: { tile: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]', value: 'text-[var(--color-accent)]', detail: 'text-[var(--color-text-secondary)]' },
  story_points: { tile: 'bg-[var(--color-cat-violet-subtle)] text-[var(--color-cat-violet)]', value: 'text-[var(--color-cat-violet)]', detail: 'text-[var(--color-text-secondary)]' }
};

@Component({
  selector: 'app-overview-kpi-strip',
  standalone: true,
  imports: [DeltaBadgeComponent],
  template: `
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="kpi-strip">
      @for (card of cards(); track card.key; let i = $index) {
        @let tone = palette(card);
        <div
          data-testid="kpi-card"
          class="kpi-card flex items-center gap-3 rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface)] px-3.5 py-3 shadow-xs transition-colors"
          [attr.role]="clickable(card) ? 'button' : null"
          [attr.tabindex]="clickable(card) ? 0 : null"
          [class.kpi-card--clickable]="clickable(card)"
          (click)="select(card)"
          (keydown.enter)="select(card)"
        >
          <span
            data-testid="kpi-icon"
            [class]="'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' + tone.tile"
            aria-hidden="true"
          >
            <svg class="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              @switch (icon(card)) {
                @case ('check') { <circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path> }
                @case ('alert') { <circle cx="12" cy="12" r="9"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path> }
                @case ('calendar') { <rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M16 3v4M8 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"></path> }
                @case ('target') { <circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle> }
                @case ('pin') { <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle> }
                @case ('inbox') { <path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path> }
                @case ('activity') { <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path> }
                @case ('layers') { <path d="m12 3 9 5-9 5-9-5 9-5z"></path><path d="m3 13 9 5 9-5"></path> }
                @case ('progress') { <path d="M21 12a9 9 0 1 1-6.2-8.56"></path><path d="M12 7v5l3 2"></path> }
                @default { <circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path> }
              }
            </svg>
          </span>

          <div class="min-w-0 flex-1">
            <p class="truncate text-[11px] font-medium text-[var(--color-text-secondary)]">{{ card.label }}</p>
            <div class="flex items-baseline gap-1">
              <span [class]="'text-sm font-bold ' + tone.value" data-testid="kpi-value">
                {{ card.value }}{{ card.suffix }}
              </span>
              @if (card.denominator !== null) {
                <span class="text-xs font-medium text-[var(--color-text-muted)]">/{{ card.denominator }}</span>
              }
              <app-delta-badge class="ml-auto" [delta]="deltas()[i] ?? null" [against]="against()" />
            </div>
            <p [class]="'truncate text-[11px] ' + tone.detail" [title]="card.detail">{{ card.detail }}</p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .kpi-card--clickable { cursor: pointer; }
    .kpi-card--clickable:hover { background: var(--color-surface-secondary); border-color: var(--color-border-strong); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewKpiStripComponent {
  readonly cards = input.required<readonly KpiCard[]>();
  readonly deltas = input<readonly (Delta | null)[]>([]);
  readonly against = input<string | null>(null);
  /** False renders every card as a plain read-out (nothing to drill into), whatever its tone. */
  readonly interactive = input(true);
  readonly cardSelected = output<string>();

  clickable(card: KpiCard): boolean {
    return this.interactive() && card.tone !== 'baseline';
  }

  select(card: KpiCard): void {
    if (this.clickable(card)) this.cardSelected.emit(card.key);
  }

  palette(card: KpiCard): KpiPalette {
    return (card.tone === 'baseline' ? BASELINE_PALETTES[card.key] : undefined) ?? TONE_PALETTES[card.tone];
  }

  icon(card: KpiCard): KpiIcon | null {
    return ICONS[card.key] ?? (card.tone === 'baseline' ? null : 'alert');
  }
}
