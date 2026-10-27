# UAT hardening: code cleaning and security testing (2026-10-27)

Branch `chore/uat-hardening`, cut from `Development` with `feature/team-attendance-widget` merged in. Backend companion report: `docs/reports/security/2026-10-27-uat-hardening-report.md` in the backend repo.

Tooling lives outside the repo in `../dev-env/` (see its `README.md`).

## Fixed

| Severity | Finding | Fix | Commit |
|---|---|---|---|
| High | **Angular 21.2.18 had published CVEs** in `@angular/router`, `common`, `core`, `compiler`, `forms`, `platform-browser`. | Upgraded to 21.2.25 (build/CLI 21.2.28), plus non-breaking `npm audit fix` on dev dependencies. `npm audit --omit=dev`: 0 vulnerabilities (was 4 high, 2 moderate). | `816bc389` |
| High | **Stored XSS in the rich-text editor.** It wrote stored HTML (task descriptions, comments, checklist task descriptions) into a contenteditable with `element.innerHTML`, bypassing Angular's sanitizer. | `sanitizeEditableHtml()` (`shared/utils/editable-html.util.ts`, DOMPurify 3.4.17) on every load and on emit. The backend now also rejects active content on write. | `f25053a3` |
| — | **No linter existed.** | Added angular-eslint (`npm run lint`, `eslint.config.js`) and fixed all 607 errors: 24 unused imports and dead test variables, an empty `ngOnInit`, redundant assignments, empty-interface aliases, a hidden no-break space, a missing `aria-selected`, and a template the lint parser could not read. | `2c71f1e5` |

## Lint backlog (warnings, visible in `npm run lint`)

| Count | Rule | What it means |
|---:|---|---|
| 131 | `template/click-events-have-key-events` | Clickable non-button elements with no keyboard handler. |
| 100 | `template/interactive-supports-focus` | Same elements are not focusable. Fix both by using `<button>` or adding `tabindex` + key handlers. |
| 17 | `no-explicit-any` | `any` in app code (spec files are exempt). |
| 12 | `no-output-native` | Outputs named like DOM events (`close`, `change`, ...). Renaming is a public API change for every parent. |
| 12 | `template/label-has-associated-control` | Form labels not linked to a control. |

Deliberate config choices (commented in `eslint.config.js`): arrow no-ops and empty `catch` blocks are allowed (fire-and-forget cleanup, best-effort DOM APIs), and `!= null` is allowed in templates.

## Verified safe

- No `bypassSecurityTrust*` anywhere; all `[innerHTML]` bindings go through Angular's sanitizer.
- No tokens in `localStorage`; auth is the HttpOnly session cookie. CSRF uses the `onevo_csrf` cookie → `X-CSRF-Token` header.
- Secrets in git history: 1 gitleaks hit, a fixture in a spec file (recorded in `../dev-env/baselines/`).

## Open items

| Priority | Item |
|---|---|
| Medium | Keyboard accessibility backlog above (231 warnings). |
| Low | 1 high-severity advisory in `undici`, bundled inside `@angular/build` (dev server only, not shipped). Fixed upstream only in a different major line. |
| Info | No DAST (OWASP ZAP) run yet; needs a running stack with test accounts. |

## Verification

- `npm run lint`: 0 errors, 272 warnings.
- Zero-warnings production build: clean.
- Unit tests: 4756/4756 (includes 20 new sanitizer specs).
