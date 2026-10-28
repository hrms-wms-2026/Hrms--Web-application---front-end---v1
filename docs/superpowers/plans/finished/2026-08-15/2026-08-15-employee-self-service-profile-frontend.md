# Employee Self-Service Profile (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Profile" entry to the topbar's Preferences popup (currently only has "Appearance"), backed by a new `modules/profile` domain module, consuming the `/api/v1/employees/me/*` endpoints from the companion backend plan.

**Architecture:** Generalize `ModalComponent` (size variant) and `PreferencesModalComponent` (fully generic tabbed shell, no more hardcoded Appearance markup) so they stay legitimately in `shared/ui/`. Extract the existing Appearance content into its own small component. Add a new `modules/profile/` domain module following the canonical template, lazy-loaded via `@defer` from `ProfileMenuComponent`.

**Tech Stack:** Angular 21 standalone components, NgRx Signal Store, RxJS, Vitest (confirmed via `vi.fn()` in existing specs — not Jest, despite what the architecture doc's example config says), Reactive Forms.

## Global Constraints

- Every async panel implements all four states (loading/error/empty/data) per the architecture doc's mandatory `@if (loading) / @else if (error) / @else` pattern (already used by `EmployeeListComponent`).
- No `BehaviorSubject` in `ProfileStore` — NgRx Signal Store `withState`/`withMethods`/`patchState` only, matching `EmployeeStore`/`GeneralSettingsStore`.
- `modules/profile/` follows the canonical template exactly: `feature/`, `ui/`, `data-access/`, `state/`, `models/`, `utils/`, `<module>.routes.ts`.
- `ui/*` components never call APIs directly — only `data-access/profile-api.service.ts` calls `HttpClient`.
- Test runner is **Vitest** (`vi.fn()`, `vi.spyOn()`), matching `preferences-modal.component.spec.ts` — not Jest.
- `PUT`/`POST`/`DELETE` calls rely on the existing `csrfInterceptor`/`authInterceptor` chain already registered globally — do not add per-request credential handling in `ProfileApiService`.
- Every field name in `models/profile.model.ts` matches the backend spec's `MyProfileResponse` JSON shape exactly (see companion backend plan §Task 3).

---

### Task 1: `ModalComponent` size variant

**Files:**
- Modify: `src/app/shared/ui/modal/modal.component.ts`
- Test: `src/app/shared/ui/modal/modal.component.spec.ts`

**Interfaces:**
- Produces: `size = input<'md' | 'xl'>('md')` — consumed by Task 2's `PreferencesModalComponent`.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('ModalComponent', ...)` block in `modal.component.spec.ts`:

```typescript
  it('defaults to the md size class', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-md')).toBe(true);
    expect(dialog.classList.contains('max-w-5xl')).toBe(false);
  });

  it('applies the xl size class when size="xl"', async () => {
    @Component({
      standalone: true,
      imports: [ModalComponent],
      template: `<app-modal [open]="true" size="xl"><p>content</p></app-modal>`
    })
    class XlHostComponent {}

    await TestBed.configureTestingModule({ imports: [XlHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(XlHostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-5xl')).toBe(true);
    expect(dialog.classList.contains('max-w-md')).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- modal.component.spec.ts`
Expected: FAIL — `size` input does not exist yet, `max-w-5xl` class never applied.

- [ ] **Step 3: Implement the size input**

In `modal.component.ts`, change the dialog `<div>`'s class binding and add the input:

```typescript
import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { nextUniqueId } from '../../utils/unique-id';

@Component({
  selector: 'app-modal',
  standalone: true,
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[1200] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/50" (click)="onBackdropClick()"></div>
        <div
          #dialog
          class="relative z-10 w-full rounded-lg bg-[var(--color-surface)] p-6 shadow-lg outline-none"
          [class.max-w-md]="size() === 'md'"
          [class.max-w-5xl]="size() === 'xl'"
          [class.max-h-\\[85vh\\]]="size() === 'xl'"
          [class.overflow-y-auto]="size() === 'xl'"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-labelledby]="title() ? titleId : null"
          (keydown.escape)="closed.emit()"
        >
          <div class="mb-4 flex items-start justify-between gap-4">
            @if (title()) {
              <h2 [id]="titleId" class="text-lg font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
            }
            <button
              type="button"
              class="text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
              aria-label="Close"
              (click)="closed.emit()"
            >
              &#x2715;
            </button>
          </div>
          <ng-content />
        </div>
      </div>
    }
  `
})
export class ModalComponent {
  open = input(false);
  title = input<string>('');
  closeOnBackdropClick = input(true);
  size = input<'md' | 'xl'>('md');
  closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLElement>>('dialog');
  readonly titleId = nextUniqueId('app-modal-title');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.dialogRef()?.nativeElement.focus();
      }
    });
  }

  onBackdropClick(): void {
    if (this.closeOnBackdropClick()) {
      this.closed.emit();
    }
  }
}
```

(Note: `[class.max-h-\[85vh\]]` uses Tailwind's arbitrary-value bracket syntax escaped for the Angular class binding attribute name — verify this renders correctly in Step 4; if the bracket syntax causes template parsing issues, use a plain CSS class `.modal-dialog--xl { max-height: 85vh; overflow-y: auto; }` in a component stylesheet instead and bind `[class.modal-dialog--xl]="size() === 'xl'"`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- modal.component.spec.ts`
Expected: PASS — all previously-passing tests still pass (default `md` behavior unchanged), plus the two new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/ui/modal/modal.component.ts src/app/shared/ui/modal/modal.component.spec.ts
git commit -m "feat: add size variant to ModalComponent for larger dialog content"
```

---

### Task 2: Generalize `PreferencesModalComponent`, extract `AppearancePanelComponent`

**Files:**
- Modify: `src/app/shared/ui/preferences-modal/preferences-modal.component.ts`
- Modify: `src/app/shared/ui/preferences-modal/preferences-modal.component.css`
- Modify: `src/app/shared/ui/preferences-modal/preferences-modal.component.spec.ts`
- Create: `src/app/shared/ui/appearance-panel/appearance-panel.component.ts`
- Create: `src/app/shared/ui/appearance-panel/appearance-panel.component.css`
- Create: `src/app/shared/ui/appearance-panel/appearance-panel.component.spec.ts`

**Interfaces:**
- Consumes: `ModalComponent` with `size` (Task 1).
- Produces: `PreferencesModalComponent` with `[tabs]`, `[activeTabId]`, `(activeTabIdChange)`, `[size]`, `(closed)`, single `<ng-content>` slot — consumed by Task 3's `ProfileMenuComponent`.

- [ ] **Step 1: Write the failing test for the generic shell**

Replace the entire contents of `preferences-modal.component.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { PreferencesModalComponent, PreferenceTab } from './preferences-modal.component';

@Component({
  standalone: true,
  imports: [PreferencesModalComponent],
  template: `
    <app-preferences-modal
      [open]="open()"
      [tabs]="tabs"
      [activeTabId]="activeTabId()"
      (activeTabIdChange)="activeTabId.set($event)"
      (closed)="closedCount = closedCount + 1"
    >
      <p>Panel for {{ activeTabId() }}</p>
    </app-preferences-modal>
  `
})
class HostComponent {
  open = signal(true);
  activeTabId = signal('tab-a');
  closedCount = 0;
  tabs: readonly PreferenceTab[] = [
    { id: 'tab-a', label: 'Tab A', icon: 'palette' },
    { id: 'tab-b', label: 'Tab B', icon: 'user' }
  ];
}

