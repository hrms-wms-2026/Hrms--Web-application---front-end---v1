# Overtime forecast widgets: frontend report (2026-11-08)

Branch `feature/overtime-forecast-widgets` (from `feature/boardui-dashboard-restyle`), committed locally and **not pushed**.
Spec: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-11-08-overtime-forecast-widgets-design.md` §5.
Plan: `docs/superpowers/plans/next/2026-11-08-overtime-forecast-widgets-frontend.md`.

## What was built

Two My Team widgets, both following `docs/design/WIDGET_CREATION_RULES.md` and modelled on `team-work-task-card`:

| Widget key | Card | Popup |
|---|---|---|
| `team-module-forecast` ("Module overtime forecast") | Mini summary strip. xs: donut over the figure. Standard: donut + hero ("~950 h overtime", "Needs 58% task rate · now 42%"), tiles Allocated / Predicted / Task rate / Overtime h (or a summary-cards row), the project bar chart, and the modules-at-risk ranking | KPI tiles, the pie with an explanation, the project chart, and the module table (#, module + path, project, deadline, days left, allocated, remaining, predicted, rate, required, overtime, status). The table is server-paged by 25, searchable, status-filtered and sortable, with CSV. **Expanding a row shows the module's team members** (name, rate, worked, task hours). |
| `team-employee-forecast` ("Employee overtime forecast") | Same ladder. Tiles Remaining / Predicted / Task rate / Overtime h, the rate-vs-required chart (top 8), and the people-at-risk ranking (avatars) | KPI tiles, the pie, the rate-vs-required chart (top 12), and the employee table (#, avatar + name, department, rate, required, deadline, remaining, predicted, overtime, status), with the same paging, search, filter, sort and CSV. **Expanding a row shows the modules the person is connected to** (module, project, deadline, remaining, open tasks). |

Shared pieces:
- Donut slices from the spec: Covered at current rate (green), Needs a higher rate (amber), Needs overtime (red). The centre shows the team rate with "task rate · last 4 wk".
- Status chips: On track, Raise rate, Overtime, No history.
- Charts go through `app-dashboard-bar-chart` behind the `ui/` adapters `module-forecast-project-chart` (remaining | predicted `pair`, capacity `marker`, overtime `alert`) and `employee-forecast-rate-chart` (rate | required in %, red over 100%).
- Summary cards: `mf-rate` / `ef-rate` (spark of the 4 weekly rates), `*-overtime` (bars), `*-risk` (rank), `*-status` (chips). Each card opens its popup section.

### Files

- `models/overtime-forecast.model.ts`, `models/team-{module,employee}-forecast.model.ts`
- `data-access/team-{module,employee}-forecast-api.service.ts`, `data-access/overtime-forecast-params.util.ts`
- `state/team-{module,employee}-forecast.store.ts`, `state/overtime-forecast-store.util.ts`
- `utils/overtime-forecast-{format,layout,table}.util.ts` (shared), `utils/team-{module,employee}-forecast-{layout,format,summary-cards}.util.ts`, `utils/*.testing.ts`
- `ui/module-forecast-project-chart`, `ui/employee-forecast-rate-chart`
- `feature/team-{module,employee}-forecast-card`, `feature/team-{module,employee}-forecast-detail-dialog`
- `widgets/widget-registry.ts` (+ spec), `scripts/hardcoded-colors-baseline.json` (the forecast palette file, 5 colours)
- `docs/design/WIDGET_CREATION_RULES.md` §10 (new reusable rules)

## Contract alignment with the backend

The backend notes (`side-session-notes/.../backend-forecast-contract-notes.md`) say both endpoints match §4 field for field. The frontend uses these points from them:
- `search` on `work/forecast/modules` is supported. The frontend sends it.
- `pageSize` is clamped to 1..100. The CSV export reads every page of 100 (`fetchAllForecastPages`). An earlier single 500-row read was fixed.
- The module list covers only modules the viewer leads, so the empty state reads "No open modules you lead with a deadline ahead."
- Sort directions: name / endDate ascending, rate lowest first, overtime / requiredRate descending. `aria-sort` follows these.
- Visibility comes from the backend catalog gate. The cards don't hide themselves.

## Verification

- `npm run check:warnings`: **clean** ("Build is clean: no warnings, no errors").
- New specs: **76 tests in 15 files, all green** (forecast utils, stores, api services, chart adapters, both cards in every view, both dialogs, widget registry).
- `npm run lint` (ESLint): 0 problems in the new code. The run still reports **7 errors in files this branch doesn't touch**: `calendar/feature/calendar-page/calendar-page.component.html` and `calendar/ui/planner-create-popover/planner-create-popover.component.ts` (click-events-have-key-events / interactive-supports-focus). Because of those, `npm run lint` exits non-zero before its colour check. Run on its own, the colour check shows no new forecast violations. Its other hits are already on the base branch.
- Prettier: every new file is formatted. Existing files such as the widget registry were already not Prettier-clean and were left alone.
- Full `ng test`: 14 failed of 5746, plus one "Worker exited unexpectedly". **None is caused by this branch.**
  - Failing alone on the **base branch too** (pre-existing):
    - `main-layout.component.spec` (navbar shell)
    - `project-list.store.spec` (loads projects)
    - `project.mapper.spec` (DTO mapping)
    - `profile-menu.component.spec` (theme preset)
    - `task-card.component.spec` (weekday name, date dependent)
  - Fail only inside the full run and **pass alone on both branches** (full-suite flakes and timeouts):
    - `app.spec` ×2 (theme store `matchMedia`)
    - `main-layout.tray-presence.spec`
    - `project-detail.component.spec` ×2
    - `task-comments.component.spec` ×2
    - `task-form-modal.component.spec` ×2

## Not done or not verified

- **No browser pass.** The user signs in at `https://dapi.onexso.com:4200`. Still to check by eye:
  - 2x2, 2x4, 3x3, 4x4, 6x4, 12x8 and the default slot, with no scroll at any size.
  - Hover on every donut and bar.
  - Every summary card opens its section.
  - Expandable rows, paging and CSV.
- The section heights come from the reference widget's measured values. They have not been re-measured for these cards, whose hero has one more caption line (the rate window).

## Browser pass follow-up (2026-11-09)

Fixes from the user's browser pass, all approved:

- **Wording:** the backend now sends `overtimeHours` = max(0, remaining − predicted), which is task hours. The UI matches.
  - The hero reads "~7,621 h" over "won't fit at today's rate".
  - The tiles, summary cards, table column and CSV say "Won't fit".
  - The popup explanation says "~X won't fit at today's rate". The divided-by-rate "that is ~X h of overtime" sentence is gone.
- **Chips** read "+902 h". The old "~" read as a minus at chip size.
- **Employee rate chart:** values are plotted up to 200%. A taller required rate is drawn at the cap with a badge showing its real figure ("853%"), and the hover and aria text keep the real figure.
- **Employee popup padding:** the body rule was still named `.mfd` from the copy, so it never applied. It is now `.efd`.
- **2x2 donut:** the centre sub-label is "4-wk rate" in the mini view. "task rate · last 4 wk" stays at 168px.
- **Long titles:** `app-widget-card` with `nowrapTitle` now truncates with an ellipsis (`truncate min-w-0`) and keeps the full title as a tooltip. This is a shared change, and every nowrap card benefits.
- **Blank space at 6x6:** the planner now gives the chart any height the ranking can't use (`ForecastPlan.chartPx`). The ranking never budgets more rows than it has items, with a minimum of 3 for the empty line.
- **Default size:** it comes from the backend catalog (`defaultW`/`defaultH`), so it is a backend registry change, not a frontend one.

Gates after the fixes:
- `check:warnings` is clean.
- 101 forecast and widget-card specs are green.
- The dashboard and shared-ui specs pass, apart from a `pan-zoom-canvas` flake that passes on its own (9/9).
- ESLint finds nothing in the new code. The 7 errors in `calendar` were there before.

## Overload indicator (2026-11-09)

Built against the backend names the other session relayed. They are not yet confirmed against a backend build: the
`overload` status (replacing `overtime`), `totals.overload` and `totals.maxTaskRate`. `raise_rate` now reads
"Overtime risk".

- **Rows:** card rankings, popup tables and summary-card chips show the current and required rate together ("26% → needs 45%"; short form "26% → 45%"). In the popups the two rate columns are merged into one sortable column.
- **Overload treatment:** a filled dark-red **⚠ Overload** badge (`#991b1b`), kept apart from the light "won't fit" red. The card hero says "⚠ N in overload". The popups list the counts On track / Overtime risk / Overload / No history under the KPI tiles.
- **Charts:** the rate chart draws `maxTaskRate` as a dash on every bar with a "90% limit" legend item, and a required rate above it takes the overload colour. The project chart's dash is capacity × limit.
- **Donut:** the last slice is now "Beyond the 90% limit" (remaining − capacity × limit).
- **Popup intro:** ends with "Above 90% task rate is treated as overload."
- **Gates:** `check:warnings` is clean. 102 forecast, registry and widget-card specs are green. ESLint finds nothing in the new code; the 7 errors in `calendar` were already there.
