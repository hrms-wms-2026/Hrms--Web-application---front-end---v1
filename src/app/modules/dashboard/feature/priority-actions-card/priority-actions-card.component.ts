import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { MyTeamActionItemsStore } from '../../state/my-team-action-items.store';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { MyTeamDeepLinkService } from '../../data-access/my-team-deep-link.service';
import { PriorityActionItem } from '../../models/priority-action-item.model';
import { buildPriorityActions } from '../../utils/priority-actions.util';

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
  imports: [NgClass, EmptyStateComponent],
  templateUrl: './priority-actions-card.component.html',
  styleUrl: './priority-actions-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PriorityActionsCardComponent {
  private readonly actionItemsStore = inject(MyTeamActionItemsStore);
  private readonly ledProgressStore = inject(MyTeamLedProgressStore);
  private readonly deepLink = inject(MyTeamDeepLinkService);
  private readonly router = inject(Router);
  private readonly authStore = inject(AuthStore);

  protected readonly items = computed(() =>
    buildPriorityActions(this.actionItemsStore.data(), this.ledProgressStore.data(), new Date(), this.authStore.employeeId())
  );

  dotClass(item: PriorityActionItem): string {
    return GROUP_DOT_CLASS[item.group];
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
