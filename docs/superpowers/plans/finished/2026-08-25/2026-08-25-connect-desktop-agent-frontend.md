# Connect Desktop Agent (Settings → Devices) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-service "Generate activation code" page at `/settings/devices` so an
employee can obtain the 8-character code the OneXso Workspace (WorkPulse) desktop TrayApp's
Connect screen needs, without a developer calling the backend API directly.

**Architecture:** One new standalone Angular component (`ConnectDeviceComponent`) backed by
one new data-access service (`ActivationApiService`) that calls the existing
`POST /api/v1/monitoring/activation/generate` endpoint (already implemented server-side,
self-service, rate-limited to 3/hour, 600s code lifetime). No new backend work. No store —
all state (code, countdown, copy confirmation) is local, ephemeral component signal state,
matching the single-action scope. Wired into the existing `settings` route/nav the same way
`clock-in-policy` is.

**Tech Stack:** Angular 21 standalone components, signal `input()`/`computed()`/`signal()`
API, plain CSS (no `.scss` anywhere in this repo), Vitest via `ng test` (confirmed run
command: `npx ng test --watch=false`, executed from
`Hrms--Web-application---front-end---v1/`).

**Spec:** `docs/superpowers/specs/finished/2026-08-25/2026-08-25-connect-desktop-agent-frontend-design.md`

---

## Design decision made while planning (not in the spec)

The spec's Error Handling section calls for an inline "Too many codes requested" message on
429. While mapping this onto the codebase, `error.interceptor.ts` (global) +
`error-handler.service.ts` were found to already show a banner notification for **every**
HTTP error status, keyed by status code — 429 already maps to
`'Too many requests. Please wait a moment.'` (`error-handler.service.ts:30,191`) — and 401 is
already handled by a redirect to login. Duplicating that as a second, bespoke inline message
would just show the user two messages for one failure. The component instead only needs to
reset its own loading state on any error and let the existing global banner carry the
message — see Task 2.

**Correction (2026-08-25, post-commit):** Tasks 3 and 4 originally gated the route/nav entry
on `permissions: ['settings:device']`. That permission is
`PermissionSeeder.cs:166` — "View biometric device connection status" (fingerprint/biometric
hardware integrations) — unrelated to the desktop tray agent. The backend's
`MonitoringActivationController.Generate` endpoint requires only `TenantPolicy`
(any authenticated employee), no permission code. Both tasks below are corrected to gate on
`modules: ['desktop_agent_gateway']` only, with no `permissions` entry.

---

### Task 1: Activation code model + data-access service

**Files:**
- Create: `src/app/modules/settings/models/activation-code.model.ts`
- Create: `src/app/modules/settings/data-access/activation-api.service.ts`
- Test: `src/app/modules/settings/data-access/activation-api.service.spec.ts`

- [ ] **Step 1: Create the response model**

```ts
// src/app/modules/settings/models/activation-code.model.ts

/**
 * Response from POST /api/v1/monitoring/activation/generate
 * (ActivationCodeResponseDto in ONEVO.Application/Features/Monitoring/TrayActivation).
 * Field names are snake_case exactly as the API returns them — there is no
 * case-conversion interceptor in this app (confirmed: only auth/csrf/correlation/error
 * interceptors exist in src/app/core/interceptors).
 */
export interface ActivationCodeResponse {
  readonly code: string;
  readonly expires_in_seconds: number;
}
```

- [ ] **Step 2: Write the failing test for the API service**

```ts
// src/app/modules/settings/data-access/activation-api.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ActivationCodeResponse } from '../models/activation-code.model';
import { ActivationApiService } from './activation-api.service';

describe('ActivationApiService', () => {
  let service: ActivationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ActivationApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ActivationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts to /monitoring/activation/generate with no body and returns the code', () => {
    const response: ActivationCodeResponse = { code: 'APDBSJNA', expires_in_seconds: 600 };

    service.generate().subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/monitoring/activation/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(response);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `Hrms--Web-application---front-end---v1/`): `npx ng test --watch=false`
Expected: FAIL — `Cannot find module './activation-api.service'` (file doesn't exist yet).

- [ ] **Step 4: Implement the service**

```ts
// src/app/modules/settings/data-access/activation-api.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ActivationCodeResponse } from '../models/activation-code.model';

/**
 * Self-service desktop-agent activation codes.
 * Matches MonitoringActivationController's POST /monitoring/activation/generate — always
 * scoped to the calling employee's own account server-side (GenerateActivationCodeCommandHandler
 * reads ICurrentUser, never a target employee id), so there is no employeeId parameter here.
 */
@Injectable({ providedIn: 'root' })
export class ActivationApiService {
  private readonly http = inject(HttpClient);

