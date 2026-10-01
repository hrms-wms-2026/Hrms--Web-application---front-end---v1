import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { ActionSourceSummary } from '../../models/my-team-action-items.model';
import { formatOldestWaiting } from '../../utils/oldest-pending.util';

const SOURCE_LABEL: Record<string, string> = {
  'leave.approval': 'Leave requests',
  'attendance.correction': 'Attendance corrections',
  'attendance.work_area': 'Work-area changes',
  'attendance.location': 'Location changes',
  'attendance.device_change': 'Device changes',
  'monitoring.exception': 'Exceptions',
  'work.task_creation': 'Task creation requests',
  'work.task_edit': 'Task edit requests',
  'work.objective_change': 'Objective changes',
  'work.status_template_change': 'Status template changes'
};

const PEOPLE_LIST_ROUTE: Record<string, { commands: string[]; queryParams?: Record<string, string> }> = {
  'leave.approval': { commands: ['/time-off/team-approvals'] },
  'attendance.correction': { commands: ['/attendance/time-tracking'], queryParams: { view: 'team', type: 'corrections' } },
  'attendance.work_area': { commands: ['/attendance/time-tracking'], queryParams: { view: 'team', type: 'work-area' } },
  'attendance.location': { commands: ['/attendance/time-tracking'], queryParams: { view: 'team', type: 'location' } },
  'attendance.device_change': { commands: ['/attendance/time-tracking'], queryParams: { view: 'team', type: 'device-change' } },
  'monitoring.exception': { commands: ['/attendance/alerts'] }
};

@Component({
  selector: 'app-approvals-exceptions-card',
  standalone: true,
  imports: [NgTemplateOutlet, EmptyStateComponent],
  templateUrl: './approvals-exceptions-card.component.html',
  styleUrl: './approvals-exceptions-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ApprovalsExceptionsCardComponent implements OnInit {
  protected readonly store = inject(MyTeamActionItemsStore);
  private readonly router = inject(Router);
  private readonly deepLink = inject(MyTeamDeepLinkService);

  protected readonly peopleSources = computed(
    () => this.store.data()?.sources.filter((s) => s.domain === 'people') ?? []
  );
  protected readonly workSources = computed(
    () => this.store.data()?.sources.filter((s) => s.domain === 'work') ?? []
  );
  // An unavailable source must stay visible (so it can be retried) even though its pendingCount
  // defaults to 0 - only sources that are genuinely ok-and-empty make the whole card empty.
  protected readonly isEmpty = computed(() => {
    const data = this.store.data();
    return !!data && data.sources.every((s) => s.status === 'ok' && s.pendingCount === 0);
  });

  ngOnInit(): void {
    void this.store.load();
  }

  retry(): void {
    void this.store.load();
  }

  sourceLabel(source: ActionSourceSummary): string {
    return SOURCE_LABEL[source.sourceKey] ?? source.sourceKey;
  }

  oldestWaitingLabel(source: ActionSourceSummary): string | null {
    return formatOldestWaiting(source.oldestPendingAt);
  }

  exceptionSeverityDot(source: ActionSourceSummary): 'critical' | 'warning' | null {
    if (source.sourceKey !== 'monitoring.exception' || source.topItems.length === 0) return null;
    return source.topItems.some((item) => item.exceptionStatus === 'Escalated') ? 'critical' : 'warning';
  }

  async openSource(source: ActionSourceSummary): Promise<void> {
    const peopleRoute = PEOPLE_LIST_ROUTE[source.sourceKey];
    if (peopleRoute) {
      await this.router.navigate(peopleRoute.commands, { queryParams: peopleRoute.queryParams });
      return;
    }

    // No cross-project "all my work approvals" screen exists - open the oldest pending item,
    // which re-authorizes and lands the viewer exactly where that item lives (spec §15).
    const firstItem = source.topItems[0];
    if (firstItem) await this.deepLink.navigate(firstItem.link);
  }
}
