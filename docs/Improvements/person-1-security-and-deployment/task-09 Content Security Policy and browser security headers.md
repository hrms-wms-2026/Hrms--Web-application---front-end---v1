# Task 09: Content Security Policy and browser security headers

| | |
|---|---|
| Priority | 9 of 24 (lower number = build first) |
| Owner folder | person-1-security-and-deployment |
| Size | 1 person, 1 day |
| Area | Security, Deployment |
| Depends on | 05 |

## What we found

`src/index.html` has no Content Security Policy and no host config defines one. The app renders user-written rich text in several places (task 13), so a CSP is the second line of defence if sanitising ever fails. The backend sets strict headers for API responses, but those do not cover the HTML page.

## What to do

1. Set the headers at the web host from task 05, not in a meta tag, so `frame-ancestors` and reporting work.
2. Start in report-only mode. Policy to aim for:
   - `default-src 'self'`
   - `script-src 'self'` (no `unsafe-inline`, no `unsafe-eval`)
   - `style-src 'self'` plus a nonce or hash if Angular inline styles need it
   - `img-src 'self' data: blob:` plus the storage domain used for uploaded images
   - `connect-src 'self'` plus `wss:` on the same host
   - `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`
3. Use Angular's `ngCspNonce` support or the `autoCsp` build option for inline styles and scripts.
4. Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera only where face check-in needs it), and HSTS for one year with subdomains.
5. Click through every module in report-only mode, fix each violation, then switch to enforce.
6. Check Google sign-in, the emoji picker and any embedded map or video still work.

## Done when

- UAT serves an enforcing CSP with no `unsafe-inline` for scripts.
- No violation appears during a full click-through.
- A header scan of the UAT URL shows no missing header.
