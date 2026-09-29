import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { AuthStore } from '../../../../core/auth/state/auth.store';
import { environment } from '../../../../../environments/environment';
import { EntitlementsManagementComponent } from './entitlements-management.component';

describe('EntitlementsManagementComponent', () => {
  let fixture: ComponentFixture<EntitlementsManagementComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EntitlementsManagementComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    // Seed wildcard permission so canManage() returns true in tests
    patchState(TestBed.inject(AuthStore) as Parameters<typeof patchState>[0], { permissions: ['*'] });
    fixture = TestBed.createComponent(EntitlementsManagementComponent);
  });

  afterEach(() => httpMock.verify());

  it('shows the New Request (on behalf) button on the Entitlements tab when the user can manage', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`).flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="new-request-on-behalf-button"]')).toBeTruthy();
  });

  it('opens the wizard in on-behalf mode', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/entitlements`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities`).flush([]);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('[data-testid="new-request-on-behalf-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.requestWizardOpen()).toBe(true);
  });
});
