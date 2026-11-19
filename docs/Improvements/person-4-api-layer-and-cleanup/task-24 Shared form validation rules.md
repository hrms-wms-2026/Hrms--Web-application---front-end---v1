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
