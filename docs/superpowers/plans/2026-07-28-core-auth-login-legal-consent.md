# Core Auth: Login + Legal Consent Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the `core/` and `shared/` layers of ONEVO HRMS, wire up the full interceptor chain, and build a working login → legal-consent-gate → dashboard flow against the real ASP.NET Core backend at `http://localhost:5139`.

**Architecture:** Domain-driven modular monolith per `ARCHITECTURE.md`. Auth lives entirely in `core/auth/` (not as a lazy `modules/auth/` feature) since it gates every route. State via `@ngrx/signals` signal stores. Cookie-based session auth (`onevo_session`, HttpOnly) with double-submit CSRF (`onevo_csrf`/`onevo_legal_csrf` cookie → `X-CSRF-Token` header). No manual token refresh — ASP.NET Core Cookie Authentication renews the session server-side.

**Tech Stack:** Angular 21.2, TypeScript 5.9, `@ngrx/signals` 21.x, Tailwind CSS v4, RxJS 7.8, vitest (via `@angular/build:unit-test`).

## Global Constraints

- Base API URL (dev): `http://localhost:5139/api/v1`.
- CSRF header is always `X-CSRF-Token`; cookie read is `onevo_csrf` first, else `onevo_legal_csrf`.
- No `/auth/refresh` call — 401 means the session is genuinely gone (or the request was a login attempt), not a signal to refresh-and-retry.
- `/auth/login` and `/auth/me` are exempt from the global 401→redirect interceptor behaviour (login shows its own inline error; the guard handles its own 401 by redirecting).
- All HTTP requests use `withCredentials: true`.
- Full request/response DTOs use `snake_case` field names to match the backend JSON exactly (no camelCase remapping at the HTTP boundary) — the DTO IS the wire shape. Camel-casing happens only in the view model.
- Path aliases: `@core/*`, `@shared/*`, `@modules/*`, `@layouts/*`, `@environments/*` all resolve to `src/<dir>/*`.
- Out of scope for this plan (do not build): the 10 other business modules, MFA/forced-password-change UI, service worker, WebSocket service, circuit breaker, `shared/ui/table`, `shared/ui/modal`.
- Every component/service task includes a passing test using `TestBed` + vitest, run via `npm test`.

---

### Task 1: Clean up the default Angular CLI scaffold

The generated `app.html`/`app.ts`/`app.spec.ts` contain Angular's marketing placeholder. Replace with a minimal shell that just renders the router outlet, so routed pages aren't drawn underneath leftover boilerplate.

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.spec.ts`
- Delete: `src/app/app.css` (empty it — no app-shell-level styles needed once Tailwind is in)

**Interfaces:**
- Produces: `App` component (selector `app-root`) rendering `<router-outlet />` only.

- [ ] **Step 1: Replace `app.html`**

```html
<router-outlet />
```

- [ ] **Step 2: Replace `app.ts`**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
```

- [ ] **Step 3: Empty `app.css`**

Replace file contents with nothing (zero bytes).

- [ ] **Step 4: Replace `app.spec.ts`**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run tests and verify they pass**

Run: `npm test`
Expected: `Test Files 1 passed`, `Tests 2 passed`

