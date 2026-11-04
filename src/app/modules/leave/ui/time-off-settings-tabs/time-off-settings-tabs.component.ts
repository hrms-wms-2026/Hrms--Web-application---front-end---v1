import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';

export interface TimeOffSettingsTab {
  path: string;
  label: string;
  permissions: readonly string[];
}

/** Settings → Time Off: the admin screens that used to be the Time Off submenu, as one tab strip. */
export const TIME_OFF_SETTINGS_TABS: readonly TimeOffSettingsTab[] = [
  { path: 'types', label: 'Leave Types', permissions: ['leave:read', 'leave:manage'] },
  { path: 'policies', label: 'Leave Policies', permissions: ['leave:manage'] },
  { path: 'entitlements', label: 'Entitlements', permissions: ['leave:read', 'leave:manage'] },
  { path: 'holidays', label: 'Holidays', permissions: ['leave:manage'] },
  { path: 'requests', label: 'All Requests', permissions: ['leave:read'] }
];

@Component({
  selector: 'app-time-off-settings-tabs',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="to-tabs tost" aria-label="Time Off settings">
      @for (tab of tabs(); track tab.path) {
        <a class="to-tab" [routerLink]="['/settings/time-off', tab.path]" routerLinkActive="to-tab--active" ariaCurrentWhenActive="page">{{ tab.label }}</a>
      }
    </nav>
  `,
  styleUrls: ['../time-off-chrome.css'],
  styles: [`.tost .to-tab { text-decoration: none; display: inline-flex; align-items: center; }`],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TimeOffSettingsTabsComponent {
  private readonly permissions = inject(PermissionService);
  readonly tabs = computed(() => TIME_OFF_SETTINGS_TABS.filter((tab) => this.permissions.hasAnyPermission(tab.permissions)));
}
