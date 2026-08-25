# Part 1: Convert `my-task` to a project-level tab; remove the separate `list` stub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `my-task` out from under `milestones/:milestoneId` to sit alongside `board`/`backlog`/
`calendar`/`settings` as a project-level route, exactly like those 4 were each converted before. Remove
the separate `list` stub tab (merged into My Task's internal view toggle per the approved design — Part 5
builds that toggle).

**Spec:** `docs/superpowers/specs/next/2026-08-25-work-management-task-time-tracking-and-my-task-design.md`
§2

**Depends on:** none — this Part only touches routing scaffolding, no new components yet. `my-task` will
point at a placeholder component until Part 5 replaces it.

## Architecture & Conventions

- **Precedent commit: `f74e9d5 feat: move board and backlog to project scope`.** Every prior conversion
  (Board, Backlog, Calendar) followed this exact same 3-file change shape
  (`work.routes.ts`/`milestone-sub-menu.component.ts`/their two spec files) — run `git show f74e9d5` and
  compare its diff shape against what you're about to do here before writing anything, to catch any detail
  this plan's text description missed.
- This codebase's existing tests (`work.routes.spec.ts`, `milestone-sub-menu.component.spec.ts`) are
  reproduced in full below with their current failing/passing lines called out explicitly — do not guess
  at what changes, the exact diffs are given.

## Global Constraints

- No standalone `list` route anywhere after this Part — grep the whole `src/app/modules/work/` tree for the
  literal string `'list'` after finishing and confirm no route/tab config still references it.

---

### Task 1: Move `my-task` to a project-level route in `work.routes.ts`

**Files:**
- Modify: `src/app/modules/work/work.routes.ts`

**Interfaces:**
- Produces: `WORK_ROUTES` with `my-task` as a sibling of `board`/`backlog`/`calendar`/`settings` under
  `:id`, pointing at a placeholder (`MilestoneComingSoonTabComponent`) until Part 5 replaces it with
  `MyTaskComponent`.

- [ ] **Step 1: Remove the two milestone-scoped children, add one project-level sibling**

Remove lines 30–40 (the `my-task` and `list` children under `milestones/:milestoneId`):

```typescript
          {
            path: 'my-task',
            loadComponent: () =>
              import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent),
            data: { title: 'My Task' }
          },
          {
            path: 'list',
            loadComponent: () =>
              import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent),
            data: { title: 'List' }
          },
```

Add a new sibling route under `:id`'s `children`, next to `board` (before or after it, matching the tab
order `Tree/Board/Backlog/My Task/Approvals/Calendar/Settings` from the sub-menu — place it right after
`backlog`):

```typescript
      {
        path: 'my-task',
        loadComponent: () =>
          import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent)
      },
```

(This still points at the coming-soon placeholder for now — Part 5 changes this one line's import to
`MyTaskComponent` once that component exists. Keeping it as a placeholder here means this Part's own tests
pass in isolation without depending on Part 5 having run first.)

- [ ] **Step 2: Update `work.routes.spec.ts`**

Three of its four existing tests need changes (the file was fully read during planning — reproduced with
exact before/after below):

Change (test 2, `'nests the milestone Tree and remaining milestone tabs under :id'`):
```typescript
    expect(milestoneRoute.children!.map((route) => route.path)).toEqual(['', 'tree', 'approvals', 'my-task', 'list']);
```
to:
```typescript
    expect(milestoneRoute.children!.map((route) => route.path)).toEqual(['', 'tree', 'approvals']);
```

Change (test 3, `'registers Board, Backlog, Calendar, and Settings as project-level siblings'`) — rename the
test to include My Task, and update both assertions:
```typescript
  it('registers Board, Backlog, My Task, Calendar, and Settings as project-level siblings', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    expect(idRoute.children!.map((route) => route.path)).toEqual(['milestones/:milestoneId', 'board', 'backlog', 'my-task', 'calendar', 'settings']);
    expect(idRoute.children!.find((r) => r.path === 'board')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'backlog')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'my-task')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'calendar')!.loadComponent).toBeTruthy();
    expect(idRoute.children!.find((r) => r.path === 'settings')!.loadComponent).toBeTruthy();
  });
```

Change (test 4, `'tags remaining milestone stub routes with titles in route data'`) — `my-task` and `list`
no longer exist under the milestone route, only `approvals` remains a "remaining stub" (it's not a stub,
it's implemented, but stays milestone-scoped per this design — check that assumption against the current
route config; if `approvals` also has no `data.title` tag, simplify this test to just confirm it has
`loadComponent` and drop the `title`-tagging assertions entirely since nothing milestone-scoped is a titled
stub anymore):

```typescript
  it('has no remaining milestone-scoped stub routes', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    expect(milestoneRoute.children!.map((r) => r.path)).toEqual(['', 'tree', 'approvals']);
    expect(milestoneRoute.children!.find((r) => r.path === 'approvals')!.loadComponent).toBeTruthy();
  });
```

