# "Milestone" → "Module" Display-Text Rename (Frontend) — Design

**Status:** Approved 2026-08-12 (scoped through direct back-and-forth with the user, no visual mockup needed). No plan written yet.

## Problem

The user's manager doesn't like the product-facing term "Milestone" and asked for it to be changed to "Module". Scoped down from an initial "rename everywhere" ask to **display text only** — component/class/file/route/DTO names stay as `Milestone*`/`milestones` throughout the codebase; only the literal strings a user sees change to "Module"/"module".

**Why display-text-only, not a full identifier rename:** The backend's actual domain entity for this concept is `Objective` (`Objective.cs`, `objective_change_requests` table, `/api/v1/work/objectives/...` routes) — "Milestone" is already a product-layer term bolted on top of that internal name, not the other way around. The user confirmed the same pattern should apply here: keep `MilestoneCardComponent`, `MilestoneTreeNodeComponent`, `MilestoneSubMenuComponent`, `milestone.model.ts`, the `/milestones/:milestoneId` route segment, etc. exactly as they are — a full rename would touch dozens of files, routes, and the backend's `objectives_milestones` module permission key for zero user-facing benefit beyond what a 6-string text swap already achieves.

## Scope

### In scope — 6 literal strings, 4 files, all under `src/app/modules/work/**`

| File | Line | Current | New |
|---|---|---|---|
| `feature/project-detail/project-detail.component.html` | 31 | `<app-loader label="Loading milestones…" />` | `label="Loading modules…"` |
| `feature/project-detail/project-detail.component.html` | 35 | `<app-empty-state title="No milestones yet" />` | `title="No modules yet"` |
| `ui/milestone-card/milestone-card.component.ts` | 40 | `aria-label="Milestone settings"` | `aria-label="Module settings"` |
| `ui/milestone-settings-modal/milestone-settings-modal.component.ts` | 13 | `title="Milestone settings"` (modal title) | `title="Module settings"` |
| `ui/milestone-settings-modal/milestone-settings-modal.component.ts` | 35 | "...the Default **Milestone** follows the project's own achieved state" | "...the Default **Module** follows the project's own achieved state" |
| `state/project-detail.store.ts` | 58 | `extractError(err, 'Failed to load milestones.')` | `extractError(err, 'Failed to load modules.')` |

Confirmed via grep across `src/app/modules/work/**`, `src/app/layouts/main-layout/**` — these are the only 6 spots where the literal word "Milestone"/"milestone" reaches a template, `aria-label`, `title` attribute, or user-facing error string. Everything else matching "milestone" in the codebase (33 files total) is a component/class/selector/file/route/property name, which stays unchanged per the scope decision above.

### Explicitly out of scope

- Any `Milestone*` component, class, file, or folder name.
- The `/milestones/:milestoneId` route segment and all `milestoneId`/`milestones` property, variable, and method names (`activeMilestoneId`, `loadMyMilestones`, `MilestoneDto`, etc.).
- The nav-gating module key `'objectives_milestones'` in `nav-items.config.ts` (`requiredModules` array) — this must stay in sync with the backend's `module_catalog.module_key`, which the companion backend design (`HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-12-milestone-to-module-display-rename-design.md`) also leaves unchanged.
- Test file names/descriptions that mention "Milestone" (e.g. `milestone-settings-modal.component.spec.ts:31`'s test title "disables the Achieved toggle for the Default Milestone") — cosmetic only, not required, left as-is to keep the diff minimal.
- Any module outside Work Management.

## Testing

No test currently asserts on the exact string content of these 6 spots (confirmed by grep — no `.toBe('Loading milestones…')`-style assertions exist). The 6 edits are plain string literal changes with no logic change, so no new tests are required; existing component/store specs continue to pass unmodified. A quick manual check (empty project, loading state, milestone-settings modal open) confirms the new text renders.

## Companion change

Backend: `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-12-milestone-to-module-display-rename-design.md` — one-row DB migration changing `module_catalog.name` from "Objectives & Milestones" to "Objectives & Modules" for `module_key = 'objectives_milestones'` (key unchanged). No frontend change depends on that migration landing first or vice versa — the two are independent and can ship in either order.
