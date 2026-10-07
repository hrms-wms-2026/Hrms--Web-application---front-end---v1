import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { attentionLabel } from '../../utils/employee-work-activity.utils';

@Component({
  selector: 'app-needs-attention-widget',
  standalone: true,
  imports: [WidgetCardComponent, RouterLink, PopoutPanelComponent],
  template: `
    @if (loader.state() === 'ready' && loader.data(); as d) {
      <app-popout-panel class="h-full" [open]="expanded()" label="Needs Attention" (closed)="expanded.set(false)">
      <section data-testid="needs-attention" class="flex h-full flex-col rounded-2xl border border-[#fef08a] bg-[#fefce8] p-5">
        <div class="mb-2 flex items-center gap-2">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700" aria-hidden="true">!</span>
          <h2 class="text-sm font-bold text-slate-900">Needs Attention</h2>
        </div>

        <div class="divide-y divide-amber-200/70" id="work-attention-list">
          @for (item of expanded() ? d.items : d.items.slice(0, collapsedLimit); track item.taskId) {
            <a
              data-testid="attention-row"
              class="flex w-full items-center justify-between gap-3 py-3 text-left"
              [routerLink]="['/work', item.projectId, 'board']"
              [queryParams]="{ highlightTaskId: item.taskId }"
              [attr.aria-label]="'Open task ' + item.title"
            >
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  [class.bg-red-500]="item.reason === 'overdue'"
                  [class.bg-amber-500]="item.reason === 'due_soon'"
                  aria-hidden="true"
                >⏱</span>
                <div class="min-w-0">
                  <p class="truncate text-xs font-bold text-slate-900" [title]="item.title">{{ item.title }}</p>
                  <p class="mt-0.5 truncate text-[11px] text-slate-500">
                    @if (item.shortId) { {{ item.shortId }} · }{{ item.projectName }} · {{ item.statusName }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <span
                  class="rounded px-2 py-0.5 text-[11px] font-semibold"
                  [class.bg-red-100]="item.reason === 'overdue'"
                  [class.text-red-700]="item.reason === 'overdue'"
                  [class.bg-amber-100]="item.reason === 'due_soon'"
                  [class.text-amber-700]="item.reason === 'due_soon'"
                >{{ label(item) }}</span>
                <span class="text-slate-400" aria-hidden="true">▸</span>
              </div>
            </a>
          }
        </div>

        @if (d.items.length > 0) {
          <div class="mt-auto flex justify-end border-t border-amber-200/70 pt-3">
            <button
              type="button"
              class="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
              data-testid="attention-toggle"
              aria-controls="work-attention-list"
              [attr.aria-expanded]="expanded()"
              (click)="expanded.set(!expanded())"
            >
              {{ expanded() ? 'Show less' : 'View all' }}
            </button>
          </div>
        }
      </section>
      </app-popout-panel>
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

  /** Rows shown on the compact card; "View all" pops the full list out over the page. */
  readonly collapsedLimit = 3;
  readonly expanded = signal(false);
}
