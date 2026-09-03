# Part 1: Projects list rows + explanation panel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. One commit per numbered task.

**Goal:** Replace the `/work` card grid with a selectable single-row list and a side explanation card.

**Spec:** `docs/superpowers/specs/next/2026-08-20-work-management-project-page-redesign-design.md`

**Status:** pending

## Global Constraints

- Touch `src/app/modules/work/**`, `src/app/shared/ui/progress-bar/**` (new), and `docs/core/ARCHITECTURE.md` (work tree). Import `app-breadcrumb-header` — do not edit `layouts/`, `organization/`, `people/`.
- Do not `ng serve` / kill the running `ng s` process. Tests: `npx vitest run <file>`.
- Current branch as-is. One commit per task. Do not push.

## Tasks

### Task 1: `app-progress-bar`

**Files:** Create `src/app/shared/ui/progress-bar/progress-bar.component.ts` + `.spec.ts`

- [ ] Linear bar mirroring `milestone-tree-node` track/fill. Inputs: `progress` (number, clamp 0–100). `data-testid="progress-bar"`, fill `data-testid="progress-fill"` with `[style.width.%]`.
- [ ] Tests: 40 → fill width 40%; 150 clamps to 100; −10 clamps to 0.
- [ ] Commit: `feat(work): add a linear progress bar for project hour completion.`

### Task 2: `ProjectListRowComponent`

**Files:** Create `src/app/modules/work/ui/project-list-row/project-list-row.component.ts` + `.spec.ts`

- [ ] Dumb UI. Inputs: `project: Project`, `selected: boolean`. Output: `selectedChange`. Row button `data-testid="project-list-row"`. Name, `app-employee-avatar [employeeId]="project.leadId"`, `app-progress-bar` with `allocatedHours === 0 ? 0 : round(completedHours/allocatedHours*100)`.
- [ ] Selected: accent-tinted background (`bg-[var(--color-accent)]/10` + ring), unselected: border + hover surface.
- [ ] Provide `EmployeeDirectoryStore` stub in tests (`get: () => undefined`, `ensureLoaded: vi.fn()`).
- [ ] Commit: `feat(work): add a selectable project list row with owner avatar and hours bar.`

### Task 3: `ProjectExplanationCardComponent`

**Files:** Create `src/app/modules/work/ui/project-explanation-card/project-explanation-card.component.ts` + `.spec.ts`

- [ ] Dumb UI. Input: `project: Project`. Outputs: `viewed`, `achieveRequested`, `settingsRequested`, `membersRequested`.
- [ ] Shows name, identifier, description (if any), start/target, allocated/completed hours, `app-avatar-stack` when `members.length > 0`.
- [ ] View always. Achieve only when `isLead && !isAchieved` (`data-testid="achieve-button"`). Settings gear only when `isLead`. Member button only when `isLead` (`app-member-button`).
- [ ] Commit: `feat(work): add the project explanation side card.`

### Task 4: Rewire `ProjectListComponent`

**Files:** Modify `project-list.component.ts` + `.html` + `.spec.ts`. Update `docs/core/ARCHITECTURE.md` work tree: add `project-list-row/`, `project-explanation-card/`; note list no longer uses `project-card` (file stays).

- [ ] Replace hand-built header with `<app-breadcrumb-header parentLabel="Work" currentLabel="Projects" icon="work" />`. Keep filter bar + Create on the next row.
- [ ] `selectedProjectId = signal<string | null>(null)`. `selectedProject = computed(() => { const list = this.store.filteredProjects(); if (!list.length) return null; return list.find(p => p.id === this.selectedProjectId()) ?? list[0]; })`.
- [ ] Two-column layout when projects exist: left rows, right explanation card (sticky). Auto-select first. Clicking a row sets `selectedProjectId`.
- [ ] Wire view → `onView`, achieve → `store.achieveProject`, settings → existing settings modal. `membersRequested` no-op until Part 3 (still emit from the card).
- [ ] Tests: breadcrumb present; no `app-project-card`; first project name in the explanation card; clicking a second row selects it (add a second project in the stub). Keep create/settings/empty/loading tests green — create payload can still include `releaseDate` until Part 2.
- [ ] Commit: `feat(work): replace the project card grid with a list and explanation panel.`
