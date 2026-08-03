import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Empty skeleton content area for the authenticated dashboard route.
 * Real dashboard modules (ARCHITECTURE.md's modules/dashboard/) replace this later.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  template: `<div class="dashboard-home"></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
