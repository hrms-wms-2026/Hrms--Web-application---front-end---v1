# ONEVO HRMS — Icon Theme & SVG Vector System

> **Icon Architecture:** Lucide-Style Native Inline SVGs  
> **Type:** Lightweight, vector stroke-based SVG icons with zero external icon font overhead.

---

## 1. Icon Technical Specification

All icons across ONEVO HRMS follow uniform SVG technical properties to ensure crisp rendering at high-DPI displays and instant CSS theme adaptability:

```html
<svg 
  viewBox="0 0 24 24" 
  width="16" 
  height="16" 
  fill="none" 
  stroke="currentColor" 
  stroke-width="2" 
  stroke-linecap="round" 
  stroke-linejoin="round"
  aria-hidden="true"
>
  <!-- Vector paths -->
</svg>
```

### Key Technical Attributes
- **ViewBox Standard:** `0 0 24 24` (uniform 24x24 coordinate grid)
- **Fill Standard:** `none` (outline vector stroke representation)
- **Stroke Color:** `currentColor` (automatically inherits text color, `--color-accent`, or parent text theme)
- **Stroke Width Variants:**
  - `1.8px` — Feature icons / Large hero graphics
  - `2.0px` — Standard UI icons (Buttons, Table actions, Form inputs, Sidebar navigation)
  - `2.5px` — High-visibility checkmarks & radio selection indicators
- **Line Joins & Caps:** `stroke-linecap="round"`, `stroke-linejoin="round"` for smooth, rounded corner curves.

---

## 2. Icon Sizing Hierarchy

| Scale Tier | Dimension (Width × Height) | Application Example |
|---|---|---|
| **Micro (12px)** | `12px × 12px` | Small inline badges, lock indicators, tab status sub-icons |
| **Small (14px – 15px)** | `14px × 14px` | Table row action buttons, dropdown caret arrows, metric trends |
| **Standard (16px – 18px)** | `16px × 18px` | Button icons, form field input prefix icons, modal headers, list items |
| **Medium (20px – 22px)** | `20px × 22px` | Main Navigation Sidebar items, section titles, card header actions |
| **Large (24px +)** | `24px × 24px` | Empty state visual graphics, modal alert banners, landing feature pillars |

---

## 3. Icon Theme Categories & Usage in Codebase

### 3.1 Navigation & Section Icons
- **Home / Dashboard:** `path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"`
- **Organization / Work:** `rect width="20" height="14" x="2" y="7" rx="2"`
- **Employees / Users:** `path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"` + `circle cx="9" cy="7" r="4"`
- **Settings / Preferences:** `path d="M12.22 2h-.44a2 2 0 0 0-2 2..."`

### 3.2 Action & Status Icons
- **Checkmark (Active/Selected):** `<polyline points="20 6 9 17 4 12" />`
- **Edit / Pencil:** `<path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />`
- **Delete / Trash:** `<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6..." />`
- **Close / Dismiss:** `<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />`
- **Warning / Alert:** `<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94..." />`

---

## 4. Design Guidelines for Icon Styling Updates

1. **Color Inheritance:** Always maintain `stroke="currentColor"` so icons dynamically color match primary text, muted text, or accent blue/emerald/violet/rose/slate on hover.
2. **Padding & Alignment:** Wrap icons in flex containers with `display: inline-flex; align-items: center; justify-content: center;`.
3. **Animations:** For interactive icons (e.g. drop caret arrows or expandable tree node arrows), apply smooth rotation transitions: `transition: transform 0.2s ease; transform: rotate(90deg);`.
