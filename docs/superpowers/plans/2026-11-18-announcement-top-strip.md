# Announcement Top Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show CROWNUS announcements in the tenant app as a full-width coloured strip above the header on every page (DEC-053, option B).

**Architecture:** The existing `AnnouncementBannerComponent` keeps its feed (`GET api/v1/announcements/active`) and its in-memory dismiss. Only its look changes, and `MainLayoutComponent` moves it out of the content viewport into a new top grid row.

**Tech Stack:** Angular 20 standalone components, signals, Tailwind, Vitest (`ng test`).

**Spec:** the short design approved in chat on 2026-11-18 (DEC-053). Its points:
- A solid strip per announcement. Info is blue, warning is amber with dark text, and critical is red. Each strip has a severity icon, a bold title, a one-line body with More/Less, and an ✕ to dismiss (any severity).
- Several announcements stack in this order: critical, then warning, then info.
- The strip shows even while the tray gate locks the workspace. Announcements carry no tenant data.
- Dismiss lasts for the page session only (DEC-052 is still pending).
- There is no backend change, and no "shown until" time (the tenant feed has no dates).

## Global Constraints

- No hard-coded colours in components (`npm run lint` runs `scripts/check-hardcoded-colors.mjs`). The strip's fills come from new `--color-notice-*` tokens in `src/app/shared/styles/theme-tokens.css`.
- Body text on every fill must reach at least 4.5:1 contrast:

  | Fill token | Value | Text | Contrast |
  |---|---|---|---|
  | info | `#1d4ed8` | white | about 6.7:1 |
  | warning | `#f59e0b` | `#1c1917` | about 9:1 |
  | critical | `#b91c1c` | white | about 6.5:1 |

- Accessibility:
  - Critical announcements use `role="alert"`; the others use `role="status"`.
  - The dismiss button keeps the aria-label `Dismiss announcement: <title>`.
  - The More button has `aria-expanded`.

## Review Focus

- A long body without spaces must not push the ✕ off-screen: it wraps or clamps with `min-w-0` and `break-words`.
- On mobile, the strip sits above the top navbar in the flex column layout.
- In dark mode and the mono preset, the strip keeps its own tokens, not `--color-text-on-solid`.
- Dismissing one of several announcements leaves the others.

---

### Task 1: Strip look, order and More toggle

**Files:**
- Modify: `src/app/layouts/main-layout/announcement-banner/announcement-banner.component.{ts,html}`
- Modify: `src/app/shared/styles/theme-tokens.css` (add 5 `--color-notice-*` tokens to `:root`)
- Test: `src/app/layouts/main-layout/announcement-banner/announcement-banner.component.spec.ts`

**Interfaces:**
- Produces: each strip is a `[data-testid="announcement-strip"]` element with `data-severity`. Each strip has a `[data-testid="announcement-icon"]` and a More button `[data-testid="announcement-more"]`. The More button renders only when the body is longer than 90 characters or contains a line break.

- [ ] **Step 1: Write the failing tests.** Add four tests:
  - strips are ordered critical, warning, info, each with `data-severity`;
  - each strip has an icon;
  - More toggles `aria-expanded` and the clamp;
  - there is no More button on a short body.
- [ ] **Step 2:** Run `npx ng test --include src/app/layouts/main-layout/announcement-banner` and confirm the new tests FAIL.
- [ ] **Step 3:** Implement the tokens, `sorted` computed, `expanded` signal set, the template and the icons.
- [ ] **Step 4:** Run the same command and confirm everything PASSES (the three existing tests too).

### Task 2: Move the strip to the top of the layout

**Files:**
- Modify: `src/app/layouts/main-layout/main-layout.component.{html,css}`
- Test: `src/app/layouts/main-layout/main-layout.tray-presence.spec.ts`

- [ ] **Step 1: Write the failing test.** `app-announcement-banner` is the first element child of `.main-layout` and is present while the workspace is gated.
- [ ] **Step 2:** Run `npx ng test --include src/app/layouts/main-layout` and confirm the test FAILS.
- [ ] **Step 3:** Move `<app-announcement-banner class="main-layout__banner" />` to the first child of `.main-layout`. Add a `banner` grid row:
  - normal layout: rows `auto auto minmax(0,1fr)`, areas `"banner banner" "rail navbar" "rail main"`;
  - sub-sidebar layout: `"banner banner banner"`;
  - mobile: the flex column already puts it first.
- [ ] **Step 4:** Run the layout specs, `npm run lint` and `npx ng build`, and confirm all PASS.
- [ ] **Step 5:** Check the real app at 4200 with an info, a warning and a critical announcement. Then commit and push `feat/platform-support-module`.
