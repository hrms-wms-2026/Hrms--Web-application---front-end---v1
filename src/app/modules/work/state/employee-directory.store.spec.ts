import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { EmployeeDirectoryStore } from './employee-directory.store';
import { PeopleApiService } from '../../people/data-access/people-api.service';
import { EmployeeListItemResponse } from '../../people/models/employee.model';

describe('EmployeeDirectoryStore', () => {
  let store: InstanceType<typeof EmployeeDirectoryStore>;
  let getEmployeeSpy: ReturnType<typeof vi.fn>;

  const employee: EmployeeListItemResponse = {
    id: 'emp-1', employeeNumber: 'E1', fullName: 'Nevi Peiris', email: 'nevi@dapi.test',
    departmentId: null, departmentName: null, positionId: null, positionName: null,
    legalEntityId: null, legalEntityName: null, employmentTypeLabel: 'Full-time', status: 'active',
    reportingManagerId: null, reportingManagerName: null
  };

  beforeEach(() => {
    getEmployeeSpy = vi.fn(() => of(employee));
    TestBed.configureTestingModule({
      providers: [{ provide: PeopleApiService, useValue: { getEmployee: getEmployeeSpy } }]
    });
    store = TestBed.inject(EmployeeDirectoryStore);
  });

  it('ensureLoaded fetches an uncached id and get() returns it with initials computed', async () => {
    await store.ensureLoaded(['emp-1']);

    const summary = store.get('emp-1');
    expect(summary?.name).toBe('Nevi Peiris');
    expect(summary?.initials).toBe('NP');
    expect(summary?.avatarUrl).toBeNull();
  });

  it('ensureLoaded does not re-fetch an already-cached id', async () => {
    await store.ensureLoaded(['emp-1']);
    await store.ensureLoaded(['emp-1']);

    expect(getEmployeeSpy).toHaveBeenCalledTimes(1);
  });

  it('get() returns undefined for an id never loaded', () => {
    expect(store.get('never-loaded')).toBeUndefined();
  });

  it('dedupes concurrent ensureLoaded calls for the same uncached id into a single fetch', async () => {
    const p1 = store.ensureLoaded(['emp-1']);
    const p2 = store.ensureLoaded(['emp-1']);

    await Promise.all([p1, p2]);

    expect(getEmployeeSpy).toHaveBeenCalledTimes(1);
    expect(store.get('emp-1')?.name).toBe('Nevi Peiris');
  });
});
