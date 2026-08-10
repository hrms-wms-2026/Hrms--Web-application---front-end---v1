import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/services/notification.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { AddEmployeeWizardComponent } from './add-employee-wizard.component';

describe('AddEmployeeWizardComponent', () => {
  let fixture: ComponentFixture<AddEmployeeWizardComponent>;
  let httpMock: HttpTestingController;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let notificationService: { success: (m: string) => void; error: (m: string) => void };

  const company = { id: 'le-1', name: 'Acme Co', companyCode: 'ACME', logoFileId: null, isActive: true, isPrimary: true };

  async function setupWithCompany(queryParams: Record<string, string> = {}): Promise<void> {
    notificationService = { success: () => {}, error: () => {} };

    await TestBed.configureTestingModule({
      imports: [AddEmployeeWizardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationService, useValue: notificationService },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
        }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    legalEntityStore = TestBed.inject(LegalEntityStore);

    const loadPromise = legalEntityStore.loadCompanies();
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush([company]);
    await loadPromise;

    fixture = TestBed.createComponent(AddEmployeeWizardComponent);
    fixture.detectChanges();

    if (!queryParams['draftId']) {
      httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  afterEach(() => httpMock.verify());

  it('shows a precondition empty state and no form when no company is selected', async () => {
    notificationService = { success: () => {}, error: () => {} };
    await TestBed.configureTestingModule({
      imports: [AddEmployeeWizardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationService, useValue: notificationService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddEmployeeWizardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No company selected');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    httpMock.expectNone(() => true);
  });

  it('shows a precondition empty state when the selected company has zero departments', async () => {
    await setupWithCompany();
    expect(fixture.nativeElement.textContent).toContain('No departments configured');
  });

  it('does not render a manager or job title field anywhere in the form', async () => {
    await setupWithCompany();
    const html = fixture.nativeElement.innerHTML as string;

    expect(html).not.toContain('formControlName="managerId"');
    expect(html).not.toContain('formControlName="jobTitle"');
    expect(fixture.nativeElement.textContent).not.toContain('Manager');
  });

  it('blocks Continue and shows validation errors when required fields are empty', async () => {
    await setupWithCompany();
    const continueButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButton = continueButtons.find((b) => b.textContent?.includes('Continue'));

    continueButton?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.step()).toBe('employee_details');
    expect(fixture.nativeElement.textContent).toContain('Full name is required.');
  });

  it('shows Schedule/Shift as not configured rather than fabricating options', async () => {
    await setupWithCompany();
    expect(fixture.nativeElement.textContent).toContain('Schedule/Shift is not yet configured');
  });

  it('the primary save action is always labeled "Save Draft", never "Create Employee" or "Send Invite"', async () => {
    await setupWithCompany();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Save Draft');
    expect(text).not.toContain('Create Employee');
    expect(text).not.toContain('Send Invite');
  });

  it('prevents a second submit while the first save is in flight', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      employeeName: 'Ada Lovelace',
      workEmail: 'ada@test.dev',
      employmentType: 'full_time',
      startDate: '2026-08-10'
    });

    const saveButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const saveButton = saveButtons.find((b) => b.textContent?.includes('Save Draft'));

    saveButton?.click();
    saveButton?.click();
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`).flush({
      id: 'draft-1',
      employeeName: 'Ada Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: null,
      positionId: null,
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      scheduleId: null,
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'waiting_for_seat',
      draftReason: 'waiting_for_seat',
      lastSavedStep: 'employee_details',
      startedById: 'user-1',
      version: '1'
    });
    await fixture.whenStable();

    httpMock.verify();
  });

  it('shows a safe error message and does not clear entered values after a save failure', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({ employeeName: 'Ada Lovelace', workEmail: 'ada@test.dev' });

    const savePromise = fixture.componentInstance.onSaveDraft();
    httpMock
      .expectOne(`${environment.apiUrl}/onboarding/drafts`)
      .flush({ detail: 'Npgsql.PostgresException' }, { status: 500, statusText: 'Server Error' });
    await savePromise;

    expect(fixture.componentInstance.form.controls.employeeName.value).toBe('Ada Lovelace');
    expect(fixture.componentInstance.store.saveError()).not.toContain('Npgsql');
  });
});
