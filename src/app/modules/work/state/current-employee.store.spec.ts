import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CurrentEmployeeStore } from './current-employee.store';
import { TaskApiService } from '../data-access/task-api.service';

describe('CurrentEmployeeStore', () => {
  let store: InstanceType<typeof CurrentEmployeeStore>;
  let getCurrentEmployeeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getCurrentEmployeeSpy = vi.fn(() => of({ employeeId: 'emp-1' }));
    TestBed.configureTestingModule({
      providers: [{ provide: TaskApiService, useValue: { getCurrentEmployee: getCurrentEmployeeSpy } }]
    });
    store = TestBed.inject(CurrentEmployeeStore);
  });

  it('id() returns empty string before ensureLoaded resolves', () => {
    expect(store.id()).toBe('');
  });

  it('ensureLoaded fetches and id() returns the resolved employee id', async () => {
    await store.ensureLoaded();

    expect(store.id()).toBe('emp-1');
  });

  it('ensureLoaded does not re-fetch once already loaded', async () => {
    await store.ensureLoaded();
    await store.ensureLoaded();

    expect(getCurrentEmployeeSpy).toHaveBeenCalledTimes(1);
  });

  it('dedupes concurrent ensureLoaded calls into a single fetch', async () => {
    const p1 = store.ensureLoaded();
    const p2 = store.ensureLoaded();

    await Promise.all([p1, p2]);

    expect(getCurrentEmployeeSpy).toHaveBeenCalledTimes(1);
    expect(store.id()).toBe('emp-1');
  });

  // A caller with no Work Management employee record (e.g. a platform admin) gets 403 from
  // GET /work/me - id() must stay '' rather than throw, so isAssignee checks just evaluate false.
  it('leaves id() empty when the caller has no employee record, without throwing', async () => {
    getCurrentEmployeeSpy.mockReturnValue(throwError(() => ({ status: 403 })));

    await expect(store.ensureLoaded()).resolves.toBeUndefined();
    expect(store.id()).toBe('');
  });
});