- [ ] **Step 6: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/app.css src/app/app.spec.ts
git commit -m "chore: strip default Angular CLI placeholder from app shell"
```

---

### Task 2: Path aliases, environment config, Tailwind CSS, @ngrx/signals

**Files:**
- Modify: `tsconfig.json`
- Create: `src/environments/environment.ts`
- Create: `postcss.config.json`
- Modify: `src/styles.css`
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `environment.apiUrl: string` importable as `@environments/environment`.
- Produces: TS path aliases `@core/*`, `@shared/*`, `@modules/*`, `@layouts/*`, `@environments/*`.

- [ ] **Step 1: Add path aliases to `tsconfig.json`**

Add `"baseUrl": "."` and `"paths"` inside `compilerOptions`:

```json
{
  "compileOnSave": false,
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@core/*": ["src/core/*"],
      "@shared/*": ["src/shared/*"],
      "@modules/*": ["src/modules/*"],
      "@layouts/*": ["src/layouts/*"],
      "@environments/*": ["src/environments/*"]
    },
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "importHelpers": true,
    "target": "ES2022",
    "module": "preserve"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  },
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.spec.json" }
  ]
}
```

- [ ] **Step 2: Create `src/environments/environment.ts`**

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5139/api/v1'
};
```

- [ ] **Step 3: Install `@ngrx/signals`**

Run: `npm install @ngrx/signals`
Expected: adds `@ngrx/signals` (^21.x) to `dependencies` in `package.json`, no peer dependency warnings (verified: `@ngrx/signals@21.1.1` declares `@angular/core: ^21.0.0`, matching this project's `^21.2.0`).

- [ ] **Step 4: Install Tailwind CSS v4**

Run: `npm install -D tailwindcss @tailwindcss/postcss postcss`

- [ ] **Step 5: Create `postcss.config.json`**

```json
{
  "plugins": {
    "@tailwindcss/postcss": {}
  }
}
```

- [ ] **Step 6: Add Tailwind import to `src/styles.css`**

Prepend to the top of the existing file:

```css
@import "tailwindcss";
```

- [ ] **Step 7: Verify the build picks up path aliases and Tailwind**

Run: `npm run build`
Expected: build succeeds with no TS "cannot find module" errors and no postcss errors.

- [ ] **Step 8: Commit**

```bash
git add tsconfig.json src/environments/environment.ts postcss.config.json src/styles.css package.json package-lock.json
git commit -m "feat: add path aliases, dev environment config, Tailwind CSS, and @ngrx/signals"
```

---

### Task 3: Shared — ProblemDetails model

The dev backend returns RFC7807 `application/problem+json` bodies on errors (verified via `curl` against `/api/v1/auth/me` and `/api/v1/auth/login`):
```json
{"type":"...","title":"Unauthorized","status":401,"detail":"Authentication is required to access this resource.","correlationId":"..."}
```

**Files:**
- Create: `src/shared/models/problem-details.model.ts`

**Interfaces:**
- Produces: `ProblemDetails` interface, consumed by `ErrorHandlerService` (Task 10) and `AuthStore` (Task 14).

- [ ] **Step 1: Create the model**

```typescript
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  correlationId?: string;
  traceId?: string;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/models/problem-details.model.ts
git commit -m "feat(shared): add ProblemDetails model matching backend error envelope"
```

---

### Task 4: Shared — email validation helper

**Files:**
- Create: `src/shared/utils/validation.helpers.ts`
- Test: `src/shared/utils/validation.helpers.spec.ts`

**Interfaces:**
- Produces: `isValidEmail(email: string): boolean`, consumed by `LoginComponent` (Task 20, via Angular's built-in `Validators.email` actually — see note in Task 20). Used directly in its own test only for this pass.

- [ ] **Step 1: Write the failing test**

```typescript
import { isValidEmail } from './validation.helpers';

describe('isValidEmail', () => {
  it('accepts a well-formed email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects a string with no @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  it('rejects a string with no domain', () => {
    expect(isValidEmail('user@')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern=validation.helpers`
Expected: FAIL — `Cannot find module './validation.helpers'`

(If that flag isn't supported by the configured test runner, just run `npm test` and confirm the new spec fails while others still collect.)

- [ ] **Step 3: Write the implementation**

```typescript
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all test files pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/validation.helpers.ts src/shared/utils/validation.helpers.spec.ts
git commit -m "feat(shared): add isValidEmail helper"
```

---

### Task 5: Shared UI — LoaderComponent

**Files:**
- Create: `src/shared/ui/loader/loader.component.ts`
- Test: `src/shared/ui/loader/loader.component.spec.ts`

**Interfaces:**
- Produces: `LoaderComponent`, selector `app-loader`, input `label: string` (default `''`). Consumed by `LoginComponent`/`LegalConsentComponent` indirectly via `ButtonComponent`'s own spinner — `LoaderComponent` itself is used standalone wherever a full-block loading state is needed (not required by Task 20/21, but part of the shared kit per the approved design).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { LoaderComponent } from './loader.component';

describe('LoaderComponent', () => {
  it('renders a status role with aria-busy', async () => {
    await TestBed.configureTestingModule({ imports: [LoaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const status = el.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the label when provided', async () => {
    await TestBed.configureTestingModule({ imports: [LoaderComponent] }).compileComponents();
    const fixture = TestBed.createComponent(LoaderComponent);
    fixture.componentRef.setInput('label', 'Loading employees');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Loading employees');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './loader.component'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loader',
  standalone: true,
  template: `
    <div class="flex items-center justify-center gap-2 py-4" role="status" aria-busy="true" [attr.aria-label]="label() || null">
      <div class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
      @if (label()) {
        <span class="text-sm text-slate-600">{{ label() }}</span>
      }
    </div>
  `
})
export class LoaderComponent {
  label = input<string>('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/loader
git commit -m "feat(shared): add LoaderComponent"
```

---

### Task 6: Shared UI — ButtonComponent

**Files:**
- Create: `src/shared/ui/button/button.component.ts`
- Test: `src/shared/ui/button/button.component.spec.ts`

**Interfaces:**
- Produces: `ButtonComponent`, selector `app-button`, type export `ButtonVariant = 'primary' | 'secondary'`, inputs `variant` (default `'primary'`), `type` (default `'button'`), `disabled` (default `false`), `loading` (default `false`), output `pressed: OutputEmitterRef<MouseEvent>`. Consumed by `LoginComponent` (Task 20), `LegalConsentComponent` (Task 21), `MainLayoutComponent` (Task 19).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ButtonComponent } from './button.component';

describe('ButtonComponent', () => {
  it('emits pressed on click', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();

    let emitted = false;
    fixture.componentInstance.pressed.subscribe(() => (emitted = true));

    const button = fixture.debugElement.query(By.css('button'));
    button.nativeElement.click();

    expect(emitted).toBe(true);
  });

  it('disables the native button when disabled is true', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('disables the native button when loading is true', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('defaults to type="button" so it never submits a form by accident', async () => {
    await TestBed.configureTestingModule({ imports: [ButtonComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();
    const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(button.type).toBe('button');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './button.component'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Component, input, output } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary';

@Component({
  selector: 'app-button',
  standalone: true,
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="classes()"
      (click)="pressed.emit($event)"
    >
      @if (loading()) {
        <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
      }
      <ng-content />
    </button>
  `
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  type = input<'button' | 'submit'>('button');
  disabled = input(false);
  loading = input(false);
  pressed = output<MouseEvent>();

  classes(): string {
    const base =
      'inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';
    const variants: Record<ButtonVariant, string> = {
      primary: 'bg-slate-900 text-white hover:bg-slate-700',
      secondary: 'bg-white text-slate-900 border border-slate-300 hover:bg-slate-50'
    };
    return `${base} ${variants[this.variant()]}`;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/button
git commit -m "feat(shared): add ButtonComponent"
```

---

### Task 7: Shared UI — CardComponent

**Files:**
- Create: `src/shared/ui/card/card.component.ts`
- Test: `src/shared/ui/card/card.component.spec.ts`

**Interfaces:**
- Produces: `CardComponent`, selector `app-card`, input `title: string` (default `''`), content projection via `<ng-content />`. Consumed by `LoginComponent` (Task 20), `LegalConsentComponent` (Task 21).

- [ ] **Step 1: Write the failing test**

```typescript
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardComponent } from './card.component';

@Component({
  standalone: true,
  imports: [CardComponent],
  template: `<app-card title="Sign in"><p>body content</p></app-card>`
})
class HostComponent {}

describe('CardComponent', () => {
  it('renders the title and projected content', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Sign in');
    expect(el.textContent).toContain('body content');
  });

  it('omits the heading when no title is given', async () => {
    await TestBed.configureTestingModule({ imports: [CardComponent] }).compileComponents();
    const fixture = TestBed.createComponent(CardComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './card.component'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <section class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      @if (title()) {
        <h2 class="mb-3 text-lg font-semibold text-slate-900">{{ title() }}</h2>
      }
      <ng-content />
    </section>
  `
})
export class CardComponent {
  title = input<string>('');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui/card
git commit -m "feat(shared): add CardComponent"
```

---

### Task 8: Core — LoggerService

**Files:**
- Create: `src/core/services/logger.service.ts`
- Test: `src/core/services/logger.service.spec.ts`

**Interfaces:**
- Produces: `LoggerService` (`providedIn: 'root'`) with `error(message: string, context?: Record<string, unknown>): void` and `warn(message: string, context?: Record<string, unknown>): void`. Consumed by `ErrorHandlerService` (Task 10).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  it('forwards error() to console.error with context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const service = TestBed.inject(LoggerService);

    service.error('boom', { url: '/api/v1/thing' });

    expect(spy).toHaveBeenCalledWith('boom', { url: '/api/v1/thing' });
    spy.mockRestore();
  });

  it('forwards warn() to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const service = TestBed.inject(LoggerService);

    service.warn('careful');

    expect(spy).toHaveBeenCalledWith('careful', {});
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './logger.service'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  error(message: string, context: Record<string, unknown> = {}): void {
    console.error(message, context);
  }

  warn(message: string, context: Record<string, unknown> = {}): void {
    console.warn(message, context);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/logger.service.ts src/core/services/logger.service.spec.ts
git commit -m "feat(core): add LoggerService"
```

---

### Task 9: Core — NotificationService

**Files:**
- Create: `src/core/services/notification.service.ts`
- Test: `src/core/services/notification.service.spec.ts`

**Interfaces:**
- Produces: `NotificationService` (`providedIn: 'root'`), `Notification` interface `{ id: number; kind: 'error' | 'success' | 'info'; message: string }`, `notifications: Signal<Notification[]>`, `error(message: string): void`, `success(message: string): void`, `dismiss(id: number): void`. Consumed by `ErrorHandlerService` (Task 10).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  it('adds an error notification', () => {
    const service = TestBed.inject(NotificationService);
    service.error('Something broke');
    expect(service.notifications()).toEqual([{ id: expect.any(Number), kind: 'error', message: 'Something broke' }]);
  });

  it('adds a success notification', () => {
    const service = TestBed.inject(NotificationService);
    service.success('Saved');
    expect(service.notifications()[0].kind).toBe('success');
  });

  it('dismisses a notification by id', () => {
    const service = TestBed.inject(NotificationService);
    service.error('First');
    service.error('Second');
    const [first] = service.notifications();

    service.dismiss(first.id);

    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0].message).toBe('Second');
  });

  it('assigns increasing unique ids across calls', () => {
    const service = TestBed.inject(NotificationService);
    service.error('A');
    service.error('B');
    const [a, b] = service.notifications();
    expect(b.id).toBeGreaterThan(a.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './notification.service'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  kind: 'error' | 'success' | 'info';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  notifications = signal<Notification[]>([]);
  private nextId = 0;

  error(message: string): void {
    this.push('error', message);
  }

  success(message: string): void {
    this.push('success', message);
  }

  dismiss(id: number): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private push(kind: Notification['kind'], message: string): void {
    const notification: Notification = { id: this.nextId++, kind, message };
    this.notifications.update((list) => [...list, notification]);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/notification.service.ts src/core/services/notification.service.spec.ts
git commit -m "feat(core): add NotificationService"
```

---

### Task 10: Core — ErrorHandlerService (error taxonomy)

**Files:**
- Create: `src/core/services/error-handler.service.ts`
- Test: `src/core/services/error-handler.service.spec.ts`

**Interfaces:**
- Consumes: `NotificationService.error()` (Task 9), `LoggerService.error()` (Task 8).
- Produces: `ErrorHandlerService` (`providedIn: 'root'`) with `handle(error: HttpErrorResponse): void`. Consumed by `error.interceptor.ts` (Task 16).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandlerService } from './error-handler.service';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';

describe('ErrorHandlerService', () => {
  function makeError(status: number): HttpErrorResponse {
    return new HttpErrorResponse({ status, url: '/api/v1/employees' });
  }

  it('shows a banner for a 500', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(500));

    expect(notify.notifications()[0].message).toBe('Something went wrong. Please try again.');
  });

  it('does not show a banner for a 401 (silent)', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(401));

    expect(notify.notifications()).toHaveLength(0);
  });

  it('does not show a banner for a 404 (inline)', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(404));

    expect(notify.notifications()).toHaveLength(0);
  });

  it('shows the offline banner for status 0', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(0));

    expect(notify.notifications()[0].message).toBe('You appear to be offline.');
  });

  it('logs every error regardless of behaviour', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const logger = TestBed.inject(LoggerService);
    const spy = vi.spyOn(logger, 'error');

    service.handle(makeError(404));

    expect(spy).toHaveBeenCalledWith('[HTTP 404]', { url: '/api/v1/employees', event: 'resource_not_found' });
  });

  it('falls back to a generic banner for an unmapped status', () => {
    const service = TestBed.inject(ErrorHandlerService);
    const notify = TestBed.inject(NotificationService);

    service.handle(makeError(418));

    expect(notify.notifications()[0].message).toBe('An unexpected error occurred.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './error-handler.service'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NotificationService } from './notification.service';
import { LoggerService } from './logger.service';

type ErrorBehaviour = 'banner' | 'inline' | 'silent';

interface ErrorAction {
  userMessage: string;
  behaviour: ErrorBehaviour;
  telemetryEvent: string;
}

const ERROR_TAXONOMY: Record<number, ErrorAction> = {
  401: { userMessage: '', behaviour: 'silent', telemetryEvent: 'auth_session_expired' },
  403: { userMessage: "You don't have access to this.", behaviour: 'banner', telemetryEvent: 'auth_forbidden' },
  404: { userMessage: 'This record no longer exists.', behaviour: 'inline', telemetryEvent: 'resource_not_found' },
  409: {
    userMessage: 'This record was just updated by someone else. Please refresh.',
    behaviour: 'inline',
    telemetryEvent: 'data_conflict'
  },
  422: { userMessage: 'Please check the highlighted fields.', behaviour: 'inline', telemetryEvent: 'validation_error' },
  429: { userMessage: 'Too many requests. Please wait a moment.', behaviour: 'banner', telemetryEvent: 'rate_limited' },
  500: { userMessage: 'Something went wrong. Please try again.', behaviour: 'banner', telemetryEvent: 'server_error' },
  503: { userMessage: 'Service temporarily unavailable.', behaviour: 'banner', telemetryEvent: 'service_unavailable' },
  0: { userMessage: 'You appear to be offline.', behaviour: 'banner', telemetryEvent: 'network_offline' }
};

const DEFAULT_ACTION: ErrorAction = {
  userMessage: 'An unexpected error occurred.',
  behaviour: 'banner',
  telemetryEvent: 'unknown_error'
};

@Injectable({ providedIn: 'root' })
export class ErrorHandlerService {
  private notify = inject(NotificationService);
  private logger = inject(LoggerService);

  handle(error: HttpErrorResponse): void {
    const action = ERROR_TAXONOMY[error.status] ?? DEFAULT_ACTION;

    this.logger.error(`[HTTP ${error.status}]`, { url: error.url ?? undefined, event: action.telemetryEvent });

    if (action.behaviour === 'banner') {
      this.notify.error(action.userMessage);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/services/error-handler.service.ts src/core/services/error-handler.service.spec.ts
git commit -m "feat(core): add ErrorHandlerService with HTTP error taxonomy"
```

---

### Task 11: Core — correlation.interceptor

**Files:**
- Create: `src/core/interceptors/correlation.interceptor.ts`
- Test: `src/core/interceptors/correlation.interceptor.spec.ts`

**Interfaces:**
- Produces: `correlationInterceptor: HttpInterceptorFn`. Registered in `app.config.ts` (Task 18).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { correlationInterceptor } from './correlation.interceptor';

describe('correlationInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([correlationInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches an X-Correlation-ID header shaped like a UUID v4', () => {
    http.get('/api/v1/ping').subscribe();
    const req = httpMock.expectOne('/api/v1/ping');
    const id = req.request.headers.get('X-Correlation-ID');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    req.flush({});
  });

  it('attaches a different id to each request', () => {
    http.get('/api/v1/a').subscribe();
    http.get('/api/v1/b').subscribe();
    const [reqA] = httpMock.match('/api/v1/a');
    const [reqB] = httpMock.match('/api/v1/b');
    expect(reqA.request.headers.get('X-Correlation-ID')).not.toBe(reqB.request.headers.get('X-Correlation-ID'));
    reqA.flush({});
    reqB.flush({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './correlation.interceptor'`

- [ ] **Step 3: Write the implementation**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ setHeaders: { 'X-Correlation-ID': uuid() } }));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/interceptors/correlation.interceptor.ts src/core/interceptors/correlation.interceptor.spec.ts
git commit -m "feat(core): add correlation ID interceptor"
```

---

### Task 12: Core — auth DTOs, view model, and mapper

**Files:**
- Create: `src/core/auth/models/dto/login-request.dto.ts`
- Create: `src/core/auth/models/dto/legal-document.dto.ts`
- Create: `src/core/auth/models/dto/auth-response.dto.ts`
- Create: `src/core/auth/models/dto/legal-acceptance-request.dto.ts`
- Create: `src/core/auth/models/view/current-user.view-model.ts`
- Create: `src/core/auth/utils/auth.mapper.ts`
- Test: `src/core/auth/utils/auth.mapper.spec.ts`

**Interfaces:**
- Produces: `LoginRequestDto`, `LegalDocumentDto`, `AuthResponseDto`, `LegalAcceptanceRequestDto`, `LegalAcceptanceDecisionDto`, `CurrentUserViewModel`, `toCurrentUserViewModel(dto: AuthResponseDto): CurrentUserViewModel`. Consumed by `AuthApiService` (Task 13) and `AuthStore` (Task 14).

- [ ] **Step 1: Create the request/response DTOs**

`src/core/auth/models/dto/login-request.dto.ts`:
```typescript
export interface LoginRequestDto {
  email: string;
  password: string;
}
```

`src/core/auth/models/dto/legal-document.dto.ts`:
```typescript
export interface LegalDocumentDto {
  document_type: string;
  version: string;
  title: string;
  effective_at: string;
  content_url: string | null;
}
```

`src/core/auth/models/dto/auth-response.dto.ts`:
```typescript
import { LegalDocumentDto } from './legal-document.dto';

export interface AuthResponseDto {
  authenticated: boolean;
  user: { email: string };
  permissions: string[];
  active_modules: string[];
  must_change_password: boolean;
  mfa_required: boolean;
  legal_acceptance_required: boolean;
  pending_legal_documents: LegalDocumentDto[] | null;
  expires_at: string | null;
  continue_url: string | null;
}
```

`src/core/auth/models/dto/legal-acceptance-request.dto.ts`:
```typescript
export interface LegalAcceptanceDecisionDto {
  document_type: string;
  version: string;
  decision: 'accepted' | 'declined';
}

export interface LegalAcceptanceRequestDto {
  acceptances: LegalAcceptanceDecisionDto[];
}
```

- [ ] **Step 2: Create the view model**

`src/core/auth/models/view/current-user.view-model.ts`:
```typescript
import { LegalDocumentDto } from '../dto/legal-document.dto';

export interface CurrentUserViewModel {
  email: string;
  permissions: string[];
  activeModules: string[];
  authenticated: boolean;
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
}
```

- [ ] **Step 3: Write the failing mapper test**

```typescript
import { toCurrentUserViewModel } from './auth.mapper';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

describe('toCurrentUserViewModel', () => {
  it('maps a fully authenticated response', () => {
    const dto: AuthResponseDto = {
      authenticated: true,
      user: { email: 'siyasiyamala932@gmail.com' },
      permissions: ['integrations:manage'],
      active_modules: ['integrations', 'work_management'],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: false,
      pending_legal_documents: null,
      expires_at: '2026-07-28T09:36:39.2098104+00:00',
      continue_url: null
    };

    expect(toCurrentUserViewModel(dto)).toEqual({
      email: 'siyasiyamala932@gmail.com',
      permissions: ['integrations:manage'],
      activeModules: ['integrations', 'work_management'],
      authenticated: true,
      legalAcceptanceRequired: false,
      pendingLegalDocuments: []
    });
  });

  it('maps a pending-legal-acceptance response', () => {
    const dto: AuthResponseDto = {
      authenticated: false,
      user: { email: 'siyasiyamala932@gmail.com' },
      permissions: [],
      active_modules: [],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: true,
      pending_legal_documents: [
        { document_type: 'privacy_notice', version: '1.0', title: 'ONEVO Privacy Notice', effective_at: '2026-07-28T08:55:29.331905+00:00', content_url: null }
      ],
      expires_at: null,
      continue_url: 'http://localhost:5139/api/v1/legal/acceptances/complete-login'
    };

    const view = toCurrentUserViewModel(dto);

    expect(view.authenticated).toBe(false);
    expect(view.legalAcceptanceRequired).toBe(true);
    expect(view.pendingLegalDocuments).toHaveLength(1);
    expect(view.pendingLegalDocuments[0].document_type).toBe('privacy_notice');
  });

  it('defaults pendingLegalDocuments to an empty array when null', () => {
    const dto: AuthResponseDto = {
      authenticated: true,
      user: { email: 'a@b.com' },
      permissions: [],
      active_modules: [],
      must_change_password: false,
      mfa_required: false,
      legal_acceptance_required: false,
      pending_legal_documents: null,
      expires_at: null,
      continue_url: null
    };

    expect(toCurrentUserViewModel(dto).pendingLegalDocuments).toEqual([]);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth.mapper'`

- [ ] **Step 5: Write the mapper implementation**

`src/core/auth/utils/auth.mapper.ts`:
```typescript
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { CurrentUserViewModel } from '../models/view/current-user.view-model';

export function toCurrentUserViewModel(dto: AuthResponseDto): CurrentUserViewModel {
  return {
    email: dto.user.email,
    permissions: dto.permissions,
    activeModules: dto.active_modules,
    authenticated: dto.authenticated,
    legalAcceptanceRequired: dto.legal_acceptance_required,
    pendingLegalDocuments: dto.pending_legal_documents ?? []
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/auth/models src/core/auth/utils
git commit -m "feat(core/auth): add auth DTOs, view model, and mapper"
```

---

### Task 13: Core — AuthApiService

**Files:**
- Create: `src/core/auth/data-access/auth-api.service.ts`
- Test: `src/core/auth/data-access/auth-api.service.spec.ts`

**Interfaces:**
- Consumes: `LoginRequestDto`, `AuthResponseDto`, `LegalAcceptanceRequestDto` (Task 12), `environment.apiUrl` (Task 2).
- Produces: `AuthApiService` (`providedIn: 'root'`) with `login(payload: LoginRequestDto): Observable<AuthResponseDto>`, `acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Observable<AuthResponseDto>`, `me(): Observable<AuthResponseDto>`, `logout(): Observable<void>`. Consumed by `AuthStore` (Task 14).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService } from './auth-api.service';
import { environment } from '@environments/environment';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpMock: HttpTestingController;

  const sampleResponse: AuthResponseDto = {
    authenticated: true,
    user: { email: 'a@b.com' },
    permissions: [],
    active_modules: [],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: null,
    continue_url: null
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AuthApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('POSTs credentials to /auth/login', () => {
    service.login({ email: 'a@b.com', password: 'secret' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', password: 'secret' });
    req.flush(sampleResponse);
  });

  it('POSTs acceptances to /legal/acceptances/complete-login', () => {
    const payload = { acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' as const }] };
    service.acceptLegalDocuments(payload).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/legal/acceptances/complete-login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(sampleResponse);
  });

  it('GETs /auth/me', () => {
    service.me().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
    expect(req.request.method).toBe('GET');
    req.flush(sampleResponse);
  });

  it('POSTs to /auth/logout', () => {
    service.logout().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth-api.service'`

- [ ] **Step 3: Write the implementation**

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { AuthResponseDto } from '../models/dto/auth-response.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);
  private authBase = `${environment.apiUrl}/auth`;

  login(payload: LoginRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${this.authBase}/login`, payload);
  }

  acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Observable<AuthResponseDto> {
    return this.http.post<AuthResponseDto>(`${environment.apiUrl}/legal/acceptances/complete-login`, payload);
  }

  /**
   * Provisional: the real /auth/me success-response contract hasn't been confirmed beyond
   * the 401-when-unauthenticated behaviour verified against the dev backend. Adjust the
   * response type here if the authenticated shape differs from AuthResponseDto.
   */
  me(): Observable<AuthResponseDto> {
    return this.http.get<AuthResponseDto>(`${this.authBase}/me`);
  }

  /** Provisional: real /auth/logout contract not yet confirmed. Adjust once known. */
  logout(): Observable<void> {
    return this.http.post<void>(`${this.authBase}/logout`, {});
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/data-access
git commit -m "feat(core/auth): add AuthApiService"
```

---

### Task 14: Core — AuthStore (signal store)

**Files:**
- Create: `src/core/auth/state/auth.store.ts`
- Test: `src/core/auth/state/auth.store.spec.ts`

**Interfaces:**
- Consumes: `AuthApiService` (Task 13), `toCurrentUserViewModel` (Task 12).
- Produces: `AuthStore` (`providedIn: 'root'`, `@ngrx/signals` store) with state signals `authenticated: Signal<boolean>`, `email: Signal<string | null>`, `permissions: Signal<string[]>`, `activeModules: Signal<string[]>`, `legalAcceptanceRequired: Signal<boolean>`, `pendingLegalDocuments: Signal<LegalDocumentDto[]>`, `loading: Signal<boolean>`, `error: Signal<string | null>`, and methods `login(payload: LoginRequestDto): Promise<void>`, `acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Promise<void>`, `checkSession(): Promise<boolean>`, `logout(): Promise<void>`, `clearSession(): void`. Consumed by `error.interceptor` (Task 16), `auth.guard` (Task 17), `LoginComponent` (Task 20), `LegalConsentComponent` (Task 21), `MainLayoutComponent` (Task 19).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { AuthApiService } from '../data-access/auth-api.service';
import { AuthResponseDto } from '../models/dto/auth-response.dto';

describe('AuthStore', () => {
  const authenticatedDto: AuthResponseDto = {
    authenticated: true,
    user: { email: 'a@b.com' },
    permissions: ['integrations:manage'],
    active_modules: ['integrations'],
    must_change_password: false,
    mfa_required: false,
    legal_acceptance_required: false,
    pending_legal_documents: null,
    expires_at: '2026-07-28T09:36:39Z',
    continue_url: null
  };

  const pendingLegalDto: AuthResponseDto = {
    ...authenticatedDto,
    authenticated: false,
    permissions: [],
    active_modules: [],
    legal_acceptance_required: true,
    pending_legal_documents: [
      { document_type: 'privacy_notice', version: '1.0', title: 'Privacy Notice', effective_at: '2026-07-28T08:55:29Z', content_url: null }
    ]
  };

  function setup(apiOverrides: Partial<AuthApiService> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthApiService, useValue: apiOverrides }]
    });
    return TestBed.inject(AuthStore);
  }

  it('populates state on successful login', async () => {
    const store = setup({ login: () => of(authenticatedDto) } as Partial<AuthApiService>);

    await store.login({ email: 'a@b.com', password: 'secret' });

    expect(store.authenticated()).toBe(true);
    expect(store.email()).toBe('a@b.com');
    expect(store.permissions()).toEqual(['integrations:manage']);
    expect(store.loading()).toBe(false);
  });

  it('surfaces legalAcceptanceRequired and pendingLegalDocuments when login is gated', async () => {
    const store = setup({ login: () => of(pendingLegalDto) } as Partial<AuthApiService>);

    await store.login({ email: 'a@b.com', password: 'secret' });

    expect(store.authenticated()).toBe(false);
    expect(store.legalAcceptanceRequired()).toBe(true);
    expect(store.pendingLegalDocuments()).toHaveLength(1);
  });

  it('sets a friendly error message from the ProblemDetails body on failed login', async () => {
    const httpError = { error: { detail: 'Invalid email or password.' } };
    const store = setup({ login: () => throwError(() => httpError) } as Partial<AuthApiService>);

    await expect(store.login({ email: 'a@b.com', password: 'wrong' })).rejects.toBeTruthy();

    expect(store.error()).toBe('Invalid email or password.');
    expect(store.loading()).toBe(false);
  });

  it('populates state after accepting legal documents', async () => {
    const store = setup({ acceptLegalDocuments: () => of(authenticatedDto) } as Partial<AuthApiService>);

    await store.acceptLegalDocuments({ acceptances: [{ document_type: 'privacy_notice', version: '1.0', decision: 'accepted' }] });

    expect(store.authenticated()).toBe(true);
    expect(store.legalAcceptanceRequired()).toBe(false);
  });

  it('checkSession returns true and hydrates state when /auth/me succeeds', async () => {
    const store = setup({ me: () => of(authenticatedDto) } as Partial<AuthApiService>);

    const result = await store.checkSession();

    expect(result).toBe(true);
    expect(store.email()).toBe('a@b.com');
  });

  it('checkSession returns false and resets state when /auth/me fails', async () => {
    const store = setup({ me: () => throwError(() => new Error('401')) } as Partial<AuthApiService>);

    const result = await store.checkSession();

    expect(result).toBe(false);
    expect(store.authenticated()).toBe(false);
  });

  it('clearSession resets to initial state', async () => {
    const store = setup({ login: () => of(authenticatedDto) } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    store.clearSession();

    expect(store.authenticated()).toBe(false);
    expect(store.email()).toBeNull();
  });

  it('logout calls the API then clears session even if the API call rejects', async () => {
    const store = setup({ login: () => of(authenticatedDto), logout: () => throwError(() => new Error('network')) } as Partial<AuthApiService>);
    await store.login({ email: 'a@b.com', password: 'secret' });

    await store.logout();

    expect(store.authenticated()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth.store'`

- [ ] **Step 3: Write the implementation**

```typescript
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthApiService } from '../data-access/auth-api.service';
import { LoginRequestDto } from '../models/dto/login-request.dto';
import { LegalAcceptanceRequestDto } from '../models/dto/legal-acceptance-request.dto';
import { LegalDocumentDto } from '../models/dto/legal-document.dto';
import { toCurrentUserViewModel } from '../utils/auth.mapper';

type AuthState = {
  authenticated: boolean;
  email: string | null;
  permissions: string[];
  activeModules: string[];
  legalAcceptanceRequired: boolean;
  pendingLegalDocuments: LegalDocumentDto[];
  loading: boolean;
  error: string | null;
};

const initialState: AuthState = {
  authenticated: false,
  email: null,
  permissions: [],
  activeModules: [],
  legalAcceptanceRequired: false,
  pendingLegalDocuments: [],
  loading: false,
  error: null
};

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { detail?: string } }).error;
    if (body?.detail) return body.detail;
  }
  return fallback;
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>(initialState),
  withMethods((store, api = inject(AuthApiService)) => ({
    async login(payload: LoginRequestDto): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dto = await firstValueFrom(api.login(payload));
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          permissions: view.permissions,
          activeModules: view.activeModules,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          loading: false
        });
      } catch (err) {
        patchState(store, { loading: false, error: extractErrorMessage(err, 'Invalid email or password.') });
        throw err;
      }
    },

    async acceptLegalDocuments(payload: LegalAcceptanceRequestDto): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const dto = await firstValueFrom(api.acceptLegalDocuments(payload));
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          permissions: view.permissions,
          activeModules: view.activeModules,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          loading: false
        });
      } catch (err) {
        patchState(store, {
          loading: false,
          error: extractErrorMessage(err, 'Could not save your acceptance. Please try again.')
        });
        throw err;
      }
    },

    async checkSession(): Promise<boolean> {
      patchState(store, { loading: true });
      try {
        const dto = await firstValueFrom(api.me());
        const view = toCurrentUserViewModel(dto);
        patchState(store, {
          authenticated: view.authenticated,
          email: view.email,
          permissions: view.permissions,
          activeModules: view.activeModules,
          legalAcceptanceRequired: view.legalAcceptanceRequired,
          pendingLegalDocuments: view.pendingLegalDocuments,
          loading: false
        });
        return view.authenticated;
      } catch {
        patchState(store, { ...initialState, loading: false });
        return false;
      }
    },

    async logout(): Promise<void> {
      try {
        await firstValueFrom(api.logout());
      } catch {
        // Session is treated as gone client-side regardless of logout call outcome.
      } finally {
        patchState(store, initialState);
      }
    },

    clearSession(): void {
      patchState(store, initialState);
    }
  }))
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/auth/state
git commit -m "feat(core/auth): add AuthStore signal store"
```

---

### Task 15: Core — auth.interceptor and csrf.interceptor

**Files:**
- Create: `src/core/interceptors/auth.interceptor.ts`
- Create: `src/core/interceptors/csrf.interceptor.ts`
- Test: `src/core/interceptors/auth.interceptor.spec.ts`
- Test: `src/core/interceptors/csrf.interceptor.spec.ts`

**Interfaces:**
- Produces: `authInterceptor: HttpInterceptorFn`, `csrfInterceptor: HttpInterceptorFn`. Registered in `app.config.ts` (Task 18).

- [ ] **Step 1: Write the failing auth.interceptor test**

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  it('sets withCredentials true on every request', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });
    const http = TestBed.inject(HttpClient);
    const httpMock = TestBed.inject(HttpTestingController);

    http.get('/api/v1/ping').subscribe();

    const req = httpMock.expectOne('/api/v1/ping');
    expect(req.request.withCredentials).toBe(true);
    req.flush({});
    httpMock.verify();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth.interceptor'`

