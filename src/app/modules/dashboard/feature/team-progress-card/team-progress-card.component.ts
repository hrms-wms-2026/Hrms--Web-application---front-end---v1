import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { ProgressBarComponent } from '../../../../shared/ui/progress-bar/progress-bar.component';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { LedOverdueTask, LedProjectProgress, LedWorkTotals } from '../../models/my-team-led-progress.model';

type TotalsSegmentKey = 'completed' | 'inProgress' | 'notStarted' | 'overdue';

@Component({
  selector: 'app-team-progress-card',
  standalone: true,
  imports: [EmptyStateComponent, ErrorStateComponent, ProgressBarComponent],
  templateUrl: './team-progress-card.component.html',
  styleUrl: './team-progress-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamProgressCardComponent implements OnInit {
  protected readonly store = inject(MyTeamLedProgressStore);
  private readonly router = inject(Router);

  protected readonly segments = computed(() => {
    const totals = this.store.data()?.totals;
    if (!totals || totals.total === 0) return [];
    const keys: { key: TotalsSegmentKey; label: string; cssClass: string }[] = [
      { key: 'completed', label: 'Completed', cssClass: 'team-progress-segment--completed' },
      { key: 'inProgress', label: 'In Progress', cssClass: 'team-progress-segment--in-progress' },
      { key: 'notStarted', label: 'Not Started', cssClass: 'team-progress-segment--not-started' },
      { key: 'overdue', label: 'Overdue', cssClass: 'team-progress-segment--overdue' }
    ];
    return keys.map((k) => ({
      ...k,
      count: totals[k.key],
      percent: Math.round((totals[k.key] / totals.total) * 100)
    }));
  });

  ngOnInit(): void {
    void this.store.load();
  }

  retry(): void {
    void this.store.load();
  }

  projectCompletionPercent(project: LedProjectProgress): number {
    return completionPercent(project.totals);
  }

  openModule(projectId: string, objectiveId: string): void {
    void this.router.navigate(['/work', projectId, 'milestones', objectiveId, 'tree']);
  }

  openOverdueTask(task: LedOverdueTask): void {
    void this.router.navigate(['/work', task.projectId, 'milestones', task.objectiveId, 'board'], {
      queryParams: { highlightTaskId: task.taskId }
    });
  }

  assigneeNames(task: LedOverdueTask): string {
    return task.assignees.map((a) => a.displayName).join(', ');
  }
}

function completionPercent(totals: LedWorkTotals): number {
  return totals.total === 0 ? 0 : Math.round((totals.completed / totals.total) * 100);
}
