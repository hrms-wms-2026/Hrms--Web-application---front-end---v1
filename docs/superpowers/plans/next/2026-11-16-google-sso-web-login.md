# Google SSO for the Web Login: Plan Overview

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** pending, not started (written 2026-11-16)

**Goal:** "Continue with Google" on `https://crownus.test:4200/auth/login` signs a real user in, using the Google SSO the backend already has.

**Architecture:** The browser loads Google Identity Services (GIS) only on the login page. GIS draws Google's own sign-in button and hands back an **ID token**. The SPA posts that token to the existing `POST /api/v1/auth/login/google`. The backend verifies it and answers like password login does: a session handoff (`redirect_required` + `continue_url`), legal consent, or a 202 "pick a workspace". The SPA learns the public Google Client ID from a new anonymous `GET /api/v1/auth/google-config`, so the admin portal stays the single place to configure it.

**Tech Stack:** Angular 21 (standalone, signals, `@ngrx/signals` store, Vitest), ASP.NET Core (.NET 10) + MediatR + xUnit/Moq/FluentAssertions, Google Identity Services (`https://accounts.google.com/gsi/client`).

---

## 1. Where things stand today (checked 2026-11-16)

| Piece | State |
|---|---|
| Backend `POST /api/v1/auth/login/google` | Built and unit-tested. Verifies the ID token against the Google app's Client ID, requires `email_verified`, finds 1 to 8 eligible workspaces for that email. Rate-limited and CSRF-exempt. Returns 400 on a tenant host, so it must be called on the root host. |
| Backend `POST /api/v1/auth/invitations/{token}/accept-google` | Built, but rejects employee-onboarding invitations (see section 6). |
| Backend public Client ID endpoint for tenants | **Missing.** Only `GET /admin/v1/auth/google-config` exists (admin portal). |
| Local DB `platform_oauth_apps` row `google` | `client_id` empty, `is_active = 0`. Google login answers 500 "Google sign-in is not configured." |
| Web login button | `signInWithGoogle()` only does `console.log`. |
| Web handling of the 202 "pick a workspace" answer | **Missing for password login too.** No code anywhere calls `login/select-workspace`. |

### Corrections to what was said earlier in chat

1. **There is no workspace picker to reuse.** The backend can answer 202 `{ requires_workspace_selection, login_challenge, workspaces: [{ slug, displayName }] }`, but the SPA never handled it. Today that body falls through `toCurrentUserViewModel` as "not signed in" and nothing happens. Part 2 adds the typed response and store method. Part 3 adds a small picker. As a side effect, the same fix also repairs password login for people who belong to 2 or more workspaces.
2. **"No Client Secret needed" is only half true.** `login/google` itself only needs the Client ID. But the config query (`GetAdminGoogleSsoConfigQueryHandler`) reports `enabled = false` unless the Google app also has an **active Client Secret credential**, because the provider catalog marks Google as `ClientSecretRequired: true`. So the admin portal needs Client ID + Client Secret + Active (the secret is needed for Calendar sync anyway).

## 2. Files touched / not touched

**Backend repo `C:\HR2\HRMS-Backend-v1`** (Part 1)

| Action | File | Why |
|---|---|---|
| Modify | `src/ONEVO.Api/Controllers/Tenant/Auth/AuthLoginController.cs` | Add anonymous `GET google-config` that reuses the existing query |
| Create | `tests/ONEVO.Tests.Unit/Features/Auth/AuthLoginControllerGoogleConfigTests.cs` | Test the new endpoint |

**Web repo `C:\HR2\Hrms--Web-application---front-end---v1`** (Parts 2 and 3)

| Action | File | Why |
|---|---|---|
| Create | `src/app/core/auth/models/dto/google-sso-config.dto.ts` | `{ enabled, clientId }` |
| Create | `src/app/core/auth/models/dto/google-login-request.dto.ts` | `{ google_id_token }` |
| Create | `src/app/core/auth/models/dto/workspace-selection.dto.ts` | 202 body, select-workspace request, `LoginResultDto` union, type guard |
| Create | `src/app/core/auth/data-access/google-identity.service.ts` (+ `.spec.ts`) | Lazy-loads GIS, renders Google's button, returns the ID token |
| Modify | `src/app/core/config/api-endpoints.ts` | `googleConfig`, `loginGoogle`, `selectWorkspace` paths |
| Modify | `src/app/core/auth/data-access/auth-api.service.ts` (+ `.spec.ts`) | `getGoogleSsoConfig()`, `loginWithGoogle()`, `selectWorkspace()`; `login()` returns the union |
| Modify | `src/app/core/auth/state/auth.store.ts` (+ `.spec.ts`) | `googleClientId`, `workspaceSelection` state and the new methods |
| Modify | `src/app/core/auth/feature/login/login.component.ts` / `.html` / `.css` (+ `.spec.ts`) | Real Google button, workspace picker, shared post-login routing |
| Modify | `docs/core/ARCHITECTURE.md` | Folder tree + CSP row and nginx snippet (rules 2 and 6 of `PROCESS_RULES.md`) |
| Modify | `docs/superpowers/plans/next/SUMMARY.md` | Index entry (already added with this plan) |

**Not touched:** `index.html` (GIS is loaded lazily, only on the login page), `environment*.ts` (the Client ID comes from the API), `accept-invitation.*` (section 6), the admin portal frontend, the TrayApp.

## 3. Parts (in this file, below)

| Part | Section | Repo | Result |
|---|---|---|---|
| 1 | "Part 1" below | Backend | `GET /api/v1/auth/google-config` returns `{ "enabled": bool, "clientId": string \| null }` |
| 2 | "Part 2" below | Web | DTOs, `GoogleIdentityService`, API methods, store methods, all unit-tested |
| 3 | "Part 3" below | Web | Login page shows Google's button when enabled, signs in, handles the workspace picker; docs + CSP updated |

Order: 1 → 2 → 3. Part 2 can be written before Part 1 lands (specs mock HTTP), but nothing works end to end until Part 1 is running.

## 4. One-time setup (a person does this, not the code)

1. **Google Cloud Console** → APIs & Services → **OAuth consent screen**: set app name, support email, and add test users while the app is in "Testing".
2. **Credentials → Create credentials → OAuth client ID**, type **Web application**.
   - Authorized JavaScript origins: try `https://crownus.test:4200`.
   - **Check this, don't assume it:** Google may reject `.test` because it isn't a public top-level domain. If it does, add `https://localhost:4200` and run the login page from `https://localhost:4200/auth/login` for SSO testing. Bare `localhost` resolves to System context on the backend, which is exactly what `login/google` needs.
   - No redirect URI is needed: the popup/ID-token flow doesn't use one.
3. Copy the **Client ID** (`....apps.googleusercontent.com`) and **Client Secret**.
4. **Admin portal** (`https://crownus.test:4300`) → System Config → OAuth Apps → **Google**: paste Client ID, add the Client Secret, turn **Active** on.
   - This is the same Google app the Calendar sync uses, so one OAuth client serves both.
