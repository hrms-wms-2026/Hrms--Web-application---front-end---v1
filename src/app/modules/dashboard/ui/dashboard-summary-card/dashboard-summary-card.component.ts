import { WIDGET } from '../../../../shared/utils/widget-palette';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { buildFileUrl } from '../../../../shared/data-access/file-api.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { SummaryCardBody, SummaryCardModel } from '../../models/summary-card.model';
import { firstNumber } from '../../utils/summary-card-format.util';

/** Card i rises in CARD_STAGGER_MS after card i-1; its figure counts up over COUNT_MS. */
const CARD_STAGGER_MS = 90;
const FIRST_DELAY_MS = 120;
const COUNT_MS = 700;
const SPARK_H = 38;
const SPARK_TOP = 4;

type Kind<K extends SummaryCardBody['kind']> = Extract<SummaryCardBody, { kind: K }>;

interface Spark {
  readonly line: string;
  readonly area: string;
}

/** Line and area paths for a sparkline in a 100 x 38 box; a missing point breaks the line. */
function sparkPaths(points: readonly (number | null)[]): Spark {
  const values = points.filter((p): p is number => p !== null && Number.isFinite(p));
  if (values.length === 0) return { line: '', area: '' };
  const min = Math.min(...values);
  const range = Math.max(...values) - min || 1;
  const last = Math.max(points.length - 1, 1);
  const xy = points.map((p, i) =>
    p === null || !Number.isFinite(p) ? null : { x: (i * 100) / last, y: SPARK_H - 4 - ((p - min) / range) * (SPARK_H - 4 - SPARK_TOP) }
  );
  const segments: { x: number; y: number }[][] = [];
  let run: { x: number; y: number }[] = [];
  for (const point of xy) {
    if (point) run.push(point);
    else if (run.length) {
      segments.push(run);
      run = [];
    }
  }
  if (run.length) segments.push(run);
  const f = (n: number) => n.toFixed(1);
  const line = segments.map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ')).join(' ');
  const area = segments
    .filter((s) => s.length > 1)
    .map((s) => `${s.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ')} L${f(s[s.length - 1].x)} ${SPARK_H} L${f(s[0].x)} ${SPARK_H} Z`)
    .join(' ');
  return { line, area };
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

/**
 * One summary card on a wide 2-row dashboard widget (design 2026-11-07): a tinted card with an icon badge and title,
 * then one of eight bodies (figure + sparkline / bars / paired bars / meter, labelled bars, a ranking, people, or
 * status chips). It rises in after the cards before it, counts its figure up and grows its chart; with reduced
 * motion (or no frame clock) it shows the final state at once. A click opens the widget's popup at `card.section`.
 */
@Component({
  selector: 'app-dashboard-summary-card',
  standalone: true,
  imports: [AvatarComponent, IconComponent, NgTemplateOutlet],
  templateUrl: './dashboard-summary-card.component.html',
  styleUrl: './dashboard-summary-card.component.css',
  host: { class: 'block min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardSummaryCardComponent {
  readonly card = input.required<SummaryCardModel>();
  /** Position in the strip: sets the rise-in delay. */
  readonly index = input(0);
  /** The popup section to open. */
  readonly opened = output<string>();
  readonly retried = output<void>();

  /** False until the card's turn to rise in; charts sit at zero until then. */
  protected readonly revealed = signal(true);
  /** 0 to 1 through the count-up. */
  private readonly count = signal(1);
  private frame: number | null = null;

  protected readonly body = computed(() => {
    const card = this.card();
    return card.state === 'ready' ? card.body : null;
  });

  private kind<K extends SummaryCardBody['kind']>(k: K): Kind<K> | null {
    const body = this.body();
    return body?.kind === k ? (body as Kind<K>) : null;
  }

  protected readonly spark = computed(() => this.kind('spark'));
  protected readonly bars = computed(() => this.kind('bars'));
  protected readonly pair = computed(() => this.kind('pair'));
  protected readonly meter = computed(() => this.kind('meter'));
  protected readonly hbars = computed(() => this.kind('hbars'));
  protected readonly rank = computed(() => this.kind('rank'));
  protected readonly people = computed(() => this.kind('people'));
  protected readonly chips = computed(() => this.kind('chips'));

  /** A ranking, people or chips count, shown beside the title so the rows keep the body's full height. */
  protected readonly headCount = computed(() => {
    const body = this.body();
    if (!body || !('countLabel' in body) || body.count === null) return null;
    return { count: body.count, label: body.countLabel };
  });

  /** The figure of a figure-led body (spark, bars, pair, meter), or null. */
  private readonly figure = computed(() => {
    const body = this.body();
    return body && 'figure' in body ? body.figure : null;
  });

  protected readonly delta = computed(() => {
    const body = this.body();
    return body && 'delta' in body ? body.delta : null;
  });

  /** The figure as shown: its first number counted up while the card animates in. */
  protected readonly figureText = computed(() => this.countUp(this.figure() ?? ''));

  protected readonly sparkPath = computed(() => {
    const spark = this.spark();
    return spark ? sparkPaths(spark.points) : null;
  });

  protected readonly barHeights = computed(() => {
    const bars = this.bars();
    if (!bars) return [];
    const max = Math.max(...bars.values, 0);
    return bars.values.map((v) => (max > 0 ? Math.round(20 + (80 * Math.max(v, 0)) / max) : 0));
  });

  protected readonly pairHeights = computed(() => {
    const pair = this.pair();
    if (!pair) return [];
    const max = Math.max(...pair.pairs.flat(), 0);
    const h = (v: number) => (max > 0 ? Math.round((100 * Math.max(v, 0)) / max) : 0);
    return pair.pairs.map(([a, b]) => [h(a), h(b)] as const);
  });

  protected readonly chipTotal = computed(() => (this.chips()?.items ?? []).reduce((sum, item) => sum + Math.max(item.value, 0), 0));

  protected readonly ariaLabel = computed(() => {
    const card = this.card();
    const body = this.body();
    const lead = body ? (this.figure() ?? ('headline' in body ? body.headline : 'count' in body ? body.count : null)) : null;
    return `${card.title}${lead ? `: ${lead}` : ''}. Open details`;
  });

  protected readonly tint = (percent: number, tone?: string): string => `color-mix(in srgb, ${tone ?? this.card().tone} ${percent}%, var(--color-card-bg))`;
  /** Monochrome text on the mild card: maroon for a "bad" tone, otherwise the darkest theme shade. */
  protected readonly ink = (tone: string): string => (tone === WIDGET.maroon ? WIDGET.maroon : WIDGET.shade1);
  /** Chip background: the solid maroon alert chip for a "bad" tone, otherwise the mild card colour. */
  protected readonly chipBg = (tone: string): string => (tone === WIDGET.maroon ? WIDGET.maroon : WIDGET.mild);
  /** Chip text: white on the solid maroon alert chip, otherwise the darkest theme shade. */
  protected readonly chipInk = (tone: string): string => (tone === WIDGET.maroon ? WIDGET.onSolid : WIDGET.shade1);
  protected readonly widget = WIDGET;

  constructor() {
    // A card that becomes ready (or changes) plays its entrance again.
    effect(() => {
      const card = this.card();
      const key = `${card.id}|${card.state}|${this.figure() ?? ''}`;
      untracked(() => this.play(key));
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** The card handles its own click: a clickable widget card around it must not also open its popup at the top. */
  protected open(event: Event): void {
    event.stopPropagation();
    this.opened.emit(this.card().section);
  }

  protected retry(event: Event): void {
    event.stopPropagation();
    this.retried.emit();
  }

  protected avatarUrl(fileId: string | null): string | null {
    return fileId ? buildFileUrl(fileId) : null;
  }

  protected pct(value: number | null): number {
    return value === null || !Number.isFinite(value) ? 0 : Math.min(Math.max(value, 0), 100);
  }

  protected percentText(value: number | null): string {
    return value === null || !Number.isFinite(value) ? '—' : `${Math.round(value)}%`;
  }

  /** A card's refresh replay (dashboard-motion.css) restarts a no-op animation on the card; play again. */
  protected onReplay(event: AnimationEvent): void {
    if (event.animationName.includes('sc-replay')) this.play('replay');
  }

  private lastKey = '';

  private play(key: string): void {
    if (key === this.lastKey && key !== 'replay') return;
    this.lastKey = key === 'replay' ? this.lastKey : key;
    this.stop();
    const motion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      typeof requestAnimationFrame === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!motion || this.card().state !== 'ready') {
      this.revealed.set(true);
      this.count.set(1);
      return;
    }
    this.revealed.set(false);
    this.count.set(0);
    const delay = FIRST_DELAY_MS + this.index() * CARD_STAGGER_MS;
    const begin = performance.now();
    const tick = (now: number) => {
      const elapsed = now - begin - delay;
      if (elapsed >= 0 && !this.revealed()) this.revealed.set(true);
      const progress = elapsed / COUNT_MS;
      this.count.set(easeOutCubic(progress));
      this.frame = progress >= 1 ? null : requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.frame !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.frame);
    this.frame = null;
  }

  private countUp(text: string): string {
    const progress = this.count();
    if (progress >= 1) return text;
    const found = firstNumber(text);
    if (!found) return text;
    // Keep the figure's own decimals while counting ("12.5 h" counts 0.0, 0.1, ... 12.5).
    const decimals = found.match.split('.')[1]?.length ?? 0;
    const value = (found.value * progress).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return text.replace(found.match, value);
  }
}
