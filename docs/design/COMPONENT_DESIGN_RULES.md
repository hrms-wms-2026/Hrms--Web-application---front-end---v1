# ONEVO HRMS — Component Design Rules & Strict Boundary Guidelines

## Strict Implementation Rules

1. **NO Logic Edits:**
   - Do NOT edit `.ts` controller logic, signal stores, state services, HTTP interceptors, form validators, or routing logic.
   - Component state management, event listeners, `@Input()`, `@Output()`, function calls, and data bindings MUST remain 100% unchanged.

2. **Styling & Visual Design Focus ONLY:**
   - Modify CSS files (`src/styles.css`, `theme-tokens.css`, component CSS files).
   - Enhance HTML class attributes (Tailwind utility classes, custom structural CSS classes).
   - Refine colors, typography, paddings, margins, subtle animations, hover states, shadow depths, borders, and rounded corners.

3. **Theme & Token Usage:**
   - Use CSS custom variables (`var(--color-...)`) for backgrounds, borders, accents, text colors, and shadows to support theme switching seamlessly.
   - Maintain a cohesive aesthetic across Auth pages, Navigation Shell, Dashboard, and Module views.
