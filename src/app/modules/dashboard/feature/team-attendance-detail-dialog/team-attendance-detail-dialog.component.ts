import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { downloadCsv, toCsv } from '../../../../shared/utils/csv.util';
import { TeamAttendanceApiService } from '../../data-access/team-attendance-api.service';
import {
  TeamAttendanceBucket,
  TeamAttendanceEmployeeRow,
  TeamAttendanceEmployeesQuery,
  TeamAttendancePage
} from '../../models/team-attendance.model';
import { TeamAttendanceStore } from '../../state/team-attendance.store';
import { AttendanceDayChartComponent } from '../../ui/attendance-day-chart/attendance-day-chart.component';
import { DonutArc, donutArcs } from '../../utils/status-donut.util';
import {
  TEAM_ATTENDANCE_COLORS,
  TEAM_ATTENDANCE_LABELS,
  teamAttendanceDelta,
  teamAttendanceRangeLabel
} from '../../utils/team-attendance-format.util';

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Column header for a yyyy-MM-dd date: day number over a one-letter weekday, read in UTC. */
function dateHeader(iso: string): { day: number; weekday: string } {
  const [y, m, d] = iso.split('-').map(Number);
  return { day: d, weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

/**
 * The Team attendance widget's fourth view: the selected week or month in full. Period tiles count employee-days;
 * the matrix has one column per date of the period (7, or 28-31) and scrolls sideways with the name column pinned.
 * Period, mode and department are the card's own store state, so opening and closing never resets them.
 */
@Component({
  selector: 'app-team-attendance-detail-dialog',
  standalone: true,
  imports: [ModalComponent, KpiTilesComponent, AvatarComponent, InputComponent, SelectComponent, AttendanceDayChartComponent],
  templateUrl: './team-attendance-detail-dialog.component.html',
  styleUrl: './team-attendance-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamAttendanceDetailDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly store = inject(TeamAttendanceStore);
  private readonly api = inject(TeamAttendanceApiService);
  private readonly destroyRef = inject(DestroyRef);
  /** The file download; a field so a test can stand in for the browser download. */
  downloadFile = downloadCsv;

  protected readonly labels = TEAM_ATTENDANCE_LABELS;
  protected readonly search = signal('');
  protected readonly page = signal(1);
  protected readonly rows = signal<TeamAttendancePage<TeamAttendanceEmployeeRow> | null>(null);
  protected readonly rowsError = signal(false);
  protected readonly exporting = signal(false);
  protected readonly exportError = signal(false);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private rowsSub: Subscription | null = null;
  private periodKey = '';

  protected readonly rangeLabel = computed(() => {
    const data = this.store.data();
    return data ? teamAttendanceRangeLabel(data.mode, data.rangeStart, data.rangeEnd) : '';
  });

  protected readonly delta = computed(() => {
    const data = this.store.data();
    return data ? teamAttendanceDelta(data.deltaPp, data.mode) : null;
  });

  protected readonly dates = computed(() =>
    (this.store.data()?.trend ?? []).map((p) => ({ date: p.date, ...dateHeader(p.date) }))
  );

  protected readonly departmentOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All departments' },
    ...(this.store.data()?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))
  ]);

  protected readonly tiles = computed<KpiTile[]>(() => {
    const data = this.store.data();
    if (!data) return [];
    const c = data.periodCounts;
    const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
    return [
      { label: 'Team', value: data.teamSize, hint: 'people', icon: 'users', tone: 'neutral', testId: 'tad-tile-team' },
      { label: 'Present', value: days(c.present), hint: this.share(c.present), icon: 'check-circle', tone: 'success', testId: 'tad-tile-present' },
      { label: 'Absent', value: days(c.absent), hint: this.share(c.absent), icon: 'alert-triangle', tone: 'danger', testId: 'tad-tile-absent' },
      { label: 'Late', value: days(c.late), hint: this.share(c.late), icon: 'clock', tone: 'warning', testId: 'tad-tile-late' },
      { label: 'On leave', value: days(c.onLeave), hint: 'not counted in the rate', icon: 'users', tone: 'accent', testId: 'tad-tile-leave' }
    ];
  });

  protected readonly distribution = computed<{ arcs: DonutArc[]; rows: { key: string; label: string; count: number; color: string }[] }>(() => {
    const c = this.store.data()?.periodCounts;
    if (!c) return { arcs: [], rows: [] };
    const rows = [
      { key: 'present', label: 'Present', count: c.present, color: TEAM_ATTENDANCE_COLORS.present },
      { key: 'absent', label: 'Absent', count: c.absent, color: TEAM_ATTENDANCE_COLORS.absent },
      { key: 'late', label: 'Late', count: c.late, color: TEAM_ATTENDANCE_COLORS.late },
      { key: 'leave', label: 'On leave', count: c.onLeave, color: TEAM_ATTENDANCE_COLORS.leave }
    ];
    return { arcs: donutArcs(rows), rows };
  });

  constructor() {
    // Reload the matrix for the shown period, department, search and page; a new period starts at page 1.
    effect(() => {
      const data = this.store.data();
      const departmentId = this.store.query().departmentId;
      const search = this.search();
      const page = this.page();
      if (!this.open() || !data) return;
      const key = `${data.mode}|${data.rangeStart}|${departmentId ?? ''}|${search}`;
      if (key !== this.periodKey) {
        this.periodKey = key;
        if (page !== 1) {
          this.page.set(1);
          return;
        }
      }
      untracked(() => this.loadRows({ mode: data.mode, anchor: data.rangeStart, departmentId, search, page, pageSize: PAGE_SIZE }));
    });

    this.destroyRef.onDestroy(() => {
      this.rowsSub?.unsubscribe();
      if (this.searchTimer) clearTimeout(this.searchTimer);
    });
  }

  onSearch(value: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.search.set(value.trim());
    }, SEARCH_DEBOUNCE_MS);
  }

  onDepartment(value: string): void {
    this.store.setDepartment(value || null);
  }

  onModeSelect(value: string): void {
    if (value === 'week' || value === 'month') this.store.setMode(value);
  }

  shift(step: -1 | 1): void {
    this.store.shift(step);
  }

  goToPage(page: number): void {
    const total = this.rows()?.totalPages ?? 1;
    this.page.set(Math.min(Math.max(1, page), Math.max(1, total)));
  }

  /** The department filter is a dialog-only refinement: clear it, so the card goes back to the whole team. */
  close(): void {
    if (this.store.query().departmentId !== null) this.store.setDepartment(null);
    this.closed.emit();
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  protected percentText(rate: number | null): string {
    return rate === null ? '—' : `${rate}%`;
  }

  protected cellLabel(bucket: TeamAttendanceBucket): string {
    return this.labels[bucket];
  }

  /** Every page of the current period, department and search as CSV, with spreadsheet-formula escaping. */
  async exportCsv(): Promise<void> {
    const data = this.store.data();
    if (!data || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(false);
    try {
      const base: Omit<TeamAttendanceEmployeesQuery, 'page'> = {
        mode: data.mode,
        anchor: data.rangeStart,
        departmentId: this.store.query().departmentId,
        search: this.search(),
        pageSize: EXPORT_PAGE_SIZE
      };
      const items: TeamAttendanceEmployeeRow[] = [];
      for (let page = 1; ; page++) {
        const result = await firstValueFrom(this.api.getEmployees({ ...base, page }));
        items.push(...result.items);
        if (page >= result.totalPages || result.items.length === 0) break;
      }
      const header = ['Name', 'Department', ...data.trend.map((p) => p.date), 'Attended', 'Eligible days', 'Rate %'];
      const lines = items.map((r) => [
        r.name,
        r.department ?? '',
        ...r.days.map((d) => this.labels[d.bucket]),
        String(r.attended),
        String(r.eligibleDays),
        r.rate === null ? '' : String(r.rate)
      ]);
      this.downloadFile(`team-attendance-${data.rangeStart}_${data.rangeEnd}.csv`, toCsv([header, ...lines]));
    } catch {
      this.exportError.set(true);
    } finally {
      this.exporting.set(false);
    }
  }

  private share(n: number): string {
    const c = this.store.data()?.periodCounts;
    const total = c ? c.present + c.late + c.absent + c.onLeave : 0;
    return total > 0 ? `${Math.round((n * 100) / total)}% of days` : '—';
  }

  private loadRows(query: TeamAttendanceEmployeesQuery): void {
    this.rowsSub?.unsubscribe();
    this.rowsError.set(false);
    this.rowsSub = this.api.getEmployees(query).subscribe({
      next: (page) => this.rows.set(page),
      error: () => this.rowsError.set(true)
    });
  }
}
