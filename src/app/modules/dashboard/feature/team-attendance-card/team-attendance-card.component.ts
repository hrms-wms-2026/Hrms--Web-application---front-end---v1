import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import { TeamAttendanceBucket, TeamAttendanceEmployeeRow, TeamAttendanceSummaryResponse } from '../../models/team-attendance.model';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
import { AttendanceDayChartComponent } from '../../ui/attendance-day-chart/attendance-day-chart.component';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import { TeamAttendanceDetailDialogComponent } from '../team-attendance-detail-dialog/team-attendance-detail-dialog.component';
import { TEAM_ATTENDANCE_COLORS, TEAM_ATTENDANCE_LABELS, teamAttendanceDelta, teamAttendanceRangeLabel } from '../../utils/team-attendance-format.util';
import { dashboardDonutPx } from '../../utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import { DashboardSummaryStripComponent } from '../../ui/dashboard-summary-strip/dashboard-summary-strip.component';
import { DashboardSummaryRowComponent } from '../../ui/dashboard-summary-row/dashboard-summary-row.component';
import { summaryRowCount, withSummaryRow } from '../../utils/summary-row.util';
import { SUMMARY_CARD_ROWS, teamAttendanceSummaryCards } from '../../utils/team-attendance-summary-cards.util';
import { SummaryCardModel } from '../../models/summary-card.model';
import {
  EMPTY_TEAM_ATTENDANCE_PLAN,
  TEAM_ATTENDANCE_CARD_CHROME,
  TEAM_ATTENDANCE_HERO_LEGEND_WIDTH_PX,
  TEAM_ATTENDANCE_MAX_RANKING_ROWS,
  TeamAttendancePlan,
  TeamAttendanceView,
  planTeamAttendanceLayout,
  resolveTeamAttendanceView
} from '../../utils/team-attendance-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { StopClickPropagationDirective } from '../../../../shared/directives/stop-click-propagation.directive';

/** The attention card's place in the strip: its ranking loads once this many cards are shown. */
const ATTENTION_CARD_POSITION = 3;

interface LegendRow {
  readonly key: Exclude<TeamAttendanceBucket, 'off' | 'pending'>;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly color: string;
}

/**
 * My Team "Team attendance". One card whose layout comes from its own rendered size: a 2-row card shows the
 * shared summary strip (donut, then its key, then summary cards of the popup's sections as it widens); taller cards keep the donut in one place and add today's
 * status tiles, then the period's trend chart, then a summary of the employee ranking as they grow. The expand
 * button opens the popup with the full ranking. The Week / Month switch and the ‹ › navigation live in the store, so a
 * resize or the dialog never resets them. Today's figures are a snapshot; the trend covers the selected period.
 */
/** The summary cards whose popup section a taller view already shows as its own section. */
function shownAttendanceCards(plan: TeamAttendancePlan): ReadonlySet<string> {
  const shown = new Set<string>();
  if (plan.trend || plan.heroTrend) shown.add('att-rate');
  if (plan.rankingRows > 0) shown.add('att-attention');
  return shown;
}

function samePlan(a: TeamAttendancePlan, b: TeamAttendancePlan): boolean {
  return (
    a.heroTrend === b.heroTrend &&
    a.legend === b.legend &&
    a.figure === b.figure &&
    a.tiles === b.tiles &&
    a.tileColumns === b.tileColumns &&
    a.trend === b.trend &&
    a.rankingRows === b.rankingRows
  );
}

