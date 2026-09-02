import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ModalComponent, ModalSize } from '../modal/modal.component';
import { TabsComponent, TabOption } from '../tabs/tabs.component';
import { PreferenceSubTab } from './preference-subtab.model';

export interface PreferenceTab {
  id: string;
  label: string;
  icon?: 'palette' | 'bell' | 'user' | 'cog' | 'user-check' | 'briefcase' | 'credit-card' | 'shield';
}

const TAB_ICON_PATHS: Record<NonNullable<PreferenceTab['icon']>, string> = {
  palette: 'M12 21a9 9 0 1 1 0-18c4.97 0 9 3.58 9 8 0 2.2-1.5 4-3.5 4-1 0-1.5-.5-2-1-.4-.4-.8-.9-1.5-.9H12a2 2 0 0 0-2 2c0 2.5 2 3.9 2 5.9Z',
  user: 'M20 21a8 8 0 1 0-16 0 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'user-check': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M17 11l2 2 4-4',
  briefcase: 'M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16 M2 7h20v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Z',
  'credit-card': 'M2 10h20 M2 5h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z'
};

@Component({
  selector: 'app-preferences-modal',
  standalone: true,
  imports: [ModalComponent, TabsComponent],
  template: `
    <app-modal [open]="open()" [title]="title()" [size]="size()" (closed)="closed.emit()">
      <div class="preferences-container" [class.preferences-container--no-sidebar]="tabs().length === 0">
        @if (tabs().length > 0) {
          <nav class="preferences-sidebar" aria-label="Preferences categories">
            @for (tab of tabs(); track tab.id) {
              <button
                type="button"
                class="preferences-tab-btn"
                [class.preferences-tab-btn--active]="activeTabId() === tab.id"
                [attr.aria-selected]="activeTabId() === tab.id"
                [attr.aria-expanded]="hasSubTabs(tab.id) && isProfileExpanded()"
                (click)="selectTab(tab.id)"
              >
                <span class="preferences-tab-btn__main">
                  <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path [attr.d]="tabIconPath(tab.icon)"/>
                  </svg>
                  <span>{{ tab.label }}</span>
                </span>

                @if (hasSubTabs(tab.id)) {
                  <svg
                    class="preferences-tab-chevron"
                    [class.preferences-tab-chevron--open]="isProfileExpanded()"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                }
              </button>

              @if (tab.id === subTabsForTabId() && isProfileExpanded()) {
                <div class="preferences-subtabs" role="group" [attr.aria-label]="tab.label + ' sections'">
                  <app-tabs
                    [tabs]="subTabOptions()"
                    [value]="activeSubTabId()"
                    [ariaLabel]="tab.label + ' sections'"
                    (valueChange)="selectSubTab($event)"
                  />
                </div>
              }
            }
          </nav>
        }

        <div class="preferences-content">
          <ng-content />
        </div>
      </div>
    </app-modal>
  `,
  styleUrl: './preferences-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreferencesModalComponent {
  readonly open = input(false);
  readonly title = input<string>('Preferences');
  readonly tabs = input<readonly PreferenceTab[]>([]);
  readonly activeTabId = input<string>('');
  readonly subTabs = input<readonly PreferenceSubTab[]>([]);
  readonly subTabsForTabId = input<string>('profile');
  readonly activeSubTabId = input<string>('');
  readonly size = input<ModalSize>('2xl');
  readonly activeTabIdChange = output<string>();
  readonly activeSubTabIdChange = output<string>();
  readonly closed = output<void>();

  readonly subTabOptions = computed<TabOption[]>(() =>
    this.subTabs().map((subTab) => ({ value: subTab.id, label: subTab.label }))
  );

  selectTab(id: string): void {
    this.activeTabIdChange.emit(id);
  }

  selectSubTab(id: string): void {
    this.activeSubTabIdChange.emit(id);
  }

  hasSubTabs(tabId: string): boolean {
    return tabId === this.subTabsForTabId() && this.subTabs().length > 0;
  }

  isProfileExpanded(): boolean {
    return this.activeTabId() === this.subTabsForTabId() && this.subTabs().length > 0;
  }

  tabIconPath(icon?: PreferenceTab['icon']): string {
    if (!icon) return TAB_ICON_PATHS.user;
    return TAB_ICON_PATHS[icon] || TAB_ICON_PATHS.user;
  }
}
