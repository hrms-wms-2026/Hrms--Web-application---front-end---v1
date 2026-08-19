# ONEVO HRMS — Component Shadows, Surfaces & Elevation System

> **Visual Elevation Architecture:** Multi-layered surface hierarchy combining CSS custom variables, soft ambient shadows, glassmorphism blurs, and crisp border tokens.

---

## 1. Elevation Scale & Shadow Themes

The project uses a structured shadow and surface elevation system that adjusts dynamically between **Light Mode** and **Dark Mode** via `theme-tokens.css`.

| Elevation Level | Variable / CSS Token | Light Mode Value | Dark Mode Value | Usage |
|---|---|---|---|---|
| **Level 0 (Flat Ground)** | `--color-app-bg` | `#fafafa` | `#09090b` | Main application backdrop body |
| **Level 1 (Base Surface)** | `--color-surface` | `#ffffff` | `#18181b` | Cards, tables, secondary containers |
| **Level 2 (Elevated Card)** | `--color-card-shadow` | `rgba(0, 0, 0, 0.04)` | `rgba(0, 0, 0, 0.5)` | KPI cards, project cards, list items |
| **Level 3 (Floating Popover)** | Popover / Dropdown Shadow | `0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05)` | `0 10px 25px -5px rgba(0,0,0,0.7)` | Select dropdowns, popover menus |
| **Level 4 (Modal Overlay)** | `--color-glass-bg` & Glass | `rgba(255, 255, 255, 0.68)` | `rgba(18, 18, 20, 0.72)` | Modal dialog backdrops, top sticky header blur |

---

## 2. Glassmorphism & Backdrop Blur Specifications

For modern SaaS UI depth, sticky headers, top navigation, and modal backdrops utilize glassmorphism styling:

```css
.glass-panel {
  background-color: var(--color-glass-bg);
  border: 1px solid var(--color-glass-border);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
```

- **Light Mode Glass:** `rgba(255, 255, 255, 0.68)` background with `rgba(0, 0, 0, 0.08)` border.
- **Dark Mode Glass:** `rgba(18, 18, 20, 0.72)` background with `rgba(255, 255, 255, 0.12)` border.

---

## 3. Border Radii & Border Tokens

Consistent corner smoothing builds a cohesive visual appearance across all component sizes:

- **Global Content Radius (`--radius-content`):** `12px` (Cards, Modals, Major container panels)
- **Component Small Radius:** `6px` – `8px` (Buttons, Form Inputs, Badges, Dropdown menus)
- **Pill / Circular Radius:** `9999px` (Avatars, Status Pill Capsules, Filter Chips)
- **Border Variable (`--color-border`):** `#e4e4e7` (Light Mode) / `#27272a` (Dark Mode)

---

## 4. Interactive States & Focus Rings

### Focus Ring Tokens
Every interactive input, button, and selectable tile uses theme-aware focus indicators to meet WCAG AA accessibility while preserving visual elegance:

- **Focus Ring CSS Variable:** `var(--color-focus-ring)`
- **Preset Variants:**
  - Blue (Default): `#93c5fd`
  - Emerald: `#6ee7b7`
  - Violet: `#c4b5fd`
  - Rose: `#fda4af`
  - Slate: `#94a3b8`

### Hover & Active Micro-Interactions
- **Button Hover Scale:** `transform: translateY(-1px);` with `transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);`
- **Active Click State:** `transform: translateY(0px) scale(0.98);`
- **Card Hover Elevation:** Soft shadow expansion from `0 1px 3px rgba(0,0,0,0.05)` to `0 8px 20px -4px rgba(0,0,0,0.08)`.
