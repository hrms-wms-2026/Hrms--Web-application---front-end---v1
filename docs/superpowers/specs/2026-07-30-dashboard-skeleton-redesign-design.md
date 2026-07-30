# Design: Dashboard Skeleton Redesign (Black/White/Gray)

**Date:** 2026-07-30
**Status:** Approved
**Base reference:** [ARCHITECTURE.md](../../../ARCHITECTURE.md); prior scaffold spec
[2026-07-28-core-shared-employees-scaffold-design.md](./2026-07-28-core-shared-employees-scaffold-design.md)

## Scope

Replace the current placeholder dashboard shell (`main-layout` + `dashboard-home`) with a
clean, reusable, black/white/gray skeleton: a light-gray top navbar and sidebar, a white
main content area with a single 15px curved inner corner, and a new username-only
`HomePageProfileCapsule` in the top-right of the navbar. No business widgets, no final
branding, no backend theme loading — this is the reusable foundation other dashboard
modules will be built on top of later.

Out of scope: any new API calls, any change to auth/session logic, real navigation items,
backend-driven theme loading (structure only, per "Deltas" §3).

## Current state (removed by this change)

- `main-layout.component.html/css`: sidebar has an "ONEVO" brand block and "Navigation
  will be configured later." placeholder text; `application-shell` has a yellow
  (`#f6f603`) background; navbar shows "ONEVO Workspace" as static text.
- `dashboard-home.component.ts`: inline template showing "Welcome, {{ store.email() }}",
  a signed-in subtext, and a sign-out button that calls `AuthStore.logout()` then
  navigates to `/auth/login`.

All of the above is deleted as part of this change.

## Deltas from the original request spec

### 1. `userName` input stays unbound, not explicitly passed as `undefined`

The backend's current `AuthResponseDto`/`CurrentUserViewModel` only carries `user.email`
— there is no name field yet. `HomePageProfileCapsule` still declares an optional
`userName` input so the fallback chain (`userName → email → 'User'`) is real and
forward-compatible, but `TopNavbarComponent`/`MainLayoutComponent` simply do not bind
`[userName]` at all (rather than binding it to a literal `undefined`). When a backend
name field exists later, only the binding in `top-navbar.component.html` needs to change
— the capsule component itself does not change.

### 2. Component decomposition (chosen over inline single-file edit)

`component_structure` in the request implies `TopNavbar`/`SideNavbar`/`MainContent` are
distinct units, not one template. This spec extracts two new presentational components
alongside the existing `MainLayoutComponent`:
- `layouts/main-layout/top-navbar/top-navbar.component.{ts,html,css}`
- `layouts/main-layout/side-navbar/side-navbar.component.{ts,html,css}`

Both are standalone, `OnPush`, presentational (no store/HTTP injection, no business
logic) — matching the existing `shared/ui/{button,card,loader}` convention already used
in this codebase. `MainLayoutComponent` remains the only piece that injects `AuthStore`
(it already does), and passes `email` down as a `@Input()` to `TopNavbarComponent`.

`HomePageProfileCapsule` is new, at `shared/ui/home-page-profile-capsule/`, alongside the
other `shared/ui/*` components — it is a leaf presentational component consumed by
`TopNavbarComponent`.

### 3. Corner radius: main-content's own top-left corner, desktop only

`border-top-left-radius: var(--dashboard-content-radius)` is applied to the `.main-content`
element itself (not the navbar or sidebar). Below the existing 768px responsive breakpoint
(where the sidebar stacks above the content instead of sitting beside it), the radius is
reset to `0` — there is no side-by-side corner to notch once the layout stacks vertically,
so keeping the curve there would look like a stray, unexplained artifact.

### 4. Sidebar width unchanged

Existing `grid-template-columns: 5rem minmax(0, 1fr)` is kept as-is. Only the background
color and removal of brand/placeholder content change.

## Color system

Added to `src/styles.scss` under `:root`, as plain CSS custom properties (no SCSS
variables, so a future runtime `document.documentElement.style.setProperty(...)` call can
override them without a rebuild):

```css
:root {
  --dashboard-surface-color: #E5E7EB;
  --dashboard-background-color: #FFFFFF;
  --dashboard-text-primary: #111111;
  --dashboard-text-secondary: #6B7280;
  --dashboard-border-color: #D1D5DB;
  --dashboard-profile-background: #D1D5DB;
  --dashboard-profile-text: #111111;
  --dashboard-content-radius: 15px;
}
```

No component SCSS/CSS file hardcodes a hex value for any of these — every reference goes
through `var(--dashboard-*)`. This is the only structural change needed for future
backend-controlled theming (per the request's `future_color_configuration` — the loading
mechanism itself is explicitly **not** built in this pass, only the variable-based
structure that would let it slot in later without touching component files).

## Components to build/change

### New: `shared/ui/home-page-profile-capsule/`
- `home-page-profile-capsule.component.ts` — standalone, `OnPush`, selector
  `app-home-page-profile-capsule`. Inputs: `userName?: string`, `email?: string`.
  `displayText = computed(() => this.userName() || this.email() || 'User')` (signal
  inputs, matching existing `shared/ui` component conventions).
