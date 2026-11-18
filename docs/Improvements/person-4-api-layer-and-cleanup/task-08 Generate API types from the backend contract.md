# Task 08: Generate API types from the backend contract

| | |
|---|---|
| Priority | 8 of 24 (lower number = build first) |
| Owner folder | person-4-api-layer-and-cleanup |
| Size | 1 person, 1 day |
| Area | API, Code quality |
| Depends on | nothing |

## What we found

Request and response types are written by hand in each module's `models` folder. The backend can change a field name, a nullability or an enum value and the frontend only finds out at run time. The cleanup scan already shows 12 unused types and an unused DTO file, which means the hand-written models have drifted from what is used.

The backend exposes Swagger documents (`/swagger/v1/swagger.json`) in Development.

## What to do

1. Add a script (`npm run api:types`) that reads the backend Swagger document and generates TypeScript types into `src/app/shared/api-types/` (for example with `openapi-typescript`). Types only, no generated HTTP client.
2. Commit the generated file so the diff shows contract changes in review.
3. Move one module's hand-written DTOs to the generated ones as the reference. Keep view models hand-written.
4. Add a CI check: when the backend document is available as an artifact, regenerate and fail if the committed file differs.
5. Report backend gaps you meet (missing response types, `object` responses, enums sent as numbers) to the backend team. They block good generation.
6. Write how to regenerate in `docs/core/`.

## Done when

- The script runs with one command against a local backend.
- One module compiles against generated DTO types.
- The list of backend contract gaps is handed to the backend team. (This originally said it feeds backend task 16, but backend task 16 is API versioning. No backend Improvements task covers Swagger response types yet; see the gap report.)

## Status (2026-11-18)

- `npm run api:types` generates `src/app/shared/api-types/backend-api.generated.ts` (openapi-typescript 7.13.0, types only) from the local backend or `--input <file>`. The file is committed.
- `npm run api:types:check` fails when the committed file differs. **CI wiring is blocked:** the repo has no pipeline and the backend publishes no Swagger artifact.
- Reference module: Leave. All 16 request DTOs are checked with `MatchesContract` (`modules/leave/models/leave-api-contract.ts`). 6 became aliases of generated types: SubmitLeaveRequestRequest, SubmitLeaveRequestOnBehalfRequest, CancelLeaveRequestRequest, ApproveLeaveRequestRequest, GenerateEntitlementsRequest, RecalculateEntitlementRequest. The other 10 stay hand-written because they are stricter than the backend. Response DTOs are not generated, because the backend Swagger has no response schemas.
- Backend gap report: `task-08-backend-contract-gaps.md`. **To do by a person:** hand it to the backend team's API owner (`person-3-api-and-pagination` in the backend Improvements). No backend task covers it yet, so they need to add one.
- How to regenerate: `docs/core/API_TYPES.md`.
