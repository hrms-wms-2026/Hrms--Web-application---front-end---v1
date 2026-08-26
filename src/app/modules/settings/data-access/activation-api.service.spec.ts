import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { ActivationCodeResponse } from '../models/activation-code.model';
import { ActivationApiService } from './activation-api.service';

describe('ActivationApiService', () => {
  let service: ActivationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ActivationApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ActivationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts to /monitoring/activation/generate with no body and returns the code', () => {
    const response: ActivationCodeResponse = { code: 'APDBSJNA', expires_in_seconds: 600 };

    service.generate().subscribe((res) => {
      expect(res).toEqual(response);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/monitoring/activation/generate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();
    req.flush(response);
  });
});
