# General Settings Design Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Settings → General Settings into a polished page with a header identity card, regrouped sections, and a company logo preview that visually matches the sidebar's top tile — via a new shared `CompanyLogoTileComponent`.

**Architecture:** Extract the sidebar's existing logo-or-initials tile markup into `src/app/shared/ui/company-logo-tile/`, a presentational (no API calls) component taking `name`/`logoUrl`/`size` inputs. Migrate the sidebar to use it (unchanged URL construction). Consume it a second time in General Settings — once in a new read-only header identity card, once in the existing logo-upload block (which keeps its own Change/Remove controls). Regroup the General Settings form into "Company identity" / "Registration & contact" / "Regional defaults" / "Default work hours", preserving every existing form control, validator, and save payload key.

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals`, Reactive Forms, Vitest (`@angular/build:unit-test`), theme-tokens.css custom properties.

## Global Constraints

- Work only inside `C:\onevoNew\Hrms--Web-application---front-end---v1`.
- Frontend only — no backend, API contract, or permission changes.
- Do not remove any existing form field, the logo upload/remove behavior, or the sticky save bar.
- Do not invent a "last saved" timestamp — no such data exists.
- **Do not commit or push.** Leave changes in the working tree for the user to review.
- No `::ng-deep` beyond what already exists in `general-settings.component.css`.
- No inline styles, no hardcoded hex colors — use `var(--color-*)` tokens from `theme-tokens.css`.
- **Known, deliberate exception:** the sidebar's logo URL (`/api/v1/files/{id}`, hardcoded) and General Settings' logo URL (`LegalEntityApiService.getLogoUrl()`, scoped + environment-aware) are different endpoints. This plan does **not** unify them — the shared component takes `logoUrl` as a plain input so each caller keeps constructing its own URL exactly as before. This mismatch is a pre-existing, unproven-broken condition and must be called out in the final report, not silently "fixed".

---

### Task 1: Shared `CompanyLogoTileComponent`

**Files:**
- Create: `src/app/shared/ui/company-logo-tile/company-logo-tile.component.ts`
- Create: `src/app/shared/ui/company-logo-tile/company-logo-tile.component.css`
- Test: `src/app/shared/ui/company-logo-tile/company-logo-tile.component.spec.ts`

**Interfaces:**
- Produces: `CompanyLogoTileComponent` (selector `app-company-logo-tile`), inputs `name: input<string | null | undefined>`, `logoUrl: input<string | null | undefined>`, `size: input<'sm' | 'md' | 'lg'>` (default `'md'`). Renders `<img class="company-logo-tile__img">` when `logoUrl()` is truthy, else `<span class="company-logo-tile__initial">`. Root element carries classes `company-logo-tile company-logo-tile--{size}`.

- [ ] **Step 1: Write the failing spec**

```typescript
// src/app/shared/ui/company-logo-tile/company-logo-tile.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyLogoTileComponent } from './company-logo-tile.component';

describe('CompanyLogoTileComponent', () => {
  let fixture: ComponentFixture<CompanyLogoTileComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [CompanyLogoTileComponent] });
    fixture = TestBed.createComponent(CompanyLogoTileComponent);
  });

  it('renders the first letter of the company name, uppercased, when there is no logo', () => {
    fixture.componentRef.setInput('name', 'acme corp');
    fixture.detectChanges();
    const initial = fixture.nativeElement.querySelector('.company-logo-tile__initial');
    expect(initial?.textContent?.trim()).toBe('A');
  });

  it('falls back to "O" when the name is empty or not provided', () => {
    fixture.detectChanges();
    const initial = fixture.nativeElement.querySelector('.company-logo-tile__initial');
    expect(initial?.textContent?.trim()).toBe('O');
  });

  it('renders an image instead of initials when a logo URL is provided', () => {
    fixture.componentRef.setInput('name', 'Acme Corp');
    fixture.componentRef.setInput('logoUrl', 'https://example.test/logo.png');
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img).toBeTruthy();
    expect(img.src).toBe('https://example.test/logo.png');
    expect(fixture.nativeElement.querySelector('.company-logo-tile__initial')).toBeFalsy();
  });

  it('gives the image a real alt and gives the fallback tile an accessible label', () => {
    fixture.componentRef.setInput('name', 'Acme Corp');
    fixture.detectChanges();
    const tile = fixture.nativeElement.querySelector('.company-logo-tile');
    expect(tile.getAttribute('role')).toBe('img');
    expect(tile.getAttribute('aria-label')).toBe('Acme Corp logo');
    expect(tile.getAttribute('title')).toBe('Acme Corp');

    fixture.componentRef.setInput('logoUrl', 'https://example.test/logo.png');
    fixture.detectChanges();
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img.alt).toBe('Acme Corp logo');
    expect(tile.getAttribute('role')).toBeNull();
  });

  it('applies the requested size class, defaulting to md', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.company-logo-tile--md')).toBeTruthy();
    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.company-logo-tile--sm')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails (module doesn't exist yet)**

