import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-employee-period-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      ariaLabel="Select month"
      [options]="store.monthOptions()"
      [value]="store.month()"
      (valueChange)="onChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePeriodPickerComponent {
  protected readonly store = inject(EmployeePeriodStore);

  onChange(month: string): void {
    this.store.setMonth(month);
  }
}
