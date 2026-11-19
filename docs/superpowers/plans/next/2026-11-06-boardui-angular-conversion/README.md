# BoardUI → Angular conversion plan (HRMS frontend, mostly dashboard)

**Date:** 2026-11-06
**Status:** pending. This is the working plan; the screens to change come from the user, one by one, in the follow-up session.
**Repo:** `Hrms--Web-application---front-end---v1` (Angular 21 + Tailwind CSS v4). No backend work is expected.

## 1. Why and what

The user likes the BoardUI look (https://www.boardui.com): clean dashboard cards, a strict colour and type system, and quiet motion. We want that look in the HRMS app, mostly on the **dashboard** (My Work, My Team, the widget cards and their detail popups).

BoardUI is **React 19 + react-aria-components + Tailwind v4**. Its components cannot run in our Angular app, so:

- **We do not install BoardUI components.** `npx boardui add/init` writes React `.tsx` files and must never be run in this repo.
- **We rebuild each piece from scratch in Angular**, using BoardUI's source, tokens and screenshots as the visual reference only.
- The BoardUI agent skill was removed from `~/.claude/skills` on purpose: it tells the agent to install React components. Its text is kept here as plain reference in `boardui-reference/`.

### Non-goals

- No React in the app, no `react-aria-components`, no `@remixicon/react`.
- No rewrite of screens the user hasn't asked for.
- No change to the dashboard behaviour rules (sizes, adaptive views, popup shell, customize mode). Only the look changes.

### Would be a failure even if it "works"

- Theme presets (`data-theme` default/emerald/violet/rose/slate/mono) or dark mode (`data-mode='dark'`) stop working.
- Teammate-owned modules change look without them knowing (shared tokens and `shared/ui` are used app-wide).
- A widget card starts scrolling, or loses its 2x2 view, because the new chrome is bigger.

## 2. Tools for this work

| Tool | Use it for |
|---|---|
| **BoardUI MCP** (`boardui`, user scope, telemetry off) | `list_components`, `get_component` (React source to read, free items only), `get_usage_examples`, `get_theme` (exact token values, type scale, global CSS). **Never** call `install_components`, `init_boardui`, `install_rules` or `install_skill`. |
| **Angular CLI MCP** (`angular-cli`, local scope for this repo) | Angular best practices, docs search, examples for signals, control flow, standalone components. |
| **Playwright MCP** | Visual check at https://onexso.com:4200/ (the user signs in themself). Full-page screenshots: stretch the viewport to the inner `scrollHeight`. |
| `boardui-reference/` (this folder) | `theming.md` (token families, type scale), `motion.md` (durations, easings), `patterns.md` (page anatomy), `components.md` (catalog + React usage), `boardui-skill-overview.md` (design rules). |
| boardui.com docs pages | Live look of each component, light and dark, to compare against. |
| `frontend-design`, `dataviz` skills | Visual decisions and chart colours when BoardUI has no free reference (Pro chart cards). |

BoardUI **Pro** items (chart cards such as `area-chart-card`, `bar-list-card`, the `template-*` pages) give no source without a licence. For those we only have the public docs page and screenshots, so we build from the picture.

## 3. What already exists (do not start from zero)

- **Tokens:** `src/app/shared/styles/theme-tokens.css` (371 lines). It already uses semantic names (`--color-text-primary`, `--color-surface`, `--color-border`, `--color-accent`, tint families, shadows) with theme presets and dark mode. **BoardUI uses some of the same names** (`--color-text-primary`) with different values and many others (`--color-background-primary-default`, `--color-border-button-default`, `chart-1..5`). Importing BoardUI's `theme.css` as-is would clash. See Phase 0.
- **Font:** Plus Jakarta Sans (body) + Instrument Serif (display) in `src/styles.css`. BoardUI uses Inter.
- **Motion:** `src/app/modules/dashboard/dashboard-motion.css` already uses BoardUI's main easing `cubic-bezier(0.22, 1, 0.36, 1)` for the dashboard load and refresh animation.
- **Shared UI** (`src/app/shared/ui/`): button, card, widget-card, modal, select, input, data-table, date-picker, date-range-picker, dropdown-menu, popover, tabs, kpi-tiles, metric-stat, progress-bar, progress-ring, toast, empty-state, avatar, avatar-stack, loader, page-header, filter-bar and more. **Most BoardUI pieces map to one of these: restyle it, don't add a second one.**
- **Dashboard:** `src/app/modules/dashboard/` (`feature/` cards, `ui/` charts like donut-breakdown and the day/week charts, `ui/widget-frame`, `ui/dashboard-grid`).
- **Dashboard rules:** 2x2 minimum, fixed 140px donut, views picked from the card's own size, cards never scroll, Team Progress popup shell, pinned Quick Actions. These stay.

## 4. Phase 0: foundations (do once, before the first screen)

Agree each point with the user before coding. Points marked **(user)** are their call.

1. **Token mapping, not token import.** Read BoardUI's tokens with `get_theme`. Write a mapping table in `token-mapping.md` (this folder): BoardUI role → our existing token, or a new token we add. Add only the missing roles to `theme-tokens.css` under our own naming style (e.g. surface tiers, `--color-chart-1..5`). Every new token needs a value in every preset and in dark mode.
2. **Scope (user).** Either (a) global: change shared tokens so the whole app moves to the BoardUI look, which affects teammate modules, so tell them first; or (b) dashboard-only: put the new values under a `.boardui` / dashboard scope class first and widen later. Recommendation: (b) first.
3. **Type scale.** Add BoardUI-style composite type utilities (`text-title-1-medium`, `text-body-regular`, `text-caption-1-semibold`, ...) as Tailwind v4 `@theme` `--text-*` entries in a new `src/app/shared/styles/typography.css`, imported from `src/styles.css`. Sizes from `theming.md`: title-1 24, title-2 20, title-3 18, headline 16, body 14, body-2 13, caption-1 12, caption-2 11.
4. **Font (user).** Keep Plus Jakarta Sans, or switch to Inter like BoardUI. A switch changes every screen, so it's a global decision.
5. **Card shape.** BoardUI cards: `rounded-3xl`, 1px border, surface background, no heavy shadow. Ours: `--radius-content: 12px` + soft shadow. Decide per the user's reaction to the first restyled widget.
6. **Motion.** Interactive UI follows `motion.md`: hover colour 150ms, popovers 150ms soft blur-in (`opacity-0 scale-95 blur-[2px]`), modals 300ms `cubic-bezier(0.32, 0.72, 0, 1)`, press = one colour step darker and never a scale, `prefers-reduced-motion` guard on every keyframe. Leave `dashboard-motion.css` timings alone unless the user asks.
7. **Icons (user).** BoardUI uses Remix Icon. Keep our current icon component (`shared/ui/icon`) unless the user wants Remix Icon's look. If so, use the SVG set through our icon component, never `@remixicon/react`.

## 5. Per-screen workflow (each request the user gives)

1. **Log it.** Add a row to the change log (section 7): screen, what the user wants changed, the BoardUI reference.
2. **Find our code.** Locate the Angular component(s) (`modules/dashboard/feature/...`, `shared/ui/...`). Read the current template, styles and spec.
3. **Read the reference.** `get_component` / `get_usage_examples` for free items; the boardui.com page in Playwright for the look (light + dark). For Pro items, screenshots only.
4. **Translate.**
   - React props → Angular `input()` / `output()`; state → signals; `className` + `cx()` → Tailwind classes in the template, conditional via `[class.x]`.
   - react-aria behaviour → Angular CDK (`Overlay`, `A11yModule`, `ListKeyManager`, `cdkTrapFocus`) or the existing shared component that already does it.
   - BoardUI token utilities → our tokens from `token-mapping.md`. No raw palette classes, no hex in components, no `dark:` colour overrides.
   - Charts: reuse our SVG chart components in `modules/dashboard/ui/`; recolour through chart tokens.
5. **Keep the rules.** Dashboard widgets still meet the widget standard (2x2, no scroll, 140px donut, host-size views).
6. **Verify.** Follow the repo `CLAUDE.md`: `npm run check:warnings` (zero warnings), `npm run lint` (0 errors, 0 warnings, a11y rules included), the component's specs, or the whole gate with `pwsh ../dev-env/scripts/verify.ps1 frontend`. Clickable cards/rows keep `role="button" tabindex="0" appKeyboardClick`. Then Playwright at https://onexso.com:4200/: light, dark, and at least two theme presets; widgets at 2x2 and a large size, checking that the frame's scroll area has no overflow.
7. **Show the user** before/after screenshots, then commit that screen on its own (one commit per screen).

## 6. Branch and ownership

- Work on a new branch (e.g. `feature/boardui-dashboard-restyle`). Ask the user which base branch to cut it from. Never push without the user asking.
- Shared files (`theme-tokens.css`, `styles.css`, `shared/ui/*`) are used by the teammate's modules too. Changes there need the user's OK, and the user should tell the teammate.

## 7. Change log (fill in during the follow-up session)

| # | Screen / component | What the user wants | BoardUI reference | Files | Status |
|---|---|---|---|---|---|
| 0 | Foundations (Phase 0) | token mapping, type scale, scope, font | `get_theme`, `theming.md` | `theme-tokens.css`, `typography.css` | pending |
| 1 | Team Progress popup (My Team dashboard) | Weekly completion → Combo Chart Card look; Team members → Bar List Card look; every panel follows the period dropdown (All time / This month / This week) | `combo-chart-card` (Pro, docs page only), `bar-list-card` (Pro, docs page only) | `feature/team-progress-detail-dialog/*`, new `ui/completion-combo-chart/*`, `data-access/team-progress-detail-api.service.ts`, `src/styles.css` (`@source not "../docs"`) | done, verified in the browser (light, dark + violet, All time / This week). Also per the user: Unscheduled work panel removed from the popup, Weekly completion made wide (2 columns) on a light gray tray. Needs backend branch `feature/led-weekly-completion-period` (dc097893) for day/week buckets; without it the chart stays on the last 10 weeks and says so. |