- [ ] **Step 3: Write auth.interceptor implementation**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ withCredentials: true }));
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Write the failing csrf.interceptor test**

```typescript
import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { csrfInterceptor } from './csrf.interceptor';

describe('csrfInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let document: Document;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([csrfInterceptor])), provideHttpClientTesting()]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.cookie = 'onevo_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = 'onevo_legal_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    httpMock.verify();
  });

  it('sets X-CSRF-Token from onevo_csrf on a POST', () => {
    document.cookie = 'onevo_csrf=full-session-token';

    http.post('/api/v1/employees', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/employees');
    expect(req.request.headers.get('X-CSRF-Token')).toBe('full-session-token');
    req.flush({});
  });

  it('falls back to onevo_legal_csrf when onevo_csrf is absent', () => {
    document.cookie = 'onevo_legal_csrf=pending-consent-token';

    http.post('/api/v1/legal/acceptances/complete-login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/legal/acceptances/complete-login');
    expect(req.request.headers.get('X-CSRF-Token')).toBe('pending-consent-token');
    req.flush({});
  });

  it('does not set the header on a GET', () => {
    document.cookie = 'onevo_csrf=full-session-token';

    http.get('/api/v1/employees').subscribe();

    const req = httpMock.expectOne('/api/v1/employees');
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({});
  });

  it('sends no header when neither cookie is present', () => {
    http.post('/api/v1/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/v1/auth/login');
    expect(req.request.headers.has('X-CSRF-Token')).toBe(false);
    req.flush({});
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './csrf.interceptor'`