describe('PreferencesModalComponent', () => {
  it('does not render when open is false', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeFalsy();
  });

  it('renders one sidebar button per tab and projects the active panel content', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.preferences-tab-btn');
    expect(buttons.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Panel for tab-a');
  });

  it('emits activeTabIdChange when a different tab is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('.preferences-tab-btn'));
    buttons[1].nativeElement.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTabId()).toBe('tab-b');
    expect(fixture.nativeElement.textContent).toContain('Panel for tab-b');
  });

  it('applies the requested modal size', async () => {
    @Component({
      standalone: true,
      imports: [PreferencesModalComponent],
      template: `<app-preferences-modal [open]="true" [tabs]="tabs" [activeTabId]="'tab-a'" size="xl"><p>x</p></app-preferences-modal>`
    })
    class XlHostComponent {
      tabs: readonly PreferenceTab[] = [{ id: 'tab-a', label: 'Tab A', icon: 'user' }];
    }

    await TestBed.configureTestingModule({ imports: [XlHostComponent] }).compileComponents();
    const fixture = TestBed.createComponent(XlHostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.classList.contains('max-w-5xl')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- preferences-modal.component.spec.ts`
Expected: FAIL — `PreferencesModalComponent` still hardcodes Appearance content and has no `[tabs]`/`[activeTabId]`/`(activeTabIdChange)` inputs/outputs.

- [ ] **Step 3: Implement the generic shell**

```typescript
// src/app/shared/ui/preferences-modal/preferences-modal.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ModalComponent } from '../modal/modal.component';

export interface PreferenceTab {
  id: string;
  label: string;
  icon: 'palette' | 'bell' | 'user' | 'cog';
}

const TAB_ICON_PATHS: Record<PreferenceTab['icon'], string> = {
  palette: 'M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.2-1.5 4-3.5 4-1 0-1.5-.5-2-1-.4-.4-.8-.9-1.5-.9H12a2 2 0 0 0-2 2c0 2.5 2 3.9 2 5.9Z',
  user: 'M20 21a8 8 0 1 0-16 0 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'
};

@Component({
  selector: 'app-preferences-modal',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" title="Preferences" [size]="size()" (closed)="closed.emit()">
      <div class="preferences-container">
        <nav class="preferences-sidebar" aria-label="Preferences categories">
          @for (tab of tabs(); track tab.id) {
            <button
              type="button"
              class="preferences-tab-btn"
              [class.preferences-tab-btn--active]="activeTabId() === tab.id"
              [attr.aria-selected]="activeTabId() === tab.id"
              (click)="selectTab(tab.id)"
            >
              <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path [attr.d]="tabIconPath(tab.icon)"/>
              </svg>
              <span>{{ tab.label }}</span>
            </button>
          }
        </nav>

        <div class="preferences-content">
          <ng-content />
        </div>
      </div>
    </app-modal>
  `,
  styleUrl: './preferences-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesModalComponent {
  readonly open = input(false);
  readonly tabs = input<readonly PreferenceTab[]>([]);
  readonly activeTabId = input<string>('');
  readonly size = input<'md' | 'xl'>('md');
  readonly activeTabIdChange = output<string>();
  readonly closed = output<void>();

  selectTab(id: string): void {
    this.activeTabIdChange.emit(id);
  }

  tabIconPath(icon: PreferenceTab['icon']): string {
    return TAB_ICON_PATHS[icon];
  }
}
```

Remove the now-unused `THEME_PRESETS`/`ThemeStore`/`ThemePresetId` imports and the `currentPreset`/`themePresets`/`onSelectTheme` members entirely — none of that belongs in this component anymore.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- preferences-modal.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing test for the extracted Appearance panel**

```typescript
// src/app/shared/ui/appearance-panel/appearance-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AppearancePanelComponent } from './appearance-panel.component';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { ThemePresetId } from '../../../core/theme/models/theme-preset.model';

describe('AppearancePanelComponent', () => {
  it('renders 5 theme preset options', async () => {
    await TestBed.configureTestingModule({
      imports: [AppearancePanelComponent],
      providers: [{ provide: ThemeStore, useValue: { preset: signal<ThemePresetId>('default'), setPreset: vi.fn() } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppearancePanelComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[role="radio"]').length).toBe(5);
  });

  it('calls ThemeStore.setPreset when a theme option is selected', async () => {
    const setPreset = vi.fn();
    await TestBed.configureTestingModule({
      imports: [AppearancePanelComponent],
      providers: [{ provide: ThemeStore, useValue: { preset: signal<ThemePresetId>('default'), setPreset } }]
    }).compileComponents();

    const fixture = TestBed.createComponent(AppearancePanelComponent);
    fixture.detectChanges();

    const emeraldOption = Array.from(fixture.nativeElement.querySelectorAll('[role="radio"]')).find((el) =>
      (el as HTMLElement).textContent?.includes('Emerald')
    ) as HTMLElement;

    emeraldOption.click();
    expect(setPreset).toHaveBeenCalledWith('emerald');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test -- appearance-panel.component.spec.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 7: Implement the extracted Appearance panel**

```typescript
// src/app/shared/ui/appearance-panel/appearance-panel.component.ts
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemeStore } from '../../../core/theme/state/theme.store';
import { THEME_PRESETS, ThemePresetId } from '../../../core/theme/models/theme-preset.model';

@Component({
  selector: 'app-appearance-panel',
  standalone: true,
  template: `
    <section class="preference-section" aria-labelledby="appearance-heading">
      <div class="section-header">
        <h3 id="appearance-heading" class="section-title">Appearance</h3>
        <p class="section-description">
          Customize the look and feel of your application workspace.
        </p>
      </div>

      <div class="theme-presets-container">
        <label class="preset-group-label">Theme Presets</label>
        <div class="theme-presets-grid" role="radiogroup" aria-label="Theme Presets">
          @for (preset of themePresets; track preset.id) {
            <button
              type="button"
              role="radio"
              class="preset-card"
              [class.preset-card--selected]="currentPreset() === preset.id"
              [attr.aria-checked]="currentPreset() === preset.id"
              (click)="onSelectTheme(preset.id)"
            >
              <div class="preset-swatch-wrapper">
                <span class="preset-swatch" [attr.data-preset]="preset.id"></span>
              </div>
              <div class="preset-info">
                <span class="preset-name">{{ preset.label }}</span>
              </div>
              @if (currentPreset() === preset.id) {
                <svg class="preset-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              }
            </button>
          }
        </div>
      </div>
    </section>
  `,
  styleUrl: './appearance-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppearancePanelComponent {
  private readonly themeStore = inject(ThemeStore);

  readonly currentPreset = this.themeStore.preset;
  readonly themePresets = THEME_PRESETS;

  onSelectTheme(presetId: ThemePresetId): void {
    this.themeStore.setPreset(presetId);
  }
}
```

Move the theme-preset-related CSS rules (`.preference-section`, `.section-header`, `.section-title`, `.section-description`, `.theme-presets-container`, `.preset-group-label`, `.theme-presets-grid`, `.preset-card*`, `.preset-swatch*`, `.preset-info`, `.preset-name`, `.preset-check-icon`) from `preferences-modal.component.css` into `appearance-panel.component.css` verbatim — leave only `.preferences-container`, `.preferences-sidebar`, `.preferences-tab-btn*`, `.tab-icon`, `.preferences-content` in `preferences-modal.component.css`.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- appearance-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/shared/ui/preferences-modal/ src/app/shared/ui/appearance-panel/
git commit -m "refactor: generalize PreferencesModalComponent into a domain-agnostic tabbed shell, extract AppearancePanelComponent"
```

---

### Task 3: Wire `ProfileMenuComponent` with Appearance + Profile tabs

**Files:**
- Modify: `src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.ts`
- Modify: `src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.html`
- Modify: `src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.spec.ts`

**Interfaces:**
- Consumes: `PreferencesModalComponent`, `AppearancePanelComponent` (Task 2). References (not yet implemented) `ProfileTabComponent` from `modules/profile/feature/profile-tab/profile-tab.component` via a dynamic `import()` inside `@defer` — this task compiles and is independently testable with a stub `@defer` block even before Task 6 creates the real component, because `@defer`'s dynamic import is resolved lazily at runtime, not at this task's build/test time (the block simply never triggers in tests that don't set `activeTabId` to `'profile'`).

- [ ] **Step 1: Write the failing test**

Add to `profile-menu.component.spec.ts` (create the file if it doesn't already cover this; otherwise extend the existing `describe` block):

```typescript
  it('opens the Preferences modal on the Appearance tab by default', async () => {
    // ... existing TestBed setup for ProfileMenuComponent ...
    const component = fixture.componentInstance;
    component.openPreferences();
    fixture.detectChanges();

    expect(component.activeTabId()).toBe('appearance');
  });

  it('switches to the Profile tab when "My Profile" is clicked', async () => {
    const component = fixture.componentInstance;
    component.openPreferences('profile');
    fixture.detectChanges();

    expect(component.activeTabId()).toBe('profile');
  });
```

(Match these two cases into whatever `TestBed.configureTestingModule` setup already exists in the file for `ProfileMenuComponent` — if no spec file exists yet for this component, create one following `preferences-modal.component.spec.ts`'s provider-mocking pattern for `AuthStore`/`NotificationService`/`Router`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profile-menu.component.spec.ts`
Expected: FAIL — `openPreferences` does not accept a tab argument, `activeTabId` signal does not exist.

- [ ] **Step 3: Implement the wiring**

```typescript
// src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.ts
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { PreferencesModalComponent, PreferenceTab } from '../../../../shared/ui/preferences-modal/preferences-modal.component';
import { AppearancePanelComponent } from '../../../../shared/ui/appearance-panel/appearance-panel.component';

@Component({
  selector: 'app-profile-menu',
  standalone: true,
  imports: [PopoverComponent, AvatarComponent, PreferencesModalComponent, AppearancePanelComponent],
  templateUrl: './profile-menu.component.html',
  styleUrl: './profile-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileMenuComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  readonly avatarUrl = input<string | null | undefined>(undefined);
  readonly userName = input<string | null | undefined>(undefined);
  readonly email = input<string | null | undefined>(undefined);

  readonly isOpen = signal(false);
  readonly isPreferencesOpen = signal(false);
  readonly activeTabId = signal<'appearance' | 'profile'>('appearance');

  readonly preferenceTabs: readonly PreferenceTab[] = [
    { id: 'appearance', label: 'Appearance', icon: 'palette' },
    { id: 'profile', label: 'Profile', icon: 'user' }
  ];

  readonly modalSize = computed<'md' | 'xl'>(() => (this.activeTabId() === 'profile' ? 'xl' : 'md'));

  readonly displayName = computed(() => {
    const name = this.userName()?.trim();
    if (name) return name;

    const mail = this.email()?.trim();
    if (mail) {
      const localPart = mail.split('@')[0];
      const words = localPart.split(/[._-]/).filter(Boolean);
      if (words.length > 0) {
        return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    return 'Account';
  });

  toggle(): void {
    this.isOpen.update((open) => !open);
  }

  close(): void {
    this.isOpen.set(false);
  }

  openPreferences(tabId: 'appearance' | 'profile' = 'appearance'): void {
    this.close();
    this.activeTabId.set(tabId);
    this.isPreferencesOpen.set(true);
  }

  closePreferences(): void {
    this.isPreferencesOpen.set(false);
  }

  onActiveTabIdChange(tabId: string): void {
    if (tabId === 'appearance' || tabId === 'profile') {
      this.activeTabId.set(tabId);
    }
  }

  async onLogout(): Promise<void> {
    this.close();
    const success = await this.authStore.logout();
    if (success) {
      await this.router.navigate(['/auth/login']);
    } else {
      this.notificationService.error('Could not log out. Try again.');
    }
  }
}
```

```html
<!-- src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.html -->
<app-popover [open]="isOpen()" ariaLabel="Profile menu" (closed)="close()">
  <button
    popover-trigger
    type="button"
    class="profile-menu-trigger"
    aria-haspopup="menu"
    [attr.aria-expanded]="isOpen()"
    aria-label="Profile and settings"
    (click)="toggle()"
  >
    <div class="profile-avatar-wrapper">
      <app-avatar [avatarUrl]="avatarUrl()" [userName]="userName()" [email]="email()" size="sm" />
      <span class="profile-online-badge" title="Online"></span>
    </div>

    <svg
      class="profile-menu-chevron"
      [class.profile-menu-chevron--open]="isOpen()"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m6 9 6 6 6-6"/>
    </svg>
  </button>

  <div popover-panel class="profile-popover-panel">
    <section class="profile-header-section">
      <app-avatar [avatarUrl]="avatarUrl()" [userName]="userName()" [email]="email()" size="lg" />
      <div class="profile-user-details">
        <span class="profile-user-name">{{ displayName() }}</span>
        @if (email()) {
          <span class="profile-user-email">{{ email() }}</span>
        }
      </div>
    </section>

    <div class="profile-popover-divider"></div>

    <section class="profile-actions-section">
      <button type="button" class="profile-action-btn" (click)="openPreferences('profile')">
        <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21a8 8 0 1 0-16 0"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <span>My Profile</span>
      </button>

      <button type="button" class="profile-action-btn" (click)="openPreferences('appearance')">
        <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.2-1.5 4-3.5 4-1 0-1.5-.5-2-1-.4-.4-.8-.9-1.5-.9H12a2 2 0 0 0-2 2c0 2.5 2 3.9 2 5.9Z"/>
          <circle cx="7.5" cy="10.5" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="7.5" r="1.5" fill="currentColor"/>
          <circle cx="16.5" cy="10.5" r="1.5" fill="currentColor"/>
        </svg>
        <span>Appearance</span>
      </button>

      <div class="profile-popover-divider"></div>

      <button type="button" class="profile-action-btn profile-action-btn--logout" (click)="onLogout()">
        <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span>Log out</span>
      </button>
    </section>
  </div>
</app-popover>

<app-preferences-modal
  [open]="isPreferencesOpen()"
  [tabs]="preferenceTabs"
  [activeTabId]="activeTabId()"
  [size]="modalSize()"
  (activeTabIdChange)="onActiveTabIdChange($event)"
  (closed)="closePreferences()"
>
  @if (activeTabId() === 'appearance') {
    <app-appearance-panel />
  }
  @if (activeTabId() === 'profile') {
    @defer (when isPreferencesOpen() && activeTabId() === 'profile') {
      <!-- Real ProfileTabComponent wired in Task 6 once modules/profile/feature/profile-tab exists. -->
    } @placeholder {
      <div class="skeleton-rows" aria-busy="true" aria-label="Loading profile"></div>
    }
  }
</app-preferences-modal>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- profile-menu.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/layouts/main-layout/top-navbar/profile-menu/
git commit -m "feat: add My Profile tab to the topbar profile menu, wire generic Preferences modal"
```

---

### Task 4: `modules/profile` models + data-access API service

**Files:**
- Create: `src/app/modules/profile/models/profile.model.ts`
- Create: `src/app/modules/profile/data-access/profile-api.service.ts`
- Create: `src/app/modules/profile/data-access/profile-api.service.spec.ts`

**Interfaces:**
- Produces: `MyProfile`, `PersonalInformation`, `Address`, `JobInformation`, `EmergencyContact`, `Dependent`, `PayrollInfo`, `SecurityInfo` models; `ProfileApiService` with one method per backend endpoint from the companion backend plan (Tasks 3–10) — consumed by Task 5's `ProfileStore`.

- [ ] **Step 1: Write the models**

```typescript
// src/app/modules/profile/models/profile.model.ts
export interface Address {
  id: string;
  addressType: 'permanent' | 'current';
  addressJson: string;
  isPrimary: boolean;
}

export interface PersonalInformation {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationalityId: string | null;
  countryName: string | null;
  displayTimezone: string | null;
  avatarUrl: string | null;
  addresses: Address[];
  version: string;
}

export interface JobInformation {
  employeeNumber: string;
  legalEntityName: string | null;
  departmentName: string | null;
  positionName: string | null;
  reportingManagerName: string | null;
  employmentTypeLabel: string;
  employmentStatus: string;
  hireDate: string;
  probationEndDate: string | null;
  workMode: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

export interface Dependent {
  id: string;
  name: string;
  relationship: 'spouse' | 'child' | 'parent' | 'other';
  dateOfBirth: string;
  isEmergencyContact: boolean;
  phone: string | null;
}

export interface PayrollInfo {
  hasBankDetailsOnFile: boolean;
  bankName: string | null;
  maskedAccountNumber: string | null;
  accountType: string | null;
  canEdit: boolean;
}

export interface SecurityInfo {
  mfaEnabled: boolean;
  lastPasswordChangedAt: string | null;
}

export interface MyProfile {
  personalInformation: PersonalInformation;
  jobInformation: JobInformation;
  emergencyContacts: EmergencyContact[];
  dependents: Dependent[];
  payroll: PayrollInfo;
  security: SecurityInfo;
}

export interface UpdatePersonalInformationRequest {
  firstName: string;
  lastName: string;
  phone: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  nationalityId: string | null;
  displayTimezone: string | null;
  addresses: Array<{ addressType: 'permanent' | 'current'; addressJson: string; isPrimary: boolean }>;
  version: string;
}

export interface UpsertEmergencyContactRequest {
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

export interface UpsertDependentRequest {
  name: string;
  relationship: Dependent['relationship'];
  dateOfBirth: string;
  isEmergencyContact: boolean;
  phone: string | null;
}

export interface UpdateBankDetailsRequest {
  bankName: string;
  branchName: string;
  accountHolderName: string;
  accountNumber: string;
  accountType: string;
  routingNumber: string | null;
}
```

- [ ] **Step 2: Write the failing API service test**

```typescript
// src/app/modules/profile/data-access/profile-api.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProfileApiService } from './profile-api.service';
import { environment } from '../../../../environments/environment';

describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMyProfile GETs /employees/me', () => {
    service.getMyProfile().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('addEmergencyContact POSTs to /employees/me/emergency-contacts', () => {
    service.addEmergencyContact({ name: 'Jane', relationship: 'spouse', phone: '555-1111', email: null, isPrimary: true }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me/emergency-contacts`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'new-id' });
  });

  it('uploadAvatar PUTs multipart form data to /employees/me/avatar', () => {
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    service.uploadAvatar(file).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me/avatar`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ avatarFileId: 'file-id' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- profile-api.service.spec.ts`
Expected: FAIL — `ProfileApiService` does not exist.

- [ ] **Step 4: Implement the API service**

```typescript
// src/app/modules/profile/data-access/profile-api.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Dependent,
  EmergencyContact,
  MyProfile,
  PayrollInfo,
  UpdateBankDetailsRequest,
  UpdatePersonalInformationRequest,
  UpsertDependentRequest,
  UpsertEmergencyContactRequest
} from '../models/profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/employees/me`;

  getMyProfile(): Observable<MyProfile> {
    return this.http.get<MyProfile>(this.base);
  }

  updatePersonalInformation(payload: UpdatePersonalInformationRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/personal-information`, payload);
  }

  uploadAvatar(file: File): Observable<{ avatarFileId: string | null }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.put<{ avatarFileId: string | null }>(`${this.base}/avatar`, formData);
  }

  addEmergencyContact(payload: UpsertEmergencyContactRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/emergency-contacts`, payload);
  }

  updateEmergencyContact(id: string, payload: UpsertEmergencyContactRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/emergency-contacts/${id}`, payload);
  }

  deleteEmergencyContact(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/emergency-contacts/${id}`);
  }

  addDependent(payload: UpsertDependentRequest): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/dependents`, payload);
  }

  updateDependent(id: string, payload: UpsertDependentRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/dependents/${id}`, payload);
  }

  deleteDependent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/dependents/${id}`);
  }

  getPayroll(): Observable<PayrollInfo> {
    return this.http.get<PayrollInfo>(`${this.base}/payroll`);
  }

  updatePayroll(payload: UpdateBankDetailsRequest): Observable<void> {
    return this.http.put<void>(`${this.base}/payroll`, payload);
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${environment.apiUrl}/auth/change-password`, { currentPassword, newPassword });
  }

  enableMfa(): Observable<{ secret: string; qrCodeUri: string }> {
    return this.http.post<{ secret: string; qrCodeUri: string }>(`${environment.apiUrl}/auth/mfa/enable`, {});
  }

  confirmMfaSetup(code: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/auth/mfa/confirm-setup`, { code });
  }

  disableMfa(currentPassword: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${environment.apiUrl}/auth/mfa/disable`, { currentPassword });
  }
}
```

(`EmergencyContact`/`Dependent` type imports above are unused by the service body itself but kept available for future strongly-typed list responses if `getMyProfile()`'s return type is narrowed per-section later — remove the two unused imports if the linter flags them, since `MyProfile` already carries both nested.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- profile-api.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Fix lint (remove unused imports if flagged)**

Run: `npm run lint -- --fix`
Expected: No errors. If `EmergencyContact`/`Dependent` are flagged unused, delete those two import names from the import statement.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/profile/models/ src/app/modules/profile/data-access/
git commit -m "feat: add profile models and ProfileApiService for employees/me endpoints"
```

