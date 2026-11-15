# Task 16: One shared clock and smarter polling

| | |
|---|---|
| Priority | 16 of 24 (lower number = build first) |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | Performance |
| Depends on | nothing |

## What we found

About 18 components start their own `setInterval` only to update a "now" signal: task clock widget and task history feed (every second), inbox revert banner (every second), conversation panel, calendar hour grid (30 seconds), task board, time-off hub, and several dashboard cards (greeting, today at a glance, team status, team schedule, action centre). A dashboard with several of these runs many timers, each waking change detection.

Polling: the notification bell asks for the unread count every 60 seconds (`notification-bell.component.ts:122`) and `planner-leave-layer.store.ts` polls too. The bell polls even when the tab is hidden. A realtime connection (`InboxHub`) already exists.

## What to do

1. Create one `ClockService` in `core` with shared signals: `nowEverySecond`, `nowEveryMinute`. It runs one timer per rate, only while something reads it, and pauses when the tab is hidden.
2. Replace the per-component timers with it.
3. Components that only show minutes must use the minute signal.
4. For the notification count: push it through the existing realtime connection and keep a slow poll only as a fallback when the connection is down.
5. Every remaining poll must stop when the tab is hidden and refresh once when it becomes visible again.
6. Check no timer survives its component (the `takeUntilDestroyed` and `clearInterval` paths).

## Done when

- A search for `setInterval(` in `src/app` finds only the clock service and real animations.
- With the tab hidden for 5 minutes the network tab shows no polling.
- The notification count updates within a second of a new notification.