- [ ] **Step 7: Write csrf.interceptor implementation**

```typescript
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE_NAMES = ['onevo_csrf', 'onevo_legal_csrf'];
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

function readCsrfToken(document: Document): string | null {
  const cookies = document.cookie.split(';').map((c) => c.trim());
  for (const name of CSRF_COOKIE_NAMES) {
    const match = cookies.find((c) => c.startsWith(`${name}=`));
    if (match) {
      return decodeURIComponent(match.slice(name.length + 1));
    }
  }
  return null;
}

export const csrfInterceptor: HttpInterceptorFn = (req, next) => {
  if (SAFE_METHODS.includes(req.method)) {
    return next(req);
  }

  const document = inject(DOCUMENT);
  const token = readCsrfToken(document);

  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { [CSRF_HEADER]: token } }));
};
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/core/interceptors/auth.interceptor.ts src/core/interceptors/auth.interceptor.spec.ts src/core/interceptors/csrf.interceptor.ts src/core/interceptors/csrf.interceptor.spec.ts
git commit -m "feat(core): add auth and CSRF interceptors"
```

---

### Task 16: Core — error.interceptor (retry/backoff + 401 handling)

**Files:**
- Create: `src/core/interceptors/error.interceptor.ts`
- Test: `src/core/interceptors/error.interceptor.spec.ts`

