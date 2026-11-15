# Task 05: Hosting setup for UAT

| | |
|---|---|
| Priority | 5 of 24 (lower number = build first) |
| Owner folder | person-1-security-and-deployment |
| Size | 1 person, 1 day |
| Area | Deployment, Performance |
| Depends on | 01 |

## What we found

The app is built with `ng build` and nothing in the repository says how the files are served. The environment files explain one firm rule: the app must call the API on the same hostname it was loaded from, because the backend finds the tenant from the `Host` header. So the web host must proxy `/api` and the SignalR hubs to the backend without rewriting `Host`.

There is no web server config, no cache header rule and no compression rule.

## What to do

1. Choose the host with the backend deploy owner (a container with nginx, or static hosting behind the same load balancer).
2. Write the config and commit it:
   - serve `index.html` for unknown paths (SPA fallback);
   - proxy `/api/`, `/admin/` and `/hubs/` to the backend, keep the `Host` header, allow WebSocket upgrade;
   - `index.html`: `Cache-Control: no-cache`;
   - hashed files (`*.js`, `*.css`, fonts): cache for one year, `immutable`;
   - Brotli and Gzip for text files.
3. Support wildcard tenant subdomains with one certificate.
4. Add a deploy step to the CI from task 01: build with the staging configuration and publish to UAT on approval.
5. After a new release, users with an old tab open must get the new version: check that lazy chunk load errors trigger a reload prompt.
6. Write `docs/core/deployment.md`.

## Done when

- A tenant subdomain on UAT loads the app, signs in, and the inbox realtime connection works.
- A second visit loads JavaScript from cache, and a new release is picked up without a hard refresh.
- The config is in the repository.
