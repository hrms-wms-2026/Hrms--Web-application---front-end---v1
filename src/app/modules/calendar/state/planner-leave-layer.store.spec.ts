import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LeaveRequestApiService } from '../../leave/data-access/leave-request-api.service';
import { PlannerLeaveLayerStore } from './planner-leave-layer.store';

describe('PlannerLeaveLayerStore', () => {
  const row = (id: string, status: string) => ({
    id, employeeId: 'me', leaveTypeId: 'annual', leaveTypeName: 'Annual', leaveTypeCode: 'AL',
    startAt: '2026-11-10T09:00:00Z', endAt: '2026-11-10T11:00:00Z', totalHours: 2, paidHours: 2, unpaidHours: 0,
    status, noticePeriodMissed: false, approvedByName: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: null,
  });

  function setup() {
    const listMine = vi.fn(() => of([row('a', 'pending'), row('b', 'approved'), row('c', 'rejected'), row('d', 'cancelled')]));
    TestBed.configureTestingModule({
      providers: [PlannerLeaveLayerStore, { provide: LeaveRequestApiService, useValue: { listMine } }],
    });
    return { store: TestBed.inject(PlannerLeaveLayerStore), listMine };
  }

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('keeps pending and approved, drops rejected and cancelled', async () => {
    const { store, listMine } = setup();

    await store.load('2026-11-09', '2026-11-15');

    expect(listMine).toHaveBeenCalledWith({ fromDate: '2026-11-09', toDate: '2026-11-15' });
    expect(store.leaves()).toEqual([
      { id: 'a', startAt: '2026-11-10T09:00:00Z', endAt: '2026-11-10T11:00:00Z', status: 'pending', typeName: 'Annual' },
      { id: 'b', startAt: '2026-11-10T09:00:00Z', endAt: '2026-11-10T11:00:00Z', status: 'approved', typeName: 'Annual' },
    ]);
  });

  it('re-reads on visibilitychange to visible and on window focus', async () => {
    const { store, listMine } = setup();
    await store.load('2026-11-09', '2026-11-15');
    store.startAutoRefresh();

    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));

    expect(listMine).toHaveBeenCalledTimes(3);
    store.stopAutoRefresh();
  });

  it('re-reads every 60 s while visible, not while hidden', async () => {
    vi.useFakeTimers();
    const { store, listMine } = setup();
    await store.load('2026-11-09', '2026-11-15');
    store.startAutoRefresh();

    vi.advanceTimersByTime(60_000);
    expect(listMine).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    vi.advanceTimersByTime(60_000);
    expect(listMine).toHaveBeenCalledTimes(2);
    store.stopAutoRefresh();
  });

  it('stops refreshing after stopAutoRefresh', async () => {
    vi.useFakeTimers();
    const { store, listMine } = setup();
    await store.load('2026-11-09', '2026-11-15');
    store.startAutoRefresh();
    store.stopAutoRefresh();

    vi.advanceTimersByTime(120_000);
    window.dispatchEvent(new Event('focus'));

    expect(listMine).toHaveBeenCalledTimes(1);
  });
});
