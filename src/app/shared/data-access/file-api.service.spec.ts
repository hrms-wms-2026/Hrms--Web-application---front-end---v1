import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { FileApiService } from './file-api.service';

describe('FileApiService', () => {
  let service: FileApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FileApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('builds a file URL from the file id, no request', () => {
    expect(service.getFileUrl('file-1')).toBe(`${environment.apiUrl}/files/file-1`);
    httpMock.expectNone(`${environment.apiUrl}/files/file-1`);
  });

  it('uploads a file with its purpose as multipart form data', () => {
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    service.upload(file, 'employee_avatar').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/files`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('purpose')).toBe('employee_avatar');
    req.flush({ fileId: 'file-1', originalFileName: 'a.png', fileSizeBytes: 1, contentType: 'image/png' });
  });

  it('deletes a file by id', () => {
    service.delete('file-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/files/file-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
