import { ChangeDetectionStrategy, Component, inject, input, output, signal, effect } from '@angular/core';
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
    <app-modal [open]="open()" title="Change Position" (closed)="onClose()">
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
        </label>
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
          <app-button [loading]="submitting()" [disabled]="!selectedPositionId() || submitting()" (pressed)="submit()">
            Save
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
  readonly closed = output<void>();
  readonly changed = output<void>();

  readonly positions = signal<readonly PositionListItemResponse[]>([]);
  readonly selectedPositionId = signal('');
  readonly effectiveFrom = signal(new Date().toISOString().slice(0, 10));
  readonly submitting = signal(false);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.loadPositions();
      }
    });
  }

  private loadPositions(): void {
    this.positionApi.listFlat(this.legalEntityId()).subscribe((page) => {
      this.positions.set(page.items.filter((p) => p.id !== this.currentPositionId()));
    });
  }

  submit(): void {
    if (!this.selectedPositionId()) {
      return;
    }
    this.submitting.set(true);
    this.peopleApi.changePosition(this.employeeId(), {
      positionId: this.selectedPositionId(),
      effectiveFrom: this.effectiveFrom()
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.changed.emit();
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
