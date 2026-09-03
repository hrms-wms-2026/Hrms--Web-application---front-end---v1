# ONEVO HRMS — Complete Design System & UI/UX Refresh Documentation

> **Project Target:** `C:\Users\User\Desktop\build\Hrms--Web-application---front-end---v1`  
> **Scope:** 100% Visual Design, Theme Styling, Color Palettes, Shadow Elevation, and Icon Theme System  
> **Strict Directive:** **ZERO modifications to component TypeScript logic, data flow, API integration, routing, or state stores.**

---

## 1. Design Documentation Index (`docs/design/`)

This directory contains the full visual design analysis and theme specifications extracted from analyzing the ONEVO HRMS frontend application:

1. **[`README.md`](file:///c:/Users/User/Desktop/build/Hrms--Web-application---front-end---v1/docs/design/README.md):** High-level overview, folder contents, and design principles (this file).
2. **[`COLOR_PALETTES.md`](file:///c:/Users/User/Desktop/build/Hrms--Web-application---front-end---v1/docs/design/COLOR_PALETTES.md):** 5 theme presets (Default Blue, Emerald Green, Violet, Rose, Slate), surface color tokens, and light/dark mode specs.
3. **[`ICON_THEME_SYSTEM.md`](file:///c:/Users/User/Desktop/build/Hrms--Web-application---front-end---v1/docs/design/ICON_THEME_SYSTEM.md):** Native inline SVG vector icon system, stroke widths (`1.8px`, `2.0px`, `2.5px`), sizing hierarchy (`12px` to `24px+`), color inheritance via `currentColor`, and icon categories across the app.
4. **[`COMPONENT_SHADOWS_AND_ELEVATION.md`](file:///c:/Users/User/Desktop/build/Hrms--Web-application---front-end---v1/docs/design/COMPONENT_SHADOWS_AND_ELEVATION.md):** Elevation hierarchy (Levels 0–4), soft card shadow themes, backdrop glassmorphism (`backdrop-filter: blur(12px)`), focus rings, corner radii, and micro-interaction hover states.
5. **[`COMPONENT_DESIGN_RULES.md`](file:///c:/Users/User/Desktop/build/Hrms--Web-application---front-end---v1/docs/design/COMPONENT_DESIGN_RULES.md):** Strict boundary rules for visual-only modifications without breaking component TS controllers or data communication.

---

## 2. Executive Summary of Frontend Visual Architecture

- **Color Theme Engine:** Controlled dynamically via custom CSS properties in `src/app/shared/styles/theme-tokens.css` switching root attributes `html[data-theme]` and `html[data-mode]`.
- **Vector Icons System:** Built entirely on SVG outline vectors (`Lucide`-style) inheriting `currentColor` so icons dynamically color match primary text, muted text, or theme accents.
- **Glass & Elevation Aesthetics:** Modern SaaS feel utilizing subtle glassmorphic backdrop filters, soft drop shadows (`--color-card-shadow`), clean border lines (`--color-border`), and rounded container corners (`12px`).
- **Responsive Layout Shell:** Fluid top header, responsive sidebar navigation, interactive modal popups, and modular domain views (Auth, Dashboard, Work Management).
