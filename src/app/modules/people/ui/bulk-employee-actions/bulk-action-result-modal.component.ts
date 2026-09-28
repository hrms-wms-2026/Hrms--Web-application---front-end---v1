import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { ModalComponent } from '../../../../shared/ui/modal/modal.component';
import { BulkEmployeeActionResponse } from '../../models/employee.model';

@Component({
  selector: 'app-bulk-action-result-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="!!result()" [title]="title()" (closed)="closed.emit()">
      @if (result(); as r) {
        <div class="flex flex-col gap-4">
          <p class="text-sm font-semibold text-[var(--color-text-primary)]" data-testid="bulk-result-summary">
            {{ r.succeeded }} changed · {{ r.pendingApproval }} sent for approval · {{ r.failed }} skipped
          </p>
          @if (failures().length > 0) {
            <ul class="flex max-h-64 flex-col gap-2 overflow-y-auto text-sm">
              @for (item of failures(); track item.employeeId) {
                <li class="rounded-md border border-[var(--color-border)] p-2" [attr.data-testid]="'bulk-result-failure-' + item.employeeId">
                  <span class="font-semibold text-[var(--color-text-primary)]">{{ names().get(item.employeeId) ?? 'Unknown employee' }}</span>
                  <span class="block text-xs text-[var(--color-danger-text)]">{{ item.reason }}</span>
                </li>
              }
            </ul>
          }
          <div class="flex justify-end"><app-button (pressed)="closed.emit()">Done</app-button></div>
        </div>
      }
    </app-modal>
  `
})
export class BulkActionResultModalComponent {
  readonly result = input<BulkEmployeeActionResponse | null>(null);
  readonly title = input('Bulk action results');
  readonly names = input<ReadonlyMap<string, string>>(new Map());
  readonly closed = output<void>();

  protected readonly failures = computed(() => (this.result()?.items ?? []).filter((i) => i.outcome === 'failed'));
}
