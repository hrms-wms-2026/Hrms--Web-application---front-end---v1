import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import {
  DataTableCellDirective,
  DataTableColumn,
  DataTableComponent,
} from '../../../../shared/ui/data-table/data-table.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import { TeamWorkingHoursApiService } from '../../data-access/team-working-hours-api.service';
import { TeamTodayMember, TeamWorkingHoursResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { DonutBreakdownComponent, DonutSlice } from '../../../../shared/ui/charts/donut-breakdown/donut-breakdown.component';
import { WorkingHoursChartComponent } from '../../ui/working-hours-chart/working-hours-chart.component';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  clockTime,
  minutesSince,
  minutesText,
  orderPresence,
  presenceFromSummary,
  presenceState,
  timeLeft,
  todayHoursText,
} from '../../utils/team-presence-format.util';
import { formatPercent } from '../../utils/team-progress-format.util';
import { WIDGET } from '../../../../shared/utils/widget-palette';

/** The Team Attendance widget's week rate (the same source, so the two widgets agree); 'error' drops the tile. */
type AttendanceRate = { readonly periodRate: number | null; readonly deltaPp: number | null } | 'error' | null;

/** The neutral statuses' slices: greys, darkest for the ones that worked today. */
/** The other slices of the 7-slice status donut, in shades between the presence ones (working shade1, leave shade2,
 * break shade3) so neighbours stay apart; absent is "bad", so maroon. */
const NEUTRAL_COLORS = { clockedOut: WIDGET.shade2b, notClockedIn: WIDGET.shade3b, absent: WIDGET.maroon, notScheduled: WIDGET.shade4 } as const;
/** Scheduled time nobody has worked yet today. */
const NOT_WORKED_COLOR = 'var(--color-widget-shade-4)';

/** Today's team minutes: worked, on break, on leave, and the rest of the work windows not worked yet. */
export function todayHours(members: readonly TeamTodayMember[], now: Date): Record<'worked' | 'break' | 'leave' | 'notWorked', number> {
  let worked = 0;
  let onBreak = 0;
  let leave = 0;
  let notWorked = 0;
  for (const m of members) {
    const breaks = m.breaks.reduce(
      (n, b) => n + Math.max(0, ((b.end ? new Date(b.end) : now).getTime() - new Date(b.start).getTime()) / 60_000),
      0,
    );
    worked += m.attendanceMinutes;
    onBreak += breaks;
    leave += m.leaveMinutes;
    if (m.expectedMinutes) notWorked += Math.max(0, m.expectedMinutes - m.attendanceMinutes - breaks);
  }
  return { worked, break: onBreak, leave, notWorked };
}

interface Banner {
  readonly key: 'leave' | 'break' | 'working';
  readonly text: string;
  readonly detail: string;
  readonly color: string;
}

/** Worked minutes per person with a record over a week; null without any record. */
function averageWorked(week: TeamWorkingHoursResponse | null): number | null {
  if (!week) return null;
  const records = week.days.reduce((n, d) => n + d.peopleWithRecord, 0);
  return records > 0 ? week.days.reduce((n, d) => n + d.workedMinutes, 0) / records : null;
}

function arrow(change: number): string {
  return change > 0 ? '↑' : change < 0 ? '↓' : '→';
}

function mondayBefore(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 7)).toISOString().slice(0, 10);
}

/**
 * The Working / Break / Leave popup, in the Team Progress popup's shell: one KPI tile row, the right-now donut, the
 * week's attendance working hours, and every member with what Team Status flagged (the attention column keeps what
 * the old Team Status card showed). CSV export carries a leave type only for members whose leave the viewer may see.
 */
