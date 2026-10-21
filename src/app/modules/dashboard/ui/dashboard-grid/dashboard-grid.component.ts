import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { BootstrapWidget, GridRect } from '../../models/dashboard-layout.model';
import { pixelToCell } from '../../grid/grid-math';
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

interface ActiveDrag {
  id: string;
  kind: 'move' | 'resize';
  startX: number;
  startY: number;
  origin: GridRect;
  size: BootstrapWidget['size'];
  cellPx: number;
  target: GridRect;
}

/**
 * Renders widgets on a CSS grid. In edit mode a widget can be dragged (its frame's [data-drag-handle]),
 * resized (its [data-resize-handle]) or moved/resized/removed from the keyboard. The grid never
 * mutates the layout: it emits moved/resized/removed and the owner (layout store) recomputes the layout.
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
      @for (w of widgets(); track w.instanceId) {
        <div
          class="relative min-w-0 scroll-mt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          [class.opacity-50]="drag()?.id === w.instanceId"
          [class.motion-safe:transition-opacity]="editing()"
          [attr.id]="anchorId(w)"
          [attr.data-instance-id]="w.instanceId"
          [attr.tabindex]="editing() ? 0 : null"
          [attr.aria-label]="editing() ? ariaLabel(w) : null"
          [style.grid-column]="gridColumn(w.layout)"
          [style.grid-row]="gridRow(w.layout)"
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

  private readonly gridEl = viewChild.required<ElementRef<HTMLElement>>('grid');
  protected readonly drag = signal<ActiveDrag | null>(null);
  protected readonly ghost = computed(() => this.drag()?.target ?? null);

  private cleanup: (() => void) | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopListening());
  }

  protected gridColumn(r: GridRect): string {
    return `${r.x + 1} / span ${r.w}`;
  }

  protected gridRow(r: GridRect): string {
    return `${r.y + 1} / span ${r.h}`;
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
      target: { ...w.layout }
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
    if (t.x !== target.x || t.y !== target.y || t.w !== target.w || t.h !== target.h) {
      this.drag.set({ ...d, target });
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
      case 'Backspace':
        event.preventDefault();
        this.removed.emit(w.instanceId);
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        event.preventDefault();
        const dx = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
        const dy = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
        if (event.shiftKey) {
          const t = this.clampResize(l, w.size, dx, dy);
          if (t.w !== l.w || t.h !== l.h) this.resized.emit({ id: w.instanceId, w: t.w, h: t.h });
        } else {
          const t = this.clampMove(l, dx, dy);
          if (t.x !== l.x || t.y !== l.y) this.moved.emit({ id: w.instanceId, x: t.x, y: t.y });
        }
        return;
      }
    }
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
