import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface SubMenuTab {
  label: string;
  segment: string;
  /** Board/Backlog/Settings moved to project-level routes (work/:id/<segment>) and are no
   *  longer nested under milestones/:milestoneId - their link must not include the milestoneId. */
  projectLevel?: boolean;
}

const BASE_TABS: SubMenuTab[] = [
  { label: 'Tree', segment: 'tree' },
  { label: 'Board', segment: 'board', projectLevel: true },
  { label: 'Backlog', segment: 'backlog', projectLevel: true },
  { label: 'My Task', segment: 'my-task' },
  { label: 'List', segment: 'list' },
  { label: 'Approvals', segment: 'approvals' },
  { label: 'Calendar', segment: 'calendar' }
];

const SETTINGS_TAB: SubMenuTab = { label: 'Settings', segment: 'settings', projectLevel: true };

@Component({
  selector: 'app-milestone-sub-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="mb-2">
      <nav class="flex gap-1 border-b border-[var(--color-border)]" data-testid="sub-menu-tabs">
        @for (tab of tabs(); track tab.segment) {
          <a
            [routerLink]="tab.projectLevel ? [tab.segment] : ['milestones', milestoneId(), tab.segment]"
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
                @case ('approvals') {
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12l2.5 2.5L16 9" />
                }
                @case ('calendar') {
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M8 4v-2M16 4v-2" />
                }
                @case ('settings') {
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
  isOwner = input(false);

  readonly tabs = computed(() => (this.isOwner() ? [...BASE_TABS, SETTINGS_TAB] : BASE_TABS));
}
