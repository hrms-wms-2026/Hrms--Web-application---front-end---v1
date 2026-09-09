/** Quiet Operations Desk: a manager's concise scan of direct and indirect report positions. */
import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { computeWorkDayHours } from '../../../organization/utils/work-day-hours';
import { GeneralSettingsStore } from '../../../organization/state/general-settings.store';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';

@Component({
  selector: 'app-team-balances',
  standalone: true,
  imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, LeaveBalanceListTableComponent],
  templateUrl: './team-balances.component.html',
  styleUrl: './team-balances.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TeamBalancesComponent {
  readonly store = inject(LeaveBalanceStore);
  readonly settingsStore = inject(GeneralSettingsStore);
  private readonly legalEntityStore = inject(LegalEntityStore);
  readonly workDayHours = computed(() =>
    computeWorkDayHours(
      this.settingsStore.settings()?.workStartTime,
      this.settingsStore.settings()?.workEndTime,
      this.settingsStore.settings()?.breakDurationMinutes
    )
  );

  constructor() {
    void this.store.loadTeam(new Date().getFullYear());
    effect(() => {
      const id = this.legalEntityStore.selectedLegalEntityId();
      if (!id || this.settingsStore.legalEntityId() === id) return;
      void this.settingsStore.load(id);
    });
  }

  onSearchInput(event: Event): void {
    const search = (event.target as HTMLInputElement).value;
    this.store.setTeamFilters({ ...this.store.teamFilters(), search: search || undefined });
  }
}
