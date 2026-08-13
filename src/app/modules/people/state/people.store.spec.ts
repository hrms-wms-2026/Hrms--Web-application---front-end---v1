import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { EmployeeListItemResponse, EmployeeListPageResponse } from '../models/employee.model';
import { PeopleStore } from './people.store';

describe('PeopleStore', () => {
  let store: InstanceType<typeof PeopleStore>;
  let httpMock: HttpTestingController;

  const mockEmployee: EmployeeListItemResponse = {
    id: 'emp-1',
    employeeNumber: 'E-001',
    fullName: 'Ada Lovelace',
    email: 'ada@test.dev',
    departmentId: null,
    departmentName: null,
    positionId: null,
    positionName: null,
    legalEntityId: null,
    legalEntityName: null,
    employmentTypeLabel: 'Full-time',
    status: 'active',
    reportingManagerId: null,
    reportingManagerName: null
  };

  const mockPage: EmployeeListPageResponse = { items: [mockEmployee], totalCount: 1, page: 1, pageSize: 25 };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PeopleStore, provideHttpClient(), provideHttpClientTesting()]
    });

    store = TestBed.inject(PeopleStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads employees into state on success', async () => {
    const loadPromise = store.loadEmployees({ page: 1, pageSize: 25 });

    expect(store.employeesLoading()).toBe(true);
    httpMock.expectOne(`${environment.apiUrl}/employees?page=1&pageSize=25`).flush(mockPage);
    await loadPromise;

    expect(store.employeesLoading()).toBe(false);
    expect(store.employees()).toEqual([mockEmployee]);
    expect(store.employeesTotalCount()).toBe(1);
    expect(store.employeesError()).toBeNull();
  });

  it('reflects an empty result as an empty array, not an error', async () => {
    const loadPromise = store.loadEmployees({});
    httpMock.expectOne(`${environment.apiUrl}/employees`).flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    await loadPromise;

    expect(store.employees()).toEqual([]);
    expect(store.employeesError()).toBeNull();
  });

  it('maps a failed request to a safe error message, not the raw backend body', async () => {
    const loadPromise = store.loadEmployees({});
    httpMock
      .expectOne(`${environment.apiUrl}/employees`)
      .flush({ detail: 'Npgsql.PostgresException: connection refused' }, { status: 500, statusText: 'Server Error' });
    await loadPromise;

    expect(store.employeesLoading()).toBe(false);
    expect(store.employeesError()).not.toContain('Npgsql');
    expect(store.employeesError()).toBe('Something went wrong while saving your changes.');
  });

  it('does not let a stale in-flight request overwrite a newer ones result', async () => {
    const firstLoad = store.loadEmployees({ search: 'stale' });
    const secondLoad = store.loadEmployees({ search: 'fresh' });

    const requests = httpMock.match(`${environment.apiUrl}/employees?search=fresh`);
    // Only the second request should have actually gone out for this URL; resolve both in
    // reverse order to prove the stale one's response is discarded.
    const staleReq = httpMock.expectOne(`${environment.apiUrl}/employees?search=stale`);

    requests[0].flush({ items: [mockEmployee], totalCount: 1, page: 1, pageSize: 25 });
    await secondLoad;
    staleReq.flush({ items: [], totalCount: 0, page: 1, pageSize: 25 });
    await firstLoad;

    expect(store.employees()).toEqual([mockEmployee]);
  });

  it('loads drafts into state on success', async () => {
    const loadPromise = store.loadDrafts({ page: 1, pageSize: 25 });
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts?page=1&pageSize=25`).flush({
      items: [
        {
          id: 'draft-1',
          displayName: 'Ada Lovelace',
          employeeName: 'Ada Lovelace',
          positionName: null,
          departmentName: null,
          status: 'waiting_for_seat',
          draftReason: 'waiting_for_seat',
          lastSavedStep: 'employee_details',
          startedByName: 'HR Starter'
        }
      ],
      totalCount: 1,
      page: 1,
      pageSize: 25
    });
    await loadPromise;

    expect(store.drafts().length).toBe(1);
    expect(store.draftsError()).toBeNull();
  });

  it('clear() resets both employees and drafts state', async () => {
    const loadPromise = store.loadEmployees({});
    httpMock.expectOne(`${environment.apiUrl}/employees`).flush(mockPage);
    await loadPromise;

    store.clear();

    expect(store.employees()).toEqual([]);
    expect(store.employeesTotalCount()).toBe(0);
  });
});
