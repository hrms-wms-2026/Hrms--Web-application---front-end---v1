# Monochrome dashboard widgets: design

Date: 2026-11-12. Frontend only. Approved mockup:
https://claude.ai/artifact/NaVXz789TejaWFbcDUonnW (version 4, "Monochrome My Team dashboard").

## Why

Today the dashboard widgets use many fixed hues: green, blue, amber, red, violet, teal and slate. The page and the
card backgrounds already follow the theme colour (`--color-accent` mixed with white and gray). The charts do not, so
the dashboard looks busy and does not change when the theme changes. The user wants one calm, single-hue look: every
widget is drawn in shades of the theme colour. Only "bad" information keeps its own colour, and that colour is maroon.

## The rules (from the user)

1. **Red becomes maroon.** Anything red today (absent, overload, won't fit, overflow, negative change, biggest gap,
   danger chips) turns maroon.
2. **Everything else uses the theme colour.** Green, blue, amber, violet, teal, indigo and slate all become shades
   of `--color-accent`.
3. **Different shades tell things apart.** Series inside one chart are separated by lightness, never by hue.
4. **Chart shades are mixed with gray.** The background is theme-plus-gray, so the chart shades are theme-plus-gray
   too. They are not pure, saturated theme colour.
5. **KPI cards and explanation cards use a mild theme tint.** This covers KPI tiles, summary cards, the plain-words
   explanation notes in popups and side panels such as "Biggest gap" and "Tasks completed". They get a light theme
   tint background and a light theme border. The value text uses the darkest shade. They are not solid fills and not
   gray panels.
6. **Applies to every dashboard widget**, including each widget's popup (detail dialog).

## Palette (light mode, from the approved mockup)

New tokens in `src/app/shared/styles/theme-tokens.css`. Every one is derived from `--color-accent`, so every theme
preset (default, emerald, violet, rose, slate, mono) re-skins them automatically:

| Token | Value | Used for |
|---|---|---|
| `--color-widget-shade-1` | `color-mix(in srgb, var(--color-accent) 48%, #3a4656)` | Main or "good" series: completed, present, worked. Solid "↑ up" chips. Values in KPI and explanation cards. |
| `--color-widget-shade-2` | `color-mix(in srgb, var(--color-accent) 50%, #7387a0)` | Second series: in progress, on leave, working. |
| `--color-widget-shade-3` | `color-mix(in srgb, var(--color-accent) 30%, #a7b5c6)` | Third series: late, not yet tasked, meetings, the old amber "warning" colours. |
| `--color-widget-shade-4` | `color-mix(in srgb, var(--color-accent) 12%, #ccd4de)` | Neutral or "nothing yet": pending, not started, not clocked in, task hours vs worked. |
| `--color-widget-track` | `color-mix(in srgb, var(--color-accent) 6%, #e1e6ec)` | Empty bar tracks and dividers inside charts. |
| `--color-widget-maroon` | `#8a1c2c` | Was red: absent, overload, won't fit, overflow, negative deltas. |
| `--color-widget-maroon-soft` | `#f4e3e6` | Background of maroon chips (maroon text on top). |
| `--color-widget-mild` | `color-mix(in srgb, var(--color-accent) 11%, #ffffff)` | Background of KPI tiles, summary cards and explanation cards. |
| `--color-widget-mild-line` | `color-mix(in srgb, var(--color-accent) 26%, #ffffff)` | Border of those cards. |

Ordering rule: the most important or "done" category gets shade 1, and the neutral or "nothing yet" category gets
shade 4. When a chart has more than four non-maroon categories, the builder adds in-between steps of the same formula
(for example `--color-widget-shade-2b`). The steps must still differ clearly in lightness.

The amber "warning" level becomes a theme shade (shade 3), not a separate colour. This follows rule 2, and the user
approved it in the mockup.

## Decisions I made (builder may revisit with a reason)

- **Backgrounds stay as they are.** The page, widget and inset tokens already exist
  (`--color-dashboard-team-page-bg`, `-widget-bg`, `-widget-inset`) and already mix theme and gray. The mockup's own
  page and card colours were only stand-ins for these. Only chart, chip and card colours change.
- **Dark mode gets its own values** for the new tokens, in the existing dark blocks of `theme-tokens.css`. The same
  idea applies: theme mixed with a dark slate. Shade 1 is the most visible and shade 4 the closest to the card. Maroon
  is lightened just enough to pass contrast (start from about `#e07a8a` text on `#3a1a20`). The builder picks exact
  values that pass 4.5:1 for text and 3:1 for chart marks against the dark widget background.
- **The rose theme** puts maroon next to a red-family accent. That is accepted. Maroon stays distinct by being much
  darker than the shades.
- **Buttons, links, selection outlines and the app shell** are not widget content and stay as they are. Example: the
  Quick Actions buttons keep the normal accent button styles.
