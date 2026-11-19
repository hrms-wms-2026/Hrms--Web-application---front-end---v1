# Overtime Forecast Widgets (frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline, TDD). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two My Team dashboard widgets, `team-module-forecast` and `team-employee-forecast`, that show whether modules / people can finish their remaining hours before the deadline at the team's 4-week task rate.

**Architecture:** Each widget copies the shape of `team-work-task-card` + `team-work-task-detail-dialog`: model → api service → signal store (card data + popup table page) → pure utils (layout / format / summary cards) → card (mini / xs / standard ladder) → 2xl popup (KPI tiles, donut, bar chart, paged server-side table with expandable rows, CSV). A small shared `overtime-forecast-format.util.ts` holds the status colours, chips, the donut slices and the rate/hour text both widgets use (spec §5 "Shared visual language"); a shared `overtime-forecast-layout.util.ts` holds the size ladder, which each widget's own layout util wraps.

**Tech Stack:** Angular (standalone, signals, OnPush), @ngrx/signals, Vitest, shared `app-dashboard-donut`, `app-donut-key`, `app-dashboard-bar-chart`, `app-dashboard-summary-strip/row`, `app-modal`, `app-kpi-tiles`.

**Spec:** `C:\Users\User\Desktop\build\HRMS-Backend-v1\docs\superpowers\specs\next\2026-11-08-overtime-forecast-widgets-design.md` (§4 contracts, §5 frontend). Rules: `docs/design/WIDGET_CREATION_RULES.md`, `CLAUDE.md`.

## Global Constraints

- Models match the §4 JSON exactly (camelCase). Hours are hours; `workedMinutes`/`taskMinutes` are minutes; rates are fractions (0.42), `requiredRate` may exceed 1 or be null.
- Endpoints: `GET {apiUrl}/work/forecast/modules`, `GET {apiUrl}/work/forecast/employees`. Query: `status?`, `projectId?` (modules), `search?`, `sort`, `page`, `pageSize`. Card asks pageSize 10, popup pages 25.
- Donut: green `#10b981` "Covered at current rate" = min(predicted, remaining); amber `#fbbf24` "Needs a higher rate" = min(capacity, remaining) − covered; red `#f87171` "Needs overtime" = max(0, remaining − capacity). Centre: team rate %, "task rate · last 4 wk".
- Status chips: On track (green), Raise rate (amber), Overtime (red), No history (slate).
- Hero: "~950 h overtime" or "On track"; caption "Needs 58% task rate · now 42%".
- 2x2 minimum, size-driven view with 20px hysteresis, no card scroll, one donut size, shared charts only, `styleUrl` only, zero build warnings, lint 0/0, specs mock HTTP and use fixed dates.

## Review Focus

- Team rate `null` (no history): the centre and tiles show "—", status chip "No history", never "NaN%". Test in shared format spec.
- `requiredRate` null (capacity 0) or > 1: text "—" / e.g. "140%", bar widths capped at 100%. Test in shared format spec.
- Remaining 0 everywhere: donut empty, hero "On track", ranking shows its empty line. Test in card spec.
- A popup page past the end after a status filter shrinks the list: the store resets to page 1 on any filter/sort/search change. Test in store spec.
- Search typed fast: only the latest table request lands (in-flight cancelled). Test in store spec.

---

### Task 1: Shared forecast format + layout core

**Files:** Create `src/app/modules/dashboard/utils/overtime-forecast-format.util.ts` (+ spec), `utils/overtime-forecast-layout.util.ts` (+ spec), `models/overtime-forecast.model.ts`.

**Produces:**
- `ForecastStatus = 'on_track' | 'raise_rate' | 'overtime' | 'no_history'`, `ForecastRateTrendPoint { weekStart: string; rate: number | null }`.
- `FORECAST_COLORS { covered, raise, overtime, noHistory }`, `FORECAST_STATUS_META: Record<ForecastStatus, { label; color }>`.
- `forecastSlices({ remainingHours, predictedHours, capacityHours }): DashboardDonutSlice[]` (keys `covered|raise|overtime`, percentText = share of remaining).
- `rateText(rate: number | null): string` ("42%", "—", "0.5%" via `formatPercent` rules), `forecastHoursText(h: number): string` ("950 h", "12.5 h"), `heroText(overtimeHours)`, `heroCaption(teamRate, requiredRate)`, `rateBarPercent(rate)` (0..100).
- Layout: `ForecastView = 'mini' | 'xs' | 'standard'`, `classifyForecastSize`, `resolveForecastView(w, h, prev)`, `FORECAST_CARD_CHROME`, `FORECAST_SECTION_PX { gap 12, xsFigure 72, xsLegend 84, tileRow 52, chart 150, rankingHead 24, rankingRow 40 }`, `ForecastPlan { legend, figure, tiles, tileColumns, chart, heroChart, rankingRows }`, `planForecastLayout(view, w, h, rowPx?)`.

