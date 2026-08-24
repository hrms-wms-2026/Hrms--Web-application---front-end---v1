# Project Detail Milestone Tree Explorer — Part 3: Routing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Part 1's `MilestoneSubMenuComponent`/`MilestoneComingSoonTabComponent` and Part 2's `MilestoneTreeTabComponent` into real nested routes, and rework `ProjectDetailComponent` from "owns the tree/detail state directly" into "permanent shell (header + milestone row) around a `<router-outlet>`" — closing the loop the design doc describes. Also fixes the pre-existing Project List back-navigation scroll-position gap.

**Architecture:** `work.routes.ts` gains a `milestones/:milestoneId` child route under `:id`, with a `redirectTo: 'tree'` default and 5 leaf routes (`tree` → Part 2's component, `board`/`backlog`/`my-task`/`list` → Part 1's stub, each tagged with `data: { title }`). `ProjectDetailComponent` no longer calls `loadMilestoneSubtree`/owns `selectedMilestoneId` — it tracks `activeMilestoneId` from the child route (via `Router` events, since it's read-only context for the shell) and navigates instead of loading data directly. `app.config.ts` gains `withRouterConfig({ paramsInheritanceStrategy: 'always' })` (so `MilestoneTreeTabComponent`'s `paramMap` actually inherits `milestoneId` from its parent route segment) and `withInMemoryScrolling(...)` (Project List scroll restoration).

**Tech Stack:** Angular 21 Router (`RouterOutlet`, nested `children`, `withRouterConfig`, `withInMemoryScrolling`), Vitest + Angular TestBed.

**Design doc:** `docs/superpowers/specs/next/2026-08-11-project-detail-milestone-tree-explorer-design.md`
**Depends on:** Part 1 (`MilestoneSubMenuComponent`, `MilestoneComingSoonTabComponent`) and Part 2 (`MilestoneTreeTabComponent`, `ProjectDetailStore.loadNodeDetail`/`clearNodeDetail`) — both must be complete before starting this part.

## Global Constraints

