import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PeopleStore } from '../../state/people.store';
import { DraftTableComponent } from '../../ui/draft-table/draft-table.component';
import { EmployeeTableComponent } from '../../ui/employee-table/employee-table.component';
import { EmployeeListViewComponent } from '../../ui/employee-list-view/employee-list-view.component';
import { EmployeeCardViewComponent } from '../../ui/employee-card-view/employee-card-view.component';
import { AddEmployeeWizardComponent } from '../add-employee-wizard/add-employee-wizard.component';

export type EmployeeViewMode = 'table' | 'list' | 'card';

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    RouterLink,
    BreadcrumbHeaderComponent,
    ButtonComponent,
    ErrorStateComponent,
    LoaderComponent,
    DraftTableComponent,
    EmployeeTableComponent,
    EmployeeListViewComponent,
    EmployeeCardViewComponent,
    AddEmployeeWizardComponent
  ],
  templateUrl: './employee-list.component.html',
  styleUrl: './employee-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly store = inject(PeopleStore);
  readonly canAddEmployee = computed(() => this.permissionService.hasPermission('employees:write'));
  readonly searchTerm = signal('');
  readonly searchExpanded = signal(false);

  readonly viewMode = signal<EmployeeViewMode>(this.loadInitialViewMode());

  private loadInitialViewMode(): EmployeeViewMode {
    try {
      const saved = localStorage.getItem('employee_view_mode');
      if (saved === 'list' || saved === 'card' || saved === 'table') {
        return saved;
      }
    } catch {
      // Ignore local storage errors
    }
    return 'table';
  }

  setViewMode(mode: EmployeeViewMode): void {
    this.viewMode.set(mode);
    try {
      localStorage.setItem('employee_view_mode', mode);
    } catch {
      // Ignore local storage errors
    }
  }

  cycleViewMode(): void {
    const current = this.viewMode();
    let next: EmployeeViewMode = 'table';
    if (current === 'table') {
      next = 'list';
    } else if (current === 'list') {
      next = 'card';
    } else {
      next = 'table';
    }
    this.setViewMode(next);
  }

  readonly viewModeTitle = computed(() => {
    const mode = this.viewMode();
    if (mode === 'table') return 'Table view (click to switch to List)';
    if (mode === 'list') return 'List view (click to switch to Card)';
    return 'Card view (click to switch to Table)';
  });

  readonly viewModeAriaLabel = computed(() => {
    const mode = this.viewMode();
    if (mode === 'table') return 'Table view, switch to List view';
    if (mode === 'list') return 'List view, switch to Card view';
    return 'Card view, switch to Table view';
  });

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
    if (!this.searchExpanded()) {
      this.onSearchInput('');
    }
  }
  readonly activeTab = signal<'employees' | 'drafts'>('employees');
  readonly Math = Math;

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly isAddEmployeeModalOpen = signal(false);
  readonly activeDraftId = signal<string | null>(null);

  constructor() {
    const initialParams = this.route.snapshot.queryParamMap;
    this.searchTerm.set(initialParams.get('search') ?? '');

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = Number(params.get('page')) || 1;
      this.store.loadEmployees({ search: params.get('search') ?? undefined, page, pageSize: 25 });
      if ((params.get('addEmployee') === 'true' || params.has('draftId')) && this.canAddEmployee()) {
        this.activeDraftId.set(params.get('draftId'));
        this.isAddEmployeeModalOpen.set(true);
      }
    });

    this.loadDrafts();
  }

  setTab(tab: 'employees' | 'drafts'): void {
    this.activeTab.set(tab);
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

  onEmployeeSaved(result: { finalized: boolean; draftId?: string }): void {
    this.closeAddEmployeeModal();
    this.loadEmployees();
    this.loadDrafts();
    if (result.finalized) {
      this.setTab('employees');
    } else {
      this.setTab('drafts');
    }
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
    const params = this.route.snapshot.queryParamMap;
    this.store.loadEmployees({
      search: params.get('search') ?? undefined,
      page: Number(params.get('page')) || 1,
      pageSize: 25
    });
  }

  loadDrafts(): void {
    this.store.loadDrafts({ page: 1, pageSize: 25 });
  }

  onContinueDraft(draftId: string): void {
    this.openAddEmployeeModal(draftId);
  }
}
