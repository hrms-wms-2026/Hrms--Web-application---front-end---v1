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

  it('uploadAvatar PUTs multipart form data to /employees/me/avatar', () => {
    const file = new File(['x'], 'avatar.png', { type: 'image/png' });
    service.uploadAvatar(file).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/employees/me/avatar`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body instanceof FormData).toBe(true);
    req.flush({ avatarFileId: 'file-id' });
  });

  it('builds a cache-busted avatar URL from the file id', () => {
    expect(service.getAvatarUrl('file-abc')).toBe(`${environment.apiUrl}/employees/me/avatar?v=file-abc`);
  });
});
