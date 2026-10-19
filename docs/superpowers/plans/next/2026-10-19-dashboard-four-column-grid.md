# Dashboard — 4-column grid with Small / Large cards

Status: implemented 2026-10-19 on `feature/my-team-dashboard` — 312/312 dashboard tests, `check:warnings` clean, checked in the browser by the user (all 6 cards fit one screen).

## Goal

Replace the home dashboard's 3 stacked columns with one 4-column, row-major grid. Every grid card
has one of two sizes: **Small = 1 column**, **Large = 2 columns** (2 Small = 1 Large). The viewer can
switch a card between Small and Large in Customize; the choice is saved with the layout.

Default (xl, 4 columns):

| Row | Cards |
|---|---|
| 1 | Good morning (S) · Action Center (L) · Quick Actions (S) |
| 2 | Today's Schedule (L) · Total time today (S) · Active projects (S) |
| 3 | My Tasks (L) · … |
| bottom band | Work Pattern (full width) |

Viewers without Action Center get Good morning (S) + Quick Actions (S) then Schedule (L) — still 4.
md = 2 columns (Large spans both), mobile = 1 column.

## Tasks

1. **Layout model v2** (`utils/dashboard-layout.util.ts`) — `{ version: 2, top, grid, bottom, hidden, sizes }`.
   Zones become `top | grid | bottom`. `DASHBOARD_CARD_META.width` → `defaultSize: 'small' | 'large'`.
   `sanitize` validates sizes; v1 saved layouts fall back to the default (column-major order has no
   meaningful row-major mapping). New `setDashboardCardSize`. Missing cards still re-homed at default index.
   No `grid-auto-flow: dense` — DOM order must equal visual order for drag and ↑/↓.
2. **Size component** (`ui/dashboard-grid-item/`) — `<app-dashboard-grid-item [size]>` sets the column
   span (`small` = 1, `large` = `md:col-span-2`) and is a `@container`, so card internals adapt to their
   own width instead of the viewport.
3. **New cards** — `today-total-time-card` (S; `TimeTrackingStore.today.totalWorkedMinutes`, calls
   `loadToday()` itself so it works with Good morning hidden) and `active-projects-card` (S;
   `ProjectApiService.listMine(1, 100)` filtered to `isActive && !isAchieved` — the endpoint has no
   status filter, so the count is capped at the first 100 projects).
4. **Home + Customize** — live grid; edit mode is one `cdkDropList` with `cdkDropListOrientation="mixed"`
   laid out as the same 4-column grid, tiles sized S/L with an S/L toggle on each grid tile.
5. **Cards at Small** — Good morning stacks its two stat boxes and Quick Actions wraps when narrow
   (container queries).
6. **Specs + verify** — update util/service/home specs, add new card specs, check in the preview.

Out of scope: Work Pattern "NaNh NaNm" (Productive, Admin/Other) — separate fix.

## Added during review (2026-10-19)

- Row height on wide screens is measured, not derived from 100vh: `DashboardHomeComponent` observes
  `.main-content__viewport` and sets `--dashboard-viewport-h`; each grid row is half of it, so the
  first two rows fill the screen. Cards stretch to the row and scroll inside (`dashboard-grid-item`).
- Today's Schedule: timeline list with Completed / In Progress / Upcoming chips.
- Total time (today): segmented half-circle gauge + 2x2 tiles, from the same breaks + activity
  timeline data as the Good morning bar (`timelineMinutes` in `timeline-segments.util.ts`); the
  work-pattern feed returned nothing for today, so it is not used here.
- Active projects: letter tiles, completed / allocated hours (task counts aren't in the list DTO).
- Quick Actions: + Create Ticket (→ Inbox), Create Task (project picker, then Work's task form as a
  popup via a CDK overlay on `<body>`), Settings; Create Task / Settings follow the sidebar's access rules.
