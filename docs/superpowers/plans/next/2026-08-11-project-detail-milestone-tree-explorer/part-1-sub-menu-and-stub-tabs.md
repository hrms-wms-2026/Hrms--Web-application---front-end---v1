# Project Detail Milestone Tree Explorer — Part 1: Sub-Menu + Stub Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the two standalone, presentational pieces of the new milestone sub-menu — the tab-row component and a single reusable "coming soon" stub used by the Board/Backlog/My Task/List tabs — with no routing wiring yet (that's Part 3).

**Architecture:** Two new `ui/` components, one new `feature/` component. `MilestoneComingSoonTabComponent` reads its title from `ActivatedRoute` route `data`, so one component (not four near-duplicates) serves all four stub tabs once Part 3 registers the routes.

**Tech Stack:** Angular 21 standalone components, `input()`/`output()` signals, Angular Router (`RouterLink`/`RouterLinkActive`), Vitest + Angular TestBed.

**Design doc:** `docs/superpowers/specs/next/2026-08-11-project-detail-milestone-tree-explorer-design.md`
**Depends on:** Nothing — both components are self-contained and testable in isolation with stubbed inputs/route data. Part 3 wires them into `work.routes.ts` and `ProjectDetailComponent`'s template.

## Global Constraints

- `feature → ui → state → data-access` layering per `docs/core/ARCHITECTURE.md` §2/§4 — `ui/` components take `input()`/`output()` only, no store injection, no API calls.
- Reuse `app-empty-state` (`src/app/shared/ui/empty-state/empty-state.component.ts`) for the stub tabs, per the user's explicit choice — do not build a new empty-state component.
- Styling uses existing tokens only: `var(--color-border)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-focus-ring)` — no new colors.
- No `any` types. Standalone components. Files/CSS classes `kebab-case`, classes `PascalCase`, signals/variables `camelCase`.

---

### Task 1: `ComingSoonPanelComponent`

**Files:**
- Create: `src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.ts`
- Test: `src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.spec.ts`

**Interfaces:**
- Consumes: `EmptyStateComponent` (`title: input.required<string>()`, `description: input<string>()`), already exists at `src/app/shared/ui/empty-state/empty-state.component.ts`.
- Produces: `ComingSoonPanelComponent` with `title = input.required<string>()`. Consumed by Task 3 (`MilestoneComingSoonTabComponent`) in this same part.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComingSoonPanelComponent } from './coming-soon-panel.component';

