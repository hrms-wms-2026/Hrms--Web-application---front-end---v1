import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { PeopleApiService } from '../data-access/people-api.service';
import { EmployeeDetailResponse } from '../models/employee.model';
import { detailFixture } from '../feature/employee-detail/tabs/employee-detail-tab.testing';
import { EmployeeDetailStore } from './employee-detail.store';

describe('EmployeeDetailStore', () => {
  function setup(apiOverrides: Record<string, unknown> = {}) {
    const apiStub = {
      getEmployeeDetail: vi.fn((id: string) => of({ ...detailFixture, id })),
      getJobJourney: vi.fn().mockReturnValue(of([])),
      ...apiOverrides
    };
    TestBed.configureTestingModule({
      providers: [
        EmployeeDetailStore,
        { provide: PeopleApiService, useValue: apiStub },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
    return { store: TestBed.inject(EmployeeDetailStore), apiStub };
  }

  it('loads the employee and exposes the full name', async () => {
    const { store } = setup();
    await store.load('emp-1');

    expect(store.employee()?.id).toBe('emp-1');
    expect(store.fullName()).toBe('Ada Lovelace');
    expect(store.loading()).toBe(false);
  });

  it('stores a safe error message when loading fails', async () => {
    const { store } = setup({ getEmployeeDetail: vi.fn().mockReturnValue(throwError(() => new Error('boom'))) });
    await store.load('emp-1');

    expect(store.error()).toBe('boom');
    expect(store.employee()).toBeNull();
  });

  it('ignores a stale response after switching to another employee', async () => {
    const first = new Subject<EmployeeDetailResponse>();
    const { store } = setup({
      getEmployeeDetail: vi.fn((id: string) => (id === 'emp-1' ? first.asObservable() : of({ ...detailFixture, id })))
    });

    const pending = store.load('emp-1');
    await store.load('emp-2');
    first.next({ ...detailFixture, id: 'emp-1' });
    await pending;

    expect(store.employee()?.id).toBe('emp-2');
  });

  it('accepts only valid YYYY-MM period months', () => {
    const { store } = setup();
    store.setPeriodMonth('2025-09');
    expect(store.periodMonth()).toBe('2025-09');
    store.setPeriodMonth('2025-13');
    expect(store.periodMonth()).toBe('2025-09');
  });
});
