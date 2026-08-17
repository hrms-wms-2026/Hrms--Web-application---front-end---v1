import { ChangeDetectionStrategy, Component, inject, input, output, signal, effect, computed } from '@angular/core';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { PeopleApiService } from '../../data-access/people-api.service';
import { PositionApiService } from '../../../organization/data-access/position-api.service';
import { PositionListItemResponse } from '../../../organization/models/position.model';

@Component({
  selector: 'app-change-position-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  template: `
    <app-modal [open]="open()" [title]="modalTitle()" (closed)="onClose()">
      <div class="flex flex-col gap-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-text-secondary)]">New position</span>
          <select
            class="rounded-md border border-[var(--color-border)] p-2"
            (change)="selectedPositionId.set($any($event.target).value)"
          >
            <option value="">Select a position…</option>
            @for (position of positions(); track position.id) {
              <option [value]="position.id" [selected]="position.id === selectedPositionId()">{{ position.name }}</option>
            }
          </select>
          @if (loadError(); as loadErrorMessage) {
            <p class="text-xs text-[var(--color-danger-text)]">{{ loadErrorMessage }}</p>
          }
        </label>
        @if (selectedPositionRequiresApproval()) {
          <p class="rounded-md bg-[var(--color-warning-subtle)] p-2 text-xs text-[var(--color-warning-text)]">
            This position requires approval. Your request will be sent to an approver and won't take effect until approved.
          </p>
        }
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-[var(--color-text-secondary)]">Effective from</span>
          <input
            type="date"
            class="rounded-md border border-[var(--color-border)] p-2"
            [value]="effectiveFrom()"
            (change)="effectiveFrom.set($any($event.target).value)"
          />
        </label>
        <div class="flex justify-end gap-2">
          <app-button variant="secondary" (pressed)="onClose()">Cancel</app-button>
          <app-button
            type="submit"
            [loading]="submitting()"
            [disabled]="!selectedPositionId() || !effectiveFrom() || submitting()"
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
  readonly employeeId = input.required<string>();
  readonly legalEntityId = input.required<string>();
  readonly currentPositionId = input<string | null>(null);
  readonly changeReason = input.required<'Promotion' | 'Transfer'>();
  readonly closed = output<void>();
  readonly changed = output<void>();
  readonly pendingApproval = output<void>();

  readonly modalTitle = computed(() => (this.changeReason() === 'Promotion' ? 'Promotion' : 'Transfer'));
  readonly positions = signal<readonly PositionListItemResponse[]>([]);
  readonly selectedPositionId = signal('');
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));
  readonly submitting = signal(false);
  readonly loadError = signal<string | null>(null);

  readonly selectedPositionRequiresApproval = computed(
    () => this.positions().find((p) => p.id === this.selectedPositionId())?.requiresApproval ?? false
  );

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
        this.loadError.set(toSafeErrorMessage(err, 'Could not load positions.'));
      }
    });
  }

  submit(): void {
    if (!this.selectedPositionId() || !this.effectiveFrom()) {
      return;
    }
    this.submitting.set(true);
    this.peopleApi
      .changePosition(this.employeeId(), {
        positionId: this.selectedPositionId(),
        effectiveFrom: this.effectiveFrom(),
        changeReason: this.changeReason()
      })
      .subscribe({
        next: (response) => {
          this.submitting.set(false);
          if (response.pendingApproval) {
            this.pendingApproval.emit();
          } else {
            this.changed.emit();
          }
        },
        error: (err) => {
          this.submitting.set(false);
          this.notifications.error(toSafeErrorMessage(err, 'Could not change position.'));
        }
      });
  }

  onClose(): void {
    this.selectedPositionId.set('');
    this.closed.emit();
  }
}
