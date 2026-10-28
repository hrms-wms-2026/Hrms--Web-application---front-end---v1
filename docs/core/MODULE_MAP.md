# Frontend module map

One row per folder under `src/app/modules/` (verified 2026-10-28). Each module follows the layout in `ARCHITECTURE.md` §2: `feature/` (smart pages), `ui/` (presentational components), `state/` (NgRx Signal Stores), `data-access/` (API services), `models/`. Shared building blocks live in `src/app/shared/` and app-wide services in `src/app/core/`.

"Docs" names where to look: plans and designs are under `docs/superpowers/plans|specs/{next,finished}/` (search by the keyword), reports under `docs/reports/<area>/`.

| Module | What it does | Main pages (`feature/`) | Docs |
|---|---|---|---|
| **attendance** | Attendance overview, time tracking (clock in/out, breaks, history), requests, monthly health, monitoring summary | overview, time-tracking, monitoring, status-card, monthly-health-card, requests-summary-card | `reports/attendance/`, `reports/time-tracking/`, `reports/clock-in-policy/`; plans `attendance-*`, `time-tracking-*` |
| **calendar** | Company calendar with month, week, day and agenda views, event form, RSVP, time zones | calendar-page, calendar-week-view, calendar-day-view, calendar-agenda-view | plans/specs `calendar-*` |
| **dashboard** | Home and customizable dashboards (My Work, My Team) with a widget store; cards for tasks, progress, attendance, schedule, insights, wellbeing | dashboard-shell, dashboard-home, my-team-page, my-insights-page, widget-store-drawer, 20+ cards | backend plan/spec `customizable-dashboard`, `team-attendance-widget`; backend `reports/dashboard/` |
| **device-activation** | Approve page for the desktop tray agent's device-authorization flow: shows the pending request for a user code and approves it | device-activation | none by name; plan `connect-desktop-agent-frontend` covers the Settings side. See gap audit. |
| **inbox** | Unified inbox: approvals and cases from every module, item details, chats between people, case history | inbox-page | `reports/work-management/user-journey/INBOX_USER_JOURNEY.md`; plan `inbox-case-history` |
| **leave** | Time off: my balances, requests, team calendar and balances, leave types, policies, entitlements | time-off-shell, my-balances, requests-list, team-calendar, team-balances, leave-types-management, policy-management, entitlements-management | backend plans `leave-management/` |
| **organization** | Company settings: general settings (legal entity), departments, positions, roles | general-settings, department-management, position-management, roles-management | `reports/organization/`, `reports/legal-entity/`; plan `general-settings-design-refresh` |
| **people** | Employees: list with bulk actions, add-employee wizard, bulk onboarding, employee detail and overview, checklists, offboarding | employee-list, add-employee-wizard, bulk-onboarding, employee-detail, checklist-builder, checklist-templates, offboarding | `reports/employee-onboarding/`, `reports/employee/`; plans `employee-*`, `bulk-*`, `offboarding` |
| **profile** | The signed-in employee's own profile | profile-tab | plan `employee-self-service-profile-frontend` |
| **public** | Public landing page before login | landing-page | backend plan `landing-page-workspace-shortcut`; see gap audit |
| **settings** | Personal and admin settings: calendar connections, clock-in policy, notification settings, users, work modes | calendar-connections, clock-in-policy-form, notification-settings, users, work-mode-list | `reports/clock-in-policy/` |
| **work** | Work Management: project list and detail, module tree and project network views, task board and backlog, project settings | project-list, project-detail, milestone-tree-tab, project-network-view, task-board, task-backlog, project-settings | most plans/specs (`wm-*`, `task-*`, `work-management-*`); `reports/work-management/user-journey/WORK_MANAGEMENT_USER_JOURNEY.md` |

Outside `modules/`: `core/auth` (login, invitation, password, legal consent, session exchange), `core/tray-presence` (tray agent gate), `core/realtime` (SignalR), `layouts/` (main layout, navigation), `shared/ui` (design-system components including the rich-text editor), `shared/utils` (helpers including `sanitizeEditableHtml`).

Known gaps between this app and the backend are tracked in the backend repo's `docs/reports/documentation/2026-10-28-docs-and-code-gap-audit.md`.
