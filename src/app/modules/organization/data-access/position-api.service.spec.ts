import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PositionApiService } from './position-api.service';
import { ManagementCoverageRecordResponse } from '../models/position.model';

describe('PositionApiService', () => {
  let service: PositionApiService;
  let httpMock: HttpTestingController;

  const updatedRecord: ManagementCoverageRecordResponse = {
    id: 'coverage-1',
    ownerPositionId: 'owner-1',
    ownerPositionName: 'Owner Manager',
    coveredTargetType: 'Position',
    coveredPositionId: 'target-1',
    coveredPositionName: 'Target Position',
    coveredDepartmentId: null,
    coveredDepartmentName: null,
    ownerOrder: 3,
    source: 'Manual',
    isLocked: false,
    status: 'active'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PositionApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PositionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('sends PUT to the coverage endpoint with only ownerOrder in the body', () => {
    service.updateCoverage('le-1', 'owner-1', 'coverage-1', { ownerOrder: 3 }).subscribe((result) => {
      expect(result).toEqual(updatedRecord);
    });

    const req = httpMock.expectOne(
      `${environment.apiUrl}/org/legal-entities/le-1/positions/owner-1/coverage/coverage-1`
    );
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ ownerOrder: 3 });
    req.flush(updatedRecord);
  });
});
