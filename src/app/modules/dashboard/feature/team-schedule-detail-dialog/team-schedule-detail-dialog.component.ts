import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { ClockService, injectNow } from '../../../../core/clock/clock.service';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import {
  TeamScheduleItem,
  TeamScheduleMember,
  TeamWeekMember,
  TeamWeekTotals,
} from '../../models/team-schedule.model';
import { injectPopupSectionFocus } from '../../utils/popup-section-focus.util';
import { TeamScheduleWeekStore } from '../../state/team-schedule-week.store';
import { listPage } from '../../utils/list-page.util';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { PlannedActualWeekChartComponent } from '../../ui/planned-actual-week-chart/planned-actual-week-chart.component';
import {
  PLANNED_ACTUAL_COLORS,
  actualOf,
  plannedActualScale,
  plannedActualShare,
  plannedActualTiles,
} from '../../utils/planned-actual-format.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  clockTime,
  minutesText,
  presenceState,
} from '../../utils/team-presence-format.util';
import { formatPercent } from '../../utils/team-progress-format.util';
import {
  SCHEDULE_COLORS,
  toPlannedActualRows,
  breakSegments,
  capacityMinutes,
  completionText,
  hasPlan,
  hourTicks,
  isNotPlanned,
  inMeetingNow,
  isOnLeave,
  isOverCapacity,
  itemColor,
  itemStatusLabel,
  loadColor,
  loadMinutes,
  loadPercent,
  loadText,
  notRankedText,
  percentText,
  spanPosition,
  timelineSpan,
  toWeekChartDays,
  unscheduledMinutes,
  scheduleFlags,
  scheduleHours,
} from '../../utils/team-schedule-format.util';

interface RankBar {
  planned: number;
  scheduled: number;
  outside: number;
  noPlan: number;
  tooltip: string;
}

interface DiffText {
  text: string;
  behind: boolean;
  ahead: boolean;
}

