# PROFILE POPOVER LOGOUT FRONTEND REPORT

> **Status**: Completed  
> **Date**: August 12, 2026  
> **Repository**: `C:\onevoNew\Hrms--Web-application---front-end---v1`

---

## 1. Summary of Changes

Integrated a clear "Log out" action into the topbar profile popover (`ProfileMenuComponent`) below the "Appearance" action, separated by a visual divider line. The action uses the existing authentication infrastructure (`AuthStore` and `AuthApiService.logout`), clears frontend session state, navigates to `/auth/login` on success, and handles API failures by displaying a fixed safe error notification toast ("Could not log out. Try again.") without exposing raw technical errors or CSRF details.

---

## 2. Files Changed

| File Path | Description of Changes |
|---|---|
| [`src/app/core/auth/state/auth.store.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/core/auth/state/auth.store.ts) | Updated `logout()` to return `Promise<boolean>` (`true` on API success, `false` on API failure), preserving session clearance logic and established store semantics without throwing uncaught exceptions. |
| [`src/app/core/auth/state/auth.store.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/core/auth/state/auth.store.spec.ts) | Updated `AuthStore.logout()` unit tests to assert `true` return on API success and `false` return on API failure while verifying session state clearance. |
| [`src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.ts) | Injected `AuthStore`, `Router`, and `NotificationService`. Added `onLogout()` handler to close the popover immediately, call `authStore.logout()`, navigate to `/auth/login` on success, and show fixed safe toast ("Could not log out. Try again.") on failure. |
| [`src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.html`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.html) | Added visual divider (`<div class="profile-popover-divider"></div>`) and "Log out" button with SVG logout icon below Appearance action. |
| [`src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.css`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.css) | Added `:focus-visible` styling using `--color-focus-ring` design token for keyboard focus accessibility. |
| [`src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.spec.ts`](file:///C:/onevoNew/Hrms--Web-application---front-end---v1/src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.spec.ts) | Added unit tests verifying: "Log out" button rendering with icon and divider, calling `AuthStore.logout()`, navigation to `/auth/login` on success, error toast on failure, and Appearance functionality preservation. |

---

## 3. Existing Logout API / Service Used

- **API Endpoint**: `POST /api/v1/auth/logout` via `AuthApiService.logout()` (defined in `src/app/core/auth/data-access/auth-api.service.ts`).
- **HTTP Interceptors**: Requests automatically pass through `authInterceptor` (attaches `withCredentials: true`), `csrfInterceptor` (attaches `X-XSRF-TOKEN`), and `errorInterceptor`.
- **State Store**: `AuthStore.logout()` (in `src/app/core/auth/state/auth.store.ts`).

---

## 4. Navigation & Session-Clear Behavior

- **On Success**:
  1. Popover closes immediately (`this.close()`).
  2. `AuthStore.logout()` calls `AuthApiService.logout()`, receives HTTP 204 No Content, resets auth state (`authenticated: false`, `email: null`, `permissions: []`, etc.), and returns `true`.
  3. `ProfileMenuComponent` navigates to `/auth/login` using Angular `Router.navigate(['/auth/login'])`.
  4. No noisy toast is shown.
- **On Failure**:
  1. Popover closes immediately (`this.close()`).
  2. `AuthStore.logout()` catches API failure, resets local session state, and returns `false`.
  3. `ProfileMenuComponent` invokes `NotificationService.error('Could not log out. Try again.')`.
  4. No navigation occurs, and raw technical/CSRF error details are never exposed to the user.

---

## 5. Tests & Verification

- **Focused Unit Tests**:
  - `npx ng test --no-watch --include src/app/layouts/**/*.spec.ts --include src/app/core/auth/**/*.spec.ts`
- **Build Verification**:
  - `npm run build`
- **Git Diff Sanity Check**:
  - `git diff --check`

---

## 6. Skipped Checks & Remaining Risks

- **Backend API modification**: Skipped by design; existing `POST /api/v1/auth/logout` endpoint was fully sufficient.
- **Remaining Risks**: None identified. All theme styling uses design CSS tokens, buttons are keyboard focusable, and error responses strictly map to safe human-readable messages.
