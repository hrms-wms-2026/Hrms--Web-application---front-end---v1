import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { LedWeeklyCompletionWeek } from '../../models/team-progress-detail.model';
import { formatHourValue } from '../../utils/team-progress-format.util';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "13 Oct" from a yyyy-MM-dd date, without going through local time (no time-zone shift). */
function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1] ?? ''}`.trim();
}

/** "Mon" from a yyyy-MM-dd date (UTC, so the weekday never shifts). */
function weekday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/** Today as yyyy-MM-dd in local time. */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 1, 2, 2.5 or 5 times a power of ten, at least `value`. */
function niceCeil(value: number): number {
  if (!(value > 0)) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
}

/** Axis label: 950, 1.2K, 12K. */
function axisHours(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function percentText(value: number): string {
  if (value > 0 && value < 0.1) return '<0.1%';
  return `${Math.round(value * 10) / 10}%`;
}

type BucketState = 'done' | 'current' | 'future';

interface ComboBucket {
  key: string;
  label: string;
  /** Long name for the headline while the bucket is hovered. */
  title: string;
  hours: number;
  tasks: number;
  /** Bar height as a share of the left axis (0-100). */
  height: number;
  state: BucketState;
  /** Completion so far (cumulative, % of the allocation); null for future buckets. */
  percent: number | null;
}

/**
 * Team Progress popup: completed task hours as rounded bars on the left axis and the completion so far
 * (cumulative completed / allocated) as a line on its own right axis. Hovering a bucket darkens its bar,
 * dims the rest, pulses its dot and swaps the headline; the tiles below hold the total and the
 * completion. Buckets are weeks or days (`granularity`), oldest first. Built after BoardUI's Combo Chart
 * Card, with this app's tokens.
 */
@Component({
  selector: 'app-completion-combo-chart',
  standalone: true,
  templateUrl: './completion-combo-chart.component.html',
  styleUrl: './completion-combo-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompletionComboChartComponent {
  readonly buckets = input.required<readonly LedWeeklyCompletionWeek[]>();
  readonly allocatedHours = input(0);
  readonly granularity = input<'week' | 'day'>('week');
  /** What the buckets cover, for the caption ("Last 10 weeks", "This month"). */
  readonly rangeLabel = input('');
  /** yyyy-MM-dd; marks the current bucket and leaves later ones out of the line. Tests pass a fixed day. */
  readonly today = input(localToday());

  protected readonly hovered = signal<number | null>(null);

  protected readonly items = computed<ComboBucket[]>(() => {
    const buckets = this.buckets();
    const today = this.today();
    const day = this.granularity() === 'day';
    const allocation = this.allocatedHours();
    const axisMax = this.leftMax();
    let done = 0;
    return buckets.map((b, i) => {
      const last = i === buckets.length - 1;
      const state: BucketState = b.weekStart > today ? 'future' : b.weekEnd >= today || (last && !day) ? 'current' : 'done';
      if (state !== 'future') done += b.completedHours;
      const percent = state === 'future' || !(allocation > 0) ? null : Math.min(100, (done * 100) / allocation);
      const label = day ? (state === 'current' ? 'Today' : weekday(b.weekStart)) : state === 'current' ? 'This wk' : shortDate(b.weekStart);
      const title = day
        ? `${weekday(b.weekStart)} ${shortDate(b.weekStart)}`
        : b.weekStart === b.weekEnd
          ? shortDate(b.weekStart)
          : `${shortDate(b.weekStart)} – ${shortDate(b.weekEnd)}`;
      return {
        key: b.weekStart,
        label,
        title: state === 'current' ? `${title} (so far)` : title,
        hours: b.completedHours,
        tasks: b.completedTaskCount,
        height: state !== 'future' && axisMax > 0 ? (b.completedHours / axisMax) * 100 : 0,
        state,
        percent
      };
    });
  });

  /** Left axis top: three nice steps over the busiest bucket (0 / 200 / 400 / 600, never 333.3). */
  protected readonly leftMax = computed(() => 3 * niceCeil(Math.max(0, ...this.buckets().map((b) => b.completedHours)) / 3));
  protected readonly leftTicks = computed(() => {
    const max = this.leftMax();
    return max > 0 ? [max, (max * 2) / 3, max / 3, 0].map(axisHours) : [];
  });

  /** With many buckets every other label is shown (the current one always), so none are cut off. */
  protected readonly labelStep = computed(() => (this.buckets().length > 7 ? 2 : 1));
  protected showLabel(index: number, state: BucketState): boolean {
    const last = this.buckets().length - 1;
    return state === 'current' || (last - index) % this.labelStep() === 0;
  }

  protected readonly hasLine = computed(() => this.allocatedHours() > 0 && this.items().some((i) => i.percent !== null));
  /** Right axis top: three nice steps over the line's highest point (never past ~100%). */
  protected readonly rightMax = computed(() => {
    const top = Math.max(0, ...this.items().map((i) => i.percent ?? 0));
    return top > 0 ? Math.min(120, 3 * niceCeil(top / 3)) : 100;
  });
  protected readonly rightTicks = computed(() => {
    const max = this.rightMax();
    return [max, (max * 2) / 3, max / 3, 0].map((v) => `${Math.round(v * 10) / 10}%`);
  });

  /** Line points in a 0-100 box (x = bucket centre). */
  protected readonly points = computed(() => {
    const items = this.items();
    const max = this.rightMax();
    return items.flatMap((item, i) =>
      item.percent === null ? [] : [{ index: i, x: ((i + 0.5) * 100) / items.length, y: 100 - (item.percent / max) * 100 }]
    );
  });
  protected readonly linePath = computed(() =>
    this.points()
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ')
  );

  protected readonly totalHours = computed(() => this.buckets().reduce((sum, b) => sum + b.completedHours, 0));
  protected readonly totalTasks = computed(() => this.buckets().reduce((sum, b) => sum + b.completedTaskCount, 0));
  /** Completion at the end of the line (the latest non-future bucket). */
  protected readonly completion = computed(() => {
    const done = this.items().filter((i) => i.percent !== null);
    return done.length > 0 ? done[done.length - 1].percent : null;
  });

  /** Headline: the hovered bucket, else the whole range. */
  protected readonly headline = computed(() => {
    const index = this.hovered();
    const item = index === null ? null : (this.items()[index] ?? null);
    if (item) {
      return {
        caption: item.title,
        hours: item.hours,
        tasks: item.tasks,
        pill: item.percent === null ? null : `${percentText(item.percent)} done`
      };
    }
    const completion = this.completion();
    return {
      caption: this.rangeLabel() ? `Completed · ${this.rangeLabel()}` : 'Completed',
      hours: this.totalHours(),
      tasks: this.totalTasks(),
      pill: completion === null ? null : `${percentText(completion)} done`
    };
  });

  protected readonly completionText = computed(() => {
    const value = this.completion();
    return value === null ? '—' : percentText(value);
  });

  protected readonly summary = computed(() => {
    const parts = this.items().map((i) => `${i.title} ${formatHourValue(i.hours)} h`);
    const completion = this.completion();
    const line = completion === null ? '' : `. Completion so far: ${percentText(completion)} of the allocation`;
    const unit = this.granularity() === 'day' ? 'day' : 'week';
    return `Completed task hours per ${unit}: ${parts.join(', ')}${line}`;
  });

  protected readonly formatHourValue = formatHourValue;

  protected hover(index: number | null): void {
    this.hovered.set(index);
  }
}
