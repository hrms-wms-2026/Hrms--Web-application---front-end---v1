/** Quiet Operations Desk: a manager's concise scan of direct and indirect report positions. */
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
@Component({ selector: 'app-team-balances', standalone: true, imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, LeaveBalanceListTableComponent], templateUrl: './team-balances.component.html', styleUrl: './team-balances.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class TeamBalancesComponent { readonly store = inject(LeaveBalanceStore); constructor() { void this.store.loadTeam(new Date().getFullYear()); } onSearchInput(event: Event): void { const search = (event.target as HTMLInputElement).value; this.store.setTeamFilters({ ...this.store.teamFilters(), search: search || undefined }); } }
