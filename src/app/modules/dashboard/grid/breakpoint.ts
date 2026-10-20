import { DestroyRef, ElementRef, Signal, inject, signal } from '@angular/core';
import { Breakpoint } from '../models/dashboard-layout.model';

/** Grid breakpoint for a container (content) width: >= 1200 desktop, >= 768 tablet, otherwise mobile. */
export function breakpointForWidth(width: number): Breakpoint {
  if (width >= 1200) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

/**
 * Tracks the grid container width with a ResizeObserver and exposes the matching breakpoint.
 * Call in an injection context (component field initialiser); the observer is disconnected on destroy.
 */
export function injectBreakpoint(host: ElementRef<HTMLElement>): Signal<Breakpoint> {
  const current = signal<Breakpoint>(breakpointForWidth(host.nativeElement.clientWidth));
  if (typeof ResizeObserver === 'undefined') {
    return current.asReadonly();
  }
  const observer = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (entry) {
      current.set(breakpointForWidth(entry.contentRect.width));
    }
  });
  observer.observe(host.nativeElement);
  inject(DestroyRef).onDestroy(() => observer.disconnect());
  return current.asReadonly();
}
