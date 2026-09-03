# General Settings Design Refresh — Report

## Summary

Redesigned Settings → General Settings into a page with four clearly-grouped form sections and a company logo preview that visually matches the sidebar's top tile, via a new shared `CompanyLogoTileComponent`. A follow-up pass then **resolved the sidebar/General-Settings logo URL mismatch** flagged in the original version of this report: both now build the logo image URL through the same verified `LegalEntityApiService.getLogoUrl()` method.

## Files changed

**New:**
- `src/app/shared/ui/company-logo-tile/company-logo-tile.component.ts`
- `src/app/shared/ui/company-logo-tile/company-logo-tile.component.css`
- `src/app/shared/ui/company-logo-tile/company-logo-tile.component.spec.ts`
- `docs/superpowers/plans/2026-08-13-general-settings-design-refresh.md` (implementation plan)

**Modified:**
- `src/app/layouts/main-layout/side-navbar/side-navbar.component.ts`
- `src/app/layouts/main-layout/side-navbar/side-navbar.component.html`
- `src/app/layouts/main-layout/side-navbar/side-navbar.component.css`
- `src/app/layouts/main-layout/side-navbar/side-navbar.component.spec.ts`
- `src/app/modules/organization/feature/general-settings/general-settings.component.ts`
- `src/app/modules/organization/feature/general-settings/general-settings.component.html`
- `src/app/modules/organization/feature/general-settings/general-settings.component.css`
- `src/app/modules/organization/feature/general-settings/general-settings.component.spec.ts`

No backend, API contract, DTO, or permission-guard changes. `legal_entity:update` gating (`hasAccess()`) and the route-level `permissionGuard` are untouched.

## What changed visually

1. **Section regroup** in General Settings, all 20 existing form fields preserved, only their grouping/headings changed:
   - **Company identity** — logo + Company name, Company code
   - **Registration & contact** — registration number, tax registration number, VAT/GST, status, email, phone, website
   - **Regional defaults** — country, currency, timezone, financial year start, first day of week, standard working days, default language, date format, time format
   - **Default work hours** — unchanged (work start/end time + validation messages)
2. Sticky save bar: unchanged, still always visible with the same hint text and button.
3. Logo preview in the "Company identity" section: renders via `<app-company-logo-tile size="lg">` instead of a dashed placeholder box with a generic image icon. When no logo is set it shows the same rounded-square initial tile as the sidebar (was: a generic outline icon). The `lg` variant adds `border: 1px solid var(--color-border)` (General Settings only, `sm`/`md` untouched) because the sidebar tile's legibility relies on shadow contrast against the dark `--color-sidebar-bg`, which the light `.gs-section` surface doesn't provide.
4. An earlier draft of this change added a header identity card (logo + name + code + status pill) above the form. **That card was removed** after review — the page now goes straight from the breadcrumb into "Company identity", matching the originally-requested layout. `CompanyLogoTileComponent` and the shared-component work were kept; only the extra header card was reverted.

## Logo URL mismatch — root cause, investigation, and fix

**Root cause:** the sidebar's tile (`side-navbar.component.ts`) built its logo `src` as a hardcoded literal, `'/api/v1/files/' + logoFileId` — no `environment.apiUrl` prefix, no legal-entity scoping, and not backed by any method in `LegalEntityApiService`. General Settings, meanwhile, used `LegalEntityApiService.getLogoUrl(legalEntityId, logoFileId)` → `${environment.apiUrl}/org/legal-entities/{id}/logo?v={logoFileId}`. These are two different URL shapes for the same underlying image.

**Verification against the backend** (`C:\onevoNew\HRMS-Backend-v1`, read-only — no backend files were changed):
- Searched the entire backend for a `FilesController` or any route matching `api/v1/files`: **none exists.** The sidebar's old URL 404s unconditionally, for every user, every time a company has a logo.
- `src/ONEVO.Api/Controllers/Tenant/OrgStructure/LegalEntitiesController.cs` defines exactly one logo-serving route:
  ```csharp
  [HttpGet("{id:guid}/logo")]
  [RequirePermission("legal_entity:update")]
  public async Task<IActionResult> GetLogo(Guid id, CancellationToken ct) { ... return File(result.Value!.Content, result.Value!.ContentType); }
  ```
  under `[Route("api/v1/org/legal-entities")]` — i.e. `GET /api/v1/org/legal-entities/{id}/logo`, which is exactly what `LegalEntityApiService.getLogoUrl()` already builds. `PUT`/`DELETE` on the same path (upload/remove) confirmed this is the live, real resource.

**Chosen canonical pattern:** `LegalEntityApiService.getLogoUrl(legalEntityId, logoFileId)` — scoped, environment-aware, cache-busted (`?v={logoFileId}`), and now confirmed to be the *only* route that actually serves the image.

