import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
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
export class DashboardHomeComponent implements OnInit {
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);

  ngOnInit(): void {
    // Action Center reads the My Team capabilities (subtitle, Overdue chip, rail); load them once, cached.
    void this.capabilitiesStore.ensureLoaded();
  }
}
