import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { MyTeamWidgetKey } from '../../models/my-team-widget-key.model';
import { MyTeamCapabilitiesStore } from '../../state/my-team-capabilities.store';
import { allowedWidgetKeys } from '../../utils/my-team-widget-visibility.util';
import { QuickActionsCardComponent } from '../quick-actions-card/quick-actions-card.component';
import { TeamProgressCardComponent } from '../team-progress-card/team-progress-card.component';
import { TeamStatusCardComponent } from '../team-status-card/team-status-card.component';

/**
 * The My Team dashboard (/dashboard/my-team), reached from Quick Actions -> My Team. A separate page
 * from the personal dashboard: it holds the team cards - Team Status and Team Progress - plus Quick
 * Actions, whose middle action links back to My Work. Action Center stays on the My Work dashboard.
 * Each team card shows only when the viewer's capabilities allow it (My Team spec §6); the backend
 * still authorizes every section.
 */
@Component({
  selector: 'app-my-team-page',
  standalone: true,
  imports: [
    LoaderComponent,
    EmptyStateComponent,
    QuickActionsCardComponent,
    TeamStatusCardComponent,
    TeamProgressCardComponent
  ],
  templateUrl: './my-team-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyTeamPageComponent implements OnInit {
  private readonly capabilitiesStore = inject(MyTeamCapabilitiesStore);

  protected readonly loaded = this.capabilitiesStore.loaded;
  protected readonly error = this.capabilitiesStore.error;

  /** The team cards this page can show - Action Center is left out, it lives on My Work. */
  private readonly allowed = computed<ReadonlySet<MyTeamWidgetKey>>(() => {
    const caps = this.capabilitiesStore.capabilities();
    return new Set((caps?.isAvailable ? allowedWidgetKeys(caps) : []).filter((key) => key !== 'actionCenter'));
  });

  protected readonly hasTeamCards = computed(() => this.allowed().size > 0);

  ngOnInit(): void {
    // Fresh on every visit, so a lead's newly granted (or removed) team access shows up here.
    void this.capabilitiesStore.loadCapabilities();
  }

  protected shows(key: MyTeamWidgetKey): boolean {
    return this.allowed().has(key);
  }

  protected retry(): void {
    void this.capabilitiesStore.loadCapabilities();
  }
}
