import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LeaveTypeResponse } from '../models/leave-type.model';
import { LeaveTypeStore } from './leave-type.store';

describe('LeaveTypeStore', () => {
  let store: InstanceType<typeof LeaveTypeStore>;
  let httpMock: HttpTestingController;
  const mockType: LeaveTypeResponse = {
    id: 'type-1', name: 'Annual Leave', code: 'ANNUAL', description: null, category: 'annual',
    isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null,
    acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 20,
    carryForwardAllowed: true, maxCarryForwardDays: 5, carryForwardExpiryMonths: 3,
    proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0,
    isActive: true, createdAt: '2026-08-21T00:00:00Z'
  };
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [LeaveTypeStore, provideHttpClient(), provideHttpClientTesting()] });
    store = TestBed.inject(LeaveTypeStore);
    httpMock = TestBed.inject(HttpTestingController);
  });
  afterEach(() => httpMock.verify());
  it('loads leave types into state', async () => {
    const loading = store.load();
    httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`).flush([mockType]);
    await loading;
    expect(store.items()).toEqual([mockType]);
    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBeNull();
  });
  it('sets loadError on a failed load', async () => {
    const loading = store.load();
    httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`).flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    await loading;
    expect(store.items()).toEqual([]);
    expect(store.loadError()).toBeTruthy();
  });
  it('creates a leave type and refreshes the list', async () => {
    const creating = store.createLeaveType({
      name: 'Sick Leave', code: 'SICK', description: null, category: 'sick',
      isPaid: true, requiresApproval: true, requiresDocument: false, documentRequiredAfterDays: null,
      acceptedDocumentTypes: [], maxConsecutiveDays: null, defaultDaysPerYear: 10,
      carryForwardAllowed: false, maxCarryForwardDays: null, carryForwardExpiryMonths: null,
      proRataForNewJoiners: true, applicableGender: 'all', minimumNoticeDays: 0
    });
    httpMock.expectOne(`${environment.apiUrl}/leave/types`).flush(mockType);
    await Promise.resolve();
    httpMock.expectOne(`${environment.apiUrl}/leave/types?includeInactive=false`).flush([mockType]);
    expect(await creating).toBe(true);
    expect(store.items()).toEqual([mockType]);
  });
});
