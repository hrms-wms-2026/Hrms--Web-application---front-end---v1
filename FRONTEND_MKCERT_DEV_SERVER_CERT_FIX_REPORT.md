# Frontend mkcert Dev Server Certificate Fix Report

## Problem

`npm start` ran `ng serve --ssl true --host 0.0.0.0 --port 4200` without pointing at the
mkcert-issued certificate/key in `.certs/`. Angular CLI's `ssl` flag alone generates its own
temporary self-signed certificate, so Chrome showed `NET::ERR_CERT_AUTHORITY_INVALID` even
though a trusted mkcert certificate already existed on disk.

## Files changed

1. `package.json` — `start` script updated to explicitly pass `--ssl-cert` and `--ssl-key`.
2. `.gitignore` — added `.certs/` so the cert/key are never committed.
3. `FRONTEND_MKCERT_DEV_SERVER_CERT_FIX_REPORT.md` — this report (new file).

No other files were modified. Auth flow code, API services, environment URL logic, and
package versions were not touched.

### package.json diff

```diff
- "start": "ng serve --ssl true --host 0.0.0.0 --port 4200",
+ "start": "ng serve --ssl true --ssl-cert .certs/localhost-cert.pem --ssl-key .certs/localhost-key.pem --host 0.0.0.0 --port 4200",
```

### .gitignore diff

```diff
  # System files
  .DS_Store
  Thumbs.db
+
+ # mkcert local dev certificates
+ .certs/
```

## Cert/key existence check

Both files confirmed present before making any changes:

```
.certs/localhost-cert.pem  (1521 bytes)
.certs/localhost-key.pem   (1708 bytes)
```

## .gitignore status

- Before: `.certs/` was **not** ignored.
- After: `.certs/` is ignored (rule added at end of `.gitignore`).
- Verified `git ls-files .certs/` returns nothing — the cert/key were never tracked, so no
  untracking step was needed. `git status --porcelain` after the change shows no `.certs/`
  entries (untracked and ignored).

Note: this repo already had a number of unrelated modified/untracked files from prior work
(auth, environment helpers, README, playwright config, etc.) present before this task started.
Those were left untouched.

## Test / build results

All run from `Hrms--Web-application---front-end---v1`:

| Command | Result |
|---|---|
| `npm test` | ✅ 22 test files, 100 tests passed |
| `npm run build` | ✅ Production build succeeded, output at `dist/Customer-web-application` |
| `npm run build:staging` | ✅ Staging build succeeded, output at `dist/Customer-web-application` |

## npm start command proof

Started `npm start` in the background. Logged output confirms the exact resolved command and
that Vite is now serving over `https://localhost:4200/`:

```
> customer-web-application@0.0.0 start
> ng serve --ssl true --ssl-cert .certs/localhost-cert.pem --ssl-key .certs/localhost-key.pem --host 0.0.0.0 --port 4200
...
➜  Local:   https://localhost:4200/
➜  Local:   https://vite.localhost:4200/
➜  Network: https://192.168.208.1:4200/
➜  Network: https://192.168.18.166:4200/
```

The command includes both `--ssl-cert .certs/localhost-cert.pem` and
`--ssl-key .certs/localhost-key.pem` as required, and `npm start` still reports
`https://localhost:4200/`.

## Certificate verification (TLS handshake, direct evidence)

Since the served certificate is the direct source of truth for whether Chrome will trust it,
the live TLS handshake on port 4200 was inspected with `openssl s_client`:

```
issuer=O=mkcert development CA, OU=TICS17\User@TICS17, CN=mkcert TICS17\User@TICS17
subject=O=mkcert development certificate, OU=TICS17\User@TICS17
notBefore=Aug  3 05:53:05 2026 GMT
notAfter=Nov  3 05:53:05 2028 GMT
```

SAN entries on the cert:

```
DNS:localhost, DNS:*.localhost, IP Address:127.0.0.1, IP Address:0:0:0:0:0:0:0:1
```

The wildcard `*.localhost` SAN covers `acme.localhost` as well as `localhost` itself.

The mkcert root CA is present and trusted in the Windows `CurrentUser\Root` certificate store
(the store Chrome relies on for trust decisions on Windows):

```
Subject: CN=mkcert TICS17\User@TICS17, OU=TICS17\User@TICS17, O=mkcert development CA
Thumbprint: 6251DE9357A09670ECD8BE443E9A5FD541BDC90D
```

This confirms Angular is now serving the mkcert-issued certificate (not its own temporary
self-signed cert), and that the issuing root CA is installed and trusted at the OS level.

## Manual browser verification status

**Not completed by the assistant.** The Claude-in-Chrome browser extension was not connected
in this environment (`tabs_context_mcp` returned "Browser extension is not connected"), so the
literal steps of opening `https://localhost:4200` and `https://acme.localhost:4200` in Chrome
and visually confirming the padlock/no-warning state could not be performed here.

The dev server was left running (background) at `https://localhost:4200/` so the user can
complete this check directly:

1. Open `https://localhost:4200` — expect no `NET::ERR_CERT_AUTHORITY_INVALID`.
2. Open `https://acme.localhost:4200` — expect no `NET::ERR_CERT_AUTHORITY_INVALID`, covered by
   the `*.localhost` SAN entry.
3. If either still warns, check the certificate issuer in Chrome's padlock UI — per the TLS
   inspection above it should read "mkcert development CA"; if it doesn't, the server picked up
   a different/cached cert (try a hard stop/restart of `npm start`). If the issuer is correct
   but Chrome still warns, the mkcert root CA is installed in the Windows store (confirmed
   above) but may not be present in Chrome's own trust store on some configurations —
   restarting Chrome fully (not just closing the tab) after mkcert install is required for it
   to pick up newly trusted roots.

## Remaining risks

- Manual Chrome verification (Part 4) was not completed by the assistant due to no connected
  browser tooling; it relies on the user's own check using the dev server left running.
- `--host 0.0.0.0` binds the dev server to all network interfaces; this was pre-existing
  behavior and unchanged by this fix.
- If the mkcert root CA is ever regenerated (`mkcert -install` re-run, or a different machine),
  `.certs/localhost-cert.pem` and `localhost-key.pem` will need to be regenerated to match, or
  Chrome will again show the untrusted-authority warning.
- Pre-existing uncommitted changes in this repo (auth/environment files, README, playwright
  config) are unrelated to this task and were left as-is.
