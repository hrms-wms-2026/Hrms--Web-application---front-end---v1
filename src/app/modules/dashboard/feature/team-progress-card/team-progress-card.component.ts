import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { MyTeamLedProgressStore } from '../../state/my-team-led-progress.store';
import { LedHourTotals, LedOverdueTask } from '../../models/my-team-led-progress.model';
import { buildPieSlices } from '../../utils/pie-slices.util';

const REFRESH_INTERVAL_MS = 60_000;

export interface HourSegment {
  key: 'completed' | 'inProgress' | 'notStarted' | 'untasked';
  hours: number;
  percent: number;
  cssClass: string;
}

interface ProgressRow {
  key: string;
  objectiveId: string;
  projectId: string;
  title: string;
  /** Shown after a led module's title only when it differs from it. */
  projectName: string | null;
  depth: number;
  atRisk: boolean;
  hours: LedHourTotals;
  completionPercent: number;
}

/** Same look as Employee Detail's Work Management card: an estimated-hours pie + legend + rates on
 * the card, and the module-by-module (child modules indented) breakdown and overdue tasks in the
 * pop-out. Hours come from a trigger-maintained summary table on the backend, so each poll is cheap. */
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
  protected readonly formatHours = formatHours;

  /** Polls set `loading` every minute; only a first load (no data yet) shows the skeleton. */
  protected readonly widgetState = computed<WidgetState>(() => {
    const data = this.store.data();
    if (!data) return this.store.error() ? 'error' : 'loading';
    const h = data.hours;
    return data.projects.length === 0 || (h.allocatedHours === 0 && h.taskCount === 0) ? 'empty' : 'ready';
  });

  protected readonly emptyMessage = computed(() =>
    (this.store.data()?.projects.length ?? 0) === 0
      ? "You don't lead any active modules"
      : 'No hours allocated or tasks in the modules you lead'
  );

  protected readonly refreshing = computed(() => this.store.loading() && !!this.store.data());

  protected readonly pieSlices = computed(() => {
    const h = this.store.data()?.hours;
    if (!h) return [];
    return buildPieSlices([
      { key: 'completed', label: 'Completed', count: h.completedHours, color: '#10b981' },
      { key: 'inProgress', label: 'In progress', count: h.inProgressHours, color: '#3b82f6' },
      { key: 'notStarted', label: 'Not started', count: h.notStartedHours, color: '#cbd5e1' },
      { key: 'untasked', label: 'Not yet tasked', count: h.untaskedHours, color: '#fcd34d' }
    ]);
  });

  /** Completed hours against the allocation (against the task estimates when nothing is allocated). */
  protected readonly completionRate = computed(() => {
    const h = this.store.data()?.hours;
    return h ? completionPercent(h) : 0;
  });

  protected readonly modulesAtRisk = computed(() => this.store.data()?.modulesAtRisk ?? 0);

  protected readonly ledModuleCount = computed(() => this.progressRows().filter((row) => row.depth === 0).length);

  /** Led modules with their child modules right below them. Led modules are ordered at-risk first,
   * then least complete; ties keep the backend order. Children keep the backend's tree order. */
  protected readonly progressRows = computed<ProgressRow[]>(() => {
    const blocks: { head: ProgressRow; rows: ProgressRow[]; index: number }[] = [];
    for (const project of this.store.data()?.projects ?? []) {
      for (const module of project.modules) {
        const row: ProgressRow = {
          key: module.objectiveId,
          objectiveId: module.objectiveId,
          projectId: project.projectId,
          title: module.title,
          projectName: module.depth === 0 && project.projectName && project.projectName !== module.title ? project.projectName : null,
          depth: module.depth,
          atRisk: module.atRisk,
          hours: module.hours,
          completionPercent: completionPercent(module.hours)
        };
        if (module.depth === 0 || blocks.length === 0) blocks.push({ head: row, rows: [row], index: blocks.length });
        else blocks[blocks.length - 1].rows.push(row);
      }
    }
    return blocks
      .sort(
        (a, b) =>
          Number(b.head.atRisk) - Number(a.head.atRisk) ||
          a.head.completionPercent - b.head.completionPercent ||
          a.index - b.index
      )
      .flatMap((block) => block.rows);
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

  /** Bar segments sized against the larger of the allocation and the task estimates, so an
   * over-tasked module fills the bar and an under-tasked one shows its untasked share. */
  hourSegments(hours: LedHourTotals): HourSegment[] {
    const scale = Math.max(hours.allocatedHours, hours.completedHours + hours.inProgressHours + hours.notStartedHours);
    if (scale <= 0) return [];
    const segments: HourSegment[] = [
      { key: 'completed', hours: hours.completedHours, percent: 0, cssClass: 'team-progress-segment--completed' },
      { key: 'inProgress', hours: hours.inProgressHours, percent: 0, cssClass: 'team-progress-segment--in-progress' },
      { key: 'notStarted', hours: hours.notStartedHours, percent: 0, cssClass: 'team-progress-segment--not-started' },
      { key: 'untasked', hours: hours.untaskedHours, percent: 0, cssClass: 'team-progress-segment--untasked' }
    ];
    return segments.filter((s) => s.hours > 0).map((s) => ({ ...s, percent: (s.hours / scale) * 100 }));
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

function completionPercent(hours: LedHourTotals): number {
  const base = hours.allocatedHours > 0 ? hours.allocatedHours : hours.completedHours + hours.inProgressHours + hours.notStartedHours;
  return base <= 0 ? 0 : Math.min(100, Math.round((hours.completedHours / base) * 100));
}

/** Hours for display: whole numbers as-is, otherwise one decimal (12.5 h). */
export function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : (Math.round(value * 10) / 10).toString();
}
