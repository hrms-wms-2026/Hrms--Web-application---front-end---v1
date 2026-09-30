import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { BulkAction, BulkActionBarComponent } from '../../../../shared/ui/bulk-action-bar/bulk-action-bar.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { MenuItem } from '../../../../shared/ui/dropdown-menu/dropdown-menu.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectionModel } from '../../../../shared/utils/selection-model';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { EMPLOYEE_COLUMNS, EmployeeColumnKey, loadEmployeeColumns, saveEmployeeColumns } from '../../models/employee-columns';
import { BulkEmployeeActionResponse, EmployeeListItemResponse, EmployeeSortKey, SortDirection, toEmployeeBulkSummary } from '../../models/employee.model';
import { PeopleStore } from '../../state/people.store';
import { BulkActionResultModalComponent } from '../../../../shared/ui/bulk-action-result-modal/bulk-action-result-modal.component';
import { BulkEmploymentTypeModalComponent } from '../../ui/bulk-employee-actions/bulk-employment-type-modal.component';
import { BulkStartOffboardingModalComponent } from '../../ui/bulk-employee-actions/bulk-start-offboarding-modal.component';
import { ChangePositionModalComponent } from '../../ui/change-position-modal/change-position-modal.component';
import { EmployeeColumnPickerComponent } from '../../ui/employee-column-picker/employee-column-picker.component';
import { EmployeeDirectoryTableComponent } from '../../ui/employee-directory-table/employee-directory-table.component';
import { EmployeeFilterPopoverComponent } from '../../ui/employee-filter-popover/employee-filter-popover.component';
import { downloadCsv, toEmployeeCsv } from '../../utils/employee-csv';
import {
  EMPLOYEE_PAGE_SIZES,
  EmployeeListFilters,
  EmployeeListUrlState,
  filtersToQueryParams,
  parseEmployeeListState,
  selectionScopeKey,
  toEmployeeListParams
} from '../../utils/employee-list-url-state';
import { AddEmployeeWizardComponent } from '../add-employee-wizard/add-employee-wizard.component';
import { DraftsStore } from '../../../../shared/state/drafts.store';

