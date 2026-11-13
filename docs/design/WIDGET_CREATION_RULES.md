# Dashboard Widget Creation Rules

> **Read this file before you create or rework ANY dashboard widget (My Work or My Team).**
> It is the standard the team settled on over many rounds: Team Progress, Team Attendance, Weekly Work
> Progress, Work vs task hours, Today's team schedule. These rules come from the shipped widgets. Do not
> reinvent anything they already solve.
>
> **Reference implementation:** `team-work-task-card` (card) + `team-work-task-detail-dialog` (popup), with
> `utils/team-work-task-{layout,format,summary-cards}.util.ts`, `state/team-work-task.store.ts`,
> `data-access/team-work-task-api.service.ts`. Copy its shape first, then change the content.

---

## 1. Files a widget needs (frontend)

All under `src/app/modules/dashboard/`. `<w>` is the widget's kebab name, `<p>` a 2–3 letter CSS prefix (e.g. `wt-`).

| File | Purpose |
|---|---|
| `models/<w>.model.ts` | Response types, matching the backend DTO exactly (camelCase). |
| `data-access/<w>-api.service.ts` | One `get(query)` per endpoint. No logic. |
| `state/<w>.store.ts` | `signalStore({ providedIn: 'root' })` with `query / data / loading / error / loadedAt`, `seed(data)`, `load()`, `markLoading()`. Cancels the in-flight request when a newer one starts. The card and popup **share** this store, so a resize or the popup never resets the period/filter. |
| `utils/<w>-layout.util.ts` | `classify…Size`, `resolve…View` (hysteresis), `…_BREAKPOINTS`, `…_CARD_CHROME`, `…_SECTION_PX`, `plan…Layout`. Pure functions with a spec. |
| `utils/<w>-format.util.ts` | Colours (`<W>_COLORS`), text formatters, donut slices. Pure, with a spec. |
| `utils/<w>-summary-cards.util.ts` | `<w>SummaryCards(data): SummaryCardModel[]`. Pure, with a spec. |
| `feature/<w>-card/` | The card (`.ts/.html/.css/.spec.ts`). |
| `feature/<w>-detail-dialog/` | The popup (`.ts/.html/.css/.spec.ts`). |
| `widgets/widget-registry.ts` | Add `'<key>': { load: () => import('../feature/<w>-card/<w>-card.component').then((m) => m.<W>CardComponent) }`. **Never a static import** of the card here: the dynamic import makes each card its own lazy chunk, downloaded only when the user's layout contains it. A static import puts every card and every detail dialog in one chunk for every user (see `docs/reports/performance/2026-11-11-frontend-bundle-size.md`). |

- **Always `styleUrl`.** Never a shared imported styles constant: the build hangs when 3+ components do that.
- `ChangeDetectionStrategy.OnPush`, standalone, `host: { class: 'block h-full' }`.
- Load data through `injectWidgetDataFeed({ apply, fetch, refreshing })` so the dashboard bootstrap payload is used when there is one. Reload on `visibilitychange` → visible.

## 2. Backend registration (every widget)

- `Features/Dashboard/Layout/Registry/DashboardWidgetRegistry.cs`: `new("<key>", DashboardKeys.MyTeam|MyWork, "Title", "One-line description", minW: 2, minH: 2, maxW: 12, maxH: 8, hasProvider)`.
  **minW and minH are always 2**, on the backend definition too, not only in the frontend.
- `Features/Dashboard/Layout/Access/DashboardWidgetAccess.cs`: a key constant and its access gate. Mirror the gate in a frontend `…Visible(capabilities)` helper (`utils/my-team-widget-visibility.util.ts`) when the card must hide itself.
- A new widget is **catalog only** (offered in the widget store) unless the user asks for it in the default layout.
- Endpoints return `Result<T>`, check the permission first, and use the **same population as the screen they mirror**. My Team people widgets use `CoveredTeam` (the Team Status population). Numbers that appear on two screens must come from the same query.
- Prefer pre-aggregated, trigger-maintained tables and paged SQL-side filtering over per-request aggregation. Big lists are paged: the card asks for the top N, the popup pages.

