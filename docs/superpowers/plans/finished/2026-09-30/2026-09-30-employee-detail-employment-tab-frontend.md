# Employee Detail — Employment Tab & Work Network (Plan 1, frontend half)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the employee detail screen into a redesigned header + **Employment** and **Personal** tabs, and add a force-directed **Work Network** graph (employee → projects → modules → open tasks) fed by its own endpoint with independent loading/error/forbidden states.

**Architecture:** `EmployeeDetailComponent` keeps its page-level `/detail` load (header, actions, offboarding, position change) and delegates tab bodies to two new standalone components. The Employment tab owns its own `work-graph` fetch and renders it inside a reusable `WidgetCardComponent` (loading / empty / error / forbidden). The graph is a static `d3-force` layout (settled synchronously) rendered as Angular-owned SVG with hover-highlight, click-through and drag.

**Tech Stack:** Angular 21 (standalone, OnPush, signal inputs/outputs), Tailwind + CSS variables, `@ngrx/signals` (not needed here), RxJS, `d3-force` (new), Vitest via `@angular/build:unit-test`.

**Spec:** `docs/superpowers/specs/finished/2026-09-30/2026-09-30-employee-detail-redesign-design.md` (§4 decisions, §5 contract, §7 frontend). Backend half: `HRMS-Backend-v1/docs/superpowers/plans/finished/2026-09-30/2026-09-30-employee-detail-work-graph-backend.md` (must be deployed/running before Task 8's manual check; Tasks 1-7 run against mocks).

## Global Constraints

- Repo `Hrms--Web-application---front-end---v1`, branch `feature/task-subtasks`. Verify `git branch --show-current` and re-run `git status --short` right before every commit; other sessions share this tree — stage only the files listed in the task.
- **No git worktrees.**
- Test runner is **Vitest**: use `vi.fn()` / `vi.spyOn()`; `describe/it/expect/vi` are global in component specs (existing specs import nothing); utils specs import from `'vitest'`. Single-file run: `npx ng test --watch=false --include "<spec path>"`.
- Angular esbuild resolves lazy `loadComponent()` imports eagerly: create a placeholder file before any route references it (no new routes are added in this plan).
- Scoped component CSS never matches dynamically inserted DOM; everything here is template-declared, so scoped CSS is fine.
- Colors/spacing use the app's CSS variables (`var(--color-border)`, `var(--color-surface)`, `var(--color-surface-secondary)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-accent)`), matching existing components.
- New dependency: `d3-force@^3` (+ `@types/d3-force@^3` dev). No chart library.
- Existing `GET /employees/{id}/detail` and `/position-history` responses are consumed unchanged.
- Task nodes navigate to the project board (`/work/:projectId/board`) — no task deep-link route exists. Module nodes → `/work/:projectId/milestones/:objectiveId/tree`. Project nodes → `/work/:projectId/board`.
- Payroll visibility stays driven by the response's `payroll` field (`employees:read:sensitive` is enforced server-side); offboarding menu stays gated on `employees:offboard`, position change on `employees:write` — do not change these conditions.
- Commit messages end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`

---

### Task 1: Work-graph model + API method

**Files:**
- Create: `src/app/modules/people/models/work-graph.model.ts`
- Modify: `src/app/modules/people/data-access/people-api.service.ts`
- Modify (test): `src/app/modules/people/data-access/people-api.service.spec.ts`

**Interfaces:**
- Produces: `WorkGraphNode`, `WorkGraphLink`, `EmployeeWorkGraphResponse` (+ `WorkGraphNodeKind`, `WorkGraphModuleRole`, `WorkGraphTaskStatus`, `WorkGraphLinkKind`) and `PeopleApiService.getWorkGraph(employeeId: string): Observable<EmployeeWorkGraphResponse>` — consumed by Tasks 2, 4, 6.

- [ ] **Step 1: Write the failing test**

Add inside the top-level `describe('PeopleApiService', …)` in `people-api.service.spec.ts` (next to the other `it(...)` blocks; `service` and `httpMock` already exist there):

```ts
  it('getWorkGraph GETs /employees/{id}/work-graph', () => {
    const response = { nodes: [], links: [], hiddenTaskCount: 0 };
    let received: unknown;

    service.getWorkGraph('emp-1').subscribe((r) => (received = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/work-graph`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
    expect(received).toEqual(response);
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: FAIL — `service.getWorkGraph is not a function` (or a compile error for the missing method).

- [ ] **Step 3: Add the model**

`src/app/modules/people/models/work-graph.model.ts`:

```ts
export type WorkGraphNodeKind = 'employee' | 'project' | 'module' | 'task';
export type WorkGraphModuleRole = 'owner' | 'member' | 'contributor';
export type WorkGraphTaskStatus = 'not_started' | 'active';
export type WorkGraphLinkKind = 'works_on' | 'contains' | 'owns' | 'member_of' | 'has_task';

export interface WorkGraphNode {
  readonly id: string;
  readonly kind: WorkGraphNodeKind;
  readonly label: string;
  readonly sublabel?: string | null;
  readonly role?: WorkGraphModuleRole | null;
  readonly status?: WorkGraphTaskStatus | null;
  readonly projectId?: string | null;
  readonly objectiveId?: string | null;
  readonly taskId?: string | null;
}

export interface WorkGraphLink {
  readonly source: string;
  readonly target: string;
  readonly kind: WorkGraphLinkKind;
}

/** Mirrors HRMS-Backend-v1 EmployeeWorkGraphResponse (GET /api/v1/employees/{id}/work-graph). */
export interface EmployeeWorkGraphResponse {
  readonly nodes: readonly WorkGraphNode[];
  readonly links: readonly WorkGraphLink[];
  readonly hiddenTaskCount: number;
}
```

- [ ] **Step 4: Add the API method**

In `people-api.service.ts`, add to the imports:

```ts
import { EmployeeWorkGraphResponse } from '../models/work-graph.model';
```

and next to `getJobJourney`:

```ts
  getWorkGraph(employeeId: string): Observable<EmployeeWorkGraphResponse> {
    return this.http.get<EmployeeWorkGraphResponse>(
      `${environment.apiUrl}/employees/${employeeId}/work-graph`
    );
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/modules/people/data-access/people-api.service.spec.ts"`
Expected: PASS (all tests in the file).

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/models/work-graph.model.ts src/app/modules/people/data-access/people-api.service.ts src/app/modules/people/data-access/people-api.service.spec.ts
git commit -m "feat(people): add work-graph model and API method

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `d3-force` dependency + pure graph layout

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)
- Create: `src/app/modules/people/ui/work-network-graph/work-graph-layout.ts`
- Test: `src/app/modules/people/ui/work-network-graph/work-graph-layout.spec.ts`

**Interfaces:**
- Consumes: `EmployeeWorkGraphResponse`, `WorkGraphNode`, `WorkGraphLinkKind` (Task 1).
- Produces (all exported from `work-graph-layout.ts`, used by Task 4):
  - `interface GraphNode extends SimulationNodeDatum { readonly id: string; readonly data: WorkGraphNode; readonly radius: number }`
  - `interface GraphLink { readonly source: GraphNode; readonly target: GraphNode; readonly kind: WorkGraphLinkKind }`
  - `interface GraphLayout { readonly nodes: readonly GraphNode[]; readonly links: readonly GraphLink[] }`
  - `nodeRadius(node: WorkGraphNode): number` — employee 34, project 24, module 16, task 8
  - `nodeClass(node: WorkGraphNode): string` — `wg-node--employee | --project | --module-owner | --module-member | --module-contributor | --task-active | --task-not-started`
  - `layoutWorkGraph(graph: EmployeeWorkGraphResponse, ticks?: number): GraphLayout` — employee pinned at (0,0); dangling links dropped.

- [ ] **Step 1: Install the dependency**

```bash
npm install d3-force@^3
npm install --save-dev @types/d3-force@^3
```
Expected: both added to `package.json`; no vulnerabilities blocking install. (If `npm` reports an unrelated pre-existing audit warning, ignore it.)

- [ ] **Step 2: Write the failing test**

`work-graph-layout.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { layoutWorkGraph, nodeClass, nodeRadius } from './work-graph-layout';

describe('work-graph-layout', () => {
  const graph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Saif Ahamed', sublabel: 'Watercraft Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Website', projectId: 'p1' },
      { id: 'module:m1', kind: 'module', label: 'Checkout', role: 'owner', projectId: 'p1', objectiveId: 'm1' },
      { id: 'task:t1', kind: 'task', label: 'Fix cart', sublabel: 'WEB-1', status: 'active', projectId: 'p1', objectiveId: 'm1', taskId: 't1' }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'employee:e1', target: 'module:m1', kind: 'owns' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' },
      { source: 'module:m1', target: 'task:missing', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  it('pins the employee at the origin', () => {
    const layout = layoutWorkGraph(graph);
    const me = layout.nodes.find((n) => n.id === 'employee:e1')!;

    expect(me.x).toBe(0);
    expect(me.y).toBe(0);
    expect(me.fx).toBe(0);
    expect(me.fy).toBe(0);
  });

  it('assigns finite coordinates to every node', () => {
    const layout = layoutWorkGraph(graph);

    expect(layout.nodes).toHaveLength(4);
    for (const node of layout.nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('resolves links to node objects and drops links with a missing endpoint', () => {
    const layout = layoutWorkGraph(graph);

    expect(layout.links).toHaveLength(4);
    for (const link of layout.links) {
      expect(layout.nodes).toContain(link.source);
      expect(layout.nodes).toContain(link.target);
    }
  });

  it('sizes nodes employee > project > module > task', () => {
    const r = (kind: WorkGraphNode['kind']) => nodeRadius({ id: 'x', kind, label: 'x' });

    expect(r('employee')).toBeGreaterThan(r('project'));
    expect(r('project')).toBeGreaterThan(r('module'));
    expect(r('module')).toBeGreaterThan(r('task'));
  });

  it('maps nodes to their style class', () => {
    const cls = (n: Partial<WorkGraphNode> & Pick<WorkGraphNode, 'kind'>) => nodeClass({ id: 'x', label: 'x', ...n });

    expect(cls({ kind: 'employee' })).toBe('wg-node--employee');
    expect(cls({ kind: 'project' })).toBe('wg-node--project');
    expect(cls({ kind: 'module', role: 'owner' })).toBe('wg-node--module-owner');
    expect(cls({ kind: 'module', role: 'member' })).toBe('wg-node--module-member');
    expect(cls({ kind: 'module', role: 'contributor' })).toBe('wg-node--module-contributor');
    expect(cls({ kind: 'task', status: 'active' })).toBe('wg-node--task-active');
    expect(cls({ kind: 'task', status: 'not_started' })).toBe('wg-node--task-not-started');
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/work-network-graph/work-graph-layout.spec.ts"`
Expected: FAIL — cannot resolve `./work-graph-layout`.

- [ ] **Step 4: Write the implementation**

`work-graph-layout.ts`:

```ts
import { SimulationNodeDatum, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { EmployeeWorkGraphResponse, WorkGraphLinkKind, WorkGraphNode } from '../../models/work-graph.model';

export interface GraphNode extends SimulationNodeDatum {
  readonly id: string;
  readonly data: WorkGraphNode;
  readonly radius: number;
}

export interface GraphLink {
  readonly source: GraphNode;
  readonly target: GraphNode;
  readonly kind: WorkGraphLinkKind;
}

export interface GraphLayout {
  readonly nodes: readonly GraphNode[];
  readonly links: readonly GraphLink[];
}

export function nodeRadius(node: WorkGraphNode): number {
  switch (node.kind) {
    case 'employee':
      return 34;
    case 'project':
      return 24;
    case 'module':
      return 16;
    default:
      return 8;
  }
}

export function nodeClass(node: WorkGraphNode): string {
  switch (node.kind) {
    case 'employee':
      return 'wg-node--employee';
    case 'project':
      return 'wg-node--project';
    case 'module':
      return `wg-node--module-${node.role ?? 'contributor'}`;
    default:
      return node.status === 'active' ? 'wg-node--task-active' : 'wg-node--task-not-started';
  }
}

function linkDistance(kind: WorkGraphLinkKind): number {
  switch (kind) {
    case 'works_on':
      return 150;
    case 'owns':
    case 'member_of':
      return 130;
    case 'contains':
      return 90;
    default:
      return 55;
  }
}

/**
 * Settles a force-directed layout synchronously (no animation loop), so rendering is
 * deterministic-enough for tests and needs no running simulation afterwards. The employee node
 * is pinned at the origin so everything radiates from him.
 */
export function layoutWorkGraph(graph: EmployeeWorkGraphResponse, ticks = 300): GraphLayout {
  const nodes: GraphNode[] = graph.nodes.map((data) => ({
    id: data.id,
    data,
    radius: nodeRadius(data),
    ...(data.kind === 'employee' ? { x: 0, y: 0, fx: 0, fy: 0 } : {})
  }));
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  const links: GraphLink[] = graph.links.flatMap((l) => {
    const source = byId.get(l.source);
    const target = byId.get(l.target);
    return source && target ? [{ source, target, kind: l.kind }] : [];
  });

  forceSimulation<GraphNode>(nodes)
    .force(
      'link',
      forceLink<GraphNode, GraphLink>(links)
        .id((n) => n.id)
        .distance((l) => linkDistance(l.kind))
        .strength(0.9)
    )
    .force('charge', forceManyBody<GraphNode>().strength(-260))
    .force('collide', forceCollide<GraphNode>().radius((n) => n.radius + 8))
    .force('x', forceX<GraphNode>(0).strength(0.03))
    .force('y', forceY<GraphNode>(0).strength(0.03))
    .stop()
    .tick(ticks);

  return { nodes, links };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/work-network-graph/work-graph-layout.spec.ts"`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add package.json package-lock.json src/app/modules/people/ui/work-network-graph/work-graph-layout.ts src/app/modules/people/ui/work-network-graph/work-graph-layout.spec.ts
git commit -m "feat(people): add d3-force work-graph layout

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `WidgetCardComponent`

**Files:**
- Create: `src/app/shared/ui/widget-card/widget-card.component.ts`
- Test: `src/app/shared/ui/widget-card/widget-card.component.spec.ts`

**Interfaces:**
- Consumes: existing `ErrorStateComponent` (`app-error-state`, inputs `message`, `retryable`, output `retry`).
- Produces: `<app-widget-card [title] [state] [errorMessage] [emptyMessage] (retry)>` where `type WidgetState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden'`. `ready` projects content. Optional header slot: `<ng-container widget-actions>`. Reused by Plan 2 widgets.

- [ ] **Step 1: Write the failing test**

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { WidgetCardComponent, WidgetState } from './widget-card.component';

@Component({
  standalone: true,
  imports: [WidgetCardComponent],
  template: `
    <app-widget-card
      title="Work Network"
      [state]="state()"
      errorMessage="Could not load."
      emptyMessage="Nothing here yet."
      (retry)="retries = retries + 1"
    >
      <p data-testid="projected">content</p>
    </app-widget-card>
  `
})
class HostComponent {
  readonly state = signal<WidgetState>('ready');
  retries = 0;
}

describe('WidgetCardComponent', () => {
  function setup(state: WidgetState) {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.state.set(state);
    fixture.detectChanges();
    return fixture;
  }

  const q = (f: { nativeElement: HTMLElement }, id: string) => f.nativeElement.querySelector(`[data-testid="${id}"]`);

  it('always renders the title', () => {
    expect(setup('ready').nativeElement.textContent).toContain('Work Network');
  });

  it('projects content when ready', () => {
    const f = setup('ready');
    expect(q(f, 'projected')).toBeTruthy();
    expect(q(f, 'widget-loading')).toBeFalsy();
  });

  it('shows a busy skeleton and hides content while loading', () => {
    const f = setup('loading');
    expect(q(f, 'widget-loading')).toBeTruthy();
    expect(q(f, 'projected')).toBeFalsy();
    expect(f.nativeElement.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('shows the empty message', () => {
    const f = setup('empty');
    expect(q(f, 'widget-empty')?.textContent).toContain('Nothing here yet.');
    expect(q(f, 'projected')).toBeFalsy();
  });

  it('shows the no-access message when forbidden', () => {
    const f = setup('forbidden');
    expect(q(f, 'widget-forbidden')?.textContent).toContain('do not have access');
  });

  it('shows the error state and emits retry', () => {
    const f = setup('error');
    expect(f.nativeElement.textContent).toContain('Could not load.');

    const retryButton = f.nativeElement.querySelector('app-error-state button') as HTMLButtonElement;
    retryButton.click();

    expect(f.componentInstance.retries).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/shared/ui/widget-card/widget-card.component.spec.ts"`
Expected: FAIL — cannot resolve `./widget-card.component`.

- [ ] **Step 3: Write the component**

(`ErrorStateComponent` was verified: inputs `message` (required), `retryable`, output `retry`, and it renders a `<button>` when retryable — the last test relies on that.)

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ErrorStateComponent } from '../error-state/error-state.component';

export type WidgetState = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';

/**
 * Shared frame for per-widget data cards: title header plus one of five states, so each widget
 * fails, loads and denies access independently of the rest of the page.
 */
@Component({
  selector: 'app-widget-card',
  standalone: true,
  imports: [ErrorStateComponent],
  template: `
    <section
      class="flex h-full flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"
      [attr.aria-busy]="state() === 'loading'"
    >
      <header class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
        <ng-content select="[widget-actions]" />
      </header>

      @switch (state()) {
        @case ('loading') {
          <div data-testid="widget-loading" class="animate-pulse space-y-3" aria-hidden="true">
            <div class="h-4 w-2/3 rounded bg-[var(--color-surface-secondary)]"></div>
            <div class="h-4 w-1/2 rounded bg-[var(--color-surface-secondary)]"></div>
            <div class="h-24 rounded bg-[var(--color-surface-secondary)]"></div>
          </div>
        }
        @case ('error') {
          <app-error-state [message]="errorMessage()" [retryable]="true" (retry)="retry.emit()" />
        }
        @case ('forbidden') {
          <p data-testid="widget-forbidden" class="text-sm text-[var(--color-text-secondary)]">
            You do not have access to this section.
          </p>
        }
        @case ('empty') {
          <p data-testid="widget-empty" class="text-sm text-[var(--color-text-secondary)]">{{ emptyMessage() }}</p>
        }
        @default {
          <ng-content />
        }
      }
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetCardComponent {
  readonly title = input.required<string>();
  readonly state = input<WidgetState>('ready');
  readonly errorMessage = input('Something went wrong loading this section.');
  readonly emptyMessage = input('Nothing to show yet.');
  readonly retry = output<void>();
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/shared/ui/widget-card/widget-card.component.spec.ts"`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/shared/ui/widget-card
git commit -m "feat(ui): add WidgetCardComponent with loading/empty/error/forbidden states

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `WorkNetworkGraphComponent`

**Files:**
- Create: `src/app/modules/people/ui/work-network-graph/work-network-graph.component.ts`
- Test: `src/app/modules/people/ui/work-network-graph/work-network-graph.component.spec.ts`

**Interfaces:**
- Consumes: `layoutWorkGraph`, `nodeClass`, `GraphNode`, `GraphLink` (Task 2); `EmployeeWorkGraphResponse`, `WorkGraphNode` (Task 1).
- Produces: `<app-work-network-graph [graph] (nodeSelected)>` — `graph: EmployeeWorkGraphResponse` (required), `nodeSelected: WorkGraphNode` emitted on click/Enter of any non-employee node (Task 6 consumes).

- [ ] **Step 1: Write the failing test**

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { WorkNetworkGraphComponent } from './work-network-graph.component';

describe('WorkNetworkGraphComponent', () => {
  const graph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:e1', kind: 'employee', label: 'Saif Ahamed', sublabel: 'Watercraft Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Website', projectId: 'p1' },
      { id: 'project:p2', kind: 'project', label: 'Mobile app', projectId: 'p2' },
      { id: 'module:m1', kind: 'module', label: 'Checkout', role: 'owner', projectId: 'p1', objectiveId: 'm1' },
      { id: 'task:t1', kind: 'task', label: 'Fix cart', sublabel: 'WEB-1', status: 'active', projectId: 'p1', objectiveId: 'm1', taskId: 't1' }
    ],
    links: [
      { source: 'employee:e1', target: 'project:p1', kind: 'works_on' },
      { source: 'employee:e1', target: 'project:p2', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'employee:e1', target: 'module:m1', kind: 'owns' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  function setup(g: EmployeeWorkGraphResponse = graph) {
    TestBed.configureTestingModule({ imports: [WorkNetworkGraphComponent] });
    const fixture = TestBed.createComponent(WorkNetworkGraphComponent);
    fixture.componentRef.setInput('graph', g);
    const selected: WorkGraphNode[] = [];
    fixture.componentInstance.nodeSelected.subscribe((n) => selected.push(n));
    fixture.detectChanges();
    return { fixture, selected, el: fixture.nativeElement as HTMLElement };
  }

  const node = (el: HTMLElement, id: string) => el.querySelector(`[data-node-id="${id}"]`) as SVGGElement;

  it('renders one SVG node per graph node and one line per link', () => {
    const { el } = setup();

    expect(el.querySelectorAll('.wg-node')).toHaveLength(5);
    expect(el.querySelectorAll('line.wg-link')).toHaveLength(5);
  });

  it('shows the employee name and current position at the centre', () => {
    const { el } = setup();
    const centre = node(el, 'employee:e1');

    expect(centre.textContent).toContain('Saif Ahamed');
    expect(centre.textContent).toContain('Watercraft Engineer');
  });

  it('applies the role/status style class to modules and tasks', () => {
    const { el } = setup();

    expect(node(el, 'module:m1').classList.contains('wg-node--module-owner')).toBe(true);
    expect(node(el, 'task:t1').classList.contains('wg-node--task-active')).toBe(true);
  });

  it('emits nodeSelected when a project, module or task is clicked', () => {
    const { el, selected } = setup();

    node(el, 'project:p1').dispatchEvent(new Event('click'));
    node(el, 'module:m1').dispatchEvent(new Event('click'));
    node(el, 'task:t1').dispatchEvent(new Event('click'));

    expect(selected.map((n) => n.id)).toEqual(['project:p1', 'module:m1', 'task:t1']);
  });

  it('does not emit when the employee node is clicked', () => {
    const { el, selected } = setup();

    node(el, 'employee:e1').dispatchEvent(new Event('click'));

    expect(selected).toEqual([]);
  });

  it('dims nodes that are not neighbours of the hovered node', () => {
    const { fixture, el } = setup();

    node(el, 'task:t1').dispatchEvent(new Event('pointerenter'));
    fixture.detectChanges();

    // task:t1's only neighbour is module:m1; project:p2 is unrelated.
    expect(node(el, 'project:p2').classList.contains('wg-node--dim')).toBe(true);
    expect(node(el, 'module:m1').classList.contains('wg-node--dim')).toBe(false);
    expect(node(el, 'task:t1').classList.contains('wg-node--dim')).toBe(false);

    node(el, 'task:t1').dispatchEvent(new Event('pointerleave'));
    fixture.detectChanges();
    expect(node(el, 'project:p2').classList.contains('wg-node--dim')).toBe(false);
  });

  it('tells the user when more tasks exist than are drawn', () => {
    const { el } = setup({ ...graph, hiddenTaskCount: 7 });

    expect(el.textContent).toContain('+7 more tasks not shown');
  });

  it('does not show the hidden-tasks note when nothing is hidden', () => {
    const { el } = setup();

    expect(el.textContent).not.toContain('more task');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/work-network-graph/work-network-graph.component.spec.ts"`
Expected: FAIL — cannot resolve `./work-network-graph.component`.

- [ ] **Step 3: Write the component**

```ts
import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { GraphLink, GraphNode, layoutWorkGraph, nodeClass } from './work-graph-layout';

interface Point {
  readonly x: number;
  readonly y: number;
}

const VIEW_PADDING = 60;
const CLICK_DRAG_THRESHOLD_PX = 4;

/**
 * Obsidian-style network centred on one employee: he is pinned in the middle, projects orbit him,
 * modules hang off projects (solid = owns, outlined = member, dashed = only has tasks there),
 * and his open tasks hang off their module. Layout is a synchronous d3-force settle; nodes can be
 * dragged and stay where dropped. Rendered as Angular-owned SVG so nodes are focusable.
 */
@Component({
  selector: 'app-work-network-graph',
  standalone: true,
  template: `
    <div class="wg-wrap">
      <svg
        #svg
        class="wg-svg"
        [attr.viewBox]="viewBox()"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label="Work network: projects, modules and open tasks"
        (pointermove)="onPointerMove($event)"
        (pointerup)="endDrag()"
        (pointerleave)="endDrag()"
      >
        @for (link of links(); track $index) {
          <line
            class="wg-link"
            [class.wg-link--dim]="isLinkDimmed(link)"
            [attr.x1]="pos(link.source).x"
            [attr.y1]="pos(link.source).y"
            [attr.x2]="pos(link.target).x"
            [attr.y2]="pos(link.target).y"
          />
        }
        @for (node of nodes(); track node.id) {
          <g
            class="wg-node"
            [class]="nodeClassOf(node)"
            [class.wg-node--dim]="isDimmed(node.id)"
            [attr.data-node-id]="node.id"
            [attr.transform]="transformOf(node)"
            tabindex="0"
            role="button"
            [attr.aria-label]="ariaLabel(node.data)"
            (pointerenter)="hovered.set(node.id)"
            (pointerleave)="hovered.set(null)"
            (focus)="hovered.set(node.id)"
            (blur)="hovered.set(null)"
            (pointerdown)="startDrag($event, node)"
            (click)="onNodeClick(node)"
            (keydown.enter)="onNodeClick(node)"
          >
            <circle [attr.r]="node.radius" />
            @if (node.data.kind === 'employee') {
              <text class="wg-initials" text-anchor="middle" dy="0.35em">{{ initials(node.data.label) }}</text>
              <text class="wg-label wg-label--strong" text-anchor="middle" [attr.y]="node.radius + 16">{{ node.data.label }}</text>
              @if (node.data.sublabel) {
                <text class="wg-sublabel" text-anchor="middle" [attr.y]="node.radius + 31">{{ node.data.sublabel }}</text>
              }
            } @else {
              <text class="wg-label" text-anchor="middle" [attr.y]="node.radius + 13">{{ shortLabel(node.data.label) }}</text>
            }
          </g>
        }
      </svg>

      <ul class="wg-legend" aria-label="Legend">
        <li><span class="wg-key wg-key--project"></span>Project</li>
        <li><span class="wg-key wg-key--owner"></span>Module you own</li>
        <li><span class="wg-key wg-key--member"></span>Module member</li>
        <li><span class="wg-key wg-key--active"></span>Active task</li>
        <li><span class="wg-key wg-key--not-started"></span>Not started task</li>
      </ul>

      @if (graph().hiddenTaskCount > 0) {
        <p class="wg-note">+{{ graph().hiddenTaskCount }} more tasks not shown</p>
      }
    </div>
  `,
  styles: [`
    .wg-wrap { display: flex; flex-direction: column; gap: 0.5rem; }
    .wg-svg { width: 100%; height: 460px; touch-action: none; user-select: none; }
    .wg-link { stroke: var(--color-border); stroke-width: 1.5; transition: opacity 120ms; }
    .wg-link--dim { opacity: 0.12; }
    .wg-node { cursor: pointer; outline: none; transition: opacity 120ms; }
    .wg-node--dim { opacity: 0.18; }
    .wg-node:focus-visible circle { stroke: var(--color-accent); stroke-width: 3; }
    .wg-node circle { stroke-width: 2; }
    .wg-node--employee circle { fill: var(--color-accent); stroke: var(--color-surface); }
    .wg-node--project circle { fill: #1d4ed8; stroke: var(--color-surface); }
    .wg-node--module-owner circle { fill: #7c3aed; stroke: var(--color-surface); }
    .wg-node--module-member circle { fill: var(--color-surface); stroke: #7c3aed; stroke-width: 3; }
    .wg-node--module-contributor circle { fill: var(--color-surface); stroke: #7c3aed; stroke-width: 2; stroke-dasharray: 3 3; }
    .wg-node--task-active circle { fill: #16a34a; stroke: var(--color-surface); }
    .wg-node--task-not-started circle { fill: #94a3b8; stroke: var(--color-surface); }
    .wg-initials { fill: #fff; font-size: 16px; font-weight: 700; pointer-events: none; }
    .wg-label { fill: var(--color-text-secondary); font-size: 11px; pointer-events: none; }
    .wg-label--strong { fill: var(--color-text-primary); font-size: 13px; font-weight: 600; }
    .wg-sublabel { fill: var(--color-text-secondary); font-size: 11px; pointer-events: none; }
    .wg-legend { display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; font-size: 0.75rem; color: var(--color-text-secondary); list-style: none; padding: 0; margin: 0; }
    .wg-legend li { display: inline-flex; align-items: center; gap: 0.375rem; }
    .wg-key { width: 0.75rem; height: 0.75rem; border-radius: 9999px; display: inline-block; border: 2px solid transparent; }
    .wg-key--project { background: #1d4ed8; }
    .wg-key--owner { background: #7c3aed; }
    .wg-key--member { border-color: #7c3aed; }
    .wg-key--active { background: #16a34a; }
    .wg-key--not-started { background: #94a3b8; }
    .wg-note { font-size: 0.75rem; color: var(--color-text-secondary); margin: 0; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkNetworkGraphComponent {
  readonly graph = input.required<EmployeeWorkGraphResponse>();
  readonly nodeSelected = output<WorkGraphNode>();

  readonly hovered = signal<string | null>(null);
  private readonly overrides = signal<Readonly<Record<string, Point>>>({});
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  private drag: { node: GraphNode; startClient: Point; moved: boolean } | null = null;
  private suppressNextClick = false;

  private readonly layout = computed(() => layoutWorkGraph(this.graph()));
  readonly nodes = computed(() => this.layout().nodes);
  readonly links = computed(() => this.layout().links);

  /** Fixed to the settled layout (not drag overrides) so dragging never rescales the view. */
  readonly viewBox = computed(() => {
    const nodes = this.nodes();
    if (nodes.length === 0) return '-200 -150 400 300';
    const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.radius)) - VIEW_PADDING;
    const maxX = Math.max(...nodes.map((n) => (n.x ?? 0) + n.radius)) + VIEW_PADDING;
    const minY = Math.min(...nodes.map((n) => (n.y ?? 0) - n.radius)) - VIEW_PADDING;
    const maxY = Math.max(...nodes.map((n) => (n.y ?? 0) + n.radius)) + VIEW_PADDING + 24;
    return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  });

  private readonly neighbours = computed(() => {
    const id = this.hovered();
    if (id === null) return null;
    const set = new Set<string>([id]);
    for (const link of this.links()) {
      if (link.source.id === id) set.add(link.target.id);
      if (link.target.id === id) set.add(link.source.id);
    }
    return set;
  });

  nodeClassOf(node: GraphNode): string {
    return nodeClass(node.data);
  }

  pos(node: GraphNode): Point {
    return this.overrides()[node.id] ?? { x: node.x ?? 0, y: node.y ?? 0 };
  }

  transformOf(node: GraphNode): string {
    const p = this.pos(node);
    return `translate(${p.x},${p.y})`;
  }

  isDimmed(id: string): boolean {
    const n = this.neighbours();
    return n !== null && !n.has(id);
  }

  isLinkDimmed(link: GraphLink): boolean {
    const id = this.hovered();
    return id !== null && link.source.id !== id && link.target.id !== id;
  }

  initials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'EM';
  }

  shortLabel(label: string, max = 22): string {
    return label.length > max ? `${label.slice(0, max - 1)}…` : label;
  }

  ariaLabel(node: WorkGraphNode): string {
    switch (node.kind) {
      case 'employee':
        return `${node.label}, ${node.sublabel ?? 'no position'}`;
      case 'project':
        return `Project ${node.label}`;
      case 'module':
        return `Module ${node.label}, ${node.role ?? 'contributor'}`;
      default:
        return `Task ${node.sublabel ?? ''} ${node.label}, ${node.status === 'active' ? 'active' : 'not started'}`.trim();
    }
  }

  onNodeClick(node: GraphNode): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    if (node.data.kind === 'employee') return;
    this.nodeSelected.emit(node.data);
  }

  startDrag(event: PointerEvent, node: GraphNode): void {
    if (node.data.kind === 'employee') return;
    this.drag = { node, startClient: { x: event.clientX, y: event.clientY }, moved: false };
    this.suppressNextClick = false;
  }

  onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) return;

    if (!drag.moved) {
      const dx = event.clientX - drag.startClient.x;
      const dy = event.clientY - drag.startClient.y;
      if (Math.hypot(dx, dy) < CLICK_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
    }
    const point = this.toSvgPoint(event);
    if (!point) return;
    this.overrides.update((current) => ({ ...current, [drag.node.id]: point }));
  }

  endDrag(): void {
    if (this.drag?.moved) this.suppressNextClick = true;
    this.drag = null;
  }

  private toSvgPoint(event: PointerEvent): Point | null {
    const svg = this.svg()?.nativeElement;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/modules/people/ui/work-network-graph/work-network-graph.component.spec.ts"`
Expected: 8 passed.

Drag is intentionally not covered by an automated test (jsdom has no `getScreenCTM`); it is verified manually in Task 8.

- [ ] **Step 5: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/ui/work-network-graph/work-network-graph.component.ts src/app/modules/people/ui/work-network-graph/work-network-graph.component.spec.ts
git commit -m "feat(people): add force-directed WorkNetworkGraphComponent

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: View helpers + Employment Record and Work Arrangement cards

**Files:**
- Modify: `src/app/modules/people/utils/employee-view.utils.ts` (+ its spec)
- Create: `src/app/modules/people/ui/employee-employment-record/employee-employment-record.component.ts` (+ spec)
- Create: `src/app/modules/people/ui/employee-work-arrangement/employee-work-arrangement.component.ts` (+ spec)

**Interfaces:**
- Produces in `employee-view.utils.ts`:
  - `formatTenure(hireDate: string | null | undefined, now?: Date): string` — `'—'` for missing/invalid, `'New Joiner'` for <1 month, else `"2 yrs 7 mos"` style (logic moved verbatim from `EmployeeDetailComponent.calculateTenure`, with injectable `now`).
  - `primaryLocationLabel(addresses: readonly EmployeeDetailAddress[] | undefined): string` — logic moved verbatim from `EmployeeDetailComponent.getPrimaryLocation`.
- `<app-employee-employment-record [hireDate] [probationEndDate] [status]>` and `<app-employee-work-arrangement [workModeLabel] [legalEntityName] [primaryLocation]>` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Edit `employee-view.utils.spec.ts`: change the import block to also import the new helpers and `EmployeeDetailAddress`:

```ts
import { EmployeeDetailAddress, EmployeeListItemResponse } from '../models/employee.model';
import {
  avatarInitials,
  attendanceWarningLabel,
  attendanceSeverityClass,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  breakOverageLabel,
  formatTenure,
  primaryLocationLabel
} from './employee-view.utils';
```

(replace the existing `import { EmployeeListItemResponse } …` line and the existing multi-line `import { … } from './employee-view.utils'`), then append at the end of the file (after the existing top-level `describe`'s closing `});`):

```ts
describe('formatTenure', () => {
  const now = new Date('2026-09-30T12:00:00Z');

  it('returns an em dash for a missing or invalid hire date', () => {
    expect(formatTenure(undefined, now)).toBe('—');
    expect(formatTenure(null, now)).toBe('—');
    expect(formatTenure('not-a-date', now)).toBe('—');
  });

  it('returns New Joiner inside the first month', () => {
    expect(formatTenure('2026-09-15', now)).toBe('New Joiner');
  });

  it('formats months only', () => {
    expect(formatTenure('2026-06-15', now)).toBe('3 mos');
  });

  it('formats years and months with plurals', () => {
    // Mid-month dates on purpose: 'YYYY-MM-DD' parses as UTC midnight, so a 1st-of-month date
    // would land in the previous month in negative-UTC-offset timezones.
    expect(formatTenure('2024-02-15', now)).toBe('2 yrs 7 mos');
    expect(formatTenure('2025-08-15', now)).toBe('1 yr 1 mo');
  });

  it('formats whole years', () => {
    expect(formatTenure('2024-09-15', now)).toBe('2 yrs');
  });
});

describe('primaryLocationLabel', () => {
  const addr = (json: string, isPrimary = true): EmployeeDetailAddress =>
    ({ id: 'a1', addressType: 'current', addressJson: json, isPrimary }) as EmployeeDetailAddress;

  it('returns Not specified when there are no addresses', () => {
    expect(primaryLocationLabel(undefined)).toBe('Not specified');
    expect(primaryLocationLabel([])).toBe('Not specified');
  });

  it('prefers the primary address and formats city, country', () => {
    expect(primaryLocationLabel([addr('{"city":"Kandy"}', false), addr('{"city":"Colombo","country":"Sri Lanka"}')])).toBe('Colombo, Sri Lanka');
  });

  it('falls back to city only, then country only', () => {
    expect(primaryLocationLabel([addr('{"city":"Colombo"}')])).toBe('Colombo');
    expect(primaryLocationLabel([addr('{"countryCode":"LK"}')])).toBe('LK');
  });

  it('falls back to the first non-empty string value', () => {
    expect(primaryLocationLabel([addr('{"line1":"12 Galle Road"}')])).toBe('12 Galle Road');
  });

  it('truncates unparseable address text to 30 characters', () => {
    const raw = 'this is definitely not json and is quite long';
    expect(primaryLocationLabel([addr(raw)])).toBe(raw.substring(0, 30));
  });
});
```

Create `employee-employment-record.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeeEmploymentRecordComponent } from './employee-employment-record.component';

describe('EmployeeEmploymentRecordComponent', () => {
  function render(inputs: { hireDate: string; probationEndDate: string | null; status: string }) {
    TestBed.configureTestingModule({ imports: [EmployeeEmploymentRecordComponent] });
    const fixture = TestBed.createComponent(EmployeeEmploymentRecordComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows hire date, tenure and status', () => {
    const el = render({ hireDate: '2024-01-15', probationEndDate: null, status: 'active' });

    expect(el.textContent).toContain('Employment Record');
    expect(el.textContent).toContain('15 Jan 2024');
    expect(el.textContent).toContain('Active');
  });

  it('shows probation as Completed when the end date has passed', () => {
    const el = render({ hireDate: '2020-01-15', probationEndDate: '2020-04-15', status: 'active' });

    expect(el.querySelector('[data-testid="probation"]')?.textContent).toContain('Completed');
  });

  it('shows the probation end date while probation is still running', () => {
    const el = render({ hireDate: '2020-01-15', probationEndDate: '2999-01-01', status: 'active' });

    expect(el.querySelector('[data-testid="probation"]')?.textContent).toContain('Ends');
  });

  it('shows Not applicable when there is no probation end date', () => {
    const el = render({ hireDate: '2020-01-15', probationEndDate: null, status: 'active' });

    expect(el.querySelector('[data-testid="probation"]')?.textContent).toContain('Not applicable');
  });
});
```

Create `employee-work-arrangement.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeeWorkArrangementComponent } from './employee-work-arrangement.component';

describe('EmployeeWorkArrangementComponent', () => {
  function render(workModeLabel: string | null, legalEntityName: string | null, primaryLocation: string) {
    TestBed.configureTestingModule({ imports: [EmployeeWorkArrangementComponent] });
    const fixture = TestBed.createComponent(EmployeeWorkArrangementComponent);
    fixture.componentRef.setInput('workModeLabel', workModeLabel);
    fixture.componentRef.setInput('legalEntityName', legalEntityName);
    fixture.componentRef.setInput('primaryLocation', primaryLocation);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows work mode, legal entity and primary location', () => {
    const el = render('Hybrid', 'Dapi Technologies', 'Colombo, Sri Lanka');

    expect(el.textContent).toContain('Work Arrangement');
    expect(el.textContent).toContain('Hybrid');
    expect(el.textContent).toContain('Dapi Technologies');
    expect(el.textContent).toContain('Colombo, Sri Lanka');
  });

  it('falls back to an em dash for missing values', () => {
    const el = render(null, null, 'Not specified');

    expect(el.querySelectorAll('[data-testid="value"]')[0]?.textContent?.trim()).toBe('—');
    expect(el.querySelectorAll('[data-testid="value"]')[1]?.textContent?.trim()).toBe('—');
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-view.utils.spec.ts" --include "src/app/modules/people/ui/employee-employment-record/*.spec.ts" --include "src/app/modules/people/ui/employee-work-arrangement/*.spec.ts"`
Expected: FAIL — `formatTenure`/`primaryLocationLabel` not exported; both components unresolved.

- [ ] **Step 3: Add the helpers**

In `employee-view.utils.ts`, add `EmployeeDetailAddress` to the file's existing `../models/employee.model` import (or add a new `import { EmployeeDetailAddress } from '../models/employee.model';` if that file imports nothing from it yet), and append:

```ts
export function formatTenure(hireDate: string | null | undefined, now: Date = new Date()): string {
  if (!hireDate) return '—';
  const hired = new Date(hireDate);
  if (isNaN(hired.getTime())) return '—';

  let years = now.getFullYear() - hired.getFullYear();
  let months = now.getMonth() - hired.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years <= 0 && months <= 0) return 'New Joiner';

  const yearPart = years > 0 ? `${years} yr${years > 1 ? 's' : ''}` : '';
  const monthPart = months > 0 ? `${months} mo${months > 1 ? 's' : ''}` : '';
  if (yearPart && monthPart) return `${yearPart} ${monthPart}`;
  return yearPart || monthPart || 'New Joiner';
}

export function primaryLocationLabel(addresses: readonly EmployeeDetailAddress[] | undefined): string {
  if (!addresses || addresses.length === 0) return 'Not specified';
  const primary = addresses.find((a) => a.isPrimary) || addresses[0];
  if (!primary || !primary.addressJson) return 'Not specified';

  try {
    const parsed: unknown = JSON.parse(primary.addressJson);
    if (parsed && typeof parsed === 'object') {
      const p = parsed as Record<string, unknown>;
      const city = p['city'] || p['town'];
      const country = p['country'] || p['countryCode'];
      if (city && country) return `${city}, ${country}`;
      if (city) return String(city);
      if (country) return String(country);
      const firstVal = Object.values(p).find((v) => typeof v === 'string' && v.trim().length > 0);
      if (firstVal) return String(firstVal);
    }
  } catch {
    return primary.addressJson.substring(0, 30);
  }
  return 'Not specified';
}
```

- [ ] **Step 4: Write the Employment Record component**

`employee-employment-record.component.ts`:

```ts
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { formatTenure } from '../../utils/employee-view.utils';

@Component({
  selector: 'app-employee-employment-record',
  standalone: true,
  imports: [CardComponent, DatePipe],
  template: `
    <app-card title="Employment Record">
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Hire date</dt>
        <dd class="font-medium text-[var(--color-text-primary)]">{{ hireDate() | date: 'dd MMM yyyy' }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Tenure</dt>
        <dd class="font-medium text-[var(--color-text-primary)]">{{ tenure() }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Probation</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="probation">{{ probationLabel() }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Status</dt>
        <dd class="font-medium text-[var(--color-text-primary)]">{{ statusLabel() }}</dd>
      </dl>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentRecordComponent {
  readonly hireDate = input.required<string>();
  readonly probationEndDate = input<string | null>(null);
  readonly status = input.required<string>();

  readonly tenure = computed(() => formatTenure(this.hireDate()));

  readonly probationLabel = computed(() => {
    const end = this.probationEndDate();
    if (!end) return 'Not applicable';
    const endDate = new Date(end);
    if (isNaN(endDate.getTime())) return 'Not applicable';
    return endDate.getTime() <= Date.now()
      ? 'Completed'
      : `Ends ${endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  });

  readonly statusLabel = computed(() => {
    const s = this.status().trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';
  });
}
```

- [ ] **Step 5: Write the Work Arrangement component**

`employee-work-arrangement.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CardComponent } from '../../../../shared/ui/card/card.component';

/** Time zone and schedule are deliberately absent: no per-employee source exists yet (spec §3). */
@Component({
  selector: 'app-employee-work-arrangement',
  standalone: true,
  imports: [CardComponent],
  template: `
    <app-card title="Work Arrangement">
      <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
        <dt class="text-[var(--color-text-secondary)]">Work mode</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="value">{{ workModeLabel() || '—' }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Legal entity</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="value">{{ legalEntityName() || '—' }}</dd>

        <dt class="text-[var(--color-text-secondary)]">Primary location</dt>
        <dd class="font-medium text-[var(--color-text-primary)]" data-testid="value">{{ primaryLocation() }}</dd>
      </dl>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeWorkArrangementComponent {
  readonly workModeLabel = input<string | null>(null);
  readonly legalEntityName = input<string | null>(null);
  readonly primaryLocation = input.required<string>();
}
```

- [ ] **Step 6: Run to verify they pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/utils/employee-view.utils.spec.ts" --include "src/app/modules/people/ui/employee-employment-record/*.spec.ts" --include "src/app/modules/people/ui/employee-work-arrangement/*.spec.ts"`
Expected: all pass. (The `formatTenure` algorithm is moved verbatim from the existing component; if an expected string is off, recompute it from `2026-09-30` minus the hire date and fix the *expected value*, not the algorithm.)

- [ ] **Step 7: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/utils/employee-view.utils.ts src/app/modules/people/utils/employee-view.utils.spec.ts src/app/modules/people/ui/employee-employment-record src/app/modules/people/ui/employee-work-arrangement
git commit -m "feat(people): add employment record and work arrangement cards

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Employment and Personal tab components

**Files:**
- Create: `src/app/modules/people/feature/employee-detail/employment-tab.component.ts` (+ `.spec.ts`)
- Create: `src/app/modules/people/feature/employee-detail/personal-tab.component.ts` (+ `.spec.ts`)

**Interfaces:**
- Consumes: `WidgetCardComponent`/`WidgetState` (Task 3), `WorkNetworkGraphComponent` (Task 4), the two cards + `primaryLocationLabel` (Task 5), `PeopleApiService.getWorkGraph` (Task 1), existing `EmployeeJobInfoComponent` (inputs `jobInformation`, `employeeId`, `canEdit`, `saving`; output `save: UpdateEmployeeJobDetailsRequest`), `EmployeeJobJourneyComponent` (input `entries`), `EmployeePersonalInfoComponent` (`personalInformation`), `EmployeeEmergencyContactsComponent` (`emergencyContacts`), `EmployeePayrollComponent` (`payroll`).
- Produces:
  - `<app-employee-employment-tab [employee] [jobJourney] [canEdit] [saving] (save)>` — `employee: EmployeeDetailResponse` (required), `jobJourney: readonly PositionHistoryEntryResponse[]`, `canEdit: boolean`, `saving: boolean`, `save: UpdateEmployeeJobDetailsRequest`.
  - `<app-employee-personal-tab [employee]>` — `employee: EmployeeDetailResponse` (required).
  Both consumed by Task 7.

- [ ] **Step 1: Write the failing tests**

`employment-tab.component.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeWorkGraphResponse } from '../../models/work-graph.model';
import { WorkModeStore } from '../../../settings/state/work-mode.store';
import { EmployeeEmploymentTabComponent } from './employment-tab.component';

describe('EmployeeEmploymentTabComponent', () => {
  const employee: EmployeeDetailResponse = {
    id: 'emp-1',
    jobInformation: {
      employeeNumber: 'E-001',
      legalEntityId: 'le-1',
      legalEntityName: 'Acme Corp',
      departmentName: 'Engineering',
      positionName: 'Software Engineer',
      positionId: 'pos-1',
      reportingManagerName: 'Grace Hopper',
      employmentTypeLabel: 'Full time',
      status: 'active',
      hireDate: '2024-01-15',
      probationEndDate: null,
      workModeLabel: 'Remote',
      employmentTypeCode: 'full_time',
      workModeId: 'wm-1'
    },
    personalInformation: {
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.dev', phone: null,
      dateOfBirth: null, gender: null, nationalityId: null, addresses: []
    },
    emergencyContacts: [],
    payroll: null,
    invitationStatus: null,
    invitationExpiresAt: null,
    trayAppAccessEnabled: false
  };

  const fullGraph: EmployeeWorkGraphResponse = {
    nodes: [
      { id: 'employee:emp-1', kind: 'employee', label: 'Ada Lovelace', sublabel: 'Software Engineer' },
      { id: 'project:p1', kind: 'project', label: 'Website', projectId: 'p1' },
      { id: 'module:m1', kind: 'module', label: 'Checkout', role: 'owner', projectId: 'p1', objectiveId: 'm1' },
      { id: 'task:t1', kind: 'task', label: 'Fix cart', sublabel: 'WEB-1', status: 'active', projectId: 'p1', objectiveId: 'm1', taskId: 't1' }
    ],
    links: [
      { source: 'employee:emp-1', target: 'project:p1', kind: 'works_on' },
      { source: 'project:p1', target: 'module:m1', kind: 'contains' },
      { source: 'module:m1', target: 'task:t1', kind: 'has_task' }
    ],
    hiddenTaskCount: 0
  };

  function setup(getWorkGraph: ReturnType<typeof vi.fn>) {
    // EmployeeJobInfoComponent injects the root WorkModeStore (-> HttpClient), which this spec
    // does not provide; stub it exactly as employee-detail.component.spec.ts does.
    const workModeStoreStub = {
      items: signal([]) as any, atCap: signal(false) as any, loading: signal(false) as any,
      saving: signal(false) as any, error: signal(null) as any,
      load: vi.fn() as any, create: vi.fn() as any, update: vi.fn() as any, deactivate: vi.fn() as any
    };
    TestBed.configureTestingModule({
      imports: [EmployeeEmploymentTabComponent],
      providers: [
        { provide: PeopleApiService, useValue: { getWorkGraph } },
        { provide: WorkModeStore, useValue: workModeStoreStub }
      ]
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(EmployeeEmploymentTabComponent);
    fixture.componentRef.setInput('employee', employee);
    return { fixture, navigate, el: fixture.nativeElement as HTMLElement };
  }

  it('renders the job details, work arrangement and employment record cards', () => {
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();

    expect(el.querySelector('app-employee-job-info')).toBeTruthy();
    expect(el.querySelector('app-employee-work-arrangement')).toBeTruthy();
    expect(el.querySelector('app-employee-employment-record')).toBeTruthy();
    expect(el.querySelector('app-employee-job-journey')).toBeTruthy();
  });

  it('loads the work graph for the employee and renders it', () => {
    const getWorkGraph = vi.fn().mockReturnValue(of(fullGraph));
    const { fixture, el } = setup(getWorkGraph);
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledWith('emp-1');
    expect(el.querySelector('app-work-network-graph')).toBeTruthy();
  });

  it('shows a loading state until the graph responds', () => {
    const subject = new Subject<EmployeeWorkGraphResponse>();
    const { fixture, el } = setup(vi.fn().mockReturnValue(subject.asObservable()));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-loading"]')).toBeTruthy();

    subject.next(fullGraph);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="widget-loading"]')).toBeFalsy();
  });

  it('shows the empty state when the employee has no project work (only the centre node)', () => {
    const onlyMe: EmployeeWorkGraphResponse = { nodes: [fullGraph.nodes[0]], links: [], hiddenTaskCount: 0 };
    const { fixture, el } = setup(vi.fn().mockReturnValue(of(onlyMe)));
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-empty"]')?.textContent).toContain('not part of any project');
    expect(el.querySelector('app-work-network-graph')).toBeFalsy();
  });

  it('shows the forbidden state on a 403 without breaking the rest of the tab', () => {
    const { fixture, el } = setup(
      vi.fn().mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })))
    );
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="widget-forbidden"]')).toBeTruthy();
    expect(el.querySelector('app-employee-job-info')).toBeTruthy();
  });

  it('shows an error state and retries the load', () => {
    const getWorkGraph = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })))
      .mockReturnValueOnce(of(fullGraph));
    const { fixture, el } = setup(getWorkGraph);
    fixture.detectChanges();

    (el.querySelector('app-error-state button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledTimes(2);
    expect(el.querySelector('app-work-network-graph')).toBeTruthy();
  });

  it('navigates to the project board, module tree and (for tasks) the project board on node click', () => {
    const { fixture, navigate } = setup(vi.fn().mockReturnValue(of(fullGraph)));
    fixture.detectChanges();
    const tab = fixture.componentInstance;

    tab.onNodeSelected(fullGraph.nodes[1]);
    tab.onNodeSelected(fullGraph.nodes[2]);
    tab.onNodeSelected(fullGraph.nodes[3]);

    expect(navigate).toHaveBeenNthCalledWith(1, ['/work', 'p1', 'board']);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/work', 'p1', 'milestones', 'm1', 'tree']);
    expect(navigate).toHaveBeenNthCalledWith(3, ['/work', 'p1', 'board']);
  });

  it('does not reload the graph when the parent re-emits the same employee id', () => {
    const getWorkGraph = vi.fn().mockReturnValue(of(fullGraph));
    const { fixture } = setup(getWorkGraph);
    fixture.detectChanges();

    fixture.componentRef.setInput('employee', { ...employee });
    fixture.detectChanges();

    expect(getWorkGraph).toHaveBeenCalledTimes(1);
  });
});
```

`personal-tab.component.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeePersonalTabComponent } from './personal-tab.component';

describe('EmployeePersonalTabComponent', () => {
  const employee: EmployeeDetailResponse = {
    id: 'emp-1',
    jobInformation: {
      employeeNumber: 'E-001', legalEntityId: 'le-1', legalEntityName: 'Acme Corp', departmentName: null,
      positionName: null, positionId: null, reportingManagerName: null, employmentTypeLabel: 'Full time',
      status: 'active', hireDate: '2024-01-15', probationEndDate: null, workModeLabel: null,
      employmentTypeCode: 'full_time', workModeId: null
    },
    personalInformation: {
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.dev', phone: null,
      dateOfBirth: null, gender: null, nationalityId: null, addresses: []
    },
    emergencyContacts: [],
    payroll: null,
    invitationStatus: null,
    invitationExpiresAt: null,
    trayAppAccessEnabled: false
  };

  function render(e: EmployeeDetailResponse) {
    TestBed.configureTestingModule({ imports: [EmployeePersonalTabComponent] });
    const fixture = TestBed.createComponent(EmployeePersonalTabComponent);
    fixture.componentRef.setInput('employee', e);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders personal information and emergency contacts', () => {
    const el = render(employee);

    expect(el.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(el.querySelector('app-employee-emergency-contacts')).toBeTruthy();
  });

  it('renders payroll only when the response includes it', () => {
    expect(render(employee).querySelector('app-employee-payroll')).toBeFalsy();

    TestBed.resetTestingModule();
    const withPayroll = render({
      ...employee,
      payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' }
    });
    expect(withPayroll.querySelector('app-employee-payroll')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/employment-tab.component.spec.ts" --include "src/app/modules/people/feature/employee-detail/personal-tab.component.spec.ts"`
Expected: FAIL — both components unresolved.

- [ ] **Step 3: Write the Personal tab**

`personal-tab.component.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { EmployeeDetailResponse } from '../../models/employee.model';
import { EmployeeEmergencyContactsComponent } from '../../ui/employee-emergency-contacts/employee-emergency-contacts.component';
import { EmployeePayrollComponent } from '../../ui/employee-payroll/employee-payroll.component';
import { EmployeePersonalInfoComponent } from '../../ui/employee-personal-info/employee-personal-info.component';

/** Payroll renders only when the server included it (employees:read:sensitive is enforced there). */
@Component({
  selector: 'app-employee-personal-tab',
  standalone: true,
  imports: [EmployeePersonalInfoComponent, EmployeeEmergencyContactsComponent, EmployeePayrollComponent],
  template: `
    <div class="space-y-4">
      <app-employee-personal-info [personalInformation]="employee().personalInformation" />
      <app-employee-emergency-contacts [emergencyContacts]="employee().emergencyContacts" />
      @if (employee().payroll; as payroll) {
        <app-employee-payroll [payroll]="payroll" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePersonalTabComponent {
  readonly employee = input.required<EmployeeDetailResponse>();
}
```

- [ ] **Step 4: Write the Employment tab**

`employment-tab.component.ts`:

```ts
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { WidgetCardComponent, WidgetState } from '../../../../shared/ui/widget-card/widget-card.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { EmployeeWorkGraphResponse, WorkGraphNode } from '../../models/work-graph.model';
import { EmployeeEmploymentRecordComponent } from '../../ui/employee-employment-record/employee-employment-record.component';
import { EmployeeJobInfoComponent } from '../../ui/employee-job-info/employee-job-info.component';
import { EmployeeJobJourneyComponent } from '../../ui/employee-job-journey/employee-job-journey.component';
import { EmployeeWorkArrangementComponent } from '../../ui/employee-work-arrangement/employee-work-arrangement.component';
import { WorkNetworkGraphComponent } from '../../ui/work-network-graph/work-network-graph.component';
import { primaryLocationLabel } from '../../utils/employee-view.utils';

/**
 * Employment tab. The Work Network widget owns its own fetch and states, so a failure or 403
 * there never affects the job details, arrangement, record or history cards around it.
 */
@Component({
  selector: 'app-employee-employment-tab',
  standalone: true,
  imports: [
    WidgetCardComponent,
    EmployeeJobInfoComponent,
    EmployeeJobJourneyComponent,
    EmployeeEmploymentRecordComponent,
    EmployeeWorkArrangementComponent,
    WorkNetworkGraphComponent
  ],
  template: `
    <div class="grid gap-4 lg:grid-cols-3">
      <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 lg:col-span-2">
        <app-employee-job-info
          [jobInformation]="employee().jobInformation"
          [employeeId]="employee().id"
          [canEdit]="canEdit()"
          [saving]="saving()"
          (save)="save.emit($event)"
        />
      </div>
      <div class="flex flex-col gap-4">
        <app-employee-work-arrangement
          [workModeLabel]="employee().jobInformation.workModeLabel"
          [legalEntityName]="employee().jobInformation.legalEntityName"
          [primaryLocation]="primaryLocation()"
        />
        <app-employee-employment-record
          [hireDate]="employee().jobInformation.hireDate"
          [probationEndDate]="employee().jobInformation.probationEndDate"
          [status]="employee().jobInformation.status"
        />
      </div>
    </div>

    <div class="mt-4">
      <app-widget-card
        title="Work Network"
        [state]="graphState()"
        errorMessage="Could not load the work network."
        emptyMessage="This employee is not part of any project yet."
        (retry)="loadGraph()"
      >
        @if (graph(); as g) {
          <app-work-network-graph [graph]="g" (nodeSelected)="onNodeSelected($event)" />
        }
      </app-widget-card>
    </div>

    <div class="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <app-employee-job-journey [entries]="jobJourney()" />
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeEmploymentTabComponent {
  private readonly api = inject(PeopleApiService);
  private readonly router = inject(Router);

  readonly employee = input.required<EmployeeDetailResponse>();
  readonly jobJourney = input<readonly PositionHistoryEntryResponse[]>([]);
  readonly canEdit = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly save = output<UpdateEmployeeJobDetailsRequest>();

  readonly graph = signal<EmployeeWorkGraphResponse | null>(null);
  readonly graphState = signal<WidgetState>('loading');

  private readonly employeeId = computed(() => this.employee().id);
  readonly primaryLocation = computed(() => primaryLocationLabel(this.employee().personalInformation.addresses));

  constructor() {
    // employeeId is a memoised computed, so a parent reload that re-emits the same id
    // (e.g. after saving job details) does not refetch the graph.
    effect(() => {
      const id = this.employeeId();
      untracked(() => this.loadGraph(id));
    });
  }

  loadGraph(id: string = this.employeeId()): void {
    this.graphState.set('loading');
    this.api.getWorkGraph(id).subscribe({
      next: (graph) => {
        if (id !== this.employeeId()) return;
        this.graph.set(graph);
        // The centre node is always present; anything beyond it is real work.
        this.graphState.set(graph.nodes.length > 1 ? 'ready' : 'empty');
      },
      error: (err: unknown) => {
        if (id !== this.employeeId()) return;
        this.graph.set(null);
        this.graphState.set(err instanceof HttpErrorResponse && err.status === 403 ? 'forbidden' : 'error');
      }
    });
  }

  onNodeSelected(node: WorkGraphNode): void {
    if (!node.projectId) return;
    if (node.kind === 'module' && node.objectiveId) {
      void this.router.navigate(['/work', node.projectId, 'milestones', node.objectiveId, 'tree']);
      return;
    }
    // Projects and tasks land on the project board: no task deep-link route exists.
    void this.router.navigate(['/work', node.projectId, 'board']);
  }
}
```

- [ ] **Step 5: Run to verify they pass**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/employment-tab.component.spec.ts" --include "src/app/modules/people/feature/employee-detail/personal-tab.component.spec.ts"`
Expected: 10 passed (8 employment + 2 personal).

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/feature/employee-detail/employment-tab.component.ts src/app/modules/people/feature/employee-detail/employment-tab.component.spec.ts src/app/modules/people/feature/employee-detail/personal-tab.component.ts src/app/modules/people/feature/employee-detail/personal-tab.component.spec.ts
git commit -m "feat(people): add Employment and Personal tab components

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Restructure `EmployeeDetailComponent` (new header + two tabs)

**Files:**
- Modify (full rewrite): `src/app/modules/people/feature/employee-detail/employee-detail.component.ts`
- Modify (test): `src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts`

**Interfaces:**
- Consumes: `EmployeeEmploymentTabComponent`, `EmployeePersonalTabComponent` (Task 6). Everything else the component already used stays as-is.
- Produces: `activeTab: WritableSignal<'employment' | 'personal'>` (default `'employment'`). Removes `calculateTenure` and `getPrimaryLocation` (moved to utils in Task 5) and the Tenure / Reporting Manager / Primary Location metric cards (their content now lives in the header key-facts and the Employment tab).

- [ ] **Step 1: Update the spec first (failing)**

In `employee-detail.component.spec.ts`:

(a) In `setup(...)`'s `apiStub`, add a default work-graph mock next to `getJobJourney`:

```ts
      getJobJourney: vi.fn().mockReturnValue(of([])),
      getWorkGraph: vi.fn().mockReturnValue(of({ nodes: [], links: [], hiddenTaskCount: 0 })),
```

(b) Replace the three tests from `it('renders the Job Information component on initial load, and switches tabs when clicked'` through `it('omits the Payroll section when the response does not include it'` (three consecutive `it` blocks) with:

```ts
  it('renders the Employment tab first and switches to the Personal tab', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('employment');
    expect(fixture.nativeElement.querySelector('app-employee-employment-tab')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-job-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-personal-tab')).toBeFalsy();

    fixture.componentInstance.activeTab.set('personal');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-employee-personal-tab')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-personal-info')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-emergency-contacts')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-employee-employment-tab')).toBeFalsy();
  });

  it('switches tabs when a tab button is clicked', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const personalButton = Array.from(
      fixture.nativeElement.querySelectorAll('nav[aria-label="Employee Detail Sections"] button')
    ).find((b) => (b as HTMLElement).textContent?.trim() === 'Personal') as HTMLButtonElement;
    personalButton.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.activeTab()).toBe('personal');
  });

  it('renders the Payroll section in the Personal tab when the response includes it', () => {
    const { fixture } = setup({
      ...detailFixture,
      payroll: { hasBankDetailsOnFile: true, bankName: 'Test Bank', maskedAccountNumber: '****1234', accountType: 'checking' }
    });
    fixture.detectChanges();

    fixture.componentInstance.activeTab.set('personal');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeTruthy();
  });

  it('omits the Payroll section when the response does not include it', () => {
    const { fixture } = setup({ ...detailFixture, payroll: null });
    fixture.detectChanges();

    fixture.componentInstance.activeTab.set('personal');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-employee-payroll')).toBeFalsy();
  });

  it('shows the key facts (manager, employment type, work mode, hire date) in the header', () => {
    const { fixture } = setup(detailFixture);
    fixture.detectChanges();

    const facts = (fixture.nativeElement.querySelector('[data-testid="employee-key-facts"]') as HTMLElement).textContent as string;
    expect(facts).toContain('Grace Hopper');
    expect(facts).toContain('Full time');
    expect(facts).toContain('Remote');
    expect(facts).toContain('15 Jan 2024');
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts"`
Expected: FAIL — `app-employee-employment-tab` not rendered / `activeTab()` is `'job'` / `employee-key-facts` missing. (All other pre-existing tests in the file must still pass or fail only for these reasons.)

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `employee-detail.component.ts` with:

```ts
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { PopoverComponent } from '../../../../shared/ui/popover/popover.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { EmployeeDetailResponse, UpdateEmployeeJobDetailsRequest } from '../../models/employee.model';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';
import { PositionHistoryEntryResponse } from '../../models/position-history.model';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';
import {
  attendanceWarningLabel,
  attendanceAttentionLabel,
  attendanceStatusLabel,
  attendanceSeverityClass,
  breakOverageLabel
} from '../../utils/employee-view.utils';
import { EmployeeEmploymentTabComponent } from './employment-tab.component';
import { EmployeePersonalTabComponent } from './personal-tab.component';

type DetailTab = 'employment' | 'personal';

/**
 * Employee detail page shell backed by GET /api/v1/employees/{id}/detail: header (identity, key
 * facts, Transfer/Promote/Offboarding actions, resend-invitation), today's attendance strip, and
 * two tabs - Employment (job details, arrangement, record, Work Network, history) and Personal
 * (personal info, emergency contacts, payroll when the server includes it).
 */
@Component({
  selector: 'app-employee-detail',
  standalone: true,
  imports: [
    DatePipe,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    ChangePositionModalComponent,
    PopoverComponent,
    EmployeeEmploymentTabComponent,
    EmployeePersonalTabComponent
  ],
  template: `
    @if (loading()) {
      <app-loader label="Loading employee…" />
    } @else if (error()) {
      <app-error-state [message]="error()!" [retryable]="true" (retry)="load()" />
    } @else if (employee(); as employee) {
      <header class="emp-detail-header">
        <app-breadcrumb-header
          parentLabel="Employees"
          currentLabel="Employee Detail"
          parentUrl="/people/employees"
          icon="people"
        />
      </header>

      <!-- Header card: identity, key facts, actions -->
      <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 mb-4">
        <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-6">
          <div class="flex items-center gap-5 min-w-0">
            <div class="relative flex-shrink-0">
              <div class="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-inner border border-blue-200">
                {{ getInitials(employee.personalInformation.firstName, employee.personalInformation.lastName) }}
              </div>
              <span class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white"
                    [class.bg-green-500]="employee.jobInformation.status.toLowerCase() === 'active'"
                    [class.bg-red-500]="employee.jobInformation.status.toLowerCase() === 'inactive'"></span>
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-3 flex-wrap">
                <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">
                  {{ employee.personalInformation.firstName }} {{ employee.personalInformation.lastName }}
                </h1>
                <span class="inline-flex items-center font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  {{ employee.jobInformation.employeeNumber }}
                </span>
              </div>
              <p class="text-base font-medium text-[var(--color-text-primary)] mt-1">
                {{ employee.jobInformation.positionName || 'Unassigned Position' }}
              </p>
              <p class="text-sm text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{{ employee.jobInformation.departmentName || 'No department' }}</span>
                <span>•</span>
                <span>{{ employee.jobInformation.legalEntityName || 'Company' }}</span>
              </p>
              <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">{{ employee.personalInformation.email }}</p>
            </div>
          </div>

          <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm xl:mx-6" data-testid="employee-key-facts">
            <dt class="text-[var(--color-text-secondary)]">Reporting Manager</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ employee.jobInformation.reportingManagerName || 'Unassigned' }}</dd>
            <dt class="text-[var(--color-text-secondary)]">Employment Type</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ employee.jobInformation.employmentTypeLabel }}</dd>
            <dt class="text-[var(--color-text-secondary)]">Work Mode</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ employee.jobInformation.workModeLabel || '—' }}</dd>
            <dt class="text-[var(--color-text-secondary)]">Hire Date</dt>
            <dd class="font-medium text-[var(--color-text-primary)]">{{ employee.jobInformation.hireDate | date: 'dd MMM yyyy' }}</dd>
          </dl>

          <div class="flex items-center gap-3 xl:self-start">
            @if ((canChangePosition() || canOffboard()) && !isOwnRecord() && employee.jobInformation.legalEntityId && !isReadOnly() && employee.invitationStatus !== 'pending' && employee.invitationStatus !== 'expired') {
              <app-popover [open]="changePositionMenuOpen()" ariaLabel="Change position actions" align="right" (closed)="changePositionMenuOpen.set(false)">
                <app-button popover-trigger data-testid="change-position-trigger" (pressed)="changePositionMenuOpen.set(!changePositionMenuOpen())">
                  {{ canChangePosition() ? 'Transfer / Promote' : 'Offboarding' }}
                </app-button>
                <div popover-panel class="change-position-menu">
                  @if (canChangePosition()) {
                    <button type="button" class="profile-action-btn" (click)="openChangePosition('Promotion')">Promotion</button>
                    <button type="button" class="profile-action-btn" (click)="openChangePosition('Transfer')">Transfer</button>
                  }
                  @if (canOffboard()) {
                    <button type="button" class="profile-action-btn" data-testid="offboarding-menu-item" (click)="navigateToOffboarding(employee.id)">
                      {{ offboardingStatus() && offboardingStatus() !== 'cancelled' ? (isReadOnly() ? 'View Offboarding' : 'Continue Offboarding') : 'Offboarding' }}
                    </button>
                  }
                </div>
              </app-popover>
            }
            @if (employee.invitationStatus === 'expired') {
              <app-button variant="secondary" [loading]="resending()" [disabled]="resending()" (pressed)="resendInvitation(employee.id)">
                Resend invitation
              </app-button>
            }
          </div>
        </div>
      </div>

      @if (employee.attendanceSummary) {
        <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-4">
          <span class="text-xs font-medium text-[var(--color-text-secondary)] block mb-1">Attendance today</span>
          @if (employee.attendanceSummary.showNotClockedInWarning && attendanceWarningLabel(employee); as warningLabel) {
            <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <span class="w-2 h-2 rounded-full bg-red-500"></span>
              {{ warningLabel }}
            </span>
          } @else {
            <span class="text-sm font-semibold text-[var(--color-text-primary)] block truncate">
              {{ attendanceStatusLabel(employee) || 'Not specified' }}
            </span>
            @if (attendanceAttentionLabel(employee); as attentionLabel) {
              <span class="mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full" [class]="severityBadgeClass(employee)">
                {{ attentionLabel }}
              </span>
            }
          }
          @if (breakOverageLabel(employee); as breakLabel) {
            <span class="mt-1 block text-xs font-medium text-red-600">{{ breakLabel }}</span>
          }
        </div>
      }

      <!-- Navigation Tabs -->
      <div class="border-b border-[var(--color-border)] mb-4">
        <nav class="flex gap-2" aria-label="Employee Detail Sections">
          @for (tab of tabs; track tab.id) {
            <button
              type="button"
              class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap cursor-pointer"
              [class.border-[var(--color-accent)]]="activeTab() === tab.id"
              [class.text-[var(--color-accent)]]="activeTab() === tab.id"
              [class.font-semibold]="activeTab() === tab.id"
              [class.border-transparent]="activeTab() !== tab.id"
              [class.text-[var(--color-text-secondary)]]="activeTab() !== tab.id"
              (click)="activeTab.set(tab.id)"
            >
              {{ tab.label }}
            </button>
          }
        </nav>
      </div>

      @if (activeTab() === 'employment') {
        <app-employee-employment-tab
          [employee]="employee"
          [jobJourney]="jobJourney()"
          [canEdit]="canChangePosition() && !isReadOnly()"
          [saving]="savingJobDetails()"
          (save)="onJobDetailsSave($event)"
        />
      } @else {
        <app-employee-personal-tab [employee]="employee" />
      }

      @if (employee.jobInformation.legalEntityId; as legalEntityId) {
        <app-change-position-modal
          [open]="changePositionOpen()"
          [employeeId]="employee.id"
          [legalEntityId]="legalEntityId"
          [currentPositionId]="employee.jobInformation.positionId"
          [changeReason]="changePositionReason()"
          (closed)="changePositionOpen.set(false)"
          (changed)="onPositionChanged()"
          (pendingApproval)="onPositionPendingApproval()"
        />
      }
    }
  `,
  styles: [`
    .emp-detail-header {
      margin-top: -1.25rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.625rem;
      border-bottom: 1px solid var(--color-border);
    }

    .change-position-menu {
      display: flex;
      flex-direction: column;
      min-width: 12rem;
      padding: 0.25rem;
    }

    .profile-action-btn {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: none;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--color-text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-align: left;
    }

    .profile-action-btn:hover:not(:disabled) {
      background-color: var(--color-surface-secondary);
      color: var(--color-accent);
    }

    .profile-action-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PeopleApiService);
  private readonly notifications = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly authStore = inject(AuthStore);
  private readonly offboardingStore = inject(OffboardingWizardStore);

  readonly employee = signal<EmployeeDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly resending = signal(false);
  readonly savingJobDetails = signal(false);
  readonly changePositionMenuOpen = signal(false);
  readonly changePositionOpen = signal(false);
  readonly changePositionReason = signal<'Promotion' | 'Transfer'>('Promotion');
  readonly tabs: readonly { readonly id: DetailTab; readonly label: string }[] = [
    { id: 'employment', label: 'Employment' },
    { id: 'personal', label: 'Personal' }
  ];
  readonly activeTab = signal<DetailTab>('employment');
  readonly jobJourney = signal<readonly PositionHistoryEntryResponse[]>([]);

  readonly attendanceWarningLabel = attendanceWarningLabel;
  readonly attendanceAttentionLabel = attendanceAttentionLabel;
  readonly attendanceStatusLabel = attendanceStatusLabel;
  readonly breakOverageLabel = breakOverageLabel;

  readonly canChangePosition = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly isOwnRecord = computed(() => this.employee()?.id === this.authStore.employeeId());
  readonly offboardingStatus = computed(() => this.offboardingStore.record()?.status ?? null);
  readonly isReadOnly = computed(() => this.offboardingStatus() === 'completed');

  constructor() {
    this.load();
  }

  getInitials(firstName?: string, lastName?: string): string {
    const f = firstName?.trim().charAt(0) || '';
    const l = lastName?.trim().charAt(0) || '';
    return (f + l).toUpperCase() || 'EM';
  }

  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.api.getEmployeeDetail(id).subscribe({
      next: (employee) => {
        this.employee.set(employee);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'The employee or selected organization record could not be found.'));
      }
    });
    this.api.getJobJourney(id).subscribe({
      next: (entries) => this.jobJourney.set(entries),
      error: () => this.jobJourney.set([])
    });
    void this.offboardingStore.loadOffboarding(id);
  }

  onJobDetailsSave(payload: UpdateEmployeeJobDetailsRequest): void {
    const id = this.employee()?.id;
    if (!id) return;
    this.savingJobDetails.set(true);
    this.api.updateJobDetails(id, payload).subscribe({
      next: () => {
        this.savingJobDetails.set(false);
        this.notifications.success('Job details updated.');
        this.load();
      },
      error: (err) => {
        this.savingJobDetails.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not update job details.'));
      }
    });
  }

  resendInvitation(employeeId: string): void {
    this.resending.set(true);
    this.api.resendInvitation(employeeId).subscribe({
      next: () => {
        this.resending.set(false);
        this.notifications.success('Invitation resent.');
        this.load();
      },
      error: (err) => {
        this.resending.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Could not resend the invitation.'));
      }
    });
  }

  onPositionChanged(): void {
    this.changePositionOpen.set(false);
    this.notifications.success('Position updated.');
    this.load();
  }

  openChangePosition(reason: 'Promotion' | 'Transfer'): void {
    this.changePositionReason.set(reason);
    this.changePositionMenuOpen.set(false);
    this.changePositionOpen.set(true);
  }

  navigateToOffboarding(employeeId: string): void {
    this.changePositionMenuOpen.set(false);
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }

  onPositionPendingApproval(): void {
    this.changePositionOpen.set(false);
    this.notifications.success('Sent for approval.');
    this.load();
  }

  severityBadgeClass(employee: EmployeeDetailResponse): string {
    const severity = attendanceSeverityClass(employee);
    if (severity === 'emp-attention--critical') return 'bg-red-50 text-red-700';
    if (severity === 'emp-attention--warning') return 'bg-amber-50 text-amber-700';
    return 'bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]';
  }
}
```

- [ ] **Step 4: Run to verify the whole spec passes**

Run: `npx ng test --watch=false --include "src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts"`
Expected: all tests pass, including the unchanged Transfer/Promote, offboarding-gating, resend-invitation, breadcrumb and Attendance-today tests. If a previously-existing test fails for a reason other than the tab restructure, do not edit the assertion — investigate: the header/action markup was copied verbatim, so a failure means a copy error.

- [ ] **Step 5: Run the whole people module + a production build**

Run: `npx ng test --watch=false --include "src/app/modules/people/**/*.spec.ts"` — Expected: all pass.
Run: `npx ng build` — Expected: build succeeds (this also catches any unused-import/strict-template error the spec run does not).

- [ ] **Step 6: Commit**

```bash
git branch --show-current && git status --short
git add src/app/modules/people/feature/employee-detail/employee-detail.component.ts src/app/modules/people/feature/employee-detail/employee-detail.component.spec.ts
git commit -m "feat(people): redesign employee detail header and split into Employment/Personal tabs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Live verification (no code)

**Files:** none.

Requires the backend half of Plan 1 running against a dev tenant that has at least one employee with project/module/task data.

- [ ] **Step 1:** Start the frontend via the project's launch config (`preview_start`, name from `.claude/launch.json`; the app serves on `https://onexso.com:4200`, tenant subdomains per the dev-root-domain convention) and sign in as a dev-tenant user with `employees:read`.
- [ ] **Step 2:** Open `People → Employees → <an employee with work data>`. Verify: new header (name, number chip, position, dept • company, email, key facts, actions); **Employment** tab is default; Work Network graph renders with the employee centred showing name + position; projects/modules/tasks styled per legend; hover dims unrelated nodes; dragging a node moves it and does not navigate; clicking a project/module/task navigates to `/work/:id/board` or the module tree; `read_console_messages` shows no errors; `read_network_requests` shows `GET …/employees/{id}/work-graph` → 200 and it is NOT re-issued when switching tabs back and forth.
- [ ] **Step 3:** Open an employee with no Work Management data → the widget shows "This employee is not part of any project yet." and the rest of the tab is intact.
- [ ] **Step 4:** As a caller **without** coverage over an employee (or with the backend returning 403 for the widget) → "You do not have access to this section." in the widget only. Switch to **Personal** → personal info, emergency contacts render; payroll appears only for a caller with `employees:read:sensitive`.
- [ ] **Step 5:** Resize to mobile (`resize_window` preset `mobile`) → no horizontal page scroll; header stacks; graph scales inside its card.
- [ ] **Step 6:** Report results faithfully (what was verified, what was not — e.g. if no dev employee has Work Management data, say the populated-graph check was not possible). Take a screenshot of the populated graph for the record.

---

## Self-review (against the spec)

- §4.1-4.5 (module = objective; default objective skipped; flat modules; 60 cap; coverage access): backend plan; frontend consumes `hiddenTaskCount` (Task 4 note) and renders module role styles (Task 2/4).
- §4.7 (no `rxResource`): widgets use Observable → signals (Task 6 `loadGraph`).
- §5 contract: model in Task 1 mirrors it exactly (`role`, `status`, `hiddenTaskCount`, link kinds).
- §7: tabs Employment/Personal (Task 7), header with key facts and existing actions (Task 7), attendance strip kept (Task 7), `WidgetCardComponent` (Task 3), graph with `d3-force` (Tasks 2/4), Employment Record + Work Arrangement cards (Task 5), payroll gating unchanged (Task 6/7), `d3-force` dependency (Task 2).
- §3 deferrals honoured: no time zone/schedule (Task 5 comment), no Overview tab, no Team Memberships, no "Edit Employee" button.
- Type/name consistency: `getWorkGraph` (T1) used in T6 + T7 spec; `layoutWorkGraph/nodeClass/GraphNode/GraphLink` (T2) used in T4; `WidgetState`/`app-widget-card` inputs `title|state|errorMessage|emptyMessage` + `(retry)` (T3) used in T6; `formatTenure/primaryLocationLabel` (T5) used in T5 card + T6; `app-employee-employment-tab` / `app-employee-personal-tab` selectors (T6) used in T7 template and spec; `activeTab` values `'employment' | 'personal'` consistent T7 template/spec.
- Verified by reading source (not compile-checked): `EmployeeJobInfoComponent` inputs/outputs; `ErrorStateComponent` inputs (Task 3 step 3 re-confirms the button selector); existing spec's `WorkModeStore` stub requirement; `CardComponent` `title` input; work routes (`/work/:id/board`, `/work/:id/milestones/:milestoneId/tree`). The code in this plan has not been built — the executor's first test run is the first compile; fix compile errors by aligning to the real signatures, not by weakening tests.
