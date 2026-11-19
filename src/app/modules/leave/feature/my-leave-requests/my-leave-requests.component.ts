/**
 * Leave Requests (hub "View All"): the caller's own requests, newest activity first, with status tabs,
 * a type and date filter, and pages. Requests waiting on the caller's approval live in the Inbox.
 */
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LeaveCancelConfirmDialogComponent } from '../../../../shared/ui/leave-cancel-confirm-dialog/leave-cancel-confirm-dialog.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { CancelLeaveRequestRequest, LeaveRequestListItemResponse } from '../../models/leave-request.model';
import { LeaveBalanceStore } from '../../state/leave-balance.store';
import { LeaveRequestStore } from '../../state/leave-request.store';
import { LeaveTypeStore } from '../../state/leave-type.store';
import { LeaveTypeIconComponent } from '../../ui/leave-type-icon/leave-type-icon.component';
import { NewLeaveRequestHostComponent } from '../../ui/new-leave-request-host/new-leave-request-host.component';
import { approvalProgressLabel, leaveDateRangeLabel, leaveDurationLabel, sortByLastActivity, workdayHours } from '../../utils/leave-hub.util';

export type RequestStatusTab = '' | 'pending' | 'approved' | 'rejected' | 'cancelled';
export const MY_REQUESTS_PAGE_SIZE = 10;

export interface MyRequestsFilter {
  status: RequestStatusTab;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  search: string;
}

/** Requests matching the tabs and filters; From/To keep any request that overlaps the range. */
export function filterMyRequests(requests: readonly LeaveRequestListItemResponse[], filter: MyRequestsFilter): LeaveRequestListItemResponse[] {
  const search = filter.search.trim().toLowerCase();
  return requests.filter((request) => {
    if (filter.status && request.status !== filter.status) return false;
    if (filter.leaveTypeId && request.leaveTypeId !== filter.leaveTypeId) return false;
    if (filter.fromDate && request.endAt.slice(0, 10) < filter.fromDate) return false;
    if (filter.toDate && request.startAt.slice(0, 10) > filter.toDate) return false;
    if (search && !`${request.leaveTypeName} ${request.approvedByName ?? ''}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

@Component({
  selector: 'app-my-leave-requests',
  standalone: true,
  imports: [
    DatePipe,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    DataTableComponent,
    DataTableCellDirective,
    DatePickerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    LeaveCancelConfirmDialogComponent,
    LoaderComponent,
    SelectComponent,
    LeaveTypeIconComponent,
    NewLeaveRequestHostComponent
  ],
  templateUrl: './my-leave-requests.component.html',
  styleUrls: ['../../ui/time-off-chrome.css', './my-leave-requests.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyLeaveRequestsComponent {
  readonly store = inject(LeaveRequestStore);
  private readonly leaveTypeStore = inject(LeaveTypeStore);
  private readonly balanceStore = inject(LeaveBalanceStore);
  private readonly notificationService = inject(NotificationService);
  readonly canRequest = inject(PermissionService).hasPermission('leave:read-own');

  readonly columns: readonly DataTableColumn[] = [
    { key: 'type', label: 'Leave type' },
    { key: 'dates', label: 'Dates' },
    { key: 'duration', label: 'Duration' },
    { key: 'applied', label: 'Applied on' },
    { key: 'approvedBy', label: 'Approved by' },
    { key: 'status', label: 'Status' },
    { key: 'actions', label: 'Actions', interactive: true, shrink: true, align: 'end' as const }
  ];
  readonly tabs: readonly { value: RequestStatusTab; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' }
  ];
  readonly trackById = (request: LeaveRequestListItemResponse): string => request.id;
  readonly approvalProgress = approvalProgressLabel;
  readonly rowTestId = (): string => 'request-row';

  readonly filter = signal<MyRequestsFilter>({ status: '', leaveTypeId: '', fromDate: '', toDate: '', search: '' });
  readonly page = signal(1);
  readonly cancelTarget = signal<LeaveRequestListItemResponse | null>(null);
  readonly wizardOpen = signal(false);

  readonly leaveTypeOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'All leave types' },
    ...this.leaveTypeStore.items().map((type) => ({ value: type.id, label: type.name }))
  ]);
  private readonly colorById = computed(() => new Map(this.leaveTypeStore.items().map((type) => [type.id, type.color])));
  private readonly iconById = computed(() => new Map(this.leaveTypeStore.items().map((type) => [type.id, type.icon ?? null])));
  private readonly workday = computed(() => {
    const window = this.balanceStore.workWindow();
    return window ? workdayHours(window.workStartTime, window.workEndTime, window.breakDurationMinutes) : null;
  });

  readonly filtered = computed(() => sortByLastActivity(filterMyRequests(this.store.myRequests(), this.filter())));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / MY_REQUESTS_PAGE_SIZE)));
  readonly pageRows = computed(() => {
    const page = Math.min(this.page(), this.pageCount());
    return this.filtered().slice((page - 1) * MY_REQUESTS_PAGE_SIZE, page * MY_REQUESTS_PAGE_SIZE);
  });
  readonly rangeLabel = computed(() => {
    const total = this.filtered().length;
    if (total === 0) return '';
    const page = Math.min(this.page(), this.pageCount());
    const first = (page - 1) * MY_REQUESTS_PAGE_SIZE + 1;
    return `${first}–${Math.min(page * MY_REQUESTS_PAGE_SIZE, total)} of ${total}`;
  });

  constructor() {
    // The list filters on the client: load everything the caller has sent.
    this.store.setMyRequestsFilter({});
    if (this.leaveTypeStore.items().length === 0) void this.leaveTypeStore.load();
    if (!this.balanceStore.workWindow()) void this.balanceStore.loadWorkWindow();
  }

  patchFilter(change: Partial<MyRequestsFilter>): void {
    this.filter.update((current) => ({ ...current, ...change }));
    this.page.set(1);
  }

  onSearchInput(event: Event): void {
    this.patchFilter({ search: (event.target as HTMLInputElement).value });
  }

  goToPage(page: number): void {
    this.page.set(Math.max(1, Math.min(page, this.pageCount())));
  }

  icon(request: LeaveRequestListItemResponse): string | null {
    return this.iconById().get(request.leaveTypeId) ?? null;
  }

  color(request: LeaveRequestListItemResponse): string {
    return this.colorById().get(request.leaveTypeId) ?? 'var(--color-accent)';
  }

  dateRange(request: LeaveRequestListItemResponse): string {
    return leaveDateRangeLabel(request.startAt, request.endAt);
  }

  duration(request: LeaveRequestListItemResponse): string {
    return leaveDurationLabel(request.startAt, request.endAt, request.totalHours, this.workday());
  }

  canCancel(request: LeaveRequestListItemResponse): boolean {
    return request.status === 'pending' || request.status === 'approved';
  }

  async onConfirmCancel(payload: CancelLeaveRequestRequest): Promise<void> {
    const target = this.cancelTarget();
    if (!target) return;
    const result = await this.store.cancel(target.id, payload);
    if (result) {
      this.notificationService.success('Leave request cancelled.');
      this.cancelTarget.set(null);
      void this.store.loadMine();
    } else {
      this.notificationService.error(this.store.cancelError() ?? 'Failed to cancel this request.');
    }
  }
}
