# Frontend bundle size ஆய்வு — 2026-11-11

> Branch: `feature/overtime-forecast-widgets` · Builder: `@angular/build:application` (esbuild) · Angular 21
> Command: `npx ng build --configuration production --stats-json` (output repo-க்கு வெளியே scratchpad-ல்; app code எதுவும் மாற்றவில்லை)

## 1. சுருக்கம் (TL;DR)

- `ng serve` காட்டும் size-கள் (**2.38 MB**, 871 kB …) **dev build** — minify இல்லை, sourcemap உண்டு. Production-ல் அதே chunk-கள் **3–4 மடங்கு சிறியவை**, network-ல் brotli/gzip ஆன பிறகு **15–20 மடங்கு சிறியவை**.
- **Initial bundle நல்ல நிலையில் உள்ளது**: 491 kB raw / ~122 kB transfer. சாதாரண Angular enterprise app-களுக்கு (initial 300–600 kB raw, 100–180 kB gzip) இது சராசரிதான்.
- **உண்மையான பிரச்சனை third-party library இல்லை.** எல்லா JS-லும் node_modules = 839 kB, நம் app code = **4,671 kB**. பிரச்சனை நம் code எப்படி split ஆகிறது என்பதில்:
  1. `main-layout` (login-க்குப் பின் **எல்லா page-க்கும்** load ஆகும்) eagerly Task form modal + Add Employee wizard + rich-text editor-ஐ இழுக்கிறது → **+1,039 kB raw / +231 kB brotli** ஒவ்வொரு page-க்கும்.
  2. Dashboard home ஒரு static `WIDGET_REGISTRY` மூலம் **எல்லா widget-களையும், எல்லா detail dialog-களையும்** ஒரே 772 kB chunk-ல் load செய்கிறது — user பார்க்காத hidden widget-கள் உட்பட.
  3. Dashboard greeting-ல் **~1 MB PNG படம்** (time-of-day illustration) — எல்லா JS-ஐ விட பெரியது.
- Login-க்குப் பின் home page-ன் முதல் load ≈ **~510 kB compressed JS/CSS + ~1 MB படம்**. இதை சுமார் **~200 kB + ~80 kB படம்** ஆக குறைக்க முடியும்.

## 2. Production size — உண்மை எண்கள்

### Initial (முதல் page load, login page உட்பட)

| | Raw (minified) | Transfer (gzip est.) |
|---|---|---|
| Initial total (JS + CSS) | **491.5 kB** | **122.4 kB** |
| இதில் JS மட்டும் | 348 kB | ~101 kB (brotli) |
| `styles.css` (Tailwind + tokens) | 134.9 kB | 18 kB |

Budget (`angular.json`): initial warning 500 kB / error 1 MB → இப்போது **491.5 kB, warning-க்கு 8.5 kB மட்டுமே கீழே**. அடுத்த சில feature-களில் warning வரும் (zero-warnings rule-ஆல் `check:warnings` fail ஆகும்) — கவனம்.

Initial-ல் இருப்பது: `@angular/core` 149 kB, `@angular/router` 77 kB, `@angular/common` 47 kB, `rxjs` 22 kB, `@angular/platform-browser` 13 kB. இவை framework — தவிர்க்க முடியாதவை.

### Top lazy chunks (prod)

| Chunk | என்ன | Raw | gzip | brotli | Dev size |
|---|---|---|---|---|---|
| `chunk-JERZEVWD` | Dashboard widgets + dialogs (registry) | 772 kB | 196 kB | **133 kB** | 2.38 MB |
| `chunk-KJB7NLUX` | Work UI: task-form-modal, meeting-form, comments | 279 kB | 63 kB | 51 kB | 865 kB |
| `inbox-page` | Inbox | 276 kB | 68 kB | 55 kB | 871 kB |
| `employee-detail` | People → employee detail | 260 kB | 63 kB | 50 kB | 863 kB |
| `calendar-page` | Calendar/Planner | 233 kB | 59 kB | 49 kB | 695 kB |
| `general-settings` | Org settings (**leaflet 146 kB**) | 201 kB | 56 kB | 49 kB | — |
| `position-management` | Org positions | 189 kB | 41 kB | 33 kB | 551 kB |
| `profile-tab` | Profile (qrcode 23 kB) | 150 kB | 28 kB | 23 kB | — |
| `time-tracking` | Attendance | 142 kB | 31 kB | 25 kB | 423 kB |
| `chunk-3MEEPKM4` | Add Employee wizard | 141 kB | 30 kB | 26 kB | — |
| `main-layout` | Layout shell | 128 kB | 29 kB | 25 kB | 761 kB |
| `chunk-KTLNYPQU` | Rich-text editor + DOMPurify | 106 kB | 30 kB | 26 kB | — |

