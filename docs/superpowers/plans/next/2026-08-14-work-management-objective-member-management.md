# Work Management — Objective Member Management (Invite/Accept) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend for the invite/accept Objective member model: a Member button + popup on the milestone detail card, "Request pending" tags, a leader-transfer action, an invitations inbox, and an optional members/leader picker at creation time — consuming the backend endpoints from the linked backend plan.

**Architecture:** New `objective-member-api.service.ts` alongside the existing `project-api.service.ts` (one service per resource, matching this module's existing convention). New signal-store methods on `ProjectDetailStore` for member actions. New standalone Angular components under `work/ui/`, wired into the existing `MilestoneDetailPanelComponent` and `ProjectDetailComponent`.

**Tech Stack:** Angular (standalone components, `@ngrx/signals` signal store), RxJS, Vitest (component/store specs) + Angular `TestBed`/`HttpTestingController` (API service specs, matching `project-api.service.spec.ts`'s existing pattern).

**Spec:** `docs/superpowers/specs/next/2026-08-14-work-management-objective-member-management-design.md`
**Depends on:** `HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-14-work-management-objective-member-management.md` (backend must ship first or alongside — every endpoint this plan calls is defined there).

## Global Constraints

- **Scope guardrail:** touch only `src/app/modules/work/**`. Do not touch `organization`, `layouts/main-layout`, `public`, any admin/platform module, or `src/app/modules/people/**` — a teammate owns those. `PeopleApiService` (in `modules/people`) is consumed read-only, never modified.
- **Commit after every task**, never push (per user 2026-08-14).
- Every new API call goes through `objective-member-api.service.ts`, never `HttpClient` directly from a component.
- Match this module's existing template style exactly: Tailwind utility classes with `[class.x]="cond()"` bindings, `data-testid` attributes on every interactive/assertable element, `input()`/`output()`/`signal()` (not `@Input`/`@Output`/class fields), standalone components importing only what they use.

---

## Task 1: DTOs

**Files:**
- Create: `src/app/modules/work/models/dto/objective-invitation.dto.ts`
- Modify: `src/app/modules/work/models/dto/milestone.dto.ts`

**Interfaces:**
- Produces: `ObjectiveMemberDto`, `ObjectiveMemberListDto`, `ObjectiveInvitationDto`, `CreateObjectiveMemberInvitationDto` — every later task imports these.

- [ ] **Step 1: New invitation DTOs**

```typescript
// src/app/modules/work/models/dto/objective-invitation.dto.ts
export interface ObjectiveMemberItemDto {
  userId: string;
  isHead: boolean;
  pending: boolean;
  inviteType: 'member' | 'leader' | null;
  invitationId: string | null;
  sinceOrInvitedAt: string;
}

export interface ObjectiveMemberListDto {
  items: ObjectiveMemberItemDto[];
}

export interface ObjectiveInvitationDto {
  id: string;
  projectId: string;
  objectiveId: string;
  invitedUserId: string;
  inviteType: 'member' | 'leader';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  invitedById: string;
  decidedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: Extend `CreateObjectiveRequestDto` and add the Transfer/Add-member response shapes to `milestone.dto.ts`**

```typescript
// src/app/modules/work/models/dto/milestone.dto.ts
// Add this interface and extend the existing CreateObjectiveRequestDto in place (do not duplicate it):

export interface CreateObjectiveMemberInvitationRequestDto {
  userId: string;
  type: 'member' | 'leader';
}

export interface CreateObjectiveRequestDto {
  parentObjectiveId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  headUserId?: string | null;
  memberInvitations?: CreateObjectiveMemberInvitationRequestDto[];
}
```

Also add, in the same file, the two outcome shapes the API service (Task 2) returns:

```typescript
export interface AddObjectiveMemberOutcomeDto {
  alreadyMember: boolean;
  invitation: import('./objective-invitation.dto').ObjectiveInvitationDto | null;
}

export interface TransferObjectiveHeadOutcomeDto {
  applied: boolean;
  pendingChangeRequest: unknown | null; // shape unused by this frontend slice - Reporting-Manager approval UI is a separate, deferred feature
  pendingInvitation: import('./objective-invitation.dto').ObjectiveInvitationDto | null;
}
```

- [ ] **Step 3: Build to confirm it compiles**

Run: `npm run build` (or the project's existing type-check script — check `package.json` for the exact command this repo uses; every prior frontend plan in this repo's `plans/finished/` used the same command, copy it from one of those rather than guessing)
Expected: 0 type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/work/models/dto/
git commit -m "feat(work): add DTOs for objective invitations and extend CreateObjectiveRequestDto"
```

---

## Task 2: `ObjectiveMemberApiService`

**Files:**
- Create: `src/app/modules/work/data-access/objective-member-api.service.ts`
- Create: `src/app/modules/work/data-access/objective-member-api.service.spec.ts`

**Interfaces:**
- Consumes: DTOs from Task 1.
- Produces: `ObjectiveMemberApiService` with `getMembers`, `addMember`, `removeMember`, `getMyInvitations`, `acceptInvitation`, `rejectInvitation`, `transferHead` — every later task injects this.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/work/data-access/objective-member-api.service.spec.ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ObjectiveMemberApiService } from './objective-member-api.service';
import { ObjectiveMemberListDto, ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { AddObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto } from '../models/dto/milestone.dto';

describe('ObjectiveMemberApiService', () => {
  let service: ObjectiveMemberApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiUrl}/work/objectives`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ObjectiveMemberApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ObjectiveMemberApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets objective members', () => {
    const dto: ObjectiveMemberListDto = { items: [] };
    service.getMembers('o1').subscribe((res) => expect(res).toEqual(dto));

    const req = httpMock.expectOne(`${base}/o1/members`);
    expect(req.request.method).toBe('GET');
    req.flush(dto);
  });

  it('adds a member and returns the outcome with response status', () => {
    const outcome: AddObjectiveMemberOutcomeDto = { alreadyMember: false, invitation: { id: 'i1' } as ObjectiveInvitationDto };
    service.addMember('o1', 'u1').subscribe((res) => {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(outcome);
    });

    const req = httpMock.expectOne(`${base}/o1/members`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'u1' });
    req.flush(outcome, { status: 202, statusText: 'Accepted' });
  });

  it('removes a member (or cancels their pending invite - backend disambiguates)', () => {
    service.removeMember('o1', 'u1').subscribe((res) => expect(res.status).toBe(204));

    const req = httpMock.expectOne(`${base}/o1/members/u1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('gets my pending invitations', () => {
    const dtos: ObjectiveInvitationDto[] = [];
    service.getMyInvitations().subscribe((res) => expect(res).toEqual(dtos));

    const req = httpMock.expectOne(`${base}/invitations/mine`);
    expect(req.request.method).toBe('GET');
    req.flush(dtos);
  });

  it('accepts an invitation', () => {
    service.acceptInvitation('i1').subscribe();

    const req = httpMock.expectOne(`${base}/invitations/i1/accept`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('rejects an invitation', () => {
    service.rejectInvitation('i1').subscribe();

    const req = httpMock.expectOne(`${base}/invitations/i1/reject`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('transfers head and returns the outcome with response status', () => {
    const outcome: TransferObjectiveHeadOutcomeDto = { applied: false, pendingChangeRequest: null, pendingInvitation: { id: 'i2' } as ObjectiveInvitationDto };
    service.transferHead('o1', 'u2').subscribe((res) => {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(outcome);
    });

    const req = httpMock.expectOne(`${base}/o1/transfer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newHeadUserId: 'u2' });
    req.flush(outcome, { status: 202, statusText: 'Accepted' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/modules/work/data-access/objective-member-api.service.spec.ts` (check `package.json` for the exact test script name this repo uses — every prior plan in `plans/finished/` ran the real command; copy it rather than guessing "vitest" vs "ng test")
Expected: FAIL — `ObjectiveMemberApiService` doesn't exist yet.

- [ ] **Step 3: Implement the service**

```typescript
// src/app/modules/work/data-access/objective-member-api.service.ts
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ObjectiveMemberListDto, ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';
import { AddObjectiveMemberOutcomeDto, TransferObjectiveHeadOutcomeDto } from '../models/dto/milestone.dto';

@Injectable({ providedIn: 'root' })
export class ObjectiveMemberApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/work/objectives`;

  getMembers(objectiveId: string): Observable<ObjectiveMemberListDto> {
    return this.http.get<ObjectiveMemberListDto>(`${this.base}/${objectiveId}/members`);
  }

  addMember(objectiveId: string, userId: string): Observable<HttpResponse<AddObjectiveMemberOutcomeDto>> {
    return this.http.post<AddObjectiveMemberOutcomeDto>(
      `${this.base}/${objectiveId}/members`, { userId }, { observe: 'response' });
  }

  removeMember(objectiveId: string, userId: string): Observable<HttpResponse<void>> {
    return this.http.delete<void>(`${this.base}/${objectiveId}/members/${userId}`, { observe: 'response' });
  }

  getMyInvitations(): Observable<ObjectiveInvitationDto[]> {
    return this.http.get<ObjectiveInvitationDto[]>(`${this.base}/invitations/mine`);
  }

  acceptInvitation(invitationId: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${this.base}/invitations/${invitationId}/accept`, {}, { observe: 'response' });
  }

  rejectInvitation(invitationId: string): Observable<HttpResponse<void>> {
    return this.http.post<void>(`${this.base}/invitations/${invitationId}/reject`, {}, { observe: 'response' });
  }

  transferHead(objectiveId: string, newHeadUserId: string): Observable<HttpResponse<TransferObjectiveHeadOutcomeDto>> {
    return this.http.post<TransferObjectiveHeadOutcomeDto>(
      `${this.base}/${objectiveId}/transfer`, { newHeadUserId }, { observe: 'response' });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: the same test command as Step 2.
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/data-access/objective-member-api.service.ts src/app/modules/work/data-access/objective-member-api.service.spec.ts
git commit -m "feat(work): add ObjectiveMemberApiService"
```

---

## Task 3: Store — member actions on `ProjectDetailStore`

**Files:**
- Modify: `src/app/modules/work/state/project-detail.store.ts`
- Modify: `src/app/modules/work/state/project-detail.store.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveMemberApiService` (Task 2).
- Produces: store state fields `objectiveMembers`, `objectiveMembersLoading`, `objectiveMembersError`, `myInvitations`; methods `loadObjectiveMembers`, `addObjectiveMember`, `removeObjectiveMember`, `transferObjectiveHead`, `loadMyInvitations`, `acceptInvitation`, `rejectInvitation` — every later component task calls these, never the API service directly.

- [ ] **Step 1: Write the failing tests**

Open `project-detail.store.spec.ts` first to see its existing mocking pattern (it stubs `ProjectApiService` — mirror that exactly for `ObjectiveMemberApiService`). Add:

```typescript
  it('loadObjectiveMembers populates objectiveMembers on success', async () => {
    const memberApi = { getMembers: vi.fn().mockReturnValue(of({ items: [{ userId: 'u1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' }] })) };
    const store = createStoreWithMemberApi(memberApi);

    await store.loadObjectiveMembers('o1');

    expect(store.objectiveMembers()).toEqual([{ userId: 'u1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' }]);
    expect(store.objectiveMembersError()).toBeNull();
  });

  it('addObjectiveMember reports pending:false when already an active member (204)', async () => {
    const memberApi = { addMember: vi.fn().mockReturnValue(of(new HttpResponse<AddObjectiveMemberOutcomeDto>({ body: { alreadyMember: true, invitation: null }, status: 204 }))) };
    const store = createStoreWithMemberApi(memberApi);

    const result = await store.addObjectiveMember('o1', 'u2');

    expect(result).toEqual({ success: true, alreadyMember: true });
  });

  it('addObjectiveMember reports pending:true (invitation created) on 202', async () => {
    const memberApi = { addMember: vi.fn().mockReturnValue(of(new HttpResponse<AddObjectiveMemberOutcomeDto>({ body: { alreadyMember: false, invitation: { id: 'i1' } as ObjectiveInvitationDto }, status: 202 }))) };
    const store = createStoreWithMemberApi(memberApi);

    const result = await store.addObjectiveMember('o1', 'u2');

    expect(result).toEqual({ success: true, alreadyMember: false });
  });

  it('transferObjectiveHead reports applied:false with a pendingInvitation on 202', async () => {
    const memberApi = { transferHead: vi.fn().mockReturnValue(of(new HttpResponse<TransferObjectiveHeadOutcomeDto>({ body: { applied: false, pendingChangeRequest: null, pendingInvitation: { id: 'i2' } as ObjectiveInvitationDto }, status: 202 }))) };
    const store = createStoreWithMemberApi(memberApi);

    const result = await store.transferObjectiveHead('o1', 'u3');

    expect(result).toEqual({ success: true, applied: false, viaInvitation: true });
  });

  it('loadMyInvitations populates myInvitations', async () => {
    const memberApi = { getMyInvitations: vi.fn().mockReturnValue(of([{ id: 'i1' } as ObjectiveInvitationDto])) };
    const store = createStoreWithMemberApi(memberApi);

    await store.loadMyInvitations();

    expect(store.myInvitations()).toEqual([{ id: 'i1' }]);
  });

  it('acceptInvitation returns success:true and clears the accepted invitation from myInvitations', async () => {
    const memberApi = {
      getMyInvitations: vi.fn().mockReturnValue(of([{ id: 'i1' } as ObjectiveInvitationDto])),
      acceptInvitation: vi.fn().mockReturnValue(of(new HttpResponse<void>({ status: 204 })))
    };
    const store = createStoreWithMemberApi(memberApi);
    await store.loadMyInvitations();

    const result = await store.acceptInvitation('i1');

    expect(result).toEqual({ success: true });
    expect(store.myInvitations()).toEqual([]);
  });
```

(Add a `createStoreWithMemberApi` helper in the spec file that provides both the existing `ProjectApiService` stub and a new `ObjectiveMemberApiService` stub via `TestBed.configureTestingModule`, mirroring however the existing top-of-file setup already provides `ProjectApiService` — copy that exact provider-override shape, don't invent a new one.)

- [ ] **Step 2: Run tests to verify they fail**

Run the project's test command scoped to `project-detail.store.spec.ts`.
Expected: FAIL — the store has no member methods yet.

- [ ] **Step 3: Extend the store**

```typescript
// src/app/modules/work/state/project-detail.store.ts
// Add to imports:
import { ObjectiveMemberApiService } from '../data-access/objective-member-api.service';
import { ObjectiveMemberItemDto, ObjectiveInvitationDto } from '../models/dto/objective-invitation.dto';

// Add to ProjectDetailState:
  readonly objectiveMembers: readonly ObjectiveMemberItemDto[];
  readonly objectiveMembersLoading: boolean;
  readonly objectiveMembersError: string | null;
  readonly myInvitations: readonly ObjectiveInvitationDto[];

// Add to initialState:
  objectiveMembers: [], objectiveMembersLoading: false, objectiveMembersError: null,
  myInvitations: [],

// Change the withMethods factory signature to also inject the new service:
  withMethods((store, api = inject(ProjectApiService), memberApi = inject(ObjectiveMemberApiService)) => ({
    // ...existing methods unchanged...

    async loadObjectiveMembers(objectiveId: string): Promise<void> {
      patchState(store, { objectiveMembersLoading: true, objectiveMembersError: null });
      try {
        const dto = await firstValueFrom(memberApi.getMembers(objectiveId));
        patchState(store, { objectiveMembers: dto.items, objectiveMembersLoading: false });
      } catch (err) {
        patchState(store, { objectiveMembersError: extractError(err, 'Failed to load members.'), objectiveMembersLoading: false });
      }
    },

    async addObjectiveMember(objectiveId: string, userId: string): Promise<{ success: boolean; alreadyMember: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.addMember(objectiveId, userId));
        patchState(store, { milestoneActionError: null });
        return { success: true, alreadyMember: res.body!.alreadyMember };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to add member.') });
        return { success: false, alreadyMember: false };
      }
    },

    async removeObjectiveMember(objectiveId: string, userId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(memberApi.removeMember(objectiveId, userId));
        patchState(store, { milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to remove member.') });
        return { success: false };
      }
    },

    async transferObjectiveHead(objectiveId: string, newHeadUserId: string): Promise<{ success: boolean; applied: boolean; viaInvitation: boolean }> {
      try {
        const res = await firstValueFrom(memberApi.transferHead(objectiveId, newHeadUserId));
        patchState(store, { milestoneActionError: null });
        return { success: true, applied: res.body!.applied, viaInvitation: res.body!.pendingInvitation !== null };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to transfer leadership.') });
        return { success: false, applied: false, viaInvitation: false };
      }
    },

    async loadMyInvitations(): Promise<void> {
      try {
        const dtos = await firstValueFrom(memberApi.getMyInvitations());
        patchState(store, { myInvitations: dtos });
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to load invitations.') });
      }
    },

    async acceptInvitation(invitationId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(memberApi.acceptInvitation(invitationId));
        patchState(store, { myInvitations: store.myInvitations().filter((i) => i.id !== invitationId), milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to accept invitation.') });
        return { success: false };
      }
    },

    async rejectInvitation(invitationId: string): Promise<{ success: boolean }> {
      try {
        await firstValueFrom(memberApi.rejectInvitation(invitationId));
        patchState(store, { myInvitations: store.myInvitations().filter((i) => i.id !== invitationId), milestoneActionError: null });
        return { success: true };
      } catch (err) {
        patchState(store, { milestoneActionError: extractError(err, 'Failed to reject invitation.') });
        return { success: false };
      }
    }
  }))
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2.
Expected: all new tests PASS, all pre-existing tests still PASS unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/state/project-detail.store.ts src/app/modules/work/state/project-detail.store.spec.ts
git commit -m "feat(work): add objective member actions to ProjectDetailStore"
```

---

## Task 4: `member-button` component

**Files:**
- Create: `src/app/modules/work/ui/member-button/member-button.component.ts`
- Create: `src/app/modules/work/ui/member-button/member-button.component.spec.ts`
- Modify: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.ts`
- Modify: `src/app/modules/work/ui/milestone-detail-panel/milestone-detail-panel.component.spec.ts` (find this file — it exists per the sibling-spec pattern already established for every UI component in this folder)

**Interfaces:**
- Produces: `MemberButtonComponent` with `memberCount` input and `pressed` output — consumed only by `MilestoneDetailPanelComponent` in this task.

- [ ] **Step 1: Write the failing component test**

```typescript
// src/app/modules/work/ui/member-button/member-button.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MemberButtonComponent } from './member-button.component';

describe('MemberButtonComponent', () => {
  let fixture: ComponentFixture<MemberButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MemberButtonComponent] }).compileComponents();
    fixture = TestBed.createComponent(MemberButtonComponent);
  });

  it('emits pressed when clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.pressed.subscribe(spy);
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="member-button"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalled();
  });

  it('shows the member count badge when memberCount is set', () => {
    fixture.componentRef.setInput('memberCount', 3);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="member-count-badge"]').textContent.trim()).toBe('3');
  });

  it('hides the badge when memberCount is 0', () => {
    fixture.componentRef.setInput('memberCount', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="member-count-badge"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run the project's test command scoped to this spec file.
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/modules/work/ui/member-button/member-button.component.ts
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-member-button',
  standalone: true,
  template: `
    <button
      type="button"
      data-testid="member-button"
      class="relative flex items-center justify-center rounded-md p-0.5 transition-colors text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]"
      aria-label="Members"
      (click)="pressed.emit()"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
      @if (memberCount() > 0) {
        <span
          data-testid="member-count-badge"
          class="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--color-accent)] px-0.5 text-[9px] font-semibold leading-none text-white"
        >{{ memberCount() }}</span>
      }
    </button>
  `
})
export class MemberButtonComponent {
  memberCount = input(0);
  pressed = output<void>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run the same command as Step 2.
Expected: all 3 tests PASS.

- [ ] **Step 5: Wire it into `MilestoneDetailPanelComponent`'s top-right corner**

In `milestone-detail-panel.component.ts`, add `MemberButtonComponent` to `imports`, add `membersRequested = output<void>()` and `memberCount = input(0)` to the class, and place the button in the title row next to the Achieved badge:

```typescript
// Replace the existing title-row div (currently title + optional Achieved badge only):
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
            <h2 class="text-lg font-bold tracking-tight text-[var(--color-text-primary)]">{{ d.title }}</h2>
            <div class="flex items-center gap-2">
              @if (d.isAchieved) {
                <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 ring-1 ring-emerald-600/20">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Achieved
                </span>
              }
              <app-member-button [memberCount]="memberCount()" (pressed)="membersRequested.emit()" />
            </div>
          </div>
```

- [ ] **Step 6: Update the panel's own spec for the new output**

Open `milestone-detail-panel.component.spec.ts`, add a test asserting `app-member-button`'s `pressed` output re-emits as the panel's `membersRequested` output (click `[data-testid="member-button"]` via `fixture.nativeElement.querySelector`, assert a subscribed spy on `membersRequested` fires) — mirror the existing `editRequested`/`achieveToggleRequested` output tests already in that file for style.

- [ ] **Step 7: Run all affected specs**

Run the test command scoped to both `member-button.component.spec.ts` and `milestone-detail-panel.component.spec.ts`.
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app/modules/work/ui/member-button/ src/app/modules/work/ui/milestone-detail-panel/
git commit -m "feat(work): add member-button to the milestone detail panel"
```

---

## Task 5: `objective-members-popup` component

**Files:**
- Create: `src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.ts`
- Create: `src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveMemberItemDto` (Task 1).
- Produces: `ObjectiveMembersPopupComponent` with `open`, `members`, `loading`, `canManage` inputs; `addRequested(userId: string)`, `removeRequested(userId: string)`, `transferRequested(userId: string)`, `closed` outputs. **Does not itself contain a people-picker** — `addRequested`/`transferRequested` take a `userId` the caller already resolved (Task 7 owns picking that `userId`; kept separate so this component has one job — rendering the member list and pending tags — and doesn't depend on how a user gets chosen).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObjectiveMembersPopupComponent } from './objective-members-popup.component';
import { ObjectiveMemberItemDto } from '../../models/dto/objective-invitation.dto';

describe('ObjectiveMembersPopupComponent', () => {
  let fixture: ComponentFixture<ObjectiveMembersPopupComponent>;

  const members: ObjectiveMemberItemDto[] = [
    { userId: 'head1', isHead: true, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-01' },
    { userId: 'mem1', isHead: false, pending: false, inviteType: null, invitationId: null, sinceOrInvitedAt: '2026-01-02' },
    { userId: 'pend1', isHead: false, pending: true, inviteType: 'member', invitationId: 'inv1', sinceOrInvitedAt: '2026-01-03' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ObjectiveMembersPopupComponent] }).compileComponents();
    fixture = TestBed.createComponent(ObjectiveMembersPopupComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('members', members);
    fixture.componentRef.setInput('canManage', true);
    fixture.detectChanges();
  });

  it('renders a row per member, tagging pending ones "Request pending"', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    expect(rows.length).toBe(3);
    const pendingRow = Array.from(rows).find((r: any) => r.dataset.userId === 'pend1') as HTMLElement;
    expect(pendingRow.querySelector('[data-testid="pending-tag"]').textContent.trim()).toBe('Request pending');
  });

  it('marks the head row with a Leader badge', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const headRow = Array.from(rows).find((r: any) => r.dataset.userId === 'head1') as HTMLElement;
    expect(headRow.querySelector('[data-testid="leader-badge"]')).not.toBeNull();
  });

  it('emits removeRequested with the row userId when its remove button is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.removeRequested.subscribe(spy);

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const memberRow = Array.from(rows).find((r: any) => r.dataset.userId === 'mem1') as HTMLElement;
    (memberRow.querySelector('[data-testid="remove-button"]') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('mem1');
  });

  it('does not render remove/transfer actions when canManage is false', () => {
    fixture.componentRef.setInput('canManage', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="remove-button"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="transfer-button"]')).toBeNull();
  });

  it('does not render a remove button on the head row (transfer is the only way to move headship)', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="member-row"]');
    const headRow = Array.from(rows).find((r: any) => r.dataset.userId === 'head1') as HTMLElement;
    expect(headRow.querySelector('[data-testid="remove-button"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command scoped to this spec file.
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

Read `src/app/shared/ui/modal/modal.component.ts` and `src/app/shared/ui/avatar/avatar.component.ts` first (both already used by `MilestoneDetailPanelComponent`) to match their exact `input()`/template-usage shape before importing them here.

```typescript
// src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.ts
import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ObjectiveMemberItemDto } from '../../models/dto/objective-invitation.dto';

@Component({
  selector: 'app-objective-members-popup',
  standalone: true,
  imports: [ModalComponent, AvatarComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" title="Members" (closed)="closed.emit()">
      <div class="flex flex-col gap-2">
        @if (canManage()) {
          <span data-testid="add-member-button">
            <app-button variant="secondary" size="sm" (pressed)="addRequested.emit()">+ Add member</app-button>
          </span>
        }
        @for (member of members(); track member.userId) {
          <div
            data-testid="member-row"
            [attr.data-user-id]="member.userId"
            class="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2"
          >
            <div class="flex items-center gap-2">
              <app-avatar [userName]="member.userId" size="sm" />
              <span class="text-xs font-medium text-[var(--color-text-primary)]">{{ member.userId }}</span>
              @if (member.isHead) {
                <span data-testid="leader-badge" class="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">Leader</span>
              }
              @if (member.pending) {
                <span data-testid="pending-tag" class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Request pending</span>
              }
            </div>
            @if (canManage() && !member.pending) {
              <div class="flex items-center gap-1">
                @if (!member.isHead) {
                  <span data-testid="remove-button">
                    <app-button variant="secondary" size="sm" (pressed)="removeRequested.emit(member.userId)">Remove</app-button>
                  </span>
                  <span data-testid="transfer-button">
                    <app-button variant="secondary" size="sm" (pressed)="transferRequested.emit(member.userId)">Make leader</app-button>
                  </span>
                }
              </div>
            }
            @if (canManage() && member.pending) {
              <span data-testid="remove-button">
                <app-button variant="secondary" size="sm" (pressed)="removeRequested.emit(member.userId)">Cancel</app-button>
              </span>
            }
          </div>
        }
      </div>
    </app-modal>
  `
})
export class ObjectiveMembersPopupComponent {
  open = input(false);
  members = input<ObjectiveMemberItemDto[]>([]);
  loading = input(false);
  canManage = input(false);

  addRequested = output<void>();
  removeRequested = output<string>();
  transferRequested = output<string>();
  closed = output<void>();
}
```

**Note:** this template renders `member.userId` as the display name because `ObjectiveMemberItemDto` (backend Task 6) carries no name field — only `userId`. Before considering this task done, confirm with the backend plan whether Get Objective Members should resolve display names server-side (matching how `GetObjectiveByIdQueryHandler` resolves `ownerName`/`reportingManagerName`) — if the backend plan ships without that, this popup will show raw GUIDs to real users, which is a usability gap worth fixing on either side before this ships to production, not silently shipped as-is.

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2.
Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/objective-members-popup/
git commit -m "feat(work): add objective-members-popup component"
```

---

## Task 6: Wire the popup into `ProjectDetailComponent`

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveMembersPopupComponent` (Task 5), `ProjectDetailStore`'s member methods (Task 3).

- [ ] **Step 1: Read the current component in full**

Open `project-detail.component.ts` completely before editing — it already wires `MilestoneDetailPanelComponent`'s `editRequested`/`achieveToggleRequested`/`createSubRequested` outputs to store calls and local modal-open signals (see `onMilestoneSettingsSaved` read earlier in this session). Follow that exact pattern for the new `membersRequested` output.

- [ ] **Step 2: Write the failing tests**

Add to `project-detail.component.spec.ts` (mirror the existing modal-open-signal tests for `editRequested` etc.):

```typescript
  it('opens the members popup when the detail panel requests it', () => {
    fixture.detectChanges();
    component.onMembersRequested();
    fixture.detectChanges();

    expect(component.membersPopupOpen()).toBe(true);
  });

  it('loads objective members when the popup opens', () => {
    component.targetMilestone.set({ objectiveId: 'o1' } as any);
    component.onMembersRequested();

    expect(storeStub.loadObjectiveMembers).toHaveBeenCalledWith('o1');
  });

  it('calls store.addObjectiveMember when the popup requests adding a member', async () => {
    component.targetMilestone.set({ objectiveId: 'o1' } as any);

    await component.onAddMemberRequested('u9');

    expect(storeStub.addObjectiveMember).toHaveBeenCalledWith('o1', 'u9');
  });

  it('calls store.removeObjectiveMember when the popup requests removing a member', async () => {
    component.targetMilestone.set({ objectiveId: 'o1' } as any);

    await component.onRemoveMemberRequested('u9');

    expect(storeStub.removeObjectiveMember).toHaveBeenCalledWith('o1', 'u9');
  });

  it('calls store.transferObjectiveHead when the popup requests a leader transfer', async () => {
    component.targetMilestone.set({ objectiveId: 'o1' } as any);

    await component.onTransferRequested('u9');

    expect(storeStub.transferObjectiveHead).toHaveBeenCalledWith('o1', 'u9');
  });
```

Extend the file's existing `storeStub` object with `loadObjectiveMembers: vi.fn()`, `addObjectiveMember: vi.fn().mockResolvedValue({ success: true, alreadyMember: false })`, `removeObjectiveMember: vi.fn().mockResolvedValue({ success: true })`, `transferObjectiveHead: vi.fn().mockResolvedValue({ success: true, applied: false, viaInvitation: true })`, `objectiveMembers: signal([])` (or however the file's existing stub exposes store signals — match that exact shape).

- [ ] **Step 3: Run tests to verify they fail**

Run the test command scoped to this spec file.
Expected: FAIL — the new methods/signal don't exist on the component yet.

- [ ] **Step 4: Implement the wiring**

Add to `ProjectDetailComponent` (exact insertion points depend on the file's current structure — read it first per Step 1; this is the logic to add, following the same shape as the existing `onMilestoneSettingsSaved`/settings-modal wiring):

```typescript
  membersPopupOpen = signal(false);

  onMembersRequested(): void {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.membersPopupOpen.set(true);
    this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  onMembersPopupClosed(): void {
    this.membersPopupOpen.set(false);
  }

  async onAddMemberRequested(userId: string): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    await this.store.addObjectiveMember(milestone.objectiveId, userId);
    await this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  async onRemoveMemberRequested(userId: string): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    await this.store.removeObjectiveMember(milestone.objectiveId, userId);
    await this.store.loadObjectiveMembers(milestone.objectiveId);
  }

  async onTransferRequested(userId: string): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    await this.store.transferObjectiveHead(milestone.objectiveId, userId);
    await this.store.loadObjectiveMembers(milestone.objectiveId);
  }
```

Add `ObjectiveMembersPopupComponent` to the component's `imports`, add `(membersRequested)="onMembersRequested()"` to the existing `<app-milestone-detail-panel>` tag, and add the popup's own tag near the other modal tags already in the template:

```html
<app-objective-members-popup
  [open]="membersPopupOpen()"
  [members]="store.objectiveMembers()"
  [loading]="store.objectiveMembersLoading()"
  [canManage]="targetMilestone()?.isOwner ?? false"
  (addRequested)="onAddMemberRequested($event)"
  (removeRequested)="onRemoveMemberRequested($event)"
  (transferRequested)="onTransferRequested($event)"
  (closed)="onMembersPopupClosed()"
/>
```

**Known gap, deliberately not fixed by this task:** `addRequested` currently has no argument in the popup's own template (Task 5's "+ Add member" button emits `void`, not a `userId`) — this task's `onAddMemberRequested(userId: string)` signature won't actually receive a real `userId` until Task 7 (the people-picker) wires a real selection into it. Wire `onAddMemberRequested` to accept the eventual real payload now so Task 7 only has to change the popup's own emit, not this component — but do not consider Task 6 "working end-to-end" until Task 7 lands.

- [ ] **Step 5: Run tests to verify they pass**

Run the same command as Step 2.
Expected: all new tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/project-detail/
git commit -m "feat(work): wire objective-members-popup into ProjectDetailComponent"
```

---

## Task 7: People-picker for Add Member / leader assignment — BLOCKED, needs a decision

**This task cannot be written yet.** While preparing this plan, cross-checking the only available employee-search endpoint (`PeopleApiService.listEmployees()`, wrapping the backend's `GET /api/v1/employees`) against what our invite APIs need turned up a real mismatch:

- `EmployeeListItemResponse` (`src/app/modules/people/models/employee.model.ts`, backend source `EmployeeListItemResponse.cs`) exposes `id` — the **Employee record's own id** — and has no `userId` field at all.
- Every Work Management invite endpoint (`AddObjectiveMemberRequest.UserId`, `TransferObjectiveHeadRequest.NewHeadUserId`, and the new `CreateObjectiveMemberInvitationRequest.userId`) takes the **`users` table id**, not the employee id. This is the existing, already-shipped contract — not something this plan introduces.

So a people-picker built directly on `PeopleApiService.listEmployees()` would let someone search and select a person, but the id it hands back (`employee.id`) is the wrong id to send to any of this plan's endpoints. This wasn't visible until DTO shapes were compared side-by-side — it isn't a gap in the design, it's a mismatch between two already-existing, already-shipped surfaces neither side (Work Management, Core HR) currently bridges.

Do not guess at a fix. The three real options, each with a different owner:
1. **Add `userId` to `EmployeeListItemResponse`** (backend, Core HR/teammate's module) — smallest change, but requires asking the teammate to touch their DTO, which is outside this plan's scope to do unilaterally.
2. **Add employee→user resolution inside Work Management** — e.g. a new backend lookup (`GetActiveEmployeeByIdAsync` on `IMilestoneMembershipCoordinator`) so the frontend picker can keep using `employee.id` and Work Management resolves it server-side. Stays entirely within our scope, but is a real addition to the already-written backend plan (Task 4/10/11 would need a `employeeId`-accepting variant, or the picker does a second round-trip).
3. **A different picker source entirely**, if one exists elsewhere in the frontend that already exposes `userId` (not found in this session's search, but worth one more targeted look before assuming it doesn't exist).

Resolve this with the user before writing Task 7's steps — everything in Tasks 1–6 and 8 works standalone without it, but "Add member" and "assign leader" have no real UI until this is settled.

---

## Task 8: My Invitations panel

**Files:**
- Create: `src/app/modules/work/ui/my-invitations-panel/my-invitations-panel.component.ts`
- Create: `src/app/modules/work/ui/my-invitations-panel/my-invitations-panel.component.spec.ts`
- Modify: `src/app/modules/work/feature/project-list/project-list.component.ts`
- Modify: `src/app/modules/work/feature/project-list/project-list.component.spec.ts`

**Interfaces:**
- Consumes: `ObjectiveInvitationDto` (Task 1), `ProjectDetailStore.loadMyInvitations`/`.myInvitations`/`.acceptInvitation`/`.rejectInvitation` (Task 3).

- [ ] **Step 1: Write the failing component test**

```typescript
// src/app/modules/work/ui/my-invitations-panel/my-invitations-panel.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyInvitationsPanelComponent } from './my-invitations-panel.component';
import { ObjectiveInvitationDto } from '../../models/dto/objective-invitation.dto';

describe('MyInvitationsPanelComponent', () => {
  let fixture: ComponentFixture<MyInvitationsPanelComponent>;

  const invitations: ObjectiveInvitationDto[] = [
    { id: 'i1', projectId: 'p1', objectiveId: 'o1', invitedUserId: 'u1', inviteType: 'leader', status: 'pending', invitedById: 'u2', decidedAt: null, createdAt: '2026-01-01' }
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MyInvitationsPanelComponent] }).compileComponents();
    fixture = TestBed.createComponent(MyInvitationsPanelComponent);
    fixture.componentRef.setInput('invitations', invitations);
    fixture.detectChanges();
  });

  it('renders one row per invitation with its type', () => {
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="invitation-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('leader');
  });

  it('emits acceptRequested with the invitation id', () => {
    const spy = vi.fn();
    fixture.componentInstance.acceptRequested.subscribe(spy);

    fixture.nativeElement.querySelector('[data-testid="accept-button"]').click();

    expect(spy).toHaveBeenCalledWith('i1');
  });

  it('emits rejectRequested with the invitation id', () => {
    const spy = vi.fn();
    fixture.componentInstance.rejectRequested.subscribe(spy);

    fixture.nativeElement.querySelector('[data-testid="reject-button"]').click();

    expect(spy).toHaveBeenCalledWith('i1');
  });

  it('renders nothing when there are no invitations', () => {
    fixture.componentRef.setInput('invitations', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="invitations-panel"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command scoped to this spec file.
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement the component**

```typescript
// src/app/modules/work/ui/my-invitations-panel/my-invitations-panel.component.ts
import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ObjectiveInvitationDto } from '../../models/dto/objective-invitation.dto';

@Component({
  selector: 'app-my-invitations-panel',
  standalone: true,
  imports: [ButtonComponent],
  template: `
    @if (invitations().length > 0) {
      <div data-testid="invitations-panel" class="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <h3 class="text-xs font-semibold text-[var(--color-text-secondary)]">Pending invitations</h3>
        @for (invitation of invitations(); track invitation.id) {
          <div data-testid="invitation-row" class="flex items-center justify-between gap-2 text-xs">
            <span>You've been invited as {{ invitation.inviteType }} on a milestone.</span>
            <div class="flex items-center gap-1">
              <span data-testid="accept-button">
                <app-button variant="primary" size="sm" (pressed)="acceptRequested.emit(invitation.id)">Accept</app-button>
              </span>
              <span data-testid="reject-button">
                <app-button variant="secondary" size="sm" (pressed)="rejectRequested.emit(invitation.id)">Reject</app-button>
              </span>
            </div>
          </div>
        }
      </div>
    }
  `
})
export class MyInvitationsPanelComponent {
  invitations = input<ObjectiveInvitationDto[]>([]);
  acceptRequested = output<string>();
  rejectRequested = output<string>();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run the same command as Step 2.
Expected: all 4 tests PASS.

- [ ] **Step 5: Wire it into `ProjectListComponent`**

Read `project-list.component.ts` in full first. Add `MyInvitationsPanelComponent` to imports, inject/reuse the same `ProjectDetailStore` this module already uses elsewhere (or confirm which store owns `myInvitations` per Task 3 and inject that one), call `store.loadMyInvitations()` in `ngOnInit`, and place `<app-my-invitations-panel [invitations]="store.myInvitations()" (acceptRequested)="onAcceptInvitation($event)" (rejectRequested)="onRejectInvitation($event)" />` near the top of the page template, above the project grid. Add `onAcceptInvitation`/`onRejectInvitation` methods that call `store.acceptInvitation`/`store.rejectInvitation` and, on success, reload both `myInvitations` and the project list (an accepted leader invitation can change which projects/milestones the caller now has access to).

Add matching tests to `project-list.component.spec.ts` mirroring Task 6 Step 2's pattern (load-on-init, accept/reject delegate to the store, reload after accept).

- [ ] **Step 6: Run all affected specs**

Run the test command scoped to `my-invitations-panel.component.spec.ts` and `project-list.component.spec.ts`.
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/modules/work/ui/my-invitations-panel/ src/app/modules/work/feature/project-list/
git commit -m "feat(work): add My Invitations panel to the project list page"
```

---

# Phase 2: UserId → Employee-Based Identity (supersedes `userId` throughout Tasks 1–3, 5, 6, 8; unblocks Task 7)

**Added 2026-08-14.** The backend plan (`HRMS-Backend-v1/docs/superpowers/plans/next/2026-08-14-work-management-objective-member-management.md`, Tasks 13–25) replaced `UserId` with `EmployeeId` as the identity for every ownership/membership field in Work Management — one User can be linked to multiple Employee records (one per legal entity, since a tenant can control several), so `UserId` can no longer identify a person unambiguously. Every Work Management invite/member/transfer endpoint now takes `employeeId` on the wire, not `userId`.

**This resolves Task 7's blocker.** Task 7 above was left unwritten because `PeopleApiService.listEmployees()` only ever returned `employee.id`, never a `userId`, and the invite endpoints at the time needed `userId` — a real mismatch with no owner-in-scope fix. That mismatch is gone: every endpoint this plan calls now takes `employeeId` directly, which is exactly what the picker already has. **Task 7 is rewritten in full below, no longer blocked.**

**Rename, mechanical, throughout every file Tasks 1–3/5/6/8 already describe:** `userId` → `employeeId` (variable names, DTO fields, method parameters, `data-user-id` attributes, route segments). Specific field/method renames:

| Old (Tasks 1–6, 8 as written above) | New (Phase 2) |
|---|---|
| `ObjectiveMemberItemDto.userId` | `ObjectiveMemberItemDto.employeeId` |
| `ObjectiveInvitationDto.invitedUserId` | `ObjectiveInvitationDto.invitedEmployeeId` |
| `CreateObjectiveMemberInvitationRequestDto.userId` | `CreateObjectiveMemberInvitationRequestDto.employeeId` |
| `CreateObjectiveRequestDto.headUserId` | `CreateObjectiveRequestDto.headEmployeeId` |
| `ObjectiveMemberApiService.addMember(objectiveId, userId)` | `addMember(objectiveId, employeeId)` — POST body `{ employeeId }` |
| `ObjectiveMemberApiService.removeMember(objectiveId, userId)` | `removeMember(objectiveId, employeeId)` — route `/members/${employeeId}` |
| `ObjectiveMemberApiService.transferHead(objectiveId, newHeadUserId)` | `transferHead(objectiveId, newHeadEmployeeId)` — POST body `{ newHeadEmployeeId }` |
| `ProjectDetailStore.addObjectiveMember(objectiveId, userId)` | `addObjectiveMember(objectiveId, employeeId)` |
| `ProjectDetailStore.removeObjectiveMember(objectiveId, userId)` | `removeObjectiveMember(objectiveId, employeeId)` |
| `ProjectDetailStore.transferObjectiveHead(objectiveId, newHeadUserId)` | `transferObjectiveHead(objectiveId, newHeadEmployeeId)` |
| `ObjectiveMembersPopupComponent`'s `addRequested`/`removeRequested`/`transferRequested` outputs, `member.userId` template bindings, `[attr.data-user-id]` | emit/bind `employeeId` throughout; attribute becomes `[attr.data-employee-id]` |
| `ProjectDetailComponent.onAddMemberRequested/onRemoveMemberRequested/onTransferRequested(userId: string)` | same methods, parameter renamed `employeeId: string` |

**Fields that do NOT rename** (per the backend plan's Task 25 decision — JSON field names on `ObjectiveDetailResponse`/`ObjectiveSubtreeResponse`/`ProjectDetailResponse`/etc. stay the same, only their meaning changes): `ownerId`, `reportingManagerId`, `leadId`, `requestedById`, `decidedById` on any milestone/project/objective-change-request DTO **not** already covered above — if this frontend's `milestone.model.ts`/`project.model.ts` (outside this plan's own new files) has doc comments describing these as "the user id of...", update the comment to "the employee id of..." wherever you touch that file for this feature, but the field name and TypeScript type (`string`) are unchanged, so no compile-breaking change there.

---

## Task 1 (revised): DTOs

Replace Task 1 Step 1's `ObjectiveMemberItemDto`/`ObjectiveInvitationDto` with:

```typescript
// src/app/modules/work/models/dto/objective-invitation.dto.ts
export interface ObjectiveMemberItemDto {
  employeeId: string;
  isHead: boolean;
  pending: boolean;
  inviteType: 'member' | 'leader' | null;
  invitationId: string | null;
  sinceOrInvitedAt: string;
}

export interface ObjectiveMemberListDto {
  items: ObjectiveMemberItemDto[];
}

export interface ObjectiveInvitationDto {
  id: string;
  projectId: string;
  objectiveId: string;
  invitedEmployeeId: string;
  inviteType: 'member' | 'leader';
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';
  invitedById: string;
  decidedAt: string | null;
  createdAt: string;
}
```

Replace Task 1 Step 2's `CreateObjectiveMemberInvitationRequestDto`/`CreateObjectiveRequestDto` with:

```typescript
// src/app/modules/work/models/dto/milestone.dto.ts
export interface CreateObjectiveMemberInvitationRequestDto {
  employeeId: string;
  type: 'member' | 'leader';
}

export interface CreateObjectiveRequestDto {
  parentObjectiveId: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  allocatedHours: number;
  headEmployeeId?: string | null;
  memberInvitations?: CreateObjectiveMemberInvitationRequestDto[];
}
```

The rest of Task 1 (Steps 3–4, build/commit) is unchanged.

---

## Task 2 (revised): `ObjectiveMemberApiService`

Replace every `userId: string` parameter with `employeeId: string`, and every `newHeadUserId`/`{ userId }`/`{ newHeadUserId }` occurrence in both the spec and the implementation:

```typescript
// objective-member-api.service.spec.ts — the 3 affected tests
  it('adds a member and returns the outcome with response status', () => {
    const outcome: AddObjectiveMemberOutcomeDto = { alreadyMember: false, invitation: { id: 'i1' } as ObjectiveInvitationDto };
    service.addMember('o1', 'e1').subscribe((res) => {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(outcome);
    });

    const req = httpMock.expectOne(`${base}/o1/members`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ employeeId: 'e1' });
    req.flush(outcome, { status: 202, statusText: 'Accepted' });
  });

  it('removes a member (or cancels their pending invite - backend disambiguates)', () => {
    service.removeMember('o1', 'e1').subscribe((res) => expect(res.status).toBe(204));

    const req = httpMock.expectOne(`${base}/o1/members/e1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('transfers head and returns the outcome with response status', () => {
    const outcome: TransferObjectiveHeadOutcomeDto = { applied: false, pendingChangeRequest: null, pendingInvitation: { id: 'i2' } as ObjectiveInvitationDto };
    service.transferHead('o1', 'e2').subscribe((res) => {
      expect(res.status).toBe(202);
      expect(res.body).toEqual(outcome);
    });

    const req = httpMock.expectOne(`${base}/o1/transfer`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newHeadEmployeeId: 'e2' });
    req.flush(outcome, { status: 202, statusText: 'Accepted' });
  });
```

```typescript
// objective-member-api.service.ts — the 3 affected methods
  addMember(objectiveId: string, employeeId: string): Observable<HttpResponse<AddObjectiveMemberOutcomeDto>> {
    return this.http.post<AddObjectiveMemberOutcomeDto>(
      `${this.base}/${objectiveId}/members`, { employeeId }, { observe: 'response' });
  }

  removeMember(objectiveId: string, employeeId: string): Observable<HttpResponse<void>> {
    return this.http.delete<void>(`${this.base}/${objectiveId}/members/${employeeId}`, { observe: 'response' });
  }

  transferHead(objectiveId: string, newHeadEmployeeId: string): Observable<HttpResponse<TransferObjectiveHeadOutcomeDto>> {
    return this.http.post<TransferObjectiveHeadOutcomeDto>(
      `${this.base}/${objectiveId}/transfer`, { newHeadEmployeeId }, { observe: 'response' });
  }
```

The rest of Task 2 (getMembers/getMyInvitations/acceptInvitation/rejectInvitation, and Steps 2/4/5) is unchanged — none of those touched a person-identifying id.

---

## Task 3 (revised): Store

Apply the same `userId`→`employeeId` rename to every occurrence:

- Test fixtures: `{ userId: 'u1', ... }` → `{ employeeId: 'e1', ... }` (both `loadObjectiveMembers` test's mock return and its assertion).
- `addObjectiveMember(objectiveId: string, userId: string)` → `addObjectiveMember(objectiveId: string, employeeId: string)`, body `await firstValueFrom(memberApi.addMember(objectiveId, employeeId))`.
- `removeObjectiveMember(objectiveId: string, userId: string)` → same rename, `memberApi.removeMember(objectiveId, employeeId)`.
- `transferObjectiveHead(objectiveId: string, newHeadUserId: string)` → `transferObjectiveHead(objectiveId: string, newHeadEmployeeId: string)`, `memberApi.transferHead(objectiveId, newHeadEmployeeId)`.

Everything else in Task 3 (`loadMyInvitations`/`acceptInvitation`/`rejectInvitation` — none of these take a person id as a parameter) is unchanged.

---

## Task 5 (revised): `objective-members-popup` component

Apply the rename throughout the spec fixtures, template, and class:

- Test fixtures: `{ userId: 'head1', ... }` → `{ employeeId: 'head1', ... }` (keep the same string values — only the property key changes) for all three fixture rows; every `r.dataset.userId === '...'` → `r.dataset.employeeId === '...'`; the `removeRequested` assertion `toHaveBeenCalledWith('mem1')` is unchanged (the value was never `userId`-shaped, just a bare id string).
- Template: `[attr.data-user-id]="member.userId"` → `[attr.data-employee-id]="member.employeeId"`; `[userName]="member.userId"` → `[userName]="member.employeeId"`; `{{ member.userId }}` → `{{ member.employeeId }}` (both occurrences); `removeRequested.emit(member.userId)` / `transferRequested.emit(member.userId)` (3 occurrences total across the active-member row, the leader-transfer button, and the pending-invite cancel row) → `.emit(member.employeeId)`.
- Class: `removeRequested = output<string>();` / `transferRequested = output<string>();` — no signature change, only what's emitted at the call site changes.
- Update the task's own **Interfaces** line: outputs are `addRequested(employeeId: string)`, `removeRequested(employeeId: string)`, `transferRequested(employeeId: string)`.

**Also resolve the "renders raw GUIDs" note left in Task 5's original Step 3** — now that Task 7 (below) supplies a real picker with names, cross-check whether the backend's `GetObjectiveMembers` response (backend Task 6) includes a resolved display name per member (it should, following the same `ObjectiveMapper`/`ResolveDisplayNamesByEmployeeIdAsync` pattern the backend's Task 21 established for `GetObjectiveById`) — if `ObjectiveMemberItemDto` gains a `name: string` field on the backend side, add it here too and render `{{ member.name }}` instead of the raw `employeeId`. Confirm this against the actual backend response shape before implementing, not from this plan's assumption.

---

## Task 6 (revised): Wire the popup into `ProjectDetailComponent`

Rename every `userId: string` parameter to `employeeId: string`: `onAddMemberRequested(employeeId: string)`, `onRemoveMemberRequested(employeeId: string)`, `onTransferRequested(employeeId: string)`, and their store calls (`this.store.addObjectiveMember(milestone.objectiveId, employeeId)`, etc.). Test fixtures `'u9'` can stay as literal strings (e.g. rename to `'e9'` for clarity, not required) — only the parameter names and the `storeStub` method call assertions' variable meaning change, the string literal values themselves are arbitrary either way.

The **"Known gap, deliberately not fixed"** note is now resolved by Task 7 below — `addRequested` gains a real `employeeId` payload once Task 7's picker is wired into Task 5's popup, so update `onAddMemberRequested`'s doc note to point at Task 7 as "done", not "pending."

---

## Task 7 (revised, no longer blocked): People-picker for Add Member / leader assignment

**Files:**
- Create: `src/app/modules/work/ui/employee-picker/employee-picker.component.ts`
- Create: `src/app/modules/work/ui/employee-picker/employee-picker.component.spec.ts`
- Modify: `src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.ts` (Task 5, revised above) — wire the picker in for both "+ Add member" and "Make leader"
- Modify: `src/app/modules/work/ui/objective-members-popup/objective-members-popup.component.spec.ts`

**Interfaces:**
- Consumes: `PeopleApiService.listEmployees(params: EmployeeListParams)` (`src/app/modules/people/data-access/people-api.service.ts` — read-only, per this plan's scope guardrail; never modify anything under `modules/people`), `EmployeeListItemResponse` (`id`, `fullName`, `email`, `departmentName`, `legalEntityId`, `legalEntityName`).
- Produces: `EmployeePickerComponent` with `open` input and `selected(employeeId: string)`/`closed` outputs — a small search-and-pick modal, no member-management knowledge of its own (mirrors `ObjectiveMembersPopupComponent`'s existing separation-of-concerns note: this component's only job is "search employees, emit the chosen one's id").

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/modules/work/ui/employee-picker/employee-picker.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeePickerComponent } from './employee-picker.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service'; // confirm exact path/export name by reading the file first
import { EmployeeListItemResponse } from '../../../people/models/employee.model';

describe('EmployeePickerComponent', () => {
  let fixture: ComponentFixture<EmployeePickerComponent>;
  let peopleApi: { listEmployees: ReturnType<typeof vi.fn> };

  const employees: EmployeeListItemResponse[] = [
    { id: 'e1', employeeNumber: 'EMP001', fullName: 'Asha Rao', email: 'asha@acme.test', departmentId: null, departmentName: 'Engineering', positionId: null, positionName: null, legalEntityId: 'le1', legalEntityName: 'Acme Inc', employmentTypeLabel: 'Full-time', status: 'active', reportingManagerId: null, reportingManagerName: null }
  ];

  beforeEach(async () => {
    peopleApi = { listEmployees: vi.fn().mockReturnValue(of({ items: employees, totalCount: 1, page: 1, pageSize: 20 })) };
    await TestBed.configureTestingModule({
      imports: [EmployeePickerComponent],
      providers: [{ provide: PeopleApiService, useValue: peopleApi }]
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeePickerComponent);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  it('loads and renders employees on open', () => {
    expect(peopleApi.listEmployees).toHaveBeenCalled();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="employee-picker-row"]');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Asha Rao');
  });

  it('re-queries with the search term when typed', () => {
    const input = fixture.nativeElement.querySelector('[data-testid="employee-picker-search"]') as HTMLInputElement;
    input.value = 'asha';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(peopleApi.listEmployees).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'asha' }));
  });

  it('emits selected with the employee id when a row is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.selected.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="employee-picker-row"]') as HTMLElement).click();

    expect(spy).toHaveBeenCalledWith('e1');
  });

  it('emits closed when the close control is activated', () => {
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-testid="employee-picker-close"]') as HTMLElement).click();

    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command scoped to this spec file.
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Read `PeopleApiService` and `ModalComponent` before implementing**

Confirm `PeopleApiService`'s injection token/class name and `listEmployees`'s exact signature/return shape by reading `src/app/modules/people/data-access/people-api.service.ts` directly — do not assume the import path above is exact, it wasn't verified against the live file in this session (only `employee.model.ts` was read directly; the service file's path is inferred from this module's established `data-access/` convention, confirm before writing the real import).

- [ ] **Step 4: Implement the component**

```typescript
// src/app/modules/work/ui/employee-picker/employee-picker.component.ts
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../../people/models/employee.model';

@Component({
  selector: 'app-employee-picker',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open()" title="Choose a person" (closed)="onClose()">
      <input
        data-testid="employee-picker-search"
        type="text"
        placeholder="Search by name or email"
        class="mb-2 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]"
        (input)="onSearchInput($event)"
      />
      <div class="flex max-h-64 flex-col gap-1 overflow-y-auto">
        @for (employee of results(); track employee.id) {
          <button
            type="button"
            data-testid="employee-picker-row"
            class="flex flex-col items-start rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--color-surface-secondary)]"
            (click)="selected.emit(employee.id)"
          >
            <span class="font-medium text-[var(--color-text-primary)]">{{ employee.fullName }}</span>
            <span class="text-[10px] text-[var(--color-text-secondary)]">{{ employee.email }} · {{ employee.departmentName }}</span>
          </button>
        }
      </div>
      <span data-testid="employee-picker-close" (click)="onClose()"></span>
    </app-modal>
  `
})
export class EmployeePickerComponent {
  private readonly peopleApi = inject(PeopleApiService);

  open = input(false);
  selected = output<string>();
  closed = output<void>();

  results = signal<EmployeeListItemResponse[]>([]);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.query('');
      }
    });
  }

  onSearchInput(event: Event): void {
    this.query((event.target as HTMLInputElement).value);
  }

  onClose(): void {
    this.closed.emit();
  }

  private query(search: string): void {
    this.peopleApi.listEmployees({ search, page: 1, pageSize: 20 }).subscribe((page) => {
      this.results.set(page.items);
    });
  }
}
```

(Confirm `listEmployees`'s actual return shape — `{ items, totalCount, page, pageSize }` per `EmployeeListPageResponse` in `employee.model.ts` already read this session — matches what `.subscribe((page) => ...)` above expects; adjust if the live service wraps it differently, e.g. an interceptor unwrapping to a bare array.)

- [ ] **Step 5: Run tests to verify they pass**

Run the same command as Step 2.
Expected: all 4 tests PASS.

- [ ] **Step 6: Wire the picker into `ObjectiveMembersPopupComponent` (Task 5, revised)**

Add `EmployeePickerComponent` to the popup's `imports`, add a local `pickerOpen = signal<'member' | 'leader' | null>(null)` and:

```typescript
// Replace the "+ Add member" button's (pressed) handler:
            <app-button variant="secondary" size="sm" (pressed)="pickerOpen.set('member')">+ Add member</app-button>
// Replace the "Make leader" button's (pressed) handler:
                    <app-button variant="secondary" size="sm" (pressed)="pickerOpen.set('leader')">Make leader</app-button>
```

Add near the end of the template, alongside the existing `</app-modal>`:

```html
<app-employee-picker
  [open]="pickerOpen() !== null"
  (selected)="onEmployeePicked($event)"
  (closed)="pickerOpen.set(null)"
/>
```

```typescript
  onEmployeePicked(employeeId: string): void {
    const mode = this.pickerOpen();
    this.pickerOpen.set(null);
    if (mode === 'member') this.addRequested.emit(employeeId);
    else if (mode === 'leader') this.transferRequested.emit(employeeId);
  }
```

`addRequested`'s output type changes from `output<void>()` to `output<string>()` (it was already documented as taking an eventual `employeeId` per Task 5's original interface note — this is that eventual payload arriving). Update `ProjectDetailComponent`'s template (Task 6, revised) binding from `(addRequested)="onAddMemberRequested($event)"` — already written that way in Task 6, no further change needed there, it was already anticipating this.

- [ ] **Step 7: Update the popup's own spec for the new wiring**

Add tests to `objective-members-popup.component.spec.ts` asserting: clicking "+ Add member" opens the picker (`app-employee-picker`'s `open` input becomes `true`), the picker's `selected` event with mode `'member'` re-emits as the popup's own `addRequested` with that `employeeId`, and the same for `'leader'` → `transferRequested`. Stub `PeopleApiService` in this spec's `TestBed` providers the same way Task 7 Step 1 above does, since the popup now transitively depends on it via `EmployeePickerComponent`.

- [ ] **Step 8: Run all affected specs**

Run the test command scoped to `employee-picker.component.spec.ts` and `objective-members-popup.component.spec.ts`.
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/modules/work/ui/employee-picker/ src/app/modules/work/ui/objective-members-popup/
git commit -m "feat(work): add employee-picker and wire it into the members popup - Task 7 unblocked by the EmployeeId identity rework"
```

---

## Task 8 (revised): My Invitations panel

Rename `ObjectiveInvitationDto`'s test fixture field `invitedUserId: 'u1'` → `invitedEmployeeId: 'u1'` (Task 8 Step 1's fixture) — nothing else in Task 8 references a person id directly (the panel only ever renders `invitation.inviteType`/`invitation.id`), so no further change needed there.

---

## Final check before handoff

- [ ] Run the project's full test command (unscoped) — expect 0 new failures beyond any pre-existing failures already noted as out-of-scope in prior sessions (per project memory: pre-existing failures in `organization/`, `layouts/main-layout`, `public/` are not this plan's responsibility).
- [ ] Run the project's type-check/build command — expect 0 new errors.
- [ ] Confirm no file outside `src/app/modules/work/**` was touched, except the read-only `PeopleApiService`/`EmployeeListItemResponse` imports (imports only, no edits to `modules/people/**` itself).
- [ ] **Phase 2 only:** `grep -rn "\.userId\b" src/app/modules/work` scoped to this feature's own new files (DTOs, `objective-member-api.service.ts`, the members popup, employee picker, store methods added by Task 3) — expect 0 matches; any hit means a Task 1–8 rename was missed.
- [ ] **Phase 2 only:** confirm the backend plan (Tasks 13–25) has shipped or is shipping alongside this frontend work — every endpoint this plan calls now expects `employeeId`, not `userId`; deploying this frontend against an un-migrated backend will break every add/remove/transfer/invite action.
