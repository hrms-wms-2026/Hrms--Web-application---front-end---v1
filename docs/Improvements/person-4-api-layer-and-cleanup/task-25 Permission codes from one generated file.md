# Task 25: Permission codes from one generated file

| | |
|---|---|
| Priority | 25 of 25 (lower number = build first). Added 2026-11-15 |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | Security, Code quality |
| Depends on | backend 32 |

## What we found

The backend review is in the backend repository: `docs/reports/security/2026-11-15-permission-system-review.md`.

- The frontend checks permissions through `core/auth/state/permission.service.ts` and `shared/directives/has-permission.directive.ts`. The codes are typed as plain text at each use: in route guards, menus, buttons and stores.
- A typo, or a code the backend has renamed or retired, does not fail the build. The menu item or button just never appears, or appears for a feature the user cannot use.
- When the backend adds a permission, somebody has to remember to type the same text here.
- The frontend check only decides what to show. The backend check is the real protection. Both need the same code list.

## What to do

1. Take the permission catalogue the backend exposes after backend task 32 and generate `src/app/core/auth/permissions.generated.ts`: a const object grouped by module and a `PermissionCode` union type. Add the script as `npm run permissions:generate`.
2. Type `PermissionService.hasPermission`, `hasAnyPermission`, the directive input and the route data key with `PermissionCode`, so an unknown code is a compile error.
3. Replace the text literals with the generated constants, one module per commit.
4. Add a lint rule or script check that forbids a permission-shaped string literal (`word:word`) passed to these functions.
5. Add a CI check: regenerate and fail when the committed file differs from the backend catalogue.
6. Check every guarded route has a matching guarded menu entry, and the other way round, so nobody sees a link that leads to a 403.
7. For a 403 from the API, show the "you do not have access" state from task 20. Do not show the missing code to the user.

## Feature keys (added 2026-11-15)

The team manages API changes with feature keys (backend tasks 43 and 16). The frontend must follow the same keys, or a user sees a menu for an API that answers 403.

1. Generate module keys and feature keys into the same file as the permission codes, with a `FeatureKey` type.
2. Read the tenant active module and feature keys from `auth/me` into the auth store.
3. Add `hasFeature(key)` to the permission service, a `*appHasFeature` directive and a `featureGuard` for routes.
4. Order of checks in the UI is the same as the backend: module, feature, permission.
5. Delete `core/config/feature-flags.ts`. Its two local flags are unused, and local flags would drift from the server.
6. For a 403 that says a feature is off, show a "not available for your workspace" state, not a generic error.
7. When a feature key is retired on the backend, the regenerated file makes every leftover check a compile error, so the dead code is easy to remove.

## Done when

- Switching a feature key off for a tenant hides its menu, route and buttons after the next `auth/me`.
- Passing an unknown code to the permission service does not compile.
- A search for the old literals in guards, menus and templates finds none.
- Renaming a code in the backend catalogue and regenerating shows every affected place as a compile error.
