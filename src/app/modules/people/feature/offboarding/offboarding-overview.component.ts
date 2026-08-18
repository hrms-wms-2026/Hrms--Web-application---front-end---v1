import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { BreadcrumbHeaderComponent } from '../../../../shared/ui/breadcrumb-header/breadcrumb-header.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { LoaderComponent } from '../../../../shared/ui/loader/loader.component';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { OffboardingApiService } from '../../data-access/offboarding-api.service';
import { OffboardingOverviewItemResponse } from '../../models/offboarding.model';
import { OffboardingWizardStore } from '../../state/offboarding-wizard.store';

@Component({
  selector: 'app-offboarding-overview',
  standalone: true,
  imports: [ReactiveFormsModule, BreadcrumbHeaderComponent, ButtonComponent, InputComponent, LoaderComponent, SelectComponent],
  template: `
    <header class="ob-page-header">
      <div class="ob-header-row">
        <app-breadcrumb-header
          parentLabel="People"
          currentLabel="Offboarding"
          icon="people"
        />
        @if (canOffboard() && !formOpen()) {
          <app-button variant="primary" [disabled]="startableEmployees().length === 0" (pressed)="openForm()">
            + Start Offboarding
          </app-button>
        }
      </div>
    </header>

    @if (formOpen()) {
      <section class="cb-card bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 mb-6 space-y-4 max-w-xl">
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <app-select
            label="Employee *"
            placeholder="Select an employee you cover"
            [options]="employeeOptions()"
            [value]="form.controls.employeeId.value || ''"
            (valueChange)="form.controls.employeeId.setValue($event)"
          />
          <app-select
            label="Exit reason *"
            [options]="[
              { value: 'resignation', label: 'Resignation' },
              { value: 'termination', label: 'Termination' },
              { value: 'retirement', label: 'Retirement' },
              { value: 'contract_end', label: 'Contract End' }
            ]"
            [value]="form.controls.reason.value || ''"
            (valueChange)="form.controls.reason.setValue($any($event))"
          />
          <app-input
            label="Last working day *"
            type="date"
            [value]="form.controls.lastWorkingDate.value || ''"
            (valueChange)="form.controls.lastWorkingDate.setValue($event)"
          />
          <app-select
            label="Knowledge risk level *"
            [options]="[
              { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
            ]"
            [value]="form.controls.knowledgeRiskLevel.value || ''"
            (valueChange)="form.controls.knowledgeRiskLevel.setValue($any($event))"
          />
          <app-select
            label="Rehire eligibility"
            [options]="[
              { value: 'eligible', label: 'Eligible' }, { value: 'not_eligible', label: 'Not Eligible' },
              { value: 'conditional', label: 'Conditional' }
            ]"
            [value]="form.controls.rehireEligibility.value || ''"
            (valueChange)="form.controls.rehireEligibility.setValue($any($event) || null)"
          />
          <app-input
            label="Notes"
            [value]="form.controls.notes.value || ''"
            (valueChange)="form.controls.notes.setValue($event || null)"
          />
          <div class="flex gap-3">
            <app-button variant="primary" type="submit" [loading]="submitting()" [disabled]="form.invalid">
              Start Offboarding
            </app-button>
            <app-button variant="secondary" type="button" (pressed)="closeForm()">Cancel</app-button>
          </div>
        </form>
      </section>
    }

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
            @if (!item.canStartOffboarding) {
              <app-button variant="secondary" size="sm" (pressed)="viewOffboarding(item.employeeId)">
                {{ item.currentOffboardingStatus === 'completed' ? 'View' : 'Continue' }}
              </app-button>
            }
          </div>
        }
      </div>
    }
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OffboardingOverviewComponent implements OnInit {
  private readonly api = inject(OffboardingApiService);
  private readonly router = inject(Router);
  private readonly permissionService = inject(PermissionService);
  private readonly wizardStore = inject(OffboardingWizardStore);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<readonly OffboardingOverviewItemResponse[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly formOpen = signal(false);
  readonly submitting = signal(false);
  readonly canOffboard = computed(() => this.permissionService.hasPermission('employees:offboard'));

  /** Only employees within coverage who don't already have an open offboarding - the same
   *  set the "Start Offboarding" employee picker offers, so the form can never be submitted
   *  for someone it shouldn't be. */
  readonly startableEmployees = computed(() => this.items().filter((i) => i.canStartOffboarding));
  readonly employeeOptions = computed(() =>
    this.startableEmployees().map((i) => ({ value: i.employeeId, label: i.employeeName })));

  readonly form = this.fb.group({
    employeeId: ['', Validators.required],
    reason: ['resignation' as const, Validators.required],
    lastWorkingDate: ['', Validators.required],
    knowledgeRiskLevel: ['medium' as const, Validators.required],
    rehireEligibility: [null as 'eligible' | 'not_eligible' | 'conditional' | null],
    notes: [null as string | null]
  });

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
        this.error.set(toSafeErrorMessage(err, 'Failed to load your covered employees.'));
      }
    });
  }

  openForm(): void {
    this.form.reset({
      employeeId: '', reason: 'resignation', lastWorkingDate: '', knowledgeRiskLevel: 'medium',
      rehireEligibility: null, notes: null
    });
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.submitting.set(true);
    const ok = await this.wizardStore.startOffboarding(value.employeeId!, {
      reason: value.reason!,
      lastWorkingDate: value.lastWorkingDate!,
      knowledgeRiskLevel: value.knowledgeRiskLevel!,
      rehireEligibility: value.rehireEligibility,
      notes: value.notes
    });
    this.submitting.set(false);
    if (ok) {
      void this.router.navigate(['/people/employees', value.employeeId, 'offboarding']);
    }
  }

  viewOffboarding(employeeId: string): void {
    void this.router.navigate(['/people/employees', employeeId, 'offboarding']);
  }
}
