# Employee Invitation Acceptance UX Fix — Frontend Report

## Root cause

`AcceptInvitationComponent.ngOnInit()` had two bugs:

1. It fetched `getInvitationPreview()` and `getCurrentLegalDocuments()` in parallel via
   `Promise.all`, wrapped in a single `try/catch` that set the exact same string —
   `"This invitation link is invalid or has expired."` — for **any** failure: a genuine 404, a
   500, a network drop (status 0), or a legal-documents fetch failure. There was no way for a
   user to tell "this link is dead" apart from "the server hiccuped, try again."
2. When the preview call **succeeded**, the component never looked at `invitation.status`. The
   backend (`GetInvitationByTokenQueryHandler`, unchanged — see the backend report) already
   returns 200 with a computed `status` of `accepted` / `revoked` / `expired` / `pending` even
   for a used/revoked/expired invitation (only a genuinely missing token/tenant 404s). The
   component rendered the password-setup form regardless of `status`, so an already-accepted,
   revoked, or expired invitation still showed a working-looking form that would only fail (with
   the backend's safe message) once submitted.

Token handling itself (`API_ENDPOINTS.auth.invitationPreview`/`acceptEmployeeInvitation` via
`encodePathValue = (v) => encodeURIComponent(v.trim())`, and reading the token from
`ActivatedRoute.snapshot.paramMap.get('token')`) was already correct — the token is decoded once
by the Angular router and re-encoded once when building the request URL, so there was no
double-encoding bug. This was verified with new tests rather than changed.

## Files changed

- `src/app/core/auth/feature/accept-invitation/accept-invitation.component.ts` — split preview
  loading into two sequential steps (invitation first, legal documents only if `status ===
  'pending'`), added `describePreviewFailure()` to map `HttpErrorResponse` status to a specific
  message, added `statusMessage()` for the accepted/revoked/expired copy.
- `src/app/core/auth/feature/accept-invitation/accept-invitation.component.html` — added a
  branch between the error state and the form: when `invitation()?.status !== 'pending'`, shows
  `statusMessage()` and never renders the form.
- `src/app/core/auth/feature/accept-invitation/accept-invitation.component.spec.ts` — rewrote the
  old single "preview fails" test into distinct 404 / 500 / network(0) cases, plus new tests for
  accepted/revoked/expired states not rendering the form, legal-documents not being fetched for a
  non-pending invitation, and a legal-documents-fetch failure surfacing the same
  network/server-failure copy.
- `src/app/core/auth/data-access/auth-api.service.tenant-host.spec.ts` — added two tests: a
  URL-safe token (`-`, `_`) passes through the request URL unchanged, and a legacy Base64 token
  (`+`, `/`, `=`) is percent-encoded so the path segment survives.

`auth-api.service.ts` and `api-endpoints.ts` were inspected but **not modified** (already
correct).

## Old vs new behavior

| Scenario | Before | After |
|---|---|---|
| Preview 404 (token not found) | "invalid or has expired" | "This invitation link could not be found. Double-check the link or ask for a new invite." |
| Preview 500 / network (status 0) | "invalid or has expired" | "We could not load this invitation. Refresh and try again." |
| Preview 200, `status: "accepted"` | Password form shown | "This invitation has already been accepted. Please sign in instead." — no form |
| Preview 200, `status: "revoked"` | Password form shown | "This invitation has been revoked. Contact your HR administrator for a new invite." — no form |
| Preview 200, `status: "expired"` | Password form shown | "This invitation has expired. Ask your HR administrator to send you a new one." — no form |
| Preview 200, `status: "pending"` | Password form shown | Unchanged — password form shown |
| Legal documents fetch fails (pending invitation) | Same generic "invalid or expired" | "We could not load this invitation. Refresh and try again." — no form |

## Tests run

- `npx ng test --no-watch --include "src/app/core/auth/**/*.spec.ts"` — 94/94 passed (10 files).
- `npx ng test --no-watch` (full suite) — 708/708 passed, 91 files. Two unrelated unhandled
  rejections logged from `checklist-builder.component.spec.ts` (`NG04002: Cannot match any
  routes. URL Segment: 'people/checklists'`) — pre-existing, in a file this task was explicitly
  told not to touch; did not affect the pass count.
- `npm run build` — succeeded. Only pre-existing CSS-budget warnings on unrelated components and
  one pre-existing CommonJS-dependency warning (`i18n-iso-countries`).
- `git diff --check` — clean (only pre-existing LF/CRLF autocrlf notices, no whitespace errors).

## Skipped checks

- No live verification: I did not open a real invitation link (pending, expired, revoked, or
  already-accepted) against a running dev tenant in a browser. All verification above is
  unit-test and build level.
- Did not add a component-level test that stubs `ActivatedRoute` with a real URL-safe token value
  (e.g. `AbCd-_09`) flowing through to the store call — the existing component spec stubs the
  route with a fixed `'raw-token'` string, and the encode-side round-trip is covered instead at
  the `AuthApiService` level (new tests above). The component's token handling is a straight
  passthrough (`this.route.snapshot.paramMap.get('token')` → `this.store.acceptEmployeeInvitation(this.token, ...)`,
  see `accept-invitation.component.ts:25` and the existing "submits the password..." spec), so
  this is a coverage gap at the component layer, not a known bug.

## Remaining risks

- The friendly accepted/revoked/expired copy assumes the backend's `status` field stays limited
  to exactly `pending` / `accepted` / `revoked` / `expired` (`InviteMapper.ComputeStatus`). Any
  new status value added backend-side would fall through to the generic `"This invitation is not
  available."` in `STATUS_MESSAGES` rather than erroring, which is safe but not informative.
- End-to-end correctness of the full flow (tenant-host resolution, session cookies, redirect to
  `/dashboard`) depends on the backend changes in the paired backend report; this report only
  covers the frontend acceptance-page UX.
