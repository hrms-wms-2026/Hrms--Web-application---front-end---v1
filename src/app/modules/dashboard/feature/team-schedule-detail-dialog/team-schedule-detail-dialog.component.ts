import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
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
import { TeamScheduleWeekStore } from '../../state/team-schedule-week.store';
import { TeamScheduleStore } from '../../state/team-schedule.store';
import { PlannedActualDayChartComponent } from '../../ui/planned-actual-day-chart/planned-actual-day-chart.component';
import { PlannedActualWeekChartComponent } from '../../ui/planned-actual-week-chart/planned-actual-week-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { plannedActualTiles } from '../../utils/planned-actual-format.util';
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
  breakSegments,
  completionText,
  hasPlan,
  hourTicks,
  itemColor,
  itemDonut,
  itemStatusLabel,
  notRankedText,
  percentText,
  spanPosition,
  timelineSpan,
  toPlannedActualRows,
  toWeekChartDays,
  unscheduledMinutes,
  workloadLevel,
} from '../../utils/team-schedule-format.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Entries in the top-workload list. */
const TOP_WORKLOAD = 3;

export type ScheduleMode = 'day' | 'week';
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

/**
 * Today's team schedule popup (2026-11-02 design match section 7.5), in the Team Progress popup's shell. Day: the date
 * navigator, five item tiles, the main table (presence, workload level, timeline, planned, actual, completion), a side
 * column (summary donut, unscheduled work, conflicts, top workload), the execution ranking and the daily planned-vs-actual
 * chart. Week: planned / actual / coverage / unscheduled tiles against last week, the week chart and a per-person table.
 * A status filter and a search narrow both tables. Titles arrive masked ("Private meeting") from the backend and are used
 * as they are everywhere, CSV included. No "Add Schedule": a manager cannot plan for someone else.
 */
@Component({
  selector: 'app-team-schedule-detail-dialog',
  standalone: true,
  imports: [
    ModalComponent,
    KpiTilesComponent,
    AvatarComponent,
    PlannedActualDayChartComponent,
    PlannedActualWeekChartComponent,
  ],
  templateUrl: './team-schedule-detail-dialog.component.html',
  styleUrl: './team-schedule-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamScheduleDetailDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly store = inject(TeamScheduleStore);
  protected readonly weekStore = inject(TeamScheduleWeekStore);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly colors = SCHEDULE_COLORS;
  protected readonly filters = SCHEDULE_STATUS_FILTERS;
  readonly mode = signal<ScheduleMode>('day');
  readonly status = signal<ScheduleStatusFilter>('all');
  readonly search = signal('');

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

  // ---- Day ----

  protected readonly tiles = computed<KpiTile[]>(() => {
    const s = this.store.data()?.summary;
    if (!s) return [];
    const total = s.tasksPlanned + s.meetings;
    const of = (n: number) => formatPercent(n, total);
    return [
      { label: 'Total items', value: total, icon: 'clipboard-list', tone: 'accent', testId: 'tsd-tile-total' },
      { label: 'Completed', value: s.tasksCompleted, hint: of(s.tasksCompleted), icon: 'check-circle', tone: 'success', testId: 'tsd-tile-completed' },
      { label: 'In progress', value: s.tasksInProgress, hint: of(s.tasksInProgress), icon: 'clock', tone: 'accent', testId: 'tsd-tile-progress' },
      { label: 'Pending', value: s.tasksPending, hint: of(s.tasksPending), icon: 'layers', tone: 'warning', testId: 'tsd-tile-pending' },
      { label: 'Meetings', value: s.meetings, hint: of(s.meetings), icon: 'users', tone: 'neutral', testId: 'tsd-tile-meetings' },
    ];
  });

  protected readonly donut = computed(() => {
    const s = this.store.data()?.summary;
    return s ? itemDonut(s) : [];
  });
  protected readonly legend = computed(() => {
    const s = this.store.data()?.summary;
    if (!s) return [];
    const total = s.tasksPlanned + s.meetings;
    return [
      { key: 'completed', label: 'Completed', count: s.tasksCompleted, color: SCHEDULE_COLORS.completed },
      { key: 'inProgress', label: 'In progress', count: s.tasksInProgress, color: SCHEDULE_COLORS.inProgress },
      { key: 'pending', label: 'Pending', count: s.tasksPending, color: SCHEDULE_COLORS.pending },
      { key: 'meetings', label: 'Meetings', count: s.meetings, color: SCHEDULE_COLORS.meeting },
    ].map((row) => ({ ...row, percent: formatPercent(row.count, total) }));
  });
  protected readonly totalItems = computed(() => {
    const s = this.store.data()?.summary;
    return s ? s.tasksPlanned + s.meetings : 0;
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
  protected readonly ticks = computed(() => hourTicks(this.span()));

  protected readonly unscheduledRows = computed(() =>
    this.dayMembers().flatMap((m) => m.unscheduled.map((u) => ({ member: m, row: u }))),
  );
  protected readonly conflictRows = computed(() =>
    this.dayMembers().flatMap((m) => m.conflicts.map((c) => ({ member: m, row: c }))),
  );
  protected readonly topWorkload = computed(() => {
    const planned = (m: TeamScheduleMember) => m.plannedTaskMinutes + m.plannedMeetingMinutes;
    const rows = this.dayMembers()
      .filter((m) => planned(m) > 0)
      .sort((a, b) => planned(b) - planned(a) || a.displayName.localeCompare(b.displayName))
      .slice(0, TOP_WORKLOAD);
    const max = Math.max(1, ...rows.map(planned));
    return rows.map((m) => ({ member: m, minutes: planned(m), share: (planned(m) * 100) / max }));
  });
  protected readonly plannedActualRows = computed(() => toPlannedActualRows(this.dayMembers()));

  // ---- Week ----

  private readonly dayByEmployee = computed(
    () => new Map<string, TeamScheduleMember | undefined>((this.store.data()?.members ?? []).map((m) => [m.employeeId, m])),
  );

  protected readonly weekMembers = computed<TeamWeekMember[]>(() => {
    const search = this.search().trim().toLowerCase();
    const status = this.status();
    return (this.weekStore.data()?.members ?? []).filter((w) => {
      if (search !== '' && !w.displayName.toLowerCase().includes(search)) return false;
      if (status === 'all') return true;
      if (status === 'unscheduled') return w.unscheduledMinutes > 0;
      // Presence is today's: the week table follows the same person's status today.
      const today = this.dayByEmployee().get(w.employeeId);
      return today !== undefined && this.matchesStatus(today, status);
    });
  });

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

  protected hasPlan(m: TeamScheduleMember): boolean {
    return hasPlan(m);
  }

  protected unscheduled(m: TeamScheduleMember): number {
    return unscheduledMinutes(m);
  }

  protected actual(m: TeamScheduleMember): number {
    return m.scheduledMinutes + m.outsideSlotMinutes + m.noPlanMinutes;
  }

  protected workload(m: TeamScheduleMember): string | null {
    return workloadLevel(m);
  }

  protected reason(m: TeamScheduleMember): string {
    return notRankedText(m.notRankedReason);
  }

  protected presenceLabel(m: TeamScheduleMember): string | null {
    if (m.presenceStatus === 'on_break') return 'On break';
    if (m.presenceStatus === 'on_leave') return 'On leave';
    const state = m.presenceStatus ? presenceState(m.presenceStatus) : null;
    return state ? PRESENCE_LABELS[state] : null;
  }

  protected presenceColor(m: TeamScheduleMember): string | null {
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
