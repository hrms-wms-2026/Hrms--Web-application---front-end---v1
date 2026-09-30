import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SelectComponent, SelectOption } from '../../../../shared/ui/select/select.component';
import { EmployeeCompareMode, EmployeePeriodStore } from '../../state/employee-period.store';

@Component({
  selector: 'app-employee-compare-picker',
  standalone: true,
  imports: [SelectComponent],
  template: `
    <app-select
      ariaLabel="Compare with"
      [options]="options"
      [value]="store.compare()"
      (valueChange)="onChange($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeComparePickerComponent {
  protected readonly store = inject(EmployeePeriodStore);

  readonly options: readonly SelectOption[] = [
    { value: 'none', label: 'No comparison' },
    { value: 'previous', label: 'Compare to previous period' }
  ];

  onChange(value: string): void {
    if (value === 'none' || value === 'previous') {
      this.store.setCompare(value as EmployeeCompareMode);
    }
  }
}
