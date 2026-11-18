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

None. All 16 Leave request DTOs matched the backend field names; 10 are stricter than the backend (nullability, string unions) and stay hand-written with a MatchesContract check; 6 are exact and are now generated aliases.