Run: `npx ng test --no-watch --include "src/app/shared/ui/company-logo-tile/*.spec.ts"`
Expected: FAIL — cannot find `./company-logo-tile.component`.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/shared/ui/company-logo-tile/company-logo-tile.component.ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type CompanyLogoTileSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-company-logo-tile',
  standalone: true,
  template: `
    <div
      class="company-logo-tile company-logo-tile--{{ size() }}"
      [title]="name() || 'Workspace'"
      [attr.role]="logoUrl() ? null : 'img'"
      [attr.aria-label]="logoUrl() ? null : altText()"
    >
      @if (logoUrl(); as src) {
        <img [src]="src" [alt]="altText()" class="company-logo-tile__img" />
      } @else {
        <span class="company-logo-tile__initial">{{ initial() }}</span>
      }
    </div>
  `,
  styleUrl: './company-logo-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompanyLogoTileComponent {
  readonly name = input<string | null | undefined>(undefined);
  readonly logoUrl = input<string | null | undefined>(undefined);
  readonly size = input<CompanyLogoTileSize>('md');

  readonly initial = computed(() => {
    const trimmed = this.name()?.trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'O';
  });

  readonly altText = computed(() => {
    const trimmed = this.name()?.trim();
    return trimmed ? `${trimmed} logo` : 'Company logo';
  });
}
```

```css
/* src/app/shared/ui/company-logo-tile/company-logo-tile.component.css */
.company-logo-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  flex-shrink: 0;
}

.company-logo-tile--sm {
  width: 34px;
  height: 34px;
  font-size: 0.9375rem;
}

.company-logo-tile--md {
  width: 48px;
  height: 48px;
  font-size: 1.125rem;
  border-radius: 10px;
}

.company-logo-tile--lg {
  width: 96px;
  height: 96px;
  font-size: 2rem;
  border-radius: 14px;
}

.company-logo-tile__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
}

.company-logo-tile__initial {
  text-transform: uppercase;
}
```

- [ ] **Step 4: Run the spec again to confirm it passes**

Run: `npx ng test --no-watch --include "src/app/shared/ui/company-logo-tile/*.spec.ts"`
Expected: PASS (5 tests).

---

### Task 2: Migrate the sidebar to `CompanyLogoTileComponent`

**Files:**
- Modify: `src/app/layouts/main-layout/side-navbar/side-navbar.component.html`
- Modify: `src/app/layouts/main-layout/side-navbar/side-navbar.component.ts`
- Modify: `src/app/layouts/main-layout/side-navbar/side-navbar.component.css`
- Modify: `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts`

**Interfaces:**
- Consumes: `CompanyLogoTileComponent` from Task 1 (`../../../shared/ui/company-logo-tile/company-logo-tile.component`).
- Keeps the existing `/api/v1/files/{logoFileId}` URL construction verbatim — do not change it (see Global Constraints).

- [ ] **Step 1: Update the component class**

Replace the full contents of `side-navbar.component.ts`:

```typescript
// src/app/layouts/main-layout/side-navbar/side-navbar.component.ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';
import { CompanyLogoTileComponent } from '../../../shared/ui/company-logo-tile/company-logo-tile.component';
import { NavigationStateService } from '../nav/navigation-state.service';
import { NavIconComponent } from './nav-icon.component';

