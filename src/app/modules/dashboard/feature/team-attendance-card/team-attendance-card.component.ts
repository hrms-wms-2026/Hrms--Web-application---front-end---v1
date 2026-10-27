import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import {
  TeamAttendanceBucket,
  TeamAttendancePeriodMode,
  TeamAttendanceSummaryResponse
} from '../../models/team-attendance.model';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
import { AttendanceDayChartComponent } from '../../ui/attendance-day-chart/attendance-day-chart.component';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import { TeamAttendanceView, resolveTeamAttendanceView } from '../../utils/team-attendance-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';

const REFRESH_INTERVAL_MS = 60_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Status colours, the same palette as the day chart. */
export const TEAM_ATTENDANCE_COLORS: Record<Exclude<TeamAttendanceBucket, 'off'>, string> = {
  present: '#34d399',
  late: '#fbbf24',
  absent: '#f87171',
  leave: '#60a5fa',
  pending: '#cbd5e1'
};

export const TEAM_ATTENDANCE_LABELS: Record<TeamAttendanceBucket, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'On leave',
  pending: 'Not in yet',
  off: 'Off'
};

interface LegendRow {
  readonly key: Exclude<TeamAttendanceBucket, 'off' | 'pending'>;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly color: string;
}

/** "26 Oct – 1 Nov" for a week, "October 2026" for a month; dates are read without a time zone. */
export function teamAttendanceRangeLabel(mode: TeamAttendancePeriodMode, start: string, end: string): string {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);
  if (mode === 'month') return `${LONG_MONTHS[sm - 1]} ${sy}`;
  return sm === em ? `${sd} – ${ed} ${MONTHS[em - 1]}` : `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`;
}

/** "↑ 4 pp vs last week"; null when there is nothing to compare. */
export function teamAttendanceDelta(deltaPp: number | null, mode: TeamAttendancePeriodMode): { text: string; down: boolean } | null {
  if (deltaPp === null) return null;
  const arrow = deltaPp > 0 ? '↑' : deltaPp < 0 ? '↓' : '±';
  return { text: `${arrow} ${Math.abs(deltaPp)} pp vs last ${mode}`, down: deltaPp < 0 };
}

/**
 * My Team "Team attendance". One card, three views chosen from its own rendered size (small: today's rate and
 * ring; medium: donut, status legend and the period's trend; large: status tiles, trend and today's list); the
 * expand button opens the detail dialog. The Week / Month switch and the ‹ › navigation live in the store, so a
 * resize or the dialog never resets them. Today's figures are a snapshot; the trend covers the selected period.
 */
@Component({
  selector: 'app-team-attendance-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    KpiTilesComponent,
    AvatarComponent,
    AttendanceDayChartComponent
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

  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private resizeObserver: ResizeObserver | null = null;
  private frameId: number | null = null;
  private pendingSize: { width: number; height: number } | null = null;

  /** The view for the card's current size; 'small' until the first measurement. */
  readonly view = signal<TeamAttendanceView>('small');
  readonly detailOpen = signal(false);

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

  protected readonly donut = computed<DonutArc[]>(() => {
    const c = this.store.data()?.todayCounts;
    if (!c) return [];
    return donutArcs([
      { key: 'present', count: c.present, color: TEAM_ATTENDANCE_COLORS.present },
      { key: 'late', count: c.late, color: TEAM_ATTENDANCE_COLORS.late },
      { key: 'absent', count: c.absent, color: TEAM_ATTENDANCE_COLORS.absent },
      { key: 'leave', count: c.onLeave, color: TEAM_ATTENDANCE_COLORS.leave },
      { key: 'pending', count: c.pending, color: TEAM_ATTENDANCE_COLORS.pending }
    ]);
  });

  protected readonly donutLabel = computed(() =>
    `Today: ${this.legend().map((r) => `${r.count} ${r.label.toLowerCase()}`).join(', ')}` +
    (this.store.data()?.todayCounts.pending ? `, ${this.store.data()?.todayCounts.pending} not in yet` : '')
  );

  protected readonly tiles = computed<KpiTile[]>(() => {
    const rows = this.legend();
    const pending = this.store.data()?.todayCounts.pending ?? 0;
    const tone = { present: 'success', absent: 'danger', late: 'warning', leave: 'accent' } as const;
    const icon = { present: 'check-circle', absent: 'alert-triangle', late: 'clock', leave: 'users' } as const;
    return rows.map((r) => ({
      label: r.label,
      value: r.count,
      hint: r.key === 'present' && pending > 0 ? `${r.percent}% · ${pending} not in yet` : `${r.percent}% today`,
      icon: icon[r.key],
      tone: tone[r.key],
      testId: `ta-tile-${r.key}`
    }));
  });

  /** True when no day of the period had anyone expected: the chart would be empty. */
  protected readonly noWorkingDays = computed(() =>
    (this.store.data()?.trend ?? []).every((p) => p.present + p.late + p.absent + p.onLeave === 0)
  );

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startPolling();
    this.observeSize();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
      this.stopObservingSize();
    });
  }

  protected percentText(rate: number | null): string {
    return rate === null ? '—' : `${rate}%`;
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  /** Clock-in time in the team's schedule time zone, 24-hour. */
  protected clockIn(at: string | null): string {
    const timezone = this.store.data()?.timezone;
    if (!at) return '–';
    try {
      return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone || undefined })
        .format(new Date(at));
    } catch {
      return new Date(at).toISOString().slice(11, 16);
    }
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
    this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
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
    const view = resolveTeamAttendanceView(size.width, size.height, this.view());
    if (view !== this.view()) this.view.set(view);
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
      this.startPolling();
    } else {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    if (this.pollId) return;
    this.pollId = setInterval(() => this.feed.reload(), REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }
}
