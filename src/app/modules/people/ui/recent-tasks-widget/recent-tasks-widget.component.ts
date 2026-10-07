import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PopoutHeaderActionsComponent } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { formatShortDate } from '../../utils/employee-overview.utils';
import { priorityLabel } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-recent-tasks-widget',
  standalone: true,
  imports: [WidgetCardComponent, RouterLink, PopoutPanelComponent, PopoutHeaderActionsComponent],
  template: `
    <app-popout-panel class="block h-full" [open]="expanded()" label="Today's Tasks" (closed)="expanded.set(false)">
    <app-widget-card
      class="group"
      title="Today's Tasks"
      [class.cursor-pointer]="canExpand() && !expanded()"
      [state]="loader.state()"
      emptyMessage="No tasks for today."
      errorMessage="Could not load recent tasks."
      (retry)="loader.reload()"
      (click)="expand()"
    >
      @if (loader.data()) {
        <div widget-actions class="flex items-center gap-2">
          <app-popout-header-actions
            [refreshedAt]="loader.loadedAt()"
            [refreshing]="loader.refreshing()"
            [expanded]="expanded()"
            [canExpand]="canExpand()"
            [revealOnHover]="!expanded()"
            (refresh)="loader.refresh()"
            (expand)="expand()"
            (closed)="expanded.set(false)"
          />
        </div>
      }
      @if (loader.data(); as d) {
        <p class="-mt-1 mb-3 text-xs text-slate-500">Tasks due today or updated today</p>
        <ul class="space-y-2">
          @for (t of expanded() ? d.items : d.items.slice(0, previewCount); track t.taskId) {
            <li>
              <a
                data-testid="recent-row"
                class="grid w-full grid-cols-1 items-center gap-x-4 gap-y-2 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 sm:grid-cols-[minmax(0,1fr)_auto]"
                [routerLink]="['/work', t.projectId, 'board']"
                [queryParams]="{ highlightTaskId: t.taskId }"
                [attr.aria-label]="'Open task ' + t.title"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-slate-900" [title]="t.title">
                    @if (t.shortId) { <span class="mr-1.5 font-medium text-slate-400">{{ t.shortId }}</span> }{{ t.title }}
                  </p>
                  <div class="mt-1 flex items-center gap-3">
                    <p class="min-w-0 truncate text-xs text-slate-500">{{ t.projectName }}</p>
                    @if (t.progressPercent > 0) {
                      <div class="hidden w-24 shrink-0 items-center gap-1.5 md:flex" [title]="t.progressPercent + '% done'">
                        <div class="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div class="h-full rounded-full bg-emerald-500" [style.width.%]="t.progressPercent"></div>
                        </div>
                        <span class="text-[11px] tabular-nums text-slate-400">{{ t.progressPercent }}%</span>
                      </div>
                    }
                  </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 sm:justify-end">
                  <span class="rounded-md px-2 py-0.5 text-[11px] font-semibold" [class]="priorityClass(t.priority)">{{ priority(t.priority) }}</span>
                  <span class="inline-flex max-w-40 items-center gap-1.5 rounded-md bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    <span class="h-2 w-2 shrink-0 rounded-full" [style.background]="t.statusColor || '#94a3b8'"></span>
                    <span class="truncate">{{ t.statusName }}</span>
                  </span>
                  <span class="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">{{ t.storyPoints ?? '—' }} SP</span>
                  @if (t.updatedToday) {
                    <span data-testid="recent-updated-today" class="rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">Updated today</span>
                  }
                  <span class="min-w-24 text-right text-xs text-slate-500">{{ due(t.dueDate) }}</span>
                  <svg class="hidden h-4 w-4 text-slate-400 sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </a>
            </li>
          }
        </ul>
        @if (canExpand()) {
          <div class="mt-3 flex justify-end border-t border-slate-100 pt-3">
            <button
              type="button"
              data-testid="recent-view-all"
              class="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              [attr.aria-expanded]="expanded()"
              (click)="onToggleClick($event)"
            >
              {{ expanded() ? 'Show less' : 'View all' }}
            </button>
          </div>
        }
      }
    </app-widget-card>
    </app-popout-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RecentTasksWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() => this.api.getWorkActivityRecentTasks(this.employeeId()), {
    isEmpty: (d) => d.items.length === 0
  });

  readonly priority = priorityLabel;

  /** Rows on the compact card; "View all" (or a click on the card) pops the full list out over the page. */
  readonly previewCount = 3;
  readonly expanded = signal(false);
  readonly canExpand = computed(() => (this.loader.data()?.items.length ?? 0) > this.previewCount);

  expand(): void {
    if (!this.expanded() && this.canExpand()) this.expanded.set(true);
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    if (this.expanded()) this.expanded.set(false);
    else this.expand();
  }

  due(dueDate: string | null): string {
    return dueDate ? `Due ${formatShortDate(dueDate)}` : 'No due date';
  }

  /** Same chip colours as the Overview tab's Work Management task list. */
  priorityClass(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'low':
        return 'bg-slate-100 text-slate-600';
      default:
        return 'bg-amber-50 text-amber-700';
    }
  }
}
