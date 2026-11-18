# API Types from the Backend Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run api:types`, which turns the backend Swagger document into a committed TypeScript file. The Leave module's 16 request DTOs are then checked against it at compile time. A gap report tells the backend team what is missing from their contract.

**Architecture:** A small Node script (`scripts/api-types/`) does three things. It downloads the Swagger document, relaxing TLS only for localhost because the dev cert is self-signed, or it reads a file passed with `--input`. It runs `openapi-typescript` (types only, no client) and formats the output with the repo's Prettier config. It then writes `src/app/shared/api-types/backend-api.generated.ts`, or with `--check` compares against that file and fails on any difference. A hand-written `api-schema.ts` adds the `ApiSchema<'Name'>` lookup and two compile-time assertions, `MatchesContract` and `SameAsContract`. Leave uses them: every request DTO gets a contract assertion, and the ones that equal the backend shape exactly become aliases of the generated types.

**Tech Stack:** Angular 21, TypeScript 5.9, `openapi-typescript` 7.13.0 (Node API), Prettier 3, `node:test`, Vitest via `ng test`.

---

## What the backend document actually contains (measured 2026-11-18)

Downloaded from `https://localhost:7229/swagger/v1/swagger.json` (OpenAPI 3.0.4, 535 paths, 621 operations, 220 schemas). Measurements:

- **No operation declares a response schema.** All 621 responses are `"200": { "description": "OK" }`. Response types such as `LeaveTypeResponse` **cannot** be generated, so they stay hand-written until the backend adds response metadata. This plan migrates **request** DTOs only, and says so in the docs.
- **No schema declares `required`.** By default every property would become optional (`?`). The generator therefore runs with `propertiesRequiredByDefault: true`.
- **420 of 530 string properties are `nullable`.** Swashbuckle is not reading C# nullable reference types, so `name` on `CreateLeaveTypeRequest` is shown as `string | null` even though the API rejects null.
- **3 enums are sent as bare integers:** `ProductivityReportScope`, `ExceptionStatus`, `ExceptionType` (Monitoring).
- **Schema ids are full .NET names**, for example `ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest` (`SwaggerExtensions.cs` sets `CustomSchemaIds(type => type.FullName...)`). This plan keeps the keys exactly as the backend sends them. `visible-product-name.guard.spec.ts` already allows `ONEVO.<Name>`. Stripping the prefix would collide on `CreateCalendarEventRequest` and `UpdateCalendarEventRequest`, which exist in both `Calendar` and `WorkManagement.CalendarEvents`.
- 37 schemas live under `ONEVO.Api.Controllers.*`: request records declared inside controllers. Another 28 are `ONEVO.Application.Features.*` and 2 are `ONEVO.Domain.Features.*`, all inner types leaking into the API contract.
- **Leave request DTOs vs backend (16 hand-written, 23 backend Leave contracts):**
  - Field names match on all 16.
  - 9 differ only in nullability, where the backend says nullable and the frontend says non-null: `ChangeLeaveDecisionRequest.decision`, `RejectLeaveRequestRequest.reason`, `CreateLeaveHolidayRequest.name`, `CreateManualEntitlementRequest.reason`, `AdjustEntitlementRequest.reason`, `CreateLeavePolicyRequest.name/assignments`, `UpdateLeavePolicyDetailsRequest.name`, `CreateLeaveTypeRequest.name/code/color/applicableGender/acceptedDocumentTypes`, `UpdateLeaveTypeRequest` (same minus `code`).
  - The frontend is also stricter in places, e.g. `decision: 'approve' | 'reject'` where the backend says `string`.

There is no `.github/workflows` in this repo and no backend Swagger artifact. So the CI part of the task ships as the `api:types:check` script plus written instructions. Wiring it into a pipeline is recorded as blocked (Task 7).

## File map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | Modify | `openapi-typescript` devDependency; `api:types`, `api:types:check`, `test:scripts` scripts |
| `scripts/api-types/api-types-lib.mjs` | Create | Pure helpers: `isLocalHost`, `normalizeEol`, `sameContent`, `generateTypes`, `download` |
| `scripts/api-types/api-types.test.mjs` | Create | `node:test` tests for the helpers |
| `scripts/api-types/generate-api-types.mjs` | Create | CLI: `--input`, `--url`, `--check` |
| `.gitattributes` | Create | Force LF on the generated file |
| `eslint.config.js` | Modify | Ignore `src/app/shared/api-types/*.generated.ts` |
| `src/app/shared/api-types/backend-api.generated.ts` | Create (generated) | Output of `npm run api:types` |
| `src/app/shared/api-types/api-schema.ts` | Create | `ApiSchemas`, `ApiSchema<K>`, `Assert`, `MatchesContract`, `SameAsContract` |
| `src/app/shared/api-types/api-schema.spec.ts` | Create | Compile-time tests via `@ts-expect-error` |
| `src/app/modules/leave/models/leave-api-contract.ts` | Create | 16 contract assertions |
| `src/app/modules/leave/models/*.model.ts` | Modify | Exact-match request DTOs become `ApiSchema<...>` aliases |
| `docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md` | Create | Gap report for the backend team |
| `docs/core/API_TYPES.md` | Create | How to regenerate and use the types |
| `docs/core/ARCHITECTURE.md` | Modify | §5.1 rule 7 |
| `docs/Improvements/person-4-api-layer-and-cleanup/task-08 Generate API types from the backend contract.md` | Modify | Status section |

