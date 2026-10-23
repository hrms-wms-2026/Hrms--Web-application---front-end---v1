import { Component, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { InputComponent } from '../../../../shared/ui/input/input.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { WorkApprovalsApiService } from '../../data-access/work-approvals-api.service';
import { toSafeErrorMessage } from '../../../../core/services/error-handler.service';

/** Ask for more allocated hours on a module. The server either adds them at once (the caller owns the
 *  parent or above) or sends an approval request, which then shows up in the approver's Inbox. */
@Component({
  selector: 'app-allocation-request-modal',
  standalone: true,
  imports: [ModalComponent, InputComponent, ButtonComponent],
  template: `
    @if (open()) {
      <app-modal data-testid="allocation-request-modal" [open]="true" [title]="'Request more hours · ' + moduleTitle()" (closed)="closed.emit()">
        <div class="arm">
          <app-input label="Additional hours" type="number" [value]="hours()" [error]="errors()['hours'] || ''" (valueChange)="hours.set($event)" />
          <app-input label="Reason" [value]="reason()" [error]="errors()['reason'] || ''" (valueChange)="reason.set($event)" />
          @if (error()) { <p class="arm__error" role="alert">{{ error() }}</p> }
          <div class="arm__actions">
            <app-button variant="secondary" (pressed)="closed.emit()">Cancel</app-button>
            <app-button data-testid="allocation-request-submit" variant="primary" [disabled]="saving()" (pressed)="submit()">
              {{ saving() ? 'Submitting…' : 'Submit request' }}
            </app-button>
          </div>
        </div>
      </app-modal>
    }
  `,
  styles: [`
    .arm { display: flex; flex-direction: column; gap: 14px; }
    .arm__actions { display: flex; justify-content: flex-end; gap: 8px; }
    .arm__error { margin: 0; color: var(--color-danger); }
  `]
})
export class AllocationRequestModalComponent {
  private readonly api = inject(WorkApprovalsApiService);

  open = input(false);
  moduleId = input.required<string>();
  moduleTitle = input('');
  closed = output<void>();
  /** The request was sent (or the hours were added directly). */
  submitted = output<void>();

  protected readonly hours = signal('');
  protected readonly reason = signal('');
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    // Every opening starts with an empty form.
    effect(() => {
      if (!this.open()) return;
      this.hours.set('');
      this.reason.set('');
      this.errors.set({});
      this.error.set(null);
    });
  }

  protected async submit(): Promise<void> {
    const errors: Record<string, string> = {};
    const hours = Number(this.hours());
    if (!Number.isFinite(hours) || hours <= 0) errors['hours'] = 'Hours must be greater than zero.';
    if (!this.reason().trim()) errors['reason'] = 'Reason is required.';
    this.errors.set(errors);
    this.error.set(null);
    if (Object.keys(errors).length > 0) return;

    this.saving.set(true);
    try {
      await firstValueFrom(this.api.createAllocationRequest(this.moduleId(), { requestedAdditionalHours: hours, reason: this.reason().trim() }));
      this.submitted.emit();
    } catch (err: any) {
      this.error.set(toSafeErrorMessage(err, 'Failed to send the request.'));
    } finally {
      this.saving.set(false);
    }
  }
}
