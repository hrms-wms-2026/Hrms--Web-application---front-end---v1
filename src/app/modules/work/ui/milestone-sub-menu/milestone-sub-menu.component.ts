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
  { label: 'Approvals', segment: 'approvals', projectLevel: true },
  { label: 'Calendar', segment: 'calendar', projectLevel: true }


];

const SETTINGS_TAB: SubMenuTab = { label: 'Settings', segment: 'settings', projectLevel: true };

@Component({
  selector: 'app-milestone-sub-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="w-full">
      <nav class="flex w-full gap-1 overflow-x-auto" data-testid="sub-menu-tabs">
        @for (tab of tabs(); track tab.segment) {
          <a
            [routerLink]="tab.projectLevel ? [tab.segment] : ['milestones', milestoneId(), tab.segment]"
            routerLinkActive="active-tab"
            [attr.aria-label]="tab.segment === 'approvals' && pendingApprovalCount() > 0
              ? 'Approvals, ' + pendingApprovalCount() + ' pending'
              : tab.label"
            class="sub-menu-tab flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
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
            @if (tab.segment === 'approvals' && pendingApprovalCount() > 0) {
              <span
                class="approvals-pending-dot"
                data-testid="approvals-pending-indicator"
                [attr.title]="pendingApprovalCount() + ' pending approval' + (pendingApprovalCount() === 1 ? '' : 's')"
                aria-hidden="true"
              ></span>
            }
          </a>
        }
      </nav>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      nav {
        scrollbar-width: none;
      }
      nav::-webkit-scrollbar {
        display: none;
      }
      .sub-menu-tab {
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
      }
      .sub-menu-tab.active-tab {
        border-bottom-color: var(--color-focus-ring);
        font-weight: 600;
        color: var(--color-text-primary);
      }
      .approvals-pending-dot {
        width: 7px;
        height: 7px;
        flex: 0 0 7px;
        border-radius: 999px;
        background: var(--color-danger, #dc2626);
      }
    `
  ]
})
export class MilestoneSubMenuComponent {
  milestoneId = input.required<string>();
  milestoneTitle = input.required<string>();
  isOwner = input(false);
  pendingApprovalCount = input(0);

  readonly tabs = computed(() => (this.isOwner() ? [...BASE_TABS, SETTINGS_TAB] : BASE_TABS));
}
