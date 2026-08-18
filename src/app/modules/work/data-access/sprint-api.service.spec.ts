import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { SprintApiService } from './sprint-api.service';

describe('SprintApiService', () => {
  let service: SprintApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SprintApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(SprintApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getByObjective requests the activeOnly query param', () => {
    service.getByObjective('obj-1', true).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/sprints?activeOnly=true`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('create posts to the sprints endpoint', () => {
    service.create('obj-1', { name: 'Sprint 1', startDate: '2026-09-01', endDate: '2026-09-14' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/work/objectives/obj-1/sprints`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });
});
