// src/app/core/clock/clock.service.spec.ts
import { Component, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type MockInstance, vi } from 'vitest';
import { ClockService, injectNow } from './clock.service';

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

@Component({ selector: 'app-minute-reader', template: '' })
class MinuteReaderComponent {
  readonly now = injectNow('minute');
}

@Component({ selector: 'app-second-reader', template: '' })
class SecondReaderComponent {
  readonly now = injectNow('second');
}

// Angular queues its own timers, so count only the timers the clock starts and has not cleared: intervals and
// timeouts alike, where a timeout that has already fired no longer counts as pending.
let setSpy: MockInstance<typeof setInterval>;
let clearSpy: MockInstance<typeof clearInterval>;
let timeoutSpy: MockInstance<typeof setTimeout>;
let clearTimeoutSpy: MockInstance<typeof clearTimeout>;
let firedTimeouts: Set<unknown>;
// Angular's scheduler calls setTimeout without a delay; the clock always passes one, so only those are the clock's.
let clockTimeouts: Set<unknown>;

// Vitest's fake timers also drive requestAnimationFrame with a ~16.7 ms interval when Angular or jsdom asks for a
// frame. The clock's own intervals are 1 s or longer, so only those count.
const MIN_CLOCK_INTERVAL_MS = 1_000;

function activeTimers(): number {
  const live = new Set(
    setSpy.mock.results
      .filter((_, i) => ((setSpy.mock.calls[i]?.[1] as number | undefined) ?? 0) >= MIN_CLOCK_INTERVAL_MS)
      .map((r) => r.value as unknown),
  );
  for (const call of clearSpy.mock.calls) live.delete(call[0]);
  const liveTimeouts = new Set(clockTimeouts);
  for (const call of clearTimeoutSpy.mock.calls) liveTimeouts.delete(call[0]);
  for (const handle of firedTimeouts) liveTimeouts.delete(handle);
  return live.size + liveTimeouts.size;
}