5. Check it worked: `curl -k https://crownus.test:7229/api/v1/auth/google-config` (after Part 1) should print `{"enabled":true,"clientId":"....apps.googleusercontent.com"}`.

## 5. Manual end-to-end check (after Parts 1 to 3 and the setup)

1. Start the API, then `npm start` in the web repo.
2. Open the login page on the origin you registered in step 2 of the setup.
3. Google's "Continue with Google" button appears. With Google disabled in the admin portal, it must **not** appear (and neither does the "or" divider).
4. Sign in with a Google account whose email **already exists** as an active user in one workspace → you land on that workspace's dashboard.
5. With an email that exists in 2+ workspaces → the "Choose a workspace" list shows → pick one → you land there.
6. With a Google email that has no user → "Invalid email or password." (the backend is deliberately generic so it can't be used to discover accounts).
7. With legal documents pending → you are sent to `/auth/legal-consent`, the same as password login.

## 6. Out of scope (follow-ups)

- **Invitation accept with Google.** `AcceptInvitationGoogleCommandHandler` returns 400 for `EmployeeOnboardingPurpose` invitations, and the web accept page only serves the employee-onboarding flow (`accept-employee`). The Google invitation path is for tenant-admin invites, which the web has no page for. It also runs on `{slug}.crownus.test`, and Google origins can't be wildcards, so every tenant subdomain would have to be registered. It needs its own design.
- **Admin portal Google login.** The admin backend endpoints exist, but the admin frontend has no GIS code either. Same pattern, separate plan in that repo.
- **Google One Tap / auto sign-in.** Not needed for a working button. Can be added later with `google.accounts.id.prompt()`.
- **Microsoft / Entra / SAML SSO.** Nothing exists on either side.

---

## Part 1: Backend `GET /api/v1/auth/google-config`

**Goal:** The web login page can ask, without being signed in, "is Google SSO on, and what is the public Client ID?"

**Architecture:** Add one anonymous action to the existing tenant `AuthLoginController`. It sends the **existing** `GetAdminGoogleSsoConfigQuery` (already unit-tested in `GetAdminGoogleSsoConfigQueryHandlerTests`). That query reads `platform_oauth_apps` directly, never decrypts secrets, and returns only `Enabled` + `ClientId`. No new query, no migration.

**Tech Stack:** ASP.NET Core (.NET 10), MediatR, xUnit, Moq, FluentAssertions.

**Repo:** `C:\HR2\HRMS-Backend-v1`. Run every command from that folder.

**Why reuse the admin query:** It already answers exactly this question, with the same safety rules (no secret material; `enabled = false` unless the app is active, has a Client ID **and** has an active Client Secret credential). Its name says "Admin", but duplicating it would make two copies that can drift. Add a comment at the call site instead.

---

### Task 1: Failing test for the new endpoint

**Files:**
- Create: `tests/ONEVO.Tests.Unit/Features/Auth/AuthLoginControllerGoogleConfigTests.cs`

- [ ] **Step 1: Write the test file**

```csharp
using FluentAssertions;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using ONEVO.Api.Controllers.Tenant.Auth;
using ONEVO.Application.Common.Models;
using ONEVO.Application.Common.ServiceInterfaces;
using ONEVO.Application.Features.Auth.Login.DTOs.Responses;
using ONEVO.Application.Features.Auth.Login.Queries.GetAdminGoogleSsoConfig;
using Xunit;

namespace ONEVO.Tests.Unit.Features.Auth;

public sealed class AuthLoginControllerGoogleConfigTests
{
    private static AuthLoginController CreateController(Mock<IMediator> mediator) =>
        new(mediator.Object, Mock.Of<IWebHostEnvironment>(), Mock.Of<ITenantContext>())
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

    [Fact]
    public async Task GoogleConfig_WhenEnabled_ReturnsClientIdFromQuery()
    {
        var mediator = new Mock<IMediator>();
        mediator
            .Setup(m => m.Send(It.IsAny<GetAdminGoogleSsoConfigQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<AdminGoogleSsoConfigDto>.Success(new AdminGoogleSsoConfigDto
            {
                Enabled = true,
                ClientId = "client-123.apps.googleusercontent.com"
            }));

        var result = await CreateController(mediator).GoogleConfig(CancellationToken.None);

        var ok = result.Should().BeOfType<OkObjectResult>().Subject;
        var dto = ok.Value.Should().BeOfType<AdminGoogleSsoConfigDto>().Subject;
        dto.Enabled.Should().BeTrue();
        dto.ClientId.Should().Be("client-123.apps.googleusercontent.com");
    }

    [Fact]
    public async Task GoogleConfig_WhenDisabled_ReturnsEnabledFalseAndNoClientId()
    {
        var mediator = new Mock<IMediator>();
        mediator
            .Setup(m => m.Send(It.IsAny<GetAdminGoogleSsoConfigQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result<AdminGoogleSsoConfigDto>.Success(new AdminGoogleSsoConfigDto
            {
                Enabled = false,
                ClientId = null
            }));

        var result = await CreateController(mediator).GoogleConfig(CancellationToken.None);

        var dto = result.Should().BeOfType<OkObjectResult>().Subject.Value
            .Should().BeOfType<AdminGoogleSsoConfigDto>().Subject;
        dto.Enabled.Should().BeFalse();
        dto.ClientId.Should().BeNull();
    }

    [Fact]
    public void GoogleConfig_IsAnAnonymousGetOnGoogleConfigRoute()
    {
        var method = typeof(AuthLoginController).GetMethod(nameof(AuthLoginController.GoogleConfig))!;

        method.GetCustomAttributes(typeof(AllowAnonymousAttribute), inherit: false).Should().NotBeEmpty();
        var get = method.GetCustomAttributes(typeof(HttpGetAttribute), inherit: false)
            .Cast<HttpGetAttribute>()
            .Single();
        get.Template.Should().Be("google-config");
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pwsh ../dev-env/scripts/verify.ps1 backend -Filter "FullyQualifiedName~AuthLoginControllerGoogleConfigTests"`

Expected: build FAILS with `'AuthLoginController' does not contain a definition for 'GoogleConfig'`.

---

### Task 2: Add the endpoint

**Files:**
- Modify: `src/ONEVO.Api/Controllers/Tenant/Auth/AuthLoginController.cs` (usings at the top; new action after `LoginWithGoogle`, before the closing `}` of the class)

- [ ] **Step 1: Add the using**

Next to the other `using ONEVO.Application.Features.Auth.Login...` lines:

```csharp
using ONEVO.Application.Features.Auth.Login.Queries.GetAdminGoogleSsoConfig;
```

- [ ] **Step 2: Add the action** right after the `LoginWithGoogle` method:

```csharp
    /// <summary>
    /// Public Google SSO config for the web login page: whether Google sign-in is usable and its
    /// public clientId. Anonymous because the page needs it before anyone signs in. Reuses the
    /// admin portal's query on purpose (same platform_oauth_apps row, same "never return secret
    /// material" rule) so there is one definition of "Google SSO is enabled".
    /// </summary>
    [HttpGet("google-config")]
    [AllowAnonymous]
    public async Task<IActionResult> GoogleConfig(CancellationToken ct)
    {
        var result = await _mediator.Send(new GetAdminGoogleSsoConfigQuery(), ct);
        return Ok(result.Value);
    }
```

- [ ] **Step 3: Run the new tests**

Run: `pwsh ../dev-env/scripts/verify.ps1 backend -Filter "FullyQualifiedName~AuthLoginControllerGoogleConfigTests"`

Expected: 3 passed, 0 failed.

- [ ] **Step 4: Run the full gate** (unit + architecture tests; `AuthControllerSplitArchitectureTests` and `AuthContractArchitectureTests` check the auth controllers)

Run: `pwsh ../dev-env/scripts/verify.ps1 backend`

Expected: build OK, all unit and architecture tests pass.

- [ ] **Step 5: Check no endpoint is accidentally unprotected**

Run: `pwsh ../dev-env/scripts/find-unauthorized-endpoints.ps1 backend`

Expected: `0` unprotected actions (the new action is explicitly `[AllowAnonymous]`, which the script accepts).

- [ ] **Step 6: Smoke-test against the running API** (API started with `dotnet run` in `src/ONEVO.Api`)

Run: `curl -k https://crownus.test:7229/api/v1/auth/google-config`

Expected before the admin setup: `{"enabled":false,"clientId":null}`. After the setup in section 4: `{"enabled":true,"clientId":"....apps.googleusercontent.com"}`. MVC serializes camelCase, so the keys are `enabled` and `clientId`. If they come back different, Part 2's `GoogleSsoConfigDto` must match what you see.

- [ ] **Step 7: Commit** (on a feature branch, not `development`/`main`)

```bash
git add src/ONEVO.Api/Controllers/Tenant/Auth/AuthLoginController.cs tests/ONEVO.Tests.Unit/Features/Auth/AuthLoginControllerGoogleConfigTests.cs
git commit -m "feat(auth): expose public Google SSO config for the web login page"
```

---

### Notes

- No rate limit entry is needed: the response is small, public and cached-safe. `login/google` itself is already rate-limited in `AuthRateLimitingMiddleware`.
- No CSRF entry is needed: it's a GET.
- Optional, same change: add `docs/postman-request/Tenant Authentication/Google Config.md` next to the existing `Login With Google.md`.

---

## Part 2: Web data layer (DTOs, GIS service, API, store)

**Goal:** Everything the login page needs for Google SSO exists and is unit-tested, without touching any UI yet.

**Architecture:** Following `docs/core/ARCHITECTURE.md` §2/§4: DTOs in `models/dto`, HTTP in `AuthApiService` (data-access), state in `AuthStore`. Google Identity Services is a browser SDK, so it gets its own small data-access wrapper `GoogleIdentityService`. Specs then mock it and never load a real script. Every new HTTP call that `login/google` needs goes to the **root host** through `getSystemApiUrl()`, exactly like `login()`, because the backend rejects Google login on a tenant host.

**Tech Stack:** Angular 21, `@ngrx/signals`, RxJS, Vitest (`vi.fn`), `HttpTestingController`.

**Repo:** `C:\HR2\Hrms--Web-application---front-end---v1`. Run every command from that folder.

**Backend contracts this part matches (checked 2026-11-16):**

| Call | Request body | Response |
|---|---|---|
| `GET /auth/google-config` (Part 1) | none | `{ "enabled": bool, "clientId": string \| null }` |
| `POST /auth/login/google` | `{ "google_id_token": "..." }` | 200: `AuthResponseDto` (usually `redirect_required` + `continue_url`) · 202: `{ "requires_workspace_selection": true, "login_challenge": "...", "workspaces": [{ "slug": "...", "displayName": "..." }] }` · 401 / 500: ProblemDetails |
| `POST /auth/login/select-workspace` | `{ "login_challenge": "...", "workspace": "<slug>" }` | `AuthResponseDto` |
| `POST /auth/login` (existing) | unchanged | can **also** return the same 202 body, which the SPA never handled until now |

Note the mixed casing in the 202 body: `displayName` is camelCase, everything else is snake_case. Keep the DTO exactly like that.

---

### Task 1: DTOs and endpoint paths

**Files:**
- Create: `src/app/core/auth/models/dto/google-sso-config.dto.ts`
- Create: `src/app/core/auth/models/dto/google-login-request.dto.ts`
- Create: `src/app/core/auth/models/dto/workspace-selection.dto.ts`
- Modify: `src/app/core/config/api-endpoints.ts:5-16` (the `auth` block)

- [ ] **Step 1: `google-sso-config.dto.ts`**

```ts
/** Public, anonymous GET /auth/google-config. Never carries secret material. */
export interface GoogleSsoConfigDto {
  enabled: boolean;
  clientId: string | null;
}
```

- [ ] **Step 2: `google-login-request.dto.ts`**

```ts
export interface GoogleLoginRequestDto {
  google_id_token: string;
}
```

- [ ] **Step 3: `workspace-selection.dto.ts`**

```ts
import { AuthResponseDto } from './auth-response.dto';

/** One workspace the signed-in identity may enter. displayName is camelCase on the wire. */
export interface WorkspaceOptionDto {
  slug: string;
  displayName: string;
}

/** 202 body from POST /auth/login and POST /auth/login/google when 2-8 workspaces match. */
export interface WorkspaceSelectionRequiredDto {
  requires_workspace_selection: true;
  login_challenge: string;
  workspaces: WorkspaceOptionDto[];
}

export interface SelectWorkspaceRequestDto {
  login_challenge: string;
  workspace: string;
}

/** What a root-host login call can answer with. */
export type LoginResultDto = AuthResponseDto | WorkspaceSelectionRequiredDto;

export function isWorkspaceSelectionRequired(body: LoginResultDto): body is WorkspaceSelectionRequiredDto {
  return (body as WorkspaceSelectionRequiredDto).requires_workspace_selection === true;
}
```

- [ ] **Step 4: Add the paths** inside `API_ENDPOINTS.auth`, after `login: '/auth/login',`:

```ts
    loginGoogle: '/auth/login/google',
    selectWorkspace: '/auth/login/select-workspace',
    googleConfig: '/auth/google-config',
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -p tsconfig.app.json --noEmit`

Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/auth/models/dto/google-sso-config.dto.ts src/app/core/auth/models/dto/google-login-request.dto.ts src/app/core/auth/models/dto/workspace-selection.dto.ts src/app/core/config/api-endpoints.ts
git commit -m "feat(auth): add Google SSO and workspace-selection DTOs"
```

---

### Task 2: `GoogleIdentityService` (lazy GIS loader)

**Files:**
- Create: `src/app/core/auth/data-access/google-identity.service.spec.ts`
- Create: `src/app/core/auth/data-access/google-identity.service.ts`

**Why Google's own button:** the backend needs an **ID token**. GIS only returns one through the button it draws itself (`google.accounts.id.renderButton`) or One Tap. A click on our own styled `<button>` can't get one, so Part 3 swaps the custom button for a host `<div>` that GIS draws into. Before coding, re-check the current GIS reference (https://developers.google.com/identity/gsi/web/reference/js-reference) for the `initialize` / `renderButton` option names used below.

- [ ] **Step 1: Write the failing spec**

```ts
import { TestBed } from '@angular/core/testing';
import { GOOGLE_GSI_SCRIPT_URL, GoogleIdentityService } from './google-identity.service';

describe('GoogleIdentityService', () => {
  let service: GoogleIdentityService;
  const initialize = vi.fn();
  const renderButton = vi.fn();

  const gisScripts = (): NodeListOf<HTMLScriptElement> =>
    document.querySelectorAll<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SCRIPT_URL}"]`);

  function finishScriptLoad(): void {
    window.google = { accounts: { id: { initialize, renderButton } } };
    gisScripts()[0].dispatchEvent(new Event('load'));
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GoogleIdentityService);
  });

  afterEach(() => {
    gisScripts().forEach((script) => script.remove());
    delete window.google;
    vi.clearAllMocks();
  });

  it('adds the GIS script only once when load() is called twice', async () => {
    const first = service.load();
    const second = service.load();
    finishScriptLoad();

    await Promise.all([first, second]);

    expect(gisScripts().length).toBe(1);
  });

  it('rejects when the script fails to load', async () => {
    const attempt = service.load();
    gisScripts()[0].dispatchEvent(new Event('error'));

    await expect(attempt).rejects.toThrow('Could not load Google Identity Services.');
  });

  it('initialises GIS with the client id, draws the button and hands back the ID token', async () => {
    const host = document.createElement('div');
    const onToken = vi.fn();

    const rendering = service.renderSignInButton(host, 'client-123', onToken);
    finishScriptLoad();
    await rendering;

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 'client-123', ux_mode: 'popup', auto_select: false })
    );
    expect(renderButton).toHaveBeenCalledWith(host, expect.objectContaining({ text: 'continue_with' }));

    const { callback } = initialize.mock.calls[0][0] as { callback: (r: { credential: string }) => void };
    callback({ credential: 'id-token-abc' });
    expect(onToken).toHaveBeenCalledWith('id-token-abc');
  });

  it('ignores a GIS callback without a credential', async () => {
    const onToken = vi.fn();
    const rendering = service.renderSignInButton(document.createElement('div'), 'client-123', onToken);
    finishScriptLoad();
    await rendering;

    const { callback } = initialize.mock.calls[0][0] as { callback: (r: { credential: string }) => void };
    callback({ credential: '' });

    expect(onToken).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx ng test --include src/app/core/auth/data-access/google-identity.service.spec.ts --watch=false`

Expected: FAIL, `Cannot find module './google-identity.service'`.

- [ ] **Step 3: Write the service**

```ts
import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

export const GOOGLE_GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/**
 * Thin wrapper over Google Identity Services. Loads the GIS script lazily (only the login page
 * needs it), draws Google's own sign-in button and passes the returned ID token to the caller.
 * The token is never stored here: it goes straight to POST /auth/login/google.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private document = inject(DOCUMENT);
  private loading: Promise<GoogleAccountsId> | null = null;

  load(): Promise<GoogleAccountsId> {
    const ready = this.document.defaultView?.google?.accounts.id;
    if (ready) return Promise.resolve(ready);
    if (this.loading) return this.loading;

    this.loading = new Promise<GoogleAccountsId>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = GOOGLE_GSI_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', () => {
        const id = this.document.defaultView?.google?.accounts.id;
        if (id) {
          resolve(id);
        } else {
          this.loading = null;
          reject(new Error('Google Identity Services did not initialise.'));
        }
      });
      script.addEventListener('error', () => {
        this.loading = null;
        reject(new Error('Could not load Google Identity Services.'));
      });
      this.document.head.appendChild(script);
    });

    return this.loading;
  }

  async renderSignInButton(host: HTMLElement, clientId: string, onToken: (idToken: string) => void): Promise<void> {
    const id = await this.load();
    id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response.credential) onToken(response.credential);
      },
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true
    });
    id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'center',
      width: Math.max(host.clientWidth, 240)
    });
  }
}
```

- [ ] **Step 4: Run the spec**

Run: `npx ng test --include src/app/core/auth/data-access/google-identity.service.spec.ts --watch=false`

Expected: 4 passed, and no warnings printed.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/auth/data-access/google-identity.service.ts src/app/core/auth/data-access/google-identity.service.spec.ts
git commit -m "feat(auth): add lazy Google Identity Services wrapper"
```

---

### Task 3: `AuthApiService` methods

**Files:**
- Modify: `src/app/core/auth/data-access/auth-api.service.spec.ts` (inside `describe('AuthApiService')`, after the `/auth/login` test at line 70-76)
- Modify: `src/app/core/auth/data-access/auth-api.service.ts` (imports; `login()` at line 43-46; new methods after it)

- [ ] **Step 1: Add the failing specs** after the `POSTs credentials to /auth/login` test:

```ts
  it('GETs the public Google SSO config from /auth/google-config', () => {
    service.getGoogleSsoConfig().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/google-config`);
    expect(req.request.method).toBe('GET');
    req.flush({ enabled: false, clientId: null });
  });

  it('POSTs the Google ID token to /auth/login/google', () => {
    service.loginWithGoogle('id-token-abc').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login/google`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ google_id_token: 'id-token-abc' });
    req.flush(sampleResponse);
  });

  it('POSTs the challenge and chosen workspace to /auth/login/select-workspace', () => {
    service.selectWorkspace({ login_challenge: 'challenge-1', workspace: 'beta' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login/select-workspace`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ login_challenge: 'challenge-1', workspace: 'beta' });
    req.flush(sampleResponse);
  });
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx ng test --include src/app/core/auth/data-access/auth-api.service.spec.ts --watch=false`

Expected: FAIL, `service.getGoogleSsoConfig is not a function` (and the same for the other two).

- [ ] **Step 3: Add imports** at the top of `auth-api.service.ts`:

```ts
import { GoogleSsoConfigDto } from '../models/dto/google-sso-config.dto';
import { GoogleLoginRequestDto } from '../models/dto/google-login-request.dto';
import { LoginResultDto, SelectWorkspaceRequestDto } from '../models/dto/workspace-selection.dto';
```

- [ ] **Step 4: Replace `login()` and add the three methods right after it**

```ts
  /** Root-host only. 200 = AuthResponseDto, 202 = WorkspaceSelectionRequiredDto. */
  login(payload: LoginRequestDto): Observable<LoginResultDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<LoginResultDto>(`${baseUrl}${API_ENDPOINTS.auth.login}`, payload);
  }

  /** Anonymous. Root host so the answer is the same from any page. */
  getGoogleSsoConfig(): Observable<GoogleSsoConfigDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.get<GoogleSsoConfigDto>(`${baseUrl}${API_ENDPOINTS.auth.googleConfig}`);
  }

  /**
   * Root-host only, like login(): AuthLoginController.LoginWithGoogle returns 400 on a tenant host.
   * Same 200/202 outcomes as login().
   */
  loginWithGoogle(idToken: string): Observable<LoginResultDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    const payload: GoogleLoginRequestDto = { google_id_token: idToken };
    return this.http.post<LoginResultDto>(`${baseUrl}${API_ENDPOINTS.auth.loginGoogle}`, payload);
  }

  /** Root-host only: completes a 202 from login() or loginWithGoogle(). */
  selectWorkspace(payload: SelectWorkspaceRequestDto): Observable<AuthResponseDto> {
    const baseUrl = getSystemApiUrl(environment.apiUrl);
    return this.http.post<AuthResponseDto>(`${baseUrl}${API_ENDPOINTS.auth.selectWorkspace}`, payload);
  }
