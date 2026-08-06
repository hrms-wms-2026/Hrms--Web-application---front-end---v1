import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../../environments/environment';
import { LegalEntityGeneralSettings } from '../../models/legal-entity.model';
import { LegalEntityStore, SELECTED_LEGAL_ENTITY_STORAGE_KEY } from '../../state/legal-entity.store';
import { GeneralSettingsComponent } from './general-settings.component';

describe('GeneralSettingsComponent', () => {
  let httpMock: HttpTestingController;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let permissionService: { hasPermission: (p: string) => boolean };

  beforeEach(() => localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY));
  afterEach(() => localStorage.removeItem(SELECTED_LEGAL_ENTITY_STORAGE_KEY));

  const companies = [
    { id: 'company-a', name: 'Company A', companyCode: 'A', logoFileId: null, isActive: true, isPrimary: true },
    { id: 'company-b', name: 'Company B', companyCode: 'B', logoFileId: null, isActive: true, isPrimary: false }
  ];

  const settingsFor = (id: string, name: string): LegalEntityGeneralSettings => ({
    id,
    name,
    companyCode: id.toUpperCase(),
    logoFileId: null,
    registrationNumber: 'REG-1',
    taxRegistrationNumber: null,
    vatGstNumber: null,
    email: 'ops@onevo.example',
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
    registeredBusinessAddress: null
  });

  async function setup(hasPermission: boolean) {
    permissionService = { hasPermission: () => hasPermission };

    await TestBed.configureTestingModule({
      imports: [GeneralSettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PermissionService, useValue: permissionService },
        { provide: NotificationService, useValue: { success: () => {}, error: () => {}, info: () => {} } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    legalEntityStore = TestBed.inject(LegalEntityStore);
  }

  /** Loads the company list (awaited, so selectedLegalEntityId is populated), creates the
   * component, and flushes company-a's general-settings GET so the form is populated. */
  async function setupWithLoadedSettings(): Promise<ComponentFixture<GeneralSettingsComponent>> {
    await setup(true);
    const loadCompaniesPromise = legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);
    await loadCompaniesPromise;

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush(settingsFor('company-a', 'Company A'));
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  afterEach(() => httpMock.verify());

  it('shows a permission-denied empty state and never calls the API when the user lacks legal_entity:update', async () => {
    await setup(false);
    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("You don't have access to this.");
    httpMock.expectNone(() => true);
  });

  it('shows "select a company" empty state when nothing is selected', async () => {
    await setup(true);
    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Select a company to edit General Settings.');
  });

  it("loads and renders the selected company's settings", async () => {
    const fixture = await setupWithLoadedSettings();

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company A');
    expect(fixture.nativeElement.textContent).toContain('Company A');
  });

  it('reloads the form (no leaked values) when the selected company changes', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.name.setValue('Dirty unsaved edit');
    legalEntityStore.selectCompany('company-b');
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.name.value).not.toBe('Dirty unsaved edit');

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`).flush(settingsFor('company-b', 'Company B'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company B');
    expect(fixture.componentInstance.form.pristine).toBe(true);
  });

  it('save() PUTs to the route-scoped id with no tenantId/id/parentLegalEntityId/logoFileId in the body', async () => {
    const fixture = await setupWithLoadedSettings();

    const submitPromise = fixture.componentInstance.onSubmit();

    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    expect(putReq.request.method).toBe('PUT');
    const bodyKeys = Object.keys(putReq.request.body).sort();
    expect(bodyKeys).toEqual(
      [
        'name', 'companyCode', 'registrationNumber', 'taxRegistrationNumber', 'vatGstNumber', 'email',
        'phoneNumber', 'website', 'countryCode', 'currencyCode', 'timezone', 'financialYearStartMonth',
        'firstDayOfWeek', 'standardWorkingDays', 'defaultLanguage', 'dateFormat', 'timeFormat', 'status',
        'registeredBusinessAddress'
      ].sort()
    );
    putReq.flush(settingsFor('company-a', 'Company A'));
    await submitPromise;
  });

  it('blocks submit and does not call the API when required fields are invalid', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.name.setValue('');
    await fixture.componentInstance.onSubmit();

    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
  });

  it('blocks submit when financialYearStartMonth is out of range', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.financialYearStartMonth.setValue(13);
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit when standardWorkingDays is empty', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.standardWorkingDays.setValue([]);
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit on an invalid email', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.email.setValue('not-an-email');
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit on a schemeless website URL', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.website.setValue('example.com');
    expect(fixture.componentInstance.form.invalid).toBe(true);
  });

  it('blocks submit when the backend returns null for a field that is required on save (registrationNumber/companyCode/timezone)', async () => {
    await setup(true);
    const loadCompaniesPromise = legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush(companies);
    await loadCompaniesPromise;

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    // GET response types these as nullable (string?); PUT requires them non-empty -
    // the form must not silently accept a null-backed value as valid.
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush({
      ...settingsFor('company-a', 'Company A'),
      registrationNumber: null,
      companyCode: null,
      timezone: null
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.invalid).toBe(true);

    await fixture.componentInstance.onSubmit();
    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
  });

  it('shows a failure state and keeps typed values on API error', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.name.setValue('Renamed Co');
    const submitPromise = fixture.componentInstance.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ errors: { Name: ['Company name conflict.'] } }, { status: 422, statusText: 'Unprocessable Entity' });
    await submitPromise;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Company name conflict.');
    expect(fixture.componentInstance.form.controls.name.value).toBe('Renamed Co');
  });

  it('updates the displayed company name in LegalEntityStore after a successful save', async () => {
    const fixture = await setupWithLoadedSettings();

    const submitPromise = fixture.componentInstance.onSubmit();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    putReq.flush(settingsFor('company-a', 'Company A Renamed'));
    await submitPromise;

    expect(legalEntityStore.companies().find((c) => c.id === 'company-a')?.name).toBe('Company A Renamed');
  });
});
