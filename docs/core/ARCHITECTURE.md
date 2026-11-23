# ONEVO HRMS — Frontend Architecture Document

> **Product:** ONEVO HRMS — Multi-Tenant B2B SaaS Platform  
> **Stack:** Angular 21.2 · TypeScript ≥5.9 <6 · Node.js ^20.19 | ^22.12 | ^24 · RxJS · NgRx Signal Store · SignalR (`@microsoft/signalr`) · Tailwind CSS 4 · Custom CSS · DOMPurify · Leaflet · d3-force  
> **Tooling:** Vitest via `@angular/build:unit-test` · Playwright e2e · ESLint (angular-eslint, flat config `eslint.config.js`) · Prettier  
> **Scale:** Large-scale · ~1000 users · Long-term maintained  
> **Version:** 2.2 | Last Updated: 2026-10-27 | v2.2: reconciled §2 core tree, §5.2, §5.4 and §6.2 with the code; earlier: circuit breaker, zoneless, security headers, consent gate

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Folder Structure](#2-folder-structure)
3. [Performance Strategy](#3-performance-strategy)
4. [State Management](#4-state-management)
5. [API & Data Fetching](#5-api--data-fetching)
6. [Security Architecture](#6-security-architecture)
7. [Error Handling & Resilience](#7-error-handling--resilience)
8. [Accessibility (a11y)](#8-accessibility-a11y)
9. [Responsiveness & Cross-Browser](#9-responsiveness--cross-browser)
10. [Testing Strategy](#10-testing-strategy)
11. [Build & Deployment](#11-build--deployment)
12. [Coding Standards](#12-coding-standards)
13. [SEO Strategy](#13-seo-strategy)
14. [Monitoring & Analytics](#14-monitoring--analytics)
15. [Example Folder Structure](#15-example-folder-structure)

---

## 1. Architecture Overview

### Pattern: Domain-Driven Modular Monolith

ONEVO HRMS uses a **Domain-Driven Modular Monolith** architecture. Each business domain (Employees, Payroll, Leave, etc.) is an independent Angular module with clear internal layers. Modules communicate only through well-defined service interfaces — never by importing across domain boundaries.

```
┌─────────────────────────────────────────────┐
│                  App Shell                   │
├──────────────┬──────────────────────────────┤
│   Core Layer │         Shared Layer          │
│  (Auth, Guards, Interceptors, Config)        │
├──────────────┴──────────────────────────────┤
│              Business Modules                │
│  employees │ payroll │ leave │ attendance    │
│  recruitment │ performance │ reports │ admin │
└─────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Responsibility | Example |
|---|---|---|
| `core/` | App-wide infrastructure | AuthService, Guards, Interceptors |
| `shared/` | Cross-domain reusable UI | ButtonComponent, TableComponent |
| `modules/` | Business domain logic | EmployeeStore, PayrollApiService |
| `layouts/` | Page layout shells | DashboardLayout, AuthLayout |

### Dependency Rules

```
feature  →  ui  →  state  →  data-access
```

Lower layers must **never** import from upper layers. This prevents circular dependencies.

---

## 2. Folder Structure

> **Current state (verified 2026-10-27):** `src/app/` holds `core/`, `layouts/`, `modules/` and `shared/`. The modules that exist under `src/app/modules/` are: `attendance`, `calendar`, `dashboard`, `device-activation`, `inbox`, `leave`, `organization`, `people`, `profile`, `public`, `settings`, `work`. The `core/` tree below matches the code. `work/` was kept in sync up to 2026-08 (see rule 6 in `docs/superpowers/rules/PROCESS_RULES.md`). `employees/`, `payroll/`, `recruitment/`, `performance/`, `reports/` and `tenant-admin/` in the tree are **planning-time skeletons that were never built** (employee features live in `people/`); `leave/`, `attendance/` and `settings/` exist but have a different internal layout from the skeleton. Always check `src/app/modules/` for what is actually built; [MODULE_MAP.md](MODULE_MAP.md) lists every module with its pages and docs.

```
src/
├── core/
│   ├── auth/                               ← login, invitation, password, legal-consent, session-exchange
│   │   ├── data-access/auth-api.service.ts
│   │   ├── feature/                        ← login, accept-invitation, forgot/reset-password, legal-consent, session-exchange
│   │   ├── models/dto/
│   │   └── utils/safe-return-path.ts
│   ├── config/
│   │   ├── app.config.ts                   ← runtime config (the Angular ApplicationConfig is src/app/app.config.ts)
│   │   ├── api-endpoints.ts
│   │   ├── build-info.ts
│   │   ├── feature-flags.ts
│   │   └── runtime-config.model.ts
│   ├── guards/
│   │   ├── auth.guard.ts
│   │   ├── permission.guard.ts
│   │   ├── redirect-if-authenticated.guard.ts
│   │   └── unsaved-changes.guard.ts
│   ├── interceptors/
│   │   ├── auth.interceptor.ts
│   │   ├── correlation.interceptor.ts      ← adds X-Correlation-ID per request
│   │   ├── csrf.interceptor.ts             ← double-submit onevo_csrf cookie → X-CSRF-Token
│   │   └── error.interceptor.ts            ← error taxonomy and retry
│   ├── realtime/
│   │   └── inbox-realtime.service.ts       ← SignalR connection to /hubs/inbox
│   ├── services/
│   │   ├── error-handler.service.ts        ← unified error taxonomy (HTTP code → action)
│   │   ├── logger.service.ts
│   │   ├── notification.service.ts
│   │   ├── notification-api.service.ts
│   │   └── notification-navigation.service.ts
│   ├── state/notifications.store.ts
│   ├── theme/                              ← theme presets + theme.store.ts
│   └── tray-presence/                      ← tray agent activation gate and presence store
│
├── shared/
│   ├── ui/
│   │   ├── button/
│   │   ├── table/
│   │   ├── modal/
│   │   ├── card/
│   │   └── loader/
│   ├── directives/
│   │   ├── permission.directive.ts
│   │   └── debounce.directive.ts
│   ├── pipes/
│   │   ├── date-format.pipe.ts
│   │   └── currency-format.pipe.ts
│   ├── utils/
│   │   ├── date.helpers.ts
│   │   ├── file.helpers.ts
│   │   └── validation.helpers.ts
│   ├── data-access/
│   │   ├── api-client.ts
│   │   ├── api-params.ts
│   │   └── file-api.service.ts
│   └── models/
│       ├── paged-result.model.ts
│       └── dropdown-option.model.ts
│
├── modules/
│   │
│   ├── auth/                                        # Authentication & Onboarding
│   │   ├── feature/
│   │   │   ├── login/
│   │   │   │   ├── login.component.ts
│   │   │   │   ├── login.component.html
│   │   │   │   └── login.component.css
│   │   │   ├── register/
│   │   │   │   ├── register.component.ts
│   │   │   │   ├── register.component.html
│   │   │   │   └── register.component.css
│   │   │   └── forgot-password/
│   │   │       ├── forgot-password.component.ts
│   │   │       ├── forgot-password.component.html
│   │   │       └── forgot-password.component.css
│   │   ├── ui/
│   │   │   ├── auth-card/
│   │   │   │   └── auth-card.component.ts
│   │   │   └── password-strength/
│   │   │       └── password-strength.component.ts
│   │   ├── data-access/
│   │   │   └── auth-api.service.ts
│   │   ├── state/
│   │   │   └── auth.store.ts
│   │   ├── models/
│   │   │   ├── login-request.model.ts
│   │   │   ├── register-request.model.ts
│   │   │   └── auth-response.model.ts
│   │   ├── utils/
│   │   │   └── auth.validator.ts
│   │   └── auth.routes.ts
│   │
│   ├── dashboard/                                   # Main Dashboard
│   │   ├── feature/
│   │   │   └── dashboard/
│   │   │       ├── dashboard.component.ts
│   │   │       ├── dashboard.component.html
│   │   │       └── dashboard.component.css
│   │   ├── ui/
│   │   │   ├── kpi-card/
│   │   │   │   └── kpi-card.component.ts
│   │   │   ├── activity-feed/
│   │   │   │   └── activity-feed.component.ts
│   │   │   └── summary-chart/
│   │   │       └── summary-chart.component.ts
│   │   ├── data-access/
│   │   │   └── dashboard-api.service.ts
│   │   ├── state/
│   │   │   └── dashboard.store.ts
│   │   ├── models/
│   │   │   ├── kpi.model.ts
│   │   │   └── dashboard-summary.model.ts
│   │   ├── utils/
│   │   │   └── dashboard.formatter.ts
│   │   └── dashboard.routes.ts
│   │
│   ├── work/                                         # Work Management (Projects, Milestones/Objectives) — built 2026-08-03+
│   │   ├── feature/
│   │   │   ├── project-list/
│   │   │   │   └── project-list.component.ts  # list rows + explanation panel (card grid removed 2026-08-20)
│   │   │   ├── project-detail/
│   │   │   │   └── project-detail.component.ts  # shell + router-outlet for milestone tabs
│   │   │   └── milestone-tree-tab/
│   │   │       └── milestone-tree-tab.component.ts  # owns tree + detail panel + members popup
│   │   ├── ui/
│   │   │   ├── project-card/                  # unused on the list page after 2026-08-20 redesign; file kept
│   │   │   │   └── project-card.component.ts
│   │   │   ├── project-list-row/
│   │   │   │   └── project-list-row.component.ts
│   │   │   ├── project-explanation-card/
│   │   │   │   └── project-explanation-card.component.ts
│   │   │   ├── project-members-popup/
│   │   │   │   └── project-members-popup.component.ts
│   │   │   ├── project-filter-bar/
│   │   │   │   └── project-filter-bar.component.ts
│   │   │   ├── project-form-modal/            # Create only
│   │   │   │   └── project-form-modal.component.ts
│   │   │   ├── project-settings-modal/        # Edit + Achieved toggle
│   │   │   │   └── project-settings-modal.component.ts
│   │   │   ├── milestone-tree-node/
│   │   │   │   └── milestone-tree-node.component.ts
│   │   │   ├── milestone-card/
│   │   │   │   └── milestone-card.component.ts
│   │   │   ├── milestone-settings-modal/       # Edit + Achieved toggle
│   │   │   │   └── milestone-settings-modal.component.ts
│   │   │   ├── milestone-detail-panel/
│   │   │   │   └── milestone-detail-panel.component.ts
│   │   │   ├── member-button/
│   │   │   │   └── member-button.component.ts
│   │   │   ├── objective-members-popup/
│   │   │   │   └── objective-members-popup.component.ts
│   │   │   ├── employee-picker/
│   │   │   │   └── employee-picker.component.ts  # search-and-pick modal; injects PeopleApiService (plan exception to ui/ no-API rule)
│   │   │   └── my-invitations-panel/
│   │   │       └── my-invitations-panel.component.ts
│   │   ├── data-access/
│   │   │   ├── project-api.service.ts
│   │   │   ├── project-category-api.service.ts
│   │   │   └── objective-member-api.service.ts
│   │   ├── state/
│   │   │   ├── project-list.store.ts
│   │   │   ├── project-detail.store.ts
│   │   │   └── project-category.store.ts
│   │   ├── models/
│   │   │   ├── project.model.ts
│   │   │   ├── milestone.model.ts
│   │   │   ├── project-category.model.ts
│   │   │   └── dto/ (project.dto.ts, milestone.dto.ts, project-category.dto.ts, objective-invitation.dto.ts)
│   │   ├── utils/
│   │   │   ├── project-form.validator.ts
│   │   │   └── project.mapper.ts
│   │   └── work.routes.ts
│   │
│   ├── employees/                                   # Employee Management
│   │   ├── feature/
│   │   │   ├── employee-list/
│   │   │   │   ├── employee-list.component.ts
│   │   │   │   ├── employee-list.component.html
│   │   │   │   └── employee-list.component.css
│   │   │   ├── employee-detail/
│   │   │   │   ├── employee-detail.component.ts
│   │   │   │   ├── employee-detail.component.html
│   │   │   │   └── employee-detail.component.css
│   │   │   ├── employee-create/
│   │   │   │   ├── employee-create.component.ts
│   │   │   │   ├── employee-create.component.html
│   │   │   │   └── employee-create.component.css
│   │   │   └── employee-edit/
│   │   │       ├── employee-edit.component.ts
│   │   │       ├── employee-edit.component.html
│   │   │       └── employee-edit.component.css
│   │   ├── ui/
│   │   │   ├── employee-table/
│   │   │   │   └── employee-table.component.ts
│   │   │   ├── employee-card/
│   │   │   │   └── employee-card.component.ts
│   │   │   ├── employee-form/
│   │   │   │   └── employee-form.component.ts
│   │   │   └── employee-filter/
│   │   │       └── employee-filter.component.ts
│   │   ├── data-access/
│   │   │   ├── employee-api.service.ts
│   │   │   └── employee-api.service.spec.ts
│   │   ├── state/
│   │   │   ├── employee.store.ts
│   │   │   └── employee.store.spec.ts
│   │   ├── models/
│   │   │   ├── employee.model.ts
│   │   │   ├── employee-dto.model.ts
│   │   │   └── employee-filter.model.ts
│   │   ├── utils/
│   │   │   ├── employee.validator.ts
│   │   │   ├── employee.formatter.ts
│   │   │   └── employee.mapper.ts
│   │   └── employees.routes.ts
│   │
│   ├── leave/                                       # Leave Management
│   │   ├── feature/
│   │   │   ├── leave-list/
│   │   │   │   ├── leave-list.component.ts
│   │   │   │   ├── leave-list.component.html
│   │   │   │   └── leave-list.component.css
│   │   │   ├── leave-apply/
│   │   │   │   ├── leave-apply.component.ts
│   │   │   │   ├── leave-apply.component.html
│   │   │   │   └── leave-apply.component.css
│   │   │   └── leave-approval/
│   │   │       ├── leave-approval.component.ts
│   │   │       ├── leave-approval.component.html
│   │   │       └── leave-approval.component.css
│   │   ├── ui/
│   │   │   ├── leave-calendar/
│   │   │   │   └── leave-calendar.component.ts
│   │   │   ├── leave-request-card/
│   │   │   │   └── leave-request-card.component.ts
│   │   │   └── leave-balance-bar/
│   │   │       └── leave-balance-bar.component.ts
│   │   ├── data-access/
│   │   │   └── leave-api.service.ts
│   │   ├── state/
│   │   │   └── leave.store.ts
│   │   ├── models/
│   │   │   ├── leave-request.model.ts
│   │   │   ├── leave-type.model.ts
│   │   │   └── leave-balance.model.ts
│   │   ├── utils/
│   │   │   ├── leave.validator.ts
│   │   │   └── leave.calculator.ts
│   │   └── leave.routes.ts
│   │
│   ├── attendance/                                  # Attendance & Clock-In
│   │   ├── feature/
│   │   │   ├── attendance-overview/
│   │   │   │   ├── attendance-overview.component.ts
│   │   │   │   ├── attendance-overview.component.html
│   │   │   │   └── attendance-overview.component.css
│   │   │   └── attendance-log/
│   │   │       ├── attendance-log.component.ts
│   │   │       ├── attendance-log.component.html
│   │   │       └── attendance-log.component.css
│   │   ├── ui/
│   │   │   ├── clock-widget/
│   │   │   │   └── clock-widget.component.ts
│   │   │   ├── attendance-table/
│   │   │   │   └── attendance-table.component.ts
│   │   │   └── attendance-status-badge/
│   │   │       └── attendance-status-badge.component.ts
│   │   ├── data-access/
│   │   │   └── attendance-api.service.ts
│   │   ├── state/
│   │   │   └── attendance.store.ts
│   │   ├── models/
│   │   │   ├── attendance-record.model.ts
│   │   │   └── attendance-filter.model.ts
│   │   ├── utils/
│   │   │   ├── attendance.calculator.ts
│   │   │   └── attendance.formatter.ts
│   │   └── attendance.routes.ts
│   │
│   ├── payroll/                                     # Payroll Processing
│   │   ├── feature/
│   │   │   ├── payroll-dashboard/
│   │   │   │   ├── payroll-dashboard.component.ts
│   │   │   │   ├── payroll-dashboard.component.html
│   │   │   │   └── payroll-dashboard.component.css
│   │   │   ├── payroll-run/
│   │   │   │   ├── payroll-run.component.ts
│   │   │   │   ├── payroll-run.component.html
│   │   │   │   └── payroll-run.component.css
│   │   │   └── payslip-detail/
│   │   │       ├── payslip-detail.component.ts
│   │   │       ├── payslip-detail.component.html
│   │   │       └── payslip-detail.component.css
│   │   ├── ui/
│   │   │   ├── payroll-summary-card/
│   │   │   │   └── payroll-summary-card.component.ts
│   │   │   ├── payslip-table/
│   │   │   │   └── payslip-table.component.ts
│   │   │   └── payroll-status-badge/
│   │   │       └── payroll-status-badge.component.ts
│   │   ├── data-access/
│   │   │   └── payroll-api.service.ts
│   │   ├── state/
│   │   │   └── payroll.store.ts
│   │   ├── models/
│   │   │   ├── payroll.model.ts
│   │   │   ├── payslip.model.ts
│   │   │   └── payroll-run-request.model.ts
│   │   ├── utils/
│   │   │   ├── payroll.calculator.ts
│   │   │   └── payroll.formatter.ts
│   │   └── payroll.routes.ts
│   │
│   ├── recruitment/                                 # Recruitment & Hiring
│   │   ├── feature/
│   │   │   ├── job-list/
│   │   │   │   ├── job-list.component.ts
│   │   │   │   ├── job-list.component.html
│   │   │   │   └── job-list.component.css
│   │   │   ├── candidate-pipeline/
│   │   │   │   ├── candidate-pipeline.component.ts
│   │   │   │   ├── candidate-pipeline.component.html
│   │   │   │   └── candidate-pipeline.component.css
│   │   │   └── interview-schedule/
│   │   │       ├── interview-schedule.component.ts
│   │   │       ├── interview-schedule.component.html
│   │   │       └── interview-schedule.component.css
│   │   ├── ui/
│   │   │   ├── job-card/
│   │   │   │   └── job-card.component.ts
│   │   │   ├── candidate-card/
│   │   │   │   └── candidate-card.component.ts
│   │   │   └── pipeline-stage/
│   │   │       └── pipeline-stage.component.ts
│   │   ├── data-access/
│   │   │   └── recruitment-api.service.ts
│   │   ├── state/
│   │   │   └── recruitment.store.ts
│   │   ├── models/
│   │   │   ├── job-posting.model.ts
│   │   │   ├── candidate.model.ts
│   │   │   └── interview.model.ts
│   │   ├── utils/
│   │   │   └── recruitment.formatter.ts
│   │   └── recruitment.routes.ts
│   │
│   ├── performance/                                 # Performance Management
│   │   ├── feature/
│   │   │   ├── performance-overview/
│   │   │   │   ├── performance-overview.component.ts
│   │   │   │   ├── performance-overview.component.html
│   │   │   │   └── performance-overview.component.css
│   │   │   ├── review-form/
│   │   │   │   ├── review-form.component.ts
│   │   │   │   ├── review-form.component.html
│   │   │   │   └── review-form.component.css
│   │   │   └── goal-tracker/
│   │   │       ├── goal-tracker.component.ts
│   │   │       ├── goal-tracker.component.html
│   │   │       └── goal-tracker.component.css
│   │   ├── ui/
│   │   │   ├── rating-widget/
│   │   │   │   └── rating-widget.component.ts
│   │   │   ├── goal-progress-bar/
│   │   │   │   └── goal-progress-bar.component.ts
│   │   │   └── review-summary-card/
│   │   │       └── review-summary-card.component.ts
│   │   ├── data-access/
│   │   │   └── performance-api.service.ts
│   │   ├── state/
│   │   │   └── performance.store.ts
│   │   ├── models/
│   │   │   ├── performance-review.model.ts
│   │   │   └── goal.model.ts
│   │   ├── utils/
│   │   │   ├── performance.calculator.ts
│   │   │   └── performance.formatter.ts
│   │   └── performance.routes.ts
│   │
│   ├── reports/                                     # Reports & Analytics
│   │   ├── feature/
│   │   │   ├── reports-overview/
│   │   │   │   ├── reports-overview.component.ts
│   │   │   │   ├── reports-overview.component.html
│   │   │   │   └── reports-overview.component.css
│   │   │   ├── report-builder/
│   │   │   │   ├── report-builder.component.ts
│   │   │   │   ├── report-builder.component.html
│   │   │   │   └── report-builder.component.css
│   │   │   └── saved-reports/
│   │   │       ├── saved-reports.component.ts
│   │   │       ├── saved-reports.component.html
│   │   │       └── saved-reports.component.css
│   │   ├── ui/
│   │   │   ├── report-card/
│   │   │   │   └── report-card.component.ts
│   │   │   ├── chart-widget/
│   │   │   │   └── chart-widget.component.ts
│   │   │   └── export-toolbar/
│   │   │       └── export-toolbar.component.ts
│   │   ├── data-access/
│   │   │   └── reports-api.service.ts
│   │   ├── state/
│   │   │   └── reports.store.ts
│   │   ├── models/
│   │   │   ├── report.model.ts
│   │   │   └── report-filter.model.ts
│   │   ├── utils/
│   │   │   ├── report.exporter.ts
│   │   │   └── report.formatter.ts
│   │   └── reports.routes.ts
│   │
│   ├── tenant-admin/                                # Tenant Administration
│   │   ├── feature/
│   │   │   ├── tenant-overview/
│   │   │   │   ├── tenant-overview.component.ts
│   │   │   │   ├── tenant-overview.component.html
│   │   │   │   └── tenant-overview.component.css
│   │   │   ├── tenant-users/
│   │   │   │   ├── tenant-users.component.ts
│   │   │   │   ├── tenant-users.component.html
│   │   │   │   └── tenant-users.component.css
│   │   │   └── tenant-billing/
│   │   │       ├── tenant-billing.component.ts
│   │   │       ├── tenant-billing.component.html
│   │   │       └── tenant-billing.component.css
│   │   ├── ui/
│   │   │   ├── tenant-card/
│   │   │   │   └── tenant-card.component.ts
│   │   │   ├── user-role-badge/
│   │   │   │   └── user-role-badge.component.ts
│   │   │   └── billing-summary/
│   │   │       └── billing-summary.component.ts
│   │   ├── data-access/
│   │   │   └── tenant-admin-api.service.ts
│   │   ├── state/
│   │   │   └── tenant-admin.store.ts
│   │   ├── models/
│   │   │   ├── tenant.model.ts
│   │   │   └── tenant-user.model.ts
│   │   ├── utils/
│   │   │   └── tenant.formatter.ts
│   │   └── tenant-admin.routes.ts
│   │
│   └── settings/                                    # User & App Settings
│       ├── feature/
│       │   ├── profile-settings/
│       │   │   ├── profile-settings.component.ts
│       │   │   ├── profile-settings.component.html
│       │   │   └── profile-settings.component.css
│       │   ├── security-settings/
│       │   │   ├── security-settings.component.ts
│       │   │   ├── security-settings.component.html
│       │   │   └── security-settings.component.css
│       │   └── notification-settings/
│       │       ├── notification-settings.component.ts
│       │       ├── notification-settings.component.html
│       │       └── notification-settings.component.css
│       ├── ui/
│       │   ├── settings-nav/
│       │   │   └── settings-nav.component.ts
│       │   └── toggle-field/
│       │       └── toggle-field.component.ts
│       ├── data-access/
│       │   └── settings-api.service.ts
│       ├── state/
│       │   └── settings.store.ts
│       ├── models/
│       │   ├── user-profile.model.ts
│       │   └── notification-preference.model.ts
│       ├── utils/
│       │   └── settings.validator.ts
│       └── settings.routes.ts

├── layouts/
│   ├── main-layout/
│   └── auth-layout/

└── app.routes.ts
```

### Layer Purpose — Quick Reference

| Layer | What goes here | Naming convention |
|---|---|---|
| `feature/` | Full pages, smart containers, route entry points | `*-list`, `*-detail`, `*-create`, `*-edit` |
| `ui/` | Dumb/presentational components, no API calls | `*-card`, `*-table`, `*-form`, `*-badge` |
| `data-access/` | HTTP services, DTOs, API error handling only | `*-api.service.ts` |
| `state/` | NgRx Signal Store, loading/error state | `*.store.ts` |
| `models/` | Interfaces, enums, request/response types | `*.model.ts` |
| `utils/` | Pure functions — validators, formatters, mappers | `*.validator.ts`, `*.formatter.ts`, `*.mapper.ts` |

---

## 3. Performance Strategy

### 3.1 Code Splitting & Lazy Loading

All business modules **must be lazy loaded**. Never eagerly import domain modules into `app.routes.ts`.

```typescript
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./modules/dashboard/feature/dashboard.component')
        .then(m => m.DashboardComponent)
  },
  {
    path: 'employees',
    loadChildren: () =>
      import('./modules/employees/employees.routes')
        .then(m => m.EMPLOYEE_ROUTES)
  },
  {
    path: 'payroll',
    loadChildren: () =>
      import('./modules/payroll/payroll.routes')
        .then(m => m.PAYROLL_ROUTES)
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
```

```typescript
// modules/employees/employees.routes.ts
import { Routes } from '@angular/router';

export const EMPLOYEE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/employee-list/employee-list.component')
        .then(m => m.EmployeeListComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./feature/employee-detail/employee-detail.component')
        .then(m => m.EmployeeDetailComponent)
  }
];
```

### 3.2 Bundle Size Optimization

Use `@angular/build` with budget thresholds. Configure in `angular.json`:

```json
"budgets": [
  {
    "type": "initial",
    "maximumWarning": "500kb",
    "maximumError": "1mb"
  },
  {
    "type": "anyComponentStyle",
    "maximumWarning": "4kb",
    "maximumError": "8kb"
  }
]
```

Avoid barrel files (`index.ts`) that re-export everything — they defeat tree shaking. Import directly:

```typescript
// ❌ Avoid barrel re-exports for large modules
import { EmployeeService } from '@modules/employees';

// ✅ Import directly
import { EmployeeApiService } from './data-access/employee-api.service';
```

### 3.3 Caching Strategy

**CDN caching** — static assets use content-hashed filenames:

```
main.[hash].js       → Cache-Control: max-age=31536000, immutable
index.html           → Cache-Control: no-cache
assets/images/*      → Cache-Control: max-age=86400
```

**Service Worker** — use `@angular/service-worker` for PWA asset caching:

```typescript
// app.config.ts
import { provideServiceWorker } from '@angular/service-worker';
import { isDevMode } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
```

```json
// ngsw-config.json
{
  "index": "/index.html",
  "assetGroups": [
    {
      "name": "app-shell",
      "installMode": "prefetch",
      "resources": {
        "files": ["/favicon.ico", "/index.html", "/*.css", "/*.js"]
      }
    },
    {
      "name": "assets",
      "installMode": "lazy",
      "updateMode": "prefetch",
      "resources": {
        "files": ["/assets/**"]
      }
    }
  ],
  "dataGroups": [
    {
      "name": "api-freshness",
      "urls": ["/api/v1/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxSize": 100,
        "maxAge": "3d",
        "timeout": "10s"
      }
    }
  ]
}
```

### 3.4 Image & Asset Optimization

Use `NgOptimizedImage` for all `<img>` tags:

```typescript
// In standalone component
import { NgOptimizedImage } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgOptimizedImage],
  template: `
    <img ngSrc="/assets/images/avatar.webp" width="64" height="64" alt="Employee avatar" />
    <img ngSrc="/assets/images/hero-banner.webp" width="1200" height="400" priority alt="Dashboard banner" />
  `
})
export class ProfileComponent {}
```

Always deliver images in **WebP** format. Use responsive `srcset` for profile images.

### 3.5 Core Web Vitals

| Metric | Target | Strategy |
|---|---|---|
| **LCP** | < 2.5s | `priority` on hero images, preload key fonts |
| **FID / INP** | < 100ms / < 200ms | Avoid long tasks in main thread |
| **CLS** | < 0.1 | Always set `width`/`height` on images, skeleton loaders |

Skeleton loader pattern to prevent CLS:

```typescript
@Component({
  standalone: true,
  template: `
    @if (loading()) {
      <div class="skeleton-card" aria-busy="true"></div>
    } @else {
      <app-employee-card [employee]="employee()" />
    }
  `
})
export class EmployeeListItemComponent {
  loading = signal(true);
  employee = signal<Employee | null>(null);
}
```

```css
.skeleton-card {
  width: 100%;
  height: 80px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

---

## 4. State Management

### 4.1 Strategy: NgRx Signal Store (Global) + Component Signals (Local)

> **Decision (v2):** `BehaviorSubject` is retired from all shared domain state. All global/module state uses **NgRx Signal Store** (`@ngrx/signals`). Component-local UI state uses Angular `signal()` directly. This eliminates the v1 inconsistency of mixing BehaviorSubject and Signals in the same store class.

| Data Type | Tool | Where |
|---|---|---|
| Auth session, user profile | NgRx Signal Store | `core/auth/` |
| Shared domain data (employee list, payroll) | NgRx Signal Store | `modules/*/state/` |
| UI state (modal open, tab active, filter) | Component `signal()` | Inside component |
| Form state | `ReactiveFormsModule` / `ngModel` | Component |
| Server data stream | RxJS Observable from API | `data-access/` layer |

### 4.2 NgRx Signal Store — Standard Pattern

All module stores must follow this pattern. No exceptions.

```typescript
// modules/employees/state/employee.store.ts
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { inject, computed } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Employee } from '../models/employee.model';
import { EmployeeApiService } from '../data-access/employee-api.service';

type EmployeeState = {
  employees: Employee[];
  loading: boolean;
  error: string | null;
  selectedId: number | null;
};

export const EmployeeStore = signalStore(
  { providedIn: 'root' },
  withState<EmployeeState>({
    employees: [],
    loading: false,
    error: null,
    selectedId: null
  }),
  withComputed(({ employees, selectedId }) => ({
    selectedEmployee: computed(() =>
      employees().find(e => e.id === selectedId()) ?? null
    ),
    activeCount: computed(() =>
      employees().filter(e => e.status === 'active').length
    )
  })),
  withMethods((store, api = inject(EmployeeApiService)) => ({
    async loadEmployees(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const employees = await firstValueFrom(api.list());
        patchState(store, { employees, loading: false });
      } catch (err: any) {
        patchState(store, { error: err.message ?? 'Failed to load employees', loading: false });
      }
    },

    selectEmployee(id: number): void {
      patchState(store, { selectedId: id });
    },

    patchEmployee(updated: Employee): void {
      patchState(store, (state) => ({
        employees: state.employees.map(e => e.id === updated.id ? updated : e)
      }));
    },

    invalidateCache(): void {
      patchState(store, { employees: [] });
    }
  }))
);
```

### 4.3 Component Usage — Signal Store

```typescript
// feature/employee-list/employee-list.component.ts
import { Component, OnInit, signal, inject } from '@angular/core';
import { EmployeeStore } from '../../state/employee.store';
import { EmployeeTableComponent } from '../../ui/employee-table/employee-table.component';
import { EmployeeFilterComponent } from '../../ui/employee-filter/employee-filter.component';
import { EmployeeFilter } from '../../models/employee-filter.model';

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [EmployeeTableComponent, EmployeeFilterComponent],
  template: `
    <div class="page-container">
      <header class="page-header">
        <h1>Employees</h1>
        <span class="count-badge">{{ store.activeCount() }} active</span>
        <button class="btn-primary" routerLink="create">+ Add Employee</button>
      </header>

      <app-employee-filter (filterChange)="onFilter($event)" />

      @if (store.loading()) {
        <div class="skeleton-table" aria-busy="true" aria-label="Loading employees"></div>
      } @else if (store.error()) {
        <app-error-banner [message]="store.error()!" (retry)="store.loadEmployees()" />
      } @else {
        <app-employee-table
          [employees]="store.employees()"
          (rowClick)="store.selectEmployee($event)"
        />
      }
    </div>
  `
})
export class EmployeeListComponent implements OnInit {
  store = inject(EmployeeStore);

  // Local UI state — stays in component, never in store
  filterOpen = signal(false);

  ngOnInit(): void {
    this.store.loadEmployees();
  }

  onFilter(filter: EmployeeFilter): void {
    // Apply filter locally or trigger new load
  }
}
```

### 4.4 Migration Rule: Retiring BehaviorSubject

> Any `BehaviorSubject` in a module store is a code smell in v2. ESLint (flat config, `eslint.config.js`, run with `npm run lint`) can enforce it by adding this rule to the `**/*.ts` block — not enabled yet:

```js
'no-restricted-imports': ['error', {
  paths: [{
    name: 'rxjs',
    importNames: ['BehaviorSubject'],
    message: 'Use NgRx Signal Store withState() instead of BehaviorSubject in module stores.'
  }]
}]
```

`BehaviorSubject` remains allowed **only** in infrastructure services (such as the realtime connection) where a stream semantic is genuinely needed.

### 4.5 Cache Invalidation Strategy

```typescript
// After mutation — invalidate or optimistic patch
@Injectable({ providedIn: 'root' })
export class EmployeeService {
  private api = inject(EmployeeApiService);
  private store = inject(EmployeeStore);

  createEmployee(data: CreateEmployeeRequest): Observable<Employee> {
    return this.api.create(data).pipe(
      tap(() => this.store.invalidateCache()),
      switchMap(() => this.store.loadEmployees())
    );
  }

  updateEmployee(id: number, data: Partial<Employee>): Observable<Employee> {
    return this.api.update(id, data).pipe(
      tap((updated) => this.store.patchEmployee(updated)) // optimistic patch
    );
  }
}
```

### 4.6 Time and Polling (decided 2026-11-20, Improvements task 16)

- **Time and polling.** Read the current time through `injectNow('second' | 'minute')` from `core/clock/clock.service.ts`. Do not start your own `setInterval` for a "now" signal. Repeating server reads go through `ClockService.poll(callback, ms)`, which pauses while the tab is hidden and calls once when it is visible again. A `setInterval` outside `core/clock` is only for a real animation (a carousel, an auto-advancing tab), and it must be cleared on destroy.
- The minute clock changes on the wall-clock minute, so HH:MM labels turn over on time.

---

## 5. API & Data Fetching

### 5.1 API Layer Rules (decided 2026-11-18)

There is **no response envelope**. The backend returns the DTO itself, and lists return either an array or `PagedResult<T>` (`shared/models/paged-result.model.ts`: `items`, `pageNumber`, `pageSize`, `totalCount`).

**Rules**

1. **API services call `ApiClient`, not `HttpClient`.** `shared/data-access/api-client.ts` always targets `environment.apiUrl` (paths start with `/`) and has `get`, `getPage`, `getBlob`, `post`, `postBlob`, `put`, `delete`.
2. **Query strings go through `toHttpParams()`** (`shared/data-access/api-params.ts`), which `ApiClient` calls for every `params` object. Do not write `new HttpParams(`; `npm run lint` runs `scripts/check-http-params.mjs` and fails on new ones.
   - `null`, `undefined` and `''` are skipped; `false` and `0` are sent.
   - A `Date` is sent as a full UTC ISO instant. For a date-only value, send `dateOnly(date)` (local calendar day). Never use `toISOString().slice(0, 10)`.
   - Arrays repeat the key: `ids=a&ids=b`.
   - Build `params` as an explicit object literal in the order the backend expects. Do not pass a caller's filter object straight through.
3. **API services return backend DTOs unchanged.** Models in `models/` match the backend response types exactly.
4. **Mapping to view models happens in the store or a mapper file** (`utils/<x>.mapper.ts`), never in the API service. Error translation that turns a known backend error code into a typed error (for example `LeavePolicyConflictError`) may stay in the service as a `catchError`.
5. **Components never call an API service directly when a store exists for that data.** They read store signals and call store methods.
6. Every API service has a header comment naming the backend controller and route it targets.

**Reference module:** Leave (`modules/leave/data-access/`) follows all of these.

```typescript
// modules/leave/data-access/leave-type-api.service.ts
/** Client for ONEVO.Api's LeaveTypesController at /api/v1/leave/types. */
@Injectable({ providedIn: 'root' })
export class LeaveTypeApiService {
  private readonly api = inject(ApiClient);

  list(includeInactive: boolean): Observable<LeaveTypeResponse[]> {
    return this.api.get<LeaveTypeResponse[]>('/leave/types', { params: { includeInactive } });
  }

  deactivate(leaveTypeId: string, confirmed: boolean): Observable<void> {
    return this.api.post<void>(`/leave/types/${leaveTypeId}/deactivate`, {}, { params: { confirmed } });
  }
}
```

**Known `ApiClient` gaps (add them when the first module needs them, do not fall back to `HttpClient`):**

- no `patch` method (about 12 call sites in modules not moved yet);
- `ApiRequestOptions` has only `params`: no `headers` (e.g. idempotency keys in People offboarding), no `context` (`HttpContext`, e.g. `SILENT_HTTP_ERRORS` in Inbox), no `observe: 'response' | 'events'` (about 10 sites, e.g. upload progress).

Extend `ApiClient` and its spec in one change, keep `toHttpParams` as the only query builder, and update this list.

Modules not moved yet are listed in `docs/Improvements/person-4-api-layer-and-cleanup/task-04 Shared helpers for the API layer.md`. Move a module by switching its services to `ApiClient`, then run `node scripts/check-http-params.mjs --update` so the baseline shrinks.

### 5.2 Interceptor Chain — Registration Order

All interceptors are registered in this order in `src/app/app.config.ts` (verified 2026-10-27; there is no logging interceptor):

```typescript
// src/app/app.config.ts
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { correlationInterceptor } from './core/interceptors/correlation.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

provideHttpClient(withInterceptors([
  authInterceptor,        // 1. Attach credentials (cookie)
  correlationInterceptor, // 2. Attach X-Correlation-ID
  csrfInterceptor,        // 3. Attach X-CSRF-Token on mutations
  errorInterceptor        // 4. Handle errors (taxonomy, retry)
]))
```

### 5.3 Error Handling & Loading States

Global error interceptor with **retry + backoff for safe reads**. The sample below is the original v2 design; the shipped interceptor has no token refresh (see §7.3 for what it actually does):

```typescript
// core/interceptors/error.interceptor.ts
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, retry, timer } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { ErrorHandlerService } from '@core/services/error-handler.service';

let isRefreshing = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const errorHandler = inject(ErrorHandlerService);

  return next(req).pipe(
    // Retry transient 5xx and network errors (not 4xx)
    retry({
      count: 3,
      delay: (error: HttpErrorResponse, attempt: number) => {
        if (error.status >= 500 || error.status === 0) {
          return timer([250, 500, 1000][attempt - 1]); // exponential backoff
        }
        throw error; // do not retry 4xx
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // 401 — attempt token refresh once, then retry original request
      if (error.status === 401 && !isRefreshing && !req.url.includes('/auth/refresh')) {
        isRefreshing = true;
        return auth.refresh().pipe(
          switchMap(() => {
            isRefreshing = false;
            return next(req); // retry original request with new session
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            auth.clearSession();
            return throwError(() => refreshError);
          })
        );
      }
      // All other errors — pass to unified error taxonomy handler
      errorHandler.handle(error);
      return throwError(() => error);
    })
  );
};
```

Component-level loading state:

```typescript
@Component({
  standalone: true,
  template: `
    @if (store.loading()) {
      <app-loader />
    } @else if (store.error()) {
      <app-error-banner [message]="store.error()!" (retry)="store.loadEmployees()" />
    } @else {
      <app-employee-table [employees]="store.employees()" />
    }
  `
})
export class EmployeeListPageComponent {
  store = inject(EmployeeStore);
}
```

### 5.4 Real-Time Data with SignalR

Realtime uses ASP.NET Core SignalR through `@microsoft/signalr`, not raw WebSockets. `core/realtime/inbox-realtime.service.ts` (`InboxRealtimeService`) opens one connection to the backend's `/hubs/inbox` hub with `HubConnectionBuilder().withUrl(...).withAutomaticReconnect()`. It authenticates with the tenant session cookie, so no token is held in the frontend. Inbox and conversation events are pushed to the stores, which stay the source of truth: a missed event is recovered by the next normal API load, never by trusting the socket alone.

The backend's other hub, `/hubs/agent-commands`, serves the tray/monitoring agent and is not used by the web app.

---

## 6. Security Architecture

### 6.1 Authentication: Session ID via Cookie (No Token in Frontend)

> **Decision:** JWT is used on the backend. The frontend **never stores or accesses the JWT directly**. Authentication state is maintained via a **secure HttpOnly cookie** containing a session ID.

```typescript
// core/auth/auth.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { User } from './models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);
  isAuthenticated = signal(false);

  constructor(private http: HttpClient) {}

  login(credentials: LoginRequest): Observable<User> {
    return this.http
      .post<User>('/api/v1/auth/login', credentials, { withCredentials: true })
      .pipe(tap((user) => {
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      }));
  }

  logout(): Observable<void> {
    return this.http
      .post<void>('/api/v1/auth/logout', {}, { withCredentials: true })
      .pipe(tap(() => this.clearSession()));
  }

  me(): Observable<User> {
    return this.http
      .get<User>('/api/v1/auth/me', { withCredentials: true })
      .pipe(tap((user) => {
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      }));
  }

  clearSession(): void {
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }
}
```

```typescript
// core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
```

### 6.2 XSS & CSRF Protection

Angular's template engine auto-escapes interpolated values, and `[innerHTML]` bindings go through Angular's HTML sanitizer. Never use `bypassSecurityTrustHtml` (the codebase has none).

**Rich text written with raw DOM APIs.** The shared rich-text editor (`shared/ui/rich-text-editor`) loads stored HTML (task descriptions, comments, checklist task descriptions) with `element.innerHTML = ...`, which bypasses Angular's sanitizer. Every such write must go through `sanitizeEditableHtml()` (`shared/utils/editable-html.util.ts`, DOMPurify). It removes scripts, embedded frames, inline event handlers and script URLs but keeps the editor's own markup (mention chips, checkboxes, inline colours). The editor also emits sanitized HTML, so pasted web content cannot carry active content to the API. The backend rejects active content on write as well (`RichTextRules`). Any new component that assigns `innerHTML` from data must use the same helper.

CSRF: **double-submit cookie pattern** — the backend sets a readable `onevo_csrf` cookie (`onevo_legal_csrf` during the pending-legal login step), and the frontend sends it back as the `X-CSRF-Token` header on state-changing requests. `CsrfProtectionMiddleware` hashes the header and compares it with the hash stored on the server-side session, so the token is bound to that session (a copied CSRF value without the matching session cookie fails).

```typescript
// core/interceptors/csrf.interceptor.ts
const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE_NAMES = ['onevo_csrf', 'onevo_legal_csrf'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (SAFE_METHODS.includes(req.method)) {
    return next(req);
  }
  const token = readCsrfToken(inject(DOCUMENT)); // first cookie found in CSRF_COOKIE_NAMES
  if (!token) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { [CSRF_HEADER]: token } }));
};
```

> ⚠️ **Removed:** The v1 `X-Requested-With: XMLHttpRequest` header was a weak CSRF mitigation. It is replaced by the double-submit pattern above.

#### 6.2.1 Keyboard and screen-reader access (enforced by lint, 2026-10-28)

The angular-eslint accessibility template rules run as errors. The shared patterns that satisfy them:

| Situation | Pattern |
|---|---|
| Clickable card, row or tab that is not a `<button>` | `role="button" tabindex="0" appKeyboardClick` — `shared/directives/keyboard-click.directive.ts` fires the element's own `(click)` on Enter/Space, only when the element itself has focus |
| Backdrop, scrim, or a box whose click only focuses its input | `role="presentation"` (mouse convenience; Escape or the close button is the keyboard path) |
| Popover or menu that must not let clicks reach the parent's click-outside handler | `appStopClickPropagation` — `shared/directives/stop-click-propagation.directive.ts` |
| Heading over a group of buttons or a custom picker | `<span>` (not `<label>`), with `aria-label` on the group |
| Component outputs | Never a DOM event name: `cancelled` / `closed`, not `cancel` / `close` |

### 6.3 Correlation ID Interceptor

Every outbound HTTP request receives a unique `X-Correlation-ID` header. This allows frontend errors to be traced to backend logs during debugging and support.

```typescript
// core/interceptors/correlation.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

// Inline UUID v4 — no external dependency needed
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({
    setHeaders: { 'X-Correlation-ID': uuid() }
  }));
};
```

### 6.4 Input Validation & Sanitization

```typescript
// shared/utils/validation.helpers.ts
export const Validators = {
  isValidEmail: (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),

  sanitizeString: (input: string): string =>
    input.trim().replace(/[<>]/g, ''),

  isValidNIC: (nic: string): boolean =>
    /^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(nic),

  isPositiveNumber: (value: unknown): boolean =>
    typeof value === 'number' && value > 0 && isFinite(value)
};
```

### 6.5 Route Guards

```typescript
// core/guards/auth.guard.ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { map, catchError, of } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.me().pipe(
    map(() => true),
    catchError(() => {
      router.navigate(['/login']);
      return of(false);
    })
  );
};
```

> The shipped guard is permission-based, not role-based: `core/guards/permission.guard.ts` (`permissionGuard`) checks the route's required permissions against the session's permission list. The role-guard sample below is the original design.

```typescript
// core/guards/role.guard.ts (design sample, not in the codebase)
import { inject } from '@angular/core';
import { CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const requiredRoles: string[] = route.data['roles'] ?? [];
  const user = auth.currentUser();

  if (!user) return false;
  return requiredRoles.some(role => user.roles.includes(role));
};
```

### 6.6 Security Headers Policy (v2.1)

> These headers are set at the hosting/CDN/reverse-proxy layer (e.g. Nginx, Cloudflare, Vercel), **not** in Angular application code — Angular has no runtime control over HTTP response headers. They're documented here because the frontend team owns the deployment config and must verify these are present before go-live.

| Header | Value | Purpose |
|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Forces HTTPS, prevents downgrade attacks |
| `X-Frame-Options` | `DENY` | Prevents clickjacking via iframe embedding |
| `X-Content-Type-Options` | `nosniff` | Blocks MIME-sniffing attacks |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.onevo.com wss://api.onevo.com; frame-ancestors 'none'` | Restricts what scripts/styles/connections the page can load — primary XSS mitigation layer |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limits referrer leakage to third parties |
| `Permissions-Policy` | `geolocation=(), camera=(), microphone=(), payment=()` | Disables unused browser APIs at the origin level |