  generate(): Observable<ActivationCodeResponse> {
    return this.http.post<ActivationCodeResponse>(
      `${environment.apiUrl}/monitoring/activation/generate`,
      null
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx ng test --watch=false`
Expected: PASS — `ActivationApiService > posts to /monitoring/activation/generate...`

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/settings/models/activation-code.model.ts src/app/modules/settings/data-access/activation-api.service.ts src/app/modules/settings/data-access/activation-api.service.spec.ts
git commit -m "feat: add ActivationApiService for self-service device activation codes"
```

---

### Task 2: ConnectDeviceComponent

**Files:**
- Create: `src/app/modules/settings/feature/connect-device/connect-device.component.ts`
- Create: `src/app/modules/settings/feature/connect-device/connect-device.component.html`
- Create: `src/app/modules/settings/feature/connect-device/connect-device.component.css`
- Test: `src/app/modules/settings/feature/connect-device/connect-device.component.spec.ts`

- [ ] **Step 1: Write the failing test suite**

```ts
// src/app/modules/settings/feature/connect-device/connect-device.component.spec.ts
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ActivationApiService } from '../../data-access/activation-api.service';
import { ConnectDeviceComponent } from './connect-device.component';

describe('ConnectDeviceComponent', () => {
  let fixture: ComponentFixture<ConnectDeviceComponent>;
  let component: ConnectDeviceComponent;
  let activationApi: { generate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    activationApi = { generate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ConnectDeviceComponent],
      providers: [{ provide: ActivationApiService, useValue: activationApi }]
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectDeviceComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the idle state with a Generate Code button and no code', () => {
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('[data-testid="generate-code"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('[data-testid="activation-code"]'))).toBeNull();
  });

  it('generates a code and starts a 10-minute countdown', () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));
    fixture.detectChanges();

    component.generate();
    fixture.detectChanges();

    expect(activationApi.generate).toHaveBeenCalledTimes(1);
    expect(component.code()).toBe('APDBSJNA');
    expect(component.formattedTime()).toBe('10:00');

    const codeEl = fixture.debugElement.query(By.css('[data-testid="activation-code"]'));
    expect(codeEl.nativeElement.textContent.trim()).toBe('APDBSJNA');
  });

  it('copies the code to the clipboard and shows a confirmation that clears after 1.5s', async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true
    });
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));

    fixture.detectChanges();
    component.generate();
    fixture.detectChanges();

    component.copyCode();
    fixture.detectChanges();

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('APDBSJNA');
    expect(component.copied()).toBe(true);

    await vi.advanceTimersByTimeAsync(1500);
    fixture.detectChanges();
    expect(component.copied()).toBe(false);
  });

  it('counts down every second and expires the code at zero', async () => {
    vi.useFakeTimers();
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 2 }));

    fixture.detectChanges();
    component.generate();
    fixture.detectChanges();
    expect(component.secondsRemaining()).toBe(2);

    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(component.secondsRemaining()).toBe(1);
    expect(component.code()).toBe('APDBSJNA');

    await vi.advanceTimersByTimeAsync(1000);
    fixture.detectChanges();
    expect(component.code()).toBeNull();
    expect(component.expired()).toBe(true);
    expect(fixture.debugElement.query(By.css('[data-testid="generate-code"]'))).toBeTruthy();
  });

  it('resets the loading state on error without throwing, and shows no code', () => {
    activationApi.generate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));
    fixture.detectChanges();

    component.generate();
    fixture.detectChanges();

    expect(component.generating()).toBe(false);
    expect(component.code()).toBeNull();
  });

  it('ignores a second generate() call while one is already in flight', () => {
    activationApi.generate.mockReturnValue(of({ code: 'APDBSJNA', expires_in_seconds: 600 }));
    fixture.detectChanges();

    component.generate();
    component.generate();

    expect(activationApi.generate).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --watch=false`
Expected: FAIL — `Cannot find module './connect-device.component'` (file doesn't exist yet).

- [ ] **Step 3: Implement the component TypeScript**

```ts
// src/app/modules/settings/feature/connect-device/connect-device.component.ts
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ActivationApiService } from '../../data-access/activation-api.service';

const COPIED_RESET_MS = 1500;

/**
 * Settings → Devices — self-service activation code for the OneXso Workspace desktop app.
 * Generates a code via ActivationApiService, scoped to the logged-in employee's own account.
 * No device list/revoke UI here — MonitoringActivationController has no list-devices
 * endpoint yet; that is a separate backend + frontend effort (see design spec).
 *
 * Error handling: the global error interceptor + ErrorHandlerService already show a banner
 * notification for every HTTP failure status (429, 5xx, etc. — see error-handler.service.ts).
 * This component only resets its own loading state on error; it does not duplicate that
 * message.
 */
@Component({
  selector: 'app-connect-device',
  standalone: true,
  imports: [BreadcrumbHeaderComponent, ButtonComponent],
  templateUrl: './connect-device.component.html',
  styleUrl: './connect-device.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConnectDeviceComponent implements OnDestroy {
  private readonly activationApi = inject(ActivationApiService);

  readonly generating = signal(false);
  readonly code = signal<string | null>(null);
  readonly secondsRemaining = signal(0);
  readonly expired = signal(false);
  readonly copied = signal(false);

  readonly formattedTime = computed(() => {
    const total = this.secondsRemaining();
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  });

  private countdownId: ReturnType<typeof setInterval> | null = null;
  private copiedResetId: ReturnType<typeof setTimeout> | null = null;

  generate(): void {
    if (this.generating()) {
      return;
    }

    this.generating.set(true);
    this.expired.set(false);
    this.copied.set(false);

    this.activationApi.generate().subscribe({
      next: (response) => {
        this.code.set(response.code);
        this.startCountdown(response.expires_in_seconds);
        this.generating.set(false);
      },
      error: (_error: HttpErrorResponse) => {
        this.generating.set(false);
      }
    });
  }

  copyCode(): void {
    const value = this.code();
    if (!value) {
      return;
    }

    void navigator.clipboard.writeText(value);
    this.copied.set(true);

    if (this.copiedResetId !== null) {
      clearTimeout(this.copiedResetId);
    }
    this.copiedResetId = setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
  }

  ngOnDestroy(): void {
    this.clearCountdown();
    if (this.copiedResetId !== null) {
      clearTimeout(this.copiedResetId);
    }
  }

  private startCountdown(totalSeconds: number): void {
    this.clearCountdown();
    this.secondsRemaining.set(totalSeconds);

    this.countdownId = setInterval(() => {
      const next = this.secondsRemaining() - 1;
      if (next <= 0) {
        this.clearCountdown();
        this.code.set(null);
        this.secondsRemaining.set(0);
        this.expired.set(true);
      } else {
        this.secondsRemaining.set(next);
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownId !== null) {
      clearInterval(this.countdownId);
      this.countdownId = null;
    }
  }
}
```

- [ ] **Step 4: Implement the component template**

```html
<!-- src/app/modules/settings/feature/connect-device/connect-device.component.html -->
<header class="cda-page-header">
  <app-breadcrumb-header parentLabel="Settings" currentLabel="Devices" icon="settings" />
</header>

<section class="cda-card">
  @if (!code()) {
    <h2 class="cda-title">Connect the OneXso Workspace desktop app</h2>
    <p class="cda-description">
      @if (expired()) {
        Code expired — generate a new one.
      } @else {
        Generate a one-time activation code, then paste it into the OneXso Workspace desktop
        app's Connect screen within 10 minutes.
      }
    </p>
    <app-button
      type="button"
      data-testid="generate-code"
      [loading]="generating()"
      [disabled]="generating()"
      (pressed)="generate()"
    >
      Generate Code
    </app-button>
  } @else {
    <p class="cda-description">
      Paste this code into the OneXso Workspace desktop app within 10 minutes.
    </p>
    <div class="cda-code-row">
      <span class="cda-code" data-testid="activation-code">{{ code() }}</span>
      <button type="button" class="cda-copy-btn" data-testid="copy-code" (click)="copyCode()">
        {{ copied() ? 'Copied!' : 'Copy' }}
      </button>
    </div>
    <p class="cda-countdown" data-testid="countdown">Expires in {{ formattedTime() }}</p>
    <app-button
      type="button"
      variant="secondary"
      data-testid="generate-again"
      [loading]="generating()"
      [disabled]="generating()"
      (pressed)="generate()"
    >
      Generate a new code
    </app-button>
  }
</section>
```

- [ ] **Step 5: Implement the component styles**

```css
/* src/app/modules/settings/feature/connect-device/connect-device.component.css */
.cda-page-header {
  margin-top: -1.25rem;
  margin-bottom: 0.75rem;
  padding-bottom: 0.625rem;
  border-bottom: 1px solid var(--color-border);
}

.cda-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 32rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
  border-radius: 12px;
  background: var(--color-surface);
}

.cda-title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.cda-description {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.45;
  color: var(--color-text-secondary);
}

.cda-code-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cda-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--color-text-primary);
}

.cda-copy-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface-secondary);
  color: var(--color-text-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
}

.cda-countdown {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx ng test --watch=false`
Expected: PASS — all 6 `ConnectDeviceComponent` tests green.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/settings/feature/connect-device/
git commit -m "feat: add ConnectDeviceComponent for self-service activation codes"
```

---

### Task 3: Wire the `/settings/devices` route

**Files:**
- Modify: `src/app/app.routes.ts:148` (insert after the `clock-in-policy` block)
- Modify: `src/app/app.routes.spec.ts` (add resolution test)

- [ ] **Step 1: Write the failing route test**

Add to `src/app/app.routes.spec.ts`, right after the existing
`'resolves /settings/bulk-onboarding to BulkOnboardingComponent'` test (around line 43):

```ts
  it('resolves /settings/devices to ConnectDeviceComponent', async () => {
    const success = await router.navigateByUrl('/settings/devices');
    expect(success).toBe(true);
    expect(router.url).toBe('/settings/devices');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --watch=false`
Expected: FAIL — navigation to `/settings/devices` does not resolve (no matching route).

- [ ] **Step 3: Add the route**

In `src/app/app.routes.ts`, insert immediately after the `clock-in-policy` block's closing
`},` (currently line 148) and before `{ path: '', pathMatch: 'full', redirectTo: 'general' }`
(currently line 149):

```ts
          {
            path: 'devices',
            loadComponent: () =>
              import('./modules/settings/feature/connect-device/connect-device.component').then(
                (m) => m.ConnectDeviceComponent
              ),
            canActivate: [permissionGuard],
            data: {
              title: 'Devices',
              modules: ['desktop_agent_gateway']
            }
          },
```

No `permissions` entry: `MonitoringActivationController.Generate` requires only
`TenantPolicy` (any authenticated employee), no specific permission code.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --watch=false`
Expected: PASS — `resolves /settings/devices to ConnectDeviceComponent`.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts src/app/app.routes.spec.ts
git commit -m "feat: wire /settings/devices route to ConnectDeviceComponent"
```

---

### Task 4: Wire the Devices nav entry

**Files:**
- Modify: `src/app/layouts/main-layout/nav/nav-items.config.ts:148-154`
- Modify: `src/app/layouts/main-layout/nav/nav-access.spec.ts` (add gating test)

- [ ] **Step 1: Write the failing nav test**

Add to `src/app/layouts/main-layout/nav/nav-access.spec.ts`, right after the existing
`'settings-clock-in-policy requires time_attendance module and attendance:read'` test
(around line 134):

```ts
  it('settings-devices requires only the desktop_agent_gateway module, no permission code', () => {
    const settings = NAV_ITEMS.find((item) => item.id === 'settings')!;
    const devices = settings.children!.find((item) => item.id === 'settings-devices')!;

    expect(devices.label).toBe('Devices & connections');
    expect(devices.path).toBe('/settings/devices');
    expect(canAccessNavItem(devices, checker([], ['desktop_agent_gateway']))).toBe(true);
    expect(canAccessNavItem(devices, checker([], []))).toBe(false);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --watch=false`
Expected: FAIL — `Cannot read properties of undefined (reading 'label')` (`settings-devices`
does not exist in `NAV_ITEMS` yet).

- [ ] **Step 3: Add the nav entry**

In `src/app/layouts/main-layout/nav/nav-items.config.ts`, replace the current
`settings-clock-in-policy` entry and its trailing comment (currently lines 148-154):

```ts
      {
        id: 'settings-clock-in-policy',
        label: 'Clock-in Policy',
        path: '/settings/clock-in-policy',
        requiredModules: ['time_attendance'],
        requiredPermissions: ['attendance:read']
      },
      {
        id: 'settings-devices',
        label: 'Devices & connections',
        path: '/settings/devices',
        requiredModules: ['desktop_agent_gateway']
      }
      // Audit log is intentionally not listed yet.
    ]
  }
];
```

No `requiredPermissions` entry: matches the route gate in Task 3, and the backend's
`MonitoringActivationController.Generate` endpoint, which requires no specific permission
code — `settings:device` (considered and rejected here) is `PermissionSeeder.cs:166`'s
biometric-hardware-connection-status permission, unrelated to the desktop tray agent.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --watch=false`
Expected: PASS — `settings-devices requires desktop_agent_gateway module and settings:device permission`.

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/main-layout/nav/nav-items.config.ts src/app/layouts/main-layout/nav/nav-access.spec.ts
git commit -m "feat: add Devices & connections nav entry under Settings"
```

---

### Task 5: Full regression run

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npx ng test --watch=false`
Expected: PASS — every existing spec plus the new `ActivationApiService`,
`ConnectDeviceComponent`, route, and nav tests all green, no regressions.

- [ ] **Step 2: Manual smoke check**

Start the dev server (`npm start`), log in as a seeded Acme user
(`siyasiyamala932@gmail.com` / `Password123!`), navigate to Settings → Devices & connections,
click Generate Code, confirm an 8-character code renders with a running countdown, click
Copy, and confirm the button briefly reads "Copied!".

- [ ] **Step 3: Commit (only if the smoke check surfaced a fix)**

```bash
git add -A
git commit -m "fix: <describe whatever the smoke check turned up>"
```