- `ProjectDetailComponent`'s project header card and milestone card row must **never** unmount or reload when switching sub-tabs or milestones — only the `<router-outlet>` content below them changes. This is the entire point of the nested-route design (see the design doc's "Prior-decision reconciliation" section) — it must look and behave identically to the old inline panel from the outside, with only the URL now reflecting state.
- Clicking a different milestone card always navigates to that milestone's `tree` sub-route (sub-tab resets to Tree on milestone change).
- Landing on bare `/work/:id` (no milestone in the URL) auto-navigates to the first milestone's `tree` route with `replaceUrl: true` — same auto-select-first-milestone behavior the module already has, now expressed as a navigation.
- An already-deep-linked URL (`/work/:id/milestones/:milestoneId/<tab>`) must **not** be overridden by the auto-select-first-milestone logic.
- No `any` types in production code (test file stub objects excepted, matching this module's existing convention).

---

### Task 1: `app.config.ts` — param inheritance + scroll restoration

**Files:**
- Modify: `src/app/app.config.ts`
- Create: `src/app/app.config.spec.ts`

**Interfaces:**
- Consumes: `withRouterConfig`, `withInMemoryScrolling` from `@angular/router` (both existing Angular Router APIs, no version bump needed — already on Angular 21 per `package.json`).
- Produces: `appConfig.providers` now includes a router configured with `paramsInheritanceStrategy: 'always'` (required for Part 2's `MilestoneTreeTabComponent` to read the inherited `milestoneId` param) and in-memory scroll restoration (fixes the Project List back-navigation scroll gap).

- [ ] **Step 1: Write the failing test**

Create `src/app/app.config.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ROUTER_CONFIGURATION } from '@angular/router';
import { appConfig } from './app.config';

describe('appConfig', () => {
  it('configures the router with param inheritance enabled, so nested milestone tabs can read the ancestor milestoneId param', () => {
    TestBed.configureTestingModule({ providers: appConfig.providers });
    const routerConfig = TestBed.inject(ROUTER_CONFIGURATION);
    expect(routerConfig.paramsInheritanceStrategy).toBe('always');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/app.config.spec.ts`
Expected: FAIL — `routerConfig.paramsInheritanceStrategy` is `undefined` (default is `'emptyOnly'`)

- [ ] **Step 3: Update `app.config.ts`**

Replace the full contents of `src/app/app.config.ts`:

```typescript
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, withRouterConfig } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { APP_RUNTIME_CONFIG, appRuntimeConfig } from './core/config/app.config';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { correlationInterceptor } from './core/interceptors/correlation.interceptor';
import { csrfInterceptor } from './core/interceptors/csrf.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled' }),
      withRouterConfig({ paramsInheritanceStrategy: 'always' })
    ),
    provideHttpClient(
      withInterceptors([authInterceptor, correlationInterceptor, csrfInterceptor, errorInterceptor])
    ),
    {
      provide: APP_RUNTIME_CONFIG,
      useValue: appRuntimeConfig,
    }
  ]
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/app.config.spec.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Manually verify scroll restoration**

Run: `npm run start`, open the app, go to Project List, scroll down, open a project (Project Detail), click back. Expected: Project List is scrolled back to where you left it, not reset to the top. (No automated test for this specific browser behavior — `withInMemoryScrolling` wraps a browser-only `ViewportScroller` API not meaningfully testable in JSDOM; `paramsInheritanceStrategy`, the part this task actually changes for the milestone-tree feature, is covered by Step 1-4's test.)

- [ ] **Step 6: Commit**

```bash
git add src/app/app.config.ts src/app/app.config.spec.ts
git commit -m "feat(app): enable router param inheritance and scroll restoration"
```

---

### Task 2: `work.routes.ts` — nested milestone tab routes

**Files:**
- Modify: `src/app/modules/work/work.routes.ts`
- Modify: `src/app/modules/work/work.routes.spec.ts`

**Interfaces:**
- Consumes: `MilestoneTreeTabComponent` (Part 2), `MilestoneComingSoonTabComponent` (Part 1) — both as lazy `loadComponent` imports.
- Produces: `WORK_ROUTES` with `:id`'s `children` containing a `milestones/:milestoneId` route with 6 sub-entries (`''` redirect + 5 tabs). Consumed by `ProjectDetailComponent` (Task 3, this part) via its `<router-outlet>`.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/app/modules/work/work.routes.spec.ts`:

```typescript
import { WORK_ROUTES } from './work.routes';

describe('WORK_ROUTES', () => {
  it('has an empty-path route and a :id route', () => {
    expect(WORK_ROUTES.find((r) => r.path === '')).toBeTruthy();
    expect(WORK_ROUTES.find((r) => r.path === ':id')).toBeTruthy();
  });

  it('nests milestones/:milestoneId under :id, redirecting the empty path to tree', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    expect(milestoneRoute).toBeTruthy();

    const emptyChild = milestoneRoute.children!.find((r) => r.path === '')!;
    expect(emptyChild.redirectTo).toBe('tree');
    expect(emptyChild.pathMatch).toBe('full');
  });

  it('registers all five tab routes, in order', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    const paths = milestoneRoute.children!.map((r) => r.path);
    expect(paths).toEqual(['', 'tree', 'board', 'backlog', 'my-task', 'list']);
  });

  it('tags each stub tab route with its own title in route data', () => {
    const idRoute = WORK_ROUTES.find((r) => r.path === ':id')!;
    const milestoneRoute = idRoute.children!.find((r) => r.path === 'milestones/:milestoneId')!;
    const byPath = (path: string) => milestoneRoute.children!.find((r) => r.path === path)!;

    expect(byPath('board').data).toEqual({ title: 'Board' });
    expect(byPath('backlog').data).toEqual({ title: 'Backlog' });
    expect(byPath('my-task').data).toEqual({ title: 'My Task' });
    expect(byPath('list').data).toEqual({ title: 'List' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/modules/work/work.routes.spec.ts`
Expected: FAIL — `idRoute.children` is `undefined`

- [ ] **Step 3: Update `work.routes.ts`**

Replace the full contents of `src/app/modules/work/work.routes.ts`:

```typescript
import { Routes } from '@angular/router';

export const WORK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./feature/project-list/project-list.component').then((m) => m.ProjectListComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./feature/project-detail/project-detail.component').then((m) => m.ProjectDetailComponent),
    children: [
      {
        path: 'milestones/:milestoneId',
        children: [
          { path: '', redirectTo: 'tree', pathMatch: 'full' },
          {
            path: 'tree',
            loadComponent: () =>
              import('./feature/milestone-tree-tab/milestone-tree-tab.component').then((m) => m.MilestoneTreeTabComponent)
          },
          {
            path: 'board',
            loadComponent: () =>
              import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent),
            data: { title: 'Board' }
          },
          {
            path: 'backlog',
            loadComponent: () =>
              import('./feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component').then((m) => m.MilestoneComingSoonTabComponent),
            data: { title: 'Backlog' }
          },
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
          }
        ]
      }
    ]
  }
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/modules/work/work.routes.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/work.routes.ts src/app/modules/work/work.routes.spec.ts
git commit -m "feat(work): nest milestones/:milestoneId tab routes under project detail"
```

---

### Task 3: Rework `ProjectDetailComponent` into a shell

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts` (full rewrite)
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.html` (full rewrite)
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts` (full rewrite)

**Interfaces:**
- Consumes: `MilestoneSubMenuComponent` (Part 1, `milestoneId`/`milestoneTitle` inputs), `RouterOutlet`, `Router.navigate(...)`, `Router.events` (`NavigationEnd`), `ActivatedRoute.snapshot.firstChild`. `ProjectDetailStore.loadProject`/`loadMyMilestones`/`getMilestoneDetail`/`editMilestone`/`achieveMilestone`/`unachieveMilestone`/`milestoneActionError` (all existing, unchanged — the settings-modal edit/achieve flow is untouched by this rework).
- Produces: `ProjectDetailComponent` with `activeMilestoneId = signal<string | null>(null)` and `activeMilestoneTitle = computed(...)`, both read by the template to drive `MilestoneSubMenuComponent` and the milestone card row's `[selected]` highlight.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ProjectDetailComponent } from './project-detail.component';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { ProjectDetail } from '../../models/project.model';
import { Milestone } from '../../models/milestone.model';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;
  let storeStub: any;
  let routerStub: any;
  let routeStub: any;
  let routerEvents: Subject<unknown>;

  const project: ProjectDetail = {
    id: 'p1', name: 'Website Revamp', identifier: 'WEB', categoryId: 'cat1', leadId: 'u1',
    startDate: '2026-08-01', targetDate: '2026-12-01', color: null, isActive: true,
    allocatedHours: 40, completedHours: 0, isLead: true, isAchieved: false, achievedAt: null,
    description: 'Rebuild the site', actualHours: 0, createdAt: '2026-08-01T00:00:00Z', updatedAt: null
  };

  const milestone: Milestone = {
    objectiveId: 'o1', projectId: 'p1', parentObjectiveId: null, isDefault: true, title: 'Default',
    ownerId: 'u1', ownerName: 'Jane Doe', reportingManagerId: null, reportingManagerName: null,
    startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, completedHours: 0,
    objectiveIsActive: true, isAchieved: false, achievedAt: null, membershipIsActive: true, membershipRemovedAt: null,
    isOwner: true
  };

  const milestone2: Milestone = { ...milestone, objectiveId: 'o2', title: 'Second', isDefault: false };

  function setup(firstChildMilestoneId: string | null): void {
    routerEvents = new Subject();
    routerStub = { navigate: vi.fn(), events: routerEvents.asObservable() };
    routeStub = {
      paramMap: of({ get: (key: string) => (key === 'id' ? 'p1' : null) }),
      snapshot: {
        firstChild: firstChildMilestoneId
          ? { paramMap: { get: (key: string) => (key === 'milestoneId' ? firstChildMilestoneId : null) } }
          : null
      }
    };

    TestBed.configureTestingModule({
      imports: [ProjectDetailComponent],
      providers: [
        { provide: ProjectDetailStore, useValue: storeStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: Router, useValue: routerStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
  }

  beforeEach(() => {
    storeStub = {
      project: () => project,
      projectLoading: () => false,
      projectError: () => null,
      milestones: () => [milestone, milestone2],
      milestonesLoading: () => false,
      milestonesError: () => null,
      loadProject: vi.fn().mockResolvedValue(undefined),
      loadMyMilestones: vi.fn().mockResolvedValue(undefined),
      getMilestoneDetail: vi.fn().mockResolvedValue(null),
      editMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      achieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      unachieveMilestone: vi.fn().mockResolvedValue({ success: true, pending: false }),
      milestoneActionError: () => null
    };
  });

  it('loads the project and its milestones for the routed id', async () => {
    setup(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(storeStub.loadProject).toHaveBeenCalledWith('p1');
    expect(storeStub.loadMyMilestones).toHaveBeenCalledWith('p1');
  });

  it('renders project name and milestone cards', async () => {
    setup('o1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Website Revamp');
    expect(fixture.nativeElement.textContent).toContain('Default');
  });

  it("navigates to the first milestone's tree route when landing with no milestone in the URL", async () => {
    setup(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(routerStub.navigate).toHaveBeenCalledWith(
      ['milestones', 'o1', 'tree'],
      expect.objectContaining({ replaceUrl: true })
    );
  });

  it('does not override an already-deep-linked milestone', async () => {
    setup('o2');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it('does not attempt to navigate when there are no milestones', async () => {
    storeStub.milestones = () => [];
    setup(null);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(routerStub.navigate).not.toHaveBeenCalled();
  });

  it("navigates to the clicked milestone's tree route, resetting the sub-tab", () => {
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSelected(milestone2);

    expect(routerStub.navigate).toHaveBeenCalledWith(
      ['milestones', 'o2', 'tree'],
      expect.objectContaining({ relativeTo: expect.anything() })
    );
  });

  it('reflects the active milestone id from the route on init, and updates it on NavigationEnd', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.componentInstance.activeMilestoneId()).toBe('o1');

    routeStub.snapshot.firstChild = { paramMap: { get: (key: string) => (key === 'milestoneId' ? 'o2' : null) } };
    routerEvents.next(new NavigationEnd(1, '/work/p1/milestones/o2/tree', '/work/p1/milestones/o2/tree'));

    expect(fixture.componentInstance.activeMilestoneId()).toBe('o2');
  });

  it('renders the sub-menu once a milestone is active', () => {
    setup('o1');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-sub-menu')).not.toBeNull();
  });

  it('does not render the sub-menu when there is no active milestone', () => {
    storeStub.milestones = () => [];
    setup(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-milestone-sub-menu')).toBeNull();
  });

  it('opens the settings modal and patches in the full detail once fetched', async () => {
    const detail = { id: 'o1', title: 'Default', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40, isAchieved: false, isDefault: true };
    storeStub.getMilestoneDetail = vi.fn().mockResolvedValue(detail);
    setup('o1');
    fixture.detectChanges();

    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
    expect(storeStub.getMilestoneDetail).toHaveBeenCalledWith('o1');

    await Promise.resolve();
    await Promise.resolve();

    expect((fixture.componentInstance.milestoneSettingsInitialValue() as any)?.description).toBe('Full scope');
  });

  it('saves fields only when the Achieved toggle is untouched', async () => {
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: false, achieved: false
    });

    expect(storeStub.editMilestone).toHaveBeenCalledWith('o1', {
      title: 'Default v2', description: 'Full scope', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40
    });
    expect(storeStub.achieveMilestone).not.toHaveBeenCalled();
    expect(storeStub.unachieveMilestone).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(false);
  });

  it('edits then achieves, in that order, when the toggle is turned on', async () => {
    const calls: string[] = [];
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    storeStub.achieveMilestone = vi.fn().mockImplementation(async () => { calls.push('achieve'); return { success: true, pending: false }; });
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: true
    });

    expect(calls).toEqual(['edit', 'achieve']);
  });

  it('unachieves then edits, in that order, when the toggle is turned off', async () => {
    const calls: string[] = [];
    storeStub.unachieveMilestone = vi.fn().mockImplementation(async () => { calls.push('unachieve'); return { success: true, pending: false }; });
    storeStub.editMilestone = vi.fn().mockImplementation(async () => { calls.push('edit'); return { success: true, pending: false }; });
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(calls).toEqual(['unachieve', 'edit']);
  });

  it('stops the sequence and keeps the modal open if the first step fails', async () => {
    storeStub.unachieveMilestone = vi.fn().mockResolvedValue({ success: false, pending: false });
    const editSpy = vi.fn();
    storeStub.editMilestone = editSpy;
    setup('o1');
    fixture.detectChanges();
    fixture.componentInstance.onMilestoneSettingsRequested(milestone);

    await fixture.componentInstance.onMilestoneSettingsSaved({
      fields: { title: 'Default', description: '', startDate: '2026-08-01', endDate: '2026-12-01', allocatedHours: 40 },
      achievedChanged: true, achieved: false
    });

    expect(editSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.milestoneSettingsOpen()).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`
Expected: FAIL — `activeMilestoneId` does not exist, `app-milestone-sub-menu` not rendered, old `selectedMilestoneId`/subtree-based tests removed.

- [ ] **Step 3: Rewrite the implementation**

Replace the full contents of `src/app/modules/work/feature/project-detail/project-detail.component.ts`:

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProjectDetailStore } from '../../state/project-detail.store';
import { MilestoneCardComponent } from '../../ui/milestone-card/milestone-card.component';
import { MilestoneSettingsModalComponent } from '../../ui/milestone-settings-modal/milestone-settings-modal.component';
import { MilestoneSubMenuComponent } from '../../ui/milestone-sub-menu/milestone-sub-menu.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { CardComponent } from '../../../../shared/ui/card/card.component';
import { Milestone, ObjectiveDetail } from '../../models/milestone.model';
import { EditObjectiveRequestDto } from '../../models/dto/milestone.dto';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    MilestoneCardComponent, MilestoneSettingsModalComponent, MilestoneSubMenuComponent, CardComponent,
    PageHeaderComponent, LoaderComponent, ErrorStateComponent, EmptyStateComponent, RouterOutlet
  ],
  templateUrl: './project-detail.component.html'
})
export class ProjectDetailComponent implements OnInit {
  readonly store = inject(ProjectDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private projectId = '';

  activeMilestoneId = signal<string | null>(null);
  activeMilestoneTitle = computed(() => {
    const id = this.activeMilestoneId();
    return this.store.milestones().find((m) => m.objectiveId === id)?.title ?? '';
  });

  milestoneSettingsOpen = signal(false);
  milestoneSettingsInitialValue = signal<ObjectiveDetail | null>(null);
  milestoneSettingsSubmitting = signal(false);
  private targetMilestone = signal<Milestone | null>(null);

  constructor() {
    this.activeMilestoneId.set(this.route.snapshot.firstChild?.paramMap.get('milestoneId') ?? null);
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.activeMilestoneId.set(this.route.snapshot.firstChild?.paramMap.get('milestoneId') ?? null);
      });
  }

  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.store.loadProject(this.projectId);
    await this.store.loadMyMilestones(this.projectId);

    if (!this.route.snapshot.firstChild) {
      const milestones = this.store.milestones();
      if (milestones.length > 0) {
        this.router.navigate(['milestones', milestones[0].objectiveId, 'tree'], { relativeTo: this.route, replaceUrl: true });
      }
    }
  }

  onMilestoneSelected(milestone: Milestone): void {
    this.router.navigate(['milestones', milestone.objectiveId, 'tree'], { relativeTo: this.route });
  }

  onMilestoneSettingsRequested(milestone: Milestone): void {
    this.targetMilestone.set(milestone);
    this.milestoneSettingsOpen.set(true);
    this.loadFullMilestoneDetail(milestone.objectiveId);
  }

  private async loadFullMilestoneDetail(id: string): Promise<void> {
    const detail = await this.store.getMilestoneDetail(id);
    if (detail && this.targetMilestone()?.objectiveId === id) {
      this.milestoneSettingsInitialValue.set(detail);
    }
  }

  async onMilestoneSettingsSaved(event: { fields: EditObjectiveRequestDto; achievedChanged: boolean; achieved: boolean }): Promise<void> {
    const milestone = this.targetMilestone();
    if (!milestone) return;
    this.milestoneSettingsSubmitting.set(true);

    if (event.achievedChanged && !event.achieved) {
      const unachieveResult = await this.store.unachieveMilestone(milestone.objectiveId);
      if (!unachieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    const editResult = await this.store.editMilestone(milestone.objectiveId, event.fields);
    if (!editResult.success) {
      this.milestoneSettingsSubmitting.set(false);
      return;
    }

    if (event.achievedChanged && event.achieved) {
      const achieveResult = await this.store.achieveMilestone(milestone.objectiveId);
      if (!achieveResult.success) {
        this.milestoneSettingsSubmitting.set(false);
        return;
      }
    }

    this.milestoneSettingsSubmitting.set(false);
    this.milestoneSettingsOpen.set(false);
    await this.store.loadMyMilestones(this.projectId);
  }

  retryProject(): void {
    this.store.loadProject(this.projectId);
  }

  retryMilestones(): void {
    this.store.loadMyMilestones(this.projectId);
  }
}
```

Replace the full contents of `src/app/modules/work/feature/project-detail/project-detail.component.html`:

```html
@if (store.projectLoading()) {
  <app-loader label="Loading project…" />
} @else if (store.projectError()) {
  <app-error-state [message]="store.projectError()!" [retryable]="true" (retry)="retryProject()" />
} @else if (store.project(); as project) {
  <div class="mb-6">
  <app-card>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-base font-semibold text-[var(--color-text-primary)]">{{ project.name }}</h1>
        <p class="text-xs text-[var(--color-text-secondary)]">{{ project.identifier }} · {{ project.description ?? '' }}</p>
      </div>
      <dl class="flex gap-6 text-sm">
        <div>
          <dt class="text-xs text-[var(--color-text-secondary)]">Start</dt>
          <dd>{{ project.startDate }}</dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-text-secondary)]">Target</dt>
          <dd>{{ project.targetDate }}</dd>
        </div>
        <div>
          <dt class="text-xs text-[var(--color-text-secondary)]">Hours</dt>
          <dd>{{ project.completedHours }} / {{ project.allocatedHours }}</dd>
        </div>
      </dl>
    </div>
  </app-card>
  </div>
}

