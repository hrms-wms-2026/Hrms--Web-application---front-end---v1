# Server Field Errors on Profile and Checklist Forms Implementation Plan (task 20 follow-up 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A refused save on the profile panels (personal info, emergency contacts, dependents, payroll) and the checklist builder shows its field messages next to the fields and any other message once, using the pattern from #191.

**Bugs found while surveying:**
- Emergency contact, dependent and payroll saves that fail with 400/404/409/422 show **nothing**. The store keeps `saveError`, but those panels never display it.
- The personal info banner shows `saveError` from any tab's failed save.
- A failed checklist save toasts **twice**: the store and then the builder. A 5xx toasts three times, because the error handler toasts too.

**Architecture:**
- `ProfileStore` keeps `saveApiError` and `saveTarget` ('personal' | 'emergencyContact' | 'dependent' | 'payroll'). It clears both when a save starts, and `clearSaveError()` clears them on sub-tab change.
- The profile tab passes each panel only its own error (`serverErrorFor(target)`).
- Panels take a signal input `serverError`, apply it with `applyServerFieldErrors(form, error, shownFields)`, and show the leftover message, or `failedSaveToast(...)` for a non-field error, through `<app-field-error>`.
- The personal info form rebuilds only when `personalInformation` changes, so a server error is not wiped.
- `ChecklistTemplateStore` keeps `saveApiError` and no longer toasts failures. The builder applies field errors (shown: `name`) and toasts `failedSaveToast` or the leftover message.

**Base:** stacked on `chore/server-field-errors` (#191).

### Tasks
1. Failing specs, then the change: profile store `saveApiError`, `saveTarget` and `clearSaveError`.
2. Failing specs, then the change: emergency contacts, dependents and payroll panels show field and non-field server errors.
3. Failing spec, then the change: the personal info form keeps a server error across unrelated input changes and shows it.
4. The profile tab wires each panel to its own error and clears on sub-tab change, with a spec.
5. Failing specs, then the change: the checklist store keeps `saveApiError` and does not toast a failure; the builder shows the name field error and toasts once.
6. Docs (ARCHITECTURE §7.4 users list, task 20 Remaining), full gate ×3, review, push, and a PR stacked on #191.
