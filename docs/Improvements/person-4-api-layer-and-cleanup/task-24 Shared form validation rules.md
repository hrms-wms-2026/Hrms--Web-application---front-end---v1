# Task 24: Shared form validation rules

| | |
|---|---|
| Priority | 24 of 24 (lower number = build first) |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | Code quality, API |
| Depends on | backend 19 |

## What we found

- Form validation rules are written per form. The duplicate scan lists repeated validator and form set-up blocks among the 295 duplicates.
- Limits such as maximum name length, allowed date range or required fields are typed as numbers in the frontend and again in the backend. When one side changes, the user gets a server error after filling a form that looked valid.
- Error messages for the same rule differ between forms.
- The largest forms (`add-employee-wizard`, 1,347 lines plus an 1,151-line store, `position-management`, `task-form-modal`) each carry their own copy of the rules.

## What to do

1. Create `shared/utils/validators/` with named, tested validators: required text, name, email, phone, date range, positive number, maximum length, rich text length.
2. Create one message map (rule key to message) and one small component or directive that shows field errors the same way everywhere, including server field errors from task 20.
3. Put the shared limits in one constants file per domain that mirrors the backend validators. If the generated API types from task 08 carry length limits, read them from there instead.
4. Move three forms to the shared validators: one small, one medium, and the leave request form.
5. Keep both layers. Frontend rules help the user; backend rules (backend task 19) protect the data. Never remove a backend rule because the frontend has it.
6. List the remaining forms with an owner.

## Done when

- The shared validators have unit tests.
- Three forms use them and show the same messages for the same rules.
- The remaining forms are listed.

## Status (2026-11-23)

Done on branch `chore/shared-form-validation`. Plan: `docs/superpowers/plans/next/2026-11-23-shared-form-validation.md`.

- `shared/utils/validators/`: pure rules (`validation-rules.ts`: required text, max length, email, phone, pattern, positive number, rich text length, date range), `AppValidators` for reactive forms (`form-validators.ts`, including `name()` and a `dateRange()` group validator), one message map with `validationMessage()` and `fieldError()` (`validation-messages.ts`). All have unit tests.
- `<app-field-error>` (`shared/ui/field-error`) shows a message for fields that are not `app-input`.
- Limits: `modules/organization/utils/organization-limits.ts` and `modules/leave/utils/leave-limits.ts`, each constant naming the backend validator it mirrors. Description limits stay in `shared/constants/text-limits.ts`. The OpenAPI document and the task 08 types do not carry FluentValidation limits, so they are hand-written.
- Three forms moved: department form modal (small), leave type form modal (medium), new leave request wizard.
- Rule: a frontend limit may be stricter than the backend's, never looser. Required text trims, like the backend's `ValidName`. Rich text length counts the stored HTML, like `ValidRichText`.
- Server field errors (the 400 body's `errors` map, PascalCase keys) are left to task 20, which is blocked on backend task 24.

### Drift found

| Field | Frontend before | Backend | Result |
|---|---|---|---|
| Department name | max 200 | max 100 (`DepartmentInputValidator`) | **Fixed to 100.** 101–200 characters used to fail on the server |
| Department code | no pattern | `^[A-Za-z0-9_-]{1,20}$` | **Pattern added.** `R&D` used to fail on the server |
| Department code | required | optional | Kept required (stricter) |
| Leave type description | max 500 | no rule, `nvarchar(max)` | Kept 500 (stricter) |
| Leave request reason | max 500 | max 2000 (`SubmitLeaveRequestCommandValidator`) | Kept 500 (stricter, product decision) |
| Company name / code | 200 / 20 | 200 / 20 (`CreateLegalEntityCommandValidator`) | Same, no change |

### Follow-up (2026-11-24, branch `chore/shared-validation-forms`)

19 more forms moved to the shared validators, messages and per-module limits:
- **Organization:** role, position, position coverage, create company, general settings.
- **Auth:** login, forgot password, reset password, accept invitation.
- **Profile:** personal info, emergency contacts, dependents, payroll (bank details), security.
- **People and planner:** checklist builder, employee job info, start offboarding, calendar event, meeting.

`ProfileValidators` and `shared/utils/validation.helpers.ts` are deleted, because the shared rules replace them.

More drift was found where the frontend was looser than the backend. All of it is fixed:

| Field | Frontend before | Backend | Now |
|---|---|---|---|
| Role name | max 100 | max 50, `^[A-Za-z0-9 _-]+$` (`Create/UpdateRoleCommandValidator`) | 50 + allowed characters |
| Role description | max 500 | max 255 | 255 |
| Checklist template name | max 150 | max 100 (`CreateChecklistTemplateCommandValidator`) | 100 |
| Emergency contact name / relationship / phone / email | no limit, no email check | 100 / 30 / 20 / 255 + email | same as backend |
| Dependent name / phone | no limit | 100 / 20 | same as backend |
| Bank details (6 fields) | no limit | 100 / 100 / 100 / 34 / 30 / 20 (`UpdateBankDetailsCommandValidator`) | same as backend |
| Offboarding notes | no limit | max 4000 | 4000 |
| Meeting title | no limit | max 500 (`MeetingCreateValidator`) | 500 |

### Remaining forms

| Form | Owner | Note |
|---|---|---|
| `modules/people/feature/add-employee-wizard` | People module owner | Large (1,347 lines + store); move during its refactor |
| `modules/organization/feature/position-management` | Organization module owner | Large; move during its refactor |
| `modules/work/ui/task-form-modal` | Work module owner | Large (3,770 lines); move during its split |

Pickers whose required check depends on another field (coverage target, checklist department/position) still check the value in the template. Their text already matches the shared `required` message.
