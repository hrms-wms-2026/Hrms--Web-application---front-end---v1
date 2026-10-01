import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeChecklistGroup } from '../../models/employee-overview.model';
import { progressPercent } from '../../utils/employee-overview.utils';

/** Lifetime view of onboarding/offboarding checklist progress; not period-aware. */
@Component({
  selector: 'app-overview-checklists-widget',
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Checklists"
      [state]="loader.state()"
      errorMessage="Could not load checklists."
      emptyMessage="No checklist tasks."
      (retry)="loader.reload()"
    >
      @if (loader.data(); as d) {
        <ul class="space-y-4">
          @for (group of d.groups; track group.lifecycleType + group.name) {
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
    </app-widget-card>
  `,
  styles: [`
    .bar { height: 100%; background: #3b82f6; }
    .bar--done { background: #16a34a; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OverviewChecklistsWidgetComponent {
  private readonly api = inject(PeopleApiService);

  readonly employeeId = input.required<string>();

  readonly loader = createWidgetLoader(
    () => this.api.getOverviewChecklists(this.employeeId()),
    { isEmpty: (v) => v.groups.length === 0 }
  );

  percent(group: EmployeeChecklistGroup): number {
    return progressPercent(group.completed, group.total);
  }

  isDone(group: EmployeeChecklistGroup): boolean {
    return group.total > 0 && group.completed === group.total;
  }
}
