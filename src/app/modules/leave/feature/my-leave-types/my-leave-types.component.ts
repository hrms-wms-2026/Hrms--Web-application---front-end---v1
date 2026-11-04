/** All my leave types (opened from the hub's "More"): every balance the caller has, one card each. */
import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { LeaveBalanceResponse } from '../../models/leave-balance.model';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveTypeIconComponent } from '../../ui/leave-type-icon/leave-type-icon.component';
import { monthlyAccrualNote, remainingShare } from '../../utils/leave-balance-notes';
import { yearOptions } from '../../utils/leave-year-options';

@Component({
  selector: 'app-my-leave-types',
  standalone: true,
  imports: [DecimalPipe, RouterLink, BreadcrumbHeaderComponent, EmptyStateComponent, ErrorStateComponent, LoaderComponent, SelectComponent, LeaveTypeIconComponent],
  templateUrl: './my-leave-types.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './my-leave-types.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyLeaveTypesComponent {
  readonly store = inject(LeaveBalanceStore);
  private readonly leaveTypeStore = inject(LeaveTypeStore);
  readonly yearOptions: SelectOption[] = yearOptions();
  readonly selectedYear = computed(() => String(this.store.year()));
  private readonly colorById = computed(() => new Map(this.leaveTypeStore.items().map((type) => [type.id, type.color])));
  private readonly iconById = computed(() => new Map(this.leaveTypeStore.items().map((type) => [type.id, type.icon ?? null])));
  private readonly today = new Date();

  constructor() {
    void this.store.loadMy(this.store.year());
    if (this.leaveTypeStore.items().length === 0) void this.leaveTypeStore.load();
  }

  onYearChange(year: string): void {
    void this.store.loadMy(Number(year));
  }

  icon(balance: LeaveBalanceResponse): string | null {
    return this.iconById().get(balance.leaveTypeId) ?? null;
  }

  color(balance: LeaveBalanceResponse): string {
    return this.colorById().get(balance.leaveTypeId) ?? 'var(--color-accent)';
  }

  share(balance: LeaveBalanceResponse): number {
    return remainingShare(balance);
  }

  accrualNote(balance: LeaveBalanceResponse): string | null {
    return monthlyAccrualNote(balance, this.today);
  }

  hours(value: number): string {
    return value.toFixed(2);
  }
}