---

### Task 5: `ProfileStore` (NgRx Signal Store)

**Files:**
- Create: `src/app/modules/profile/state/profile.store.ts`
- Create: `src/app/modules/profile/state/profile.store.spec.ts`

**Interfaces:**
- Consumes: `ProfileApiService` (Task 4).
- Produces: `ProfileStore` with `profile`, `loading`, `error`, `saving` signals and `loadProfile()`, `savePersonalInformation()`, `uploadAvatar()`, `addEmergencyContact()`, `updateEmergencyContact()`, `removeEmergencyContact()`, `addDependent()`, `updateDependent()`, `removeDependent()`, `savePayroll()`, `changePassword()`, `enableMfa()`, `confirmMfaSetup()`, `disableMfa()` — consumed by every `ui/*-panel` component in Tasks 7–11.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/modules/profile/state/profile.store.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProfileStore } from './profile.store';
import { ProfileApiService } from '../data-access/profile-api.service';
import { MyProfile } from '../models/profile.model';

const sampleProfile: MyProfile = {
  personalInformation: {
    firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: null,
    dateOfBirth: null, gender: null, nationalityId: null, countryName: null,
    displayTimezone: null, avatarUrl: null, addresses: [], version: '1'
  },
  jobInformation: {
    employeeNumber: 'EMP-001', legalEntityName: 'Acme', departmentName: null, positionName: null,
    reportingManagerName: null, employmentTypeLabel: 'Full-time', employmentStatus: 'active',
    hireDate: '2024-01-01', probationEndDate: null, workMode: 'onsite'
  },
  emergencyContacts: [],
  dependents: [],
  payroll: { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: false },
  security: { mfaEnabled: false, lastPasswordChangedAt: null }
};

