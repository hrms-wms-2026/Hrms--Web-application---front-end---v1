import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import { DASHBOARD_DONUT_PX, donutValueFontPx } from '../utils/dashboard-donut.util';
import {
  ROUNDED_DONUT_STROKE,
  donutSweeps,
  easeOutCubic,
  fullRingPath,
  roundedSlicePath,
} from '../utils/rounded-donut.util';
import { DonutArc, donutArcs } from '../utils/status-donut.util';
import { formatPercent } from '../../../utils/format-percent.util';

/** One slice of a dashboard donut. */
export interface DashboardDonutSlice {
  readonly key: string;
  readonly label: string;
  /** Size of the slice (hours, people, tasks). Zero or less draws no arc. */
  readonly value: number;
  /** The value as the hover centre shows it ("12.5 h", "3"); the plain number when left out. */
  readonly valueText?: string;
  /** The share as shown ("12%"); the slice's share of all the slices when left out (a widget whose share is
   * of something else, like an allocation, passes its own). */
  readonly percentText?: string;
  readonly color: string;
}

/** A slice's share as shown: its own percentText, else its part of the slices' total. */
export function donutSliceShare(
  slice: DashboardDonutSlice,
  slices: readonly DashboardDonutSlice[],
): string {
  if (slice.percentText !== undefined) return slice.percentText;
  return formatPercent(
    slice.value,
    slices.reduce((sum, s) => sum + Math.max(0, s.value), 0),
  );
}

/** How long one slice takes to grow in, and how long the next one waits after it starts (ms). */
const SLICE_GROW_MS = 620;
const SLICE_STAGGER_MS = 240;
/** Matches dashboard-motion.css: wait for the card to rise in, then the widget's turn (--dash-i). */
const FIRST_LOAD_DELAY_MS = 420;
const WIDGET_STAGGER_MS = 90;
const REPLAY_DELAY_MS = 60;

/** Same slices in the same order, sizes and colours: a re-emitted list that would draw the same ring. */
function sameArcs(a: readonly DonutArc[], b: readonly DonutArc[]): boolean {
  return (
    a.length === b.length &&
    a.every(
      (arc, i) =>
        arc.key === b[i].key &&
        arc.color === b[i].color &&
        Math.abs(arc.length - b[i].length) < 1e-6,
    )
  );
}

/** A slice as drawn: its path, the stroke that rounds it (0 for the full ring) and how far it has faded in. */
interface DrawnSlice {
  readonly key: string;
  readonly color: string;
  readonly path: string;
  readonly stroke: number;
  readonly opacity: number;
}

/**
 * The one donut every dashboard widget and popup draws (2026-11-06). The ring is the slices in order from
 * 12 o'clock, drawn as rounded slices with a small gap between them (2026-11-07). On load the slices grow in one
 * after another, each sweeping from its own start; new data, or a card's refresh replay, plays it again. Hovering a slice, or setting `active` from a legend row, lifts that slice, fades the rest and
 * puts its value, name and share in the centre; otherwise the centre shows the projected content (each widget's
 * own figure). `active` is two-way, so a widget's colour key and the donut light the same slice.
 *
 * Usage: `<app-dashboard-donut [slices]="slices()" [(active)]="hovered" ariaLabel="…">centre</app-dashboard-donut>`
 */
@Component({
  selector: 'app-dashboard-donut',
  standalone: true,
  templateUrl: './dashboard-donut.component.html',
  styleUrl: './dashboard-donut.component.css',
  host: {
    class: 'dd',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '(mouseleave)': 'active.set(null)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardDonutComponent {
  readonly slices = input.required<readonly DashboardDonutSlice[]>();
  readonly ariaLabel = input.required<string>();
  /** Diameter in px: DASHBOARD_DONUT_PX by default (dashboardDonutPx(view) on a card with a mini view). */
  readonly size = input(DASHBOARD_DONUT_PX);
  /** Ring thickness in viewBox units (the box is 42 wide). */
  readonly strokeWidth = input(6);
  /** The slice under the pointer or picked from a legend row; null shows the projected centre. */
  readonly active = model<string | null>(null);

  protected readonly arcs = computed(
    () => donutArcs(this.slices().map((s) => ({ key: s.key, count: s.value, color: s.color }))),
    { equal: sameArcs },
  );

  /** Milliseconds into the grow-in; Infinity once done (or when motion is off), which draws the ring whole. */
  private readonly elapsed = signal(Number.POSITIVE_INFINITY);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private frame: number | null = null;
  private delay = 0;

  protected readonly drawn = computed<DrawnSlice[]>(() => {
    const arcs = this.arcs();
    const elapsed = this.elapsed();
    const sweeps = donutSweeps(arcs.map((a) => a.length));
    const lone = arcs.length === 1;
    return arcs.map((arc, i) => {
      const progress = easeOutCubic((elapsed - this.delay - i * SLICE_STAGGER_MS) / SLICE_GROW_MS);
      const { start, sweep } = sweeps[i];
      const whole = lone && progress >= 1;
      return {
        key: arc.key,
        color: arc.color,
        path: whole ? fullRingPath() : roundedSlicePath(start, sweep * progress, !lone),
        stroke: whole ? 0 : ROUNDED_DONUT_STROKE,
        opacity: Math.min(1, progress * 1.6),
      };
    });
  });

  constructor() {
    // A new set of slices grows in again; the first one waits for the widget's own rise-in.
    let first = true;
    effect(() => {
      this.arcs();
      untracked(() => {
        this.play(first ? this.firstLoadDelay() : REPLAY_DELAY_MS);
        first = false;
      });
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** A card's refresh button restarts the dashboard's CSS animations (dashboard-motion.css); the ring follows. */
  protected onReplay(event: AnimationEvent): void {
    // Angular scopes keyframe names ("_ngcontent-…_dd-replay-a"), so match on the part we wrote.
    if (event.animationName.includes('dd-replay')) this.play(REPLAY_DELAY_MS);
  }

  /** The lit slice: only one that draws an arc. */
  protected readonly activeSlice = computed(() => {
    const key = this.active();
    return key === null ? null : (this.slices().find((s) => s.key === key && s.value > 0) ?? null);
  });

  protected valueText(slice: DashboardDonutSlice): string {
    return slice.valueText ?? String(slice.value);
  }

  protected share(slice: DashboardDonutSlice): string {
    return donutSliceShare(slice, this.slices());
  }

  protected readonly valueFontPx = donutValueFontPx;

  private firstLoadDelay(): number {
    const index = Number.parseInt(
      getComputedStyle(this.host.nativeElement).getPropertyValue('--dash-i'),
      10,
    );
    return FIRST_LOAD_DELAY_MS + (Number.isFinite(index) ? index : 0) * WIDGET_STAGGER_MS;
  }

  private play(delay: number): void {
    this.stop();
    const count = untracked(this.arcs).length;
    // No animation where the user asked for less motion, or where there is no frame clock (unit tests).
    if (
      count === 0 ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      typeof requestAnimationFrame !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      this.elapsed.set(Number.POSITIVE_INFINITY);
      return;
    }
    this.delay = delay;
    const total = delay + (count - 1) * SLICE_STAGGER_MS + SLICE_GROW_MS;
    const begin = performance.now();
    this.elapsed.set(0);
    const tick = (now: number) => {
      const elapsed = now - begin;
      if (elapsed >= total) {
        this.elapsed.set(Number.POSITIVE_INFINITY);
        this.frame = null;
        return;
      }
      this.elapsed.set(elapsed);
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
  }
}