```

- [ ] **Step 5: Run the spec file and the tenant-host spec**

Run: `npx ng test --include "src/app/core/auth/data-access/*.spec.ts" --watch=false`

Expected: all pass. The `login()` return type change compiles because `AuthStore` is updated in Task 4. If you run this step before Task 4, expect a type error in `auth.store.ts`. That's fine, Task 4 fixes it.

- [ ] **Step 6: Commit** (together with Task 4 if the type error above shows up)

```bash
git add src/app/core/auth/data-access/auth-api.service.ts src/app/core/auth/data-access/auth-api.service.spec.ts
git commit -m "feat(auth): add Google login, config and workspace-selection API calls"
```

---

### Task 4: `AuthStore` state and methods

**Files:**
- Modify: `src/app/core/auth/state/auth.store.spec.ts` (append tests at the end of `describe('AuthStore')`)
- Modify: `src/app/core/auth/state/auth.store.ts`

- [ ] **Step 1: Add the failing specs** at the end of `describe('AuthStore')`:

```ts
  const selectionBody: WorkspaceSelectionRequiredDto = {
    requires_workspace_selection: true,
    login_challenge: 'challenge-1',
    workspaces: [
      { slug: 'acme', displayName: 'Acme' },
      { slug: 'beta', displayName: 'Beta' }
    ]
  };

  it('keeps the Google client id when SSO is enabled', async () => {
    const store = setup({ getGoogleSsoConfig: () => of({ enabled: true, clientId: 'client-123' }) } as Partial<AuthApiService>);
    await store.loadGoogleSsoConfig();
    expect(store.googleClientId()).toBe('client-123');
  });

  it('leaves the Google client id empty when SSO is disabled', async () => {
    const store = setup({ getGoogleSsoConfig: () => of({ enabled: false, clientId: null }) } as Partial<AuthApiService>);
    await store.loadGoogleSsoConfig();
    expect(store.googleClientId()).toBeNull();
  });

  it('leaves the Google client id empty when the config call fails', async () => {
    const store = setup({ getGoogleSsoConfig: () => throwError(() => new Error('down')) } as Partial<AuthApiService>);
    await store.loadGoogleSsoConfig();
    expect(store.googleClientId()).toBeNull();
  });

  it('signs in with a Google ID token', async () => {
    const loginWithGoogle = vi.fn(() => of(authenticatedDto));
    const store = setup({ loginWithGoogle } as Partial<AuthApiService>);

    await store.loginWithGoogle('id-token-abc');

    expect(loginWithGoogle).toHaveBeenCalledWith('id-token-abc');
    expect(store.authenticated()).toBe(true);
    expect(store.workspaceSlug()).toBe('acme');
    expect(store.workspaceSelection()).toBeNull();
  });

  it('keeps the workspace choices when Google login answers 202', async () => {
    const store = setup({ loginWithGoogle: () => of(selectionBody) } as Partial<AuthApiService>);

    await store.loginWithGoogle('id-token-abc');

    expect(store.authenticated()).toBe(false);
    expect(store.workspaceSelection()).toEqual(selectionBody);
    expect(store.loading()).toBe(false);
  });

  it('keeps the workspace choices when password login answers 202', async () => {
    const store = setup({ login: () => of(selectionBody) } as Partial<AuthApiService>);

    await store.login({ email: 'a@b.com', password: 'secret' });

    expect(store.workspaceSelection()).toEqual(selectionBody);
  });

  it('finishes sign-in after a workspace is chosen', async () => {
    const selectWorkspace = vi.fn(() => of(authenticatedDto));
    const store = setup({ loginWithGoogle: () => of(selectionBody), selectWorkspace } as Partial<AuthApiService>);

    await store.loginWithGoogle('id-token-abc');
    await store.selectWorkspace('beta');

    expect(selectWorkspace).toHaveBeenCalledWith({ login_challenge: 'challenge-1', workspace: 'beta' });
    expect(store.authenticated()).toBe(true);
    expect(store.workspaceSelection()).toBeNull();
  });

  it('drops an expired workspace choice and shows an error', async () => {
    const store = setup({
      loginWithGoogle: () => of(selectionBody),
      selectWorkspace: () => throwError(() => new HttpErrorResponse({ status: 401 }))
    } as Partial<AuthApiService>);

    await store.loginWithGoogle('id-token-abc');
    await expect(store.selectWorkspace('beta')).rejects.toBeTruthy();

    expect(store.workspaceSelection()).toBeNull();
    expect(store.error()).toBe('That sign-in has expired. Please sign in again.');
  });

  it('reports an unreachable server when Google login never reaches the API', async () => {
    const store = setup({
      loginWithGoogle: () => throwError(() => new HttpErrorResponse({ status: 0 }))
    } as Partial<AuthApiService>);

    await expect(store.loginWithGoogle('id-token-abc')).rejects.toBeTruthy();

    expect(store.error()).toBe('We could not reach the server. Check your connection and try again.');
  });

  it('clears the workspace choice on request', async () => {
    const store = setup({ loginWithGoogle: () => of(selectionBody) } as Partial<AuthApiService>);
    await store.loginWithGoogle('id-token-abc');

    store.clearWorkspaceSelection();

    expect(store.workspaceSelection()).toBeNull();
  });