---

### Task 1: Generator helpers with tests

**Files:**
- Modify: `package.json`
- Create: `scripts/api-types/api-types-lib.mjs`
- Test: `scripts/api-types/api-types.test.mjs`

- [ ] **Step 1: Install dependencies and the exact generator version**

Run from `C:\HR2\_wt-api-types`:

```powershell
npm ci
npm install --save-dev --save-exact openapi-typescript@7.13.0
```

Expected: `package.json` devDependencies gain `"openapi-typescript": "7.13.0"`, and `package-lock.json` changes.

- [ ] **Step 2: Write the failing tests**

Create `scripts/api-types/api-types.test.mjs`:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolve } from 'node:path';
import {
  GENERATED_PATH,
  generateTypes,
  isLocalHost,
  normalizeEol,
  sameContent,
} from './api-types-lib.mjs';

const target = resolve(GENERATED_PATH);

const demoDoc = {
  openapi: '3.0.4',
  info: { title: 'demo', version: '1' },
  paths: {},
  components: {
    schemas: {
      'Demo.Contracts.Thing': {
        type: 'object',
        properties: {
          name: { type: 'string', nullable: true },
          count: { type: 'integer', format: 'int32' },
        },
        additionalProperties: false,
      },
    },
  },
};

describe('isLocalHost', () => {
  it('accepts loopback hosts only', () => {
    assert.equal(isLocalHost('https://localhost:7229/swagger/v1/swagger.json'), true);
    assert.equal(isLocalHost('https://127.0.0.1:7229/x'), true);
    assert.equal(isLocalHost('https://[::1]:7229/x'), true);
    assert.equal(isLocalHost('https://api.example.com/swagger.json'), false);
    assert.equal(isLocalHost('https://localhost.example.com/x'), false);
  });
});

describe('normalizeEol / sameContent', () => {
  it('treats CRLF and LF as the same content', () => {
    assert.equal(normalizeEol('a\r\nb\r\n'), 'a\nb\n');
    assert.equal(sameContent('a\r\nb\n', 'a\nb\n'), true);
    assert.equal(sameContent('a\nb\n', 'a\nc\n'), false);
  });
});

