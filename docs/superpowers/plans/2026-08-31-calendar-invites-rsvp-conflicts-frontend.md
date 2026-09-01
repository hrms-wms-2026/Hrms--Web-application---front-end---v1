# Calendar Invites, RSVP, and Conflict Detection — Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Calendar event form show who's invited and their response status, warn (non-blocking) about scheduling conflicts while creating an event, and let an invited viewer Accept/Decline without touching the creator's Save/Delete controls.

**Architecture:** The existing `CalendarEventFormModalComponent` stays a "dumb" presentational component driven entirely by `@Input`/`@Output` - it never injects `CalendarEventStore` directly (matching its current design). Conflict-checking and RSVP submission are new store methods that `CalendarPageComponent` (the only component that already talks to the store) calls in response to two new modal outputs, feeding results back down via two new modal inputs.

**Tech Stack:** Angular 21 standalone components, `@ngrx/signals`, RxJS-free debounce (a plain `setTimeout`/`clearTimeout` field, matching this component's existing non-RxJS style), Vitest + Angular `TestBed`/`HttpTestingController`.

**Spec:** `docs/superpowers/specs/2026-08-31-calendar-invites-rsvp-conflicts-design.md` (Part 5, plus the response shapes defined by Parts 1-4, all already shipped on the backend). This plan implements Part 5 only.

## Global Constraints

- Branch off `feature/calendar-frontend-module` (the latest shipped frontend Calendar work) in this repo.
- `CalendarEventFormModalComponent` must not inject `CalendarEventStore` - it stays presentational; all store calls happen in `CalendarPageComponent`.
- Backend response shapes (already shipped, verified live against the running dev API):
  - `GET /api/v1/calendar` items now include `participants: { employeeId, employeeName, responseStatus }[] | null` (`responseStatus` is lowercase: `"pending" | "accepted" | "rejected"`).
  - `POST /api/v1/calendar/{id}/respond` body `{ responseStatus: "Accepted" | "Rejected" }` (PascalCase on the wire, unlike the lowercase stored value it maps to) returns `204 No Content`. `{id}` must be a **real** row id - pass `recurrenceMasterId` when editing a virtual occurrence, else the event's own `id` (the exact same resolution `CalendarPageComponent.onDelete`/`onSave` already do for edit-occurrence scope).
  - `POST /api/v1/calendar/check-conflicts` body `{ participantEmployeeIds: string[], startDate: string, endDate: string }` returns `{ conflicts: { employeeId, employeeName, conflictingEventId, conflictingEventTitle }[] }`. Never blocks - conflicts are informational only.
- **Known scope simplification, stated explicitly rather than silently assumed:** the frontend has no session field for the raw backend `UserId` that `CalendarEventItem.createdById` is - only `employeeId` (see `CurrentUserViewModel`). So "is the viewer the creator" cannot be determined client-side. Accept/Decline is shown whenever the viewer's own `employeeId` appears in `event.participants` - **additively**, alongside the existing Save/Delete row, not replacing it. A non-creator participant who clicks Save/Delete still gets the backend's existing 403, surfaced through the existing `store.actionError` path - the same enforcement-lives-server-side pattern already used everywhere else in this app.
- Participants are set at event creation only (already-established Calendar Core scope) - the participants list shown on an existing event is **read-only**. Conflict-checking therefore only makes sense while creating a new event (the only place participant selection is editable), not while editing one.
- Match existing design tokens: `--color-warning-subtle` / `--color-warning-text` for the conflict warning (already used by `change-position-modal.component.ts`), and the existing `rounded-full px-2 ... bg-green-100/bg-red-100` status-pill convention (already used by `task-tree-row.component.ts` and others) for the response-status badge.

---

### Task 1: Models and API service

**Files:**
- Modify: `src/app/modules/calendar/models/calendar-event.model.ts`
- Modify: `src/app/modules/calendar/data-access/calendar-event-api.service.ts`
- Modify: `src/app/modules/calendar/data-access/calendar-event-api.service.spec.ts`

**Interfaces:**
- Produces: `CalendarEventParticipant`, `RespondToCalendarEventStatus`, `RespondToCalendarEventRequest`, `CheckCalendarConflictsRequest`, `CalendarConflict`, `CalendarConflictsResponse`, `CalendarEventApiService.respond(eventId, responseStatus)`, `CalendarEventApiService.checkConflicts(payload)`.

- [ ] **Step 1: Add the new model types and widen `CalendarEventResponse`**

In `calendar-event.model.ts`, add after the existing `CalendarEventResponse` interface:
```typescript
export interface CalendarEventParticipant {
  employeeId: string;
  employeeName: string;
  responseStatus: string;
}
```
Add a field to the existing `CalendarEventResponse` interface (after `originalStart`):
```typescript
  originalStart: string | null;
  participants: readonly CalendarEventParticipant[] | null;
```
Append at the end of the file:
```typescript
export type RespondToCalendarEventStatus = 'Accepted' | 'Rejected';

export interface RespondToCalendarEventRequest {
  responseStatus: RespondToCalendarEventStatus;
}

export interface CalendarConflict {
  employeeId: string;
  employeeName: string;
  conflictingEventId: string;
  conflictingEventTitle: string;
}

export interface CheckCalendarConflictsRequest {
  participantEmployeeIds: readonly string[];
  startDate: string;
  endDate: string;
}

export interface CalendarConflictsResponse {
  conflicts: readonly CalendarConflict[];
}
```

- [ ] **Step 2: Write the failing API service tests**

Add to `calendar-event-api.service.spec.ts`:
```typescript
  it('respond posts { responseStatus } to {eventId}/respond', () => {
    service.respond('event-1', 'Accepted').subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/event-1/respond`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ responseStatus: 'Accepted' });
    req.flush(null);
  });

  it('checkConflicts posts to check-conflicts', () => {
    service.checkConflicts({ participantEmployeeIds: ['emp-1'], startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T10:00:00Z' }).subscribe();
    const req = http.expectOne(`${environment.apiUrl}/calendar/check-conflicts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ participantEmployeeIds: ['emp-1'], startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T10:00:00Z' });
    req.flush({ conflicts: [] });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- calendar-event-api.service.spec.ts`
Expected: FAIL - `service.respond`/`service.checkConflicts` do not exist yet.

- [ ] **Step 4: Add the service methods**

Add to `calendar-event-api.service.ts` (import the new types alongside the existing ones):
```typescript
import {
  CalendarEventResponse, CalendarEventsResponse, CheckCalendarConflictsRequest, CalendarConflictsResponse,
  CreateCalendarEventRequest, EditRecurringOccurrenceRequest, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../models/calendar-event.model';
```
```typescript
  respond(eventId: string, responseStatus: RespondToCalendarEventStatus): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${eventId}/respond`, { responseStatus });
  }

  checkConflicts(payload: CheckCalendarConflictsRequest): Observable<CalendarConflictsResponse> {
    return this.http.post<CalendarConflictsResponse>(`${this.baseUrl}/check-conflicts`, payload);
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- calendar-event-api.service.spec.ts`
Expected: all pass, including the 2 new tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/models/calendar-event.model.ts src/app/modules/calendar/data-access/calendar-event-api.service.ts src/app/modules/calendar/data-access/calendar-event-api.service.spec.ts
git commit -m "feat(calendar): add participants, RSVP, and conflict-check models/API methods"
```

---

### Task 2: Store methods

**Files:**
- Modify: `src/app/modules/calendar/state/calendar-event.store.ts`
- Modify: `src/app/modules/calendar/state/calendar-event.store.spec.ts`

**Interfaces:**
- Consumes: `CalendarEventApiService.respond`, `CalendarEventApiService.checkConflicts` (Task 1).
- Produces: `CalendarEventStore.conflicts()`, `CalendarEventStore.checkingConflicts()`, `CalendarEventStore.respondToEvent(eventId, responseStatus, from, to)`, `CalendarEventStore.checkConflicts(participantEmployeeIds, startDate, endDate)`, `CalendarEventStore.clearConflicts()`.

- [ ] **Step 1: Update the existing `makeEvent` test factory**

In `calendar-event.store.spec.ts`, add `participants: null,` to the object `makeEvent()` returns (before the `...overrides` spread) - required now that `CalendarEventResponse.participants` is non-optional.

- [ ] **Step 2: Write the failing store tests**

Add to `calendar-event.store.spec.ts`:
```typescript
  it('respondToEvent posts the response then refreshes events', async () => {
    const work = store.respondToEvent('event-1', 'Accepted', '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar/event-1/respond` && r.method === 'POST').flush(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar`).flush({ events: [makeEvent({ id: 'refreshed' })] });

    expect(await work).toBe(true);
    expect(store.events().map((e) => e.id)).toEqual(['refreshed']);
  });

  it('respondToEvent sets actionError on failure', async () => {
    const work = store.respondToEvent('event-1', 'Accepted', '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z');
    http.expectOne((r) => r.url === `${environment.apiUrl}/calendar/event-1/respond`).flush({ detail: 'not a participant' }, { status: 404, statusText: 'Not Found' });
    expect(await work).toBe(false);
    expect(store.actionError()).toBeTruthy();
  });

  it('checkConflicts populates conflicts on success', async () => {
    const work = store.checkConflicts(['emp-1'], '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z');
    http.expectOne(`${environment.apiUrl}/calendar/check-conflicts`).flush({
      conflicts: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: 'e9', conflictingEventTitle: 'Standup' }]
    });
    await work;
    expect(store.conflicts().length).toBe(1);
    expect(store.checkingConflicts()).toBe(false);
  });

  it('checkConflicts clears conflicts on failure rather than surfacing actionError', async () => {
    const work = store.checkConflicts(['emp-1'], '2026-09-01T09:00:00Z', '2026-09-01T10:00:00Z');
    http.expectOne(`${environment.apiUrl}/calendar/check-conflicts`).flush({ detail: 'boom' }, { status: 500, statusText: 'Error' });
    await work;
    expect(store.conflicts()).toEqual([]);
    expect(store.actionError()).toBeNull();
  });

  it('clearConflicts resets conflicts state', () => {
    store.clearConflicts();
    expect(store.conflicts()).toEqual([]);
    expect(store.checkingConflicts()).toBe(false);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- calendar-event.store.spec.ts`
Expected: FAIL - the new store methods/state don't exist yet.

- [ ] **Step 4: Add the state fields and methods**

In `calendar-event.store.ts`, widen the state interface and initial value:
```typescript
interface CalendarEventState {
  readonly events: readonly CalendarEventResponse[];
  readonly loading: boolean;
  readonly loadError: string | null;
  readonly saving: boolean;
  readonly actionError: string | null;
  readonly conflicts: readonly CalendarConflict[];
  readonly checkingConflicts: boolean;
}
```
```typescript
  withState<CalendarEventState>({
    events: [], loading: false, loadError: null, saving: false, actionError: null,
    conflicts: [], checkingConflicts: false
  }),
```
Add to the import line: `CalendarConflict, RespondToCalendarEventStatus,` (alongside the existing model imports).

Add methods (after `cancelOccurrence`, inside the same `withMethods` object):
```typescript
    async respondToEvent(
      eventId: string, responseStatus: RespondToCalendarEventStatus, from: string, to: string
    ): Promise<boolean> {
      patchState(store, { saving: true, actionError: null });
      try {
        await firstValueFrom(api.respond(eventId, responseStatus));
        const response = await firstValueFrom(api.getEvents(from, to));
        patchState(store, { saving: false, events: response.events });
        return true;
      } catch (err) {
        patchState(store, { saving: false, actionError: toSafeErrorMessage(err, 'Failed to respond to this event.') });
        return false;
      }
    },
    async checkConflicts(participantEmployeeIds: readonly string[], startDate: string, endDate: string): Promise<void> {
      patchState(store, { checkingConflicts: true });
      try {
        const response = await firstValueFrom(api.checkConflicts({ participantEmployeeIds, startDate, endDate }));
        patchState(store, { checkingConflicts: false, conflicts: response.conflicts });
      } catch {
        // Conflict-checking is informational only - a failed check should never block or alarm
        // the user with an actionError; it just silently shows no warning.
        patchState(store, { checkingConflicts: false, conflicts: [] });
      }
    },
    clearConflicts(): void {
      patchState(store, { conflicts: [], checkingConflicts: false });
    }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- calendar-event.store.spec.ts`
Expected: all pass, including the 5 new tests.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/state/calendar-event.store.ts src/app/modules/calendar/state/calendar-event.store.spec.ts
git commit -m "feat(calendar): add respondToEvent/checkConflicts/clearConflicts store methods"
```

---

### Task 3: Participants display and Accept/Decline in the form modal

**Files:**
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.html`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts`

**Interfaces:**
- Consumes: `AuthStore.employeeId()` (`src/app/core/auth/state/auth.store.ts`, already exists).
- Produces: `CalendarEventFormModalComponent.respond` output (`EventEmitter<RespondToCalendarEventStatus>`), `CalendarEventFormModalComponent.viewerParticipant()`.

- [ ] **Step 1: Give the shared spec setup a controllable `AuthStore` double**

In `calendar-event-form-modal.component.spec.ts`, replace the top of the file and `beforeEach`:
```typescript
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { CalendarEventFormModalComponent } from './calendar-event-form-modal.component';

describe('CalendarEventFormModalComponent', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<CalendarEventFormModalComponent>>;
  let currentEmployeeId: string | null;

  beforeEach(async () => {
    currentEmployeeId = null;
    await TestBed.configureTestingModule({
      imports: [CalendarEventFormModalComponent],
      providers: [{ provide: AuthStore, useValue: { employeeId: () => currentEmployeeId } }]
    }).compileComponents();
    fixture = TestBed.createComponent(CalendarEventFormModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });
```
(Every existing test in this file keeps working unchanged - `currentEmployeeId` just defaults to `null`, matching "no viewer identity" until a test sets it.)

- [ ] **Step 2: Write the failing tests**

Add to the same file:
```typescript
  it('shows participants with their response status badge', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.nativeElement.textContent).toContain('pending');
  });

  it('does not show Accept/Decline when the viewer is not a participant', () => {
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'someone-else', employeeName: 'Bob', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-accept"]')).toBeNull();
  });

  it('emits respond when the viewer is a participant and clicks Accept', () => {
    currentEmployeeId = 'emp-1';
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null,
      participants: [{ employeeId: 'emp-1', employeeName: 'Ada Lovelace', responseStatus: 'pending' }]
    });
    fixture.detectChanges();

    const spy = vi.fn();
    fixture.componentInstance.respond.subscribe(spy);
    fixture.nativeElement.querySelector('[data-testid="calendar-form-accept"]').click();
    expect(spy).toHaveBeenCalledWith('Accepted');
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- calendar-event-form-modal.component.spec.ts`
Expected: FAIL - `respond` output and participants UI don't exist yet.

- [ ] **Step 4: Add `viewerParticipant()`, the `respond` output, and `onRespond`**

In `calendar-event-form-modal.component.ts`, add a new import line and replace the existing `calendar-event.model` import line with a widened version:
```typescript
import { AuthStore } from '../../../../core/auth/state/auth.store';
```
```typescript
// Replaces the existing "import { CalendarEventResponse, CreateCalendarEventRequest,
// RecurrenceEditScope, UpdateCalendarEventRequest } from ..." line - same source, more types.
import {
  CalendarEventParticipant, CalendarEventResponse, CreateCalendarEventRequest, RecurrenceEditScope,
  RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../../models/calendar-event.model';
```
Add a field and an output (alongside the existing `@Output() delete`):
```typescript
  @Output() respond = new EventEmitter<RespondToCalendarEventStatus>();

  private readonly authStore = inject(AuthStore);
```
Add a method (alongside `get isEdit()`):
```typescript
  viewerParticipant(): CalendarEventParticipant | null {
    const employeeId = this.authStore.employeeId();
    if (!employeeId || !this.event?.participants) return null;
    return this.event.participants.find((p) => p.employeeId === employeeId) ?? null;
  }

  onRespond(status: RespondToCalendarEventStatus): void {
    this.respond.emit(status);
  }
```

- [ ] **Step 5: Add the participants list and Accept/Decline block to the template**

In `calendar-event-form-modal.component.html`, add just before the `@if (isEdit && event?.isRecurringOccurrence)` block:
```html
    @if (isEdit && event?.participants?.length) {
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-medium text-[var(--color-text-primary)]">Participants</span>
        @for (participant of event!.participants!; track participant.employeeId) {
          <div class="flex items-center justify-between text-sm">
            <span>{{ participant.employeeName }}</span>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              [class.bg-gray-100]="participant.responseStatus === 'pending'"
              [class.text-gray-700]="participant.responseStatus === 'pending'"
              [class.bg-green-100]="participant.responseStatus === 'accepted'"
              [class.text-green-700]="participant.responseStatus === 'accepted'"
              [class.bg-red-100]="participant.responseStatus === 'rejected'"
              [class.text-red-700]="participant.responseStatus === 'rejected'"
            >{{ participant.responseStatus }}</span>
          </div>
        }
      </div>
    }

    @if (isEdit && viewerParticipant(); as vp) {
      <div class="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] p-2">
        <span class="text-sm">Your response: <strong>{{ vp.responseStatus }}</strong></span>
        <div class="flex gap-2">
          <app-button type="button" variant="secondary" data-testid="calendar-form-decline" (click)="onRespond('Rejected')">Decline</app-button>
          <app-button type="button" data-testid="calendar-form-accept" (click)="onRespond('Accepted')">Accept</app-button>
        </div>
      </div>
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- calendar-event-form-modal.component.spec.ts`
Expected: all pass, including the 3 new tests, and every pre-existing test in this file still passes unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-event-form-modal/
git commit -m "feat(calendar): show participants and let an invited viewer accept/decline"
```

---

### Task 4: Conflict-checking while creating an event

**Files:**
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.ts`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.html`
- Modify: `src/app/modules/calendar/ui/calendar-event-form-modal/calendar-event-form-modal.component.spec.ts`

**Interfaces:**
- Produces: `CalendarEventFormModalComponent.conflicts` input (`readonly CalendarConflict[]`, default `[]`), `CalendarEventFormModalComponent.checkingConflicts` input (`boolean`, default `false`), `CalendarEventFormModalComponent.checkConflicts` output (`EventEmitter<{ participantEmployeeIds: readonly string[]; startDate: string; endDate: string }>`), `CalendarEventFormModalComponent.onParticipantIdsChange(ids)`.

- [ ] **Step 1: Write the failing tests**

Add to `calendar-event-form-modal.component.spec.ts`:
```typescript
  it('emits checkConflicts (debounced) once participants and both dates are set, but not while editing', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    fixture.componentInstance.checkConflicts.subscribe(spy);

    fixture.componentInstance.form.patchValue({ startDate: '2026-09-01', startTime: '09:00', endDate: '2026-09-01', endTime: '10:00' });
    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    expect(spy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(400);
    expect(spy).toHaveBeenCalledWith({
      participantEmployeeIds: ['emp-1'], startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T10:00:00Z'
    });
    vi.useRealTimers();
  });

  it('does not emit checkConflicts while editing an existing event', () => {
    vi.useFakeTimers();
    fixture.componentRef.setInput('event', {
      id: 'e1', title: 'Existing', description: null, startDate: '2026-09-01T09:00:00Z', endDate: '2026-09-01T09:30:00Z',
      sourceType: 'manual', color: null, recurrence: 'none', isAllDay: false, timezone: 'UTC', eventStatus: null,
      isPrivate: false, location: null, meetingLink: null, externalSource: null, createdById: 'u1',
      isRecurringOccurrence: false, recurrenceMasterId: null, originalStart: null, participants: null
    });
    fixture.detectChanges();
    const spy = vi.fn();
    fixture.componentInstance.checkConflicts.subscribe(spy);

    fixture.componentInstance.onParticipantIdsChange(['emp-1']);
    vi.advanceTimersByTime(400);
    expect(spy).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('renders a non-blocking warning line per conflict', () => {
    fixture.componentRef.setInput('conflicts', [
      { employeeId: 'emp-1', employeeName: 'Ada Lovelace', conflictingEventId: 'e9', conflictingEventTitle: 'Standup' }
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace is busy at this time (Standup)');
    expect(fixture.nativeElement.querySelector('[data-testid="calendar-form-save-plain"]').disabled).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- calendar-event-form-modal.component.spec.ts`
Expected: FAIL - `checkConflicts` output, `conflicts`/`checkingConflicts` inputs, and `onParticipantIdsChange` don't exist yet.

- [ ] **Step 3: Add the debounced conflict-check trigger**

In `calendar-event-form-modal.component.ts`, extend the same `calendar-event.model` import line Task 3's Step 4 just widened, adding `CalendarConflict`:
```typescript
import {
  CalendarConflict, CalendarEventParticipant, CalendarEventResponse, CreateCalendarEventRequest,
  RecurrenceEditScope, RespondToCalendarEventStatus, UpdateCalendarEventRequest
} from '../../models/calendar-event.model';
```
Add inputs and the output:
```typescript
  @Input() conflicts: readonly CalendarConflict[] = [];
  @Input() checkingConflicts = false;
  @Output() checkConflicts = new EventEmitter<{ participantEmployeeIds: readonly string[]; startDate: string; endDate: string }>();
```
Add a field for the debounce timer handle and subscribe to form changes (place the subscription right after the `form` field is defined - field initializers run top-to-bottom, and `scheduleConflictCheck` only needs to exist on the prototype by the time it's actually invoked, not at subscribe-time):
```typescript
  private conflictCheckTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly formChangeSubscription = this.form.valueChanges.subscribe(() => this.scheduleConflictCheck());
```
Replace the template's `(selectedIdsChange)="participantIds.set($event)"` wiring by adding this method (used by the template edit in Step 4 below):
```typescript
  onParticipantIdsChange(ids: readonly string[]): void {
    this.participantIds.set(ids);
    this.scheduleConflictCheck();
  }

  private scheduleConflictCheck(): void {
    if (this.isEdit) return; // participants are read-only once an event exists - nothing to re-check
    if (this.conflictCheckTimer) clearTimeout(this.conflictCheckTimer);
    this.conflictCheckTimer = setTimeout(() => {
      const ids = this.participantIds();
      const raw = this.form.getRawValue();
      if (ids.length === 0 || !raw.startDate || !raw.endDate) return;
      this.checkConflicts.emit({
        participantEmployeeIds: ids,
        startDate: `${raw.startDate}T${raw.startTime}:00Z`,
        endDate: `${raw.endDate}T${raw.endTime}:00Z`
      });
    }, 400);
  }
```

- [ ] **Step 4: Wire the participant picker and add the warning block to the template**

In `calendar-event-form-modal.component.html`, change:
```html
(selectedIdsChange)="participantIds.set($event)"
```
to:
```html
(selectedIdsChange)="onParticipantIdsChange($event)"
```
Add the warning block right after the `@if (!isEdit) { ... Add participants ... }` block:
```html
    @if (!isEdit && conflicts.length > 0) {
      <div class="flex flex-col gap-1 rounded-md bg-[var(--color-warning-subtle)] p-2 text-xs text-[var(--color-warning-text)]" role="alert">
        @for (conflict of conflicts; track conflict.employeeId + conflict.conflictingEventId) {
          <span>{{ conflict.employeeName }} is busy at this time ({{ conflict.conflictingEventTitle }}).</span>
        }
      </div>
    }
```
(No `[disabled]` binding is added to the Create button - the warning is purely informational, matching the spec's non-blocking requirement.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- calendar-event-form-modal.component.spec.ts`
Expected: all pass, including the 3 new tests from this task and the 3 from Task 3.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/calendar/ui/calendar-event-form-modal/
git commit -m "feat(calendar): debounced non-blocking conflict warning while creating an event"
```

---

### Task 5: Wire the page component

**Files:**
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.ts`
- Modify: `src/app/modules/calendar/feature/calendar-page/calendar-page.component.html`

**Interfaces:**
- Consumes: `CalendarEventStore.conflicts()`, `CalendarEventStore.checkingConflicts()`, `CalendarEventStore.checkConflicts(...)`, `CalendarEventStore.respondToEvent(...)`, `CalendarEventStore.clearConflicts()` (Task 2); `CalendarEventFormModalComponent.conflicts`/`checkingConflicts` inputs and `checkConflicts`/`respond` outputs (Tasks 3-4).

No spec file exists for this component today (it was verified live in the browser in the original Calendar frontend plan, not unit-tested) - this task keeps that precedent and is verified via Step 4's manual check instead of a new spec file.

- [ ] **Step 1: Add the two new handlers and clear conflicts on close**

In `calendar-page.component.ts`, import `RespondToCalendarEventStatus` alongside the existing model imports:
```typescript
import { CalendarEventResponse, RecurrenceEditScope, RespondToCalendarEventStatus } from '../../models/calendar-event.model';
```
Add to `closeForm()` (so a stale warning from a previous create attempt never leaks into the next one):
```typescript
  closeForm(): void {
    this.formOpen.set(false);
    this.editingEvent.set(null);
    this.prefillStart.set(null);
    this.store.clearConflicts();
  }
```
Add two new methods (after `onDelete`):
```typescript
  onCheckConflicts(payload: { participantEmployeeIds: readonly string[]; startDate: string; endDate: string }): void {
    this.store.checkConflicts(payload.participantEmployeeIds, payload.startDate, payload.endDate);
  }

  async onRespond(status: RespondToCalendarEventStatus): Promise<void> {
    const editing = this.editingEvent();
    if (!editing) return;
    const eventId = editing.recurrenceMasterId ?? editing.id;
    const { from, to } = this.currentRange();
    const ok = await this.store.respondToEvent(eventId, status, from, to);
    if (ok) this.closeForm();
  }
```

- [ ] **Step 2: Bind the new inputs/outputs in the template**

In `calendar-page.component.html`, widen the `<app-calendar-event-form-modal>` element:
```html
<app-calendar-event-form-modal
  [open]="formOpen()"
  [event]="editingEvent()"
  [prefillStart]="prefillStart()"
  [saving]="store.saving()"
  [conflicts]="store.conflicts()"
  [checkingConflicts]="store.checkingConflicts()"
  (save)="onSave($event)"
  (delete)="onDelete($event)"
  (respond)="onRespond($event)"
  (checkConflicts)="onCheckConflicts($event)"
  (cancel)="closeForm()"
/>
```

- [ ] **Step 3: Run the full frontend unit suite**

Run: `npm test`
Expected: every test passes, including the pre-existing suite (no regressions from the wiring change).

- [ ] **Step 4: Manual verification in the browser**

Start the dev server, log in to the seeded `dapi` tenant, open the Calendar module:
1. Click "New event", add a participant, pick a start/end time that overlaps an event that participant is already on - confirm the amber conflict warning appears within ~half a second of finishing the picker/date inputs, and the Create button stays enabled.
2. Create the event anyway - confirm it creates successfully despite the warning.
3. Open an existing event that has a participant whose `employeeId` matches the logged-in user - confirm the participants list shows with a response-status badge, and the Accept/Decline row appears.
4. Click Accept - confirm the modal closes and re-opening the same event shows the response status updated to "accepted".

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/calendar/feature/calendar-page/
git commit -m "feat(calendar): wire participants/RSVP/conflict-check into the calendar page"
```
