# Work Management — Employee Directory Service (Part 6 of 8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **No backend dependency — can run in parallel with the backend repo's Part 5.**

**Goal:** One cached service that resolves employee IDs to display name + avatar (falling back to
initials), replacing every place in Work Management that currently shows a raw employee ID or hits
`PeopleApiService` directly and repeatedly.

**Architecture:** A `signalStore`-backed cache keyed by employee ID, wrapping the existing
`PeopleApiService.getEmployee(id)` (confirmed present: `GET /api/v1/employees/{id}`, returns
`EmployeeListItemResponse` with `fullName` — confirmed **no avatar field exists on this response
today**, on this branch). Every consumer asks this one service; nothing else calls `PeopleApiService`
for employee display data directly.

**Tech Stack:** Angular (standalone components, signals, `@ngrx/signals`).

**Spec:** `HRMS-Backend-v1/docs/superpowers/specs/next/2026-08-17-work-management-sprint-ux-v2-design.md`

## Global Constraints

- Work Management module only — this service lives in `src/app/modules/work/`, even though it calls
  a People-module endpoint (calling an existing read endpoint from another module is fine; do not
  modify anything under `src/app/modules/people/`).
- **Confirmed fact, not an assumption**: `EmployeeListItemResponse` has no avatar field on this branch
  today. Build the fallback-to-initials path as the real, expected path for now — not a rare edge
  case — and design the DTO/model so adding a real avatar URL later is a one-line addition, not a
  restructure.
- Never render a raw GUID as a fallback anywhere this service's output is used.

---

### Task 1: `EmployeeDirectoryStore`

**Files:**
- Create: `src/app/modules/work/models/employee-summary.model.ts`
- Create: `src/app/modules/work/state/employee-directory.store.ts`
- Create: `src/app/modules/work/state/employee-directory.store.spec.ts`

**Interfaces:**
- Produces:
  ```typescript
  interface EmployeeSummary { id: string; name: string; initials: string; avatarUrl: string | null; }
  ```
  and a store with `get(employeeId: string): EmployeeSummary | undefined` (signal read, synchronous,
  cache-only), `ensureLoaded(employeeIds: readonly string[]): Promise<void>` (fetches any IDs not
  already cached, in parallel, then populates the cache) — consumed by every Task 2/3 component below.

- [ ] **Step 1: Write the model**

```typescript
// models/employee-summary.model.ts
export interface EmployeeSummary {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
}

export function buildInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}
```

- [ ] **Step 2: Write the failing test**

```typescript
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EmployeeDirectoryStore } from './employee-directory.store';
import { PeopleApiService } from '../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../people/models/employee.model';

describe('EmployeeDirectoryStore', () => {
  let store: InstanceType<typeof EmployeeDirectoryStore>;
  let peopleApi: jasmine.SpyObj<PeopleApiService>;

  const employee: EmployeeListItemResponse = {
    id: 'emp-1', employeeNumber: 'E1', fullName: 'Nevi Peiris', email: 'nevi@dapi.test',
    departmentId: null, departmentName: null, positionId: null, positionName: null,
    legalEntityId: null, legalEntityName: null, employmentTypeLabel: 'Full-time', status: 'active',
    reportingManagerId: null, reportingManagerName: null
  };

  beforeEach(() => {
    peopleApi = jasmine.createSpyObj('PeopleApiService', ['getEmployee']);
    peopleApi.getEmployee.and.returnValue(of(employee));
    TestBed.configureTestingModule({ providers: [{ provide: PeopleApiService, useValue: peopleApi }] });
    store = TestBed.inject(EmployeeDirectoryStore);
  });

  it('ensureLoaded fetches an uncached id and get() returns it with initials computed', async () => {
    await store.ensureLoaded(['emp-1']);

    const summary = store.get('emp-1');
    expect(summary?.name).toBe('Nevi Peiris');
    expect(summary?.initials).toBe('NP');
    expect(summary?.avatarUrl).toBeNull();
  });

  it('ensureLoaded does not re-fetch an already-cached id', async () => {
    await store.ensureLoaded(['emp-1']);
    await store.ensureLoaded(['emp-1']);

    expect(peopleApi.getEmployee).toHaveBeenCalledTimes(1);
  });

  it('get() returns undefined for an id never loaded', () => {
    expect(store.get('never-loaded')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/employee-directory.store.spec.ts'`
