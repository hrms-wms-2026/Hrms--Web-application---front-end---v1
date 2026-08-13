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
    EmployeeTableComponent
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

  toggleSearch(): void {
    this.searchExpanded.update((v) => !v);
    if (!this.searchExpanded()) {
      this.onSearchInput('');
    }
  }
  readonly activeTab = signal<'employees' | 'drafts'>('employees');
  readonly Math = Math;

  private searchDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const initialParams = this.route.snapshot.queryParamMap;
    this.searchTerm.set(initialParams.get('search') ?? '');

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = Number(params.get('page')) || 1;
      this.store.loadEmployees({ search: params.get('search') ?? undefined, page, pageSize: 25 });
    });

    this.loadDrafts();
  }

  setTab(tab: 'employees' | 'drafts'): void {
    this.activeTab.set(tab);
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
    this.router.navigate(['/people/employees/new'], { queryParams: { draftId } });
  }
}