describe('ProfileStore', () => {
  let store: InstanceType<typeof ProfileStore>;
  let apiMock: { getMyProfile: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    apiMock = { getMyProfile: vi.fn() };
    TestBed.configureTestingModule({
      providers: [ProfileStore, { provide: ProfileApiService, useValue: apiMock }]
    });
    store = TestBed.inject(ProfileStore);
  });

  it('loads the profile successfully', async () => {
    apiMock.getMyProfile.mockReturnValue(of(sampleProfile));
    await store.loadProfile();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.profile()?.personalInformation.firstName).toBe('Jane');
  });

  it('sets error state on load failure', async () => {
    apiMock.getMyProfile.mockReturnValue(throwError(() => new Error('Network error')));
    await store.loadProfile();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('Network error');
    expect(store.profile()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profile.store.spec.ts`
Expected: FAIL — `ProfileStore` does not exist.

- [ ] **Step 3: Implement the store**

```typescript
// src/app/modules/profile/state/profile.store.ts
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ProfileApiService } from '../data-access/profile-api.service';
import {
  MyProfile,
  UpdateBankDetailsRequest,
  UpdatePersonalInformationRequest,
  UpsertDependentRequest,
  UpsertEmergencyContactRequest
} from '../models/profile.model';
import { toSafeErrorMessage } from '../../../core/services/error-handler.service';

export interface ProfileState {
  readonly profile: MyProfile | null;
  readonly loading: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly saveError: string | null;
}

const initialState: ProfileState = {
  profile: null,
  loading: false,
  saving: false,
  error: null,
  saveError: null
};

export const ProfileStore = signalStore(
  { providedIn: 'root' },
  withState<ProfileState>(initialState),
  withMethods((store, api = inject(ProfileApiService)) => ({
    async loadProfile(): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const profile = await firstValueFrom(api.getMyProfile());
        patchState(store, { profile, loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: toSafeErrorMessage(err, 'Failed to load profile.') });
      }
    },

    async savePersonalInformation(payload: UpdatePersonalInformationRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updatePersonalInformation(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to save personal information.') });
        return false;
      }
    },

    async uploadAvatar(file: File): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        const result = await firstValueFrom(api.uploadAvatar(file));
        const current = store.profile();
        if (current) {
          patchState(store, {
            profile: { ...current, personalInformation: { ...current.personalInformation, avatarUrl: result.avatarFileId } },
            saving: false
          });
        } else {
          patchState(store, { saving: false });
        }
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to upload avatar.') });
        return false;
      }
    },

    async addEmergencyContact(payload: UpsertEmergencyContactRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.addEmergencyContact(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to add emergency contact.') });
        return false;
      }
    },

    async updateEmergencyContact(id: string, payload: UpsertEmergencyContactRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updateEmergencyContact(id, payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to update emergency contact.') });
        return false;
      }
    },

    async removeEmergencyContact(id: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.deleteEmergencyContact(id));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to remove emergency contact.') });
        return false;
      }
    },

    async addDependent(payload: UpsertDependentRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.addDependent(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to add dependent.') });
        return false;
      }
    },

    async updateDependent(id: string, payload: UpsertDependentRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updateDependent(id, payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to update dependent.') });
        return false;
      }
    },

    async removeDependent(id: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.deleteDependent(id));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to remove dependent.') });
        return false;
      }
    },

    async savePayroll(payload: UpdateBankDetailsRequest): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.updatePayroll(payload));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to save payroll details.') });
        return false;
      }
    },

    async changePassword(currentPassword: string, newPassword: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.changePassword(currentPassword, newPassword));
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to change password.') });
        return false;
      }
    },

    async enableMfa(): Promise<{ secret: string; qrCodeUri: string } | null> {
      patchState(store, { saving: true, saveError: null });
      try {
        const result = await firstValueFrom(api.enableMfa());
        patchState(store, { saving: false });
        return result;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to start MFA setup.') });
        return null;
      }
    },

    async confirmMfaSetup(code: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.confirmMfaSetup(code));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Invalid verification code.') });
        return false;
      }
    },

    async disableMfa(currentPassword: string): Promise<boolean> {
      patchState(store, { saving: true, saveError: null });
      try {
        await firstValueFrom(api.disableMfa(currentPassword));
        await this.loadProfile();
        patchState(store, { saving: false });
        return true;
      } catch (err) {
        patchState(store, { saving: false, saveError: toSafeErrorMessage(err, 'Failed to disable MFA.') });
        return false;
      }
    }
  }))
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- profile.store.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/profile/state/
git commit -m "feat: add ProfileStore with load and per-section save methods"
```

---

### Task 6: `feature/profile-tab` root panel + sub-tab navigation

**Files:**
- Create: `src/app/modules/profile/feature/profile-tab/profile-tab.component.ts`
- Create: `src/app/modules/profile/feature/profile-tab/profile-tab.component.html`
- Create: `src/app/modules/profile/feature/profile-tab/profile-tab.component.css`
- Create: `src/app/modules/profile/feature/profile-tab/profile-tab.component.spec.ts`
- Modify: `src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.html` (wire the real `@defer` import)

**Interfaces:**
- Consumes: `ProfileStore` (Task 5). References `ui/personal-info-form`, `ui/job-info-panel`, `ui/emergency-contacts-panel`, `ui/dependents-panel`, `ui/payroll-panel`, `ui/security-panel` (Tasks 7–11) — this task creates the sub-tab shell that composes them; the individual panel components are stubbed here with a minimal placeholder selector and filled in by their own tasks, matching how Task 3 stubbed the `@defer` block for this component.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/modules/profile/feature/profile-tab/profile-tab.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ProfileTabComponent } from './profile-tab.component';
import { ProfileStore } from '../../state/profile.store';

describe('ProfileTabComponent', () => {
  it('shows a loading skeleton while the profile loads', async () => {
    const storeMock = { profile: signal(null), loading: signal(true), error: signal(null), loadProfile: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileTabComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it('shows an error banner when loading fails', async () => {
    const storeMock = { profile: signal(null), loading: signal(false), error: signal('Failed to load profile.'), loadProfile: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileTabComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Failed to load profile.');
  });

  it('renders 5 sub-tab buttons once loaded', async () => {
    const storeMock = {
      profile: signal({ personalInformation: {}, jobInformation: {}, emergencyContacts: [], dependents: [], payroll: {}, security: {} }),
      loading: signal(false), error: signal(null), loadProfile: vi.fn()
    };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfileTabComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.profile-subtab-btn').length).toBe(5);
  });

  it('calls loadProfile on init', async () => {
    const storeMock = { profile: signal(null), loading: signal(false), error: signal(null), loadProfile: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ProfileTabComponent],
      providers: [{ provide: ProfileStore, useValue: storeMock }]
    }).compileComponents();

    TestBed.createComponent(ProfileTabComponent).detectChanges();
    expect(storeMock.loadProfile).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- profile-tab.component.spec.ts`
Expected: FAIL — `ProfileTabComponent` does not exist.

- [ ] **Step 3: Implement the shell (with stub panels — real panels wired in Tasks 7–11)**

```typescript
// src/app/modules/profile/feature/profile-tab/profile-tab.component.ts
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ProfileStore } from '../../state/profile.store';

type ProfileSubTab = 'personal' | 'emergency' | 'job' | 'payroll' | 'security';

@Component({
  selector: 'app-profile-tab',
  standalone: true,
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileTabComponent implements OnInit {
  readonly store = inject(ProfileStore);

  readonly activeSubTab = signal<ProfileSubTab>('personal');

  readonly subTabs: ReadonlyArray<{ id: ProfileSubTab; label: string }> = [
    { id: 'personal', label: 'Personal Information' },
    { id: 'emergency', label: 'Emergency Contact & Dependents' },
    { id: 'job', label: 'Job Information' },
    { id: 'payroll', label: 'Payroll & Statutory' },
    { id: 'security', label: 'Security Settings' }
  ];

  ngOnInit(): void {
    this.store.loadProfile();
  }

  selectSubTab(id: ProfileSubTab): void {
    this.activeSubTab.set(id);
  }
}
```

