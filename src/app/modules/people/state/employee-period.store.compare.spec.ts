import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from './employee-period.store';

describe('EmployeePeriodStore compare', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [EmployeePeriodStore] });
    return TestBed.inject(EmployeePeriodStore);
  }

  it('starts with comparison off', () => {
    const store = setup();

    expect(store.compare()).toBe('none');
    expect(store.comparePrevious()).toBe(false);
  });

  it('turns comparison on and off, independent of the month', () => {
    const store = setup();
    store.setMonth('2026-05');

    store.setCompare('previous');
    expect(store.comparePrevious()).toBe(true);
    expect(store.month()).toBe('2026-05');

    store.setCompare('none');
    expect(store.comparePrevious()).toBe(false);
  });
});
