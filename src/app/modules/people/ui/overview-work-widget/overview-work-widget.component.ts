import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PopoutHeaderActionsComponent, latestDate } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import {
  EmployeeWorkOverviewResponse,
  EmployeeWorkTaskBucket,
  EmployeeWorkTaskItem
} from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { createCompareLoader, deltaIf } from '../../utils/overview-compare';
import { DeltaBadgeComponent } from '../delta-badge/delta-badge.component';
import { WorkTaskRowComponent } from '../work-task-row/work-task-row.component';

/** List order of the buckets. */
const GROUPS: readonly { readonly bucket: EmployeeWorkTaskBucket }[] = [
  { bucket: 'overdue' },
  { bucket: 'not_started' },
  { bucket: 'in_progress' },
  { bucket: 'completed' }
];

type TasksState = 'loading' | 'ready' | 'error';

/**
 * Work card for the selected month. Clicking it pops it out (wide) into every task behind the
 * counts, grouped overdue / not started / in progress / completed and ordered by priority by the
 * API. The task list is fetched only when opened, once per month; clicking a task asks the page to
 * open its task detail.
 */
@Component({
  selector: 'app-overview-work-widget',
  standalone: true,
  imports: [WidgetCardComponent, DeltaBadgeComponent, PopoutPanelComponent, PopoutHeaderActionsComponent, WorkTaskRowComponent],
  host: { class: 'block h-full' },
  template: `
    <app-popout-panel
      class="block h-full"
      [open]="showAll()"
      label="Work Management tasks"
      expandedWidth="64rem"
      expandedMaxHeight="min(85vh, 56rem)"
      (closed)="showAll.set(false)"
    >
    <app-widget-card
      class="group h-full block"
      [class.cursor-pointer]="!showAll()"
      (click)="expand()"
      title="Work Management"
      [nowrapTitle]="true"
      [state]="loader.state()"
      errorMessage="Could not load work management."
      emptyMessage="No tasks in this period."
      (retry)="loader.reload()"
    >
      <app-popout-header-actions
        widget-actions
        [refreshedAt]="refreshedAt()"
        [refreshing]="refreshing()"
        [expanded]="showAll()"
        [canExpand]="true"
        [revealOnHover]="!showAll()"
        (refresh)="refreshAll()"
        (expand)="expand()"
        (closed)="showAll.set(false)"
      />
      @if (loader.data(); as d) {
        <div class="flex flex-col gap-4" data-testid="work-layout" [class.work-layout--wide]="showAll()">
          <div class="flex items-center gap-5">
            <div class="flex shrink-0 flex-col items-center">
              <svg viewBox="0 0 72 72" class="h-28 w-28" role="img" aria-label="Task distribution pie chart">
                @let slices = pieSlices(d);
                @if (slices.length === 0) {
                  <circle cx="36" cy="36" r="34" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1" />
                } @else {
                  @for (slice of slices; track slice.key) {
                    @if (slice.isFull) {
                      <circle data-testid="pie-slice" cx="36" cy="36" r="34" [attr.fill]="slice.color" stroke="#ffffff" stroke-width="1.5">
                        <title>{{ slice.label }}: {{ slice.count }} (100%)</title>
                      </circle>
                    } @else {
                      <path
                        data-testid="pie-slice"
                        [attr.d]="slice.path"
                        [attr.fill]="slice.color"
                        stroke="#ffffff"
                        stroke-width="1.5"
                        stroke-linejoin="round"
                        class="transition-opacity duration-200 hover:opacity-85"
                      >
                        <title>{{ slice.label }}: {{ slice.count }} ({{ slice.percent }}%)</title>
                      </path>
                    }
                  }
                }
              </svg>
              <p class="mt-2 text-xs text-slate-500" data-testid="work-assigned">
                <span class="font-bold text-slate-900 tabular-nums">{{ d.assigned }}</span> tasks
              </p>
            </div>

            <dl
              class="grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 text-sm"
              data-testid="work-legend"
            >
              <dt class="flex items-center gap-2 whitespace-nowrap text-slate-600"><span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>Completed</dt>
              <dd class="flex items-center justify-end gap-1 font-bold tabular-nums text-slate-900" data-testid="work-completed">
                <span>{{ d.completed }}</span>
                @if (completedDelta()) {
                  <app-delta-badge [delta]="completedDelta()" [against]="period.compareLabel()" />
                }
              </dd>

              <dt class="flex items-center gap-2 whitespace-nowrap text-slate-600"><span class="h-2.5 w-2.5 rounded-full bg-blue-500"></span>In progress</dt>
              <dd class="flex items-center justify-end gap-1 font-bold tabular-nums text-slate-900" data-testid="work-in-progress">
                <span>{{ d.inProgress }}</span>
                @if (inProgressDelta()) {
                  <app-delta-badge [delta]="inProgressDelta()" [against]="period.compareLabel()" />
                }
              </dd>

              <dt class="flex items-center gap-2 whitespace-nowrap text-slate-600"><span class="h-2.5 w-2.5 rounded-full bg-slate-300"></span>Not started</dt>
              <dd class="flex items-center justify-end font-bold tabular-nums text-slate-900" data-testid="work-not-started">
                <span>{{ d.notStarted }}</span>
              </dd>

              <dt class="flex items-center gap-2 whitespace-nowrap text-slate-600"><span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span>Overdue</dt>
              <dd class="flex items-center justify-end gap-1 font-bold tabular-nums text-rose-600" data-testid="work-overdue">
                <span>{{ d.overdue }}</span>
                @if (overdueDelta()) {
                  <app-delta-badge [delta]="overdueDelta()" [against]="period.compareLabel()" />
                }
              </dd>
            </dl>
          </div>

          <!-- View all shares the rates line, so the card has no extra footer row. -->
          <div class="work-rates grid grid-cols-[1fr_1fr_auto] items-end gap-4 border-t border-slate-100 pt-3">
            <div>
              <p class="text-xs text-slate-500">Completion rate</p>
              <p class="mt-0.5 text-base font-bold text-slate-900" data-testid="work-completion-rate">{{ d.completionRatePercent }}%</p>
            </div>
            <div>
              <p class="text-xs text-slate-500">On-time rate</p>
              <p class="mt-0.5 text-base font-bold text-slate-900" data-testid="work-ontime-rate">{{ d.onTimeRatePercent === null ? '—' : d.onTimeRatePercent + '%' }}</p>
            </div>
            @if (!showAll()) {
              <button type="button" class="pb-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer whitespace-nowrap" data-testid="work-toggle" (click)="onToggleClick($event)">View all ({{ d.assigned }})</button>
            }
          </div>

          @if (showAll()) {
            <section class="border-t border-slate-100 pt-4" data-testid="work-task-list" aria-label="Tasks">
              @switch (tasksState()) {
                @case ('loading') {
                  <div class="space-y-2" data-testid="work-tasks-loading" aria-hidden="true">
                    @for (i of [0, 1, 2, 3]; track i) {
                      <div class="h-14 animate-pulse rounded-xl bg-slate-100"></div>
                    }
                  </div>
                }
                @case ('error') {
                  <p class="py-4 text-center text-sm text-rose-600" data-testid="work-tasks-error">
                    Could not load the tasks.
                    <button type="button" class="font-semibold underline cursor-pointer" (click)="retryTasks($event)">Retry</button>
                  </p>
                }
                @default {
                  @for (group of groups(); track group.bucket) {
                    <!-- No group headings: the order (overdue, not started, in progress, completed) carries it. -->
                    <div class="mb-2 last:mb-0" data-testid="work-task-group" [attr.data-bucket]="group.bucket">
                      <ul class="space-y-2">
                        @for (task of group.items; track task.taskId) {
                          <li><app-work-task-row [task]="task" (opened)="taskSelected.emit($event)" /></li>
                        }
                      </ul>
                    </div>
                  } @empty {
                    <p class="py-4 text-center text-sm text-slate-500">No tasks in this period.</p>
                  }
                }
              }
              <div class="mt-4 flex justify-end">
                <button type="button" class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer" data-testid="work-toggle" (click)="onToggleClick($event)">Show less</button>
              </div>
            </section>
          }
        </div>
      }
    </app-widget-card>
    </app-popout-panel>
  `,
  // Popped out: pie + legend + rates share one row, so the task list starts higher.
  styles: [`
    .work-layout--wide { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; column-gap: 2.5rem; }
    .work-layout--wide > section { grid-column: 1 / -1; }
    .work-layout--wide [data-testid="work-legend"] { max-width: 20rem; }
    .work-layout--wide .work-rates { border-top: 0; padding-top: 0; padding-left: 2.5rem; border-left: 1px solid rgb(241 245 249); column-gap: 2.5rem; align-self: stretch; align-items: center; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewWorkWidgetComponent {
  private readonly api = inject(PeopleApiService);
  readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();
  /** A task row was clicked; the Overview opens it in the task detail modal. */
  readonly taskSelected = output<EmployeeWorkTaskItem>();
  readonly showAll = signal(false);

  private readonly destroyRef = inject(DestroyRef);
  readonly tasks = signal<readonly EmployeeWorkTaskItem[] | null>(null);
  readonly tasksState = signal<TasksState>('loading');
  private readonly tasksLoadedAt = signal<Date | null>(null);
  private readonly tasksRefreshing = signal(false);
  /** When the shown data last came from the backend (card counts or task list, whichever is newer). */
  readonly refreshedAt = computed(() => latestDate(this.loader.loadedAt(), this.tasksLoadedAt()));
  readonly refreshing = computed(() => this.loader.refreshing() || this.tasksRefreshing());
  /** Which employee + month the loaded tasks belong to. */
  private readonly tasksKey = computed(() => `${this.employeeId()}|${this.period.from()}|${this.period.to()}`);
  readonly groups = computed(() => {
    const tasks = this.tasks() ?? [];
    return GROUPS
      .map((group) => ({ ...group, items: tasks.filter((task) => task.bucket === group.bucket) }))
      .filter((group) => group.items.length > 0);
  });

  constructor() {
    // A new employee or month makes the loaded list stale: drop it, and refetch if the list is open.
    effect(() => {
      this.tasksKey();
      untracked(() => {
        this.tasks.set(null);
        if (this.showAll()) this.loadTasks();
      });
    });
  }

  /** A click anywhere on the card pops it out with the task list (fetched on first open). */
  expand(): void {
    if (this.showAll() || !this.loader.data()) return;
    this.showAll.set(true);
    if (this.tasks() === null) this.loadTasks();
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.showAll()) this.showAll.set(false);
    else this.expand();
  }

  retryTasks(event: Event): void {
    event.stopPropagation();
    this.loadTasks();
  }

  /** Popup refresh: the counts and the task list again, keeping both on screen until the new data lands. */
  refreshAll(): void {
    this.loader.refresh();
    // The task list is only refetched if it has been loaded (i.e. the popup was opened).
    if (this.tasks() !== null) this.loadTasks();
  }

  private loadTasks(): void {
    const key = this.tasksKey();
    // With a list already showing, refetch quietly; the header's refresh icon spins instead.
    if (this.tasks() === null) this.tasksState.set('loading');
    else this.tasksRefreshing.set(true);
    this.api
      .getOverviewWorkTasks(this.employeeId(), this.period.from(), this.period.to())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (key !== this.tasksKey()) return;
          this.tasks.set(response.items);
          this.tasksState.set('ready');
          this.tasksLoadedAt.set(new Date());
          this.tasksRefreshing.set(false);
        },
        error: () => {
          this.tasksRefreshing.set(false);
          if (key === this.tasksKey() && this.tasks() === null) this.tasksState.set('error');
        }
      });
  }

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()),
    { isEmpty: (v) => v.assigned === 0 }
  );
  readonly compareLoader = createCompareLoader(this.period, (from, to) =>
    this.api.getOverviewWork(this.employeeId(), from, to)
  );
  readonly completedDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.completed, this.compareLoader.data()?.completed, 'higher-better')
  );
  readonly inProgressDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.inProgress, this.compareLoader.data()?.inProgress, 'neutral')
  );
  readonly overdueDelta = computed(() =>
    deltaIf(this.period.isComparing(), this.loader.data()?.overdue, this.compareLoader.data()?.overdue, 'lower-better')
  );
  pieSlices(d: EmployeeWorkOverviewResponse): WorkPieSlice[] {
    const total = d.assigned;
    if (!total || total <= 0) return [];

    const items = [
      { key: 'completed', label: 'Completed', count: d.completed, color: '#10b981' },
      { key: 'inProgress', label: 'In progress', count: d.inProgress, color: '#3b82f6' },
      { key: 'overdue', label: 'Overdue', count: d.overdue, color: '#ef4444' },
      { key: 'notStarted', label: 'Not started', count: d.notStarted, color: '#cbd5e1' }
    ].filter((item) => item.count > 0);

    if (items.length === 0) return [];

    if (items.length === 1) {
      return [
        {
          ...items[0],
          percent: 100,
          path: '',
          isFull: true
        }
      ];
    }

    const cx = 36;
    const cy = 36;
    const r = 34;
    let currentAngle = -Math.PI / 2;

    return items.map((item, index) => {
      const sliceAngle = (item.count / total) * 2 * Math.PI;
      const startAngle = currentAngle;
      const endAngle =
        index === items.length - 1 && Math.abs(currentAngle + sliceAngle - (3 * Math.PI) / 2) < 0.01
          ? (3 * Math.PI) / 2
          : currentAngle + sliceAngle;
      currentAngle = endAngle;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const path = `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;
      const percent = Math.round((item.count / total) * 100);

      return {
        ...item,
        percent,
        path,
        isFull: false
      };
    });
  }
}

export interface WorkPieSlice {
  readonly key: string;
  readonly label: string;
  readonly count: number;
  readonly percent: number;
  readonly color: string;
  readonly path: string;
  readonly isFull: boolean;
}
