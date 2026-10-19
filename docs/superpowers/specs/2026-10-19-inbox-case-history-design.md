# Inbox case history — design

Date: 2026-10-19 · Repos: `HRMS-Backend-v1` (endpoint) + `Hrms--Web-application---front-end---v1` (UI)

## Why

The Inbox lacks accountability. A reviewer opening a ticket about someone can't see whether the same
thing has happened with that person before. They decide each case cold. The ticket details panel should
show the person's earlier cases, so a repeat pattern is visible at the moment of decision.

## Goals

- In the ticket details panel, show the subject person's other cases from the ticket's month — at most 5.
- A **View all** link turns the details pane into a full, month-by-month history of that person.
- In the full view, the month switcher marks every month that has history with a red dot, so the reviewer
  can jump straight to months that matter.
- Load only what is shown: the 5 rows with the panel; the full month only on View all / month change.

## Non-goals

- No summary sentences, counts-as-prose, or "3rd time this year" text. Details stay minimal facts
  (see the user's standing preference: the details panel is facts, not prose).
- No severity column. Severity is shown the way the ticket list already shows it — the type icon's colour.
- No mixing of exceptions and requests in one list.
- No new permissions. Visibility follows the existing rules.
- No change to the ticket list or the conversation pane.

## Anti-goals (would be a failure even if it works)

- The history becoming a back door: a reviewer seeing cases for someone they cannot otherwise see.
- False alarms counting against the person: dismissed exceptions looking the same as real ones.
- Opening a ticket getting slower because full history is fetched up front.

## What "a case" is

The split is the existing inbox **category**:

| Current ticket is… | History lists… |
|---|---|
| an alert (`category = alert`: monitoring exceptions, attendance alerts, calendar/meeting exceptions) | the person's other **alerts** |
| a request (`category = request`: leave, attendance correction, work-mode / location / device change, …) | the person's other **requests** |

Ordering within a month: items of the **same type** as the current ticket first (same `source` + `kind` +
`actionType`), then the rest; each group newest first. The current ticket itself is never listed.

**Subject person:** for alerts, the employee the alert is about; for requests, the requester
(`requestedBy`). History is about that person, not about the caller — it includes cases the caller was never
involved in, limited by visibility (below).

**Sources in v1** (each implements `ListSubjectHistoryAsync`):

| Category | Source |
|---|---|
| alert | monitoring exceptions, calendar/meeting exceptions, attendance alerts |
| request | leave, attendance requests (correction, work-mode, location, device change) |

**Not covered — section hidden:** Work items (monitor alerts are about a project, `RequestedBy` is null) and
Onboarding requests (position approval / seat increase — `RequestedBy` is the HR initiator, not a subject).
These providers return empty and the card does not render the section for their kinds.

## The compact block (details panel)

A "Past cases" section in `app-inbox-item-card`, placed after the existing facts and before Participants.

- Up to 5 rows from the **month the current ticket was created in** (not today's month).
- Row: **[type icon, coloured like the list] · type label · date · status chip.** Nothing else.
  - Icon colour reuses `inboxIconTone` / `inboxStatusTone` (`modules/inbox/utils/inbox-item.util.ts`): live
    alerts carry severity colour, live requests follow status, finished items are gray.
  - Status chip uses each side's own words: alerts Open / Acknowledged / Escalated / Resolved (the existing
    `ExceptionStatus` values — there is no Dismissed state); requests Pending / Approved / Rejected / Cancelled.
    Escalated is live (it is still pending), so it keeps its danger tone.
  - Cancelled requests render muted (reduced opacity). Alerts are never muted: no "dismissed / false alarm" state
    exists today, and adding one is out of scope.
- Under the rows, when the month holds more than 5: **View all (N)**. When it holds 5 or fewer, no link.
- Empty month: a single quiet line "No other cases this month" — the section is still there, so the reviewer
  knows it was checked. A **View all** link still shows here (other months may have history) — *builder's call
  whether to label it "View history" in this state.*
- Clicking a row opens that ticket the normal way (selects it), when the caller can open it; otherwise the row
  is not clickable (see Visibility).
- Not shown when the caller is the subject person (an employee looking at their own request).

## The full view (View all)

The whole details pane (`aside.inbox__details`) switches to the history view. List and conversation panes
are untouched.

- Header: **← Back** (returns to the ticket's details, same scroll state not required) · person's name ·
  category label ("Alerts" / "Requests").
- Month switcher: **‹ October 2026 ›**. Clicking the month label opens a 12-month grid for one year with
  ‹ › to change year. Months with history carry a **red dot**. Months before the person's join date and after
  the current month are disabled.
- Red dot rule: the month has at least one item that is **not** a cancelled request (every alert counts).
- Opens on the ticket's month. Rows are the same shape as the compact block, all of the month's items, same
  ordering (same type first). Rows open tickets the same way.
- Each month change fetches that month. The dot map is fetched per year when the grid opens or the year changes.
- Selecting a different ticket in the list exits the history view back to normal details.
- Narrow screens (details is a drawer): the history view replaces the drawer content the same way.

## Backend

New provider capability, alongside `ListAsync` on `IInboxSourceProvider`
(`Features/Inbox/Contracts/InboxContracts.cs`), since `ListAsync` is "items involving the caller" and history
must be "items about a person":

```
Task<IReadOnlyList<InboxItem>> ListSubjectHistoryAsync(
    Guid tenantId, Guid subjectEmployeeId, DateTimeOffset from, DateTimeOffset to, Guid callerEmployeeId, CancellationToken ct);
```

Providers that have no per-person history return empty. The router fans out, filters by category, sorts.

Endpoints (Inbox controller, `api/v1/inbox`):

- `GET history?employeeId=&category=&from=&to=&excludeSource=&excludeKind=&excludeId=` → `InboxItem[]`
  (all items in range; the client takes 5 for the compact block — the month is small, one call serves both).
  *Builder's call: a `limit` param if a month's payload proves large.*
- `GET history/months?employeeId=&category=&year=` → `{ month: 1..12, count: int }[]` for months with at least
  one item that is not a cancelled request.

`from`/`to` are sent by the client as the month's bounds in the viewer's local time.

Each item carries a `canOpen` flag (caller would get a non-null `GetDetailAsync`). *Builder's call: compute it
cheaply from the same scope resolution the provider already does, not by calling GetDetailAsync per row.*

## Visibility

- The caller must be able to see the subject employee under the existing relationship-based visibility rules
  (the same check as `RequireVisibleEmployee`). Otherwise the endpoints return 404 / empty, and the section is hidden.
- Within that, history lists every item about the person in the category — including ones the caller was not
  involved in. Rows the caller couldn't open are shown (facts only) but not clickable. **Decided by the user
  (2026-10-19):** relationship visibility alone is the gate; module audience/approver rules do not filter rows.

## Frontend pieces

- `InboxHistoryService` / store slice: compact load keyed by the open ticket; full-view state (month, year,
  dot map, items, loading/error).
- `app-inbox-case-history` (compact block) and `app-inbox-case-history-view` (full pane), sharing one row
  component that reuses `app-inbox-type-icon`.
- `inbox-page.component.ts`: a `historyOpen` signal chooses between `app-inbox-item-card` and the full view
  inside `aside.inbox__details`.
- Uses existing shared pieces (scroll-fade on the list, existing chip/pill tones). No new tables.

## Tests

- Backend: router category filter and ordering; exclusion of the current item; visibility denial; months
  endpoint excludes cancelled requests; at least one provider (exceptions, leave) implements history.
- Frontend (Vitest): compact block caps at 5 and shows View all (N) only when more; empty month line; same-type
  ordering; full view back button, month change fetch, red dots from the months response, disabled months.

## Calls made in this design (not explicitly decided by the user)

- Opens on the ticket's month, not today's.
- No "dismissed" alert state exists, so alerts are never muted; cancelled requests are muted and give no red dot.
- Escalated counts as live.
- v1 sources: exceptions, calendar exceptions, attendance alerts, leave, attendance requests. Work and
  Onboarding hide the section.
- Month grid one year at a time, limited to join date … current month.
- Rows the caller can't open are listed but not clickable.
- Hidden when the caller is the subject person.
- "Same type" = same source + kind + action type.
- Section placement: after the facts, before Participants.
