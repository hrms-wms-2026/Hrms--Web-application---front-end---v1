import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeSignalItemsResponse } from '../models/employee-overview.model';
import { EmployeePeriodStore } from './employee-period.store';
import { SignalDrilldownStore } from './signal-drilldown.store';

describe('SignalDrilldownStore', () => {
  const response = (key: string): EmployeeSignalItemsResponse => ({ key, total: 1, timezone: 'Asia/Colombo', items: [
    { kind: 'attendance_day', id: '2026-09-02', date: '2026-09-02', title: 'Wed 2 Sep', subtitle: 'x', occurredAt: null,
      projectId: null, projectName: null, dueDate: null, approvalKind: null, requestedAt: null, approverName: null }
  ] });

  function setup(get = vi.fn((_: string, key: string) => of(response(key)))) {
    TestBed.configureTestingModule({
      providers: [EmployeePeriodStore, SignalDrilldownStore, { provide: PeopleApiService, useValue: { getOverviewSignalItems: get } }]
    });
    const period = TestBed.inject(EmployeePeriodStore);
    period.setMonth('2026-09');
    const store = TestBed.inject(SignalDrilldownStore);
    store.setEmployee('emp-1');
    return { store, period, get };
  }

  it('loads items for the opened key and the current period', async () => {
    const { store, get } = setup();
    store.open('late_clock_ins');
    await Promise.resolve();

    expect(get).toHaveBeenCalledWith('emp-1', 'late_clock_ins', '2026-09-01', '2026-09-30');
    expect(store.openKey()).toBe('late_clock_ins');
    expect(store.openResponse()?.key).toBe('late_clock_ins');
  });

  it('serves a reopened key from cache', async () => {
    const { store, get } = setup();
    store.open('late_clock_ins'); await Promise.resolve();
    store.close();
    store.open('late_clock_ins'); await Promise.resolve();

    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps only one key open and toggles it closed', () => {
    const { store } = setup();
    store.open('late_clock_ins');
    store.open('over_break');
    expect(store.openKey()).toBe('over_break');
    store.toggle('over_break');
    expect(store.openKey()).toBeNull();
  });

  it('reset clears the cache and the open key', async () => {
    const { store, get } = setup();
    store.open('late_clock_ins'); await Promise.resolve();
    store.reset();
    expect(store.openKey()).toBeNull();
    store.open('late_clock_ins'); await Promise.resolve();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('records an error for the key and retry refetches', async () => {
    const get = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of(response('over_break')));
    const { store } = setup(get);
    store.open('over_break'); await Promise.resolve();
    expect(store.errorKey()).toBe('over_break');

    store.retry(); await Promise.resolve();
    expect(store.errorKey()).toBeNull();
    expect(store.openResponse()?.items).toHaveLength(1);
  });

  it('select remembers the item with the open response timezone', async () => {
    const { store } = setup();
    store.open('late_clock_ins'); await Promise.resolve();
    const item = store.openResponse()!.items[0];
    store.select(item);
    expect(store.selected()).toEqual({ item, timezone: 'Asia/Colombo' });
    store.clearSelection();
    expect(store.selected()).toBeNull();
  });
});
