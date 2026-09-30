import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from './employee-period.store';

describe('EmployeePeriodStore', () => {
  function setup() {
    TestBed.configureTestingModule({ providers: [EmployeePeriodStore] });
    return TestBed.inject(EmployeePeriodStore);
  }

  it('starts on the current month', () => {
    const store = setup();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    expect(store.month()).toBe(expected);
  });

  it('derives inclusive from/to and a label from the month', () => {
    const store = setup();

    store.setMonth('2026-02');

    expect(store.from()).toBe('2026-02-01');
    expect(store.to()).toBe('2026-02-28');
    expect(store.label()).toBe('Feb 2026');
  });

  it('updates derived values when the month changes again', () => {
    const store = setup();
    store.setMonth('2026-02');

    store.setMonth('2026-12');

    expect(store.from()).toBe('2026-12-01');
    expect(store.to()).toBe('2026-12-31');
  });
});
