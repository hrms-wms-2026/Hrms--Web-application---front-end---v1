import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/** One stacked part of a bar, bottom first. */
export interface DashboardBarSegment {
  readonly key: string;
  readonly value: number;
  readonly color: string;
  /** What the headline reads while this part of the bar is hovered; without it the whole bar's reading shows. */
  readonly hover?: DashboardBarSegmentHover;
}

/** The headline for one hovered part of a bar ("Watercraft · In progress", "700 h", "35% of 2,000 h allocated"). */
export interface DashboardBarSegmentHover {
  readonly label: string;
  readonly value: string;
  readonly chip?: string;
}

/** Whether a bar is a finished bucket, the running one (drawn lighter) or one still to come (empty track). */
export type DashboardBarState = 'done' | 'current' | 'future';

/** A small pill beside the headline value. */
export interface DashboardBarChip {
  readonly text: string;
  readonly tone: 'up' | 'down' | 'neutral';
  readonly title?: string;
}

export interface DashboardBar {
  readonly key: string;
  /** Under the bar; empty hides it (thinned labels). */
  readonly label: string;
  /** The headline's label while the bar is hovered ("Week of 14 Sep", "Mon 3 Nov"). */
  readonly title: string;
  /** The headline's value while the bar is hovered ("383 h", "92%"). */
  readonly valueText: string;
  /** The pill beside it while hovered ("12 tasks", "23 present"). */
  readonly chip?: string;
  /** A smaller line under the value while hovered ("12h task · 2 done"); `orders` layout. */
  readonly sub?: string;
  readonly segments: readonly DashboardBarSegment[];
  /** A second stack drawn beside the first (planned | actual, worked | task); same axis. */
  readonly pair?: readonly DashboardBarSegment[];
  /** A target on the same axis (expected hours), drawn as a dash across the track. */
  readonly marker?: number;
  /** A small count over the track (people on leave). */
  readonly badge?: { readonly text: string; readonly title: string };
  /** Drawn faint, so another bar stands out (the selected day). */
  readonly dim?: boolean;
  readonly tooltip: string;
  readonly state?: DashboardBarState;
  /** Why this bar needs attention ("At risk: …"). Draws a red border round its track and, while the bar is
   * hovered, a red line under the headline that says why. */
  readonly alert?: string;
}

/** One entry of the chart's legend: a bar colour, or the target dash. */
export interface DashboardBarLegendItem {
  readonly label: string;
  readonly color: string;
  readonly marker?: boolean;
}

/** What the headline reads while no bar is hovered. */
export interface DashboardBarHeadline {
  readonly label: string;
  readonly value: string;
  readonly chip?: DashboardBarChip | null;
  /** Hover text for the label (what the numbers mean). */
  readonly hint?: string;
  /** A red line under the headline: why the hovered bar has a red border. */
  readonly alert?: string;
  /** A smaller line under the value (the comparison figure); `orders` layout. */
  readonly sub?: string;
}

/**
 * `earnings`: a boxy grey track per bucket, legend under the chart.
 * `orders` (BoardUI "Orders chart card"): no tracks, slim side-by-side bars, a soft band behind the hovered
 * bucket, a larger headline with a comparison line under it, and the legend (round dots) beside the headline.
 */
export type DashboardBarVariant = 'earnings' | 'orders';

/** A round axis step (1, 2 or 5 x 10^n) so two steps cover the tallest bar. */
function axisStep(max: number): number {
  if (!(max > 0)) return 1;
  const raw = max / 2;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? 10 * power;
}

/** "1.2K" from 1000 up, plain below (whole steps under 1 keep their decimals), then the unit. */
function axisText(value: number, suffix: string): string {
  return (
    (value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : `${Number(value.toFixed(2))}`) +
    suffix
  );
}

const stackTotal = (segments: readonly DashboardBarSegment[] | undefined): number =>
  (segments ?? []).reduce((sum, s) => sum + Math.max(0, s.value), 0);

/**
 * The one bar chart every dashboard widget and popup draws (2026-11-06), in the BoardUI "Earnings chart" layout:
 * an optional headline, a round axis on the left and one boxy track per bucket with its segments stacked from
 * the bottom (the stack keeps a small top curve). Hovering a bar outlines its track and, with a headline, puts
 * that bar's title, value and chip in it; leaving the chart brings the headline back. A `current` bar is drawn
 * lighter and a `future` one is an empty track. Fills its parent's height.
 *
 * Usage: `<app-dashboard-bar-chart [bars]="bars()" [headline]="{ label, value }" ariaLabel="…" />`
 */