Expected: FAIL — `EmployeeDirectoryStore` doesn't exist.

- [ ] **Step 4: Implement the store**

```typescript
import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PeopleApiService } from '../../people/data-access/people-api.service';
import { EmployeeSummary, buildInitials } from '../models/employee-summary.model';

interface EmployeeDirectoryState {
  readonly byId: Readonly<Record<string, EmployeeSummary>>;
}

const initialState: EmployeeDirectoryState = { byId: {} };

export const EmployeeDirectoryStore = signalStore(
  { providedIn: 'root' },
  withState<EmployeeDirectoryState>(initialState),
  withMethods((store, peopleApi = inject(PeopleApiService)) => ({
    get(employeeId: string): EmployeeSummary | undefined {
      return store.byId()[employeeId];
    },

    async ensureLoaded(employeeIds: readonly string[]): Promise<void> {
      const cached = store.byId();
      const missing = [...new Set(employeeIds)].filter((id) => !cached[id]);
      if (missing.length === 0) return;

      const fetched = await Promise.all(
        missing.map((id) => firstValueFrom(peopleApi.getEmployee(id)).catch(() => null))
      );

      const additions: Record<string, EmployeeSummary> = {};
      fetched.forEach((employee, index) => {
        if (!employee) return;
        additions[missing[index]!] = {
          id: employee.id,
          name: employee.fullName,
          initials: buildInitials(employee.fullName),
          avatarUrl: null // no avatar field on EmployeeListItemResponse today - see plan's Global Constraints
        };
      });

      patchState(store, { byId: { ...store.byId(), ...additions } });
    }
  }))
);
```

- [ ] **Step 5: Run to verify all pass**

Run: `npx ng test --watch=false --include='**/employee-directory.store.spec.ts'`
Expected: PASS (all 3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/models/employee-summary.model.ts src/app/modules/work/state/employee-directory.store.ts src/app/modules/work/state/employee-directory.store.spec.ts
git commit -m "feat(work): EmployeeDirectoryStore - cached name/initials/avatar lookup by employee id"
```

---

### Task 2: `EmployeeAvatarComponent`

**Files:**
- Create: `src/app/modules/work/ui/employee-avatar/employee-avatar.component.ts`
- Create: `src/app/modules/work/ui/employee-avatar/employee-avatar.component.spec.ts`

**Interfaces:**
- Produces: `EmployeeAvatarComponent { employeeId: input.required<string>() }` — self-contained
  (calls `EmployeeDirectoryStore.ensureLoaded` itself on init, so consuming components don't each need
  to remember to). Renders an avatar image if `avatarUrl` is present, otherwise initials in a colored
  circle using existing theme tokens only. Shows the resolved name as a tooltip (`title` attribute).

- [ ] **Step 1: Write the failing test**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeeAvatarComponent } from './employee-avatar.component';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

describe('EmployeeAvatarComponent', () => {
  let fixture: ComponentFixture<EmployeeAvatarComponent>;
  let store: { get: jasmine.Spy; ensureLoaded: jasmine.Spy };

  beforeEach(async () => {
    store = { get: jasmine.createSpy().and.returnValue({ id: 'emp-1', name: 'Nevi Peiris', initials: 'NP', avatarUrl: null }), ensureLoaded: jasmine.createSpy().and.resolveTo(undefined) };
    await TestBed.configureTestingModule({
      imports: [EmployeeAvatarComponent],
      providers: [{ provide: EmployeeDirectoryStore, useValue: store }]
    }).compileComponents();
    fixture = TestBed.createComponent(EmployeeAvatarComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
  });

  it('calls ensureLoaded for the given employeeId on init', () => {
    expect(store.ensureLoaded).toHaveBeenCalledWith(['emp-1']);
  });

  it('renders initials when no avatarUrl is present', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('NP');
  });

  it('never renders the raw employeeId as text', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain('emp-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include='**/employee-avatar.component.spec.ts'`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

```typescript
import { Component, OnInit, computed, inject, input } from '@angular/core';
import { EmployeeDirectoryStore } from '../../state/employee-directory.store';

@Component({
  selector: 'app-employee-avatar',
  standalone: true,
  template: `
    <span class="employee-avatar" [attr.title]="summary()?.name ?? ''" [attr.aria-label]="summary()?.name ?? 'Unknown'">
      @if (summary()?.avatarUrl) {
        <img [src]="summary()!.avatarUrl" [alt]="summary()!.name" class="employee-avatar__img" />
      } @else {
        <span class="employee-avatar__initials">{{ summary()?.initials ?? '?' }}</span>
      }
    </span>
  `,
  styles: [`
    .employee-avatar { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 999px; overflow: hidden; background: var(--color-surface-secondary); color: var(--color-text-primary); font-size: 11px; font-weight: 600; flex-shrink: 0; }
    .employee-avatar__img { width: 100%; height: 100%; object-fit: cover; }
  `]
})
export class EmployeeAvatarComponent implements OnInit {
  private readonly directory = inject(EmployeeDirectoryStore);

  employeeId = input.required<string>();

  protected readonly summary = computed(() => this.directory.get(this.employeeId()));

  ngOnInit(): void {
    void this.directory.ensureLoaded([this.employeeId()]);
  }
}
```

- [ ] **Step 4: Run to verify all pass, then commit**

Run: `npx ng test --watch=false --include='**/employee-avatar.component.spec.ts'`
Expected: PASS.

```bash
git add src/app/modules/work/ui/employee-avatar/
git commit -m "feat(work): EmployeeAvatarComponent - avatar-or-initials, never a raw id"
```

---

### Task 3: Replace every raw-ID display in Work Management

**Files:**
- Modify: `src/app/modules/work/ui/task-create-modal/task-create-modal.component.ts` (assignee `<select>`)
- Modify: whatever component renders Work Management's own member list (find via
  `grep -rln "ObjectiveMemberListDto\|getMembers(" src/app/modules/work` — likely a member-management
  UI under `feature/` or `ui/`)
