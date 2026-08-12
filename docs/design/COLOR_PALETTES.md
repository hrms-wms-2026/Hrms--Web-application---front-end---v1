# ONEVO HRMS — Color Palettes & Theme System

## 1. Theme Presets

ONEVO HRMS supports 5 dynamic color theme presets powered by CSS variables on `html[data-theme]` and `html[data-mode]`.

| Preset | Accent Hex | Subtle Hex | Hover Hex | Sidebar Dark Hex | Focus Ring Hex |
|---|---|---|---|---|---|
| **Default (Blue)** | `#2563eb` | `#dbeafe` | `#1d4ed8` | `#0f172a` | `#93c5fd` |
| **Emerald** | `#059669` | `#d1fae5` | `#047857` | `#052e2b` | `#6ee7b7` |
| **Violet** | `#7c3aed` | `#ede9fe` | `#6d28d9` | `#1e1033` | `#c4b5fd` |
| **Rose** | `#e11d48` | `#ffe4e6` | `#be123c` | `#2b0a13` | `#fda4af` |
| **Slate** | `#475569` | `#e2e8f0` | `#334155` | `#0b1120` | `#94a3b8` |

---

## 2. Light vs. Dark Surface Design Tokens

### Light Mode (`:root`)
- **App Background:** `#fafafa`
- **Primary Surface:** `#ffffff`
- **Secondary Surface:** `#f4f4f5`
- **Text Primary:** `#09090b`
- **Text Secondary:** `#71717a`
- **Border:** `#e4e4e7`

### Dark Mode (`html.dark`, `[data-mode='dark']`)
- **App Background:** `#09090b`
- **Primary Surface:** `#18181b`
- **Secondary Surface:** `#27272a`
- **Text Primary:** `#f4f4f5`
- **Text Secondary:** `#a1a1aa`
- **Border:** `#27272a`

---

## 3. Typography Rules

- **Primary Sans:** `'Plus Jakarta Sans'`, sans-serif (Headings, Body, Buttons, Inputs)
- **Display Serif:** `'Instrument Serif'`, serif (Selected Hero metrics / Headings where specified)
