import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { environment } from '../../../../../environments/environment';
import { LegalEntityGeneralSettings } from '../../models/legal-entity.model';
import { LegalEntityStore, SELECTED_LEGAL_ENTITY_STORAGE_KEY } from '../../state/legal-entity.store';
import { GeneralSettingsComponent } from './general-settings.component';

describe('GeneralSettingsComponent', () => {
  let httpMock: HttpTestingController;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let permissionService: {
    hasPermission: (p: string) => boolean;
    hasAnyPermission: (ps: readonly string[]) => boolean;
  };

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
    workStartTime: null,
    workEndTime: null,
    breakDurationMinutes: null,
    officeAddress: null,
    officeLatitude: null,
    officeLongitude: null
  });

  /** true = every permission, false = none, or the exact permission codes the user holds. */
  async function setup(granted: boolean | readonly string[]) {
    TestBed.resetTestingModule();
    const has = (p: string) => (typeof granted === 'boolean' ? granted : granted.includes(p));
    permissionService = { hasPermission: has, hasAnyPermission: (ps) => ps.some(has) };

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
  async function setupWithLoadedSettings(
    granted: boolean | readonly string[] = true
  ): Promise<ComponentFixture<GeneralSettingsComponent>> {
    await setup(granted);
    const loadCompaniesPromise = legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/session/companies`).flush(companies);
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

  it('opens view-only with legal_entity:read alone: fields locked, no Save bar, no logo actions', async () => {
    const fixture = await setupWithLoadedSettings(['legal_entity:read']);
    const el = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company A');
    expect(el.textContent).toContain('You have view-only access to these settings.');
    expect(el.querySelector<HTMLFieldSetElement>('.gs-readonly-fieldset')!.disabled).toBe(true);
    expect(el.querySelector('.gs-sticky-save')).toBeNull();
    expect(el.querySelector('.gs-logo-actions')).toBeNull();

    await fixture.componentInstance.onSubmit();
    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
  });

  it('flips Status between Active and Inactive each time the status pill is clicked', async () => {
    const fixture = await setupWithLoadedSettings();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector<HTMLButtonElement>('.gs-status-toggle')!;
    expect(el.querySelector('app-select[label="Status"]')).toBeNull();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toContain('Active');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.status.value).toBe('inactive');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toContain('Inactive');

    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.status.value).toBe('active');
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
    // The company name is a form field value (native <input> property), not static text -
    // there is no separate page heading for it.
    const inputs: NodeListOf<HTMLInputElement> = fixture.nativeElement.querySelectorAll('input');
    expect(Array.from(inputs).some((el) => el.value === 'Company A')).toBe(true);
  });

  it('reloads the form (no leaked values) when the selected company changes', async () => {
    const fixture = await setupWithLoadedSettings();

    fixture.componentInstance.form.controls.name.setValue('Dirty unsaved edit');
    const selectPromise = legalEntityStore.selectCompany('company-b');

    httpMock.expectOne(`${environment.apiUrl}/session/active-company`).flush({});
    await fixture.whenStable();
    httpMock.expectOne(`${environment.apiUrl}/auth/me`).flush({});
    await selectPromise;

    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-b/general-settings`).flush(settingsFor('company-b', 'Company B'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.name.value).toBe('Company B');
    expect(fixture.componentInstance.form.pristine).toBe(true);
  });

  it('shows a backend field error next to its field when the save is refused with a 400', async () => {
    const fixture = await setupWithLoadedSettings();
    const submitPromise = fixture.componentInstance.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush(
        { title: 'Validation Error', detail: 'One or more validation errors occurred.', errors: { CompanyCode: ['Company code is already used by another company.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    await submitPromise;
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.companyCode.errors).toEqual({ server: { message: 'Company code is already used by another company.' } });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Company code is already used by another company.');
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
        'workStartTime', 'workEndTime', 'breakDurationMinutes',
        'officeAddress', 'officeLatitude', 'officeLongitude'
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
    httpMock.expectOne(`${environment.apiUrl}/session/companies`).flush(companies);
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
    const notificationService = TestBed.inject(NotificationService);
    const spy = vi.spyOn(notificationService, 'error');

    fixture.componentInstance.form.controls.name.setValue('Renamed Co');
    const submitPromise = fixture.componentInstance.onSubmit();
    httpMock
      .expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`)
      .flush({ errors: { Name: ['Company name conflict.'] } }, { status: 422, statusText: 'Unprocessable Entity' });
    await submitPromise;
    fixture.detectChanges();

    // Task 20: the field message sits next to the field; the toast points to it.
    expect(spy).toHaveBeenCalledWith('Please check the highlighted fields.');
    expect(fixture.componentInstance.form.controls.name.errors).toEqual({ server: { message: 'Company name conflict.' } });
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

  async function uploadLogoThroughDialog(fixture: ComponentFixture<GeneralSettingsComponent>): Promise<void> {
    const framed = new File(['bytes'], 'logo.png', { type: 'image/png' });
    const pending = fixture.componentInstance.onLogoSaved(framed);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/files`)
      .flush({ fileId: 'file-1', originalFileName: 'logo.png', fileSizeBytes: 5, contentType: 'image/png' });
    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/logo`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fileId: 'file-1' });
    req.flush({ legalEntityId: 'company-a', logoFileId: 'file-1' });
    await pending;
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('opens the file picker from the logo tile when no logo is set, then frames the picked file in the Change logo popup', async () => {
    const fixture = await setupWithLoadedSettings();
    expect(fixture.nativeElement.querySelector('.gs-logo-preview img')).toBeFalsy();

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('.gs-logo-input');
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
    fixture.nativeElement.querySelector('.gs-logo-preview--editable').click();
    expect(clickSpy).toHaveBeenCalled();

    const file = new File(['bytes'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    expect(fixture.componentInstance.logoDialogOpen()).toBe(true);
    expect(fixture.componentInstance.pickedLogo()).toBe(file);
    httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/logo`);
  });

  it('uploads the framed logo when the popup saves', async () => {
    const fixture = await setupWithLoadedSettings();
    fixture.componentInstance.logoDialogOpen.set(true);

    await uploadLogoThroughDialog(fixture);

    expect(fixture.componentInstance.logoDialogOpen()).toBe(false);
    const img: HTMLImageElement = fixture.nativeElement.querySelector('.gs-logo-preview img');
    expect(img).toBeTruthy();
    expect(img.src).toContain(`${environment.apiUrl}/files/file-1`);
  });

  it('opens the Change logo popup instead of the picker when a logo exists', async () => {
    const fixture = await setupWithLoadedSettings();
    await uploadLogoThroughDialog(fixture);

    const fileInput: HTMLInputElement = fixture.nativeElement.querySelector('.gs-logo-input');
    const clickSpy = vi.spyOn(fileInput, 'click').mockImplementation(() => undefined);
    fixture.componentInstance.onLogoClick(fileInput);

    expect(clickSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.logoDialogOpen()).toBe(true);
    expect(fixture.componentInstance.pickedLogo()).toBeNull();
  });

  it('removes the logo when the popup removes it', async () => {
    const fixture = await setupWithLoadedSettings();
    await uploadLogoThroughDialog(fixture);

    const pending = fixture.componentInstance.onLogoRemoved();
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/logo`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await pending;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gs-logo-preview img')).toBeFalsy();
  });


  it('populates workStartTime and workEndTime from settings into the form', async () => {
    await setup(true);
    const loadCompaniesPromise = legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/session/companies`).flush(companies);
    await loadCompaniesPromise;

    const fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush({
      ...settingsFor('company-a', 'Company A'),
      workStartTime: '09:00',
      workEndTime: '17:30'
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.workStartTime.value).toBe('09:00');
    expect(fixture.componentInstance.form.controls.workEndTime.value).toBe('17:30');
    expect(fixture.componentInstance.form.valid).toBe(true);
  });

  it('leaves workStartTime and workEndTime blank when settings has null times', async () => {
    const fixture = await setupWithLoadedSettings(); // settingsFor returns null/null
    expect(fixture.componentInstance.form.controls.workStartTime.value).toBe('');
    expect(fixture.componentInstance.form.controls.workEndTime.value).toBe('');
  });

  it('toRequestPayload sends null for both work time fields when both are blank', async () => {
    const fixture = await setupWithLoadedSettings();
    const submitPromise = fixture.componentInstance.onSubmit();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    expect(putReq.request.body.workStartTime).toBeNull();
    expect(putReq.request.body.workEndTime).toBeNull();
    putReq.flush(settingsFor('company-a', 'Company A'));
    await submitPromise;
  });

  it('toRequestPayload sends HH:mm strings for a valid work time pair', async () => {
    const fixture = await setupWithLoadedSettings();
    fixture.componentInstance.form.controls.workStartTime.setValue('08:00');
    fixture.componentInstance.form.controls.workEndTime.setValue('16:30');
    const submitPromise = fixture.componentInstance.onSubmit();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    expect(putReq.request.body.workStartTime).toBe('08:00');
    expect(putReq.request.body.workEndTime).toBe('16:30');
    putReq.flush(settingsFor('company-a', 'Company A'));
    await submitPromise;
  });

  it('form is invalid when only workStartTime is set', async () => {
    const fixture = await setupWithLoadedSettings();
    fixture.componentInstance.form.controls.workStartTime.setValue('09:00');
    expect(fixture.componentInstance.form.invalid).toBe(true);
    expect(fixture.componentInstance.form.errors?.['workTimePair']).toBe('both_required');
  });

  it('form is invalid when only workEndTime is set', async () => {
    const fixture = await setupWithLoadedSettings();
    fixture.componentInstance.form.controls.workEndTime.setValue('17:30');
    expect(fixture.componentInstance.form.invalid).toBe(true);
    expect(fixture.componentInstance.form.errors?.['workTimePair']).toBe('both_required');
  });

  it('form is valid for overnight 22:00-06:00 and shows the leave-day hours line', async () => {
    const fixture = await setupWithLoadedSettings();
    fixture.componentInstance.form.controls.workStartTime.setValue('22:00');
    fixture.componentInstance.form.controls.workEndTime.setValue('06:00');
    fixture.componentInstance.form.controls.breakDurationMinutes.setValue('0');
    expect(fixture.componentInstance.form.valid).toBe(true);
    expect(fixture.componentInstance.isOvernightWindow()).toBe(true);
    expect(fixture.componentInstance.getWorkingHoursSummary()).toContain('8.0 working hours');
  });

  it('form is valid when work times are cleared after being set', async () => {
    const fixture = await setupWithLoadedSettings();
    fixture.componentInstance.form.controls.workStartTime.setValue('09:00');
    fixture.componentInstance.form.controls.workEndTime.setValue('17:30');
    expect(fixture.componentInstance.form.valid).toBe(true);
    fixture.componentInstance.form.controls.workStartTime.setValue('');
    fixture.componentInstance.form.controls.workEndTime.setValue('');
    expect(fixture.componentInstance.form.valid).toBe(true);
  });

  describe('breakDurationMinutes', () => {
    it('renders a "Break duration" field in the Default work hours section', async () => {
      const fixture = await setupWithLoadedSettings();
      expect(fixture.nativeElement.textContent).toContain('Break duration');
      const numberInput: HTMLInputElement | null = fixture.nativeElement.querySelector('input[type="number"]');
      expect(numberInput).toBeTruthy();
    });

    it('loads an existing breakDurationMinutes value from the API into the form', async () => {
      await setup(true);
      const loadCompaniesPromise = legalEntityStore.loadCompanies();
      httpMock.expectOne(`${environment.apiUrl}/session/companies`).flush(companies);
      await loadCompaniesPromise;

      const fixture = TestBed.createComponent(GeneralSettingsComponent);
      fixture.detectChanges();

      httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`).flush({
        ...settingsFor('company-a', 'Company A'),
        breakDurationMinutes: 60
      });
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.form.controls.breakDurationMinutes.value).toBe('60');
      expect(fixture.componentInstance.form.valid).toBe(true);
    });

    it('leaves breakDurationMinutes blank when settings has a null value', async () => {
      const fixture = await setupWithLoadedSettings(); // settingsFor returns breakDurationMinutes: null
      expect(fixture.componentInstance.form.controls.breakDurationMinutes.value).toBe('');
    });

    it('toRequestPayload sends null when breakDurationMinutes is blank', async () => {
      const fixture = await setupWithLoadedSettings();
      const submitPromise = fixture.componentInstance.onSubmit();
      const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
      expect(putReq.request.body.breakDurationMinutes).toBeNull();
      putReq.flush(settingsFor('company-a', 'Company A'));
      await submitPromise;
    });

    it('toRequestPayload sends a number when breakDurationMinutes has a valid value', async () => {
      const fixture = await setupWithLoadedSettings();
      fixture.componentInstance.form.controls.breakDurationMinutes.setValue('45');
      const submitPromise = fixture.componentInstance.onSubmit();
      const putReq = httpMock.expectOne(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
      expect(putReq.request.body.breakDurationMinutes).toBe(45);
      putReq.flush(settingsFor('company-a', 'Company A'));
      await submitPromise;
    });

    it('blocks submit on a negative breakDurationMinutes value', async () => {
      const fixture = await setupWithLoadedSettings();
      fixture.componentInstance.form.controls.breakDurationMinutes.setValue('-1');
      expect(fixture.componentInstance.form.invalid).toBe(true);

      await fixture.componentInstance.onSubmit();
      httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    });

    it('blocks submit on a decimal breakDurationMinutes value', async () => {
      const fixture = await setupWithLoadedSettings();
      fixture.componentInstance.form.controls.breakDurationMinutes.setValue('7.5');
      expect(fixture.componentInstance.form.invalid).toBe(true);

      await fixture.componentInstance.onSubmit();
      httpMock.expectNone(`${environment.apiUrl}/org/legal-entities/company-a/general-settings`);
    });

    it('accepts zero as a valid breakDurationMinutes value', async () => {
      const fixture = await setupWithLoadedSettings();
      fixture.componentInstance.form.controls.breakDurationMinutes.setValue('0');
      expect(fixture.componentInstance.form.valid).toBe(true);
    });
  });
});
