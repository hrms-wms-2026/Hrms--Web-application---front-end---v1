import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { DashboardShellComponent } from '../dashboard-shell/dashboard-shell.component';

/**
 * The My Team dashboard (/dashboard/my-team), reached from Quick Actions -> My Team. A customizable
 * grid hosted by the shared dashboard shell; which team widgets appear is decided server-side from the
 * viewer's My Team capabilities. When no team widget is allowed (or the capabilities check failed) the
 * page shows today's empty / retry state below the grid.
 */
@Component({
  selector: 'app-my-team-page',
  standalone: true,
  imports: [DashboardShellComponent, EmptyStateComponent],
  templateUrl: './my-team-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTeamPageComponent implements OnInit {
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);

  ngOnInit(): void {
    // Fresh on every visit, so a lead's newly granted (or removed) team access shows up here.
    void this.capabilitiesStore.loadCapabilities();
  }
}