மொத்தம் 202 JS file-கள், 5.6 MB raw — ஆனால் ஒரு user ஒரே நேரத்தில் இதில் ஒரு சிறு பகுதியை மட்டுமே download செய்வார்.

### ஒவ்வொரு page-க்கும் உண்மையில் download ஆவது (initial-க்கு மேல், static imports closure)

| Route | Raw | Brotli |
|---|---|---|
| Login | +57 kB | +13 kB |
| `main-layout` மட்டும் (எல்லா page-க்கும்) | **+1,039 kB** | **+231 kB** |
| Dashboard home (main-layout உட்பட) | **+1,907 kB** | **+390 kB** |
| Inbox | +761 kB | +184 kB |
| Task board | +902 kB | +204 kB |
| Employee detail | +1,106 kB | +253 kB |
| Calendar | +996 kB | +229 kB |

(Chunk-கள் browser cache-ல் share ஆகும் — முதல் page-க்குப் பின் அடுத்த page-கள் இதைவிடக் குறைவாக download செய்யும்.)

## 3. ஏன் பெரியது — காரணங்கள் (எண்களுடன்)

### காரணம் 1 — `DraftModalHost` main-layout-ல் eager import (மிகப் பெரியது)

`src/app/layouts/main-layout/draft-modal-host/draft-modal-host.component.ts:3-4`:

```ts
import { TaskFormModalComponent } from '../../../modules/work/ui/task-form-modal/task-form-modal.component';
import { AddEmployeeWizardComponent } from '../../../modules/people/feature/add-employee-wizard/add-employee-wizard.component';
```

Draft-ஐ user திறந்தால் மட்டுமே இவை காட்டப்படுகின்றன (`@if (store.activeDraft())`), ஆனால் `@if` code-ஐ lazy ஆக்காது. அதனால் **எல்லா page-லும்**:

| இழுக்கப்படுவது | Raw |
|---|---|
| `modules/work/ui` (task-form-modal மட்டும் 146 kB) | 229 kB |
| Add Employee wizard + store | 136 kB |
| Rich-text editor + DOMPurify | 100 kB |
| `@angular/cdk` (drag-drop/overlay) | 57 kB |
| Work meetings form | 45 kB |
| `@angular/forms` | 40 kB |
| date/time/date-range picker, select, comment-composer… | ~85 kB |
| `i18n-iso-countries` + `diacritics` | 23 kB |

Layout-க்கு உண்மையில் தேவையானது (top-navbar, side-navbar, mobile nav, tray gate, signalr) ~200 kB மட்டுமே.

### காரணம் 2 — Dashboard `WIDGET_REGISTRY` எல்லாவற்றையும் static ஆக import செய்கிறது

`src/app/modules/dashboard/widgets/widget-registry.ts` 18 widget card component-களை நேரடியாக import செய்கிறது. ஒவ்வொரு card-ம் அதன் detail dialog-ஐயும் static ஆக import செய்கிறது. விளைவு: ஒரே **772 kB chunk** (dev-ல் 2.38 MB). இதில்:

- `team-progress-detail-dialog` 58 kB, `team-progress-card` 55 kB, `team-schedule-detail-dialog` 48 kB, `team-schedule-card` 37 kB, இரண்டு forecast detail dialog-கள் 26 kB + 26 kB …
- `HIDDEN_WIDGET_KEYS` (my-tasks, work-pattern, notifications, wellbeing) — **ஒருபோதும் render ஆகாதவை, ஆனாலும் download ஆகின்றன**.
- My Team widget-கள் ஒரு சாதாரண employee-க்கும் download ஆகின்றன.
- Popup/detail dialog-கள் user click செய்யாவிட்டாலும் load.

### காரணம் 3 — பெரிய படங்கள் (JS-ஐ விடப் பெரியது)

