import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { TeamTodayMember, TeamTodayResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { injectHostSize } from '../../utils/host-size.util';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  PresenceState,
  clockTime,
  minutesSince,
  minutesText,
  neutralLine,
  orderPresence,
  presenceFromSummary,
  presenceState,
  timeLeft
} from '../../utils/team-presence-format.util';
import { PRESENCE_MEDIUM_ROWS, PresenceView, presenceView } from '../../utils/team-presence-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamStatusDetailDialogComponent } from '../team-status-detail-dialog/team-status-detail-dialog.component';

const REFRESH_INTERVAL_MS = 60_000;
/** Elapsed times tick between refreshes; the counts only change when the data reloads. */
const TICK_MS = 30_000;

interface Counter {
  readonly key: PresenceState;
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

/**
 * My Team "Working / Break / Leave" (key team-status; replaces Team Status, My Team widgets design 2026-10-29 section
 * 6.4). Who is working, on a break or on approved leave right now, since when and for how long. The population, the
 * statuses and the leave masking are Team Status's own: a person whose leave the viewer may not see arrives as absent
 * and stays in the neutral line. A schedule never makes anyone Working. The view comes from the card's own size: mini =
 * the donut and three counts, medium = counters and the first rows, large = counters and a table. The popup has the
 * week's working hours and the full member table.
 */
@Component({
  selector: 'app-team-status-card',
  standalone: true,
  imports: [AvatarComponent, WidgetCardComponent, PopoutHeaderActionsComponent, TeamStatusDetailDialogComponent],
  templateUrl: './team-status-card.component.html',
  styleUrl: './team-status-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamStatusCardComponent implements OnInit {
  protected readonly store = inject(MyTeamTodayStore);
  /** Inside a dashboard frame the first payload comes from the bootstrap and reloads go through the
   * widget context; outside one (or when that data isn't available) the store fetches as before. */
  private readonly feed = injectWidgetDataFeed<TeamTodayResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => void this.store.load(),
    refreshing: () => this.store.markLoading()
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly size = injectHostSize();

  private pollId: ReturnType<typeof setInterval> | null = null;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private lastView: PresenceView | null = null;

  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly colors = PRESENCE_COLORS;
  protected readonly now = signal(new Date());
  readonly detailOpen = signal(false);

  /** The view for the card's current size, with ~20px hysteresis; 'medium' until the first measurement. */
  readonly view = computed<PresenceView>(() => {
    const { width, height } = this.size();
    this.lastView = presenceView(width, height, this.lastView);
    return this.lastView;
  });

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.totalMembers === 0 ? 'empty' : 'ready';
  });
  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly groups = computed(() => {
    const summary = this.store.data()?.summary;
    return summary ? presenceFromSummary(summary) : null;
  });

  protected readonly counters = computed<Counter[]>(() => {
    const g = this.groups();
    if (!g) return [];
    return [
      { key: 'working', label: PRESENCE_LABELS.working, count: g.working, color: PRESENCE_COLORS.working },
      { key: 'break', label: PRESENCE_LABELS.break, count: g.onBreak, color: PRESENCE_COLORS.break },
      { key: 'leave', label: PRESENCE_LABELS.leave, count: g.onLeave, color: PRESENCE_COLORS.leave }
    ];
  });

  protected readonly donut = computed<DonutArc[]>(() => donutArcs(this.counters()));
  /** At work right now (working or on a break) of the whole team. */
  protected readonly atWork = computed(() => {
    const g = this.groups();
    return g ? g.working + g.onBreak : 0;
  });
  protected readonly donutLabel = computed(
    () => `${this.counters().map((c) => `${c.count} ${c.label.toLowerCase()}`).join(', ')} of ${this.store.data()?.totalMembers ?? 0}`
  );
  protected readonly neutral = computed(() => {
    const g = this.groups();
    return g ? neutralLine(g.neutral) : '';
  });

  protected readonly ordered = computed(() => orderPresence(this.store.data()?.members ?? []));
  /** Medium lists the people in the three states first; the neutral ones only fill what is left. */
  protected readonly mediumRows = computed(() => this.ordered().slice(0, PRESENCE_MEDIUM_ROWS));

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startPolling();
    this.tickId = setInterval(() => this.now.set(new Date()), TICK_MS);
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
      if (this.tickId) clearInterval(this.tickId);
    });
  }

  protected state(member: TeamTodayMember): PresenceState | null {
    return presenceState(member.status);
  }

  protected stateLabel(member: TeamTodayMember): string {
    const state = presenceState(member.status);
    return state ? PRESENCE_LABELS[state] : member.statusLabel;
  }

  protected stateColor(member: TeamTodayMember): string | null {
    const state = presenceState(member.status);
    return state ? PRESENCE_COLORS[state] : null;
  }

  protected sinceText(member: TeamTodayMember): string {
    return member.stateSince ? `Since ${clockTime(member.stateSince)}` : '';
  }

  protected elapsedText(member: TeamTodayMember): string {
    return member.stateSince ? minutesText(minutesSince(member.stateSince, this.now())) : '—';
  }

  protected left(member: TeamTodayMember): { text: string; usedPercent: number } | null {
    return timeLeft(member, this.now());
  }

  /** Leave never counts down: its type and end only where Team Status shows them (leave-authorized viewers). */
  protected leaveText(member: TeamTodayMember): string {
    return member.leave ? `${member.leave.leaveTypeName} · until ${member.leave.endsOn}` : '';
  }

  protected attendanceText(member: TeamTodayMember): string {
    return member.attendanceMinutes > 0 ? minutesText(member.attendanceMinutes) : '—';
  }

  protected avatarUrl(member: TeamTodayMember): string | null {
    return member.avatarFileId ? buildFileUrl(member.avatarFileId) : null;
  }

  retry(): void {
    this.feed.reload();
  }

  openDetail(event?: Event): void {
    event?.stopPropagation();
    if (this.store.data()) this.detailOpen.set(true);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
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
