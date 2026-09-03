import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { TabOption, TabsComponent } from '../../../../shared/ui/tabs/tabs.component';
import { TeamBalancesComponent } from '../team-balances/team-balances.component';
import { PendingApprovalsComponent } from '../pending-approvals/pending-approvals.component';
import { RequestsListComponent } from '../requests-list/requests-list.component';

type TeamTab = 'balances' | 'approvals' | 'all';

@Component({
  selector: 'app-team-hub',
  standalone: true,
  imports: [TabsComponent, TeamBalancesComponent, PendingApprovalsComponent, RequestsListComponent],
  templateUrl: './team-hub.component.html',
  styleUrl: './team-hub.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamHubComponent {
  private readonly permissionService = inject(PermissionService);

  private readonly canSeeBalances = computed(() => this.permissionService.hasPermission('leave:read-team'));
  private readonly canSeeApprovals = computed(() => this.permissionService.hasPermission('leave:approve'));
  private readonly canSeeAll = computed(() => this.permissionService.hasPermission('leave:read'));

  readonly tabs = computed<readonly TabOption[]>(() => {
    const options: TabOption[] = [];
    if (this.canSeeBalances()) options.push({ value: 'balances', label: 'Balances' });
    if (this.canSeeApprovals()) options.push({ value: 'approvals', label: 'Pending Approvals' });
    if (this.canSeeAll()) options.push({ value: 'all', label: 'All Requests' });
    return options;
  });

  private readonly requestedTab = signal<TeamTab | null>(null);

  readonly activeTab = computed<TeamTab | null>(() => {
    const requested = this.requestedTab();
    const available = this.tabs().map((tab) => tab.value as TeamTab);
    if (requested && available.includes(requested)) return requested;
    return available[0] ?? null;
  });

  selectTab(tab: string): void {
    this.requestedTab.set(tab as TeamTab);
  }
}
