# One Shared Clock and Smarter Polling (Improvements task 16) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 16 per-component "now" timers and the 3 always-on polls with one `ClockService` that ticks only while something uses it and pauses while the tab is hidden, and push the notification count over the existing realtime hub.

**Architecture:** A root `ClockService` in `src/app/core/clock/` owns one `setInterval` per rate (`second`, `minute`), reference-counted through `injectNow(rate)`, which releases on the caller's `DestroyRef`. The same service runs visibility-aware polls (`clock.poll(callback, ms)` returns a stop function): no tick while hidden, one immediate call when the tab is visible again. Components read a `Signal<number>` (epoch ms) instead of keeping their own timer. The notification bell keeps its 60-second poll through `clock.poll` and also refreshes on a new `notificationsChanged` hub event; slowing the poll down when the hub is connected is the last task and waits for the backend event.

**Tech Stack:** Angular 20 signals (`signal`, `computed`, `effect`, `DestroyRef`), Vitest via `@angular/build:unit-test` (jsdom, `isolate: false`), `@microsoft/signalr` (existing `InboxRealtimeService`).

**Task file:** `docs/Improvements/person-4-api-layer-and-cleanup/task-16 One shared clock and smarter polling.md`

---

## Before you start: branch base

Branch `chore/shared-clock` is cut from `fix/spec-raf-leak` (PR #176), not from plain Development. Without #176, `team-status-card.component.spec.ts` leaves `document.visibilityState` set to `'hidden'`. Every `ClockService` timer and poll checks that value, so any clock spec that runs after it in the same worker gets no ticks. Merge this branch only after #176. Once #176 is in Development, rebase onto Development.

## Before you start: test-runner traps (read this)

The unit-test runner uses Vitest with `isolate: false`. Every spec file shares one global scope with the files run before it in the same worker. Two leaks were found on 2026-11-20 (fixed in PR #176):

1. **Fake timers and stubbed globals.** In `afterEach`, always call `vi.useRealTimers()` **before** `vi.unstubAllGlobals()`. In the other order, fake timers put back the stubbed value after the unstub.
2. **`document.visibilityState`.** A spec that overrides it with `Object.defineProperty(document, 'visibilityState', ...)` must remove the override in `afterEach` with `Reflect.deleteProperty(document, 'visibilityState')`. That restores the real getter from `Document.prototype`.

Every spec this plan adds or changes follows both rules. To check a spec file for leaks, run it in one worker together with the dashboard and position-management specs. Use a scratch runner config such as `export default { test: { maxWorkers: 1, minWorkers: 1, fileParallelism: false } };` with `npx ng test --watch=false --runner-config <path> --include <globs>`. Do not commit that config.

`ClockService` is `providedIn: 'root'`, so it is created when the first component injects it. A spec that uses fake timers must call `vi.useFakeTimers()` **before** `TestBed.createComponent(...)`. Otherwise the service's `setInterval` is a real timer and `vi.advanceTimersByTime` does not move it. The existing component specs already call `useFakeTimers()` before setup, because the old per-component timers had the same rule.

---

## Scope

**Clocks to convert (16 sites, 15 files + 1 dialog):**

| File (`src/app/...`) | Today | New rate | Notes |
|---|---|---|---|
| `modules/work/ui/task-clock-widget/task-clock-widget.component.ts` | 1 s, `number` | second | live elapsed time |
| `modules/work/ui/task-history-feed/task-history-feed.component.ts` | 1 s, `number` | second | live elapsed time |
| `modules/inbox/ui/inbox-revert-banner/inbox-revert-banner.component.ts` | 1 s, `number` | second | m:ss countdown |
| `modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.ts` | 30 s, `number` | minute | spec advances 30 s → 60 s |
| `modules/inbox/ui/conversation-panel/conversation-panel.component.ts` | 30 s, `number` | minute | 30-minute edit window |
| `shared/ui/popout-header-actions/popout-header-actions.component.ts` | 30 s, `Date` | minute | "just now" / "N min ago" |
| `modules/dashboard/feature/team-status-card/team-status-card.component.ts` | 30 s, `Date` | minute | minutes since / left |
| `modules/dashboard/feature/dashboard-greeting/dashboard-greeting.component.ts` | 60 s, `number` | minute | |
| `modules/dashboard/feature/today-at-a-glance-card/today-at-a-glance-card.component.ts` | 60 s, `number` | minute | refresh button sets now → `clock.refresh()` |
| `modules/dashboard/feature/action-center-card/action-center-card.component.ts` | 60 s, `Date`, own pause on hidden | minute | own start/stop clock goes |
| `modules/dashboard/feature/team-schedule-card/team-schedule-card.component.ts` | 60 s, `Date`, own pause on hidden | minute | own start/stop clock goes |
| `modules/dashboard/feature/team-schedule-detail-dialog/team-schedule-detail-dialog.component.ts` | 60 s, `Date`, only while open | minute | `clock.refresh()` on open |
| `modules/leave/feature/time-off-hub/time-off-hub.component.ts` | 60 s, `Date` | minute | `now` is public `readonly` |
| `modules/work/feature/task-board/task-board.component.ts` | 60 s, `Date`, field initializer | minute | `ngOnDestroy` clear goes |

**Polls to make visibility-aware (3):**

| File | Today |
|---|---|
| `layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts` | 60 s, runs while hidden |
| `modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.ts` | 15 s `refreshDayDetail`, runs while hidden |
| `modules/calendar/state/planner-leave-layer.store.ts` | 60 s, skips the fetch while hidden but the timer keeps running |

**Kept on purpose (real animations, not clocks):** `modules/public/ui/landing-feature-tabs/landing-feature-tabs.component.ts` (tab auto-advance), `modules/dashboard/feature/wellbeing-carousel-card/wellbeing-carousel-card.component.ts` (6 s carousel). Both already clear their interval on destroy.

**Open question: tray presence (decide before Task 10).** `core/tray-presence/state/tray-presence.store.ts` polls `getStatus()` with `setTimeout`, every 15 s while connected and every 5 s while locked or offline, for as long as the app is open, hidden tab included. The 5-minute hidden-tab network check in "Done when" fails on this poll. It is the device-presence security gate (`main-layout` starts it), so pausing it while hidden is the security owner's call, not this task's. If they agree: wrap `schedulePoll` so it waits while `document.visibilityState === 'hidden'` and polls at once on `visibilitychange` to visible. The deadline timer keeps locking on time either way. If they do not agree: record the exception in the task file's status section.

**Reviewed, out of scope:** the other `setTimeout`-based polls are bounded. `meeting-link-panel` polls for 2 minutes at most while a link provisions, and `bulk-onboarding.store` polls until a terminal batch status.

**Backend dependency (separate repo, separate PR):** the hub has no notification event today. `InboxHub` sends `messageCreated`, `inboxChanged` and similar events to the group `inbox:{tenantId}:{userId}`. Notifications are created in `ONEVO.Infrastructure/Services/SharedPlatform/Notifications/NotificationDispatcher.cs` and `NotificationInAppDeliveryHandler.cs` for a `RecipientUserId`. The backend needs to send `notificationsChanged` (payload `{}`) to `InboxHub.UserGroup(tenantId, recipientUserId)` after the notification row is committed. Tasks 1–10 here work without it. Task 11 waits for it.

## File structure

| File | Responsibility |
|---|---|
| Create `src/app/core/clock/clock.service.ts` | `ClockService` (shared rate timers, visibility-aware polls, `refresh()`), `injectNow(rate)` |
| Create `src/app/core/clock/clock.service.spec.ts` | Service tests: start/stop by reference count, pause when hidden, refresh on visible, polls, cleanup |
| Modify the 14 clock files above | Read `injectNow(...)`; delete their own timers and clock pause code |
| Modify `src/app/core/realtime/inbox-realtime.service.ts` (+ `inbox-realtime.models.ts`) | `notificationsChanged$` stream |
| Modify the 3 poll files above | Use `clock.poll(...)` |
| Modify specs named in each task | Timing changes only, no assertion removed |
| Modify `docs/core/ARCHITECTURE.md` | One rule: "time and polling go through `ClockService`" |
| Modify task file + `docs/superpowers/plans/SUMMARY.md` | Status |

---

### Task 1: `ClockService` and `injectNow`

**Files:**
- Create: `src/app/core/clock/clock.service.ts`
- Test: `src/app/core/clock/clock.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/app/core/clock/clock.service.spec.ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
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

describe('ClockService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T09:00:00Z'));
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('runs no timer while nothing reads the clock', () => {
    TestBed.inject(ClockService);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ticks the minute clock once a minute for a reader, and stops when the reader is destroyed', () => {
    const fixture = TestBed.createComponent(MinuteReaderComponent);
    const start = fixture.componentInstance.now();
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(59_000);
    expect(fixture.componentInstance.now()).toBe(start);
    vi.advanceTimersByTime(1_000);
    expect(fixture.componentInstance.now()).toBe(start + 60_000);

    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shares one timer per rate between readers', () => {
    const a = TestBed.createComponent(MinuteReaderComponent);
    const b = TestBed.createComponent(MinuteReaderComponent);
    expect(vi.getTimerCount()).toBe(1);
    a.destroy();
    expect(vi.getTimerCount()).toBe(1);
    b.destroy();
    expect(vi.getTimerCount()).toBe(0);
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
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5 * 60_000);
    expect(fixture.componentInstance.now()).toBe(start);

    setVisibility('visible');
    expect(fixture.componentInstance.now()).toBe(start + 5 * 60_000);
    expect(vi.getTimerCount()).toBe(1);
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
      expect(vi.getTimerCount()).toBe(0);
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
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it('leaves no timer and no listener when the root injector is destroyed', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    TestBed.inject(ClockService).poll(vi.fn(), 15_000);
    TestBed.createComponent(MinuteReaderComponent);
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    remove.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to check they fail**

Run: `npx ng test --watch=false --include "src/app/core/clock/**/*.spec.ts"`
Expected: FAIL, because `./clock.service` cannot be resolved.

The `vi.getTimerCount()` assertions assume the clock's intervals are the only fake timers. After Step 3, if a count is off by one because Angular's scheduler queued its own timer on `createComponent`, switch those assertions to spies. Use `const setSpy = vi.spyOn(globalThis, 'setInterval')` and `const clearSpy = vi.spyOn(globalThis, 'clearInterval')` created after `useFakeTimers()`, and compare `setSpy.mock.calls.length - clearSpy.mock.calls.length`. Keep what each test checks.

- [ ] **Step 3: Write the service**

```ts
// src/app/core/clock/clock.service.ts
import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';

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
  private readonly values: Record<ClockRate, WritableSignal<number>> = {
    second: signal(Date.now()),
    minute: signal(Date.now()),
  };
  private readonly readers: Record<ClockRate, number> = { second: 0, minute: 0 };
  private readonly timers: Record<ClockRate, ReturnType<typeof setInterval> | null> = { second: null, minute: null };
  private readonly polls = new Set<Poll>();
  private listening = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.readers.second = 0;
      this.readers.minute = 0;
      for (const poll of this.polls) this.stopPoll(poll);
      this.polls.clear();
      this.sync();
    });
  }

  /** Epoch milliseconds at the given rate. Use `injectNow()` in components so the timer runs only while needed. */
  now(rate: ClockRate): Signal<number> {
    return this.values[rate].asReadonly();
  }

  /** Counts one reader of `rate` and returns the function that releases it (safe to call twice). */
  acquire(rate: ClockRate): () => void {
    this.readers[rate]++;
    this.values[rate].set(Date.now());
    this.sync();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.readers[rate]--;
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
      for (const poll of this.polls) poll.callback();
    }
    this.sync();
  };

  /** Starts or stops each timer and the visibility listener to match the readers, the polls and the tab state. */
  private sync(): void {
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
          if (this.visible()) poll.callback();
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
 */
export function injectNow(rate: ClockRate = 'minute'): Signal<number> {
  const clock = inject(ClockService);
  inject(DestroyRef).onDestroy(clock.acquire(rate));
  return clock.now(rate);
}
```

- [ ] **Step 4: Run the tests to check they pass**

Run: `npx ng test --watch=false --include "src/app/core/clock/**/*.spec.ts"`
Expected: PASS, 10 tests, no warnings.

- [ ] **Step 5: Commit**

```powershell
git add src/app/core/clock
git commit -m "feat(core): shared ClockService with per-rate timers and visibility-aware polls"
```

---

### Task 2: Second-rate readers (task clock, task history, revert banner)

**Files:**
- Modify: `src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.ts:189-214`
- Modify: `src/app/modules/work/ui/task-history-feed/task-history-feed.component.ts:69-83`
- Modify: `src/app/modules/inbox/ui/inbox-revert-banner/inbox-revert-banner.component.ts:31-46`
- Specs (should pass unchanged): the `.spec.ts` next to each file

All three read `this.now()` as epoch ms, so the type stays `Signal<number>`.

- [ ] **Step 1: Task clock widget.** Remove `private tickTimer: ReturnType<typeof setInterval> | null = null;` and the whole constructor. Replace `private readonly now = signal(Date.now());` with:

```ts
  /** Ticks every second while clocked in shows a live elapsed time. */
  private readonly now = injectNow('second');
```

Add `import { injectNow } from '../../../../core/clock/clock.service';`. If `destroyRef` has no other use, delete its field and drop `DestroyRef` from the `@angular/core` import. Drop `signal` only if nothing else uses it (`pushPopupOpen` does, so it stays).

- [ ] **Step 2: Task history feed.** Remove `tickTimer`, the constructor and, if unused, `destroyRef`/`DestroyRef`. Replace the `now` field:

```ts
  private readonly now = injectNow('second');
```

Add `import { injectNow } from '../../../../core/clock/clock.service';`. Remove `signal` from the import if nothing else uses it.

- [ ] **Step 3: Revert banner.** Replace the `now` field and delete the constructor:

```ts
  private readonly now = injectNow('second');
```

Change the import line to `import { Component, computed, input, output } from '@angular/core';` and add `import { injectNow } from '../../../../core/clock/clock.service';`.

- [ ] **Step 4: Run their specs**

Run: `npx ng test --watch=false --include "src/app/modules/work/ui/task-clock-widget/**/*.spec.ts" --include "src/app/modules/work/ui/task-history-feed/**/*.spec.ts" --include "src/app/modules/inbox/ui/inbox-revert-banner/**/*.spec.ts"`
Expected: PASS. These specs call `vi.useFakeTimers()` and advance 1 s / 65 s. If one creates the component first, move its `useFakeTimers()` call above the create call and do not change any assertion. Also check that its `afterEach` calls `vi.useRealTimers()`; add it if missing.

- [ ] **Step 5: Commit**

```powershell
git add src/app/modules/work/ui/task-clock-widget src/app/modules/work/ui/task-history-feed src/app/modules/inbox/ui/inbox-revert-banner
git commit -m "refactor(time): task clock, task history and revert banner read the shared second clock"
```

---

### Task 3: Minute readers kept as `number` (greeting, today at a glance, calendar grid, conversation panel)

**Files:**
- Modify: `src/app/modules/dashboard/feature/dashboard-greeting/dashboard-greeting.component.ts:11-36`
- Modify: `src/app/modules/dashboard/feature/today-at-a-glance-card/today-at-a-glance-card.component.ts:86-98,194-197,216-226`
- Modify: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.ts:183-198`
- Modify: `src/app/modules/inbox/ui/conversation-panel/conversation-panel.component.ts:31,622,734-735`
- Modify: `src/app/modules/calendar/ui/calendar-hour-grid/calendar-hour-grid.component.spec.ts:223,282`

- [ ] **Step 1: Greeting.** Replace the fields `destroyRef`, `tickTimer` and `now` (and their comment) with:

```ts
  // Re-evaluates "Good morning" -> "Good afternoon" as time passes: computed() needs a signal to depend on.
  private readonly now = injectNow('minute');
```

Delete the constructor. The import becomes `import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';`, plus `import { injectNow } from '../../../../core/clock/clock.service';`.

- [ ] **Step 2: Today at a glance.** Delete `private tickTimer ...` and the block

```ts
    this.tickTimer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => {
      if (this.tickTimer !== null) clearInterval(this.tickTimer);
    });
```

Replace `private readonly now = signal(Date.now());` with:

```ts
  private readonly clock = inject(ClockService);
  private readonly now = injectNow('minute');
```

In `refresh()`, replace `this.now.set(Date.now());` with `this.clock.refresh();`. Add `import { ClockService, injectNow } from '../../../../core/clock/clock.service';`. Keep `destroyRef`: the ResizeObserver in `afterNextRender` still disconnects through it. After this step, `grep -n setInterval` on the file must print nothing.

- [ ] **Step 3: Calendar hour grid.** Replace the `now` field with `private readonly now = injectNow('minute');` and update its comment's last sentence to "Ticking a signal re-derives it and self-heals that load-order race within a minute.". In the constructor, replace

```ts
    const tick = setInterval(() => this.now.set(Date.now()), 30_000);
    this.destroyRef.onDestroy(() => {
      clearInterval(tick);
      if (this.autoScrollTimer !== null) clearTimeout(this.autoScrollTimer);
    });
```

with

```ts
    this.destroyRef.onDestroy(() => {
      if (this.autoScrollTimer !== null) clearTimeout(this.autoScrollTimer);
    });
```

Add the `injectNow` import (`'../../../../core/clock/clock.service'`). Drop `signal` from the import only if unused.

- [ ] **Step 4: Calendar spec timing (inputs change, assertions do not).** On the minute clock, the value is `Date.now()` when the 60-second tick fires. So each test sets the system time one minute before the moment it asserts, then advances 60 s. In `calendar-hour-grid.component.spec.ts`:
  - The now-line test near line 222: change `vi.setSystemTime(new Date('2026-09-01T09:00:00Z'));` / `vi.advanceTimersByTime(30_000);` to `vi.setSystemTime(new Date('2026-09-01T08:59:00Z'));` / `vi.advanceTimersByTime(60_000);`. The tick lands at 09:00:00, and the `(9 / 24) * 100` assertion stays.
  - "updates the pill as the clock ticks" near line 281: change `vi.setSystemTime(new Date('2026-09-01T09:37:10Z'));` / `vi.advanceTimersByTime(30_000);` to `vi.setSystemTime(new Date('2026-09-01T09:36:10Z'));` / `vi.advanceTimersByTime(60_000);`. The tick lands at 09:37:10, and `'9:37 AM'` stays.

- [ ] **Step 5: Conversation panel.** Delete `const CLOCK_TICK_MS = 30 * 1000;` and the two constructor lines

```ts
    const tick = setInterval(() => this.now.set(Date.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
```

Replace `private readonly now = signal(Date.now());` with `private readonly now = injectNow('minute');`. Add `import { injectNow } from '../../../../core/clock/clock.service';`. The edit window is 30 minutes, so a minute rate is fine.

- [ ] **Step 6: Run the specs**

Run: `npx ng test --watch=false --include "src/app/modules/dashboard/feature/dashboard-greeting/**/*.spec.ts" --include "src/app/modules/dashboard/feature/today-at-a-glance-card/**/*.spec.ts" --include "src/app/modules/calendar/ui/calendar-hour-grid/**/*.spec.ts" --include "src/app/modules/inbox/ui/conversation-panel/**/*.spec.ts"`
Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/app/modules/dashboard/feature/dashboard-greeting src/app/modules/dashboard/feature/today-at-a-glance-card src/app/modules/calendar/ui/calendar-hour-grid src/app/modules/inbox/ui/conversation-panel
git commit -m "refactor(time): greeting, today at a glance, calendar grid and conversation panel read the shared minute clock"
```

---

### Task 4: Minute readers that use `Date` (popout header, time-off hub, task board)

**Files:**
- Modify: `src/app/shared/ui/popout-header-actions/popout-header-actions.component.ts:4,137,152-154`
- Modify: `src/app/modules/leave/feature/time-off-hub/time-off-hub.component.ts:95,232-234`
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts:163-165,375-376`

The pattern for a `Date` reader:

```ts
  private readonly minute = injectNow('minute');
  private readonly now = computed(() => new Date(this.minute()));
```

- [ ] **Step 1: Popout header actions.** Delete `const TICK_MS = 30_000;` and the two constructor lines `const timer = setInterval(...)` / `inject(DestroyRef).onDestroy(() => clearInterval(timer));`. Replace `private readonly now = signal(new Date());` with the pattern above. Update the class doc comment from "re-renders every 30 seconds" to "re-renders every minute". Add the `injectNow` import (`'../../../core/clock/clock.service'`). Remove `DestroyRef` and `signal` from the import if they are unused.

- [ ] **Step 2: Time-off hub.** Replace `readonly now = signal(new Date());` with

```ts
  private readonly minute = injectNow('minute');
  readonly now = computed(() => new Date(this.minute()));
```

Delete the two constructor lines and their comment (`// Re-check every minute ...`, `const tick = ...`, `inject(DestroyRef).onDestroy(...)`). Add the import (`'../../../../core/clock/clock.service'`). Run `grep -rn "\.now\.set(" src/app/modules/leave`: it must print nothing.

- [ ] **Step 3: Task board.** Replace

```ts
  private readonly now = signal(new Date());
  private readonly clockTimer = setInterval(() => this.now.set(new Date()), 60_000);
```

with the pattern above (keep the doc comment above it). In `ngOnDestroy`, delete `clearInterval(this.clockTimer);`. Add the import (`'../../../../core/clock/clock.service'`).

- [ ] **Step 4: Run the specs**

Run: `npx ng test --watch=false --include "src/app/shared/ui/popout-header-actions/**/*.spec.ts" --include "src/app/modules/leave/feature/time-off-hub/**/*.spec.ts" --include "src/app/modules/work/feature/task-board/**/*.spec.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/shared/ui/popout-header-actions src/app/modules/leave/feature/time-off-hub src/app/modules/work/feature/task-board
git commit -m "refactor(time): popout header, time-off hub and task board read the shared minute clock"
```

---

### Task 5: Dashboard team cards (team status, team schedule card + dialog, action centre)

These cards paused their own clock on `visibilitychange`. The service now does that, so their **clock** start/stop code goes. Their **data** reload on `visibilitychange` (`feed.reload()`, `store.load()`) stays.

**Files:**
- Modify: `src/app/modules/dashboard/feature/team-status-card/team-status-card.component.ts:40,94,103,221,224`
- Modify: `src/app/modules/dashboard/feature/team-schedule-card/team-schedule-card.component.ts:85,143,152,323,326,462-481`
- Modify: `src/app/modules/dashboard/feature/team-schedule-detail-dialog/team-schedule-detail-dialog.component.ts:139-140,208-222,278-279`
- Modify: `src/app/modules/dashboard/feature/action-center-card/action-center-card.component.ts:38,82-83,292-318`

- [ ] **Step 1: Team status.** Delete `const TICK_MS = 30_000;` and the field `private tickId ...`. Replace `protected readonly now = signal(new Date());` with

```ts
  private readonly minute = injectNow('minute');
  protected readonly now = computed(() => new Date(this.minute()));
```

In `ngOnInit`, delete `this.tickId = setInterval(...)` and `if (this.tickId) clearInterval(this.tickId);`. Add the import (`'../../../../core/clock/clock.service'`).

- [ ] **Step 2: Team schedule card.** Delete `const CLOCK_TICK_MS = 60_000;`, the `clockId` field, `startClock()` and `stopClock()`. Replace the `now` field with the same two lines as Step 1. In `ngOnInit`, delete `if (document.visibilityState === 'visible') this.startClock();` and `this.stopClock();`. Replace `onVisibilityChange` with:

```ts
  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') this.feed.reload();
  }
```

- [ ] **Step 3: Team schedule detail dialog.** Delete `NOW_TICK_MS` and its comment. Replace the `// The now line moves once a minute, only while the popup is open.` block (the `clock` variable, `stop`, the effect and `inject(DestroyRef).onDestroy(stop)`) with:

```ts
    // The now line is current the moment the popup opens, then moves with the shared minute clock.
    const clock = inject(ClockService);
    effect(() => {
      if (this.open()) untracked(() => clock.refresh());
    });
```

Replace the `now` field (and keep its doc comment, reworded to "The clock for the now line; moves every minute.") with the two lines from Step 1. Add `import { ClockService, injectNow } from '../../../../core/clock/clock.service';`.

- [ ] **Step 4: Action centre.** Delete `const CLOCK_TICK_MS = 60_000;`, the `clockId` field, `startClock()`, `stopClock()`, the `this.startClock();` call in `ngOnInit`, and `this.stopClock();` in its `onDestroy`. Replace the `now` field with the two lines from Step 1. Replace `onVisibilityChange` with:

```ts
  private onVisibilityChange(): void {
    if (document.visibilityState === 'visible') void this.store.load();
  }
```

The `ngOnInit` destroy hook keeps `document.removeEventListener('visibilitychange', this.visibilityHandler);`.

- [ ] **Step 5: Run the dashboard specs**

Run: `npx ng test --watch=false --include "src/app/modules/dashboard/**/*.spec.ts"`
Expected: PASS. Two specs need a closer look:
- `team-status-card` "a clock tick changes elapsed times but not the counts or the order" advances 30 s while hidden. It asserts the order and one API call, both still true. No change is needed, but under the minute clock that test never ticks. To keep it meaningful, change its advance to `60_000` and its visibility to `'visible'`, and add `Reflect.deleteProperty(document, 'visibilityState')` to the spec's `afterEach` (#176 already does that). Its assertions stay.
- `team-schedule-card` "a poll tick keeps the row order" advances 60 s. No change.

If a spec fails because it created the component before `vi.useFakeTimers()`, move the `useFakeTimers()` call up. Never delete an assertion.

- [ ] **Step 6: Commit**

```powershell
git add src/app/modules/dashboard/feature/team-status-card src/app/modules/dashboard/feature/team-schedule-card src/app/modules/dashboard/feature/team-schedule-detail-dialog src/app/modules/dashboard/feature/action-center-card
git commit -m "refactor(dashboard): team cards read the shared minute clock; their own clock pausing goes"
```

---

### Task 6: Planner leave layer poll

**Files:**
- Modify: `src/app/modules/calendar/state/planner-leave-layer.store.ts`
- Spec: `src/app/modules/calendar/state/planner-leave-layer.store.spec.ts`

- [ ] **Step 1: Make the spec's `afterEach` leak-safe first.** Replace its `afterEach` with:

```ts
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });
```

Run: `npx ng test --watch=false --include "src/app/modules/calendar/state/planner-leave-layer.store.spec.ts"`
Expected: PASS (behaviour unchanged).

- [ ] **Step 2: Use `clock.poll`.** Replace the class fields and the two methods:

```ts
  private readonly clock = inject(ClockService);
  private stopPoll: (() => void) | null = null;
  private readonly onFocus = () => void this.reload();
```

```ts
  startAutoRefresh(): void {
    if (this.stopPoll) return;
    this.document.defaultView?.addEventListener('focus', this.onFocus);
    // Every minute while visible, and once when the tab is visible again.
    this.stopPoll = this.clock.poll(() => void this.reload(), REFRESH_MS);
  }

  stopAutoRefresh(): void {
    this.document.defaultView?.removeEventListener('focus', this.onFocus);
    this.stopPoll?.();
    this.stopPoll = null;
  }
```

Delete the `timer` and `onVisible` fields. Add `import { ClockService } from '../../../core/clock/clock.service';`.

- [ ] **Step 3: Run the spec**

Run: `npx ng test --watch=false --include "src/app/modules/calendar/state/planner-leave-layer.store.spec.ts"`
Expected: PASS. The "re-reads on visibilitychange to visible" test now goes through the service's listener. The "hidden" test passes because the service skips a tick while hidden.

- [ ] **Step 4: Commit**

```powershell
git add src/app/modules/calendar/state
git commit -m "refactor(calendar): planner leave layer polls through ClockService"
```

---

### Task 7: Attendance detail drawer poll

**Files:**
- Modify: `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.ts:120-134`
- Test: `src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/attendance-detail-drawer.component.spec.ts`

- [ ] **Step 1: Write the failing test.** Add it inside `describe('AttendanceDetailDrawerComponent', ...)`. The spec's `async setup()` already selects `employee-1` / `2026-08-27` and stubs `refreshDayDetail`. Fake only the interval functions, so `await fixture.whenStable()` inside `setup()` still resolves.

```ts
  it('stops refreshing the open day while the tab is hidden and refreshes once when it is back', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const { store } = await setup();

      vi.advanceTimersByTime(15_000);
      expect(store.refreshDayDetail).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(60_000);
      expect(store.refreshDayDetail).toHaveBeenCalledTimes(1);

      Reflect.deleteProperty(document, 'visibilityState');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(store.refreshDayDetail).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx ng test --watch=false --include "src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer/**/*.spec.ts"`
Expected: FAIL on the hidden assertion: `refreshDayDetail` is called 5 times, not 1.

- [ ] **Step 3: Implement.** Add `private readonly clock = inject(ClockService);` and replace the `window.setInterval` block inside the effect with:

```ts
      onCleanup(this.clock.poll(() => void this.store.refreshDayDetail(selected.employeeId, selected.workDate), 15_000));
```

Add `import { ClockService } from '../../../../../core/clock/clock.service';`.

- [ ] **Step 4: Run it to check it passes**

Run: the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/modules/attendance/feature/time-tracking/attendance-detail-drawer
git commit -m "fix(attendance): detail drawer stops refreshing while the tab is hidden"
```

---

### Task 8: Realtime `notificationsChanged` stream

**Files:**
- Modify: `src/app/core/realtime/inbox-realtime.models.ts`
- Modify: `src/app/core/realtime/inbox-realtime.service.ts:60-78,100-110`
- Test: `src/app/core/realtime/inbox-realtime.service.spec.ts`

- [ ] **Step 1: Write the failing test.** The spec builds the service with the `fakeFactory` connection, which records each handler in `hub.handlers`. Add it next to "re-emits hub events on the matching streams":

```ts
  it('re-emits notificationsChanged so the bell can refresh its count', async () => {
    await connect();
    const changed = vi.fn();
    service.notificationsChanged$.subscribe(changed);

    hub.handlers.get('notificationsChanged')!({});

    expect(changed).toHaveBeenCalledWith({});
  });
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx ng test --watch=false --include "src/app/core/realtime/**/*.spec.ts"`
Expected: FAIL, because `notificationsChanged$` is undefined.

- [ ] **Step 3: Implement.** In `inbox-realtime.models.ts`, add:

```ts
/** The signed-in user's notifications changed (new, read or removed): refresh the bell's unread count. */
export type NotificationsChangedEvent = Record<string, never>;
```

In the service, next to the other subjects and streams:

```ts
  private readonly notificationsChanged = new Subject<NotificationsChangedEvent>();
  readonly notificationsChanged$: Observable<NotificationsChangedEvent> = this.notificationsChanged.asObservable();
```

and next to the other `connection.on(...)` lines in `start()`:

```ts
    connection.on('notificationsChanged', (event: NotificationsChangedEvent) => this.notificationsChanged.next(event));
```

Import `NotificationsChangedEvent` with the other model types.

- [ ] **Step 4: Run it to check it passes.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/core/realtime
git commit -m "feat(realtime): notificationsChanged stream from InboxHub"
```

---

### Task 9: Notification bell: visibility-aware poll and push refresh

**Files:**
- Modify: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts:103-130`
- Test: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts`

- [ ] **Step 1: Give the existing tests a realtime stub.** At the top of the spec's `describe`, add:

```ts
  const realtime = {
    notificationsChanged$: new Subject<Record<string, never>>(),
    reconnected$: new Subject<void>(),
    connected: signal(true),
  };
```

Add `{ provide: InboxRealtimeService, useValue: realtime }` to each existing `providers` list. Import `Subject` from `rxjs`, `signal` from `@angular/core` and `InboxRealtimeService` from `'../../../../core/realtime/inbox-realtime.service'`.

- [ ] **Step 2: Write the failing tests.** Add a `setupBell()` helper with the same store stub and providers as the existing "toggles dropdown" test, plus the realtime stub. Then add the tests:

```ts
  function setupBell() {
    const storeStub = {
      unreadCount: () => 0,
      items: () => [],
      refreshUnreadCount: vi.fn().mockResolvedValue(undefined),
      loadMine: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      markAllRead: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        { provide: NotificationsStore, useValue: storeStub },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: TaskApiService, useValue: { getNotificationNavigation: vi.fn() } },
        { provide: AuthStore, useValue: { authenticated: () => true, activeModules: () => [] } },
        { provide: InboxRealtimeService, useValue: realtime },
      ],
    });
    const fixture = TestBed.createComponent(NotificationBellComponent);
    fixture.detectChanges();
    return { fixture, storeStub };
  }

  it('does not poll the unread count while the tab is hidden, and refreshes once when it is back', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      const { storeStub } = setupBell();
      const calls = () => storeStub.refreshUnreadCount.mock.calls.length;
      const atStart = calls();

      vi.advanceTimersByTime(60_000);
      expect(calls()).toBe(atStart + 1);

      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5 * 60_000);
      expect(calls()).toBe(atStart + 1);

      Reflect.deleteProperty(document, 'visibilityState');
      document.dispatchEvent(new Event('visibilitychange'));
      expect(calls()).toBe(atStart + 2);
    } finally {
      vi.useRealTimers();
      Reflect.deleteProperty(document, 'visibilityState');
    }
  });

  it('refreshes the unread count as soon as the hub says notifications changed, and after a reconnect', () => {
    const { storeStub } = setupBell();
    const before = storeStub.refreshUnreadCount.mock.calls.length;
    realtime.notificationsChanged$.next({});
    realtime.reconnected$.next();
    expect(storeStub.refreshUnreadCount.mock.calls.length).toBe(before + 2);
  });
```

Polling starts under these providers: the existing "toggles dropdown" test already sees `refreshUnreadCount` called at start, so `tenantWorkspaceReady(...)` is true with the real `PermissionService` and `TrayPresenceStore`.

- [ ] **Step 3: Run them to check they fail**

Run: `npx ng test --watch=false --include "src/app/layouts/main-layout/top-navbar/notification-bell/**/*.spec.ts"`
Expected: FAIL. The hidden test sees 5 more polls, and the push test sees no refresh.

- [ ] **Step 4: Implement.** In the component:

```ts
  private readonly clock = inject(ClockService);
  private readonly realtime = inject(InboxRealtimeService);
  private stopPoll: (() => void) | null = null;
```

(remove `pollId`), then in the constructor, after the existing effect:

```ts
    // A pushed change or a reconnect (events may have been missed) refreshes the badge at once.
    merge(this.realtime.notificationsChanged$, this.realtime.reconnected$)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (this.stopPoll) void this.store.refreshUnreadCount();
      });
```

and replace the two methods:

```ts
  private startPolling(): void {
    if (this.stopPoll) return;
    void this.store.refreshUnreadCount();
    // Every minute while the tab is visible, and once when it is visible again. Task 11 slows this down to a
    // fallback once the backend pushes notificationsChanged.
    this.stopPoll = this.clock.poll(() => void this.store.refreshUnreadCount(), 60_000);
  }

  private stopPolling(): void {
    this.stopPoll?.();
    this.stopPoll = null;
  }
```

Imports: `merge` from `rxjs`, `takeUntilDestroyed` from `@angular/core/rxjs-interop`, `ClockService` from `'../../../../core/clock/clock.service'`, `InboxRealtimeService` from `'../../../../core/realtime/inbox-realtime.service'`.

- [ ] **Step 5: Run them to check they pass.** Same command. Expected: PASS, all tests in the file.

- [ ] **Step 6: Commit**

```powershell
git add src/app/layouts/main-layout/top-navbar/notification-bell
git commit -m "fix(notifications): bell stops polling while hidden and refreshes on hub push"
```

---

### Task 10: Done checks, docs and full gate

**Files:**
- Modify: `docs/core/ARCHITECTURE.md` (the state/services rules section)
- Modify: `docs/Improvements/person-4-api-layer-and-cleanup/task-16 One shared clock and smarter polling.md`
- Modify: `docs/superpowers/plans/SUMMARY.md`

- [ ] **Step 1: `setInterval` check**

Run: `git grep -n "setInterval(" -- "src/app/**/*.ts" ":!**/*.spec.ts"`
Expected: exactly 4 lines. Two are in `core/clock/clock.service.ts` (the rate timer and the poll timer). The other two are in `landing-feature-tabs.component.ts` and `wellbeing-carousel-card.component.ts`. Anything else is a missed site: convert it with the matching task's pattern.

- [ ] **Step 2: No leftover tick constants or manual clocks**

Run: `git grep -n -E "CLOCK_TICK_MS|NOW_TICK_MS|tickTimer|clockTimer|clockId|tickId|pollId" -- "src/app/**/*.ts"`
Expected: no output.

- [ ] **Step 3: Architecture rule.** Add this under the services/state rules in `docs/core/ARCHITECTURE.md`:

```markdown
- **Time and polling.** Read the current time through `injectNow('second' | 'minute')` from `core/clock/clock.service.ts`. Do not start your own `setInterval` for a "now" signal. Repeating server reads go through `ClockService.poll(callback, ms)`, which pauses while the tab is hidden and calls once when it is visible again. A `setInterval` outside `core/clock` is only for a real animation (a carousel, an auto-advancing tab), and it must be cleared on destroy.
```

- [ ] **Step 4: Full gate**

```powershell
npm run check:warnings
npx ng lint
npx ng test --watch=false
```

Expected:
- `check:warnings`: clean.
- `ng lint`: only the errors already on Development (7 a11y errors in `calendar-page.component.html` / `planner-create-popover.component.ts`). None in files this branch changed.
- `ng test`: only the failures already on Development (4 en-GB date tests and the flaky `main-layout` timeout). Run the leak check from "Before you start" for `src/app/core/clock/**`, `src/app/modules/dashboard/**` and `src/app/modules/organization/feature/position-management/**` in one worker. Expected: 0 failures.

- [ ] **Step 5: Manual check in the browser** (dev server, signed in, dashboard with team cards)
- DevTools → Performance → record 10 s on the dashboard. You should see one 1-minute timer and no 1 s or 30 s timers, unless a task clock is on screen.
- Hide the tab for 5 minutes (switch tabs). In the Network panel, nothing is sent to `/notifications/unread-count`, `/leave-requests` or attendance day detail while hidden. One refresh goes out when you come back. The tray presence status call still runs unless the open question above was decided for pausing it.
- The greeting, the today-at-a-glance now label and the team schedule now line move on the minute.

- [ ] **Step 6: Status docs.** In the task file, add a `## Status (2026-11-xx)` section. List what was done (Tasks 1–10), the `setInterval` result, and "Notification push: frontend listens for `notificationsChanged`; waiting for the backend event (Task 11)". Add a row to `docs/superpowers/plans/SUMMARY.md`:

```markdown
| One Shared Clock and Smarter Polling (Improvements task 16) | in progress (backend event pending) | `next/2026-11-20-shared-clock-and-polling.md` | 2026-11-20 |
```

- [ ] **Step 7: Commit**

```powershell
git add docs/core/ARCHITECTURE.md "docs/Improvements/person-4-api-layer-and-cleanup/task-16 One shared clock and smarter polling.md" docs/superpowers/plans/SUMMARY.md
git commit -m "docs: shared clock rule and task 16 status"
```

---

### Task 11: Slow fallback poll once the backend pushes `notificationsChanged` (after the backend PR merges)

**Precondition:** the backend sends `notificationsChanged` to `InboxHub.UserGroup(tenantId, recipientUserId)` when a notification is created or read. Check it by hand: with the bell open in one tab, create a notification for that user (for example, assign them a task). The badge changes within a second, without waiting for the minute poll.

**Files:**
- Modify: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.ts`
- Test: `src/app/layouts/main-layout/top-navbar/notification-bell/notification-bell.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
  it('polls every 5 minutes while the hub is connected and every minute while it is down', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    try {
      realtime.connected.set(true);
      const { fixture, storeStub } = setupBell();
      const calls = () => storeStub.refreshUnreadCount.mock.calls.length;
      const atStart = calls();

      vi.advanceTimersByTime(4 * 60_000);
      expect(calls()).toBe(atStart);
      vi.advanceTimersByTime(60_000);
      expect(calls()).toBe(atStart + 1);

      // The connection drops: the poll restarts at the fast rate with one refresh straight away.
      realtime.connected.set(false);
      fixture.detectChanges();
      expect(calls()).toBe(atStart + 2);
      vi.advanceTimersByTime(60_000);
      expect(calls()).toBe(atStart + 3);
    } finally {
      vi.useRealTimers();
      realtime.connected.set(true);
    }
  });