**Fix applied:** `side-navbar.component.ts` now injects `LegalEntityApiService` (the same data-access service `GeneralSettingsComponent` already used) and computes:
```ts
readonly companyLogoUrl = computed(() => {
  const company = this.selectedCompany();
  return company?.logoFileId ? this.legalEntityApi.getLogoUrl(company.id, company.logoFileId) : null;
});
```
No new endpoint was invented, no raw storage key is exposed in the template (the file id is only ever passed into the existing service method, never rendered or used as a raw path segment by hand), and `CompanyLogoTileComponent` is unchanged — it still just receives a final `logoUrl` string input and stays fully presentational/API-agnostic, per the constraint that it "should not know API route rules."

**Fallback behavior preserved:** when `logoFileId` is absent, both call sites pass `null`/`undefined` into `CompanyLogoTileComponent`, which renders the initials tile exactly as before — untouched by this fix.

## Tests run

```
npx ng test --no-watch --include "src/app/modules/organization/**/*.spec.ts" --include "src/app/layouts/**/*.spec.ts" --include "src/app/shared/**/*.spec.ts"
```
Result: **47 test files, 347 tests — all passed.**

What changed in this pass:
- `side-navbar.component.spec.ts`:
  - Updated the existing "renders the company logo image via the shared tile..." test to assert the scoped URL (`${environment.apiUrl}/org/legal-entities/co-1/logo?v=file-9`) instead of the old `/api/v1/files/file-9` literal.
  - Added a new regression test, **"resolves the same logo URL as General Settings (`LegalEntityApiService.getLogoUrl`) for the same company/logo id"** — it injects the real `LegalEntityApiService`, computes the expected URL from it directly (the service is the single oracle), and asserts the sidebar's rendered `<img>` `src` equals that value exactly. This is the test that proves sidebar and General Settings converge on one URL pattern.
  - All other pre-existing sidebar tests (nav visibility, active-item highlighting, initial-tile fallback, tooltip) pass unmodified.
- `company-logo-tile.component.spec.ts` and `general-settings.component.spec.ts`: unchanged in this pass — `CompanyLogoTileComponent`'s input contract (`name`/`logoUrl`/`size`) did not change, and General Settings was already using the correct URL.

```
npm run build
```
Result: **succeeded**, no new TypeScript/template errors. Pre-existing per-component CSS budget *warning* (4kB soft threshold, 8kB hard error threshold) on `general-settings.component.css` (4.71kB after the header-card CSS was removed, down from 6.10kB) — well under the error threshold; several other components in this codebase already exceed the same soft threshold.

```
git diff --check
```
Result: **exit code 0** after fixing one real finding — a stray blank line at EOF in `general-settings.component.css` left over from the header-card removal, which `git diff --check` correctly flagged as a new-blank-line-at-EOF issue. Fixed. Only benign CRLF/LF `core.autocrlf` notices remain (not check failures).

## Remaining risks

1. **The verified endpoint is permission-gated.** `GET /api/v1/org/legal-entities/{id}/logo` requires `legal_entity:update` — the same permission that gates editing General Settings, which most regular employees will not have. That means: for users *without* `legal_entity:update`, the sidebar's logo image request will now get a `403` instead of the previous unconditional `404`. Visually this is not a regression (both render a broken-image glyph in the `<img>`; `CompanyLogoTileComponent` has no `onerror`-to-initials fallback, deliberately not added in this pass — see below), but it means the sidebar logo is effectively admin-only-visible until the backend either loosens that GET's permission (e.g. to `org:read`, which is what gates the company list itself) or the frontend adds a graceful image-load-failure fallback. Recommend picking one of those as an explicit follow-up; this task's scope was strictly "unify the URL pattern," not "make the image load for everyone."
2. **A graceful `onerror` → initials fallback was deliberately not added** to `CompanyLogoTileComponent` in this pass. `AvatarComponent` in this codebase already has this exact pattern (image-load failure falls back to initials), so it would be a small, precedented addition — but it's a distinct behavioral change from "unify the URL," so it was left out to keep this change reviewable as one thing. Flagged here as the natural next step, especially given risk #1 above.
3. **`logoFileId` can go stale in the sidebar's source of truth.** The sidebar reads `logoFileId` from `LegalEntityStore`'s company-list item (`LegalEntityListItem`), while General Settings reads the freshly-loaded value from `GeneralSettingsStore.settings()`. After a logo upload, `GeneralSettingsComponent.onSubmit()` → `legalEntityStore.updateCompanyDisplay(...)` only patches `name`/`companyCode`/`isActive` — not `logoFileId`. So immediately after uploading or removing a logo, the sidebar's `?v=` cache-buster (or the presence/absence of an image at all) can lag behind General Settings until the company list is next reloaded (e.g. next page load). The *URL pattern* is now unified; this staleness is a separate, pre-existing data-freshness gap, noted per instructions rather than fixed.
4. No live-rendered visual review was performed (this environment has no reachable authenticated tenant instance) — recommend a quick manual pass on `/settings/general` and the sidebar for a company with and without a logo once a tenant environment is available.
5. Not committed or pushed, per instructions — all changes are in the working tree for review.
