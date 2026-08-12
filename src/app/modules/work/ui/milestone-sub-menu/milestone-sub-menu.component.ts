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
    <div class="mb-2">
      <p
        class="mb-1 text-sm font-medium text-[var(--color-text-primary)]"
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
