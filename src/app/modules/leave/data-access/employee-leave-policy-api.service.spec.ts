import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { EmployeeLeavePolicyApiService } from './employee-leave-policy-api.service';

describe('EmployeeLeavePolicyApiService', () => {
  let service: EmployeeLeavePolicyApiService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/employees/e1/leave-policies`;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EmployeeLeavePolicyApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EmployeeLeavePolicyApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists the resolved policy per leave type', () => {
    service.list('e1').subscribe();
    expect(http.expectOne(base).request.method).toBe('GET');
  });

  it('sets an employee override with the policy id', () => {
    service.set('e1', 't1', 'p1').subscribe();
    const req = http.expectOne(`${base}/t1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ policyId: 'p1' });
  });

  it('resets the override', () => {
    service.reset('e1', 't1').subscribe();
    expect(http.expectOne(`${base}/t1`).request.method).toBe('DELETE');
  });
});
