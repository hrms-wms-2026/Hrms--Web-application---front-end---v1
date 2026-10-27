# CLAUDE.md

Guidance for Claude Code (and humans) working in this Angular frontend.

## Build, test and scan

The dev-env gate scripts live outside this repo, in `../dev-env/scripts/`. They print one line per step and keep full logs in `../dev-env/reports/`:

- `pwsh ../dev-env/scripts/verify.ps1 frontend` runs the zero-warnings production build and the unit tests.
- `pwsh ../dev-env/scripts/verify.ps1 frontend -Format -Baseline origin/Development` also runs a Prettier check on the files changed on this branch.
- `pwsh ../dev-env/scripts/security-scan.ps1 frontend -Baseline origin/Development` runs the security scanners and shows only Semgrep findings new on this branch.
- `npm run lint` runs ESLint (`eslint.config.js`). It must report **0 errors**. Warnings are a tracked backlog (mostly keyboard accessibility); do not add new ones.

## Security rules

- Never assign data to `innerHTML` directly. Angular's `[innerHTML]` binding sanitizes; raw `element.innerHTML = ...` does not. Pass any stored or user HTML through `sanitizeEditableHtml()` (`src/app/shared/utils/editable-html.util.ts`) first.
- Never use `bypassSecurityTrust*`.

## Zero warnings (mandatory)

`ng serve`, `ng build` and `ng test` must print **no warnings and no errors**. A change that adds a warning is not finished.

**How it is enforced**

- `tsconfig.json` sets `angularCompilerOptions.extendedDiagnostics.defaultCategory` to `"error"`. Angular template diagnostics (NG8xxx) such as NG8107 (unneeded `?.`) and NG8102 (unneeded `??`) fail the build instead of warning.
- `.githooks/pre-push` runs `npm run check:warnings` (`scripts/check-no-warnings.mjs`). It runs a production `ng build` and **blocks the push** if any `[WARNING]` or `[ERROR]` line appears.
- `npm install` turns the hook on (the `prepare` script runs `git config core.hooksPath .githooks`). On an existing clone, run `npm run prepare` once.
- Run `npm run check:warnings` yourself before committing.

**Rules**

- **Never suppress a diagnostic to make it go away.** Do not set a check to `"suppress"` or `"warning"` in any `tsconfig*.json`, and do not use `--no-verify` to skip the hook. Fix the code. If a suppression is truly unavoidable, it needs the lead's sign-off and a comment explaining why.
- **Template nullability must match the types:**
  - Signals and store selectors that are always defined are called as `store.value()`, not `store.value?.()`.
  - Only use `?.` / `??` on values whose type includes `null` or `undefined`.
- **Lookups by key that can be missing** (`Record<string, T>` indexed by an id) must be typed `Record<string, T | undefined>`. Then `map[id] ?? fallback` is honest and does not trigger NG8102. Do **not** delete the `??` from a lookup that can really miss: that turns a warning into a runtime bug.
- **Keep budgets green.** Do not raise `budgets` in `angular.json` to silence a size warning; reduce the bundle or the component styles instead.
- **Tests:** a test run must not print Angular compiler warnings either. Specs must mock HTTP, so no real requests reach `https://localhost:7229`, and must not depend on today's date. Use a fixed clock or relative dates.
