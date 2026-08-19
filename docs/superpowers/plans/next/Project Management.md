# Future Feature: Project Management Screens — Onexo Workspace UI/UX Corrections

**Status:** Not started. No Project Management screens exist in this repo yet (only auth/legal-consent and the dashboard skeleton have shipped specs/plans so far). Captured 2026-08-04 from a corrections document the user's manager wrote after reviewing a submitted Project Management user journey (Project Page, Create Project, Edit Project, Overdue/Close popup, Delete confirmation). Not yet brainstormed/spec'd — this file is raw context for that future brainstorm, not a design.

**Related:** the backend repo's `docs/superpowers/next-plan/Project Management.md` (item 2) captures the backend-relevant subset of the same feedback — workflow status, approval pipeline, archive/restore, progress calculation. The two are linked: several of the corrections below (status changes, archive, overdue handling) can't be finished on the frontend until that backend work exists. The backend repo's `docs/superpowers/specs/2026-08-04-work-management-projects-edit-delete-view-design.md` (section 9) is the currently-approved Edit/Delete/GetById/List API this frontend work would eventually consume — it does **not** yet expose workflow status, schedule health, or approval endpoints.

## Overall verdict from the manager

**Not approved for development in the current form.** The submitted journey (View → Create → Edit → Respond to overdue → Delete) is functionally incomplete and several business rules are unsafe as designed. Two categories of problem: (1) the UI template doesn't match the approved Onexo Workspace product, (2) core lifecycle/business rules (approval, progress, overdue handling, deletion) need to change — see the backend next-plan file for the rule-level detail; this file focuses on what's frontend-only.

## Frontend-only corrections (no backend change needed to fix these)

**1. Wrong product identity / generic template.** Header uses an `OT`/"ONEVO Technologies" identity instead of the approved Onexo Workspace logo, brand colors, and one consistent header shared across Organisation/Projects/Tasks/Attendance/Leave/Reporting — don't give Project Management its own visual identity.

**2. Spec content leaking into the application UI.** The submitted screens mixed design-doc content (Screen Explanation panel, Component Specification table, Functional Behaviour table, Business Rules table, Validations & Messages table, Screen States table, Edge Cases table, numbered callout circles) directly into the application mockup. Required: two separate outputs going forward — a clean full-canvas (16:9) application screen, and a separate written screen-spec document. Don't repeat this mixing in future screen submissions.

**3. Generic black-and-white styling.** Too monochrome/wireframe-like, heavy black buttons/icons. Needs: Onexo brand accent color, neutral light workspace background, clear surface elevation, softer borders, consistent card radius, branded primary CTA, semantic colors for success/warning/risk/overdue, consistent icon family, better spacing/hierarchy.

**4. Navigation.** Submitted nav (Home/Projects/Calendar/Time Off/Reports/Settings) is too generic and not permission-driven. Onexo Workspace is one unified, permission-driven app — nav items should reflect the signed-in user's actual responsibilities/permissions (example manager nav given: Dashboard, My work, Projects, Tasks, Team, Attendance, Leave, Insights, Reports). An employee shouldn't see create/edit/archive project actions they don't have permission for.

**5. Poor use of screen space on the Project Page.** Oversized empty areas, only six basic cards shown, too much icon real estate, edit/delete icons too prominent on every card (encourages accidental clicks). Should prioritize schedule health, completion, planned-vs-actual effort, milestones, tasks, open risks/issues, owner, team, approval status per card/row instead.

**6. Create/Edit forms too large for a modal.** Recommend a dedicated full-page form or a wide multi-step drawer instead: Step 1 Project scope, Step 2 Schedule and planning, Step 3 Ownership and access, Step 4 Review and approval.

**7. Responsive/accessibility behavior undefined.** Needs: minimum desktop width, tablet behavior, collapsible nav, keyboard navigation, focus order, screen-reader labels, error announcements, modal focus trapping, accessible status colors — none of this was specified in the submission.

## Per-screen corrections (frontend-only slice; rule-level items live in the backend next-plan file)

