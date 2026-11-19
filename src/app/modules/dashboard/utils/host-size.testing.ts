import { vi } from 'vitest';

/** Stand-in for ResizeObserver in specs: tests report the host size through trigger(). */
export class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(): void {
    // Sizes are reported through trigger().
  }
  unobserve(): void {
    // Not used.
  }
  disconnect(): void {
    // Nothing to release.
  }
  trigger(width: number, height: number): void {
    this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
}

/** Installs FakeResizeObserver and a synchronous frame; undo with vi.unstubAllGlobals(). */
export function stubResizeObserver(): void {
  FakeResizeObserver.instances = [];
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  vi.stubGlobal('requestAnimationFrame', undefined);
}
