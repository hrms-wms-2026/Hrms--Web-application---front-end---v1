# Milestone Card Uniform Height + Default-Selected First Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every milestone card in the horizontal-scroll row the same height (host-level `h-full` stretch, not a fixed pixel value), and auto-select the first milestone on Project Detail load so the inline detail panel isn't empty by default.

**Architecture:** `CardComponent` and `MilestoneCardComponent` both gain `host: { class: 'block h-full' }` so their custom-element tags claim 100% of the height their parent already offers (a flex row's direct children stretch to the tallest sibling by default — that part already works; the gap was every level below the wrapper defaulting to inline/content-sized instead of claiming it). `ProjectDetailComponent.ngOnInit` calls the same `onMilestoneSelected` a click already uses, once milestones load.

**Tech Stack:** Angular 21, Vitest.

**Design doc:** `docs/superpowers/specs/next/2026-08-10-milestone-card-uniform-height-and-default-select-design.md`

## Global Constraints

- No fixed pixel height anywhere — the row's height still tracks whichever milestone card has the most content.
- `ProjectCardComponent`/`ProjectListComponent` are out of scope — not touched.

---

### Task 1: `CardComponent` + `MilestoneCardComponent` — host-level `h-full` stretch

**Files:**
- Modify: `src/app/shared/ui/card/card.component.ts`
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.ts`
- Modify: `src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts`

**Interfaces:** No public API change — `CardComponent`/`MilestoneCardComponent`'s inputs/outputs are unchanged, only their own host/template classes change.

- [ ] **Step 1: Write the failing test**

Add this test to `milestone-card.component.spec.ts`, after the existing `'applies a highlight class when selected'` test:

```typescript
  it('fills the height of its container (host + section both claim h-full)', () => {
    setup(baseMilestone);
    const hostElement: HTMLElement = fixture.nativeElement;
    expect(hostElement.className).toContain('h-full');
    const section = fixture.nativeElement.querySelector('app-card section');
    expect(section?.className).toContain('h-full');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: FAIL — neither the host nor the section carries `h-full` yet.

- [ ] **Step 3: Update `CardComponent`**

Replace `card.component.ts` with:

```typescript
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <section class="flex h-full flex-col rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      @if (title()) {
        <h2 class="mb-3 text-lg font-semibold text-[var(--color-text-primary)]">{{ title() }}</h2>
      }
      <ng-content />
    </section>
  `
})
export class CardComponent {
  title = input<string>('');
}
```

- [ ] **Step 4: Update `MilestoneCardComponent`'s host and root wrapper**

In `milestone-card.component.ts`, add `host: { class: 'block h-full' }` to the `@Component` decorator (alongside `selector`/`standalone`/`imports`/`template`), and change the template's root `<div data-testid="milestone-card" class="relative cursor-pointer rounded-lg transition-shadow" ...>` to add `h-full`:

```typescript
@Component({
  selector: 'app-milestone-card',
  standalone: true,
  host: { class: 'block h-full' },
  imports: [CardComponent],
  template: `
    <div
      data-testid="milestone-card"
      class="relative h-full cursor-pointer rounded-lg transition-shadow"
      [class.ring-2]="selected()"
      [class.ring-[var(--color-focus-ring)]]="selected()"
      (click)="viewed.emit()"
    >
```

(Rest of the template and class body unchanged — only the `host` property and the root `<div>`'s class list change.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx ng test --include src/app/modules/work/ui/milestone-card/milestone-card.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 6: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions. `CardComponent` is shared (also used by `ProjectCardComponent`/other consumers) — `host: { class: 'block h-full' }` only has an effect where a parent already offers a height (flex/grid stretch context); elsewhere `height: 100%` on a block element with no explicit-height ancestor has no visible effect, so this should not change any other screen's layout. Confirm via the full suite, not just the `work` module, if any non-`work` spec renders `CardComponent`.

- [ ] **Step 7: Commit**

```bash
git add src/app/shared/ui/card/card.component.ts src/app/modules/work/ui/milestone-card/
git commit -m "feat(work): stretch milestone cards to uniform height via host-level h-full"
```

---

### Task 2: Auto-select the first milestone on load

**Files:**
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.ts`
- Modify: `src/app/modules/work/feature/project-detail/project-detail.component.spec.ts`

**Interfaces:** No new public methods — `ngOnInit`'s behavior changes only.

- [ ] **Step 1: Write the failing test**

Add this test to `project-detail.component.spec.ts`, after the existing `'resets stale subtree state on init'` test:

```typescript
  it('auto-selects the first milestone once milestones load', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.selectedMilestoneId()).toBe('o1');
    expect(storeStub.loadMilestoneSubtree).toHaveBeenCalledWith('o1');
  });

  it('does not attempt to select anything when there are no milestones', async () => {
    storeStub.milestones = () => [];
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.selectedMilestoneId()).toBeNull();
    expect(storeStub.loadMilestoneSubtree).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: FAIL — `selectedMilestoneId()` stays `null` and `loadMilestoneSubtree` is never called today, since `ngOnInit` doesn't auto-select yet.

- [ ] **Step 3: Update `ngOnInit`**

In `project-detail.component.ts`, replace the `ngOnInit` method:

```typescript
  async ngOnInit(): Promise<void> {
    const paramMap = await firstValueFrom(this.route.paramMap);
    this.projectId = paramMap.get('id')!;
    this.selectedMilestoneId.set(null);
    this.store.clearSelectedSubtree();
    this.store.loadProject(this.projectId);
    await this.store.loadMyMilestones(this.projectId);
    const milestones = this.store.milestones();
    if (milestones.length > 0) {
      this.onMilestoneSelected(milestones[0]);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --include src/app/modules/work/feature/project-detail/project-detail.component.spec.ts --watch=false`
Expected: PASS.

- [ ] **Step 5: Run the full work module suite**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/app/modules/work/feature/project-detail/project-detail.component.ts src/app/modules/work/feature/project-detail/project-detail.component.spec.ts
git commit -m "feat(work): auto-select the first milestone on Project Detail load"
```

---

### Task 3: Move plan+spec to finished, sync SUMMARY.md files

**Files:**
- Modify: `docs/superpowers/plans/SUMMARY.md`, `docs/superpowers/plans/finished/SUMMARY.md`
- Modify: `docs/superpowers/specs/SUMMARY.md`, `docs/superpowers/specs/next/SUMMARY.md`, `docs/superpowers/specs/finished/SUMMARY.md`
- Move: this plan and its design doc into `finished/2026-08-10/` (already exists this session)

- [ ] **Step 1: Move the files**

```bash
git mv docs/superpowers/plans/next/2026-08-10-milestone-card-uniform-height-and-default-select.md docs/superpowers/plans/finished/2026-08-10/
git mv docs/superpowers/specs/next/2026-08-10-milestone-card-uniform-height-and-default-select-design.md docs/superpowers/specs/finished/2026-08-10/
```

- [ ] **Step 2: Update all five SUMMARY.md files**

Follow the exact format already established for the other four 2026-08-10 entries this session.

- [ ] **Step 3: Run the full work module suite one last time**

Run: `npx ng test --include "src/app/modules/work/**/*.spec.ts" --watch=false`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/plans docs/superpowers/specs
git commit -m "docs: move milestone card uniform height + default-select plan+spec to finished/2026-08-10"
```
