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
    @if (loader.state() === 'ready' && loader.data(); as d) {
      <section data-testid="needs-attention" class="flex h-full flex-col rounded-2xl border border-[#fef08a] bg-[#fefce8] p-5">
        <header class="mb-1 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700" aria-hidden="true">!</span>
            <div>
              <h2 class="text-sm font-bold text-slate-900">Needs Attention</h2>
              <p class="text-[11px] text-slate-500">Overdue or due in the next 3 days</p>
            </div>
          </div>
          <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">{{ d.totalCount }}</span>
        </header>

        <ul class="divide-y divide-amber-200/70">
          @for (item of d.items; track item.taskId) {
            <li data-testid="attention-row" class="flex items-center justify-between gap-3 py-3">
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  [class.bg-red-500]="item.reason === 'overdue'"
                  [class.bg-amber-500]="item.reason === 'due_soon'"
                  aria-hidden="true"
                >{{ item.reason === 'overdue' ? '!' : '⏱' }}</span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold text-slate-900" [title]="item.title">
                    @if (item.shortId) { <span class="mr-1 font-medium text-slate-400">{{ item.shortId }}</span> }{{ item.title }}
                  </p>
                  <p class="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500">
                    <span class="truncate">{{ item.projectName }}</span>
                    <span class="text-slate-300">·</span>
                    <span class="inline-flex shrink-0 items-center gap-1">
                      <span class="h-1.5 w-1.5 rounded-full" [style.background]="item.statusColor || '#94a3b8'"></span>{{ item.statusName }}
                    </span>
                    @if (item.storyPoints !== null) {
                      <span class="text-slate-300">·</span>
                      <span class="shrink-0">{{ item.storyPoints }} SP</span>
                    }
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span
                  class="rounded px-2 py-0.5 text-[11px] font-semibold"
                  [class.bg-red-100]="item.reason === 'overdue'"
                  [class.text-red-700]="item.reason === 'overdue'"
                  [class.bg-amber-100]="item.reason === 'due_soon'"
                  [class.text-amber-800]="item.reason === 'due_soon'"
                >{{ label(item) }}</span>
                <a
                  class="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  [routerLink]="['/work', item.projectId, 'board']"
                  [queryParams]="{ highlightTaskId: item.taskId }"
                  [attr.aria-label]="'View task ' + item.title"
                >
                  View
                </a>
              </div>
            </li>
          }
        </ul>

        @if (d.totalCount > d.items.length) {
          <p class="mt-auto border-t border-amber-200/70 pt-3 text-right text-xs font-semibold text-amber-800">+{{ d.totalCount - d.items.length }} more</p>
        }
      </section>
    } @else {
      <app-widget-card
        title="Needs Attention"
        [state]="loader.state()"
        emptyMessage="Nothing overdue or due in the next 3 days."
        errorMessage="Could not load tasks that need attention."
        (retry)="loader.reload()"
      />
    }
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