@Component({
  selector: 'app-team-status-detail-dialog',
  standalone: true,
  imports: [
    ModalComponent,
    KpiTilesComponent,
    AvatarComponent,
    DataTableComponent,
    DataTableCellDirective,
    WorkingHoursChartComponent,
    DonutBreakdownComponent,
  ],
  templateUrl: './team-status-detail-dialog.component.html',
  styleUrl: './team-status-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamStatusDetailDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly store = inject(MyTeamTodayStore);
  private readonly api = inject(TeamWorkingHoursApiService);
  private readonly attendanceApi = inject(TeamAttendanceApiService);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly week = signal<TeamWorkingHoursResponse | null>(null);
  protected readonly weekError = signal(false);
  /** The week before, for "vs last week" on the average working time. */
  protected readonly lastWeek = signal<TeamWorkingHoursResponse | null>(null);
  protected readonly attendanceRate = signal<AttendanceRate>(null);
  private weekSub: Subscription | null = null;
  private lastWeekSub: Subscription | null = null;
  private rateSub: Subscription | null = null;

  protected readonly columns: DataTableColumn[] = [
    { key: 'rank', label: '#', width: '4%' },
    { key: 'name', label: 'Employee', width: '18%' },
    { key: 'state', label: 'Status', width: '11%' },
    { key: 'start', label: 'Start', width: '9%' },
    { key: 'elapsed', label: 'Elapsed', width: '8%' },
    { key: 'remaining', label: 'Remaining', width: '12%' },
    { key: 'todayHours', label: 'Today hours', width: '10%' },
    { key: 'progress', label: 'Progress', width: '14%' },
    { key: 'attention', label: 'Attention', width: '14%', wrap: true },
  ];
  protected readonly trackByMember = (m: TeamTodayMember): string => m.employeeId;

  protected readonly groups = computed(() => {
    const summary = this.store.data()?.summary;
    return summary ? presenceFromSummary(summary) : null;
  });

  protected readonly tiles = computed<KpiTile[]>(() => {
    const g = this.groups();
    const total = this.store.data()?.totalMembers ?? 0;
    if (!g) return [];
    const ofTeam = (n: number) => `${formatPercent(n, total)} of team`;
    const average = this.average();
    const tiles: KpiTile[] = [
      { label: 'Working', value: g.working, hint: ofTeam(g.working), icon: 'users', tone: 'accent', testId: 'wbld-tile-working' },
      { label: 'On break', value: g.onBreak, hint: ofTeam(g.onBreak), icon: 'clock', tone: 'warning', testId: 'wbld-tile-break' },
      { label: 'On leave', value: g.onLeave, hint: ofTeam(g.onLeave), icon: 'layers', tone: 'accent', testId: 'wbld-tile-leave' },
      {
        label: 'Avg working time',
        value: average === null ? '—' : minutesText(average),
        hint: this.averageChange() ?? 'per person with a record this week',
        icon: 'clock',
        tone: 'neutral',
        testId: 'wbld-tile-avg',
      },
    ];
    const rate = this.attendanceRate();
    if (rate !== 'error') {
      tiles.push({
        label: 'Attendance rate',
        value: rate === null || rate.periodRate === null ? '—' : formatPercent(rate.periodRate, 100),
        hint: rate === null ? 'Loading…' : rate.deltaPp === null ? 'this week' : `${arrow(rate.deltaPp)} ${Math.abs(Math.round(rate.deltaPp * 10) / 10)} pts vs last week`,
        icon: 'check-circle',
        tone: 'success',
        testId: 'wbld-tile-rate',
      });
    }
    return tiles;
  });

  /** This week's worked minutes per person with a record. */
  protected readonly average = computed(() => averageWorked(this.week()));
  /** "↑ 8% vs last week"; null until both weeks have an average. */
  protected readonly averageChange = computed(() => {
    const now = this.average();
    const before = averageWorked(this.lastWeek());
    if (now === null || before === null || before <= 0) return null;
    const change = Math.round(((now - before) * 1000) / before) / 10;
    return `${arrow(change)} ${Math.abs(change)}% vs last week`;
  });

  /** Only counts above zero get a banner: who is on leave, on a break, and how many are working. */
  protected readonly banners = computed<Banner[]>(() => {
    const g = this.groups();
    const total = this.store.data()?.totalMembers ?? 0;
    if (!g) return [];
    const names = (status: string) =>
      this.members()
        .filter((m) => m.status === status)
        .map((m) => m.displayName)
        .join(', ');
    const people = (n: number) => (n === 1 ? '1 employee is' : `${n} employees are`);
    const banners: Banner[] = [];
    if (g.onLeave > 0)
      banners.push({ key: 'leave', text: `${people(g.onLeave)} currently on leave`, detail: names('on_leave'), color: PRESENCE_COLORS.leave });
    if (g.onBreak > 0)
      banners.push({ key: 'break', text: `${people(g.onBreak)} on break`, detail: names('on_break'), color: PRESENCE_COLORS.break });
    if (g.working > 0)
      banners.push({
        key: 'working',
        text: `${people(g.working)} working`,
        detail: `${formatPercent(g.working, total)} of the team`,
        color: PRESENCE_COLORS.working,
      });
    return banners;
  });

  /** Everyone in the team, so the ring reads as shares of the whole team; neutral statuses only when present. */
  protected readonly statusSlices = computed<DonutSlice[]>(() => {
    const g = this.groups();
    if (!g) return [];
    const slice = (key: string, label: string, value: number, color: string): DonutSlice => ({
      key,
      label,
      value,
      valueText: String(value),
      color,
    });
    const neutral = [
      slice('clockedOut', 'Clocked out', g.neutral.clockedOut, NEUTRAL_COLORS.clockedOut),
      slice('notClockedIn', 'Not clocked in', g.neutral.notClockedIn, NEUTRAL_COLORS.notClockedIn),
      slice('absent', 'Absent', g.neutral.absent, NEUTRAL_COLORS.absent),
      slice('notScheduled', 'Not scheduled', g.neutral.notScheduled, NEUTRAL_COLORS.notScheduled),
    ].filter((s) => s.value > 0);
    return [
      slice('working', PRESENCE_LABELS.working, g.working, PRESENCE_COLORS.working),
      slice('break', PRESENCE_LABELS.break, g.onBreak, PRESENCE_COLORS.break),
      slice('leave', PRESENCE_LABELS.leave, g.onLeave, PRESENCE_COLORS.leave),
      ...neutral,
    ];
  });

  /** Today's minutes across the team; recomputed when the card's data refreshes. */
  private readonly hoursToday = computed(() => todayHours(this.store.data()?.members ?? [], new Date()));
  protected readonly hoursSlices = computed<DonutSlice[]>(() => {
    const h = this.hoursToday();
    const slice = (key: string, label: string, value: number, color: string): DonutSlice => ({
      key,
      label,
      value,
      valueText: minutesText(value),
      color,
    });
    return [
      slice('worked', 'Worked', h.worked, PRESENCE_COLORS.working),
      slice('break', 'Break', h.break, PRESENCE_COLORS.break),
      slice('leave', 'Leave', h.leave, PRESENCE_COLORS.leave),
      slice('notWorked', 'Not worked yet', h.notWorked, NOT_WORKED_COLOR),
    ];
  });
  protected readonly hoursWorkedText = computed(() => minutesText(this.hoursToday().worked));
  protected readonly hoursScheduledText = computed(() => {
    const h = this.hoursToday();
    const scheduled = h.worked + h.break + h.leave + h.notWorked;
    return scheduled > 0 ? `of ${minutesText(scheduled)}` : 'worked';
  });

  protected readonly members = computed(() => orderPresence(this.store.data()?.members ?? []));
  private readonly rankOf = computed(() => new Map(this.members().map((m, i) => [m.employeeId, i + 1])));

  constructor() {
    // The week's working hours, fetched when the popup opens and again when the card's data refreshes.
    effect(() => {
      const open = this.open();
      const asOf = this.store.data()?.asOf;
      if (!open || !asOf) return;
      untracked(() => this.loadWeek());
    });
    inject(DestroyRef).onDestroy(() => {
      this.weekSub?.unsubscribe();
      this.lastWeekSub?.unsubscribe();
      this.rateSub?.unsubscribe();
    });
  }

  protected stateLabel(m: TeamTodayMember): string {
    const state = presenceState(m.status);
    return state ? PRESENCE_LABELS[state] : m.statusLabel;
  }

  protected stateColor(m: TeamTodayMember): string | null {
    const state = presenceState(m.status);
    return state ? PRESENCE_COLORS[state] : null;
  }

  protected sinceText(m: TeamTodayMember): string {
    if (presenceState(m.status) === 'leave')
      return m.leave ? `${m.leave.leaveTypeName} · until ${m.leave.endsOn}` : '—';
    return m.stateSince ? clockTime(m.stateSince) : '—';
  }

  protected elapsedText(m: TeamTodayMember): string {
    return m.stateSince ? minutesText(minutesSince(m.stateSince, new Date())) : '—';
  }

  protected remainingText(m: TeamTodayMember): string {
    return timeLeft(m, new Date())?.text ?? '—';
  }

  protected rank(m: TeamTodayMember): number | undefined {
    return this.rankOf().get(m.employeeId);
  }

  protected startText(m: TeamTodayMember): string {
    if (m.clockInAt) return clockTime(m.clockInAt);
    return presenceState(m.status) === 'leave' ? 'All day' : '—';
  }

  protected todayHours(m: TeamTodayMember): string {
    return todayHoursText(m);
  }

  /** Attendance of the work window for the bar (capped); null without a window. */
  protected progress(m: TeamTodayMember): number | null {
    return m.expectedMinutes ? Math.min(100, (m.attendanceMinutes * 100) / m.expectedMinutes) : null;
  }

  protected progressText(m: TeamTodayMember): string {
    return m.expectedMinutes ? formatPercent(m.attendanceMinutes, m.expectedMinutes) : '—';
  }

  protected attendanceText(m: TeamTodayMember): string {
    return m.attendanceMinutes > 0 ? minutesText(m.attendanceMinutes) : '—';
  }

  protected attentionText(m: TeamTodayMember): string {
    return [m.isLate ? 'Late' : '', m.attentionLabel ?? ''].filter((s) => s.length > 0).join(' · ');
  }

  protected pct(part: number, whole: number): string {
    return formatPercent(part, whole);
  }

  protected avatarUrl(m: TeamTodayMember): string | null {
    return m.avatarFileId ? buildFileUrl(m.avatarFileId) : null;
  }

  close(): void {
    this.closed.emit();
  }

  retryWeek(): void {
    this.loadWeek();
  }

  /** The member table as shown, with spreadsheet-formula escaping. The leave column is empty unless Team Status sent a
   * leave block (the viewer is leave-authorized for that person); no leave reason exists anywhere. */
  exportCsv(): void {
    const data = this.store.data();
    if (!data) return;
    const now = new Date();
    const header = [
      'Name',
      'State',
      'Since',
      'Elapsed',
      'Remaining',
      'Attendance',
      'Start',
      'Today hours',
      'Progress',
      'Late',
      'Attention',
      'Leave type',
      'Leave until',
    ];
    const lines = this.members().map((m) => [
      m.displayName,
      this.stateLabel(m),
      m.stateSince ? clockTime(m.stateSince) : '',
      m.stateSince ? minutesText(minutesSince(m.stateSince, now)) : '',
      timeLeft(m, now)?.text ?? '',
      m.attendanceMinutes > 0 ? minutesText(m.attendanceMinutes) : '',
      m.clockInAt ? clockTime(m.clockInAt) : '',
      todayHoursText(m),
      m.expectedMinutes ? formatPercent(m.attendanceMinutes, m.expectedMinutes) : '',
      m.isLate ? 'Yes' : '',
      m.attentionLabel ?? '',
      m.leave ? m.leave.leaveTypeName : '',
      m.leave ? m.leave.endsOn : '',
    ]);
    this.downloadFile(`working-break-leave-${data.workDate}.csv`, toCsv([header, ...lines]));
  }

  private loadWeek(): void {
    this.weekSub?.unsubscribe();
    this.weekError.set(false);
    this.weekSub = this.api.getWeek(null).subscribe({
      next: (week) => {
        this.week.set(week);
        this.loadLastWeek(mondayBefore(week.weekStart));
      },
      error: () => this.weekError.set(true),
    });
    this.loadRate();
  }

  private loadLastWeek(weekStart: string): void {
    this.lastWeekSub?.unsubscribe();
    this.lastWeekSub = this.api.getWeek(weekStart).subscribe({
      next: (week) => this.lastWeek.set(week),
      error: () => this.lastWeek.set(null),
    });
  }

  /** The Team Attendance summary for this week: the same population and rate as that widget. */
  private loadRate(): void {
    this.rateSub?.unsubscribe();
    this.rateSub = this.attendanceApi.getSummary({ mode: 'week', anchor: null, departmentId: null }).subscribe({
      next: (summary) => this.attendanceRate.set({ periodRate: summary.periodRate, deltaPp: summary.deltaPp }),
      error: () => this.attendanceRate.set('error'),
    });
  }
}
