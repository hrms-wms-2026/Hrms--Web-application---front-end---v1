import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { EmployeeDetailResponse } from '../../../models/employee.model';
import { AttendanceDayStatus, InsightStatus } from '../../../models/employee-insights.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { EmployeeInsightsStore } from '../../../state/employee-insights.store';
import { BarChartComponent, BarTone, ChartBar } from '../../../ui/detail-kit/bar-chart.component';
import { DetailCardComponent } from '../../../ui/detail-kit/detail-card.component';
import { DetailIconComponent } from '../../../ui/detail-kit/detail-icon.component';
import { InsightPlaceholderComponent } from '../../../ui/detail-kit/insight-placeholder.component';
import { KvRowComponent } from '../../../ui/detail-kit/kv-row.component';
import { LineChartComponent } from '../../../ui/detail-kit/line-chart.component';
import { BarSegment, SegmentedBarComponent } from '../../../ui/detail-kit/segmented-bar.component';
import { StatTileComponent } from '../../../ui/detail-kit/stat-tile.component';
import { BadgeTone, StatusBadgeComponent } from '../../../ui/detail-kit/status-badge.component';
import { TimelineComponent, TimelineItem } from '../../../ui/detail-kit/timeline.component';
import {
  calculateTenure,
  employmentHistory,
  formatDateRange,
  formatDayMonth,
  formatMinutes,
  formatRelativeDayTime,
  toPeriodMonth
} from '../../../utils/employee-detail.utils';
import {
  attendanceAttentionLabel,
  attendanceSeverityClass,
  attendanceStatusLabel,
  attendanceWarningLabel,
  breakOverageLabel
} from '../../../utils/employee-view.utils';

const DAY_TONES: Record<AttendanceDayStatus, BarTone> = {
  present: 'success',
  late: 'warning',
  missing_clock_out: 'danger',
  leave: 'success-soft',
  none: 'muted'
};

const STATUS_TONES: Record<InsightStatus, BadgeTone> = { pending: 'warning', approved: 'success', rejected: 'danger' };
const HISTORY_PREVIEW_LIMIT = 4;

/**
 * Overview tab. Header, Employment & Organization and Employee History use the real detail
 * response; the period cards (attendance, work, time off, approvals, activity, productivity,
 * upcoming items, checklists) come from EmployeeInsightsStore, which only has data in
 * development until the Phase 3 endpoints exist - elsewhere those cards show "no data yet".
 */
@Component({
  selector: 'app-employee-overview-tab',
  standalone: true,
  imports: [
    DatePipe,
    BarChartComponent,
    DetailCardComponent,
    DetailIconComponent,
    InsightPlaceholderComponent,
    KvRowComponent,
    LineChartComponent,
    SegmentedBarComponent,
    StatTileComponent,
    StatusBadgeComponent,
    TimelineComponent
  ],
  templateUrl: './employee-overview-tab.component.html',
  styleUrl: './employee-overview-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeOverviewTabComponent {
  protected readonly store = inject(EmployeeDetailStore);
  protected readonly insightsStore = inject(EmployeeInsightsStore);

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;
  readonly formatMinutes = formatMinutes;
  readonly formatRelativeDayTime = formatRelativeDayTime;
  readonly formatDateRange = formatDateRange;
  readonly statusTones = STATUS_TONES;

  readonly insights = this.insightsStore.overview;
  readonly periodSubtitle = computed(() => {
    const month = this.store.periodMonth();
    if (month === toPeriodMonth(new Date())) return 'This month';
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  readonly tenure = computed(() => calculateTenure(this.store.employee()?.jobInformation.hireDate));
  readonly history = computed<TimelineItem[]>(() =>
    employmentHistory(this.store.jobJourney(), this.store.employee()?.jobInformation.probationEndDate)
      .slice(0, HISTORY_PREVIEW_LIMIT)
      .map((event) => ({ date: formatShortDate(event.date), title: event.title, description: event.description }))
  );

  readonly attendanceBars = computed<ChartBar[]>(() =>
    (this.insights()?.attendance.days ?? []).map((day) => ({ value: 1, label: day.date, tone: DAY_TONES[day.status] }))
  );
  readonly attendanceAxis = computed(() => {
    const days = this.insights()?.attendance.days ?? [];
    if (!days.length) return [];
    const picks = [1, 8, 15, 22, days.length];
    return picks.map((d) => formatShortDay(days[d - 1].date));
  });

  readonly workSegments = computed<BarSegment[]>(() => {
    const work = this.insights()?.work;
    if (!work) return [];
    const other = Math.max(0, work.assigned - work.completed - work.inProgress - work.overdue);
    return [
      { value: work.completed, tone: 'success', label: 'Completed' },
      { value: work.inProgress, tone: 'info', label: 'In progress' },
      { value: other, tone: 'neutral', label: 'Not started' },
      { value: work.overdue, tone: 'danger', label: 'Overdue' }
    ];
  });

  readonly trend = computed(() =>
    (this.insights()?.productivity.trend ?? []).map((point) => ({ label: formatMonthShort(point.month), value: point.value }))
  );

  constructor() {
    effect(() => {
      const employeeId = this.store.employeeId();
      const month = this.store.periodMonth();
      // untracked: the load reads store signals that must not become dependencies of this effect,
      // or finishing a load (loading -> false) would re-trigger it forever when there is no data.
      if (employeeId) untracked(() => void this.insightsStore.loadOverview(employeeId, month));
    });
  }

  severityBadgeClass(employee: EmployeeDetailResponse): string {
    const severity = attendanceSeverityClass(employee);
    if (severity === 'emp-attention--critical') return 'bg-red-50 text-red-700';
    if (severity === 'emp-attention--warning') return 'bg-amber-50 text-amber-700';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }

  statusLabel(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}

function formatShortDate(value: string): string {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDay(value: string): string {
  return formatDayMonth(value);
}

function formatMonthShort(value: string): string {
  const [y, m] = value.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}