| File | Size | எங்கே |
|---|---|---|
| `assets/dashboard/…fresh_early_morning.png` | 1.17 MB | dashboard greeting / today-at-a-glance / time-off hub |
| `…sunny_clear_midday.png` | 1.10 MB | அதே |
| `…golden_hour_sunset_dusk.png` | 1.00 MB | அதே |
| `…calm_night_sky_deep.png` | 0.94 MB | அதே |
| `assets/wellbeing/*.png` (5 files) | 3.0 MB | wellbeing carousel (hidden widget) |

1376×768 RGB PNG — ஒரு vector-style illustration-க்கு PNG மிக மோசமான format. WebP/AVIF-ல் இவை ~60–120 kB ஆகும். Home page-ல் ஒவ்வொரு login-க்கும் ~1 MB படம் இது.

### காரணம் 4 — மிகப் பெரிய single component file-கள் (inline template + styles)

| File | Source size | Prod output |
|---|---|---|
| `work/ui/task-form-modal/task-form-modal.component.ts` | **214 kB** (ஒரே file) | 146 kB |
| `shared/ui/rich-text-editor/rich-text-editor.component.ts` | 113 kB | 70 kB |
| `people/feature/add-employee-wizard` (ts+html+css) | 168 kB | 118 kB |

Component CSS மட்டும் மொத்தம் **302 kB** JS-க்குள் (129 component-கள்). ஒரு modal 146 kB minified என்பது — பல tab/section-கள் ஒரே component-ல் இருப்பதன் அடையாளம். இதை sub-component-களாக பிரித்து `@defer` செய்யலாம்.

### காரணம் 5 — Third-party libraries (சிறிய பங்கு, ஏற்கனவே பெரும்பாலும் சரி)

| Library | Size | Chunk | நிலை |
|---|---|---|---|
| `leaflet` | 146 kB | general-settings மட்டும் | சரி — map உள்ள page-ல் மட்டும். Map picker-ஐ `@defer (on viewport)` செய்தால் settings page இன்னும் வேகம் |
| `@angular/cdk` | 122 kB | 2 shared chunks | தேவை; ஆனால் main-layout வழியாக eager (காரணம் 1) |
| `@microsoft/signalr` | 54 kB | main-layout | Realtime notification-க்கு தேவை — சரி |
| `emoji-picker-element` | 37 kB | dynamic import | ✅ ஏற்கனவே lazy |
| `lucide` | 35 kB | 15 route-களில் shared | per-icon import — சரி |
| `dompurify` | 30 kB | rich-text chunk | security-க்கு தேவை |
| `qrcode` | 23 kB | profile-tab | 2FA setup click-ல் dynamic import செய்யலாம் (சிறிய வெற்றி) |
| `i18n-iso-countries` | 16 kB | wizard வழியாக main-layout | காரணம் 1 சரிசெய்தால் தானாக போகும் |
| `d3-force` | 14 kB | network graph | சரி |

Moment / lodash / chart.js / xlsx / pdf / Angular Material — **எதுவும் இல்லை**. Library duplication இல்லை (ஒவ்வொரு package-ம் ஒரே chunk-ல்). இது நல்ல செய்தி.

## 4. Production config சரிபார்ப்பு

- `production` config-ல் `optimization`, `sourceMap`, `namedChunks` எழுதவில்லை → Angular defaults: **optimization on, sourceMap off, namedChunks off, extractLicenses on** ✅. (`buildOptimizer` esbuild builder-ல் இல்லை; தேவையில்லை.)
- `outputHashing: all` ✅ — long-term caching-க்கு நல்லது.
- Budgets: `anyComponentStyle` 45/55 kB — சரி. ஆனால் **lazy chunk-களுக்கு budget இல்லை**, அதனால்தான் 772 kB dashboard chunk எந்த warning-மும் இல்லாமல் வளர்ந்தது.
- `@angular/cdk/overlay-prebuilt.css` இரண்டு முறை (`angular.json` styles + `styles.css` `@import`) — 1.7 kB, சிறியது; ஒன்றை நீக்கலாம்.
- `staging` config-ல் `sourceMap: true` — staging-க்கு சரி, ஆனால் `.map` file-கள் public server-க்கு deploy ஆகாமல் பார்க்கவும்.
- Server-ல் **brotli/gzip compression on ஆக இருக்கிறதா** என்று production web server / CDN-ல் உறுதி செய்யவும் — இல்லையென்றால் மேலே உள்ள "raw" எண்களே network-ல் போகும் (4–6 மடங்கு அதிகம்).

## 5. இது உண்மையில் "too big"-ஆ?

