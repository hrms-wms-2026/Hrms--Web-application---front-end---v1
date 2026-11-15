# Task 17: Dependency checks and browser storage review

| | |
|---|---|
| Priority | 17 of 24 (lower number = build first) |
| Owner folder | person-1-security-and-deployment |
| Size | 1 person, 1 day |
| Area | Security |
| Depends on | 01 |

## What we found

- No dependency scan runs anywhere for this repository. `package.json` pins Angular 21, SignalR, DOMPurify and others with caret ranges, so installs can drift between machines without the lock file check in CI.
- `localStorage` is used in 12 places. All keys found are display preferences (theme, navigation state, view modes, column choices, selected legal entity, hidden panels). That is fine, but nothing stops a future change from storing personal data there, and nothing clears these keys on sign-out.
- The selected legal entity id is stored and read in two places (`legal-entity.store.ts` and `sprint-start-dialog.component.ts`).

## What to do

1. Add `npm audit --audit-level=high` to CI and fail on High or Critical in production dependencies.
2. Add Dependabot or Renovate for npm and GitHub Actions, weekly, grouped by Angular and others.
3. Add a secret scan (gitleaks) to CI with the baseline from `dev-env/baselines`.
4. Create one `PreferencesStorage` service in `core`: typed keys, values namespaced per tenant and user, safe JSON parsing, try and catch around every access. Move the 12 call sites to it.
5. Write the rule in `docs/core/`: only display preferences in browser storage; never tokens, names, emails or business data.
6. On sign-out clear keys that reveal business context (selected legal entity). Keep pure display preferences.
7. Add a lint rule that forbids direct `localStorage` and `sessionStorage` use outside the service.

## Done when

- CI fails on a High vulnerability and on a committed secret.
- A search for `localStorage.` finds only the service.
- Signing in as a second user in the same browser does not reuse the first user's legal entity.
