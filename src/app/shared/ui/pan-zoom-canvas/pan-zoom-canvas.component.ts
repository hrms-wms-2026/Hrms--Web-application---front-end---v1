import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { CanvasGridComponent } from '../canvas-grid/canvas-grid.component';
import {
  CanvasBox,
  CanvasMinimapComponent,
  CanvasMinimapItem,
  CanvasPoint
} from '../canvas-minimap/canvas-minimap.component';

/** Smaller than the +/- step so one wheel fling doesn't blow through the whole zoom range. */
const WHEEL_ZOOM_STEP = 0.02;
const BUTTON_ZOOM_STEP = 0.1;
const FIT_PADDING = 48;
/** Pointer-downs on these never start a pan: they belong to the content or the controls. */
const NO_PAN_SELECTOR = 'button, a, input, select, textarea, app-canvas-minimap, [data-no-pan]';

/**
 * Pannable, zoomable canvas for org charts and other card diagrams: dotted grid, drag to pan,
 * wheel and +/- zoom, and an overview minimap with Fit.
 *
 * Content in the default slot is moved by `translate(pan) scale(zoom)` around its top centre.
 * Content marked `canvasOverlay` stays put above it (titles, toolbars, empty/error states).
 *
 * The minimap draws one box per element matching `cardSelector` inside the content. Those boxes are
 * measured from layout offsets (which ignore the CSS transform), only when the content's DOM or the
 * canvas size changes - never while panning or zooming; the viewport rectangle is plain arithmetic.
 */
