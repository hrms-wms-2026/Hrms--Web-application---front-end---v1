# Neutral surfaces + Dark mode: implementation plan (2026-11-05)

## Goal

1. Change the light look to:

   | Item | Value |
   |---|---|
   | Main background | `#FAFAFA` |
   | Cards | `#FAFAFA` |
   | Header | `#FAFAFA` |
   | Borders | `#E5E5E5` |
   | Card shadow | `0 1px 3px rgba(0,0,0,0.035)` |
   | Selected project | Existing blue outline, **no fill** |
   | Sidebar | Keep existing navy (no change) |

2. Every color comes from one central place (`src/styles.css` → `theme-tokens.css`). Changing a token re-skins the whole app.
3. Add a **Light / Dark / System** switch to **Appearance** (profile menu). It works together with the existing accent presets (Default, Emerald, Violet, Rose, Slate).

## What already exists (found in the code)

- `src/styles.css` imports `src/app/shared/styles/theme-tokens.css`. That file already defines `:root` tokens (`--color-app-bg`, `--color-surface`, `--color-border`, `--color-card-shadow`, ...) and a dark block on `:root[data-mode='dark'], html.dark`.
- `ThemeStore` (`src/app/core/theme/state/theme.store.ts`) stores only the accent **preset** (`data-theme`, localStorage `onevo.theme.preset`). It has no light/dark mode.
- Dark mode is only switched on the public landing page (`landing-header.component.ts`). It sets `html.dark` + `data-mode` and stores `onevo.color.mode` in localStorage. The main app has no switch for it.
- `AppearancePanelComponent` (`shared/ui/appearance-panel`) shows the 5 preset swatches only.
- Most of the app already uses tokens: about 6,300 `var(--color-*)` uses.
- But some code bypasses the tokens:
  - about 1,040 hard-coded hex colors in 108 component `.css`/`.html` files. The worst are `position-coverage-modal`, `monitoring`, `attendance-detail-drawer`, `action-center-card`, the auth pages and `position-tree-node`.
  - about 846 Tailwind gray/white/black utilities (`bg-white`, `text-gray-500`, `border-slate-200`, ...). These are mostly in dashboard cards and People overview widgets.
  - 211 `box-shadow` declarations, each with its own value.
  - Tailwind `dark:` is used only twice, and no `@custom-variant dark` is defined. So `dark:` currently follows the OS setting, not the app.
- The selected project row (`work/ui/project-list-row`) uses a blue border **plus** a tinted fill (`color-mix(accent-subtle 40%)`) and `shadow-sm`.

## Design decisions

- **Two separate settings:** `data-theme` = accent preset (as today) and `data-mode` = `light | dark`. The stored preference is `light | dark | system`. With `system`, the app follows `prefers-color-scheme` and updates live when the OS setting changes.
- Cards are now the same color as the page (`#FAFAFA`). The border and the soft shadow separate them. **Decided:** popups, dropdowns, menus and inputs also use `#FAFAFA`. `--color-surface-raised` stays as its own token (same value in light mode) so dark mode can still lift popups slightly. Popups are separated by `--shadow-popover` and the border.
- The sidebar keeps its current navy and per-preset sidebar tokens in **both** modes.
- One default mode for everyone: **Light**. A new user does not start in dark mode just because their OS is dark, unless they pick System.
- Preference is saved in localStorage for now, the same as presets. There is no backend endpoint yet.

## Phases

### Phase 1: Central token layer (no visual change yet)

Files: `src/styles.css`, `src/app/shared/styles/theme-tokens.css`

1. Add the missing semantic tokens to `theme-tokens.css`, with light and dark values:
   - `--color-header-bg`
   - `--color-card-bg`
   - `--color-surface-raised` (popups, menus, inputs)
   - `--color-border-strong`
   - `--shadow-card` (full shadow value)
   - `--shadow-popover`
   - `--color-selected-outline`
   - `--color-overlay`
2. Add `--color-hover`, `--color-muted-bg` and the chart and status palettes. These replace the repeated hex values that appear in components, for example status pills and chart series.
3. ~~Map the tokens to Tailwind v4 with `@theme inline`.~~ **Skipped (2026-11-05):** `--color-surface: var(--color-surface)` would point at itself, and the codebase already uses `bg-[var(--color-surface)]` everywhere. Only add a mapping later under different names (for example `--color-ui-surface`), and then check the built CSS for loops.
   **Done in Phases 1–2:** the new tokens `--color-card-bg`, `--color-header-bg` and `--color-surface-raised` are aliases of `--color-surface`, so dark mode keeps working without copies. `--shadow-card` is `0 1px 3px var(--color-card-shadow)`. Also added: `--shadow-popover`, `--color-selected-outline`, `color-scheme`, and `@custom-variant dark`. The chart and status palettes move to Phase 3, where they replace real hex values.