describe('generateTypes', () => {
  it('writes a do-not-edit header first', async () => {
    const out = await generateTypes(demoDoc, target);
    assert.match(out.split('\n')[1], /Generated by `npm run api:types`/);
    assert.match(out, /Do not edit by hand/);
  });

  it('keeps backend schema keys and makes properties required, keeping nullability', async () => {
    const out = await generateTypes(demoDoc, target);
    assert.match(out, /['"]Demo\.Contracts\.Thing['"]: \{/);
    assert.match(out, /\bname: string \| null;/);
    assert.match(out, /\bcount: number;/);
    assert.doesNotMatch(out, /\bname\?:/);
  });

  it('is deterministic and uses LF line endings', async () => {
    const a = await generateTypes(demoDoc, target);
    const b = await generateTypes(demoDoc, target);
    assert.equal(a, b);
    assert.equal(a.includes('\r\n'), false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test scripts/api-types/api-types.test.mjs`
Expected: FAIL with `Cannot find module ... api-types-lib.mjs`.

- [ ] **Step 4: Write the implementation**

Create `scripts/api-types/api-types-lib.mjs`:

```js
import http from 'node:http';
import https from 'node:https';
import openapiTS, { astToString } from 'openapi-typescript';
import { format, resolveConfig } from 'prettier';

/** Repo-relative path of the committed generated file. */
export const GENERATED_PATH = 'src/app/shared/api-types/backend-api.generated.ts';

/** Local backend Swagger document (Development only). */
export const DEFAULT_SWAGGER_URL = 'https://localhost:7229/swagger/v1/swagger.json';

const HEADER = [
  '/**',
  ' * Generated by `npm run api:types` from the backend Swagger document.',
  ' * Do not edit by hand. See docs/core/API_TYPES.md.',
  ' */',
  '',
].join('\n');

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalHost(url) {
  return LOOPBACK.has(new URL(url).hostname);
}

export function normalizeEol(text) {
  return text.replace(/\r\n/g, '\n');
}

export function sameContent(a, b) {
  return normalizeEol(a) === normalizeEol(b);
}

/**
 * Turns an OpenAPI document (parsed JSON) into the formatted TypeScript source.
 * `targetFile` is only used to find the Prettier config.
 *
 * - propertiesRequiredByDefault: the backend declares no `required` arrays, and
 *   .NET properties are always present, so a property is required unless the
 *   schema says otherwise. Nullability still comes from `nullable`.
 * - alphabetize: the diff shows contract changes, not reordering.
 */
export async function generateTypes(doc, targetFile) {
  const ast = await openapiTS(doc, { propertiesRequiredByDefault: true, alphabetize: true });
  const source = HEADER + astToString(ast);
  const prettierOptions = (await resolveConfig(targetFile)) ?? {};
  const formatted = await format(source, { ...prettierOptions, filepath: targetFile });
  return normalizeEol(formatted);
}

/**
 * Downloads a document. The local backend uses a self-signed dev certificate,
 * so certificate checks are skipped for loopback hosts only, never globally.
 */
export function download(url) {
  return new Promise((resolvePromise, reject) => {
    const parsed = new URL(url);
    const client = parsed.protocol === 'http:' ? http : https;
    const request = client.get(parsed, { rejectUnauthorized: !isLocalHost(url) }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`GET ${url} returned ${response.statusCode}`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () => resolvePromise(body));
    });
    request.on('error', reject);
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/api-types/api-types.test.mjs`
Expected: PASS, 6 tests, 0 failures.

If `openapiTS` rejects `alphabetize` as unknown, check `node_modules/openapi-typescript/dist/types.d.ts` for the option name. Do not drop the option silently: either fix the name or report back.

- [ ] **Step 6: Add the scripts test command**

In `package.json` `scripts`, add after `"test"`:

```json
"test:scripts": "node --test scripts/api-types/api-types.test.mjs",
```

Run: `npm run test:scripts` and confirm it passes.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json scripts/api-types/api-types-lib.mjs scripts/api-types/api-types.test.mjs
git commit -m "feat(api-types): add openapi-typescript generator helpers"
```

---

### Task 2: CLI script, npm commands and repo gates

**Files:**
- Create: `scripts/api-types/generate-api-types.mjs`
- Modify: `package.json`, `eslint.config.js`
- Create: `.gitattributes`

- [ ] **Step 1: Write the CLI**

Create `scripts/api-types/generate-api-types.mjs`:

```js
#!/usr/bin/env node
// Generates src/app/shared/api-types/backend-api.generated.ts from the backend Swagger document.
//
//   npm run api:types                          # from the local backend (https://localhost:7229)
//   npm run api:types -- --input swagger.json  # from a saved document (CI artifact)
//   npm run api:types -- --url <swagger url>   # from another backend (or set API_SWAGGER_URL)
//   npm run api:types:check [-- --input ...]   # fail if the committed file is out of date
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  DEFAULT_SWAGGER_URL,
  GENERATED_PATH,
  download,
  generateTypes,
  sameContent,
} from './api-types-lib.mjs';

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    url: { type: 'string' },
    check: { type: 'boolean', default: false },
  },
});

async function readSource() {
  if (values.input) {
    return readFile(values.input, 'utf8');
  }
  const url = values.url ?? process.env.API_SWAGGER_URL ?? DEFAULT_SWAGGER_URL;
  try {
    return await download(url);
  } catch (error) {
    throw new Error(
      `Could not read ${url}: ${error.message}\n` +
        'Is the backend running in Development (Swagger is only on in Development)? ' +
        'Or pass a saved document with --input <file>.',
    );
  }
}

async function main() {
  const doc = JSON.parse(await readSource());
  const target = resolve(GENERATED_PATH);
  const generated = await generateTypes(doc, target);

  if (values.check) {
    const current = await readFile(target, 'utf8').catch(() => '');
    if (!sameContent(current, generated)) {
      console.error(
        `${GENERATED_PATH} is out of date with the backend contract.\n` +
          'Run `npm run api:types` and commit the result.',
      );
      process.exit(1);
    }
    console.log(`${GENERATED_PATH} matches the backend contract.`);
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, generated);
  console.log(`Wrote ${GENERATED_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm commands**

In `package.json` `scripts`, add:

```json
"api:types": "node scripts/api-types/generate-api-types.mjs",
"api:types:check": "node scripts/api-types/generate-api-types.mjs --check",
```

- [ ] **Step 3: Check the error path without a backend**

Run: `npm run api:types -- --url https://localhost:1/swagger.json`
Expected: exit code 1, with a message starting `Could not read https://localhost:1/swagger.json` that mentions `--input`. No file is written:

```powershell
Test-Path src/app/shared/api-types/backend-api.generated.ts
```

That should print `False`.

- [ ] **Step 4: Force LF on the generated file**

Create `.gitattributes`:

```
# Generated from the backend Swagger document; LF so `npm run api:types:check` is stable on Windows.
src/app/shared/api-types/*.generated.ts text eol=lf
```

- [ ] **Step 5: Keep ESLint off the generated file**

In `eslint.config.js` line 9, change the `ignores` array to:

```js
    ignores: ['dist/**', '.angular/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'src/app/shared/api-types/*.generated.ts'],
```

Then run Prettier on that file only: `npx prettier --write eslint.config.js`.

- [ ] **Step 6: Commit**

```powershell
git add scripts/api-types/generate-api-types.mjs package.json .gitattributes eslint.config.js
git commit -m "feat(api-types): add api:types and api:types:check commands"
```

---

### Task 3: Generate and commit the backend types

**Files:**
- Create (generated): `src/app/shared/api-types/backend-api.generated.ts`

- [ ] **Step 1: Make sure the backend is up**

```powershell
curl.exe -sk -o NUL -w "%{http_code}" https://localhost:7229/swagger/v1/swagger.json
```

Expected: `200`. If it is not, start the API the way the memory note `run-all-four-projects` describes. Don't use `scripts/run-all.ps1`'s swagger probe: it can report DOWN while the API is actually serving.

- [ ] **Step 2: Generate**

Run: `npm run api:types`
Expected: `Wrote src/app/shared/api-types/backend-api.generated.ts`.

- [ ] **Step 3: Sanity-check the output**

```powershell
Select-String -Path src/app/shared/api-types/backend-api.generated.ts -Pattern "'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest': \{" -SimpleMatch
Select-String -Path src/app/shared/api-types/backend-api.generated.ts -Pattern "name\?:" | Measure-Object
```

Expected: the first command finds one line, and the second reports `Count : 0`. If quotes differ (`"` vs `'`), adjust the pattern. The key point is that the schema key exists.

- [ ] **Step 4: The check passes against the same document**

Run: `npm run api:types:check`
Expected: `src/app/shared/api-types/backend-api.generated.ts matches the backend contract.`, exit code 0.

- [ ] **Step 5: The check fails when the file drifts**

Append one line, run the check, then restore:

```powershell
Add-Content src/app/shared/api-types/backend-api.generated.ts "// drift"
npm run api:types:check
git checkout -- src/app/shared/api-types/backend-api.generated.ts 2>$null; npm run api:types
```

Expected: the check exits 1 with `is out of date with the backend contract`. The regenerate then restores the file. The file is not committed yet, so regenerate instead of checking out.

- [ ] **Step 6: Repo gates on the new file**

```powershell
npx ng test --watch=false --include=src/app/visible-product-name.guard.spec.ts
npx tsc -p tsconfig.app.json --noEmit
npx prettier --check src/app/shared/api-types/backend-api.generated.ts
```

Expected: the guard spec passes, `tsc` prints nothing, and Prettier reports the file formatted.

If the guard fails on a line in the generated file, print the line. If it contains `ONEVO` not followed by `.` and an uppercase letter, report it back instead of editing the generated file or the guard.

- [ ] **Step 7: Commit**

```powershell
git add src/app/shared/api-types/backend-api.generated.ts
git commit -m "feat(api-types): generate backend contract types"
```

---

### Task 4: `ApiSchema` lookup and contract assertions

**Files:**
- Create: `src/app/shared/api-types/api-schema.ts`
- Test: `src/app/shared/api-types/api-schema.spec.ts`

- [ ] **Step 1: Write the failing type tests**

Create `src/app/shared/api-types/api-schema.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ApiSchema, Assert, MatchesContract, SameAsContract } from './api-schema';

interface Gen {
  id: string;
  name: string | null;
  count: number;
}

// A frontend type may be stricter (non-null, optional) but must have the same keys and compatible types.
type _ok = Assert<MatchesContract<{ id: string; name: string; count: number }, Gen>>;
type _optional = Assert<MatchesContract<{ id: string; name?: string | null; count: number }, Gen>>;
// @ts-expect-error a renamed field is drift
type _renamed = Assert<MatchesContract<{ id: string; title: string; count: number }, Gen>>;
// @ts-expect-error a field the backend has but the frontend dropped is drift
type _missing = Assert<MatchesContract<{ id: string; name: string }, Gen>>;
// @ts-expect-error a field the frontend sends but the backend does not know is drift
type _extra = Assert<MatchesContract<{ id: string; name: string; count: number; more: boolean }, Gen>>;
// @ts-expect-error a changed field type is drift
type _retyped = Assert<MatchesContract<{ id: string; name: string; count: string }, Gen>>;

type _same = Assert<SameAsContract<Gen, Gen>>;
// @ts-expect-error a narrower frontend type is not "the same", so it must stay hand-written
type _narrower = Assert<SameAsContract<{ id: string; name: string; count: number }, Gen>>;

// The lookup resolves real generated keys.
type _lookup = Assert<
  MatchesContract<
    ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>,
    ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>
  >
>;

describe('api-schema contract assertions', () => {
  it('are checked by the TypeScript compiler (see the type aliases above)', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run the type check to verify it fails**

Run: `npx tsc -p tsconfig.spec.json --noEmit`
Expected: FAIL with `Cannot find module './api-schema'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/shared/api-types/api-schema.ts`:

```ts
import type { components } from './backend-api.generated';

/** Every schema in the backend Swagger document, keyed by its full backend type name. */
export type ApiSchemas = components['schemas'];

/** One backend schema, e.g. `ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>`. */
export type ApiSchema<K extends keyof ApiSchemas> = ApiSchemas[K];

/** Compiles only when `T` is `true`. Use it to turn a contract check into a build error. */
export type Assert<T extends true> = T;

type NoKeysMissingFrom<A, B> = [Exclude<keyof A, keyof B>] extends [never] ? true : false;

/**
 * True when a hand-written DTO still fits the backend contract: the same field names both ways,
 * and every field type assignable to the backend's. The frontend may be stricter (non-null where
 * the backend says nullable, a string union where it says string, optional where the backend
 * declares nothing as required).
 * A renamed, removed, added or retyped field makes it false.
 */
export type MatchesContract<Hand, Gen> = [Hand] extends [Partial<Gen>]
  ? NoKeysMissingFrom<Hand, Gen> extends true
    ? NoKeysMissingFrom<Gen, Hand>
    : false
  : false;

/** True when the hand-written DTO is exactly the generated one, so it can become an alias. */
export type SameAsContract<Hand, Gen> =
  MatchesContract<Hand, Gen> extends true
    ? [Gen] extends [Hand]
      ? [Hand] extends [Gen]
        ? true
        : false
      : false
    : false;
```

- [ ] **Step 4: Run the checks to verify they pass**

```powershell
npx tsc -p tsconfig.spec.json --noEmit
npx ng test --watch=false --include=src/app/shared/api-types/api-schema.spec.ts
npx eslint src/app/shared/api-types/api-schema.ts src/app/shared/api-types/api-schema.spec.ts
```

Expected:
- `tsc` prints nothing. Every `@ts-expect-error` is used, so a wrong helper shows `Unused '@ts-expect-error' directive`.
- 1 test passes, with no warnings.
- ESLint reports 0 problems. `_`-prefixed aliases are allowed by `varsIgnorePattern: '^_'`.

- [ ] **Step 5: Commit**

```powershell
git add src/app/shared/api-types/api-schema.ts src/app/shared/api-types/api-schema.spec.ts
git commit -m "feat(api-types): add ApiSchema lookup and contract assertions"
```

---

### Task 5: Leave as the reference module

**Files:**
- Create: `src/app/modules/leave/models/leave-api-contract.ts`
- Modify: request DTOs in `src/app/modules/leave/models/*.model.ts`, only the ones Step 2 proves equal

- [ ] **Step 1: Add the contract assertions for all 16 request DTOs**

Create `src/app/modules/leave/models/leave-api-contract.ts`:

```ts
import type { ApiSchema, Assert, MatchesContract } from '../../../shared/api-types/api-schema';
import type {
  ApproveLeaveRequestRequest,
  ChangeLeaveDecisionRequest,
  RejectLeaveRequestRequest,
} from './leave-approval.model';
import type { CreateLeaveHolidayRequest } from './leave-calendar.model';
import type {
  AdjustEntitlementRequest,
  CreateManualEntitlementRequest,
  GenerateEntitlementsRequest,
  RecalculateEntitlementRequest,
} from './leave-entitlement.model';
import type {
  AddLeavePolicyVersionRequest,
  CreateLeavePolicyRequest,
  UpdateLeavePolicyDetailsRequest,
} from './leave-policy.model';
import type {
  CancelLeaveRequestRequest,
  SubmitLeaveRequestOnBehalfRequest,
  SubmitLeaveRequestRequest,
} from './leave-request.model';
import type { CreateLeaveTypeRequest, UpdateLeaveTypeRequest } from './leave-type.model';

/**
 * Compile-time check that every Leave request DTO still matches the backend contract
 * (`npm run api:types`). If the backend renames, removes, adds or retypes a field, the build
 * fails here. Response DTOs are not checked: the backend Swagger has no response schemas yet
 * (see docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md).
 */
export type LeaveRequestContracts = [
  Assert<MatchesContract<SubmitLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestRequest'>>>,
  Assert<MatchesContract<SubmitLeaveRequestOnBehalfRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestOnBehalfRequest'>>>,
  Assert<MatchesContract<CancelLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>>>,
  Assert<MatchesContract<ChangeLeaveDecisionRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.ChangeLeaveDecisionRequest'>>>,
  Assert<MatchesContract<ApproveLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.ApproveLeaveRequestRequest'>>>,
  Assert<MatchesContract<RejectLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.RejectLeaveRequestRequest'>>>,
  Assert<MatchesContract<CreateLeaveHolidayRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Holidays.CreateLeaveHolidayRequest'>>>,
  Assert<MatchesContract<GenerateEntitlementsRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.GenerateEntitlementsRequest'>>>,
  Assert<MatchesContract<CreateManualEntitlementRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.CreateManualEntitlementRequest'>>>,
  Assert<MatchesContract<AdjustEntitlementRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.AdjustEntitlementRequest'>>>,
  Assert<MatchesContract<RecalculateEntitlementRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.RecalculateEntitlementRequest'>>>,
  Assert<MatchesContract<CreateLeavePolicyRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.CreateLeavePolicyRequest'>>>,
  Assert<MatchesContract<AddLeavePolicyVersionRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.AddLeavePolicyVersionRequest'>>>,
  Assert<MatchesContract<UpdateLeavePolicyDetailsRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.UpdateLeavePolicyDetailsRequest'>>>,
  Assert<MatchesContract<CreateLeaveTypeRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>>>,
  Assert<MatchesContract<UpdateLeaveTypeRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Types.UpdateLeaveTypeRequest'>>>,
];
```

Run: `npx tsc -p tsconfig.app.json --noEmit`

**Expected:** no output.

**If an assertion fails,** that is real drift:
- Read the generated schema next to the hand-written type and find the field.
- If the frontend is wrong (a field name or type that the backend does not have), fix the hand-written type and check the service and store still compile.
- If a nested type is the cause (`rules`, `assignments`, `blackouts`), compare that nested type the same way.
- Note every fix in the commit message and in the gap report (Task 6) under "Drift found".
- Do not change the assertion to make it pass.

- [ ] **Step 2: Find which DTOs are exactly the backend shape**

Create a throwaway file `src/app/modules/leave/models/_same-probe.ts`:

```ts
import type { ApiSchema, Assert, SameAsContract } from '../../../shared/api-types/api-schema';
import type { AddLeavePolicyVersionRequest } from './leave-policy.model';
import type { CancelLeaveRequestRequest, SubmitLeaveRequestOnBehalfRequest, SubmitLeaveRequestRequest } from './leave-request.model';
import type { ApproveLeaveRequestRequest } from './leave-approval.model';
import type { GenerateEntitlementsRequest, RecalculateEntitlementRequest } from './leave-entitlement.model';

export type Probe = [
  Assert<SameAsContract<SubmitLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestRequest'>>>,
  Assert<SameAsContract<SubmitLeaveRequestOnBehalfRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.SubmitLeaveRequestOnBehalfRequest'>>>,
  Assert<SameAsContract<CancelLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>>>,
  Assert<SameAsContract<ApproveLeaveRequestRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Approvals.ApproveLeaveRequestRequest'>>>,
  Assert<SameAsContract<GenerateEntitlementsRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.GenerateEntitlementsRequest'>>>,
  Assert<SameAsContract<RecalculateEntitlementRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Entitlements.RecalculateEntitlementRequest'>>>,
  Assert<SameAsContract<AddLeavePolicyVersionRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Policies.AddLeavePolicyVersionRequest'>>>,
];
```

These 7 are the candidates: no nullability difference was measured. The other 9 are known stricter and stay hand-written.

Run: `npx tsc -p tsconfig.app.json --noEmit`. Each error line points at one tuple entry. Entries **without** an error are exactly equal. Write down the list, then delete the probe:

```powershell
Remove-Item src/app/modules/leave/models/_same-probe.ts
```

- [ ] **Step 3: Turn the exact matches into aliases**

For each DTO that passed Step 2, replace its hand-written `interface` with an alias to the generated type. Keep or adapt the doc comment. For example, if `CancelLeaveRequestRequest` passed, then in `src/app/modules/leave/models/leave-request.model.ts`, replace

```ts
export interface CancelLeaveRequestRequest {
  // ...existing fields
}
```

with

```ts
/** Generated from the backend contract (`npm run api:types`). */
export type CancelLeaveRequestRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>;
```

and add at the top of that file:

```ts
import type { ApiSchema } from '../../../shared/api-types/api-schema';
```

Special cases:
- **`SubmitLeaveRequestOnBehalfRequest extends SubmitLeaveRequestRequest`:**
  - If both passed, alias both.
  - If only the base passed, leave the `extends` interface as it is. An interface can extend an object type alias.
  - If only the on-behalf one passed, alias it and leave the base.
- **If none of the 7 passed,** keep all 16 hand-written. The Task 5 contract file alone meets "one module compiles against generated DTO types". Say so in the Status section (Task 7).

Run after the edits:

```powershell
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.spec.json --noEmit
npx ng test --watch=false --include="src/app/modules/leave/**/*.spec.ts"
npx eslint "src/app/modules/leave/models/*.ts"
```

Expected: no `tsc` output, all Leave specs pass with no warnings, and ESLint reports 0 problems.

- [ ] **Step 4: Production build stays warning-free**

Run: `npm run check:warnings`
Expected: passes, with no `[WARNING]` or `[ERROR]` lines.

- [ ] **Step 5: Commit**

```powershell
git add src/app/modules/leave/models
git commit -m "feat(leave): check request DTOs against the generated backend contract"
```

In the body, list which DTOs became aliases and any drift fixed in Step 1.

---

### Task 6: Backend contract gap report

**Files:**
- Create: `docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md`

- [ ] **Step 1: Re-measure from the live document**

Save the document and print the counts. This uses Node, so no shell quoting issues:

```powershell
curl.exe -sk https://localhost:7229/swagger/v1/swagger.json -o $env:TEMP\swagger.json
node -e "const d=require(process.env.TEMP+'/swagger.json');const s=d.components.schemas;let ops=0,noResp=0;for(const v of Object.values(d.paths))for(const o of Object.values(v)){if(!o.responses)continue;ops++;const r=o.responses['200']||o.responses['201'];if(!r||!r.content)noResp++}let req=0,str=0,nul=0;for(const x of Object.values(s)){if(x.required)req++;for(const p of Object.values(x.properties||{}))if(p.type==='string'){str++;if(p.nullable)nul++}}const ns=k=>Object.keys(s).filter(n=>n.startsWith(k)).length;console.log({paths:Object.keys(d.paths).length,ops,noResp,schemas:Object.keys(s).length,withRequired:req,stringProps:str,nullableStrings:nul,intEnums:Object.entries(s).filter(([,v])=>v.enum&&v.type==='integer').map(([k])=>k),controllers:ns('ONEVO.Api.Controllers.'),application:ns('ONEVO.Application.'),domain:ns('ONEVO.Domain.')})"
```

Expected (2026-11-18): 535 paths, 621 operations, 621 without response schema, 220 schemas, 0 with `required`, 420 of 530 strings nullable, 3 integer enums, 37 controller types, 28 application types, 2 domain types. Use the numbers you get, not these.

- [ ] **Step 2: Write the report**

Create `docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md`. Use this content, replacing numbers with Step 1 output. Keep the "Drift found" section, and write "None" if Task 5 found none:

````markdown
# Backend contract gaps found while generating frontend types (task 08)

| | |
|---|---|
| From | Frontend, Person 4 (task 08) |
| For | Backend team. Feeds backend Improvements task 16 (path in the backend repo not verified from the frontend). |
| Measured | 2026-11-18, `https://localhost:7229/swagger/v1/swagger.json`, OpenAPI 3.0.4 |
| Size | 535 paths, 621 operations, 220 schemas |

The frontend now generates TypeScript types from this document (`npm run api:types`, see `docs/core/API_TYPES.md` in the frontend repo). The gaps below limit what can be generated. They are ordered by how much they block.

## 1. No response schemas (blocks all response types)

All 621 operations document only `"200": { "description": "OK" }`. The frontend therefore cannot generate a single response type, and every `...Response` interface stays hand-written and can drift silently.

**Fix:** declare the response type on every action, e.g. `[ProducesResponseType<LeaveTypeResponse>(StatusCodes.Status200OK)]`, or return `ActionResult<T>` / `Results<Ok<T>, ...>`. Lists that page should declare the paged type.

## 2. No `required`, and most strings marked nullable

0 schemas declare `required`, and 420 of 530 string properties are `nullable: true`. Example: `CreateLeaveTypeRequest.name` is shown as optional and nullable, but the API rejects a missing name. The frontend currently assumes "every property is present" (`propertiesRequiredByDefault`) and keeps its own stricter types.

**Fix:** have Swashbuckle read C# nullable reference types and mark non-nullable properties required, e.g. `c.SupportNonNullableReferenceTypes();` and `c.NonNullableReferenceTypesAsRequired();` in `SwaggerExtensions.cs` (check these exist in the Swashbuckle version used). Where a request field is validated as required, declare it `required` in the record.

## 3. Enums sent as numbers

3 enums are documented as bare integers with no names: `ONEVO.Application.Features.Monitoring.Reports.Queries.GetProductivityReport.ProductivityReportScope`, `ONEVO.Domain.Features.Monitoring.Exceptions.Entities.ExceptionStatus`, `ONEVO.Domain.Features.Monitoring.Exceptions.Entities.ExceptionType`. The generated type is `0 | 1 | 2`, which says nothing.

**Fix:** serialize these as strings (`JsonStringEnumConverter`) or add a schema filter that emits the names.

## 4. Inner types in the API contract

37 schemas are types declared inside controllers (`ONEVO.Api.Controllers.*`). Another 28 are `ONEVO.Application.Features.*` and 2 are `ONEVO.Domain.Features.*` types used directly as request or response bodies. Any refactor inside the Application or Domain layer changes the public contract.

**Fix:** move them to `ONEVO.Api.Contracts.*` request/response records.

## 5. Duplicate short names

`CreateCalendarEventRequest` and `UpdateCalendarEventRequest` each exist in both `ONEVO.Api.Contracts.Calendar` and `ONEVO.Api.Contracts.WorkManagement.CalendarEvents`. The full-name schema ids keep them apart today, but it is confusing for clients. Worth deciding which one is current.

## Drift found in the Leave reference module

(From task 08 step "Leave as the reference module": list each hand-written request DTO that did not match and what was changed, or write "None: all 16 Leave request DTOs matched the backend field names; 9 are stricter than the backend only in nullability.")
````

- [ ] **Step 3: Commit**

```powershell
git add docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md
git commit -m "docs(api-types): backend contract gap report for the backend team"
```

---

### Task 7: Docs, then final verification

**Files:**
- Create: `docs/core/API_TYPES.md`
- Modify: `docs/core/ARCHITECTURE.md`, `docs/Improvements/person-4-api-layer-and-cleanup/task-08 Generate API types from the backend contract.md`

- [ ] **Step 1: Write `docs/core/API_TYPES.md`**

````markdown
# Generated API types

`src/app/shared/api-types/backend-api.generated.ts` holds TypeScript types generated from the backend Swagger document. It is committed, so a backend contract change shows up as a diff in review.

## Regenerate

1. Run the backend in Development (Swagger is only served there): `https://localhost:7229/swagger/v1/swagger.json` must answer 200.
2. `npm run api:types`
3. Review the diff of `backend-api.generated.ts`, fix anything that no longer compiles, and commit it together with the frontend change.

Other sources:

- A saved document (for example a CI artifact): `npm run api:types -- --input path/to/swagger.json`
- Another backend: `npm run api:types -- --url <swagger url>` or set `API_SWAGGER_URL`.

The certificate check is skipped only for `localhost`, `127.0.0.1` and `::1`, because the local backend uses a self-signed dev certificate.

## Check (for CI)

`npm run api:types:check` regenerates in memory and exits 1 if the committed file differs. It accepts the same `--input` / `--url` options. The repo has no CI pipeline and the backend publishes no Swagger artifact yet. When both exist, add one step: `npm run api:types:check -- --input <artifact path>`.

## Use

```ts
import type { ApiSchema, Assert, MatchesContract } from '../../../shared/api-types/api-schema';

// A request DTO that is exactly the backend shape: alias it.
export type CancelLeaveRequestRequest =
  ApiSchema<'ONEVO.Api.Contracts.Leave.Requests.CancelLeaveRequestRequest'>;

// A stricter hand-written DTO: keep it, and check it still fits the backend.
export type Contracts = [
  Assert<MatchesContract<CreateLeaveTypeRequest, ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>>>,
];
```

- Schema keys are the full backend type names. Do not shorten them: two `CreateCalendarEventRequest` types exist.
- `MatchesContract` fails the build when a field is renamed, removed, added or retyped. The frontend type may be stricter (non-null, string union, optional).
- View models (what a component shows) stay hand-written. Only request and response DTOs come from the contract.
- **Response types are not generated yet.** The backend documents no response schemas. See `docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md`.

Reference module: Leave (`src/app/modules/leave/models/leave-api-contract.ts`).

Generator: `openapi-typescript` (types only, no client), options `propertiesRequiredByDefault` and `alphabetize`. Script: `scripts/api-types/`. Tests: `npm run test:scripts`.
````

- [ ] **Step 2: Add rule 7 to `docs/core/ARCHITECTURE.md` §5.1**

After the line starting `6. Every API service has a header comment naming`, insert:

```markdown
7. **Request DTOs come from the backend contract** (decided 2026-11-18). `npm run api:types` generates `shared/api-types/backend-api.generated.ts` from the backend Swagger document. A request DTO that equals the backend shape is an alias (`ApiSchema<'...'>`). A stricter hand-written one gets a `MatchesContract` assertion in `models/<module>-api-contract.ts`. Response DTOs stay hand-written until the backend documents response schemas. See `docs/core/API_TYPES.md`.
```

Also change the next line, `**Reference module:** Leave (`modules/leave/data-access/`) follows all of these.`, to:

```markdown
**Reference module:** Leave (`modules/leave/data-access/` and `modules/leave/models/leave-api-contract.ts`) follows all of these.
```

- [ ] **Step 3: Add a Status section to the task 08 file**

Append to `docs/Improvements/person-4-api-layer-and-cleanup/task-08 Generate API types from the backend contract.md`, filling the bracketed parts from Task 5:

```markdown

## Status (2026-11-18)

- `npm run api:types` generates `src/app/shared/api-types/backend-api.generated.ts` (openapi-typescript 7.13.0, types only) from the local backend or `--input <file>`. The file is committed.
- `npm run api:types:check` fails when the committed file differs. **CI wiring is blocked:** the repo has no pipeline and the backend publishes no Swagger artifact.
- Reference module: Leave. All 16 request DTOs are checked with `MatchesContract` (`modules/leave/models/leave-api-contract.ts`). [N] became aliases of generated types: [names]. Response DTOs are not generated, because the backend Swagger has no response schemas.
- Backend gap report: `task-08-backend-contract-gaps.md`. **To do by a person:** hand it to the backend team (feeds backend task 16).
- How to regenerate: `docs/core/API_TYPES.md`.
```

- [ ] **Step 4: Full verification**

```powershell
npm run test:scripts
npm run api:types:check
npx tsc -p tsconfig.app.json --noEmit
npx tsc -p tsconfig.spec.json --noEmit
npx eslint scripts/api-types src/app/shared/api-types "src/app/modules/leave/models/*.ts"
npx prettier --check scripts/api-types src/app/shared/api-types src/app/modules/leave/models docs/core/API_TYPES.md
npm run check:warnings
npx ng test --watch=false
```

Expected:
- Everything passes except the full `ng test`.
- `ng test` may show only the 5 failures already on `origin/Development` on this PC:
  - en-GB date formats in `date-range-picker`, `time-tracking` (2) and inbox `leave-request-summary`
  - the `main-layout` timeout
- Confirm that none of the failing files are in `git diff --name-only origin/Development`.
- Full `npm run lint` is already red on `Development` (a11y and colours), so the scoped ESLint above is the gate for this change.

- [ ] **Step 5: Commit**

```powershell
git add docs/core/API_TYPES.md docs/core/ARCHITECTURE.md "docs/Improvements/person-4-api-layer-and-cleanup/task-08 Generate API types from the backend contract.md"
git commit -m "docs(api-types): how to regenerate, architecture rule 7, task 08 status"
```

---

## Done when (mapped to task 08)

| Task 08 "Done when" | Covered by |
|---|---|
| The script runs with one command against a local backend | Task 2 + Task 3 (`npm run api:types`) |
| One module compiles against generated DTO types | Task 5 (Leave: 16 contract assertions + aliases) |
| Gap list handed to the backend team | Task 6 writes it. Handing it over is a person's step, noted in the Status section. |

Not covered, on purpose: response DTOs (the backend has no response schemas) and CI wiring (no pipeline or artifact exists).
