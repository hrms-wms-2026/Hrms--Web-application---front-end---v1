import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardShellComponent } from '../dashboard-shell/dashboard-shell.component';

/**
 * Employee dashboard content area for the authenticated dashboard route ("My Work"). The customizable
 * grid, its Customize / Save / Cancel flow and the widget store all live in the shared dashboard shell.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [DashboardShellComponent],
  template: `<app-dashboard-shell dashboardKey="my-work" />`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardHomeComponent {}