```nginx
# nginx.conf snippet — apply to the ONEVO HRMS server block
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), camera=(), microphone=(), payment=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.onevo.com wss://api.onevo.com; frame-ancestors 'none'" always;
```

> **CI gate:** Add a smoke test (e.g. via `curl -I` or Playwright's response headers assertion) against the staging deployment that fails the pipeline if any of these six headers is missing.

---

## 7. Error Handling & Resilience

> This section was added in v2. The v1 error interceptor only handled basic 401/403/500. The full taxonomy, refresh-retry flow, and retry backoff are now required.

### 7.1 Error Taxonomy — HTTP Code → User Action Mapping

All HTTP error codes must map to exactly one action. This table is the source of truth for `ErrorHandlerService`.

| HTTP Code | User Message | Behaviour | Telemetry Event |
|---|---|---|---|
| `401` | *(session ended)* | No retry (no refresh token) → redirect to login with return path | `auth_session_expired` |
| `403` | "You don't have access to this." | Banner notification | `auth_forbidden` |
| `404` | "This record no longer exists." | Inline message | `resource_not_found` |
| `409` | "This record was just updated by someone else. Please refresh." | Inline message | `data_conflict` |
| `422` | "Please check the highlighted fields." | Inline (form errors) | `validation_error` |
| `429` | "Too many requests. Please wait a moment." | Banner notification | `rate_limited` |
| `500` | "Something went wrong. Please try again." | Banner notification | `server_error` |
| `503` | "Service temporarily unavailable." | Banner notification | `service_unavailable` |
| `0` / offline | "You appear to be offline." | Persistent banner | `network_offline` |

```typescript
// core/services/error-handler.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';

interface ErrorAction {
  userMessage: string;
  behaviour: 'redirect' | 'banner' | 'inline' | 'silent';
  telemetryEvent: string;
}

const ERROR_TAXONOMY: Record<number | string, ErrorAction> = {
  401:     { userMessage: '',                                                              behaviour: 'silent', telemetryEvent: 'auth_session_expired' },
  403:     { userMessage: "You don't have access to this.",                               behaviour: 'banner', telemetryEvent: 'auth_forbidden' },
  404:     { userMessage: 'This record no longer exists.',                                behaviour: 'inline', telemetryEvent: 'resource_not_found' },
  409:     { userMessage: 'This record was just updated by someone else. Please refresh.', behaviour: 'inline', telemetryEvent: 'data_conflict' },
  422:     { userMessage: 'Please check the highlighted fields.',                         behaviour: 'inline', telemetryEvent: 'validation_error' },
  429:     { userMessage: 'Too many requests. Please wait a moment.',                     behaviour: 'banner', telemetryEvent: 'rate_limited' },
  500:     { userMessage: 'Something went wrong. Please try again.',                      behaviour: 'banner', telemetryEvent: 'server_error' },
  503:     { userMessage: 'Service temporarily unavailable.',                             behaviour: 'banner', telemetryEvent: 'service_unavailable' },
  offline: { userMessage: 'You appear to be offline.',                                    behaviour: 'banner', telemetryEvent: 'network_offline' },
};

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  handle(error: HttpErrorResponse): void {
    const key = error.status === 0 ? 'offline' : error.status;
    const action = ERROR_TAXONOMY[key] ?? {
      userMessage: 'An unexpected error occurred.',
      behaviour: 'banner',
      telemetryEvent: 'unknown_error'
    };

    this.logger.error(`[HTTP ${error.status}]`, { url: error.url, event: action.telemetryEvent });

    if (action.behaviour === 'banner') {
      this.notify.error(action.userMessage);
    }
    // 'inline' and 'silent' behaviours are handled by the component / interceptor respectively
  }
}
```

### 7.2 Retry Logic with Exponential Backoff

Transient 5xx errors and network failures (status `0`) are retried up to 3 times with increasing delays. 4xx errors are **never** retried.

```typescript
// Inside error.interceptor.ts (see §5.3 for full file)
retry({
  count: 3,
  delay: (error: HttpErrorResponse, attempt: number) => {
    if (error.status >= 500 || error.status === 0) {
      const delays = [250, 500, 1000];
      return timer(delays[attempt - 1] ?? 1000);
    }
    throw error; // re-throw 4xx immediately — no retry
  }
})
```

### 7.3 Token Refresh Flow

**There is no token refresh (verified 2026-10-27).** The backend uses a single session cookie with sliding expiry and no refresh token (`SessionPolicy.cs`). A `401` mid-session means the session itself is gone (idle past the window, revoked, or signed out elsewhere), so `error.interceptor.ts` does not retry it: the user is sent to log in again with a return path.

What the interceptor does retry: `GET`/`HEAD` requests that fail with a 5xx or a dropped connection, up to 3 times with 250/500/1000 ms delays. Writes are never retried automatically, because a failed response does not prove the write was not applied (retrying once duplicated calendar events).

### 7.4 Error States in Components — Required Pattern

Every async component must handle all four states. No exceptions.

```typescript
@Component({
  standalone: true,
  template: `
    @if (store.loading()) {
      <div class="skeleton-rows" aria-busy="true" aria-label="Loading..."></div>
    } @else if (store.error()) {
      <app-error-banner
        [message]="store.error()!"
        (retry)="store.loadEmployees()"
      />
    } @else if (store.employees().length === 0) {
      <app-empty-state
        icon="users"
        message="No employees yet."
        actionLabel="Add Employee"
        actionRoute="/employees/create"
      />
    } @else {
      <app-employee-table [employees]="store.employees()" />
    }
  `
})
export class EmployeeListPageComponent {
  store = inject(EmployeeStore);
}
```

> **Rule:** All four states (loading, error, empty, data) are mandatory for any list or detail page. Missing any one will show blank screens in production.

### 7.5 Circuit Breaker

> Added in v2.1. Retry with backoff (§7.2) handles transient single-request failures, but does not prevent the frontend from hammering a backend that is fully down (e.g. mid-restart or deployment). The circuit breaker sits above retry and stops outbound calls to a failing endpoint group entirely once a failure threshold is crossed.

```typescript
// core/services/circuit-breaker.service.ts
import { Injectable, signal } from '@angular/core';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitEntry {
  state: CircuitState;
  failureCount: number;
  openedAt: number | null;
}

const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 30_000; // 30s probe window

@Injectable({ providedIn: 'root' })
export class CircuitBreakerService {
  private circuits = new Map<string, CircuitEntry>();
  status = signal<Record<string, CircuitState>>({});

  private getEntry(key: string): CircuitEntry {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, { state: 'CLOSED', failureCount: 0, openedAt: null });
    }
    return this.circuits.get(key)!;
  }

  /** Call before issuing a request. Throws if the circuit is OPEN and not yet ready to probe. */
  canRequest(key: string): boolean {
    const entry = this.getEntry(key);

    if (entry.state === 'OPEN') {
      const elapsed = Date.now() - (entry.openedAt ?? 0);
      if (elapsed >= OPEN_DURATION_MS) {
        entry.state = 'HALF_OPEN'; // allow a single probe request through
      }
    }

    return entry.state !== 'OPEN';
  }
}
```

> **Note:** The document provided to establish this file was truncated mid-section (§7.5 Circuit Breaker) before it reached the source. Sections 8–15 (Accessibility, Responsiveness, Testing, Build & Deployment, Coding Standards, SEO, Monitoring, and the final Example Folder Structure) are referenced in the table of contents but were not included in the received content. Paste the remaining sections and I'll append them here to complete the document.
