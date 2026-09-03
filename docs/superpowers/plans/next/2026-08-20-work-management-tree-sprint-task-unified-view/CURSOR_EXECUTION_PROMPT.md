# Cursor execution prompt — Unified Tree (Objective→Sprint→Task) Frontend, Parts 4-7

Copy-paste this whole file as your instruction to Cursor.

---

Repo: `Hrms--Web-application---front-end---v1`. Current branch, no new branch needed.

**Already shipped, do not redo:** Parts 1-3 (node model + lazy Sprint/Task nesting, per-row create/edit/
members icons, removal of the old Modules carousel + side detail panel) — all landed and committed
(`905a9bb`..`076321e`) before this prompt was written. Each of `part-1-*.md`/`part-2-*.md`/`part-3-*.md`
now has a status header explaining exactly what shipped and, for Part 3 specifically, that its "remove the
side panel" decision has been REVERSED by Part 6 below — read those status headers, not just the old task
lists, before touching anything they describe.

**Spec (read in full before starting Part 4):**
`HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-tree-sprint-task-unified-view-design.md`
§4 (rewritten 2026-08-21 for the expanded requirement — 6/4/2 icon sets, project-wide tree, restored panel,
delete task, sprint-optional task creation).

**Plan parts, strict order:**
4. `part-4-project-wide-tree-data-source.md` — **hard-blocked on the backend repo's Part 3
   (`part-3-enrich-objective-tree-response.md`) shipping first.** Check `HRMS-Backend-v1`'s git log for that
   commit before starting; if it hasn't shipped, stop and say so rather than guessing at the response shape.
5. `part-5-module-sprint-task-row-components.md` — depends on Part 4's real per-node `isOwner` flag.
6. `part-6-restore-explanation-panel.md` — depends on Part 5's `kind`-based row components existing to
   mirror their content/actions.
7. `part-7-delete-task-and-sprint-optional-create.md` — **hard-blocked on the backend repo's Part 4
   (delete-task) AND Part 5 (sprint-optional create) both shipping first.** Same check as above.

## Hard scope rule

Work Management module only: `src/app/modules/work/**`. Never touch `organization`, `layouts/main-layout`,
`public`, admin/platform modules — a teammate owns those. Never run a dev server or kill a running node/ng
process without asking first — it may belong to someone else's session.

## Process discipline

Test-first, one task = one commit, run `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'`
after every task and confirm green before moving on. Go from Part 4 → 5 → 6 in sequence without stopping
for approval as long as tests stay green and the backend dependencies for the current part have actually
shipped (check, don't assume); stop before Part 7 and confirm both its backend blockers have landed. Stop
and flag clearly if a file the plan describes doesn't match what you actually find in the repo — trust the
real code over the plan's description.

## Things worth knowing

- **Part 4's fetch-plus-filter shape is confirmed with the user, not a guess** — the Tree tab fetches the
  caller's entire reachable project tree once, but renders it through a client-side Module filter dropdown
  defaulting to the active module (`:milestoneId`), so it looks like today's single-module view until the
  user deliberately widens it. Don't skip the filter component thinking the project-wide fetch alone
  satisfies the requirement — both pieces were explicitly requested together.
- **Part 5's `isOwner` row-level gate is a harder rule than what shipped in Part 2.** Part 2 gated icons
  individually per-icon; Part 5 hides ALL of a Module or Sprint row's icons together when
  `!node().isOwner`, except Task rows, where Edit stays ungated and only Delete is gated — this asymmetry
  is deliberate (matches how Task edit already works today), don't "fix" it into a uniform rule.
  Re-read Part 5's `TaskTreeRowComponent` section if this seems inconsistent.
- **Part 5's Delete-task icon and Part 7's Sprint-optional "Add task" icon are deliberately split across
  two parts.** Part 5 builds and tests the UI (icon, gating, event bubbling) with the actual API call
  stubbed as a no-op, specifically so Part 5 doesn't need to wait on backend work that hadn't shipped when
  this plan was written. By the time you reach Part 7, verify the backend blockers really have shipped
  before wiring the real calls — don't silently wire them against an endpoint that isn't there yet.
- **Part 6 reuses Part 5's output names on purpose** (`editRequested`, `achieveSprintRequested`, etc.) so
  `MilestoneTreeTabComponent`'s Part-5 handlers can be bound a second time to the panel's emitters instead
  of writing parallel handler logic — don't invent differently-named outputs for the panel.
- **`ProjectExplanationCardComponent` styling convention**: Tailwind utility classes inline in the
  template, no external `.scss`, no `styles: []` array. Match this exactly in the new
  `TreeExplanationPanelComponent` (Part 6) for visual consistency with the Project List page's card, which
  the user explicitly referenced as the restyle target.

## When you finish

Run the full `npx ng test --watch=false --include='**/modules/work/**/*.spec.ts'` suite one more time after
Part 7. Report the final test count and anything flagged mid-way. **Do not consider this feature done on
green tests alone** — per this session's own repeated experience (three separate bugs on the Project Page
Redesign work were caught only by manual testing, not by green tests), a full manual browser pass is
required: verify project-wide tree visibility for a multi-module owner, verify an ancestor-only module
renders with zero icons, verify each row kind's full icon set and the explanation panel's matching content,
verify delete-task and sprint-less task creation actually work end-to-end against the live backend. Leave
both plan folders (this repo and `HRMS-Backend-v1`) in `plans/next/` until that manual pass happens and the
user confirms — only then should either move to `finished/`.