@Component({
  selector: 'app-pan-zoom-canvas',
  standalone: true,
  imports: [CanvasGridComponent, CanvasMinimapComponent],
  template: `
    <app-canvas-grid [spacing]="gridSpacing()" />
    <ng-content select="[canvasOverlay]" />
    <div #world class="pzc-world" [style.transform]="transform()">
      <ng-content />
    </div>
    @if (showMinimap() && cards().length > 0) {
      <app-canvas-minimap
        [label]="label() + ' overview'"
        [world]="worldBox()"
        [items]="miniItems()"
        [viewport]="viewport()"
        [canZoomIn]="zoom() < maxZoom()"
        [canZoomOut]="zoom() > minZoom()"
        (navigate)="centerOn($event)"
        (zoomIn)="zoomIn()"
        (zoomOut)="zoomOut()"
        (fit)="fit()"
      />
    }
  `,
  styles: [`
    :host {
      position: relative; isolation: isolate; display: block; overflow: hidden;
      cursor: grab; touch-action: none; overscroll-behavior: contain;
    }
    :host(.pzc--panning) { cursor: grabbing; user-select: none; -webkit-user-select: none; }
    .pzc-world {
      /* Offset parent for the card measurements. */
      position: relative; width: 100%;
      transform-origin: top center; transition: transform 0.15s ease-out;
      will-change: transform; backface-visibility: hidden;
    }
    :host(.pzc--panning) .pzc-world { transition: none; }
  `],
  host: {
    role: 'group',
    '[attr.aria-label]': 'label()',
    '[class.pzc--panning]': 'isPanning()',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'endPan()',
    '(pointercancel)': 'endPan()',
    '(wheel)': 'onWheel($event)'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PanZoomCanvasComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly worldRef = viewChild.required<ElementRef<HTMLElement>>('world');

  readonly label = input('Canvas');
  readonly initialZoom = input(0.7);
  readonly minZoom = input(0.4);
  readonly maxZoom = input(1.5);
  readonly gridSpacing = input(24);
  readonly showMinimap = input(true);
  /** Elements drawn on the minimap and never used to start a pan. */
  readonly cardSelector = input('.tt-slot');

  /** A plain press on empty canvas (before any drag) - e.g. to clear a selection. */
  readonly backgroundPointerDown = output<void>();

  readonly zoom = signal(0.7);
  readonly panX = signal(0);
  readonly panY = signal(0);
  readonly isPanning = signal(false);

  readonly zoomPercentage = computed(() => Math.round(this.zoom() * 100));
  readonly transform = computed(() => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`);

  /** Card rectangles in world coordinates (the content's own, untransformed layout). */
  readonly cards = signal<readonly CanvasBox[]>([]);
  /** Canvas size, and the content's untransformed offset + width inside it. */
  private readonly layout = signal({ width: 0, height: 0, left: 0, top: 0, worldWidth: 0 });

  readonly miniItems = computed<CanvasMinimapItem[]>(() =>
    this.cards().map((c) => ({ shape: 'rect', x: c.x, y: c.y, width: c.width, height: c.height }))
  );

  readonly worldBox = computed<CanvasBox>(() => {
    const cards = this.cards();
    if (cards.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of cards) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + c.width);
      maxY = Math.max(maxY, c.y + c.height);
    }
    return { x: minX - FIT_PADDING, y: minY - FIT_PADDING, width: maxX - minX + FIT_PADDING * 2, height: maxY - minY + FIT_PADDING * 2 };
  });

  /** What the canvas shows, mapped back through `translate(pan) scale(zoom)` around top centre. */
  readonly viewport = computed<CanvasBox | null>(() => {
    const l = this.layout();
    if (l.width === 0) return null;
    const z = this.zoom();
    const originX = l.worldWidth / 2;
    return { x: (-l.left - originX - this.panX()) / z + originX, y: (-l.top - this.panY()) / z, width: l.width / z, height: l.height / z };
  });

  private pan: { pointerId: number; startX: number; startY: number; fromX: number; fromY: number } | null = null;

  constructor() {
    let initialised = false;
    effect(() => {
      const zoom = this.initialZoom();
      if (!initialised) {
        initialised = true;
        this.zoom.set(zoom);
      }
    });

    // Re-measure when the content's DOM changes (data, mode switch, expand/collapse) or the canvas
    // is resized. Batched to one measurement per frame.
    effect((onCleanup) => {
      const world = this.worldRef().nativeElement;
      this.cardSelector();
      let frame: number | null = null;
      const schedule = () => {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          this.measure();
        });
      };
      schedule();
      const mutations = new MutationObserver(schedule);
      mutations.observe(world, { childList: true, subtree: true });
      const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
      resize?.observe(this.host.nativeElement);
      onCleanup(() => {
        mutations.disconnect();
        resize?.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
      });
    });
  }

  // ── Public controls ────────────────────────────────────────────────────

  zoomIn(): void {
    this.zoom.update((z) => Math.min(this.maxZoom(), Math.round((z + BUTTON_ZOOM_STEP) * 10) / 10));
  }

  zoomOut(): void {
    this.zoom.update((z) => Math.max(this.minZoom(), Math.round((z - BUTTON_ZOOM_STEP) * 10) / 10));
  }

  /** Back to the starting zoom with the content's top centre in its home position. */
  resetZoom(): void {
    this.zoom.set(this.initialZoom());
    this.panX.set(0);
    this.panY.set(0);
  }

  /** Pans (keeping the zoom) so the world point sits in the middle of the canvas. */
  centerOn(world: CanvasPoint): void {
    const l = this.layout();
    const z = this.zoom();
    const originX = l.worldWidth / 2;
    this.panX.set(l.width / 2 - l.left - originX - z * (world.x - originX));
    this.panY.set(l.height / 2 - l.top - z * world.y);
  }

  /**
   * Pans so the first content element matching `selector` (e.g. a highlighted card) sits in the
   * middle. Returns false when nothing matches.
   */
  centerOnMatch(selector: string): boolean {
    const element = this.worldRef().nativeElement.querySelector<HTMLElement>(selector);
    if (!element) return false;
    this.measure();
    const box = this.worldRect(element);
    this.centerOn({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
    return true;
  }

  /**
   * Fits everything, then - if the element matching `selector` still ends up off screen (a chart
   * too big to fit at the minimum zoom) - centres on it instead.
   */
  fitAndReveal(selector: string): void {
    this.fit();
    const element = this.worldRef().nativeElement.querySelector<HTMLElement>(selector);
    const view = this.viewport();
    if (!element || !view) return;
    const box = this.worldRect(element);
    const visible = box.x >= view.x && box.y >= view.y
      && box.x + box.width <= view.x + view.width && box.y + box.height <= view.y + view.height;
    if (!visible) this.centerOnMatch(selector);
  }

  /** Zooms and pans so everything fits the canvas (within the zoom limits). */
  fit(): void {
    this.measure();
    const l = this.layout();
    if (this.cards().length === 0 || l.width === 0) {
      this.resetZoom();
      return;
    }
    const world = this.worldBox();
    const fitted = Math.min(l.width / world.width, (l.height - l.top) / world.height);
    const z = Math.min(this.maxZoom(), Math.max(this.minZoom(), Math.floor(fitted * 100) / 100));
    this.zoom.set(z);
    // Centre horizontally; keep the top of the content just under whatever sits above it.
    const originX = l.worldWidth / 2;
    this.panX.set(l.width / 2 - l.left - originX - z * (world.x + world.width / 2 - originX));
    this.panY.set(fitted >= z ? -z * world.y : l.height / 2 - l.top - z * (world.y + world.height / 2));
  }

  // ── Gestures ───────────────────────────────────────────────────────────

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoom.update((z) => Math.min(this.maxZoom(), Math.round((z + WHEEL_ZOOM_STEP) * 100) / 100));
    } else if (event.deltaY > 0) {
      this.zoom.update((z) => Math.max(this.minZoom(), Math.round((z - WHEEL_ZOOM_STEP) * 100) / 100));
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as Element | null;
    if (!target || target.closest(NO_PAN_SELECTOR) || target.closest(this.cardSelector())) return;

    this.backgroundPointerDown.emit();
    this.isPanning.set(true);
    this.pan = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: this.panX(), fromY: this.panY() };
    try {
      this.host.nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // Synthetic events in tests have no active pointer to capture.
    }
  }

  onPointerMove(event: PointerEvent): void {
    const pan = this.pan;
    if (!pan || pan.pointerId !== event.pointerId) return;
    this.panX.set(pan.fromX + event.clientX - pan.startX);
    this.panY.set(pan.fromY + event.clientY - pan.startY);
  }

  endPan(): void {
    const pan = this.pan;
    if (!pan) return;
    this.pan = null;
    this.isPanning.set(false);
    try {
      if (this.host.nativeElement.hasPointerCapture?.(pan.pointerId)) this.host.nativeElement.releasePointerCapture(pan.pointerId);
    } catch {
      // Synthetic events in tests have no active pointer to release.
    }
  }

  // ── Measurement ────────────────────────────────────────────────────────

  private measure(): void {
    const host = this.host.nativeElement;
    const world = this.worldRef().nativeElement;
    this.layout.set({
      width: host.clientWidth,
      height: host.clientHeight,
      left: world.offsetLeft,
      top: world.offsetTop,
      worldWidth: world.offsetWidth
    });
    const cards: CanvasBox[] = [];
    world.querySelectorAll<HTMLElement>(this.cardSelector()).forEach((card) => cards.push(this.worldRect(card)));
    this.cards.set(cards);
  }

  /** An element's box in world coordinates, summing layout offsets up to the world element. */
  private worldRect(element: HTMLElement): CanvasBox {
    const world = this.worldRef().nativeElement;
    let x = 0, y = 0;
    let el: HTMLElement | null = element;
    while (el && el !== world) {
      x += el.offsetLeft;
      y += el.offsetTop;
      el = el.offsetParent as HTMLElement | null;
    }
    return { x, y, width: element.offsetWidth, height: element.offsetHeight };
  }
}
