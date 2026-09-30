import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { recentMonths } from '../../utils/employee-overview.utils';

@Component({
  selector: 'app-employee-period-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      ariaLabel="Select month"
      [options]="options"
      [value]="store.month()"
      (valueChange)="onChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeePeriodPickerComponent {
  protected readonly store = inject(EmployeePeriodStore);

  readonly options: readonly SelectOption[] = recentMonths();

  onChange(month: string): void {
    this.store.setMonth(month);
  }
}
