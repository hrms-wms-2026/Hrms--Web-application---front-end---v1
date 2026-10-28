# UAT hardening: code cleaning and security testing (2026-10-27)

Branch `chore/uat-hardening`, cut from `Development` with `feature/team-attendance-widget` merged in. Backend companion report: `docs/reports/security/2026-10-27-uat-hardening-report.md` in the backend repo.

Tooling lives outside the repo in `../dev-env/` (see its `README.md`).

## Fixed

| Severity | Finding | Fix | Commit |
|---|---|---|---|
| High | **Angular 21.2.18 had published CVEs** in `@angular/router`, `common`, `core`, `compiler`, `forms`, `platform-browser`. | Upgraded to 21.2.25 (build/CLI 21.2.28), plus non-breaking `npm audit fix` on dev dependencies. `npm audit --omit=dev`: 0 vulnerabilities (was 4 high, 2 moderate). | `816bc389` |
| High | **Stored XSS in the rich-text editor.** It wrote stored HTML (task descriptions, comments, checklist task descriptions) into a contenteditable with `element.innerHTML`, bypassing Angular's sanitizer. | `sanitizeEditableHtml()` (`shared/utils/editable-html.util.ts`, DOMPurify 3.4.17) on every load and on emit. The backend now also rejects active content on write. | `f25053a3` |
| — | **No linter existed.** | Added angular-eslint (`npm run lint`, `eslint.config.js`) and fixed all 607 errors: 24 unused imports and dead test variables, an empty `ngOnInit`, redundant assignments, empty-interface aliases, a hidden no-break space, a missing `aria-selected`, and a template the lint parser could not read. | `2c71f1e5` |

## Lint backlog — cleared 2026-10-28

The 272 warnings left after the first pass were all fixed, and those rules are errors again in `eslint.config.js`. `npm run lint` now reports 0 errors and 0 warnings.

| Was | Rule | Fix |
|---:|---|---|
| 231 | `template/click-events-have-key-events`, `template/interactive-supports-focus` (137 elements) | **66 click shields** `(click)="$event.stopPropagation()"` around popovers/menus → new `appStopClickPropagation` directive (same behaviour, no fake interaction). **35 backdrops, scrims, click-to-focus boxes and spans wrapping a real `<app-button>`** → `role="presentation"` (the inner button is already keyboard-reachable). **26 real actions** (task cards and subtasks, tree rows, project rows, expandable overview cards, calendar day cells, landing tabs, dropdown trigger) → `role="button" tabindex="0" appKeyboardClick`; the new directive fires the element's own click on Enter/Space only when the element itself has focus, so Enter in a nested input does not also open the card. Landing tabs also expose `aria-pressed`. **4 "×" remove marks inside pill buttons** → hidden from screen readers, and the pill button now clears its value with Delete/Backspace. **3 focus-managed containers** (face photo dialog, bulk-action toolbar, dropdown panel) → `tabindex="-1"`. |
| 17 | `no-explicit-any` | `err: any` → `unknown` in the error helpers (they already pass it to `toSafeErrorMessage(unknown)`); typed the two helpers that read error fields. |
| 12 | `template/label-has-associated-control` | Project logo/banner file inputs linked with `for`/`id`; group headings over segmented controls and custom pickers changed to `<span>`; `<label>` around a switch `<button>` allowed by rule option. |
| 12 | `no-output-native` | `cancel` → `cancelled`, `close` → `closed` on 12 modal components, with every parent binding and spec updated. |

Deliberate config choices (commented in `eslint.config.js`): arrow no-ops and empty `catch` blocks are allowed (fire-and-forget cleanup, best-effort DOM APIs), and `!= null` is allowed in templates.

## Verified safe

- No `bypassSecurityTrust*` anywhere; all `[innerHTML]` bindings go through Angular's sanitizer.
- No tokens in `localStorage`; auth is the HttpOnly session cookie. CSRF uses the `onevo_csrf` cookie → `X-CSRF-Token` header.
- Secrets in git history: 1 gitleaks hit, a fixture in a spec file (recorded in `../dev-env/baselines/`).

## Open items

| Priority | Item |
|---|---|
| Low | A manual keyboard-only pass through the main screens (the lint rules and unit tests prove the wiring, not the whole user journey). |
| Low | About 1,489 files do not match the repo's Prettier config; formatting them is a separate, team-coordinated commit. |
| Low | 1 high-severity advisory in `undici`, bundled inside `@angular/build` (dev server only, not shipped). Fixed upstream only in a different major line. |
| Info | No DAST (OWASP ZAP) run yet; needs a running stack with test accounts. |

## Verification

- `npm run lint`: 0 errors, 0 warnings (2026-10-28; was 272 warnings on 2026-10-27).
- Zero-warnings production build: clean.
- Unit tests: 4766/4766 on 2026-10-28 (includes 20 sanitizer specs, 7 specs for the two new directives and 3 keyboard specs for the landing tabs).
