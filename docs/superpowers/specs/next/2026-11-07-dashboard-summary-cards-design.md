# Dashboard summary cards (2-row widgets) — design

Date: 2026-11-07. Approved by the user from the live mockup
(https://claude.ai/artifact/3WVQ6qmS74pmgFKy7BT661, private).

## Why

At 2 rows tall, a wide My Team widget today swaps its donut for a long stacked bar. That wastes the
width and repeats what the donut already says. The user wants the donut kept, its colour key beside
it, and the rest of the width filled with **summary cards**. Each card summarises one section of
that widget's popup (detail dialog), so a manager sees what the popup holds without opening it.
The cards must look and move better than plain KPI tiles (reference: the user's "HRMS Dashboard"
KPI-card image: tinted card, icon badge, big figure, delta line, small chart).

## Goals

- One rule for every dashboard widget at 2 rows:
  - narrow (2×2, 2×3): donut only (140px mini donut, unchanged);
  - medium (about 2×4, 2×5): donut + colour key (`app-donut-key`, list variant);
  - wide (about 2×6 and up): donut + colour key + as many summary cards as fit (max 4).
    Spare width is shared by the cards (they stretch); never empty space.
- One shared, reusable summary-card component; widgets only build data models for it.
- First pass covers 4 widgets: Team attendance, Team progress, Today's team schedule,
  Work vs task hours.
- Cards animate in: stagger rise + fade, number count-up, bars grow one by one, sparkline draws,
  meters fill. Respect `prefers-reduced-motion`.
- Clicking a card opens that widget's popup scrolled to the matching section.

## Non-goals

- No change to views taller than 2 rows (they keep tiles / trend / ranking as today).
- No change to the popups' contents, except an optional "scroll to section" input.
- Other widgets (My Work etc.) get cards later, using the same component.

## Anti-goals

- A card that scrolls or clips text (the "a card never scrolls" rule holds).
- Numbers on a card that differ from the popup: a card must read the same query/endpoint as the
  popup section it summarises.
- The old wide stacked bar staying anywhere at 2 rows.

## Layout rule (measured on the widget host, hysteresis 20px)

Body width = host width − card chrome (32px). Donut 140, gap 14.
- Key fits when body ≥ 140 + 14 + KEY_MIN (220) → about 2×4 at 1440px wide.
- Cards: n = floor((body − donut − key − gaps) / (CARD_MIN 240 + 14)), clamped 0..4.
- Card height = the mini body height (about 150px). Cards share leftover width equally.
Constants live in one shared util (`summary-strip-layout.util.ts`) with spec tests.

## Card kinds (one component, typed model union)

Header: tinted icon badge + title. Tone colour drives the tint (bg tone 6%, border tone 22%, icon
badge tone 18%). Body kinds:
- `spark` — big figure, delta line, area sparkline.
- `bars` — big figure, delta line, 7 small bars (last bar solid).
- `pair` — figure, delta line, pairs of bars per day (planned/actual, worked/task).
- `meter` — figure, delta line, progress meter with "x / y" caption.
- `hbars` — headline + up to 3 labelled horizontal bars with %.
- `rank` — optional count + up to 3 ranked rows (rank pill, avatar initials/photo, name, status chips).
  Rankings put whoever needs attention first.
- `people` — count + up to 3 people with a chip (e.g. "Back Mon").
- `chips` — count, thin segmented bar, status chips with counts.
Delta: green up / red down, from the data's own sense ("better" not "bigger").

## The 4 widgets (card order = priority; narrower widgets show the first n)

**Team attendance** (data: attendance-summary + employees endpoint)
1. Attendance rate — `spark`: periodRate, deltaPp vs previous period, trend rates.
2. By department — `hbars`: overall periodRate + top 3 `departmentRates` (lowest-rate rows amber).
3. Needs attention — `rank`: employees with the most late + absent + leave days in the period,
   chips "3 late", "1 absent", "2 leave". **Needs a new backend sort `attention`** on
   the team attendance employees query.
4. On leave today — `people`: `todayPreview` rows with bucket `leave` (count = todayCounts.onLeave).
   Return date is not in the API: show the department instead (decided by Claude; can add later).

**Team progress** (data: led-progress + weekly-completion + led employees)
1. Weekly completion — `bars`: completed hours this week vs last, last 7 buckets.
2. Projects — `hbars`: project count + top 3 projects by completed share of allocation.
3. Overdue tasks — `rank`: overdueTotal + top 3 `overdueTasks` by daysOverdue ("5 d late").
4. Falling behind — `rank`: members with the lowest completed ÷ total hours. **Needs a new backend
   employee sort `completionRate`** (asc; people with no hours last).

**Today's team schedule** (data: team day + team week, already loaded by the card)
1. Coverage — `meter`: week totals coveragePercent, scheduled / planned hours, delta vs previous.
2. Planned vs actual — `pair`: week `days` planned vs clocked.
3. Needs a plan — `rank`: members not planned (notRankedReason `no_planned_task_time`) first,
   then over capacity (planned > expectedMinutes, highest load first).
4. Right now — `chips`: counts by presenceStatus (working, in meeting, on break, on leave,
   not planned).

**Work vs task hours** (data: work-vs-task response, already loaded)
1. Task share of work — `spark`: totals.utilization, delta pp vs previous, trend utilization.
2. Work vs task by day — `pair`: trend worked vs task minutes.
3. Biggest gap — `rank`: employees by worked − task minutes, largest first ("+11 h").
4. Tasks completed — `bars`: completedTasks, delta vs previous, trend completedTasks.

## Data loading

A card's extra request (rankings) loads only while that card is shown, the way the ranking panel
does today, keyed on period + filters + calculatedAt. Loading = skeleton bars in the card; error =
one-line "Couldn't load" with Try again (no scroll).

## Builder's calls (made by Claude, check while reading)

- Return date for leave members is not available; the card shows department.
- "Needs attention" weights late, absent and leave days equally (sum), ties by name.
- "Falling behind" uses completed ÷ total estimated hours.
- Card min width 240px, key min width 220px.
- Icons are added to the shared hand-authored `app-icon` set (no new dependency).
- Work happens on the current branches (FE `feature/boardui-dashboard-restyle`, which carries the
  uncommitted rounded-donut work the cards sit beside; BE `feature/led-weekly-completion-period`).
  Nothing is committed or pushed without the user asking.