```html
<!-- src/app/modules/profile/feature/profile-tab/profile-tab.component.html -->
@if (store.loading()) {
  <div class="skeleton-rows" aria-busy="true" aria-label="Loading profile"></div>
} @else if (store.error()) {
  <div class="profile-error-banner">
    <p>{{ store.error() }}</p>
    <button type="button" (click)="store.loadProfile()">Retry</button>
  </div>
} @else if (store.profile(); as profile) {
  <div class="profile-tab-container">
    <nav class="profile-subtab-nav" aria-label="Profile sections">
      @for (tab of subTabs; track tab.id) {
        <button
          type="button"
          class="profile-subtab-btn"
          [class.profile-subtab-btn--active]="activeSubTab() === tab.id"
          [attr.aria-selected]="activeSubTab() === tab.id"
          (click)="selectSubTab(tab.id)"
        >
          {{ tab.label }}
        </button>
      }
    </nav>

    <div class="profile-subtab-content">
      <!-- Task 7 wires <app-personal-info-form> here when activeSubTab() === 'personal' -->
      <!-- Task 9 wires <app-emergency-contacts-panel>/<app-dependents-panel> here for 'emergency' -->
      <!-- Task 8 wires <app-job-info-panel> here for 'job' -->
      <!-- Task 10 wires <app-payroll-panel> here for 'payroll' -->
      <!-- Task 11 wires <app-security-panel> here for 'security' -->
      @if (activeSubTab() === 'personal') {
        <p>Personal Information panel — implemented in Task 7.</p>
      }
      @if (activeSubTab() === 'emergency') {
        <p>Emergency Contact &amp; Dependents panel — implemented in Task 9.</p>
      }
      @if (activeSubTab() === 'job') {
        <p>Job Information panel — implemented in Task 8.</p>
      }
      @if (activeSubTab() === 'payroll') {
        <p>Payroll &amp; Statutory panel — implemented in Task 10.</p>
      }
      @if (activeSubTab() === 'security') {
        <p>Security Settings panel — implemented in Task 11.</p>
      }
    </div>
  </div>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- profile-tab.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the real `@defer` import in `ProfileMenuComponent`**

Replace the placeholder `@defer` block from Task 3's `profile-menu.component.html` with:

```html
  @if (activeTabId() === 'profile') {
    @defer (when isPreferencesOpen() && activeTabId() === 'profile') {
      @if (profileTabComponent(); as Cmp) {
        <ng-container *ngComponentOutlet="Cmp" />
      }
    } @placeholder {
      <div class="skeleton-rows" aria-busy="true" aria-label="Loading profile"></div>
    }
  }
```

This requires `NgComponentOutlet` and a resolved-component signal in `ProfileMenuComponent`. Add to `profile-menu.component.ts`:

```typescript
import { NgComponentOutlet } from '@angular/common';
import { Type, signal } from '@angular/core';
// ... existing imports ...

@Component({
  // ...
  imports: [PopoverComponent, AvatarComponent, PreferencesModalComponent, AppearancePanelComponent, NgComponentOutlet],
  // ...
})
export class ProfileMenuComponent {
  // ... existing members ...

  readonly profileTabComponent = signal<Type<unknown> | null>(null);

  openPreferences(tabId: 'appearance' | 'profile' = 'appearance'): void {
    this.close();
    this.activeTabId.set(tabId);
    this.isPreferencesOpen.set(true);
    if (tabId === 'profile' && !this.profileTabComponent()) {
      import('../../../../modules/profile/feature/profile-tab/profile-tab.component').then((m) => {
        this.profileTabComponent.set(m.ProfileTabComponent);
      });
    }
  }
}
```

(The `@defer` block's own lazy-loading plus this explicit dynamic `import()` both exist because `@defer` alone lazy-loads the *template block*, but `NgComponentOutlet` still needs a resolved `Type` to project — the dynamic import is what actually triggers the separate JS chunk download for `modules/profile/**`, verified by build output in Step 6.)

- [ ] **Step 6: Verify code splitting**

Run: `npm run build`
Expected: Build output includes a separate lazy chunk containing `profile-tab` (check `dist/**/stats.json` or the build's printed chunk list for a `profile-tab` or similarly-named chunk distinct from `main.js`) — confirms `modules/profile/**` code is not bundled into the eagerly-loaded main-layout chunk.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/profile/feature/profile-tab/ src/app/layouts/main-layout/top-navbar/profile-menu/
git commit -m "feat: add ProfileTabComponent shell with 5 sub-tabs, lazy-load from ProfileMenuComponent"
```

---

### Task 7: `ui/personal-info-form`

**Files:**
- Create: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.ts`
- Create: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.html`
- Create: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.css`
- Create: `src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts`
- Create: `src/app/modules/profile/utils/profile-validators.ts`
- Create: `src/app/modules/profile/utils/profile-validators.spec.ts`
- Modify: `src/app/modules/profile/feature/profile-tab/profile-tab.component.html` (wire the panel)
- Modify: `src/app/modules/profile/feature/profile-tab/profile-tab.component.ts` (import the panel component)

**Interfaces:**
- Consumes: `ProfileStore.savePersonalInformation`/`uploadAvatar` (Task 5), `PersonalInformation` model (Task 4).

- [ ] **Step 1: Write the validators**

```typescript
// src/app/modules/profile/utils/profile-validators.ts
import { Validators as SharedValidators } from '../../../shared/utils/validation.helpers';

export const ProfileValidators = {
  isValidEmail: SharedValidators.isValidEmail,

  /** UX-only format check - the backend is the validation authority per architecture-doc §6.4. */
  isValidPhone: (phone: string): boolean => /^[0-9+()\-\s]{7,20}$/.test(phone.trim())
};
```

```typescript
// src/app/modules/profile/utils/profile-validators.spec.ts
import { ProfileValidators } from './profile-validators';

