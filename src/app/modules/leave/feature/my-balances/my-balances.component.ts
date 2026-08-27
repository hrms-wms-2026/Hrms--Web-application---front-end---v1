/** Quiet Operations Desk: the employee's own leave position at a glance. */
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveBalanceListTableComponent } from '../../ui/leave-balance-list-table/leave-balance-list-table.component';
@Component({ selector: 'app-my-balances', standalone: true, imports: [CommonModule, EmptyStateComponent, ErrorStateComponent, SelectComponent, LeaveBalanceListTableComponent], templateUrl: './my-balances.component.html', styleUrl: './my-balances.component.css', changeDetection: ChangeDetectionStrategy.OnPush })
export class MyBalancesComponent { readonly store = inject(LeaveBalanceStore); readonly yearOptions: SelectOption[] = yearOptions(); readonly selectedYear = computed(() => String(this.store.year())); constructor() { void this.store.loadMy(new Date().getFullYear()); } onYearChange(year: string): void { void this.store.loadMy(Number(year)); } }
export function yearOptions(): SelectOption[] { const current = new Date().getFullYear(); return [current - 1, current, current + 1].map((year) => ({ value: String(year), label: String(year) })); }
