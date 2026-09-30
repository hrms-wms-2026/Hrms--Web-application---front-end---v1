import { TestBed } from '@angular/core/testing';
import { EmployeePeriodStore } from './employee-period.store';

describe('EmployeePeriodStore bounds & compare month', () => {
  let store: InstanceType<typeof EmployeePeriodStore>;
  const now = new Date(2026, 8, 30); // Sep 2026

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EmployeePeriodStore] });
    store = TestBed.inject(EmployeePeriodStore);
    store.setBounds('2026-06-15', null, now);
  });

  it('defaults to the max month and lists only in-bounds months', () => {
    expect(store.month()).toBe('2026-09');
    expect(store.monthOptions().map((o) => o.value)).toEqual(['2026-09', '2026-08', '2026-07', '2026-06']);
  });

  it('disables stepping past the edges', () => {
    expect(store.canGoNext()).toBe(false);
    store.setMonth('2026-06');
    expect(store.canGoPrevious()).toBe(false);
    store.previousMonth();
    expect(store.month()).toBe('2026-06');
  });

  it('ignores out-of-bounds months', () => {
    store.setMonth('2026-05');
    expect(store.month()).toBe('2026-09');
  });

  it('termination month caps the range', () => {
    store.setBounds('2026-06-15', '2026-08-10', now);
    expect(store.month()).toBe('2026-08');
    expect(store.canGoNext()).toBe(false);
  });

  it('toggleCompare defaults to the previous month and exposes its bounds', () => {
    store.toggleCompare();
    expect(store.compareMonth()).toBe('2026-08');
    expect(store.compareFrom()).toBe('2026-08-01');
    expect(store.compareTo()).toBe('2026-08-31');
    store.toggleCompare();
    expect(store.compareMonth()).toBeNull();
  });

  it('toggleCompare on the first month compares with the next one', () => {
    store.setMonth('2026-06');
    store.toggleCompare();
    expect(store.compareMonth()).toBe('2026-07');
  });

  it('rejects comparing a month with itself or out of bounds', () => {
    store.setCompareMonth('2026-09');
    expect(store.compareMonth()).toBeNull();
    store.setCompareMonth('2025-01');
    expect(store.compareMonth()).toBeNull();
  });

  it('clears the compare month when the selected month moves onto it', () => {
    store.setCompareMonth('2026-08');
    store.setMonth('2026-08');
    expect(store.compareMonth()).toBeNull();
  });

  it('compareOptions excludes the selected month', () => {
    expect(store.compareOptions().map((o) => o.value)).not.toContain('2026-09');
  });
});
