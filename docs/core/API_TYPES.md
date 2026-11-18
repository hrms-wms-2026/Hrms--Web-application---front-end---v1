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
  Assert<
    MatchesContract<
      CreateLeaveTypeRequest,
      ApiSchema<'ONEVO.Api.Contracts.Leave.Types.CreateLeaveTypeRequest'>
    >
  >,
];
```

- Schema keys are the full backend type names. Do not shorten them: two `CreateCalendarEventRequest` types exist.
- `MatchesContract` fails the build when a field is renamed, removed, added or retyped. The frontend type may be stricter (non-null, string union, optional). It also accepts `readonly` properties and arrays in frontend DTOs (it compares by shape).
- View models (what a component shows) stay hand-written. Only request and response DTOs come from the contract.
- **Response types are not generated yet.** The backend documents no response schemas. See `docs/Improvements/person-4-api-layer-and-cleanup/task-08-backend-contract-gaps.md`.

Reference module: Leave (`src/app/modules/leave/models/leave-api-contract.ts`).

Generator: `openapi-typescript` (types only, no client), options `propertiesRequiredByDefault` and `alphabetize`. Script: `scripts/api-types/`. Tests: `npm run test:scripts`.
