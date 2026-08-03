# Dashboard Skeleton Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder ONEVO dashboard shell (yellow background, brand text, welcome/sign-out block) with a reusable black/white/gray skeleton: a light-gray top navbar and sidebar, a white main content area with one 15px curved inner corner, and a new `HomePageProfileCapsule` showing the signed-in user's name/email in the top-right.

**Architecture:** Decompose the existing single-file `MainLayoutComponent` template into three composed pieces — `SideNavbarComponent` and `TopNavbarComponent` (new, `layouts/main-layout/`) plus the existing `MainLayoutComponent` shell — with a new leaf `HomePageProfileCapsuleComponent` (`shared/ui/`) consumed by `TopNavbarComponent`. All colors come from CSS custom properties added to the global stylesheet; no component hardcodes a hex value.

**Tech Stack:** Angular 21 standalone components, signal `input()`/`computed()` API, plain CSS (this repo uses no `.scss` anywhere — confirmed via repo search), Vitest via `ng test --watch=false` (confirmed command; baseline is 21 spec files / 84 tests passing).

## Global Constraints

- Every dashboard color/radius value is a CSS custom property on `:root` in `src/styles.css`: `--dashboard-surface-color: #E5E7EB`, `--dashboard-background-color: #FFFFFF`, `--dashboard-text-primary: #111111`, `--dashboard-text-secondary: #6B7280`, `--dashboard-border-color: #D1D5DB`, `--dashboard-profile-background: #D1D5DB`, `--dashboard-profile-text: #111111`, `--dashboard-content-radius: 15px`.
- No component `.css` file hardcodes a hex value for any of the above — always reference `var(--dashboard-*)`. (Kept as `.css`, not `.scss` — this repo has no Sass tooling installed anywhere; confirmed no `sass` devDependency and no existing `.scss` file.)
- Top navbar and sidebar use the exact same background variable (`--dashboard-surface-color`).
- Main content background is `--dashboard-background-color`; the grid container behind it (`.main-layout`) is `--dashboard-surface-color` so the rounded corner is visually a white card floating on gray, not white-on-white.
- `border-top-left-radius: var(--dashboard-content-radius)` applies only to `.main-content`, only above the existing 768px breakpoint; reset to `0` at `max-width: 768px`. `.main-content` also has `overflow: hidden` so routed page content can never visually cover the curve.
- Layout uses one flat CSS grid on `.main-layout` with explicit `grid-template-areas` (`"sidebar navbar" / "sidebar main"` desktop, `"navbar" / "sidebar" / "main"` mobile) — no nested `.application-shell` grid wrapper.
- Sidebar keeps its existing `5rem` grid width — no layout width change.
- `HomePageProfileCapsuleComponent` shows only display text (`userName?.trim() → email?.trim() → 'User'` fallback); no dropdown, no logout button, no logo, no extra profile info. Long values are truncated visually (`max-width: 18rem`, ellipsis) but the full value stays available via `[title]`.
- All new/changed signal inputs are typed `input<string | null>()` with a `readonly` modifier (not plain `input<string>()`), for consistency between `HomePageProfileCapsuleComponent` and `TopNavbarComponent`.
- `HomePageProfileCapsuleComponent.userName` stays an optional, unbound input — never explicitly bound to `undefined` in a template. Only `email` is bound from `MainLayoutComponent` downward today.
- No changes to `AuthStore`, `AuthApiService`, guards, or interceptors — `AuthStore.logout()` stays intact; only its call site in `DashboardHomeComponent` is removed.
- No new HTTP calls — `MainLayoutComponent` reuses the existing injected `AuthStore`.
- No backend theme-loading logic — CSS custom properties are the full extent of this pass.
- Test command: `npx ng test --watch=false` (run from `Hrms--Web-application---front-end---v1/`). Confirmed baseline: 21 files, 84 tests, all passing.

---

### Task 1: Add dashboard color CSS custom properties

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Produces: global CSS custom properties `--dashboard-surface-color`, `--dashboard-background-color`, `--dashboard-text-primary`, `--dashboard-text-secondary`, `--dashboard-border-color`, `--dashboard-profile-background`, `--dashboard-profile-text`, `--dashboard-content-radius`, available to every component stylesheet in the app from this point on.