@Component({
  selector: 'app-side-navbar',
  standalone: true,
  imports: [RouterLink, NavIconComponent, CompanyLogoTileComponent],
  templateUrl: './side-navbar.component.html',
  styleUrl: './side-navbar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SideNavbarComponent {
  private readonly navState = inject(NavigationStateService);
  private readonly legalEntityStore = inject(LegalEntityStore);

  readonly visibleItems = this.navState.visibleItems;
  readonly activeItem = this.navState.activeItem;

  readonly selectedCompany = this.legalEntityStore.selectedLegalEntity;

  readonly companyLogoUrl = computed(() => {
    const company = this.selectedCompany();
    return company?.logoFileId ? '/api/v1/files/' + company.logoFileId : null;
  });
}
```

(`companyInitial` is removed — that logic now lives inside `CompanyLogoTileComponent`.)

- [ ] **Step 2: Update the template**

Replace the top of `side-navbar.component.html` (keep the rest of the file — the divider and `@for` nav loop — unchanged):

```html
<!-- src/app/layouts/main-layout/side-navbar/side-navbar.component.html -->
<nav aria-label="Main navigation" class="nav-rail">
  <!-- Slack-style Company Workspace Logo / Initial Tile -->
  <div class="nav-rail__company-tile">
    <app-company-logo-tile [name]="selectedCompany()?.name" [logoUrl]="companyLogoUrl()" size="sm" />
  </div>

  <div class="nav-rail__divider"></div>

  @for (item of visibleItems(); track item.id) {
    <a
      [routerLink]="item.path"
      class="nav-rail-item"
      [class.nav-rail-item--active]="activeItem()?.id === item.id"
      [attr.aria-current]="activeItem()?.id === item.id ? 'page' : null"
    >
      <div class="nav-rail-item__icon-wrapper">
        <app-nav-icon [name]="item.icon!" [active]="activeItem()?.id === item.id" />
      </div>
      <span>{{ item.label }}</span>
    </a>
  }
</nav>
```

- [ ] **Step 3: Remove the now-duplicated tile styles from the sidebar's CSS**

In `side-navbar.component.css`, delete these three rule blocks (their styling now lives in `company-logo-tile.component.css`), keeping `.nav-rail__company-tile` and `.nav-rail__divider` as-is:

```css
/* DELETE this block: */
.nav-rail__company-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-primary);
  font-size: 0.9375rem;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: transform 150ms ease;
  cursor: pointer;
}

.nav-rail__company-avatar:hover {
  transform: scale(1.06);
}