- `.html` — single element rendering `{{ displayText() }}`, no dropdown, no button, no
  logo.
- `.scss` — `border-radius: 999px`, `background: var(--dashboard-profile-background)`,
  `color: var(--dashboard-profile-text)`, `border: 1px solid var(--dashboard-border-color)`,
  compact horizontal padding, `display: inline-flex; align-items: center` for vertical
  centering inside the navbar.

### New: `layouts/main-layout/top-navbar/`
- Inputs: `userName?: string`, `email?: string` (passed straight through to the capsule).
- Template: empty except `<app-home-page-profile-capsule>` right-aligned via flex
  (`justify-content: flex-end` on the host row).
- Background: `var(--dashboard-surface-color)`.

### New: `layouts/main-layout/side-navbar/`
- No inputs, no content — an empty `<nav>` shell.
- Background: `var(--dashboard-surface-color)` (same variable as top navbar, per the
  requirement that both use an identical color).

### Changed: `layouts/main-layout/main-layout.component.{ts,html,css}`
- `.ts`: inject `AuthStore` (already does), read `store.email()`, pass to
  `<app-top-navbar [email]="store.email()">` — `userName` left unbound.
- `.html`: compose `<app-side-navbar>`, `<app-top-navbar>`, and the existing
  `<main id="main-content"><router-outlet /></main>` — brand block and placeholder text
  removed entirely.
- `.css`: sidebar/navbar backgrounds → `var(--dashboard-surface-color)`;
  `.application-shell` background → `var(--dashboard-background-color)` (removes the
  yellow); `.main-content` gets `border-top-left-radius: var(--dashboard-content-radius)`;
  media query for ≤768px sets that radius to `0`. Skip-link and focus-visible styles are
  kept as-is (accessibility, unrelated to this visual change).

### Changed: `modules/dashboard/feature/dashboard-home/dashboard-home.component.ts`
- Remove the welcome/email/sign-out template entirely. Replace with an empty skeleton
  content block (a single empty container, no text) so the route still resolves to a
  valid component. `ButtonComponent` import and `Router`/sign-out method are removed
  since logout is no longer exposed from this page.
- `AuthStore.logout()` itself is untouched — only this component's call site is removed,
  per the request's explicit instruction to keep logout logic intact and only remove its
  dashboard entry point.

## Testing

- `home-page-profile-capsule.component.spec.ts`: three cases — `userName` set (shows
  name), `userName` unset/`email` set (shows email), neither set (shows `'User'`).
- `main-layout.component.spec.ts` (new or extended): renders without the removed
  "ONEVO"/"Navigation will be configured later" text; confirms `app-top-navbar` and
  `app-side-navbar` are present.
- `dashboard-home.component.spec.ts` (existing, updated): no longer asserts on welcome
  text/email/sign-out button; confirms the component renders without error.

## Out of scope for this pass

- Backend theme-loading (fetching color config, calling `setProperty` after auth/init) —
  structure (CSS custom properties) is ready for it, but no loading code is written.
- Real navigation items in the sidebar.
- Any change to `AuthStore`, `AuthApiService`, guards, or interceptors.
- Widening the sidebar or otherwise changing its grid width.
- Any alternate sign-out entry point (e.g. a future settings/profile menu) — out of
  scope; noted only as a follow-up possibility, not built here.

## Implementation corrections (2026-07-30, pre-build)

Four corrections identified before implementation, applied on top of the design above:

1. **Signal-input typing**: inputs are `input<string | null>()` (not `string`), with
   `readonly` modifiers, and the fallback chain trims each candidate:
   `this.userName()?.trim() || this.email()?.trim() || 'User'`.
2. **Corner visibility bug**: the original plan set `.application-shell` (the wrapper
   around navbar + main-content) to `var(--dashboard-background-color)` (white) — with a
   white wrapper directly behind a white rounded main-content box, the curve would be
   invisible. Corrected: the grid container itself carries
   `background: var(--dashboard-surface-color)` (gray), so the rounded corner's revealed
   triangle shows gray behind the white content box. `.main-content` also gets
   `overflow: hidden` so routed page content can never render past its own rounded corner.
3. **Explicit grid areas**: the nested two-level grid (outer sidebar/shell, inner
   navbar/main) is replaced with one flat grid on `.main-layout` using named
   `grid-template-areas` (`"sidebar navbar" / "sidebar main"` desktop,
   `"navbar" / "sidebar" / "main"` mobile). This removes the `.application-shell` wrapper
   entirely — `app-side-navbar`, `app-top-navbar`, and `.main-content` become direct grid
   children of `.main-layout`.
4. **Long-email safety**: the profile capsule gets `max-width: 18rem`,
   `text-overflow: ellipsis`, `white-space: nowrap`, `overflow: hidden`, plus
   `[title]="displayText()"` so the full value is still available on hover/assistive tech
   even when visually truncated.

`.scss` was requested again for the capsule/global stylesheet in the correction request;
kept as `.css` per the already-established finding that this repo has no Sass tooling
installed (no `sass` devDependency, no `.scss` file anywhere) — introducing `.scss` now
would silently fail to compile. This is a repeated, deliberate deviation, not an
oversight.
