import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { environment } from '../../../../environments/environment';
import { AuthStore } from '../../../core/auth/state/auth.store';
import { LegalEntityListItem } from '../models/legal-entity.model';
import { LegalEntityStore, SELECTED_LEGAL_ENTITY_STORAGE_KEY } from './legal-entity.store';

describe('LegalEntityStore', () => {
  let store: InstanceType<typeof LegalEntityStore>;
  let httpMock: HttpTestingController;

  const mockCompanies: LegalEntityListItem[] = [
    {
      id: 'comp-1',
      name: 'Alpha Corp',
      companyCode: 'ALPHA',
      logoFileId: null,
      isActive: true,
      isPrimary: true
    },
    {
      id: 'comp-2',
      name: 'Beta LLC',
      companyCode: 'BETA',
      logoFileId: null,
      isActive: true,
      isPrimary: false
    }
  ];

  beforeEach(() => {
    localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY);

    TestBed.configureTestingModule({
      providers: [
        LegalEntityStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { checkSession: vi.fn().mockResolvedValue(true) } }
      ]
    });

    store = TestBed.inject(LegalEntityStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY);
    httpMock.verify();
  });

  it('loads companies and selects primary company by default', async () => {
    const loadPromise = store.loadCompanies();

    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    req.flush(mockCompanies);
    await loadPromise;

    expect(store.companies()).toEqual(mockCompanies);
    expect(store.selectedLegalEntityId()).toBe('comp-1');
    expect(store.selectedLegalEntity()).toEqual(mockCompanies[0]);
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-1');
  });

  it('reuses valid persisted selectedLegalEntityId', async () => {
    localStorage.setItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY, 'comp-2');

    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    req.flush(mockCompanies);
    await loadPromise;

    expect(store.selectedLegalEntityId()).toBe('comp-2');
    expect(store.selectedLegalEntity()).toEqual(mockCompanies[1]);
  });

  it('falls back to primary company when persisted selectedLegalEntityId is invalid', async () => {
    localStorage.setItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY, 'invalid-deleted-comp-id');

    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    req.flush(mockCompanies);
    await loadPromise;

    expect(store.selectedLegalEntityId()).toBe('comp-1');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-1');
  });

  it('updates selectedLegalEntityId state and localStorage when selectCompany is called', async () => {
    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    req.flush(mockCompanies);
    await loadPromise;

    const selectPromise = store.selectCompany('comp-2');
    const switchReq = httpMock.expectOne(`${environment.apiUrl}/session/active-company`);
    expect(switchReq.request.method).toBe('POST');
    expect(switchReq.request.body).toEqual({ legalEntityId: 'comp-2' });
    switchReq.flush(null);
    await selectPromise;

    expect(store.selectedLegalEntityId()).toBe('comp-2');
    expect(store.selectedLegalEntity()?.name).toBe('Beta LLC');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-2');
  });

  it('does not change local selection when the backend rejects the switch', async () => {
    const loadPromise = store.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/session/companies`).flush(mockCompanies);
    await loadPromise;

    const selectPromise = store.selectCompany('comp-2');
    httpMock
      .expectOne(`${environment.apiUrl}/session/active-company`)
      .flush({ detail: 'Required permission org:read missing' }, { status: 403, statusText: 'Forbidden' });
    const success = await selectPromise;

    expect(success).toBe(false);
    expect(store.selectedLegalEntityId()).toBe('comp-1');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-1');
    expect(store.switchError()).toBe('You do not have access to perform this action.');
  });

  it('handles empty company list safely without crashing', async () => {
    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    req.flush([]);
    await loadPromise;

    expect(store.companies()).toEqual([]);
    expect(store.selectedLegalEntityId()).toBeNull();
    expect(store.selectedLegalEntity()).toBeNull();
  });

  it('updateCompanyDisplay patches name/companyCode/isActive on the matching company only', async () => {
    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/session/companies`);
    req.flush(mockCompanies);
    await loadPromise;

    store.updateCompanyDisplay('comp-1', { name: 'Alpha Corp Renamed', companyCode: 'ALPHA2', isActive: false });

    const updated = store.companies().find((c) => c.id === 'comp-1');
    expect(updated).toEqual({ ...mockCompanies[0], name: 'Alpha Corp Renamed', companyCode: 'ALPHA2', isActive: false });
    expect(store.companies().find((c) => c.id === 'comp-2')).toEqual(mockCompanies[1]);
  });

  const mockCreatedGeneralSettings = {
    id: 'comp-3',
    name: 'Gamma Inc',
    companyCode: 'GAMMA',
    logoFileId: null,
    registrationNumber: 'REG-3',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: null,
    phoneNumber: null,
    website: null,
    countryCode: 'LKA',
    currencyCode: 'LKR',
    timezone: 'UTC',
    financialYearStartMonth: 1,
    firstDayOfWeek: 1,
    standardWorkingDays: [1, 2, 3, 4, 5],
    defaultLanguage: 'en-US',
    dateFormat: 'DD MMM YYYY',
    timeFormat: '12h' as const,
    status: 'active' as const
  };

  const createPayload = {
    name: 'Gamma Inc',
    companyCode: 'GAMMA',
    registrationNumber: 'REG-3',
    countryCode: 'LKA',
    currencyCode: 'LKR',
    taxRegistrationNumber: null,
    parentLegalEntityId: null
  };

  it('creates a company, exposes saving state, and refreshes the list on success', async () => {
    const createPromise = store.createCompany(createPayload);
    expect(store.saving()).toBe(true);

    const postReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities` && r.method === 'POST');
    postReq.flush(mockCreatedGeneralSettings);

    const refreshReq = await vi.waitFor(() =>
      httpMock.expectOne(`${environment.apiUrl}/session/companies`)
    );
    refreshReq.flush([...mockCompanies, { id: 'comp-3', name: 'Gamma Inc', companyCode: 'GAMMA', logoFileId: null, isActive: true, isPrimary: false }]);

    const success = await createPromise;

    expect(success).toBe(true);
    expect(store.saving()).toBe(false);
    expect(store.createError()).toBeNull();
    expect(store.companies().length).toBe(3);
  });

  it('sets createError and does not refresh the list when creation fails', async () => {
    const createPromise = store.createCompany(createPayload);

    const postReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities` && r.method === 'POST');
    postReq.flush({ detail: 'Company name already exists.' }, { status: 409, statusText: 'Conflict' });

    const success = await createPromise;

    expect(success).toBe(false);
    expect(store.saving()).toBe(false);
    expect(store.createError()).toBe('Company name already exists.');
  });

  it('ignores a second createCompany call while one is already saving', async () => {
    const firstPromise = store.createCompany(createPayload);

    const second = await store.createCompany({ ...createPayload, name: 'Should Be Ignored' });
    expect(second).toBe(false);

    const postReq = httpMock.expectOne((r) => r.url === `${environment.apiUrl}/org/legal-entities` && r.method === 'POST');
    postReq.flush(mockCreatedGeneralSettings);
    const refreshReq = await vi.waitFor(() =>
      httpMock.expectOne(`${environment.apiUrl}/session/companies`)
    );
    refreshReq.flush(mockCompanies);
    await firstPromise;
  });
});
