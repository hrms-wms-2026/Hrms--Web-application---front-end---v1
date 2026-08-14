const FLIP_ATTR = 'data-flip-id';
const DEFAULT_DURATION_MS = 320;
const DEFAULT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const MOVE_EPSILON_PX = 0.5;
const SCALE_EPSILON = 0.01;

export type FlipSnapshot = Record<string, DOMRect>;

export interface FlipOptions {
  duration?: number;
  easing?: string;
}

/** Snapshots the current bounding rect of every [data-flip-id] descendant, keyed by that id. Call before a layout-changing state update. */
export function captureFlipRects(container: HTMLElement): FlipSnapshot {
  const snapshot: FlipSnapshot = {};
  container.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(FLIP_ATTR);
    if (id) snapshot[id] = el.getBoundingClientRect();
  });
  return snapshot;
}

/** Call after the layout-changing state update has rendered. Animates every [data-flip-id] descendant from its `before` position/size to its new one (Invert + Play of the FLIP technique). Elements with no prior snapshot, elements that didn't move/resize, and all elements under prefers-reduced-motion are left untouched. */
export function playFlipAnimation(container: HTMLElement, before: FlipSnapshot, options: FlipOptions = {}): void {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const duration = options.duration ?? DEFAULT_DURATION_MS;
  const easing = options.easing ?? DEFAULT_EASING;

  container.querySelectorAll<HTMLElement>(`[${FLIP_ATTR}]`).forEach((el) => {
    const id = el.getAttribute(FLIP_ATTR);
    if (!id) return;

    const first = before[id];
    if (!first) return;

    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    const sx = last.width === 0 ? 1 : first.width / last.width;
    const sy = last.height === 0 ? 1 : first.height / last.height;

    const unchanged =
      Math.abs(dx) < MOVE_EPSILON_PX && Math.abs(dy) < MOVE_EPSILON_PX &&
      Math.abs(sx - 1) < SCALE_EPSILON && Math.abs(sy - 1) < SCALE_EPSILON;
    if (unchanged) return;

    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transform: 'none' }
      ],
      { duration, easing }
    );
  });
}
