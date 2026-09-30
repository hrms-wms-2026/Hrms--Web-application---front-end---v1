import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { attentionLabel } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-needs-attention-widget',
  standalone: true,
  imports: [WidgetCardComponent, RouterLink],
  template: `
    <app-widget-card
      title="Needs attention"
      [state]="loader.state()"
      emptyMessage="Nothing overdue or due in the next 3 days."
      errorMessage="Could not load tasks that need attention."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <table class="w-full table-fixed text-sm">
          <thead class="text-left text-[var(--color-text-secondary)]">
            <tr>
              <th class="w-[30%] py-1 font-normal">Task</th>
              <th class="py-1 font-normal">Project</th>
              <th class="py-1 font-normal">Issue</th>
              <th class="py-1 font-normal">Status</th>
              <th class="w-10 py-1 font-normal">SP</th>
              <th class="w-20 py-1"></th>
            </tr>
          </thead>
          <tbody>
            @for (item of d.items; track item.taskId) {
              <tr data-testid="attention-row" class="border-t border-[var(--color-border)]">
                <td class="truncate py-2" [title]="item.title">{{ item.title }}</td>
                <td class="truncate py-2">{{ item.projectName }}</td>
                <td
                  class="py-2"
                  [class.text-[var(--color-danger-text)]]="item.reason === 'overdue'"
                  [class.text-amber-600]="item.reason === 'due_soon'"
                >
                  {{ label(item) }}
                </td>
                <td class="py-2">
                  <span
                    class="rounded-full border px-2 py-0.5 text-xs"
                    [style.borderColor]="item.statusColor"
                    [style.color]="item.statusColor"
                  >
                    {{ item.statusName }}
                  </span>
                </td>
                <td class="py-2">{{ item.storyPoints ?? '—' }}</td>
                <td class="py-2 text-right">
                  <a
                    class="text-[var(--color-accent)] underline"
                    [routerLink]="['/work', item.projectId, 'board']"
                    [queryParams]="{ highlightTaskId: item.taskId }"
                  >
                    View task
                  </a>
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (d.totalCount > d.items.length) {
          <p class="mt-2 text-sm text-[var(--color-text-secondary)]">+{{ d.totalCount - d.items.length }} more</p>
        }
      }
    </app-widget-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NeedsAttentionWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(() => this.api.getWorkActivityNeedsAttention(this.employeeId()), {
    isEmpty: (d) => d.items.length === 0
  });

  readonly label = attentionLabel;
}
