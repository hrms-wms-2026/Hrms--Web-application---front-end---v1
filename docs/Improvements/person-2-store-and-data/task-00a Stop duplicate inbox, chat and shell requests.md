# Task 00a: Stop duplicate inbox, chat and shell requests

| | |
|---|---|
| Priority | Urgent. Do before task 01. Added 2026-11-15 after measuring |
| Owner folder | person-2-store-and-data |
| Size | 1 person, 1 day |
| Area | Performance, Store |
| Depends on | backend 00a and 00b for the paged chat list. Steps 1 to 4 need no backend change |

## What we found

Measured on 2026-11-15 with a Playwright window on the dapi tenant. The full numbers are in the backend repository: `docs/reports/performance/2026-11-15-api-response-timings.md`.

- The Inbox screen calls `GET /inbox/chats` twice and `GET /inbox/counts` twice during one load. Each of those calls costs 3 to 6 seconds today, so the screen needed 13 seconds before the network went quiet.
- The app shell calls `GET /inbox/counts` on every page load. It is the slowest call on nine of the ten screens measured (3.6 to 6.3 seconds).
- Calendar and Planner each call `planner/me/focus` and `planner/me/range` twice. Work calls `work/project-categories` twice. `monitoring/activation/status` is called twice on every load.
- `employees/{id}/identity` is called once per person shown: three or four separate requests per screen.
- Every full page load starts with about ten shell calls before any screen data. Two of them, `work/task-drafts` and `onboarding/drafts`, return an empty list and take 240 to 260 ms each.
- Attendance asks for `time-tracking/history-detail` for today and gets a 404.
- The chat list response is 183 KB with all 274 chats, and the list renders all of them.

The measurement used full page loads. Check with the network tab whether the shell calls also repeat on in-app navigation; if they do, that is part of this task.

## What to do

1. Find why the Inbox screen loads chats and counts twice. Likely two components or an effect that fires again when a signal settles. Make one store own each request and return the in-flight request to a second caller.
2. Do the same for the planner, project categories and activation status duplicates.
3. Inbox counts in the shell: load it after the screen's own data, not together with it. Refresh it from the realtime `InboxHub` event, not on each navigation.
4. Load the two draft lists only when the user opens the drafts menu, or after the first paint.
5. Person identities: collect the ids needed on a screen and ask once. Ask the backend for a batch identity endpoint if none exists, and cache results for the session.
6. When backend task 00b is ready: load the chat list one page at a time (30 rows), load more on scroll, and move search and the type filter to query parameters.
7. Fix or guard the attendance `history-detail` call so no 404 is requested for a day with no record.

## Done when

- Opening the Inbox makes one chats request and one counts request.
- No screen in the measured list sends the same GET twice during one load.
- The first data request of a screen is not queued behind inbox counts.
- The per-screen request counts before and after are added to the timing report.
