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
import { DashboardBarChip } from '../../ui/dashboard-bar-chart/dashboard-bar-chart.component';
import { AttendanceDayChartComponent } from '../../ui/attendance-day-chart/attendance-day-chart.component';
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
 * The Team attendance widget's popup, in the Team Progress popup's shell: the selected week or month in full,
 * with the employee matrix ranked by attendance rate. Period tiles count employee-days;
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

  /** The change against the previous period, as the chart headline's pill. */
  protected readonly deltaChip = computed<DashboardBarChip | null>(() => {
    const d = this.delta();
    return d ? { text: d.text, tone: d.down ? 'down' : 'up' } : null;
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

  /** Department comparison bars: width = rate, coloured green from 90%, amber from 75%, else red. */
  protected readonly departmentBars = computed(() =>
    // Worst rate first so problem departments sit at the top; departments with no rate (all on leave) go last.
    [...(this.store.data()?.departmentRates ?? [])]
      .sort((a, b) => {
        if (a.rate === null || b.rate === null) {
          return a.rate === b.rate ? a.name.localeCompare(b.name) : a.rate === null ? 1 : -1;
        }
        return a.rate - b.rate || a.name.localeCompare(b.name);
      })
      .map((d) => ({
      key: d.id ?? 'none',
      name: d.name,
      people: d.people,
      rate: d.rate,
      width: d.rate ?? 0,
      color:
        d.rate === null
          ? TEAM_ATTENDANCE_COLORS.leave
          : d.rate >= 90
            ? TEAM_ATTENDANCE_COLORS.present
            : d.rate >= 75
              ? TEAM_ATTENDANCE_COLORS.late
              : TEAM_ATTENDANCE_COLORS.absent,
      title: `${d.name}: ${d.attended} of ${d.expected} expected days attended · ${d.people} ${d.people === 1 ? 'person' : 'people'}`,
    })),
  );

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
      untracked(() => this.loadRows({ mode: data.mode, anchor: data.rangeStart, departmentId, search, page, pageSize: PAGE_SIZE, sort: 'rate' }));
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
        pageSize: EXPORT_PAGE_SIZE,
        sort: 'rate'
      };
      const items: TeamAttendanceEmployeeRow[] = [];
      for (let page = 1; ; page++) {
        const result = await firstValueFrom(this.api.getEmployees({ ...base, page }));
        items.push(...result.items);
        if (page >= result.totalPages || result.items.length === 0) break;
      }
      const header = ['Rank', 'Name', 'Department', ...data.trend.map((p) => p.date), 'Attended', 'Eligible days', 'Rate %'];
      const lines = items.map((r) => [
        r.rank === null ? '' : String(r.rank),
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