describe('ComingSoonPanelComponent', () => {
  let fixture: ComponentFixture<ComingSoonPanelComponent>;

  it('renders the given title with a Coming soon suffix', () => {
    fixture = TestBed.createComponent(ComingSoonPanelComponent);
    fixture.componentRef.setInput('title', 'Board');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Board — Coming soon');
  });

  it('renders a different title for a different tab', () => {
    fixture = TestBed.createComponent(ComingSoonPanelComponent);
    fixture.componentRef.setInput('title', 'Backlog');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Backlog — Coming soon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.spec.ts`
Expected: FAIL — `Cannot find module './coming-soon-panel.component'`

- [ ] **Step 3: Write the implementation**

Create `src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.ts`:

```typescript
import { Component, input } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';

@Component({
  selector: 'app-coming-soon-panel',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `<app-empty-state [title]="title() + ' — Coming soon'" description="This view isn't built yet." />`
})
export class ComingSoonPanelComponent {
  title = input.required<string>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.ts src/app/modules/work/ui/coming-soon-panel/coming-soon-panel.component.spec.ts
git commit -m "feat(work): add ComingSoonPanelComponent for stub milestone tabs"
```

---

### Task 2: `MilestoneComingSoonTabComponent`

**Files:**
- Create: `src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.ts`
- Test: `src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.spec.ts`

**Interfaces:**
- Consumes: `ComingSoonPanelComponent` (Task 1, `title: input.required<string>()`), `ActivatedRoute.snapshot.data['title']` (a `string`, set per-route by Part 3).
- Produces: `MilestoneComingSoonTabComponent`. Registered by Part 3 as the lazy-loaded target for the `board`/`backlog`/`my-task`/`list` routes, each with a different `data: { title: '...' }`.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { MilestoneComingSoonTabComponent } from './milestone-coming-soon-tab.component';

describe('MilestoneComingSoonTabComponent', () => {
  function setup(title: string | undefined): ComponentFixture<MilestoneComingSoonTabComponent> {
    TestBed.configureTestingModule({
      imports: [MilestoneComingSoonTabComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { data: title === undefined ? {} : { title } } } }
      ]
    });
    const fixture = TestBed.createComponent(MilestoneComingSoonTabComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('reads the title from route data and shows it as Coming soon', () => {
    const fixture = setup('Board');
    expect(fixture.nativeElement.textContent).toContain('Board — Coming soon');
  });

  it('reflects a different route data title', () => {
    const fixture = setup('Backlog');
    expect(fixture.nativeElement.textContent).toContain('Backlog — Coming soon');
  });

  it('falls back to a generic title when route data has none', () => {
    const fixture = setup(undefined);
    expect(fixture.nativeElement.textContent).toContain('This view — Coming soon');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.spec.ts`
Expected: FAIL — `Cannot find module './milestone-coming-soon-tab.component'`

- [ ] **Step 3: Write the implementation**

Create `src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.ts`:

```typescript
import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ComingSoonPanelComponent } from '../../ui/coming-soon-panel/coming-soon-panel.component';

@Component({
  selector: 'app-milestone-coming-soon-tab',
  standalone: true,
  imports: [ComingSoonPanelComponent],
  template: `<app-coming-soon-panel [title]="title" />`
})
export class MilestoneComingSoonTabComponent {
  private readonly route = inject(ActivatedRoute);
  readonly title: string = this.route.snapshot.data['title'] ?? 'This view';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.ts src/app/modules/work/feature/milestone-coming-soon-tab/milestone-coming-soon-tab.component.spec.ts
git commit -m "feat(work): add MilestoneComingSoonTabComponent, one component for all 4 stub tabs"
```

---

### Task 3: `MilestoneSubMenuComponent`

**Files:**
- Create: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts`
- Test: `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts`

**Interfaces:**
- Consumes: Angular `RouterLink`/`RouterLinkActive` directives only — no store, no API.
- Produces: `MilestoneSubMenuComponent` with `milestoneId = input.required<string>()` and `milestoneTitle = input.required<string>()`. Consumed by `ProjectDetailComponent` in Part 3, which supplies the currently active milestone's id/title.

- [ ] **Step 1: Write the failing test**

Create `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterLink } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MilestoneSubMenuComponent } from './milestone-sub-menu.component';

describe('MilestoneSubMenuComponent', () => {
  let fixture: ComponentFixture<MilestoneSubMenuComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MilestoneSubMenuComponent],
      providers: [provideRouter([])]
    });
    fixture = TestBed.createComponent(MilestoneSubMenuComponent);
    fixture.componentRef.setInput('milestoneId', 'o1');
    fixture.componentRef.setInput('milestoneTitle', 'Milestone 1');
    fixture.detectChanges();
  });

  it('shows the selected milestone title above the tabs', () => {
    const title = fixture.nativeElement.querySelector('[data-testid="sub-menu-milestone-title"]');
    expect(title.textContent).toContain('Milestone 1');
  });

  it('renders all five tabs in order', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('[data-testid="sub-menu-tab"]'))
      .map((el: any) => el.textContent.trim());
    expect(labels).toEqual(['Tree', 'Board', 'Backlog', 'My Task', 'List']);
  });

  it('builds the correct routerLink target for each tab, relative to the project detail route', () => {
    const links = fixture.debugElement.queryAll(By.directive(RouterLink));
    const targets = links.map((el) => el.injector.get(RouterLink).routerLink);
    expect(targets).toEqual([
      ['milestones', 'o1', 'tree'],
      ['milestones', 'o1', 'board'],
      ['milestones', 'o1', 'backlog'],
      ['milestones', 'o1', 'my-task'],
      ['milestones', 'o1', 'list']
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts`
Expected: FAIL — `Cannot find module './milestone-sub-menu.component'`

- [ ] **Step 3: Write the implementation**

Create `src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts`:

```typescript
import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface SubMenuTab {
  label: string;
  segment: string;
}

const TABS: SubMenuTab[] = [
  { label: 'Tree', segment: 'tree' },
  { label: 'Board', segment: 'board' },
  { label: 'Backlog', segment: 'backlog' },
  { label: 'My Task', segment: 'my-task' },
  { label: 'List', segment: 'list' }
];

@Component({
  selector: 'app-milestone-sub-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="mb-4">
      <p
        class="mb-2 text-sm font-medium text-[var(--color-text-primary)]"
        data-testid="sub-menu-milestone-title"
      >
        {{ milestoneTitle() }}
      </p>
      <nav class="flex gap-1 border-b border-[var(--color-border)]" data-testid="sub-menu-tabs">
        @for (tab of tabs; track tab.segment) {
          <a
            [routerLink]="['milestones', milestoneId(), tab.segment]"
            routerLinkActive="border-b-2 border-[var(--color-focus-ring)] font-semibold text-[var(--color-text-primary)]"
            class="px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            data-testid="sub-menu-tab"
          >{{ tab.label }}</a>
        }
      </nav>
    </div>
  `
})
export class MilestoneSubMenuComponent {
  milestoneId = input.required<string>();
  milestoneTitle = input.required<string>();
  readonly tabs = TABS;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.ts src/app/modules/work/ui/milestone-sub-menu/milestone-sub-menu.component.spec.ts
git commit -m "feat(work): add MilestoneSubMenuComponent (Tree/Board/Backlog/My Task/List tabs)"
```