- **Project Page:** compact summary row (active/at-risk/overdue/pending-approval/completed-this-month counts, clickable); replace the Past/Present/Future filter set with workflow-status filters (All/Draft/Pending approval/Active/On hold/Completed/Archived) plus a separate schedule-health filter (Upcoming/On track/At risk/Overdue); richer cards (name, code, owner, workflow status, schedule health, dates, completion, milestones/tasks completed, open risks/issues, team avatars); move Edit/Delete off the card face into a three-dot menu; add real pagination ("Showing 1–12 of 46"); distinguish header global search from page-level project search; fix stale 2025 sample dates in mockups. Preserve filters and grid/list preference across navigation to Project Details.
- **Create Project form:** missing fields entirely absent from the submission — start date, project code, description, completion criteria, deliverables, priority, approver, access/visibility, business unit/department, approval policy. Buttons should be Cancel / Save draft / Submit for approval (not a single "Create Project" that bypasses approval). Drop the dual Logo + Cover Image upload requirement at creation time (move to Project Settings later, use an optional icon/color instead). Document upload needs progress/cancel/retry/validation/duplicate-handling/versioning states.
- **Edit Project form:** must share field order/terminology/validation/upload/date components with Create (don't diverge as a separate structure). Show current-vs-proposed-vs-impact for baseline field changes. No unrestricted status dropdown — use controlled action buttons instead (Submit for approval / Start / Put on hold / Resume / Submit for completion / Cancel / Archive), each with its own validation. Concurrent-edit conflict message needed (backend has no optimistic concurrency yet either — see backend spec section 2's known limitation). Disable Save until a field actually changes; unsaved-changes confirmation; prevent double-submit.
- **Overdue handling:** replace the auto-popping "Close or Extend?" modal with a non-blocking overdue badge/banner + owner notification + dashboard exception entry. Remove "Don't show this again" (hides a real risk) — offer "Remind me tomorrow" / "Dismiss this notification" instead, and keep the project visibly Overdue regardless.
- **Delete confirmation:** replace entirely with an Archive confirmation showing the impact (counts of milestones/tasks/documents/hours/open issues/pending approvals), blocking with a clear reason if dependencies prevent archiving (e.g., active time entries, pending approvals), and requiring an archive reason. Add an Archived Projects view (filter, details, restore, archive reason/by/date, retention info).

## All text corrections from the manager's doc (apply verbatim when these screens are actually built)

Project Page: "View and manage all projects in your organization." → "Plan, track and manage projects across your organisation."; "All Projects"→"All"; "Past/Present/Future Projects"→"Completed/Active/Upcoming"; "72% Completed"→"72% complete"; "Due date : 25 Aug 2025"→"Target date: 25 Aug 2026"; "View"→"Open project"; "Create Project"→"Add project"; "Delete"→"Archive".

Create Project: "Create Project"→"Add project"; "Project Type"→"Project category" or "Project template"; "Estimated Time"→"Planned effort"; "Project Documents"→"Supporting documents"; "Due Date"→"Target end date"; "Logo"→"Project icon"; "Cover Image"→"Project banner"; "Project Lead"→"Project owner"; "Project created successfully."→"Project saved as draft."; final submit button → "Submit for approval".

Edit Project: "Estimated Time"→"Planned effort"; "Add / Replace File"→"Add new version"; "Due Date"→"Target end date"; "Update Project"→"Save changes"; "Project updated successfully."→"Changes saved."; "Due Date must be a future date."→"The target end date cannot be before the project start date."; baseline-change save → "Changes submitted for approval. The current approved plan remains active."

Overdue/Close popup: "Project Due Date Has Passed"→"Project is overdue"; "Close Project"→"Review completion"; "Extend Due Date"→"Request date extension"; "Don't show this message again for this project"→"Remind me tomorrow"; "Project closed successfully."→"Project submitted for completion."; "Due date updated successfully."→"Date-extension request submitted."

Delete confirmation: "Delete Project"→"Archive project"; "Are you sure you want to delete the project "X"?"→"Archive X?"; "This action cannot be undone."→"The project can be restored by an authorised user."; "All project data including tasks, documents, comments, and history will be permanently deleted."→"Project records, tasks, documents, time entries and audit history will be preserved."; "Project deleted successfully."→"Project archived."; "Failed to delete project. Please try again."→"The project could not be archived. Review the issue and try again."; "Deleted projects cannot be recovered."→"Archived projects remain available to authorised users."

## Missing screens entirely (not in the submitted journey)

Project Details/Dashboard, Project Approval Request, Project Approval Review, Pending Approval state, Date-extension Request, Completion Review, Archived Projects (search/open/restore/audit/reason). All of these need the backend approval/archive/progress work in the linked backend next-plan file before they can be fully built — some (Project Details, Archived Projects list) could start as frontend-only shells against today's API and be wired up once the backend work lands.

## Recommended corrected journey (manager's ordering, for reference)

Open Projects → search/filter → Project Details → Add project → define scope/schedule/effort/owner/access → Save as Draft → validate plan → Submit for approval → approver reviews (Approve/Request changes/Reject) → start approved project → create milestones/tasks → track completion/effort/risks/issues → submit baseline changes for approval → handle overdue via notification + date-extension request → review completion criteria → submit for completion → approve completion → archive → restore where authorised.

## Suggested next step (when picked up)

Run `superpowers:brainstorming` fresh on this topic — it depends on the backend repo's next-plan brainstorm (workflow status, approval pipeline, archive/restore, progress calc) landing first or alongside, since several of the corrections above can't be finished frontend-only. Good opening questions:
- Which pieces can ship frontend-only against today's API (branding/template, nav, card layout, form-to-multi-step conversion, text corrections) versus which need the backend work first (status filters, approval buttons, archive/restore, overdue banner backed by real schedule-health)?
- Full-page form vs. wide drawer for Create/Edit — which fits the existing Onexo Workspace shell better?
- What's the actual approved Onexo brand palette/logo/icon family to design against?
