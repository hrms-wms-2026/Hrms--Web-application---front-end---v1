import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, afterRenderEffect, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { BootstrapWidget, GridRect } from '../../models/dashboard-layout.model';
import { GridItem, pixelToCell, readingOrder, reorderTo, resizePacked } from '../../grid/grid-math';
import { WidgetFrameComponent } from '../widget-frame/widget-frame.component';

export interface GridReorderEvent {
  id: string;
  /** The widget's new position in reading order (top to bottom, left to right) among the grid's widgets. */
  index: number;
}

/** The pinned card's natural size in px: as wide as its tiles in one row, as tall as its content at that width. */
export interface PinnedSize {
  width: number;
  height: number;
}

export interface GridResizeEvent {
  id: string;
  w: number;
  h: number;
}

/** Deep-link anchors the My Team deep-link service scrolls to (unchanged from the old card switch). */
const ANCHOR_IDS: Record<string, string | undefined> = {
  'team-status': 'my-team-widget-teamStatus',
  'team-progress': 'my-team-widget-teamProgress',
  'action-center': 'my-team-widget-actionCenter'
};

let nextGridId = 0;

interface PendingAnnouncement {
  id: string;
  kind: 'move' | 'resize';
}

interface ActiveDrag {
  id: string;
  kind: 'move' | 'resize';
  startX: number;
  startY: number;
  origin: GridRect;
  size: BootstrapWidget['size'];
  cellPx: number;
  /** Resize: the snapped size. Move: unused (the widget's slot comes from `index`). */
  target: GridRect;
  /** Move: where the widget sits in reading order now, and where it started. */
  index: number;
  fromIndex: number;
  /** Move: the widget the pointer last reordered against; it must leave and re-enter before it counts again. */
  overId: string | null;
  /** Pointer travel since the gesture started, in px: a dragged widget follows the pointer. */
  dxPx: number;
  dyPx: number;
}

interface GridCell {
  w: BootstrapWidget;
  rect: GridRect;
}

/** How long a widget takes to settle into its new place. */
const SETTLE_MS = 420;

/**
 * A spring (stiffness 220, damping 22, mass 1) sampled into a CSS linear() easing: a quick start and a soft
 * landing with a hint of overshoot, the way icons settle on a phone's home screen.
 */
const SPRING_EASING = (() => {
  const k = 220;
  const c = 22;
  const steps = 48;
  const dt = SETTLE_MS / 1000 / steps;
  let x = 0;
  let v = 0;
  const points: string[] = ['0'];
  for (let i = 1; i <= steps; i++) {
    for (let j = 0; j < 8; j++) {
      const a = k * (1 - x) - c * v;
      v += a * (dt / 8);
      x += v * (dt / 8);
    }
    points.push((i === steps ? 1 : x).toFixed(4));
  }
  return `linear(${points.join(', ')})`;
})();

const FALLBACK_EASING = 'cubic-bezier(0.2, 0.9, 0.3, 1.1)';

/**
 * Renders widgets on a CSS grid. In edit mode it works like a phone's home screen: drag a widget by its frame's
 * [data-drag-handle] over another and the others move out of its way (they shift along in reading order, never
 * hidden underneath); resize from [data-resize-handle] and the widgets after it re-pack; or use the keyboard. The
 * grid never mutates the layout: it emits reordered/resized/removed and the owner (layout store) re-packs with the
 * same grid-math (reorderTo / resizePacked) the grid previews with, so the drop lands exactly where the preview
 * showed. Every widget that changes place springs there (FLIP), unless the viewer prefers reduced motion.
 */
