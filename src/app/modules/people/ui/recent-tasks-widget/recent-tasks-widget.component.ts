import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { formatShortDate } from '../../utils/employee-overview.utils';
import { priorityLabel } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-recent-tasks-widget',
  standalone: true,
  imports: [WidgetCardComponent, RouterLink],
  template: `
    <app-widget-card
      title="Recent Tasks"
      [state]="loader.state()"
      emptyMessage="No tasks assigned yet."
      errorMessage="Could not load recent tasks."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <table class="w-full table-fixed text-sm">
          <thead class="text-left text-[var(--color-text-secondary)]">
            <tr>
              <th class="w-[28%] py-1 font-normal">Task</th>
              <th class="py-1 font-normal">Project</th>
              <th class="py-1 font-normal">Status</th>
              <th class="py-1 font-normal">Priority</th>
              <th class="py-1 font-normal">Due</th>
              <th class="w-10 py-1 font-normal">SP</th>
            </tr>
          </thead>
          <tbody>
            @for (t of d.items; track t.taskId) {
              <tr data-testid="recent-row" class="border-t border-[var(--color-border)]">
                <td class="truncate py-2">
                  <a class="hover:underline" [routerLink]="['/work', t.projectId, 'board']" [queryParams]="{ highlightTaskId: t.taskId }" [title]="t.title">{{ t.title }}</a>
                </td>
                <td class="truncate py-2">{{ t.projectName }}</td>
                <td class="py-2">
                  <span
                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                    [style.backgroundColor]="statusBackground(t.statusColor)"
                    [style.color]="t.statusColor"
                  >
                    {{ t.statusName }}
                  </span>
                </td>
                <td class="py-2">
                  <span class="rounded-full px-2 py-0.5 text-xs font-medium" [style.backgroundColor]="priorityBackground(t.priority)" [style.color]="priorityColor(t.priority)">
                    {{ priority(t.priority) }}
                  </span>
                </td>
                <td class="py-2">{{ due(t.dueDate) }}</td>
                <td class="py-2">{{ t.storyPoints ?? '—' }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </app-widget-card>
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

  due(dueDate: string | null): string {
    return dueDate ? formatShortDate(dueDate) : '—';
  }

  statusBackground(hex: string): string {
    return `color-mix(in srgb, ${hex} 15%, transparent)`;
  }

  priorityColor(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'urgent':
      case 'high':
        return 'var(--color-danger)';
      case 'medium':
        return 'var(--color-warning)';
      default:
        return 'var(--color-success)';
    }
  }

  priorityBackground(priority: string): string {
    return `color-mix(in srgb, ${this.priorityColor(priority)} 15%, transparent)`;
  }
}
