import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WidgetCardComponent } from '../../../../shared/ui/widget-card/widget-card.component';
import { createWidgetLoader } from '../../../../shared/ui/widget-card/widget-loader';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDeliveryResponse, EmployeeWorkOverviewResponse } from '../../models/employee-overview.model';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { Delta } from '../../utils/employee-overview.utils';
import { createCompareLoader, deltaIf } from '../../utils/overview-compare';
import { KpiCard } from '../../utils/overview-kpi-cards';
import { OverviewKpiStripComponent } from '../overview-kpi-strip/overview-kpi-strip.component';

/**
 * Top-of-tab KPI strip in the Overview tab's style: completed/assigned, in progress and overdue
 * from getOverviewWork plus story points from getOverviewDelivery - two independent loaders. The
 * strip's loading/error state follows `work` alone; the Story points card appears only once
 * `delivery` is itself ready, so a failure on that endpoint still leaves the work cards visible.
 * When the header's Compare is on, each card shows its change against the comparison month.
 */
@Component({
  selector: 'app-work-summary-widget',
  standalone: true,
  imports: [WidgetCardComponent, OverviewKpiStripComponent],
  template: `
    @switch (work.state()) {
      @case ('loading') {
        <div data-testid="widget-loading" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          @for (i of [0, 1, 2, 3]; track i) {
            <div class="h-[4.25rem] animate-pulse rounded-xl border border-[var(--color-border)]/80 bg-[var(--color-surface-secondary)]"></div>
          }
        </div>
      }
      @case ('ready') {
        <app-overview-kpi-strip [cards]="cards()" [deltas]="deltas()" [against]="period.compareLabel()" [interactive]="false" />
      }
      @default {
        <app-widget-card
          title="Work Summary"
          [state]="work.state()"
          errorMessage="Could not load the work summary."
          emptyMessage="No tasks in this period."
          (retry)="retry()"
        />
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkSummaryWidgetComponent {
  private readonly api = inject(PeopleApiService);
  protected readonly period = inject(EmployeePeriodStore);

  readonly employeeId = input.required<string>();

  readonly work = createWidgetLoader(() => this.api.getOverviewWork(this.employeeId(), this.period.from(), this.period.to()));

  readonly delivery = createWidgetLoader(() =>
    this.api.getOverviewDelivery(this.employeeId(), this.period.from(), this.period.to(), false)
  );

  readonly compareWork = createCompareLoader(this.period, (from, to) => this.api.getOverviewWork(this.employeeId(), from, to));

  readonly compareDelivery = createCompareLoader(this.period, (from, to) =>
    this.api.getOverviewDelivery(this.employeeId(), from, to, false)
  );

  readonly cards = computed<readonly KpiCard[]>(() => {
    const w = this.work.data();
    if (!w) return [];
    const d = this.delivery.state() === 'ready' ? this.delivery.data() : null;
    return workKpiCards(w, d);
  });

  readonly deltas = computed<readonly (Delta | null)[]>(() => {
    const comparing = this.period.isComparing();
    const w = this.compareWork.data();
    const d = this.compareDelivery.data();
    return this.cards().map((card) => deltaIf(comparing, card.value, compareValue(card.key, w, d), card.polarity));
  });

  retry(): void {
    this.work.reload();
    this.delivery.reload();
  }
}

function workKpiCards(w: EmployeeWorkOverviewResponse, d: EmployeeDeliveryResponse | null): readonly KpiCard[] {
  const cards: KpiCard[] = [
    {
      key: 'tasks_completed',
      tone: 'baseline',
      label: 'Tasks completed',
      value: w.completed,
      denominator: w.assigned,
      suffix: '',
      detail: `${w.completionRatePercent}% completion rate · ${w.assigned} assigned`,
      polarity: 'higher-better'
    },
    {
      key: 'tasks_in_progress',
      tone: 'baseline',
      label: 'In progress',
      value: w.inProgress,
      denominator: null,
      suffix: '',
      detail: `${w.notStarted} not started yet`,
      polarity: 'higher-better'
    },
    {
      key: 'overdue_tasks',
      tone: w.overdue > 0 ? 'critical' : 'baseline',
      label: 'Overdue tasks',
      value: w.overdue,
      denominator: null,
      suffix: '',
      detail: w.overdue > 0 ? 'Past their due date' : 'Nothing overdue',
      polarity: 'lower-better'
    }
  ];
  if (d) {
    cards.push({
      key: 'story_points',
      tone: 'baseline',
      label: 'Story points',
      value: d.storyPointsCompleted,
      denominator: d.storyPointsAssigned,
      suffix: '',
      detail: 'Completed of assigned',
      polarity: 'higher-better'
    });
  }
  return cards;
}

function compareValue(key: string, w: EmployeeWorkOverviewResponse | null, d: EmployeeDeliveryResponse | null): number | null {
  switch (key) {
    case 'tasks_completed':
      return w?.completed ?? null;
    case 'tasks_in_progress':
      return w?.inProgress ?? null;
    case 'overdue_tasks':
      return w?.overdue ?? null;
    case 'story_points':
      return d?.storyPointsCompleted ?? null;
    default:
      return null;
  }
}