@Component({
  selector: 'app-dashboard-bar-chart',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './dashboard-bar-chart.component.html',
  styleUrl: './dashboard-bar-chart.component.css',
  host: {
    class: 'block',
    '[class.bc--orders]': "variant() === 'orders'",
    '[class.bc--boxy]': 'boxy()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardBarChartComponent {
  readonly bars = input.required<readonly DashboardBar[]>();
  readonly ariaLabel = input.required<string>();
  /** The resting headline; null leaves the headline out (hover then shows only the outline and tooltip). */
  readonly headline = input<DashboardBarHeadline | null>(null);
  /** The headline on one short line (label, value, chip), for cards with little height. */
  readonly compactHeadline = input(false);
  /** Hides the left axis. */
  readonly hideAxis = input(false);
  /** Shown over the empty tracks when every bar is zero. */
  readonly emptyText = input('Nothing in this range');
  /** A unit after each axis tick ("h"). */
  readonly axisSuffix = input('');
  /** A key under the chart: what each colour (and the target dash) means. */
  readonly legend = input<readonly DashboardBarLegendItem[]>([]);
  /** The look: see {@link DashboardBarVariant}. */
  readonly variant = input<DashboardBarVariant>('earnings');

  /** Orders layout with a week or less (7 buckets): wide boxy bars with a small corner curve, not slim ones. */
  protected readonly boxy = computed(() => this.variant() === 'orders' && this.bars().length <= 7);

  /** The hovered bar's index. */
  protected readonly active = signal<number | null>(null);
  /** The hovered part of the active bar (a segment key), when that part has its own hover reading. */
  protected readonly activeSegment = signal<string | null>(null);

  /** Keeps a line under the headline for the alert text whenever any bar has one, so hovering never shifts the plot. */
  protected readonly alertLine = computed(() => this.bars().some((bar) => !!bar.alert));

  /** Each bar's largest figure on the axis: its stack, its pair or its target. */
  private readonly tallest = computed(() =>
    this.bars().map((bar) =>
      Math.max(stackTotal(bar.segments), stackTotal(bar.pair), bar.marker ?? 0),
    ),
  );

  protected readonly axis = computed(() => {
    const step = axisStep(Math.max(0, ...this.tallest()));
    const suffix = this.axisSuffix();
    return { max: step * 2, ticks: [step * 2, step, 0].map((v) => axisText(v, suffix)) };
  });

  /** Each bar's stacks (heights as shares of the axis, segments as shares of their stack) and target. */
  protected readonly columns = computed(() => {
    const max = this.axis().max;
    const stack = (segments: readonly DashboardBarSegment[] | undefined, future: boolean) => {
      const total = stackTotal(segments);
      return {
        height: future || !(total > 0) ? 0 : Math.min(100, (total / max) * 100),
        segments: (segments ?? [])
          .filter((s) => s.value > 0)
          .map((s) => ({ ...s, share: (s.value / total) * 100 })),
      };
    };
    return this.bars().map((bar) => {
      const future = bar.state === 'future';
      const main = stack(bar.segments, future);
      return {
        bar,
        height: main.height,
        segments: main.segments,
        pair: bar.pair ? stack(bar.pair, future) : null,
        marker:
          bar.marker !== undefined && bar.marker > 0
            ? Math.min(100, (bar.marker / max) * 100)
            : null,
      };
    });
  });

  protected readonly empty = computed(() => this.tallest().every((t) => !(t > 0)));

  protected readonly shownHeadline = computed<DashboardBarHeadline | null>(() => {
    const resting = this.headline();
    if (!resting) return null;
    const index = this.active();
    const bar = index === null ? undefined : this.bars()[index];
    if (!bar) return resting;
    if (bar.state === 'future') return { label: bar.title, value: '—', chip: null };
    const segmentKey = this.activeSegment();
    const hover =
      segmentKey === null
        ? undefined
        : [...bar.segments, ...(bar.pair ?? [])].find((s) => s.key === segmentKey)?.hover;
    if (hover) {
      return {
        label: hover.label,
        value: hover.value,
        chip: hover.chip ? { text: hover.chip, tone: 'neutral' } : null,
        sub: bar.sub,
        alert: bar.alert,
      };
    }
    return {
      label: bar.title,
      value: bar.valueText,
      chip: bar.chip ? { text: bar.chip, tone: 'neutral' } : null,
      sub: bar.sub,
      alert: bar.alert,
    };
  });

  protected enterBar(index: number): void {
    this.active.set(index);
    this.activeSegment.set(null);
  }

  protected leaveChart(): void {
    this.active.set(null);
    this.activeSegment.set(null);
  }
}