```

Add the import at the top of the spec:

```ts
import { WorkspaceSelectionRequiredDto } from '../models/dto/workspace-selection.dto';
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx ng test --include src/app/core/auth/state/auth.store.spec.ts --watch=false`

Expected: FAIL, `store.loadGoogleSsoConfig is not a function` and similar.

- [ ] **Step 3: Store imports.** Add to `auth.store.ts`:

```ts
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import {
  LoginResultDto,
  WorkspaceSelectionRequiredDto,
  isWorkspaceSelectionRequired
} from '../models/dto/workspace-selection.dto';
```

- [ ] **Step 4: State.** Add to `interface AuthState` (after `continueUrl`):

```ts
  googleClientId: string | null;
  workspaceSelection: WorkspaceSelectionRequiredDto | null;
```

and to `initialState` (after `continueUrl: null,`):

```ts
  googleClientId: null,
  workspaceSelection: null,
```

- [ ] **Step 5: Shared helpers.** Change the head of `withMethods` from an expression body to a block, so the helpers can be shared. Replace

```ts
  withMethods((store, api = inject(AuthApiService)) => ({
```

with

```ts
  withMethods((store, api = inject(AuthApiService)) => {
    const applyAuthResponse = (dto: AuthResponseDto): void => {
      const view = toCurrentUserViewModel(dto);
      patchState(store, {
        authenticated: view.authenticated,
        email: view.email,
        employeeId: view.employeeId,
        permissions: view.permissions,
        activeModules: view.activeModules,
        managesPeople: view.managesPeople,
        legalAcceptanceRequired: view.legalAcceptanceRequired,
        pendingLegalDocuments: view.pendingLegalDocuments,
        workspaceSlug: view.workspaceSlug,
        redirectRequired: view.redirectRequired,
        continueUrl: view.continueUrl,
        workspaceSelection: null,
        loading: false
      });
    };

    /** 202 bodies park the choice in state; anything else is a normal auth response. */
    const applyLoginResult = (body: LoginResultDto): void => {
      if (isWorkspaceSelectionRequired(body)) {
        patchState(store, { workspaceSelection: body, loading: false });
        return;
      }
      applyAuthResponse(body);
    };

    const loginErrorMessage = (err: unknown, fallback: string): string =>
      err instanceof HttpErrorResponse && err.status === 0
        ? UNREACHABLE_MESSAGE
        : extractErrorMessage(err, fallback);

    return {
```

and at the very end of the methods object replace the closing

```ts
  }))
);
```

with

```ts
    };
  })
);
```

- [ ] **Step 6: Replace the body of `login()`** with:

```ts
    async login(payload: LoginRequestDto): Promise<void> {
      patchState(store, { loading: true, error: null, workspaceSelection: null });
      try {
        applyLoginResult(await firstValueFrom(api.login(payload)));
      } catch (err) {
        // status 0 = the request never reached the API (network/TLS/CORS), so the credentials
        // were never checked - same convention as exchange() below.
        patchState(store, { loading: false, error: loginErrorMessage(err, 'Invalid email or password.') });
        throw err;
      }
    },