This task has no test-first cycle: CSS custom-property values aren't observable through Vitest/jsdom component tests (the global stylesheet isn't loaded into the isolated component test environment), so there is nothing meaningful to assert here in isolation. Correctness is verified by the production build in Task 1's own step 2, and visually confirmed once every later task wires a variable in and the full suite/build re-runs in Task 7.

- [ ] **Step 1: Add the custom properties**

Replace the full contents of `src/styles.css` with:

```css
@import "tailwindcss";

:root {
  --dashboard-surface-color: #E5E7EB;
  --dashboard-background-color: #FFFFFF;
  --dashboard-text-primary: #111111;
  --dashboard-text-secondary: #6B7280;
  --dashboard-border-color: #D1D5DB;
  --dashboard-profile-background: #D1D5DB;
  --dashboard-profile-text: #111111;
  --dashboard-content-radius: 15px;
}

/* You can add global styles to this file, and also import other style files */
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "feat(dashboard): add dashboard CSS custom properties"
```

---

### Task 2: Build HomePageProfileCapsuleComponent

**Files:**
- Create: `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.ts`
- Create: `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.html`
- Create: `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.css`
- Test: `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.spec.ts`

**Interfaces:**
- Produces: `HomePageProfileCapsuleComponent` (selector `app-home-page-profile-capsule`), inputs `readonly userName = input<string | null>()`, `readonly email = input<string | null>()` (both optional, no default), rendering `userName()?.trim() || email()?.trim() || 'User'`, exposed via `[title]` for the full value.
- Consumes: `--dashboard-profile-background`, `--dashboard-profile-text`, `--dashboard-border-color` (from Task 1).

- [ ] **Step 1: Write the failing tests**

Create `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HomePageProfileCapsuleComponent } from './home-page-profile-capsule.component';

describe('HomePageProfileCapsuleComponent', () => {
  it('shows userName when provided', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', 'Asha Kumar');
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('Asha Kumar');
  });

  it('falls back to email when userName is not provided', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('asha@onevo.test');
  });

  it('falls back to email when userName is blank (whitespace only)', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', '   ');
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('asha@onevo.test');
  });

  it('shows "User" when neither userName nor email is provided', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('User');
  });

  it('shows "User" when both inputs are explicitly null', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    fixture.componentRef.setInput('userName', null);
    fixture.componentRef.setInput('email', null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('User');
  });

  it('renders a long identity value fully in the DOM and exposes it via title (visual truncation is CSS-only)', async () => {
    await TestBed.configureTestingModule({ imports: [HomePageProfileCapsuleComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HomePageProfileCapsuleComponent);
    const longEmail = 'a.very.long.employee.email.address.for.testing@onevo-enterprise-workspace.example.com';
    fixture.componentRef.setInput('email', longEmail);
    fixture.detectChanges();

    const span = fixture.nativeElement.querySelector('.profile-capsule') as HTMLElement;
    expect(span.textContent?.trim()).toBe(longEmail);
    expect(span.getAttribute('title')).toBe(longEmail);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --watch=false`
