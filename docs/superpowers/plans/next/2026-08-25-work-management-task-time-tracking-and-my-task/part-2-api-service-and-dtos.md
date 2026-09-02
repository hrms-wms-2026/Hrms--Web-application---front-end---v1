# Part 2: `TaskApiService` additions and DTO extensions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add every new HTTP method the backend plan's Parts 6–8 introduced, and extend
`EditTaskRequestDto`/`CreateTaskEditRequestDto` with `progressPercent`/`reason`. No UI changes in this
Part — this is the data-access layer every later frontend Part consumes.

**Spec:** `docs/superpowers/specs/next/2026-08-25-work-management-task-time-tracking-and-my-task-design.md`
§3

**Depends on:** the backend plan's Parts 2, 6, 7, 8 must be deployed (or at minimum merged/available) before
this Part's new HTTP calls will succeed against a real backend — but this Part's own unit tests (mocking
`HttpClient`) do not require the real backend running, so implementation can proceed in parallel.

## Architecture & Conventions

- Every method in `TaskApiService` is a one-line `this.http.<verb><T>(url, ...)` wrapper — no method in
  this file has any logic beyond building the URL and (for POST/PATCH) the body object. Match that exactly;
  do not add try/catch or transformation logic here (that belongs in the calling component/store, see
  `task-detail-modal.component.ts`'s existing `submit()` for where error handling already lives).
- New DTOs go in `models/dto/task.dto.ts` and `models/dto/task-history.dto.ts` (new file for the 4
  history-entry shapes — keep them out of `task.dto.ts` to avoid that file growing unfocused, matching this
  module's existing pattern of one dto file per feature area, e.g. `task-category.dto.ts`,
  `task-edit-request.dto.ts`).
- Field naming in DTOs is camelCase, mirroring the backend's JSON output exactly (ASP.NET's default
  camelCase serialization) — `progressPercent`, `clockingSessionId`, `pushedPercent`, etc.

## Global Constraints