describe('ProfileValidators', () => {
  it('accepts a plausible phone number', () => {
    expect(ProfileValidators.isValidPhone('+94 77 123 4567')).toBe(true);
  });

  it('rejects an obviously invalid phone number', () => {
    expect(ProfileValidators.isValidPhone('abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run validator test to verify it fails, then passes**

Run: `npm test -- profile-validators.spec.ts`
Expected: FAIL (module doesn't exist) then, after implementing the file above, PASS.

- [ ] **Step 3: Write the failing component test**

```typescript
// src/app/modules/profile/ui/personal-info-form/personal-info-form.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PersonalInfoFormComponent } from './personal-info-form.component';
import { PersonalInformation } from '../../models/profile.model';

const samplePersonalInfo: PersonalInformation = {
  firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-1111',
  dateOfBirth: null, gender: null, nationalityId: null, countryName: null,
  displayTimezone: null, avatarUrl: null, addresses: [], version: '1'
};

describe('PersonalInfoFormComponent', () => {
  it('pre-fills the form from the personalInformation input', async () => {
    await TestBed.configureTestingModule({ imports: [PersonalInfoFormComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.componentInstance.form.value.firstName).toBe('Jane');
  });

  it('emits save with the form value and current version when submitted', async () => {
    await TestBed.configureTestingModule({ imports: [PersonalInfoFormComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInfoFormComponent);
    fixture.componentRef.setInput('personalInformation', samplePersonalInfo);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    let emitted: unknown;
    fixture.componentInstance.save.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmit();

    expect((emitted as { version: string }).version).toBe('1');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- personal-info-form.component.spec.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 5: Implement the component**

```typescript
// src/app/modules/profile/ui/personal-info-form/personal-info-form.component.ts
import { ChangeDetectionStrategy, Component, OnChanges, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PersonalInformation } from '../../models/profile.model';
import { UpdatePersonalInformationRequest } from '../../models/profile.model';
import { ProfileValidators } from '../../utils/profile-validators';

@Component({
  selector: 'app-personal-info-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './personal-info-form.component.html',
  styleUrl: './personal-info-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonalInfoFormComponent implements OnChanges {
  readonly personalInformation = input.required<PersonalInformation>();
  readonly saving = input(false);
  readonly saveError = input<string | null>(null);
  readonly save = output<UpdatePersonalInformationRequest>();
  readonly avatarSelected = output<File>();

  private readonly fb = new FormBuilder().nonNullable;

  form = this.buildForm(null);

  ngOnChanges(): void {
    this.form = this.buildForm(this.personalInformation());
  }

  private buildForm(info: PersonalInformation | null) {
    return this.fb.group({
      firstName: [info?.firstName ?? '', [Validators.required, Validators.maxLength(100)]],
      lastName: [info?.lastName ?? '', [Validators.required, Validators.maxLength(100)]],
      phone: [info?.phone ?? ''],
      dateOfBirth: [info?.dateOfBirth ?? ''],
      gender: [info?.gender ?? ''],
      displayTimezone: [info?.displayTimezone ?? '']
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.save.emit({
      firstName: value.firstName,
      lastName: value.lastName,
      phone: value.phone || null,
      dateOfBirth: value.dateOfBirth || null,
      gender: value.gender || null,
      nationalityId: this.personalInformation().nationalityId,
      displayTimezone: value.displayTimezone || null,
      addresses: this.personalInformation().addresses.map((a) => ({
        addressType: a.addressType, addressJson: a.addressJson, isPrimary: a.isPrimary
      })),
      version: this.personalInformation().version
    });
  }

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.avatarSelected.emit(file);
    }
  }

  isPhoneValid(): boolean {
    const phone = this.form.value.phone;
    return !phone || ProfileValidators.isValidPhone(phone);
  }
}
```

```html
<!-- src/app/modules/profile/ui/personal-info-form/personal-info-form.component.html -->
<form [formGroup]="form" (ngSubmit)="onSubmit()" class="personal-info-form">
  @if (saveError()) {
    <div class="form-error-banner" role="alert">{{ saveError() }}</div>
  }

  <div class="avatar-upload-row">
    <img [src]="personalInformation().avatarUrl ?? '/assets/images/avatar-placeholder.svg'" alt="Profile photo" width="64" height="64" />
    <label class="avatar-upload-label">
      Change photo
      <input type="file" accept="image/*" (change)="onAvatarFileSelected($event)" hidden />
    </label>
  </div>

  <div class="form-field">
    <label for="firstName">First name</label>
    <input id="firstName" type="text" formControlName="firstName" />
    @if (form.controls.firstName.invalid && form.controls.firstName.touched) {
      <span class="field-error">First name is required.</span>
    }
  </div>

  <div class="form-field">
    <label for="lastName">Last name</label>
    <input id="lastName" type="text" formControlName="lastName" />
    @if (form.controls.lastName.invalid && form.controls.lastName.touched) {
      <span class="field-error">Last name is required.</span>
    }
  </div>

  <div class="form-field">
    <label for="phone">Mobile number</label>
    <input id="phone" type="tel" formControlName="phone" />
    @if (!isPhoneValid()) {
      <span class="field-error">Please enter a valid phone number.</span>
    }
  </div>

  <div class="form-field">
    <label for="dateOfBirth">Date of birth</label>
    <input id="dateOfBirth" type="date" formControlName="dateOfBirth" />
  </div>

  <div class="form-field">
    <label for="gender">Gender</label>
    <select id="gender" formControlName="gender">
      <option value="">Prefer not to say</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="other">Other</option>
    </select>
  </div>

  <div class="form-field">
    <label for="displayTimezone">Display timezone</label>
    <input id="displayTimezone" type="text" formControlName="displayTimezone" placeholder="e.g. Asia/Colombo" />
  </div>

  <button type="submit" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save changes' }}</button>
</form>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- personal-info-form.component.spec.ts`
Expected: PASS.

- [ ] **Step 7: Wire the panel into `ProfileTabComponent`**

In `profile-tab.component.ts`, add `PersonalInfoFormComponent` to `imports` and inject a save/upload handler:

```typescript
// Add to imports array: PersonalInfoFormComponent
// Add these methods to the class:
  onSavePersonalInformation(payload: import('../../models/profile.model').UpdatePersonalInformationRequest): void {
    this.store.savePersonalInformation(payload);
  }

  onAvatarSelected(file: File): void {
    this.store.uploadAvatar(file);
  }
```

In `profile-tab.component.html`, replace the `'personal'` placeholder block:

```html
      @if (activeSubTab() === 'personal') {
        <app-personal-info-form
          [personalInformation]="profile.personalInformation"
          [saving]="store.saving()"
          [saveError]="store.saveError()"
          (save)="onSavePersonalInformation($event)"
          (avatarSelected)="onAvatarSelected($event)"
        />
      }
```

- [ ] **Step 8: Run the full profile module test suite**

Run: `npm test -- --testPathPattern=modules/profile`
Expected: All PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/profile/ui/personal-info-form/ src/app/modules/profile/utils/ src/app/modules/profile/feature/profile-tab/
git commit -m "feat: add Personal Information form with avatar upload"
```

---

### Task 8: `ui/job-info-panel` (read-only)

**Files:**
- Create: `src/app/modules/profile/ui/job-info-panel/job-info-panel.component.ts`
- Create: `src/app/modules/profile/ui/job-info-panel/job-info-panel.component.html`
- Create: `src/app/modules/profile/ui/job-info-panel/job-info-panel.component.spec.ts`
- Modify: `src/app/modules/profile/feature/profile-tab/profile-tab.component.ts`/`.html`

**Interfaces:**
- Consumes: `JobInformation` model (Task 4). No store methods — this panel is read-only, matching profile-management.md ("Most Job Information fields are HR-owned and read-only for the employee").

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/modules/profile/ui/job-info-panel/job-info-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { JobInfoPanelComponent } from './job-info-panel.component';
import { JobInformation } from '../../models/profile.model';

const sampleJobInfo: JobInformation = {
  employeeNumber: 'EMP-001', legalEntityName: 'Acme Corp', departmentName: 'Engineering',
  positionName: 'Software Engineer', reportingManagerName: 'Alex Manager',
  employmentTypeLabel: 'Full-time', employmentStatus: 'active',
  hireDate: '2024-01-15', probationEndDate: null, workMode: 'remote'
};

describe('JobInfoPanelComponent', () => {
  it('renders job information fields as read-only text, no form controls', async () => {
    await TestBed.configureTestingModule({ imports: [JobInfoPanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(JobInfoPanelComponent);
    fixture.componentRef.setInput('jobInformation', sampleJobInfo);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Software Engineer');
    expect(fixture.nativeElement.textContent).toContain('Alex Manager');
    expect(fixture.nativeElement.querySelectorAll('input, select, textarea, button[type="submit"]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- job-info-panel.component.spec.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/modules/profile/ui/job-info-panel/job-info-panel.component.ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { JobInformation } from '../../models/profile.model';

@Component({
  selector: 'app-job-info-panel',
  standalone: true,
  templateUrl: './job-info-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class JobInfoPanelComponent {
  readonly jobInformation = input.required<JobInformation>();
}
```

```html
<!-- src/app/modules/profile/ui/job-info-panel/job-info-panel.component.html -->
<dl class="job-info-list">
  <div class="job-info-row"><dt>Employee number</dt><dd>{{ jobInformation().employeeNumber }}</dd></div>
  <div class="job-info-row"><dt>Company</dt><dd>{{ jobInformation().legalEntityName ?? '—' }}</dd></div>
  <div class="job-info-row"><dt>Department</dt><dd>{{ jobInformation().departmentName ?? '—' }}</dd></div>
  <div class="job-info-row"><dt>Position</dt><dd>{{ jobInformation().positionName ?? '—' }}</dd></div>
  <div class="job-info-row"><dt>Reports to</dt><dd>{{ jobInformation().reportingManagerName ?? '—' }}</dd></div>
  <div class="job-info-row"><dt>Employment type</dt><dd>{{ jobInformation().employmentTypeLabel }}</dd></div>
  <div class="job-info-row"><dt>Employment status</dt><dd>{{ jobInformation().employmentStatus }}</dd></div>
  <div class="job-info-row"><dt>Start date</dt><dd>{{ jobInformation().hireDate }}</dd></div>
  @if (jobInformation().probationEndDate) {
    <div class="job-info-row"><dt>Probation end date</dt><dd>{{ jobInformation().probationEndDate }}</dd></div>
  }
  <div class="job-info-row"><dt>Work mode</dt><dd>{{ jobInformation().workMode }}</dd></div>
</dl>
<p class="job-info-note">These fields are managed by HR. Contact your administrator to request a change.</p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- job-info-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the panel into `ProfileTabComponent`**

Add `JobInfoPanelComponent` to `profile-tab.component.ts`'s `imports`, replace the `'job'` placeholder block in `profile-tab.component.html`:

```html
      @if (activeSubTab() === 'job') {
        <app-job-info-panel [jobInformation]="profile.jobInformation" />
      }
```

- [ ] **Step 6: Run the full profile module test suite**

Run: `npm test -- --testPathPattern=modules/profile`
Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/profile/ui/job-info-panel/ src/app/modules/profile/feature/profile-tab/
git commit -m "feat: add read-only Job Information panel"
```

---

### Task 9: `ui/emergency-contacts-panel` + `ui/dependents-panel`

**Files:**
- Create: `src/app/modules/profile/ui/emergency-contacts-panel/emergency-contacts-panel.component.ts` (+html, +spec)
- Create: `src/app/modules/profile/ui/dependents-panel/dependents-panel.component.ts` (+html, +spec)
- Modify: `src/app/modules/profile/feature/profile-tab/profile-tab.component.ts`/`.html`

**Interfaces:**
- Consumes: `EmergencyContact`/`Dependent` models (Task 4); each panel emits add/update/remove events that `ProfileTabComponent` forwards to `ProfileStore`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/profile/ui/emergency-contacts-panel/emergency-contacts-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { EmergencyContactsPanelComponent } from './emergency-contacts-panel.component';
import { EmergencyContact } from '../../models/profile.model';

const contacts: EmergencyContact[] = [
  { id: '1', name: 'Jane Doe', relationship: 'spouse', phone: '555-1111', email: null, isPrimary: true }
];

describe('EmergencyContactsPanelComponent', () => {
  it('lists existing emergency contacts', async () => {
    await TestBed.configureTestingModule({ imports: [EmergencyContactsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', contacts);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jane Doe');
  });

  it('emits remove with the contact id when delete is clicked', async () => {
    await TestBed.configureTestingModule({ imports: [EmergencyContactsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(EmergencyContactsPanelComponent);
    fixture.componentRef.setInput('contacts', contacts);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    let emittedId: string | undefined;
    fixture.componentInstance.remove.subscribe((id: string) => (emittedId = id));
    fixture.componentInstance.onRemove('1');

    expect(emittedId).toBe('1');
  });
});
```

```typescript
// src/app/modules/profile/ui/dependents-panel/dependents-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { DependentsPanelComponent } from './dependents-panel.component';
import { Dependent } from '../../models/profile.model';

const dependents: Dependent[] = [
  { id: '1', name: 'Sam Doe', relationship: 'child', dateOfBirth: '2015-06-01', isEmergencyContact: false, phone: null }
];

describe('DependentsPanelComponent', () => {
  it('lists existing dependents', async () => {
    await TestBed.configureTestingModule({ imports: [DependentsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(DependentsPanelComponent);
    fixture.componentRef.setInput('dependents', dependents);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sam Doe');
  });

  it('emits add with form values when the add form is submitted', async () => {
    await TestBed.configureTestingModule({ imports: [DependentsPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(DependentsPanelComponent);
    fixture.componentRef.setInput('dependents', []);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.addForm.setValue({
      name: 'New Dependent', relationship: 'child', dateOfBirth: '2020-01-01', isEmergencyContact: false, phone: ''
    });

    let emitted: unknown;
    fixture.componentInstance.add.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmitAdd();

    expect((emitted as { name: string }).name).toBe('New Dependent');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- emergency-contacts-panel.component.spec.ts dependents-panel.component.spec.ts`
Expected: FAIL — components don't exist.

- [ ] **Step 3: Implement `EmergencyContactsPanelComponent`**

```typescript
// src/app/modules/profile/ui/emergency-contacts-panel/emergency-contacts-panel.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { EmergencyContact, UpsertEmergencyContactRequest } from '../../models/profile.model';

@Component({
  selector: 'app-emergency-contacts-panel',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './emergency-contacts-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmergencyContactsPanelComponent {
  readonly contacts = input.required<EmergencyContact[]>();
  readonly saving = input(false);
  readonly add = output<UpsertEmergencyContactRequest>();
  readonly remove = output<string>();

  private readonly fb = new FormBuilder().nonNullable;
  readonly addForm = this.fb.group({
    name: ['', Validators.required],
    relationship: ['', Validators.required],
    phone: ['', Validators.required],
    email: [''],
    isPrimary: [false]
  });

  onSubmitAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const value = this.addForm.getRawValue();
    this.add.emit({ name: value.name, relationship: value.relationship, phone: value.phone, email: value.email || null, isPrimary: value.isPrimary });
    this.addForm.reset({ isPrimary: false });
  }

  onRemove(id: string): void {
    this.remove.emit(id);
  }
}
```

```html
<!-- src/app/modules/profile/ui/emergency-contacts-panel/emergency-contacts-panel.component.html -->
<ul class="emergency-contacts-list">
  @for (contact of contacts(); track contact.id) {
    <li class="emergency-contact-row">
      <span>{{ contact.name }} — {{ contact.relationship }} — {{ contact.phone }}</span>
      <button type="button" [disabled]="saving()" (click)="onRemove(contact.id)">Remove</button>
    </li>
  } @empty {
    <li class="empty-state">No emergency contacts added yet.</li>
  }
</ul>

<form [formGroup]="addForm" (ngSubmit)="onSubmitAdd()" class="add-emergency-contact-form">
  <input type="text" formControlName="name" placeholder="Full name" />
  <input type="text" formControlName="relationship" placeholder="Relationship" />
  <input type="tel" formControlName="phone" placeholder="Primary phone" />
  <input type="email" formControlName="email" placeholder="Email (optional)" />
  <label><input type="checkbox" formControlName="isPrimary" /> Primary emergency contact</label>
  <button type="submit" [disabled]="saving()">Add contact</button>
</form>
```

- [ ] **Step 4: Implement `DependentsPanelComponent`**

```typescript
// src/app/modules/profile/ui/dependents-panel/dependents-panel.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Dependent, UpsertDependentRequest } from '../../models/profile.model';

@Component({
  selector: 'app-dependents-panel',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './dependents-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DependentsPanelComponent {
  readonly dependents = input.required<Dependent[]>();
  readonly saving = input(false);
  readonly add = output<UpsertDependentRequest>();
  readonly remove = output<string>();

  private readonly fb = new FormBuilder().nonNullable;
  readonly addForm = this.fb.group({
    name: ['', Validators.required],
    relationship: ['child' as Dependent['relationship'], Validators.required],
    dateOfBirth: ['', Validators.required],
    isEmergencyContact: [false],
    phone: ['']
  });

  onSubmitAdd(): void {
    if (this.addForm.invalid) {
      this.addForm.markAllAsTouched();
      return;
    }
    const value = this.addForm.getRawValue();
    this.add.emit({
      name: value.name, relationship: value.relationship, dateOfBirth: value.dateOfBirth,
      isEmergencyContact: value.isEmergencyContact, phone: value.phone || null
    });
    this.addForm.reset({ relationship: 'child', isEmergencyContact: false });
  }

  onRemove(id: string): void {
    this.remove.emit(id);
  }
}
```

```html
<!-- src/app/modules/profile/ui/dependents-panel/dependents-panel.component.html -->
<ul class="dependents-list">
  @for (dependent of dependents(); track dependent.id) {
    <li class="dependent-row">
      <span>{{ dependent.name }} — {{ dependent.relationship }} — {{ dependent.dateOfBirth }}</span>
      @if (dependent.isEmergencyContact) {
        <span class="badge">Also an emergency contact</span>
      }
      <button type="button" [disabled]="saving()" (click)="onRemove(dependent.id)">Remove</button>
    </li>
  } @empty {
    <li class="empty-state">No dependents added yet.</li>
  }
</ul>

<form [formGroup]="addForm" (ngSubmit)="onSubmitAdd()" class="add-dependent-form">
  <input type="text" formControlName="name" placeholder="Full name" />
  <select formControlName="relationship">
    <option value="spouse">Spouse</option>
    <option value="child">Child</option>
    <option value="parent">Parent</option>
    <option value="other">Other</option>
  </select>
  <input type="date" formControlName="dateOfBirth" />
  <input type="tel" formControlName="phone" placeholder="Phone (optional)" />
  <label><input type="checkbox" formControlName="isEmergencyContact" /> Also an emergency contact</label>
  <button type="submit" [disabled]="saving()">Add dependent</button>
</form>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- emergency-contacts-panel.component.spec.ts dependents-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 6: Wire both panels into `ProfileTabComponent`**

Add both components to `profile-tab.component.ts`'s `imports` and these handler methods:

```typescript
  onAddEmergencyContact(payload: import('../../models/profile.model').UpsertEmergencyContactRequest): void {
    this.store.addEmergencyContact(payload);
  }

  onRemoveEmergencyContact(id: string): void {
    this.store.removeEmergencyContact(id);
  }

  onAddDependent(payload: import('../../models/profile.model').UpsertDependentRequest): void {
    this.store.addDependent(payload);
  }

  onRemoveDependent(id: string): void {
    this.store.removeDependent(id);
  }
```

Replace the `'emergency'` placeholder block in `profile-tab.component.html`:

```html
      @if (activeSubTab() === 'emergency') {
        <section>
          <h4>Emergency Contacts</h4>
          <app-emergency-contacts-panel
            [contacts]="profile.emergencyContacts"
            [saving]="store.saving()"
            (add)="onAddEmergencyContact($event)"
            (remove)="onRemoveEmergencyContact($event)"
          />
        </section>
        <section>
          <h4>Dependents</h4>
          <app-dependents-panel
            [dependents]="profile.dependents"
            [saving]="store.saving()"
            (add)="onAddDependent($event)"
            (remove)="onRemoveDependent($event)"
          />
        </section>
      }
```

- [ ] **Step 7: Run the full profile module test suite**

Run: `npm test -- --testPathPattern=modules/profile`
Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/profile/ui/emergency-contacts-panel/ src/app/modules/profile/ui/dependents-panel/ src/app/modules/profile/feature/profile-tab/
git commit -m "feat: add Emergency Contacts and Dependents CRUD panels"
```

---

### Task 10: `ui/payroll-panel`

**Files:**
- Create: `src/app/modules/profile/ui/payroll-panel/payroll-panel.component.ts` (+html, +spec)
- Modify: `src/app/modules/profile/feature/profile-tab/profile-tab.component.ts`/`.html`

**Interfaces:**
- Consumes: `PayrollInfo` model (Task 4). `canEdit: false` hides the edit form entirely (design decision from the frontend spec §5) rather than disabling it — avoids a submit-then-403 dead end.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/profile/ui/payroll-panel/payroll-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { PayrollPanelComponent } from './payroll-panel.component';
import { PayrollInfo } from '../../models/profile.model';

describe('PayrollPanelComponent', () => {
  it('shows masked account number and no edit form when canEdit is false', async () => {
    const payroll: PayrollInfo = { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'savings', canEdit: false };
    await TestBed.configureTestingModule({ imports: [PayrollPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PayrollPanelComponent);
    fixture.componentRef.setInput('payroll', payroll);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('****1234');
    expect(fixture.nativeElement.querySelector('form')).toBeFalsy();
  });

  it('shows the edit form when canEdit is true', async () => {
    const payroll: PayrollInfo = { hasBankDetailsOnFile: false, bankName: null, maskedAccountNumber: null, accountType: null, canEdit: true };
    await TestBed.configureTestingModule({ imports: [PayrollPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(PayrollPanelComponent);
    fixture.componentRef.setInput('payroll', payroll);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('form')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- payroll-panel.component.spec.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/modules/profile/ui/payroll-panel/payroll-panel.component.ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PayrollInfo, UpdateBankDetailsRequest } from '../../models/profile.model';

@Component({
  selector: 'app-payroll-panel',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './payroll-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PayrollPanelComponent {
  readonly payroll = input.required<PayrollInfo>();
  readonly saving = input(false);
  readonly save = output<UpdateBankDetailsRequest>();

  private readonly fb = new FormBuilder().nonNullable;
  readonly form = this.fb.group({
    bankName: ['', Validators.required],
    branchName: ['', Validators.required],
    accountHolderName: ['', Validators.required],
    accountNumber: ['', Validators.required],
    accountType: ['', Validators.required],
    routingNumber: ['']
  });

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.save.emit({
      bankName: value.bankName, branchName: value.branchName, accountHolderName: value.accountHolderName,
      accountNumber: value.accountNumber, accountType: value.accountType, routingNumber: value.routingNumber || null
    });
  }
}
```

```html
<!-- src/app/modules/profile/ui/payroll-panel/payroll-panel.component.html -->
@if (payroll().hasBankDetailsOnFile) {
  <dl class="payroll-summary">
    <div><dt>Bank</dt><dd>{{ payroll().bankName }}</dd></div>
    <div><dt>Account number</dt><dd>{{ payroll().maskedAccountNumber }}</dd></div>
    <div><dt>Account type</dt><dd>{{ payroll().accountType }}</dd></div>
  </dl>
} @else {
  <p>No bank details on file.</p>
}

@if (payroll().canEdit) {
  <form [formGroup]="form" (ngSubmit)="onSubmit()" class="payroll-edit-form">
    <input type="text" formControlName="bankName" placeholder="Bank name" />
    <input type="text" formControlName="branchName" placeholder="Branch" />
    <input type="text" formControlName="accountHolderName" placeholder="Account holder name" />
    <input type="text" formControlName="accountNumber" placeholder="Account number" />
    <input type="text" formControlName="accountType" placeholder="Account type" />
    <input type="text" formControlName="routingNumber" placeholder="Routing number (optional)" />
    <button type="submit" [disabled]="saving()">{{ saving() ? 'Saving...' : 'Save bank details' }}</button>
  </form>
} @else {
  <p class="payroll-permission-note">Contact HR to update your bank details.</p>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- payroll-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the panel into `ProfileTabComponent`**

Add `PayrollPanelComponent` to `profile-tab.component.ts`'s `imports` and:

```typescript
  onSavePayroll(payload: import('../../models/profile.model').UpdateBankDetailsRequest): void {
    this.store.savePayroll(payload);
  }
```

Replace the `'payroll'` placeholder block in `profile-tab.component.html`:

```html
      @if (activeSubTab() === 'payroll') {
        <app-payroll-panel [payroll]="profile.payroll" [saving]="store.saving()" (save)="onSavePayroll($event)" />
      }
```

- [ ] **Step 6: Run the full profile module test suite**

Run: `npm test -- --testPathPattern=modules/profile`
Expected: All PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/profile/ui/payroll-panel/ src/app/modules/profile/feature/profile-tab/
git commit -m "feat: add Payroll & Statutory panel with permission-gated edit form"
```

---

### Task 11: `ui/security-panel`

**Files:**
- Create: `src/app/modules/profile/ui/security-panel/security-panel.component.ts` (+html, +spec)
- Modify: `src/app/modules/profile/feature/profile-tab/profile-tab.component.ts`/`.html`

**Interfaces:**
- Consumes: `SecurityInfo` model (Task 4), `ProfileStore.changePassword`/`enableMfa`/`confirmMfaSetup`/`disableMfa` (Task 5).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/profile/ui/security-panel/security-panel.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { SecurityPanelComponent } from './security-panel.component';
import { SecurityInfo } from '../../models/profile.model';

describe('SecurityPanelComponent', () => {
  it('shows Enable MFA when mfaEnabled is false', async () => {
    const security: SecurityInfo = { mfaEnabled: false, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Enable MFA');
  });

  it('shows Disable MFA when mfaEnabled is true', async () => {
    const security: SecurityInfo = { mfaEnabled: true, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Disable MFA');
  });

  it('emits changePassword with current and new password on submit', async () => {
    const security: SecurityInfo = { mfaEnabled: false, lastPasswordChangedAt: null };
    await TestBed.configureTestingModule({ imports: [SecurityPanelComponent, ReactiveFormsModule] }).compileComponents();
    const fixture = TestBed.createComponent(SecurityPanelComponent);
    fixture.componentRef.setInput('security', security);
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();

    fixture.componentInstance.passwordForm.setValue({ currentPassword: 'old-pw', newPassword: 'new-password-123' });

    let emitted: unknown;
    fixture.componentInstance.changePassword.subscribe((v: unknown) => (emitted = v));
    fixture.componentInstance.onSubmitPasswordChange();

    expect(emitted).toEqual({ currentPassword: 'old-pw', newPassword: 'new-password-123' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- security-panel.component.spec.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/modules/profile/ui/security-panel/security-panel.component.ts
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SecurityInfo } from '../../models/profile.model';

type MfaSetupStep = 'idle' | 'show-qr' | 'confirm-code';

@Component({
  selector: 'app-security-panel',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './security-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SecurityPanelComponent {
  readonly security = input.required<SecurityInfo>();
  readonly saving = input(false);
  readonly qrCodeUri = input<string | null>(null);

  readonly changePassword = output<{ currentPassword: string; newPassword: string }>();
  readonly startMfaSetup = output<void>();
  readonly confirmMfaSetup = output<string>();
  readonly disableMfa = output<string>();

  readonly mfaSetupStep = signal<MfaSetupStep>('idle');

  private readonly fb = new FormBuilder().nonNullable;

  readonly passwordForm = this.fb.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  readonly mfaCodeForm = this.fb.group({ code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]] });
  readonly disableMfaForm = this.fb.group({ currentPassword: ['', Validators.required] });

  onSubmitPasswordChange(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const value = this.passwordForm.getRawValue();
    this.changePassword.emit({ currentPassword: value.currentPassword, newPassword: value.newPassword });
    this.passwordForm.reset();
  }

  onStartMfaSetup(): void {
    this.mfaSetupStep.set('show-qr');
    this.startMfaSetup.emit();
  }

  onProceedToConfirmCode(): void {
    this.mfaSetupStep.set('confirm-code');
  }

  onSubmitMfaCode(): void {
    if (this.mfaCodeForm.invalid) {
      this.mfaCodeForm.markAllAsTouched();
      return;
    }
    this.confirmMfaSetup.emit(this.mfaCodeForm.getRawValue().code);
    this.mfaSetupStep.set('idle');
    this.mfaCodeForm.reset();
  }

  onSubmitDisableMfa(): void {
    if (this.disableMfaForm.invalid) {
      this.disableMfaForm.markAllAsTouched();
      return;
    }
    this.disableMfa.emit(this.disableMfaForm.getRawValue().currentPassword);
    this.disableMfaForm.reset();
  }
}
```

```html
<!-- src/app/modules/profile/ui/security-panel/security-panel.component.html -->
<section class="security-password-section">
  <h4>Change password</h4>
  <form [formGroup]="passwordForm" (ngSubmit)="onSubmitPasswordChange()">
    <input type="password" formControlName="currentPassword" placeholder="Current password" />
    <input type="password" formControlName="newPassword" placeholder="New password (min. 8 characters)" />
    <button type="submit" [disabled]="saving()">Change password</button>
  </form>
</section>

<section class="security-mfa-section">
  <h4>Two-factor authentication</h4>
  @if (security().mfaEnabled) {
    <p>MFA is currently enabled.</p>
    <form [formGroup]="disableMfaForm" (ngSubmit)="onSubmitDisableMfa()">
      <input type="password" formControlName="currentPassword" placeholder="Current password to confirm" />
      <button type="submit" [disabled]="saving()">Disable MFA</button>
    </form>
  } @else if (mfaSetupStep() === 'idle') {
    <button type="button" [disabled]="saving()" (click)="onStartMfaSetup()">Enable MFA</button>
  } @else if (mfaSetupStep() === 'show-qr') {
    <p>Scan this QR code with your authenticator app:</p>
    @if (qrCodeUri()) {
      <img [src]="qrCodeUri()" alt="MFA setup QR code" width="180" height="180" />
    }
    <button type="button" (click)="onProceedToConfirmCode()">I've scanned it</button>
  } @else if (mfaSetupStep() === 'confirm-code') {
    <form [formGroup]="mfaCodeForm" (ngSubmit)="onSubmitMfaCode()">
      <input type="text" formControlName="code" placeholder="6-digit code" maxlength="6" />
      <button type="submit" [disabled]="saving()">Confirm</button>
    </form>
  }
</section>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- security-panel.component.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the panel into `ProfileTabComponent`**

Add `SecurityPanelComponent` to `profile-tab.component.ts`'s `imports`, a `qrCodeUri` signal, and these handlers:

```typescript
  readonly qrCodeUri = signal<string | null>(null);

  async onStartMfaSetup(): Promise<void> {
    const result = await this.store.enableMfa();
    this.qrCodeUri.set(result?.qrCodeUri ?? null);
  }

  onChangePassword(payload: { currentPassword: string; newPassword: string }): void {
    this.store.changePassword(payload.currentPassword, payload.newPassword);
  }

  onConfirmMfaSetup(code: string): void {
    this.store.confirmMfaSetup(code);
  }

  onDisableMfa(currentPassword: string): void {
    this.store.disableMfa(currentPassword);
  }
```

Replace the `'security'` placeholder block in `profile-tab.component.html`:

```html
      @if (activeSubTab() === 'security') {
        <app-security-panel
          [security]="profile.security"
          [saving]="store.saving()"
          [qrCodeUri]="qrCodeUri()"
          (changePassword)="onChangePassword($event)"
          (startMfaSetup)="onStartMfaSetup()"
          (confirmMfaSetup)="onConfirmMfaSetup($event)"
          (disableMfa)="onDisableMfa($event)"
        />
      }
```

- [ ] **Step 6: Run the full profile module test suite**

Run: `npm test -- --testPathPattern=modules/profile`
Expected: All PASS.

- [ ] **Step 7: Run the full frontend test suite as a final baseline**

Run: `npm test`
Expected: All PASS — confirms Tasks 1–11 integrate cleanly and no existing component (Appearance, ProfileMenuComponent's logout/avatar behavior, ModalComponent's other consumers) regressed.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/profile/ui/security-panel/ src/app/modules/profile/feature/profile-tab/
git commit -m "feat: add Security Settings panel with change-password and MFA enable/disable"
```
