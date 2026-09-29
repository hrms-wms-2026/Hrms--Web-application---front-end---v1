import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { EmployeeDirectoryStore } from './employee-directory.store';
import { PeopleApiService } from '../../people/data-access/people-api.service';
import { EmployeeIdentityResponse } from '../../people/models/employee.model';
import { FileApiService } from '../../../shared/data-access/file-api.service';

describe('EmployeeDirectoryStore', () => {
  let store: InstanceType<typeof EmployeeDirectoryStore>;
  let getEmployeeIdentitySpy: ReturnType<typeof vi.fn>;

  const identity: EmployeeIdentityResponse = { id: 'emp-1', name: 'Nevi Peiris', avatarFileId: null };

  beforeEach(() => {
    getEmployeeIdentitySpy = vi.fn(() => of(identity));
    TestBed.configureTestingModule({
      providers: [
        { provide: PeopleApiService, useValue: { getEmployeeIdentity: getEmployeeIdentitySpy } },
        { provide: FileApiService, useValue: { getFileUrl: (id: string) => `https://api.test/files/${id}` } }
      ]
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

  it('ensureLoaded resolves avatarFileId through FileApiService', async () => {
    getEmployeeIdentitySpy.mockReturnValue(of({ ...identity, avatarFileId: 'file-1' }));

    await store.ensureLoaded(['emp-1']);

    expect(store.get('emp-1')?.avatarUrl).toBe('https://api.test/files/file-1');
  });

  it('ensureLoaded does not re-fetch an already-cached id', async () => {
    await store.ensureLoaded(['emp-1']);
    await store.ensureLoaded(['emp-1']);

    expect(getEmployeeIdentitySpy).toHaveBeenCalledTimes(1);
  });

  it('get() returns undefined for an id never loaded', () => {
    expect(store.get('never-loaded')).toBeUndefined();
  });

  it('dedupes concurrent ensureLoaded calls for the same uncached id into a single fetch', async () => {
    const p1 = store.ensureLoaded(['emp-1']);
    const p2 = store.ensureLoaded(['emp-1']);

    await Promise.all([p1, p2]);

    expect(getEmployeeIdentitySpy).toHaveBeenCalledTimes(1);
    expect(store.get('emp-1')?.name).toBe('Nevi Peiris');
  });

  // GET /employees/{id}/identity requires only authentication (no employees:read), so a failure
  // here should just mean the employee no longer exists (404) - still cached as an unresolved
  // placeholder instead of left re-fetchable forever, guarding the same request-storm as before.
  it('caches a failed lookup as an unresolved placeholder instead of leaving it re-fetchable forever', async () => {
    const { throwError } = await import('rxjs');
    getEmployeeIdentitySpy.mockReturnValue(throwError(() => ({ status: 404 })));

    await store.ensureLoaded(['emp-404']);
    expect(store.get('emp-404')?.name).toBe('Unknown employee');
    expect(getEmployeeIdentitySpy).toHaveBeenCalledTimes(1);

    await store.ensureLoaded(['emp-404']);
    expect(getEmployeeIdentitySpy).toHaveBeenCalledTimes(1);
  });
});