- No method added in this Part is called by anything yet — `dotnet`... no wait, this is the frontend repo:
  `ng build` (or this repo's actual build command — check `package.json`) must succeed with zero new
  unused-import warnings, since every new DTO/method is exported and will show as used once Parts 3–6
  consume them, but an unused import inside this Part's own new files would still be a real problem.

---

### Task 1: New DTOs

**Files:**
- Modify: `src/app/modules/work/models/dto/task.dto.ts`
- Create: `src/app/modules/work/models/dto/task-history.dto.ts`

**Interfaces:**
- Produces: `EditTaskRequestDto`/`CreateTaskEditRequestDto` gain `progressPercent?: number` and
  `reason?: string`. New `PushTaskRequestDto`, `AddReasonRequestDto`,
  `TaskHistoryEntryDto` (+ 4 nested detail-shape interfaces).

- [ ] **Step 1: Extend the two existing request DTOs**

In `task.dto.ts`:

```typescript
export interface EditTaskRequestDto {
  title: string;
  description?: string;
  priority: WorkTaskDto['priority'];
  dueDate?: string;
  estimatedHours?: number;
  storyPoints?: number;
  progressPercent?: number;
  reason?: string;
}
```

Find `CreateTaskEditRequestDto` in `task-edit-request.dto.ts` (not `task.dto.ts` — check that file, it was
listed as a separate import in `task-api.service.ts`) and apply the same two-field addition to it.

- [ ] **Step 2: Write the new `PushTaskRequestDto`/`AddReasonRequestDto` (in `task.dto.ts`)**

```typescript
export interface PushTaskRequestDto {
  percent: number;
  reason?: string;
}

export interface AddReasonRequestDto {
  reason: string;
}
```

- [ ] **Step 3: Write `task-history.dto.ts`**

```typescript
export interface TaskEditEntryDetailsDto {
  logId: string;
  source: 'direct' | 'approved_request';
  editRequestId: string | null;
  oldValuesJson: string;
  newValuesJson: string;
  reason: string | null;
}

export interface TaskStatusChangeEntryDetailsDto {
  fromStatusId: string;
  toStatusId: string;
}

export interface TaskClockSessionEntryDetailsDto {
  sessionId: string;
  clockInAt: string;
  clockOutAt: string | null;
  durationMinutes: number | null;
  sessionReason: string | null;
  pushedPercent: number | null;
  previousPercent: number | null;
  percentageLogId: string | null;
  percentageReason: string | null;
}

export interface TaskPercentageChangeEntryDetailsDto {
  logId: string;
  previousPercent: number;
  newPercent: number;
  source: 'push' | 'manual_edit' | 'status_change';
  reason: string | null;
}

export interface TaskHistoryEntryDto {
  type: 'edit' | 'status_change' | 'clock_session' | 'percentage_change';
  occurredAt: string;
  employeeId: string;
  employeeName: string;
  edit: TaskEditEntryDetailsDto | null;
  statusChange: TaskStatusChangeEntryDetailsDto | null;
  clockSession: TaskClockSessionEntryDetailsDto | null;
  percentageChange: TaskPercentageChangeEntryDetailsDto | null;
}
```

- [ ] **Step 4: Build to confirm the new file compiles and existing imports still resolve**

Run: `ng build` (check `package.json` for the exact build script name first).
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/models/dto/task.dto.ts src/app/modules/work/models/dto/task-edit-request.dto.ts src/app/modules/work/models/dto/task-history.dto.ts
git commit -m "feat(work): add DTOs for task history, push, and reason-note requests"
```

---

### Task 2: `TaskApiService` new methods

**Files:**
- Modify: `src/app/modules/work/data-access/task-api.service.ts`
- Test: `src/app/modules/work/data-access/task-api.service.spec.ts` (existing file — add to it)

**Interfaces:**
- Produces: `getMyTasks(projectId, sprintId?)`, `getTaskHistory(taskId)`, `clockIn(taskId)`,
  `push(taskId, request)`, `addClockingSessionReason(sessionId, reason)`,
  `addPercentageLogReason(logId, reason)`.

- [ ] **Step 1: Write the failing tests**

Read `task-api.service.spec.ts` in full first and match its existing `HttpTestingController` setup exactly
(every existing test in that file follows the same "call the method, expect one request, flush a fixture
response" shape). Add:

```typescript
it('getMyTasks builds the my-tasks URL with an optional sprintId param', () => {
  service.getMyTasks('p1', 's1').subscribe();
  const req = httpMock.expectOne((r) => r.url === `${baseUrl}/projects/p1/my-tasks` && r.params.get('sprintId') === 's1');
  expect(req.request.method).toBe('GET');
  req.flush([]);
});

it('getMyTasks omits sprintId when not provided', () => {
  service.getMyTasks('p1').subscribe();
  const req = httpMock.expectOne(`${baseUrl}/projects/p1/my-tasks`);
  expect(req.request.method).toBe('GET');
  expect(req.request.params.has('sprintId')).toBe(false);
  req.flush([]);
});

it('getTaskHistory GETs the history endpoint', () => {
  service.getTaskHistory('t1').subscribe();
  const req = httpMock.expectOne(`${baseUrl}/tasks/t1/history`);
  expect(req.request.method).toBe('GET');
  req.flush([]);
});

it('clockIn POSTs with no body', () => {
  service.clockIn('t1').subscribe();
  const req = httpMock.expectOne(`${baseUrl}/tasks/t1/clock-in`);
  expect(req.request.method).toBe('POST');
  req.flush(null);
});

it('push POSTs percent and reason', () => {
  service.push('t1', { percent: 60, reason: 'made progress' }).subscribe();
  const req = httpMock.expectOne(`${baseUrl}/tasks/t1/push`);
  expect(req.request.method).toBe('POST');
  expect(req.request.body).toEqual({ percent: 60, reason: 'made progress' });
  req.flush({});
});

it('addClockingSessionReason PATCHes the reason', () => {
  service.addClockingSessionReason('s1', 'note').subscribe();
  const req = httpMock.expectOne(`${baseUrl}/clocking-sessions/s1/reason`);
  expect(req.request.method).toBe('PATCH');
  expect(req.request.body).toEqual({ reason: 'note' });
  req.flush(null);
});

it('addPercentageLogReason PATCHes the reason', () => {
  service.addPercentageLogReason('l1', 'note').subscribe();
  const req = httpMock.expectOne(`${baseUrl}/percentage-log/l1/reason`);
  expect(req.request.method).toBe('PATCH');
  expect(req.request.body).toEqual({ reason: 'note' });
  req.flush(null);
});
```

**Note:** `baseUrl` above assumes the existing spec file already has a `baseUrl` constant matching
`${environment.apiUrl}/work` — confirm this by reading the file; if the existing tests instead inline the
full URL string per-test, match that style rather than introducing a new constant.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- --include='**/task-api.service.spec.ts'`
Expected: FAIL — methods don't exist yet.

- [ ] **Step 3: Implement**

Add to `TaskApiService`, importing the new DTOs at the top:

```typescript
  getMyTasks(projectId: string, sprintId?: string): Observable<WorkTaskDto[]> {
    let params = new HttpParams();
    if (sprintId) params = params.set('sprintId', sprintId);
    return this.http.get<WorkTaskDto[]>(`${this.baseUrl}/projects/${projectId}/my-tasks`, { params });
  }

  getTaskHistory(taskId: string): Observable<TaskHistoryEntryDto[]> {
    return this.http.get<TaskHistoryEntryDto[]>(`${this.baseUrl}/tasks/${taskId}/history`);
  }

  clockIn(taskId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/tasks/${taskId}/clock-in`, {});
  }

  push(taskId: string, request: PushTaskRequestDto): Observable<WorkTaskDto> {
    return this.http.post<WorkTaskDto>(`${this.baseUrl}/tasks/${taskId}/push`, request);
  }

  addClockingSessionReason(sessionId: string, reason: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/clocking-sessions/${sessionId}/reason`, { reason });
  }

  addPercentageLogReason(logId: string, reason: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/percentage-log/${logId}/reason`, { reason });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --include='**/task-api.service.spec.ts'`
Expected: PASS, all tests including every pre-existing one in the file.

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/data-access/task-api.service.ts src/app/modules/work/data-access/task-api.service.spec.ts
git commit -m "feat(work): add TaskApiService methods for my-tasks, history, clock-in, push, and reason notes"
```

---

## Self-review checklist for this Part

- [ ] Every new DTO field name matches its backend counterpart's camelCase JSON name exactly (cross-check
  against the backend plan's Part 7 Task 1 DTOs and Part 8's `WorkTaskResponse` — a mismatch here fails
  silently at runtime, not at compile time, since these are plain interfaces with no runtime validation).
- [ ] `getMyTasks` omits the `sprintId` query param entirely (not `sprintId=undefined`) when not provided —
  confirmed by Task 2's second test.
- [ ] No component/store file changed in this Part — grep the diff for anything outside
  `data-access/`/`models/dto/` and confirm none.
