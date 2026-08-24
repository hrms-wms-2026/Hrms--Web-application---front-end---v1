import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActiveHolder } from '../../models/onboarding-draft.model';

@Component({
  selector: 'app-reports-to-picker',
  standalone: true,
  template: `
    <div class="rtp-list" role="radiogroup" aria-label="Reports to">
      @for (holder of holders(); track holder.employeeId) {
        <button
          type="button"
          class="rtp-option"
          data-testid="reports-to-option"
          [class.rtp-option--selected]="holder.employeeId === selectedEmployeeId()"
          [attr.aria-pressed]="holder.employeeId === selectedEmployeeId()"
          (click)="selectedEmployeeIdChange.emit(holder.employeeId)"
        >
          {{ holder.firstName }} {{ holder.lastName }}
          <span class="rtp-option__email">{{ holder.workEmail }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './reports-to-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReportsToPickerComponent {
  readonly holders = input<readonly ActiveHolder[]>([]);
  readonly selectedEmployeeId = input<string | null>(null);
  readonly selectedEmployeeIdChange = output<string | null>();
}
