import { ElementRef, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { breakpointForWidth, injectBreakpoint } from './breakpoint';

describe('breakpointForWidth', () => {
  it('maps content widths to breakpoints at the 1200 / 768 thresholds', () => {
    expect(breakpointForWidth(1200)).toBe('desktop');
    expect(breakpointForWidth(1199)).toBe('tablet');
    expect(breakpointForWidth(768)).toBe('tablet');
    expect(breakpointForWidth(767)).toBe('mobile');
    expect(breakpointForWidth(0)).toBe('mobile');
  });
});

describe('injectBreakpoint', () => {
  let callback: ResizeObserverCallback;
  const disconnect = vi.fn();
  const observe = vi.fn();

  beforeEach(() => {
    disconnect.mockClear();
    observe.mockClear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: ResizeObserverCallback) {
          callback = cb;
        }
        observe = observe;
        disconnect = disconnect;
        unobserve = vi.fn();
      }
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  function create(width: number) {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { value: width, configurable: true });
    const injector = TestBed.inject(Injector);
    return runInInjectionContext(injector, () => injectBreakpoint(new ElementRef(el)));
  }

  function resize(width: number) {
    callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
  }

  it('reports the initial width and observes the host', () => {
    const bp = create(1300);
    expect(bp()).toBe('desktop');
    expect(observe).toHaveBeenCalled();
  });

  it('updates when the observed width crosses a threshold', () => {
    const bp = create(1300);
    resize(900);
    expect(bp()).toBe('tablet');
    resize(500);
    expect(bp()).toBe('mobile');
    resize(1200);
    expect(bp()).toBe('desktop');
  });

  it('disconnects the observer on destroy', () => {
    create(1300);
    TestBed.resetTestingModule();
    expect(disconnect).toHaveBeenCalled();
  });
});
