# WM Project Network View — design

Date: 2026-10-19
Repos: `HRMS-Backend-v1` (new query + endpoint) and `Hrms--Web-application---front-end---v1` (new view).

## Intent

Work Management's project page opens on the **Tree** tab: a file-explorer list of modules with a
details/explanation card on the right. It reads well for "what is under what", badly for "how does
this project hang together" — how many modules, who owns them, which ones are in trouble, how far
along each is.

The People module already has the picture that answers that: the **Work Network** explorer
(`src/app/modules/people/ui/work-network-graph/explorer/`) — a d3-force graph with the employee in
the centre, projects and modules orbiting, task cards revealed on hover/click, pan/zoom, minimap and
a details panel. It was built for one employee's footprint.

This project adds the same picture to Work Management, rooted on a **project** instead of an
employee, as a second view of the Tree tab that the user switches to.

## Goals

- A project-rooted network view on the WM project page, switchable from the Tree tab.
- Reuse the existing explorer wholesale — canvas, layout, detail panel, pan-zoom, minimap.
- Two project-specific signals on the node circles:
  - a module that has a monitoring alert (the red dot in today's tree) draws its **whole circle red**;
  - every module draws a **ring progress** on its circle outline — grey track, theme-colour arc for
    the completed share of allocated hours; 100% means the full ring is theme colour.
- One backend call feeds the view.

## Non-goals

- Changing the Tree view. It stays exactly as it is, explanation card included.
- Sprint nodes. v1 goes module → task, like the employee view. (See "Decisions".)
- New permission rules. The view shows what the viewer can already see in the tree.
- Editing from the graph (drag to re-parent, create, assign). Read-only in v1.

## Anti-goals — what makes this a failure even if it works

**Any observable change to the employee Work Network.** This is the hard constraint the user stated
twice. The friend who owns `modules/people/ui/work-network-graph/` must see their feature render and
behave byte-for-byte as it does today. Every edit to their files is additive and opt-in; the
employee view passes none of the new inputs and therefore takes none of the new behaviour. Their
existing specs must pass untouched, and no existing spec may be edited to accommodate this work.

A second failure: forking the explorer. A copied canvas that drifts from theirs is worse than no
feature.

## Constraints

- **Reuse first.** Create a new component only where nothing exists to reuse. The user was explicit.
- **Do not move the explorer to `shared/`.** It stays in `modules/people/…`; Work Management imports
  it from there. The user declined the move.
- **Scope: Work Management only** — plus the minimal additive edits to the explorer named below.
  No other module of the friend's is touched.
- Angular zero-warnings rule applies (`npm run check:warnings` before FE commits).
- Backend: existing WM conventions — feature folder, MediatR query + handler, architecture tests,
  unit tests per handler.

## What the user sees

The Tree tab toolbar (the row holding search, the avatar filter, the filter bar, *Expand all*,
*Create module*) gains a **view switch**. Tree is the default; switching puts the network canvas
where the tree list is.

In network mode:

- **Centre:** the project's root module (the default objective — "The Hardware integration portal"
  in the user's screenshot). Sub-modules orbit it, their children beyond them.
- **Nodes:** the explorer's existing circles, labels and summaries, plus the two new signals above.
- **Tasks:** revealed as cards beside a module on hover, pinned on click — the explorer's existing
  behaviour, unchanged.
- **Click a node:** the explorer's own `work-network-detail-panel` opens on the right.
- **Depth:** exactly what the viewer already sees in the Tree tab — no new rule. That rule, read off
  `GetObjectiveTreeQueryHandler`, is: **every active project member sees the full module tree.**
  Visibility is *not* scoped by where the caller holds membership; `ProjectModuleTree.AtOrBelow`
  only drives the per-node `IsOwner` flag. Tasks are different — they are scoped, by
  `TaskAccessResolver` (`WorkTaskVisibilityScopes.Assignees` keeps private tasks out), and the
  project graph must apply that filter to its task nodes.

## Backend

A new feature folder `Features/WorkManagement/ProjectWorkGraph/`, mirroring the shape of
`EmployeeWorkGraph/`:

- `GET /api/v1/work/projects/{id}/work-graph`
- `GetProjectWorkGraphQuery` / `…Handler`
- Response: a new `ProjectWorkGraphResponse` record with the same three members as
  `EmployeeWorkGraphResponse` (`Nodes`, `Links`, `HiddenTaskCount`), **reusing** the existing
  `WorkGraphNode` / `WorkGraphLink` / `WorkGraphStats` / `WorkGraphModuleDetails` /
  `WorkGraphTaskDetails` records. The frontend canvas is typed on that shape, so matching it is what
  makes the reuse possible.

Node contents:

- Root module → the centre node.
- Each visible descendant module → a `module` node with `Stats` (task counts, `AllocatedHours`,
  `CompletedHours`) and `Module` details (owner, dates, members, member count).
- Open tasks of visible modules → `task` nodes, capped the way the employee handler caps them, with
  the remainder reported in `HiddenTaskCount`. **Top-level tasks only** (subtasks excluded, matching
  `ListTopLevelProgressRowsAsync`, which is what the tree's counts and progress already mean), and
  **put through `TaskAccessResolver.FilterViewableTasksAsync`** — the employee handler never needed
  this because it only ever returned the caller's own tasks; a project-rooted query does, and
  skipping it would leak private tasks.
- Links: `contains` from parent module to child module and from module to task.

No new field on the shared `WorkGraphNode` record — see the alert decision below.

Access: the same guard the WM objective-tree query uses, so a caller who cannot read the project
gets the same failure they get today.

## Frontend

The whole explorer is reused, wrapper included — `WorkNetworkExplorerComponent` holds the hover/lock
orchestration, search, fit/zoom/reset, Esc handling, counts box and legend, and re-implementing
those in Work Management would be the fork this design names as a failure. Reusing it costs a few
more additive edits to the friend's files; the user chose that over the fork, on the condition that
every edit stays additive and the employee view is observably unchanged.

New, in `modules/work/`:

- A **network view component** that calls the new endpoint, holds the view-switch state, and renders
  `app-work-network-explorer` from the people module in project mode.
- A small **view-switch control** in the Tree toolbar.
- A data-access method on the WM project API service.
- A TS type for the response, structurally identical to `EmployeeWorkGraphResponse`.

Additive, opt-in edits to the friend's files — the only ones this project touches:

1. `explorer/work-network-explorer.component.ts` — optional inputs for the header title and
   description, for hiding the close button, and for the legend's contents, so the project view can
   say "Project Network", drop the close button it has no use for, and show a module/alert legend
   instead of the employee-shaped one. Omitting them leaves today's header, close button and legend
   exactly as they are.
2. `explorer/work-network-detail-panel.component.ts` — an optional project mode. Today `kindLine()`
   composes "Module • {project} • You own / Member / Contributor" from `node.role` and from a
   `kind: 'project'` node, `isMe()` / `firstName()` read the `employee` node, and the Tasks tab is
   headed as the employee's tasks. In project mode the panel takes its subtitle from the module's
   place in the tree and heads the tab as the module's tasks. The employee view passes nothing and
   renders as it does now.
3. `explorer/explorer-layout.ts` — an optional root id so a node other than the `employee` node can
   be the fixed centre, and the root's radius / collision / link distance keyed off "is root"
   rather than only off `kind` (a module-only graph otherwise gives every node radius 21 and the
   tight `contains` distance, so the centre does not read as the centre). Omitting the id keeps
   today's behaviour exactly: the `employee` node pinned at 0,0, every size as it is now.
4. `explorer/work-network-explorer-canvas.component.ts` — an optional ring `<circle>` on the node
   body (grey track + theme-colour arc via `stroke-dasharray`), an alert class that fills the core
   circle red, and a fill for modules that carry no `role` (a project graph's modules are not
   viewer-relative, so today's owner/member/contributor colouring has nothing to say about them).
   All driven by new optional inputs.

Every one of the four is behind a new optional input that the employee view does not pass, so it
renders and behaves exactly as it does today. `modules/people/models/work-graph.model.ts` is **not**
touched. The friend's existing specs must pass unedited, and the plan adds a spec that renders the
employee view with no new inputs and asserts the old output.

## Decisions made while writing this (the user's to overrule)

- **Detail panel:** the network view uses the friend's `work-network-detail-panel`, as in the
  preview image, rather than feeding the WM explanation card. The WM explanation card stays as the
  Tree view's panel, untouched. The user said both things at different points; this reading
  satisfies both.
- **No sprint nodes in v1.** The shared model has no `sprint` kind and adding one is a wider change
  to the friend's model than the alert field. Module → task matches the employee view.
- **Centre via a new optional `rootId`** rather than labelling the root module as an `employee`
  node. Passing a module as `kind: 'employee'` would need no layout edit at all, but it would make
  the root render with the employee radius, the employee label style and employee-shaped aria text,
  and it would lie in the response. Since an additive edit is already sanctioned, the honest option
  is better.
- **Ring source:** `Stats.CompletedHours / Stats.AllocatedHours` — the same number the tree's
  progress column shows. No new field.
- **Alerts come from the frontend, not the endpoint.** The project page already loads
  `ProjectMonitorStore`, indexed by target id, and the tree's dot already encodes two rules the
  graph must not contradict on the same screen: an alert inside an achieved module draws *faded*
  and is left out of the count, and some alerts target a task or sprint rather than a module. Using
  that store means the red circle matches the tree's dots by construction, the backend needs no
  alert field, and the friend's shared model file is not touched at all. Alerts that target a task
  or sprint roll up to the owning module's circle.
- **Tree toolbar in network mode:** the tree search, the assignee-avatar owner filter, the
  highlight filter bar and *Expand all* are hidden while the network view is on; *Create module*
  and the view switch stay. The explorer carries its own search, and mapping the 11-field highlight
  filter onto node rendering is a feature in its own right. Worth adding later; it would roughly
  double the frontend work here.
- **Module colour:** `role` is viewer-relative (do *I* own this module) and means little in a
  project-rooted picture, so project-mode modules take one neutral module fill and let the ring and
  the alert red carry the information. The owner is in the label line and the detail panel.
- **Placement:** the canvas replaces the tree list inside the existing left column at a
  viewport-relative height; the detail panel floats over the canvas's right side, as in the preview
  image, rather than taking over the 24rem explanation-card column. Not a fullscreen overlay — the
  user asked for the tree area to switch, not the page.
- **Switch placement:** the Tree toolbar row, not the tab strip, so Tree/Board/Backlog/Milestones
  keep meaning "tab" and the switch clearly scopes to the tree area.

## Left to the builder

- Exact label and icon of the view switch, and whether the choice persists per project.
- Task cap for the project graph, and whether tasks come from all visible modules or only expanded ones.
- Whether the project graph includes a `project` node at all, or the root module alone is the centre
  (the detail panel's project-mode subtitle is written either way).
- Ring stroke width, radius offset and the theme CSS variable to use.
- Whether the network view shows the same empty/loading states as the tree, and its behaviour on a
  project whose root module has no children.
- Test layout in both repos, following the per-handler / per-component convention.
