import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
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
import { TeamScheduleWeekStore } from '../../state/team-schedule-week.store';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { PlannedActualDayChartComponent } from '../../ui/planned-actual-day-chart/planned-actual-day-chart.component';
import { PlannedActualWeekChartComponent } from '../../ui/planned-actual-week-chart/planned-actual-week-chart.component';
import { DASHBOARD_DONUT_PX, donutValueFontPx } from '../../utils/dashboard-donut.util';
import { DashboardDonutComponent, DashboardDonutSlice } from '../../ui/dashboard-donut/dashboard-donut.component';
import { DonutKeyComponent } from '../../ui/dashboard-donut/donut-key.component';
import { injectHostSize } from '../../utils/host-size.util';
import { plannedActualTiles, summarizePlannedActual } from '../../utils/planned-actual-format.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  minutesText,
  presenceState,
} from '../../utils/team-presence-format.util';
import { formatPercent } from '../../utils/team-progress-format.util';
import {
  SCHEDULE_COLORS,
  breakSegments,
  completionText,
  hasPlan,
  hourTicks,
  isNotPlanned,
  inMeetingNow,
  isOnLeave,
  isOverCapacity,
  itemColor,
  itemDonut,
  itemStatusLabel,
  loadColor,
  loadPercent,
  loadText,
  scheduleFlagChips,
  scheduleFlags,
  spanPosition,
  timelineSpan,
  toPlannedActualRows,
  toWeekChartDays,
  totalItems,
  unscheduledMinutes,
} from '../../utils/team-schedule-format.util';
import {
  EMPTY_SCHEDULE_PLAN,
  SCHEDULE_CARD_CHROME,
  SCHEDULE_SIDE_PX,
  SchedulePlan,
  ScheduleView,
  drawnScheduleView,
  planScheduleLayout,
  resolveScheduleView,
} from '../../utils/team-schedule-layout.util';
import { injectWidgetDataFeed } from '../../widgets/widget-data-feed';
import { TeamScheduleDetailDialogComponent } from '../team-schedule-detail-dialog/team-schedule-detail-dialog.component';

const CLOCK_TICK_MS = 60_000;
/** The timeline's fixed columns (member 200, status 104, done 48, three 12px gaps); the track takes the rest. */
const TIMELINE_NAME_PX = 388;
/** A block narrower than this shows its colour and tooltip only. */
const BLOCK_LABEL_MIN_PX = 48;
/** Entries in each side-column list. */
const SIDE_LIST = 3;

interface LegendRow {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly color: string;
}

/**
 * My Team "Today's team schedule" (key team-schedule; 2026-11-02 design match section 7): each report's plan for their
 * own today, how far through it they are, and what was worked off-plan. Read-only: managers never edit a plan. The view
 * comes from the card's own size and grows by detail (2026-11-05 merged-widget design): mini = the item count, a stacked
 * bar and the status chips (over capacity, not planned, on leave); xs / rows = the item donut and its legend, the chips,
 * then one row per person (load against capacity and items done); timeline = the donut panel beside the status tiles,
 * then a line per person (status, load, labelled blocks, done), then (taller) the daily planned-vs-actual chart, (wider)
 * a side column with the summary, unscheduled work and conflicts, and at the maximum size the week's planned-vs-actual
 * chart. The card never scrolls.
 * With the Planner off there is no timeline and no plan figure: clocked time against the work window, and a
 * "Planner is off" note.
 */
