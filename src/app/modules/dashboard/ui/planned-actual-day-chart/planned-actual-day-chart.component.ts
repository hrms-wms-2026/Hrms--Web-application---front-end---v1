import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  PLANNED_ACTUAL_COLORS,
  PlannedActualRow,
  actualOf,
  plannedActualScale,
  plannedActualShare,
} from '../../utils/planned-actual-format.util';
import { minutesText } from '../../utils/team-presence-format.util';

interface DayChartRow {
  readonly id: string;
  readonly label: string;
  readonly planned: number;
  readonly scheduled: number;
  readonly outside: number;
  readonly noPlan: number;
  readonly actualText: string;
  readonly plannedText: string;
  readonly completion: string;
  readonly tooltip: string;
}

/**
 * Today's planned vs actual, one row per person (2026-11-02 design match section 7.3): a light planned bar over the
 * actual clocked bar split into in plan / outside slot / no plan, both against the larger of planned and actual over
 * every row, so overtime never draws past its track. Texts are the true, uncapped minutes.
 */
@Component({
  selector: 'app-planned-actual-day-chart',
  standalone: true,
  templateUrl: './planned-actual-day-chart.component.html',
  styleUrl: './planned-actual-day-chart.component.css',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlannedActualDayChartComponent {
  readonly rows = input.required<readonly PlannedActualRow[]>();
  /** The most rows to draw (the card's budget); everyone when unset. */
  readonly maxRows = input<number | null>(null);

  protected readonly colors = PLANNED_ACTUAL_COLORS;

  protected readonly shown = computed<readonly DayChartRow[]>(() => {
    const max = this.maxRows();
    const rows = max === null ? this.rows() : this.rows().slice(0, max);
    const scale = plannedActualScale(rows);
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      planned: plannedActualShare(r.planned, scale),
      scheduled: plannedActualShare(r.scheduled, scale),
      outside: plannedActualShare(r.outside, scale),
      noPlan: plannedActualShare(r.noPlan, scale),
      actualText: minutesText(actualOf(r)),
      plannedText: minutesText(r.planned),
      completion:
        r.completion === null || r.completion === undefined ? '—' : `${Math.round(r.completion)}%`,
      tooltip:
        `${r.label}: planned ${minutesText(r.planned)}, actual ${minutesText(actualOf(r))} ` +
        `(${minutesText(r.scheduled)} in plan, ${minutesText(r.outside)} outside slot, ${minutesText(r.noPlan)} no plan)`,
    }));
  });

  protected readonly summary = computed(
    () =>
      'Planned vs actual today. ' +
      this.shown()
        .map((r) => `${r.label}: planned ${r.plannedText}, actual ${r.actualText}`)
        .join('; '),
  );
}
