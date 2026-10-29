# ONEXSO UAT Readiness Audit (October 2026): Frontend

| Field | Value |
|---|---|
| Audit date | 2026-10-29 |
| Audit branch | `audit/uat-readiness-2026-10` |
| Frontend baseline | `Development` @ `1c6211b0` |
| Backend baseline | `development` @ `8ce94e88` |

## Table of Contents

1. [Purpose](#1-purpose)
2. [Reports in This Repository](#2-reports-in-this-repository)
3. [Full Report Set](#3-full-report-set)
4. [Frontend Issues at a Glance](#4-frontend-issues-at-a-glance)

## 1. Purpose

This is the frontend part of the ONEXSO UAT readiness audit. It was a source-code audit with test runs and a local runtime smoke test. No product code was changed.

## 2. Reports in This Repository

| No. | Report | File |
|---|---|---|
| 4 | Frontend UAT Audit | [04-frontend-uat-audit.md](04-frontend-uat-audit.md) |

## 3. Full Report Set

All 13 reports, including the cross-application reports (API compatibility, security, issue register, task backlog, checklist and go/no-go), are in the backend repository on the same branch:

`HRMS-Backend-v1` → branch `audit/uat-readiness-2026-10` → `docs/uat-readiness/`

Issue IDs (`UAT-0xx`) are shared between the two repositories.

## 4. Frontend Issues at a Glance

| ID | Severity | Title | Fix location |
|---|---|---|---|
| UAT-001 | P1 | Planner calls `/planner/me/range` and `/me/focus`, which are missing on backend `development` | Backend merge or planner out of scope |
| UAT-002 | P1 | No frontend CI | `.github/workflows/ci.yml` (new) |
| UAT-013 | P2 | 5 ESLint errors | `calendar-page.component.html:108-109`, `meeting-form-modal.component.ts:18` |
| UAT-006 | P2 | Coverage modal calls missing `positions/coverage/by-target` | Backend endpoint, or remove the call |
| UAT-014 | P3 | Flaky `landing-header.component.spec.ts` | Spec |
| UAT-015 | P3 | Dashboard time-zone inconsistency (suspected) | Dashboard widgets |
| UAT-017 | P3 | Dead `setTrayAppAccess()` call | `people-api.service.ts:105` |
