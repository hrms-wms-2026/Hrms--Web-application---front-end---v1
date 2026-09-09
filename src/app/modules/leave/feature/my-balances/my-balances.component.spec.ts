import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { MyBalancesComponent } from './my-balances.component';

describe('MyBalancesComponent', () => {
  let fixture: ComponentFixture<MyBalancesComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MyBalancesComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyBalancesComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads balances and my requests on init', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    expect(fixture.nativeElement.textContent).toContain('remaining hours');
  });

  it('opens the new-request wizard when the button is clicked', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/balances/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/my`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('[data-testid="new-request-button"]');
    button.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.wizardOpen()).toBe(true);
  });
});
