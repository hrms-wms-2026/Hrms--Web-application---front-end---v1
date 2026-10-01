import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeeComparePickerComponent } from './employee-compare-picker.component';

describe('EmployeeComparePickerComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [EmployeeComparePickerComponent],
      providers: [EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setBounds('2026-07-01', null, new Date(2026, 8, 30));
    const fixture = TestBed.createComponent(EmployeeComparePickerComponent);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance as SelectComponent;
    return { fixture, select, store };
  }

  it('offers every bounded month except the selected month', () => {
    const { fixture, select, store } = setup();

    expect(select.options()).toEqual(store.compareOptions());
    expect(select.options().map((option) => option.value)).toEqual(['2026-08', '2026-07']);
    expect(fixture.nativeElement.querySelector('app-select')).toBeTruthy();
  });

  it('writes the selected comparison month to the store', () => {
    const { select, store } = setup();
    const setCompareMonth = vi.spyOn(store, 'setCompareMonth');

    select.valueChange.emit('2026-08');

    expect(setCompareMonth).toHaveBeenCalledWith('2026-08');
    expect(store.compareMonth()).toBe('2026-08');
  });
});