@Component({
  selector: 'app-team-attendance-card',
  standalone: true,
  imports: [StopClickPropagationDirective, DashboardDonutComponent, DonutKeyComponent, DashboardSummaryStripComponent, DashboardSummaryRowComponent,
    NgTemplateOutlet,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    AvatarComponent,
    AttendanceDayChartComponent,
    TeamAttendanceDetailDialogComponent
  ],
  templateUrl: './team-attendance-card.component.html',
  styleUrl: './team-attendance-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamAttendanceCardComponent implements OnInit {
  protected readonly store = inject(TeamAttendanceStore);
  private readonly feed = injectWidgetDataFeed<TeamAttendanceSummaryResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => this.store.load(),
    refreshing: () => this.store.markLoading()
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly api = inject(TeamAttendanceApiService);

  private visibilityHandler = (): void => this.onVisibilityChange();
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private pendingSize: { width: number; height: number } | null = null;
  /** Whether a size has been applied yet: the first measurement picks its view with no hysteresis. */
  private measured = false;

  /** The view for the card's current size; 'standard' until the first measurement. */
  readonly view = signal<TeamAttendanceView>('standard');
  /** The last measured host size: the layout below follows it and the loaded data. */
  private readonly size = signal<{ width: number; height: number } | null>(null);
  /** The sections under the donut at the current size (tiles, trend, ranking rows). A taller view puts two summary
   * cards of what it is not already showing in the tiles' place, budgeted at the cards' height; without room or two
   * such cards it keeps the tiles. */
  private readonly layout = computed(() => {
    const size = this.size();
    const view = this.view();
    if (!size) return { plan: EMPTY_TEAM_ATTENDANCE_PLAN, cards: [] as SummaryCardModel[] };
    return withSummaryRow(
      (rowPx) => planTeamAttendanceLayout(view, size.width, size.height, rowPx),
      this.summaryCards(),
      shownAttendanceCards,
      // Three of its four cards can be off-screen at once (the rate card is the trend), so a wide row takes three.
      summaryRowCount(size.width - TEAM_ATTENDANCE_CARD_CHROME.width, 3)
    );
  });
  readonly plan = computed<TeamAttendancePlan>(() => this.layout().plan, { equal: samePlan });
  /** Taller views: the summary cards in the tiles' place (empty: the tiles). */
  protected readonly rowCards = computed(() => this.layout().cards);
  /** Whether the row shows the attention card. A plain boolean, so the ranking effect below re-runs only when that
   * changes, not on every new card list (a failed load would otherwise retry forever). */
  private readonly attentionInRow = computed(() => this.rowCards().some((c) => c.id === 'att-attention'));
  /** standard: whether today's status legend fits beside the donut and the rate. */
  readonly heroLegend = signal(false);
  readonly detailOpen = signal(false);
  /** The popup section a summary card asked for (null: the top). */
  readonly detailSection = signal<string | null>(null);

  /** mini: how many summary cards the 2-row strip shows. The attention card is the third. */
  protected readonly shownCards = signal(0);
  /** The attention ranking (sort 'attention'), loaded only once its summary card is shown. */
  private readonly attention = signal<readonly TeamAttendanceEmployeeRow[] | null>(null);
  private readonly attentionError = signal(false);
  private attentionKey = '';
  /** The period and department the shown attention ranking belongs to. */
  private attentionScope = '';
  private attentionSub: Subscription | null = null;

  protected readonly summaryCards = computed<SummaryCardModel[]>(() => {
    const data = this.store.data();
    return data ? teamAttendanceSummaryCards(data, { rows: this.attention(), error: this.attentionError() }) : [];
  });

  /** The top of the employee ranking (best rate first), loaded only while the card is tall enough to show it. */
  protected readonly ranking = signal<readonly TeamAttendanceEmployeeRow[] | null>(null);
  protected readonly rankingError = signal(false);
  private rankingKey = '';
  private rankingSub: Subscription | null = null;
  protected readonly rankingShown = computed(() => (this.ranking() ?? []).slice(0, this.plan().rankingRows));

  /** Full size, or the mini size in the 2x2 view. */
  protected readonly donutPx = computed(() => dashboardDonutPx(this.view()));
  protected readonly labels = TEAM_ATTENDANCE_LABELS;
  protected readonly colors = TEAM_ATTENDANCE_COLORS;

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.teamSize === 0 ? 'empty' : 'ready';
  });

  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly rangeLabel = computed(() => {
    const data = this.store.data();
    return data ? teamAttendanceRangeLabel(data.mode, data.rangeStart, data.rangeEnd) : '';
  });

  protected readonly delta = computed(() => {
    const data = this.store.data();
    return data ? teamAttendanceDelta(data.deltaPp, data.mode) : null;
  });

  protected readonly attendedToday = computed(() => {
    const c = this.store.data()?.todayCounts;
    return c ? c.present + c.late : 0;
  });

  protected readonly legend = computed<LegendRow[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const c = data.todayCounts;
    const share = (n: number) => (data.eligibleToday > 0 ? Math.round((n * 100) / data.eligibleToday) : 0);
    return [
      { key: 'present', label: 'Present', count: c.present, percent: share(c.present), color: TEAM_ATTENDANCE_COLORS.present },
      { key: 'absent', label: 'Absent', count: c.absent, percent: share(c.absent), color: TEAM_ATTENDANCE_COLORS.absent },
      { key: 'late', label: 'Late', count: c.late, percent: share(c.late), color: TEAM_ATTENDANCE_COLORS.late },
      { key: 'leave', label: 'On leave', count: c.onLeave, percent: share(c.onLeave), color: TEAM_ATTENDANCE_COLORS.leave }
    ];
  });

  protected readonly donut = computed<DonutArc[]>(() =>
    donutArcs(this.donutSlices().map((s) => ({ key: s.key, count: s.value, color: s.color })))
  );

  /** The slice the donut lights (hovered there or on a legend row). */
  protected readonly hovered = signal<string | null>(null);

  /** The legend's statuses as donut-key rows: count, and share of everyone expected today. */
  protected readonly keySlices = computed<DashboardDonutSlice[]>(() =>
    this.legend().map((row) => ({ key: row.key, label: row.label, value: row.count, percentText: `${row.percent}%`, color: row.color }))
  );

  /** The ring: present, late, absent, on leave, then the people not in yet. */
  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const c = data.todayCounts;
    const share = (n: number): string => `${data.eligibleToday > 0 ? Math.round((n * 100) / data.eligibleToday) : 0}%`;
    const slice = (key: string, label: string, value: number, color: string): DashboardDonutSlice =>
      ({ key, label, value, percentText: share(value), color });
    return [
      slice('present', 'Present', c.present, TEAM_ATTENDANCE_COLORS.present),
      slice('late', 'Late', c.late, TEAM_ATTENDANCE_COLORS.late),
      slice('absent', 'Absent', c.absent, TEAM_ATTENDANCE_COLORS.absent),
      slice('leave', 'On leave', c.onLeave, TEAM_ATTENDANCE_COLORS.leave),
      slice('pending', 'Not in yet', c.pending, TEAM_ATTENDANCE_COLORS.pending)
    ];
  });

  protected readonly donutLabel = computed(() =>
    `Today: ${this.legend().map((r) => `${r.count} ${r.label.toLowerCase()}`).join(', ')}` +
    (this.store.data()?.todayCounts.pending ? `, ${this.store.data()?.todayCounts.pending} not in yet` : '')
  );

  /** True when no day of the period had anyone expected: the chart would be empty. */
  protected readonly noWorkingDays = computed(() =>
    (this.store.data()?.trend ?? []).every((p) => p.present + p.late + p.absent + p.onLeave === 0)
  );

  constructor() {
    // Load the ranking for the shown period and department once the card is tall enough to show it.
    effect(() => {
      const data = this.store.data();
      const departmentId = this.store.query().departmentId;
      const wanted = this.plan().rankingRows > 0;
      if (!data || !wanted) return;
      const key = `${data.mode}|${data.rangeStart}|${departmentId ?? ''}|${data.calculatedAtUtc}`;
      if (key === this.rankingKey) return;
      this.rankingKey = key;
      untracked(() => this.loadRanking(data.mode, data.rangeStart, departmentId));
    });
    // The attention card's ranking: loaded for the shown period once the strip shows that card.
    effect(() => {
      const data = this.store.data();
      const departmentId = this.store.query().departmentId;
      const inStrip = this.view() === 'mini' && this.shownCards() >= ATTENTION_CARD_POSITION;
      const inRow = this.attentionInRow();
      if (!data || (!inStrip && !inRow)) return;
      const key = `${data.mode}|${data.rangeStart}|${departmentId ?? ''}|${data.calculatedAtUtc}`;
      if (key === this.attentionKey) return;
      this.attentionKey = key;
      untracked(() => this.loadAttention(data.mode, data.rangeStart, departmentId));
    });
    inject(DestroyRef).onDestroy(() => {
      this.rankingSub?.unsubscribe();
      this.attentionSub?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.observeSize();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopObservingSize();
    });
  }

  protected percentText(rate: number | null): string {
    return rate === null ? '—' : `${rate}%`;
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  retryRanking(event?: Event): void {
    event?.stopPropagation();
    const data = this.store.data();
    if (data) this.loadRanking(data.mode, data.rangeStart, this.store.query().departmentId);
  }

  private loadRanking(mode: 'week' | 'month', anchor: string, departmentId: string | null): void {
    this.rankingSub?.unsubscribe();
    this.rankingError.set(false);
    this.rankingSub = this.api
      .getEmployees({ mode, anchor, departmentId, page: 1, pageSize: TEAM_ATTENDANCE_MAX_RANKING_ROWS, sort: 'rate' })
      .subscribe({
        next: (page) => this.ranking.set(page.items),
        error: () => {
          this.ranking.set(null);
          this.rankingError.set(true);
          this.rankingKey = '';
        }
      });
  }

  retryAttention(): void {
    const data = this.store.data();
    if (!data) return;
    this.attentionKey = '';
    this.loadAttention(data.mode, data.rangeStart, this.store.query().departmentId);
  }

  private loadAttention(mode: 'week' | 'month', anchor: string, departmentId: string | null): void {
    this.attentionSub?.unsubscribe();
    this.attentionError.set(false);
    // A refresh of the same period keeps the shown ranking until the new one lands (no skeleton flash); another
    // period or department starts from the skeleton.
    const scope = `${mode}|${anchor}|${departmentId ?? ''}`;
    if (scope !== this.attentionScope) this.attention.set(null);
    this.attentionScope = scope;
    this.attentionSub = this.api
      .getEmployees({ mode, anchor, departmentId, page: 1, pageSize: SUMMARY_CARD_ROWS, sort: 'attention' })
      .subscribe({
        next: (page) => this.attention.set(page.items),
        error: () => {
          this.attention.set(null);
          this.attentionError.set(true);
          this.attentionKey = '';
        }
      });
  }

  onModeSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'week' || value === 'month') this.store.setMode(value);
  }

  shift(step: -1 | 1, event?: Event): void {
    event?.stopPropagation();
    this.store.shift(step);
  }

  retry(): void {
    this.feed.reload();
  }

  openDetail(event?: Event): void {
    event?.stopPropagation();
    if (!this.store.data()) return;
    this.detailSection.set(null);
    this.detailOpen.set(true);
  }

  /** A summary card: open the popup at the section it summarises. */
  openSection(section: string): void {
    if (!this.store.data()) return;
    this.detailSection.set(section);
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailSection.set(null);
  }

  private observeSize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[entries.length - 1]?.contentRect;
      if (!rect) return;
      this.pendingSize = { width: rect.width, height: rect.height };
      if (typeof requestAnimationFrame !== 'function') {
        this.applySize();
        return;
      }
      if (this.frameId !== null) return;
      this.frameId = requestAnimationFrame(() => {
        this.frameId = null;
        this.applySize();
      });
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  private applySize(): void {
    const size = this.pendingSize;
    if (!size) return;
    this.pendingSize = null;
    const view = resolveTeamAttendanceView(size.width, size.height, this.measured ? this.view() : null);
    if (size.width > 0 && size.height > 0) this.measured = true;
    if (view !== this.view()) this.view.set(view);
    this.size.set({ width: size.width, height: size.height });
    this.heroLegend.set(size.width - TEAM_ATTENDANCE_CARD_CHROME.width >= TEAM_ATTENDANCE_HERO_LEGEND_WIDTH_PX);
  }

  private stopObservingSize(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.feed.reload();
    }
  }
}
