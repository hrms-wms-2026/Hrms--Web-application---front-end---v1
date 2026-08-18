import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { OffboardingApiService } from './offboarding-api.service';

describe('OffboardingApiService', () => {
  let service: OffboardingApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OffboardingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('startOffboarding posts to /employees/:id/offboarding with an Idempotency-Key header', () => {
    service.startOffboarding('emp-1', {
      reason: 'resignation', lastWorkingDate: '2026-12-01', knowledgeRiskLevel: 'medium',
      rehireEligibility: 'eligible', notes: null
    }).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/offboarding`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Idempotency-Key')).toBe(true);
    req.flush({ offboardingRecordId: 'rec-1' });
  });

  it('getOffboarding gets /employees/:id/offboarding', () => {
    service.getOffboarding('emp-1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/emp-1/offboarding`);
    expect(req.request.method).toBe('GET');
    req.flush(null);
  });

  it('listMyPendingBypassRequests gets /offboarding-bypass-requests?status=pending', () => {
    service.listMyPendingBypassRequests().subscribe();
    const req = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/offboarding-bypass-requests` && r.params.get('status') === 'pending');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getOffboardingOverview gets /employees/offboarding-overview', () => {
    service.getOffboardingOverview().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/offboarding-overview`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
