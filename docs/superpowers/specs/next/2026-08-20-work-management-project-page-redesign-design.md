# Work Management — Project Page Redesign (frontend design)

**Status:** Approved 2026-08-20 (same design as the backend companion). Frontend plan written after backend Parts 1–3 shipped.

**Companion:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-20-work-management-project-page-redesign-design.md`

**Scope:** Work Management module only (`src/app/modules/work/**`), plus one new shared presentational `app-progress-bar` (the spec requires it; only a circular `app-progress-ring` exists today). Import existing `app-breadcrumb-header` — do not edit `layouts/main-layout`, `organization`, `people`, `public`, or admin/platform.

## Goal

Redesign `/work` Projects: card grid → single-row list with a side Explanation panel. Create modal becomes a 4-step wizard. Project-level membership uses `POST /work/projects/{id}/members` (Default Objective, server-side). Banner is an independent optional upload from Logo. Release date is dropped from the create form.

## UI

- Header: `app-breadcrumb-header` (`parentLabel="Work"`, `currentLabel="Projects"`, `icon="work"`). Filters + Create stay on a toolbar row under it.
- List row: project name, owner avatar (`app-employee-avatar` with `project.leadId`), linear `app-progress-bar` from `completedHours / allocatedHours` (0% when allocated is 0).
- First filtered project auto-selected; clicking a row selects it. Selected row uses accent surface, matching milestone-tree selected styling.
- Side `ProjectExplanationCardComponent`: name, identifier, description, dates, hours, member avatars only (`app-avatar-stack`). Buttons: View project (navigate `/work/:id`), Achieve project (lead + not already achieved), owner-only Member button (existing `app-member-button`). Lead also keeps Settings so edit/delete is not lost when the card grid goes away.
- Create wizard (hand-rolled steps inside existing `app-project-form-modal`, same convention as `AddEmployeeWizardComponent`):
  1. Category — category pills/tabs, not a select.
  2. Details — name, identifier, description, start, target, allocated hours, color, logo, **banner**. No release date.
  3. Members — optional, staged client-side via existing `app-employee-picker`.
  4. Preview & confirm — summary, then create (multipart, omit empty `releaseDate`, send `banner` when present). After create succeeds, `POST /work/projects/{id}/members` once per staged employee id.
- Members popup: modeled on `ObjectiveMembersPopupComponent` but add-only (backend Part 2 has no project-level remove/transfer). Lists avatars from `project.members`. Add → `POST /work/projects/{id}/members`.

## Out of scope

- Notifications UI (in-app bell already polls; Outbox delivery is backend).
- Changing `AddObjectiveMember` / non-default Objective invite UI.
- Deleting `ProjectCardComponent` (unused on this page after the grid goes; leave the file).
