import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../../../environments/environment';
import { RequestsListComponent } from './requests-list.component';

describe('RequestsListComponent', () => {
  let fixture: ComponentFixture<RequestsListComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RequestsListComponent], providers: [provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RequestsListComponent);
  });

  afterEach(() => httpMock.verify());

  it('loads all requests and leave types on init', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
  });

  it('reloads with a status filter when setStatusFilter is called', () => {
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/requests/all`).flush([]);
    httpMock.expectOne((r) => r.url === `${environment.apiUrl}/leave/types`).flush([]);
    fixture.componentInstance.setStatusFilter('rejected');
    httpMock.expectOne(`${environment.apiUrl}/leave/requests/all?status=rejected`).flush([]);
  });
});
