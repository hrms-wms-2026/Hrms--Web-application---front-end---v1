# Monochrome Dashboard Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolour every dashboard widget, popup and shared chart to shades of the theme colour, with maroon for anything that was red.

**Architecture:** One set of `--color-widget-*` tokens in `theme-tokens.css` (light + dark), derived from
`--color-accent`. One TS module `widget-palette.ts` exports the token strings plus a stable shade picker for data
colours. Each widget's colour map, summary-card tone map and CSS switch to those tokens. A guard spec fails if any
dashboard colour map still holds a non-widget colour.

**Tech Stack:** Angular 20 (standalone, signals), Vitest via `@angular/build:unit-test`, plain CSS with `color-mix`.

**Spec:** `docs/superpowers/specs/2026-11-12-monochrome-dashboard-widgets-design.md`
(mockup: https://claude.ai/artifact/NaVXz789TejaWFbcDUonnW). Read the spec first.

## Global Constraints

- Light token values, verbatim from the spec:
  - `--color-widget-shade-1: color-mix(in srgb, var(--color-accent) 48%, #3a4656)`
  - `--color-widget-shade-2: color-mix(in srgb, var(--color-accent) 50%, #7387a0)`
  - `--color-widget-shade-3: color-mix(in srgb, var(--color-accent) 30%, #a7b5c6)`
  - `--color-widget-shade-4: color-mix(in srgb, var(--color-accent) 12%, #ccd4de)`
  - `--color-widget-track: color-mix(in srgb, var(--color-accent) 6%, #e1e6ec)`
  - `--color-widget-maroon: #8a1c2c`, `--color-widget-maroon-soft: #f4e3e6`
  - `--color-widget-mild: color-mix(in srgb, var(--color-accent) 11%, #ffffff)`
  - `--color-widget-mild-line: color-mix(in srgb, var(--color-accent) 26%, #ffffff)`
- Shade order: the main or done category gets shade 1, and the neutral or "nothing yet" category gets shade 4. Old
  amber goes to shade 3. Anything red goes to maroon.
- Exactly three chip styles. Bad: maroon-soft background with maroon text, and the filled ⚠ chip is solid maroon
  with white text. Main or positive: solid shade 1 with `--color-text-on-solid`. Every other soft `--tone` chip:
  mild background, mild-line border and shade-1 text.
- KPI tiles, summary cards and explanation notes use mild background, mild-line border, shade-1 value and secondary
  text label. A "bad" tile keeps the mild card and shows its value in maroon.
- Backgrounds (`--color-dashboard-team-*`), buttons, links, the app shell, layouts, sizes and motion do not change.
- Data colours (`project.color`, avatar hues) inside dashboard widgets use `widgetShadeFor(id)`. Stored data stays
  as it is.
- `shared/ui/kpi-tiles` changes only behind an opt-in input. Leave and People pages must render exactly as before.
- Zero warnings: `npm run check:warnings` and `npm run lint` (ESLint plus `check-hardcoded-colors.mjs`) must be clean.
  Lower counts in `scripts/hardcoded-colors-baseline.json` by hand when hex values go away. Never run `--update`.
- `styleUrl` only. Never a shared imported styles constant (it makes the build hang).
- Only touch `src/app/modules/dashboard/**`, `src/app/shared/styles/theme-tokens.css`,
  `src/app/shared/ui/kpi-tiles/**`, `scripts/hardcoded-colors-baseline.json` and `docs/design/WIDGET_CREATION_RULES.md`.

## Review Focus

- **Theme switch at runtime:** changing the preset while on the dashboard must recolour every chart with no reload.
  This only works if colours stay `var()` strings and are never resolved to hex in TS. Pinned by the guard spec in
  Task 2 (values must be `var(--color-widget-…)`).
- **SVG donut arcs:** `[attr.stroke]="var(...)"` renders black or none. Pinned in Task 3 by a spec that checks the
  arc's `style.stroke`.
- **Dark mode contrast:** shade 4 and track must still be visible on the dark widget background, and maroon text
  must pass 4.5:1. Checked by hand in Task 1, step 4, and in the browser pass (Task 9).
- **More than four non-maroon categories** (Team Schedule, Today's schedule, Work pattern): neighbouring shades must
  differ clearly. Pinned in Task 2 by a spec that the ramp has distinct entries in lightness order.
- **Leave/People pages using kpi-tiles:** must look unchanged. Pinned in Task 3 by a spec that the default tone map
  is untouched when the opt-in is off.

---

### Task 1: Tokens

**Files:**
- Modify: `src/app/shared/styles/theme-tokens.css` (`:root` block near the dashboard-team tokens at lines 15–19; the
  dark blocks `:root[data-mode='dark']…` / `html.dark…` around line 329+)

- [ ] **Step 1:** In `:root`, add the nine light tokens from Global Constraints, plus `--color-widget-shade-2b:
  color-mix(in srgb, var(--color-accent) 40%, #8c9db2)` and `--color-widget-shade-3b: color-mix(in srgb,
  var(--color-accent) 20%, #bac5d2)`. These are the in-between steps for charts with five or six categories.
  Add a comment that says what each token is for.
- [ ] **Step 2:** Add dark-mode values in the generic dark block (the one every dark preset inherits from, not one
  per preset). Mix the accent with dark slates. Shade 1 is the most visible (around `color-mix(accent 70%, #dbe3ee)`)
  and shade 4 sits closest to the card (around `color-mix(accent 22%, #3b4656)`). Use maroon text about `#e07a8a`,
  maroon-soft about `#3a1a20`, mild `color-mix(accent 14%, <dark widget bg>)` and mild-line
  `color-mix(accent 30%, <dark widget bg>)`.
- [ ] **Step 3:** `npm run check:warnings`. Expected: no `[WARNING]` or `[ERROR]` lines.
- [ ] **Step 4:** In DevTools or a scratch page, check contrast for the default and emerald presets in light and
  dark: shade-1 text on mild ≥ 4.5:1, maroon on maroon-soft ≥ 4.5:1, shade-4 against widget bg ≥ 3:1 (chart mark).
  Adjust the dark values until they pass.
- [ ] **Step 5:** Commit `feat(dashboard): monochrome widget colour tokens`.

### Task 2: Palette module and guard spec

**Files:**
- Create: `src/app/modules/dashboard/utils/widget-palette.ts`, `widget-palette.spec.ts`
- Create: `src/app/modules/dashboard/utils/widget-colors.guard.spec.ts`
- Modify: `scripts/hardcoded-colors-baseline.json` only if needed

**Interfaces — Produces:**
```ts
export const WIDGET = {
  shade1: 'var(--color-widget-shade-1)', shade2: 'var(--color-widget-shade-2)',
  shade2b: 'var(--color-widget-shade-2b)', shade3: 'var(--color-widget-shade-3)',
  shade3b: 'var(--color-widget-shade-3b)', shade4: 'var(--color-widget-shade-4)',
  track: 'var(--color-widget-track)', maroon: 'var(--color-widget-maroon)',
  maroonSoft: 'var(--color-widget-maroon-soft)', mild: 'var(--color-widget-mild)',
  mildLine: 'var(--color-widget-mild-line)'
} as const;
/** Lightness order, darkest first: shade1, shade2, shade2b, shade3, shade3b, shade4. */
export const WIDGET_RAMP: readonly string[];
/** Picks `n` ramp entries spread evenly from shade1 to shade4 (n ≤ 6). n=4 → [1,2,3,4]. */
export function widgetRamp(n: number): string[];
/** Stable shade for a data item (project, person): FNV-1a hash of `key` mod WIDGET_RAMP.length. */
export function widgetShadeFor(key: string): string;
export function isWidgetColor(value: string): boolean; // true for any WIDGET value or 'transparent'
```

- [ ] **Step 1: Failing tests** in `widget-palette.spec.ts`:
  `widgetRamp(4)` equals `[WIDGET.shade1, WIDGET.shade2, WIDGET.shade3, WIDGET.shade4]`; `widgetRamp(6)` equals
  `WIDGET_RAMP`; `widgetRamp(2)` equals `[WIDGET.shade1, WIDGET.shade4]`; `widgetShadeFor('p-42')` returns the same
  value on two calls and is in `WIDGET_RAMP`; `isWidgetColor('#10b981')` is false;
  `isWidgetColor(WIDGET.maroon)` is true.
- [ ] **Step 2:** `npx ng test --include='**/widget-palette.spec.ts'`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement `widget-palette.ts`.
- [ ] **Step 4:** Run again. Expected: PASS.
- [ ] **Step 5: Guard spec** `widget-colors.guard.spec.ts`. Import every exported colour map in `utils/`
  (`TEAM_ATTENDANCE_COLORS`, the team-progress series list, `PRESENCE_COLORS`, the overtime-forecast status map,
  team-schedule, team-work-task, planned-actual and weekly-work-progress colour maps, and every
  `*-summary-cards.util.ts` TONE/CHIP map, exporting the private ones if needed). For each, assert every colour value
  satisfies `isWidgetColor`. Mark the cases for maps not migrated yet with `it.todo` and switch each to `it` in the
  task that migrates it. Tasks 4–8 must leave no `it.todo` behind.
- [ ] **Step 6:** Commit `feat(dashboard): widget palette helpers and colour guard spec`.

### Task 3: Shared charts, cards and kpi-tiles

**Files:**
- Modify: `ui/dashboard-donut/dashboard-donut.component.html` (lines 28–29: `[attr.fill]`/`[attr.stroke]` →
  `[style.fill]`/`[style.stroke]`), its spec
- Modify: `ui/dashboard-bar-chart/*.css`, `ui/team-progress-time/*.css`, `ui/team-progress-time-detail/*.css`,
  `ui/dashboard-summary-card/*.css`, `ui/working-hours-chart`, `ui/daily-work-chart`, `ui/weekly-completion-chart`,
  `ui/widget-frame` (only colour lines)
- Modify: `src/app/shared/ui/kpi-tiles/kpi-tiles.component.ts` and its spec

**Interfaces — Produces:** `KpiTilesComponent` input `palette = input<'default' | 'widget'>('default')`. With
`'widget'`, every tile is the mild card (`WIDGET.mild` / `WIDGET.mildLine`), the icon badge and value are shade 1,
and the `danger` tone puts the value in maroon. `DashboardSummaryCard` uses the mild card for all tones, with maroon
for the danger/bad tone.

- [ ] **Step 1: Failing tests:** the donut spec renders a slice with `color: WIDGET.shade2` and expects the arc
  `path.style.stroke` to be `'var(--color-widget-shade-2)'`. The kpi-tiles spec expects that, with the default
  palette, a `success` tile still uses `var(--color-success)` (unchanged), and with `palette="widget"` its background
  is `var(--color-widget-mild)`.
- [ ] **Step 2:** Run those two specs. Expected: FAIL.
- [ ] **Step 3:** Implement. In the shared `ui/` CSS, replace hex and `--color-cat-*`/`--color-tint-*`/status
  tokens: tracks and grid lines → `--color-widget-track`, series → shades, red/danger → maroon, chips → the three chip
  styles. Bar-chart `alert` frame → maroon.
- [ ] **Step 4:** Run the `ui/**` and `shared/ui/kpi-tiles` specs. Update only colour expectations. Expected: PASS.
- [ ] **Step 5:** Lower the baseline counts for the files touched. `npm run lint` must be clean.
- [ ] **Step 6:** Commit `feat(dashboard): monochrome shared charts, summary cards and kpi-tiles opt-in`.

### Tasks 4–8: Widgets, by family

Each task runs the same cycle. (1) Switch that family's guard-spec `it.todo` cases to `it` and watch them fail.
(2) Change the `utils/` colour maps to `WIDGET.*`. Use `widgetRamp(n)` where a family has more than four non-maroon
categories. (3) Change the card CSS, popup CSS and inline template colours (Tailwind `bg-emerald-500`, `text-red-…`
and similar, `var(--color-cat-*)`, `--color-tint-*`, `--color-danger*`, `--color-success*`, `--color-warning*`,
`--color-info`, raw hex) to widget tokens or `WIDGET.*` bindings. Set `palette="widget"` on every `<app-kpi-tiles>`
in the family. (4) Fix the colour expectations in that family's specs. (5) Run the family's specs, then `npm run
lint`, then lower the baseline counts. (6) Commit `feat(dashboard): monochrome <family>`.

Shade mapping comes from the mockup where it covers the widget, otherwise from the shade order rule.

- **Task 4: Team Progress + Weekly Work Progress.** `team-progress-card`, `team-progress-detail-dialog`,
  `weekly-progress-card`, `weekly-work-progress-detail-dialog`, `task-progress-card`; utils `team-progress-format`,
  `team-progress-summary-cards`, `weekly-work-progress-format`, `team-progress-time-format`. Mapping: completed →
  shade1, in progress → shade2, not started → shade3, not yet tracked/tasked → shade4. Weekly completion bars →
  shade1. "↑ +x%" → solid shade1 chip, "x% completed" pill → mild card style.
- **Task 5: Work vs task hours + Team Status.** `team-work-task-card`, `team-work-task-detail-dialog`,
  `team-status-card`, `team-status-detail-dialog`; utils `team-work-task-format`, `team-work-task-summary-cards`,
  `team-presence-format`, `planned-actual-format`; `ui/work-task-day-chart`, `planned-actual-*-chart`,
  `work-schedule-task-chart`. Mapping: worked → shade1, task → shade4. The task share in the donut → shade4 on shade2.
  Negative deltas and "Biggest gap" values → maroon chip. Presence: working → shade1, break → shade3, leave → shade2.
  The old leave red counts as "red", so leave → maroon only if it marks a problem. Leave is not a problem, so use
  shade2.
- **Task 6: Team Schedule + Today's Schedule + Team Plan Today.** `team-schedule-card`,
  `team-schedule-detail-dialog`, `todays-schedule-card`, `team-plan-today-card`; utils `team-schedule-format`,
  `team-schedule-summary-cards`, `util/timeline-segments`, `util/time-of-day`. Mapping: completed → shade1, in
  progress → shade2, meetings → shade3, pending → shade4. Use `widgetRamp(n)` for extra categories. Overdue or
  conflict → maroon.
- **Task 7: Overtime forecasts + Team Attendance.** `team-module-forecast-*`, `team-employee-forecast-*`,
  `team-attendance-card`, `team-attendance-detail-dialog`; utils `overtime-forecast-format`,
  `team-module-forecast-*`, `team-employee-forecast-*`, `team-attendance-format`, `team-attendance-summary-cards`;
  `ui/module-forecast-project-chart`, `employee-forecast-rate-chart`, `attendance-day-chart`. Mapping: on_track →
  shade1, raise_rate → shade3, overload → maroon, no_history → shade4. Attendance: present → shade1, leave → shade2,
  late → shade3, pending → shade4, absent → maroon. The ⚠ overflow chip (dark red `#991b1b` today) → solid maroon.
  The "won't fit" light red → maroon-soft chip. Explanation notes (`efd-note`, `mfd-note`) → mild card.
- **Task 8: Personal widgets.** `action-center-card`, `my-tasks-card`, `today-at-a-glance-card`,
  `work-pattern-card`, `wellbeing-carousel-card`, `attendance-trend-card`, `active-projects-card`,
  `quick-create-task`, `dashboard-notifications-card`, `quick-actions-card` (only non-button colours); util
  `action-inbox`. `active-projects-card` and `quick-create-task`: replace `project.color` and the fallback list or
  `'#6366f1'` with `widgetShadeFor(project.id)`. Add a spec where two projects with different stored colours render
  `widgetShadeFor` values and a project with the same id renders the same shade twice. Action inbox: late → maroon
  text, soon → shade2 text.

### Task 9: Docs, full gate, browser pass

**Files:**
- Modify: `docs/design/WIDGET_CREATION_RULES.md`. Replace the status-colour line (good `#10b981`…) and the dark-red ⚠
  chip rule with the monochrome rules: the tokens, `WIDGET`/`widgetRamp`/`widgetShadeFor`, the three chip styles,
  the mild card, `palette="widget"` on kpi-tiles, and the guard spec. Also add a line to the done checklist: "colour
  maps pass `widget-colors.guard.spec.ts`".

- [ ] **Step 1:** Update the rules file.
- [ ] **Step 2:** `grep -rnE "#[0-9a-fA-F]{3,6}\b|--color-(cat|tint|success|warning|info|danger)" src/app/modules/dashboard --include=*.css --include=*.html --include=*.ts | grep -v spec`.
  Expected: only `widget-palette.ts` (none) and lines with a comment saying why they stay, such as the white text
  token. No series, chip or card colours.
- [ ] **Step 3:** `pwsh ../dev-env/scripts/verify.ps1 frontend` and `npm run lint`. Expected: build clean, all unit
  tests pass (record the count), 0 lint errors or warnings.
- [ ] **Step 4:** Browser pass in Playwright on `https://crownus.test:4200/`. The user signs in. Check the My Team
  dashboard and the personal dashboard in default light, default dark, emerald light and mono. Open one popup per
  widget. Take full-page screenshots (stretch the viewport to the inner scrollHeight). Look for any leftover green,
  blue, amber, violet or teal.
- [ ] **Step 5:** Commit `docs(dashboard): monochrome widget rules`.
