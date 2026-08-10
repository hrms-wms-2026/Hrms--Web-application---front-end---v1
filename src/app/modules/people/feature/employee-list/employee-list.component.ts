import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { NotificationService } from '../../../../core/services/notification.service';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import { PeopleStore } from '../../state/people.store';
import { DraftTableComponent } from '../../ui/draft-table/draft-table.component';
import { EmployeeTableComponent } from '../../ui/employee-table/employee-table.component';

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-employee-list',
  standalone: true,
  imports: [
    RouterLink,
    ButtonComponent,
    ErrorStateComponent,
    InputComponent,
    LoaderComponent,
    PageHeaderComponent,
    DraftTableComponent,
    EmployeeTableComponent
  ],
  template: `
    <app-page-header title="Employees" subtitle="People in your organization and pending onboarding drafts.">
      @if (canAddEmployee()) {
        <a routerLink="/people/employees/new">
          <app-button variant="primary">+ Add Employee</app-button>
        </a>
      }
    </app-page-header>

    <div class="mb-4 max-w-sm">
      <app-input
        placeholder="Search by name, email, or employee number"
        [value]="searchTerm()"
        (valueChange)="onSearchInput($event)"
      />
    </div>

    <section class="mb-8">
      <h2 class="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Employees</h2>
      @if (store.employeesLoading()) {
        <app-loader label="Loading employees…" />
      } @else if (store.employeesError()) {
        <app-error-state [message]="store.employeesError()!" [retryable]="true" (retry)="loadEmployees()" />
      } @else {
        <app-employee-table [employees]="store.employees()" />
        @if (store.employeesTotalCount() > store.employeesPageSize()) {
          <div class="mt-3 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
            <span>
              Page {{ store.employeesPage() }} of
              {{ Math.ceil(store.employeesTotalCount() / store.employeesPageSize()) }}
            </span>
            <div class="flex gap-2">
              <app-button
                variant="secondary"
                [disabled]="store.employeesPage() <= 1"
                (pressed)="goToEmployeesPage(store.employeesPage() - 1)"
              >
                Previous
              </app-button>
              <app-button
                variant="secondary"
                [disabled]="store.employeesPage() * store.employeesPageSize() >= store.employeesTotalCount()"
                (pressed)="goToEmployeesPage(store.employeesPage() + 1)"
              >
                Next
              </app-button>
            </div>
          </div>
        }
      }
    </section>

    <section>
      <h2 class="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">Onboarding drafts</h2>
      @if (store.draftsLoading()) {
        <app-loader label="Loading drafts…" />
      } @else if (store.draftsError()) {
        <app-error-state [message]="store.draftsError()!" [retryable]="true" (retry)="loadDrafts()" />
      } @else {
        <app-draft-table [drafts]="store.drafts()" (continueDraft)="onContinueDraft($event)" />
      }
    </section>
  `,
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
