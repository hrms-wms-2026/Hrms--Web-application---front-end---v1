import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { PopoutHeaderActionsComponent, latestDate } from '../../../../shared/ui/popout-header-actions/popout-header-actions.component';
import { PopoutPanelComponent } from '../../../../shared/ui/popout-panel/popout-panel.component';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeChecklistGroup } from '../../models/employee-overview.model';
import { progressPercent } from '../../utils/employee-overview.utils';

/** Groups on the compact card. */
export const CHECKLIST_PREVIEW_LIMIT = 3;

/**
 * Lifetime view of onboarding/offboarding checklist progress; not period-aware. One request: the
 * response is a handful of per-checklist counts, so the popup reuses it rather than refetching.
 * The card shows the first three; clicking it (or View all) pops it out in place with all of them.
 */
@Component({
  selector: 'app-overview-checklists-widget',
  standalone: true,
  imports: [WidgetCardComponent, PopoutPanelComponent, PopoutHeaderActionsComponent],
  template: `
    <app-popout-panel class="block h-full" [open]="showAll()" label="Checklists" (closed)="showAll.set(false)">
    <app-widget-card
      class="group"
      [class.cursor-pointer]="canExpand() && !showAll()"
      (click)="expand()"
      title="Checklists"
      [state]="loader.state()"
      errorMessage="Could not load checklists."
      emptyMessage="No checklist tasks."
      (retry)="loader.reload()"
    >
      <app-popout-header-actions
        widget-actions
        [refreshedAt]="loader.loadedAt()"
        [refreshing]="loader.refreshing()"
        [expanded]="showAll()"
        [canExpand]="canExpand()"
        [revealOnHover]="!showAll()"
        (refresh)="loader.refresh()"
        (expand)="expand()"
        (closed)="showAll.set(false)"
      />
      @if (loader.data(); as d) {
        <ul class="space-y-4">
          @for (group of displayedGroups(); track group.lifecycleType + group.name) {
            <li data-testid="checklist-group" [class.group--done]="isDone(group)">
              <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span class="font-medium text-[var(--color-text-primary)]">{{ group.name }}</span>
                <span class="text-xs text-[var(--color-text-secondary)]">
                  {{ group.completed }} / {{ group.total }}@if (group.bypassed > 0) { · {{ group.bypassed }} bypassed }
                </span>
              </div>
              <div
                class="h-2 overflow-hidden rounded-full bg-[var(--color-surface-secondary)]"
                role="progressbar"
                [attr.aria-valuemin]="0"
                [attr.aria-valuemax]="group.total"
                [attr.aria-valuenow]="group.completed"
                [attr.aria-label]="group.name + ': ' + group.completed + ' of ' + group.total + ' completed'"
              >
                <div class="bar" data-testid="checklist-bar" [class.bar--done]="isDone(group)" [style.width.%]="percent(group)"></div>
              </div>
            </li>
          }
        </ul>
      }

      @if (canExpand()) {
        <div class="mt-3 flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            class="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
            data-testid="checklists-toggle"
            [attr.aria-expanded]="showAll()"
            (click)="onToggleClick($event)"
          >
            {{ showAll() ? 'Show less' : 'View all' }}
          </button>
        </div>
      }
    </app-widget-card>
    </app-popout-panel>
  `,
  styles: [`
    .bar { height: 100%; background: #3b82f6; }
    .bar--done { background: #16a34a; }
  `],
  host: {
    class: 'block h-full',
    '[style.display]': "loader.state() === 'empty' ? 'none' : null"
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewChecklistsWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewChecklists(this.employeeId()),
    { isEmpty: (v) => v.groups.length === 0 }
  );

  readonly showAll = signal(false);
  readonly canExpand = computed(() => (this.loader.data()?.groups.length ?? 0) > CHECKLIST_PREVIEW_LIMIT);
  readonly displayedGroups = computed(() => {
    const groups = this.loader.data()?.groups ?? [];
    return this.showAll() ? groups : groups.slice(0, CHECKLIST_PREVIEW_LIMIT);
  });

  /** A click anywhere on the card pops it out - only when there are more groups than it shows. */
  expand(): void {
    if (!this.showAll() && this.canExpand()) this.showAll.set(true);
  }

  onToggleClick(event: Event): void {
    event.stopPropagation();
    this.showAll.set(!this.showAll() && this.canExpand());
  }

  percent(group: EmployeeChecklistGroup): number {
    return progressPercent(group.completed, group.total);
  }

  isDone(group: EmployeeChecklistGroup): boolean {
    return group.total > 0 && group.completed === group.total;
  }
}