.nav-rail__company-logo {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
```

- [ ] **Step 4: Add regression tests for the migrated tile**

Append to `side-navbar.component.spec.ts` (add `import { LegalEntityStore } from '../../../modules/organization/state/legal-entity.store';` to the top of the file alongside the existing imports):

```typescript
  it('shows the sidebar-style initial tile when no company is selected', () => {
    const fixture = setup([], []);
    const initial = fixture.nativeElement.querySelector('.company-logo-tile__initial');
    expect(initial?.textContent?.trim()).toBe('O');
  });

  it('renders the company logo image via the shared tile when a company with a logo is selected', () => {
    TestBed.configureTestingModule({
      imports: [SideNavbarComponent],
      providers: [
        provideRouter([{ path: '**', component: BlankComponent }]),
        { provide: AuthStore, useValue: { permissions: () => [], activeModules: () => [] } },
        {
          provide: LegalEntityStore,
          useValue: {
            selectedLegalEntity: () => ({
              id: 'co-1',
              name: 'Acme Corp',
              companyCode: 'ACME',
              logoFileId: 'file-9',
              isActive: true,
              isPrimary: true
            })
          }
        }
      ]
    });
    const fixture = TestBed.createComponent(SideNavbarComponent);
    fixture.detectChanges();

    const img: HTMLImageElement = fixture.nativeElement.querySelector('.company-logo-tile__img');
    expect(img).toBeTruthy();
    expect(img.src).toContain('/api/v1/files/file-9');
  });
```

Place both `it(...)` blocks inside the existing top-level `describe('SideNavbarComponent', () => { ... })`, after the last existing test.

- [ ] **Step 5: Run the sidebar spec**

Run: `npx ng test --no-watch --include "src/app/layouts/**/*.spec.ts"`
Expected: PASS — all prior tests plus the 2 new ones (10 total in this file).

---

### Task 3: Redesign the General Settings template

**Files:**
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.ts`
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.html`
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.css`

**Interfaces:**
- Consumes: `CompanyLogoTileComponent` from Task 1; `logoUrl()`, `hasAccess()`, `selectedLegalEntity()`, `settingsStore`, `form` all already exist on `GeneralSettingsComponent` (unchanged).
- Every one of the 20 `UpdateLegalEntityGeneralSettingsRequest` fields (`name`, `companyCode`, `registrationNumber`, `taxRegistrationNumber`, `vatGstNumber`, `email`, `phoneNumber`, `website`, `countryCode`, `currencyCode`, `timezone`, `financialYearStartMonth`, `firstDayOfWeek`, `standardWorkingDays`, `defaultLanguage`, `dateFormat`, `timeFormat`, `status`, `workStartTime`, `workEndTime`) must still have a bound `<app-input>`/`<app-select>`/checkbox in the template — only their section grouping changes.

- [ ] **Step 1: Add the import to the component class**

In `general-settings.component.ts`, add the import and register it:

```typescript
import { CompanyLogoTileComponent } from '../../../../shared/ui/company-logo-tile/company-logo-tile.component';
```

Add `CompanyLogoTileComponent` to the `imports: [...]` array in the `@Component` decorator (alongside `ReactiveFormsModule`, `BreadcrumbHeaderComponent`, etc.).

- [ ] **Step 2: Replace the full template**

Replace the entire contents of `general-settings.component.html`:

```html
<header class="gs-page-header">
  <div class="gs-header-row">
    <app-breadcrumb-header parentLabel="Settings" currentLabel="General Settings" icon="settings" />
  </div>
</header>

@if (!hasAccess()) {
  <app-empty-state
    title="You don't have access to this."
    description="Viewing and editing General Settings requires the legal_entity:update permission."
  />
} @else if (!selectedLegalEntity()) {
  <app-empty-state title="Select a company to edit General Settings." />
} @else {

  <section class="gs-identity-card" aria-label="Company overview">
    <div class="gs-identity-card__left">
      <app-company-logo-tile [name]="selectedLegalEntity()!.name" [logoUrl]="logoUrl()" size="md" />
      <div class="gs-identity-card__text">
        <h1 class="gs-identity-card__name">{{ selectedLegalEntity()!.name }}</h1>
        <div class="gs-identity-card__meta">
          @if (selectedLegalEntity()!.companyCode) {
            <span class="gs-identity-card__code">{{ selectedLegalEntity()!.companyCode }}</span>
          }
          <span class="gs-identity-card__hint">Manage company identity, regional defaults, and work settings.</span>
        </div>
      </div>
    </div>
    @if (settingsStore.settings(); as settings) {
      <span class="gs-status-pill" [class.gs-status-pill--inactive]="settings.status === 'inactive'">
        {{ settings.status === 'active' ? 'Active' : 'Inactive' }}
      </span>
    }
  </section>

  @if (settingsStore.loading()) {
    <div class="skeleton-block" aria-busy="true" aria-label="Loading General Settings"></div>
  } @else if (settingsStore.loadError()) {
    <app-error-state [message]="settingsStore.loadError()!" [retryable]="true" (retry)="settingsStore.load(selectedLegalEntity()!.id)" />
  } @else if (settingsStore.settings()) {

    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="gs-form">

      <!-- Section 1: Company identity -->
      <section class="gs-section">
        <h2 class="gs-section__title">Company identity</h2>
        <div class="gs-identity-row">
          <div class="gs-logo-upload-block">
            <div class="gs-logo-preview" aria-label="Company logo preview">
              <app-company-logo-tile [name]="form.controls.name.value" [logoUrl]="logoUrl()" size="lg" />
            </div>
            <div class="gs-logo-actions">
              <label class="gs-logo-btn" [class.gs-logo-btn--busy]="uploadingLogo()">
                <input type="file" accept="image/png,image/jpeg,image/webp" (change)="onLogoFileSelected($event)" [disabled]="uploadingLogo() || removingLogo()" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                {{ uploadingLogo() ? 'Uploading…' : 'Change logo' }}
              </label>
              @if (logoUrl()) {
                <button type="button" class="gs-logo-remove-btn" [disabled]="uploadingLogo() || removingLogo()" (click)="onRemoveLogo()">
                  {{ removingLogo() ? 'Removing…' : 'Remove' }}
                </button>
              }
            </div>
          </div>

          <div class="gs-field-grid gs-field-grid--3 gs-identity-fields">
            <app-input label="Company name" [value]="form.controls.name.value" (valueChange)="form.controls.name.setValue($event)"
              (blurred)="form.controls.name.markAsTouched()"
              [error]="form.controls.name.touched && form.controls.name.invalid ? 'Required (max 200 chars).' : ''" />
            <app-input label="Company code" [value]="form.controls.companyCode.value" (valueChange)="form.controls.companyCode.setValue($event)"
              (blurred)="form.controls.companyCode.markAsTouched()"
              [error]="form.controls.companyCode.touched && form.controls.companyCode.invalid ? 'Required (max 20 chars).' : ''" />
          </div>
        </div>
      </section>

      <!-- Section 2: Registration & contact -->
      <section class="gs-section">
        <h2 class="gs-section__title">Registration &amp; contact</h2>
        <div class="gs-field-grid gs-field-grid--3">
          <app-input label="Company registration number" [value]="form.controls.registrationNumber.value" (valueChange)="form.controls.registrationNumber.setValue($event)"
            (blurred)="form.controls.registrationNumber.markAsTouched()"
            [error]="form.controls.registrationNumber.touched && form.controls.registrationNumber.invalid ? 'Required (max 50 chars).' : ''" />
          <app-input label="Tax registration number" [value]="form.controls.taxRegistrationNumber.value" (valueChange)="form.controls.taxRegistrationNumber.setValue($event)"
            [error]="form.controls.taxRegistrationNumber.invalid ? 'Max 80 characters.' : ''" />
          <app-input label="VAT/GST number (optional)" [value]="form.controls.vatGstNumber.value" (valueChange)="form.controls.vatGstNumber.setValue($event)"
            [error]="form.controls.vatGstNumber.invalid ? 'Max 50 characters.' : ''" />
          <app-select label="Status" [options]="STATUS_OPTIONS" [value]="form.controls.status.value" (valueChange)="form.controls.status.setValue($any($event))" />
          <app-input label="Company email" type="email" [value]="form.controls.email.value" (valueChange)="form.controls.email.setValue($event)"
            (blurred)="form.controls.email.markAsTouched()"
            [error]="form.controls.email.touched && form.controls.email.invalid ? 'Enter a valid email address.' : ''" />
          <app-input label="Phone number" [value]="form.controls.phoneNumber.value" (valueChange)="form.controls.phoneNumber.setValue($event)"
            [error]="form.controls.phoneNumber.invalid ? 'Max 20 characters.' : ''" />
          <app-input label="Website (optional)" type="url" [value]="form.controls.website.value" (valueChange)="form.controls.website.setValue($event)"
            (blurred)="form.controls.website.markAsTouched()"
            [error]="form.controls.website.touched && form.controls.website.invalid ? 'Enter a full URL, e.g. https://example.com.' : ''" />
        </div>
      </section>

      <!-- Section 3: Regional defaults -->
      <section class="gs-section">
        <h2 class="gs-section__title">Regional defaults</h2>
        <div class="gs-field-grid gs-field-grid--3">
          <app-select label="Country" [options]="COUNTRY_CODE_OPTIONS" placeholder="Select a country"
            [value]="form.controls.countryCode.value"
            (valueChange)="form.controls.countryCode.setValue($event); form.controls.countryCode.markAsTouched()"
            [error]="form.controls.countryCode.touched && form.controls.countryCode.invalid ? 'Required.' : ''" />
          <app-select label="Currency" [options]="CURRENCY_CODE_OPTIONS" placeholder="Select a currency"
            [value]="form.controls.currencyCode.value"
            (valueChange)="form.controls.currencyCode.setValue($event); form.controls.currencyCode.markAsTouched()"
            [error]="form.controls.currencyCode.touched && form.controls.currencyCode.invalid ? 'Required.' : ''" />
          <app-select label="Time zone" [options]="TIMEZONE_OPTIONS" placeholder="Select a timezone"
            [value]="form.controls.timezone.value"
            (valueChange)="form.controls.timezone.setValue($event); form.controls.timezone.markAsTouched()"
            [error]="form.controls.timezone.touched && form.controls.timezone.invalid ? 'Required.' : ''" />
          <app-select label="Financial year starts in" [options]="FINANCIAL_YEAR_MONTH_OPTIONS"
            [value]="form.controls.financialYearStartMonth.value + ''" (valueChange)="form.controls.financialYearStartMonth.setValue(+$event)" />
          <app-select label="First day of the week" [options]="FIRST_DAY_OF_WEEK_OPTIONS"
            [value]="form.controls.firstDayOfWeek.value + ''" (valueChange)="form.controls.firstDayOfWeek.setValue(+$event)" />

          <fieldset class="gs-fieldset">
            <legend class="gs-fieldset__legend">Standard working days</legend>
            <div class="gs-weekdays">
              @for (day of WEEKDAY_OPTIONS; track day.value) {
                <label class="gs-weekday-chip" [class.gs-weekday-chip--selected]="isDaySelected(day.value)">
                  <input type="checkbox" [checked]="isDaySelected(day.value)" (change)="toggleDay(day.value, $any($event.target).checked)" />
                  {{ day.shortLabel }}
                </label>
              }
            </div>
            @if (form.controls.standardWorkingDays.touched && form.controls.standardWorkingDays.invalid) {
              <p class="gs-field-error">Select at least one working day.</p>
            }
          </fieldset>

          <app-select label="Default language" [options]="DEFAULT_LANGUAGE_OPTIONS" [value]="form.controls.defaultLanguage.value" [disabled]="true" />
          <app-select label="Date format" [options]="DATE_FORMAT_OPTIONS" [value]="form.controls.dateFormat.value" (valueChange)="form.controls.dateFormat.setValue($event)" />
          <app-select label="Time format" [options]="TIME_FORMAT_OPTIONS" [value]="form.controls.timeFormat.value" (valueChange)="form.controls.timeFormat.setValue($any($event))" />
        </div>
      </section>

      <!-- Section 4: Default work hours -->
      <section class="gs-section">
        <h2 class="gs-section__title">Default work hours</h2>
        <div class="gs-field-grid gs-field-grid--2">
          <app-input
            type="time"
            label="Work start time"
            [value]="form.controls.workStartTime.value"
            (valueChange)="form.controls.workStartTime.setValue($event); form.controls.workStartTime.markAsDirty()"
            (blurred)="form.controls.workStartTime.markAsTouched()"
            [error]="form.controls.workStartTime.touched && form.controls.workStartTime.invalid ? 'Enter a valid time (HH:mm).' : ''"
          />
          <app-input
            type="time"
            label="Work end time"
            [value]="form.controls.workEndTime.value"
            (valueChange)="form.controls.workEndTime.setValue($event); form.controls.workEndTime.markAsDirty()"
            (blurred)="form.controls.workEndTime.markAsTouched()"
            [error]="form.controls.workEndTime.touched && form.controls.workEndTime.invalid ? 'Enter a valid time (HH:mm).' : ''"
          />
        </div>
        @if (form.errors?.['workTimePair'] === 'both_required') {
          <p class="gs-field-error" role="alert">Both start and end time must be set together, or leave both blank.</p>
        } @else if (form.errors?.['workTimePair'] === 'start_not_before_end') {
          <p class="gs-field-error" role="alert">Work start time must be earlier than end time (same-day only).</p>
        }
      </section>

    </form>
  }

  <!-- Sticky Save bar — always visible -->
  <div class="gs-sticky-save" role="region" aria-label="Save settings">
    <p class="gs-sticky-save__hint">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
      These settings will become the default for new employees and future records in this company.
    </p>
    <app-button type="button" (click)="onSubmit()" [loading]="submitting()" [disabled]="submitting()">Save changes</app-button>
  </div>

}
```

- [ ] **Step 3: Update the CSS**

In `general-settings.component.css`:

1. Replace the `.gs-logo-preview` rule (the one with `width: 96px; height: 96px; border: 1.5px dashed ...`) with:

```css
.gs-logo-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
```

2. Delete the now-unused `.gs-logo-preview__img` rule block (`object-fit: cover; border-radius: 10px;` etc.) — the shared component owns its own image styling.

3. Append these new rules at the end of the file:

```css
/* ── Identity card (page header) ─────────────────────────────── */
.gs-identity-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.125rem 1.5rem;
  margin-bottom: 1rem;
  border: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);
  border-radius: 12px;
  background: var(--color-surface);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
}

.gs-identity-card__left {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.gs-identity-card__text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}

.gs-identity-card__name {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gs-identity-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.gs-identity-card__code {
  padding: 0.0625rem 0.5rem;
  border-radius: 999px;
  background: var(--color-surface-secondary);
  color: var(--color-text-secondary);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.gs-identity-card__hint {
  font-size: 0.78125rem;
  color: var(--color-text-secondary);
}

.gs-status-pill {
  flex-shrink: 0;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-success) 14%, transparent);
  color: var(--color-success);
  font-size: 0.75rem;
  font-weight: 600;
}

.gs-status-pill--inactive {
  background: var(--color-danger-subtle);
  color: var(--color-danger-text);
}

@media (max-width: 640px) {
  .gs-identity-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
```

- [ ] **Step 4: Run the existing General Settings spec to check for regressions**

Run: `npx ng test --no-watch --include "src/app/modules/organization/feature/general-settings/*.spec.ts"`
Expected: all pre-existing tests still PASS (the `.gs-logo-preview` wrapper div still exists with the same class, so `.gs-logo-preview img` / `.gs-logo-preview svg` selectors in old tests keep working against the shared component's rendered `<img>`). If anything fails, it will be because a field got dropped during the section move — cross-check against the field list in the Interfaces note above and restore it.

---

### Task 4: New/updated General Settings tests

**Files:**
- Modify: `src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts`

**Interfaces:**
- Consumes: existing `setupWithLoadedSettings()` helper (company-a: name `'Company A'`, companyCode `'A'`, no logo) already defined in this file.

- [ ] **Step 1: Update the stale comment on the existing name-rendering test**

Find this test (currently ~line 104):

```typescript
  it("loads and renders the selected company's settings", async () => {
    const fixture = await setupWithLoadedSettings();

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company A');
    // The company name is a form field value (native <input> property), not static text -
    // the breadcrumb-based redesign no longer displays it as a page heading.
    const inputs: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input');
    expect(Array.from(inputs).some((el) => el.value === 'Company A')).toBe(true);
  });
```

Replace it with (the comment is now stale — the header identity card *does* show the name as a heading, so update the assertion to match reality instead of just describing the old behavior):

```typescript
  it("loads and renders the selected company's settings", async () => {
    const fixture = await setupWithLoadedSettings();

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company A');
    const inputs: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input');
    expect(Array.from(inputs).some((el) => el.value === 'Company A')).toBe(true);
    // The header identity card also shows the company name as a heading.
    expect(fixture.nativeElement.querySelector('.gs-identity-card__name')?.textContent?.trim()).toBe('Company A');
  });
```

- [ ] **Step 2: Add new tests for the redesigned header**

Add these tests to the file (e.g. directly after the test updated in Step 1):

```typescript
  it('renders the header identity card with the company name and code', async () => {
    const fixture = await setupWithLoadedSettings();

    const card = fixture.nativeElement.querySelector('.gs-identity-card');
    expect(card).toBeTruthy();
    expect(card.querySelector('.gs-identity-card__name')?.textContent?.trim()).toBe('Company A');
    expect(card.querySelector('.gs-identity-card__code')?.textContent?.trim()).toBe('A');
    expect(card.textContent).toContain('Manage company identity, regional defaults, and work settings.');
  });

  it('shows the sidebar-style initial tile (not a generic icon) in the header card when no logo exists', async () => {
    const fixture = await setupWithLoadedSettings();

    const headerTile = fixture.nativeElement.querySelector('.gs-identity-card app-company-logo-tile .company-logo-tile__initial');
    expect(headerTile?.textContent?.trim()).toBe('C');
  });

  it('shows an Active status pill once settings load, and Inactive when status is inactive', async () => {
    const fixture = await setupWithLoadedSettings();

    let pill = fixture.nativeElement.querySelector('.gs-status-pill');
    expect(pill?.textContent?.trim()).toBe('Active');
    expect(pill.classList.contains('gs-status-pill--inactive')).toBe(false);

    fixture.componentInstance.form.controls.status.setValue('inactive');
    // The pill reflects settingsStore.settings().status (server-confirmed), not the dirty form value,
    // until a save completes - so it should still read Active here.
    fixture.detectChanges();
    pill = fixture.nativeElement.querySelector('.gs-status-pill');
    expect(pill?.textContent?.trim()).toBe('Active');
  });

  it('does not render a status pill while settings are still loading', async () => {
    await setup(true);
    const loadCompaniesPromise = legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);
    await loadCompaniesPromise;

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gs-identity-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.gs-status-pill')).toBeFalsy();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    await fixture.whenStable();
  });
```

- [ ] **Step 3: Run the full spec file**

Run: `npx ng test --no-watch --include "src/app/modules/organization/feature/general-settings/*.spec.ts"`
Expected: PASS — all original tests plus the 4 new ones.

---

### Task 5: Full verification sweep

**Files:** none (verification only).

- [ ] **Step 1: Run the full test scope named in the task brief**

Run:
```bash
npx ng test --no-watch --include "src/app/modules/organization/**/*.spec.ts" --include "src/app/layouts/**/*.spec.ts" --include "src/app/shared/**/*.spec.ts"
```
Expected: all files PASS, 0 failures. If a pre-existing, unrelated failure surfaces, note it in the report rather than fixing out-of-scope code.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no new TypeScript/template errors. (Existing budget warnings, if any, are not this task's concern unless the new component pushes a bundle over an error threshold.)

- [ ] **Step 3: Check for whitespace issues in the diff**

Run: `git diff --check`
Expected: no output (no trailing-whitespace / conflict-marker issues). Fix any reported lines.

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Serve the app (`npm start`) and open `/settings/general` for a tenant with `legal_entity:update`, once with a company that has no logo and once with a company that has one. Confirm the header card tile matches the sidebar tile's look (rounded-square, same background/shadow), and that Change logo / Remove still work.

---

### Task 6: Write the report

**Files:**
- Create: `GENERAL_SETTINGS_DESIGN_REFRESH_REPORT.md` (repo root: `C:\onevoNew\Hrms--Web-application---front-end---v1\GENERAL_SETTINGS_DESIGN_REFRESH_REPORT.md`)

- [ ] **Step 1: Write the report**

Include, based on what actually happened in Tasks 1-5 (fill in real file paths/test counts/command output, not placeholders):
- Files changed (the 3 new `company-logo-tile.*` files + `general-settings.component.{ts,html,css,spec.ts}` + `side-navbar.component.{ts,html,css,spec.ts}`).
- What changed visually (header identity card, section regrouping, logo tile swap).
- How the logo was aligned with the sidebar (shared `CompanyLogoTileComponent`, sizes `sm`/`md`/`lg`).
- Explicit callout: shared component created at `src/app/shared/ui/company-logo-tile/`; both sidebar and General Settings migrated to it.
- **Flagged risk:** the sidebar's `/api/v1/files/{id}` URL vs. General Settings' `LegalEntityApiService.getLogoUrl()` scoped URL are different endpoints; not unified in this change (see Global Constraints above) — recommend a backend-informed follow-up to confirm/consolidate.
- Tests run and results (exact commands + pass counts from Task 5).
- `npm run build` result.
- Skipped checks (e.g., no live backend available for manual smoke test, if applicable).
- Remaining risks (e.g., visual review pending human eyes; dark-theme not manually screenshotted, only verified via token usage).

---

## Self-review notes (from plan authoring)

- Spec coverage: header card ✓ (Task 3), logo parity ✓ (Tasks 1-3), section regrouping ✓ (Task 3, all 20 fields accounted for), shared component + tests ✓ (Task 1), sidebar migration + tests ✓ (Task 2), General Settings tests ✓ (Task 4), verification commands ✓ (Task 5), report ✓ (Task 6). "Do not invent last-saved data" ✓ — no such field added anywhere.
- No placeholders: every step above has literal code, not descriptions.
- Type consistency: `CompanyLogoTileComponent`'s `size` type `'sm' | 'md' | 'lg'` used identically in Tasks 1-3; `name`/`logoUrl` input names match across all three call sites (sidebar, header card, logo upload block).
