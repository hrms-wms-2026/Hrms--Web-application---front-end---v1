import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { BulkOnboardingApiService } from './bulk-onboarding-api.service';

describe('BulkOnboardingApiService', () => {
  let service: BulkOnboardingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(BulkOnboardingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('upload() posts multipart form data to /onboarding/bulk-batches', () => {
    const file = new File(['a,b\n1,2'], 'employees.csv', { type: 'text/csv' });
    service.upload({ file, legalEntityId: 'le-1', defaultWorkModeId: 'wm-1', defaultEmploymentType: 'full_time', defaultChecklistTemplateId: null })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ id: 'batch-1', status: 'mapping_pending', totalRows: 1, validRows: null, invalidRows: null, detectedColumns: ['a', 'b'], suggestedMapping: {} });
  });

  it('preview() posts the mapping to /onboarding/bulk-batches/{id}/preview', () => {
    service.preview('batch-1', { firstName: 'First Name' }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mapping: { firstName: 'First Name' } });
    req.flush({ firstName: 'Jane', lastName: null, workEmail: null, startDate: null, employmentType: null, workModeName: null, departmentName: null, positionName: null, checklistTemplateName: null, employeeNumber: null });
  });

  it('requestFinalize() posts selected draft ids to /finalize', () => {
    service.requestFinalize('batch-1', ['draft-1', 'draft-2']).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1/finalize`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ onboardingDraftIds: ['draft-1', 'draft-2'] });
    req.flush({ id: 'batch-1', status: 'finalize_pending', totalRows: 2, validRows: 2, invalidRows: 0, detectedColumns: [], suggestedMapping: {} });
  });

  it('getBatch() gets /onboarding/bulk-batches/{id}', () => {
    service.getBatch('batch-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'batch-1', status: 'drafts_created', totalRows: 1, validRows: 1, invalidRows: 0, rows: [] });
  });

  it('resolveIssues() posts to /onboarding/bulk-batches/{id}/resolve-issues', () => {
    service
      .resolveIssues('batch-1', {
        issueKey: 'department_not_found:Sales',
        action: 'map_existing',
        targetId: 'dept-1',
        applyToRowNumbers: [2, 5]
      })
      .subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/onboarding/bulk-batches/batch-1/resolve-issues`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      issueKey: 'department_not_found:Sales',
      action: 'map_existing',
      targetId: 'dept-1',
      applyToRowNumbers: [2, 5]
    });
    req.flush({ validRows: 2, invalidRows: 0, totalRows: 2, rows: [], issues: [] });
  });
});