**Interfaces:**
- Consumes: `AuthStore.clearSession()` (Task 14), `ErrorHandlerService.handle()` (Task 10), Angular `Router`.
- Produces: `errorInterceptor: HttpInterceptorFn`. Registered in `app.config.ts` (Task 18).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { AuthStore } from '../auth/state/auth.store';
import { NotificationService } from '../services/notification.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;
  let authStore: InstanceType<typeof AuthStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    authStore = TestBed.inject(AuthStore);
  });

  afterEach(() => httpMock.verify());

  it('retries a 500 three times with backoff before failing', fakeAsync(() => {
    let errored = false;
    http.get('/api/v1/employees').subscribe({ error: () => (errored = true) });

    for (let i = 0; i < 4; i++) {
      const req = httpMock.expectOne('/api/v1/employees');
      req.flush({}, { status: 500, statusText: 'Server Error' });
      tick(1000);
    }

    expect(errored).toBe(true);
  }));

  it('does not retry a 404', () => {
    let errored = false;
    http.get('/api/v1/employees/9').subscribe({ error: () => (errored = true) });

    const req = httpMock.expectOne('/api/v1/employees/9');
    req.flush({}, { status: 404, statusText: 'Not Found' });

    expect(errored).toBe(true);
  });

  it('clears the session and redirects to /login on a 401 from a protected endpoint', () => {
    const clearSpy = vi.spyOn(authStore, 'clearSession');
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.get('/api/v1/employees').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/employees');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(clearSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });

  it('does not redirect on a 401 from /auth/login (invalid credentials)', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.post('/api/v1/auth/login', {}).subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/auth/login');
    req.flush({ detail: 'Invalid email or password.' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('does not redirect on a 401 from /auth/me (guard handles it itself)', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');

    http.get('/api/v1/auth/me').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/auth/me');
    req.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('forwards a 403 to ErrorHandlerService for banner display', () => {
    const notify = TestBed.inject(NotificationService);

    http.get('/api/v1/employees').subscribe({ error: () => {} });
    const req = httpMock.expectOne('/api/v1/employees');
    req.flush({}, { status: 403, statusText: 'Forbidden' });

    expect(notify.notifications()[0].message).toBe("You don't have access to this.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './error.interceptor'`

- [ ] **Step 3: Write the implementation**

```typescript
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, retry, throwError, timer } from 'rxjs';
import { AuthStore } from '../auth/state/auth.store';
import { ErrorHandlerService } from '../services/error-handler.service';

const RETRY_DELAYS_MS = [250, 500, 1000];
const SESSION_EXEMPT_PATH_FRAGMENTS = ['/auth/login', '/auth/me'];

function isSessionExempt(url: string): boolean {
  return SESSION_EXEMPT_PATH_FRAGMENTS.some((fragment) => url.includes(fragment));
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authStore = inject(AuthStore);
  const errorHandler = inject(ErrorHandlerService);

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error: HttpErrorResponse, attempt: number) => {
        if (error.status >= 500 || error.status === 0) {
          return timer(RETRY_DELAYS_MS[attempt - 1] ?? 1000);
        }
        throw error;
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isSessionExempt(req.url)) {
        authStore.clearSession();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      errorHandler.handle(error);
      return throwError(() => error);
    })
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/interceptors/error.interceptor.ts src/core/interceptors/error.interceptor.spec.ts
git commit -m "feat(core): add error interceptor with retry/backoff and scoped 401 handling"
```

---

### Task 17: Core — auth.guard

**Files:**
- Create: `src/core/guards/auth.guard.ts`
- Test: `src/core/guards/auth.guard.spec.ts`

**Interfaces:**
- Consumes: `AuthStore.checkSession()` (Task 14).
- Produces: `authGuard: CanActivateFn`. Used in `app.routes.ts` (Task 22).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthStore } from '../auth/state/auth.store';

describe('authGuard', () => {
  function runGuard() {
    return TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
  }

  it('allows navigation when checkSession resolves true', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(true) } }]
    });

    const result = await runGuard();

    expect(result).toBe(true);
  });

  it('redirects to /login and denies navigation when checkSession resolves false', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthStore, useValue: { checkSession: () => Promise.resolve(false) } }]
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    const result = await runGuard();

    expect(result).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth.guard'`

- [ ] **Step 3: Write the implementation**

```typescript
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/state/auth.store';

export const authGuard: CanActivateFn = async () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const authenticated = await authStore.checkSession();
  if (authenticated) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/guards
git commit -m "feat(core): add authGuard"
```

---

### Task 18: Wire interceptors and providers into app.config.ts

**Files:**
- Modify: `src/app/app.config.ts`

**Interfaces:**
- Consumes: `authInterceptor`, `correlationInterceptor`, `csrfInterceptor` (Task 15/11), `errorInterceptor` (Task 16).

- [ ] **Step 1: Update `app.config.ts`**

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { correlationInterceptor } from '@core/interceptors/correlation.interceptor';
import { csrfInterceptor } from '@core/interceptors/csrf.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, correlationInterceptor, csrfInterceptor, errorInterceptor])
    )
  ]
};
```

- [ ] **Step 2: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all tests still pass (this task has no new spec — it's covered by each interceptor's own tests plus the build check).

- [ ] **Step 4: Commit**

```bash
git add src/app/app.config.ts
git commit -m "feat: register auth/correlation/csrf/error interceptors in app config"
```

---

### Task 19: Layouts — AuthLayoutComponent and MainLayoutComponent

**Files:**
- Create: `src/layouts/auth-layout/auth-layout.component.ts`
- Create: `src/layouts/main-layout/main-layout.component.ts`
- Test: `src/layouts/auth-layout/auth-layout.component.spec.ts`
- Test: `src/layouts/main-layout/main-layout.component.spec.ts`

**Interfaces:**
- Consumes: `AuthStore` (Task 14), `ButtonComponent` (Task 6).
- Produces: `AuthLayoutComponent` (selector `app-auth-layout`), `MainLayoutComponent` (selector `app-main-layout`). Used in `app.routes.ts` (Task 22).

- [ ] **Step 1: Write the failing AuthLayoutComponent test**

```typescript
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthLayoutComponent } from './auth-layout.component';

