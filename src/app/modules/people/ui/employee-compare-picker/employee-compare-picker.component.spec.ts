import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from './employee-compare-picker.component';

describe('EmployeeComparePickerComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [EmployeeComparePickerComponent],
      providers: [EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    const fixture = TestBed.createComponent(EmployeeComparePickerComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('offers no comparison and previous period', () => {
    const { fixture } = setup();

    expect(fixture.componentInstance.options.map((o) => o.value)).toEqual(['none', 'previous']);
    expect(fixture.nativeElement.querySelector('app-select')).toBeTruthy();
  });

  it('writes the choice to the store', () => {
    const { fixture, store } = setup();

    fixture.componentInstance.onChange('previous');
    expect(store.comparePrevious()).toBe(true);

    fixture.componentInstance.onChange('none');
    expect(store.comparePrevious()).toBe(false);
  });

  it('ignores values it does not know', () => {
    const { fixture, store } = setup();

    fixture.componentInstance.onChange('last-year');

    expect(store.compare()).toBe('none');
  });
});
