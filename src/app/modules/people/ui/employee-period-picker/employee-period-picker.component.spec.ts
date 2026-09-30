import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from '../../state/employee-period.store';
import { EmployeePeriodPickerComponent } from './employee-period-picker.component';

describe('EmployeePeriodPickerComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [EmployeePeriodPickerComponent],
      providers: [EmployeePeriodStore]
    });
    const store = TestBed.inject(EmployeePeriodStore);
    const fixture = TestBed.createComponent(EmployeePeriodPickerComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  it('offers the last 12 months, newest first, starting at the current month', () => {
    const { fixture, store } = setup();

    expect(fixture.componentInstance.options).toHaveLength(12);
    expect(fixture.componentInstance.options[0].value).toBe(store.month());
  });

  it('renders the shared select control', () => {
    const { fixture } = setup();

    expect(fixture.nativeElement.querySelector('app-select')).toBeTruthy();
  });

  it('writes the chosen month to the store', () => {
    const { fixture, store } = setup();

    fixture.componentInstance.onChange('2026-05');

    expect(store.month()).toBe('2026-05');
    expect(store.from()).toBe('2026-05-01');
  });
});