- **Initial: இல்லை.** 122 kB transfer — நல்லது.
- **Login-க்குப் பிந்தைய home page: ஆம், தேவையில்லாமல் பெரியது.** ~510 kB compressed JS/CSS + 1 MB படம். ஒரு நல்ல Angular enterprise app-ல் ஒரு route-க்கு 100–200 kB compressed வழக்கம். 4G-ல் இது ~1–2 விநாடி கூடுதல்; slow office Wi-Fi-ல் இன்னும் அதிகம். Parse/compile time-ம் (1.9 MB raw JS) low-end laptop-களில் தெரியும்.
- **மற்ற route-கள்: சராசரி**, ஆனால் main-layout-ன் 231 kB எல்லாவற்றிலும் சேர்கிறது.

## 6. சரிசெய்யும் பட்டியல் (பெரிய வெற்றி முதலில்)

| # | என்ன செய்வது | சேமிப்பு (est.) | Effort |
|---|---|---|---|
| 1 | **Dashboard படங்களை WebP/AVIF ஆக மாற்று** (1376×768 → ~1200 px, quality 75), `<img loading="lazy" decoding="async">` அல்லது `NgOptimizedImage`. Wellbeing PNG-களும். | **~0.9 MB home page-ல்** (4.1 MB → ~0.3 MB; wellbeing 3 MB → ~0.25 MB) | மிகக் குறைவு (½ நாள், code change பெரும்பாலும் file extension மட்டும்) |
| 2 | **`DraftModalHost`-ல் `@defer (when store.activeDraft())`** அல்லது `TaskFormModal`/`AddEmployeeWizard`-ஐ `import()` + `NgComponentOutlet` மூலம் load. | **எல்லா page-லும் ~−800 kB raw / ~−180 kB brotli** | குறைவு (1–2 மணி) |
| 3 | **`WIDGET_REGISTRY` → lazy loaders**: `component` க்கு பதில் `load: () => import('…').then(m => m.X)`; grid user-ன் layout-ல் உள்ள widget-களை மட்டும் resolve செய்து `NgComponentOutlet`-ல் render. Hidden widget-களை registry-லிருந்தே நீக்கலாம். | Employee home: ~−600 kB raw / ~−100 kB brotli; manager-க்கு காட்டும் widget-களைப் பொறுத்து | நடுத்தரம் (½–1 நாள்; widget creation rules doc-ஐயும் update செய்ய வேண்டும்) |
| 4 | **Detail/popup dialog-களை click-ல் மட்டும் load** (`await import('…detail-dialog.component')` பிறகு `Dialog.open`) — team-progress, team-schedule, forecast, attendance dialogs. | ~−200 kB raw / ~−40 kB brotli dashboard-ல் | குறைவு–நடுத்தரம் |
| 5 | **Lazy chunk budget சேர்** (`angular.json` → `{"type": "bundle", "name": "...", ...}` அல்லது CI-ல் stats script மூலம் "எந்த lazy chunk-ம் 300 kB raw தாண்டக்கூடாது"). மேலும் initial warning 500 kB-க்கு இப்போதே அருகில் — fix #2 பிறகு initial மாறாது, ஆனால் எதிர்கால regression-ஐ பிடிக்கும். | Regression தடுப்பு | குறைவு |
| 6 | **`task-form-modal` (214 kB file) பிரிப்பு**: tab/section-களை (comments, history, attachments, clock widget) child component-களாக மாற்றி `@defer (on interaction/viewport)`. Rich-text editor-ஐயும் editor focus/viewport-ல் `@defer`. | Task modal திறப்பு ~−80 kB raw | நடுத்தரம்–அதிகம் (1–2 நாள், test-கள் update) |
| 7 | `general-settings`-ல் office-location-picker (leaflet) `@defer (on viewport)`; `qrcode`-ஐ 2FA setup click-ல் `import()`. | −146 kB / −23 kB அந்த page-களில் | குறைவு |
| 8 | Server/CDN-ல் brotli + `Cache-Control: max-age=31536000, immutable` hashed file-களுக்கு; `index.html`-க்கு `no-cache`. | Repeat visit-ல் ~100% JS cache hit | குறைவு (deploy config) |

**#1 + #2 + #3 செய்தால் மட்டுமே** home page முதல் load: ~510 kB compressed + 1 MB படம் → **~230 kB compressed + ~80 kB படம்** (சுமார் 75% குறைவு), எந்த feature-ம் மாறாமல்.