4. Add `@custom-variant dark (&:where([data-mode='dark'], [data-mode='dark'] *));` so `dark:` follows the app switch and not the OS.
5. Add `color-scheme: light` and `color-scheme: dark` on `:root`, so scrollbars, native inputs and date pickers match the mode.

### Phase 2: Apply the new light palette

File: `theme-tokens.css` only. These are the values that drive the whole app.

- `--color-app-bg: #fafafa`
- `--color-card-bg: #fafafa`
- `--color-header-bg: #fafafa`
- `--color-surface: #fafafa`
- `--color-border: #e5e5e5`
- `--shadow-card: 0 1px 3px rgba(0,0,0,0.035)`
- `--color-card-shadow: rgba(0,0,0,0.035)`
- `--color-surface-raised: #fafafa` for popups, dropdowns and inputs (decided: match the cards).
- Point the top navbar background (`layouts/main-layout/top-navbar/*.css`) at `--color-header-bg`.
- Point the shared card containers (dashboard widget shell, `app-data-table` wrapper, settings cards) at `--color-card-bg` + `--shadow-card`.
- Selected project (`project-list-row.component.ts`): keep `border-[var(--color-accent)]`, remove the tinted background and `shadow-sm`, and keep the logo ring. Update its spec if it asserts on the classes.

### Phase 3: Remove hard-coded colors (largest phase, done module by module)

Rule: no hex, `rgb()` or Tailwind gray/white/black utilities in components. Use tokens only. Each batch is one commit, verified in both modes.

1. Shared UI and layouts first, because every screen uses them: `shared/ui/*`, `shared/styles/*`, `layouts/*`, popups and the curved header, `app-select`, `app-data-table`, time-picker. Follow the memory rule: change shared primitives globally.
2. Dashboard cards: the main location of Tailwind gray utilities.
3. People: overview widgets, wizard, profile.
4. Attendance: monitoring, detail drawer, timeline, time-tracking.
5. Organization: position-coverage-modal, position tree.
6. Leave / Time Off, Work, Inbox, Settings.
7. Auth and public pages: login, reset, invitation, device activation.
8. Shadows: replace the 211 one-off `box-shadow` values with `--shadow-card`, `--shadow-popover` and `--shadow-modal`.

**Progress (2026-11-05):**
- **Batch 1 (shared UI + layouts): done.**
- **Batch 2 (dashboard): done.** Checked live in Chrome in light and dark mode. Committed in `ff249b0e`.
- **Batch 3 (People) and Batch 4 (Attendance): done.** Employee detail and Attendance were checked live in both modes.
  - The script now also handles `[class.bg-white]` bindings, `-[#hex]` arbitrary classes, neutral SVG `stroke`/`fill`, and the `white` keyword.
  - Chart or graph files, and chart-like selectors (seg, bar, legend, dot, cell, swatch, fill), keep their colored values, so legends match their charts.
  - Specs that asserted old class names were updated. Committed in `1dc4e9c2`.
- **Batch 5 (Organization), Batch 6 (Leave) and Batch 7 (Work): done.** Work Tree and Org Positions were checked live in both modes.
  - Kept fixed on purpose:
    - the `task-kind.ts` identity palette (Task teal, Bug red, …)
    - `project-card` hero overlays, which sit on a dark image in both modes
    - the colour/hue pickers
  - New rule: white elements on a selected accent row (`bg-white`, `bg-white/15`) map to `--color-text-on-solid`, never `--color-surface`. Committed in `8d5b12a5`.
- **Batch 8 (Settings, Inbox, Profile, Calendar) and Batch 9 (auth pages, device activation): done.**
  - The planner item style map is fully tokenized.
  - The task-kind palette keeps its hues but now has `dark:` variants (`bg-*-950/60`, `text-*-400`), so tinted planner and task items stay readable in dark mode.
  - The auth pages' forced-light token overrides were removed, so login, forgot/reset password and accept invitation now follow the mode.
  - Planner and Settings were checked live in dark mode.
  - **Not checked live:** the auth pages. That would need logging out, so it is left for the Phase 4 check.
- **Left as is:** the public landing pages (`modules/public`), which already have their own dark mode handled by the landing header.
- **Still to do in Phase 3:** the shadow cleanup (step 8) and the hard-coded-colour guard script.
- What is left in shared code is data: the rich-text palette, filter-bar swatches, the entity-icon registry, and the canvas `fillStyle`.

**Token mapping rules used (keep for the remaining batches):**
- **Neutral text:**
  - shades 700–900 → `--color-text-primary`
  - shades 500–600 → `--color-text-secondary`
  - shades 300–400 → `--color-text-muted`
- **White:**
  - text on a solid fill → `--color-text-on-solid`, which stays white in both modes
  - a white background → `--color-surface`
  - a chip with dark background and light text (tooltip) → `bg --color-text-primary` + `text --color-text-inverse`
