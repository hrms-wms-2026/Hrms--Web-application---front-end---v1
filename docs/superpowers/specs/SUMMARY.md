# specs/ — Master Index

Layout and rules: see `../rules/FILE_CREATION_RULES.md` §0 (specs follow the same finished/next split as plans).

| Design | Status (finished/next) | Location | Approval Status | Date |
|---|---|---|---|---|
| Core + Shared + Employees Scaffold Design | finished | `finished/2026-07-28/2026-07-28-core-shared-employees-scaffold-design.md` | Approved | 2026-07-28 |
| Dashboard Skeleton Redesign Design | finished | `finished/2026-07-30/2026-07-30-dashboard-skeleton-redesign-design.md` | Approved | 2026-07-30 |
| Work Management — Projects List, Project Detail, Milestone Read View Design | finished | `finished/2026-08-09/2026-08-08-work-management-projects-milestones-design.md` | Approved | 2026-08-08 |
| Project Identifier Auto-suggest Design | next | `next/2026-08-10-project-identifier-autosuggest-design.md` | Approved | 2026-08-10 |
| Milestone Cards, Tree View Page, Edit/Achieve Design | finished | `finished/2026-08-10/2026-08-10-milestone-cards-and-tree-view-design.md` | Approved | 2026-08-10 |
| Project & Milestone Card — Settings Popup Consolidation Design | finished | `finished/2026-08-10/2026-08-10-card-settings-popup-design.md` | Approved | 2026-08-10 |
| Project Detail — Compact Cards, Horizontal Scroll, Inline Milestone Detail Design | finished | `finished/2026-08-10/2026-08-10-project-detail-inline-milestone-layout-design.md` | Approved (visual mockup) | 2026-08-10 |
| Milestone Card Uniform Height + Default-Selected First Milestone Design | finished | `finished/2026-08-10/2026-08-10-milestone-card-uniform-height-and-default-select-design.md` | Approved | 2026-08-10 |
| Project Detail — Milestone Sub-Menu, Explorer Tree, and Detail Panel Design | next (navigation shape implemented 2026-08-12) | `next/2026-08-11-project-detail-milestone-tree-explorer-design.md` | Approved (visual mockup) | 2026-08-11 |
| Project Detail — Unified Tree-Table Redesign (Manager Mockup) Design | next (partially reverted same day — see doc's status line; Tree-tab styling only, card+sub-menu nav restored) | `next/2026-08-12-milestone-tree-mockup-redesign-design.md` | Approved | 2026-08-12 |
| Work Management — Task Foundation (Task Board, Approvals, Notification) Design | next | `next/2026-08-16-work-management-task-foundation-design.md` | Approved | 2026-08-16 |
| Attendance & Leave Management (Frontend) Design | next | `next/2026-08-17-attendance-leave-management-design.md` | Approved | 2026-08-17 |
| Leave hourly ledger Design | next | `next/2026-09-09-leave-hourly-ledger-design.md` | Approved | 2026-09-09 |
| Work Management — Project Page Redesign Design | finished | `finished/2026-08-21/2026-08-20-work-management-project-page-redesign-design.md` | Approved | 2026-08-20, shipped 2026-08-21 |
| Task Subtasks Design | finished | `finished/2026-09-21/2026-09-21-task-subtasks-design.md` | Approved | 2026-09-21 |
| Centralized File/Photo Upload System Design | next | `next/2026-09-22-centralized-file-upload-design.md` | Approved | 2026-09-22 |

The first three designs' corresponding plans in `../plans/finished/` have been executed (see `../plans/SUMMARY.md`), so those are classified `finished` here. The Milestone Cards design's plan (all 10 tasks across 3 parts, plus its backend addendum in `HRMS-Backend-v1`) finished 2026-08-10, so it moved to `finished/2026-08-10/` too. The Card Settings Popup, Project Detail Inline Milestone Layout, and Milestone Card Uniform Height designs' plans also finished 2026-08-10, same folder. The Identifier Auto-suggest design is still approved but has no plan written yet — see `next/SUMMARY.md`. The Attendance & Leave design is also pending — no plan written yet. The Project Page Redesign design's plan finished 2026-08-21, so it moved to `finished/2026-08-21/` too. The Task Subtasks design's companion plans (backend in `HRMS-Backend-v1`, frontend in `../plans/finished/2026-09-21/2026-09-21-task-subtasks-frontend.md`) both finished 2026-09-21, so it moved to `finished/2026-09-21/` as well.

## 2026-10-28 migration of loose files

22 files had been added loose in `specs/`, against FILE_CREATION_RULES rule 1. They were moved with `git mv` on 2026-10-28. Status was decided from the code, not from the file: **finished** means the feature's endpoints/components exist in `src/`; **pending** means they do not. Finished files sit under `finished/<date>/` using the date in the file name (the plan/design date; the completion date was not recorded).

| File | Location | Status | Note |
|---|---|---|---|
|  | `finished/2026-08-15/2026-08-15-employee-self-service-profile-frontend-design.md` | finished |  |
| Employee Detail Screen — Frontend Design | `finished/2026-08-16/2026-08-16-employee-detail-screen-frontend-design.md` | finished |  |
| Employee Offboarding Execution — Frontend Design | `finished/2026-08-17/2026-08-17-employee-offboarding-execution-frontend-design.md` | finished |  |
| Sensitive Position Approval + Change Position Action Menu — Frontend Design | `finished/2026-08-17/2026-08-17-sensitive-position-approval-frontend-design.md` | finished |  |
| Bulk Employee Onboarding — Frontend Design | `finished/2026-08-18/2026-08-18-bulk-employee-onboarding-frontend-design.md` | finished |  |
| Connect Desktop Agent (Settings → Devices) — Design | `finished/2026-08-25/2026-08-25-connect-desktop-agent-frontend-design.md` | finished |  |
| Time Tracking Date-Range Picker Design | `finished/2026-08-25/2026-08-25-time-tracking-date-range-picker-design.md` | finished |  |
| Tray App Employee Access Toggle — Frontend Design | `next/2026-08-25-tray-app-employee-access-toggle-frontend-design.md` | pending | only the API method exists; no UI and no backend endpoint |
| Calendar Invites, RSVP, and Conflict Detection Design | `finished/2026-08-31/2026-08-31-calendar-invites-rsvp-conflicts-design.md` | finished |  |
| Calendar R1: Recurrence Engine + Frontend Design | `finished/2026-08-31/2026-08-31-calendar-r1-recurrence-and-frontend-design.md` | finished |  |
| Calendar Timezone Correctness and Unsaved-Changes Guard Design | `finished/2026-09-01/2026-09-01-calendar-timezone-and-unsaved-guard-design.md` | finished |  |
| Module / Sub-Module Creation Screen — Assets, Members, Date Range Picker | `finished/2026-09-02/2026-09-02-module-creation-assets-members-design.md` | finished | frontend done; backend asset endpoints missing (see backend plans/next) |
| ClickUp-style Task Status Groups Design | `finished/2026-09-18/2026-09-18-task-status-groups-design.md` | finished |  |
| Employee List Redesign + Bulk Actions (Sub-project B) — Design | `finished/2026-09-28/2026-09-28-employee-list-bulk-actions-design.md` | finished |  |
| Shared Bulk-Action Primitives (Sub-project A) — Design | `finished/2026-09-28/2026-09-28-shared-bulk-action-primitives-design.md` | finished |  |
| Task Backlog Bulk Actions (Sub-project C) — Design | `finished/2026-09-28/2026-09-28-task-backlog-bulk-actions-design.md` | finished |  |
| Draft Chips Bar + Unsaved Changes Guard (Sub-project D) — Design | `finished/2026-09-29/2026-09-29-drafts-bar-and-unsaved-changes-guard-design.md` | finished |  |
| Employee Detail Screen Redesign — Design | `finished/2026-09-30/2026-09-30-employee-detail-redesign-design.md` | finished |  |
| Needs Attention drill-down — design | `finished/2026-10-01/2026-10-01-needs-attention-drilldown-design.md` | finished |  |
| Inbox case history — design | `finished/2026-10-19/2026-10-19-inbox-case-history-design.md` | finished |  |
| WM Project Network View — design | `finished/2026-10-19/2026-10-19-wm-project-network-view-design.md` | finished |  |
| Attendance: late/early deductions and short-hours retirement — design | `finished/2026-10-20/2026-10-20-attendance-late-early-deductions-design.md` | finished |  |
