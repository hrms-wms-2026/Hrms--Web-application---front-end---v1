# Part 7: Test coverage audit for every side-effecting component in this plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run last, after Parts 1–6 are fully implemented. Frontend companion to the backend plan's Part 10
— a checklist-driven re-read of every test file for a component that calls the backend and changes state
(the frontend's closest equivalent to a "Command"), not new features. Same reasoning as the backend Part
10: don't skip this, it exists because test suites for interactive components like these reliably miss the
same handful of things.

## General rules for this Part (mirror of the backend Part 10's rules, adapted)

- **Never assert only that a spy/mock was called.** Also assert the resulting DOM/signal state — a
  component whose click handler calls the right service method but then does nothing with the response (or
  swallows an error silently) will still pass a test that only checks `expect(spy).toHaveBeenCalled()`.
- **Every disabled/hidden UI state needs a test proving it's disabled/hidden, not just that the enabled
  state renders correctly.** A button with `[disabled]="someComputed()"` needs at least one test where that
  computed is true and the DOM property is actually asserted `true`.
- **Test the exact boundary, not just clearly-inside/clearly-outside**, same as the backend note — this
  plan's frontend has the identical `percent > current` client-side check as the backend, and it needs the
  identical boundary tests (equal, one below, one above).
- **Async component methods need `await`/`fixture.whenStable()` before assertions**, and every test
  asserting on an HTTP call needs to confirm no *extra* unexpected request fired (use `httpMock.verify()`
  in an `afterEach` if the file's `HttpClientTestingModule` setup doesn't already do this).
- **A click handler that stops propagation needs a test that actually simulates the click and checks the
  *other* handler did NOT also fire** — not just that the click's own handler fired.

---

### Task 1: `TaskClockWidgetComponent` (Part 3)

**File:** `src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.spec.ts`

- [ ] Every one of the 4 `clockInDisabled()` conditions (locked at 100, other-employee open session, not
  an assignee, and — implicitly — none of those, so enabled) has its own test, and each disabled case's
  `clockInDisabledReason()` is asserted to contain the specific expected substring, not just that it's
  non-empty (Part 3 already does this for 3 of the 4 — confirm the 4th, "enabled," case is covered by the
  first test in the file and that it explicitly checks `.disabled === false`, not merely that the button
  exists).
- [ ] Push popup: percent exactly equal to current → blocked (Part 3 has this). Percent one **less** than
  current → also blocked (not yet in Part 3's plan — add it, since "not greater than" covers two distinct
  boundary directions and only one was tested). Percent one **more** than current → allowed, and the actual
  `TaskApiService.push` call fires with the correct `taskId`/`percent`/`reason`.
- [ ] Push success → `pushed` output emits the mapped `WorkTask` (not the raw DTO — confirm `toWorkTask` is
  actually applied, a test asserting on `dto`-shaped fields when it should be `WorkTask`-shaped fields would
  be a subtle bug), and the popup closes (`pushPopupOpen()` becomes `false`).
- [ ] Push failure (service throws / returns an error response) → popup stays open, `pushError()` is set
  from the error detail, `pushSubmitting()` returns to `false` (the `finally` block) — Part 3's plan didn't
  include a failure-path test at all; add one, this is the most likely gap in this file.
- [ ] Clock In click → `TaskApiService.clockIn` is called with the correct `taskId`, and `clockedIn` emits
  only after the call resolves (not synchronously before it) — an `await`/`fakeAsync`+`tick()` test, not a
  synchronous one, or this timing bug would slip through.
- [ ] Reason field: submitting with a reason includes it verbatim in the `push` call's body; submitting
  with the reason field left empty sends `undefined`, not an empty string (mirrors the backend's null-vs-
  empty-string concern from its own Part 10).

Commit:
```bash
git add src/app/modules/work/ui/task-clock-widget/task-clock-widget.component.spec.ts
git commit -m "test(work): harden TaskClockWidgetComponent test coverage per Part 7 audit"
```

---

### Task 2: `TaskDetailModalComponent`'s percent/reason/history additions (Part 4)

**File:** `src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.spec.ts`

- [ ] `progressPercent`/`reason` are included in **both** the `editTask` (owner) and `createTaskEditRequest`
  (non-owner) submission paths — Part 4's plan only tested the owner path explicitly; add the equivalent
  test for `isObjectiveOwner = false`, asserting `createTaskEditRequest` was called with the same two
  fields. These two paths are exactly where the backend's Part 4 found attribution differs — the frontend
  test suite must prove both call sites actually send the data, since a bug fixing one and forgetting the
  other is easy to make and easy to miss.
- [ ] Reopening the modal for a **different** task after having entered (but not submitted) a
  `progressPercent`/`reason` value on the first task → the form resets to the second task's own values, not
  leftover state from the first (mirrors the existing `effect()`'s documented reason for re-seeding on
  every `open()` transition — Part 4 didn't add a dedicated test for this specific new-field case, only
  relying on the pre-existing effect; add one that would fail if the reset logic for these two new fields
  were accidentally left out of that effect).
- [ ] `hasOpenSessionMine()`/`hasOpenSessionOtherEmployee()` computed correctly from a history feed
  containing an open session — test both outcomes (mine vs. someone else's) as two separate cases, and a
  third case with **no** open session at all in the history (both computeds `false`) — Part 4's plan only
  specified the computed logic, not explicit tests for all three states; add them.
- [ ] History fetch failure (service throws) → the modal still opens and shows the rest of the form; it
  does not crash or leave the modal in a stuck loading state — not covered anywhere in Part 4's plan text,
  add it.
- [ ] `onTaskPushed` → both re-emits `saved` **and** triggers a history reload — test both effects
  independently (a spy on `loadHistory`'s underlying `getTaskHistory` call, and a separate assertion that
  `saved` emitted with the pushed task).

Commit:
```bash
git add src/app/modules/work/ui/task-detail-modal/task-detail-modal.component.spec.ts
git commit -m "test(work): harden TaskDetailModalComponent percent/reason/history test coverage per Part 7 audit"
```

---

### Task 3: `MyTaskComponent` (Part 5)

**File:** `src/app/modules/work/feature/my-task/my-task.component.spec.ts`

- [ ] Search filter is case-insensitive **and** matches on `shortId` as well as `title` — Part 5's plan
  only tested a title substring match; add a `shortId`-match test and a differently-cased match test
  explicitly.
- [ ] Switching the Sprint filter **while a search term is active** → both filters apply together (the
  refetch from the sprint change must not silently clear the search box, and the search must still narrow
  the newly-fetched sprint-filtered list) — not in Part 5's plan text, add it; filter-combination bugs are
  a common miss.
- [ ] `reload()` (called after Create/Save) preserves the currently-selected `view()` and `sprintFilter()`
  — the user shouldn't be bounced back to Board view or "All Sprints" just because a task was created; add
  a test that sets both to non-default values, calls `reload()`, and confirms both are unchanged afterward.
- [ ] Load failure (either `getMyTasks` or `getStatuses` rejects) → `error()` is set and the loading state
  clears — Part 5's plan didn't include an explicit failure-path test for this component's own `load()`;
  add one, matching the `catch`/`finally` shape already in the implementation.
- [ ] Empty state distinguishes "no tasks assigned" from "no search results" (Part 5 Task 2 already covers
  the first case — add the second: some tasks exist, but the search term matches none of them).

Commit:
```bash
git add src/app/modules/work/feature/my-task/my-task.component.spec.ts
git commit -m "test(work): harden MyTaskComponent test coverage per Part 7 audit"
```

---

### Task 4: Card/row clock-widget wiring — click isolation (Part 6)

**Files:**
- `src/app/modules/work/ui/task-card/task-card.component.spec.ts`
- `src/app/modules/work/ui/task-table/task-table.component.spec.ts`

For **both** files:
- [ ] Clicking the clock widget's Clock In button does **not** also emit the card/row's own `viewed`
  output — simulate the click on the actual nested button, not a direct method call on the component
  instance (a direct method call would bypass the DOM event entirely and could pass even if
  `stopPropagation()` were missing).
- [ ] Clicking inside the open Push popup (percent input, reason input, Submit, Cancel) does not emit
  `viewed` either — the popup is a separate nested overlay from the Clock In button itself, and Part 6's
  plan only explicitly called out stopping propagation at the outer wrapping `<div>`; confirm clicks on the
  popup's own inner controls are also covered by that same wrapper (they should be, since it wraps the
  whole `@if (hasOpenSessionMine())` block per Part 3's template) — write the test against the popup's
  submit button specifically, don't assume the outer-div test generalizes without checking.
- [ ] `isAssignee`/`hasOpenSessionMine`/`hasOpenSessionOtherEmployee` computeds: test all 3 boolean
  combinations that are actually reachable (assignee+mine, assignee+other, assignee+none, not-assignee) —
  Part 6's plan gave 3 example tests; confirm the 4th (`isAssignee() === false`, widget not rendered at all)
  is also present, since `@if (isAssignee())` gates the whole widget.

Commit:
```bash
git add src/app/modules/work/ui/task-card/task-card.component.spec.ts src/app/modules/work/ui/task-table/task-table.component.spec.ts
git commit -m "test(work): harden card/row clock-widget click-isolation test coverage per Part 7 audit"
```

---

## Self-review checklist for this Part

- [ ] Every box above is checked with a real passing test, or explicitly flagged as a product question to
  the user (none in this Part are expected to be, unlike the backend Part 10's Task 6 — if you find one,
  stop and ask rather than deciding silently).
- [ ] `npm test` is green for the whole `work` module after this Part's final commit.
- [ ] `ng build` still succeeds (a test-only Part shouldn't change this, but confirm nothing was
  accidentally left in a broken state from an earlier Part).