describe('ClockService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSpy = vi.spyOn(globalThis, 'setInterval');
    clearSpy = vi.spyOn(globalThis, 'clearInterval');
    firedTimeouts = new Set();
    clockTimeouts = new Set();
    const fakeSetTimeout = globalThis.setTimeout;
    timeoutSpy = vi.spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      const handle: unknown = fakeSetTimeout(() => {
        firedTimeouts.add(handle);
        fn();
      }, ms);
      if (ms !== undefined) clockTimeouts.add(handle);
      return handle;
    }) as typeof setTimeout);
    clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    vi.setSystemTime(new Date('2026-11-20T09:00:00Z'));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    setSpy.mockRestore();
    clearSpy.mockRestore();
    timeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('runs no timer while nothing reads the clock', () => {
    TestBed.inject(ClockService);
    expect(activeTimers()).toBe(0);
  });

  it('ticks the minute clock once a minute for a reader, and stops when the reader is destroyed', () => {
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();
    expect(activeTimers()).toBe(1);

    vi.advanceTimersByTime(59_000);
    expect(fixture.componentInstance.now()).toBe(start);
    vi.advanceTimersByTime(1_000);
    expect(fixture.componentInstance.now()).toBe(start + 60_000);

    fixture.destroy();
    expect(activeTimers()).toBe(0);
  });

  it('ticks the minute clock on the wall-clock minute, then every 60 s', () => {
    vi.setSystemTime(new Date('2026-11-20T09:00:20Z'));
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();
    expect(activeTimers()).toBe(1);

    vi.advanceTimersByTime(39_999);
    expect(fixture.componentInstance.now()).toBe(start);
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:01:00Z'));
    expect(activeTimers()).toBe(1);

    vi.advanceTimersByTime(59_999);
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:01:00Z'));
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:02:00Z'));
    vi.advanceTimersByTime(60_000);
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:03:00Z'));

    fixture.destroy();
    expect(activeTimers()).toBe(0);
  });

  it('hiding the tab before the minute boundary leaves no timer, and visible re-aligns to the next boundary', () => {
    vi.setSystemTime(new Date('2026-11-20T09:00:20Z'));
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();
    vi.advanceTimersByTime(10_000);

    setVisibility('hidden');
    expect(activeTimers()).toBe(0);
    vi.advanceTimersByTime(5 * 60_000);
    expect(fixture.componentInstance.now()).toBe(start);

    // Now 09:05:30. The value jumps to now, and the next change is the 09:06:00 boundary, 30 s away.
    setVisibility('visible');
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:05:30Z'));
    expect(activeTimers()).toBe(1);
    vi.advanceTimersByTime(29_999);
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:05:30Z'));
    vi.advanceTimersByTime(1);
    expect(fixture.componentInstance.now()).toBe(Date.parse('2026-11-20T09:06:00Z'));
  });

  it('hiding the tab after the boundary clears the running minute interval', () => {
    vi.setSystemTime(new Date('2026-11-20T09:00:20Z'));
    TestBed.createComponent(MinuteReaderComponent);
    vi.advanceTimersByTime(40_000);
    expect(activeTimers()).toBe(1);
    setVisibility('hidden');
    expect(activeTimers()).toBe(0);
  });

  it('shares one timer per rate between readers', () => {
    const a = TestBed.createComponent(MinuteReaderComponent);
    const b = TestBed.createComponent(MinuteReaderComponent);
    expect(activeTimers()).toBe(1);
    a.destroy();
    expect(activeTimers()).toBe(1);
    b.destroy();
    expect(activeTimers()).toBe(0);
  });

  it('ticks the second clock every second', () => {
    const fixture = TestBed.createComponent(SecondReaderComponent);
    const start = fixture.componentInstance.now();
    vi.advanceTimersByTime(3_000);
    expect(fixture.componentInstance.now()).toBe(start + 3_000);
  });

  it('pauses while the tab is hidden and catches up at once when it is visible again', () => {
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();

    setVisibility('hidden');
    expect(activeTimers()).toBe(0);
    vi.advanceTimersByTime(5 * 60_000);
    expect(fixture.componentInstance.now()).toBe(start);

    setVisibility('visible');
    expect(fixture.componentInstance.now()).toBe(start + 5 * 60_000);
    expect(activeTimers()).toBe(1);
  });

  it('refresh() moves every clock to the current time', () => {
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();
    vi.setSystemTime(start + 10_000);
    TestBed.inject(ClockService).refresh();
    expect(fixture.componentInstance.now()).toBe(start + 10_000);
  });

  describe('poll', () => {
    it('calls back on its period while visible, never while hidden, and once on becoming visible', () => {
      const clock = TestBed.inject(ClockService);
      const callback = vi.fn();
      const stop = clock.poll(callback, 15_000);

      vi.advanceTimersByTime(30_000);
      expect(callback).toHaveBeenCalledTimes(2);

      setVisibility('hidden');
      vi.advanceTimersByTime(5 * 60_000);
      expect(callback).toHaveBeenCalledTimes(2);

      setVisibility('visible');
      expect(callback).toHaveBeenCalledTimes(3);

      stop();
      vi.advanceTimersByTime(60_000);
      expect(callback).toHaveBeenCalledTimes(3);
      expect(activeTimers()).toBe(0);
    });

    it('skips a tick that fires while the tab reports hidden without an event', () => {
      const clock = TestBed.inject(ClockService);
      const callback = vi.fn();
      clock.poll(callback, 15_000);
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      vi.advanceTimersByTime(15_000);
      expect(callback).not.toHaveBeenCalled();
    });

    it('a stop function is safe to call twice', () => {
      const clock = TestBed.inject(ClockService);
      const stop = clock.poll(vi.fn(), 15_000);
      stop();
      expect(() => stop()).not.toThrow();
      expect(activeTimers()).toBe(0);
    });
  });

  it('one second reader and one minute reader run two intervals', () => {
    TestBed.createComponent(SecondReaderComponent);
    TestBed.createComponent(MinuteReaderComponent);
    expect(activeTimers()).toBe(2);
  });

  it('a second reader of a running rate does not change the value the first reader sees', () => {
    const a = TestBed.createComponent(MinuteReaderComponent);
    const start = a.componentInstance.now();
    vi.advanceTimersByTime(10_000);
    TestBed.createComponent(MinuteReaderComponent);
    expect(a.componentInstance.now()).toBe(start);
  });

  it('starts nothing after the root injector is destroyed', () => {
    const clock = TestBed.inject(ClockService);
    TestBed.resetTestingModule();
    const release = clock.acquire('minute');
    const stop = clock.poll(vi.fn(), 15_000);
    expect(activeTimers()).toBe(0);
    expect(() => {
      release();
      stop();
    }).not.toThrow();
  });

  describe('a failing poll', () => {
    it('does not stop the other polls or the clocks when the tab becomes visible', () => {
      const handleError = vi.fn();
      TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError } }] });
      const reader = TestBed.createComponent(MinuteReaderComponent);
      const start = reader.componentInstance.now();
      const clock = TestBed.inject(ClockService);
      const failure = new Error('poll failed');
      clock.poll(() => {
        throw failure;
      }, 15_000);
      const healthy = vi.fn();
      clock.poll(healthy, 15_000);

      setVisibility('hidden');
      setVisibility('visible');
      expect(healthy).toHaveBeenCalledTimes(1);
      expect(handleError).toHaveBeenCalledWith(failure);
      expect(activeTimers()).toBe(3);

      vi.advanceTimersByTime(60_000);
      expect(reader.componentInstance.now()).toBe(start + 60_000);
    });

    it('a poll registered during the catch-up does not fire in the same loop', () => {
      const clock = TestBed.inject(ClockService);
      const late = vi.fn();
      clock.poll(() => {
        clock.poll(late, 15_000);
      }, 15_000);

      setVisibility('hidden');
      setVisibility('visible');
      expect(late).not.toHaveBeenCalled();
    });

    it('a poll stopped during the catch-up is not called', () => {
      const clock = TestBed.inject(ClockService);
      const second = vi.fn();
      let stopSecond = (): void => undefined;
      clock.poll(() => {
        stopSecond();
      }, 15_000);
      stopSecond = clock.poll(second, 15_000);

      setVisibility('hidden');
      setVisibility('visible');
      expect(second).not.toHaveBeenCalled();
    });
  });

  it('leaves no timer and no listener when the root injector is destroyed', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    try {
      TestBed.inject(ClockService).poll(vi.fn(), 15_000);
      TestBed.createComponent(MinuteReaderComponent);
      TestBed.resetTestingModule();
      expect(activeTimers()).toBe(0);
      const added = add.mock.calls.find((call) => call[0] === 'visibilitychange')?.[1];
      const removed = remove.mock.calls.find((call) => call[0] === 'visibilitychange')?.[1];
      expect(added).toBeDefined();
      expect(removed).toBe(added);
    } finally {
      add.mockRestore();
      remove.mockRestore();
    }
  });
});