/** Actual minus planned as "+1h 10m" (ahead), "−2h" (behind) or "0m". */
function diffText(diff: number): DiffText {
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
  return { text: sign + minutesText(Math.abs(diff)), behind: diff < 0, ahead: diff > 0 };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Entries in the top-workload list. */
const TOP_WORKLOAD = 3;

export type ScheduleMode = 'day' | 'week';

/** Summary-card sections that live in the week view. */
const WEEK_SECTIONS: ReadonlySet<string> = new Set(['coverage', 'planned-actual']);
export type ScheduleStatusFilter = 'all' | 'working' | 'in_meeting' | 'on_break' | 'on_leave' | 'unscheduled';

export const SCHEDULE_STATUS_FILTERS: { value: ScheduleStatusFilter; label: string }[] = [
  { value: 'all', label: 'All status' },
  { value: 'working', label: 'Working' },
  { value: 'in_meeting', label: 'In meeting' },
  { value: 'on_break', label: 'On break' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'unscheduled', label: 'Unscheduled' },
];

function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function arrow(change: number): string {
  return change > 0 ? '↑' : change < 0 ? '↓' : '→';
}

/** Rows per page in every per-person list of the popup. */
export const SCHEDULE_LIST_PAGE_SIZE = 10;

/** The popup's paged lists, each with its own page. */
export type ScheduleList = 'table' | 'ranking' | 'week';

const FIRST_PAGES: Record<ScheduleList, number> = { table: 1, ranking: 1, week: 1 };

/**
 * Today's team schedule popup (2026-11-02 design match section 7.5), in the Team Progress popup's shell. Day: the date
 * navigator, five hours tiles, the main table (presence, workload level, timeline, planned, actual, completion), a side
 * column (summary donut, unscheduled work, conflicts, top workload), the execution ranking and the daily planned-vs-actual
 * chart. Week: planned / actual / coverage / unscheduled tiles against last week, the week chart and a per-person table.
 * A status filter and a search narrow both tables. Titles arrive masked ("Private meeting") from the backend and are used
 * as they are everywhere, CSV included. No "Add Schedule": a manager cannot plan for someone else.
 */
const MAX_AXIS_LABELS = 7;

@Component({
  selector: 'app-team-schedule-detail-dialog',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    ModalComponent,
    KpiTilesComponent,
    AvatarComponent,
    PlannedActualWeekChartComponent,
  ],
  templateUrl: './team-schedule-detail-dialog.component.html',
  styleUrl: './team-schedule-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamScheduleDetailDialogComponent {
  readonly open = input(false);
  /** Opened from a summary card: the section to scroll to. Coverage and planned-actual live in the week view. */
  readonly focusSection = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly store = inject(TeamScheduleStore);
  protected readonly weekStore = inject(TeamScheduleWeekStore);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly colors = SCHEDULE_COLORS;
  protected readonly paColors = PLANNED_ACTUAL_COLORS;
  protected readonly filters = SCHEDULE_STATUS_FILTERS;
  readonly mode = signal<ScheduleMode>('day');
  readonly status = signal<ScheduleStatusFilter>('all');
  readonly search = signal('');
  readonly pages = signal<Record<ScheduleList, number>>(FIRST_PAGES);

  protected readonly isToday = computed(() => this.store.date() === null);
  protected readonly isCurrentWeek = computed(() => this.weekStore.weekStart() === null);
  protected readonly atLatest = computed(() => (this.mode() === 'day' ? this.isToday() : this.isCurrentWeek()));

  protected readonly dateLabel = computed(() => {
    if (this.mode() === 'week') {
      const week = this.weekStore.data();
      if (!week) return 'This week';
      return `${this.isCurrentWeek() ? 'This week · ' : ''}${dayLabel(week.weekStart)} – ${dayLabel(week.weekEnd)}`;
    }
    const date = this.store.data()?.date;
    if (!date) return '';
    return `${this.isToday() ? 'Today · ' : ''}${dayLabel(date)}`;
  });

  constructor() {
    // A summary card for a week section opens the week view; one for a day section, the day view.
    effect(() => {
      const section = this.focusSection();
      if (!this.open() || !section) return;
      untracked(() => this.setMode(WEEK_SECTIONS.has(section) ? 'week' : 'day'));
    });
    injectPopupSectionFocus(this.open, this.focusSection);
    // A new filter, search, day or week starts every list on its first page.
    effect(() => {
      this.search();
      this.status();
      this.store.data();
      this.weekStore.data();
      untracked(() => this.pages.set(FIRST_PAGES));
    });

    // The now line is current the moment the popup opens, then moves with the shared minute clock.
    const clock = inject(ClockService);
    effect(() => {
      if (this.open()) untracked(() => clock.refresh());
    });
  }

  protected goToPage(list: ScheduleList, page: number): void {
    this.pages.update((p) => ({ ...p, [list]: page }));
  }

  // ---- Day ----

  /** Today's items: tasks by status plus meetings, each tile with its share of the total. */
  /** Hour tiles (2026-11-05): today's planned time by status over everyone, % of the planned total. */
  protected readonly tiles = computed<KpiTile[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const h = scheduleHours(data.members);
    const of = (n: number) => formatPercent(n, h.total);
    return [
      { label: 'Planned hours', value: minutesText(h.total), icon: 'clipboard-list', tone: 'accent', testId: 'tsd-tile-total' },
      { label: 'Completed hours', value: minutesText(h.completed), hint: of(h.completed), icon: 'check-circle', tone: 'success', testId: 'tsd-tile-completed' },
      { label: 'In progress', value: minutesText(h.inProgress), hint: of(h.inProgress), icon: 'clock', tone: 'accent', testId: 'tsd-tile-progress' },
      { label: 'Pending', value: minutesText(h.pending), hint: of(h.pending), icon: 'layers', tone: 'warning', testId: 'tsd-tile-pending' },
      { label: 'Meeting hours', value: minutesText(h.meetings), hint: of(h.meetings), icon: 'users', tone: 'neutral', testId: 'tsd-tile-meetings' },
    ];
  });

  /** The side column's summary list: counted over everyone, whatever the filter. */
  protected readonly summaryRows = computed(() => {
    const data = this.store.data();
    if (!data) return [];
    const s = data.summary;
    const f = scheduleFlags(data.members);
    return [
      { label: 'People', value: s.people, alert: false },
      { label: 'Tasks planned', value: s.tasksPlanned, alert: false },
      { label: 'Meetings', value: s.meetings, alert: false },
      { label: 'Over capacity', value: f.overCapacity, alert: f.overCapacity > 0 },
      { label: 'Not planned', value: f.notPlanned, alert: false },
      { label: 'On leave', value: f.onLeave, alert: false },
    ];
  });

  /** The day's members after the status filter and the search; the backend's order is kept. */
  protected readonly dayMembers = computed(() => {
    const search = this.search().trim().toLowerCase();
    const status = this.status();
    return (this.store.data()?.members ?? []).filter(
      (m) => this.matchesStatus(m, status) && (search === '' || m.displayName.toLowerCase().includes(search)),
    );
  });

  protected readonly span = computed(() => {
    const data = this.store.data();
    return timelineSpan(data?.members ?? [], data?.date ?? '1970-01-01');
  });
  /** At most 7 hour labels: the schedule column is about 320-600px wide, room for 7 "09:00" labels. */
  protected readonly ticks = computed(() => hourTicks(this.span(), MAX_AXIS_LABELS));
  /** The clock for the now line; moves every minute. */
  private readonly minute = injectNow('minute');
  protected readonly now = computed(() => new Date(this.minute()));
  /** The now line's position (% of the track) on today's table; null on another day or outside the span. */
  protected readonly nowLeft = computed(() => {
    if (!this.isToday() || !this.store.data()) return null;
    const t = this.now();
    return spanPosition(t.toISOString(), new Date(t.getTime() + 1).toISOString(), this.span())?.left ?? null;
  });
  /** The "2:05 PM" badge over the now line. */
  protected readonly nowText = computed(() =>
    this.now().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  );

  protected readonly unscheduledRows = computed(() =>
    this.dayMembers().flatMap((m) => m.unscheduled.map((u) => ({ member: m, row: u }))),
  );
  protected readonly conflictRows = computed(() =>
    this.dayMembers().flatMap((m) => m.conflicts.map((c) => ({ member: m, row: c }))),
  );
  /** The most loaded people: load as a share of their capacity (or of the top load without a work window). */
  protected readonly topWorkload = computed(() => {
    const rows = this.dayMembers()
      .filter((m) => loadMinutes(m) > 0 && !isOnLeave(m))
      .sort((a, b) => loadMinutes(b) - loadMinutes(a) || a.displayName.localeCompare(b.displayName))
      .slice(0, TOP_WORKLOAD);
    const max = Math.max(1, ...rows.map(loadMinutes));
    return rows.map((m) => {
      const capacity = capacityMinutes(m);
      const percent = capacity ? Math.round((loadMinutes(m) * 100) / capacity) : null;
      return {
        member: m,
        text: percent === null ? minutesText(loadMinutes(m)) : `${percent}% · ${minutesText(loadMinutes(m))}`,
        share: loadPercent(m) ?? (loadMinutes(m) * 100) / max,
        over: isOverCapacity(m),
        color: loadColor(m),
      };
    });
  });
  protected readonly tablePage = computed(() => listPage(this.dayMembers(), this.pages().table, SCHEDULE_LIST_PAGE_SIZE));
  protected readonly rankingPage = computed(() => listPage(this.dayMembers(), this.pages().ranking, SCHEDULE_LIST_PAGE_SIZE));
  /** The ranking's planned-vs-actual double bar per person: planned over actual (in plan / outside slot / no plan),
      both against the page's largest of planned and actual, so overtime never draws past its track. */
  protected readonly rankBars = computed(() => {
    const rows = toPlannedActualRows(this.rankingPage().items);
    const scale = plannedActualScale(rows);
    const bars: Record<string, RankBar | undefined> = {};
    for (const r of rows) {
      bars[r.id] = {
        planned: plannedActualShare(r.planned, scale),
        scheduled: plannedActualShare(r.scheduled, scale),
        outside: plannedActualShare(r.outside, scale),
        noPlan: plannedActualShare(r.noPlan, scale),
        tooltip:
          `Planned ${minutesText(r.planned)} · actual ${minutesText(actualOf(r))} ` +
          `(${minutesText(r.scheduled)} in plan, ${minutesText(r.outside)} outside slot, ${minutesText(r.noPlan)} no plan)`,
      };
    }
    return bars;
  });

  // ---- Week ----

  private readonly dayByEmployee = computed(
    () => new Map<string, TeamScheduleMember | undefined>((this.store.data()?.members ?? []).map((m) => [m.employeeId, m])),
  );

  /** Week ranking (2026-11-05): by coverage, highest first, over everyone whatever the filter; no coverage = unranked. */
  protected readonly weekRanks = computed(() => {
    const ranked = (this.weekStore.data()?.members ?? [])
      .filter((w) => w.coveragePercent !== null)
      .sort((a, b) => (b.coveragePercent ?? 0) - (a.coveragePercent ?? 0) || a.displayName.localeCompare(b.displayName));
    return new Map<string, number | undefined>(ranked.map((w, i) => [w.employeeId, i + 1]));
  });

  protected weekRank(w: TeamWeekMember): number | null {
    return this.weekRanks().get(w.employeeId) ?? null;
  }

  protected readonly weekMembers = computed<TeamWeekMember[]>(() => {
    const search = this.search().trim().toLowerCase();
    const status = this.status();
    const ranks = this.weekRanks();
    const order = (w: TeamWeekMember) => ranks.get(w.employeeId) ?? Number.MAX_SAFE_INTEGER;
    return (this.weekStore.data()?.members ?? []).filter((w) => {
      if (search !== '' && !w.displayName.toLowerCase().includes(search)) return false;
      if (status === 'all') return true;
      if (status === 'unscheduled') return w.unscheduledMinutes > 0;
      // Presence is today's: the week table follows the same person's status today.
      const today = this.dayByEmployee().get(w.employeeId);
      return today !== undefined && this.matchesStatus(today, status);
    }).sort((a, b) => order(a) - order(b));
  });

  protected readonly weekPage = computed(() => listPage(this.weekMembers(), this.pages().week, SCHEDULE_LIST_PAGE_SIZE));

  /** The week's planned-vs-actual double bar: planned over actual (in plan / unscheduled), against the page's largest. */
  protected readonly weekBars = computed(() => {
    const rows = this.weekPage().items;
    const scale = Math.max(1, ...rows.map((w) => Math.max(w.plannedMinutes, w.scheduledMinutes + w.unscheduledMinutes)));
    const bars: Record<string, RankBar | undefined> = {};
    for (const w of rows) {
      bars[w.employeeId] = {
        planned: plannedActualShare(w.plannedMinutes, scale),
        scheduled: plannedActualShare(w.scheduledMinutes, scale),
        outside: plannedActualShare(w.unscheduledMinutes, scale),
        noPlan: 0,
        tooltip:
          `Planned ${minutesText(w.plannedMinutes)} · actual ${minutesText(w.clockedMinutes)} ` +
          `(${minutesText(w.scheduledMinutes)} in plan, ${minutesText(w.unscheduledMinutes)} unscheduled)`,
      };
    }
    return bars;
  });

  /** Week actual minus planned, like the day's difference; null without a planner or with neither. */
  protected weekDifference(w: TeamWeekMember, plannerEnabled: boolean): DiffText | null {
    if (!plannerEnabled || (w.plannedMinutes === 0 && w.clockedMinutes === 0)) return null;
    return diffText(w.clockedMinutes - w.plannedMinutes);
  }

  protected readonly weekTiles = computed<KpiTile[]>(() => {
    const week = this.weekStore.data();
    if (!week) return [];
    const summary = (t: TeamWeekTotals) => ({
      planned: t.plannedMinutes,
      actual: t.clockedMinutes,
      inPlanPercent: t.coveragePercent,
      unscheduled: t.unscheduledMinutes,
    });
    const tiles = plannedActualTiles(summary(week.totals), summary(week.previous));
    const coverage = week.totals.coveragePercent;
    const before = week.previous.coveragePercent;
    tiles[2] = {
      label: 'Coverage',
      value: coverage === null ? '—' : `${coverage}%`,
      hint:
        coverage !== null && before !== null
          ? `${arrow(coverage - before)} ${Math.abs(Math.round((coverage - before) * 10) / 10)} pts vs last week`
          : 'of the planned time so far',
      icon: 'check-circle',
      tone: 'success',
      testId: 'tsd-tile-coverage',
    };
    return tiles;
  });

  protected readonly weekDays = computed(() => {
    const week = this.weekStore.data();
    return week ? toWeekChartDays(week, this.store.today()) : null;
  });

  protected readonly weekClocked = computed(() => this.weekStore.data()?.totals.clockedMinutes ?? 0);

  // ---- Helpers ----

  private matchesStatus(m: TeamScheduleMember, status: ScheduleStatusFilter): boolean {
    switch (status) {
      case 'all':
        return true;
      case 'unscheduled':
        return unscheduledMinutes(m) > 0;
      case 'in_meeting':
        return m.items.some((i) => i.kind === 'meeting' && i.status === 'in_meeting');
      default:
        return m.presenceStatus === status;
    }
  }

  protected position(startIso: string, endIso: string): { left: number; width: number } | null {
    return spanPosition(startIso, endIso, this.span());
  }

  protected breaks(m: TeamScheduleMember): { start: string; end: string }[] {
    return breakSegments(m, new Date());
  }

  protected itemColor(item: TeamScheduleItem): string {
    return itemColor(item);
  }

  protected itemTitle(item: TeamScheduleItem): string {
    return `${item.title} · ${clockTime(item.start)}-${clockTime(item.end)} · ${itemStatusLabel(item)}`;
  }

  protected range(startIso: string, endIso: string): string {
    return `${clockTime(startIso)}–${clockTime(endIso)}`;
  }

  protected minutes(m: number): string {
    return minutesText(m);
  }

  protected percent(value: number | null): string {
    return percentText(value);
  }

  protected completion(m: TeamScheduleMember): string {
    return completionText(m);
  }

  protected load(m: TeamScheduleMember): string {
    return loadText(m);
  }

  protected loadFill(m: TeamScheduleMember): number | null {
    return loadPercent(m);
  }

  protected loadColor(m: TeamScheduleMember): string {
    return loadColor(m);
  }

  protected over(m: TeamScheduleMember): boolean {
    return isOverCapacity(m);
  }

  protected onLeave(m: TeamScheduleMember): boolean {
    return isOnLeave(m);
  }

  protected notPlanned(m: TeamScheduleMember): boolean {
    return isNotPlanned(m);
  }

  /** The person's plan in the team planner. */
  protected planParams(m: TeamScheduleMember): Record<string, string> {
    return { scope: 'team', teamView: 'day', person: m.employeeId };
  }

  protected hasPlan(m: TeamScheduleMember): boolean {
    return hasPlan(m);
  }

  protected unscheduled(m: TeamScheduleMember): number {
    return unscheduledMinutes(m);
  }

  protected actual(m: TeamScheduleMember): number {
    return m.scheduledMinutes + m.outsideSlotMinutes + m.noPlanMinutes;
  }

  protected planned(m: TeamScheduleMember): number {
    return m.plannedTaskMinutes + m.plannedMeetingMinutes;
  }

  /** Actual minus planned: "+1h 10m" ahead, "−2h" behind, "0m" on plan; null ("—") without a planner, on leave or with neither. */
  protected difference(m: TeamScheduleMember, plannerEnabled: boolean): DiffText | null {
    if (!plannerEnabled || this.onLeave(m)) return null;
    const planned = this.planned(m);
    const actual = this.actual(m);
    if (planned === 0 && actual === 0) return null;
    return diffText(actual - planned);
  }


  protected reason(m: TeamScheduleMember): string {
    return notRankedText(m.notRankedReason);
  }

  /** Team Status has no meeting state: a working person whose meeting is on now reads "In meeting". */
  protected presenceLabel(m: TeamScheduleMember): string | null {
    if (inMeetingNow(m)) return 'In meeting';
    if (m.presenceStatus === 'on_break') return 'On break';
    if (m.presenceStatus === 'on_leave') return 'On leave';
    const state = m.presenceStatus ? presenceState(m.presenceStatus) : null;
    return state ? PRESENCE_LABELS[state] : null;
  }

  protected presenceColor(m: TeamScheduleMember): string | null {
    if (inMeetingNow(m)) return SCHEDULE_COLORS.meeting;
    const state = m.presenceStatus ? presenceState(m.presenceStatus) : null;
    return state ? PRESENCE_COLORS[state] : null;
  }


  protected avatarUrl(m: { avatarFileId: string | null }): string | null {
    return m.avatarFileId ? buildFileUrl(m.avatarFileId) : null;
  }

  setMode(mode: ScheduleMode): void {
    this.mode.set(mode);
    if (mode === 'week' && !this.weekStore.data() && !this.weekStore.loading()) this.weekStore.load(null);
  }

  setStatus(status: ScheduleStatusFilter): void {
    this.status.set(status);
  }

  setSearch(text: string): void {
    this.search.set(text);
  }

  protected onStatusSelect(event: Event): void {
    this.setStatus((event.target as HTMLSelectElement).value as ScheduleStatusFilter);
  }

  protected onSearchInput(event: Event): void {
    this.setSearch((event.target as HTMLInputElement).value);
  }

  shift(step: -1 | 1): void {
    if (step === 1 && this.atLatest()) return;
    if (this.mode() === 'day') this.store.shiftDay(step);
    else this.weekStore.shiftWeek(step);
  }

  close(): void {
    this.closed.emit();
  }

  /** The shown mode's table, one row per person. Titles as the backend sent them ("Private meeting"). */
  exportCsv(): void {
    if (this.mode() === 'week') {
      this.exportWeekCsv();
      return;
    }
    const data = this.store.data();
    if (!data) return;
    const header = [
      'Name',
      'Planned task min',
      'Planned meeting min',
      'Clocked min',
      'Scheduled min',
      'Outside slot min',
      'No plan min',
      'Item completion %',
      'Time coverage %',
      'Execution score (today)',
      'Rank',
      'Not ranked',
      'Items',
    ];
    const lines = this.dayMembers().map((m) => [
      m.displayName,
      String(m.plannedTaskMinutes),
      String(m.plannedMeetingMinutes),
      String(m.clockedMinutes),
      data.plannerEnabled ? String(m.scheduledMinutes) : '',
      data.plannerEnabled ? String(m.outsideSlotMinutes) : '',
      data.plannerEnabled ? String(m.noPlanMinutes) : '',
      m.itemCompletionPercent === null ? '' : String(m.itemCompletionPercent),
      m.timeCoveragePercent === null ? '' : String(m.timeCoveragePercent),
      m.score === null ? '' : String(m.score),
      m.rank === null ? '' : String(m.rank),
      notRankedText(m.notRankedReason),
      m.items.map((i) => `${i.title} (${itemStatusLabel(i)})`).join('; '),
    ]);
    this.downloadFile(`team-schedule-${data.date}.csv`, toCsv([header, ...lines]));
  }

  private exportWeekCsv(): void {
    const week = this.weekStore.data();
    if (!week) return;
    const header = ['Name', 'Planned min', 'Actual min', 'In plan min', 'Unscheduled min', 'Coverage %'];
    const lines = this.weekMembers().map((m) => [
      m.displayName,
      week.plannerEnabled ? String(m.plannedMinutes) : '',
      String(m.clockedMinutes),
      week.plannerEnabled ? String(m.scheduledMinutes) : '',
      week.plannerEnabled ? String(m.unscheduledMinutes) : '',
      m.coveragePercent === null ? '' : String(m.coveragePercent),
    ]);
    this.downloadFile(`team-week-${week.weekStart}.csv`, toCsv([header, ...lines]));
  }
}