## 7. இந்த ஆய்வை மீண்டும் ஓட்டுவது

```bash
npx ng build --configuration production --stats-json --output-path ../tmp-prodbuild
```

`stats.json` என்பது esbuild metafile. `outputs[chunk].inputs[file].bytesInOutput` = அந்த file chunk-ல் எவ்வளவு. `outputs[chunk].imports` (`kind: import-statement` = static, `dynamic-import` = lazy) மூலம் ஒரு route-ன் static closure-ஐ கணக்கிடலாம். Visual ஆக பார்க்க: `npx esbuild-visualizer --metadata ../tmp-prodbuild/stats.json`. Output-ஐ repo-ன் `dist/`-க்கு வெளியே வைக்கவும்.

## 8. செய்த fix-கள் (2026-11-11, அதே நாள்) — முடிவுகள்

Fix #2, #3 செய்யப்பட்டன; கூடுதலாக ஒரு leak கண்டுபிடித்து சரிசெய்யப்பட்டது. Commit செய்யவில்லை.

| File | மாற்றம் |
|---|---|
| `modules/dashboard/widgets/widget-registry.ts` | `component: X` → `load: () => import('…').then((m) => m.X)`. ஒவ்வொரு card-ம் தனி lazy chunk. |
| `modules/dashboard/ui/widget-frame/widget-frame.component.ts` | Layout-ல் உள்ள widget-க்கு மட்டும் `load()` அழைத்து, கிடைத்த component-ஐ `ngComponentOutlet`-ல் render. Chunk download fail ஆனால் unsupported placeholder. |
| `layouts/main-layout/draft-modal-host/draft-modal-host.component.ts` | Task form modal, Add Employee wizard → `@defer (on immediate)` (draft திறந்தால் மட்டும்). |
| `modules/dashboard/feature/todays-schedule-card/…component.html` | Meeting occurrence drawer → `@defer` (இது task form + rich-text editor-ஐ இழுத்து வந்தது, ~550 kB raw). |
| Specs | widget-registry, widget-frame (lazy load + load-fail test), draft-modal-host (`compileComponents` + `whenStable`). |
| `docs/design/WIDGET_CREATION_RULES.md` | Registry-ல் static import வேண்டாம் என்ற rule. |

### முன் / பின் (initial-க்கு மேல், static closure)

| | முன் (raw / brotli) | பின் (raw / brotli) |
|---|---|---|
| `main-layout` (எல்லா page-க்கும்) | 1,039 / 231 kB | **400 / 97 kB** |
| Dashboard home — employee "My Work" (6 widgets) | 1,907 / 390 kB | **673 / 173 kB** |
| Dashboard home — manager "My Team" (8 team widgets) | 1,907 / 390 kB | 1,088 / 267 kB |
| எல்லா widget-களும் ஒரே layout-ல் | 1,907 / 390 kB | 1,274 / 319 kB |
| Inbox / Task board / Employee detail / Calendar | மாற்றம் இல்லை (route-ன் சொந்த code) | — |

Initial bundle மாறவில்லை (491.5 kB / 122 kB). 772 kB dashboard chunk இப்போது இல்லை.

Manager layout இன்னும் 267 kB brotli — ஒவ்வொரு team card-ம் அதன் detail dialog-ஐ static ஆக import செய்கிறது (team-progress-card chunk 137 kB). அடுத்த படி: fix #4 (dialog-ஐ click-ல் `import()`). படங்கள் (fix #1) இன்னும் செய்யவில்லை.

### சரிபார்ப்பு

- `ng build --configuration production`: 0 warnings, 0 errors.
- ESLint (மாற்றிய folder-கள்): 0.
- `ng test`: 5,770 / 5,784 pass. 14 fail-களும் மாற்றாத file-களில்: `pan-zoom-canvas` (தனியாக ஓட்டினால் pass — full-run load flake), `main-layout.component.spec` முதல் test 5 s timeout (இந்த மாற்றம் இல்லாமலும் fail — முன்பே இருந்தது), `profile-menu`, `project.mapper`, `project-list.store`, `tray-presence` (working tree-ல் உள்ள மற்ற uncommitted மாற்றங்கள்).
- Browser-ல் manual check இன்னும் செய்யவில்லை: dashboard widget-கள் load ஆகின்றனவா, drafts bar-லிருந்து task/employee draft திறக்கிறதா, Today's schedule-ல் meeting click → drawer.
