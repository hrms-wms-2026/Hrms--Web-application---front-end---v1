import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-employee-compare-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      ariaLabel="Compare with"
      [options]="store.compareOptions()"
      [value]="store.compareMonth() ?? ''"
      (valueChange)="store.setCompareMonth($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeComparePickerComponent {
  protected readonly store = inject(EmployeePeriodStore);
}
