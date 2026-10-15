import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { EmployeeDocumentsComponent } from './employee-documents.component';
import { EmployeeDocumentsApiService } from '../../data-access/employee-documents-api.service';
import { FileApiService } from '../../../../shared/data-access/file-api.service';

describe('EmployeeDocumentsComponent', () => {
  let apiMock: { list: ReturnType<typeof vi.fn> };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        { provide: EmployeeDocumentsApiService, useValue: apiMock },
        { provide: FileApiService, useValue: { download: vi.fn() } }
      ]
    });
    const fixture = TestBed.createComponent(EmployeeDocumentsComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    return fixture;
  }

  beforeEach(() => {
    apiMock = { list: vi.fn() };
  });

  it("lists the employee's documents", async () => {
    apiMock.list.mockReturnValue(of([{
      id: 'd1', fileId: 'f1', name: 'National ID', documentType: 'identity', fileName: 'id.png',
      contentType: 'image/png', fileSizeBytes: 2048, uploadedAt: '2026-08-20T00:00:00Z'
    }]));
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.list).toHaveBeenCalledWith('emp-1');
    const row = fixture.nativeElement.querySelector('[data-testid="employee-document-d1"]');
    expect(row.textContent).toContain('National ID');
    expect(row.textContent).toContain('Identity document');
  });

  it('shows a no-access state on 403', async () => {
    apiMock.list.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="employee-documents-forbidden"]')).not.toBeNull();
  });

  it('shows an empty state', async () => {
    apiMock.list.mockReturnValue(of([]));
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="employee-documents-empty"]')).not.toBeNull();
  });
});
