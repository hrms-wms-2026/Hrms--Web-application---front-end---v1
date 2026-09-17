import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { WorkModeApiService } from './work-mode-api.service';
import { environment } from '../../../../environments/environment';

describe('WorkModeApiService', () => {
  let service: WorkModeApiService;
  let httpMock: HttpTestingController;
  const legalEntityId = 'le-1';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [WorkModeApiService]
    });
    service = TestBed.inject(WorkModeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists work modes for a legal entity', () => {
    service.list(legalEntityId, false).subscribe();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/${legalEntityId}/work-modes?includeInactive=false`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates a work mode', () => {
    const payload = {
      name: 'Client Site',
      biometricEnabled: true,
      webEnabled: true,
      trayEnabled: false,
      photoRequired: true,
      selfRegistersLocation: false,
      allowsDailyLocationChoice: false
    };
    service.create(legalEntityId, payload).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/attendance/legal-entities/${legalEntityId}/work-modes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('deactivates a work mode', () => {
    service.deactivate(legalEntityId, 'wm-1').subscribe();
    const req = httpMock.expectOne(
      `${environment.apiUrl}/attendance/legal-entities/${legalEntityId}/work-modes/wm-1/deactivate`
    );
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });
});
