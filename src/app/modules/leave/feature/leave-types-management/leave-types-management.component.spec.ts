import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { environment } from '../../../../../environments/environment';
import { LeaveTypesManagementComponent } from './leave-types-management.component';

describe('LeaveTypesManagementComponent', () => {
  let fixture: ComponentFixture<LeaveTypesManagementComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaveTypesManagementComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    patchState(TestBed.inject(AuthStore) as Parameters<typeof patchState>[0], { permissions: ['leave:manage'] });
    fixture = TestBed.createComponent(LeaveTypesManagementComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads leave types on init and shows the create action for managers', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.startsWith(`${environment.apiUrl}/leave/types`)).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Leave Types');
    expect(fixture.nativeElement.textContent).toContain('+ New leave type');
  });

  it('shows a refused save in the form, and a reopened form starts clean', async () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.startsWith(`${environment.apiUrl}/leave/types`)).flush([]);
    await fixture.whenStable();
    const page = fixture.componentInstance;
    const value = { name: 'Sick', code: 'SICK', description: null, color: '#16A34A', isPaid: true, applicableGender: 'all' as const, requiresDocument: false, documentRequiredAfterHours: null, acceptedDocumentTypes: [], icon: '' };

    page.openCreateModal();
    fixture.detectChanges();
    const saving = page.onSave(value);
    httpMock.expectOne(`${environment.apiUrl}/leave/types`).flush({ errors: { Code: ['Leave type code is already used.'] } }, { status: 400, statusText: 'Bad Request' });
    await saving;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Leave type code is already used.');

    page.closeFormModal();
    fixture.detectChanges();
    page.openCreateModal();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Leave type code is already used.');
  });
});
