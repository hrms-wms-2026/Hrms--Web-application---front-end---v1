import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import {
  WidgetCardComponent,
  WidgetState,
} from '../../../../shared/ui/widget-card/widget-card.component';
import {
  TeamScheduleItem,
  TeamScheduleMember,
  TeamScheduleResponse,
} from '../../models/team-schedule.model';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { injectHostSize } from '../../utils/host-size.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  minutesText,
  presenceState,
} from '../../utils/team-presence-format.util';
import {
  SCHEDULE_COLORS,
  completionText,
  hasPlan,
  hourTicks,
  itemColor,
  itemStatusLabel,
  spanPosition,
  taskStatusDonut,
  timelineSpan,
  unscheduledMinutes,
} from '../../utils/team-schedule-format.util';
import { ScheduleView, resolveScheduleView } from '../../utils/team-schedule-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamScheduleDetailDialogComponent } from '../team-schedule-detail-dialog/team-schedule-detail-dialog.component';

const REFRESH_INTERVAL_MS = 60_000;
const SCHEDULE_MEDIUM_ROWS = 5;

/**
 * My Team "Today's team schedule" (key team-schedule, My Team widgets design 2026-10-29 section 6.2): each report's plan
 * for their own today, how far through it they are, and what was worked off-plan. Read-only: managers never edit a plan.
 * Views from the card's own size: mini = the task-status donut (tasks only, never meetings) and an unscheduled-work alert,
 * medium = people rows with a mini plan bar, large = a timeline. With the Planner off the schedule figures give way to a
 * "Planner is off" note; meetings and clocked time still show.
 */
@Component({
  selector: 'app-team-schedule-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    AvatarComponent,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    TeamScheduleDetailDialogComponent,
  ],
  templateUrl: './team-schedule-card.component.html',
  styleUrl: './team-schedule-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamScheduleCardComponent implements OnInit {
  protected readonly store = inject(TeamScheduleStore);
  private readonly feed = injectWidgetDataFeed<TeamScheduleResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => this.store.load(),
    refreshing: () => this.store.markLoading(),
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly size = injectHostSize();
  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private lastView: ScheduleView | null = null;

  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly colors = SCHEDULE_COLORS;
  protected readonly now = signal(new Date());
  readonly detailOpen = signal(false);

  readonly view = computed<ScheduleView>(() => {
    const { width, height } = this.size();
    this.lastView = resolveScheduleView(width, height, this.lastView);
    return this.lastView;
  });

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.members.length === 0 ? 'empty' : 'ready';
  });
  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly donut = computed(() => {
    const data = this.store.data();
    return data ? taskStatusDonut(data.summary) : [];
  });
  protected readonly donutLabel = computed(() => {
    const s = this.store.data()?.summary;
    return s
      ? `Tasks today: ${s.tasksCompleted} completed, ${s.tasksInProgress} in progress, ${s.tasksPending} pending`
      : '';
  });

  /** Rows keep the backend's order (ranked, then by name); a clock tick never re-sorts them. */
  protected readonly mediumRows = computed(() =>
    (this.store.data()?.members ?? []).slice(0, SCHEDULE_MEDIUM_ROWS),
  );
  protected readonly span = computed(() => {
    const data = this.store.data();
    return timelineSpan(data?.members ?? [], data?.date ?? '1970-01-01');
  });
  protected readonly ticks = computed(() => hourTicks(this.span()));
  protected readonly nowLeft = computed(() => {
    const data = this.store.data();
    if (!data || this.store.date() !== null) return null;
    const t = this.now().toISOString();
    return (
      spanPosition(t, new Date(this.now().getTime() + 1).toISOString(), this.span())?.left ?? null
    );
  });

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startPolling();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
    });
  }

  protected completion(member: TeamScheduleMember): string {
    return completionText(member);
  }

  protected hasPlan(member: TeamScheduleMember): boolean {
    return hasPlan(member);
  }

  protected unscheduled(member: TeamScheduleMember): number {
    return unscheduledMinutes(member);
  }

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected presenceLabel(member: TeamScheduleMember): string | null {
    if (!member.presenceStatus) return null;
    const state = presenceState(member.presenceStatus);
    return state ? PRESENCE_LABELS[state] : null;
  }

  protected presenceColor(member: TeamScheduleMember): string | null {
    const state = member.presenceStatus ? presenceState(member.presenceStatus) : null;
    return state ? PRESENCE_COLORS[state] : null;
  }

  protected position(startIso: string, endIso: string): { left: number; width: number } | null {
    return spanPosition(startIso, endIso, this.span());
  }

  protected itemColor(item: TeamScheduleItem): string {
    return itemColor(item);
  }

  protected itemTitle(item: TeamScheduleItem): string {
    return `${item.title} · ${itemStatusLabel(item)}`;
  }

  protected inConflict(member: TeamScheduleMember, item: TeamScheduleItem): boolean {
    return member.conflicts.some((c) => c.start < item.end && c.end > item.start);
  }

  protected avatarUrl(member: TeamScheduleMember): string | null {
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
    this.pollId = setInterval(() => {
      this.now.set(new Date());
      this.feed.reload();
    }, REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }
}
