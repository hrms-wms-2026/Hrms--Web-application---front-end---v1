import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { LegalEntityGeneralSettings } from '../models/legal-entity.model';
import { GeneralSettingsStore } from './general-settings.store';

describe('GeneralSettingsStore', () => {
  let store: InstanceType<typeof GeneralSettingsStore>;
  let httpMock: HttpTestingController;

  const settingsA: LegalEntityGeneralSettings = {
    id: 'company-a',
    name: 'Company A',
    companyCode: 'A',
    logoFileId: null,
    registrationNumber: 'REG-A',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: null,
    phoneNumber: null,
    website: null,
    countryCode: 'LKA',
    currencyCode: 'LKR',
    timezone: 'Asia/Colombo',
    financialYearStartMonth: 1,
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

  const settingsB: LegalEntityGeneralSettings = { ...settingsA, id: 'company-b', name: 'Company B', companyCode: 'B' };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GeneralSettingsStore, provideHttpClient(), provideHttpClientTesting()]
    });
    store = TestBed.inject(GeneralSettingsStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('loads settings for a legal entity', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    expect(store.settings()).toEqual(settingsA);
    expect(store.legalEntityId()).toBe('company-a');
    expect(store.loading()).toBe(false);
    expect(store.loadError()).toBeNull();
  });

  it('clears prior settings immediately when load() is called for a different company (no cross-company leak)', () => {
    void store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);

    void store.load('company-b');
    expect(store.settings()).toBeNull();
    expect(store.legalEntityId()).toBe('company-b');

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`).flush(settingsB);
  });

  it('ignores a stale in-flight response if the target company changed before it resolved', async () => {
    const loadAPromise = store.load('company-a');
    const reqA = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);

    const loadBPromise = store.load('company-b');
    const reqB = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`);

    reqB.flush(settingsB);
    await loadBPromise;
    reqA.flush(settingsA); // stale - must not overwrite B
    await loadAPromise;

    expect(store.settings()).toEqual(settingsB);
    expect(store.legalEntityId()).toBe('company-b');
  });

  it('sets loadError on failure', async () => {
    const loadPromise = store.load('company-a');
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ detail: 'Not found.' }, { status: 404, statusText: 'Not Found' });
    await loadPromise;

    expect(store.loadError()).toBe('Not found.');
    expect(store.settings()).toBeNull();
  });

  it('clear() resets to initial state', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    store.clear();

    expect(store.settings()).toBeNull();
    expect(store.legalEntityId()).toBeNull();
  });

  it('save() PUTs and updates settings on success', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const savePromise = store.save('company-a', {
      name: 'Company A Renamed',
      companyCode: 'A',
      registrationNumber: 'REG-A',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: null,
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 1,
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
    });

    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    expect(putReq.request.method).toBe('PUT');
    putReq.flush({ ...settingsA, name: 'Company A Renamed' });

    const result = await savePromise;
    expect(result?.name).toBe('Company A Renamed');
    expect(store.settings()?.name).toBe('Company A Renamed');
    expect(store.saving()).toBe(false);
  });

  it('save() sets saveError and keeps prior settings on failure', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const savePromise = store.save('company-a', {
      name: '',
      companyCode: 'A',
      registrationNumber: 'REG-A',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: null,
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5],
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      status: 'active',
      workStartTime: null,
      workEndTime: null,
      breakDurationMinutes: null,
      officeAddress: null,
      officeLatitude: null,
      officeLongitude: null
    });

    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ errors: { Name: ['Company name is required.'] } }, { status: 422, statusText: 'Unprocessable Entity' });

    const result = await savePromise;
    expect(result).toBeNull();
    expect(store.saveError()).toBe('Company name is required.');
    expect(store.settings()).toEqual(settingsA); // failed values kept in form by the component, not the store
  });

  it('save() round-trips workStartTime and workEndTime through the store', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const savePromise = store.save('company-a', {
      name: 'Company A',
      companyCode: 'A',
      registrationNumber: 'REG-A',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: null,
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5],
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      status: 'active',
      workStartTime: '08:00',
      workEndTime: '16:30',
      breakDurationMinutes: 60,
      officeAddress: null,
      officeLatitude: null,
      officeLongitude: null
    });

    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    putReq.flush({ ...settingsA, workStartTime: '08:00', workEndTime: '16:30' });
    const result = await savePromise;

    expect(result?.workStartTime).toBe('08:00');
    expect(result?.workEndTime).toBe('16:30');
    expect(store.settings()?.workStartTime).toBe('08:00');
    expect(store.settings()?.workEndTime).toBe('16:30');
  });

  it('save() clears workStartTime and workEndTime when null/null is sent', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const savePromise = store.save('company-a', {
      name: 'Company A',
      companyCode: 'A',
      registrationNumber: 'REG-A',
      taxRegistrationNumber: null,
      vatGstNumber: null,
      email: null,
      phoneNumber: null,
      website: null,
      countryCode: 'LKA',
      currencyCode: 'LKR',
      timezone: 'Asia/Colombo',
      financialYearStartMonth: 1,
      firstDayOfWeek: 1,
      standardWorkingDays: [1, 2, 3, 4, 5],
      defaultLanguage: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      status: 'active',
      workStartTime: null,
      workEndTime: null,
      breakDurationMinutes: null,
      officeAddress: null,
      officeLatitude: null,
      officeLongitude: null
    });

    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    putReq.flush({ ...settingsA, workStartTime: null, workEndTime: null });
    const result = await savePromise;

    expect(result?.workStartTime).toBeNull();
    expect(result?.workEndTime).toBeNull();
    expect(store.settings()?.workStartTime).toBeNull();
    expect(store.settings()?.workEndTime).toBeNull();
  });

  it('uploadLogo() PUTs multipart and patches logoFileId on success', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });
    const uploadPromise = store.uploadLogo('company-a', file);

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/logo`);
    expect(req.request.method).toBe('PUT');
    req.flush({ legalEntityId: 'company-a', logoFileId: 'file-1' });

    const ok = await uploadPromise;
    expect(ok).toBe(true);
    expect(store.settings()?.logoFileId).toBe('file-1');
    expect(store.uploadingLogo()).toBe(false);
  });

  it('uploadLogo() sets saveError and keeps prior settings on failure', async () => {
    const loadPromise = store.load('company-a');
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsA);
    await loadPromise;

    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });
    const uploadPromise = store.uploadLogo('company-a', file);

    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/logo`)
      .flush({ detail: 'File exceeds the 5 MB limit.' }, { status: 400, statusText: 'Bad Request' });

    const ok = await uploadPromise;
    expect(ok).toBe(false);
    expect(store.saveError()).toBe('File exceeds the 5 MB limit.');
    expect(store.settings()).toEqual(settingsA);
    expect(store.uploadingLogo()).toBe(false);
  });

  it('removeLogo() DELETEs and clears logoFileId on success', async () => {
    const loadPromise = store.load('company-a');
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ ...settingsA, logoFileId: 'file-1' });
    await loadPromise;

    const removePromise = store.removeLogo('company-a');

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/logo`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    const ok = await removePromise;
    expect(ok).toBe(true);
    expect(store.settings()?.logoFileId).toBeNull();
    expect(store.removingLogo()).toBe(false);
  });
});
