import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ProfileApiService } from './profile-api.service';
import { environment } from '../../../../environments/environment';

describe('ProfileApiService', () => {
  let service: ProfileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProfileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getMyProfile GETs /employees/me', () => {
    service.getMyProfile().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('addEmergencyContact POSTs to /employees/me/emergency-contacts', () => {
    service.addEmergencyContact({ name: 'Jane', relationship: 'spouse', phone: '555-1111', email: null, isPrimary: true }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me/emergency-contacts`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'new-id' });
  });

  it('linkAvatar PUTs the uploaded file id to /employees/me/avatar', () => {
    service.linkAvatar('file-id').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me/avatar`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fileId: 'file-id' });
    req.flush({ avatarFileId: 'file-id' });
  });

  it('removeAvatar DELETEs /employees/me/avatar', () => {
    service.removeAvatar().subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me/avatar`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