```

- [ ] **Step 7: Add the new methods** right before `clearSession(): void {`:

```ts
    /** Never throws: any failure just means the Google button stays hidden. */
    async loadGoogleSsoConfig(): Promise<void> {
      try {
        const config = await firstValueFrom(api.getGoogleSsoConfig());
        patchState(store, { googleClientId: config.enabled && config.clientId ? config.clientId : null });
      } catch {
        patchState(store, { googleClientId: null });
      }
    },

    async loginWithGoogle(idToken: string): Promise<void> {
      patchState(store, { loading: true, error: null, workspaceSelection: null });
      try {
        applyLoginResult(await firstValueFrom(api.loginWithGoogle(idToken)));
      } catch (err) {
        patchState(store, { loading: false, error: loginErrorMessage(err, 'Google sign-in failed. Please try again.') });
        throw err;
      }
    },

    async selectWorkspace(slug: string): Promise<void> {
      const selection = store.workspaceSelection();
      if (!selection) return;
      patchState(store, { loading: true, error: null });
      try {
        applyAuthResponse(
          await firstValueFrom(api.selectWorkspace({ login_challenge: selection.login_challenge, workspace: slug }))
        );
      } catch (err) {
        // The challenge lives 5 minutes server-side and is single-use; any failure means start over.
        patchState(store, {
          loading: false,
          workspaceSelection: null,
          error: loginErrorMessage(err, 'That sign-in has expired. Please sign in again.')
        });
        throw err;
      }
    },

    clearWorkspaceSelection(): void {
      patchState(store, { workspaceSelection: null, error: null });
    },
```

> `safeServerDetail()` may return the server's ProblemDetails text instead of these fallbacks. That's expected. For example, the backend answers a Google email with no account with its generic "Invalid email or password." on purpose, so it can't be used to discover accounts. The expired-choice test above uses a 401 with no body, so it gets the fallback.

- [ ] **Step 8: Run the store and API specs**

Run: `npx ng test --include "src/app/core/auth/**/*.spec.ts" --watch=false`

Expected: every auth spec passes, including the existing `login` tests (they still get a plain `AuthResponseDto`), with no warnings.

- [ ] **Step 9: Commit**

```bash
git add src/app/core/auth/state/auth.store.ts src/app/core/auth/state/auth.store.spec.ts src/app/core/auth/data-access/auth-api.service.ts src/app/core/auth/data-access/auth-api.service.spec.ts
git commit -m "feat(auth): store Google SSO config, Google login and workspace selection"
```

---

## Part 3: Web login UI (Google button, workspace picker, docs, CSP)

**Goal:** On the root-host login page, Google's "Continue with Google" button appears only when Google SSO is enabled. It signs the user in, and people with several workspaces can pick one.

**Architecture:** `LoginComponent` (a `feature/` smart container) asks `AuthStore.loadGoogleSsoConfig()` for the client id, then asks `GoogleIdentityService` to draw Google's button into a host `<div>`. The ID token goes to `AuthStore.loginWithGoogle()`. After any login (password, Google or workspace pick), one shared `navigateAfterLogin()` does what `submit()` does today: legal consent, cross-host `continue_url`, `returnUrl`, or the default page. The picker is shown inline. The rest of the page is hidden with `[hidden]`, not removed with `@if`, so the GIS-drawn button survives and doesn't need re-drawing.

**Architecture note (deviation, stated on purpose):** `ARCHITECTURE.md` §2 says feature components make no direct API calls. `GoogleIdentityService` is not an HTTP API. It's a browser SDK that has to draw into this component's DOM, so the component injects it directly. All HTTP still goes through the store. (`LoginComponent` already injects `AuthApiService` for `meForTenant`. That existing deviation is left as it is.)

**Tech Stack:** Angular 21 standalone component, signals, `viewChild`, Vitest.

**Repo:** `C:\HR2\Hrms--Web-application---front-end---v1`. Needs Part 2 merged first.

---

### Task 1: Make the spec's `setup()` ready for the new dependencies

**Files:**
- Modify: `src/app/core/auth/feature/login/login.component.spec.ts:1-58`

The component will call `store.loadGoogleSsoConfig()`, `store.googleClientId()` and `store.workspaceSelection()` on every render. The existing tests pass small store mocks without those, so `setup()` must fill in safe defaults, or every existing test breaks.

- [ ] **Step 1: Add the import** at the top:

```ts
import { GoogleIdentityService } from '../../data-access/google-identity.service';
```

- [ ] **Step 2: Replace `setup()`** with:

```ts
  const googleIdentity = { renderSignInButton: vi.fn().mockResolvedValue(undefined) };

  const storeDefaults = {
    loadGoogleSsoConfig: vi.fn().mockResolvedValue(undefined),
    googleClientId: () => null,
    workspaceSelection: () => null,
    loading: () => false,
    error: () => null
  };

  function setup(
    authStoreOverrides: Record<string, unknown>,
    returnUrl: string | null = null,
    authApiOverrides: Record<string, unknown> = { meForTenant: vi.fn() }
  ) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([
          { path: 'dashboard', component: RouteTargetStubComponent },
          { path: 'auth/legal-consent', component: RouteTargetStubComponent },
          { path: 'device/activate', component: RouteTargetStubComponent },
          { path: '**', component: RouteTargetStubComponent }
        ]),
        { provide: AuthStore, useValue: { ...storeDefaults, ...authStoreOverrides } },
        { provide: AuthApiService, useValue: authApiOverrides },
        { provide: GoogleIdentityService, useValue: googleIdentity },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (key: string) => (key === 'returnUrl' ? returnUrl : null) } }
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => googleIdentity.renderSignInButton.mockClear());
```

- [ ] **Step 3: Run the existing login spec** (nothing in the component has changed yet)

Run: `npx ng test --include src/app/core/auth/feature/login/login.component.spec.ts --watch=false`

Expected: all existing tests still pass.

---

### Task 2: Failing specs for Google sign-in and the picker

**Files:**
- Modify: `src/app/core/auth/feature/login/login.component.spec.ts` (new `describe` blocks at the end of `describe('LoginComponent')`)

- [ ] **Step 1: Append the specs**

```ts
  async function settleGoogleSetup(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  const baseStore = {
    login: vi.fn(),
    legalAcceptanceRequired: () => false,
    redirectRequired: () => false,
    continueUrl: () => null
  };

  describe('Google sign-in', () => {
    it('keeps the Google button hidden when Google SSO is disabled', async () => {
      const fixture = setup({ ...baseStore, googleClientId: () => null });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(googleIdentity.renderSignInButton).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('.login-google').hidden).toBe(true);
      expect(fixture.nativeElement.querySelector('.login-google-divider')).toBeNull();
    });

    it("draws Google's button with the configured client id", async () => {
      const fixture = setup({ ...baseStore, googleClientId: () => 'client-123' });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(googleIdentity.renderSignInButton).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        'client-123',
        expect.any(Function)
      );
      expect(fixture.nativeElement.querySelector('.login-google').hidden).toBe(false);
      expect(fixture.nativeElement.querySelector('.login-google-divider')).not.toBeNull();
    });

    it('keeps the button hidden when Google Identity Services fails to load', async () => {
      googleIdentity.renderSignInButton.mockRejectedValueOnce(new Error('blocked'));
      const fixture = setup({ ...baseStore, googleClientId: () => 'client-123' });

      await settleGoogleSetup();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.login-google').hidden).toBe(true);
    });

    it('signs in with the ID token and follows the continue url', async () => {
      const restore = stubLocation('localhost');
      const loginWithGoogle = vi.fn().mockResolvedValue(undefined);
      try {
        const fixture = setup({
          ...baseStore,
          googleClientId: () => 'client-123',
          loginWithGoogle,
          redirectRequired: () => true,
          continueUrl: () => 'https://acme.localhost:4200/auth/continue?code=abc'
        });

        await fixture.componentInstance.completeGoogleSignIn('id-token-abc');

        expect(loginWithGoogle).toHaveBeenCalledWith('id-token-abc');
        expect(window.location.href).toBe('https://acme.localhost:4200/auth/continue?code=abc');
      } finally {
        restore();
      }
    });

    it('stays on the page when Google sign-in fails', async () => {
      const fixture = setup({
        ...baseStore,
        loginWithGoogle: vi.fn().mockRejectedValue(new Error('401'))
      });
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

      await fixture.componentInstance.completeGoogleSignIn('id-token-abc');

      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('workspace picker', () => {
    const selection = {
      requires_workspace_selection: true as const,
      login_challenge: 'challenge-1',
      workspaces: [
        { slug: 'acme', displayName: 'Acme' },
        { slug: 'beta', displayName: 'Beta' }
      ]
    };

    it('lists the workspaces and hides the login form', () => {
      const fixture = setup({ ...baseStore, workspaceSelection: () => selection });

      const options = fixture.nativeElement.querySelectorAll('.login-workspaces__option');
      expect(Array.from(options as NodeListOf<HTMLElement>).map((o) => o.textContent?.trim())).toEqual(['Acme', 'Beta']);
      expect(fixture.nativeElement.querySelector('.login-main').hidden).toBe(true);
    });

    it('selects a workspace and continues sign-in', async () => {
      const restore = stubLocation('localhost');
      const selectWorkspace = vi.fn().mockResolvedValue(undefined);
      try {
        const fixture = setup({
          ...baseStore,
          workspaceSelection: () => selection,
          selectWorkspace,
          redirectRequired: () => true,
          continueUrl: () => 'https://beta.localhost:4200/auth/continue?code=xyz'
        });

        await fixture.componentInstance.chooseWorkspace('beta');

        expect(selectWorkspace).toHaveBeenCalledWith('beta');
        expect(window.location.href).toBe('https://beta.localhost:4200/auth/continue?code=xyz');
      } finally {
        restore();
      }
    });

    it('goes back to the sign-in options', () => {
      const clearWorkspaceSelection = vi.fn();
      const fixture = setup({ ...baseStore, workspaceSelection: () => selection, clearWorkspaceSelection });

      (fixture.nativeElement.querySelector('.login-workspaces__back') as HTMLButtonElement).click();

      expect(clearWorkspaceSelection).toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run and watch them fail**

Run: `npx ng test --include src/app/core/auth/feature/login/login.component.spec.ts --watch=false`

Expected: the new tests FAIL (`.login-google` not found, `completeGoogleSignIn is not a function`, `chooseWorkspace is not a function`). The old tests still pass.

---

### Task 3: Component class

**Files:**
- Modify: `src/app/core/auth/feature/login/login.component.ts`

- [ ] **Step 1: Imports.** Change the first line and add the service import:

```ts
import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
```

```ts
import { GoogleIdentityService } from '../../data-access/google-identity.service';
```

- [ ] **Step 2: Fields.** Under `store = inject(AuthStore);` add:

```ts
  private googleIdentity = inject(GoogleIdentityService);

  readonly googleButtonHost = viewChild.required<ElementRef<HTMLElement>>('googleButtonHost');
  /** True only after Google's button has actually been drawn. */
  readonly googleReady = signal(false);
```

- [ ] **Step 3: `ngOnInit`.** Replace the last line `void this.loadRememberedAccount();` with:

```ts
    void this.loadRememberedAccount();
    void this.setupGoogleSignIn();
```

- [ ] **Step 4: Replace `signInWithGoogle()`** (the `console.log` stub) with:

```ts
  private async setupGoogleSignIn(): Promise<void> {
    try {
      await this.store.loadGoogleSsoConfig();
      const clientId = this.store.googleClientId();
      if (!clientId) return;

      await this.googleIdentity.renderSignInButton(
        this.googleButtonHost().nativeElement,
        clientId,
        (idToken) => void this.completeGoogleSignIn(idToken)
      );
      this.googleReady.set(true);
    } catch {
      // Script blocked, offline, or GIS failed: password login still works, so just hide Google.
      this.googleReady.set(false);
    }
  }

  async completeGoogleSignIn(idToken: string): Promise<void> {
    try {
      await this.store.loginWithGoogle(idToken);
    } catch {
      return; // store.error() is shown in the template
    }
    await this.navigateAfterLogin();
  }

  async chooseWorkspace(slug: string): Promise<void> {
    try {
      await this.store.selectWorkspace(slug);
    } catch {
      return;
    }
    await this.navigateAfterLogin();
  }
```

- [ ] **Step 5: Share the post-login routing.** In `submit()`, replace everything from `if (this.store.legalAcceptanceRequired()) {` to the end of the method with one call:

```ts
    await this.navigateAfterLogin();
  }

  /** Same routing for password, Google and workspace-pick logins. */
  private async navigateAfterLogin(): Promise<void> {
    // 202: the template now shows the workspace picker; wait for the user's choice.
    if (this.store.workspaceSelection()) return;

    if (this.store.legalAcceptanceRequired()) {
      this.router.navigate(['/auth/legal-consent']);
    } else if (this.store.redirectRequired()) {
      const url = this.store.continueUrl();
      if (url) {
        // continueUrl already carries its own ?code=... query string, so append with '&'.
        // The tenant host's SessionExchangeComponent reads this same returnUrl param back out
        // once the session cookie is established there.
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        window.location.href = returnUrl ? `${url}&returnUrl=${encodeURIComponent(returnUrl)}` : url;
      }
    } else {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl) {
        // navigate([returnUrl]) would treat the whole string (path + query string) as one
        // literal path segment and silently drop the query params - navigateByUrl parses it
        // as a real URL instead, which a route like /device/activate?request_id=...&user_code=...
        // depends on.
        await this.router.navigateByUrl(returnUrl);
      } else {
        this.router.navigate(['/people/employees']);
      }
    }
  }
```

---

### Task 4: Template and styles

**Files:**
- Modify: `src/app/core/auth/feature/login/login.component.html`
- Modify: `src/app/core/auth/feature/login/login.component.css` (lines ~116-145, the `Google SSO Button` block)

- [ ] **Step 1: Template.** Make these changes in order:

1. Right after `<h1 class="login-title">Welcome back!</h1>`, insert the picker:

```html
  @if (store.workspaceSelection(); as selection) {
    <section class="login-workspaces" aria-labelledby="login-workspaces-title">
      <h2 id="login-workspaces-title" class="login-workspaces__title">Choose a workspace</h2>
      <ul class="login-workspaces__list">
        @for (workspace of selection.workspaces; track workspace.slug) {
          <li>
            <button
              type="button"
              class="login-workspaces__option"
              [disabled]="store.loading()"
              (click)="chooseWorkspace(workspace.slug)"
            >
              {{ workspace.displayName }}
            </button>
          </li>
        }
      </ul>
      @if (store.error()) {
        <p class="login-server-error" role="alert">{{ store.error() }}</p>
      }
      <button type="button" class="login-workspaces__back" (click)="store.clearWorkspaceSelection()">
        Use another account
      </button>
    </section>
  }

  <div class="login-main" [hidden]="!!store.workspaceSelection()">
```

2. Replace the whole `<!-- Google SSO Button -->` `<button ...>...</button>` and the `<!-- Divider -->` block after it with:

```html
  <!-- Google SSO: Google Identity Services draws its own button into the host div -->
  <div class="login-google" [hidden]="!googleReady()">
    <div #googleButtonHost class="login-google__host"></div>
  </div>

  @if (googleReady()) {
    <div class="login-divider login-google-divider" aria-hidden="true">
      <span>or</span>
    </div>
  }
```

3. Close the new wrapper: add `</div>` right after the closing `</a>` of the "Forgot Password?" link (before the final `</div>` of `login-container`).

4. The existing `@if (store.error())` inside the form stays. Google errors show there too, because the form is visible when Google login fails.

- [ ] **Step 2: Styles.** Delete the three rules `.login-google-btn`, `.login-google-btn:hover`, `.login-google-btn:focus-visible` and put this in their place (keep the section comment):

```css
.login-google {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 44px;
}

.login-google[hidden],
.login-main[hidden] {
  display: none;
}

.login-google__host {
  width: 100%;
  display: flex;
  justify-content: center;
}

.login-workspaces {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-workspaces__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.login-workspaces__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.login-workspaces__option {
  width: 100%;
  height: 44px;
  padding: 0 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.login-workspaces__option:hover:not(:disabled) {
  background-color: var(--color-surface-secondary);
}

.login-workspaces__option:focus-visible,
.login-workspaces__back:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

.login-workspaces__back {
  align-self: center;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
}
```

If a token above (`--color-text-secondary`) doesn't exist in `src/app/shared/styles/theme-tokens.css`, use the token the file already uses for `.login-forgot-link`.

- [ ] **Step 3: Run the login spec**

Run: `npx ng test --include src/app/core/auth/feature/login/login.component.spec.ts --watch=false`

Expected: all tests pass (old + 8 new), no warnings.

- [ ] **Step 4: Lint + zero-warning build + full tests**

Run: `npm run lint`

Expected: 0 errors, 0 warnings.

Run: `pwsh ../dev-env/scripts/verify.ps1 frontend`

Expected: production build with no `[WARNING]`/`[ERROR]`, all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/auth/feature/login/login.component.ts src/app/core/auth/feature/login/login.component.html src/app/core/auth/feature/login/login.component.css src/app/core/auth/feature/login/login.component.spec.ts
git commit -m "feat(auth): real Google sign-in button and workspace picker on the login page"
```

---

### Task 5: Docs and CSP (same change, per `PROCESS_RULES.md` rules 2 and 6)

**Files:**
- Modify: `docs/core/ARCHITECTURE.md` (folder tree in §2; security headers table around line 1314; nginx snippet around line 1325)

- [ ] **Step 1: Folder tree.** Under `core/auth/data-access/` add `google-identity.service.ts`. Under `core/auth/models/dto/` add `google-sso-config.dto.ts`, `google-login-request.dto.ts`, `workspace-selection.dto.ts`.

- [ ] **Step 2: CSP.** The documented production CSP (`script-src 'self'`, narrow `connect-src`) would block Google Identity Services. Following Google's GIS CSP guidance, change the `Content-Security-Policy` value in **both** the table row and the nginx `add_header` line to:

```
default-src 'self'; script-src 'self' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style; img-src 'self' data: https:; connect-src 'self' https://api.onevo.com wss://api.onevo.com https://accounts.google.com/gsi/; frame-ancestors 'none'
```

Add one sentence under the table: "The `accounts.google.com/gsi/` sources are only for Google SSO on the login page; remove them if Google SSO is ever dropped."

- [ ] **Step 3: Tell whoever owns the real nginx/hosting config** that the same CSP change must be deployed, or Google's button will silently not appear in production. The repo only documents the header. It doesn't deploy it.

- [ ] **Step 4: Commit**

```bash
git add docs/core/ARCHITECTURE.md
git commit -m "docs(architecture): document Google SSO files and CSP sources"
```

---

### Task 6: Manual check in the browser

Follow section 4 (one-time setup) and section 5 (the 7-point end-to-end check). Use Chrome, not the built-in preview pane: the pane can't run the custom `crownus.test` domain. Record the result in `docs/superpowers/plans/next/SUMMARY.md` against this plan's entry.
