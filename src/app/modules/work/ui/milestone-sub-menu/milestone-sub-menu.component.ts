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
            class="flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            data-testid="sub-menu-tab"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" [attr.data-testid]="'sub-menu-tab-icon-' + tab.segment">
              @switch (tab.segment) {
                @case ('tree') {
                  <circle cx="6" cy="5" r="2" />
                  <circle cx="6" cy="19" r="2" />
                  <circle cx="18" cy="12" r="2" />
                  <path d="M6 7v10M6 12h10" />
                }
                @case ('board') {
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M9 4v16M15 4v16" />
                }
                @case ('backlog') {
                  <path d="M4 6h16M4 12h16M4 18h10" />
                }
                @case ('my-task') {
                  <path d="M9 11l3 3 8-8" />
                  <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />
                }
                @case ('list') {
                  <circle cx="4.5" cy="6" r="1" />
                  <circle cx="4.5" cy="12" r="1" />
                  <circle cx="4.5" cy="18" r="1" />
                  <path d="M9 6h11M9 12h11M9 18h11" />
                }
              }
            </svg>
            {{ tab.label }}
          </a>
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
