import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterRenderEffect, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { BootstrapWidget, GridRect } from '../../models/dashboard-layout.model';
import { GridItem, moveTo, pixelToCell, resizeTo } from '../../grid/grid-math';
import { WidgetFrameComponent } from '../widget-frame/widget-frame.component';

export interface GridMoveEvent {
  id: string;
  x: number;
  y: number;
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
  target: GridRect;
  /** Pointer travel since the gesture started, in px: a dragged widget follows the pointer. */
  dxPx: number;
  dyPx: number;
}

interface GridCell {
  w: BootstrapWidget;
  rect: GridRect;
}

/** How long the other widgets take to slide into their new places. */
const REFLOW_MS = 180;

/**
 * Renders widgets on a CSS grid. In edit mode a widget can be dragged (its frame's [data-drag-handle]),
 * resized (its [data-resize-handle]) or moved/resized/removed from the keyboard. The grid never
 * mutates the layout: it emits moved/resized/removed and the owner (layout store) recomputes the layout.
 * While a pointer gesture runs, the grid previews that same recomputation (grid-math moveTo / resizeTo):
 * the other widgets step out of the way, a resized widget changes size live and a dragged one follows
 * the pointer, so nothing overlaps and the drop lands exactly where the preview showed. Widgets that
 * change place slide there (FLIP), unless the viewer prefers reduced motion.
 */
