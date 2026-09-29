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
  selector: 'app-app-offboarding-overview',
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

    <div class="ob-metrics-grid">
      <div class="ob-metric-card">
        <span class="ob-metric-card__title">Total Covered</span>
        <span class="ob-metric-card__value">{{ items().length }}</span>
      </div>
      <div class="ob-metric-card">
        <span class="ob-metric-card__title">Active Offboardings</span>
        <span class="ob-metric-card__value ob-metric-card__value--active">{{ activeCount() }}</span>
      </div>
      <div class="ob-metric-card">
        <span class="ob-metric-card__title">Completed Exits</span>
        <span class="ob-metric-card__value ob-metric-card__value--completed">{{ completedCount() }}</span>
      </div>
    </div>

    @if (formOpen()) {
      <section class="ob-form-card">
        <div class="ob-form-card__header">
          <h3 class="ob-form-card__title">Initiate Employee Offboarding</h3>
          <p class="ob-form-card__subtitle">Select a covered employee to begin their exit workflow and task checklists.</p>
        </div>
        <form [formGroup]="form" (ngSubmit)="submit()" class="ob-form-grid">
          <div class="col-span-full">
            <app-select
              label="Employee *"
              placeholder="Select an employee you cover"
              [options]="employeeOptions()"
              [value]="form.controls.employeeId.value || ''"
              (valueChange)="form.controls.employeeId.setValue($event)"
            />
          </div>
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
          <div class="col-span-full">
            <app-input
              label="Notes"
              [value]="form.controls.notes.value || ''"
              (valueChange)="form.controls.notes.setValue($event || null)"
            />
          </div>
          <div class="ob-form-actions col-span-full">
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
      <p class="ob-error-msg" role="alert">{{ error() }}</p>
    } @else if (items().length === 0) {
      <div class="ob-empty-box">
        <p class="ob-empty-box__text">No employees are currently within your management coverage.</p>
      </div>
    } @else {
      <div class="ob-cards-container">
        @for (item of items(); track item.employeeId) {
          <div class="ob-employee-card rounded-lg">
            <div class="ob-employee-card__main">
              <div class="ob-avatar">{{ getInitials(item.employeeName) }}</div>
              <div class="ob-employee-card__info">
                <div class="ob-employee-card__name-row">
                  <h4 class="ob-employee-card__name">{{ item.employeeName }}</h4>
                  @if (item.currentOffboardingStatus) {
                    <span class="ob-status-pill" [class.ob-status-pill--completed]="item.currentOffboardingStatus === 'completed'">
                      {{ item.currentOffboardingStatus }}
                    </span>
                  } @else {
                    <span class="ob-status-pill ob-status-pill--active">Active</span>
                  }
                </div>
                <p class="ob-employee-card__meta">
                  <span>{{ item.positionName || 'Unassigned position' }}</span>
                  <span class="ob-dot">•</span>
                  <span>{{ item.departmentName || 'No department' }}</span>
                </p>
              </div>
            </div>
            @if (!item.canStartOffboarding) {
              <div class="ob-employee-card__action">
                <app-button variant="secondary" size="sm" (pressed)="viewOffboarding(item.employeeId)">
                  {{ item.currentOffboardingStatus === 'completed' ? 'View Details' : 'Continue Offboarding' }}
                </app-button>
              </div>
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
    .ob-metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .ob-metric-card {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      padding: 1rem 1.15rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    }
    .ob-metric-card__title {
      font-size: 0.775rem;
      font-weight: 600;
      color: var(--color-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .ob-metric-card__value {
      font-size: 1.5rem;
      font-weight: 750;
      color: var(--color-text-primary);
    }
    .ob-metric-card__value--active {
      color: var(--color-primary);
    }
    .ob-metric-card__value--completed {
      color: #16a34a;
    }
    .ob-form-card {
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 14px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
      max-width: 44rem;
    }
    .ob-form-card__header {
      margin-bottom: 1.25rem;
    }
    .ob-form-card__title {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--color-text-primary);
    }
    .ob-form-card__subtitle {
      margin: 0.25rem 0 0;
      font-size: 0.825rem;
      color: var(--color-text-secondary);
    }
    .ob-form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .ob-form-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }
    .ob-cards-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .ob-employee-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .ob-employee-card:hover {
      border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    }
    .ob-employee-card__main {
      display: flex;
      align-items: center;
      gap: 0.875rem;
    }
    .ob-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
      color: var(--color-primary);
      font-size: 0.875rem;
      font-weight: 700;
      flex-shrink: 0;
    }
    .ob-employee-card__info {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }
    .ob-employee-card__name-row {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }
    .ob-employee-card__name {
      margin: 0;
      font-size: 0.925rem;
      font-weight: 650;
      color: var(--color-text-primary);
    }
    .ob-status-pill {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.5rem;
      border-radius: 9999px;
      font-size: 0.725rem;
      font-weight: 600;
      text-transform: capitalize;
      background: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface));
      color: var(--color-primary);
    }
    .ob-status-pill--completed {
      background: color-mix(in srgb, #16a34a 12%, var(--color-surface));
      color: #16a34a;
    }
    .ob-status-pill--active {
      background: color-mix(in srgb, var(--color-border) 40%, transparent);
      color: var(--color-text-secondary);
    }
    .ob-employee-card__meta {
      margin: 0;
      font-size: 0.8rem;
      color: var(--color-text-secondary);
    }
    .ob-dot {
      margin: 0 0.35rem;
      opacity: 0.5;
    }
    .ob-error-msg {
      color: var(--color-danger-text, #dc2626);
      font-size: 0.875rem;
    }
    .ob-empty-box {
      padding: 2.5rem 1.5rem;
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: 12px;
    }
    .ob-empty-box__text {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }
    @media (max-width: 640px) {
      .ob-form-grid {
        grid-template-columns: 1fr;
      }
      .ob-employee-card {
        flex-direction: column;
        align-items: flex-start;
      }
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

  readonly activeCount = computed(() => this.items().filter(i => i.currentOffboardingStatus && i.currentOffboardingStatus !== 'completed').length);
  readonly completedCount = computed(() => this.items().filter(i => i.currentOffboardingStatus === 'completed').length);

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

  getInitials(name: string): string {
    if (!name) return 'EO';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
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
