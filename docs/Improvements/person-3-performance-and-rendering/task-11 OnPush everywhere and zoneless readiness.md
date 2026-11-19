# Task 11: OnPush everywhere and zoneless readiness

| | |
|---|---|
| Priority | 11 of 24 (lower number = build first) |
| Owner folder | person-3-performance-and-rendering |
| Size | 1 person, 1 day |
| Area | Performance, Rendering |
| Depends on | nothing |

## What we found

320 of 414 components use `ChangeDetectionStrategy.OnPush`. The other 94 use the default, which re-checks them on every event anywhere in the app. They are concentrated: 45 in `modules/work/ui`, 11 in `modules/inbox/ui`, 9 in `modules/work/feature`, 6 in `core/auth/feature`, and a few shared ones (`tabs`, `modal`, `popover`, `page-header`, `progress-bar`, `progress-ring`, `rich-text-editor`). The shared ones matter most because they sit inside every screen.

The app still uses zone.js. Since state is already in signals, moving to zoneless change detection is realistic and removes a whole class of wasted work.

## What to do

1. Add `OnPush` to the shared components first, then inbox, then work. Fix what breaks: usually a plain field mutated in a callback, which should become a signal.
2. Add an ESLint rule (`@angular-eslint/prefer-on-push-component-change-detection`) so new components cannot skip it.
3. Find code that depends on zone.js: `setTimeout` or third-party callbacks that change plain fields, `NgZone` use, manual `detectChanges`.
4. Try `provideZonelessChangeDetection()` on a branch, run the unit and e2e suites, and write down what fails.
5. Do not switch to zoneless in this task. Deliver the list of blockers and an estimate.

## Done when

- All components are `OnPush` and the lint rule is on.
- The full test suite passes.
- The zoneless findings are written in `docs/reports/`.
