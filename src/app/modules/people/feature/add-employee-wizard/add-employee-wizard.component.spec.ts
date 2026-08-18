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

  async function setupWithCompany(queryParams: Record<string, string> = {}): Promise<void> {
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
    httpMock.expectOne(`${environment.apiUrl}/org/legal-entities?includeInactive=false`).flush([company]);
    await loadPromise;

    fixture = TestBed.createComponent(AddEmployeeWizardComponent);
    fixture.detectChanges();

    httpMock.expectOne(`${environment.apiUrl}/work-modes`).flush([{ id: 1, code: 'on_site', label: 'On-Site' }]);
    await fixture.whenStable();

    if (!queryParams['draftId']) {
      httpMock.expectOne((r) => r.url.includes('/departments')).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  afterEach(() => httpMock.verify());

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
    httpMock.expectOne(`${environment.apiUrl}/work-modes`).flush([]);

    expect(fixture.nativeElement.textContent).toContain('No company selected');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('shows a precondition empty state when the selected company has zero departments', async () => {
    await setupWithCompany();
    expect(fixture.nativeElement.textContent).toContain('No departments configured');
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
      workModeId: 1,
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
      workModeId: 1,
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
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
      employeeNumber: null,
      workModeId: 1,
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
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
    httpMock.expectOne(`${environment.apiUrl}/work-modes`).flush([]);

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
      employeeNumber: null,
      workModeId: 1,
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'finalized',
      draftReason: 'invitation_sent',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
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
      workModeId: 1,
      selectedTemplateId: null,
      editedTasksJson: null,
      status: 'draft',
      draftReason: 'saved_manually',
      lastSavedStep: 'review_and_submit',
      startedById: 'user-1',
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
    expect(text).toContain('Employee');
    expect(text).toContain('Another person');
    expect(text).toContain('days from employee start date');
    expect(text).toContain('Required');
    expect(text).toContain('Choosing another assignee is not available yet.');
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
});
