import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MyTeamWidgetKey } from '../../models/my-team-widget-key.model';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { TeamKpiTile, TeamKpiTone, buildTeamKpis } from '../../utils/team-kpi.util';

/** Tinted icon tile, value and caption colours - the same palette as Employee Detail's KPI strip. */
interface KpiPalette {
  tile: string;
  value: string;
  caption: string;
}

const TONE_PALETTE: Record<TeamKpiTone, KpiPalette> = {
  critical: { tile: 'bg-red-50 text-red-600', value: 'text-red-600', caption: 'text-red-600' },
  warning: { tile: 'bg-amber-50 text-amber-600', value: 'text-amber-600', caption: 'text-amber-600' },
  neutral: { tile: 'bg-blue-50 text-blue-600', value: 'text-blue-600', caption: 'text-slate-500' },
  good: { tile: 'bg-emerald-50 text-emerald-600', value: 'text-emerald-600', caption: 'text-emerald-600' }
};

/** Four at-a-glance numbers above the My Team widgets, styled like Employee Detail's KPI cards.
 * Read-only over the widgets' own stores - it never loads or polls, so a tile appears only once its
 * widget has fetched (see buildTeamKpis). */
@Component({
  selector: 'app-team-kpi-strip',
  standalone: true,
  template: `
    @if (tiles().length > 0) {
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="team-kpi-strip">
        @for (tile of tiles(); track tile.key) {
          @let tone = palette(tile.tone);
          <button
            type="button"
            class="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 text-left shadow-xs transition-colors hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
            [attr.data-testid]="'team-kpi-' + tile.key"
            (click)="jumpTo(tile)"
          >
            <span [class]="'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ' + tone.tile" aria-hidden="true">
              <svg class="h-[1.125rem] w-[1.125rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                @switch (tile.key) {
                  @case ('present') { <rect x="3.5" y="5" width="17" height="15.5" rx="2"></rect><path d="M16 3v4M8 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"></path> }
                  @case ('approvals') { <path d="M22 12h-6l-2 3h-4l-2-3H2"></path><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path> }
                  @case ('attention') { <circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path> }
                  @default { <circle cx="12" cy="12" r="9"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path> }
                }
              </svg>
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[11px] font-medium text-slate-500">{{ tile.label }}</p>
              <p [class]="'text-sm font-bold tabular-nums ' + tone.value" data-testid="team-kpi-value">{{ tile.value }}</p>
              <p [class]="'truncate text-[11px] ' + tone.caption" [title]="tile.caption">{{ tile.caption }}</p>
            </div>
          </button>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamKpiStripComponent {
  readonly visibleWidgets = input.required<readonly MyTeamWidgetKey[]>();

  private readonly todayStore = inject(MyTeamTodayStore);
  private readonly actionItemsStore = inject(MyTeamActionItemsStore);
  private readonly ledProgressStore = inject(MyTeamLedProgressStore);

  protected readonly tiles = computed(() =>
    buildTeamKpis({
      visibleWidgets: this.visibleWidgets(),
      today: this.todayStore.data(),
      actionItems: this.actionItemsStore.data(),
      ledProgress: this.ledProgressStore.data()
    })
  );

  palette(tone: TeamKpiTone): KpiPalette {
    return TONE_PALETTE[tone];
  }

  jumpTo(tile: TeamKpiTile): void {
    document.getElementById(`my-team-widget-${tile.target}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