<h2 class="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">Milestones</h2>

@if (store.milestonesLoading()) {
  <app-loader label="Loading milestones…" />
} @else if (store.milestonesError()) {
  <app-error-state [message]="store.milestonesError()!" [retryable]="true" (retry)="retryMilestones()" />
} @else if (store.milestones().length === 0) {
  <app-empty-state title="No milestones yet" />
} @else {
  <div class="flex gap-4 overflow-x-auto pb-2">
    @for (milestone of store.milestones(); track milestone.objectiveId) {
      <div class="w-48 flex-shrink-0">
        <app-milestone-card
          [milestone]="milestone"
          [selected]="activeMilestoneId() === milestone.objectiveId"
          (viewed)="onMilestoneSelected(milestone)"
          (settingsRequested)="onMilestoneSettingsRequested(milestone)"
        />
      </div>
    }
  </div>

  @if (activeMilestoneId(); as milestoneId) {
    <div class="mt-6">
      <app-milestone-sub-menu [milestoneId]="milestoneId" [milestoneTitle]="activeMilestoneTitle()" />
      <router-outlet />
    </div>
  }
}

<app-milestone-settings-modal
  [open]="milestoneSettingsOpen()"
  [initialValue]="milestoneSettingsInitialValue()"
  [submitting]="milestoneSettingsSubmitting()"
  [errorMessage]="store.milestoneActionError() ?? ''"
  (saved)="onMilestoneSettingsSaved($event)"
  (closed)="milestoneSettingsOpen.set(false)"
