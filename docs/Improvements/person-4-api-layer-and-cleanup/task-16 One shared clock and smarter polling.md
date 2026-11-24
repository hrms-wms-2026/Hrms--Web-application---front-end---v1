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

## Status (2026-11-23)

In progress: frontend done, waiting for the backend event. Branch `chore/shared-clock`, plan `docs/superpowers/plans/next/2026-11-20-shared-clock-and-polling.md`.

- Plan Tasks 1–10 done: one `ClockService` (`core/clock`) with a second and a minute clock, one timer per rate only while something reads it, nothing while the tab is hidden. The minute clock turns over on the wall-clock minute.
- Every "now" reader moved to `injectNow()`: task clock, task history, revert banner, greeting, today at a glance, calendar grid, conversation panel, popout header, time-off hub, task board, and the dashboard team cards.
- Polls moved to `ClockService.poll()`, so they stop while the tab is hidden and refresh once when it is back: planner leave layer, attendance detail drawer, notification bell.
- `setInterval(` search in `src/app` (not specs): only `core/clock/clock.service.ts` and the two real animations (`wellbeing-carousel-card`, `landing-feature-tabs`).
- Notification push: the frontend listens for `notificationsChanged` on `InboxHub` and refreshes the bell straight away (also after a reconnect). Waiting for the backend to send that event. Plan Task 11 then slows the bell's poll to a fallback.
- Browser check (plan Task 10 step 5) done on 2026-11-24 in Chrome, dapi tenant, home and My Team dashboards, local API:
  - `ClockService` showed 8 minute readers, no second readers, one minute timer, no second timer and one 60 s poll (the bell). No other `setInterval` started over 10 s, or when moving to My Team with its five team cards.
  - The today at a glance now label moved from 11:46 to 11:47 on the wall-clock minute.
  - Hidden for 5 minutes (simulated with `visibilityState` = hidden plus a `visibilitychange` event, because the browser tool could not switch Chrome tabs): both clock timers and the bell poll stopped. No call went to `/notifications/unread-count`, `/leave-requests` or attendance day detail. Only the tray presence status call (`/monitoring/activation/status`, every 5 s while the tray is not connected) kept running, which is the open question in the plan.
  - Back to visible: one `/notifications/unread-count` and one refresh of each visible card, then the minute timer and bell poll restarted.
  - No console errors.
  - Not checked: the bell refreshing on a hub push, because the backend does not send `notificationsChanged` yet.
