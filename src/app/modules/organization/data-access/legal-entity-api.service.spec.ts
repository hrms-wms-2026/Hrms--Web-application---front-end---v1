import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LegalEntityApiService } from './legal-entity-api.service';
import {
  CreateLegalEntityRequest,
  LegalEntityGeneralSettings,
  LegalEntityListItem,
  UpdateLegalEntityGeneralSettingsRequest
} from '../models/legal-entity.model';

describe('LegalEntityApiService', () => {
  let service: LegalEntityApiService;
  let httpMock: HttpTestingController;

  const mockCompanies: LegalEntityListItem[] = [
    {
      id: 'company-1',
      name: 'OneVo Technologies',
      companyCode: 'OVT',
      logoFileId: null,
      isActive: true,
      isPrimary: true
    },
    {
      id: 'company-2',
      name: 'OneVo Digital',
      companyCode: 'OVD',
      logoFileId: null,
      isActive: true,
      isPrimary: false
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LegalEntityApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(LegalEntityApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches legal entities with default includeInactive=false', () => {
    service.getLegalEntities().subscribe((companies) => {
      expect(companies).toEqual(mockCompanies);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCompanies);
  });

  it('passes includeInactive=true when requested', () => {
    service.getLegalEntities(true).subscribe((companies) => {
      expect(companies).toEqual(mockCompanies);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=true`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCompanies);
  });

  it('fetches selector companies from the tenant-authenticated session endpoint', () => {
    service.getAccessibleCompanies().subscribe((companies) => expect(companies).toEqual(mockCompanies));

    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    expect(req.request.method).toBe('GET');
    req.flush(mockCompanies);
  });

  const mockGeneralSettings: LegalEntityGeneralSettings = {
    id: 'company-1',
    name: 'OneVo Technologies',
    companyCode: 'OVT',
    logoFileId: null,
    registrationNumber: 'REG-001',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: 'ops@onevo.example',
    phoneNumber: null,
    website: null,
    countryCode: 'LKA',
    currencyCode: 'LKR',
    timezone: 'Asia/Colombo',
    financialYearStartMonth: 4,
    firstDayOfWeek: 1,
    standardWorkingDays: [1, 2, 3, 4, 5],
    defaultLanguage: 'en',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    status: 'active',
    workStartTime: '09:00',
    workEndTime: '17:30',
    breakDurationMinutes: 60,
    officeAddress: null,
    officeLatitude: null,
    officeLongitude: null
  };

  it('fetches general settings for a legal entity', () => {
    service.getGeneralSettings('company-1').subscribe((result) => {
      expect(result).toEqual(mockGeneralSettings);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-1/general-settings`);
    expect(req.request.method).toBe('GET');
    req.flush(mockGeneralSettings);
  });

  it('updates general settings with a PUT to the route-scoped id', () => {
    const payload: UpdateLegalEntityGeneralSettingsRequest = {
      name: 'OneVo Technologies',
      companyCode: 'OVT',
      registrationNumber: 'REG-001',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: 'ops@onevo.example',
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 4,
      firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5],
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      status: 'active',
      workStartTime: '09:00',
      workEndTime: '17:30',
      breakDurationMinutes: 60,
      officeAddress: null,
      officeLatitude: null,
      officeLongitude: null
    };

    service.updateGeneralSettings('company-1', payload).subscribe((result) => {
      expect(result).toEqual(mockGeneralSettings);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-1/general-settings`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush(mockGeneralSettings);
  });

  it('creates a legal entity with a POST to the collection route, sending only the create contract fields', () => {
    const payload: CreateLegalEntityRequest = {
      name: 'New Co',
      companyCode: 'NEWCO',
      registrationNumber: 'REG-NEWCO',
      countryCode: 'LKA',
      currencyCode: 'LKR',
      taxRegistrationNumber: null,
      parentLegalEntityId: null
    };

    service.createLegalEntity(payload).subscribe((result) => {
      expect(result).toEqual(mockGeneralSettings);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    expect(Object.keys(req.request.body)).toEqual([
      'name', 'companyCode', 'registrationNumber', 'countryCode', 'currencyCode',
      'taxRegistrationNumber', 'parentLegalEntityId'
    ]);
    req.flush(mockGeneralSettings);
  });

  it('uploads the logo as a company_logo file, then links the file id to the company', () => {
    const file = new File(['fake image bytes'], 'logo.png', { type: 'image/png' });
    let result: unknown;

    service.uploadLogo('company-1', file).subscribe((r) => (result = r));

    const upload = httpMock.expectOne(`${environment.apiUrl}/files`);
    expect(upload.request.method).toBe('POST');
    expect((upload.request.body as FormData).get('purpose')).toBe('company_logo');
    expect((upload.request.body as FormData).get('file')).toBe(file);
    upload.flush({ fileId: 'file-1', originalFileName: 'logo.png', fileSizeBytes: 16, contentType: 'image/png' });

    const link = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-1/logo`);
    expect(link.request.method).toBe('PUT');
    expect(link.request.body).toEqual({ fileId: 'file-1' });
    link.flush({ legalEntityId: 'company-1', logoFileId: 'file-1' });

    expect(result).toEqual({ legalEntityId: 'company-1', logoFileId: 'file-1' });
  });

  it('removes a logo with a DELETE', () => {
    service.removeLogo('company-1').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-1/logo`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('posts the selected company id to session/active-company', () => {
    service.switchActiveCompany('company-2').subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/session/active-company`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ legalEntityId: 'company-2' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('builds the logo display URL from the shared file route', () => {
    const url = service.getLogoUrl('company-1', 'file-1');

    expect(url).toBe(`${environment.apiUrl}/files/file-1`);
  });
});
