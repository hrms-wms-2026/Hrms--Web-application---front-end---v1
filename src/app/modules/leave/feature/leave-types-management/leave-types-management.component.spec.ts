import { provideHttpClient } from '@angular/common/http';
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
      providers: [provideHttpClient(), provideHttpClientTesting()]
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
});