@Component({
  selector: 'app-dashboard-grid',
  standalone: true,
  imports: [WidgetFrameComponent],
  template: `
    <div
      #grid
      class="grid w-full min-w-0"
      data-testid="dashboard-grid"
      [style.grid-template-columns]="'repeat(' + columns() + ', minmax(0, 1fr))'"
      [style.grid-auto-rows.px]="rowHeight()"
      [style.gap.px]="gap()"
    >
      @for (c of cells(); track c.w.instanceId) {
        @let w = c.w;
        <div
          class="relative min-w-0 scroll-mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          [class.z-30]="drag()?.id === w.instanceId"
          [class.shadow-2xl]="drag()?.id === w.instanceId"
          [class.rounded-2xl]="editing()"
          [style.transform]="dragTransform(c)"
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
      @if (ghost(); as g) {
        <div
          class="pointer-events-none z-0 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-100/40"
          data-testid="grid-ghost"
          aria-hidden="true"
          [style.grid-column]="gridColumn(g)"
          [style.grid-row]="gridRow(g)"
        ></div>
      }
    </div>
    @if (editing()) {
      <p class="sr-only" [id]="helpId">
        Use the arrow keys to move this widget, Shift plus the arrow keys to resize it, and Delete to remove it.
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

  readonly moved = output<GridMoveEvent>();
  readonly resized = output<GridResizeEvent>();
  readonly removed = output<string>();
  /** Emitted when a keyboard removal leaves no other widget to focus; the owner moves focus elsewhere. */
  readonly focusOutside = output<void>();

  protected readonly helpId = `dashboard-grid-help-${nextGridId++}`;
  protected readonly announcement = signal('');
  private pendingAnnouncement: PendingAnnouncement | null = null;

  private readonly gridEl = viewChild.required<ElementRef<HTMLElement>>('grid');
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

  /** Each cell's last drawn position relative to the grid, for the FLIP slide. */
  private lastPositions = new Map<string, { left: number; top: number }>();

  private cleanup: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopListening());

    afterRenderEffect(() => {
      this.cells();
      const animate = this.editing();
      untracked(() => this.slideMovedCells(animate));
    });

    // After a keyboard move/resize the owner recomputes the layout (compaction may differ from the request);
    // announce where the widget actually settled.
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

  /** A dragged widget is drawn at its previewed slot, then shifted to sit under the pointer. */
  protected dragTransform(c: GridCell): string | null {
    const d = this.drag();
    if (!d || d.kind !== 'move' || d.id !== c.w.instanceId) return null;
    const pitchX = d.cellPx + this.gap();
    const pitchY = this.rowHeight() + this.gap();
    const x = (d.origin.x - c.rect.x) * pitchX + d.dxPx;
    const y = (d.origin.y - c.rect.y) * pitchY + d.dyPx;
    return `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  private preview(widgets: BootstrapWidget[], d: ActiveDrag): Map<string, GridRect> | null {
    const o = d.origin;
    const t = d.target;
    const items: GridItem[] = widgets.map(w => ({ id: w.instanceId, rect: w.layout }));
    let next: GridItem[];
    if (d.kind === 'move') {
      if (t.x === o.x && t.y === o.y) return null;
      next = moveTo(items, d.id, t.x, t.y, this.columns());
    } else {
      if (t.w === o.w && t.h === o.h) return null;
      next = resizeTo(items, d.id, t.w, t.h, d.size, this.columns());
    }
    return new Map(next.map(i => [i.id, i.rect]));
  }

  /** FLIP: every cell (other than one under the pointer) that changed place slides from where it was drawn. */
  private slideMovedCells(animate: boolean): void {
    const grid = this.gridEl().nativeElement;
    const origin = grid.getBoundingClientRect();
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dragging = this.drag();
    const next = new Map<string, { left: number; top: number }>();
    for (const el of Array.from(grid.querySelectorAll<HTMLElement>('[data-instance-id]'))) {
      const id = el.dataset['instanceId'] ?? '';
      const r = el.getBoundingClientRect();
      const pos = { left: r.left - origin.left, top: r.top - origin.top };
      next.set(id, pos);
      const prev = this.lastPositions.get(id);
      if (!animate || reduced || !prev || typeof el.animate !== 'function') continue;
      if (dragging?.kind === 'move' && dragging.id === id) continue;
      const dx = prev.left - pos.left;
      const dy = prev.top - pos.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: REFLOW_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
      );
    }
    this.lastPositions = next;
  }

  protected anchorId(w: BootstrapWidget): string | null {
    return ANCHOR_IDS[w.widgetKey] ?? null;
  }

  protected ariaLabel(w: BootstrapWidget): string {
    const l = w.layout;
    return `${w.title}, column ${l.x + 1}, row ${l.y + 1}, width ${l.w}, height ${l.h}`;
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
    this.drag.set({
      id: w.instanceId,
      kind,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...w.layout },
      size: w.size,
      cellPx,
      target: { ...w.layout },
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
    const dx = pixelToCell(e.clientX - d.startX, d.cellPx, this.gap());
    const dy = pixelToCell(e.clientY - d.startY, this.rowHeight(), this.gap());
    const target = d.kind === 'move' ? this.clampMove(d.origin, dx, dy) : this.clampResize(d.origin, d.size, dx, dy);
    const t = d.target;
    const dxPx = e.clientX - d.startX;
    const dyPx = e.clientY - d.startY;
    const snapped = t.x !== target.x || t.y !== target.y || t.w !== target.w || t.h !== target.h;
    // A dragged widget follows every pointer move; a resize only redraws when the size snaps to a new cell.
    if (snapped || (d.kind === 'move' && (dxPx !== d.dxPx || dyPx !== d.dyPx))) {
      this.drag.set({ ...d, target: snapped ? target : t, dxPx, dyPx });
    }
  }

  private onPointerUp(e: MouseEvent): void {
    this.onPointerMove(e);
    const d = this.drag();
    this.endDrag();
    if (!d) return;
    const o = d.origin;
    const t = d.target;
    if (d.kind === 'move') {
      if (t.x !== o.x || t.y !== o.y) this.moved.emit({ id: d.id, x: t.x, y: t.y });
    } else if (t.w !== o.w || t.h !== o.h) {
      this.resized.emit({ id: d.id, w: t.w, h: t.h });
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
        const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
        if (event.shiftKey) {
          const t = this.clampResize(l, w.size, dx, dy);
          if (t.w !== l.w || t.h !== l.h) {
            this.pendingAnnouncement = { id: w.instanceId, kind: 'resize' };
            this.resized.emit({ id: w.instanceId, w: t.w, h: t.h });
          }
        } else {
          const t = this.clampMove(l, dx, dy);
          if (t.x !== l.x || t.y !== l.y) {
            this.pendingAnnouncement = { id: w.instanceId, kind: 'move' };
            this.moved.emit({ id: w.instanceId, x: t.x, y: t.y });
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

  private clampMove(origin: GridRect, dx: number, dy: number): GridRect {
    const maxX = Math.max(0, this.columns() - origin.w);
    return { ...origin, x: Math.min(maxX, Math.max(0, origin.x + dx)), y: Math.max(0, origin.y + dy) };
  }

  private clampResize(origin: GridRect, size: BootstrapWidget['size'], dw: number, dh: number): GridRect {
    const cols = this.columns();
    const minW = Math.min(size.minW, cols);
    const maxW = Math.max(minW, Math.min(size.maxW, cols - origin.x));
    const minH = size.minH;
    const maxH = Math.max(minH, size.maxH);
    return {
      ...origin,
      w: Math.min(maxW, Math.max(minW, origin.w + dw)),
      h: Math.min(maxH, Math.max(minH, origin.h + dh))
    };
  }
}