- [ ] **Step 3: Run the frontend test suite for this file**

Run: `npm test -- --include='**/work.routes.spec.ts'` (confirm the actual test-runner invocation syntax
this repo uses — check `package.json`'s `test` script or a recent CI log rather than assuming Karma/Jest
flags blind).
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/modules/work/work.routes.ts src/app/modules/work/work.routes.spec.ts
git commit -m "feat(work): move my-task to a project-level route, remove the standalone list route"
```

---

### Task 2: Update `milestone-sub-menu.component.ts` — My Task becomes project-level, List tab removed

**Files:**
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts`
- Modify: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts`

**Interfaces:**
- Produces: `BASE_TABS` with 6 entries (`Tree, Board, Backlog, My Task, Approvals, Calendar`), `My Task`
  carrying `projectLevel: true`.

- [ ] **Step 1: Edit `BASE_TABS`**

Change:
```typescript
const BASE_TABS: SubMenuTab[] = [
  { label: 'Tree', segment: 'tree' },
  { label: 'Board', segment: 'board', projectLevel: true },
  { label: 'Backlog', segment: 'backlog', projectLevel: true },
  { label: 'My Task', segment: 'my-task' },
  { label: 'List', segment: 'list' },
  { label: 'Approvals', segment: 'approvals' },
    { label: 'Calendar', segment: 'calendar', projectLevel: true }

];
```
to:
```typescript
const BASE_TABS: SubMenuTab[] = [
  { label: 'Tree', segment: 'tree' },
  { label: 'Board', segment: 'board', projectLevel: true },
  { label: 'Backlog', segment: 'backlog', projectLevel: true },
  { label: 'My Task', segment: 'my-task', projectLevel: true },
  { label: 'Approvals', segment: 'approvals' },
  { label: 'Calendar', segment: 'calendar', projectLevel: true }
];
```

(This also cleans up the pre-existing stray indentation/blank-line around the `Calendar` entry — matching
the rest of the array's consistent 2-space formatting is a natural side effect of this edit, not a
separate unrelated reformatting pass.)

- [ ] **Step 2: Remove the now-dead `@case ('list')` icon block**

In the template's `@switch (tab.segment)`, delete:
```typescript
                @case ('list') {
                  <circle cx="4.5" cy="6" r="1" />
                  <circle cx="4.5" cy="12" r="1" />
                  <circle cx="4.5" cy="18" r="1" />
                  <path d="M9 6h11M9 12h11M9 18h11" />
                }
```

- [ ] **Step 3: Update the 4 spec assertions that hardcode tab counts/labels/hrefs**

```typescript
  it('renders all six base tabs in order for non-owners', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el) => (el as HTMLElement).textContent?.trim() ?? '');
    expect(labels).toEqual(['Tree', 'Board', 'Backlog', 'My Task', 'Approvals', 'Calendar']);
  });

  it('includes Settings tab for owners', () => {
    fixture.componentRef.setInput('isOwner', true);
    fixture.detectChanges();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el) => (el as HTMLElement).textContent?.trim() ?? '');
    expect(labels).toEqual(['Tree', 'Board', 'Backlog', 'My Task', 'Approvals', 'Calendar', 'Settings']);
  });

  it('renders an icon inside every tab link', () => {
    const icons = fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"] svg');
    expect(icons.length).toBe(6);
  });

  it('builds the correct link target for each tab', () => {
    const hrefs = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el: any) => el.getAttribute('href'));
    expect(hrefs).toEqual([
      '/milestones/o1/tree',
      '/board',
      '/backlog',
      '/my-task',
      '/milestones/o1/approvals',
      '/calendar'
    ]);
  });
```

(The last test's `'/my-task'` — no `milestoneId` segment, no leading `/milestones/o1` — is the whole point
of `projectLevel: true`; double check this against how `'/board'`/`'/backlog'` already render in the
current passing test, since `my-task` must match that exact shape now.)

- [ ] **Step 4: Run the tests**

Run: `npm test -- --include='**/milestone-sub-menu.component.spec.ts'`
Expected: PASS, all 5 tests (the `'links Settings to the project-level route'` test is untouched and
should still pass unmodified).

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts
git commit -m "feat(work): make My Task a project-level sub-menu tab, remove the List tab"
```

---

## Self-review checklist for this Part

- [ ] `grep -rn "'list'" src/app/modules/work/` returns zero route/tab-config matches (test files
  referencing `'list'` inside an unrelated string, if any, are fine — only route/tab config matters).
- [ ] `my-task`'s route still points at `MilestoneComingSoonTabComponent` after this Part — Part 5 is what
  changes that import, not this Part.
- [ ] No other file in the repo still imports `MilestoneComingSoonTabComponent` for a route this Part just
  removed (`list`) — if `git grep -n "milestone-coming-soon-tab"` shows any leftover reference to a route
  path that no longer exists, that's a bug introduced by this Part, fix it before committing Task 2.
