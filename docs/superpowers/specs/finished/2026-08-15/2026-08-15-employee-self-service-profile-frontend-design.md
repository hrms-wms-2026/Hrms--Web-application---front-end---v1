
  # Employee Self-Service Profile — Frontend Design

  **Status:** Approved by user 2026-08-15, ready for implementation planning.

  **Companion spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-15-employee-self-service-profile-backend-design.md` (backend half — this document's `data-access` layer is a client of that API contract, reproduced here only where the frontend needs to know the shape).

  **Origin:** brainstormed live with the user 2026-08-15 via `superpowers:brainstorming`. User request: add a "Profile" entry to the existing topbar profile-menu dropdown's Preferences popup (currently only has "Appearance"), reusing that popup and extending its size to fit the Profile content. Grounded in `ONEVO_HRMS_Frontend_Architecture.md` and the actual current codebase (see §2).

  ---

  ## 1. Goal

  Let any user open their own Profile — Personal Information, Emergency Contacts & Dependents, Job Information (read-only), Payroll & Statutory, Security Settings — from the same popup that currently only offers Appearance, without duplicating content that already lives on other dedicated pages (Documents, Time Off).

  ## 2. Current-state facts this design depends on

  Verified directly against the codebase:

  - `ProfileMenuComponent` (`src/app/layouts/main-layout/top-navbar/profile-menu/profile-menu.component.ts`) owns a local `isPreferencesOpen = signal(false)` and renders `<app-preferences-modal [open]="isPreferencesOpen()" (closed)="closePreferences()" />` directly — no modal service/registry.
  - `PreferencesModalComponent` (`src/app/shared/ui/preferences-modal/preferences-modal.component.ts`, template inline in the `.ts`, no separate `.html`) wraps `ModalComponent`, hardcodes the "Appearance" panel's markup directly in its own template, and has a `tabs: readonly PreferenceTab[]` array with exactly one entry today.
  - `ModalComponent` (`src/app/shared/ui/modal/modal.component.ts`) hardcodes `max-w-md` in its template — no size input exists yet.
  - `AuthStore` (`src/app/core/auth/state/auth.store.ts`, NgRx SignalStore) holds only `email, permissions, activeModules, ...` — **no name, avatar, or employee data**, and there is **no `/employees/me` call anywhere in the frontend today**. `ProfileMenuComponent`'s `userName`/`avatarUrl` inputs exist on the component but nothing currently supplies them — `displayName()` just derives a name from the email local-part. This gap is exactly what the new `ProfileStore` fills, and once it loads, `ProfileMenuComponent` should source `userName`/`avatarUrl` from it instead of the email-derived fallback.
  - Feature-module convention (from `modules/organization/feature/general-settings/`): `feature/<name>/*.component.{ts,html,css,spec.ts}`, `state/<name>.store.ts` (NgRx SignalStore, `load/save` methods calling a `data-access` service), `data-access/<name>-api.service.ts`, `utils/<name>-validators.ts`, Reactive Forms via `FormBuilder.nonNullable.group`, permission-gating via `PermissionService.hasPermission(...)`.

  ## 3. Layering fix (required before adding Profile content)

  `shared/ui/` must stay domain-agnostic per the architecture doc's dependency rule — it cannot host five domain forms backed by a `ProfileStore`. Two changes, both non-breaking for existing callers:

  - **`ModalComponent`**: add `size = input<'md' | 'xl'>('md')`, map to `[class.max-w-md]="size() === 'md'"` / `[class.max-w-5xl]="size() === 'xl'"` (plus a taller max-height + internal scroll region for `'xl'`, since Profile content is long). Default stays `'md'` — every other current consumer of `ModalComponent` is unaffected.
  - **`PreferencesModalComponent`**: becomes a **fully generic tabbed-dialog shell** — `[tabs]`, `[activeTabId]`, `(activeTabIdChange)`, `[size]`, `(closed)`, and a single `<ng-content>` slot for the active tab's panel. It no longer contains "Appearance" markup at all. The Appearance panel (theme-preset grid, currently inline) is extracted into its own small presentational component, `AppearancePanelComponent`, in `shared/ui/appearance-panel/` (legitimately cross-domain: it only reads `ThemeStore` from `core/theme/`, no domain coupling).
  - **`ProfileMenuComponent`** (layouts) now owns `activeTabId = signal<'appearance' | 'profile'>('appearance')` and the `tabs` array, and composes:
    ```html
    <app-preferences-modal [open]="isPreferencesOpen()" [tabs]="tabs" [size]="activeTabId() === 'profile' ? 'xl' : 'md'"
      [activeTabId]="activeTabId()" (activeTabIdChange)="activeTabId.set($event)" (closed)="closePreferences()">
      @if (activeTabId() === 'appearance') { <app-appearance-panel /> }
      @if (activeTabId() === 'profile') {
        @defer (when activeTabId() === 'profile') {
          <app-profile-tab />
        } @placeholder { <div class="skeleton-rows" aria-busy="true"></div> }
      }
    </app-preferences-modal>
    ```
  - `@defer` keeps `modules/profile/` out of the eagerly-loaded main-layout bundle — it only downloads when a user actually opens the Profile tab, consistent with "business modules must be lazy loaded."

  ## 4. New `modules/profile/` module

  Following the canonical module template exactly:

  ```
  modules/profile/
    feature/profile-tab/
      profile-tab.component.ts|html|css|spec.ts     <- root panel; renders 5 sub-tabs (pill/vertical nav
                                                          inside the modal content pane) + delegates to ui/*
    ui/personal-info-form/                            <- Personal Information fields + address(es) + avatar upload
    ui/emergency-contacts-panel/                       <- emergency_contacts CRUD list
    ui/dependents-panel/                               <- dependents CRUD list; "mark as emergency contact" toggle
    ui/job-info-panel/                                 <- read-only, no form controls
    ui/payroll-panel/                                  <- masked view; edit form only rendered when payroll.canEdit
    ui/security-panel/                                 <- change-password form + MFA enable/disable, each opens its
                                                          own small confirm dialog (stacked on the Preferences modal)
    data-access/profile-api.service.ts
    state/profile.store.ts
    models/profile.model.ts
    utils/profile-validators.ts
    profile.routes.ts                                  <- present per template convention; unused by the modal
                                                          path today, reserved in case a future full-page route
                                                          is added without restructuring the module
  ```

  Emergency Contacts & Dependents share one sub-tab ("Emergency Contact & Dependents") per the brainstormed scope — `ui/emergency-contacts-panel` and `ui/dependents-panel` are two components composed inside `feature/profile-tab`'s single sub-tab, matching `dependent-management.md`'s note that a dependent flagged `is_emergency_contact` surfaces in the emergency-contact view without a duplicate backend row: the panel unions `emergencyContacts[]` and `dependents.filter(d => d.isEmergencyContact)` client-side for display, while still editing each through its own distinct CRUD endpoint.

  ## 5. State — `ProfileStore`

  NgRx Signal Store, `providedIn: 'root'`, same shape as `EmployeeStore`:

  - `loadProfile()` — single `GET /api/v1/employees/me` call on first Profile-tab open (`ngOnInit`/`@defer` trigger), populates all 5 sections at once so re-opening a different sub-tab never re-fetches.
  - `savePersonalInformation(patch)` — `PUT .../me/personal-information`, includes `version` from state for the concurrency check; on `409` surfaces the standard "record was just updated, please refresh" inline message (existing `ErrorHandlerService` taxonomy already maps `409` this way — no new mapping needed) and offers a reload.
  - `uploadAvatar(file)` — `PUT .../me/avatar` multipart.
  - `addEmergencyContact`/`updateEmergencyContact`/`removeEmergencyContact`, `addDependent`/`updateDependent`/`removeDependent` — optimistic list patch on success, matching `EmployeeStore.patchEmployee`'s pattern.
  - `savePayroll(patch)` — only callable when `payroll().canEdit` is true; `payroll-panel` component hides the edit form entirely (not just disables it) when `canEdit` is false, so there's no dead-end submit-then-403 UX — the backend 403 remains the authority, this is UX-only.
  - `changePassword`, `enableMfa`, `confirmMfaSetup`, `disableMfa` — thin wrappers around the corresponding `/auth/*` endpoints; `security-panel` drives its own local `signal()` UI state for the two-step MFA-enable flow (show QR → collect 6-digit code → confirm) same as any component-local UI state per the state-management doc's `Data Type` table.

  All four async states (loading/error/empty/data) are implemented per section, per the mandatory pattern in architecture-doc §7.4 — `profile-tab` and each `ui/*-panel` follow the `@if (store.loading()) { skeleton } @else if (store.error()) { error-banner } @else { content }` template shape already used by `EmployeeListComponent`.

  ## 6. Models

  ```typescript
  // models/profile.model.ts
  export interface PersonalInformation { firstName: string; lastName: string; email: string; phone: string;
    dateOfBirth: string | null; gender: string | null; maritalStatus: string | null; nationalityId: string | null;
    countryName: string | null; displayTimezone: string | null; identityDocumentType: string | null;
    identityDocumentNumber: string | null; personalEmail: string | null; avatarUrl: string | null;
    addresses: Address[]; version: string; }
  export interface Address { id: string; addressType: 'permanent' | 'current'; addressJson: Record<string, string>; isPrimary: boolean; }
  export interface JobInformation { employeeNumber: string; legalEntityName: string; departmentName: string | null;
    positionName: string | null; reportingManagerName: string | null; employmentTypeLabel: string;
    employmentStatus: string; hireDate: string; probationEndDate: string | null; workMode: string; }
  export interface EmergencyContact { id: string; name: string; relationship: string; phone: string; email: string | null; isPrimary: boolean; }
  export interface Dependent { id: string; name: string; relationship: string; dateOfBirth: string; isEmergencyContact: boolean; phone: string | null; }
  export interface PayrollInfo { hasBankDetailsOnFile: boolean; bankName: string | null; maskedAccountNumber: string | null; accountType: string | null; canEdit: boolean; }
  export interface SecurityInfo { mfaEnabled: boolean; lastPasswordChangedAt: string | null; }
  export interface MyProfile { personalInformation: PersonalInformation; jobInformation: JobInformation;
    emergencyContacts: EmergencyContact[]; dependents: Dependent[]; payroll: PayrollInfo; security: SecurityInfo; }
  ```

  Field set matches the backend spec's `MyProfileResponse` exactly (§5 of the companion doc) — no reshaping in the API service beyond the standard `ApiResponse<T>` unwrap.

  ## 7. Validation (`utils/profile-validators.ts`)

  Reuses `shared/utils/validation.helpers.ts`'s `Validators.isValidEmail` for personal/work email fields; adds `isValidPhone` (basic format check, since backend is the validation authority per architecture-doc §6.4 — frontend validation is UX-only, never trusted). No NIC-specific validator is added here — identity-document validation is country-driven per `profile-management.md` ("Country determines the identity document label... do not hardcode NIC globally"), so this frontend intentionally does not replicate the backend's country-specific identity rules; it defers entirely to the `422` field errors the backend returns.

  ## 8. Testing

  Jest, matching `general-settings.store.spec.ts` / `preferences-modal.component.spec.ts` conventions:

  - `modal.component.spec.ts` — extend for the new `size` input (default stays `md`, existing assertions unaffected).
  - `preferences-modal.component.spec.ts` — rewritten for the generic-shell behavior (tab switching via `activeTabIdChange`, no more Appearance-specific assertions inside this file — those move to `appearance-panel.component.spec.ts`).
  - `appearance-panel.component.spec.ts` — new, carries over the existing theme-preset assertions verbatim.
  - `profile.store.spec.ts` — load/save/error-state coverage per section, mocked `ProfileApiService` (same mocking pattern as `employee.store.spec.ts`).
  - `profile-api.service.spec.ts` — one test per endpoint call shape.
  - `personal-info-form.component.spec.ts`, `emergency-contacts-panel.component.spec.ts`, `dependents-panel.component.spec.ts`, `job-info-panel.component.spec.ts`, `payroll-panel.component.spec.ts` (including a `canEdit: false` case that asserts the edit form is absent, not just disabled), `security-panel.component.spec.ts` (password change + two-step MFA enable + disable-with-reauth).
  - `profile-menu.component.spec.ts` — extend for tab-array composition and the `@defer` trigger.

  ## 9. Accessibility & error handling

  No deviation from the architecture doc's standard patterns: `@if (loading) / @else if (error) / @else` in every panel (§7.4), `aria-selected`/`role="radiogroup"` patterns already used in the existing Appearance grid carried over to the new sub-tab nav, `409` handled via the existing error taxonomy (no new HTTP-code mapping required), focus trap already provided by `ModalComponent`.

  ## 10. Out of scope

  - Documents/onboarding-tasks and Time Off/lifecycle content — user decision; these stay on their existing dedicated pages (Work/Time Off/Attendance nav items), not duplicated in this popup.
  - A modal-service/overlay registry refactor — out of scope; `ProfileMenuComponent` keeps owning the modal's open/close state exactly as it does today, just with a richer `tabs`/`activeTabId` surface.
  - Any change to `AuthStore` — `ProfileStore` is a separate, new store; `AuthStore` is not touched.

  ## 11. Self-review

  - No placeholders — every field traces to the companion backend spec's API contract.
  - Internal consistency: the layering fix (§3) was the one architectural risk flagged during design review (putting domain forms in `shared/ui/`) and is resolved here before any component is scoped, not left as an implementation-time surprise.
  - Scope: matches the user's explicit "5 sections in the popup, link out for the rest" decision — Documents/Time Off deliberately excluded rather than force-fit into the modal.
  - Ambiguity resolved: `canEdit`-driven form visibility (hide vs. disable) for Payroll was decided explicitly (hide) to avoid a submit-then-403 dead end, rather than left to whoever implements `payroll-panel`.
