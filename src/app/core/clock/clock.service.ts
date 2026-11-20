// src/app/core/clock/clock.service.ts
import { DOCUMENT } from '@angular/common';
import { DestroyRef, ErrorHandler, Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';

/** How often a clock signal changes. Show seconds only where the UI counts seconds. */
export type ClockRate = 'second' | 'minute';

const PERIOD_MS: Record<ClockRate, number> = { second: 1_000, minute: 60_000 };
const RATES: readonly ClockRate[] = ['second', 'minute'];

interface Poll {
  readonly callback: () => void;
  readonly periodMs: number;
  timer: ReturnType<typeof setInterval> | null;
}

/**
 * The app's one source of "now" and of repeating polls (Improvements task 16). One timer per rate runs only while
 * something reads that rate, and nothing runs while the tab is hidden; when the tab is visible again every clock
 * jumps to the current time and every poll calls back once. Read it through `injectNow()`; poll with `poll()`.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly document = inject(DOCUMENT);
  private readonly errorHandler = inject(ErrorHandler);
  private readonly values: Record<ClockRate, WritableSignal<number>> = {
    second: signal(Date.now()),
    minute: signal(Date.now()),
  };
  private readonly readers: Record<ClockRate, number> = { second: 0, minute: 0 };
  private readonly timers: Record<ClockRate, ReturnType<typeof setInterval> | null> = { second: null, minute: null };
  private readonly polls = new Set<Poll>();
  private listening = false;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.readers.second = 0;
      this.readers.minute = 0;
      for (const poll of this.polls) this.stopPoll(poll);
      this.polls.clear();
      this.sync();
      this.destroyed = true;
    });
  }

  /** Epoch milliseconds at the given rate. Use `injectNow()` in components so the timer runs only while needed. */
  now(rate: ClockRate): Signal<number> {
    return this.values[rate].asReadonly();
  }

  /** Counts one reader of `rate` and returns the function that releases it (safe to call twice). */
  acquire(rate: ClockRate): () => void {
    if (this.destroyed) return () => undefined;
    this.readers[rate]++;
    if (this.timers[rate] === null) this.values[rate].set(Date.now());
    this.sync();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.readers[rate] = Math.max(0, this.readers[rate] - 1);
      this.sync();
    };
  }

  /** Moves every clock to the current time now, e.g. after a manual refresh. */
  refresh(): void {
    const now = Date.now();
    for (const rate of RATES) this.values[rate].set(now);
  }

  /**
   * Calls `callback` every `periodMs` while the tab is visible, and once as soon as it is visible again. It does
   * not call at start: the caller does its first load itself. Returns the stop function (safe to call twice).
   */
  poll(callback: () => void, periodMs: number): () => void {
    if (this.destroyed) return () => undefined;
    const poll: Poll = { callback, periodMs, timer: null };
    this.polls.add(poll);
    this.sync();
    return () => {
      if (!this.polls.delete(poll)) return;
      this.stopPoll(poll);
      this.sync();
    };
  }

  private visible(): boolean {
    return this.document.visibilityState !== 'hidden';
  }

  private readonly onVisibilityChange = (): void => {
    if (this.visible()) {
      this.refresh();
      this.sync();
      for (const poll of [...this.polls]) this.run(poll);
    } else {
      this.sync();
    }
  };

  /** Runs one poll; a failing callback goes to Angular's ErrorHandler and never stops the clock or other polls. */
  private run(poll: Poll): void {
    try {
      poll.callback();
    } catch (error) {
      this.errorHandler.handleError(error);
    }
  }

  /** Starts or stops each timer and the visibility listener to match the readers, the polls and the tab state. */
  private sync(): void {
    if (this.destroyed) return;
    const visible = this.visible();
    for (const rate of RATES) {
      const timer = this.timers[rate];
      const wanted = visible && this.readers[rate] > 0;
      if (wanted && timer === null) {
        this.timers[rate] = setInterval(() => this.values[rate].set(Date.now()), PERIOD_MS[rate]);
      } else if (!wanted && timer !== null) {
        clearInterval(timer);
        this.timers[rate] = null;
      }
    }
    for (const poll of this.polls) {
      if (visible && poll.timer === null) {
        poll.timer = setInterval(() => {
          if (this.visible()) this.run(poll);
        }, poll.periodMs);
      } else if (!visible) {
        this.stopPoll(poll);
      }
    }
    const needed = this.readers.second + this.readers.minute + this.polls.size > 0;
    if (needed && !this.listening) {
      this.document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.listening = true;
    } else if (!needed && this.listening) {
      this.document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.listening = false;
    }
  }

  private stopPoll(poll: Poll): void {
    if (poll.timer !== null) clearInterval(poll.timer);
    poll.timer = null;
  }
}

/**
 * The current time (epoch ms) at `rate`, for a component or directive. Call it in an injection context (a field
 * initializer or the constructor); the clock stops counting this reader when the caller is destroyed.
 * Do not call it from a root service: that reader is never destroyed, so the clock would never be released.
 */
export function injectNow(rate: ClockRate = 'minute'): Signal<number> {
  const clock = inject(ClockService);
  inject(DestroyRef).onDestroy(clock.acquire(rate));
  return clock.now(rate);
}