- [ ] Test: slices for remaining 1500 / predicted 1100 / capacity 2600 → covered 1100, raise 400, overtime 0; remaining 100 / capacity 60 / predicted 30 → 30 / 30 / 40; `rateText(null)` "—", `rateText(0.42)` "42%", `rateText(1.4)` "140%"; caption "Needs 58% task rate · now 42%".
- [ ] Test: layout ladder like `team-work-task-layout.util.spec.ts` (204 high → mini, 315x420 → xs, 760x420 tiles, taller adds chart, then ≥3 ranking rows, max 10).
- [ ] Implement, run `npx ng test --include=...overtime-forecast*`, commit.

### Task 2: Module widget data (model, api, store)

**Files:** `models/team-module-forecast.model.ts`, `data-access/team-module-forecast-api.service.ts` (+ spec), `state/team-module-forecast.store.ts` (+ spec), `utils/team-module-forecast.testing.ts`.

**Produces:** `ModuleForecastQuery { status: ForecastStatus | null; projectId: string | null; search: string; sort: 'overtime'|'requiredRate'|'endDate'|'name'; page: number; pageSize: number }`, `ModuleForecastResponse` per §4a. Store `TeamModuleForecastStore`: `data/loading/error/loadedAt` (card: page 1, size 10, sort overtime), `table: { query, data, loading, error }`, methods `seed`, `load`, `markLoading`, `loadTable(patch?)` (filter/sort/search changes reset page to 1), `setTablePage(n)`, `fetchAll(): Observable<response>` (CSV: pageSize 500).

- [ ] Test api: params only include set values; path `work/forecast/modules`.
- [ ] Test store: load → card query; `loadTable({status:'overtime'})` resets page 1; newer table request cancels older; error text kept.
- [ ] Implement, test, commit.

### Task 3: Module utils (layout wrapper, format, summary cards)

**Files:** `utils/team-module-forecast-layout.util.ts`, `utils/team-module-forecast-format.util.ts`, `utils/team-module-forecast-summary-cards.util.ts` (+ specs).

**Produces:** `planModuleForecastLayout` (wraps core), `moduleForecastExplanation(totals)`, `moduleAtRisk(items)`, `teamModuleForecastSummaryCards(data)` → ids `mf-rate` (spark, section `summary`), `mf-overtime` (bars per project, section `projects`), `mf-risk` (rank, section `modules`), `mf-status` (chips, section `modules`).

- [ ] Tests with fixed fixture, implement, commit.

### Task 4: Module project chart adapter

**Files:** `ui/module-forecast-project-chart/module-forecast-project-chart.component.ts` (+ spec). Bars per project: segment remaining, `pair` predicted, `marker` capacity, `alert` when overtimeHours > 0; legend Remaining / Predicted / Capacity (marker); `axisSuffix="h"`.

- [ ] Test bar count, pair, marker; implement; commit.

### Task 5: Module card + popup

**Files:** `feature/team-module-forecast-card/*`, `feature/team-module-forecast-detail-dialog/*`.

- Card: mini strip; xs donut (+key, +figure); standard hero (donut + hero figure + caption, chips key when wide), tiles Allocated / Predicted / Task rate / Overtime h (or summary row), project chart, at-risk ranking ("View all ›").
- Popup: header, KPI tiles (Allocated / Remaining / Predicted / Task rate vs required / Overtime) `data-section="summary"`, pie + explanation `data-section="forecast"`, project chart `data-section="projects"`, module table `data-section="modules"` (#, module + path, project, deadline, days left, allocated, remaining, predicted, rate, required, overtime, status; sort buttons on server sort keys; search; status select; pager; CSV; expand row → members table name / rate / worked / task hours).
- [ ] Card spec: each view, empty state, open section. Dialog spec: tiles, rows, expand shows members, status filter calls store, pager, CSV.
- [ ] Commit.

### Task 6–9: Employee widget

Same as Tasks 2–5 with §4b: query adds `search`, sort `overtime|requiredRate|rate|name`; chart adapter `ui/employee-forecast-rate-chart` (segment rate %, pair required %, `axisSuffix="%"`, top N); summary card ids `ef-rate` (`summary`), `ef-overtime` (`rates`), `ef-risk` (`employees`), `ef-status` (`employees`); popup table #, avatar + name, department, rate, required, deadline, remaining, predicted, overtime, status; expand → modules (module, project, deadline, remaining, open tasks). Tiles: Remaining / Predicted / Task rate / Overtime h.

### Task 10: Registry, verification, report

- `widgets/widget-registry.ts` + spec: `'team-module-forecast'`, `'team-employee-forecast'`.
- `npm run check:warnings`, `npm run lint`, full `ng test` (list pre-existing failures).
- Add any new reusable rule to `WIDGET_CREATION_RULES.md`; report `docs/reports/2026-11-08-overtime-forecast-widgets-frontend.md`.
