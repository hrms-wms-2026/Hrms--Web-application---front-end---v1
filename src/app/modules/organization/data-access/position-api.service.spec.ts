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
    status: 'active',
    responsibleEmployeeId: null,
    responsibleEmployeeName: null
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

  it('sends GET to position access endpoint', () => {
    const mockAccess = {
      positionId: 'pos-1',
      roleId: 'role-1',
      roleName: 'Manager',
      requiresApproval: true,
      isActive: true
    };

    service.getPositionAccess('le-1', 'pos-1').subscribe((res) => {
      expect(res).toEqual(mockAccess);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-1/positions/pos-1/access`);
    expect(req.request.method).toBe('GET');
    req.flush(mockAccess);
  });

  it('sends PUT to position access endpoint with roleId and requiresApproval', () => {
    const payload = { roleId: 'role-123', requiresApproval: true };
    const mockResponse = {
      positionId: 'pos-1',
      roleId: 'role-123',
      roleName: 'Role 123',
      requiresApproval: true,
      isActive: true
    };

    service.setPositionAccess('le-1', 'pos-1', payload).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-1/positions/pos-1/access`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ roleId: 'role-123', requiresApproval: true });
    req.flush(mockResponse);
  });

  it('sends POST to createPosition with ONLY position fields (excludes roleId, requiresApproval, positionType)', () => {
    const createPayload = {
      departmentId: 'dept-1',
      name: 'Software Engineer',
      code: 'SE-01',
      maxOccupancy: 1,
      reportsToPositionId: null
    };

    service.createPosition('le-1', createPayload).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/le-1/positions`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      departmentId: 'dept-1',
      name: 'Software Engineer',
      code: 'SE-01',
      maxOccupancy: 1,
      reportsToPositionId: null
    });
    expect((req.request.body as Record<string, unknown>)['roleId']).toBeUndefined();
    expect((req.request.body as Record<string, unknown>)['requiresApproval']).toBeUndefined();
    expect((req.request.body as Record<string, unknown>)['positionType']).toBeUndefined();
    req.flush({ id: 'pos-created', ...createPayload, positionType: 'unique' as const, legalEntityId: 'le-1', isActive: true, createdAt: '2026-01-01', updatedAt: null });
  });

  it('sends GET to /org/position-template-packs without legalEntityId or tenantId', () => {
    const mockPacks = {
      items: [
        {
          id: 'pack-1',
          templateKey: 'exec-pack',
          name: 'Executive Leadership Template',
          description: 'Exec pack',
          industryProfileTag: null,
          employeeCountRangeKey: '101-500',
          employeeCountMin: 101,
          employeeCountMax: 500,
          positions: [
            {
              positionKey: 'ceo',
              positionName: 'Chief Executive Officer',
              departmentName: 'Executive',
              reportsToPositionKey: null,
              linkedRoleTemplateId: null
            }
          ]
        }
      ]
    };

    service.listPositionTemplatePacks().subscribe((res) => {
      expect(res).toEqual(mockPacks);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/position-template-packs`);
    expect(req.request.method).toBe('GET');
    req.flush(mockPacks);
  });
});