@Component({
  selector: 'app-team-schedule-card',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    DashboardDonutComponent,
    DonutKeyComponent,
    AvatarComponent,
    WidgetCardComponent,
    PopoutHeaderActionsComponent,
    TeamScheduleDetailDialogComponent,
    PlannedActualDayChartComponent,
    PlannedActualWeekChartComponent,
  ],
  templateUrl: './team-schedule-card.component.html',
  styleUrl: './team-schedule-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamScheduleCardComponent implements OnInit {
  protected readonly store = inject(TeamScheduleStore);
  protected readonly weekStore = inject(TeamScheduleWeekStore);
  private readonly feed = injectWidgetDataFeed<TeamScheduleResponse>({
    apply: (data) => this.store.seed(data),
    fetch: () => this.store.load(),
    refreshing: () => this.store.markLoading(),
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly size = injectHostSize();
  private clockId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();
  private lastView: ScheduleView | null = null;
  private weekRequested = false;

  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly valueFontPx = donutValueFontPx;
  protected readonly sidePx = SCHEDULE_SIDE_PX;
  protected readonly colors = SCHEDULE_COLORS;
  protected readonly now = signal(new Date());
  readonly detailOpen = signal(false);

  readonly view = computed<ScheduleView>(() => {
    const { width, height } = this.size();
    this.lastView = resolveScheduleView(width, height, this.lastView);
    return this.lastView;
  });

  protected readonly plannerEnabled = computed(() => this.store.data()?.plannerEnabled ?? true);
  protected readonly members = computed(() => this.store.data()?.members ?? []);
  /** The view the template draws: no timeline with the Planner off. */
  protected readonly drawn = computed(() => drawnScheduleView(this.view(), this.plannerEnabled()));
  protected readonly plan = computed<SchedulePlan>(() => {
    const { width, height } = this.size();
    return width > 0 && height > 0
      ? planScheduleLayout(this.view(), width, height, this.members().length, this.plannerEnabled())
      : EMPTY_SCHEDULE_PLAN;
  });

  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.members.length === 0 ? 'empty' : 'ready';
  });
  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly donut = computed(() => {
    const data = this.store.data();
    return data ? itemDonut(data.summary) : [];
  });
  protected readonly legend = computed<LegendRow[]>(() => {
    const s = this.store.data()?.summary;
    if (!s) return [];
    return [
      { key: 'completed', label: 'Completed', count: s.tasksCompleted, color: SCHEDULE_COLORS.completed },
      { key: 'inProgress', label: 'In progress', count: s.tasksInProgress, color: SCHEDULE_COLORS.inProgress },
      { key: 'pending', label: 'Pending', count: s.tasksPending, color: SCHEDULE_COLORS.pending },
      { key: 'meetings', label: 'Meetings', count: s.meetings, color: SCHEDULE_COLORS.meeting },
    ];
  });
  /** The donut and its key: today's items by status, each with its share of all of them. */
  protected readonly donutSlices = computed<DashboardDonutSlice[]>(() =>
    this.legend().map((row) => ({ key: row.key, label: row.label, value: row.count, color: row.color })),
  );
  /** The slice the donut lights (hovered there or on a key row). */
  protected readonly hovered = signal<string | null>(null);
  protected readonly totalItems = computed(() => {
    const s = this.store.data()?.summary;
    return s ? totalItems(s) : 0;
  });
  protected readonly donutLabel = computed(
    () => `${this.totalItems()} items today: ${this.legend().map((r) => `${r.count} ${r.label.toLowerCase()}`).join(', ')}`,
  );
  /** Over capacity, not planned, on leave: counted over everyone, not only the rows shown. */
  protected readonly flags = computed(() => scheduleFlags(this.members()));
  protected readonly chips = computed(() => scheduleFlagChips(this.flags()));
  /** The side column's summary list. */
  protected readonly summaryRows = computed(() => {
    const s = this.store.data()?.summary;
    if (!s) return [];
    const f = this.flags();
    return [
      { label: 'People', value: s.people, alert: false },
      { label: 'Tasks planned', value: s.tasksPlanned, alert: false },
      { label: 'Tasks completed', value: s.tasksCompleted, alert: false },
      { label: 'In progress', value: s.tasksInProgress, alert: false },
      { label: 'Pending', value: s.tasksPending, alert: false },
      { label: 'Meetings', value: s.meetings, alert: false },
      { label: 'Over capacity', value: f.overCapacity, alert: f.overCapacity > 0 },
      { label: 'Not planned', value: f.notPlanned, alert: false },
      { label: 'On leave', value: f.onLeave, alert: false },
    ];
  });
  protected readonly clockedTotal = computed(() =>
    this.members().reduce((sum, m) => sum + m.clockedMinutes, 0),
  );

  /** Rows keep the backend's order (ranked, then by name); a clock tick never re-sorts them. */
  protected readonly rows = computed(() => this.members().slice(0, this.plan().rows));

  protected readonly span = computed(() => {
    const data = this.store.data();
    return timelineSpan(data?.members ?? [], data?.date ?? '1970-01-01');
  });
  protected readonly ticks = computed(() => hourTicks(this.span()));
  /** The "2:00 PM" badge over the now line. */
  protected readonly nowText = computed(() =>
    this.now().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  );
  protected readonly nowLeft = computed(() => {
    const data = this.store.data();
    if (!data || this.store.date() !== null) return null;
    const t = this.now().toISOString();
    return (
      spanPosition(t, new Date(this.now().getTime() + 1).toISOString(), this.span())?.left ?? null
    );
  });
  /** The narrowest block (as % of the track) that still gets a label. */
  private readonly labelMinPercent = computed(() => {
    const track =
      this.size().width -
      SCHEDULE_CARD_CHROME.width -
      TIMELINE_NAME_PX -
      (this.plan().side ? SCHEDULE_SIDE_PX + 12 : 0);
    return track > 0 ? (BLOCK_LABEL_MIN_PX * 100) / track : 100;
  });

  protected readonly plannedActualRows = computed(() => toPlannedActualRows(this.members()));
  protected readonly daySummary = computed(() =>
    plannedActualTiles(summarizePlannedActual(this.plannedActualRows())),
  );
  protected readonly unscheduledTop = computed(() =>
    this.members()
      .filter((m) => unscheduledMinutes(m) > 0)
      .sort((a, b) => unscheduledMinutes(b) - unscheduledMinutes(a))
      .slice(0, SIDE_LIST),
  );
  protected readonly conflictsTop = computed(() =>
    this.members()
      .flatMap((m) => m.conflicts.map((c) => ({ member: m, conflict: c })))
      .slice(0, SIDE_LIST),
  );
  protected readonly weekDays = computed(() => {
    const week = this.weekStore.data();
    return week ? toWeekChartDays(week, this.store.today() ?? this.store.data()?.date ?? null) : null;
  });

  constructor() {
    // The week costs a request, so it loads only once the card first reaches the maximum size.
    effect(() => {
      if (!this.plan().weekChart || this.weekRequested) return;
      this.weekRequested = true;
      untracked(() => this.weekStore.load(null));
    });
  }

  ngOnInit(): void {
    this.feed.start();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startClock();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopClock();
    });
  }

  protected load(member: TeamScheduleMember): string {
    return loadText(member);
  }

  protected loadFill(member: TeamScheduleMember): number | null {
    return loadPercent(member);
  }

  protected loadColor(member: TeamScheduleMember): string {
    return loadColor(member);
  }

  protected over(member: TeamScheduleMember): boolean {
    return isOverCapacity(member);
  }

  protected onLeave(member: TeamScheduleMember): boolean {
    return isOnLeave(member);
  }

  protected notPlanned(member: TeamScheduleMember): boolean {
    return isNotPlanned(member);
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

  protected percent(part: number, whole: number): string {
    return formatPercent(part, whole);
  }

  /** Team Status has no meeting state: a working person whose meeting is on now reads "In meeting". */
  protected presenceLabel(member: TeamScheduleMember): string | null {
    if (inMeetingNow(member)) return 'In meeting';
    if (member.presenceStatus === 'on_break') return 'On break';
    if (member.presenceStatus === 'on_leave') return 'On leave';
    const state = member.presenceStatus ? presenceState(member.presenceStatus) : null;
    return state ? PRESENCE_LABELS[state] : null;
  }

  protected presenceColor(member: TeamScheduleMember): string | null {
    if (inMeetingNow(member)) return SCHEDULE_COLORS.meeting;
    const state = member.presenceStatus ? presenceState(member.presenceStatus) : null;
    return state ? PRESENCE_COLORS[state] : null;
  }


  protected position(startIso: string, endIso: string): { left: number; width: number } | null {
    return spanPosition(startIso, endIso, this.span());
  }

  protected breaks(member: TeamScheduleMember): { start: string; end: string }[] {
    return breakSegments(member, this.now());
  }

  protected itemColor(item: TeamScheduleItem): string {
    return itemColor(item);
  }

  protected itemTitle(item: TeamScheduleItem): string {
    return `${item.title} · ${itemStatusLabel(item)}`;
  }

  protected blockLabel(item: TeamScheduleItem, widthPercent: number): string | null {
    return this.plan().blockLabels && widthPercent >= this.labelMinPercent() ? item.title : null;
  }

  protected breakLabel(widthPercent: number): boolean {
    return this.plan().blockLabels && widthPercent >= this.labelMinPercent();
  }

  protected inConflict(member: TeamScheduleMember, item: TeamScheduleItem): boolean {
    return member.conflicts.some((c) => c.start < item.end && c.end > item.start);
  }

  /** Planner off: clocked time against the work window for the bar (capped); null without a window. */
  protected clockedShare(member: TeamScheduleMember): number | null {
    return member.expectedMinutes ? Math.min(100, (member.clockedMinutes * 100) / member.expectedMinutes) : null;
  }

  protected clockedText(member: TeamScheduleMember): string {
    return member.expectedMinutes
      ? `${minutesText(member.clockedMinutes)} / ${minutesText(member.expectedMinutes)}`
      : `${minutesText(member.clockedMinutes)} clocked`;
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
      this.startClock();
    } else {
      this.stopClock();
    }
  }

  private startClock(): void {
    if (this.clockId) return;
    this.clockId = setInterval(() => this.now.set(new Date()), CLOCK_TICK_MS);
  }

  private stopClock(): void {
    if (this.clockId) {
      clearInterval(this.clockId);
      this.clockId = null;
    }
  }
}