- **Icons with meaning** (⚠ overflow chip, ▲/▼ deltas) keep their glyphs. Only the colour changes.
- **Shared `shared/ui/kpi-tiles`** is also used by Leave and People pages, which are out of scope. Give it an opt-in
  input (for example `palette="widget"`). Only the dashboard sets it. Other pages look the same as before.
- **Chip patterns, only three:** (a) bad: `--color-widget-maroon-soft` background with maroon text. The filled ⚠
  overflow chip is solid maroon with white text. (b) Positive or main highlight (▲ up delta, "12% completed" pill):
  solid shade 1 with white text, or the mild card style where a solid chip would be too loud. (c) Any other soft
  `--tone` chip (forecast `ef-chip` / `mf-chip` statuses and others): the mild card style, meaning mild background,
  mild-line border and shade-1 text.
- **The mockup is a reference.** Read it with the Artifact tool for which series gets which shade in the widgets it
  shows: Team Progress, Work vs task hours, Team schedule, Milestone overtime forecast and Quick Actions. For the
  other widgets, use the ordering rule.
- **Colours that come from data** (user's decision): project colours such as `project.color` in Active Projects,
  the Quick Create Task fallback, and per-person avatar hues inside widgets also become theme shades. Do not show the
  stored colour. Map each item to a palette of theme shades: `--color-widget-shade-1..4` plus in-between steps, cycled
  by a stable index such as the project id hash. Do not use list position, which changes when the list re-sorts. The
  colour key or legend next to the chart tells the items apart, so repeated shades are acceptable. This applies only
  inside dashboard widgets. Stored project colours and other pages stay as they are.
- **Mono preset** becomes gray plus maroon. That is accepted. The second preset for the done check is emerald.

## How it is built

- Add the tokens above (light and dark). Charts and chips reference them through `var(--color-widget-*)`.
- **Chart palettes are data** (WIDGET_CREATION_RULES §6): each widget's `utils/*-format.util.ts` colour map changes
  from hex or `var(--color-cat-*)` to `var(--color-widget-*)` strings. Summary-card tone and chip maps
  (`*-summary-cards.util.ts`) change the same way.
- The **shared donut** sets colour through `[attr.stroke]` and `[attr.fill]`. SVG presentation attributes do not
  resolve `var()`, so switch them to `[style.stroke]` / `[style.fill]`, or resolve the variable another way. The donut
  key, bar chart and other shared charts already use `[style.*]` and accept `var()`.
- **KPI tile and summary-card styles** (the `--tone` → `color-mix(tone 28%/8%, #fff)` pattern) become the mild card:
  background `--color-widget-mild`, border `--color-widget-mild-line`, value `--color-widget-shade-1`, label in the
  secondary text colour. A maroon "bad" tile keeps the mild card but shows its value in maroon.
- Popup explanation notes (`efd-note`, `mfd-note`, `wtd-note` and their siblings) use the mild card.
- Hardcoded hex values in widget CSS and TS that this change removes come out of
  `scripts/hardcoded-colors-baseline.json`. Lower those counts by hand. Never run `--update`.
- Update `docs/design/WIDGET_CREATION_RULES.md`. Its status-colour line (§ visual style: good `#10b981`, in progress
  `#3b82f6`, ...) and the dark-red ⚠ chip rule become the monochrome rules above, so new widgets follow them.

## Scope

In: every widget under `src/app/modules/dashboard/`. That means the `feature/*-card` components, their
`feature/*-detail-dialog` popups, the shared `ui/` charts (donut, donut key, bar chart, day/week charts,
team-progress-time, summary card/row/strip, working-hours, daily-work, weekly-completion, project-hours and others)
and the `utils/` colour maps. This includes personal widgets (My Tasks, Today at a glance, Work pattern, Wellbeing,
Attendance trend, Action center, Notifications), not only My Team ones.

Out: pages outside the dashboard (calendar team load, attendance module, Work Management), the backend, and layout or
size behaviour of widgets.

## Goals, non-goals, anti-goals

- Goal: switching the theme preset recolours every widget, and the dashboard reads as one hue plus maroon.
- Non-goal: changing data, layouts, sizes, views or motion.
- Anti-goal: categories in one chart that can't be told apart. Neighbouring shades must differ clearly in lightness.
  Text on tinted cards must still pass 4.5:1.
- Anti-goal: leaving any green, blue, amber, violet or teal mark in a widget. A leftover hue breaks the look.

## Done means

- No widget, popup or shared chart under `modules/dashboard` shows a fixed non-theme hue except maroon.
- Light and dark mode both look right for at least the default and one other preset.
- Specs updated for the new colour values. `npm run check:warnings`, `npm run lint` and the unit tests are all green.
  The hardcoded-colour check passes.
- Browser pass in Playwright on `https://crownus.test:4200/` (the user signs in). Check the My Team dashboard and one
  popup per widget.
