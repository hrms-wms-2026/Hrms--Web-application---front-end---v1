import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SelectComponent } from '../../../../shared/ui/select/select.component';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeePeriodPickerComponent } from './employee-period-picker.component';

describe('EmployeePeriodPickerComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [EmployeePeriodPickerComponent],
      providers: [EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    store.setBounds('2026-07-01', null, new Date(2026, 8, 30));
    const fixture = TestBed.createComponent(EmployeePeriodPickerComponent);
    fixture.detectChanges();
    const select = fixture.debugElement.query(By.directive(SelectComponent)).componentInstance as SelectComponent;
    return { fixture, select, store };
  }

  it('offers the bounded store months, newest first', () => {
    const { select, store } = setup();

    expect(select.options()).toEqual(store.monthOptions());
    expect(select.options().map((option) => option.value)).toEqual(['2026-09', '2026-08', '2026-07']);
  });

  it('renders the shared select control', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('app-select')).toBeTruthy();
  });

  it('writes the chosen month to the store', () => {
    const { select, store } = setup();

    select.valueChange.emit('2026-08');

    expect(store.month()).toBe('2026-08');
    expect(store.from()).toBe('2026-08-01');
  });
});
