import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TaskPriority, TaskStatus } from '../../../models/employee-insights.model';
import { EmployeeDetailStore } from '../../../state/employee-detail.store';
import { EmployeeInsightsStore } from '../../../state/employee-insights.store';
import { BarChartComponent, ChartBar } from '../../../ui/detail-kit/bar-chart.component';
import { DetailCardComponent } from '../../../ui/detail-kit/detail-card.component';
import { DetailIconComponent } from '../../../ui/detail-kit/detail-icon.component';
import { EmptyNoteComponent } from '../../../ui/detail-kit/empty-note.component';
import { InsightPlaceholderComponent } from '../../../ui/detail-kit/insight-placeholder.component';
import { StatTileComponent } from '../../../ui/detail-kit/stat-tile.component';
import { BadgeTone, StatusBadgeComponent } from '../../../ui/detail-kit/status-badge.component';
import { formatClock, formatMinutes, formatRelativeDayTime } from '../../../utils/employee-detail.utils';

const TASK_STATUS: Record<TaskStatus, { label: string; tone: BadgeTone }> = {
  to_do: { label: 'To Do', tone: 'neutral' },
  in_progress: { label: 'In Progress', tone: 'info' },
  review: { label: 'Review', tone: 'purple' },
  completed: { label: 'Completed', tone: 'success' }
};

const PRIORITY: Record<TaskPriority, { label: string; tone: BadgeTone }> = {
  high: { label: 'High', tone: 'danger' },
  medium: { label: 'Medium', tone: 'warning' },
  low: { label: 'Low', tone: 'success' }
};

/**
 * Work & Activity tab: work summary, tasks needing attention, delivery health, recorded device
 * activity, recent tasks, application usage and work pattern for the selected period. All of it
 * comes from EmployeeInsightsStore (development sample data until the Phase 3 endpoints exist).
 */
@Component({
  selector: 'app-employee-work-activity-tab',
  standalone: true,
  imports: [DatePipe, BarChartComponent, DetailCardComponent, DetailIconComponent, EmptyNoteComponent, InsightPlaceholderComponent, StatTileComponent, StatusBadgeComponent],
  templateUrl: './employee-work-activity-tab.component.html',
  styleUrl: './employee-work-activity-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkActivityTabComponent {
  protected readonly store = inject(EmployeeDetailStore);
  protected readonly insightsStore = inject(EmployeeInsightsStore);

  readonly insights = this.insightsStore.workActivity;
  readonly taskStatus = TASK_STATUS;
  readonly priority = PRIORITY;
  readonly formatMinutes = formatMinutes;
  readonly formatClock = formatClock;
  readonly formatRelativeDayTime = formatRelativeDayTime;

  readonly monthlyBars = computed<ChartBar[]>(() =>
    (this.insights()?.delivery.monthly ?? []).map((m) => ({ value: m.completed, label: m.month }))
  );
  readonly monthlyLabels = computed(() =>
    (this.insights()?.delivery.monthly ?? []).map((m) => {
      const [y, mo] = m.month.split('-').map(Number);
      return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    })
  );
  readonly monthlyTicks = computed(() => {
    const max = Math.max(10, ...(this.insights()?.delivery.monthly ?? []).map((m) => m.completed));
    const step = Math.ceil(max / 30) * 10;
    return [0, step, step * 2, step * 3];
  });

  readonly hourlyBars = computed<ChartBar[]>(() =>
    (this.insights()?.recordedActivity.hourly ?? []).map((h) => ({ value: h.activeMinutes, label: h.hour }))
  );
  readonly hourlyLabels = computed(() => {
    const hourly = this.insights()?.recordedActivity.hourly ?? [];
    return hourly.filter((_, i) => i % 4 === 0).map((h) => {
      const [hh] = h.hour.split(':').map(Number);
      return `${hh % 12 || 12}${hh < 12 ? 'AM' : 'PM'}`;
    });
  });

  constructor() {
    effect(() => {
      const employeeId = this.store.employeeId();
      const month = this.store.periodMonth();
      // untracked: the load reads store signals that must not become dependencies of this effect,
      // or finishing a load (loading -> false) would re-trigger it forever when there is no data.
      if (employeeId) untracked(() => void this.insightsStore.loadWorkActivity(employeeId, month));
    });
  }
}
