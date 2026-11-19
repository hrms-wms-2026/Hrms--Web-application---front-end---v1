import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** A rectangle in the host canvas's own (world) coordinates. */
export interface CanvasBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CanvasPoint {
  readonly x: number;
  readonly y: number;
}

export type CanvasMinimapTone = 'primary' | 'secondary' | 'muted';

/** One thing drawn on the map: a circle (centre x/y, radius) or a rectangle (top-left x/y, width/height). */
export type CanvasMinimapItem =
  | { readonly shape: 'circle'; readonly x: number; readonly y: number; readonly r: number; readonly tone?: CanvasMinimapTone }
  | { readonly shape: 'rect'; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly tone?: CanvasMinimapTone };

export interface CanvasMinimapLink {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/**
 * Overview map for a pannable/zoomable canvas, with zoom in / out / fit buttons beside it.
 *
 * It knows nothing about the canvas it serves: the host passes the world bounds, the shapes to draw
 * and the part of the world currently on screen, all in its own coordinates. Clicking or dragging on
 * the map emits `navigate` with the world point to centre on.
 */
@Component({
  selector: 'app-canvas-minimap',
  standalone: true,
  template: `
    <svg
      class="cmm-map"
      [attr.viewBox]="viewBox()"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      [attr.aria-label]="label()"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="dragging = false"
      (pointercancel)="dragging = false"
    >
      @for (link of links(); track $index) {
        <line class="cmm-link" vector-effect="non-scaling-stroke" [attr.x1]="link.x1" [attr.y1]="link.y1" [attr.x2]="link.x2" [attr.y2]="link.y2" />
      }
      @for (item of items(); track $index) {
        @if (item.shape === 'circle') {
          <circle [class]="'cmm-item cmm-item--' + (item.tone ?? 'primary')" [attr.cx]="item.x" [attr.cy]="item.y" [attr.r]="item.r" />
        } @else {
          <rect
            [class]="'cmm-item cmm-item--rect cmm-item--' + (item.tone ?? 'primary')"
            vector-effect="non-scaling-stroke"
            [attr.x]="item.x"
            [attr.y]="item.y"
            [attr.width]="item.width"
            [attr.height]="item.height"
            [attr.rx]="item.height * 0.12"
          />
        }
      }
      @if (viewport(); as v) {
        <rect class="cmm-view" vector-effect="non-scaling-stroke" [attr.x]="v.x" [attr.y]="v.y" [attr.width]="v.width" [attr.height]="v.height" />
      }
    </svg>
    <div class="cmm-buttons">
      <button type="button" class="cmm-btn" aria-label="Zoom in" title="Zoom in" [disabled]="!canZoomIn()" (click)="zoomIn.emit()">+</button>
      <button type="button" class="cmm-btn" aria-label="Zoom out" title="Zoom out" [disabled]="!canZoomOut()" (click)="zoomOut.emit()">−</button>
      <button type="button" class="cmm-btn" aria-label="Fit to view" title="Fit to screen" (click)="fit.emit()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
      </button>
    </div>
  `,
  styles: [`
    :host {
      position: absolute; left: 1rem; bottom: 1rem; z-index: 6; display: flex; gap: 0.25rem;
      padding: 0.375rem; border-radius: 0.75rem; border: 1px solid var(--color-border);
      background: var(--color-surface); box-shadow: var(--shadow-popover);
      touch-action: none;
    }
    .cmm-map {
      display: block; width: 9.5rem; height: 6rem; border-radius: 0.5rem; cursor: pointer;
      background: color-mix(in srgb, var(--color-accent) 4%, var(--color-surface-secondary));
    }
    .cmm-buttons { display: flex; flex-direction: column; gap: 0.125rem; }
    .cmm-btn {
      display: flex; width: 1.75rem; height: 1.75rem; align-items: center; justify-content: center;
      border: 0; border-radius: 0.375rem; background: transparent; color: var(--color-text-secondary);
      font-size: 1rem; cursor: pointer;
    }
    .cmm-btn:hover:not(:disabled) { background: var(--color-surface-secondary); color: var(--color-text-primary); }
    .cmm-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .cmm-btn svg { width: 0.95rem; height: 0.95rem; }
    .cmm-link { stroke: var(--color-border-strong); stroke-width: 1; }
    .cmm-item--primary { fill: var(--color-cat-blue); }
    .cmm-item--secondary { fill: var(--color-cat-violet); }
    .cmm-item--muted { fill: var(--color-cat-slate); }
    .cmm-item--rect { fill-opacity: 0.85; }
    .cmm-view { fill: color-mix(in srgb, var(--color-accent) 8%, transparent); stroke: var(--color-accent); stroke-width: 1.5; }
  `],
  host: {
    'aria-label': 'Minimap',
    // The map sits on top of the canvas: keep its gestures from starting a canvas pan or zoom.
    '(pointerdown)': '$event.stopPropagation()',
    '(wheel)': '$event.stopPropagation()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CanvasMinimapComponent {
  readonly world = input.required<CanvasBox>();
  readonly items = input<readonly CanvasMinimapItem[]>([]);
  readonly links = input<readonly CanvasMinimapLink[]>([]);
  /** The part of the world currently on screen; drawn as the viewport rectangle. */
  readonly viewport = input<CanvasBox | null>(null);
  readonly canZoomIn = input(true);
  readonly canZoomOut = input(true);
  readonly label = input('Overview map');

  readonly navigate = output<CanvasPoint>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly fit = output<void>();

  /**
   * Frames the world only (not the viewport), so the map stays still while it is dragged; a viewport
   * that runs past the content is simply clipped at the map's edge.
   */
  readonly viewBox = computed(() => {
    const w = this.world();
    return `${w.x} ${w.y} ${Math.max(w.width, 1)} ${Math.max(w.height, 1)}`;
  });

  dragging = false;

  onPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    this.dragging = true;
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    this.emitNavigate(event);
  }

  onPointerMove(event: PointerEvent): void {
    if (this.dragging) this.emitNavigate(event);
  }

  private emitNavigate(event: PointerEvent): void {
    const map = event.currentTarget as SVGSVGElement;
    const ctm = map.getScreenCTM?.();
    if (!ctm) return;
    const pt = map.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const world = pt.matrixTransform(ctm.inverse());
    this.navigate.emit({ x: world.x, y: world.y });
  }
}
