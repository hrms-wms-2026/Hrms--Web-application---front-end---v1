import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import { PermissionService } from '../../../../core/auth/state/permission.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LegalEntityStore } from '../../../organization/state/legal-entity.store';
import { AddEmployeeWizardStore } from '../../state/add-employee-wizard.store';
import { AddEmployeeWizardComponent } from './add-employee-wizard.component';

describe('AddEmployeeWizardComponent', () => {
  let fixture: ComponentFixture<AddEmployeeWizardComponent>;
  let httpMock: HttpTestingController;
  let legalEntityStore: InstanceType<typeof LegalEntityStore>;
  let notificationService: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void; warning: (m: string) => void };

  const company = { id: 'le-1', name: 'Acme Co', companyCode: 'ACME', logoFileId: null, isActive: true, isPrimary: true };
  const engineeringDepartment = { id: 'dept-1', name: 'Engineering', legalEntityId: 'le-1', isActive: true };
  const openPosition = {
    id: 'pos-open',
    legalEntityId: 'le-1',
    departmentId: 'dept-1',
    name: 'Software Engineer',
    code: 'SE-1',
    positionType: 'Pooled',
    maxOccupancy: 3,
    reportsToPositionId: null,
    isActive: true,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: null,
    assignedCount: 1
  };
  const fullPosition = {
    id: 'pos-full',
    legalEntityId: 'le-1',
    departmentId: 'dept-1',
    name: 'Project Manager',
    code: 'PM-1',
    positionType: 'Unique',
    maxOccupancy: 1,
    reportsToPositionId: null,
    isActive: true,
    createdAt: '2026-08-20T00:00:00Z',
    updatedAt: null,
    assignedCount: 1
  };

  async function setupWithCompany(
    queryParams: Record<string, string> = {},
    options: { departments?: readonly typeof engineeringDepartment[] } = {}
  ): Promise<void> {
    TestBed.resetTestingModule();
    notificationService = { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };

    await TestBed.configureTestingModule({
      imports: [AddEmployeeWizardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: AddEmployeeWizardComponent }]),
        { provide: PermissionService, useValue: { hasPermission: () => true, hasAnyPermission: () => true } },
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
    httpMock.expectOne(`${environment.apiUrl}/session/companies`).flush([company]);
    await loadPromise;

    fixture = TestBed.createComponent(AddEmployeeWizardComponent);
    fixture.detectChanges();

    if (!queryParams['draftId']) {
      // Only fires immediately when there's no draft to resume - resuming a draft sets companyId
      // from the draft's own legalEntityId, so work modes load once that resolves (see
      // flushWorkModesRequest, called by draftId-resume tests after they flush the draft GET).
      httpMock
        .expectOne((r) => r.url === `${environment.apiUrl}/work-modes` && r.params.get('legalEntityId') === 'le-1')
        .flush([{ id: '1', label: 'On-Site' }]);
      await fixture.whenStable();

      httpMock.expectOne((r) => r.url.includes('/departments')).flush({
        items: options.departments ?? [],
        page: 1,
        pageSize: 25,
        totalCount: (options.departments ?? []).length,
        totalPages: 1
      });
      httpMock
        .expectOne((r) => r.url.includes('/onboarding/employee-number-suggestion'))
        .flush({ employeeNumber: 'ACME-0001', prefix: 'ACME', sequence: 1 });
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  async function flushPositionsForDepartment(
    positions: readonly (typeof openPosition | typeof fullPosition)[]
  ): Promise<void> {
    fixture.componentInstance.onDepartmentChange('dept-1');
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({
      items: positions,
      page: 1,
      pageSize: 25,
      totalCount: positions.length,
      totalPages: 1
    });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /**
   * Work modes load once companyId is set. On the non-draft path that happens immediately
   * (see setupWithCompany); when resuming a draft, companyId is only set from the draft's own
   * legalEntityId after the draft GET resolves, so draftId-resume tests call this themselves
   * right after flushing that request.
   */
  function flushWorkModesRequest(): void {
    httpMock
      .expectOne((r) => r.url === `${environment.apiUrl}/work-modes` && r.params.get('legalEntityId') === 'le-1')
      .flush([{ id: '1', label: 'On-Site' }]);
  }

  function flushEmployeeNumberSuggestionRequests(sequence = 1): void {
    for (const req of httpMock.match((r) => r.url.includes('/onboarding/employee-number-suggestion'))) {
      req.flush({
        employeeNumber: `ACME-${String(sequence).padStart(4, '0')}`,
        prefix: 'ACME',
        sequence
      });
    }
  }

  function flushEmployeeNumberAvailabilityRequests(available = true): void {
    for (const req of httpMock.match((r) => r.url.includes('/onboarding/employee-number-availability'))) {
      const employeeNumber = req.request.params.get('employeeNumber') ?? 'ACME-0001';
      req.flush({ employeeNumber, available });
    }
  }

  afterEach(() => {
    flushEmployeeNumberSuggestionRequests();
    flushEmployeeNumberAvailabilityRequests();
    httpMock.verify();
  });

  it('shows a precondition empty state and no form when no company is selected', async () => {
    notificationService = { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };
    await TestBed.configureTestingModule({
      imports: [AddEmployeeWizardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissionService, useValue: { hasPermission: () => true, hasAnyPermission: () => true } },
        { provide: NotificationService, useValue: notificationService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AddEmployeeWizardComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No company selected');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows a precondition empty state when the selected company has zero departments', async () => {
    await setupWithCompany();
    expect(fixture.nativeElement.textContent).toContain('No departments configured');
  });

  it('renders available and full positions with concise vacancy labels', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    await flushPositionsForDepartment([openPosition, fullPosition]);

    const options = fixture.componentInstance.store.positions();
    expect(options.some((option) => option.label.includes('Software Engineer [2]'))).toBe(true);
    expect(options.some((option) => option.label.includes('Project Manager [No vacancy]'))).toBe(true);
  });

  it('disables the full position option in the position select', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    await flushPositionsForDepartment([openPosition, fullPosition]);

    const options = fixture.componentInstance.store.positions();
    const fullOption = options.find((option) => option.label.includes('Project Manager [No vacancy]'));
    expect(fullOption).toBeTruthy();
    expect(fullOption?.disabled).toBe(true);
  });

  it('renders work mode and employment type options as visible selectable chips', async () => {
    await setupWithCompany();
    const chips: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.work-mode-chip'));
    expect(chips.length).toBeGreaterThan(0);

    const fullTimeChip = chips.find((c) => c.textContent?.includes('Full-time'));
    expect(fullTimeChip).toBeTruthy();

    fullTimeChip?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.employmentType.value).toBe('full_time');
    expect(fullTimeChip?.classList).toContain('work-mode-chip--active');
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
    expect(fixture.nativeElement.textContent).toContain('First name is required.');
  });

  it('blocks continue, save draft, and finalize when the selected position has no vacancy', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    await flushPositionsForDepartment([openPosition, fullPosition]);

    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-full',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    await fixture.componentInstance.store.setPosition('pos-full', null);
    fixture.detectChanges();

    fixture.componentInstance.goToNextStep();
    fixture.detectChanges();
    expect(fixture.componentInstance.store.step()).toBe('employee_details');
    expect(fixture.nativeElement.textContent).toContain('The selected position no longer has a vacancy. Choose another position.');

    await fixture.componentInstance.onSaveDraft();
    httpMock.expectNone(`${environment.apiUrl}/onboarding/drafts`);

    fixture.componentInstance.store.goToStep('review_and_submit');
    fixture.detectChanges();
    await fixture.componentInstance.onFinalize();
    httpMock.expectNone((req) => req.url.includes('/onboarding/drafts') && req.method === 'POST');
    httpMock.expectNone((req) => req.url.includes('/onboarding/drafts/') && req.url.endsWith('/finalize'));
  });

  it('does not render Schedule/Shift notice text in the form', async () => {
    await setupWithCompany();
    expect(fixture.nativeElement.textContent).not.toContain('Schedule/Shift is not yet configured');
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
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });

    const saveButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const saveButton = saveButtons.find((b) => b.textContent?.includes('Save Draft'));

    saveButton?.click();
    saveButton?.click();
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`).flush({
      id: 'draft-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      workModeId: '1',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'waiting_for_seat',
      draftReason: 'waiting_for_seat',
      lastSavedStep: 'employee_details',
      startedById: 'user-1',
      reportsToEmployeeId: null,
      version: '1'
    });
    await fixture.whenStable();

    httpMock.verify();
  });

  it('shows a safe error message and does not clear entered values after a save failure', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });

    const savePromise = fixture.componentInstance.onSaveDraft();
    httpMock
      .expectOne(`${environment.apiUrl}/onboarding/drafts`)
      .flush({ detail: 'Npgsql.PostgresException' }, { status: 500, statusText: 'Server Error' });
    await savePromise;

    expect(fixture.componentInstance.form.controls.firstName.value).toBe('Ada');
    expect(fixture.componentInstance.form.controls.lastName.value).toBe('Lovelace');
    expect(fixture.componentInstance.store.saveError()).not.toContain('Npgsql');
  });

  it('validates workEmail over 254 characters as invalid', async () => {
    await setupWithCompany();
    const longEmail = 'a'.repeat(246) + '@test.dev'; // 255 chars
    fixture.componentInstance.form.controls.workEmail.setValue(longEmail);

    expect(fixture.componentInstance.form.controls.workEmail.valid).toBe(false);
  });

  it('save draft does not call API when work mode is missing', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: ''
    });

    await fixture.componentInstance.onSaveDraft();

    httpMock.expectNone(`${environment.apiUrl}/onboarding/drafts`);
  });

  it('review step no longer claims finalization is unavailable in this version of the product', async () => {
    await setupWithCompany();
    fixture.componentInstance.store.goToStep('review_and_submit');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('This employee cannot be finalized in this version of the product');
    expect(fixture.nativeElement.textContent).toContain('Finalize and send invite');
  });

  it('finalize button saves draft first then finalizes when no draft exists', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.componentInstance.store.goToStep('review_and_submit');
    fixture.detectChanges();

    const finPromise = fixture.componentInstance.onFinalize();

    const saveReq = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(saveReq.request.method).toBe('POST');
    saveReq.flush({
      id: 'draft-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      workModeId: '1',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
      reportsToEmployeeId: null,
      version: '1'
    });

    await Promise.resolve();
    await Promise.resolve();

    const finReq = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-1/finalize`);
    expect(finReq.request.method).toBe('POST');
    finReq.flush({
      draftId: 'draft-1',
      employeeId: 'emp-1',
      status: 'finalized',
      draftReason: 'invitation_sent',
      invitationQueued: true,
      positionApprovalPending: false,
      checklistTasksCreated: true,
      messageKey: 'finalized'
    });

    await finPromise;
  });

  it('calls loadChecklistTemplateMatches when moving from employee_details to checklist_template after validation passes', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.detectChanges();

    const continueButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButton = continueButtons.find((b) => b.textContent?.includes('Continue'));
    continueButton?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.step()).toBe('checklist_template');

    const req = httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    expect(req.request.params.get('legalEntityId')).toBe('le-1');
    req.flush([{ id: 'tmpl-1', name: 'Company Default Onboarding', matchLevel: 'company', departmentId: null, positionId: null }]);
    await fixture.whenStable();
    fixture.detectChanges();

    // No auto-selection means no detail request fires - the card's own label is what proves the match rendered.
    expect(fixture.nativeElement.textContent).not.toContain('Checklist templates are not yet available');
    expect(fixture.nativeElement.textContent).toContain('Company Default Onboarding');
  });

  it('shows the empty state on Step 2 only when the match response is empty', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.detectChanges();

    const continueButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButton = continueButtons.find((b) => b.textContent?.includes('Continue'));
    continueButton?.click();
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('not yet available');
  });

  it('selecting a checklist template updates selectedTemplateId', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.detectChanges();

    const continueButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButton = continueButtons.find((b) => b.textContent?.includes('Continue'));
    continueButton?.click();
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([
      { id: 'tmpl-1', name: 'Company Default Onboarding', matchLevel: 'company', departmentId: null, positionId: null },
      { id: 'tmpl-2', name: 'Dept Onboarding', matchLevel: 'department', departmentId: 'dept-1', positionId: null }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.selectedTemplateId()).toBeNull();

    const radios: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="radio"].checklist-card'));
    const deptOption = radios.find((r) => r.textContent?.includes('Dept Onboarding'));
    (deptOption as HTMLElement)?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.selectedTemplateId()).toBe('tmpl-2');

    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-2`).flush({
      id: 'tmpl-2',
      name: 'Dept Onboarding',
      templateType: 'onboarding',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      positionId: null,
      positionName: null,
      isActive: true,
      tasks: []
    });
    await fixture.whenStable();
  });

  it('clears a selected full position after reload and also clears checklist/template task edits', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    await flushPositionsForDepartment([openPosition]);

    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-open',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    await fixture.componentInstance.store.setPosition('pos-open', null);
    fixture.componentInstance.goToNextStep();
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([
      { id: 'tmpl-1', name: 'Engineering Onboarding', matchLevel: 'position', departmentId: 'dept-1', positionId: 'pos-open' }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.checklist-card') as HTMLElement;
    card.click();
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      id: 'tmpl-1',
      name: 'Engineering Onboarding',
      templateType: 'onboarding',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      positionId: 'pos-open',
      positionName: 'Software Engineer',
      isActive: true,
      tasks: [
        { title: 'Provision laptop', ownerType: 'employee', assignedToId: null, dueOffsetDays: 1, sequence: 1, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null }
      ]
    });
    await fixture.whenStable();
    fixture.detectChanges();

    const titleInput = fixture.nativeElement.querySelector('input[placeholder="Task title"]') as HTMLInputElement;
    titleInput.value = 'Provision laptop ASAP';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.store.draftTasks().length).toBe(1);

    const reloadedOpenPosition = { ...openPosition, assignedCount: 3 };
    const reloadPromise = fixture.componentInstance.store.loadPositionsForDepartment('le-1', 'dept-1');
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({
      items: [reloadedOpenPosition],
      page: 1,
      pageSize: 25,
      totalCount: 1,
      totalPages: 1
    });
    await reloadPromise;
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.positionId.value).toBe('');
    expect(fixture.componentInstance.store.positionId()).toBeNull();
    expect(fixture.componentInstance.store.selectedTemplateId()).toBeNull();
    expect(fixture.componentInstance.store.draftTasks()).toEqual([]);
    expect(fixture.componentInstance.store.positionValidationMessage()).toBe(
      'The selected position no longer has a vacancy. Choose another position.'
    );
    fixture.componentInstance.goToPreviousStep();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('The selected position no longer has a vacancy. Choose another position.');
  });

  it('does not repeatedly call the matches endpoint when opening Step 2 without department/position changes', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.detectChanges();

    const continueButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButton = continueButtons.find((b) => b.textContent?.includes('Continue'));
    continueButton?.click();
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([
      { id: 'tmpl-1', name: 'Company Default Onboarding', matchLevel: 'company', departmentId: null, positionId: null }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.detectChanges();
    await fixture.whenStable();

    httpMock.expectNone((r) => r.url.includes('/onboarding/checklist-templates/matches'));
    httpMock.expectNone(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
  });

  it('finalize existing draft calls finalize endpoint directly', async () => {
    await setupWithCompany({ draftId: 'draft-existing' });

    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-existing`).flush({
      id: 'draft-existing',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: 'ACME-0001',
      workModeId: '1',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
      reportsToEmployeeId: null,
      version: '1'
    });

    await fixture.whenStable();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([]);
    await fixture.whenStable();
    await Promise.resolve();
    flushWorkModesRequest();
    flushEmployeeNumberSuggestionRequests();

    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1',
      employeeNumber: 'ACME-0001'
    });
    fixture.componentInstance.employeeNumberAvailability.set('available');
    fixture.detectChanges();

    const finPromise = fixture.componentInstance.onFinalize();

    httpMock.expectNone((req) => req.url === `${environment.apiUrl}/onboarding/drafts` && req.method === 'POST');
    const finReq = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-existing/finalize`);
    expect(finReq.request.method).toBe('POST');
    finReq.flush({
      draftId: 'draft-existing',
      employeeId: null,
      status: 'waiting_for_position_approval',
      draftReason: 'waiting_for_position_approval',
      invitationQueued: false,
      positionApprovalPending: true,
      checklistTasksCreated: false,
      messageKey: 'position_approval_requested'
    });

    await finPromise;
  });

  it('shows saved labels and reporting manager details on the review step for a resumed draft even when live options are unavailable', async () => {
    await setupWithCompany({ draftId: 'draft-review-labels' });

    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-review-labels`).flush({
      id: 'draft-review-labels',
      firstName: 'Hello',
      lastName: 'wms',
      workEmail: 'iamilaxsl705@gmail.com',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      positionId: 'pos-1',
      positionName: 'Frontend Engineer',
      employmentType: 'full_time',
      startDate: '2026-08-20',
      employeeNumber: 'ET231',
      workModeId: '1',
      workModeLabel: 'On-Site',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
      reportsToEmployeeId: 'mgr-1',
      reportingManagerName: 'Grace Hopper',
      reportingManagerPositionName: 'Engineering Manager',
      version: '1'
    });

    await fixture.whenStable();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await fixture.whenStable();
    flushEmployeeNumberSuggestionRequests();
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([]);
    await fixture.whenStable();
    flushWorkModesRequest();
    flushEmployeeNumberSuggestionRequests();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Engineering');
    expect(text).toContain('Frontend Engineer');
    expect(text).toContain('On-Site');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('Engineering Manager');
  });

  it('resets stale finalized wizard state when Add Employee opens without a draftId', async () => {
    TestBed.resetTestingModule();
    notificationService = { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };

    await TestBed.configureTestingModule({
      imports: [AddEmployeeWizardComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: AddEmployeeWizardComponent }]),
        { provide: PermissionService, useValue: { hasPermission: () => true, hasAnyPermission: () => true } },
        { provide: NotificationService, useValue: notificationService },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } }
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    const store = TestBed.inject(AddEmployeeWizardStore);

    // Simulate leftover state from a previously finalized draft earlier in this session -
    // the store is providedIn: 'root' and survives route navigations.
    const finalizePromise = store.finalizeDraft('draft-old');
    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-old/finalize`).flush({
      draftId: 'draft-old',
      employeeId: 'emp-1',
      status: 'finalized',
      draftReason: 'invitation_sent',
      invitationQueued: true,
      positionApprovalPending: false,
      checklistTasksCreated: true,
      messageKey: 'finalized'
    });
    await finalizePromise;
    expect(store.finalizeResult()).not.toBeNull();
    expect(store.lastSaveReason()).toBe('invitation_sent');

    fixture = TestBed.createComponent(AddEmployeeWizardComponent);
    fixture.detectChanges();

    expect(store.finalizeResult()).toBeNull();
    expect(store.lastSaveReason()).toBeNull();
    expect(store.draftId()).toBeNull();
  });

  it('blocks Save Draft / Finalize and shows a safe message when the resumed draft is already finalized', async () => {
    await setupWithCompany({ draftId: 'draft-finalized' });

    httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-finalized`).flush({
      id: 'draft-finalized',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: 'ACME-0001',
      workModeId: '1',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'finalized',
      draftReason: 'invitation_sent',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
      reportsToEmployeeId: null,
      version: '1'
    });
    await fixture.whenStable();
    httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/positions')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([]);
    await fixture.whenStable();
    flushWorkModesRequest();
    flushEmployeeNumberSuggestionRequests();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('This onboarding has already been finalized.');

    const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    expect(buttons.some((b) => b.textContent?.includes('Save Draft'))).toBe(false);
    expect(buttons.some((b) => b.textContent?.includes('Finalize and send invite'))).toBe(false);

    const backLink: HTMLAnchorElement | null = fixture.nativeElement.querySelector('a[href="/people/employees"]');
    expect(backLink).toBeTruthy();
  });

  it('clears wizard state and navigates to Employees after a successful finalize with invitation queued', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.componentInstance.store.goToStep('review_and_submit');
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    // reset() nulls companyId, which the constructor's still-live company-selection effect would
    // react to by re-fetching departments if it ran before this component is torn down by
    // navigation. router.navigate resolves on a microtask (like the real Router) so that
    // "reset() called before navigate() settles" is actually observable, not just "called after
    // the navigate() line textually" - a plain vi.fn().mockResolvedValue would make both a
    // fire-and-forget and an awaited navigate() look identical in call order.
    const callOrder: string[] = [];
    const navigateSpy = vi.spyOn(router, 'navigate').mockImplementation(() =>
      Promise.resolve().then(() => {
        callOrder.push('navigate-settled');
        return true;
      })
    );
    const store = fixture.componentInstance.store;
    const realReset = store.reset.bind(store);
    const resetSpy = vi.spyOn(store, 'reset').mockImplementation(() => {
      callOrder.push('reset');
      realReset();
    });

    const finPromise = fixture.componentInstance.onFinalize();

    const saveReq = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    saveReq.flush({
      id: 'draft-new',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      employeeNumber: null,
      workModeId: '1',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
      reportsToEmployeeId: null,
      version: '1'
    });

    await Promise.resolve();
    await Promise.resolve();

    const finReq = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts/draft-new/finalize`);
    finReq.flush({
      draftId: 'draft-new',
      employeeId: 'emp-1',
      status: 'finalized',
      draftReason: 'invitation_sent',
      invitationQueued: true,
      positionApprovalPending: false,
      checklistTasksCreated: true,
      messageKey: 'finalized'
    });

    await finPromise;

    expect(navigateSpy).toHaveBeenCalledWith(['/people/employees']);
    expect(resetSpy).toHaveBeenCalled();
    expect(callOrder).toEqual(['navigate-settled', 'reset']);
    expect(store.finalizeResult()).toBeNull();
    expect(store.draftId()).toBeNull();
    expect(store.lastSaveReason()).toBeNull();
  });

  async function advanceToChecklistStepUnselected(): Promise<void> {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });
    fixture.detectChanges();

    const continueButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
    const continueButton = continueButtons.find((b) => b.textContent?.includes('Continue'));
    continueButton?.click();
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/onboarding/checklist-templates/matches')).flush([
      { id: 'tmpl-1', name: 'Engineering Onboarding', matchLevel: 'department', departmentId: 'dept-1', positionId: null }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  /** Advances to Step 2 with one match, then explicitly clicks it - selection is never automatic. */
  async function advanceToChecklistStepWithOneMatch(): Promise<void> {
    await advanceToChecklistStepUnselected();

    const card = fixture.nativeElement.querySelector('.checklist-card') as HTMLElement;
    card.click();
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      id: 'tmpl-1',
      name: 'Engineering Onboarding',
      templateType: 'onboarding',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      positionId: null,
      positionName: null,
      isActive: true,
      tasks: [
        { title: 'Sign paperwork', ownerType: 'employee', assignedToId: null, dueOffsetDays: 0, sequence: 2, isRequired: true, isBypassable: false, bypassPenaltyDescription: null, category: null },
        { title: 'Provision laptop', ownerType: 'it', assignedToId: 'user-9', dueOffsetDays: 1, sequence: 1, isRequired: false, isBypassable: false, bypassPenaltyDescription: null, category: null }
      ]
    });
    await fixture.whenStable();
    const positionLoads = httpMock.match((r) => r.url.includes('/people/checklist-assignee-positions'));
    for (const req of positionLoads) {
      req.flush([{ id: 'pos-hr', name: 'HR Partner' }]);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function findByText(selector: string, text: string): HTMLElement | undefined {
    return Array.from(fixture.nativeElement.querySelectorAll(selector)).find(
      (el) => (el as HTMLElement).textContent?.includes(text)
    ) as HTMLElement | undefined;
  }

  it('shows a neutral right-panel message when Step 2 loads with no checklist selected', async () => {
    await advanceToChecklistStepUnselected();
    expect(fixture.nativeElement.textContent).toContain('Select a checklist to preview and customize tasks for this employee.');
  });

  it('does not select any checklist card by default', async () => {
    await advanceToChecklistStepUnselected();
    expect(fixture.componentInstance.store.selectedTemplateId()).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.checklist-card--active').length).toBe(0);
  });

  it('shows a visible selected state on the active checklist card that does not rely on color alone', async () => {
    await advanceToChecklistStepWithOneMatch();

    const card = fixture.nativeElement.querySelector('.checklist-card') as HTMLElement;
    expect(card.classList).toContain('checklist-card--active');
    expect(card.getAttribute('aria-checked')).toBe('true');
    expect(card.querySelector('.checklist-card__check')).toBeTruthy();
  });

  it('clicking a checklist selects it and shows the editable task panel', async () => {
    await advanceToChecklistStepWithOneMatch();

    expect(fixture.componentInstance.store.selectedTemplateId()).toBe('tmpl-1');
    expect(fixture.nativeElement.querySelectorAll('input[placeholder="Task title"]').length).toBe(2);
  });

  it('shows the right-side panel with checklist name, type, applicability, and task count once selected', async () => {
    await advanceToChecklistStepWithOneMatch();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Engineering Onboarding');
    expect(text).toContain('Onboarding');
    expect(text).toContain('Department — Engineering');
    expect(text).toContain('2 tasks');
  });

  it('lists tasks in sequence order as editable rows with assignee, due-days, and required controls', async () => {
    await advanceToChecklistStepWithOneMatch();

    const titleInputs: HTMLInputElement[] = Array.from(fixture.nativeElement.querySelectorAll('input[placeholder="Task title"]'));
    expect(titleInputs.map((input) => input.value)).toEqual(['Provision laptop', 'Sign paperwork']);

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('+ Assign');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Assigned to');
    expect(text).not.toContain('Choosing another assignee is not available yet.');
  });

  it('task title can be edited', async () => {
    await advanceToChecklistStepWithOneMatch();

    const clientId = fixture.componentInstance.store.draftTasks()[0].clientId;
    const titleInput = fixture.nativeElement.querySelector('input[placeholder="Task title"]') as HTMLInputElement;
    titleInput.value = 'Provision laptop (updated)';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.store.draftTasks().find((t) => t.clientId === clientId)?.title).toBe('Provision laptop (updated)');
  });

  it('task can be added', async () => {
    await advanceToChecklistStepWithOneMatch();
    const before = fixture.componentInstance.store.draftTasks().length;

    (findByText('button', '+ Add task') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.draftTasks().length).toBe(before + 1);
  });

  it('task can be removed', async () => {
    await advanceToChecklistStepWithOneMatch();
    const before = fixture.componentInstance.store.draftTasks().length;

    (fixture.nativeElement.querySelector('button[aria-label="Remove task"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.draftTasks().length).toBe(before - 1);
  });

  it('task can be moved up and down', async () => {
    await advanceToChecklistStepWithOneMatch();
    const [firstBefore, secondBefore] = fixture.componentInstance.store.draftTasks().map((t) => t.title);

    (fixture.nativeElement.querySelector('button[aria-label="Move task down"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.draftTasks()[0].title).toBe(secondBefore);
    expect(fixture.componentInstance.store.draftTasks()[1].title).toBe(firstBefore);

    const upButtons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button[aria-label="Move task up"]'));
    upButtons[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.draftTasks()[0].title).toBe(firstBefore);
  });

  it('due days rejects negative and decimal values', async () => {
    await advanceToChecklistStepWithOneMatch();
    const clientId = fixture.componentInstance.store.draftTasks()[0].clientId;
    const originalDueDays = fixture.componentInstance.store.draftTasks()[0].dueDays;
    const dueInput = fixture.nativeElement.querySelector('input[type="number"]') as HTMLInputElement;

    dueInput.value = '-1';
    dueInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.store.draftTasks().find((t) => t.clientId === clientId)?.dueDays).toBe(originalDueDays);
    expect(fixture.nativeElement.textContent).toContain('Enter a whole number of days, 0 or more.');

    dueInput.value = '2.5';
    dueInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.store.draftTasks().find((t) => t.clientId === clientId)?.dueDays).toBe(originalDueDays);

    dueInput.value = '5';
    dueInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.store.draftTasks().find((t) => t.clientId === clientId)?.dueDays).toBe(5);
  });

  it('task title required validation is shown and blocks Continue', async () => {
    await advanceToChecklistStepWithOneMatch();
    const titleInput = fixture.nativeElement.querySelector('input[placeholder="Task title"]') as HTMLInputElement;
    titleInput.value = '';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (findByText('button', 'Continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.step()).toBe('checklist_template');
    expect(fixture.nativeElement.textContent).toContain('A title is required.');
  });

  it('does not mutate the original template detail object when editing tasks', async () => {
    await advanceToChecklistStepWithOneMatch();
    const originalTitle = fixture.componentInstance.store.selectedTemplateDetail()?.tasks.find((t) => t.title === 'Provision laptop')?.title;

    const titleInput = fixture.nativeElement.querySelector('input[placeholder="Task title"]') as HTMLInputElement;
    titleInput.value = 'Changed title';
    titleInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.store.selectedTemplateDetail()?.tasks.find((t) => t.title === 'Provision laptop')?.title).toBe(
      originalTitle
    );
  });

  it('does not render raw backend field names or raw backend values anywhere in the DOM', async () => {
    await advanceToChecklistStepWithOneMatch();

    const html = fixture.nativeElement.innerHTML as string;
    expect(html).not.toContain('ownerType');
    expect(html).not.toContain('assignedToId');
    expect(html).not.toContain('assigneePositionId');
    expect(html).not.toContain('dueOffsetDays');
    expect(html).not.toContain('editedTasksJson');
    expect(html).not.toContain('sequence');
    expect(html).not.toContain('matchLevel');
    // Raw values from the fixture's tasks (ownerType: 'it', assignedToId: 'user-9') - the actual leak risk.
    expect(html).not.toContain('user-9');
    expect(html).not.toContain('custom_user');
    expect(fixture.nativeElement.textContent).not.toMatch(/\bit\b/);
  });

  it('shows a populated header with a "0 tasks" count and no task rows when the selected checklist has zero tasks', async () => {
    await advanceToChecklistStepUnselected();

    const card = fixture.nativeElement.querySelector('.checklist-card') as HTMLElement;
    card.click();
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/people/checklist-templates/tmpl-1`).flush({
      id: 'tmpl-1',
      name: 'Engineering Onboarding',
      templateType: 'onboarding',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      departmentName: 'Engineering',
      positionId: null,
      positionName: null,
      isActive: true,
      tasks: []
    });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Engineering Onboarding');
    expect(fixture.nativeElement.textContent).toContain('0 tasks');
    expect(fixture.nativeElement.querySelectorAll('input[placeholder="Task title"]').length).toBe(0);
  });

  it('does not issue continuous detail requests after a checklist is selected', async () => {
    await advanceToChecklistStepWithOneMatch();

    fixture.detectChanges();
    fixture.detectChanges();
    await fixture.whenStable();

    httpMock.expectNone(`${environment.apiUrl}/people/checklist-templates/tmpl-1`);
  });

  it('blocks save when a reports-to pick is needed but not made', async () => {
    await setupWithCompany();
    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@test.dev',
      departmentId: 'dept-1',
      positionId: 'pos-1',
      employmentType: 'full_time',
      startDate: '2026-08-10',
      workModeId: '1'
    });

    const setPositionPromise = fixture.componentInstance.store.setPosition('pos-1', 'reports-to-pos');
    httpMock.expectOne(
      `${environment.apiUrl}/org/legal-entities/le-1/positions/reports-to-pos/active-holders`
    ).flush([
      { employeeId: 'a', firstName: 'A', lastName: 'One', workEmail: 'a@acme.test', avatarFileId: null },
      { employeeId: 'b', firstName: 'B', lastName: 'Two', workEmail: 'b@acme.test', avatarFileId: null }
    ]);
    await setPositionPromise;
    fixture.detectChanges();

    await fixture.componentInstance.onSaveDraft();

    httpMock.expectNone(`${environment.apiUrl}/onboarding/drafts`);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Select who this employee reports to');
  });

  it('shows a position selector for another-person tasks and loads people after a position is chosen', async () => {
    await advanceToChecklistStepWithOneMatch();

    const laptop = fixture.componentInstance.store.draftTasks().find((t) => t.title === 'Provision laptop')!;
    expect(laptop.assignee).toBe('another');
    expect(fixture.nativeElement.textContent).toContain('+ Assign');

    (findByText('button', '+ Assign') as HTMLButtonElement).click();
    fixture.detectChanges();

    (findByText('button', 'Existing employee') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/people/checklist-assignee-positions')).flush([
      { id: 'pos-hr', name: 'HR Partner' }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Select position');
    (findByText('button', 'HR Partner') as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url.includes('/people/checklist-assignees')).flush([
      { employeeId: 'emp-1', userId: 'user-aaa', displayName: 'Jane Smith', workEmail: 'jane@acme.test', avatarFileId: null },
      { employeeId: 'emp-2', userId: 'user-bbb', displayName: 'John Jones', workEmail: 'john@acme.test', avatarFileId: null }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Jane Smith');
    expect(fixture.nativeElement.textContent).toContain('John Jones');
    expect(fixture.componentInstance.store.draftTasks().find((t) => t.clientId === laptop.clientId)?.selectedAssigneeUserId).toBeNull();
  });

  it('shows a friendly empty message when a position has no active employees', async () => {
    await advanceToChecklistStepWithOneMatch();
    (findByText('button', '+ Assign') as HTMLButtonElement).click();
    fixture.detectChanges();
    (findByText('button', 'Existing employee') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/people/checklist-assignee-positions')).flush([
      { id: 'pos-hr', name: 'HR Partner' }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    (findByText('button', 'HR Partner') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/people/checklist-assignees')).flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No active employees are assigned to this position yet.');
  });

  it('preselects the only active employee and still lets HR change it', async () => {
    await advanceToChecklistStepWithOneMatch();
    const laptop = fixture.componentInstance.store.draftTasks().find((t) => t.title === 'Provision laptop')!;
    (findByText('button', '+ Assign') as HTMLButtonElement).click();
    fixture.detectChanges();
    (findByText('button', 'Existing employee') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/people/checklist-assignee-positions')).flush([
      { id: 'pos-hr', name: 'HR Partner' }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    (findByText('button', 'HR Partner') as HTMLButtonElement).click();
    fixture.detectChanges();
    httpMock.expectOne((r) => r.url.includes('/people/checklist-assignees')).flush([
      { employeeId: 'emp-1', userId: 'user-aaa', displayName: 'Jane Smith', workEmail: 'jane@acme.test', avatarFileId: null }
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.draftTasks().find((t) => t.clientId === laptop.clientId)?.selectedAssigneeUserId).toBe('user-aaa');
    expect(fixture.nativeElement.textContent).toContain('Jane Smith');
  });

  it('blocks Save Draft until an another-person task has a selected person', async () => {
    await advanceToChecklistStepWithOneMatch();
    await fixture.componentInstance.onSaveDraft();
    fixture.detectChanges();

    httpMock.expectNone(`${environment.apiUrl}/onboarding/drafts`);
    expect(fixture.nativeElement.textContent).toContain('Select a position.');
  });

  it('auto-fills employee number from the suggestion endpoint when company is available', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    expect(fixture.componentInstance.form.controls.employeeNumber.value).toBe('ACME-0001');
    expect(fixture.componentInstance.employeeNumberAvailability()).toBe('available');
  });

  it('does not overwrite a manually edited employee number when suggestion would refresh', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    fixture.componentInstance.onEmployeeNumberChange('CUSTOM-99');
    fixture.detectChanges();

    // Clear the dedupe key as if the company changed, while keeping the manual value.
    (fixture.componentInstance as unknown as { employeeNumberSuggestionRequestKey: string | null }).employeeNumberSuggestionRequestKey =
      null;
    await (
      fixture.componentInstance as unknown as { maybeSuggestEmployeeNumber: (id: string) => Promise<void> }
    ).maybeSuggestEmployeeNumber('le-2');
    fixture.detectChanges();

    expect(fixture.componentInstance.form.controls.employeeNumber.value).toBe('CUSTOM-99');
    httpMock.expectNone((r) => r.url.includes('/employee-number-suggestion'));
  });

  it('blocks Continue when the employee number is already in use', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    await flushPositionsForDepartment([openPosition]);

    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@acme.test',
      employmentType: 'full_time',
      startDate: '2026-08-20',
      workModeId: '1',
      positionId: 'pos-open',
      departmentId: 'dept-1'
    });
    fixture.componentInstance.store.setPosition('pos-open', null);
    fixture.componentInstance.onEmployeeNumberChange('ACME-0001');
    fixture.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 400));
    const availabilityReq = httpMock.expectOne((r) => r.url.includes('/employee-number-availability'));
    availabilityReq.flush({ employeeNumber: 'ACME-0001', available: false });
    await fixture.whenStable();
    fixture.detectChanges();

    const stepBefore = fixture.componentInstance.store.step();
    fixture.componentInstance.goToNextStep();
    fixture.detectChanges();

    expect(fixture.componentInstance.store.step()).toBe(stepBefore);
    expect(fixture.nativeElement.textContent).toContain('This employee number is already in use.');
  });

  it('saves the edited employee number in the draft payload', async () => {
    await setupWithCompany({}, { departments: [engineeringDepartment] });
    await flushPositionsForDepartment([openPosition]);

    fixture.componentInstance.form.patchValue({
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@acme.test',
      employmentType: 'full_time',
      startDate: '2026-08-20',
      workModeId: '1',
      positionId: 'pos-open',
      departmentId: 'dept-1',
      employeeNumber: 'ACME-0042'
    });
    fixture.componentInstance.store.setPosition('pos-open', null);
    fixture.componentInstance.employeeNumberAvailability.set('available');
    fixture.detectChanges();

    const savePromise = fixture.componentInstance.onSaveDraft();
    const saveReq = httpMock.expectOne(`${environment.apiUrl}/onboarding/drafts`);
    expect(saveReq.request.body.employeeNumber).toBe('ACME-0042');
    saveReq.flush({
      id: 'draft-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      workEmail: 'ada@acme.test',
      legalEntityId: 'le-1',
      departmentId: 'dept-1',
      positionId: 'pos-open',
      employmentType: 'full_time',
      startDate: '2026-08-20',
      employeeNumber: 'ACME-0042',
      workModeId: '1',
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'employee_details',
      startedById: 'user-1',
      reportsToEmployeeId: null,
      version: '1'
    });
    await savePromise;
    flushEmployeeNumberAvailabilityRequests();
  });
});
