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
import { TeamWorkingHoursApiService } from '../../data-access/team-working-hours-api.service';
import { TeamTodayMember, TeamWorkingHoursResponse } from '../../models/my-team-today.model';
import { MyTeamTodayStore } from '../../state/my-team-today.store';
import { WorkingHoursChartComponent } from '../../ui/working-hours-chart/working-hours-chart.component';
import { DASHBOARD_DONUT_PX } from '../../utils/dashboard-donut.util';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import {
  PRESENCE_COLORS,
  PRESENCE_LABELS,
  clockTime,
  minutesSince,
  minutesText,
  neutralLine,
  orderPresence,
  presenceFromSummary,
  presenceState,
  timeLeft,
} from '../../utils/team-presence-format.util';

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
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly donutPx = DASHBOARD_DONUT_PX;
  protected readonly week = signal<TeamWorkingHoursResponse | null>(null);
  protected readonly weekError = signal(false);
  private weekSub: Subscription | null = null;

  protected readonly columns: DataTableColumn[] = [
    { key: 'name', label: 'Name', width: '24%' },
    { key: 'state', label: 'State', width: '14%' },
    { key: 'since', label: 'Since', width: '18%' },
    { key: 'elapsed', label: 'Elapsed', width: '10%' },
    { key: 'remaining', label: 'Remaining', width: '14%' },
    { key: 'attendance', label: 'Attendance', width: '10%', align: 'end' },
    { key: 'attention', label: 'Attention', width: '10%', wrap: true },
  ];
  protected readonly trackByMember = (m: TeamTodayMember): string => m.employeeId;

  protected readonly groups = computed(() => {
    const summary = this.store.data()?.summary;
    return summary ? presenceFromSummary(summary) : null;
  });

  protected readonly tiles = computed<KpiTile[]>(() => {
    const g = this.groups();
    if (!g) return [];
    return [
      {
        label: 'Working',
        value: g.working,
        icon: 'users',
        tone: 'accent',
        testId: 'wbld-tile-working',
      },
      {
        label: 'Break',
        value: g.onBreak,
        icon: 'clock',
        tone: 'warning',
        testId: 'wbld-tile-break',
      },
      {
        label: 'Leave',
        value: g.onLeave,
        hint: 'approved leave you can see',
        icon: 'layers',
        tone: 'danger',
        testId: 'wbld-tile-leave',
      },
      {
        label: 'Not clocked in',
        value: g.neutral.notClockedIn + g.neutral.absent,
        hint: neutralLine(g.neutral) || 'everyone is accounted for',
        icon: 'alert-triangle',
        tone: 'neutral',
        testId: 'wbld-tile-neutral',
      },
    ];
  });

  protected readonly legend = computed(() => {
    const g = this.groups();
    if (!g) return [];
    return [
      {
        key: 'working',
        label: PRESENCE_LABELS.working,
        count: g.working,
        color: PRESENCE_COLORS.working,
      },
      {
        key: 'break',
        label: PRESENCE_LABELS.break,
        count: g.onBreak,
        color: PRESENCE_COLORS.break,
      },
      {
        key: 'leave',
        label: PRESENCE_LABELS.leave,
        count: g.onLeave,
        color: PRESENCE_COLORS.leave,
      },
    ];
  });
  protected readonly donut = computed<DonutArc[]>(() => donutArcs(this.legend()));
  protected readonly members = computed(() => orderPresence(this.store.data()?.members ?? []));

  constructor() {
    // The week's working hours, fetched when the popup opens and again when the card's data refreshes.
    effect(() => {
      const open = this.open();
      const asOf = this.store.data()?.asOf;
      if (!open || !asOf) return;
      untracked(() => this.loadWeek());
    });
    inject(DestroyRef).onDestroy(() => this.weekSub?.unsubscribe());
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

  protected attendanceText(m: TeamTodayMember): string {
    return m.attendanceMinutes > 0 ? minutesText(m.attendanceMinutes) : '—';
  }

  protected attentionText(m: TeamTodayMember): string {
    return [m.isLate ? 'Late' : '', m.attentionLabel ?? ''].filter((s) => s.length > 0).join(' · ');
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
    this.weekSub = this.api.getWeek().subscribe({
      next: (week) => this.week.set(week),
      error: () => this.weekError.set(true),
    });
  }
}
