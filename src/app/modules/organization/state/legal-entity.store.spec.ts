import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
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
      providers: [LegalEntityStore, provideHttpClient(), provideHttpClientTesting()]
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

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
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
    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
    req.flush(mockCompanies);
    await loadPromise;

    expect(store.selectedLegalEntityId()).toBe('comp-2');
    expect(store.selectedLegalEntity()).toEqual(mockCompanies[1]);
  });

  it('falls back to primary company when persisted selectedLegalEntityId is invalid', async () => {
    localStorage.setItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY, 'invalid-deleted-comp-id');

    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
    req.flush(mockCompanies);
    await loadPromise;

    expect(store.selectedLegalEntityId()).toBe('comp-1');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-1');
  });

  it('updates selectedLegalEntityId state and localStorage when selectCompany is called', async () => {
    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
    req.flush(mockCompanies);
    await loadPromise;

    store.selectCompany('comp-2');

    expect(store.selectedLegalEntityId()).toBe('comp-2');
    expect(store.selectedLegalEntity()?.name).toBe('Beta LLC');
    expect(localStorage.getItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY)).toBe('comp-2');
  });

  it('handles empty company list safely without crashing', async () => {
    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
    req.flush([]);
    await loadPromise;

    expect(store.companies()).toEqual([]);
    expect(store.selectedLegalEntityId()).toBeNull();
    expect(store.selectedLegalEntity()).toBeNull();
  });

  it('updateCompanyDisplay patches name/companyCode/isActive on the matching company only', async () => {
    const loadPromise = store.loadCompanies();
    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`);
    req.flush(mockCompanies);
    await loadPromise;

    store.updateCompanyDisplay('comp-1', { name: 'Alpha Corp Renamed', companyCode: 'ALPHA2', isActive: false });

    const updated = store.companies().find((c) => c.id === 'comp-1');
    expect(updated).toEqual({ ...mockCompanies[0], name: 'Alpha Corp Renamed', companyCode: 'ALPHA2', isActive: false });
    expect(store.companies().find((c) => c.id === 'comp-2')).toEqual(mockCompanies[1]);
  });
});