@Component({
  selector: 'app-dashboard-grid',
  standalone: true,
  imports: [WidgetFrameComponent],
  template: `
    <div
      #grid
      class="relative grid w-full min-w-0"
      data-testid="dashboard-grid"
      [style.grid-template-columns]="'repeat(' + columns() + ', minmax(0, 1fr))'"
      [style.grid-auto-rows.px]="rowHeight()"
      [style.gap.px]="gap()"
    >
      <!-- First in the DOM so widgets sliding across the landing slot are drawn over it. -->
      @if (ghost(); as g) {
        <div
          class="pointer-events-none rounded-2xl border-2 border-dashed border-[var(--color-accent)] bg-[var(--color-accent-subtle)]/60"
          data-testid="grid-ghost"
          aria-hidden="true"
          [style.grid-column]="gridColumn(g)"
          [style.grid-row]="gridRow(g)"
        ></div>
      }
      <!-- The pinned corner (Quick Actions): never dragged, resized or removed; the widgets pack around it. -->
      <div class="relative min-w-0" data-testid="grid-pinned" [style.grid-column]="gridColumn(pinned())" [style.grid-row]="gridRow(pinned())">
        <ng-content select="[gridPinned]" />
      </div>
      @for (c of cells(); track c.w.instanceId) {
        @let w = c.w;
        @let dragged = drag()?.id === w.instanceId;
        <!-- --dash-i staggers the widget's entrance (dashboard-motion.css). -->
        <div
          class="relative min-w-0 scroll-mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          [style.--dash-i]="$index"
          [class.z-30]="dragged"
          [class.rounded-2xl]="editing()"
          [class.shadow-2xl]="dragged && drag()?.kind === 'move'"
          [class.cursor-grabbing]="dragged && drag()?.kind === 'move'"
          [style.transform]="dragTransform(c)"
          [style.transition]="dragged && drag()?.kind === 'move' ? 'box-shadow 150ms ease' : null"
          [attr.id]="anchorId(w)"
          [attr.data-instance-id]="w.instanceId"
          [attr.tabindex]="editing() ? 0 : null"
          [attr.role]="editing() ? 'group' : null"
          [attr.aria-roledescription]="editing() ? 'widget' : null"
          [attr.aria-describedby]="editing() ? helpId : null"
          [attr.aria-label]="editing() ? ariaLabel(w) : null"
          [style.grid-column]="gridColumn(c.rect)"
          [style.grid-row]="gridRow(c.rect)"
          (pointerdown)="onPointerDown($event, w)"
          (keydown)="onKeydown($event, w)"
        >
          <app-widget-frame [widget]="w" [editing]="editing()" (remove)="removed.emit(w.instanceId)" />
        </div>
      }
    </div>
    @if (editing()) {
      <p class="sr-only" [id]="helpId">
        Use the arrow keys to move this widget earlier or later, Shift plus the arrow keys to resize it, and Delete to remove it.
      </p>
      <div class="sr-only" aria-live="polite" aria-atomic="true" data-testid="grid-live">{{ announcement() }}</div>
    }
  `,
  host: { class: 'block w-full min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardGridComponent {
  readonly widgets = input.required<BootstrapWidget[]>();
  readonly columns = input.required<number>();
  readonly rowHeight = input.required<number>();
  readonly gap = input.required<number>();
  readonly editing = input(false);
  /** Natural size of the projected [gridPinned] card; null until it has measured itself. */
  readonly pinnedSize = input<PinnedSize | null>(null);

  readonly reordered = output<GridReorderEvent>();
  readonly resized = output<GridResizeEvent>();
  readonly removed = output<string>();
  /** The cells the pinned card takes (top-right corner); the owner packs the widgets around them. */
  readonly pinnedChange = output<GridRect>();
  /** Emitted when a keyboard removal leaves no other widget to focus; the owner moves focus elsewhere. */
  readonly focusOutside = output<void>();

  protected readonly helpId = `dashboard-grid-help-${nextGridId++}`;
  protected readonly announcement = signal('');
  private pendingAnnouncement: PendingAnnouncement | null = null;

  private readonly gridEl = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly gridWidth = signal(0);

  /**
   * The pinned corner: enough columns for the card's tiles in one row (all columns when it can't fit, and the tiles
   * wrap), enough rows for its content, flush with the right edge of the first row.
   */
  protected readonly pinned = computed<GridRect>(() => {
    const cols = this.columns();
    const gap = this.gap();
    const size = this.pinnedSize();
    const width = this.gridWidth();
    if (!size || width <= 0) {
      const w = Math.min(3, cols);
      return { x: cols - w, y: 0, w, h: 1 };
    }
    const cellPx = (width - gap * (cols - 1)) / cols;
    const w = Math.min(cols, Math.max(1, Math.ceil((size.width + gap) / (cellPx + gap) - 0.001)));
    const h = Math.max(1, Math.ceil((size.height + gap) / (this.rowHeight() + gap) - 0.001));
    return { x: cols - w, y: 0, w, h };
  });
  protected readonly drag = signal<ActiveDrag | null>(null);

  /** Each widget with the rect it is drawn at: its layout, or during a gesture the previewed result. */
  protected readonly cells = computed<GridCell[]>(() => {
    const widgets = this.widgets();
    const d = this.drag();
    const preview = d ? this.preview(widgets, d) : null;
    return widgets.map(w => ({ w, rect: preview?.get(w.instanceId) ?? w.layout }));
  });

  /** Where a dragged widget will land (it is drawn under the pointer meanwhile). */
  protected readonly ghost = computed(() => {
    const d = this.drag();
    if (!d || d.kind !== 'move') return null;
    return this.cells().find(c => c.w.instanceId === d.id)?.rect ?? null;
  });

  /** Each cell's last settled position relative to the grid, for the FLIP slide. */
  private lastPositions = new Map<string, { left: number; top: number }>();
  private readonly easing =
    typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timing-function', 'linear(0, 1)')
      ? SPRING_EASING
      : FALLBACK_EASING;

  private cleanup: (() => void) | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopListening());

    afterNextRender(() => {
      const el = this.gridEl().nativeElement;
      this.gridWidth.set(el.clientWidth);
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.gridWidth.set(el.clientWidth));
      observer.observe(el);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });

    effect(() => {
      const rect = this.pinned();
      untracked(() => this.pinnedChange.emit(rect));
    });

    afterRenderEffect(() => {
      this.cells();
      const animate = this.editing();
      untracked(() => this.settleMovedCells(animate));
    });

    // After a keyboard move/resize the owner re-packs the layout; announce where the widget actually settled.
    effect(() => {
      const widgets = this.widgets();
      untracked(() => {
        const pending = this.pendingAnnouncement;
        if (!pending) return;
        this.pendingAnnouncement = null;
        const w = widgets.find(x => x.instanceId === pending.id);
        if (!w) return;
        const l = w.layout;
        this.announcement.set(
          pending.kind === 'move'
            ? `${w.title} moved to column ${l.x + 1}, row ${l.y + 1}`
            : `${w.title} resized to width ${l.w}, height ${l.h}`
        );
      });
    });
  }

  protected gridColumn(r: GridRect): string {
    return `${r.x + 1} / span ${r.w}`;
  }

  protected gridRow(r: GridRect): string {
    return `${r.y + 1} / span ${r.h}`;
  }

  /** A dragged widget is laid out at its previewed slot, then shifted (and lifted) to sit under the pointer. */
  protected dragTransform(c: GridCell): string | null {
    const d = this.drag();
    if (!d || d.kind !== 'move' || d.id !== c.w.instanceId) return null;
    const pitchX = d.cellPx + this.gap();
    const pitchY = this.rowHeight() + this.gap();
    const x = (d.origin.x - c.rect.x) * pitchX + d.dxPx;
    const y = (d.origin.y - c.rect.y) * pitchY + d.dyPx;
    return `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(1.02)`;
  }

  protected anchorId(w: BootstrapWidget): string | null {
    return ANCHOR_IDS[w.widgetKey] ?? null;
  }

  protected ariaLabel(w: BootstrapWidget): string {
    const l = w.layout;
    return `${w.title}, column ${l.x + 1}, row ${l.y + 1}, width ${l.w}, height ${l.h}`;
  }

  private items(widgets: BootstrapWidget[]): GridItem[] {
    return widgets.map(w => ({ id: w.instanceId, rect: w.layout }));
  }

  private orderOf(widgets: BootstrapWidget[]): string[] {
    return readingOrder(this.items(widgets)).map(i => i.id);
  }

  private preview(widgets: BootstrapWidget[], d: ActiveDrag): Map<string, GridRect> | null {
    const items = this.items(widgets);
    let next: GridItem[];
    if (d.kind === 'move') {
      if (d.index === d.fromIndex) return null;
      next = reorderTo(items, d.id, d.index, this.columns(), [this.pinned()]);
    } else {
      if (d.target.w === d.origin.w && d.target.h === d.origin.h) return null;
      next = resizePacked(items, d.id, d.target.w, d.target.h, d.size, this.columns(), [this.pinned()]);
    }
    return new Map(next.map(i => [i.id, i.rect]));
  }

  /**
   * FLIP: every cell (other than the one under the pointer) that changed place springs from where it was drawn.
   * A cell still mid-flight starts from where it is on screen, so quick successive moves stay continuous.
   */
  private settleMovedCells(animate: boolean): void {
    const grid = this.gridEl().nativeElement;
    const origin = grid.getBoundingClientRect();
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dragging = this.drag();
    const next = new Map<string, { left: number; top: number }>();
    for (const el of Array.from(grid.querySelectorAll<HTMLElement>('[data-instance-id]'))) {
      const id = el.dataset['instanceId'] ?? '';
      const onScreen = el.getBoundingClientRect();
      const running = typeof el.getAnimations === 'function' ? el.getAnimations() : [];
      running.forEach(a => a.cancel());
      const settled = running.length ? el.getBoundingClientRect() : onScreen;
      const pos = { left: settled.left - origin.left, top: settled.top - origin.top };
      next.set(id, pos);

      const prev = this.lastPositions.get(id);
      if (!animate || reduced || !prev || typeof el.animate !== 'function') continue;
      if (dragging?.kind === 'move' && dragging.id === id) continue;
      // Where the cell was drawn a moment ago: its last settled place plus any flight still in progress.
      const fromX = prev.left + (onScreen.left - settled.left) - pos.left;
      const fromY = prev.top + (onScreen.top - settled.top) - pos.top;
      if (Math.abs(fromX) < 1 && Math.abs(fromY) < 1) continue;
      el.animate([{ transform: `translate(${fromX}px, ${fromY}px)` }, { transform: 'translate(0, 0)' }], {
        duration: SETTLE_MS,
        easing: this.easing
      });
    }
    this.lastPositions = next;
  }

  // ---- pointer ----

  protected onPointerDown(event: PointerEvent | MouseEvent, w: BootstrapWidget): void {
    if (!this.editing() || this.drag()) return;
    const target = event.target as Element | null;
    const kind: 'move' | 'resize' | null = target?.closest('[data-resize-handle]')
      ? 'resize'
      : target?.closest('[data-drag-handle]')
        ? 'move'
        : null;
    if (!kind) return;
    if ('button' in event && event.button !== 0) return;

    const columns = this.columns();
    const gap = this.gap();
    const width = this.gridEl().nativeElement.clientWidth;
    const cellPx = (width - gap * (columns - 1)) / columns;
    event.preventDefault();
    try {
      (target as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.((event as PointerEvent).pointerId);
    } catch {
      // Capture is best-effort; document-level listeners below carry the gesture anyway.
    }
    const index = this.orderOf(this.widgets()).indexOf(w.instanceId);
    this.drag.set({
      id: w.instanceId,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...w.layout },
      size: w.size,
      cellPx,
      target: { ...w.layout },
      index,
      fromIndex: index,
      overId: null,
      dxPx: 0,
      dyPx: 0
    });
    this.startListening();
  }

  private startListening(): void {
    const onMove = (e: Event) => this.onPointerMove(e as MouseEvent);
    const onUp = (e: Event) => this.onPointerUp(e as MouseEvent);
    const onCancel = () => this.cancelDrag();
    // Escape during a drag cancels only the drag: listen in the capture phase on window (ahead of the shell's
    // document-level Escape handler, which would cancel the whole edit) and stop the event there.
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      this.cancelDrag();
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
    this.cleanup = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
    };
  }

  private stopListening(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  private onPointerMove(e: MouseEvent): void {
    const d = this.drag();
    if (!d) return;
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    if (d.kind === 'resize') {
      const dx = pixelToCell(dxPx, d.cellPx, this.gap());
      const dy = pixelToCell(dyPx, this.rowHeight(), this.gap());
      const target = this.clampResize(d.origin, d.size, dx, dy);
      // A resize redraws only when the size snaps to a new cell.
      if (target.w !== d.target.w || target.h !== d.target.h) this.drag.set({ ...d, target, dxPx, dyPx });
      return;
    }
    const { index, overId } = this.reorderUnderPointer(d, e.clientX, e.clientY);
    if (index !== d.index || overId !== d.overId || dxPx !== d.dxPx || dyPx !== d.dyPx) {
      this.drag.set({ ...d, index, overId, dxPx, dyPx });
    }
  }

  /**
   * The dragged widget takes the place of the widget under the pointer (the others shift along, like icons on a
   * phone). It only reacts when the pointer enters a widget, so a widget sliding under a still pointer can't make
   * the order flip back and forth. Past the last widget, it goes to the end.
   */
  private reorderUnderPointer(d: ActiveDrag, clientX: number, clientY: number): { index: number; overId: string | null } {
    const box = this.gridEl().nativeElement.getBoundingClientRect();
    const col = Math.floor((clientX - box.left) / (d.cellPx + this.gap()));
    const row = Math.floor((clientY - box.top) / (this.rowHeight() + this.gap()));
    const cells = this.cells();
    const over = cells.find(
      c => c.w.instanceId !== d.id && col >= c.rect.x && col < c.rect.x + c.rect.w && row >= c.rect.y && row < c.rect.y + c.rect.h
    );
    if (over) {
      if (over.w.instanceId === d.overId) return { index: d.index, overId: d.overId };
      const order = readingOrder(cells.map(c => ({ id: c.w.instanceId, rect: c.rect }))).map(i => i.id);
      return { index: order.indexOf(over.w.instanceId), overId: over.w.instanceId };
    }
    const bottom = Math.max(0, ...cells.filter(c => c.w.instanceId !== d.id).map(c => c.rect.y + c.rect.h));
    if (row >= bottom) return { index: cells.length - 1, overId: null };
    return { index: d.index, overId: null };
  }

  private onPointerUp(e: MouseEvent): void {
    this.onPointerMove(e);
    const d = this.drag();
    this.endDrag();
    if (!d) return;
    if (d.kind === 'move') {
      if (d.index !== d.fromIndex) this.reordered.emit({ id: d.id, index: d.index });
    } else if (d.target.w !== d.origin.w || d.target.h !== d.origin.h) {
      this.resized.emit({ id: d.id, w: d.target.w, h: d.target.h });
    }
  }

  private cancelDrag(): void {
    this.endDrag();
  }

  private endDrag(): void {
    this.stopListening();
    this.drag.set(null);
  }

  // ---- keyboard ----

  protected onKeydown(event: KeyboardEvent, w: BootstrapWidget): void {
    // Only when the cell itself is focused (not the remove button inside it).
    if (!this.editing() || event.target !== event.currentTarget) return;
    const l = w.layout;
    switch (event.key) {
      case 'Delete':
      case 'Backspace': {
        event.preventDefault();
        const list = this.widgets();
        const index = list.findIndex(x => x.instanceId === w.instanceId);
        const neighbour = list[index + 1] ?? list[index - 1] ?? null;
        this.removed.emit(w.instanceId);
        this.announcement.set(`${w.title} removed`);
        const next = neighbour ? this.cellElement(neighbour.instanceId) : null;
        if (next) {
          next.focus();
        } else {
          this.focusOutside.emit();
        }
        return;
      }
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        event.preventDefault();
        if (event.shiftKey) {
          const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
          const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
          const t = this.clampResize(l, w.size, dx, dy);
          if (t.w !== l.w || t.h !== l.h) {
            this.pendingAnnouncement = { id: w.instanceId, kind: 'resize' };
            this.resized.emit({ id: w.instanceId, w: t.w, h: t.h });
          }
        } else {
          const order = this.orderOf(this.widgets());
          const from = order.indexOf(w.instanceId);
          const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
          const to = Math.min(order.length - 1, Math.max(0, from + step));
          if (to !== from) {
            this.pendingAnnouncement = { id: w.instanceId, kind: 'move' };
            this.reordered.emit({ id: w.instanceId, index: to });
          }
        }
        return;
      }
    }
  }

  private cellElement(instanceId: string): HTMLElement | null {
    const cells = this.gridEl().nativeElement.querySelectorAll<HTMLElement>('[data-instance-id]');
    return Array.from(cells).find(c => c.dataset['instanceId'] === instanceId) ?? null;
  }

  // ---- clamping ----

  private clampResize(origin: GridRect, size: BootstrapWidget['size'], dw: number, dh: number): GridRect {
    const cols = this.columns();
    const minW = Math.min(size.minW, cols);
    // Not limited by the widget's column: the layout re-packs, so a wider widget simply wraps to fit.
    const maxW = Math.max(minW, Math.min(size.maxW, cols));
    const minH = size.minH;
    const maxH = Math.max(minH, size.maxH);
    return {
      ...origin,
      w: Math.min(maxW, Math.max(minW, origin.w + dw)),
      h: Math.min(maxH, Math.max(minH, origin.h + dh))
    };
  }
}
