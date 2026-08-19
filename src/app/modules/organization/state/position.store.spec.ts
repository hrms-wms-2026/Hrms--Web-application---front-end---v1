import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PositionStore } from './position.store';
import { ManagementCoverageRecordResponse, PositionListItemResponse } from '../models/position.model';

describe('PositionStore - updateCoverage', () => {
  let store: InstanceType<typeof PositionStore>;
  let httpMock: HttpTestingController;

  const ownerPosition: PositionListItemResponse = {
    id: 'owner-1',
    legalEntityId: 'le-1',
    departmentId: null,
    name: 'Owner Manager',
    code: null,
    positionType: 'unique',
    maxOccupancy: 1,
    reportsToPositionId: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: null
  };

  const initialRecord: ManagementCoverageRecordResponse = {
    id: 'coverage-1',
    ownerPositionId: 'owner-1',
    ownerPositionName: 'Owner Manager',
    coveredTargetType: 'Position',
    coveredPositionId: 'target-1',
    coveredPositionName: 'Target Position',
    coveredDepartmentId: null,
    coveredDepartmentName: null,
    ownerOrder: 1,
    source: 'Manual',
    isLocked: false,
    status: 'active',
    responsibleEmployeeId: null,
    responsibleEmployeeName: null
  };

  const coverageUrl = `${environment.apiUrl}/org/legal-entities/le-1/positions/owner-1/coverage`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PositionStore, provideHttpClient(), provideHttpClientTesting()]
    });
    store = TestBed.inject(PositionStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('calls PUT and replaces the updated record on success', async () => {
    void store.loadCoverage('le-1', ownerPosition);
    httpMock.expectOne(coverageUrl).flush([initialRecord]);

    const updated: ManagementCoverageRecordResponse = { ...initialRecord, ownerOrder: 3 };
    const updatePromise = store.updateCoverage('le-1', 'owner-1', 'coverage-1', { ownerOrder: 3 });
    const req = httpMock.expectOne(`${coverageUrl}/coverage-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ownerOrder: 3 });
    req.flush(updated);

    const success = await updatePromise;

    expect(success).toBe(true);
    expect(store.coverageRecords()).toEqual([updated]);
    expect(store.coverageSaving()).toBe(false);
    expect(store.coverageError()).toBeNull();
  });

  it('surfaces server 409 message and refreshes coverage records from API on conflict', async () => {
    void store.loadCoverage('le-1', ownerPosition);
    httpMock.expectOne(coverageUrl).flush([initialRecord]);

    const updatePromise = store.updateCoverage('le-1', 'owner-1', 'coverage-1', { ownerOrder: 2 });

    const req = httpMock.expectOne(`${coverageUrl}/coverage-1`);
    req.flush(
      { detail: 'This target already has Backup Manager 1.' },
      { status: 409, statusText: 'Conflict' }
    );

    await Promise.resolve();

    const refreshedRecord: ManagementCoverageRecordResponse = {
      ...initialRecord,
      ownerOrder: 2
    };
    const refreshReq = httpMock.expectOne(coverageUrl);
    refreshReq.flush([initialRecord, refreshedRecord]);

    const success = await updatePromise;

    expect(success).toBe(false);
    expect(store.coverageError()).toBe('This target already has Backup Manager 1.');
    expect(store.coverageRecords()).toEqual([initialRecord, refreshedRecord]);
  });
});
