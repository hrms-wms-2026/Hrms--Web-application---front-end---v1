import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { PriorityActionItem } from '../../models/priority-action-item.model';
import { buildPriorityActions } from '../../utils/priority-actions.util';

const REFRESH_INTERVAL_MS = 60_000;

const GROUP_DOT_CLASS: Record<PriorityActionItem['group'], string> = {
  escalated_exception: 'priority-action-dot--critical',
  open_exception: 'priority-action-dot--warning',
  pending_approval: 'priority-action-dot--info',
  overdue_work: 'priority-action-dot--critical'
};

/** No store, no API, no fetch of its own - a pure presentation layer over data the sibling
 * Approvals & Exceptions / Team Progress widgets already loaded (My Team spec §8.4). */
@Component({
  selector: 'app-priority-actions-card',
  standalone: true,
  imports: [NgClass, EmptyStateComponent, ErrorStateComponent],
  templateUrl: './priority-actions-card.component.html',
  styleUrl: './priority-actions-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PriorityActionsCardComponent implements OnInit {
  private readonly actionItemsStore = inject(MyTeamActionItemsStore);
  private readonly ledProgressStore = inject(MyTeamLedProgressStore);
  private readonly deepLink = inject(MyTeamDeepLinkService);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);
  private readonly destroyRef = inject(DestroyRef);

  /** A ticking "now" so relative-age captionLabels (e.g. "<1h ago") stay accurate for a long-lived
   * page session, independent of when the sibling stores themselves last refetched - `new Date()`
   * read directly inside `computed()` would otherwise only advance when a tracked signal input
   * (the sibling stores' data) changes, which can be much less often than every minute. */
  private readonly now = signal(new Date());
  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();

  protected readonly items = computed(() =>
    buildPriorityActions(this.actionItemsStore.data(), this.ledProgressStore.data(), this.now(), this.authStore.employeeId())
  );

  /** A sibling store's first load hasn't resolved yet - distinct from "resolved with zero items",
   * which is the genuine empty state handled by `items().length === 0` below. */
  protected readonly siblingsLoading = computed(
    () =>
      (this.actionItemsStore.loading() && !this.actionItemsStore.data()) ||
      (this.ledProgressStore.loading() && !this.ledProgressStore.data())
  );

  protected readonly siblingsErrored = computed(
    () =>
      (!!this.actionItemsStore.error() && !this.actionItemsStore.data()) ||
      (!!this.ledProgressStore.error() && !this.ledProgressStore.data())
  );

  ngOnInit(): void {
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startClock();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopClock();
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.now.set(new Date());
      this.startClock();
    } else {
      this.stopClock();
    }
  }

  private startClock(): void {
    if (this.pollId) return;
    this.pollId = setInterval(() => this.now.set(new Date()), REFRESH_INTERVAL_MS);
  }

  private stopClock(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  dotClass(item: PriorityActionItem): string {
    return GROUP_DOT_CLASS[item.group];
  }

  retry(): void {
    void this.actionItemsStore.load();
    void this.ledProgressStore.load();
  }

  async open(item: PriorityActionItem): Promise<void> {
    if (item.overdueTask) {
      await this.router.navigate(
        ['/work', item.overdueTask.projectId, 'milestones', item.overdueTask.objectiveId, 'board'],
        { queryParams: { highlightTaskId: item.overdueTask.taskId } }
      );
      return;
    }
    if (item.link) await this.deepLink.navigate(item.link);
  }
}