const SEARCH_DEBOUNCE_MS = 300;
const TERMINAL_STATUSES = ['resigned', 'terminated'];

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    EmployeeDirectoryTableComponent,
    EmployeeColumnPickerComponent,
    EmployeeFilterPopoverComponent,
    ChangePositionModalComponent,
    BulkEmploymentTypeModalComponent,
    BulkStartOffboardingModalComponent,
    BulkActionResultModalComponent,
    BulkActionBarComponent,
    AddEmployeeWizardComponent
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListComponent {
  readonly toEmployeeBulkSummary = toEmployeeBulkSummary;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly legalEntityStore = inject(LegalEntityStore);
  private readonly authStore = inject(AuthStore);

  readonly store = inject(PeopleStore);
  private readonly draftsStore = inject(DraftsStore);
  readonly canAddEmployee = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canWrite = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));
  readonly legalEntityId = this.legalEntityStore.selectedLegalEntityId;
  readonly searchTerm = signal('');
  readonly searchExpanded = signal(false);

  readonly listState = signal<EmployeeListUrlState>(parseEmployeeListState(this.route.snapshot.queryParamMap));
  readonly pageSizes = EMPLOYEE_PAGE_SIZES;
  readonly visibleColumnKeys = signal<EmployeeColumnKey[]>(loadEmployeeColumns());
  readonly visibleColumns = computed(() => EMPLOYEE_COLUMNS.filter((c) => this.visibleColumnKeys().includes(c.key)));

  readonly selection = new SelectionModel<string>();
  /** Every row seen while this selection was built, so selections survive paging. */
  private readonly rowCache = signal<ReadonlyMap<string, EmployeeListItemResponse>>(new Map());
  readonly selectedRows = computed(() =>
    [...this.selection.selected()].map((id) => this.rowCache().get(id)).filter((r): r is EmployeeListItemResponse => !!r));
  readonly selectedIdList = computed(() => [...this.selection.selected()]);
  private lastSelectionScope = selectionScopeKey(this.listState());

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.store.employeesTotalCount() / this.listState().pageSize)));
  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = Math.min(this.listState().page, total);
    const start = Math.max(1, Math.min(current - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });
  readonly rangeStart = computed(() => this.store.employeesTotalCount() === 0 ? 0 : (this.listState().page - 1) * this.listState().pageSize + 1);
  readonly rangeEnd = computed(() => Math.min(this.listState().page * this.listState().pageSize, this.store.employeesTotalCount()));

  readonly positionChangeBlockedReason = computed(() => {
    const companies = new Set(this.selectedRows().map((r) => r.legalEntityId));
    if (companies.has(null)) return 'Some selected employees have no company assigned.';
    if (companies.size > 1) return 'Select employees from a single company to change their position together.';
    return null;
  });
  readonly bulkLegalEntityId = computed(() => this.selectedRows()[0]?.legalEntityId ?? '');

  readonly bulkActions = computed<BulkAction[]>(() => {
    const actions: BulkAction[] = [];
    if (this.canWrite()) {
      const blocked = this.positionChangeBlockedReason();
      actions.push(
        { id: 'promote', label: 'Promote', placement: 'primary', disabled: !!blocked, disabledReason: blocked ?? undefined },
        { id: 'transfer', label: 'Transfer', placement: 'primary', disabled: !!blocked, disabledReason: blocked ?? undefined },
        { id: 'employment-type', label: 'Change Employment Type', placement: 'more' }
      );
    }
    actions.push({ id: 'export', label: 'Export Selected', placement: 'more' });
    if (this.canOffboard()) {
      actions.push({ id: 'offboard', label: 'Bulk Offboard', placement: 'more', danger: true });
    }
    return actions;
  });

  readonly bulkPositionReason = signal<'Promotion' | 'Transfer' | null>(null);
  readonly bulkEmploymentTypeOpen = signal(false);
  readonly bulkOffboardOpen = signal(false);
  readonly bulkResult = signal<{ title: string; result: BulkEmployeeActionResponse } | null>(null);
  readonly resultNames = computed(() => new Map([...this.rowCache().values()].map((r) => [r.id, r.fullName] as const)));
  readonly rowPositionChange = signal<{ employee: EmployeeListItemResponse; reason: 'Promotion' | 'Transfer' } | null>(null);

  readonly rowMenuItems = (employee: EmployeeListItemResponse): MenuItem[] => {
    const own = employee.id === this.authStore.employeeId();
    const terminal = TERMINAL_STATUSES.includes(employee.status.toLowerCase());
    const invitationBlocked = employee.invitationStatus === 'pending' || employee.invitationStatus === 'expired';
    const items: MenuItem[] = [];
    if (this.canWrite() && !own && !terminal && !invitationBlocked && employee.legalEntityId) {
      items.push({ id: 'promote', label: 'Promote' }, { id: 'transfer', label: 'Transfer' });
    }
    if (this.canOffboard() && !own && !terminal) {
      items.push({ id: 'offboard', label: 'Offboard', danger: true, dividerBefore: items.length > 0 });
    }
    return items;
  };

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
    if (!this.searchExpanded()) {
      this.onSearchInput('');
    }
  }
  readonly activeTab = signal<'employees' | 'drafts'>('employees');

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly isAddEmployeeModalOpen = signal(false);
  readonly activeDraftId = signal<string | null>(null);

  constructor() {
    const initialParams = this.route.snapshot.queryParamMap;
    this.searchTerm.set(initialParams.get('search') ?? '');

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const state = parseEmployeeListState(params);
      const scope = selectionScopeKey(state);
      if (scope !== this.lastSelectionScope) {
        this.selection.clear();
        this.lastSelectionScope = scope;
      }
      this.listState.set(state);
      this.store.loadEmployees(toEmployeeListParams(state));
      if ((params.get('addEmployee') === 'true' || params.has('draftId')) && this.canAddEmployee()) {
        this.activeDraftId.set(params.get('draftId'));
        this.isAddEmployeeModalOpen.set(true);
      }
    });

    effect(() => {
      const rows = this.store.employees();
      untracked(() => this.rowCache.update((cache) => {
        const next = new Map(cache);
        for (const row of rows) next.set(row.id, row);
        return next;
      }));
    });
  }

  openAddEmployeeModal(draftId?: string): void {
    this.activeDraftId.set(draftId ?? null);
    this.isAddEmployeeModalOpen.set(true);
  }

  closeAddEmployeeModal(): void {
    this.isAddEmployeeModalOpen.set(false);
    this.activeDraftId.set(null);
    if (this.route.snapshot.queryParamMap.has('addEmployee') || this.route.snapshot.queryParamMap.has('draftId')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { addEmployee: null, draftId: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  onEmployeeSaved(_result: { finalized: boolean; draftId?: string }): void {
    this.closeAddEmployeeModal();
    this.loadEmployees();
    void this.draftsStore.load();
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (this.searchDebounceHandle) {
      clearTimeout(this.searchDebounceHandle);
    }
    this.searchDebounceHandle = setTimeout(() => {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { search: value || null, page: 1 },
        queryParamsHandling: 'merge'
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  goToEmployeesPage(page: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { page }, queryParamsHandling: 'merge' });
  }

  loadEmployees(): void {
    this.store.loadEmployees(toEmployeeListParams(this.listState()));
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  onSortChanged(event: { sortBy: EmployeeSortKey; sortDir: SortDirection }): void {
    this.navigate({ sortBy: event.sortBy, sortDir: event.sortDir, page: 1 });
  }

  onFiltersApplied(filters: EmployeeListFilters): void {
    this.navigate({ ...filtersToQueryParams(filters), page: 1 });
  }

  onColumnsApplied(keys: EmployeeColumnKey[]): void {
    this.visibleColumnKeys.set(keys);
    saveEmployeeColumns(keys);
  }

  onPageSizeChange(value: string): void {
    this.navigate({ pageSize: Number(value), page: 1 });
  }

  onBulkAction(actionId: string): void {
    switch (actionId) {
      case 'promote': this.bulkPositionReason.set('Promotion'); break;
      case 'transfer': this.bulkPositionReason.set('Transfer'); break;
      case 'employment-type': this.bulkEmploymentTypeOpen.set(true); break;
      case 'offboard': this.bulkOffboardOpen.set(true); break;
      case 'export': this.exportSelected(); break;
    }
  }

  onBulkCompleted(title: string, result: BulkEmployeeActionResponse): void {
    this.bulkResult.set({ title, result });
    this.selection.clear();
    this.loadEmployees();
  }

  onRowAction(event: { employee: EmployeeListItemResponse; actionId: string }): void {
    if (event.actionId === 'offboard') {
      void this.router.navigate(['/people/employees', event.employee.id, 'offboarding']);
      return;
    }
    this.rowPositionChange.set({ employee: event.employee, reason: event.actionId === 'promote' ? 'Promotion' : 'Transfer' });
  }

  private exportSelected(): void {
    const csv = toEmployeeCsv(this.selectedRows(), this.visibleColumns());
    downloadCsv(`employees-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }
}