```

- [ ] **Step 2: Run it to check it fails** (the poll is still 60 s while connected).

Run: `npx ng test --watch=false --include "src/app/layouts/main-layout/top-navbar/notification-bell/**/*.spec.ts"`

- [ ] **Step 3: Implement.** Add constants and restart the poll when the connection state changes:

```ts
const POLL_WHEN_PUSHED_MS = 5 * 60_000;
const POLL_WHEN_DOWN_MS = 60_000;
```

In the constructor, replace the first effect's body with:

```ts
    effect(() => {
      const unlocked = tenantWorkspaceReady(this.authStore, this.permissionService, this.trayPresence);
      const period = this.realtime.connected() ? POLL_WHEN_PUSHED_MS : POLL_WHEN_DOWN_MS;
      untracked(() => {
        this.stopPolling();
        if (unlocked) this.startPolling(period);
      });
    });
```

Then change `startPolling` to take the period:

```ts
  private startPolling(periodMs: number): void {
    void this.store.refreshUnreadCount();
    this.stopPoll = this.clock.poll(() => void this.store.refreshUnreadCount(), periodMs);
  }
```

Remove the comment that points to Task 11.

- [ ] **Step 4: Run it to check it passes.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/app/layouts/main-layout/top-navbar/notification-bell
git commit -m "feat(notifications): poll the unread count only as a fallback while the hub is down"
```