- **Neutral backgrounds and borders:**
  - backgrounds at shade 50–100 → `--color-surface-secondary`
  - borders at shade 100–200 → `--color-border`
  - borders at shade 300–400 → `--color-border-strong`
- **Blue UI chrome** (links, buttons, active states) → `--color-accent`, `--color-accent-hover` and `--color-accent-subtle`.
- **Status colors:**
  - green → `--color-success`, `--color-success-text`, `--color-success-subtle`
  - red/rose → the matching `--color-danger-*` tokens
  - amber → the matching `--color-warning-*` tokens
  - violet/indigo → `--color-cat-*`
- **Chart series and legend colors stay hex.** The bar and its legend swatch must use the same value, and the utils palettes (`team-*-format.util.ts`, `segmentColor()`) are the source. A later step can move each palette, together with its CSS, to `--color-chart-*` tokens.
- **Opaque `rgb(r g b)` literals:** only neutral greys are tokenized, because colored `rgb()` values are usually series.
- **SVG** `stroke="#…"` tracks → `style="stroke: var(--color-surface-secondary)"`. Never put `var()` inside a presentation attribute.
- **Script:** `tokenize-colors.mjs` lives in the session scratchpad, and `--rgb-only` maps only the neutral `rgb()` values. Next batch, it also needs to handle the `-[#hex]` arbitrary classes and SVG attributes. For now these are fixed by hand.
- **Bundle budget:** each new token utility adds global CSS. To stay under the 500 kB initial budget, Leaflet's CSS (14.8 kB) moved out of `styles.css` into `LeafletStylesComponent`, which is rendered by the office-location picker only. The initial bundle is now 492.8 kB.

Hex colors that are **data**, not theme, stay as they are: project and leave-type colors, avatar colors, entity-icon colors, chart series chosen by the user.

Guard against new hard-coded colors: add a small script `scripts/check-hardcoded-colors.mjs` that runs in `npm run lint` and fails when a component adds new hex or gray-utility colors. It uses an allowlist file for the current leftovers, so it can be turned on in Phase 1 and the list shrinks phase by phase.

### Phase 4: Dark mode switch

1. `core/theme/models/theme-mode.model.ts`: `ThemeMode = 'light' | 'dark' | 'system'`, default `'light'`.
2. `ThemeStore`:
   - add the `mode` state and a `resolvedMode` computed value
   - add `setMode()`
   - persist to localStorage key `onevo.color.mode`, the key the landing page already uses, so the two stay in sync
   - apply both `data-mode` and the `dark` class on `<html>`
   - listen to `matchMedia('(prefers-color-scheme: dark)')` while in `system` mode
3. Prevent a flash of the wrong theme: add a tiny inline script in `src/index.html` that reads localStorage and sets `data-mode` and `data-theme` before Angular boots.
4. `AppearancePanelComponent`: add a "Mode" radiogroup above Theme Presets with **Light / Dark / System**. Use buttons with `role="radio"`, matching the preset cards and the CLAUDE.md accessibility rules.
5. `landing-header.component.ts`: replace its own DOM and localStorage code with `ThemeStore.setMode()`, so there is one source of truth.
6. Fill in the dark token values: app bg `#09090b`, card `#111113`, header `#111113`, raised `#18181b`, border `#27272a`, a stronger dark card shadow. Check status, chart and accent-subtle tokens for contrast in dark mode.

### Phase 5: Verify

- Unit tests (Vitest):
  - ThemeStore: mode persistence, `system` following matchMedia, attributes applied
  - appearance panel: renders and selects a mode
  - project row: selected has no fill
- `npm run lint` (0 warnings), `npm run check:warnings`, and `pwsh ../dev-env/scripts/verify.ps1 frontend`.
- Live check in the browser pane, in Light and Dark, for each preset: dashboard, People, Attendance, Work/projects, Inbox, Settings, popups and wizards, login. Take screenshots of each.
- Contrast check: text-secondary on `#FAFAFA` and on dark surfaces should reach WCAG AA (4.5:1).

## Order and size

| Phase | Size | Can ship alone? |
|---|---|---|
| 1 Token layer | S | Yes (no visual change) |
| 2 New light palette | S | Yes. This gives the requested look on all token-based screens immediately. |
| 3 Hard-coded color cleanup | L (≈100 files) | In batches per module |
| 4 Dark mode switch | M | Only after Phase 3 is mostly done; otherwise dark mode shows white patches |
| 5 Verify | M | Runs after each phase |

Recommended order: 1 → 2 (quick visible win) → 3 in batches → 4 → 5.

## Decisions (answered 2026-11-05)

1. Popups, dropdowns and inputs: **match the cards** (`#FAFAFA`).
2. Mode options: **Light / Dark / System**.
3. Dark mode **also applies to the auth and login pages** (Phase 3 step 7 is in scope for dark mode, and the pre-boot script in `index.html` covers them).
4. Scope: **this web app only**. `HRMS-Platform-Administration-Front-End-v1` is not touched.