## 3. Size and layout

- Grid: 96px rows, 12px gap → 2 rows = 204px, 3 = 312, 4 = 420, 5 = 528, 6 = 636. A column is ~97px at 1440px wide, ~140px at 1920px.
- **Every widget works at 2x2**, and all the way up to 12x8.
- The card picks its view from **its own rendered size** (ResizeObserver + rAF, like the reference card's `observeSize/applySize`), never from grid w/h. **20px hysteresis.** A 0x0 host renders the standard view first.
- View ladder: **`mini`** (2 rows, height < ~260px), **`xs`** (narrow but tall, width < ~330px: donut over the figure), **`standard`**.
- **Grow by adding detail, never by scaling.** A taller card adds sections in priority order: KPI tiles / summary row → trend chart → top-N ranking (min 3 rows, max 10). Each section has a fixed height in `…_SECTION_PX`, and the plan only adds a section when its full height fits.
- **A card never scrolls.** Every view must fit its size. Measure section heights **in the browser**, never guess them (a guessed 64px tile was really 102px). To verify, check `scrollHeight - clientHeight` of the frame's `overflow-auto` div at every size from 2x2 to 12x8.
- Card chrome is tight: padding `px-4 py-3`, header gap `mb-2`. No wasted space.
- Hide secondary controls (period select, ‹ › range) in mini/xs views. Period switches live in the popup or the standard view only.

## 4. Charts: shared components only

The charts live in `src/app/shared/ui/charts/` (`dashboard-donut` + `donut-key`, `donut-breakdown`,
`dashboard-bar-chart`, and their `utils/`), with the palette in `shared/utils/widget-palette.ts` and
`formatPercent` in `shared/utils/format-percent.util.ts`. They are the **project-wide** charts: any screen
(Time Off, Attendance, …) that shows a pie/donut or bar chart uses these, in the monochrome palette below.
Never build a new chart component on another screen.

- **Donut:** always `app-dashboard-donut` + `app-donut-key` (variants `list | compact | wrap | chips`), bound to one `[(active)]` signal. Hovering a slice or key row lights it, and the centre shows value + `label · %`. The key shows the % right beside the label ("Completed 12%"). **Never hand-draw a donut SVG.**
- **One donut size:** `dashboardDonutPx(view)` → 168px (`DASHBOARD_DONUT_PX`), 140px only in 2x2 mini views. A donut never resizes otherwise. If it doesn't fit, leave it out.
- **Bar charts:** always `app-dashboard-bar-chart` behind a thin adapter component in `ui/` (see `work-task-day-chart`). It supports `pair` stacks, a target `marker`, a count `badge`, `dim`, a legend and `axisSuffix`. Pass `heading` so the hover headline replaces the title. No overlay polylines.
- Percentages go through `formatPercent`, so a tiny value reads 0.5%, not 0%. All numbers use `font-variant-numeric: tabular-nums`.

## 5. The 2-row (mini) view and summary cards

- At 2 rows use `app-dashboard-summary-strip`: donut only at 2x2, donut + key at ~2x4, then **summary cards** as it widens. Never a stacked bar.
- Taller views put `app-dashboard-summary-row` (via `withSummaryRow` + `summaryRowCount`) in the KPI tiles' place, showing only cards for sections the view is **not** already showing (`shown…Cards(view, plan)`). Without room, or with fewer than two such cards, keep the KPI tiles.
- Each `SummaryCardModel` summarises **one popup section**: `section` = the popup's `data-section` id. Clicking it opens the popup scrolled to that section (`openSection` → `focusSection`).
- Body kinds: `spark`, `bars`, `pair`, `meter`, `hbars`, `rank`, `people`, `chips`. Ranked-people cards show at most `SUMMARY_CARD_ROWS`. Deltas use `summaryDelta(value, unit, higherIsGood, 'vs last week')`.
- Order the cards by importance. The 2-row strip shows four. A fifth card is for taller views only.

## 6. The popup (detail dialog)

- Same shell as Team Progress: `app-modal size="2xl"`, with its default header hidden by the component CSS and our own header (title, range/period controls, close). Full-screen under 640px.
- **Overview first, no tabs.** Top: one row of KPI tiles (`app-kpi-tiles`, `maxColumns` 4–5, `data-section="summary"`). Then chart panels. Then the table.
- Every section has a `data-section` id that the summary cards point at.
- Tables are ranked with a `#` column where order means something, sortable, searchable, and paged when long, with **CSV export**.
- Inputs: `[open]`, `[focusSection]`, `(closed)`. The popup reads the shared store and can change its period.

## 7. Visual style

The source of truth is `feature/team-attendance-card/team-attendance-card.component.css`. Copy its values under your prefix.

- **Text:** strong `rgb(15 23 42)`, body `rgb(51 65 85)`, muted `rgb(100 116 139)`, faint `rgb(148 163 184)`. **Borders** `rgb(226 232 240)`, panel border / donut track `#f1f5f9`, soft row bg `rgb(248 250 252)`, link `rgb(37 99 235)`, focus ring 2px `rgb(59 130 246)`. **Deltas:** up = solid shade 1 chip (or shade-1 text), down = maroon (see §7a).
- **Type:** hero figure 2.25rem/700 (1.5rem xs, 1.625rem mini). Donut centre 1.5rem/700 + 0.75rem muted sub-label. Section title 0.8125rem/600. Body rows 0.8125rem. Captions, links and deltas 0.75rem. Tile label 0.6875rem.
- **KPI tile:** 52px, radius 0.625rem, the mild card (§7a): bg `--color-widget-mild`, no border, `--shadow-widget-tile` shadow, count 1.125rem/700 in shade 1 (maroon for a bad figure). 2 or 4 columns (4 from ~400px body width), gap 0.5rem.
- **Panel:** 1px slate-100 border, radius 0.75rem, padding 0.625rem 0.75rem. Trend panel fixed 150px.
- **Ranking row:** 40px, grid `auto auto 1fr minmax(3rem,6rem) 2.75rem`: rank pill (top 3 mild card), avatar, name, 6px bar, bold right-aligned value. Header "View all ›" opens the popup.
- **Status colours:** monochrome, see §7a. Never a fixed hue (green, blue, amber, violet, teal, slate) in a widget.
- Motion comes from `dashboard-motion.css` via `app-widget-frame`. Don't add global styles.

## 7a. Monochrome colours (2026-11-12)

Every widget, popup and shared chart is drawn in shades of the theme colour, with maroon for anything "bad".
Spec: `docs/superpowers/specs/2026-11-12-monochrome-dashboard-widgets-design.md`.

- **Tokens** (`shared/styles/theme-tokens.css`, light + dark, all derived from `--color-accent`):
  `--color-widget-shade-1 … -4` (plus `-2b`, `-3b` in-between steps), `--color-widget-track`, `--color-widget-gray` (plain
  neutral gray with no theme tint, only where a category must read as grey: Team schedule meetings), `--color-widget-maroon`,
  `--color-widget-maroon-soft`, `--color-widget-mild`, `--color-widget-mild-line`, `--color-widget-on-solid`
  (text on solid shade-1 / maroon) and `--color-widget-on-light` (text on lighter shade fills).
- **In TS** use `WIDGET` from `shared/utils/widget-palette.ts`: `WIDGET.shade1` … `WIDGET.maroon`. They are `var()` strings;
  never resolve them to hex, so a theme switch recolours every chart at runtime. SVG fills/strokes bind
  `[style.fill]` / `[style.stroke]`, never `[attr.fill]` (presentation attributes don't resolve `var()`).
- **Shade order:** main or "done" series = shade 1, then shade 2, shade 3, and neutral or "nothing yet" = shade 4.
  Old amber warnings = shade 3. Anything red (absent, overload, won't fit, overflow, negative change) = maroon. More
  than four non-maroon series: `widgetRamp(n)` (up to 6, lightness order). Neighbours must differ clearly.
- **Data colours** (project colours, avatar hues) inside widgets: `widgetShadeFor(id)` (stable hash, never list
  position) and `widgetInkOn(shade)` for text on it. Stored data colours are never shown.
- **Three chip styles only:** bad = maroon-soft background, maroon text; the filled ⚠ Overload badge = solid
  maroon with `--color-widget-on-solid` text. Main / positive (▲ up delta, "12% completed") = solid shade 1 with
  `--color-widget-on-solid`, or the mild chip where solid is too loud. Every other chip = the mild chip: mild
  background, mild-line border, shade-1 text.
- **The mild card:** KPI tiles, summary cards and plain-words explanation notes (`*-note`, "Biggest gap", …) use
  `--color-widget-mild` background, **no border** (keep a transparent 1px border so sizes don't shift) and only the
  very thin `--shadow-widget-tile` lift, like the widget cards themselves, with a shade-1 value and secondary-text
  label. A bad tile keeps the mild card and shows its value in maroon. Chips keep their mild-line outline.
- **Header controls** (company switcher, Search, Customize in the top navbar) use the same mild tint: mild background,
  mild-line border, shade-1 text, so the shell continues the theme colour on every page.
- **`app-kpi-tiles`** inside the dashboard always sets `palette="widget"`. Without it the tiles keep their default
  look (Leave and People pages).
- Backgrounds (`--color-dashboard-team-*`), buttons, links, focus rings and the app shell are not widget content and
  keep their own tokens.
- Every exported colour map in `utils/` is listed in `utils/widget-colors.guard.spec.ts`, which fails on any
  non-widget colour. A new map goes in that spec.

## 8. Card shell

```html
<app-widget-card title="…" [nowrapTitle]="true" [state]="widgetState()" errorMessage="…" emptyMessage="…" (retry)="retry()">
  <div widget-actions>
    <app-popout-header-actions [refreshing]="refreshing()" [expanded]="false" [canExpand]="true"
      [revealOnHover]="true" (refresh)="retry()" (expand)="openDetail()" />
  </div>
  @switch (view()) { @case ('mini') { <app-dashboard-summary-strip … /> } @default { …grow column… } }
</app-widget-card>
<app-<w>-detail-dialog [open]="detailOpen()" [focusSection]="detailSection()" (closed)="closeDetail()" />
```

- `widgetState`: `loading` (no data yet), `error` (no data + error), `empty` (nothing to show, with a helpful message), `ready`.
- `refreshing` = loading while data exists. The card keeps showing the old data.
- Clicking the card or expand opens the popup. Inner buttons call `event.stopPropagation()`.

## 9. Done checklist

1. Backend: registry entry (min 2x2), access gate, endpoint + handler + unit tests, architecture tests green.
2. Frontend: specs for the layout, format and summary-card utils, the card (each view) and the dialog.
3. `npm run check:warnings`: **zero warnings** (template diagnostics are build errors). `ng build` clean.
4. Browser pass at `https://<tenant>.onexso.com:4200` (the user signs in): 2x2, 2x4, 3x3, 4x4, 6x4, 12x8 and the default slot. No scroll at any size, hover on every donut/bar, every summary card opens its section, CSV export works.
5. Colour maps pass `widget-colors.guard.spec.ts`, `app-kpi-tiles` has `palette="widget"`, and no fixed hue is left (§7a).
6. Update this file if the widget established a new rule.

## 10. Rules added by the overtime forecast widgets (2026-11-08)

- **Sibling widgets share their language in one util.** When two widgets show the same concept (Module and
  Employee overtime forecast), the colours, status chips, donut slices and text formatters live in one shared
  `utils/<topic>-format.util.ts` (and the size ladder in `utils/<topic>-layout.util.ts`). Each widget still has its own
  model, api, store, layout/format/summary-cards utils, card and dialog, which wrap the shared ones.
- **Chart palettes are data.** The colour map lives in the format util that defines the series and holds only
  `WIDGET.*` values (§7a), so no hex and no baseline entry is needed. Never run `--update` on
  `scripts/hardcoded-colors-baseline.json`, because it would also lock in other people's violations; lower counts by
  hand. CSS and templates use `var(--color-widget-*)`; per-row colours go in through `[style.--tone]`.
- **Long popup tables page on the server.** The store keeps the card's read (`data`, top N) apart from the popup's
  `tableQuery` / `table` page. A filter, search or sort change goes back to page 1 (`nextTableQuery`), and a newer table
  read cancels the one in flight. Search waits 250ms after the last key. Sort buttons exist only for the keys the
  endpoint sorts by.
- **CSV exports every row, not the page.** The backend clamps `pageSize` (1..100), so read page 1 and then the other
  pages in parallel (`fetchAllForecastPages`).
- **Expandable rows** use a `<button aria-expanded>` in the row header cell. The detail is a full-width `<tr>`
  (`colspan` = column count) holding a small nested table.
- **Without a range row**, the standard view fits the KPI tiles at 3 rows (312px). The summary-cards row (140px)
  fits from 4 rows.
- **Severity badge (Overload).** *(Colours superseded by §7a: the badge is solid maroon, "won't fit" is the maroon-soft chip.)* When one status is worse than "behind", give it its own treatment, never a darker
  copy of the hours colour. Use a filled chip (`background: var(--tone)`, `color: var(--color-text-on-solid)`) with
  `<span aria-hidden="true">⚠</span>` before the word, in a dark red (`#991b1b`) kept apart from the light
  "won't fit" red (`#f87171`). Use it in card rankings, popup tables, status counts and the summary-card rank chip
  (`⚠ 26% → 120%`). Keep plain chips for the other statuses.
- **Threshold marker.** A limit that applies to every bar (the tenant's realistic task-rate limit, `maxTaskRate`) is the
  bar chart's `marker` on each bar, plus a legend item with `marker: true` ("90% limit"). A pair value above the limit
  takes the severity colour. When the limit changes what is reachable, the donut's last slice is "Beyond the 90%
  limit" (capacity × limit), and the popup intro says the rule in one line ("Above 90% task rate is treated as overload.").
- **Rate rows show both rates:** "26% → needs 45%" in tables, "26% → 45%" in tight spots (a ranking row's second line,
  chips). Merge the current and required rate columns into one sortable column.
- **Bar charts in narrow cards (body under ~360px).** Pass `compactHeadline=false` so the title sits over the figure,
  and never truncate the title mid-word. Show only the bars that fit at a readable width (`chartFit(bodyWidth)`: about
  64px a bar after the axis, top N by the widget's ranking) with a "+N more … in the popup" line. Shorten labels to the
  width they get. The full name stays in the bar's `title` and the aria label.
- **Never let a target dash set the scale.** Draw a `marker` only when it lands within 1.25× of the tallest bar.
  Otherwise leave it out and give its value in the hover (`sub` and tooltip), so one huge project can't flatten the
  others into stubs.
- **No red frames on many bars.** `alert` is for a single exceptional bar. To mark several, use the bar's small
  `badge` ("⚠ 2") and keep the neutral track.
- **Donut centre labels stay short** in cards ("4-wk rate"). A longer sub-label overlaps the ring at 140px and in
  narrow standard views at 168px.