Expected: FAIL — `Cannot find module './home-page-profile-capsule.component'` (component doesn't exist yet).

- [ ] **Step 3: Write the component**

Create `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.ts`:

```ts
import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-home-page-profile-capsule',
  standalone: true,
  templateUrl: './home-page-profile-capsule.component.html',
  styleUrl: './home-page-profile-capsule.component.css'
})
export class HomePageProfileCapsuleComponent {
  readonly userName = input<string | null>();
  readonly email = input<string | null>();

  readonly displayText = computed(() => this.userName()?.trim() || this.email()?.trim() || 'User');
}
```

Create `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.html`:

```html
<span class="profile-capsule" [title]="displayText()">{{ displayText() }}</span>
```

Create `src/app/shared/ui/home-page-profile-capsule/home-page-profile-capsule.component.css`:

```css
.profile-capsule {
  display: inline-flex;
  align-items: center;
  max-width: 18rem;
  padding: 0.375rem 1rem;
  border-radius: 999px;
  background: var(--dashboard-profile-background);
  color: var(--dashboard-profile-text);
  border: 1px solid var(--dashboard-border-color);
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false`
Expected: PASS — all 6 new tests plus the existing 84 pass (90 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/home-page-profile-capsule/
git commit -m "feat(dashboard): add HomePageProfileCapsuleComponent"
```

---

### Task 3: Build SideNavbarComponent

**Files:**
- Create: `src/app/layouts/main-layout/side-navbar/side-navbar.component.ts`
- Create: `src/app/layouts/main-layout/side-navbar/side-navbar.component.html`
- Create: `src/app/layouts/main-layout/side-navbar/side-navbar.component.css`
- Test: `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts`

**Interfaces:**
- Produces: `SideNavbarComponent` (selector `app-side-navbar`), no inputs, renders an empty `<nav>` shell colored via `--dashboard-surface-color`.
- Consumes: `--dashboard-surface-color`, `--dashboard-border-color` (from Task 1).

- [ ] **Step 1: Write the failing test**

Create `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { SideNavbarComponent } from './side-navbar.component';

describe('SideNavbarComponent', () => {
  it('renders an empty navigation shell', async () => {
    await TestBed.configureTestingModule({ imports: [SideNavbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SideNavbarComponent);
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector('nav') as HTMLElement | null;
    expect(nav).toBeTruthy();
    expect(nav?.textContent?.trim()).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false`
Expected: FAIL — `Cannot find module './side-navbar.component'`.

- [ ] **Step 3: Write the component**

Create `src/app/layouts/main-layout/side-navbar/side-navbar.component.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-side-navbar',
  standalone: true,
  templateUrl: './side-navbar.component.html',
  styleUrl: './side-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavbarComponent {}
```

Create `src/app/layouts/main-layout/side-navbar/side-navbar.component.html`:

```html
<nav aria-label="Main navigation"></nav>
```

Create `src/app/layouts/main-layout/side-navbar/side-navbar.component.css`:

```css
:host {
  display: block;
  height: 100%;
  background: var(--dashboard-surface-color);
  border-right: 1px solid var(--dashboard-border-color);
}

nav {
  height: 100%;
}

@media (max-width: 768px) {
  :host {
    border-right: 0;
    border-bottom: 1px solid var(--dashboard-border-color);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false`
Expected: PASS — new test plus all prior tests (91 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/main-layout/side-navbar/
git commit -m "feat(dashboard): add SideNavbarComponent"
```

---

### Task 4: Build TopNavbarComponent

**Files:**
- Create: `src/app/layouts/main-layout/top-navbar/top-navbar.component.ts`
- Create: `src/app/layouts/main-layout/top-navbar/top-navbar.component.html`
- Create: `src/app/layouts/main-layout/top-navbar/top-navbar.component.css`
- Test: `src/app/layouts/main-layout/top-navbar/top-navbar.component.spec.ts`

**Interfaces:**
- Consumes: `HomePageProfileCapsuleComponent` (selector `app-home-page-profile-capsule`, inputs `userName`/`email`) from Task 2.
- Produces: `TopNavbarComponent` (selector `app-top-navbar`), inputs `readonly userName = input<string | null>()`, `readonly email = input<string | null>()`, both passed straight through to the capsule.

- [ ] **Step 1: Write the failing test**

Create `src/app/layouts/main-layout/top-navbar/top-navbar.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { TopNavbarComponent } from './top-navbar.component';

describe('TopNavbarComponent', () => {
  it('renders the profile capsule with the provided email', async () => {
    await TestBed.configureTestingModule({ imports: [TopNavbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TopNavbarComponent);
    fixture.componentRef.setInput('email', 'asha@onevo.test');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-home-page-profile-capsule')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('asha@onevo.test');
  });

  it('renders the profile capsule with "User" when no inputs are bound', async () => {
    await TestBed.configureTestingModule({ imports: [TopNavbarComponent] }).compileComponents();
    const fixture = TestBed.createComponent(TopNavbarComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('User');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --watch=false`
Expected: FAIL — `Cannot find module './top-navbar.component'`.

- [ ] **Step 3: Write the component**

Create `src/app/layouts/main-layout/top-navbar/top-navbar.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HomePageProfileCapsuleComponent } from '../../../shared/ui/home-page-profile-capsule/home-page-profile-capsule.component';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [HomePageProfileCapsuleComponent],
  templateUrl: './top-navbar.component.html',
  styleUrl: './top-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TopNavbarComponent {
  readonly userName = input<string | null>();
  readonly email = input<string | null>();
}
```

Create `src/app/layouts/main-layout/top-navbar/top-navbar.component.html`:

```html
<app-home-page-profile-capsule [userName]="userName()" [email]="email()" />
```

Create `src/app/layouts/main-layout/top-navbar/top-navbar.component.css`:

```css
:host {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-height: 2.75rem;
  width: 100%;
  padding: 0 1rem;
  background: var(--dashboard-surface-color);
  border-bottom: 1px solid var(--dashboard-border-color);
}

@media (max-width: 768px) {
  :host {
    min-height: 3rem;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false`
Expected: PASS — 2 new tests plus all prior tests (93 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/main-layout/top-navbar/
git commit -m "feat(dashboard): add TopNavbarComponent"
```

---

### Task 5: Rewire MainLayoutComponent onto the new shell

**Files:**
- Modify: `src/app/layouts/main-layout/main-layout.component.ts`
- Modify: `src/app/layouts/main-layout/main-layout.component.html`
- Modify: `src/app/layouts/main-layout/main-layout.component.css`
- Test: `src/app/layouts/main-layout/main-layout.component.spec.ts` (new file)

**Interfaces:**
- Consumes: `TopNavbarComponent` (Task 4, input `email`), `SideNavbarComponent` (Task 3), `AuthStore` (existing, `src/app/core/auth/state/auth.store.ts`, exposes `email` as a readable signal).
- Produces: `MainLayoutComponent` renders `<app-side-navbar>` + `<app-top-navbar [email]="...">` + the existing `<main id="main-content">` router outlet, with no "ONEVO" brand text, no "Navigation will be configured later" text, no yellow background.

- [ ] **Step 1: Write the failing tests**

Create `src/app/layouts/main-layout/main-layout.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout.component';
import { AuthStore } from '../../core/auth/state/auth.store';

describe('MainLayoutComponent', () => {
  it('renders the top and side navbar shell without legacy branding or placeholder text', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { email: () => 'asha@onevo.test' } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-top-navbar')).toBeTruthy();
    expect(el.querySelector('app-side-navbar')).toBeTruthy();
    expect(el.textContent).not.toContain('ONEVO');
    expect(el.textContent).not.toContain('Navigation will be configured later');
  });

  it('passes the authenticated user email down to the top navbar', async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { email: () => 'asha@onevo.test' } }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(MainLayoutComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('asha@onevo.test');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --watch=false`
Expected: FAIL — the rendered shell still has the old `<aside class="sidebar">`/`<header class="navbar">` markup, so `app-top-navbar`/`app-side-navbar` are not found and "ONEVO" text is still present.

- [ ] **Step 3: Rewrite the component**

Replace `src/app/layouts/main-layout/main-layout.component.ts` with:

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/state/auth.store';
import { SideNavbarComponent } from './side-navbar/side-navbar.component';
import { TopNavbarComponent } from './top-navbar/top-navbar.component';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, SideNavbarComponent, TopNavbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  private readonly authStore = inject(AuthStore);
  readonly email = this.authStore.email;
  readonly announcementMessage = signal('');
}
```

Replace `src/app/layouts/main-layout/main-layout.component.html` with:

```html
<a class="skip-to-main" href="#main-content">
  Skip to main content
</a>

<div class="main-layout">
  <app-side-navbar />
  <app-top-navbar [email]="email()" />

  <main id="main-content" class="main-content" tabindex="-1">
    <router-outlet />
  </main>
</div>

<div
  id="global-notification-container"
  class="global-notification-container"
  aria-label="Application notifications"
></div>

<div id="global-dialog-container" class="global-dialog-container"></div>

<div class="sr-only" aria-live="polite" aria-atomic="true">
  {{ announcementMessage() }}
</div>
```

Note: the `<section class="application-shell">` wrapper from the original design is removed — `app-side-navbar`, `app-top-navbar`, and `<main>` are now direct children of `.main-layout`, placed by explicit named grid areas (correction #3) rather than a nested grid.

Replace `src/app/layouts/main-layout/main-layout.component.css` with:

```css
:host {
  display: block;
  min-height: 100dvh;
}

.skip-to-main {
  position: fixed;
  top: 0;
  left: 1rem;
  z-index: 1000;
  padding: 0.75rem 1rem;
  background: #ffffff;
  color: #111827;
  border: 2px solid currentColor;
  border-radius: 0.5rem;
  transform: translateY(-150%);
  transition: transform 150ms ease;
}

.skip-to-main:focus {
  transform: translateY(0.5rem);
}

.main-layout {
  display: grid;
  grid-template-columns: 5rem minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    "sidebar navbar"
    "sidebar main";
  min-height: 100dvh;
  background: var(--dashboard-surface-color);
}

app-side-navbar {
  grid-area: sidebar;
  min-height: 0;
}

app-top-navbar {
  grid-area: navbar;
  min-width: 0;
}

.main-content {
  grid-area: main;
  min-width: 0;
  min-height: 0;
  padding: 1.5rem;
  outline: none;
  background: var(--dashboard-background-color);
  border-top-left-radius: var(--dashboard-content-radius);
  overflow: hidden;
}

.main-content:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: -3px;
}

.global-notification-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 1100;
}

.global-dialog-container {
  position: relative;
  z-index: 1200;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 768px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      "navbar"
      "sidebar"
      "main";
  }

  .main-content {
    padding: 1rem;
    border-top-left-radius: 0;
  }
}
```

Notes:
- The sidebar/navbar surface color and border are owned by `SideNavbarComponent`/`TopNavbarComponent`'s own `:host` styles (Tasks 3-4), not repeated here.
- `.main-layout` itself carries `background: var(--dashboard-surface-color)` (correction #2) — this is what shows through the small triangle revealed by `.main-content`'s rounded top-left corner. If this were white (as in the original, pre-correction design), the white rounded box would blend into a white background and the curve would be invisible.
- `overflow: hidden` on `.main-content` (correction #2) ensures routed page content can never render past its own rounded corner and visually hide the curve.
- `min-width: 0` / `min-height: 0` on the flexible grid items (correction #3) prevent the grid tracks from growing to fit oversized content and causing page overflow.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --watch=false`
Expected: PASS — 2 new tests plus all prior tests (95 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/main-layout/main-layout.component.ts src/app/layouts/main-layout/main-layout.component.html src/app/layouts/main-layout/main-layout.component.css src/app/layouts/main-layout/main-layout.component.spec.ts
git commit -m "feat(dashboard): rewire MainLayoutComponent onto the black/white/gray shell"
```

---

### Task 6: Clean up DashboardHomeComponent

**Files:**
- Modify: `src/app/modules/dashboard/feature/dashboard-home/dashboard-home.component.ts`
- Modify: `src/app/modules/dashboard/feature/dashboard-home/dashboard-home.component.spec.ts`

**Interfaces:**
- Produces: `DashboardHomeComponent` with no dependency on `AuthStore`, `Router`, or `ButtonComponent` — an empty skeleton content component.

- [ ] **Step 1: Write the failing test**

Replace `src/app/modules/dashboard/feature/dashboard-home/dashboard-home.component.spec.ts` with:

```ts
import { TestBed } from '@angular/core/testing';
import { DashboardHomeComponent } from './dashboard-home.component';

describe('DashboardHomeComponent', () => {
  it('renders an empty skeleton content area without the removed placeholder UI', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();

    const text = (fixture.nativeElement.textContent as string).trim();
    expect(text).not.toContain('Welcome');
    expect(text).not.toContain('Sign out');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --watch=false`
Expected: FAIL — the current component still renders "Welcome, ..." text and a "Sign out" button, and no longer matches the old spec's removed assertions (the old spec's own two tests, which reference `AuthStore`/sign-out, are being replaced in this same step so there's nothing stale left behind).

- [ ] **Step 3: Rewrite the component**

Replace `src/app/modules/dashboard/feature/dashboard-home/dashboard-home.component.ts` with:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Empty skeleton content area for the authenticated dashboard route.
 * Real dashboard modules (ARCHITECTURE.md's modules/dashboard/) replace this later.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  template: `<div class="dashboard-home"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ng test --watch=false`
Expected: PASS — new test replaces the previous file's two tests (net -1 from Task 5's 95, so 94 total).

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/dashboard/feature/dashboard-home/
git commit -m "feat(dashboard): remove welcome/email/sign-out placeholder from DashboardHomeComponent"
```

---

### Task 7: Full regression run and production build verification

**Files:** none (verification only)

**Interfaces:** none — this task gates the whole plan.

- [ ] **Step 1: Run the full test suite**

Run: `npx ng test --watch=false`
Expected: PASS — all tests green (94 total per the running count above; treat the exact number as informational, not a hard assertion — what matters is zero failures).

- [ ] **Step 2: Run a production build**

Run: `npx ng build`
Expected: `Application bundle generation complete.` with no errors or new warnings beyond what existed before this plan.

- [ ] **Step 3: Manual visual check**

Run: `npx ng serve` (leave running), then open `http://localhost:4200` in a browser and log in through the existing flow to reach `/dashboard`.

Confirm visually:
- Top navbar and sidebar are the same light-gray, main content is white.
- The main content area's top-left corner has a visible curve; it disappears when the window is narrowed below ~768px.
- Only the profile capsule (name or email, no dropdown/logout/logo) appears in the top-right of the navbar.
- No "ONEVO" branding, no "Navigation will be configured later" text, no welcome/email/sign-out text anywhere on the dashboard.

Stop the dev server (Ctrl+C) once confirmed.

- [ ] **Step 4: Commit (if step 3 required any fixup)**

If the manual check in Step 3 required no code changes, there is nothing to commit — the plan is complete as of Task 6's commit. If a fixup was needed, commit it with a message describing exactly what visual issue it corrects.

## Self-Review Notes

- **Spec coverage:** every `layout_requirements`/`new_component`/`color_system`/`styling_rules`/`acceptance_criteria` item from the approved design spec maps to Task 1 (colors), Task 2 (capsule), Task 3 (sidebar), Task 4 (top navbar), Task 5 (shell wiring + corner radius + yellow-background removal), Task 6 (dashboard-home cleanup). `future_color_configuration` is intentionally not a task — the spec's Deltas §out-of-scope excludes it, only the CSS-variable structure from Task 1 satisfies "ready for it."
- **File extension correction:** the original request's `suggested_files` used `.scss` for the capsule component (and repeated this again in a later correction request); this repo has no `.scss` anywhere (confirmed via search, no `sass` devDependency) and uses plain `.css` throughout, so all new stylesheets in this plan are `.css` to match existing convention and avoid a silent, unbuilt-Sass compile failure.
- **Type/signature consistency checked:** `HomePageProfileCapsuleComponent.userName`/`email` (Task 2) are `input<string | null>()`, matching `TopNavbarComponent`'s identically-typed inputs (Task 4) and what `MainLayoutComponent` binds only `email` to (Task 5), leaving `userName` correctly unbound end-to-end per the Global Constraints.
- **Four post-approval corrections folded in** (see the design spec's "Implementation corrections" section for full rationale): (1) consistent `input<string | null>()` + `readonly` + `.trim()` fallback typing across Tasks 2 and 4; (2) `.main-layout` grid background changed to `--dashboard-surface-color` (was incorrectly `--dashboard-background-color` on the old `.application-shell` wrapper, which would have made the rounded corner invisible against a white-on-white background) plus `overflow: hidden` on `.main-content`, both in Task 5; (3) the nested two-level grid replaced with one flat grid using named `grid-template-areas` on `.main-layout`, removing the `.application-shell` wrapper entirely, in Task 5; (4) `max-width`/ellipsis/`title` attribute added to the capsule in Task 2 so long emails truncate safely without losing the full value for hover/assistive tech. Test counts in Tasks 3-7 were recalculated to account for Task 2 growing from 3 to 6 tests.
