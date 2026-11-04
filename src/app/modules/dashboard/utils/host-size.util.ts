import { DestroyRef, ElementRef, Signal, inject, signal } from '@angular/core';

export interface HostSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The component host's rendered size, updated at most once per animation frame. Starts at 0x0 (not
 * laid out yet), and stays there where ResizeObserver doesn't exist (tests). Call from an injection
 * context; the observer is disconnected when the component is destroyed.
 */
export function injectHostSize(): Signal<HostSize> {
  const size = signal<HostSize>({ width: 0, height: 0 });
  if (typeof ResizeObserver === 'undefined') return size.asReadonly();

  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  let pending: HostSize | null = null;
  let frameId: number | null = null;
  const apply = (): void => {
    frameId = null;
    if (!pending) return;
    const next = pending;
    pending = null;
    const current = size();
    if (current.width !== next.width || current.height !== next.height) size.set(next);
  };

  const observer = new ResizeObserver((entries) => {
    const rect = entries[entries.length - 1]?.contentRect;
    if (!rect) return;
    pending = { width: rect.width, height: rect.height };
    if (typeof requestAnimationFrame !== 'function') {
      apply();
    } else if (frameId === null) {
      frameId = requestAnimationFrame(apply);
    }
  });
  observer.observe(host);
  inject(DestroyRef).onDestroy(() => {
    observer.disconnect();
    if (frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameId);
  });
  return size.asReadonly();
}

/** True for a laid-out card smaller than the given size in either direction (a 2-column or 2-row
 * dashboard card). A 0x0 host (not laid out yet) is not compact, so the full view renders first. */
export function isCompactSize(size: HostSize, minWidth: number, minHeight: number): boolean {
  if (!(size.width > 0) || !(size.height > 0)) return false;
  return size.width < minWidth || size.height < minHeight;
}