- Modify: `src/app/modules/work/feature/task-board/task-board.component.ts` and
  `task-backlog.component.ts` (`assignableMembers` — replace the raw `PeopleApiService`/"get all
  employees" call flagged as a known gap in Part 4 with `EmployeeDirectoryStore.ensureLoaded` + `get`)

**This task has no single code sample** — each site needs the same three-line change (call
`EmployeeAvatarComponent` for the avatar, call `EmployeeDirectoryStore.get(id)?.name ?? id` only as an
absolute last-resort text fallback, never render the bare id alone). Do each site as its own small
TDD cycle: write/extend that component's spec to assert the id string never appears as visible text
and a name does, run it to see it fail against the current ID-only rendering, fix, verify.

- [ ] **Step 1: Find every raw-ID display site**

Run: `grep -rn "employeeId\}\}" src/app/modules/work --include="*.ts" -l` and manually check each
result's template for `{{ ... employeeId }}` or similar direct interpolation of an ID into visible
text (not just used as a `[value]`/tracking key, which is fine).

- [ ] **Step 2-N: For each site found, write the failing test, fix, verify** — repeat the pattern from
  Task 2's tests (assert no bare ID string in `textContent`, assert a name or `EmployeeAvatarComponent`
  is present) for every site.

- [ ] **Final step: Full frontend regression**

Run: `npx ng test --watch=false`
Expected: all PASS.

- [ ] **Commit** (one commit per site is fine, or batch if they're trivially small — use judgment,
  each commit message should name the specific component fixed):

```bash
git add -A
git commit -m "fix(work): replace raw employee-id display with resolved name + avatar across Work Management"
```

---

## End of Part 6

Part 6 done when `npx ng test --watch=false` is green and no Work Management template interpolates a
raw employee ID as visible text anywhere. Feeds Part 7 (task-detail popup's assignee display, Board
Structure's nothing employee-related) and Part 8 (Backlog v2's sprint/task cards, if they show
assignees).
