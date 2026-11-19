import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PositionListItemResponse } from '../../../organization/models/position.model';
import { PeopleApiService } from '../../data-access/people-api.service';
import { BulkEmployeeActionResponse } from '../../models/employee.model';
import { ActiveHolder } from '../../models/onboarding-draft.model';
import { ReportsToPickerComponent } from '../reports-to-picker/reports-to-picker.component';

@Component({
  selector: 'app-change-position-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, DatePickerComponent, ReportsToPickerComponent, SelectComponent],
  template: `
    <app-modal [open]="open()" [title]="modalTitle()" (closed)="onClose()">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-1 text-sm">
          <app-select
            label="New position"
            placeholder="Select a position…"
            [options]="positionOptions()"
            [value]="selectedPositionId()"
            (valueChange)="onPositionSelected($event)"
          />
          @if (loadError(); as loadErrorMessage) {
            <p class="text-xs text-[var(--color-danger-text)]">{{ loadErrorMessage }}</p>
          }
        </div>
        @if (selectedPositionRequiresApproval()) {
          <p class="rounded-md bg-[var(--color-warning-subtle)] p-2 text-xs text-[var(--color-warning-text)]">
            This position requires approval. Your request will be sent to an approver and won't take effect until approved.
          </p>
        }
        @if (selectedPositionRequiresManagerPick()) {
          <div class="flex flex-col gap-1 text-sm">
            <span class="text-[var(--color-text-secondary)]">Reports to</span>
            <p class="text-xs text-[var(--color-text-secondary)]">
              More than one person holds the reporting position — choose who {{ isBulk() ? 'these employees report' : 'this employee reports' }} to.
            </p>
            <app-reports-to-picker
              [holders]="activeHolders()"
              [selectedEmployeeId]="selectedReportsToEmployeeId()"
              (selectedEmployeeIdChange)="selectedReportsToEmployeeId.set($event)"
            />
          </div>
        }
        <app-date-picker
          label="Effective from"
          placeholder="YYYY-MM-DD"
          [value]="effectiveFrom()"
          (valueChange)="effectiveFrom.set($event)"
        />
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="onClose()">Cancel</app-button>
          <app-button
            type="submit"
            data-testid="change-position-submit"
            [loading]="submitting()"
            [disabled]="!selectedPositionId() || !effectiveFrom() || submitting() || (selectedPositionRequiresManagerPick() && !selectedReportsToEmployeeId())"
            (pressed)="submit()"
          >
            {{ selectedPositionRequiresApproval() ? 'Send for approval' : 'Save' }}
          </app-button>
        </div>
      </div>
    </app-modal>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePositionModalComponent {
  private readonly peopleApi = inject(PeopleApiService);
  private readonly positionApi = inject(PositionApiService);
  private readonly notifications = inject(NotificationService);

  readonly open = input.required<boolean>();
  readonly employeeId = input<string>('');
  /** Non-empty switches the modal to bulk mode: one position applied to every id. */
  readonly employeeIds = input<readonly string[]>([]);
  readonly legalEntityId = input.required<string>();
  readonly currentPositionId = input<string | null>(null);
  readonly changeReason = input.required<'Promotion' | 'Transfer'>();
  readonly closed = output<void>();
  readonly changed = output<void>();
  readonly pendingApproval = output<void>();
  readonly bulkCompleted = output<BulkEmployeeActionResponse>();

  readonly isBulk = computed(() => this.employeeIds().length > 0);
  readonly modalTitle = computed(() => {
    const base = this.changeReason() === 'Promotion' ? 'Promotion' : 'Transfer';
    return this.isBulk() ? `${base} · ${this.employeeIds().length} employees` : base;
  });
  readonly positions = signal<readonly PositionListItemResponse[]>([]);
  readonly selectedPositionId = signal('');
  readonly positionOptions = computed<readonly SelectOption[]>(() =>
    this.positions().map((p) => ({ value: p.id, label: p.name }))
  );
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly activeHolders = signal<readonly ActiveHolder[]>([]);
  readonly selectedReportsToEmployeeId = signal<string | null>(null);

  readonly selectedPositionRequiresApproval = computed(
    () => this.positions().find((p) => p.id === this.selectedPositionId())?.requiresApproval ?? false
  );

  readonly selectedPositionRequiresManagerPick = computed(() => this.activeHolders().length > 1);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.loadPositions();
      }
    });
  }

  private loadPositions(): void {
    this.loadError.set(null);
    this.positionApi.listFlat(this.legalEntityId(), { pageSize: 100, includeInactive: false }).subscribe({
      next: (page) => {
        this.positions.set(page.items.filter((p) => p.id !== this.currentPositionId()));
      },
      error: (err) => {
        this.loadError.set(toSafeErrorMessage(err, 'Failed to load positions for promotion/transfer.'));
      }
    });
  }

  onPositionSelected(positionId: string): void {
    this.selectedPositionId.set(positionId);
    this.selectedReportsToEmployeeId.set(null);
    this.activeHolders.set([]);

    if (!positionId) {
      return;
    }

    this.peopleApi.getActiveHolders(this.legalEntityId(), positionId).subscribe({
      next: (holders: readonly ActiveHolder[]) => {
        this.activeHolders.set(holders);
        if (holders.length === 1) {
          this.selectedReportsToEmployeeId.set(holders[0].employeeId);
        }
      },
      error: () => {
        this.activeHolders.set([]);
      }
    });
  }

  onClose(): void {
    this.selectedPositionId.set('');
    this.loadError.set(null);
    this.activeHolders.set([]);
    this.selectedReportsToEmployeeId.set(null);
    this.closed.emit();
  }

  submit(): void {
    const posId = this.selectedPositionId();
    const eff = this.effectiveFrom();
    if (!posId || !eff) {
      return;
    }

    this.submitting.set(true);

    const payload = {
      positionId: posId,
      effectiveFrom: eff,
      changeReason: this.changeReason(),
      reportsToEmployeeId: this.selectedReportsToEmployeeId()
    };

    if (this.isBulk()) {
      this.peopleApi.bulkChangePosition({ ...payload, employeeIds: [...this.employeeIds()] }).subscribe({
        next: (res) => {
          this.submitting.set(false);
          this.bulkCompleted.emit(res);
          this.onClose();
        },
        error: (err) => {
          this.submitting.set(false);
          this.notifications.error(toSafeErrorMessage(err, 'Failed to change positions.'));
        }
      });
      return;
    }

    this.peopleApi.changePosition(this.employeeId(), payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.pendingApproval) {
          this.notifications.success('Position change request submitted for approval.');
          this.pendingApproval.emit();
        } else {
          this.notifications.success('Position updated successfully.');
          this.changed.emit();
        }
        this.onClose();
      },
      error: (err) => {
        this.submitting.set(false);
        this.notifications.error(toSafeErrorMessage(err, 'Failed to change position.'));
      }
    });
  }
}
