import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { ActionCenterCategory } from '../../models/action-center-category.model';
import { PriorityActionItem } from '../../models/priority-action-item.model';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { buildActionCenterCategories } from '../../utils/action-center-categories.util';
import { buildPriorityActions } from '../../utils/priority-actions.util';
import { actionCenterRailVisible } from '../../utils/my-team-widget-visibility.util';

const REFRESH_INTERVAL_MS = 60_000;
const QUEUE_COLLAPSED_LIMIT = 5;

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

const GROUP_DOT_CLASS: Record<PriorityActionItem['group'], string> = {
  escalated_exception: 'priority-action-dot--critical',
  open_exception: 'priority-action-dot--warning',
  pending_approval: 'priority-action-dot--info',
  overdue_work: 'priority-action-dot--critical'
};

interface RailDomainView {
  domain: 'people' | 'work';
  heading: string;
  visibleCategories: ActionCenterCategory[];
  collapsedCount: number;
}

/** The 2026-10-01 merge of the former ApprovalsExceptionsCard (rail) and PriorityActionsCard
 * (queue) into one widget. The rail and queue read the SAME action-items response - no duplicate
 * fetch - and the queue additionally reads led-progress (read-only, Team Progress still owns its
 * load/poll). See MY_TEAM_ACTION_CENTER_CONSOLIDATION_DESIGN_PROPOSAL.md. */
@Component({
  selector: 'app-action-center-card',
  standalone: true,
  imports: [NgClass, EmptyStateComponent, ErrorStateComponent],
  templateUrl: './action-center-card.component.html',
  styleUrl: './action-center-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ActionCenterCardComponent implements OnInit {
  protected readonly store = inject(MyTeamActionItemsStore);
  private readonly ledProgressStore = inject(MyTeamLedProgressStore);
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);
  private readonly deepLink = inject(MyTeamDeepLinkService);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  private readonly now = signal(new Date());
  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();

  protected readonly showRail = computed(() => actionCenterRailVisible(this.capabilitiesStore.capabilities()));

  protected readonly subtitle = computed<string | null>(() => {
    const caps = this.capabilitiesStore.capabilities();
    const hasPeople = !!caps && (caps.canReviewPeopleApprovals || caps.canReviewExceptions);
    const hasWork = !!caps && (caps.hasWorkApprovals || caps.leadsWork);
    if (hasPeople && hasWork) return null;
    if (hasPeople) return 'People you manage';
    if (hasWork) return 'Work you lead';
    return null;
  });

  // --- Rail ---

  private readonly categories = computed(() => buildActionCenterCategories(this.store.data()));
  protected readonly peopleRailExpanded = signal(false);
  protected readonly workRailExpanded = signal(false);

  protected readonly peopleRail = computed(() =>
    this.railDomainView('people', 'People I manage', this.peopleRailExpanded())
  );
  protected readonly workRail = computed(() =>
    this.railDomainView('work', 'Work I lead', this.workRailExpanded())
  );

  private railDomainView(domain: 'people' | 'work', heading: string, expanded: boolean): RailDomainView {
    const all = this.categories().filter((c) => c.domain === domain);
    const individual = all.filter((c) => c.pendingCount > 0 || c.status === 'unavailable');
    const zeroOk = all.filter((c) => c.pendingCount === 0 && c.status === 'ok');
    if (expanded || zeroOk.length <= 1) {
      return { domain, heading, visibleCategories: [...individual, ...zeroOk], collapsedCount: 0 };
    }
    return { domain, heading, visibleCategories: individual, collapsedCount: zeroOk.length };
  }

  toggleRailExpanded(domain: 'people' | 'work'): void {
    if (domain === 'people') this.peopleRailExpanded.update((v) => !v);
    else this.workRailExpanded.update((v) => !v);
  }

  sourceLabel(category: ActionCenterCategory): string {
    return SOURCE_LABEL[category.sourceKey] ?? category.sourceKey;
  }

  async openCategory(category: ActionCenterCategory): Promise<void> {
    const peopleRoute = PEOPLE_LIST_ROUTE[category.sourceKey];
    if (peopleRoute) {
      await this.router.navigate(peopleRoute.commands, { queryParams: peopleRoute.queryParams });
      return;
    }
    const source = this.store.data()?.sources.find((s) => s.sourceKey === category.sourceKey);
    const firstItem = source?.topItems[0];
    if (firstItem) await this.deepLink.navigate(firstItem.link);
  }

  exceptionSeverityDot(category: ActionCenterCategory): 'critical' | 'warning' | null {
    if (category.sourceKey !== 'monitoring.exception') return null;
    const source = this.store.data()?.sources.find((s) => s.sourceKey === category.sourceKey);
    if (!source || source.topItems.length === 0) return null;
    return source.topItems.some((item) => item.exceptionStatus === 'Escalated') ? 'critical' : 'warning';
  }

  // --- Queue ---

  protected readonly items = computed(() =>
    buildPriorityActions(this.store.data(), this.ledProgressStore.data(), this.now(), this.authStore.employeeId())
  );
  protected readonly queueExpanded = signal(false);
  protected readonly visibleQueueItems = computed(() =>
    this.queueExpanded() ? this.items() : this.items().slice(0, QUEUE_COLLAPSED_LIMIT)
  );
  protected readonly hiddenQueueItemCount = computed(() => Math.max(0, this.items().length - QUEUE_COLLAPSED_LIMIT));

  protected readonly siblingsLoading = computed(
    () =>
      (this.store.loading() && !this.store.data()) ||
      (this.ledProgressStore.loading() && !this.ledProgressStore.data())
  );
  protected readonly siblingsErrored = computed(
    () =>
      (!!this.store.error() && !this.store.data()) ||
      (!!this.ledProgressStore.error() && !this.ledProgressStore.data())
  );

  toggleQueueExpanded(): void {
    this.queueExpanded.update((v) => !v);
  }

  dotClass(item: PriorityActionItem): string {
    return GROUP_DOT_CLASS[item.group];
  }

  async openQueueItem(item: PriorityActionItem): Promise<void> {
    if (item.overdueTask) {
      await this.router.navigate(
        ['/work', item.overdueTask.projectId, 'milestones', item.overdueTask.objectiveId, 'board'],
        { queryParams: { highlightTaskId: item.overdueTask.taskId } }
      );
      return;
    }
    if (item.link) await this.deepLink.navigate(item.link);
  }

  // --- Lifecycle / polling (owns MyTeamActionItemsStore, conditional on the rail being relevant) ---

  ngOnInit(): void {
    if (this.showRail()) {
      void this.store.load();
      document.addEventListener('visibilitychange', this.visibilityHandler);
      if (document.visibilityState === 'visible') this.startPolling();
    }
    this.startClock();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
      this.stopClock();
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.store.load();
      this.startPolling();
      this.now.set(new Date());
      this.startClock();
    } else {
      this.stopPolling();
      this.stopClock();
    }
  }

  private startPolling(): void {
    if (this.pollId) return;
    this.pollId = setInterval(() => void this.store.load(), REFRESH_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  private clockId: ReturnType<typeof setInterval> | null = null;

  private startClock(): void {
    if (this.clockId) return;
    this.clockId = setInterval(() => this.now.set(new Date()), REFRESH_INTERVAL_MS);
  }

  private stopClock(): void {
    if (this.clockId) {
      clearInterval(this.clockId);
      this.clockId = null;
    }
  }

  retry(): void {
    void this.store.load();
    void this.ledProgressStore.load();
  }
}
