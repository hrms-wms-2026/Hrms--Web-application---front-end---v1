# Part 2: Four-step create wizard (no release date, independent banner)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. One commit per numbered task. Depends on Part 1.

**Goal:** Turn Create Project into a 4-step wizard. Drop release date from the form. Add optional banner, independent of logo. Stage members client-side (invite them in Part 3 after create).

**Spec:** `docs/superpowers/specs/next/2026-08-20-work-management-project-page-redesign-design.md`

**Status:** pending

## Global Constraints

Same as Part 1. Do not call `POST /work/projects/{id}/members` yet — Part 3 wires that. This part only stages employee ids on the payload.

## Tasks

### Task 1: Validator — release date no longer required

**Files:** `src/app/modules/work/utils/project-form.validator.ts` + `.spec.ts`

- [ ] Make `releaseDate` optional on `ProjectFormFields` (`string`, may be `''`). Remove the create-mode `releaseDate` required check.
- [ ] Replace the spec `requires releaseDate only in create mode` with `allows a blank releaseDate in create mode`.
- [ ] Commit: `feat(work): stop requiring a release date on create project.`

### Task 2: Payload + API — optional releaseDate, independent banner

**Files:** `project.model.ts`, `project.dto.ts`, `project-api.service.ts` + `.spec.ts`, `project-list.store.spec.ts` (payload literals)

- [ ] `CreateProjectPayload` / `CreateProjectRequestDto`: `releaseDate: string | null`; add `bannerFile: File | null`.
- [ ] `create()`: omit `releaseDate` form field when null/blank. `formData.set('banner', file)` when `bannerFile` is set. Logo unchanged.
- [ ] Tests: no `releaseDate` key when null; `banner` file present when provided; logo still independent.
- [ ] Commit: `feat(work): send optional banner and omit blank releaseDate on create project.`

### Task 3: Four-step wizard in `ProjectFormModalComponent`

**Files:** `project-form-modal.component.ts` + `.spec.ts`

Steps (`step` signal 1–4), Next/Back, Create only on step 4:

1. **Category** — pills from `categoryStore.categories()`, `data-testid="category-pill"` + `data-category-id`. Selecting sets `categoryId`. Next blocked without category.
2. **Details** — existing name/identifier/description/start/target/hours/color/logo **plus banner** (`data-testid="banner-field"`). **No release-date field.** Next runs `validateProjectForm` (create).
3. **Members** — optional. `+ Add member` opens `app-employee-picker`. Staged ids in `memberEmployeeIds` signal, listed with directory names. Skip allowed.
4. **Preview** — name, identifier, category label, dates, member count, logo/banner file names if any. Submit emits `CreateProjectPayload` with `releaseDate: null`, `bannerFile`, and `memberEmployeeIds` (add that field to the payload).

- [ ] Reset all fields + `step=1` + `memberEmployeeIds=[]` when `open()` becomes true.
- [ ] Tests: no `release-date-field`; banner field present; cannot Next from step 1 without category; valid details → step 3; submit from step 4 emits `releaseDate: null` and `bannerFile` when chosen.
- [ ] Commit: `feat(work): turn create project into a four-step wizard.`
