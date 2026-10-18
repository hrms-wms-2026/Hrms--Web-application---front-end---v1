import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { AvatarComponent } from '../../../../shared/ui/avatar/avatar.component';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DataTableCellDirective, DataTableColumn, DataTableComponent } from '../../../../shared/ui/data-table/data-table.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/ui/error-state/error-state.component';
import { KpiTile, KpiTilesComponent } from '../../../../shared/ui/kpi-tiles/kpi-tiles.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewItemResponse, OffboardingRecordStatus } from '../../models/offboarding.model';
import { StartOffboardingModalComponent } from '../../ui/start-offboarding-modal/start-offboarding-modal.component';

const OPEN_STATUSES: ReadonlySet<OffboardingRecordStatus> = new Set(['initiated', 'in_progress']);
const STATUS_LABELS: Record<OffboardingRecordStatus, string> = {
  initiated: 'Initiated', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled'
};

@Component({
  selector: 'app-app-offboarding-overview',
  standalone: true,
  imports: [
    AvatarComponent, BreadcrumbHeaderComponent, ButtonComponent, DataTableComponent, DataTableCellDirective,
    EmptyStateComponent, ErrorStateComponent, KpiTilesComponent, LoaderComponent, StartOffboardingModalComponent
  ],
  template: `
    <header class="ob-page-header">
      <div class="ob-header-row">
        <app-breadcrumb-header parentLabel="People" currentLabel="Offboarding" icon="people" />
        @if (canOffboard()) {
          <app-button variant="primary" [disabled]="startableEmployees().length === 0" (pressed)="openForm()">
            + Start Offboarding
          </app-button>
        }
      </div>
    </header>

    @if (loading()) {
      <app-loader label="Loading offboardings…" />
    } @else if (error(); as errorMessage) {
      <app-error-state [message]="errorMessage" [retryable]="true" (retry)="load()" />
    } @else {
      <app-kpi-tiles ariaLabel="Offboarding totals" [tiles]="kpiTiles()" />

      @if (inProgress().length === 0) {
        <app-empty-state
          title="No offboardings in progress"
          description="People in your reporting line who are being offboarded will show here."
        />
      } @else {
        <app-data-table
          [columns]="columns"
          [rows]="inProgress()"
          [trackBy]="trackByEmployee"
          [rowClickable]="true"
          [rowTestId]="rowTestId"
          caption="Offboardings in progress"
          (rowClicked)="viewOffboarding($event.employeeId)"
        >
          <ng-template appDataTableCell="employee" let-item>
            <span class="ob-employee">
              <app-avatar size="sm" shape="circle" [userName]="item.employeeName" />
              <span class="ob-employee__name">{{ item.employeeName }}</span>
            </span>
          </ng-template>
          <ng-template appDataTableCell="position" let-item>{{ item.positionName || '—' }}</ng-template>
          <ng-template appDataTableCell="department" let-item>{{ item.departmentName || '—' }}</ng-template>
          <ng-template appDataTableCell="status" let-item>
            <span class="ob-status-pill">{{ statusLabel(item.currentOffboardingStatus) }}</span>
          </ng-template>
          <ng-template appDataTableCell="actions" let-item>
            <app-button variant="secondary" size="sm" (pressed)="viewOffboarding(item.employeeId)">Continue</app-button>
          </ng-template>
        </app-data-table>
      }
    }

    <app-start-offboarding-modal
      [open]="formOpen()"
      [employeeOptions]="employeeOptions()"
      (started)="viewOffboarding($event)"
      (closed)="closeForm()"
    />
  `,
  styles: [`
    .ob-page-header {
      margin-top: -1.25rem;
      margin-bottom: 1.25rem;
      padding-bottom: 0.625rem;
      border-bottom: 1px solid var(--color-border);
    }
    .ob-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      height: 36px;
      min-height: 36px;
    }
    .ob-employee {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      min-width: 0;
    }
    .ob-employee__name {
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
      color: var(--color-text-primary);
    }
    .ob-status-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.125rem 0.5rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: color-mix(in srgb, var(--color-accent) 14%, transparent);
      color: var(--color-accent);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingOverviewComponent implements OnInit {
  private readonly api = inject(OffboardingApiService);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  protected readonly columns: readonly DataTableColumn[] = [
    { key: 'employee', label: 'Employee', width: '30%' },
    { key: 'position', label: 'Position' },
    { key: 'department', label: 'Department' },
    { key: 'status', label: 'Status', width: '9rem' },
    { key: 'actions', label: 'Actions', hideLabel: true, interactive: true, align: 'end', width: '8rem' }
  ];
  protected readonly trackByEmployee = (item: OffboardingOverviewItemResponse): string => item.employeeId;
  protected readonly rowTestId = (item: OffboardingOverviewItemResponse): string => `offboarding-row-${item.employeeId}`;

  /** Everyone in the caller's reporting line (the backend scopes this to their visibility, never unrestricted). */
  readonly items = signal<readonly OffboardingOverviewItemResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));

  /** The list only shows people whose offboarding is still open - not the whole reporting line. */
  readonly inProgress = computed(() =>
    this.items().filter((i) => i.currentOffboardingStatus !== null && OPEN_STATUSES.has(i.currentOffboardingStatus)));
  readonly completedCount = computed(() => this.items().filter((i) => i.currentOffboardingStatus === 'completed').length);

  /** Only employees in the reporting line without an open offboarding - the picker never offers anyone else. */
  readonly startableEmployees = computed(() => this.items().filter((i) => i.canStartOffboarding));
  readonly employeeOptions = computed(() =>
    this.startableEmployees().map((i) => ({ value: i.employeeId, label: i.employeeName })));

  readonly kpiTiles = computed<readonly KpiTile[]>(() => [
    { label: 'In progress', value: this.inProgress().length, icon: 'clock', tone: 'accent', testId: 'kpi-in-progress' },
    { label: 'Completed exits', value: this.completedCount(), icon: 'check-circle', tone: 'success', testId: 'kpi-completed' },
    { label: 'People in your reporting line', value: this.items().length, icon: 'users', tone: 'neutral', testId: 'kpi-covered' }
  ]);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getOffboardingOverview().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to load offboardings.'));
      }
    });
  }

  statusLabel(status: OffboardingRecordStatus | null): string {
    return status ? STATUS_LABELS[status] : '—';
  }

  openForm(): void {
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  viewOffboarding(employeeId: string): void {
    void this.router.navigate(['/people/offboarding', employeeId]);
  }
}
