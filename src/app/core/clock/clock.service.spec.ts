// src/app/core/clock/clock.service.spec.ts
import { Component } from '@angular/core';
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

// Angular queues its own timers, so count only the intervals the clock starts and has not cleared.
let setSpy: MockInstance<typeof setInterval>;
let clearSpy: MockInstance<typeof clearInterval>;

function activeIntervals(): number {
  return setSpy.mock.calls.length - clearSpy.mock.calls.length;
}

describe('ClockService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setSpy = vi.spyOn(globalThis, 'setInterval');
    clearSpy = vi.spyOn(globalThis, 'clearInterval');
    vi.setSystemTime(new Date('2026-11-20T09:00:00Z'));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    setSpy.mockRestore();
    clearSpy.mockRestore();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('runs no timer while nothing reads the clock', () => {
    TestBed.inject(ClockService);
    expect(activeIntervals()).toBe(0);
  });

  it('ticks the minute clock once a minute for a reader, and stops when the reader is destroyed', () => {
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();
    expect(activeIntervals()).toBe(1);

    vi.advanceTimersByTime(59_000);
    expect(fixture.componentInstance.now()).toBe(start);
    vi.advanceTimersByTime(1_000);
    expect(fixture.componentInstance.now()).toBe(start + 60_000);

    fixture.destroy();
    expect(activeIntervals()).toBe(0);
  });

  it('shares one timer per rate between readers', () => {
    const a = TestBed.createComponent(MinuteReaderComponent);
    const b = TestBed.createComponent(MinuteReaderComponent);
    expect(activeIntervals()).toBe(1);
    a.destroy();
    expect(activeIntervals()).toBe(1);
    b.destroy();
    expect(activeIntervals()).toBe(0);
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
    expect(activeIntervals()).toBe(0);
    vi.advanceTimersByTime(5 * 60_000);
    expect(fixture.componentInstance.now()).toBe(start);

    setVisibility('visible');
    expect(fixture.componentInstance.now()).toBe(start + 5 * 60_000);
    expect(activeIntervals()).toBe(1);
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
      expect(activeIntervals()).toBe(0);
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
      expect(activeIntervals()).toBe(0);
    });
  });

  it('leaves no timer and no listener when the root injector is destroyed', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    TestBed.inject(ClockService).poll(vi.fn(), 15_000);
    TestBed.createComponent(MinuteReaderComponent);
    TestBed.resetTestingModule();
    expect(activeIntervals()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    remove.mockRestore();
  });
});