describe('AuthLayoutComponent', () => {
  it('renders a router outlet inside a centered shell', async () => {
    await TestBed.configureTestingModule({
      imports: [AuthLayoutComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    const fixture = TestBed.createComponent(AuthLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './auth-layout.component'`

- [ ] **Step 3: Write AuthLayoutComponent implementation**

```typescript
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div class="w-full max-w-md">
        <router-outlet />
      </div>
    </div>
  `
})
export class AuthLayoutComponent {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Write the failing MainLayoutComponent test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthStore } from '@core/auth/state/auth.store';

describe('MainLayoutComponent', () => {
  it('shows the signed-in user email', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { email: () => 'a@b.com', logout: () => Promise.resolve() } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('a@b.com');
  });

  it('calls AuthStore.logout and navigates to /login on sign out', async () => {
    const logoutSpy = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: { email: () => 'a@b.com', logout: logoutSpy } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await fixture.componentInstance.signOut();

    expect(logoutSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './main-layout.component'`

- [ ] **Step 7: Write MainLayoutComponent implementation**

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@core/auth/state/auth.store';
import { ButtonComponent } from '@shared/ui/button/button.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    <div class="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 class="text-2xl font-semibold text-slate-900">Welcome, {{ store.email() }}</h1>
      <p class="mt-2 text-slate-500">You're signed in to ONEVO HRMS.</p>
      <div class="mt-6 inline-block">
        <app-button variant="secondary" (pressed)="signOut()">Sign out</app-button>
      </div>
    </div>
  `
})
export class MainLayoutComponent {
  store = inject(AuthStore);
  private router = inject(Router);

  async signOut(): Promise<void> {
    await this.store.logout();
    this.router.navigate(['/login']);
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/layouts
git commit -m "feat(layouts): add AuthLayoutComponent and MainLayoutComponent"
```

---

### Task 20: Core auth feature — LoginComponent

**Files:**
- Create: `src/core/auth/feature/login/login.component.ts`
- Create: `src/core/auth/feature/login/login.component.html`
- Test: `src/core/auth/feature/login/login.component.spec.ts`

**Interfaces:**
- Consumes: `AuthStore` (Task 14), `ButtonComponent`, `CardComponent` (Tasks 6, 7).
- Produces: `LoginComponent` (selector `app-login`). Used in `app.routes.ts` (Task 22).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';
import { AuthStore } from '../../state/auth.store';

describe('LoginComponent', () => {
  function setup(authStoreOverrides: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStoreOverrides }]
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('does not call login when the form is invalid', async () => {
    const loginSpy = vi.fn();
    const fixture = setup({
      login: loginSpy,
      legalAcceptanceRequired: () => false,
      authenticated: () => false,
      loading: () => false,
      error: () => null
    });

    await fixture.componentInstance.submit();

    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('calls login with the form values when valid', async () => {
    const loginSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({
      login: loginSpy,
      legalAcceptanceRequired: () => false,
      authenticated: () => true,
      loading: () => false,
      error: () => null
    });

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(loginSpy).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret' });
  });

  it('navigates to /legal-consent when login succeeds but legal acceptance is required', async () => {
    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => true,
      authenticated: () => false,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/legal-consent']);
  });

  it('navigates to /dashboard when login succeeds and is fully authenticated', async () => {
    const fixture = setup({
      login: vi.fn().mockResolvedValue(undefined),
      legalAcceptanceRequired: () => false,
      authenticated: () => true,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'secret' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('does not navigate when login rejects', async () => {
    const fixture = setup({
      login: vi.fn().mockRejectedValue(new Error('bad credentials')),
      legalAcceptanceRequired: () => false,
      authenticated: () => false,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fixture.componentInstance.form.setValue({ email: 'a@b.com', password: 'wrong' });
    await fixture.componentInstance.submit();

    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('renders the store error message', () => {
    const fixture = setup({
      login: vi.fn(),
      legalAcceptanceRequired: () => false,
      authenticated: () => false,
      loading: () => false,
      error: () => 'Invalid email or password.'
    });

    expect(fixture.nativeElement.textContent).toContain('Invalid email or password.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './login.component'`

- [ ] **Step 3: Write `login.component.html`**

```html
<app-card title="Sign in to ONEVO HRMS">
  <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
    <div>
      <label for="email" class="block text-sm font-medium text-slate-700">Email</label>
      <input
        id="email"
        type="email"
        formControlName="email"
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      @if (form.controls.email.touched && form.controls.email.invalid) {
        <p class="mt-1 text-sm text-red-600">Enter a valid email address.</p>
      }
    </div>

    <div>
      <label for="password" class="block text-sm font-medium text-slate-700">Password</label>
      <input
        id="password"
        type="password"
        formControlName="password"
        class="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      @if (form.controls.password.touched && form.controls.password.invalid) {
        <p class="mt-1 text-sm text-red-600">Password is required.</p>
      }
    </div>

    @if (store.error()) {
      <p class="text-sm text-red-600" role="alert">{{ store.error() }}</p>
    }

    <app-button type="submit" [loading]="store.loading()" [disabled]="store.loading()">Sign in</app-button>
  </form>
</app-card>
```

- [ ] **Step 4: Write `login.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CardComponent } from '@shared/ui/card/card.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonComponent, CardComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  store = inject(AuthStore);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    try {
      await this.store.login(this.form.getRawValue());
    } catch {
      return;
    }

    if (this.store.legalAcceptanceRequired()) {
      this.router.navigate(['/legal-consent']);
    } else if (this.store.authenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/auth/feature/login
git commit -m "feat(core/auth): add LoginComponent"
```

---

### Task 21: Core auth feature — LegalConsentComponent

**Files:**
- Create: `src/core/auth/feature/legal-consent/legal-consent.component.ts`
- Create: `src/core/auth/feature/legal-consent/legal-consent.component.html`
- Test: `src/core/auth/feature/legal-consent/legal-consent.component.spec.ts`

**Interfaces:**
- Consumes: `AuthStore` (Task 14), `ButtonComponent`, `CardComponent` (Tasks 6, 7).
- Produces: `LegalConsentComponent` (selector `app-legal-consent`). Used in `app.routes.ts` (Task 22).

- [ ] **Step 1: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LegalConsentComponent } from './legal-consent.component';
import { AuthStore } from '../../state/auth.store';
import { LegalDocumentDto } from '../../models/dto/legal-document.dto';

describe('LegalConsentComponent', () => {
  const docs: LegalDocumentDto[] = [
    { document_type: 'privacy_notice', version: '1.0', title: 'ONEVO Privacy Notice', effective_at: '2026-07-28T08:55:29Z', content_url: null },
    { document_type: 'terms', version: '1.0', title: 'ONEVO Terms & Conditions', effective_at: '2026-07-28T08:55:29Z', content_url: null }
  ];

  function setup(authStoreOverrides: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [LegalConsentComponent],
      providers: [provideRouter([]), { provide: AuthStore, useValue: authStoreOverrides }]
    });
    const fixture = TestBed.createComponent(LegalConsentComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders each pending legal document title', () => {
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn(),
      authenticated: () => false,
      loading: () => false,
      error: () => null
    });

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('ONEVO Privacy Notice');
    expect(text).toContain('ONEVO Terms & Conditions');
  });

  it('accepts with a decision per pending document and navigates on success', async () => {
    const acceptSpy = vi.fn().mockResolvedValue(undefined);
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: acceptSpy,
      authenticated: () => true,
      loading: () => false,
      error: () => null
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await fixture.componentInstance.accept();

    expect(acceptSpy).toHaveBeenCalledWith({
      acceptances: [
        { document_type: 'privacy_notice', version: '1.0', decision: 'accepted' },
        { document_type: 'terms', version: '1.0', decision: 'accepted' }
      ]
    });
    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('does not navigate when acceptance fails', async () => {
    const fixture = setup({
      pendingLegalDocuments: () => docs,
      acceptLegalDocuments: vi.fn().mockRejectedValue(new Error('network')),
      authenticated: () => false,
      loading: () => false,
      error: () => 'Could not save your acceptance. Please try again.'
    });
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    await fixture.componentInstance.accept();

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './legal-consent.component'`

- [ ] **Step 3: Write `legal-consent.component.html`**

```html
<app-card title="Before you continue">
  <div class="space-y-4">
    @for (doc of store.pendingLegalDocuments(); track doc.document_type) {
      <div class="rounded-md border border-slate-200 p-4">
        <h3 class="font-medium text-slate-900">{{ doc.title }}</h3>
        <p class="text-sm text-slate-500">Version {{ doc.version }}</p>
      </div>
    }

    @if (store.error()) {
      <p class="text-sm text-red-600" role="alert">{{ store.error() }}</p>
    }

    <app-button [loading]="store.loading()" [disabled]="store.loading()" (pressed)="accept()">
      Accept and continue
    </app-button>
  </div>
</app-card>
```

- [ ] **Step 4: Write `legal-consent.component.ts`**

```typescript
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../state/auth.store';
import { ButtonComponent } from '@shared/ui/button/button.component';
import { CardComponent } from '@shared/ui/card/card.component';

@Component({
  selector: 'app-legal-consent',
  standalone: true,
  imports: [ButtonComponent, CardComponent],
  templateUrl: './legal-consent.component.html'
})
export class LegalConsentComponent {
  private router = inject(Router);
  store = inject(AuthStore);

  async accept(): Promise<void> {
    const acceptances = this.store.pendingLegalDocuments().map((doc) => ({
      document_type: doc.document_type,
      version: doc.version,
      decision: 'accepted' as const
    }));

    try {
      await this.store.acceptLegalDocuments({ acceptances });
    } catch {
      return;
    }

    if (this.store.authenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/auth/feature/legal-consent
git commit -m "feat(core/auth): add LegalConsentComponent"
```

---

### Task 22: Wire app.routes.ts and smoke-test against the real backend

**Files:**
- Modify: `src/app/app.routes.ts`

**Interfaces:**
- Consumes: `AuthLayoutComponent`, `MainLayoutComponent` (Task 19), `LoginComponent` (Task 20), `LegalConsentComponent` (Task 21), `authGuard` (Task 17).

- [ ] **Step 1: Write `app.routes.ts`**

```typescript
import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('@layouts/auth-layout/auth-layout.component').then((m) => m.AuthLayoutComponent),
    children: [
      {
        path: 'login',
        loadComponent: () => import('@core/auth/feature/login/login.component').then((m) => m.LoginComponent)
      },
      {
        path: 'legal-consent',
        loadComponent: () =>
          import('@core/auth/feature/legal-consent/legal-consent.component').then((m) => m.LegalConsentComponent)
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' }
    ]
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('@layouts/main-layout/main-layout.component').then((m) => m.MainLayoutComponent)
  },
  { path: '**', redirectTo: 'login' }
];
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests across every task pass.

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors.

- [ ] **Step 4: Manual smoke test against the real dev backend**

With the ASP.NET backend running on `http://localhost:5139`:
1. Run `npm start`, open the app in a browser at the dev server URL.
2. Confirm it redirects to `/login`.
3. Submit an invalid password. Confirm the inline error "Invalid email or password." appears and the URL stays on `/login` (open DevTools → Network to confirm the `/auth/login` 401 did NOT trigger a redirect).
4. Submit valid credentials for an account that has not yet accepted the legal documents. Confirm navigation to `/legal-consent` and that the privacy notice + terms titles render.
5. Click "Accept and continue". Confirm navigation to `/dashboard`, and that the page shows "Welcome, <email>". In DevTools → Application → Cookies, confirm `onevo_legal_csrf`/`onevo_legal_pending` are gone and `onevo_csrf`/`onevo_session` are present.
6. Click "Sign out". Confirm navigation back to `/login`.
7. Navigate directly to `/dashboard` in the address bar while signed out. Confirm the guard redirects to `/login` rather than showing the page.

Expected: every step behaves as described. If step 3's inline error doesn't appear (e.g., because the interceptor's `isSessionExempt` check doesn't match the login request's actual URL shape once real dev-server proxying is involved), fix `SESSION_EXEMPT_PATH_FRAGMENTS` in `error.interceptor.ts` before continuing — do not proceed to Task-adjacent work with this unverified.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.routes.ts
git commit -m "feat: wire login/legal-consent/dashboard routes with auth guard"
```

---

## Plan Self-Review Notes

- **Spec coverage:** All five deltas from the design spec (auth-in-core, real login+legal-consent flow, no manual refresh, CSRF cookie/header naming, three-model pattern) are implemented across Tasks 12–22. Tailwind/`@ngrx/signals` install is Task 2. Shared UI kit (button/card/loader) is Tasks 5–7, scoped down from the full five-component set per the design's explicit note that `table`/`modal` are deferred to the employees plan.
- **Employees module and remaining 10 business modules:** explicitly out of scope per the design doc — a separate plan, using this one's `core/`+`shared/` foundation.
- **Known follow-ups flagged in code comments, not silently assumed:** `AuthApiService.me()` and `.logout()` response contracts (Task 13), to be corrected once the backend team confirms them.