Update the task file status to "done" and the SUMMARY row to `finished`.

---

## Self-review notes (for the reviewer)

- **Spec coverage.** Clock service: Task 1. Per-component timers replaced: Tasks 2–5. Minute signal for minute-only views: the rates in the Scope table. Notification pushed through realtime with a slow fallback poll: Tasks 8, 9 and 11, plus the backend dependency. Remaining polls stop while hidden and refresh on visible: Tasks 6, 7 and 9. No timer survives its component: Task 1 tests, the `DestroyRef` release in `injectNow`, and the Task 10 grep checks. "Done when" checks: Task 10 Steps 1, 4 and 5, and the Task 11 precondition.
- **Not covered without a decision.** The tray presence poll keeps running while the tab is hidden until its owner decides (see "Open question").
- **Behaviour changes, on purpose.** 30-second clocks (calendar now line, team status minutes, conversation edit window, popout "N min ago") now move every 60 seconds. The team schedule dialog's now line also ticks while the dialog is closed, if another minute reader is alive. That costs nothing extra because the timer is shared.
- **Known risk.** `ClockService` is a root singleton. Under the non-isolated runner, a spec that creates a reader with real timers and never destroys it would keep a real interval alive. Angular's TestBed teardown destroys the root injector after each test, and the service's own `DestroyRef` hook clears every timer, which Task 1's last test covers.