/>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/project-detail/
git commit -m "feat(work): rework ProjectDetailComponent into a shell around the milestone tab router-outlet"
```

---

### Task 4: Full module regression check

**Files:** None changed — verification only.

**Interfaces:** N/A.

- [ ] **Step 1: Run the full work module test suite**

Run: `npx vitest run src/app/modules/work`
Expected: PASS — every spec file under `src/app/modules/work`, including `MilestoneCardComponent`, `MilestoneSettingsModalComponent`, `ProjectCardComponent`, `ProjectListComponent`, `ProjectApiService`, `project.mapper`, and all files touched across Parts 1-3.

- [ ] **Step 2: Run the full app build**

Run: `npm run build`
Expected: PASS — no TypeScript errors (confirms every `import`/`loadComponent()` path and every component's `input`/`output` usage across all three parts is correctly typed and wired).

- [ ] **Step 3: Manual smoke test**

Run: `npm run start`, then in the browser:
1. Open a project from Project List. Expected: lands on `.../milestones/<first-id>/tree`, Tree tab active, first milestone's subtree visible (root expanded, deeper levels collapsed), detail panel shows "Select a milestone".
2. Click a tree node with children. Expected: detail panel loads that node's title/dates/progress/hours/description; chevron click on the same node only expands/collapses, does not reload the detail panel.
3. Click a different milestone card in the row. Expected: URL changes to that milestone's `tree` route, tree reloads for the new milestone, sub-tab stays on Tree, project header and milestone card row do not flicker/reload.
4. Click Board/Backlog/My Task/List tabs. Expected: URL changes accordingly, each shows its own "Coming soon" panel, active tab underline moves.
5. Use the browser back button through several of the above steps. Expected: each back step restores the exact previous milestone + tab.
6. Refresh the browser on a `.../milestones/:id/board` URL directly. Expected: page loads directly into that exact tab (not reset to Tree).

- [ ] **Step 4: Commit** (only if Step 3 surfaces a fix)

If manual smoke testing finds an issue, fix it, re-run the affected spec file(s) from Step 1, then:

```bash
git add -u
git commit -m "fix(work): address issue found in milestone tree explorer smoke test"
```

If Step 3 passes cleanly with no changes needed, there is nothing to commit for this task.
