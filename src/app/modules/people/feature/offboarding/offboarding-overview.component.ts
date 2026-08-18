import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewItemResponse } from '../../models/offboarding.model';

@Component({
  selector: 'app-offboarding-overview',
  standalone: true,
  imports: [ButtonComponent, LoaderComponent],
  template: `
    <h1 class="text-xl font-bold mb-4">Offboarding</h1>
    @if (loading()) {
      <app-loader label="Loading your covered employees…" />
    } @else if (error()) {
      <p class="text-sm text-[var(--color-danger-text)]">{{ error() }}</p>
    } @else if (items().length === 0) {
      <p class="text-sm text-[var(--color-text-secondary)]">No employees are currently within your management coverage.</p>
    } @else {
      <div class="space-y-2">
        @for (item of items(); track item.employeeId) {
          <div class="flex items-center justify-between p-3 border border-[var(--color-border)] rounded-lg">
            <div>
              <p class="text-sm font-medium">{{ item.employeeName }}</p>
              <p class="text-xs text-[var(--color-text-secondary)]">
                {{ item.positionName || 'Unassigned position' }} · {{ item.departmentName || 'No department' }}
                @if (item.currentOffboardingStatus) { · {{ item.currentOffboardingStatus }} }
              </p>
            </div>
            @if (item.canStartOffboarding && canOffboard()) {
              <app-button variant="secondary" (pressed)="startOffboarding(item.employeeId)">Start Offboarding</app-button>
            } @else if (!item.canStartOffboarding) {
              <app-button variant="secondary" (pressed)="viewOffboarding(item.employeeId)">
                {{ item.currentOffboardingStatus === 'completed' ? 'View' : 'Continue' }}
              </app-button>
            }
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingOverviewComponent implements OnInit {
  private readonly api = inject(OffboardingApiService);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);

  readonly items = signal<readonly OffboardingOverviewItemResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));

  ngOnInit(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.getOffboardingOverview().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(toSafeErrorMessage(err, 'Failed to load your covered employees.'));
      }
    });
  }

  startOffboarding(employeeId: string): void {
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }

  viewOffboarding(employeeId: string): void {
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }
}
