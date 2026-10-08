import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { LedOverdueTask, LedWorkTotals } from '../../models/my-team-led-progress.model';
import { buildPieSlices } from '../../utils/pie-slices.util';

const REFRESH_INTERVAL_MS = 60_000;

interface ProgressRow {
  key: string;
  title: string;
  /** Shown after the title only when it differs from it. */
  projectName: string | null;
  projectId: string;
  objectiveId: string | null;
  totals: LedWorkTotals;
  completionPercent: number;
}

/** Same look as Employee Detail's Work Management card: pie + legend + rates on the card, and the
 * module-by-module breakdown and overdue tasks in the pop-out. */
@Component({
  selector: 'app-team-progress-card',
  standalone: true,
  imports: [WidgetCardComponent, PopoutPanelComponent, PopoutHeaderActionsComponent],
  templateUrl: './team-progress-card.component.html',
  styleUrl: './team-progress-card.component.css',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamProgressCardComponent implements OnInit {
  protected readonly store = inject(MyTeamLedProgressStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private pollId: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler = (): void => this.onVisibilityChange();

  protected readonly showAll = signal(false);

  /** Polls set `loading` every minute; only a first load (no data yet) shows the skeleton. */
  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    return data.projects.length === 0 || data.totals.total === 0 ? 'empty' : 'ready';
  });
  protected readonly emptyMessage = computed(() =>
    (this.store.data()?.projects.length ?? 0) === 0
      ? "You don't lead any active modules"
      : 'No open tasks in the modules you lead'
  );
  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly pieSlices = computed(() => {
    const t = this.store.data()?.totals;
    if (!t) return [];
    return buildPieSlices([
      { key: 'completed', label: 'Completed', count: t.completed, color: '#10b981' },
      { key: 'inProgress', label: 'In progress', count: t.inProgress, color: '#3b82f6' },
      { key: 'overdue', label: 'Overdue', count: t.overdue, color: '#ef4444' },
      { key: 'notStarted', label: 'Not started', count: t.notStarted, color: '#cbd5e1' }
    ]);
  });

  protected readonly completionRate = computed(() => {
    const t = this.store.data()?.totals;
    return t ? completionPercent(t) : 0;
  });

  protected readonly modulesAtRisk = computed(() => this.progressRows().filter((row) => row.totals.overdue > 0).length);

  /** Modules (or module-less projects) flattened and sorted at-risk first: most overdue, then
   * least complete. Ties keep the backend order. */
  protected readonly progressRows = computed<ProgressRow[]>(() => {
    const projects = this.store.data()?.projects ?? [];
    const rows: ProgressRow[] = projects.flatMap((project): ProgressRow[] =>
      project.modules.length > 0
        ? project.modules.map((module) => ({
            key: `m:${module.objectiveId}`,
            title: module.title,
            projectName: project.projectName && project.projectName !== module.title ? project.projectName : null,
            projectId: project.projectId,
            objectiveId: module.objectiveId,
            totals: module.totals,
            completionPercent: completionPercent(module.totals)
          }))
        : [
            {
              key: `p:${project.projectId}`,
              title: project.projectName,
              projectName: null,
              projectId: project.projectId,
              objectiveId: null,
              totals: project.totals,
              completionPercent: completionPercent(project.totals)
            }
          ]
    );
    return rows
      .map((row, index) => ({ row, index }))
      .sort(
        (a, b) =>
          b.row.totals.overdue - a.row.totals.overdue ||
          a.row.completionPercent - b.row.completionPercent ||
          a.index - b.index
      )
      .map(({ row }) => row);
  });

  ngOnInit(): void {
    void this.store.load();
    document.addEventListener('visibilitychange', this.visibilityHandler);
    if (document.visibilityState === 'visible') this.startPolling();
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.stopPolling();
    });
  }

  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      void this.store.load();
      this.startPolling();
    } else {
      this.stopPolling();
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

  retry(): void {
    void this.store.load();
  }

  totalsSegments(totals: LedWorkTotals | undefined | null): { key: 'completed' | 'inProgress' | 'notStarted'; percent: number; count: number; cssClass: string }[] {
    if (!totals || totals.total === 0) return [];
    const segments: { key: 'completed' | 'inProgress' | 'notStarted'; percent: number; count: number; cssClass: string }[] = [
      { key: 'completed', count: totals.completed, percent: (totals.completed / totals.total) * 100, cssClass: 'team-progress-segment--completed' },
      { key: 'inProgress', count: totals.inProgress, percent: (totals.inProgress / totals.total) * 100, cssClass: 'team-progress-segment--in-progress' },
      { key: 'notStarted', count: totals.notStarted, percent: (totals.notStarted / totals.total) * 100, cssClass: 'team-progress-segment--not-started' }
    ];
    return segments.filter((s) => s.count > 0);
  }

  /** A click anywhere on the card pops out the module breakdown. */
  expand(): void {
    if (this.showAll() || !this.store.data()) return;
    this.showAll.set(true);
  }

  collapse(): void {
    this.showAll.set(false);
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.collapse();
    else this.expand();
  }

  openModule(projectId: string, objectiveId: string, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/work', projectId, 'milestones', objectiveId, 'tree']);
  }

  openOverdueTask(task: LedOverdueTask, event?: Event): void {
    event?.stopPropagation();
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
